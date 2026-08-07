import { useState, useEffect, useRef } from 'react';
import { Printer, Barcode, Wifi, WifiOff, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { generateStandardLotLabelHtml, generateSerializedLotLabelBatchHtml, generateQrDataUrl, generateCode128Svg } from '@/lib/barcodeGenerator';
import { printHtmlViaQzTray } from '@/lib/qzTrayPrinter';

interface LabelData {
  lot_number: string;
  item_name?: string;
  category?: string;
  density?: number | string;
  thickness?: number | string;
  width_mm?: number | string;
  length_mm?: number | string;
  unit?: string;
  qty_current?: number | string;
  received_date?: string;
  location?: string;
  location_name?: string;
}

interface GodexLabelPrinterProps {
  labelData: LabelData;
  printerName?: string;
  copies?: number;
  onClose?: () => void;
}

// ZPL removed, moved to HTML pixel method.

// ─────────────────────────────────────────────────────────────────────────────
// 라벨 미리보기 컴포넌트 (80×60mm 사규 표준 라벨 템플릿 100% 일치 시뮬레이션)
// ─────────────────────────────────────────────────────────────────────────────
function LabelPreview({ data }: { data: LabelData }) {
  const [qrUrl, setQrUrl] = useState<string>('');

  const pipeSpecText = [
    data.thickness ? (typeof data.thickness === 'number' ? `${data.thickness}T` : String(data.thickness)) : '',
    data.density ? `${data.density}K` : '',
    data.width_mm ? `${data.width_mm}W` : '',
    data.length_mm ? `${data.length_mm}L` : '',
  ].filter(Boolean).join(' ') || data.thickness?.toString() || data.item_name || '100파이 210H';

  const lotNo = data.lot_number || '260203CW007';
  const itemName = data.item_name || '일체형슬리브 100파이';
  const locationText = data.location_name || data.location || 'FIELD-1F-MAT';

  useEffect(() => {
    const payload = `LOT: ${lotNo}\n제품명: ${itemName}\n규격: ${pipeSpecText}\n위치: ${locationText}\n수량: ${data.qty_current || 1}`;
    generateQrDataUrl(payload, 200).then(setQrUrl);
  }, [lotNo, itemName, pipeSpecText, locationText, data.qty_current]);

  const barcodeSvg = generateCode128Svg(lotNo, 22);

  return (
    <div
      className="bg-white border-2 border-slate-900 rounded-lg shadow-2xl mx-auto p-2 text-slate-900 font-sans"
      style={{ width: '320px', height: '240px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', position: 'relative' }}
    >
      {/* 헤더 */}
      <div className="flex justify-between items-center pb-1">
        <span className="font-extrabold text-slate-900 text-xs">(주)이지원</span>
        <span className="border border-slate-800 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-900">
          1/1 (입고LOT)
        </span>
      </div>
      <div className="border-b border-slate-900 mb-1"></div>

      {/* 중앙 본문 (좌측 대형 QR/바코드, 우측 LOT/품목/규격/순번) */}
      <div className="flex gap-2 items-start flex-1 my-0.5">
        <div className="w-[100px] flex flex-col items-center">
          <div className="w-[90px] h-[90px] border border-slate-300 rounded p-0.5 bg-white">
            {qrUrl ? <img src={qrUrl} alt="QR" className="w-full h-full object-contain" /> : <div className="text-[8px] text-center pt-8">QR...</div>}
          </div>
          <div className="w-full mt-1 text-center overflow-hidden">
            <div className="w-[85px] mx-auto" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
            <div className="text-[8px] font-mono text-slate-600 tracking-tight mt-0.5">{lotNo}</div>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 font-mono text-[10px] pt-1">
          <div className="flex"><span className="w-8 text-slate-500 font-normal">LOT</span> <strong className="text-slate-900 text-xs font-black truncate">{lotNo}</strong></div>
          <div className="flex"><span className="w-8 text-slate-500 font-normal">품목</span> <strong className="text-slate-900 text-[10px] font-bold truncate">{itemName}</strong></div>
          <div className="flex"><span className="w-8 text-slate-500 font-normal">규격</span> <strong className="text-blue-700 text-xs font-black underline">{pipeSpecText}</strong></div>
          <div className="flex"><span className="w-8 text-slate-500 font-normal">순번</span> <strong className="text-slate-900 font-bold">1 / 1</strong></div>
        </div>
      </div>

      {/* 하단 점선 및 풋터 */}
      <div className="border-t border-dashed border-slate-400 my-1"></div>
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-700">
        <span>입고: {data.received_date ? data.received_date.slice(0, 10) : '2026-02-02'}</span>
        <span className="font-bold">◆◆◆◆◆◆ {locationText}</span>
        <span>발행: 1 / 1</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
export function GodexLabelPrinter({ labelData, printerName: initialPrinter, copies: initialCopies = 1, onClose }: GodexLabelPrinterProps) {
  const [selectedPrinter, setSelectedPrinter] = useState(initialPrinter || '');
  const [copies, setCopies] = useState(initialCopies);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<'success' | 'error' | null>(null);
  const [qzLoaded, setQzLoaded] = useState(false);

  // QZ Tray 연결 상태
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);

  // QZ Tray JS 스크립트 동적 로드
  useEffect(() => {
    if ((window as any).qz) { setQzLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.onload = () => setQzLoaded(true);
    script.onerror = () => setQzLoaded(false);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const connectQz = async () => {
    setError(null);
    try {
      const qz = (window as any).qz;
      if (!qz) throw new Error('QZ Tray 스크립트가 로드되지 않았습니다.');
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }
      setConnected(true);
      const found = await qz.printers.find();
      setPrinters(found || []);
      if (found && found.length > 0 && !selectedPrinter) {
        const defaultP = found.find((p: string) => p.toLowerCase().includes('godex') || p.toLowerCase().includes('label')) || found[0];
        setSelectedPrinter(defaultP);
      }
    } catch (err: any) {
      setConnected(false);
      setError(err?.message || 'QZ Tray 연결 실패 (프로그램 실행 필요)');
    }
  };

  const disconnect = async () => {
    try {
      const qz = (window as any).qz;
      if (qz && qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch {
      /* ignore */
    } finally {
      setConnected(false);
      setSelectedPrinter('');
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    setPrintResult(null);
    try {
      const specText = [
        labelData.thickness ? (typeof labelData.thickness === 'number' ? `${labelData.thickness}T` : String(labelData.thickness)) : '',
        labelData.density ? `${labelData.density}K` : '',
        labelData.width_mm ? `${labelData.width_mm}W` : '',
        labelData.length_mm ? `${labelData.length_mm}L` : '',
      ].filter(Boolean).join(' ') || labelData.thickness?.toString() || '규격 미기재';

      const count = copies > 0 ? copies : Math.max(1, Number(labelData.qty_current || 1));
      
      // HTML 생성
      const labelHtmlContent = await generateSerializedLotLabelBatchHtml(
        labelData.lot_number,
        labelData.item_name || '품목명 미지정',
        specText,
        labelData.location_name || labelData.location || '-',
        Number(labelData.qty_current || 1),
        labelData.unit || 'EA',
        labelData.received_date,
        count
      );

      // 전체 HTML 랩핑 (흑백, 크기 조정)
      const fullHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>LOT 라벨</title>
      <style>
        @page { size: 80mm 60mm; margin: 0 !important; }
        @media print {
          @page { size: 80mm 60mm; margin: 0 !important; }
          html, body { width: 80mm !important; height: 60mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
        }
        html, body { width: 80mm; height: 60mm; margin: 0; padding: 0; background: #fff; font-family: 'Malgun Gothic', sans-serif; overflow: hidden; transform: scale(0.96); transform-origin: top left; }
        * { color: black !important; border-color: black !important; background-color: transparent !important; }
        .label-card { width: 76mm; height: 56mm; margin: 2mm auto; padding: 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 0.3mm solid #000; overflow: hidden; page-break-inside: avoid; break-inside: avoid; background: #fff; }
        .label-card:not(:last-child) { page-break-after: always; break-after: always; }
        .header { display: flex; justify-content: space-between; align-items: center; font-size: 9pt; font-weight: bold; }
        .company { font-weight: 900; font-size: 10pt; color: #000; }
        .lot-badge-box { border: 0.3mm solid #000; border-radius: 10px; padding: 0.5mm 3mm; font-size: 7.5pt; font-weight: bold; }
        .header-divider { border-bottom: 0.4mm solid #000; margin: 1mm 0 1.5mm 0; }
        .body-row { display: flex; gap: 2.5mm; align-items: flex-start; flex: 1; overflow: hidden; }
        .qr-col { width: 26mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
        .qr-img { width: 25mm; height: 25mm; border: 0.2mm solid #000; }
        .barcode-box { width: 25mm; text-align: center; margin-top: 1mm; }
        .barcode-box svg { width: 24mm; height: 6mm; margin: 0 auto; display: block; }
        .barcode-text { font-size: 5pt; font-family: monospace; letter-spacing: 0.2px; margin-top: 0.2mm; }
        .info-col { flex: 1; overflow: hidden; font-family: monospace; }
        .field { font-size: 7.5pt; margin-bottom: 0.8mm; line-height: 1.2; display: flex; white-space: nowrap; overflow: hidden; }
        .field .lbl { width: 8mm; color: #000; flex-shrink: 0; }
        .field .val { font-weight: bold; color: #000; overflow: hidden; text-overflow: ellipsis; }
        .lot-title { font-size: 9.5pt; font-weight: 900; }
        .item-title { font-size: 8.5pt; font-weight: bold; }
        .thickness-val { text-decoration: underline; font-weight: 900; }
        .footer-divider { border-top: 0.2mm dashed #000; margin: 1mm 0 0.8mm 0; }
        .footer { display: flex; justify-content: space-between; align-items: center; font-size: 6.5pt; font-family: monospace; }
        .loc-text { font-weight: bold; }
      </style></head><body>${labelHtmlContent}</body></html>
      `;

      await printHtmlViaQzTray(fullHtml, selectedPrinter || undefined, { copies: 1 });
      setPrintResult('success');
    } catch (e: any) {
      setPrintResult('error');
      alert('인쇄 실패: ' + (e.message || e));
    } finally {
      setPrinting(false);
    }
  };
  const handleBrowserPrint = async () => {
    const win = window.open('', '_blank', 'width=450,height=380');
    if (!win) return;
    const specText = [
      labelData.thickness ? (typeof labelData.thickness === 'number' ? `${labelData.thickness}T` : String(labelData.thickness)) : '',
      labelData.density ? `${labelData.density}K` : '',
      labelData.width_mm ? `${labelData.width_mm}W` : '',
      labelData.length_mm ? `${labelData.length_mm}L` : '',
    ].filter(Boolean).join(' ') || labelData.thickness?.toString() || '규격 미기재';

    const count = copies > 0 ? copies : Math.max(1, Number(labelData.qty_current || 1));
    const labelHtml = await generateSerializedLotLabelBatchHtml(
      labelData.lot_number,
      labelData.item_name || '품목명 미지정',
      specText,
      labelData.location_name || labelData.location || '-',
      Number(labelData.qty_current || 1),
      labelData.unit || 'EA',
      labelData.received_date,
      count
    );

    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>LOT 라벨</title>
      <style>
        @page { size: 80mm 60mm; margin: 0 !important; }
        @media print {
          @page { size: 80mm 60mm; margin: 0 !important; }
          html, body { width: 80mm !important; height: 60mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
        }
        html, body { width: 80mm; height: 60mm; margin: 0; padding: 0; background: #fff; font-family: 'Malgun Gothic', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden; }
        .label-card { width: 76mm; height: 56mm; margin: 2mm auto; padding: 1.5mm 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 0.4mm solid #334155; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
        .label-card:not(:last-child) { page-break-after: always; break-after: always; }
        .label-card:last-child { page-break-after: avoid; break-after: avoid; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.3mm solid #1a237e; padding-bottom: 0.5mm; font-size: 7pt; font-weight: bold; }
        .company { color: #c00; } .title { color: #1a237e; } .date { color: #666; font-size: 6pt; }
        .body-row { display: flex; gap: 2mm; align-items: center; flex: 1; margin-top: 0.5mm; margin-bottom: 0.5mm; overflow: hidden; }
        .qr-box .qr-img { width: 16mm; height: 16mm; border: 0.2mm solid #cbd5e1; flex-shrink: 0; }
        .info-box { flex: 1; overflow: hidden; }
        .lot-number { font-size: 9pt; font-weight: 900; font-family: monospace; color: #1d4ed8; letter-spacing: -0.2px; white-space: nowrap; }
        .field { font-size: 6.5pt; margin-top: 0.3mm; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .field .lbl { color: #64748b; }
        .field .val { font-weight: bold; color: #0f172a; }
        .item-val { color: #0f172a; }
        .loc-val { color: #065f46; }
        .qty-bar { background: #f8fafc; border: 0.2mm solid #cbd5e1; padding: 0.5mm 1.5mm; font-size: 7pt; margin-top: 0.5mm; display: flex; justify-content: space-between; align-items: center; }
        .barcode-box { text-align: center; border-top: 0.2mm dashed #cbd5e1; padding-top: 0.5mm; margin-top: 0.5mm; }
        .barcode-box svg { width: 60mm; height: 8mm; margin: 0 auto; display: block; }
        .barcode-text { font-size: 5.5pt; font-family: monospace; color: #475569; letter-spacing: 0.5px; margin-top: 0.2mm; }
      </style></head><body>${labelHtml}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-auto relative my-auto border border-slate-200" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-lg text-slate-800">🏷️ 고덱스 라벨 출력</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-lg font-bold transition">×</button>
          )}
        </div>

        {/* 라벨 미리보기 */}
        <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-700 mb-2 text-center flex items-center justify-center gap-1">
            📋 (주)이지원 사규 표준 라벨 미리보기 (80mm × 60mm)
          </p>
          <LabelPreview data={labelData} />
        </div>

        {/* QZ Tray 방식 */}
        <div className="border rounded-xl p-4 mb-4 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            {connected
              ? <Wifi className="w-4 h-4 text-green-600" />
              : <WifiOff className="w-4 h-4 text-slate-400" />}
            <span className="text-sm font-bold text-slate-800">QZ Tray 직접 인쇄 (권장)</span>
            {connected && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">연결됨</span>}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3 border border-amber-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="mt-1 text-slate-600">QZ Tray 프로그램 실행 후 아래 "재연결" 버튼을 클릭하세요.</p>
              </div>
            </div>
          )}

          {!connected ? (
            <button
              onClick={connectQz}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4 text-emerald-400" /> QZ Tray 연결하기
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">선택된 프린터:</span>
                <strong className="text-slate-900 font-extrabold">{selectedPrinter || 'Godex (자동)'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-600 font-medium">출력 매수 (장수)</label>
                <input
                  type="number" min={1} max={99} value={copies}
                  onChange={e => setCopies(Number(e.target.value))}
                  className="w-20 border rounded-lg px-2 py-1 text-sm font-bold text-center border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handlePrint}
                  disabled={printing || !selectedPrinter}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Printer className="w-4 h-4" />
                  {printing ? '출력 중...' : `라벨 출력 (${copies}매)`}
                </button>
                <button
                  onClick={disconnect}
                  className="px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  연결 해제
                </button>
              </div>
              {printResult === 'success' && (
                <div className="flex items-center gap-1.5 text-green-700 text-xs font-bold bg-green-50 p-2 rounded-lg border border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" /> 고덱스 프린터로 전송 완료!
                </div>
              )}
            </div>
          )}
        </div>
        {/* 브라우저 인쇄 방식 (대안) */}
        <div className="border rounded-xl p-4 bg-slate-50 border-slate-200">
          <p className="text-xs text-slate-700 font-bold mb-1">🖨️ 브라우저 일반 인쇄 (대안)</p>
          <p className="text-xs text-slate-500 mb-3">
            QZ Tray가 없을 때 브라우저 인쇄 대화상자로 출력합니다.
          </p>
          <button
            onClick={handleBrowserPrint}
            className="w-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-lg transition shadow-sm"
          >
            브라우저로 인쇄
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 독립 페이지 버전 (LOT 번호로 라벨 출력)
// ─────────────────────────────────────────────────────────────────────────────
export function LabelPrintPage() {
  const [lotNumber, setLotNumber] = useState('');
  const [lotData, setLotData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [printerName, setPrinterName] = useState(
    () => localStorage.getItem('ezone_godex_printer') || ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const searchLot = async () => {
    if (!lotNumber.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/material-lots?search=${encodeURIComponent(lotNumber.trim())}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.data?.length > 0) {
        setLotData(json.data[0]);
      } else {
        alert('해당 LOT를 찾을 수 없습니다: ' + lotNumber);
        setLotData(null);
      }
    } catch (e) {
      alert('조회 실패');
    } finally {
      setLoading(false);
    }
  };

  const savePrinter = (name: string) => {
    setPrinterName(name);
    localStorage.setItem('ezone_godex_printer', name);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-xl"><Printer className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">LOT 라벨 출력</h1>
            <p className="text-sm text-gray-500">고덱스 라벨 프린터 직접 출력 (QZ Tray)</p>
          </div>
        </div>

        {/* LOT 검색 */}
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            LOT 번호 입력 또는 바코드 스캔
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={lotNumber}
              onChange={e => setLotNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchLot()}
              placeholder="예: 260227CW005"
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={searchLot}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {loading ? '...' : '검색'}
            </button>
          </div>
          {lotData && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm">
              <div className="flex items-center gap-2 text-blue-800">
                <Package className="w-4 h-4" />
                <span className="font-semibold">{lotData.item_name}</span>
                <span className="text-blue-600">({lotData.category})</span>
              </div>
              <div className="text-blue-600 mt-1 font-mono text-xs">{lotData.lot_number} · 현재고: {lotData.qty_current} {lotData.unit}</div>
            </div>
          )}
        </div>

        {/* 라벨 출력 */}
        {lotData && (
          <GodexLabelPrinter
            labelData={lotData}
            printerName={printerName}
            copies={1}
          />
        )}
      </div>
    </div>
  );
}
