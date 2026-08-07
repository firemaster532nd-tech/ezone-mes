import QRCode from 'qrcode';

// ─── Code128-B 1D 바코드 패턴 테이블 (ISO/IEC 15417 표준) ────────────────────
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','313111','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112'
];

/**
 * 1D Code128-B 바코드 SVG 생성
 */
export function generateCode128Svg(text: string, height = 35): string {
  const safeText = text.replace(/[^\x20-\x7E]/g, '').trim() || 'NO-DATA';
  
  const codes: number[] = [104]; // Start B
  let sum = 104;

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    const validCode = code >= 0 && code <= 95 ? code : 31; // fallback to '?'
    codes.push(validCode);
    sum += validCode * (i + 1);
  }

  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(106); // Stop

  let modules = '';
  codes.forEach(c => {
    modules += CODE128_PATTERNS[c];
  });

  let totalUnits = 0;
  for (let i = 0; i < modules.length; i++) {
    totalUnits += parseInt(modules[i], 10);
  }

  let x = 0;
  let rects = '';
  for (let i = 0; i < modules.length; i++) {
    const width = parseInt(modules[i], 10);
    const isBar = i % 2 === 0;
    if (isBar) {
      rects += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000000"/>`;
    }
    x += width;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalUnits} ${height}" width="100%" height="${height}px" preserveAspectRatio="none" style="display:block;">${rects}</svg>`;
}

/**
 * 2D QR 코드 Data URL (Base64) 생성 (오프라인 100% 동작, 빈 QR 방지)
 */
export async function generateQrDataUrl(text: string, size = 200): Promise<string> {
  try {
    return await QRCode.toDataURL(text || 'EMPTY', {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('QR Code Generation error:', err);
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

export interface RackLabelStockInfo {
  lotNumber?: string;
  itemName?: string;
  qty?: number | string;
  type?: 'certified' | 'non_certified' | 'empty';
}

export async function generateRackLocationLabelHtml(
  locFull: string,
  sideText: string,
  code: string,
  _stockInfo?: RackLabelStockInfo | null   // 현재 미사용 — QR URL 스캔 페이지로 재고 표시
): Promise<string> {
  // QR에는 스캔 시 재고 조회 URL 인코딩 (스마트폰/PC에서 바로 재고 확인)
  const BASE_URL = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://이지원.kr';
  const qrUrl = `${BASE_URL}/scan?loc=${encodeURIComponent(locFull)}`;

  const qrDataUrl = await generateQrDataUrl(qrUrl, 400);
  const barcodeSvg = generateCode128Svg(locFull, 45);

  return `
<div style="width: 76mm; height: 56mm; margin: 2mm auto; padding: 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 0.6mm solid #000; overflow: hidden; page-break-inside: avoid; break-inside: avoid; background: white;">
  <div style="font-size: 25pt; font-weight: 900; font-family: 'Malgun Gothic', sans-serif; color: #000; letter-spacing: 1px; text-align: center; margin-bottom: 2mm; line-height: 1;">
    ${locFull}
  </div>
  <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin-bottom: 2mm;">
    <img src="${qrDataUrl}" alt="QR" style="width: 25mm; height: 25mm; border: 0.3mm solid #000;" />
  </div>
  <div style="text-align: center; width: 100%;">
    <div style="width: 70mm; margin: 0 auto; display: flex; justify-content: center; padding-top: 1mm; border-top: 0.3mm dashed #000;">
      ${barcodeSvg.replace('width="100%"', 'width="100%" style="max-height: 12mm;"')}
    </div>
  </div>
</div>`;
}

/**
 * 랙 위치 LOT 라벨 HTML 생성 (80×60mm) - QR + 바코드 동시 인쇄
 */
export async function generateRackLotLabelHtml(
  locFull: string,
  sideText: string,
  lotNo: string,
  itemName: string,
  qty: string,
  spec?: string
): Promise<string> {
  const codeText = lotNo !== '-' ? lotNo : locFull;
  const qrPayload = [
    `LOT: ${lotNo}`,
    `제품명: ${itemName || '-'}`,
    `규격: ${spec || '규격 미기재'}`,
    `위치: ${locFull} (${sideText})`,
    `수량: ${qty}`
  ].join('\n');

  const qrDataUrl = await generateQrDataUrl(qrPayload, 220);
  const barcodeSvg = generateCode128Svg(codeText, 32);

  return `
<div class="label-card">
  <div class="header">
    <span class="company">(주)이지원</span>
    <span class="title">📦 랙 재고 LOT 라벨</span>
    <span class="date">${new Date().toISOString().slice(0, 10)}</span>
  </div>
  <div class="body-row">
    <div class="qr-box">
      <img src="${qrDataUrl}" alt="QR" class="qr-img"/>
    </div>
    <div class="info-box">
      <div class="loc-code">${locFull} (${sideText})</div>
      <div class="field"><span class="lbl">LOT:</span> <span class="val lot-val">${lotNo}</span></div>
      <div class="field"><span class="lbl">품목:</span> <span class="val">${itemName}</span></div>
      <div class="field"><span class="lbl" style="font-weight:bold;color:#b91c1c;">규격:</span> <span class="val spec-val font-bold">${spec || '규격 미기재'}</span></div>
      <div class="field"><span class="lbl">수량:</span> <span class="val qty-val">${qty}</span></div>
    </div>
  </div>
  <div class="barcode-box">
    ${barcodeSvg}
    <div class="barcode-text">${codeText}</div>
  </div>
</div>`;
}

/**
 * 자재 / 완제품 표준 LOT 라벨 HTML 생성 (80×60mm) - QR + 바코드 동시 인쇄
 */
export async function generateStandardLotLabelHtml(
  lotNo: string,
  itemName: string,
  spec: string,
  location: string,
  qtyStr: string,
  unit: string,
  receivedDate?: string,
  seqBadge?: string
): Promise<string> {
  const qrPayload = [
    `LOT: ${lotNo}`,
    `제품명: ${itemName || '-'}`,
    `규격: ${spec || '규격 미기재'}`,
    `위치: ${location || '-'}`,
    `수량: ${qtyStr} ${unit}`
  ].join('\n');

  const qrDataUrl = await generateQrDataUrl(qrPayload, 200);
  const barcodeSvg = generateCode128Svg(lotNo, 24);

  // 파이 및 높이 규격 텍스트 추출 (예: 100파이 210H)
  let pipeSpecText = spec || '-';
  if (!pipeSpecText || pipeSpecText === '-') {
    pipeSpecText = itemName;
  }

  const badgeText = seqBadge || '1/1';
  const dateFormatted = receivedDate ? receivedDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const locFormatted = location && location !== '-' ? location : 'A1-P1';

  return `
<div class="label-card">
  <div class="header">
    <span class="company">(주)이지원</span>
    <span class="lot-badge-box">${badgeText} (입고LOT)</span>
  </div>
  <div class="header-divider"></div>
  
  <div class="body-row">
    <div class="qr-col">
      <img src="${qrDataUrl}" alt="QR" class="qr-img"/>
      <div class="barcode-box">
        ${barcodeSvg}
        <div class="barcode-text">${lotNo}</div>
      </div>
    </div>
    <div class="info-col">
      <div class="field"><span class="lbl">LOT</span> <span class="val lot-title">${lotNo}</span></div>
      <div class="field"><span class="lbl">품목</span> <span class="val item-title">${itemName}</span></div>
      <div class="field"><span class="lbl">규격</span> <span class="val thickness-val">${pipeSpecText}</span></div>
      <div class="field"><span class="lbl">순번</span> <span class="val">${badgeText}</span></div>
    </div>
  </div>

  <div class="footer-divider"></div>
  <div class="footer">
    <span class="date-text">입고: ${dateFormatted}</span>
    <span class="loc-text">◆◆◆◆◆◆ ${locFormatted}</span>
    <span class="print-seq">발행: ${badgeText}</span>
  </div>
</div>`;
}

export async function generateSerializedLotLabelBatchHtml(
  lotNo: string,
  itemName: string,
  spec: string,
  location: string,
  totalQty: number,
  unit: string,
  receivedDate?: string,
  printCountOverride?: number
): Promise<string> {
  const cards: string[] = [];
  const count = printCountOverride && printCountOverride > 0 ? printCountOverride : Math.max(1, totalQty);
  const denom = totalQty > 0 ? Math.round(totalQty) : count;
  
  for (let i = 1; i <= count; i++) {
    const seqBadge = `${i}/${denom}`;
    // 사규 C302 LOT 부여 규칙 준수: LOT 번호에 임의 접미사(-001)나 랙 표시 결합 금지
    const cardHtml = await generateStandardLotLabelHtml(
      lotNo,
      itemName,
      spec,
      location,
      totalQty.toLocaleString(),
      unit,
      receivedDate,
      seqBadge
    );
    cards.push(cardHtml);
  }

  return cards.join('');
}
