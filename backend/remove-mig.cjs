const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/routes');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
let totalReplaced = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace: await migrate...() with // await migrate...()
  const newContent = content.replace(/^(\s*)(await\s+migrate[A-Za-z0-9_]+\s*\(\)\s*;)/gm, '$1// $2');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${file}`);
    totalReplaced++;
  }
}
console.log(`Done. Updated ${totalReplaced} files.`);
