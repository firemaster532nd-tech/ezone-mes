import XLSX from 'xlsx';

const filePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx';

function inspect() {
  const workbook = XLSX.readFile(filePath);
  const sheetsToInspect = ['2.재단(VM)작업', '2.1 재단작업(VT)'];

  for (const sheetName of sheetsToInspect) {
    console.log(`\n========================================`);
    console.log(`Sheet: ${sheetName}`);
    console.log(`========================================`);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) {
      console.log('Empty sheet');
      continue;
    }
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log(`Range: A1:${XLSX.utils.encode_cell(range.e)}`);

    // Let's print the first 40 rows
    for (let r = 0; r <= Math.min(40, range.e.r); r++) {
      const row: any[] = [];
      let hasVal = false;
      for (let c = 0; c <= Math.min(15, range.e.c); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          row.push(`${XLSX.utils.encode_col(c)}:${cell.v}`);
          hasVal = true;
        } else {
          row.push('');
        }
      }
      // Trim ending empty values
      while (row.length > 0 && row[row.length - 1] === '') {
        row.pop();
      }
      if (hasVal) {
        console.log(`Row ${r + 1}:`, row.join(' | '));
      } else {
        console.log(`Row ${r + 1}: (empty)`);
      }
    }
  }
}

try {
  inspect();
} catch (err) {
  console.error(err);
}
