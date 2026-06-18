const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/info.csv', 'utf8'));
data.sections.forEach((s, idx) => {
    console.log(`Section ${idx}: ${s.title}`);
});
