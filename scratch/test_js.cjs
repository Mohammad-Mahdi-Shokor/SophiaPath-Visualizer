try {
  class A { constructor() { console.log("A"); } }
  class B extends A { constructor() { super(); console.log("B"); } }
  new B();
} catch (e) { console.log(e); }
