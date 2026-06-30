const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function parsePdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data: data });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  const maxPages = Math.min(pdf.numPages, 15);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `\n--- PAGE ${i} ---\n` + pageText;
  }
  return fullText;
}

async function main() {
  const certDir = 'c:/Users/edwar/OneDrive/ezone-mes/upload/(주)이지원 품질인정서 원본(G4B)/2차 품질인정(24.7.22)';
  const vt049Pdf = path.join(certDir, 'EZ F.B POSMAC Duct-VT-049-9990124_KICT-2024-0181620250325162516_UCSDA.pdf');
  
  if (!fs.existsSync(vt049Pdf)) {
    console.error('File not found:', vt049Pdf);
    return;
  }
  
  try {
    console.log('Reading VT-049 PDF with legacy build...');
    const text = await parsePdfText(vt049Pdf);
    fs.writeFileSync('c:/Users/edwar/OneDrive/ezone-mes/backend/src/vt049_text.txt', text);
    console.log('Saved PDF text to vt049_text.txt');
    
    // 키워드 '소켓', 'socket', 'vm', 'vt', 'va' 검색 출력
    const lines = text.split('\n');
    lines.forEach((l, idx) => {
      const lower = l.toLowerCase();
      if (lower.includes('소켓') || lower.includes('socket') || lower.includes('vm') || lower.includes('vt') || lower.includes('va')) {
        // 너무 긴 행은 줄여서 출력
        const trimmed = l.trim();
        if (trimmed.length > 0) {
          console.log(`L${idx+1}:`, trimmed.slice(0, 150));
        }
      }
    });
  } catch (e) {
    console.error('Error parsing PDF:', e);
  }
}

main();
