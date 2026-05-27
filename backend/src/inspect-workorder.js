import XLSX from 'xlsx';
import path from 'path';

const filePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';
const workbook = XLSX.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n========================================`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`========================================`);
  
  rows.slice(0, 40).forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(row));
  });
});
