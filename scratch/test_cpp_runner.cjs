const fs = require('fs');

const code = `
abstract class Shape {
    public abstract double area();
    
    public String getType() {
        return "Shape";
    }
}

class Circle extends Shape {
    private double radius;
    
    public Circle(double radius) {
        this.radius = radius;
    }
    
    public double area() {
        return Math.PI * radius * radius;
    }
    
    public String getType() {
        return "Circle";
    }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = {new Circle(5)};
        for (Shape s : shapes) {
            System.out.printf("%s area: %.2f\\n", s.getType(), s.area());
        }
    }
}
`;

const extractMainMethodBodyFromRunner = (runnerCode) => {
  const cleanCode = runnerCode.trim();
  const mainMethodRegex = /(?:\bpublic\s+|\bstatic\s+|\bprivate\s+|\bprotected\s+)*void\s+main\s*\([^)]*\)\s*\{/;
  const match = mainMethodRegex.exec(cleanCode);
  if (match) {
    const mainOpenBraceIdx = match.index + match[0].length - 1;
    let mainDepth = 1;
    let mainCloseBraceIdx = -1;
    for (let i = mainOpenBraceIdx + 1; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') mainDepth++;
      else if (cleanCode[i] === '}') {
        mainDepth--;
        if (mainDepth === 0) {
          mainCloseBraceIdx = i;
          break;
        }
      }
    }
    if (mainCloseBraceIdx !== -1) {
      return cleanCode.substring(mainOpenBraceIdx + 1, mainCloseBraceIdx).trim();
    }
  }
  return cleanCode;
};

const extractMainMethodBody = (javaCode) => {
  const cleanCode = javaCode;
  const runnerClassRegex = /(?:public\s+)?class\s+Main\s*(?:extends\s+\w+)?\s*\{/;
  const match = runnerClassRegex.exec(cleanCode);
  if (!match) return { mainBody: "", remainingCode: javaCode };
  const runnerStartIdx = match.index;
  const openBraceIdx = match.index + match[0].length - 1;
  let depth = 1;
  let runnerCloseBraceIdx = -1;
  for (let i = openBraceIdx + 1; i < cleanCode.length; i++) {
    if (cleanCode[i] === '{') depth++;
    else if (cleanCode[i] === '}') {
      depth--;
      if (depth === 0) { runnerCloseBraceIdx = i; break; }
    }
  }
  if (runnerCloseBraceIdx === -1) return { mainBody: "", remainingCode: javaCode };
  const runnerBody = cleanCode.substring(openBraceIdx + 1, runnerCloseBraceIdx);
  const mainMethodRegexSimple = /void\s+main\s*\([^)]*\)\s*\{/;
  const mainMatch = mainMethodRegexSimple.exec(runnerBody);
  if (!mainMatch) {
    const remainingCode = javaCode.substring(0, runnerStartIdx) + javaCode.substring(runnerCloseBraceIdx + 1);
    return { mainBody: "", remainingCode };
  }
  const mainOpenBraceIdx = mainMatch.index + mainMatch[0].length - 1;
  let mainDepth = 1;
  let mainCloseBraceIdx = -1;
  for (let i = mainOpenBraceIdx + 1; i < runnerBody.length; i++) {
    if (runnerBody[i] === '{') mainDepth++;
    else if (runnerBody[i] === '}') { mainDepth--; if (mainDepth === 0) { mainCloseBraceIdx = i; break; } }
  }
  if (mainCloseBraceIdx === -1) {
    const remainingCode = javaCode.substring(0, runnerStartIdx) + javaCode.substring(runnerCloseBraceIdx + 1);
    return { mainBody: "", remainingCode };
  }
  const mainBody = runnerBody.substring(mainOpenBraceIdx + 1, mainCloseBraceIdx).trim();
  const remainingCode = javaCode.substring(0, runnerStartIdx) + javaCode.substring(runnerCloseBraceIdx + 1);
  return { mainBody, remainingCode };
};

const parseClassAttributes = (javaCode) => {
  let cleanCode = javaCode;
  const attributes = [];
  const classDeclRegex = /class\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = classDeclRegex.exec(cleanCode)) !== null) {
    const searchStart = match.index + match[0].length;
    const openBraceIdx = cleanCode.indexOf("{", searchStart);
    if (openBraceIdx === -1) continue;
    let depth = 1;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') depth++;
      else if (cleanCode[i] === '}') { depth--; if (depth === 0) { closeBraceIdx = i; break; } }
    }
    if (closeBraceIdx === -1) continue;
    const classBody = cleanCode.substring(openBraceIdx + 1, closeBraceIdx);
    let accumulated = "";
    let bodyDepth = 0;
    for (let charIdx = 0; charIdx < classBody.length; charIdx++) {
      const char = classBody[charIdx];
      if (char === '{') bodyDepth++;
      else if (char === '}') bodyDepth--;
      else if (char === ';') {
        if (bodyDepth === 0) {
          const stmt = accumulated.trim();
          if (stmt && !stmt.includes('(')) {
            const attrRegex = /^(?:public|private|protected|static|final)?\s*([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)/;
            const m = attrRegex.exec(stmt);
            if (m) {
              const typeCandidate = m[1];
              if (!['return', 'throw', 'new', 'import', 'package', 'class', 'extends', 'implements'].includes(typeCandidate)) {
                attributes.push(m[2]);
              }
            }
          }
          accumulated = "";
        }
      } else {
        if (bodyDepth === 0) accumulated += char;
      }
    }
  }
  return [...new Set(attributes)];
};

const cleanParamTypes = (paramStr) => {
  if (!paramStr || !paramStr.trim()) return "";
  if (paramStr.includes('args') && (paramStr.includes('String') || paramStr.includes('[]'))) return "args";
  return paramStr.split(',').map(p => { const parts = p.trim().split(/\s+/); return parts[parts.length - 1]; }).join(', ');
};

const translateJavaToJs = (javaCode, inputStr) => {
  let code = javaCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  code = code.replace(/@\w+/g, "");

  const stringLiterals = [];
  code = code.replace(/"(\\.|[^"\\])*"/g, (match) => {
    stringLiterals.push(match);
    return `__STR_LITERAL_${stringLiterals.length - 1}__`;
  });
  
  let classesCode = code;
  let mainBody = "";

  const extracted = extractMainMethodBody(code);
  mainBody = extracted.mainBody;
  classesCode = extracted.remainingCode;
  
  let finalMainBody = mainBody;
  code = classesCode;

  code = code.replace(/(?:public|protected|private)?\s*abstract\s+[\w<>[\]]+\s+\w+\s*\([^)]*\)\s*;/g, "");

  const attributes = parseClassAttributes(code);
  
  // Track extends
  const extendsMap = {};
  code = code.replace(/\b(public\s+|abstract\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = `class ${className}`;
    if (parentClass) {
      res += ` extends ${parentClass}`;
      extendsMap[className] = true;
    }
    return res;
  });

  code = code.replace(/\bimplements\s+[\w\s,]+/g, "");

  const classRegex = /class\s+(\w+)/g;
  let match;
  const classNames = [];
  while ((match = classRegex.exec(code)) !== null) {
    classNames.push(match[1]);
  }

  classNames.forEach(className => {
    const constrRegex = new RegExp(`\\b(?:public|private|protected|internal)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(constrRegex, (match, paramStr) => {
      const cleaned = cleanParamTypes(paramStr);
      let res = `constructor(${cleaned}) {`;
      if (extendsMap[className]) {
        res += ` super();`;
      }
      return res;
    });
  });

  code = code.replace(/\b(public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  const types = ['int', 'double', 'float', 'boolean', 'char', 'String', 'auto', 'void', 'Shape', 'Circle', 'Rectangle', 'Object'];
  const allTypes = [...types, ...classNames];
  
  const varDeclRegex = /\b([A-Z][a-zA-Z0-9_]*|int|double|float|boolean|char|byte|short|long|void)(?:<[a-zA-Z0-9_,\s<>?]*>)?(?:\[\])?\s+([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()(?=\s*=[^=]|\s*;|\s*,)/g;
  
  code = code.replace(varDeclRegex, 'let $2');
  finalMainBody = finalMainBody.replace(varDeclRegex, 'let $2');

  allTypes.concat(['void']).forEach(type => {
    const methodRegex = new RegExp(`\\b${type}(?:\\[\\])?\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(methodRegex, (match, methodName, paramStr) => {
      const cleaned = cleanParamTypes(paramStr);
      return `${methodName}(${cleaned}) {`;
    });
  });

  attributes.forEach(attr => {
    const letDeclRegex = new RegExp(`\\blet\\s+${attr}\\s*;`, 'g');
    code = code.replace(letDeclRegex, '');
  });

  attributes.forEach(attr => {
    const regex = new RegExp(`(?<!this\\.|let\\s+|const\\s+|var\\s+|class\\s+|extends\\s+|new\\s+|public\\s+|private\\s+|protected\\s+|\\.\\s*)\\b${attr}\\b`, 'g');
    code = code.replace(regex, `this.${attr}`);
  });

  finalMainBody = finalMainBody.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'stdout.push(sprintf($1));');
  
  let js = `
    const stdout = [];
    const sprintf = (format, ...args) => {
      let str = format;
      args.forEach(arg => {
        if (str.includes("%.2f")) {
          str = str.replace("%.2f", Number(arg).toFixed(2));
        } else if (str.includes("%s")) {
          str = str.replace("%s", String(arg));
        } 
      });
      return str;
    };
  `;

  js += "\n" + code;
  js += `\n// Execute main\n(function() {\n${finalMainBody}\n})();`;
  js += `\nreturn stdout.join("");`;

  stringLiterals.forEach((str, idx) => {
    js = js.replace(new RegExp(`__STR_LITERAL_${idx}__`, 'g'), str);
  });
  return js;
};

console.log(translateJavaToJs(code, ""));
try {
  const res = new Function(translateJavaToJs(code, ""))();
  console.log("OUT:", res);
} catch (e) {
  console.log("ERR:", e);
}
