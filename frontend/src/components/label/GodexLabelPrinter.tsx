import { useState, useEffect, useRef } from 'react';
import { Printer, Barcode, Wifi, WifiOff, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { generateStandardLotLabelHtml, generateSerializedLotLabelBatchHtml } from '@/lib/barcodeGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// QZ Tray 타입 선언
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    qz: any;
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// ZPL 생성 함수 (고덱스 ZPL 호환)
// ─────────────────────────────────────────────────────────────────────────────
function buildZpl(data: LabelData, copies: number = 1): string {
  const {
    lot_number = '',
    item_name = '',
    category = '',
    density = '',
    thickness = '',
    width_mm = '',
    length_mm = '',
    unit = 'EA',
    qty_current = '',
    received_date = '',
    location = '',
    location_name = '',
  } = data;

  // 규격 문자열 조합
  const spec = [
    density ? `${density}K` : '',
    thickness ? `${thickness}T` : '',
    width_mm ? `${width_mm}W` : '',
    length_mm ? `${length_mm}L` : '',
  ].filter(Boolean).join(' ');

  // 날짜 포맷 (YYYY-MM-DD → YY.MM.DD)
  const dateStr = received_date
    ? received_date.slice(2).replace(/-/g, '.')
    : new Date().toISOString().slice(2, 10).replace(/-/g, '.');

  // 라벨 크기: 60mm × 40mm (2.36" × 1.57") @ 203 dpi
  // 1mm ≈ 8 dots (203dpi)
  return `
^XA
^PW480
^LL320
^CI28

^FO10,10^A0N,22,22^FD${category}^FS
^FO10,36^A0N,28,28^FD${item_name.slice(0,28)}^FS
^FO10,68^A0N,22,22^FD규격: ${spec}^FS
^FO10,92^A0N,20,20^FD수량: ${qty_current} ${unit}^FS
^FO10,114^A0N,20,20^FD입고일: ${dateStr}^FS

^FO10,140^A0N,24,24^FD위치: ${location_name || location || '위치 미지정'}^FS
^FO10,165^BY2,3,50^BCN,50,Y,N,N
^FD${lot_number}^FS

^FO10,240^A0N,18,18^FDLOT: ${lot_number}^FS

^PQ${copies},0,1,Y
^XZ
  `.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// QZ Tray 연결 훅
// ─────────────────────────────────────────────────────────────────────────────
function useQzTray() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);

  const connect = async () => {
    try {
      if (!window.qz) {
        setError('QZ Tray가 설치되지 않았습니다. qz.io에서 다운로드하세요.');
        return false;
      }
      if (!window.qz.websocket.isActive()) {
        await window.qz.websocket.connect();
      }
      setConnected(true);
      setError(null);

      // 프린터 목록 조회
      const list = await window.qz.printers.find();
      setPrinters(Array.isArray(list) ? list : [list]);
      return true;
    } catch (e: any) {
      setError(e.message || 'QZ Tray 연결 실패');
      setConnected(false);
      return false;
    }
  };

  const disconnect = async () => {
    try {
      if (window.qz?.websocket?.isActive()) {
        await window.qz.websocket.disconnect();
      }
      setConnected(false);
    } catch (_) {}
  };

  const print = async (printerName: string, zpl: string) => {
    if (!window.qz) throw new Error('QZ Tray가 필요합니다.');
    const config = window.qz.configs.create(printerName);
    const data = [{ type: 'raw', format: 'plain', data: zpl }];
    await window.qz.print(config, data);
  };

  return { connected, error, printers, connect, disconnect, print };
}

// ─────────────────────────────────────────────────────────────────────────────
// 라벨 미리보기 컴포넌트 (60×40mm 시뮬레이션)
// ─────────────────────────────────────────────────────────────────────────────
function LabelPreview({ data }: { data: LabelData }) {
  const spec = [
    data.density ? `${data.density}K` : '',
    data.thickness ? `${data.thickness}T` : '',
    data.width_mm ? `${data.width_mm}W` : '',
    data.length_mm ? `${data.length_mm}L` : '',
  ].filter(Boolean).join(' ');

  const dateStr = (data.received_date || new Date().toISOString().slice(0, 10))
    .slice(2).replace(/-/g, '.');

  return (
    <div
      className="bg-white border-2 border-gray-800 rounded shadow-md mx-auto"
      style={{ width: '240px', height: '160px', padding: '8px', fontFamily: 'monospace', position: 'relative' }}
    >
      <div style={{ fontSize: '9px', color: '#666', fontWeight: 'bold' }}>{data.category}</div>
      <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {data.item_name?.slice(0, 22) || '—'}
      </div>
      <div style={{ fontSize: '9px', marginBottom: '2px' }}>규격: {spec || '—'}</div>
      <div style={{ fontSize: '9px', marginBottom: '2px' }}>수량: {data.qty_current} {data.unit || 'EA'}</div>
      <div style={{ fontSize: '9px', marginBottom: '4px' }}>입고: {dateStr}</div>
      <div style={{ fontSize: '9px', marginBottom: '4px', color: '#1d4ed8', fontWeight: 'bold' }}>위치: {data.location_name || data.location || '위치 미지정'}</div>

      {/* 바코드 시뮬레이션 */}
      <div style={{ display: 'flex', gap: '1px', height: '28px', marginBottom: '2px' }}>
        {Array.from(data.lot_number || '').map((c, i) => (
          <div
            key={i}
            style={{
              width: `${(c.charCodeAt(0) % 3) + 1}px`,
              background: '#000',
              height: '100%',
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: '8px', textAlign: 'center', letterSpacing: '1px' }}>
        {data.lot_number || '—'}
      </div>

      <div style={{
        position: 'absolute', bottom: '4px', right: '6px',
        fontSize: '7px', color: '#aaa',
      }}>
        이지원 MES
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
export function GodexLabelPrinter({ labelData, printerName: initialPrinter, copies: initialCopies = 1, onClose }: GodexLabelPrinterProps) {
  const { connected, error, printers, connect, disconnect, print } = useQzTray();
  const [selectedPrinter, setSelectedPrinter] = useState(initialPrinter || '');
  const [copies, setCopies] = useState(initialCopies);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<'success' | 'error' | null>(null);
  const [qzLoaded, setQzLoaded] = useState(false);

  // QZ Tray JS 스크립트 동적 로드
  useEffect(() => {
    if (window.qz) { setQzLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.onload = () => setQzLoaded(true);
    script.onerror = () => setQzLoaded(false);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleConnect = async () => {
    await connect();
  };

  const handlePrint = async () => {
    if (!selectedPrinter) { alert('프린터를 선택해주세요.'); return; }
    setPrinting(true);
    setPrintResult(null);
    try {
      const zpl = buildZpl(labelData, copies);
      await print(selectedPrinter, zpl);
      setPrintResult('success');
    } catch (e: any) {
      setPrintResult('error');
      alert('인쇄 실패: ' + (e.message || e));
    }
  };
  const handleBrowserPrint = async () => {
    const win = window.open('', '_blank', 'width=450,height=380');
    if (!win) return;
    const spec = [
      labelData.density ? `${labelData.density}K` : '',
      labelData.thickness ? `${labelData.thickness}T` : '',
      labelData.width_mm ? `${labelData.width_mm}W` : '',
      labelData.length_mm ? `${labelData.length_mm}L` : '',
    ].filter(Boolean).join(' ');

    const count = copies > 0 ? copies : Math.max(1, Number(labelData.qty_current || 1));
    const labelHtml = await generateSerializedLotLabelBatchHtml(
      labelData.lot_number,
      labelData.item_name || '품목명 미지정',
      spec,
      labelData.location_name || labelData.location || '-',
      Number(labelData.qty_current || 1),
      labelData.unit || 'EA',
      labelData.received_date,
      count
    );

    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>LOT 라벨</title>
      <style>
        @page { size: 80mm 60mm; margin: 0; }
        html, body { width: 80mm; height: 60mm; margin: 0; padding: 0; background: #fff; font-family: 'Malgun Gothic', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden; }
        .label-card { width: 72mm; height: 52mm; margin: 4mm auto; padding: 1.5mm 2mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 0.4mm solid #334155; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
        .label-card:not(:last-child) { page-break-after: always; break-after: always; }
        .label-card:last-child { page-break-after: avoid; break-after: avoid; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.3mm solid #1a237e; padding-bottom: 0.3mm; font-size: 7pt; font-weight: bold; }
        .company { color: #c00; } .title { color: #1a237e; } .date { color: #666; font-size: 6pt; }
        .body-row { display: flex; gap: 2mm; align-items: center; flex: 1; margin-top: 0.5mm; margin-bottom: 0.5mm; overflow: hidden; }
        .qr-box .qr-img { width: 15mm; height: 15mm; border: 0.2mm solid #cbd5e1; flex-shrink: 0; }
        .info-box { flex: 1; overflow: hidden; }
        .lot-number { font-size: 8.5pt; font-weight: 900; font-family: monospace; color: #1d4ed8; letter-spacing: -0.2px; white-space: nowrap; }
        .field { font-size: 6pt; margin-top: 0.2mm; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .field .lbl { color: #64748b; }
        .field .val { font-weight: bold; color: #0f172a; }
        .item-val { color: #0f172a; }
        .loc-val { color: #065f46; }
        .qty-bar { background: #f8fafc; border: 0.2mm solid #cbd5e1; padding: 0.4mm 1mm; font-size: 6.8pt; margin-top: 0.3mm; display: flex; justify-content: space-between; align-items: center; }
        .barcode-box { text-align: center; border-top: 0.2mm dashed #cbd5e1; padding-top: 0.4mm; margin-top: 0.3mm; }
        .barcode-box svg { width: 45mm; height: 7mm; margin: 0 auto; display: block; }
        .barcode-text { font-size: 5.5pt; font-family: monospace; color: #475569; letter-spacing: 0.5px; margin-top: 0.1mm; }
      </style></head><body>${labelHtml}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-lg text-gray-800">고덱스 라벨 출력</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        )}
      </div>

      {/* 라벨 미리보기 */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2 text-center">📋 라벨 미리보기 (60mm × 40mm)</p>
        <LabelPreview data={labelData} />
      </div>

      {/* QZ Tray 방식 */}
      <div className="border rounded-xl p-4 mb-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-3">
          {connected
            ? <Wifi className="w-4 h-4 text-green-500" />
            : <WifiOff className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold">QZ Tray 직접 인쇄 (권장)</span>
          {connected && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">연결됨</span>}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>{error}</p>
              <a href="https://qz.io/download" target="_blank" rel="noreferrer"
                className="underline text-blue-600">QZ Tray 다운로드 →</a>
            </div>
          </div>
        )}

        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={!qzLoaded}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-40"
          >
            {qzLoaded ? 'QZ Tray 연결' : 'QZ Tray 로딩 중...'}
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">프린터 선택</label>
              <select
                value={selectedPrinter}
                onChange={e => setSelectedPrinter(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— 프린터 선택 —</option>
                {printers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-600">출력 매수</label>
              <input
                type="number" min={1} max={99} value={copies}
                onChange={e => setCopies(Number(e.target.value))}
                className="w-16 border rounded-lg px-2 py-1 text-sm text-center"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                disabled={printing || !selectedPrinter}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                {printing ? '출력 중...' : `라벨 출력 (${copies}매)`}
              </button>
              <button
                onClick={disconnect}
                className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                연결 해제
              </button>
            </div>
            {printResult === 'success' && (
              <div className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" /> 출력 완료!
              </div>
            )}
          </div>
        )}
      </div>

      {/* 브라우저 인쇄 방식 (대안) */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <p className="text-xs text-gray-600 font-semibold mb-2">🖨️ 브라우저 인쇄 (대안)</p>
        <p className="text-xs text-gray-500 mb-3">
          프린터 드라이버로 인쇄. 고덱스를 기본 프린터로 설정 후 사용하세요.
        </p>
        <button
          onClick={handleBrowserPrint}
          className="w-full border-2 border-gray-300 hover:border-blue-400 text-gray-700 text-sm font-semibold py-2 rounded-lg"
        >
          브라우저로 인쇄
        </button>
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
