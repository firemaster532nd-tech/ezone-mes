import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const files = fs.readdirSync(uploadDir);

for (const file of files) {
  if (file.endsWith('.xlsx')) {
    const filePath = path.join(uploadDir, file);
    try {
      const workbook = XLSX.readFile(filePath);
      console.log(`\n========================================`);
      console.log(`FILE: ${file}`);
      console.log(`Sheets:`, workbook.SheetNames);
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const range = sheet['!ref'];
        console.log(`  Sheet: "${name}", Range: ${range}`);
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length > 0) {
          console.log('  Row 0:', data[0]);
        }
        if (data.length > 1) {
          console.log('  Row 1:', data[1]);
        }
        if (data.length > 2) {
          console.log('  Row 2:', data[2]);
        }
      }
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message);
    }
  }
}
