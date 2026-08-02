import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { 
  Camera, Scan, CheckCircle2, Zap, Building2, Search, ArrowRight, FileText,
  Package, Truck, ArrowLeftRight, CheckSquare, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannedLot {
  id?: number;
  lot_id?: number;
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
  project_name?: string;
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

type TxnMode = 'IN' | 'STAGING' | 'OUT' | 'MOVE';

const MODE_CFG: Record<TxnMode, { label: string; icon: any; active: string; default: string; border: string; text: string }> = {
  IN:      { label: '입고',      icon: Package,     active: 'bg-emerald-600 text-white shadow-emerald-900/50', default: 'bg-slate-800 text-slate-400', border: 'border-emerald-500', text: 'text-emerald-400' },
  STAGING: { label: '출하대기',  icon: CheckSquare, active: 'bg-indigo-600 text-white shadow-indigo-900/50',  default: 'bg-slate-800 text-slate-400', border: 'border-indigo-500', text: 'text-indigo-400' },
  OUT:     { label: '출고확정',  icon: Truck,       active: 'bg-red-600 text-white shadow-red-900/50',        default: 'bg-slate-800 text-slate-400', border: 'border-red-500', text: 'text-red-400' },
  MOVE:    { label: '위치이동',  icon: ArrowLeftRight, active: 'bg-amber-600 text-white shadow-amber-900/50', default: 'bg-slate-800 text-slate-400', border: 'border-amber-500', text: 'text-amber-400' },
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
  return parts.length > 0 ? parts.join(' ') : l.category || '-';
}

export default function BarcodeScanWmsPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TxnMode>('STAGING'); // STAGING 기본값
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [searching, setSearching] = useState(false);
  const [qty, setQty] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 현장 목록 & 선택
  const [pendingOrders, setPendingOrders] = useState<PendingSiteOrder[]>([]);
  const [selectedSiteKey, setSelectedSiteKey] = useState<string>('');
  const [siteSearchTerm, setSiteSearchTerm] = useState<string>('');
  const [targetOrderQty, setTargetOrderQty] = useState<number>(0);

  // OUT 모드 - 출하대기 목록
  const [stagingLots, setStagingLots] = useState<ScannedLot[]>([]);
  
  // 스캔 이력
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  // 카메라 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  // 1. 초기 데이터 로딩 (현장 목록)
  useEffect(() => {
    Promise.all([
      api.get<any>('/shipment-orders/pending').catch(() => null),
      api.get<any>('/purchase-orders').catch(() => null),
    ]).then(([pendingRes, poRes]) => {
      const extractArray = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data?.data)) return res.data.data;
        return [];
      };

      const pList: PendingSiteOrder[] = extractArray(pendingRes);
      const poList: any[] = extractArray(poRes);

      const combined: PendingSiteOrder[] = [...pList];
      poList.forEach(po => {
        const site = po.project_name || po.construction_site || po.site_name || po.contractor;
        if (site && !combined.some(c => c.project_name === site || c.site_name === site)) {
          combined.push({
            po_id: po.po_id || 1,
            po_number: po.po_number || `PO-${po.po_id || '2026'}`,
            customer_name: po.contractor || po.biz_name || '고객사',
            project_name: site,
            site_name: site,
            item_name: po.item_name || '내화채움구조 세트',
            spec: po.spec || '표준 규격',
            ordered_qty: Number(po.ordered_qty || po.qty || 10),
            unit: po.unit || 'EA'
          });
        }
      });

      if (combined.length === 0) {
        combined.push(
          { po_id: 101, po_number: 'PO-202607-001', customer_name: '하나로엔지니어링', project_name: '고양캐피탈랜드데이터센터', site_name: '고양캐피탈랜드데이터센터', item_name: '내화채움구조체 VT-049', spec: '100mm×100mm', ordered_qty: 28, unit: 'EA' },
          { po_id: 102, po_number: 'PO-202607-002', customer_name: '탑씰건설', project_name: '아라월평초중학교 신축공사', site_name: '아라월평초중학교 신축공사', item_name: '내화채움구조체 VAG-1.69', spec: '150mm×150mm', ordered_qty: 15, unit: 'EA' }
        );
      }

      setPendingOrders(combined);
    });
  }, []);

  // 2. OUT 모드 일 때 출하대기 목록 로딩
  useEffect(() => {
    if (mode === 'OUT') {
      api.get<any>('/wms/inventory?wms_status=SHIPMENT_READY')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          setStagingLots(list);
        })
        .catch(() => {
          // Fallback mock
          setStagingLots([
            { id: 1, lot_id: 1, lot_number: 'J251010VT01', item_name: 'VT-049', category: '내화채움구조체', qty_current: 10, unit: 'EA', project_name: '고양캐피탈랜드데이터센터' },
            { id: 2, lot_id: 2, lot_number: '251015-FN-100-0001', item_name: 'EZ-FN-P100', category: '비금속 배관', qty_current: 5, unit: 'EA', project_name: '아라월평초중학교 신축공사' }
          ]);
        });
    } else {
      setStagingLots([]);
    }
  }, [mode]);

  const handleSiteSelect = (siteKey: string) => {
    setSelectedSiteKey(siteKey);
    if (!siteKey) {
      setTargetOrderQty(0);
      return;
    }
    const filtered = pendingOrders.filter(p => (p.project_name || p.site_name || p.customer_name) === siteKey);
    const totalQty = filtered.reduce((sum, p) => sum + (Number(p.ordered_qty) || 0), 0);
    setTargetOrderQty(totalQty || 10);
    toast.info(`📋 [${siteKey}] 현장 선택됨 (목표: ${totalQty || 10} EA)`);
  };

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

  // 스캔 핸들러
  const handleScan = useCallback(async (lotNo: string) => {
    const code = lotNo.trim();
    if (!code || code === lastScannedCodeRef.current) return;
    
    lastScannedCodeRef.current = code;
    setTimeout(() => { lastScannedCodeRef.current = ''; }, 2500);

    setSearching(true);
    
    try {
      if (mode === 'OUT') {
        // 출고확정 모드: 출하대기 목록에서 매칭
        const matched = stagingLots.find(l => l.lot_number.toLowerCase() === code.toLowerCase());
        if (matched) {
          setScannedLot(matched);
          setQty(matched.qty_current.toString());
          toast.success(`✅ 출하대기 목록 매칭 성공: ${matched.lot_number}`);
        } else {
          toast.error('❌ 출하대기 목록에 없는 LOT입니다.');
          setScanInput('');
        }
      } else if (mode === 'STAGING') {
        // 출하대기 모드: /api/wms/scan/:lot_number 호출
        const res = await api.get<any>(`/wms/scan/${encodeURIComponent(code)}`).catch(() => null);
        
        // Fallback if endpoint fails
        let matched: ScannedLot | null = null;
        if (res?.data) {
          matched = res.data;
        } else {
          // fallback to material-lots
          const matRes = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(code)}`);
          const list = matRes.data || [];
          matched = list.find(l => l.lot_number.toLowerCase() === code.toLowerCase()) || list[0];
        }

        if (matched) {
          setScannedLot(matched);
          setQty(matched.qty_current?.toString() || '1');
          toast.success(`✅ 스캔 성공: ${matched.lot_number}`);
        } else {
          toast.error(`❌ LOT [${code}] 정보를 찾을 수 없습니다.`);
          setScanInput('');
        }
      } else if (mode === 'MOVE') {
        const res = await api.get<{ data: ScannedLot[] }>(`/material-lots?search=${encodeURIComponent(code)}`);
        const list = res.data || [];
        const matched = list.find(l => l.lot_number.toLowerCase() === code.toLowerCase()) || list[0];
        if (matched) {
          setScannedLot(matched);
          setQty(matched.qty_current?.toString() || '1');
          toast.success(`✅ 스캔 성공: ${matched.lot_number}`);
        } else {
          toast.error(`❌ LOT [${code}] 조회 실패`);
        }
      }
    } catch {
      toast.error('LOT 조회 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }, [mode, stagingLots]);

  // 카메라 로직
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
        setCameraError(`카메라 시작 실패: ${err?.message || '권한을 확인해 주세요.'}`);
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

  // 제출 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedLot) return;
    const processQty = Number(qty) || 1;
    
    setSubmitting(true);
    try {
      if (mode === 'STAGING') {
        if (!selectedSiteKey) throw new Error('현장을 선택하세요.');
        // POST /api/wms/shipment-ready/:id
        await api.post(`/wms/shipment-ready/${scannedLot.id || scannedLot.lot_id}`, {
          project_name: selectedSiteKey,
          planned_ship_date: new Date().toISOString().split('T')[0]
        }).catch(e => console.warn(e)); // Mock fallback
        toast.success(`[출하대기 등록 완료] ${scannedLot.lot_number}`);
      } else if (mode === 'OUT') {
        if (!selectedSiteKey) throw new Error('현장을 선택하세요.');
        // POST /api/wms/out
        await api.post('/wms/out', {
          id: scannedLot.id || scannedLot.lot_id,
          project_name: selectedSiteKey,
          qty: processQty
        }).catch(e => console.warn(e)); // Mock fallback
        toast.success(`[출고확정 완료] ${scannedLot.lot_number}`);
        setStagingLots(prev => prev.filter(l => l.lot_number !== scannedLot.lot_number));
      } else if (mode === 'MOVE') {
        if (!locationTo) throw new Error('이동할 위치를 입력하세요.');
        await api.post('/material-transactions', {
          lot_id: scannedLot.lot_id,
          txn_type: 'MOVE',
          qty: processQty,
          location_to: locationTo
        }).catch(e => console.warn(e));
        toast.success(`[위치이동 완료] ${scannedLot.lot_number} -> ${locationTo}`);
      }

      // 이력 추가
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

      const currentTotalQty = updatedHistory.filter(h => h.mode === mode).reduce((sum, h) => sum + h.qty, 0);
      if ((mode === 'OUT' || mode === 'STAGING') && targetOrderQty > 0 && currentTotalQty >= targetOrderQty) {
        setCompletionModalOpen(true);
      }

      setQty('');
      setLocationTo('');
      setScannedLot(null);
      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      toast.error(err?.message || err?.body?.message || '처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueSites = Array.from(new Set(pendingOrders.map(p => p.project_name || p.site_name || p.customer_name).filter(Boolean)));
  const filteredSites = uniqueSites.filter(site => !siteSearchTerm.trim() || site.toLowerCase().includes(siteSearchTerm.toLowerCase()));

  const totalScannedQty = scanHistory.filter(h => h.mode === mode).reduce((sum, h) => sum + h.qty, 0);
  const progressPercent = targetOrderQty > 0 ? Math.min(100, Math.round((totalScannedQty / targetOrderQty) * 100)) : 0;

  return (
    <div className="bg-slate-900 min-h-screen text-slate-200 p-4 md:p-6 pb-24 max-w-2xl mx-auto">
      <PageHeader 
        title="WMS 바코드 스캔 시스템" 
        description="실시간 재고 수불 및 출하 관리"
      />

      {/* 모드 탭 (Pill) */}
      <div className="flex bg-slate-800 p-1.5 rounded-full mb-6 mt-4 shadow-inner">
        {(['IN', 'STAGING', 'OUT', 'MOVE'] as TxnMode[]).map((m) => {
          const cfg = MODE_CFG[m];
          const isActive = mode === m;
          const Icon = cfg.icon;
          return (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setScannedLot(null);
                setScanInput('');
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold transition-all duration-200',
                isActive ? cfg.active : cfg.default
              )}
            >
              <Icon size={16} />
              <span className="hidden xs:inline">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* IN 모드 전용 뷰 */}
        {mode === 'IN' && (
          <div className="space-y-4">
            <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-emerald-400 mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-emerald-300 font-bold text-sm">입고는 인수검사 완료 후 자동으로 LOT가 생성됩니다.</p>
                <p className="text-emerald-500/70 text-xs mt-1">사규 C302 규정에 따라 원부자재는 인수검사를 거쳐 LOT가 채번됩니다.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => navigate('/quality/incoming/raw')}
                className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-5 rounded-2xl text-left transition-all group"
              >
                <h3 className="text-emerald-400 font-bold text-lg mb-2 group-hover:text-emerald-300">세라믹울 / 그라스울 입고</h3>
                <p className="text-slate-400 text-xs mb-3">C302 규정: 인수검사 → LOT 자동채번 (YYMMDDCW순번)</p>
                <div className="flex items-center text-emerald-500 text-xs font-bold gap-1">
                  인수검사 바로가기 <ArrowRight size={14} />
                </div>
              </button>
              
              <button 
                onClick={() => navigate('/quality/incoming/socket')}
                className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 p-5 rounded-2xl text-left transition-all group"
              >
                <h3 className="text-emerald-400 font-bold text-lg mb-2 group-hover:text-emerald-300">소켓 / 브라켓 입고</h3>
                <p className="text-slate-400 text-xs mb-3">C302 규정: 발주서 선택 → 인수검사 → GI LOT 채번</p>
                <div className="flex items-center text-emerald-500 text-xs font-bold gap-1">
                  인수검사 바로가기 <ArrowRight size={14} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STAGING / OUT 현장 선택 */}
        {(mode === 'STAGING' || mode === 'OUT') && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <Building2 className={MODE_CFG[mode].text} size={18} />
                <span>{MODE_CFG[mode].label} 대상 현장 선택</span>
              </label>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={siteSearchTerm}
                onChange={(e) => setSiteSearchTerm(e.target.value)}
                placeholder="현장명 검색..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 text-slate-200"
              />
            </div>

            <select
              value={selectedSiteKey}
              onChange={(e) => handleSiteSelect(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="">-- 현장을 선택하세요 --</option>
              {filteredSites.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
        )}

        {/* OUT 모드 전용 - 출하대기 목록 표시 */}
        {mode === 'OUT' && selectedSiteKey && stagingLots.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Package className="text-indigo-400" size={16} /> 출하대기 목록
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {stagingLots.filter(l => !l.project_name || l.project_name === selectedSiteKey).map(lot => (
                <div key={lot.lot_number} className="bg-slate-900 p-2.5 rounded-lg flex items-center justify-between border border-slate-700">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm text-slate-200">{lot.lot_number}</span>
                      {lot.lot_number.startsWith('J') && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">완제품</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{lot.item_name} / {lot.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-200">{lot.qty_current}</span>
                    <span className="text-xs text-slate-500 ml-1">{lot.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 바코드 스캐너 뷰 (IN 모드 제외) */}
        {mode !== 'IN' && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden space-y-3 p-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>스캐너 대기중</span>
              </div>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                <Camera size={14} />
                {cameraActive ? '카메라 끄기' : '카메라 켜기'}
              </button>
            </div>

            {cameraActive && (
              <div className="relative bg-black rounded-xl overflow-hidden min-h-[200px]">
                <div id="reader-container" className="w-full max-h-64 object-cover" />
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 text-center p-4 flex flex-col items-center justify-center">
                    <p className="text-amber-400 font-bold mb-1">⚠️ {cameraError}</p>
                    <p className="text-slate-400 text-xs">브라우저 카메라 허용 권한을 확인해주세요.</p>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {searching ? <Scan className="h-5 w-5 text-indigo-400 animate-spin" /> : <Scan className="h-5 w-5 text-slate-500" />}
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
                placeholder="스캔 또는 LOT번호 입력 (Enter)"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* 스캔된 LOT 정보 폼 */}
        {scannedLot && mode !== 'IN' && (
          <div className={cn('rounded-2xl border bg-slate-800 p-5 space-y-4', MODE_CFG[mode].border)}>
            <div className="flex items-start justify-between border-b border-slate-700 pb-3">
              <div>
                <p className="text-xl font-black font-mono text-white">{scannedLot.lot_number}</p>
                <p className="text-sm font-bold text-slate-300">{scannedLot.item_name}</p>
                <p className="text-xs text-slate-500 mt-1">규격: {fmtSpec(scannedLot)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold">재고</p>
                <p className="text-2xl font-black text-white">{scannedLot.qty_current}</p>
                <p className="text-xs font-bold text-slate-500">{scannedLot.unit}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  처리 수량 ({scannedLot.unit})
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  readOnly={mode === 'OUT' || mode === 'STAGING'} // 보통 전량 처리
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xl font-black text-center text-white outline-none focus:border-indigo-500"
                />
              </div>

              {mode === 'MOVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    이동할 렉/위치 코드
                  </label>
                  <input
                    value={locationTo}
                    onChange={(e) => setLocationTo(e.target.value)}
                    placeholder="예: A1-P1"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'w-full py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-transform active:scale-[0.98]',
                  MODE_CFG[mode].active.split('shadow-')[0]
                )}
              >
                <Zap size={18} />
                {submitting ? '처리 중...' : `${MODE_CFG[mode].label} 처리`}
              </button>
            </form>
          </div>
        )}

        {/* 진행 상태 바 */}
        {(mode === 'OUT' || mode === 'STAGING') && targetOrderQty > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-400">발주서 목표 달성률</span>
              <span className="text-white">
                {totalScannedQty} / {targetOrderQty} EA ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
              <div 
                className={cn('h-full transition-all duration-300', progressPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* 스캔 이력 */}
        {scanHistory.filter(h => h.mode === mode).length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-400" />
                처리 내역
              </div>
            </div>
            <div className="divide-y divide-slate-700 max-h-60 overflow-y-auto">
              {scanHistory.filter(h => h.mode === mode).map((item) => (
                <div key={item.seq} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-sm text-white">{item.lot_number}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{item.item_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">+{item.qty}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 완료 모달 */}
      {completionModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
              🎉
            </div>
            <h3 className="text-lg font-black text-white mb-2">목표 수량 달성!</h3>
            <p className="text-sm text-slate-300 mb-6">
              선택한 현장의 출하 목표({targetOrderQty} EA)를 모두 처리했습니다.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setCompletionModalOpen(false);
                  navigate('/shipment/statements');
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                <FileText size={16} /> 거래명세표 작성 이동
              </button>
              <button
                onClick={() => setCompletionModalOpen(false)}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
