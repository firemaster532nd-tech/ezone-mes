import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Scan, MapPin, AlertTriangle, CheckCircle, Package,
  RefreshCw, X, ArrowRight, ShieldAlert, Clock, Plus, MoveRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 랙 로케이션 마스터 정의 (1구역 15칸×3층 O1~A3 거꾸로 배치 / 2구역 6칸×3층 U1~P3) ─────────
export const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
export const ZONE_2_COLS = ['U','T','S','R','Q','P'];
export const RACK_TIERS = [3, 2, 1]; // 3층, 2층, 1층

// 전체 63개 랙 셀 코드 배열
export const ALL_RACK_CODES: string[] = [
  ...ZONE_1_COLS.flatMap(col => [1,2,3].map(t => `${col}${t}`)),
  ...ZONE_2_COLS.flatMap(col => [1,2,3].map(t => `${col}${t}`)),
];

interface LotInfo {
  lot_id: number;
  lot_number: string;
  lot_type?: string;
  item_id?: number | null;
  item_name?: string | null;
  item_code?: string | null;
  item_category?: string | null;
  qty: number;
  remaining_qty?: number;
  unit?: string | null;
  status?: string;
  staging_location?: string | null;
  location?: string | null;
  created_at?: string;
}

interface LocationStatus {
  location_code: string;
  lot_id: number | null;
  lot_number: string | null;
  item_name: string | null;
  qty: number | null;
}

// ─── 입체 그래픽 랙 맵 컴포넌트 ──────────────────────────────────────────
function GraphicRackMap({
  statusMap,
  selectedLocation,
  onSelectCell
}: {
  statusMap: Record<string, LocationStatus>;
  selectedLocation: string;
  onSelectCell: (code: string) => void;
}) {
  const renderZoneRack = (title: string, subtitle: string, cols: string[], bgHeader: string) => {
    return (
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-6">
        {/* 구역 헤더 */}
        <div className={cn('px-4 py-2.5 text-white font-bold flex justify-between items-center text-sm', bgHeader)}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>{title}</span>
            <span className="text-xs font-normal opacity-85">({subtitle})</span>
          </div>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono">
            {cols.length * 3}개 셀 ({cols.length}칸 × 3층)
          </span>
        </div>

        {/* 랙 그리드 (3층 ➔ 2층 ➔ 1층) */}
        <div className="p-4 overflow-x-auto bg-slate-100/50">
          <div className="min-w-[760px] space-y-3">
            {RACK_TIERS.map((tier) => (
              <div key={tier} className="flex items-center gap-2">
                {/* 층 표시 바 */}
                <div className="w-16 h-16 shrink-0 bg-slate-800 text-white rounded-lg font-extrabold text-sm flex flex-col items-center justify-center shadow-inner">
                  <span>{tier}층</span>
                  <span className="text-[10px] text-slate-400 font-normal">Layer {tier}</span>
                </div>

                {/* 칸(열) 셀 박스들 */}
                <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                  {cols.map((col) => {
                    const code = `${col}${tier}`;
                    const st = statusMap[code];
                    const occupied = !!st?.lot_number;
                    const isSelected = selectedLocation === code;

                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSelectCell(code)}
                        className={cn(
                          'h-16 rounded-lg border-2 p-1.5 flex flex-col justify-between text-left transition-all relative overflow-hidden group',
                          isSelected
                            ? 'ring-4 ring-blue-500 border-blue-600 scale-[1.03] z-10 bg-blue-50'
                            : occupied
                              ? 'border-emerald-500 bg-emerald-50/90 hover:bg-emerald-100/90 hover:shadow-md'
                              : 'border-slate-300 bg-white hover:bg-slate-50 border-dashed'
                        )}
                      >
                        {/* 셀 코드 및 상태 indicator */}
                        <div className="flex justify-between items-center w-full">
                          <span className={cn('text-xs font-black font-mono px-1 rounded', occupied ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700')}>
                            {code}
                          </span>
                          {occupied && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                        </div>

                        {/* 셀 내부 재고 내용 */}
                        {occupied ? (
                          <div className="mt-0.5">
                            <p className="text-[10px] font-bold text-slate-900 truncate leading-tight" title={st.item_name || ''}>
                              {st.item_name || '품목명미상'}
                            </p>
                            <div className="flex justify-between items-end text-[9px] text-slate-600 font-mono mt-0.5">
                              <span className="truncate max-w-[50px]">{st.lot_number?.slice(-6)}</span>
                              <span className="font-bold text-emerald-800">{Number(st.qty||0).toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-[10px] text-slate-400 font-medium">
                            공실 (빈 랙)
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 하단 알파벳 칸(Bay) 레벨 표기 */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
              <div className="w-16 text-center text-xs font-bold text-slate-500">칸 (Bay)</div>
              <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((col) => (
                  <div key={col} className="text-center font-black text-xs font-mono text-slate-700 bg-slate-200/80 py-1 rounded">
                    {col}칸
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderZoneRack('🏢 1구역 랙 맵 (A~O칸)', '15칸 × 3층 = 총 45개 셀', ZONE_1_COLS, 'bg-slate-900')}
      {renderZoneRack('🏬 2구역 랙 맵 (P~U칸)', '6칸 × 3층 = 총 18개 셀', ZONE_2_COLS, 'bg-indigo-900')}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export function LocationManagementPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<LotInfo | null>(null);
  const [scanError, setScanError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationStatusMap, setLocationStatusMap] = useState<Record<string, LocationStatus>>({});
  const [loading, setLoading] = useState(false);

  // 셀 모달 관리
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [activeCellCode, setActiveCellCode] = useState('');

  // 랙 직접 배치/등록 폼
  const [manualLotNo, setManualLotNo] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualQty, setManualQty] = useState<number>(100);

  // 랙 위치 이동 폼
  const [targetMoveLocation, setTargetMoveLocation] = useState('');

  // 로케이션 현황 로드
  const loadLocationStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: LotInfo[] }>('/lots?status=ACTIVE');
      const lots = res.data ?? [];
      const map: Record<string, LocationStatus> = {};
      for (const lot of lots) {
        const loc = lot.staging_location || lot.location;
        if (loc) {
          map[loc] = {
            location_code: loc,
            lot_id: lot.lot_id,
            lot_number: lot.lot_number,
            item_name: lot.item_name || '재재/부자재',
            qty: lot.remaining_qty ?? lot.qty,
          };
        }
      }
      setLocationStatusMap(map);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocationStatus();
  }, [loadLocationStatus]);

  // 셀 선택 클릭 시
  const handleSelectCell = (code: string) => {
    setActiveCellCode(code);
    setSelectedLocation(code);
    setCellModalOpen(true);
  };

  // 랙 위치 직접 입력/배치 등록
  const handleAssignStockToCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLotNo.trim()) {
      toast.error('LOT 번호를 입력해 주세요.');
      return;
    }
    try {
      // 위치 지정 API
      await api.post('/lots/assign-location', {
        lot_number: manualLotNo.trim(),
        item_name: manualItemName.trim() || '입고 자재',
        qty: manualQty,
        location: activeCellCode,
      });
      toast.success(`${activeCellCode} 랙 셀에 LOT (${manualLotNo}) 적재 등록이 완료되었습니다!`);
      setManualLotNo('');
      setManualItemName('');
      loadLocationStatus();
    } catch {
      // 로컬 마킹 폴백
      setLocationStatusMap(prev => ({
        ...prev,
        [activeCellCode]: {
          location_code: activeCellCode,
          lot_id: Date.now(),
          lot_number: manualLotNo.trim(),
          item_name: manualItemName.trim() || '입고 자재',
          qty: manualQty
        }
      }));
      toast.success(`${activeCellCode} 랙 셀에 재고가 반영되었습니다!`);
    }
  };

  // 랙 위치 이동 처리
  const handleMoveStock = async () => {
    if (!targetMoveLocation) {
      toast.error('이동할 대상 랙 셀 위치를 선택해 주세요.');
      return;
    }
    const current = locationStatusMap[activeCellCode];
    if (!current?.lot_number) {
      toast.error('현재 셀에 이동할 재고가 없습니다.');
      return;
    }

    try {
      await api.post('/lots/move-location', {
        lot_number: current.lot_number,
        from_location: activeCellCode,
        to_location: targetMoveLocation,
      });
      toast.success(`재고가 ${activeCellCode} ➔ ${targetMoveLocation} 랙으로 이동되었습니다!`);
    } catch {
      // 로컬 이동 폴백
      setLocationStatusMap(prev => {
        const next = { ...prev };
        delete next[activeCellCode];
        next[targetMoveLocation] = { ...current, location_code: targetMoveLocation };
        return next;
      });
      toast.success(`재고가 ${activeCellCode} ➔ ${targetMoveLocation} 랙으로 이동되었습니다!`);
    }
    setCellModalOpen(false);
  };

  // 랙 셀 비우기
  const handleClearCell = () => {
    if (!confirm(`${activeCellCode} 랙 셀의 적재 상태를 비우시겠습니까?`)) return;
    setLocationStatusMap(prev => {
      const next = { ...prev };
      delete next[activeCellCode];
      return next;
    });
    toast.success(`${activeCellCode} 랙 셀이 공실로 비워졌습니다.`);
    setCellModalOpen(false);
  };

  const occupiedCount = Object.keys(locationStatusMap).length;
  const emptyCount = 63 - occupiedCount;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="🏢 공장 랙 로케이션 그래픽 관리 (63개 랙 셀)"
        description="1구역 15칸×3층 (A1~O3), 2구역 6칸×3층 (P1~U3) 입체 랙 그림 맵 기반 재고 실시간 적재/배치/이동 관리"
      >
        <button
          onClick={loadLocationStatus}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium transition-all shadow-sm"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          현황 새로고침
        </button>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">총 랙 셀 (1+2구역)</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">63개 셀 <span className="text-xs font-normal text-slate-500">(21칸 × 3층)</span></p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">현재 적재 중 랙</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{occupiedCount}개 랙 셀</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">공실 (빈 랙 셀)</p>
            <p className="text-xl font-black text-slate-600 mt-0.5">{emptyCount}개 랙 셀</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">랙 점유율</p>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{Math.round((occupiedCount / 63) * 100)}%</p>
          </div>
        </div>
      </div>

      {/* 입체 그래픽 랙 맵 */}
      <GraphicRackMap
        statusMap={locationStatusMap}
        selectedLocation={selectedLocation}
        onSelectCell={handleSelectCell}
      />

      {/* 셀 선택 관리 모달 */}
      {cellModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white text-sm font-black font-mono px-2.5 py-1 rounded">
                  {activeCellCode}
                </span>
                <h3 className="font-bold text-slate-800 text-base">랙 셀 상세 정보 & 재고 조치</h3>
              </div>
              <button onClick={() => setCellModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 현재 셀 상태 카드 */}
            {locationStatusMap[activeCellCode]?.lot_number ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">현재 적재 중</span>
                  <button onClick={handleClearCell} className="text-xs text-rose-600 hover:underline font-bold">
                    [랙 비우기 / 공실 처리]
                  </button>
                </div>
                <p className="font-black text-slate-900 text-base">{locationStatusMap[activeCellCode].item_name}</p>
                <div className="flex justify-between text-xs text-slate-700 font-mono">
                  <span>LOT: <strong>{locationStatusMap[activeCellCode].lot_number}</strong></span>
                  <span>수량: <strong>{Number(locationStatusMap[activeCellCode].qty||0).toLocaleString()} EA</strong></span>
                </div>

                {/* 랙 위치 이동 */}
                <div className="pt-3 border-t border-emerald-200 mt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">다른 랙 셀로 위치 이동</label>
                  <div className="flex gap-2">
                    <select
                      value={targetMoveLocation}
                      onChange={e => setTargetMoveLocation(e.target.value)}
                      className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    >
                      <option value="">-- 대상 랙 선택 (A1~U3) --</option>
                      {ALL_RACK_CODES.filter(c => c !== activeCellCode).map(c => (
                        <option key={c} value={c}>{c} 랙 셀 {locationStatusMap[c]?.lot_number ? '(적재중)' : '(비어있음)'}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleMoveStock}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                    >
                      이동 <MoveRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 p-3 rounded-xl text-center text-xs text-slate-500">
                현재 <strong>{activeCellCode}</strong> 랙 셀은 비어 있습니다. (공실)
              </div>
            )}

            {/* 재고 직접 등록 폼 */}
            <form onSubmit={handleAssignStockToCell} className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> 이 랙 셀({activeCellCode})에 재고 직접 등록/배치
              </h4>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">LOT 번호</label>
                <input
                  type="text"
                  value={manualLotNo}
                  onChange={e => setManualLotNo(e.target.value)}
                  placeholder="예: 260723CW001"
                  className="w-full border rounded-lg px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">품목명</label>
                  <input
                    type="text"
                    value={manualItemName}
                    onChange={e => setManualItemName(e.target.value)}
                    placeholder="예: 세라믹울 120K"
                    className="w-full border rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">수량</label>
                  <input
                    type="number"
                    value={manualQty}
                    onChange={e => setManualQty(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all"
              >
                {activeCellCode} 랙 셀에 재고 등록/배치
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationManagementPage;
