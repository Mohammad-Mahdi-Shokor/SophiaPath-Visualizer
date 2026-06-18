const fs = require('fs');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // We need to track extends.
  // The regex is: `class ${className}` + (parentClass ? ` extends ${parentClass}` : '')
  // We can just add a global object or map in the JS code to track extends, but doing it during transpilation is easier.
  
  // Find where `code = code.replace(/\b(public\s+|abstract\s+|static\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?...`
  // We will replace it to also store extends in a map.
  
  const replacement1 = `
  const extendsMap = {};
  code = code.replace(/\\b(public\\s+|abstract\\s+|static\\s+)*class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?(?:\\s+implements\\s+[\\w\\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = \`class \${className}\`;
    if (parentClass) {
      res += \` extends \${parentClass}\`;
      extendsMap[className] = true;
    }
    return res;
  });
`;
  
  content = content.replace(/code = code\.replace\(\/\\b\(public\\s\+\|abstract\\s\+\|static\\s\+\)\*class\\s\+\(\\w\+\)\(\?:\\s\+extends\\s\+\(\\w\+\)\)\?\(\?:\\s\+implements\\s\+\[\\w\\s,\]\+\)\?\/g, \(match, modifiers, className, parentClass\) => \{[\s\S]*?return res;\n  \}\);/m, replacement1.trim());

  const replacement2 = `
  classNames.forEach(className => {
    const constrRegex = new RegExp(\`\\\\b(?:public|private|protected|internal)?\\\\s*\${className}\\\\s*\\\\(([^)]*)\\\\)\\\\s*(?:throws\\\\s+[\\\\w\\\\s,]+)?\\\\s*\\\\{\`, 'g');
    code = code.replace(constrRegex, (match, paramStr) => {
      let cleaned = paramStr;
      if (typeof cleanParamTypes !== 'undefined') {
        cleaned = cleanParamTypes(paramStr);
      } else {
        cleaned = paramStr.split(',').map(p => {
          if (!p.trim()) return '';
          const parts = p.trim().split(/\\s+/);
          return parts[parts.length - 1];
        }).filter(p => p).join(', ');
      }
      let res = \`constructor(\${cleaned}) {\`;
      if (extendsMap[className]) {
        res += ' super();';
      }
      return res;
    });
  });
`;

  content = content.replace(/classNames\.forEach\(className => \{[\s\S]*?return `constructor\(\$\{cleanParams\}\) \{`;\n    \}\);\n  \}\);/m, replacement2.trim());

  // Wait, CppPlaygroundDialog might have `cleanParamTypes` while ChallengePlaygroundDialog doesn't.
  // The replacement handles both using `typeof cleanParamTypes !== 'undefined'`.

  fs.writeFileSync(filePath, content, 'utf-8');
};

fixFile('src/components/ChallengePlaygroundDialog.jsx');
fixFile('src/components/CppPlaygroundDialog.jsx');

console.log('Fixed super() injection.');
