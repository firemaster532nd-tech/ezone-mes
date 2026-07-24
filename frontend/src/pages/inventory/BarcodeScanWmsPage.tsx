import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Camera, Keyboard, ArrowDownCircle, ArrowUpCircle, MoveRight,
  CheckCircle2, AlertCircle, X, RefreshCw, Scan, Package, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ScannedLot {
  lot_id: number;
  lot_number: string;
  item_name: string;
  category: string;
  qty_current: number;
  unit: string;
  location?: string;
  density?: number;
  thickness?: number;
  width_mm?: number;
  length_mm?: number;
}

type TxnMode = 'IN' | 'OUT' | 'MOVE';

const MODE_CONFIG = {
  IN:   { label: '입고',     emoji: '📥', color: 'bg-emerald-600', hover: 'hover:bg-emerald-700', border: 'border-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  OUT:  { label: '출고',     emoji: '📤', color: 'bg-red-600',     hover: 'hover:bg-red-700',     border: 'border-red-500',     light: 'bg-red-50',     text: 'text-red-700'     },
  MOVE: { label: '위치이동', emoji: '🚚', color: 'bg-amber-500',   hover: 'hover:bg-amber-600',   border: 'border-amber-400',   light: 'bg-amber-50',   text: 'text-amber-700'   },
};

// ─── 최근 거래 기록 ───────────────────────────────────────────────────────────
interface RecentTxn {
  lot_number: string;
  item_name: string;
  mode: TxnMode;
  qty: number;
  location?: string;
  time: string;
}

export default function BarcodeScanWmsPage() {
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<TxnMode>('OUT');
  const [qty, setQty] = useState<number | ''>('');
  const [locationTo, setLocationTo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentTxns, setRecentTxns] = useState<RecentTxn[]>([]);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [streamActive, setStreamActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 포커스 유지
  useEffect(() => {
    if (!cameraMode) inputRef.current?.focus();
  }, [cameraMode, scannedLot]);

  // 키보드 웨지 스캐너 감지 (빠른 연속 입력)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (cameraMode || e.target !== inputRef.current) return;
    // 스캐너는 Enter로 종료
    if (e.key === 'Enter' && scanInput.trim()) {
      handleScan(scanInput.trim());
    }
  }, [cameraMode, scanInput]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // LOT 번호로 서버 조회
  const handleScan = async (lotNo: string) => {
    if (!lotNo.trim()) return;
    setSearching(true);
    setScannedLot(null);
    try {
      const res = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(lotNo.trim())}&active=1`);
      const matched = (res.data || []).find(l =>
        l.lot_number === lotNo.trim() ||
        l.lot_number.toLowerCase() === lotNo.trim().toLowerCase()
      ) || res.data?.[0];

      if (matched) {
        setScannedLot(matched);
        setQty('');
        setLocationTo('');
        setProjectName('');
        toast.success(`LOT 확인: ${matched.lot_number} (${matched.item_name})`);
        setTimeout(() => document.getElementById('qty-input')?.focus(), 100);
      } else {
        toast.error(`LOT [${lotNo}] 를 찾을 수 없습니다.`);
      }
    } catch { toast.error('LOT 조회 실패'); }
    finally { setSearching(false); }
  };

  // 수불 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedLot) { toast.error('먼저 LOT를 스캔하세요.'); return; }
    if (!qty || Number(qty) <= 0) { toast.error('수량을 입력하세요.'); return; }
    if (mode === 'MOVE' && !locationTo) { toast.error('이동 후 위치를 입력하세요.'); return; }

    setSubmitting(true);
    try {
      const qtyVal = mode === 'OUT' ? -Math.abs(Number(qty)) : Number(qty);
      await api.post('/material-transactions', {
        lot_id: scannedLot.lot_id,
        txn_type: mode,
        qty: Math.abs(Number(qty)),
        location_to: locationTo || undefined,
        project_name: projectName || undefined,
        source_type: 'BARCODE_SCAN',
        notes: `바코드 스캔 ${MODE_CONFIG[mode].label}`,
      });

      // 최근 거래 추가
      const newTxn: RecentTxn = {
        lot_number: scannedLot.lot_number,
        item_name: scannedLot.item_name,
        mode,
        qty: Number(qty),
        location: mode === 'MOVE' ? locationTo : scannedLot.location,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setRecentTxns(prev => [newTxn, ...prev.slice(0, 9)]);

      // 로컬 재고 반영
      setScannedLot(prev => prev ? {
        ...prev,
        qty_current: prev.qty_current + qtyVal,
        location: mode === 'MOVE' ? locationTo : prev.location,
      } : null);

      toast.success(`✅ ${MODE_CONFIG[mode].label} 완료! ${scannedLot.lot_number} ${Number(qty)} ${scannedLot.unit}`);
      setQty('');
      setLocationTo('');
      setProjectName('');

      // 다음 스캔 준비
      setTimeout(() => {
        setScanInput('');
        setScannedLot(null);
        if (!cameraMode) inputRef.current?.focus();
      }, 1500);

    } catch (e: any) {
      toast.error(e?.response?.data?.message || '등록 실패');
    } finally { setSubmitting(false); }
  };

  // 카메라 시작
  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);

      // BarcodeDetector API 사용
      if ('BarcodeDetector' in window) {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'data_matrix']
        });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || !barcodeDetectorRef.current) return;
          try {
            const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              stopCamera();
              setCameraMode(false);
              setScanInput(code);
              handleScan(code);
            }
          } catch { /* 무시 */ }
        }, 200);
      } else {
        setCameraError('이 브라우저는 자동 바코드 인식을 지원하지 않습니다. Chrome 88+ 을 사용해주세요. 카메라에서 QR을 보여주거나, 아래 입력창에 직접 입력하세요.');
      }
    } catch (e: any) {
      setCameraError(`카메라 접근 실패: ${e.message || '권한 거부'}`);
      setCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreamActive(false);
  };

  useEffect(() => {
    if (cameraMode) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraMode]);

  const fmtSpec = (l: ScannedLot) => {
    const p: string[] = [];
    if (l.density)    p.push(`${l.density}K`);
    if (l.thickness)  p.push(`${l.thickness}T`);
    if (l.width_mm)   p.push(`${l.width_mm}W`);
    if (l.length_mm)  p.push(`${l.length_mm}L`);
    return p.join(' ') || '-';
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen max-w-2xl mx-auto">
      <PageHeader
        title="📱 바코드 스캔 입출고 WMS"
        description="LOT 라벨 바코드 스캔 → 즉시 입고/출고/위치이동 처리"
      />

      {/* 스캔 입력 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 카메라 뷰 */}
        {cameraMode && (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
            {/* 스캔 가이드선 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-32 border-4 border-emerald-400 rounded-xl opacity-80">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>
            {/* 스캔 애니메이션 */}
            {streamActive && (
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-64 pointer-events-none">
                <div className="h-0.5 bg-red-500 animate-bounce opacity-80" />
              </div>
            )}
            <button onClick={() => setCameraMode(false)}
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full">
              <X className="h-4 w-4" />
            </button>
            {cameraError && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 text-center">{cameraError}</div>
            )}
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* 스캔 입력창 */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {searching ? <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" /> : <Scan className="h-5 w-5 text-slate-400" />}
            </div>
            <input
              ref={inputRef}
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { handleScan(scanInput); } }}
              placeholder="바코드 스캔 또는 LOT번호 직접 입력 후 Enter"
              className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-300 rounded-xl text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* 카메라 / 키보드 전환 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setCameraMode(!cameraMode)}
              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border-2',
                cameraMode
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50')}>
              <Camera className="h-4 w-4" />
              {cameraMode ? '📸 카메라 스캔 중...' : '카메라 스캔'}
            </button>
            <button
              onClick={() => { setScanInput(''); inputRef.current?.focus(); }}
              className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-slate-300 text-slate-600 hover:bg-slate-50">
              <Keyboard className="h-4 w-4" /> 직접 입력
            </button>
          </div>
        </div>
      </div>

      {/* LOT 정보 & 수불 폼 */}
      {scannedLot ? (
        <div className="space-y-4">
          {/* LOT 정보 카드 */}
          <div className={cn('rounded-2xl border-2 p-4', MODE_CONFIG[mode].border, MODE_CONFIG[mode].light)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className={cn('text-xs font-bold mb-1', MODE_CONFIG[mode].text)}>✅ LOT 인식됨</p>
                <p className="text-lg font-black text-slate-900 font-mono">{scannedLot.lot_number}</p>
                <p className="text-sm text-slate-600 font-medium">{scannedLot.item_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fmtSpec(scannedLot)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold">현재 재고</p>
                <p className="text-2xl font-black text-slate-900">{Number(scannedLot.qty_current).toLocaleString()}</p>
                <p className="text-sm text-slate-500">{scannedLot.unit}</p>
                {scannedLot.location && (
                  <p className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded mt-1 text-slate-600">{scannedLot.location}</p>
                )}
              </div>
            </div>

            {/* 거래 유형 선택 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['OUT', 'IN', 'MOVE'] as TxnMode[]).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={cn('py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 border-2 transition-all',
                    mode === m
                      ? `${MODE_CONFIG[m].color} text-white border-transparent shadow-lg scale-105`
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                  <span className="text-xl">{MODE_CONFIG[m].emoji}</span>
                  <span>{MODE_CONFIG[m].label}</span>
                </button>
              ))}
            </div>

            {/* 수불 폼 */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  수량 ({scannedLot.unit}) *
                </label>
                <input
                  id="qty-input"
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={`${MODE_CONFIG[mode].label}할 수량`}
                  className={cn('w-full border-2 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none transition-all',
                    mode === 'OUT' ? 'border-red-300 focus:border-red-500 text-red-700' :
                    mode === 'IN' ? 'border-emerald-300 focus:border-emerald-500 text-emerald-700' :
                    'border-amber-300 focus:border-amber-500 text-amber-700')}
                  required
                  autoFocus
                />
                {/* 재고 예측 */}
                {qty !== '' && (
                  <p className={cn('text-center text-sm font-bold mt-1',
                    mode === 'IN' ? 'text-emerald-600' : mode === 'OUT' ? 'text-red-600' : 'text-amber-600')}>
                    처리 후 잔고: {(scannedLot.qty_current + (mode === 'OUT' ? -Number(qty) : mode === 'IN' ? Number(qty) : 0)).toLocaleString()} {scannedLot.unit}
                  </p>
                )}
              </div>

              {(mode === 'MOVE' || mode === 'IN') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {mode === 'MOVE' ? '이동 후 위치 *' : '적재 위치'}
                  </label>
                  <input
                    type="text"
                    value={locationTo}
                    onChange={e => setLocationTo(e.target.value)}
                    placeholder="예: A1-P1, H3-P2 (바코드 스캔 가능)"
                    className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-blue-500"
                    required={mode === 'MOVE'}
                  />
                </div>
              )}

              {mode === 'OUT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">출하처 / 현장명</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="판교현장, 부산현장 등"
                    className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'w-full py-4 rounded-2xl text-white text-base font-black flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95',
                  MODE_CONFIG[mode].color, MODE_CONFIG[mode].hover,
                  submitting && 'opacity-70'
                )}>
                <Zap className="h-5 w-5" />
                {submitting ? '처리 중...' : `${MODE_CONFIG[mode].emoji} ${MODE_CONFIG[mode].label} 등록`}
              </button>
            </form>

            <button onClick={() => { setScannedLot(null); setScanInput(''); setTimeout(() => inputRef.current?.focus(), 100); }}
              className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700 text-center">
              ✕ 취소하고 다시 스캔
            </button>
          </div>
        </div>
      ) : (
        /* 안내 화면 */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Scan className="h-8 w-8 text-slate-400" />
          </div>
          <p className="font-bold text-slate-600">LOT 라벨을 스캔하거나</p>
          <p className="text-sm text-slate-400">위 입력창에 LOT 번호를 입력 후 Enter 하세요</p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(['OUT', 'IN', 'MOVE'] as TxnMode[]).map(m => (
              <div key={m} className={cn('p-3 rounded-xl border text-center', MODE_CONFIG[m].light, `border-${m === 'IN' ? 'emerald' : m === 'OUT' ? 'red' : 'amber'}-200`)}>
                <p className="text-2xl mb-1">{MODE_CONFIG[m].emoji}</p>
                <p className={cn('text-xs font-bold', MODE_CONFIG[m].text)}>{MODE_CONFIG[m].label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 거래 내역 */}
      {recentTxns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-600">이번 세션 처리 내역 ({recentTxns.length}건)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentTxns.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-lg">{MODE_CONFIG[r.mode].emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-700 truncate">{r.lot_number}</p>
                  <p className="text-[11px] text-slate-400 truncate">{r.item_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-black',
                    r.mode === 'OUT' ? 'text-red-600' : r.mode === 'IN' ? 'text-emerald-600' : 'text-amber-600')}>
                    {r.mode === 'OUT' ? '-' : '+'}{r.qty.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400">{r.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
