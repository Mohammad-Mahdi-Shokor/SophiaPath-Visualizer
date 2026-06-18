import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Box,
  Typography,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Terminal as TerminalIcon,
  Refresh as ResetIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import html2canvas from 'html2canvas';

export const translateCppToJs = (cppCode, inputStr) => {
  // 1. Clean comments
  let code = cppCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  // 2. Find int main()
  const mainBodyMatch = /int\s+main\s*\(\s*\)\s*\{([\s\S]*)\}/.exec(code);
  if (!mainBodyMatch) {
    throw new Error("Missing int main() structure.");
  }
  let body = mainBodyMatch[1].trim();

  // 3. Remove standard return statement
  body = body.replace(/\breturn\s+0\s*;/g, "");

  // 4. Set up helper variables and context in the generated JS
  let js = `
    const stdout = [];
    const inputTokens = ${JSON.stringify(inputStr.trim().split(/\s+/).filter(t => t.length > 0))};
    let inputPtr = 0;
    
    const nextInputToken = () => {
      if (inputPtr >= inputTokens.length) return "";
      return inputTokens[inputPtr++];
    };

    const readInput = () => {
      const token = nextInputToken();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(token)) {
        return parseFloat(token);
      }
      return token;
    };
  `;

  // 5. Clean namespace prefixes
  body = body.replace(/std::cout/g, "cout").replace(/std::cin/g, "cin").replace(/std::endl/g, "endl");

  // 6. Translate C++ variable declarations
  const types = ['int', 'double', 'float', 'string', 'bool', 'char', 'auto'];
  types.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'g');
    body = body.replace(regex, 'let');
  });

  // 7. Translate cin >> var1 >> var2;
  const cinRegex = /cin\s*(>>\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)+;/g;
  body = body.replace(cinRegex, (match) => {
    const vars = match.split('>>').slice(1).map(v => v.replace(/;$/, '').trim());
    return vars.map(v => `${v} = readInput();`).join(' ');
  });

  // 8. Translate cout << var1 << "string" << endl;
  const coutRegex = /cout\s*(<<\s*[^;]+)+;/g;
  body = body.replace(coutRegex, (match) => {
    const parts = match.split('<<').slice(1).map(p => p.replace(/;$/, '').trim());
    const pushes = parts.map(part => {
      if (part === 'endl' || part === '"\\n"' || part === "'\\n'") {
        return `stdout.push("\\n");`;
      }
      return `stdout.push(${part});`;
    });
    return pushes.join(' ');
  });

  // Append translated body
  js += "\n" + body;
  js += `\nreturn stdout.join("");`;

  return js;
};

const parseClassAttributes = (javaCode) => {
  let cleanCode = javaCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 
  
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
      else if (cleanCode[i] === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    if (closeBraceIdx === -1) continue;
    
    const classBody = cleanCode.substring(openBraceIdx + 1, closeBraceIdx);
    
    let accumulated = "";
    let bodyDepth = 0;
    
    for (let charIdx = 0; charIdx < classBody.length; charIdx++) {
      const char = classBody[charIdx];
      if (char === '{') {
        bodyDepth++;
      } else if (char === '}') {
        bodyDepth--;
      } else if (char === ';') {
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
        if (bodyDepth === 0) {
          accumulated += char;
        }
      }
    }
  }
  return [...new Set(attributes)];
};

const cleanParamTypes = (paramStr) => {
  if (!paramStr || !paramStr.trim()) return "";
  if (paramStr.includes('args') && (paramStr.includes('String') || paramStr.includes('[]'))) {
    return "args";
  }
  return paramStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    return parts[parts.length - 1];
  }).join(', ');
};

const extractMainMethodBodyFromRunner = (runnerCode) => {
  const cleanCode = runnerCode.trim();
  
  // Try to find void main method
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
  
  // Try to find class Runner body
  const runnerClassRegex = /(?:public\s+)?class\s+Runner\s*(?:extends\s+\w+)?\s*\{/;
  const classMatch = runnerClassRegex.exec(cleanCode);
  if (classMatch) {
    const openBraceIdx = classMatch.index + classMatch[0].length - 1;
    let depth = 1;
    let closeBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < cleanCode.length; i++) {
      if (cleanCode[i] === '{') depth++;
      else if (cleanCode[i] === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }
    if (closeBraceIdx !== -1) {
      const runnerBody = cleanCode.substring(openBraceIdx + 1, closeBraceIdx).trim();
      const subMatch = mainMethodRegex.exec(runnerBody);
      if (subMatch) {
        const subOpenBraceIdx = subMatch.index + subMatch[0].length - 1;
        let subDepth = 1;
        let subCloseBraceIdx = -1;
        for (let i = subOpenBraceIdx + 1; i < runnerBody.length; i++) {
          if (runnerBody[i] === '{') subDepth++;
          else if (runnerBody[i] === '}') {
            subDepth--;
            if (subDepth === 0) {
              subCloseBraceIdx = i;
              break;
            }
          }
        }
        if (subCloseBraceIdx !== -1) {
          return runnerBody.substring(subOpenBraceIdx + 1, subCloseBraceIdx).trim();
        }
      }
      return runnerBody;
    }
  }
  
  return cleanCode;
};

const extractMainMethodBody = (javaCode) => {
  const cleanCode = javaCode;
  const runnerClassRegex = /(?:public\s+)?class\s+Runner\s*(?:extends\s+\w+)?\s*\{/;
  const match = runnerClassRegex.exec(cleanCode);
  if (!match) {
    return { mainBody: "", remainingCode: javaCode };
  }
  
  const runnerStartIdx = match.index;
  const openBraceIdx = match.index + match[0].length - 1;
  
  let depth = 1;
  let runnerCloseBraceIdx = -1;
  for (let i = openBraceIdx + 1; i < cleanCode.length; i++) {
    if (cleanCode[i] === '{') depth++;
    else if (cleanCode[i] === '}') {
      depth--;
      if (depth === 0) {
        runnerCloseBraceIdx = i;
        break;
      }
    }
  }
  
  if (runnerCloseBraceIdx === -1) {
    return { mainBody: "", remainingCode: javaCode };
  }
  
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
    else if (runnerBody[i] === '}') {
      mainDepth--;
      if (mainDepth === 0) {
        mainCloseBraceIdx = i;
        break;
      }
    }
  }
  
  if (mainCloseBraceIdx === -1) {
    const remainingCode = javaCode.substring(0, runnerStartIdx) + javaCode.substring(runnerCloseBraceIdx + 1);
    return { mainBody: "", remainingCode };
  }
  
  const mainBody = runnerBody.substring(mainOpenBraceIdx + 1, mainCloseBraceIdx).trim();
  const remainingCode = javaCode.substring(0, runnerStartIdx) + javaCode.substring(runnerCloseBraceIdx + 1);
  
  return { mainBody, remainingCode };
};

const extractMethodBody = (methodStr, startIndex) => {
  const openBraceIdx = methodStr.indexOf('{', startIndex);
  if (openBraceIdx === -1) return null;
  let depth = 1;
  for (let i = openBraceIdx + 1; i < methodStr.length; i++) {
    if (methodStr[i] === '{') depth++;
    else if (methodStr[i] === '}') {
      depth--;
      if (depth === 0) return { body: methodStr.substring(openBraceIdx + 1, i), closeIdx: i };
    }
  }
  return null;
};

const processMethodsAndConstructors = (code, classNames, allTypes, extendsMap) => {
  let modifiedCode = code;

  // Process constructors
  classNames.forEach(className => {
    const constrRegex = new RegExp(`\\b(?:(?:public|private|protected|internal)\\s+)*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    let match;
    while ((match = constrRegex.exec(modifiedCode)) !== null) {
      const paramStr = match[1];
      const bodyInfo = extractMethodBody(modifiedCode, match.index);
      
      if (bodyInfo) {
        let body = bodyInfo.body;
        let cleanedParams = [];
        
        if (paramStr.trim()) {
          const params = paramStr.split(',').map(p => {
            const parts = p.trim().split(/\s+/);
            return parts[parts.length - 1]; // get the parameter name
          });
          params.forEach(p => {
            if (p === 'args') {
               cleanedParams.push(p);
               return; // skip main args
            }
            const pRegex = new RegExp(`(?<!this\\.|\\.)\\b${p}\\b`, 'g');
            body = body.replace(pRegex, `__p_${p}`);
            cleanedParams.push(`__p_${p}`);
          });
        }
        
        let newMethod = `constructor(${cleanedParams.join(', ')}) {`;
        if (extendsMap[className]) {
          newMethod += ' super();';
        }
        newMethod += body + '}';
        
        modifiedCode = modifiedCode.substring(0, match.index) + newMethod + modifiedCode.substring(bodyInfo.closeIdx + 1);
        constrRegex.lastIndex = match.index + newMethod.length;
      }
    }
  });

  // Process normal methods
  allTypes.concat(['void']).forEach(type => {
    const methodRegex = new RegExp(`\\b(?:(?:public|private|protected|static|final|abstract|synchronized|transient|volatile)\\s+)*${type}(?:\\[\\]|\\<[^>]*\\>)?\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    let match;
    while ((match = methodRegex.exec(modifiedCode)) !== null) {
      const methodName = match[1];
      const paramStr = match[2];
      
      if (classNames.includes(methodName) || ['if', 'while', 'for', 'switch'].includes(methodName)) {
        methodRegex.lastIndex = match.index + match[0].length;
        continue;
      }
      
      const bodyInfo = extractMethodBody(modifiedCode, match.index);
      if (bodyInfo) {
        let body = bodyInfo.body;
        let cleanedParams = [];
        
        if (paramStr.trim()) {
          const params = paramStr.split(',').map(p => {
             const parts = p.trim().split(/\s+/);
             return parts[parts.length - 1];
          });
          params.forEach(p => {
            if (p === 'args' || p === '') {
               if(p) cleanedParams.push(p);
               return;
            }
            const pRegex = new RegExp(`(?<!this\\.|\\.)\\b${p}\\b`, 'g');
            body = body.replace(pRegex, `__p_${p}`);
            cleanedParams.push(`__p_${p}`);
          });
        }
        
        const newMethod = `${methodName}(${cleanedParams.join(', ')}) {${body}}`;
        modifiedCode = modifiedCode.substring(0, match.index) + newMethod + modifiedCode.substring(bodyInfo.closeIdx + 1);
        methodRegex.lastIndex = match.index + newMethod.length;
      }
    }
  });

  return modifiedCode;
};

export const translateJavaToJs = (javaCode, inputStr) => {
  let code = javaCode.replace(/\/\/ === RUNNER_SECTION_START ===/g, "__RUNNER_SECTION_START__");
  code = code
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  code = code.replace(/@\w+/g, "");

  // Mask string literals
  const stringLiterals = [];
  code = code.replace(/"(\\.|[^"\\])*"/g, (match) => {
    stringLiterals.push(match);
    return `__STR_LITERAL_${stringLiterals.length - 1}__`;
  });
  code = code.replace(/'(\\.|[^'\\])*'/g, (match) => {
    stringLiterals.push(match);
    return `__STR_LITERAL_${stringLiterals.length - 1}__`;
  });

  // Extract main method
  let classesCode = code;
  let mainBody = "";

  if (code.includes("__RUNNER_SECTION_START__")) {
    const parts = code.split("__RUNNER_SECTION_START__");
    classesCode = parts[0];
    const runnerCode = parts[1] || "";
    mainBody = extractMainMethodBodyFromRunner(runnerCode);
  } else {
    // Fallback: extract from combined code
    const extracted = extractMainMethodBody(code);
    mainBody = extracted.mainBody;
    classesCode = extracted.remainingCode;
  }
  
  let finalMainBody = mainBody;
  code = classesCode;

  // Strip abstract method declarations before doing anything else
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

  const types = [
    'int', 'double', 'float', 'boolean', 'char', 'String', 'auto', 
    'void', 'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet', 'Object',
    'Shape', 'Circle', 'Rectangle', 'Employee', 'Contractor', 'Appliance', 
    'WashingMachine', 'Refrigerator', 'Product', 'Payable', 'BankAccount', 'Scanner'
  ];
  const allTypes = [...types, ...classNames];
  
  code = processMethodsAndConstructors(code, classNames, allTypes, extendsMap);

  code = code.replace(/\b(public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  const varDeclRegex = /\b([A-Z][a-zA-Z0-9_]*|int|double|float|boolean|char|byte|short|long|void)(?:<[a-zA-Z0-9_,\s<>?]*>)?(?:\[\])?\s+([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()(?=\s*=[^=]|\s*;|\s*,)/g;
  
  code = code.replace(varDeclRegex, 'let $2');
  finalMainBody = finalMainBody.replace(varDeclRegex, 'let $2');

  // Strip let declarations of attributes inside class body
  attributes.forEach(attr => {
    const letDeclRegex = new RegExp(`\\blet\\s+${attr}\\s*;`, 'g');
    code = code.replace(letDeclRegex, '');
  });

  // Prepend this. to attributes inside class methods, avoiding constructor/parameter/other declarations
  attributes.forEach(attr => {
    const regex = new RegExp(`(?<!this\\.|let\\s+|const\\s+|var\\s+|class\\s+|extends\\s+|new\\s+|public\\s+|private\\s+|protected\\s+|\\.\\s*)\\b${attr}\\b`, 'g');
    code = code.replace(regex, `this.${attr}`);
  });

  // Apply printing and scanner translation to finalMainBody
  finalMainBody = finalMainBody.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'stdout.push($1); stdout.push("\\n");');
  finalMainBody = finalMainBody.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'stdout.push($1);');
  finalMainBody = finalMainBody.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'stdout.push(sprintf($1));');
  finalMainBody = finalMainBody.replace(/\be\.getMessage\(\)/g, "e.message");
  finalMainBody = finalMainBody.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  finalMainBody = finalMainBody.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "readInput()");

  code = code.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'stdout.push($1); stdout.push("\\n");');
  code = code.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'stdout.push($1);');
  code = code.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'stdout.push(sprintf($1));');

  code = code.replace(/\be\.getMessage\(\)/g, "e.message");
  code = code.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  code = code.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "readInput()");

  // Cleanup duplicate super() injected by extends logic if the user already wrote super()
  code = code.replace(/super\(\);\s*super\(/g, "super(");

  let js = `
    const stdout = [];
    const inputTokens = ${JSON.stringify(inputStr.trim().split(/\s+/).filter(t => t.length > 0))};
    let inputPtr = 0;
    
    const nextInputToken = () => {
      if (inputPtr >= inputTokens.length) return "";
      return inputTokens[inputPtr++];
    };

    const readInput = () => {
      const token = nextInputToken();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(token)) {
        return parseFloat(token);
      }
      return token;
    };

    const sprintf = (format, ...args) => {
      let str = format;
      args.forEach(arg => {
        if (str.includes("%.2f")) {
          str = str.replace("%.2f", Number(arg).toFixed(2));
        } else if (str.includes("%.1f")) {
          str = str.replace("%.1f", Number(arg).toFixed(1));
        } else if (str.includes("%s")) {
          str = str.replace("%s", String(arg));
        } else if (str.includes("%d")) {
          str = str.replace("%d", Math.round(Number(arg)));
        } else {
          str = str.replace(/%[a-zA-Z]/, String(arg));
        }
      });
      return str;
    };
  `;

  js += "\n" + code;
  js += `\n// Execute main\n(function() {\n${finalMainBody}\n})();`;
  js += `\nreturn stdout.join("");`;

  // Restore string literals
  stringLiterals.forEach((str, idx) => {
    js = js.replace(new RegExp(`__STR_LITERAL_${idx}__`, 'g'), str);
  });

  return js;
};

// eslint-disable-next-line react-refresh/only-export-components
export const simulateCodeExecution = (code, inputStr = "", language = "cpp") => {
  try {
    const isJava = language.toLowerCase() === 'java' || code.includes('class ') || code.includes('System.out');
    const jsCode = isJava ? translateJavaToJs(code, inputStr) : translateCppToJs(code, inputStr);
    const result = new Function(jsCode)();
    return {
      output: String(result),
      isError: false
    };
  } catch (err) {
    return {
      output: `Compilation / Execution Error: ${err.message}`,
      isError: true
    };
  }
};

export const translateCppToJsAsync = (cppCode) => {
  // 1. Clean comments
  let code = cppCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  // 2. Find int main()
  const mainBodyMatch = /int\s+main\s*\(\s*\)\s*\{([\s\S]*)\}/.exec(code);
  if (!mainBodyMatch) {
    throw new Error("Missing int main() structure.");
  }
  let body = mainBodyMatch[1].trim();

  // 3. Remove standard return statement
  body = body.replace(/\breturn\s+0\s*;/g, "");

  // 4. Set up helper variables and context in the generated JS
  let js = `
    const readInput = async () => {
      const token = await onReadInput();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(String(token))) {
        return parseFloat(token);
      }
      return token;
    };
  `;

  // 5. Clean namespace prefixes
  body = body.replace(/std::cout/g, "cout").replace(/std::cin/g, "cin").replace(/std::endl/g, "endl");

  // 6. Translate C++ variable declarations
  const types = ['int', 'double', 'float', 'string', 'bool', 'char', 'auto'];
  types.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'g');
    body = body.replace(regex, 'let');
  });

  // 7. Translate cin >> var1 >> var2;
  const cinRegex = /cin\s*(>>\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)+;/g;
  body = body.replace(cinRegex, (match) => {
    const vars = match.split('>>').slice(1).map(v => v.replace(/;$/, '').trim());
    return vars.map(v => `${v} = await readInput();`).join(' ');
  });

  // 8. Translate cout << var1 << "string" << endl;
  const coutRegex = /cout\s*(<<\s*[^;]+)+;/g;
  body = body.replace(coutRegex, (match) => {
    const parts = match.split('<<').slice(1).map(p => p.replace(/;$/, '').trim());
    const pushes = parts.map(part => {
      if (part === 'endl' || part === '"\\n"' || part === "'\\n'") {
        return `onStdout("\\n");`;
      }
      return `onStdout(${part});`;
    });
    return pushes.join(' ');
  });

  // Append translated body
  js += "\n" + body;

  return js;
};

export const translateJavaToJsAsync = (javaCode) => {
  let code = javaCode.replace(/\/\/ === RUNNER_SECTION_START ===/g, "__RUNNER_SECTION_START__");
  code = code
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  code = code.replace(/@\w+/g, "");

  const stringLiterals = [];
  code = code.replace(/"(\\.|[^"\\])*"/g, (match) => {
    stringLiterals.push(match);
    return `__STR_LITERAL_${stringLiterals.length - 1}__`;
  });
  code = code.replace(/'(\\.|[^'\\])*'/g, (match) => {
    stringLiterals.push(match);
    return `__STR_LITERAL_${stringLiterals.length - 1}__`;
  });

  let classesCode = code;
  let mainBody = "";

  if (code.includes("__RUNNER_SECTION_START__")) {
    const parts = code.split("__RUNNER_SECTION_START__");
    classesCode = parts[0];
    const runnerCode = parts[1] || "";
    mainBody = extractMainMethodBodyFromRunner(runnerCode);
  } else {
    const extracted = extractMainMethodBody(code);
    mainBody = extracted.mainBody;
    classesCode = extracted.remainingCode;
  }
  
  let finalMainBody = mainBody;
  code = classesCode;

  code = code.replace(/(?:public|protected|private)?\s*abstract\s+[\w<>[\]]+\s+\w+\s*\([^)]*\)\s*;/g, "");

  const attributes = parseClassAttributes(code);
  
  const extendsMapAsync = {};
  code = code.replace(/\b(public\s+|abstract\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = `class ${className}`;
    if (parentClass) {
      res += ` extends ${parentClass}`;
      extendsMapAsync[className] = true;
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

  const types = [
    'int', 'double', 'float', 'boolean', 'char', 'String', 'auto', 
    'void', 'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet', 'Object',
    'Shape', 'Circle', 'Rectangle', 'Employee', 'Contractor', 'Appliance', 
    'WashingMachine', 'Refrigerator', 'Product', 'Payable', 'BankAccount', 'Scanner'
  ];
  const allTypes = [...types, ...classNames];
  
  code = processMethodsAndConstructors(code, classNames, allTypes, extendsMapAsync);

  code = code.replace(/\b(public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  const varDeclRegex = /\b([A-Z][a-zA-Z0-9_]*|int|double|float|boolean|char|byte|short|long|void)(?:<[a-zA-Z0-9_,\s<>?]*>)?(?:\[\])?\s+([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()(?=\s*=[^=]|\s*;|\s*,)/g;
  
  code = code.replace(varDeclRegex, 'let $2');
  finalMainBody = finalMainBody.replace(varDeclRegex, 'let $2');

  attributes.forEach(attr => {
    const letDeclRegex = new RegExp(`\\blet\\s+${attr}\\s*;`, 'g');
    code = code.replace(letDeclRegex, '');
  });

  attributes.forEach(attr => {
    const regex = new RegExp(`(?<!this\\.|let\\s+|const\\s+|var\\s+|class\\s+|extends\\s+|new\\s+|public\\s+|private\\s+|protected\\s+|\\.\\s*)\\b${attr}\\b`, 'g');
    code = code.replace(regex, `this.${attr}`);
  });

  finalMainBody = finalMainBody.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'onStdout($1); onStdout("\\n");');
  finalMainBody = finalMainBody.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'onStdout($1);');
  finalMainBody = finalMainBody.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'onStdout(sprintf($1));');
  finalMainBody = finalMainBody.replace(/\be\.getMessage\(\)/g, "e.message");
  finalMainBody = finalMainBody.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  finalMainBody = finalMainBody.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "await readInput()");

  code = code.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'onStdout($1); onStdout("\\n");');
  code = code.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'onStdout($1);');
  code = code.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'onStdout(sprintf($1));');
  code = code.replace(/\be\.getMessage\(\)/g, "e.message");
  code = code.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  code = code.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "await readInput()");

  // Cleanup duplicate super() injected by extends logic if the user already wrote super()
  code = code.replace(/super\(\);\s*super\(/g, "super(");

  let js = `
    const readInput = async () => {
      const token = await onReadInput();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(String(token))) {
        return parseFloat(token);
      }
      return token;
    };

    const sprintf = (format, ...args) => {
      let str = format;
      args.forEach(arg => {
        if (str.includes("%.2f")) {
          str = str.replace("%.2f", Number(arg).toFixed(2));
        } else if (str.includes("%.1f")) {
          str = str.replace("%.1f", Number(arg).toFixed(1));
        } else if (str.includes("%s")) {
          str = str.replace("%s", String(arg));
        } else if (str.includes("%d")) {
          str = str.replace("%d", Math.round(Number(arg)));
        } else {
          str = str.replace(/%[a-zA-Z]/, String(arg));
        }
      });
      return str;
    };
  `;

  js += "\n" + code;
  js += `\n// Execute main\nawait (async function() {\n${finalMainBody}\n})();`;

  stringLiterals.forEach((str, idx) => {
    js = js.replace(new RegExp(`__STR_LITERAL_${idx}__`, 'g'), str);
  });

  return js;
};

export const executeCodeAsync = async (code, language, onStdout, onReadInput) => {
  const isJava = language.toLowerCase() === 'java' || code.includes('class ') || code.includes('System.out');
  const jsCode = isJava ? translateJavaToJsAsync(code) : translateCppToJsAsync(code);
  const runnerFn = new Function('onStdout', 'onReadInput', `
    return (async () => {
      \n${jsCode}\n
    })();
  `);
  return runnerFn(onStdout, onReadInput);
};
const normalizeCppCode = (cppCode) => {
  // Strip comments
  let code = cppCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 
  
  // Wrap single-statement if/while/for/else without braces in explicit braces
  // e.g. "if (cond) stmt;" -> "if (cond) { stmt; }"
  code = code.replace(/(\b(if|while|for)\s*\([^)]+\))\s*([^{;\s\n][^;\n]+;)/g, '$1 { $3 }');
  code = code.replace(/(\belse\b)\s*([^{;\s\n][^;\n]+;)/g, '$1 { $2 }');

  // Format braces to be on their own lines
  code = code.replace(/\{/g, '\n{\n').replace(/\}/g, '\n}\n');
  
  // Split statements by semicolon, but not inside for (...) or inside string literals
  let result = "";
  let inParentheses = 0;
  let inString = false;
  let stringChar = null;
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    
    // Handle string literal boundaries
    if ((char === '"' || char === "'") && code[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
    
    if (!inString) {
      if (char === '(') inParentheses++;
      else if (char === ')') inParentheses--;
    }
    
    if (char === ';' && inParentheses === 0 && !inString) {
      result += ';\n';
    } else {
      result += char;
    }
  }
  
  return result
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

const convertCppToPseudocode = (cppCode) => {
  if (!cppCode) return 'START\nEND';
  
  const lines = normalizeCppCode(cppCode);
  const pseudocode = ['START'];
  const stack = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip boilerplates
    if (
      line.startsWith('#') || 
      line.startsWith('using') || 
      line.startsWith('int main') || 
      line === '{'
    ) {
      continue;
    }
    
    // Stop at return
    if (line.startsWith('return')) {
      continue;
    }
    
    // Handle block closing
    if (line === '}') {
      const nextLine = lines[i + 1] ? lines[i + 1].trim().toLowerCase() : '';
      const isElse = nextLine.startsWith('else');
      
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top === 'IF') {
          if (!isElse) {
            stack.pop();
            pseudocode.push('END IF');
          }
        } else if (top === 'WHILE') {
          stack.pop();
          pseudocode.push('END WHILE');
        } else if (top === 'FOR') {
          stack.pop();
          pseudocode.push('END FOR');
        } else {
          stack.pop();
        }
      }
      continue;
    }
    
    // Clean standard prefixes std:: and spaces
    let parsed = line.replace(/std::/g, '').trim();
    
    // Convert IF statement
    if (parsed.startsWith('if')) {
      const condMatch = /if\s*\((.*)\)/.exec(parsed);
      const cond = condMatch ? condMatch[1].trim() : parsed.replace(/^if\s*/, '');
      stack.push('IF');
      pseudocode.push(`IF ${cond}`);
      continue;
    }
    
    // Convert ELSE IF statement
    if (parsed.startsWith('else if')) {
      const condMatch = /else if\s*\((.*)\)/.exec(parsed);
      const cond = condMatch ? condMatch[1].trim() : parsed.replace(/^else if\s*/, '');
      pseudocode.push(`ELSE IF ${cond}`);
      continue;
    }
    
    // Convert ELSE statement
    if (parsed.startsWith('else')) {
      pseudocode.push('ELSE');
      continue;
    }
    
    // Convert WHILE statement
    if (parsed.startsWith('while')) {
      const condMatch = /while\s*\((.*)\)/.exec(parsed);
      const cond = condMatch ? condMatch[1].trim() : parsed.replace(/^while\s*/, '');
      stack.push('WHILE');
      pseudocode.push(`WHILE ${cond}`);
      continue;
    }
    
    // Convert FOR statement
    if (parsed.startsWith('for')) {
      const condMatch = /for\s*\((.*)\)/.exec(parsed);
      const cond = condMatch ? condMatch[1].trim() : parsed.replace(/^for\s*/, '');
      stack.push('FOR');
      pseudocode.push(`FOR ${cond}`);
      continue;
    }
    
    // Convert declarations like int x = 10;
    if (/^(int|double|float|string|bool|char|auto)\s+/.test(parsed)) {
      parsed = parsed.replace(/^(int|double|float|string|bool|char|auto)\s+/, 'DECLARE ');
    }
    
    // Convert cout and printf
    if (parsed.startsWith('cout')) {
      const parts = parsed.split('<<').slice(1);
      const outputParts = parts
        .map(p => p.trim().replace(/;$/, ''))
        .filter(p => p !== 'endl' && p !== '"\\n"' && p !== "'\\n'");
      if (outputParts.length > 0) {
        parsed = `PRINT ${outputParts.join(' + ')}`;
      } else {
        continue;
      }
    } else if (parsed.startsWith('printf')) {
      const printfMatch = /printf\s*\((.*)\)/.exec(parsed);
      if (printfMatch) {
        parsed = `PRINT ${printfMatch[1].trim()}`;
      }
    }
    
    // Convert cin
    if (parsed.startsWith('cin')) {
      const parts = parsed.split('>>').slice(1).map(p => p.trim().replace(/;$/, ''));
      parsed = `INPUT ${parts.join(', ')}`;
    }
    
    // Clean up trailing semicolons
    parsed = parsed.replace(/;$/, '').trim();
    
    if (parsed) {
      pseudocode.push(parsed);
    }
  }
  
  // Empty remaining stack items just in case
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === 'IF') pseudocode.push('END IF');
    else if (top === 'WHILE') pseudocode.push('END WHILE');
    else if (top === 'FOR') pseudocode.push('END FOR');
  }
  
  pseudocode.push('END');
  return pseudocode.join('\n');
};

const parsePseudocodeToTree = (pseudocodeText) => {
  if (!pseudocodeText) return [];
  
  const lines = pseudocodeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const parseHelper = (index) => {
    const result = [];
    let i = index;
    
    while (i < lines.length) {
      const line = lines[i];
      const upper = line.toUpperCase();
      
      if (
        upper.startsWith('ELSE IF') || 
        upper.startsWith('ELSE') || 
        upper.startsWith('END IF') || 
        upper.startsWith('END WHILE') || 
        upper.startsWith('END FOR') || 
        upper.startsWith('END LOOP')
      ) {
        break;
      }
      
      if (upper.startsWith('IF ')) {
        const condition = line.replace(/^IF\s+/i, '').trim();
        const node = {
          type: 'branch',
          condition: condition,
          trueBranch: [],
          falseBranch: [],
          color: '#FF9F43'
        };
        
        i++; // move past IF
        
        // Parse true branch
        const trueRes = parseHelper(i);
        node.trueBranch = trueRes.nodes;
        i = trueRes.nextIndex;
        
        // Now we are at ELSE IF, ELSE, or END IF
        if (i < lines.length && lines[i].toUpperCase().startsWith('ELSE IF')) {
          const elseIfLine = lines[i].replace(/^ELSE IF\s+/i, 'IF ');
          lines[i] = elseIfLine;
          
          const falseRes = parseHelper(i);
          node.falseBranch = falseRes.nodes;
          i = falseRes.nextIndex;
        } else if (i < lines.length && lines[i].toUpperCase() === 'ELSE') {
          i++; // move past ELSE
          const falseRes = parseHelper(i);
          node.falseBranch = falseRes.nodes;
          i = falseRes.nextIndex;
        }
        
        // Move past END IF
        if (i < lines.length && lines[i].toUpperCase() === 'END IF') {
          i++;
        }
        
        result.push(node);
      } else if (upper.startsWith('WHILE ') || upper.startsWith('FOR ') || upper.startsWith('LOOP ')) {
        const condition = line;
        const node = {
          type: 'loop',
          condition: condition,
          body: [],
          color: '#8B5CF6'
        };
        
        i++; // move past WHILE/FOR/LOOP
        
        // Parse loop body
        const bodyRes = parseHelper(i);
        node.body = bodyRes.nodes;
        i = bodyRes.nextIndex;
        
        // Move past END WHILE / END FOR / END LOOP
        if (i < lines.length && (
          lines[i].toUpperCase().startsWith('END WHILE') || 
          lines[i].toUpperCase().startsWith('END FOR') || 
          lines[i].toUpperCase().startsWith('END LOOP')
        )) {
          i++;
        }
        
        result.push(node);
      } else if (upper === 'END WHILE' || upper === 'END FOR' || upper === 'END LOOP') {
        i++; // skip loop endings
      } else {
        let type = 'process';
        let label = line;
        let color = 'rgba(255, 255, 255, 0.4)';
        let shape = 'rectangle';
        
        if (upper.startsWith('START') || upper.startsWith('BEGIN')) {
          type = 'terminal';
          label = 'START';
          color = '#3DDC97'; // green
          shape = 'oval';
        } else if (upper.startsWith('END') || upper.startsWith('STOP')) {
          type = 'terminal';
          label = 'END';
          color = '#FF647C'; // red
          shape = 'oval';
        } else if (
          upper.startsWith('PRINT') || 
          upper.startsWith('OUTPUT') || 
          upper.startsWith('DISPLAY') || 
          upper.startsWith('WRITE') || 
          upper.startsWith('INPUT') || 
          upper.startsWith('READ') || 
          upper.startsWith('GET')
        ) {
          type = 'io';
          label = line;
          color = '#1CB0F6'; // light blue
          shape = 'parallelogram';
        }
        
        result.push({ type, label, color, shape });
        i++;
      }
    }
    
    return { nodes: result, nextIndex: i };
  };
  
  return parseHelper(0).nodes;
};
const DEFAULT_STARTER = `#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = 20;
    int sum = x + y;
    
    cout << "Value of x: " << x << endl;
    cout << "Value of y: " << y << endl;
    cout << "Sum is: " << sum << endl;
    
    return 0;
}`;

export const CppPlaygroundDialog = ({ open, onClose, initialCode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeTab, setActiveTab] = useState('compiler'); // 'compiler' | 'flowchart'
  const [code, setCode] = useState(initialCode || DEFAULT_STARTER);
  const [pseudocode, setPseudocode] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('Terminal ready. Click "RUN CODE" to execute.');
  const [isRunning, setIsRunning] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [currentInputVal, setCurrentInputVal] = useState('');
  const inputResolverRef = useRef(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    } else {
      setCode(DEFAULT_STARTER);
    }
    setTerminalOutput('Terminal ready. Click "RUN CODE" to execute.');
    setActiveTab('compiler');
    setPseudocode('');
  }, [initialCode, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRun = async () => {
    setIsRunning(true);
    setTerminalOutput('');
    setIsWaitingForInput(false);
    setCurrentInputVal('');
    
    try {
      const isJava = code.includes('class ') || code.includes('System.out') || code.includes('public static void main');
      const lang = isJava ? 'java' : 'cpp';
      
      const onStdout = (text) => {
        setTerminalOutput(prev => prev + text);
      };
      
      const onReadInput = () => {
        return new Promise((resolve) => {
          setIsWaitingForInput(true);
          inputResolverRef.current = resolve;
        });
      };
      
      await executeCodeAsync(code, lang, onStdout, onReadInput);
      
    } catch (err) {
      setTerminalOutput(prev => prev + `\n❌ COMPILATION / RUNTIME ERROR: ${err.message}\n`);
    } finally {
      setIsRunning(false);
      setIsWaitingForInput(false);
    }
  };

  const handleInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const val = currentInputVal;
      setTerminalOutput(prev => prev + val + '\n');
      setCurrentInputVal('');
      setIsWaitingForInput(false);
      if (inputResolverRef.current) {
        inputResolverRef.current(val);
      }
    }
  };

  const handleDownloadPng = async () => {
    try {
      const element = document.getElementById('flowchart-capture-content');
      if (!element) return;
      
      const canvas = await html2canvas(element, {
        backgroundColor: theme.palette.mode === 'dark' ? '#0A0C16' : '#FAFAFC',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = 'flowchart.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting flowchart to PNG:', err);
      alert('Failed to generate PNG of flowchart: ' + err.message);
    }
  };

  const handleReset = () => {
    if (activeTab === 'compiler') {
      setCode(initialCode || DEFAULT_STARTER);
      setTerminalOutput('Code reset to template.');
    } else {
      setPseudocode(convertCppToPseudocode(code));
    }
  };

  const handleCopy = () => {
    const textToCopy = activeTab === 'compiler' ? code : pseudocode;
    navigator.clipboard.writeText(textToCopy);
  };

  const handleGenerateFromCpp = () => {
    setPseudocode(convertCppToPseudocode(code));
  };

  const renderDownArrow = () => (
    <svg width="24" height="34" viewBox="0 0 24 34" style={{ margin: '4px 0', color: 'rgba(255,255,255,0.15)' }}>
      <path d="M12 0L12 30" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3" />
      <path d="M7 25L12 30L17 25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const renderStandardNode = (node) => {
    if (node.shape === 'oval') {
      return (
        <Box
          style={{
            width: '130px',
            height: '42px',
            borderRadius: '21px',
            border: `2px solid ${node.color}`,
            background: `rgba(${node.color === '#3DDC97' ? '61,220,151' : '255,100,124'}, 0.12)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 15px rgba(${node.color === '#3DDC97' ? '61,220,151' : '255,100,124'}, 0.15)`
          }}
        >
          <Typography variant="body2" style={{ fontFamily: '"Roboto Mono", monospace', fontWeight: 800, color: '#fff' }}>
            {node.label}
          </Typography>
        </Box>
      );
    } else if (node.shape === 'parallelogram') {
      return (
        <Box
          style={{
            width: '190px',
            height: '48px',
            background: 'rgba(28, 176, 246, 0.08)',
            border: `2.5px solid ${node.color}`,
            transform: 'skewX(-15deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontFamily: '"Roboto Mono", monospace',
              fontWeight: 700,
              color: '#fff',
              transform: 'skewX(15deg)',
              padding: '0 12px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '160px'
            }}
          >
            {node.label}
          </Typography>
        </Box>
      );
    } else if (node.shape === 'diamond') {
      return (
        <Box
          style={{
            width: '110px',
            height: '110px',
            background: 'rgba(255, 159, 67, 0.08)',
            border: `2.5px solid ${node.color}`,
            transform: 'rotate(45deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            margin: '10px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontFamily: '"Roboto Mono", monospace',
              fontWeight: 800,
              color: '#fff',
              transform: 'rotate(-45deg)',
              textAlign: 'center',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              padding: '10px',
              maxWidth: '90px',
              wordBreak: 'break-word'
            }}
          >
            {node.label}
          </Typography>
        </Box>
      );
    } else {
      // Rectangle Process
      return (
        <Box
          style={{
            width: '190px',
            height: '48px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '2.5px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontFamily: '"Roboto Mono", monospace',
              fontWeight: 700,
              color: '#e0e0e0',
              padding: '0 12px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '170px'
            }}
          >
            {node.label}
          </Typography>
        </Box>
      );
    }
  };

  const renderBranchNode = (node) => {
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '15px 0' }}>
        {/* Decision Diamond */}
        <Box
          style={{
            width: '110px',
            height: '110px',
            background: 'rgba(255, 159, 67, 0.08)',
            border: '2.5px solid #FF9F43',
            transform: 'rotate(45deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 2
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontFamily: '"Roboto Mono", monospace',
              fontWeight: 800,
              color: '#fff',
              transform: 'rotate(-45deg)',
              textAlign: 'center',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              padding: '10px',
              maxWidth: '90px',
              wordBreak: 'break-word'
            }}
          >
            {node.condition}
          </Typography>
        </Box>

        {/* Vertical line from diamond to split point */}
        <Box style={{ width: '2px', height: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />

        {/* Split Rows Container */}
        <Box style={{ display: 'flex', width: '100%', position: 'relative', marginTop: '-2px' }}>
          
          {/* Horizontal Connecting Line (Dashed) */}
          <Box style={{
            position: 'absolute',
            top: '0',
            left: '25%',
            right: '25%',
            height: '2px',
            borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
            zIndex: 1
          }} />

          {/* Left Column (True Branch - YES) */}
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', paddingRight: '10px' }}>
            {/* Vertical line from horizontal line down */}
            <Box style={{ width: '2px', height: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
            
            {/* YES Label Chip */}
            <Box style={{
              background: 'rgba(61, 220, 151, 0.12)',
              border: '1px solid #3DDC97',
              borderRadius: '12px',
              padding: '2px 8px',
              marginBottom: '15px',
              boxShadow: '0 0 10px rgba(61, 220, 151, 0.1)'
            }}>
              <Typography variant="caption" style={{ color: '#3DDC97', fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                YES ✔️
              </Typography>
            </Box>

            {/* Recursive Render of True Branch */}
            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {node.trueBranch && node.trueBranch.length > 0 ? (
                renderTreeNodes(node.trueBranch)
              ) : (
                <Box style={{
                  width: '80px',
                  height: '30px',
                  border: '1.5px dashed rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
                    pass
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Bottom vertical line to merge */}
            <Box style={{ width: '2px', flexGrow: 1, minHeight: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
          </Box>

          {/* Right Column (False Branch - NO) */}
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', paddingLeft: '10px' }}>
            {/* Vertical line from horizontal line down */}
            <Box style={{ width: '2px', height: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
            
            {/* NO Label Chip */}
            <Box style={{
              background: 'rgba(255, 100, 124, 0.12)',
              border: '1px solid #FF647C',
              borderRadius: '12px',
              padding: '2px 8px',
              marginBottom: '15px',
              boxShadow: '0 0 10px rgba(255, 100, 124, 0.1)'
            }}>
              <Typography variant="caption" style={{ color: '#FF647C', fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                NO ❌
              </Typography>
            </Box>

            {/* Recursive Render of False Branch */}
            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {node.falseBranch && node.falseBranch.length > 0 ? (
                renderTreeNodes(node.falseBranch)
              ) : (
                <Box style={{
                  width: '80px',
                  height: '30px',
                  border: '1.5px dashed rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
                    pass
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Bottom vertical line to merge */}
            <Box style={{ width: '2px', flexGrow: 1, minHeight: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
          </Box>

        </Box>

        {/* Bottom Horizontal Merge Line (Dashed) */}
        <Box style={{ display: 'flex', width: '100%', position: 'relative', height: '2px', marginTop: '-2px' }}>
          <Box style={{
            position: 'absolute',
            bottom: '0',
            left: '25%',
            right: '25%',
            height: '2px',
            borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
            zIndex: 1
          }} />
        </Box>

        {/* Final dropdown arrow from merge point */}
        <Box style={{ width: '2px', height: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
      </Box>
    );
  };

  const renderLoopNode = (node) => {
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '15px 0' }}>
        {/* Loop Diamond */}
        <Box
          style={{
            width: '110px',
            height: '110px',
            background: 'rgba(139, 92, 246, 0.08)',
            border: '2.5px solid #8B5CF6',
            transform: 'rotate(45deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 2
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontFamily: '"Roboto Mono", monospace',
              fontWeight: 800,
              color: '#fff',
              transform: 'rotate(-45deg)',
              textAlign: 'center',
              fontSize: '0.75rem',
              lineHeight: 1.2,
              padding: '10px',
              maxWidth: '90px',
              wordBreak: 'break-word'
            }}
          >
            {node.condition}
          </Typography>
        </Box>

        {/* Horizontal split for Loop Body vs. Exit */}
        <Box style={{ display: 'flex', width: '100%', position: 'relative', marginTop: '10px' }}>
          
          {/* Connecting line */}
          <Box style={{
            position: 'absolute',
            top: '0',
            left: '25%',
            right: '25%',
            height: '2px',
            borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
            zIndex: 1
          }} />

          {/* Left Column: Loop Body (True) */}
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', paddingRight: '10px', borderLeft: '2px dashed rgba(139, 92, 246, 0.25)', borderRadius: '8px 0 0 8px', marginLeft: '5px' }}>
            <Box style={{ width: '2px', height: '15px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
            
            <Box style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid #8B5CF6',
              borderRadius: '12px',
              padding: '2px 8px',
              marginBottom: '15px'
            }}>
              <Typography variant="caption" style={{ color: '#8B5CF6', fontWeight: 800, fontSize: '0.65rem' }}>
                LOOP BODY ✔️
              </Typography>
            </Box>

            <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {node.body && node.body.length > 0 ? (
                renderTreeNodes(node.body)
              ) : (
                <Box style={{
                  width: '80px',
                  height: '30px',
                  border: '1.5px dashed rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
                    pass
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Arrow looping back up */}
            <Box style={{ width: '2px', flexGrow: 1, minHeight: '20px', borderLeft: '2px dashed rgba(139, 92, 246, 0.5)', zIndex: 1 }} />
            <Typography variant="caption" style={{ color: '#8B5CF6', fontSize: '0.6rem', fontWeight: 800, marginTop: '-5px', marginBottom: '10px' }}>
              ▲ loop back
            </Typography>
          </Box>

          {/* Right Column: Loop Exit (False) */}
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', paddingLeft: '10px' }}>
            <Box style={{ width: '2px', height: '15px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
            
            <Box style={{
              background: 'rgba(255, 100, 124, 0.12)',
              border: '1px solid #FF647C',
              borderRadius: '12px',
              padding: '2px 8px',
              marginBottom: '15px'
            }}>
              <Typography variant="caption" style={{ color: '#FF647C', fontWeight: 800, fontSize: '0.65rem' }}>
                EXIT ❌
              </Typography>
            </Box>

            <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40px' }}>
              <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '0.7rem' }}>
                Exit Loop
              </Typography>
            </Box>
            
            <Box style={{ width: '2px', flexGrow: 1, minHeight: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
          </Box>

        </Box>

        {/* Bottom Horizontal Merge Line (Dashed) */}
        <Box style={{ display: 'flex', width: '100%', position: 'relative', height: '2px', marginTop: '-2px' }}>
          <Box style={{
            position: 'absolute',
            bottom: '0',
            left: '25%',
            right: '25%',
            height: '2px',
            borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
            zIndex: 1
          }} />
        </Box>

        {/* Final arrow down from loop exit merge */}
        <Box style={{ width: '2px', height: '20px', borderLeft: '2px dashed rgba(255, 255, 255, 0.15)', zIndex: 1 }} />
      </Box>
    );
  };

  const renderTreeNodes = (nodes) => {
    if (!nodes || nodes.length === 0) return null;
    
    return nodes.map((node, idx) => {
      const isLast = idx === nodes.length - 1;
      let element = null;
      
      if (node.type === 'branch') {
        element = renderBranchNode(node);
      } else if (node.type === 'loop') {
        element = renderLoopNode(node);
      } else {
        element = renderStandardNode(node);
      }
      
      return (
        <React.Fragment key={idx}>
          {element}
          {!isLast && renderDownArrow()}
        </React.Fragment>
      );
    });
  };

  const renderFlowchartNodes = () => {
    const treeNodes = parsePseudocodeToTree(pseudocode);
    if (treeNodes.length === 0) {
      return (
        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center' }}>
            Write some pseudocode on the left or click "Sync from C++" to draw the flowchart!
          </Typography>
        </Box>
      );
    }

    return (
      <Box id="flowchart-capture-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '10px 0' }}>
        {renderTreeNodes(treeNodes)}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        style: {
          borderRadius: '24px',
          background: theme.palette.mode === 'dark' ? 'rgba(22, 22, 50, 0.94)' : 'rgba(252, 253, 255, 0.94)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--divider)',
          boxShadow: 'var(--shadow-card)',
          maxHeight: '98vh',
          width: '95vw',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--divider)', flexWrap: 'wrap', gap: '12px' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TerminalIcon style={{ color: 'var(--primary-main)' }} />
          <Typography variant="h6" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: 'var(--text-primary)' }}>
            C++ Compiler Playground
          </Typography>
        </Box>
        
        {/* Switcher tabs */}
        <Box style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setActiveTab('compiler')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'compiler' ? 'var(--primary-main)' : 'transparent',
              color: activeTab === 'compiler' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            C++ Compiler
          </button>
          <button
            onClick={() => {
              setActiveTab('flowchart');
              setPseudocode(convertCppToPseudocode(code));
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'flowchart' ? 'var(--primary-main)' : 'transparent',
              color: activeTab === 'flowchart' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
          >
            Pseudocode & Flowchart Lab
          </button>
        </Box>

        <IconButton onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent style={{ padding: '20px 24px', overflowY: 'auto' }}>
        {activeTab === 'compiler' ? (
          <Box style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', minHeight: '400px', alignItems: 'stretch' }}>
            {/* Editor Column */}
            <Box style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Source Code Editor
                </Typography>
                <Box style={{ display: 'flex', gap: '4px' }}>
                  <IconButton size="small" onClick={handleCopy} title="Copy Code" style={{ color: 'var(--primary-main)' }}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={handleReset} title="Reset Template" style={{ color: 'var(--text-secondary)' }}>
                    <ResetIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              <Box style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fffffe',
                height: '480px',
                width: '100%',
                boxShadow: '0 4px 25px rgba(0,0,0,0.15)'
              }}>
                <Editor
                  height="100%"
                  language="cpp"
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    lineNumbersMinChars: 3
                  }}
                />
              </Box>
            </Box>

            {/* Console / Terminal Column */}
            <Box style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
              {/* Output terminal */}
              <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Interactive Terminal Output
              </Typography>
              <Paper
                elevation={0}
                style={{
                  flexGrow: 1,
                  padding: '16px',
                  backgroundColor: '#05070f',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: '"Roboto Mono", monospace',
                  fontSize: '0.82rem',
                  color: '#3DDC97',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  height: '480px',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start'
                }}
              >
                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                  {terminalOutput}
                  {isWaitingForInput && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <span style={{ color: '#FF9F43', fontWeight: 800 }}>{`> `}</span>
                      <input
                        type="text"
                        value={currentInputVal}
                        onChange={(e) => setCurrentInputVal(e.target.value)}
                        onKeyDown={handleInputSubmit}
                        autoFocus
                        placeholder="Type input and press Enter..."
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#3DDC97',
                          fontFamily: '"Roboto Mono", monospace',
                          fontSize: '0.82rem',
                          flexGrow: 1,
                          caretColor: '#3DDC97'
                        }}
                      />
                    </div>
                  )}
                </div>
              </Paper>
            </Box>
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', minHeight: '400px' }}>
            {/* Pseudocode Editor Panel */}
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pseudocode Editor
                </Typography>
                <Box style={{ display: 'flex', gap: '4px' }}>
                  <IconButton size="small" onClick={handleCopy} title="Copy Pseudocode" style={{ color: 'var(--primary-main)' }}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={handleReset} title="Reset to C++ Output" style={{ color: 'var(--text-secondary)' }}>
                    <ResetIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <TextField
                multiline
                fullWidth
                value={pseudocode}
                onChange={(e) => setPseudocode(e.target.value)}
                variant="outlined"
                inputProps={{
                  style: {
                    fontFamily: '"Roboto Mono", monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    color: theme.palette.mode === 'dark' ? '#E5E9F0' : '#2D2D4D',
                    backgroundColor: theme.palette.mode === 'dark' ? '#0F1424' : '#F7F9FC',
                    padding: '16px',
                    borderRadius: '14px',
                    border: '1px solid var(--code-border)',
                    minHeight: '380px'
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { padding: 0, '& fieldset': { border: 'none' } }
                }}
              />
            </Box>

            {/* Visual Flowchart Display Panel */}
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Flowchart Visualizer
              </Typography>
              <Paper
                elevation={0}
                style={{
                  height: '450px',
                  padding: '20px',
                  backgroundColor: theme.palette.mode === 'dark' ? '#0A0C16' : '#FAFAFC',
                  borderRadius: '16px',
                  border: '1px solid var(--divider)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {renderFlowchartNodes()}
              </Paper>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions style={{ padding: '16px 24px', borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between' }}>
        {activeTab === 'compiler' ? (
          <>
            <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>
              Supports basic variables, arithmetic, cin streams, and cout loops!
            </Typography>
            <Button
              variant="contained"
              disabled={isRunning}
              onClick={handleRun}
              startIcon={<PlayIcon />}
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                fontWeight: 800,
                textTransform: 'none',
                background: 'var(--hero-gradient)',
                color: '#fff',
                boxShadow: '0 6px 15px rgba(var(--primary-main-rgb), 0.2)'
              }}
            >
              {isRunning ? "RUNNING..." : "RUN CODE"}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="caption" style={{ color: 'var(--text-secondary)', maxWidth: '70%' }}>
              Green = START/END, Blue = Input/Output, Grey = Process, Orange/Purple = Branch.
            </Typography>
            <Box style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outlined"
                onClick={handleDownloadPng}
                startIcon={<DownloadIcon />}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderColor: 'var(--primary-main)',
                  color: 'var(--primary-main)'
                }}
              >
                Download Flowchart
              </Button>
              <Button
                variant="outlined"
                onClick={handleGenerateFromCpp}
                startIcon={<ResetIcon />}
                style={{
                  padding: '20px 20px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderColor: 'var(--primary-main)',
                  color: 'var(--primary-main)'
                }}
              >
              </Button>
            </Box>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
