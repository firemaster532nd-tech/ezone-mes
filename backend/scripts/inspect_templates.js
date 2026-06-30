import XLSX from 'xlsx';
import path from 'path';

const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const file1 = path.join(uploadDir, '소켓 발주서.xlsx');
const file2 = path.join(uploadDir, '소켓발주서양식.xlsx');

function inspectFile(filePath, label) {
  console.log(`\n========================================`);
  console.log(`[INSPECTING] ${label}: ${filePath}`);
  console.log(`========================================`);
  try {
    const wb = XLSX.readFile(filePath);
    console.log('Sheet Names:', wb.SheetNames);
    
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    
    // Convert to JSON (AOA) to see layout
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Total Rows: ${data.length}`);
    
    // Print first 30 rows
    console.log('--- ROWS 36 TO 100 ---');
    data.slice(35, 100).forEach((row, i) => {
      const cleanRow = row.map(v => (v === undefined || v === null) ? '' : v);
      console.log(`Row ${i + 36}:`, JSON.stringify(cleanRow));
    });
  } catch (err) {
    console.error(`Error reading ${label}:`, err);
  }
}

inspectFile(file1, '소켓 발주서');
inspectFile(file2, '소켓발주서양식');
