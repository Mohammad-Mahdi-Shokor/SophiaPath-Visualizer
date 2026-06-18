let code = `
class Circle {
    constructor(radius) {
        this.radius = radius;
    }
    area() {
        return Math.PI * radius * radius;
    }
}
`;

const attributes = ['radius'];

// Protect parameters
code = code.replace(/(?:constructor|[a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g, (match, params) => {
  const protectedParams = params.replace(/\b([a-zA-Z_]\w*)\b/g, '___PARAM___$1');
  return match.replace(params, protectedParams);
});

// Protect let/var/const declarations inside methods
code = code.replace(/\b(let|const|var)\s+([a-zA-Z_]\w*)\b/g, '$1 ___LOCAL___$2');

// Now replace attributes with this.attr
attributes.forEach(attr => {
  const regex = new RegExp(`(?<!this\\.|\\.\\s*)\\b${attr}\\b`, 'g');
  code = code.replace(regex, `this.${attr}`);
});

// Restore protected
code = code.replace(/___PARAM___([a-zA-Z_]\w*)/g, '$1');
code = code.replace(/___LOCAL___([a-zA-Z_]\w*)/g, '$1');

console.log(code);
