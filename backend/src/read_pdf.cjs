const xlsx = require('xlsx');

const file = 'c:/Users/edwar/OneDrive/ezone-mes/docs/BOM_구조별_현황_출처포함.xlsx';

try {
  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]]; // 첫번째 시트
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log('--- ALL ROWS OF BOM STRUCTURE STATUS ---');
  rows.forEach((r, idx) => {
    const line = r.filter(c => c !== null && c !== undefined && c !== '').join(' | ');
    if (line.length > 0) {
      console.log(`[${idx+1}]`, line);
    }
  });
} catch (e) {
  console.error(e);
}
