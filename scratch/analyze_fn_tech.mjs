import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file6 = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\에프엔테크\\에프엔테크 입출고 관리(2606)-1.xlsx';
const file7 = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\에프엔테크\\에프엔테크 입출고 관리(2607)-1.xlsx';

function inspectWorkbook(filePath, outFilePath) {
  const logStream = fs.createWriteStream(outFilePath, { flags: 'w' });
  const log = (msg) => {
    console.log(msg);
    logStream.write(msg + '\n');
  };

  log(`Workbook Path: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    log(`ERROR: File does not exist`);
    logStream.end();
    return;
  }

  const wb = XLSX.readFile(filePath);
  log(`Sheets count: ${wb.SheetNames.length}`);
  log(`Sheet Names: ${JSON.stringify(wb.SheetNames)}`);

  wb.SheetNames.forEach((name) => {
    log(`\n----------------------------------------`);
    log(`Sheet Name: "${name}"`);
    const ws = wb.Sheets[name];
    const ref = ws['!ref'] || 'A1:A1';
    log(`Ref range: ${ref}`);

    const range = XLSX.utils.decode_range(ref);
    const maxR = Math.min(range.e.r, 40); // 40행까지 분석
    const maxC = Math.min(range.e.c, 30); // 30열까지 분석

    log(`Decoding top ${maxR + 1} rows and ${maxC + 1} columns:`);
    for (let r = 0; r <= maxR; r++) {
      const rowVals = [];
      let hasVal = false;
      for (let c = 0; c <= maxC; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        const val = cell ? String(cell.v).trim() : '';
        rowVals.push(val);
        if (val !== '') hasVal = true;
      }
      if (hasVal) {
        log(`Row ${String(r).padStart(2, ' ')}: ${JSON.stringify(rowVals)}`);
      }
    }
  });

  logStream.end();
}

inspectWorkbook(file6, 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\scratch\\analysis_2606.txt');
inspectWorkbook(file7, 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\scratch\\analysis_2607.txt');
console.log('Analysis reports generated in scratch folder.');
