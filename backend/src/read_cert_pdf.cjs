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
  const certDir = 'c:/Users/edwar/OneDrive/ezone-mes/upload/(주)이지원 품질인정서 원본(G4B)/3차 품질인정(25.09.10)';
  
  const files = [
    '원본-(주)이지원-건기원 KICT(FS-BD25-0910-07) EZ-BD-CV-1S(200A) 품질인정서-25.09.10.pdf',
    '원본-(주)이지원-건기원 KICT(FS-BD25-0910-08) EZ-BD-RV-3S(025M) 품질인정서-25.09.10.pdf'
  ];

  for (const file of files) {
    const pdfPath = path.join(certDir, file);
    if (!fs.existsSync(pdfPath)) {
      console.error('File not found:', pdfPath);
      continue;
    }
    
    try {
      console.log(`\n======================================================`);
      console.log(`🔍 [PDF 분석] ${file}`);
      console.log(`======================================================`);
      
      const text = await parsePdfText(pdfPath);
      const lines = text.split('\n');
      console.log(`📄 총 페이지 수 분석 완료.`);
      
      lines.forEach((l, idx) => {
        const lower = l.toLowerCase();
        if (
          lower.includes('구성') ||
          lower.includes('자재') ||
          lower.includes('두께') ||
          lower.includes('치수') ||
          lower.includes('프레임') ||
          lower.includes('패킹') ||
          lower.includes('실란트') ||
          lower.includes('차열재') ||
          lower.includes('글라스울') ||
          lower.includes('posmac') ||
          lower.includes('플레이트') ||
          lower.includes('댐퍼') ||
          lower.includes('가스켓') ||
          lower.includes('하우징')
        ) {
          const trimmed = l.trim();
          if (trimmed.length > 0) {
            console.log(`[L${idx+1}]`, trimmed.slice(0, 140));
          }
        }
      });
    } catch (e) {
      console.error('Error parsing PDF:', e);
    }
  }
}

main();

