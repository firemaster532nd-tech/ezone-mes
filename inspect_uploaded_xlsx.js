import XLSX from 'xlsx';

const filePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';

function inspect() {
  const workbook = XLSX.readFile(filePath);
  const sheetsToInspect = ['2.재단(VM)작업', '차열재 재단(VM,VT)'];
  for (const sheetName of sheetsToInspect) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const start = Math.max(0, range.e.r - 20);
    for (let r = start; r <= range.e.r; r++) {
      const row = [];
      for (let c = 0; c <= 15; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      if (row.some(v => v !== '')) {
        console.log(`Row ${r}:`, row.map(v => typeof v === 'string' ? v.trim().replace(/\n/g, ' ') : v));
      }
    }
  }
}

try {
  inspect();
} catch (err) {
  console.error(err);
}
