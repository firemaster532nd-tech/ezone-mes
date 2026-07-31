import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Camera, Keyboard, RefreshCw, Scan, CheckCircle2, Zap, ArrowRightLeft, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

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

const MODE_CFG: Record<TxnMode, { label: string; emoji: string; active: string; light: string; border: string; text: string }> = {
  OUT:  { label: '출고',     emoji: '📤', active: 'bg-red-600 text-white border-red-600 shadow-md',     light: 'bg-red-50 border-red-200', border: 'border-red-500', text: 'text-red-700' },
  IN:   { label: '입고',     emoji: '📥', active: 'bg-emerald-600 text-white border-emerald-600 shadow-md', light: 'bg-emerald-50 border-emerald-200', border: 'border-emerald-500', text: 'text-emerald-700' },
  MOVE: { label: '위치이동', emoji: '🚚', active: 'bg-amber-500 text-white border-amber-500 shadow-md',   light: 'bg-amber-50 border-amber-200', border: 'border-amber-500', text: 'text-amber-700' },
};

interface RecentTxn {
  lot_number: string;
  item_name: string;
  mode: TxnMode;
  qty: number;
  time: string;
}

function fmtSpec(l: ScannedLot) {
  return [l.density && `${l.density}K`, l.thickness && `${l.thickness}T`, l.width_mm && `${l.width_mm}W`, l.length_mm && `${l.length_mm}L`]
    .filter(Boolean).join(' ') || '-';
}

export default function BarcodeScanWmsPage() {
  const [mode, setMode] = useState<TxnMode>('OUT');
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [searching, setSearching] = useState(false);
  const [qty, setQty] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<RecentTxn[]>([]);
  
  // 동시에 가동되는 스캔 모드 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  // 1. 모바일 기기 자동 감지
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileDevice = mobileRegex.test(userAgent) || window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      if (isMobileDevice) {
        setCameraActive(true); // 모바일은 카메라 스캐너 자동 활성화
      }
    };
    checkMobile();
  }, []);

  // 2. 바코드 스캐너 키보드 포커스 유지 (카메라와 동시 가동)
  const focusScannerInput = useCallback(() => {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(focusScannerInput, 1000);
    return () => clearInterval(interval);
  }, [focusScannerInput]);

  // 3. LOT 바코드 인식 처리
  const handleScan = useCallback(async (lotNo: string) => {
    const code = lotNo.trim();
    if (!code || code === lastScannedCodeRef.current) return;
    
    lastScannedCodeRef.current = code;
    setTimeout(() => { lastScannedCodeRef.current = ''; }, 3000); // 3초 중복 스캔 방지

    setSearching(true);
    try {
      const res = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(code)}`);
      const list = res.data || [];
      const matched = list.find(l => l.lot_number === code || l.lot_number.toLowerCase() === code.toLowerCase()) || list[0];
      
      if (matched) {
        setScannedLot(matched);
        setQty(''); 
        setLocationTo(''); 
        setProjectName('');
        toast.success(`✅ [인식완료] ${matched.lot_number} (${matched.item_name})`);
        setTimeout(() => document.getElementById('wms-qty')?.focus(), 200);
      } else {
        toast.error(`❌ 바코드 [${code}] 에 해당하는 재고/LOT를 찾을 수 없습니다.`);
        setScanInput('');
      }
    } catch (e) {
      console.error(e);
      toast.error('LOT 바코드 조회 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }, []);

  // 4. 모바일/웹캠 카메라 스캐너 동시 가동 (Html5Qrcode)
  useEffect(() => {
    if (!cameraActive) {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().then(() => {
          html5QrcodeRef.current?.clear();
          html5QrcodeRef.current = null;
        }).catch(() => {});
      }
      return;
    }

    setCameraError('');
    const qrRegionId = 'reader-container';

    const startHtml5Qrcode = async () => {
      try {
        if (!html5QrcodeRef.current) {
          html5QrcodeRef.current = new Html5Qrcode(qrRegionId);
        }

        await html5QrcodeRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            setScanInput(decodedText);
            handleScan(decodedText);
          },
          () => {} // silent error ignore
        );
      } catch (err: any) {
        console.error('Camera start error:', err);
        setCameraError(`카메라 시작 오류: ${err?.message || '카메라 권한을 확인해주세요.'}`);
      }
    };

    setTimeout(startHtml5Qrcode, 200);

    return () => {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().then(() => {
          html5QrcodeRef.current?.clear();
          html5QrcodeRef.current = null;
        }).catch(() => {});
      }
    };
  }, [cameraActive, handleScan]);

  // 5. 입고/출고/위치이동 수불 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedLot) return;
    if (!qty || Number(qty) <= 0) {
      toast.error('처리할 수량을 입력하세요.');
      return;
    }
    if (mode === 'MOVE' && !locationTo) {
      toast.error('이동할 렉/위치 코드를 입력하세요.');
      return;
    }

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

      const processedQty = Number(qty);
      setRecent((prev) => [{
        lot_number: scannedLot.lot_number,
        item_name: scannedLot.item_name,
        mode,
        qty: processedQty,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }, ...prev.slice(0, 9)]);

      // 로컬 재고 수량 즉시 변경 반영
      setScannedLot((prev) => prev ? {
        ...prev,
        qty_current: prev.qty_current + (mode === 'IN' ? processedQty : mode === 'OUT' ? -processedQty : 0),
        location: mode === 'MOVE' ? locationTo : prev.location,
      } : null);

      toast.success(`${MODE_CFG[mode].emoji} ${MODE_CFG[mode].label} 정상 완료! [${scannedLot.lot_number}] ${processedQty}${scannedLot.unit}`);
      
      setQty('');
      setLocationTo('');
      setProjectName('');

      // 다음 스캔을 위한 초기화
      setTimeout(() => {
        setScannedLot(null);
        setScanInput('');
        inputRef.current?.focus();
      }, 1500);
    } catch (err: any) {
      toast.error(err?.body?.message || '수불 처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen max-w-2xl mx-auto">
      <PageHeader 
        title="📱 바코드 스캔 WMS (입고 · 출고 · 위치이동)" 
        description="실시간 하드웨어 바코드 스캐너 & 카메라 스캐너 동시 가동 시스템"
      />

      {/* 🔘 1. 상단 필수 기능 선택 버튼 (출고 / 입고 / 위치이동) - 언제나 클릭 가능 */}
      <div className="bg-white rounded-2xl p-2.5 border shadow-sm space-y-1.5">
        <p className="text-[11px] font-bold text-slate-500 px-1">▼ 실행할 작업 선택 (버튼 클릭 후 스캔)</p>
        <div className="grid grid-cols-3 gap-2">
          {(['OUT', 'IN', 'MOVE'] as TxnMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                toast.info(`${MODE_CFG[m].emoji} [${MODE_CFG[m].label}] 모드로 전환되었습니다.`);
              }}
              className={cn(
                'py-3.5 px-2 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-1 border-2 transition-all cursor-pointer',
                mode === m ? MODE_CFG[m].active : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="text-xl">{MODE_CFG[m].emoji}</span>
              <span>{MODE_CFG[m].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 📷 2. 동시 가동되는 스캔 시스템 (카메라 + 물리 바코드 스캐너 포커스) */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden space-y-3 p-4">
        {/* 스캐너 포커스 안내 및 토글 바 */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>스캐너 동시 준비 완료</span>
            {isMobile && <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">📱 모바일</span>}
          </div>
          <button
            type="button"
            onClick={() => setCameraActive(!cameraActive)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors',
              cameraActive ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-600'
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            {cameraActive ? '카메라 스캔 켜짐' : '카메라 스캔 켜기'}
          </button>
        </div>

        {/* 카메라 비디오 바코드 라이브 뷰어 */}
        {cameraActive && (
          <div className="relative bg-slate-900 rounded-xl overflow-hidden min-h-[200px]">
            <div id="reader-container" className="w-full max-h-64 object-cover" />
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 text-white text-xs p-4 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-amber-400 font-bold">⚠️ {cameraError}</p>
                <p className="text-slate-400 text-[11px]">스마트폰 브라우저 카메라 허용 권한을 확인해주세요.</p>
              </div>
            )}
          </div>
        )}

        {/* 하드웨어 바코드 스캐너 자동 포커스 입력창 */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {searching ? <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" /> : <Scan className="h-5 w-5 text-slate-400" />}
          </div>
          <input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scanInput.trim()) {
                e.preventDefault();
                handleScan(scanInput);
              }
            }}
            placeholder="바코드 스캐너 스캔 또는 LOT번호 입력 후 Enter ↵"
            className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-300 rounded-xl text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>

      {/* 📦 3. LOT 인식 후 수불 입력 폼 */}
      {scannedLot ? (
        <div className={cn('rounded-2xl border-2 p-5 space-y-4 shadow-sm', MODE_CFG[mode].light, MODE_CFG[mode].border)}>
          <div className="flex items-start justify-between border-b pb-3">
            <div>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded text-white bg-slate-800')}>
                {MODE_CFG[mode].emoji} {MODE_CFG[mode].label} 대상 선택됨
              </span>
              <p className="text-xl font-black font-mono text-slate-900 mt-1">{scannedLot.lot_number}</p>
              <p className="text-sm font-bold text-slate-700">{scannedLot.item_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">규격: {fmtSpec(scannedLot)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-bold">현재 보유 재고</p>
              <p className="text-3xl font-black text-slate-900">{Number(scannedLot.qty_current).toLocaleString()}</p>
              <p className="text-xs font-bold text-slate-500">{scannedLot.unit}</p>
              {scannedLot.location && (
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border mt-1 inline-block text-slate-700 font-bold">
                  📍 {scannedLot.location}
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {MODE_CFG[mode].label} 처리 수량 ({scannedLot.unit}) *
              </label>
              <input
                id="wms-qty"
                type="number"
                min="0.001"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={`${MODE_CFG[mode].label}할 수량 입력`}
                required
                className={cn(
                  'w-full border-2 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none bg-white transition-all',
                  mode === 'OUT' ? 'border-red-300 focus:border-red-600 text-red-700' :
                  mode === 'IN' ? 'border-emerald-300 focus:border-emerald-600 text-emerald-700' :
                  'border-amber-300 focus:border-amber-600 text-amber-700'
                )}
              />
              {qty && Number(qty) > 0 && (
                <p className={cn('text-center text-xs font-bold mt-1.5', MODE_CFG[mode].text)}>
                  예상 잔고: {(scannedLot.qty_current + (mode === 'IN' ? Number(qty) : mode === 'OUT' ? -Number(qty) : 0)).toLocaleString()} {scannedLot.unit}
                </p>
              )}
            </div>

            {(mode === 'MOVE' || mode === 'IN') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {mode === 'MOVE' ? '이동 후 렉/위치 코드 (예: A1-P1) *' : '적재 렉/위치 코드 (선택)'}
                </label>
                <input
                  value={locationTo}
                  onChange={(e) => setLocationTo(e.target.value)}
                  placeholder="예: A1-P1, H3-P2"
                  required={mode === 'MOVE'}
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-blue-500 bg-white"
                />
              </div>
            )}

            {mode === 'OUT' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">출하 현장명/고객사 (선택)</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="예: 고양캐피탈랜드데이터센터, 판교현장 등"
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 bg-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'w-full py-4 rounded-xl text-white text-base font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-60 cursor-pointer',
                mode === 'OUT' ? 'bg-red-600 hover:bg-red-700' :
                mode === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' :
                'bg-amber-500 hover:bg-amber-600'
              )}
            >
              <Zap className="h-5 w-5" />
              {submitting ? '처리 중...' : `${MODE_CFG[mode].emoji} ${MODE_CFG[mode].label} 실행 완료`}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setScannedLot(null);
              setScanInput('');
              inputRef.current?.focus();
            }}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-bold text-center border-t pt-2"
          >
            ✕ 취소하고 다른 바코드 스캔하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-6 text-center space-y-2 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
            <Scan className="h-6 w-6" />
          </div>
          <p className="font-bold text-sm text-slate-700">스캐너로 바코드를 찍거나 라벨을 카메라에 보여주세요</p>
          <p className="text-xs text-slate-400">선택된 모드({MODE_CFG[mode].emoji} {MODE_CFG[mode].label})로 즉시 바코드 조회가 실행됩니다.</p>
        </div>
      )}

      {/* 📋 4. 현재 세션 처리 이력 내역 */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-700">이번 세션 수불 처리 내역 ({recent.length}건)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-lg">{MODE_CFG[r.mode].emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-800 truncate">{r.lot_number}</p>
                  <p className="text-[11px] text-slate-500 truncate">{r.item_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-black', MODE_CFG[r.mode].text)}>
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
