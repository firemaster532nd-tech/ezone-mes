import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

const uploadDir = '../upload';

function checkFile(filename: string) {
  const f = path.join(uploadDir, filename);
  if (!fs.existsSync(f)) {
    console.log('File not found:', f);
    return;
  }
  try {
    const wb = xlsx.readFile(f);
    console.log(`\n=== FILE: ${filename} ===`);
    console.log('Sheets:', wb.SheetNames.join(', '));
    
    // Print first 50 rows of each sheet
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const data: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
      console.log(`  Sheet [${sheetName}]: ${data.length} rows`);
      data.slice(0, 50).forEach((row, i) => {
        const nonVal = row.filter(c => c !== '');
        if (nonVal.length > 0) {
          console.log(`    [Row ${i}]`, row.slice(0, 10).join(' | '));
        }
      });
    }
  } catch (err: any) {
    console.error('Error reading', filename, ':', err.message);
  }
}

async function main() {
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.xlsx'));
  console.log('Excel files in upload:', files);
  for (const f of files) {
    if (f.includes('에프엔테크')) {
      checkFile(f);
    }
  }
}

main();
