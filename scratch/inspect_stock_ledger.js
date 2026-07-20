import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\이지원재고수불표.xlsx';
const outputJsonPath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\scratch\\inspect_result.json';

function inspect() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const workbook = XLSX.readFile(filePath);
  const result = {
    sheetNames: workbook.SheetNames,
    sheets: {}
  };
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rows = [];
    const limit = Math.min(25, range.e.r);
    for (let r = 0; r <= limit; r++) {
      const row = [];
      for (let c = 0; c <= Math.min(20, range.e.c); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      if (row.some(v => v !== '')) {
        rows.push({
          rowNum: r,
          data: row.map(v => typeof v === 'string' ? v.trim() : v)
        });
      }
    }
    result.sheets[sheetName] = {
      range: `A1 to ${XLSX.utils.encode_cell({ r: range.e.r, c: range.e.c })}`,
      sampleRows: rows
    };
  }
  
  fs.writeFileSync(outputJsonPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('Inspection complete! Result written to inspect_result.json');
}

try {
  inspect();
} catch (err) {
  console.error(err);
}
