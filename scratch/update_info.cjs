const fs = require('fs');

const file = 'public/info.csv';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const oopSection = data.sections[1]; // OOP section

oopSection.lessons.forEach((lesson, lIdx) => {
    lesson.pages.forEach((page, pIdx) => {
        page.blocks.forEach((block, bIdx) => {
            if (block.type === 'code_challenge') {
                if (lIdx === 52 && pIdx === 6 && bIdx === 0) {
                    block.problem = 'Write a class `DivisionCalculator` with a static method `calculate()` that reads two integers from the user (numerator and denominator). If the denominator is 0, throw an ArithmeticException with the message "Cannot divide by zero!". Catch the exception and print the error message. If valid, calculate and print the result as a double with 2 decimal places.';
                    block.starterCode.lines = ["import java.util.Scanner;\n\n// Write your classes here"];
                    block.hiddenMain = `public class Main {
    public static void main(String[] args) {
        DivisionCalculator.calculate();
    }
}`;
                }
                if (lIdx === 52 && pIdx === 7 && bIdx === 0) {
                    block.problem = 'Write a class `NumberValidator` with a static method `validate()` that reads an integer from the user. If the number is negative, throw an Exception with message "Negative numbers not allowed!". If zero, throw an Exception with message "Zero is not valid!". Catch both with a single catch block and print the message. If positive, print "Valid: " followed by the number.';
                    block.starterCode.lines = ["import java.util.Scanner;\n\n// Write your classes here"];
                    block.hiddenMain = `public class Main {
    public static void main(String[] args) {
        NumberValidator.validate();
    }
}`;
                }
                if (lIdx === 57 && pIdx === 7 && bIdx === 0) {
                    block.problem = 'Create the Appliance hierarchy shown above. <b>Appliance</b> is abstract with protected name/isOn, concrete turnOn()/turnOff()/getStatus(), and abstract operate(). <b>WashingMachine</b> operate() returns "Washing". <b>Refrigerator</b> operate() returns "Cooling".';
                    block.starterCode.lines = ["// Write your classes here"];
                    block.hiddenMain = `public class Main {
    public static void main(String[] args) {
        Appliance w = new WashingMachine("Washing Machine");
        w.turnOn();
        System.out.println(w.name + ": " + w.getStatus() + " — " + w.operate());
        
        Appliance r = new Refrigerator("Refrigerator");
        r.turnOn();
        System.out.println(r.name + ": " + r.getStatus() + " — " + r.operate());
    }
}`;
                }
            }
        });
    });
});

fs.writeFileSync(file, JSON.stringify(data, null, 4));
console.log('info.csv updated successfully.');
