import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { 
  Camera, Scan, CheckCircle2, Zap, Building2, Search, ArrowRight, FileText
} from 'lucide-react';
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

interface PendingSiteOrder {
  po_id: number;
  po_number: string;
  customer_name: string;
  project_name: string;
  site_name: string;
  item_name: string;
  spec: string;
  ordered_qty: number;
  unit: string;
}

type TxnMode = 'OUT' | 'STAGING' | 'IN' | 'MOVE';

const MODE_CFG: Record<TxnMode, { label: string; emoji: string; active: string; light: string; border: string; text: string }> = {
  OUT:     { label: '출고확정',    emoji: '📤', active: 'bg-red-600 text-white border-red-600 shadow-md',     light: 'bg-red-50 border-red-200', border: 'border-red-500', text: 'text-red-700' },
  STAGING: { label: '출하대기',    emoji: '📦', active: 'bg-indigo-600 text-white border-indigo-600 shadow-md', light: 'bg-indigo-50 border-indigo-200', border: 'border-indigo-500', text: 'text-indigo-700' },
  IN:      { label: '입고',        emoji: '📥', active: 'bg-emerald-600 text-white border-emerald-600 shadow-md', light: 'bg-emerald-50 border-emerald-200', border: 'border-emerald-500', text: 'text-emerald-700' },
  MOVE:    { label: '위치이동',    emoji: '🚚', active: 'bg-amber-500 text-white border-amber-500 shadow-md',   light: 'bg-amber-50 border-amber-200', border: 'border-amber-500', text: 'text-amber-700' },
};

interface ScanHistoryItem {
  seq: number;
  lot_number: string;
  item_name: string;
  spec: string;
  qty: number;
  unit: string;
  mode: TxnMode;
  location?: string;
  projectName?: string;
  time: string;
}

function fmtSpec(l: Partial<ScannedLot>) {
  const parts = [l.density && `${l.density}K`, l.thickness && `${l.thickness}T`, l.width_mm && `${l.width_mm}W`, l.length_mm && `${l.length_mm}L`].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
}

export default function BarcodeScanWmsPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TxnMode>('OUT');
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [searching, setSearching] = useState(false);
  const [qty, setQty] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. 발주서/현장 목록 및 키워드 검색기
  const [pendingOrders, setPendingOrders] = useState<PendingSiteOrder[]>([]);
  const [selectedSiteKey, setSelectedSiteKey] = useState<string>(''); // project_name
  const [siteSearchTerm, setSiteSearchTerm] = useState<string>(''); // 검색 키워드
  const [targetOrderQty, setTargetOrderQty] = useState<number>(0);

  // 2. 실시간 스캔 카운터 및 세션 이력
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  // 동시에 가동되는 스캔 모드 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  // 등록된 발주서/현장 목록 불러오기 (다중 엔드포인트 세이프 폴백)
  useEffect(() => {
    Promise.all([
      api.get<{ data: PendingSiteOrder[] }>('/shipment-orders/pending').catch(() => null),
      api.get<{ data: any[] }>('/purchase-orders').catch(() => null),
    ]).then(([pendingRes, poRes]) => {
      const pList: PendingSiteOrder[] = pendingRes?.data?.data || [];
      const poList: any[] = poRes?.data?.data || [];

      // Combine both
      const combined: PendingSiteOrder[] = [...pList];
      poList.forEach(po => {
        const site = po.project_name || po.construction_site || po.contractor;
        if (site && !combined.some(c => c.project_name === site || c.site_name === site)) {
          combined.push({
            po_id: po.po_id,
            po_number: `PO-${po.po_id}`,
            customer_name: po.contractor || '고객사',
            project_name: site,
            site_name: site,
            item_name: '내화채움구조 세트',
            spec: '표준 규격',
            ordered_qty: 10,
            unit: 'EA'
          });
        }
      });

      setPendingOrders(combined);
    });
  }, []);

  // 현장 선택 변경 시 목표 수량 계산
  const handleSiteSelect = (siteKey: string) => {
    setSelectedSiteKey(siteKey);
    if (!siteKey) {
      setTargetOrderQty(0);
      return;
    }
    const filtered = pendingOrders.filter(p => (p.project_name || p.site_name || p.customer_name) === siteKey);
    const totalQty = filtered.reduce((sum, p) => sum + (Number(p.ordered_qty) || 0), 0);
    setTargetOrderQty(totalQty || 10);
    toast.info(`📋 [${siteKey}] 현장이 선택되었습니다. 목표 수량: ${totalQty || 10} EA`);
  };

  // 모바일 기기 감지
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      if (isMobileDevice) {
        setCameraActive(true);
      }
    };
    checkMobile();
  }, []);

  // 키보드 바코드 스캐너 포커스 유지 (SELECT 콤보박스 선택 중일 때는 포커스 뺏지 않도록 방지!)
  const focusScannerInput = useCallback(() => {
    const tag = document.activeElement?.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(focusScannerInput, 1000);
    return () => clearInterval(interval);
  }, [focusScannerInput]);

  // 바코드 스캔 수행
  const handleScan = useCallback(async (lotNo: string) => {
    const code = lotNo.trim();
    if (!code || code === lastScannedCodeRef.current) return;
    
    lastScannedCodeRef.current = code;
    setTimeout(() => { lastScannedCodeRef.current = ''; }, 2500);

    setSearching(true);
    try {
      const res = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(code)}`);
      const list = res.data || [];
      const matched = list.find(l => l.lot_number === code || l.lot_number.toLowerCase() === code.toLowerCase()) || list[0];
      
      if (matched) {
        setScannedLot(matched);
        setQty('1');
        toast.success(`✅ [${matched.lot_number}] ${matched.item_name} (${fmtSpec(matched)}) 스캔됨`);
        setTimeout(() => document.getElementById('wms-qty')?.focus(), 150);
      } else {
        toast.error(`❌ LOT [${code}] 에 해당하는 재고를 찾을 수 없습니다.`);
        setScanInput('');
      }
    } catch {
      toast.error('LOT 조회 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }, []);

  // 카메라 스캐너 동시 가동 Engine
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
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            setScanInput(decodedText);
            handleScan(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        setCameraError(`카메라 시작 실패: ${err?.message || '카메라 권한을 확인해 주세요.'}`);
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

  // 수불 처리 및 실시간 카운팅 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedLot) return;
    const processQty = Number(qty) || 1;
    if (processQty <= 0) {
      toast.error('처리 수량을 입력하세요.');
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
        qty: processQty,
        location_to: locationTo || undefined,
        project_name: selectedSiteKey || undefined,
        source_type: 'BARCODE_SCAN',
        notes: `바코드 스캔 ${MODE_CFG[mode].label}`,
      });

      const nextSeq = scanHistory.length + 1;
      const historyItem: ScanHistoryItem = {
        seq: nextSeq,
        lot_number: scannedLot.lot_number,
        item_name: scannedLot.item_name,
        spec: fmtSpec(scannedLot),
        qty: processQty,
        unit: scannedLot.unit,
        mode,
        location: locationTo || scannedLot.location,
        projectName: selectedSiteKey,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      const updatedHistory = [historyItem, ...scanHistory];
      setScanHistory(updatedHistory);

      const currentTotalQty = updatedHistory.reduce((sum, h) => sum + h.qty, 0);

      toast.success(`🎉 [#${nextSeq}번째 ${MODE_CFG[mode].label} 완료] ${scannedLot.lot_number} | ${scannedLot.item_name} (${processQty}${scannedLot.unit})`);

      if (mode === 'OUT' && targetOrderQty > 0 && currentTotalQty >= targetOrderQty) {
        setCompletionModalOpen(true);
      }

      setQty('');
      setLocationTo('');
      setScannedLot(null);
      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      toast.error(err?.body?.message || '수불 처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // unique site keys & filtered sites
  const uniqueSites = Array.from(new Set(pendingOrders.map(p => p.project_name || p.site_name || p.customer_name).filter(Boolean)));
  const filteredSites = uniqueSites.filter(site => 
    !siteSearchTerm.trim() || site.toLowerCase().includes(siteSearchTerm.toLowerCase())
  );

  const totalScannedCount = scanHistory.length;
  const totalScannedQty = scanHistory.reduce((sum, h) => sum + h.qty, 0);
  const progressPercent = targetOrderQty > 0 ? Math.min(100, Math.round((totalScannedQty / targetOrderQty) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen max-w-2xl mx-auto pb-24">
      <PageHeader 
        title="📱 WMS 바코드 스캔 수불 시스템" 
        description="발주서/현장 연동 · 실시간 수량 카운팅 & 달성 알림"
      />

      {/* 🔘 1. 작업 선택 (출고확정 / 출하대기 / 입고 / 위치이동) */}
      <div className="bg-white rounded-2xl p-3 border shadow-sm space-y-2">
        <p className="text-xs font-bold text-slate-600 px-1">▼ 1. 실행할 물류 작업 선택</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(['OUT', 'STAGING', 'IN', 'MOVE'] as TxnMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                toast.info(`${MODE_CFG[m].emoji} [${MODE_CFG[m].label}] 모드로 전환되었습니다.`);
              }}
              className={cn(
                'py-3 px-1 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 border-2 transition-all cursor-pointer',
                mode === m ? MODE_CFG[m].active : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="text-lg">{MODE_CFG[m].emoji}</span>
              <span className="truncate max-w-[70px] text-[11px]">{MODE_CFG[m].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 📋 2. 출고/출하대기 선택 시 등록된 발주서 / 현장 선택 연동 */}
      {(mode === 'OUT' || mode === 'STAGING') && (
        <div className="bg-white rounded-2xl p-4 border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Building2 className={cn('h-4 w-4', mode === 'OUT' ? 'text-red-600' : 'text-indigo-600')} />
              <span>📋 {MODE_CFG[mode].label} 현장 / 등록 발주서 선택</span>
            </label>
            <span className="text-[11px] font-bold text-slate-500">
              총 {uniqueSites.length}개 현장 등록됨
            </span>
          </div>

          {/* 🔍 검색 필터 입력창 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={siteSearchTerm}
              onChange={(e) => setSiteSearchTerm(e.target.value)}
              placeholder="🔍 현장명/발주서 키워드 검색 (예: 고양, 아라월평, 판교)"
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          {/* 현장 선택 드롭다운 (포커스 뺏김 현원 방지!) */}
          <select
            value={selectedSiteKey}
            onChange={(e) => handleSiteSelect(e.target.value)}
            className={cn(
              'w-full border-2 rounded-xl p-3 text-xs font-bold bg-white text-slate-900 outline-none transition-colors cursor-pointer',
              mode === 'OUT' ? 'border-red-300 focus:border-red-500' : 'border-indigo-300 focus:border-indigo-500'
            )}
          >
            <option value="">-- {MODE_CFG[mode].label} 처리할 현장/발주서를 선택하세요 --</option>
            {filteredSites.map((site) => (
              <option key={site} value={site}>
                🏢 {site}
              </option>
            ))}
          </select>

          {/* 선택된 발주서/현장의 등록 품목 상세 내역 */}
          {selectedSiteKey && (
            <div className="bg-slate-50 border rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="font-extrabold text-slate-800">📋 [{selectedSiteKey}] 발주 품목 명세</span>
                <span className="font-mono font-bold text-indigo-700">목표: {targetOrderQty} EA</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingOrders
                  .filter(p => (p.project_name || p.site_name || p.customer_name) === selectedSiteKey)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border p-2 rounded-lg text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900">{item.item_name}</span>
                        <span className="text-slate-400 font-mono ml-2">규격: {item.spec || '-'}</span>
                      </div>
                      <span className="font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded font-mono">
                        {item.ordered_qty} {item.unit || 'EA'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 📊 3. 실시간 스캔 진행 카운터 */}
      <div className="bg-white rounded-2xl p-4 border shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <span className="text-lg">🔢</span> 실시간 스캔 진행 현황
          </span>
          <span className="text-xs font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            총 {totalScannedCount}건 스캔 완료 ({totalScannedQty} EA)
          </span>
        </div>

        {targetOrderQty > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">발주서 목표 달성률</span>
              <span className={cn(progressPercent >= 100 ? 'text-emerald-600 font-black' : 'text-blue-700 font-black')}>
                {totalScannedQty} / {targetOrderQty} EA ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border">
              <div 
                className={cn('h-full transition-all duration-300', progressPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600')}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 📷 4. 동시 가동되는 스캔 시스템 */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden space-y-3 p-4">
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
              'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer',
              cameraActive ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-600'
            )}
          >
            <Camera className="h-3.5 w-3.5" />
            {cameraActive ? '카메라 스캔 켜짐' : '카메라 스캔 켜기'}
          </button>
        </div>

        {cameraActive && (
          <div className="relative bg-slate-900 rounded-xl overflow-hidden min-h-[180px]">
            <div id="reader-container" className="w-full max-h-60 object-cover" />
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 text-white text-xs p-4 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-amber-400 font-bold">⚠️ {cameraError}</p>
                <p className="text-slate-400 text-[11px]">스마트폰 브라우저 카메라 허용 권한을 확인해주세요.</p>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {searching ? <Scan className="h-5 w-5 text-blue-500 animate-spin" /> : <Scan className="h-5 w-5 text-slate-400" />}
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

      {/* 📦 5. LOT 인식 후 수불 입력 폼 */}
      {scannedLot ? (
        <div className={cn('rounded-2xl border-2 p-5 space-y-4 shadow-sm bg-white', MODE_CFG[mode].border)}>
          <div className="flex items-start justify-between border-b pb-3">
            <div>
              <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-slate-800">
                #{scanHistory.length + 1}번째 스캔 대상
              </span>
              <p className="text-xl font-black font-mono text-slate-900 mt-1">{scannedLot.lot_number}</p>
              <p className="text-sm font-bold text-slate-800">{scannedLot.item_name}</p>
              <p className="text-xs text-slate-500 font-medium">규격: {fmtSpec(scannedLot)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-bold">현재 재고</p>
              <p className="text-3xl font-black text-slate-900">{Number(scannedLot.qty_current).toLocaleString()}</p>
              <p className="text-xs font-bold text-slate-500">{scannedLot.unit}</p>
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
                placeholder="수량 입력"
                required
                className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-blue-600"
              />
            </div>

            {(mode === 'MOVE' || mode === 'IN' || mode === 'STAGING') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {mode === 'MOVE' ? '이동 후 렉/위치 코드 (예: A1-P1) *' : '적재/보관 렉/공장구역 코드 (선택)'}
                </label>
                <input
                  value={locationTo}
                  onChange={(e) => setLocationTo(e.target.value)}
                  placeholder="예: A1-P1 또는 FIELD-1F-MAIN"
                  required={mode === 'MOVE'}
                  className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'w-full py-4 rounded-xl text-white text-base font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-60 cursor-pointer',
                mode === 'OUT' ? 'bg-red-600 hover:bg-red-700' :
                mode === 'STAGING' ? 'bg-indigo-600 hover:bg-indigo-700' :
                mode === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' :
                'bg-amber-500 hover:bg-amber-600'
              )}
            >
              <Zap className="h-5 w-5" />
              {submitting ? '처리 중...' : `[#${scanHistory.length + 1}번째] ${MODE_CFG[mode].emoji} ${MODE_CFG[mode].label} 확인`}
            </button>
          </form>
        </div>
      ) : null}

      {/* 📜 6. 실시간 스캔 카운팅 리스트 */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden space-y-0">
        <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-black">실시간 스캔 처리 카운팅 내역 ({scanHistory.length}건)</span>
          </div>
          {scanHistory.length > 0 && (
            <button
              onClick={() => setScanHistory([])}
              className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-0.5 rounded font-bold"
            >
              초기화
            </button>
          )}
        </div>

        {scanHistory.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {scanHistory.map((item) => (
              <div key={item.seq} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black bg-blue-900 text-white px-2 py-1 rounded-lg">
                    #{item.seq}번째
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">{item.lot_number}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.mode}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{item.item_name}</p>
                    <p className="text-[11px] text-slate-400">규격: {item.spec} {item.location && `| 위치: ${item.location}`}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-emerald-700">
                    {item.qty} {item.unit}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 space-y-1">
            <p>아직 스캔된 항목이 없습니다.</p>
            <p className="text-[11px] text-slate-300">스캐너나 카메라로 찍으면 실시간 카운팅 순번과 품목 정보가 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* 🎉 7. 수량 100% 달성 알림 모달 */}
      {completionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black">
              🎉
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">출하 수량 100% 달성 완료!</h3>
              <p className="text-xs font-bold text-emerald-700">
                선택하신 현장 [{selectedSiteKey}] 의 총 발주 수량 ({targetOrderQty} EA) 스캔이 완수되었습니다.
              </p>
            </div>

            <div className="bg-slate-50 border p-3 rounded-xl text-xs space-y-1 text-left">
              <p className="text-slate-600 font-bold">총 스캔 처리: <span className="text-blue-900 font-black">{totalScannedQty} EA ({totalScannedCount}건)</span></p>
              <p className="text-slate-600 font-bold">출하 현장: <span className="text-slate-800 font-black">{selectedSiteKey}</span></p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setCompletionModalOpen(false);
                  navigate('/shipment/statements');
                }}
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
              >
                <FileText size={16} />
                <span>📄 출하 거래명세표 작성/출력으로 이동</span>
              </button>
              <button
                onClick={() => setCompletionModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                닫고 계속 스캔하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
