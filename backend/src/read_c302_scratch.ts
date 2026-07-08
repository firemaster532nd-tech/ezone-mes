import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = '../upload/C302 제품식별 및 추적성관리 규정_Rev8.pdf';

async function parsePdfText(pdfPath: string) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data: data });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    console.log(`\n--- PAGE ${i} ---`);
    console.log(pageText);
  }
}

async function main() {
  try {
    await parsePdfText(pdfPath);
  } catch (err: any) {
    console.error('Error parsing PDF:', err.message);
  }
}

main();
