import XLSX from 'xlsx';
import path from 'path';

const scratchDir = 'C:\\Users\\edwar\\.gemini\\antigravity\\brain\\79d4c3dc-5488-4b43-80c5-b95250044cd0\\scratch';

function inspect(filename: string) {
  const filePath = path.join(scratchDir, filename);
  console.log(`\n=== INSPECTING: ${filename} ===`);
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames.slice(0, 3)) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rows: any[] = [];
    for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
      const row: any[] = [];
      for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        row.push(cell ? cell.v : '');
      }
      rows.push(row);
    }
    console.log('First rows:');
    rows.slice(0, 15).forEach((r, idx) => {
      if (r.some((v: any) => v !== '')) {
        console.log(`Row ${idx}:`, r.map((v: any) => typeof v === 'string' ? v.trim().replace(/\n/g, ' ') : v));
      }
    });
  }
}

try {
  inspect('sheet1.xlsx');
  inspect('sheet2.xlsx');
} catch (err) {
  console.error(err);
}
