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

class Rectangle extends Shape {
    private double width;
    private double height;
    
    public Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }
    
    public double area() {
        return width * height;
    }
    
    public String getType() {
        return "Rectangle";
    }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = {new Circle(5), new Rectangle(4, 6)};
        for (Shape s : shapes) {
            System.out.printf("%s area: %.2f\\n", s.getType(), s.area());
        }
    }
}
`;

const translateJavaToJs = (javaCode, inputStr) => {
  let code = javaCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  code = code.replace(/import\s+[\w.]+;/g, "");
  code = code.replace(/@\w+/g, "");
  
  code = code.replace(/\binterface\s+(\w+)/g, "class $1");
  code = code.replace(/\bextends\s+Exception\b/g, "extends Error");
  
  code = code.replace(/\b(public\s+|abstract\s+|static\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = `class ${className}`;
    if (parentClass) {
      res += ` extends ${parentClass}`;
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

  // Constructors
  classNames.forEach(className => {
    const constrRegex = new RegExp(`\\b(?:public|private|protected|internal)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(constrRegex, (match, params) => {
      const cleanParams = params.split(',').map(p => {
        if (!p.trim()) return '';
        const parts = p.trim().split(/\s+/);
        return parts[parts.length - 1];
      }).filter(p => p).join(', ');
      return `constructor(${cleanParams}) {`;
    });
  });

  // Methods
  code = code.replace(/(?:public|private|protected|static|final|abstract|synchronized|volatile|\s)*\b[a-zA-Z_][a-zA-Z0-9_<>[\]]*\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:throws\s+[a-zA-Z0-9_,\s]+)?\s*(\{|;)/g, (match, methodName, params, brace) => {
    const keywords = ['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'else'];
    if (keywords.includes(methodName)) return match;
    const isStatic = match.includes("static") ? "static " : "";
    const cleanParams = params.split(',').map(p => {
        if (!p.trim()) return '';
        const parts = p.trim().split(/\s+/);
        return parts[parts.length - 1];
    }).filter(p => p).join(', ');
    return `\n${isStatic}${methodName}(${cleanParams}) ${brace === ';' ? '{}' : '{'}`;
  });
  
  code = code.replace(/\b(?:public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  // Types
  const types = ['int', 'double', 'float', 'boolean', 'char', 'String', 'Shape', 'Circle', 'Rectangle', 'Employee', 'Contractor', 'Appliance', 'WashingMachine', 'Refrigerator', 'Product', 'Payable', 'BankAccount', 'Scanner', 'Vehicle', 'Car', 'Motorcycle', 'Drawable', 'Speaker', 'Mover', 'Dog', 'Cat', 'Robot', 'Bird', 'Animal', 'Cow', 'Geometry', 'Exception', 'InvalidAgeException', 'InvalidEmailException', 'InsufficientFundsException', 'InvalidPasswordException', 'Object', 'SalariedEmployee', 'HourlyEmployee', 'Comparable'];
  types.forEach(type => {
    const varDeclRegex = new RegExp(`\\b${type}(?:\\[\\])?\\s+(?!extends\\b|implements\\b|instanceof\\b)([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g');
    code = code.replace(varDeclRegex, '$1');
  });

  code = code.replace(/=\s*\{([^}]+)\}/g, '= [$1]');
  code = code.replace(/for\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g, 'for (let $1 of $2)');
  code = code.replace(/\(\([a-zA-Z_][a-zA-Z0-9_]*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\)/g, '$1');
  code = code.replace(/\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1');
  code = code.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s+instanceof\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1 instanceof $2');

  code = code.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'stdout.push($1); stdout.push("\\n");');
  code = code.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'stdout.push($1);');
  code = code.replace(/System\.out\.printf\s*\(([^;]+)\)\s*;/g, 'stdout.push(sprintf($1));');

  code = code.replace(/\be\.getMessage\(\)/g, "e.message");
  code = code.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  code = code.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "readInput()");

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

    const sprintf = (...args) => {
      if (args.length === 0) return "";
      let str = args[0];
      if (typeof str === 'string' && str.startsWith('"') && str.endsWith('"')) {
          str = str.slice(1, -1);
      }
      const formatArgs = args.slice(1);
      formatArgs.forEach(arg => {
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
      return str.replace(/\\\\n/g, '\\n');
    };
  `;

  js += "\n" + code;
  js += `\n// Execute main\nif (typeof Main !== 'undefined' && Main.main) { Main.main([]); }`;
  js += `\nreturn stdout.join("");`;
  return js;
};

try {
    const jsCode = translateJavaToJs(code, "");
    console.log("--- JS CODE ---");
    console.log(jsCode);
    console.log("--- EXECUTION ---");
    const result = new Function(jsCode)();
    console.log(result);
} catch (e) {
    console.error("ERROR:", e);
}
