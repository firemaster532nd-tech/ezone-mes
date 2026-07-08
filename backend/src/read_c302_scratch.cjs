const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = 'c:/Users/edwar/OneDrive/ezone-mes/upload/C302 제품식별 및 추적성관리 규정_Rev8.pdf';

async function parsePdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data: data });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `\n--- PAGE ${i} ---\n` + pageText;
  }
  return fullText;
}

async function main() {
  try {
    const text = await parsePdfText(pdfPath);
    const lines = text.split('\n');
    console.log(`Parsed ${pdfPath} successfully.`);
    lines.forEach((l, idx) => {
      const trimmed = l.trim();
      if (
        trimmed.includes('LOT') ||
        trimmed.includes('로트') ||
        trimmed.includes('식별') ||
        trimmed.includes('조립') ||
        trimmed.includes('완제품') ||
        trimmed.includes('반제품') ||
        trimmed.includes('소켓') ||
        trimmed.includes('평철')
      ) {
        console.log(`[L${idx+1}] ${trimmed}`);
      }
    });
  } catch (e) {
    console.error('Error parsing PDF:', e);
  }
}

main();
