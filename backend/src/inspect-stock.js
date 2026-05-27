import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const filename = '차열재_재고관리_v10.xlsx';
const filePath = path.join(uploadDir, filename);

if (fs.existsSync(filePath)) {
  const workbook = XLSX.readFile(filePath);
  console.log('Sheets in Stock file:', workbook.SheetNames);
  
  // 첫 번째 시트 분석
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Sheet "${sheetName}" total rows: ${rows.length}`);
  
  // 처음 30줄 출력하여 구조 파악
  console.log('--- Rows 1-30 ---');
  rows.slice(0, 30).forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(row));
  });
} else {
  console.log('File not found:', filePath);
}
