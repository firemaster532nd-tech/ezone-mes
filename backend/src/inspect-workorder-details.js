import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const filename = '26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';
const filePath = path.join(uploadDir, filename);

if (fs.existsSync(filePath)) {
  const workbook = XLSX.readFile(filePath);
  
  // 시트별로 상위 몇 줄씩 출력
  const targets = ['1. 소켓인수검사', '2.재단(VM)작업', '2.1 재단작업(VT)', '차열재 재단(VM,VT)'];
  
  for (const sheetName of targets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`Sheet not found: ${sheetName}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n==================== Sheet: ${sheetName} ====================`);
    rows.slice(0, 15).forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    });
  }
} else {
  console.log('File not found:', filePath);
}
