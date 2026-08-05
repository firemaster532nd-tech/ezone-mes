import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { 
  Camera, Scan, CheckCircle2, Zap, Building2, Search, ArrowRight, FileText,
  Package, Truck, ArrowLeftRight, CheckSquare, Info, ShoppingCart, Trash2, Send, Volume2, Sparkles
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

type TxnMode = 'AUTO' | 'IN' | 'STAGING' | 'OUT' | 'MOVE';

const MODE_CFG: Record<TxnMode, { label: string; icon: any; active: string; default: string; border: string; text: string }> = {
  AUTO:    { label: '⚡스마트 감지', icon: Zap,             active: 'bg-amber-500 text-slate-950 shadow-amber-500/50 font-black', default: 'bg-slate-800 text-slate-400', border: 'border-amber-400', text: 'text-amber-400' },
  IN:      { label: '입고',         icon: Package,         active: 'bg-emerald-600 text-white shadow-emerald-900/50', default: 'bg-slate-800 text-slate-400', border: 'border-emerald-500', text: 'text-emerald-400' },
  STAGING: { label: '출하대기',     icon: CheckSquare,     active: 'bg-indigo-600 text-white shadow-indigo-900/50',  default: 'bg-slate-800 text-slate-400', border: 'border-indigo-500', text: 'text-indigo-400' },
  OUT:     { label: '출고확정',     icon: Truck,           active: 'bg-red-600 text-white shadow-red-900/50',        default: 'bg-slate-800 text-slate-400', border: 'border-red-500', text: 'text-red-400' },
  MOVE:    { label: '위치이동',     icon: ArrowLeftRight, active: 'bg-teal-600 text-white shadow-teal-900/50',       default: 'bg-slate-800 text-slate-400', border: 'border-teal-500', text: 'text-teal-400' },
};

interface CartItem {
  id: string;
  lot_number: string;
  item_name: string;
  spec: string;
  qty: number;
  unit: string;
  mode: TxnMode;
  location_code?: string;
  project_name?: string;
  time: string;
}

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

function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 (880Hz)
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {}
}

export default function BarcodeScanWmsPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<TxnMode>('AUTO');
  const [scanInput, setScanInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [locationTo, setLocationTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 위치 스캔 팝업: 해당 라케이션 현재 재고 표시
  const [locationPopup, setLocationPopup] = useState<{
    locCode: string;
    items: { lot_number: string; item_name: string; qty: number; spec?: string; slot: string }[];
  } | null>(null);

  // 현장 목록 & 선택
  const [pendingOrders, setPendingOrders] = useState<PendingSiteOrder[]>([]);
  const [selectedSiteKey, setSelectedSiteKey] = useState<string>('');
  const [siteSearchTerm, setSiteSearchTerm] = useState<string>('');

  // 🛒 일괄 스캔 장바구니 (Batch Scan Cart)
  const [batchCart, setBatchCart] = useState<CartItem[]>([]);

  // OUT 모드 - 출하대기 목록
  const [stagingLots, setStagingLots] = useState<ScannedLot[]>([]);
  
  // 스캔 이력
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  // 카메라 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

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

  // 2. 모바일 디바이스 감지
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

  // 3. 포커스 유지
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

  // 4. 바코드 스캔 처리 (연속 장바구니 자동 추가)
  const handleScan = useCallback(async (barcodeValue: string) => {
    const code = barcodeValue.trim();
    if (!code) return;

    playBeepSound();
    setSearching(true);
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // 랙 위치 바코드 패턴 인지 (예: A1-P1, FIELD-1F-OUTDOOR 등)
      if (/^[A-R][1-3]-P[1-2]$/i.test(code) || code.startsWith('FIELD-')) {
        if (batchCart.length > 0) {
          toast.success(`🚚 [${code}] 위치로 즉시 이동 처리를 시작합니다!`);
          
          const updatedCart = batchCart.map(item => ({ ...item, location_code: code, mode: 'MOVE' as TxnMode }));
          
          setSubmitting(true);
          try {
            await api.post<any>('/wms/batch-upload', {
              items: updatedCart.map(item => ({
                lot_number: item.lot_number,
                mode: 'MOVE',
                qty: item.qty,
                location_code: code,
                project_name: item.project_name || selectedSiteKey,
                item_name: item.item_name,
                spec: item.spec,
              }))
            });
            toast.success(`🎉 랙(${code})으로 즉시 이동 완료되었습니다!`);
            
            setScanHistory(prev => {
              const newHistoryItems: ScanHistoryItem[] = updatedCart.map((item, idx) => ({
                seq: prev.length + idx + 1,
                lot_number: item.lot_number,
                item_name: item.item_name,
                spec: item.spec,
                qty: item.qty,
                unit: item.unit,
                mode: 'MOVE',
                location: code,
                projectName: item.project_name || selectedSiteKey,
                time: currentTime,
              }));
              return [...newHistoryItems, ...prev];
            });
            
            setBatchCart([]);
            setLocationTo('');
          } catch (err) {
            toast.error(`이동 실패: ${(err as any)?.message}`);
          } finally {
            setSubmitting(false);
            setScanInput('');
            setTimeout(() => inputRef.current?.focus(), 50);
          }
          return;
        } else {
          // 장바구니가 비어있다면 → 해당 위치 현재 재고 조회 후 팝업 표시
          setLocationTo(code);
          setScanInput('');
          try {
            const res = await api.get<any>('/wms/rack-map');

            // API 응답: res.data = { data: { non_certified, lots, material_lots } }
            const payload = (res.data?.data !== undefined) ? res.data.data : res.data;
            const lots: any[]          = Array.isArray(payload?.lots)          ? payload.lots          : [];
            const material_lots: any[] = Array.isArray(payload?.material_lots) ? payload.material_lots : [];
            const non_certified: any[] = Array.isArray(payload?.non_certified) ? payload.non_certified : [];

            const allItems: { lot_number: string; item_name: string; qty: number; spec?: string; slot: string }[] = [];

            // rack base 코드와 파레트 번호 분리 — 예) 'J3-P1' → rackBase='J3', palletNo='1'
            const rackBase = code.replace(/-P[12]$/i, '');
            const palletNo = code.match(/-P([12])$/i)?.[1] ?? null;

            // ① 비인정재고 — location_code = 'J3-P1' 형식으로 직접 비교 (가장 신뢰)
            non_certified.forEach((nc: any) => {
              const locCode: string = nc.location_code || '';
              const locBase = locCode.replace(/-P[12]$/i, '');
              const locPallet = locCode.match(/-P([12])$/i)?.[1] ?? String(nc.pallet_no ?? '');
              // rack_code 기반 매칭도 fallback으로 지원
              const matchesBase = locBase === rackBase || nc.rack_code === rackBase;
              if (!matchesBase) return;
              if (palletNo && locPallet && locPallet !== palletNo) return;
              allItems.push({
                lot_number: nc.lot_number || '-',
                item_name: nc.item_name || '비인정재고',
                qty: Number(nc.qty ?? 0),
                spec: nc.spec || nc.notes || '',
                slot: locPallet ? `P${locPallet}` : `P${nc.pallet_no ?? '?'}`,
              });
            });

            // ② 인정재고 (assembly_lot) — location_code 'A1-P1' 형식
            lots.forEach((l: any) => {
              const locCode: string = l.location_code || l.staging_location || '';
              const locBase = locCode.replace(/-P[12]$/i, '');
              const locPallet = locCode.match(/-P([12])$/i)?.[1] ?? l.rack_pallet?.toString() ?? '';
              if (locBase !== rackBase) return;
              if (palletNo && locPallet && locPallet !== palletNo) return;
              allItems.push({
                lot_number: l.lot_number,
                item_name: l.item_name || '완제품',
                qty: Number(l.remaining_qty ?? l.qty ?? 0),
                spec: l.spec || '',
                slot: locPallet ? `P${locPallet}` : '',
              });
            });

            // ③ 자재 (material_lots) — location_code 'A1-P1' 형식 (없으면 location 텍스트)
            material_lots.forEach((ml: any) => {
              const locCode: string = ml.location_code || '';
              const locBase = locCode.replace(/-P[12]$/i, '');
              const locPallet = locCode.match(/-P([12])$/i)?.[1] ?? ml.rack_pallet?.toString() ?? '';
              if (!locCode || locBase !== rackBase) return;
              if (palletNo && locPallet && locPallet !== palletNo) return;
              allItems.push({
                lot_number: ml.lot_number,
                item_name: ml.item_name || '자재',
                qty: Number(ml.qty_current ?? 0),
                spec: ml.spec || ml.category || '',
                slot: locPallet ? `P${locPallet}` : '',
              });
            });

            setLocationPopup({ locCode: code, items: allItems });
            toast[allItems.length > 0 ? 'success' : 'info'](
              allItems.length > 0
                ? `📍 [${code}] ${allItems.length}건 재고 확인`
                : `📍 [${code}] 등록된 재고 없음`
            );
          } catch (err) {
            console.error('위치 재고 조회 실패:', err);
            toast.info(`📍 목적지 선지정: ${code}`);
          }
          return;
        }


      }





      let detectedMode: TxnMode = mode;
      let itemName = '원부자재/완제품';
      let spec = '표준 규격';
      let unit = 'EA';
      let defaultQty = 1;

      // ⚡ 스마트 감지 모드인 경우
      if (mode === 'AUTO') {
        const lookupRes = await api.post<any>('/wms/barcode/lookup', { barcode: code }).catch(() => null);
        const data = lookupRes?.data || lookupRes;
        
        if (data && (data.non_certified?.length > 0 || data.lots?.length > 0)) {
          const itemInfo = data.non_certified?.[0] || data.lots?.[0];
          itemName = itemInfo.item_name || '재고 품목';
          spec = itemInfo.spec || itemInfo.category || '기본 규격';
          unit = itemInfo.unit || 'EA';
          defaultQty = Number(itemInfo.qty) || 1;
          
          if (itemInfo.wms_status === 'SHIPMENT_READY') {
            detectedMode = 'OUT'; // 이미 출하 대기 ➔ 출고 확정
          } else {
            detectedMode = 'STAGING'; // WMS 보관 재고 ➔ 출하 대기
          }
        } else {
          // 신규 입고 바코드
          detectedMode = 'IN';
          itemName = code.startsWith('J') ? '조립 완제품' : code.includes('CW') ? '세라믹울' : code.includes('GI') ? '금속소켓' : '원부자재';
        }
      }

      // 장바구니에 담기 (이미 카트에 있으면 수량 증가)
      setBatchCart(prevCart => {
        const existingIdx = prevCart.findIndex(item => item.lot_number.toLowerCase() === code.toLowerCase() && item.mode === detectedMode);
        if (existingIdx >= 0) {
          const updated = [...prevCart];
          updated[existingIdx].qty += 1;
          toast.success(`🛒 [${code}] 카트 수량 증가 (+1 -> 총 ${updated[existingIdx].qty}개)`);
          return updated;
        } else {
          const newItem: CartItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            lot_number: code,
            item_name: itemName,
            spec,
            qty: defaultQty,
            unit,
            mode: detectedMode,
            location_code: locationTo || undefined,
            project_name: selectedSiteKey || undefined,
            time: currentTime,
          };
          toast.success(`🛒 스캔 추가 [${MODE_CFG[detectedMode].label}]: ${code}`);
          return [newItem, ...prevCart];
        }
      });

      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      toast.error(`스캔 오류: ${(err as any)?.message || '인식 실패'}`);
    } finally {
      setSearching(false);
    }
  }, [mode, locationTo, selectedSiteKey, batchCart]);

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
      } catch (err) {
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

  // 🚀 한 번에 일괄 업로드 (Batch Upload)
  const handleBatchUpload = async () => {
    if (batchCart.length === 0) {
      toast.error('업로드할 스캔 카트 항목이 없습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<any>('/wms/batch-upload', {
        items: batchCart.map(item => ({
          lot_number: item.lot_number,
          mode: item.mode === 'AUTO' ? 'STAGING' : item.mode,
          qty: item.qty,
          location_code: item.location_code,
          project_name: item.project_name || selectedSiteKey,
          item_name: item.item_name,
          spec: item.spec,
        }))
      });

      toast.success(`🎉 ${res.message || `총 ${batchCart.length}건이 성공적으로 일괄 등록되었습니다!`}`);
      
      // 스캔 이력으로 이동
      const newHistoryItems: ScanHistoryItem[] = batchCart.map((item, idx) => ({
        seq: scanHistory.length + idx + 1,
        lot_number: item.lot_number,
        item_name: item.item_name,
        spec: item.spec,
        qty: item.qty,
        unit: item.unit,
        mode: item.mode,
        location: item.location_code,
        projectName: item.project_name || selectedSiteKey,
        time: item.time,
      }));

      setScanHistory([...newHistoryItems, ...scanHistory]);
      setBatchCart([]);
      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      toast.error(`일괄 업로드 실패: ${(err as any)?.message || '서버 오류'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const removeItemFromCart = (id: string) => {
    setBatchCart(prev => prev.filter(item => item.id !== id));
    toast.info('스캔 항목이 카트에서 삭제되었습니다.');
  };

  const clearCart = () => {
    setBatchCart([]);
    toast.info('스캔 카트가 초기화되었습니다.');
  };

  const uniqueSites = Array.from(new Set(pendingOrders.map(p => p.project_name || p.site_name || p.customer_name).filter(Boolean)));
  const filteredSites = uniqueSites.filter(site => !siteSearchTerm.trim() || site.toLowerCase().includes(siteSearchTerm.toLowerCase()));

  return (
    <div className="bg-slate-900 min-h-screen text-slate-200 p-4 md:p-6 pb-24 max-w-2xl mx-auto">
      <PageHeader 
        title="WMS 스마트 바코드 연속 스캔" 
        description="블루투스/카메라 스캔 ➔ 1초 일괄 업로드 시스템"
      />

      {/* 📱 1. 모드 선택 탭 (AUTO / IN / STAGING / OUT / MOVE) */}
      <div className="grid grid-cols-5 gap-1.5 mb-4 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
        {(Object.keys(MODE_CFG) as TxnMode[]).map(m => {
          const cfg = MODE_CFG[m];
          const Icon = cfg.icon;
          const isSelected = mode === m;
          return (
            <button
              key={m}
              onClick={() => { setMode(m); toast.info(`[${cfg.label}] 모드 전환`); }}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[11px] transition-all',
                isSelected ? cfg.active : cfg.default
              )}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* 🏢 2. 출하 현장 선택 (STAGING / OUT / AUTO 용) */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-4 backdrop-blur-md shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-400" />
            출하 / 수불 대상 현장 선택
          </label>

          {selectedSiteKey && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              {selectedSiteKey}
            </span>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="현장명 검색 (예: 고양캐피탈랜드)..."
            value={siteSearchTerm}
            onChange={e => setSiteSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {filteredSites.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {filteredSites.map(site => (
              <button
                key={site}
                onClick={() => {
                  setSelectedSiteKey(site);
                  toast.success(`🏢 현장 선택: ${site}`);
                }}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition',
                  selectedSiteKey === site 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold' 
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                )}
              >
                {site}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 📍 랙 위치 지정 배너 */}
      {locationTo && (
        <div className="mb-4 bg-teal-950/60 border border-teal-500/50 rounded-xl p-3 flex items-center justify-between text-xs text-teal-300">
          <div className="flex items-center gap-2 font-bold">
            <span>📍 지정된 랙 위치:</span>
            <span className="font-mono text-sm bg-teal-900 px-2 py-0.5 rounded text-white border border-teal-400">{locationTo}</span>
          </div>
          <button onClick={() => setLocationTo('')} className="text-teal-400 hover:text-white font-bold">
            비우기 ✕
          </button>
        </div>
      )}

      {/* 🔍 3. 바코드 스캔 입력창 (스캐너 자동 포커스) */}
      <div className="bg-slate-800/90 border-2 border-amber-500/60 rounded-2xl p-4 mb-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Scan className="w-4 h-4 animate-pulse" />
            블루투스/USB 스캐너 및 카메라 스캔
          </span>
          <span className="text-[10px] text-slate-400 font-mono">0.1초 자동 감지</span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleScan(scanInput); }} className="relative flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            placeholder="스캐너로 바코드를 찍거나 직접 입력하세요..."
            className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-sm font-mono text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
            disabled={searching}
          />
          <button
            type="submit"
            disabled={searching || !scanInput.trim()}
            className="px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow flex items-center gap-1 flex-shrink-0"
          >
            {searching ? '조회중...' : '스캔'}
          </button>
        </form>
      </div>

      {/* 📹 4. 카메라 바코드 스캐너 */}
      {isMobile && (
        <div className="mb-4 bg-slate-800 border border-slate-700 rounded-2xl p-3 text-center">
          <button
            onClick={() => setCameraActive(!cameraActive)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 mx-auto"
          >
            <Camera className="w-4 h-4" />
            {cameraActive ? '스마트폰 카메라 끄기' : '스마트폰 카메라 켜기'}
          </button>
          
          {cameraActive && (
            <div className="mt-3">
              <div id="reader-container" className="overflow-hidden rounded-xl border border-slate-700 max-w-sm mx-auto" />
              {cameraError && <p className="text-xs text-red-400 mt-2">{cameraError}</p>}
            </div>
          )}
        </div>
      )}

      {/* 🛒 5. 스캔 장바구니 목록 & 한 번에 일괄 업로드 */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl mb-6">
        <div className="p-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">
              연속 스캔 카트 (총 <span className="text-amber-400 font-black text-base">{batchCart.length}</span>건)
            </h3>
          </div>

          {batchCart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              비우기
            </button>
          )}
        </div>

        {batchCart.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-2">
            <Package className="w-10 h-10 mx-auto opacity-30" />
            <p className="font-bold">카트가 비어있습니다.</p>
            <p className="text-[11px] text-slate-600">바코드를 스캐너로 계속 찍으면 여기에 차곡차곡 쌓입니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/60 max-h-96 overflow-y-auto">
            {batchCart.map((item) => {
              const cfg = MODE_CFG[item.mode] || MODE_CFG.AUTO;
              const updateQty = (newQty: number) => {
                setBatchCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: Math.max(1, newQty) } : c));
              };
              return (
                <div key={item.id} className="p-3.5 flex flex-col gap-2 hover:bg-slate-750 transition text-xs border-b border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-black', cfg.active)}>
                        {cfg.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-white text-sm truncate">{item.lot_number}</p>
                        <p className="text-[11px] text-slate-400 truncate">{item.item_name} ({item.spec})</p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeItemFromCart(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>

                  {/* ⚖️ 수량 조절 툴바 (모바일 터치 최적화) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-750 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-bold">🎯 빠른 수량:</span>
                      <div className="flex items-center gap-1.5">
                        {[1, 5, 10].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              updateQty(preset);
                            }}
                            className={cn(
                              'px-3 py-1 rounded-lg text-[11px] font-bold border transition shadow-sm',
                              item.qty === preset
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => updateQty(item.qty - 1)}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 hover:border-rose-800/50 font-black text-white flex items-center justify-center border border-slate-700 text-lg transition-colors"
                      >
                        -
                      </button>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={e => updateQty(Number(e.target.value || 1))}
                          className="w-20 px-2 py-1.5 bg-slate-950 border border-amber-500/50 text-amber-400 font-mono font-black text-sm text-center rounded-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 pointer-events-none">{item.unit || 'EA'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateQty(item.qty + 1)}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-emerald-900/50 hover:text-emerald-400 hover:border-emerald-800/50 font-black text-white flex items-center justify-center border border-slate-700 text-lg transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🚀 일괄 업로드 실행 버튼 */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/80">
          <button
            onClick={handleBatchUpload}
            disabled={submitting || batchCart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 transition transform active:scale-98"
          >
            <Send className="w-5 h-5" />
            {submitting ? 'WMS 수불 일괄 처리 중...' : `🚀 총 ${batchCart.length}건 한 번에 일괄 업로드 (Batch Upload)`}
          </button>
        </div>
      </div>

      {/* 📜 6. 최근 처리 완료 이력 */}
      {scanHistory.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
          <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-between">
            <span>📜 최근 처리 완료 이력 ({scanHistory.length}건)</span>
            <span className="text-[10px] text-slate-500 font-mono">최신순</span>
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
            {scanHistory.slice(0, 10).map((h) => (
              <div key={h.seq} className="p-2 bg-slate-900/80 rounded-lg flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">#{h.seq}</span>
                  <span className="font-mono font-bold text-slate-200">{h.lot_number}</span>
                  <span className="text-slate-400">{h.item_name}</span>
                </div>
                <span className="text-emerald-400 font-bold font-mono">✅ 완료 ({h.time})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 위치 스캔 재고 팝업 ─────────────────────────────────────────────── */}
      {locationPopup && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end sm:items-center justify-center p-3">
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 overflow-hidden">

            {/* 헤더 */}
            <div className="px-5 py-4 bg-slate-800 border-b border-slate-700 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg font-mono tracking-wider">
                    📍 {locationPopup.locCode}
                  </span>
                  <span className="text-slate-400 text-xs">현재 보관 재고</span>
                </div>
                <p className="text-[11px] text-slate-500">스캔 시점 기준 실시간 조회</p>
              </div>
              <button
                onClick={() => setLocationPopup(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>

            {/* 재고 목록 */}
            <div className="p-4 max-h-72 overflow-y-auto space-y-2">
              {locationPopup.items.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-3xl">📭</p>
                  <p className="text-slate-400 text-sm font-bold">현재 이 위치는 비어있습니다</p>
                  <p className="text-slate-500 text-xs">제품을 스캔하면 이 위치로 이동됩니다</p>
                </div>
              ) : (
                locationPopup.items.map((item, i) => (
                  <div key={i} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.slot && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
                              {item.slot}
                            </span>
                          )}
                          <span className="text-white font-mono font-black text-sm truncate">
                            {item.lot_number}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs font-bold truncate">{item.item_name}</p>
                        {item.spec && item.spec !== '-' && (
                          <p className="text-slate-500 text-[10px] mt-0.5 truncate">규격: {item.spec}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-emerald-400 font-black text-base font-mono">
                          {Number(item.qty).toLocaleString()}
                        </p>
                        <p className="text-slate-500 text-[10px]">EA</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 푸터 */}
            <div className="px-4 pb-4 pt-2 border-t border-slate-700 space-y-2">
              {locationPopup.items.length > 0 && (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">총 재고 합계</span>
                  <span className="text-emerald-400 font-black font-mono">
                    {locationPopup.items.reduce((a, b) => a + b.qty, 0).toLocaleString()} EA
                    <span className="text-slate-500 text-[10px] ml-1">/ {locationPopup.items.length}개 LOT</span>
                  </span>
                </div>
              )}
              <p className="text-[10px] text-slate-500 text-center">
                💡 이 위치가 목적지로 선지정되었습니다. 제품 바코드를 스캔하면 이동됩니다.
              </p>
              <button
                onClick={() => setLocationPopup(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                확인 (이 위치로 이동 준비 완료)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
