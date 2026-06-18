const fs = require('fs');
let code = fs.readFileSync('src/components/CppPlaygroundDialog.jsx', 'utf-8');

// For translateJavaToJs
code = code.replace(/code = code\.replace\(\/\\b\(public\\s\+\|abstract\\s\+\|static\\s\+\)\*class\\s\+\(\\w\+\)\(\?:\\s\+extends\\s\+\(\\w\+\)\)\?\(\?:\\s\+implements\\s\+\[\\w\\s,\]\+\)\?\/g, \(match, modifiers, className, parentClass\) => \{\n    let res = `class \$\{className\}`;\n    if \(parentClass\) \{\n      res \+= ` extends \$\{parentClass\}`;\n    \}\n    return res;\n  \}\);/g, `
  const extendsMap = {};
  code = code.replace(/\\b(public\\s+|abstract\\s+|static\\s+)*class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?(?:\\s+implements\\s+[\\w\\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = \`class \${className}\`;
    if (parentClass) {
      res += \` extends \${parentClass}\`;
      extendsMap[className] = true;
    }
    return res;
  });
`);

code = code.replace(/classNames\.forEach\(className => \{\n    const constrRegex = new RegExp\(`\\\\b\(\?:public\|private\|protected\|internal\)\?\\\\s\*\$\{className\}\\\\s\*\\\\(\(\[\^)\]\*\)\\\\)\\\\s\*\(\?:throws\\\\s\+\[\\\\w\\\\s,\]\+\)\?\\\\s\*\\\\\{`, 'g'\);\n    code = code\.replace\(constrRegex, \(match, paramStr\) => \{\n      const cleaned = cleanParamTypes\(paramStr\);\n      return `constructor\(\$\{cleaned\}\) \{`;\n    \}\);\n  \}\);/g, `
  classNames.forEach(className => {
    const constrRegex = new RegExp(\`\\\\b(?:public|private|protected|internal)?\\\\s*\${className}\\\\s*\\\\(([^)]*)\\\\)\\\\s*(?:throws\\\\s+[\\\\w\\\\s,]+)?\\\\s*\\\\{\`, 'g');
    code = code.replace(constrRegex, (match, paramStr) => {
      const cleaned = cleanParamTypes(paramStr);
      let res = \`constructor(\${cleaned}) {\`;
      if (extendsMap[className]) {
        res += ' super();';
      }
      return res;
    });
  });
`);

fs.writeFileSync('src/components/CppPlaygroundDialog.jsx', code, 'utf-8');
console.log('Fixed CppPlaygroundDialog.jsx super()');
