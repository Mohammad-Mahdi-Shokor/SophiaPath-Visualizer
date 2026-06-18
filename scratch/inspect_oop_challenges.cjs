const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/info.csv', 'utf8'));
const oopSection = data.sections[1];

let challengeCount = 0;

oopSection.lessons.forEach((lesson, lIdx) => {
    lesson.pages.forEach((page, pIdx) => {
        page.blocks.forEach((block, bIdx) => {
            if (block.type === 'code_challenge') {
                challengeCount++;
                console.log(`\n--- Challenge ${challengeCount} at Lesson ${lIdx}, Page ${pIdx}, Block ${bIdx} ---`);
                console.log(`Problem: ${block.problem}`);
                console.log(`StarterCode lines:\n${block.starterCode.lines.join('\n')}`);
                console.log(`Has hiddenMain: ${!!block.hiddenMain}`);
                if (!block.hiddenMain) {
                    console.log(`TestCases:`, JSON.stringify(block.testCases, null, 2));
                }
            }
        });
    });
});

console.log(`\nTotal Code Challenges in OOP: ${challengeCount}`);
