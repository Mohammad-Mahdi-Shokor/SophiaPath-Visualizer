const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'philopostgremh19',
    database: 'sophia-path',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    const res = await client.query("SELECT id, title, pages FROM lessons;");
    
    let occurrences = 0;
    res.rows.forEach(row => {
      if (!row.pages) return;
      row.pages.forEach((page, pIdx) => {
        const blocks = page.blocks || [page];
        blocks.forEach(block => {
          const type = (block.type || '').toLowerCase();
          if (type === 'fill_code' || type === 'fill_code_options' || type === 'write_line') {
            occurrences++;
            console.log(`\n========================================`);
            console.log(`Lesson: ${row.title} (ID: ${row.id}) | Page: ${pIdx + 1}`);
            console.log(`Exercise Type: ${type}`);
            console.log(`Instruction: ${block.instruction}`);
            console.log(`Code Template lines:`);
            console.log(JSON.stringify(block.codeTemplate?.lines || block.lines, null, 2));
          }
        });
      });
    });
    
    console.log(`\nTotal exercise occurrences found: ${occurrences}`);

  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await client.end();
  }
}

main();
