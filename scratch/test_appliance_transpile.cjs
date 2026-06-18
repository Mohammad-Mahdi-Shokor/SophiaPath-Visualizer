const fs = require('fs');

const codeToTest = `
abstract class Appliance {
    protected String name;
    protected boolean isOn;

    public Appliance(String name) {
        this.name = name;
        this.isOn = false;
    }

    public void turnOn() { this.isOn = true; }
    public void turnOff() { this.isOn = false; }
    public String getStatus() { return this.isOn ? "On" : "Off"; }
    public abstract String operate();
}

class WashingMachine extends Appliance {
    public WashingMachine(String name) { super(name); }
    public String operate() { return "Washing"; }
}

class Refrigerator extends Appliance {
    public Refrigerator(String name) { super(name); }
    public String operate() { return "Cooling"; }
}
`;

const hiddenMain = `public class Main {
    public static void main(String[] args) {
        Appliance w = new WashingMachine("Washing Machine");
        Appliance r = new Refrigerator("Refrigerator");
        w.turnOn();
        r.turnOn();
        System.out.println(w.name + ": " + w.getStatus() + " — " + w.operate());
        System.out.println(r.name + ": " + r.getStatus() + " — " + r.operate());
    }
}`;

let jsContent = fs.readFileSync('src/components/ChallengePlaygroundDialog.jsx', 'utf-8');
const match = jsContent.match(/const translateJavaToJs = \([^)]*\) => \{[\s\S]*?\n\};/);
if (match) {
  let transpileStr = match[0];
  transpileStr = transpileStr.replace('const translateJavaToJs = ', 'global.translateJavaToJs = ');
  eval(transpileStr);
  const jsCode = global.translateJavaToJs(codeToTest + "\n" + hiddenMain, "");
  console.log("--- TRANSPILED JS ---");
  console.log(jsCode);
  console.log("--- EXECUTION ---");
  try {
    const res = new Function(jsCode)();
    console.log("OUT:", res);
  } catch (e) {
    console.log("ERR:", e.stack);
  }
}
