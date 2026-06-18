const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/info.csv', 'utf8'));

const oopSection = data.sections[1];

const blocksToInspect = [];

oopSection.lessons.forEach((lesson, lIdx) => {
    lesson.pages.forEach((page, pIdx) => {
        page.blocks.forEach((block, bIdx) => {
            if (block.type === 'code_challenge' && !block.hiddenMain) {
                blocksToInspect.push({lIdx, pIdx, bIdx, block});
            }
        });
    });
});

console.log(JSON.stringify(blocksToInspect, null, 2));
