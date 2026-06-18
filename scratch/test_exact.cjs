const jsCode = `
    const stdout = [];
    class Shape {
      area() {}
      getType() { return "Shape"; }
    }
    class Circle extends Shape {
      constructor(radius) { this.radius = radius; }
      area() { return Math.PI * radius * radius; }
      getType() { return "Circle"; }
    }
    class Rectangle extends Shape {
      constructor(width, height) { this.width = width; this.height = height; }
      area() { return width * height; }
      getType() { return "Rectangle"; }
    }
    class Main {
      static main(args) {
        let shapes = [new Circle(5), new Rectangle(4, 6)];
        for (let s of shapes) {
            stdout.push(s.getType() + " area: " + s.area() + "\\n");
        }
      }
    }
    // Execute main
    if (typeof Main !== 'undefined' && Main.main) { Main.main([]); }
    return stdout.join("");
`;
try {
  const result = new Function(jsCode)();
  console.log("RESULT:", result);
} catch (e) {
  console.log("CATCH:", e.message);
}
