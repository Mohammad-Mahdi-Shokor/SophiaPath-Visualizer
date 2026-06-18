const jsCode = `
    const stdout = [];
    const sprintf = (...args) => {
      // ...
    };

    class Appliance {
      constructor(name) {
        this.name = name;
        this.isOn = false;
      }
      turnOn() { this.isOn = true; }
      turnOff() { this.isOn = false; }
      getStatus() { return this.isOn ? "On" : "Off"; }
    }

    class WashingMachine extends Appliance {
      constructor(name) { super(); super(name); } // wait, how did super() get injected?
    }
`;
