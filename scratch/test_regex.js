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
const match = jsContent.match(/const simulateCodeExecution = [\s\S]*?return \{[\s\S]*?isError: false[\s\S]*?\};[\s\S]*?\};/);
if (match) {
  let simCodeStr = match[0];
  const translateMatch = jsContent.match(/const translateJavaToJs = \([^)]*\) => \{[\s\S]*?\n\};/);
  
  eval(translateMatch[0]);
  eval(simCodeStr.replace('const simulateCodeExecution = ', 'global.simulateCodeExecution = '));
  
  const res = global.simulateCodeExecution(codeToTest, "", "java", hiddenMain);
  console.log("--- RESULT ---");
  console.log(res);
} else {
  console.log("Could not extract simulateCodeExecution");
}
