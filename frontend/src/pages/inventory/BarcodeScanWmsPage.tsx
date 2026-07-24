import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Camera, Keyboard, X, RefreshCw, Scan, CheckCircle2, Zap } from 'lucide-react';
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

type TxnMode = 'OUT' | 'IN' | 'MOVE';

const MODE_CFG: Record<TxnMode, { label: string; emoji: string; active: string; light: string; text: string }> = {
  OUT:  { label:'출고',     emoji:'📤', active:'bg-red-600 text-white',     light:'bg-red-50 border-red-300',     text:'text-red-700' },
  IN:   { label:'입고',     emoji:'📥', active:'bg-emerald-600 text-white', light:'bg-emerald-50 border-emerald-300', text:'text-emerald-700' },
  MOVE: { label:'위치이동', emoji:'🚚', active:'bg-amber-500 text-white',   light:'bg-amber-50 border-amber-300',  text:'text-amber-700' },
};

interface RecentTxn {
  lot_number: string; item_name: string; mode: TxnMode; qty: number; time: string;
}

function fmtSpec(l: ScannedLot) {
  return [l.density&&`${l.density}K`, l.thickness&&`${l.thickness}T`, l.width_mm&&`${l.width_mm}W`, l.length_mm&&`${l.length_mm}L`]
    .filter(Boolean).join(' ') || '-';
}

export default function BarcodeScanWmsPage() {
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<TxnMode>('OUT');
  const [qty, setQty] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<RecentTxn[]>([]);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraErr, setCameraErr] = useState('');
  const [streamActive, setStreamActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!cameraMode) setTimeout(() => inputRef.current?.focus(), 100);
  }, [cameraMode, scannedLot]);

  // LOT 조회
  const handleScan = useCallback(async (lotNo: string) => {
    const code = lotNo.trim();
    if (!code) return;
    setSearching(true);
    setScannedLot(null);
    try {
      const res = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(code)}`);
      const list = res.data || [];
      const matched = list.find(l => l.lot_number === code || l.lot_number.toLowerCase() === code.toLowerCase()) || list[0];
      if (matched) {
        setScannedLot(matched);
        setQty(''); setLocationTo(''); setProjectName('');
        toast.success(`✅ ${matched.lot_number} — ${matched.item_name}`);
        setTimeout(() => document.getElementById('wms-qty')?.focus(), 150);
      } else {
        toast.error(`LOT [${code}] 를 찾을 수 없습니다.`);
        setScanInput('');
      }
    } catch (e) {
      console.error(e);
      toast.error('LOT 조회 실패');
    } finally { setSearching(false); }
  }, []);

  // 수불 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedLot) return;
    if (!qty || Number(qty) <= 0) { toast.error('수량을 입력하세요.'); return; }
    if (mode === 'MOVE' && !locationTo) { toast.error('이동 위치를 입력하세요.'); return; }
    setSubmitting(true);
    try {
      await api.post('/material-transactions', {
        lot_id: scannedLot.lot_id,
        txn_type: mode,
        qty: Number(qty),
        location_to: locationTo || undefined,
        project_name: projectName || undefined,
        source_type: 'BARCODE_SCAN',
        notes: `바코드 스캔 ${MODE_CFG[mode].label}`,
      });
      setRecent(prev => [{
        lot_number: scannedLot.lot_number, item_name: scannedLot.item_name,
        mode, qty: Number(qty), time: new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
      }, ...prev.slice(0,9)]);
      // 로컬 재고 반영
      setScannedLot(prev => prev ? {...prev,
        qty_current: prev.qty_current + (mode==='IN'?Number(qty):mode==='OUT'?-Number(qty):0),
        location: mode==='MOVE' ? locationTo : prev.location
      } : null);
      toast.success(`${MODE_CFG[mode].emoji} ${MODE_CFG[mode].label} 완료! ${scannedLot.lot_number} × ${qty}${scannedLot.unit}`);
      setQty(''); setLocationTo(''); setProjectName('');
      // 다음 스캔 준비
      setTimeout(() => { setScannedLot(null); setScanInput(''); if (!cameraMode) inputRef.current?.focus(); }, 1800);
    } catch (e: any) {
      toast.error(e?.body?.message || '등록 실패');
    } finally { setSubmitting(false); }
  };

  // 카메라 시작
  const startCamera = async () => {
    setCameraErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStreamActive(true);
      if ('BarcodeDetector' in window) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['code_128','code_39','qr_code','ean_13','data_matrix'] });
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !detectorRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes.length > 0) {
              const code = codes[0].rawValue;
              stopCamera(); setCameraMode(false);
              setScanInput(code); handleScan(code);
            }
          } catch { /* ignore */ }
        }, 200);
      } else {
        setCameraErr('Chrome 88+ 에서 자동 바코드 인식이 지원됩니다. 아래 입력창에 직접 입력하거나 LOT를 카메라 앞에 보여주세요.');
      }
    } catch (e: any) {
      setCameraErr(`카메라 접근 실패: ${e.message}`); setCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null; setStreamActive(false);
  };

  useEffect(() => {
    if (cameraMode) startCamera(); else stopCamera();
    return stopCamera;
  }, [cameraMode]);

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen max-w-2xl mx-auto">
      <PageHeader title="📱 바코드 스캔 WMS" description="LOT 라벨 스캔 → 즉시 입고/출고/위치이동"/>

      {/* 스캔 영역 */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {cameraMode && (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted/>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-28 relative">
                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg','top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg','bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg'].map((cls,i) => (
                  <div key={i} className={`absolute w-6 h-6 border-emerald-400 ${cls}`}/>
                ))}
                {streamActive && <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 animate-bounce opacity-80"/>}
              </div>
            </div>
            <button onClick={()=>setCameraMode(false)} className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full"><X className="h-4 w-4"/></button>
            {cameraErr && <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-xs p-2 text-center">{cameraErr}</div>}
          </div>
        )}
        <div className="p-4 space-y-3">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {searching ? <RefreshCw className="h-5 w-5 text-blue-500 animate-spin"/> : <Scan className="h-5 w-5 text-slate-400"/>}
            </div>
            <input ref={inputRef} value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && scanInput.trim()) { e.preventDefault(); handleScan(scanInput); } }}
              placeholder="바코드 스캔 또는 LOT번호 입력 후 Enter ↵"
              className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-300 rounded-xl text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoComplete="off" autoFocus/>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setCameraMode(!cameraMode)}
              className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-colors',
                cameraMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50')}>
              <Camera className="h-4 w-4"/> {cameraMode ? '📸 카메라 스캔 중...' : '카메라로 스캔'}
            </button>
            <button onClick={()=>{ setScanInput(''); setScannedLot(null); setTimeout(()=>inputRef.current?.focus(),50); }}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Keyboard className="h-4 w-4"/> 직접 입력
            </button>
          </div>
        </div>
      </div>

      {/* LOT 인식 후 수불 폼 */}
      {scannedLot ? (
        <div className={cn('rounded-2xl border-2 p-4 space-y-4', MODE_CFG[mode].light)}>
          {/* LOT 정보 */}
          <div className="flex items-start justify-between">
            <div>
              <p className={cn('text-xs font-bold mb-1', MODE_CFG[mode].text)}>✅ LOT 인식됨</p>
              <p className="text-lg font-black font-mono text-slate-900">{scannedLot.lot_number}</p>
              <p className="text-sm text-slate-600">{scannedLot.item_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{fmtSpec(scannedLot)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-bold">현재 재고</p>
              <p className="text-3xl font-black text-slate-900">{Number(scannedLot.qty_current).toLocaleString()}</p>
              <p className="text-sm text-slate-500">{scannedLot.unit}</p>
              {scannedLot.location && (
                <span className="text-xs font-mono bg-white/80 px-2 py-0.5 rounded mt-1 inline-block text-slate-600">{scannedLot.location}</span>
              )}
            </div>
          </div>

          {/* 거래유형 선택 */}
          <div className="grid grid-cols-3 gap-2">
            {(['OUT','IN','MOVE'] as TxnMode[]).map(m => (
              <button key={m} type="button" onClick={()=>setMode(m)}
                className={cn('py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 border-2 transition-all',
                  mode===m ? `${MODE_CFG[m].active} border-transparent shadow-lg scale-105` : 'bg-white border-slate-200 text-slate-600')}>
                <span className="text-xl">{MODE_CFG[m].emoji}</span><span>{MODE_CFG[m].label}</span>
              </button>
            ))}
          </div>

          {/* 수불 폼 */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">수량 ({scannedLot.unit}) *</label>
              <input id="wms-qty" type="number" min="0.001" step="any" value={qty} onChange={e=>setQty(e.target.value)}
                placeholder={`${MODE_CFG[mode].label}할 수량`} required
                className={cn('w-full border-2 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none transition-all',
                  mode==='OUT'?'border-red-300 focus:border-red-500 text-red-700':mode==='IN'?'border-emerald-300 focus:border-emerald-500 text-emerald-700':'border-amber-300 focus:border-amber-500 text-amber-700')}/>
              {qty && Number(qty)>0 && (
                <p className={cn('text-center text-sm font-bold mt-1', mode==='IN'?'text-emerald-600':mode==='OUT'?'text-red-600':'text-amber-600')}>
                  처리 후 잔고: {(scannedLot.qty_current+(mode==='IN'?Number(qty):mode==='OUT'?-Number(qty):0)).toLocaleString()} {scannedLot.unit}
                </p>
              )}
            </div>
            {(mode==='MOVE'||mode==='IN') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{mode==='MOVE'?'이동 후 위치 *':'적재 위치'}</label>
                <input value={locationTo} onChange={e=>setLocationTo(e.target.value)} placeholder="A1-P1, H3-P2" required={mode==='MOVE'}
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-blue-500"/>
              </div>
            )}
            {mode==='OUT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">출하처/현장명</label>
                <input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="판교현장, 부산현장 등"
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"/>
              </div>
            )}
            <button type="submit" disabled={submitting}
              className={cn('w-full py-4 rounded-2xl text-white text-base font-black flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-60',
                mode==='OUT'?'bg-red-600 hover:bg-red-700':mode==='IN'?'bg-emerald-600 hover:bg-emerald-700':'bg-amber-500 hover:bg-amber-600')}>
              <Zap className="h-5 w-5"/>
              {submitting ? '처리 중...' : `${MODE_CFG[mode].emoji} ${MODE_CFG[mode].label} 등록`}
            </button>
          </form>
          <button onClick={()=>{ setScannedLot(null); setScanInput(''); setTimeout(()=>inputRef.current?.focus(),50); }}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 text-center">✕ 취소하고 다시 스캔</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Scan className="h-8 w-8 text-slate-400"/>
          </div>
          <p className="font-bold text-slate-600">LOT 라벨을 스캔하거나</p>
          <p className="text-sm text-slate-400">입력창에 LOT번호 입력 후 Enter</p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(['OUT','IN','MOVE'] as TxnMode[]).map(m => (
              <div key={m} className={cn('p-3 rounded-xl border text-center', MODE_CFG[m].light)}>
                <p className="text-2xl mb-1">{MODE_CFG[m].emoji}</p>
                <p className={cn('text-xs font-bold', MODE_CFG[m].text)}>{MODE_CFG[m].label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 세션 처리 내역 */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500"/>
            <span className="text-xs font-bold text-slate-600">이번 세션 처리 내역 ({recent.length}건)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.map((r,i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-lg">{MODE_CFG[r.mode].emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-700 truncate">{r.lot_number}</p>
                  <p className="text-[11px] text-slate-400 truncate">{r.item_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-black', MODE_CFG[r.mode].text)}>
                    {r.mode==='OUT'?'-':'+'}{r.qty.toLocaleString()}
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
