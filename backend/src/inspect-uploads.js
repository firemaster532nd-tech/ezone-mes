import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';

function inspectExcel(filename) {
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  console.log(`\n==================================================`);
  console.log(`Inspecting file: ${filename}`);
  console.log(`==================================================`);

  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    console.log(`\nSheet: "${sheetName}" (Range: ${sheet['!ref']})`);

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Total rows: ${rows.length}`);

    // Print first 15 rows
    console.log('--- First 15 rows: ---');
    rows.slice(0, 15).forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    });
  }
}

const files = [
  '차열재_재고관리_v10.xlsx',
  '26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx',
  '26.05.12엘티엔지니어링_기건공영(주)_(주)케이에스이엔지_수원10비행단 품질관리서_세부내역_통합.xlsx'
];

files.forEach(inspectExcel);
