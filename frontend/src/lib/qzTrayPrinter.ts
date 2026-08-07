export async function ensureQzTrayLoaded(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.qz) {
      resolve(w.qz);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.onload = () => {
      const qz = w.qz;
      // 빈 인증서 설정 — "Remember this decision" 체크 후 반복 확인 최소화
      if (qz?.security) {
        qz.security.setCertificatePromise(() => Promise.resolve(''));
        qz.security.setSignaturePromise(() => () => Promise.resolve(''));
      }
      resolve(qz);
    };
    script.onerror = () => reject(new Error('QZ Tray 스크립트를 CDN에서 로드하는 데 실패했습니다.'));
    document.head.appendChild(script);
  });
}

export async function printHtmlViaQzTray(
  htmlContent: string,
  printerName?: string,
  options: { copies?: number; widthMm?: number; heightMm?: number } = {}
) {
  const qz = await ensureQzTrayLoaded();

  // 1. QZ Tray 연결 (무서명 모드)
  if (!qz.websocket.isActive()) {
    try {
      await qz.websocket.connect({
        retries: 3,
        delay: 500,
        host: ['localhost'],
        usingSecure: window.location.protocol === 'https:',
      });
    } catch (e) {
      if (window.location.protocol === 'https:') {
        // Fallback to HTTP
        await qz.websocket.connect({
          retries: 2,
          delay: 500,
          host: ['localhost'],
          usingSecure: false,
        });
      } else {
        throw e;
      }
    }
  }

  // 2. 프린터 찾기
  let targetPrinter = printerName;
  if (!targetPrinter) {
    let printers = await qz.printers.find('Godex');
    if (!Array.isArray(printers)) printers = printers ? [printers] : [];
    if (printers.length === 0) {
      const all = await qz.printers.find();
      const allList = Array.isArray(all) ? all : [all];
      targetPrinter = prompt(
        'Godex 프린터를 자동으로 찾지 못했습니다.\n아래 목록에서 프린터명을 정확히 입력하세요:\n\n' +
        allList.join('\n')
      );
      if (!targetPrinter) {
        throw new Error('프린터 선택이 취소되었습니다.');
      }
    } else {
      targetPrinter = printers[0];
    }
  }

  // 3. 인쇄 설정
  const config = qz.configs.create(targetPrinter, {
    size: { width: options.widthMm || 80, height: options.heightMm || 60 },
    margins: 0,
    units: 'mm',
    density: 203,
    colorType: 'blackwhite',
    copies: options.copies || 1
  });

  // 4. 인쇄 데이터 전송 (Pixel HTML)
  const printData = [{
    type: 'pixel',
    format: 'html',
    flavor: 'plain',
    data: htmlContent
  }];

  await qz.print(config, printData);
}

/**
 * 여러 라벨을 1장씩 QZ Tray로 순차 전송
 * pixel/html은 CSS page-break를 무시하므로 라벨당 qz.print() 1회 필수
 */
export async function printLabelsViaQzTray(
  labelHtmlDivs: string[],
  printerName?: string,
  options: { widthMm?: number; heightMm?: number } = {}
) {
  const qz = await ensureQzTrayLoaded();

  // 연결
  if (!qz.websocket.isActive()) {
    try {
      await qz.websocket.connect({ retries: 3, delay: 500, host: ['localhost'], usingSecure: window.location.protocol === 'https:' });
    } catch {
      await qz.websocket.connect({ retries: 2, delay: 500, host: ['localhost'], usingSecure: false });
    }
  }

  // 프린터 찾기
  let targetPrinter = printerName;
  if (!targetPrinter) {
    let printers = await qz.printers.find('Godex');
    if (!Array.isArray(printers)) printers = printers ? [printers] : [];
    if (printers.length === 0) {
      const all = await qz.printers.find();
      const allList = Array.isArray(all) ? all : [all];
      targetPrinter = prompt('Godex 프린터를 찾지 못했습니다.\n프린터명을 입력하세요:\n\n' + allList.join('\n'));
      if (!targetPrinter) throw new Error('프린터 선택 취소');
    } else {
      targetPrinter = printers[0];
    }
  }

  const config = qz.configs.create(targetPrinter, {
    size: { width: options.widthMm || 80, height: options.heightMm || 60 },
    margins: 0, units: 'mm', density: 203, colorType: 'blackwhite', copies: 1,
  });

  // 모든 라벨을 단일 qz.print() 배열로 전송 → 보안 다이얼로그 1번만 표시
  const printData = labelHtmlDivs.map(div => ({
    type: 'pixel',
    format: 'html',
    flavor: 'plain',
    data: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @page { size: 80mm 60mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: 80mm; height: 60mm; overflow: hidden; background: white; font-family: 'Malgun Gothic', Arial, sans-serif; }
</style></head><body>${div}</body></html>`,
  }));

  await qz.print(config, printData);
}
