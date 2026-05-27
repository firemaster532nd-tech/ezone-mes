import fs from 'fs';
import https from 'https';
import path from 'path';
import XLSX from 'xlsx';

const scratchDir = 'C:\\Users\\edwar\\.gemini\\antigravity\\brain\\79d4c3dc-5488-4b43-80c5-b95250044cd0\\scratch';

// Ensure scratch directory exists
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

const file1Path = path.join(scratchDir, 'sheet1.xlsx');
const file2Path = path.join(scratchDir, 'sheet2.xlsx');

const url1 = 'https://docs.google.com/spreadsheets/d/1dUrjgHuUFRr0I6yi5EGYYdHH2AWCz2PRfEVPPX_51vg/export?format=xlsx';
const url2 = 'https://docs.google.com/spreadsheets/d/1kH9YUURBpINrDBvGdFjk2d724ubWQTkq/export?format=xlsx';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // Handle redirects (301, 302, 303, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download from ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function analyzeExcel(filePath, label) {
  console.log(`\n=================== ANALYZING ${label} ===================`);
  const workbook = XLSX.readFile(filePath);
  console.log(`Sheet Names:`, workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Get range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    console.log(`\n--- Sheet: "${sheetName}" (Range: ${worksheet['!ref']}, Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}) ---`);
    
    // Parse first 15 rows
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }).slice(0, 15);
    console.log(`Sample Rows (First 15 rows):`);
    rows.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, row.slice(0, 15).map(v => typeof v === 'string' ? v.trim() : v));
    });
  }
}

async function run() {
  try {
    console.log('Downloading Sheet 1...');
    await downloadFile(url1, file1Path);
    console.log('Downloaded Sheet 1.');
    
    console.log('Downloading Sheet 2...');
    await downloadFile(url2, file2Path);
    console.log('Downloaded Sheet 2.');
    
    analyzeExcel(file1Path, 'Sheet 1 (이지원재고수불표)');
    analyzeExcel(file2Path, 'Sheet 2 (완제품조립수불현황)');
  } catch (err) {
    console.error('Error during run:', err);
  }
}

run();
