import XLSX from 'xlsx';
import path from 'path';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const filePath = path.join(uploadDir, '직원정보.xlsx');

console.log('Loading XLSX:', filePath);
const workbook = XLSX.readFile(filePath);
console.log('Sheets:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
console.log('Range:', range);

const rows = [];
for (let r = 0; r <= range.e.r; r++) {
  const row = [];
  for (let c = 0; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    row.push(cell ? cell.v : '');
  }
  rows.push(row);
}

rows.forEach((r, idx) => {
  console.log(`Row ${idx}:`, r.map(v => typeof v === 'string' ? v.trim() : v));
});
