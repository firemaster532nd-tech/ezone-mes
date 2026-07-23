import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Package, MapPin, CheckCircle, RefreshCw, X, Plus, MoveRight, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 랙 로케이션 마스터 (1구역 O1~A3 15칸×3층 / 2구역 P1~R3 3칸×3층) ─────────
export const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
export const ZONE_2_COLS = ['P','Q','R'];
export const RACK_TIERS = [3, 2, 1];

export interface PalletSlot {
  slot_no: 1 | 2; // 파레트 1번 (앞) / 파레트 2번 (뒤)
  lot_id?: number | null;
  lot_number?: string | null;
  item_name?: string | null;
  qty?: number | null;
}

export interface RackCellStatus {
  location_code: string;
  pallet1: PalletSlot;
  pallet2: PalletSlot;
}

interface AvailableLot {
  lot_id: number;
  lot_number: string;
  item_name: string;
  remaining_qty: number;
  location?: string | null;
}

// ─── 입체 2파레트 랙 그래픽 맵 컴포넌트 ──────────────────────────────────
function GraphicRackMap({
  statusMap,
  selectedLocation,
  onSelectCell
}: {
  statusMap: Record<string, RackCellStatus>;
  selectedLocation: string;
  onSelectCell: (code: string) => void;
}) {
  const renderZoneRack = (title: string, subtitle: string, cols: string[], bgHeader: string) => {
    return (
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-6">
        <div className={cn('px-4 py-2.5 text-white font-bold flex justify-between items-center text-sm', bgHeader)}>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>{title}</span>
            <span className="text-xs font-normal opacity-85">({subtitle})</span>
          </div>
          <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded font-mono">
            랙당 2파레트 (총 {cols.length * 3 * 2}개 파레트 용량)
          </span>
        </div>

        <div className="p-4 overflow-x-auto bg-slate-100/60">
          <div className="min-w-[880px] space-y-3">
            {RACK_TIERS.map((tier) => (
              <div key={tier} className="flex items-center gap-2">
                <div className="w-16 h-20 shrink-0 bg-slate-900 text-white rounded-lg font-black text-sm flex flex-col items-center justify-center shadow-inner border border-slate-700">
                  <span>{tier}층</span>
                  <span className="text-[10px] text-slate-400 font-normal">Layer {tier}</span>
                </div>

                {/* 각 랙 셀 (2파레트 내장형) */}
                <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                  {cols.map((col) => {
                    const code = `${col}${tier}`;
                    const cell = statusMap[code] || {
                      location_code: code,
                      pallet1: { slot_no: 1 },
                      pallet2: { slot_no: 2 }
                    };
                    const p1 = cell.pallet1;
                    const p2 = cell.pallet2;
                    const hasP1 = !!p1.lot_number;
                    const hasP2 = !!p2.lot_number;
                    const isSelected = selectedLocation === code;

                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onSelectCell(code)}
                        className={cn(
                          'h-20 rounded-lg border-2 p-1 flex flex-col justify-between text-left transition-all relative overflow-hidden group',
                          isSelected
                            ? 'ring-4 ring-blue-500 border-blue-600 scale-[1.03] z-10 bg-blue-50'
                            : (hasP1 || hasP2)
                              ? 'border-emerald-500 bg-white hover:bg-emerald-50/50 shadow-sm'
                              : 'border-slate-300 bg-white hover:bg-slate-50 border-dashed'
                        )}
                      >
                        {/* 랙 셀 제목 */}
                        <div className="flex justify-between items-center w-full px-0.5 border-b border-slate-200 pb-0.5">
                          <span className="text-[11px] font-black font-mono text-slate-800">
                            {code}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {hasP1 && hasP2 ? '2/2 꽉참' : hasP1 || hasP2 ? '1/2 적재' : '0/2 공실'}
                          </span>
                        </div>

                        {/* 2개 파레트 슬롯 가로(좌/우) 화면 시각화 (P2 왼쪽 / P1 오른쪽) */}
                        <div className="grid grid-cols-2 gap-0.5 mt-0.5 text-[8px] font-mono leading-none h-full">
                          {/* P2 (왼쪽 파레트) */}
                          <div className={cn('p-1 rounded flex flex-col justify-between truncate border', hasP2 ? 'bg-indigo-600 text-white font-bold border-indigo-700' : 'bg-slate-100 text-slate-400 border-dashed border-slate-300')}>
                            <div className="flex justify-between items-center text-[7px] opacity-90">
                              <span>P2(좌)</span>
                              {hasP2 && <span className="h-1 w-1 rounded-full bg-white animate-pulse" />}
                            </div>
                            <span className="truncate text-[8px] font-bold mt-0.5" title={p2.item_name || ''}>
                              {hasP2 ? (p2.item_name || p2.lot_number?.slice(-4)) : '공실'}
                            </span>
                            {hasP2 && <span className="text-[7px] text-right font-black mt-0.5">{Number(p2.qty||0).toLocaleString()}</span>}
                          </div>

                          {/* P1 (오른쪽 파레트) */}
                          <div className={cn('p-1 rounded flex flex-col justify-between truncate border', hasP1 ? 'bg-emerald-600 text-white font-bold border-emerald-700' : 'bg-slate-100 text-slate-400 border-dashed border-slate-300')}>
                            <div className="flex justify-between items-center text-[7px] opacity-90">
                              <span>P1(우)</span>
                              {hasP1 && <span className="h-1 w-1 rounded-full bg-white animate-pulse" />}
                            </div>
                            <span className="truncate text-[8px] font-bold mt-0.5" title={p1.item_name || ''}>
                              {hasP1 ? (p1.item_name || p1.lot_number?.slice(-4)) : '공실'}
                            </span>
                            {hasP1 && <span className="text-[7px] text-right font-black mt-0.5">{Number(p1.qty||0).toLocaleString()}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 하단 알파벳 칸(Bay) 표기 */}
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
      {renderZoneRack('🏢 1구역 랙 맵 (O~A칸, 2파레트/셀)', '15칸 × 3층 = 총 45개 셀 (90 파레트 용량)', ZONE_1_COLS, 'bg-slate-900')}
      {renderZoneRack('🏬 2구역 랙 맵 (P~R칸, 2파레트/셀)', '3칸 × 3층 = 총 9개 셀 (18 파레트 용량)', ZONE_2_COLS, 'bg-indigo-900')}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export function LocationManagementPage() {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [rackStatusMap, setRackStatusMap] = useState<Record<string, RackCellStatus>>({});
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([]);
  const [loading, setLoading] = useState(false);

  // 셀 모달 상태
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [activeCellCode, setActiveCellCode] = useState('');

  // 폼 선택 파레트 번호 (1 | 2)
  const [targetSlotNo, setTargetSlotNo] = useState<1 | 2>(1);

  // 현재 보유 재고 선택 상태
  const [selectedLotId, setSelectedLotId] = useState('');
  const [inputLotNo, setInputLotNo] = useState('');
  const [inputItemName, setInputItemName] = useState('');
  const [inputQty, setInputQty] = useState<number>(100);

  // 위치 이동 타겟 셀
  const [targetMoveCode, setTargetMoveCode] = useState('');

  // 로케이션 현황 및 현재 보유 재고 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 보유 중인 활성 LOT 목록 불러오기
      const res = await api.get<{ data: any[] }>('/lots?status=ACTIVE');
      const rawLots = res.data ?? [];

      const availList: AvailableLot[] = rawLots.map(l => ({
        lot_id: l.lot_id,
        lot_number: l.lot_number,
        item_name: l.item_name || '자재/부자재',
        remaining_qty: l.remaining_qty ?? l.qty ?? 0,
        location: l.staging_location || l.location
      }));
      setAvailableLots(availList);

      // 2. 랙 셀별 2파레트 매핑
      const map: Record<string, RackCellStatus> = {};
      for (const l of availList) {
        if (l.location) {
          if (!map[l.location]) {
            map[l.location] = {
              location_code: l.location,
              pallet1: { slot_no: 1 },
              pallet2: { slot_no: 2 }
            };
          }
          // 슬롯 1번이 비어있으면 1번에, 없으면 2번에 배치
          if (!map[l.location].pallet1.lot_number) {
            map[l.location].pallet1 = {
              slot_no: 1,
              lot_id: l.lot_id,
              lot_number: l.lot_number,
              item_name: l.item_name,
              qty: l.remaining_qty
            };
          } else if (!map[l.location].pallet2.lot_number) {
            map[l.location].pallet2 = {
              slot_no: 2,
              lot_id: l.lot_id,
              lot_number: l.lot_number,
              item_name: l.item_name,
              qty: l.remaining_qty
            };
          }
        }
      }
      setRackStatusMap(map);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 셀 선택 시
  const handleSelectCell = (code: string) => {
    setActiveCellCode(code);
    setSelectedLocation(code);
    setCellModalOpen(true);
    // 기본 파레트1 슬롯 선택
    setTargetSlotNo(1);
    setSelectedLotId('');
    setInputLotNo('');
    setInputItemName('');
  };

  // 현재 보유 재고 드롭다운 선택 시 폼에 자동 로드
  const handleSelectAvailableLot = (lotIdStr: string) => {
    setSelectedLotId(lotIdStr);
    const found = availableLots.find(l => String(l.lot_id) === lotIdStr || l.lot_number === lotIdStr);
    if (found) {
      setInputLotNo(found.lot_number);
      setInputItemName(found.item_name);
      setInputQty(found.remaining_qty);
      toast.info(`현재 보유 재고 LOT (${found.lot_number})가 선택되었습니다.`);
    }
  };

  // 선택 파레트 슬롯에 재고 배치 및 등록
  const handleAssignToPallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLotNo.trim()) {
      toast.error('배치할 LOT 번호를 입력하거나 현재 재고에서 선택해 주세요.');
      return;
    }

    try {
      await api.post('/lots/assign-location', {
        lot_number: inputLotNo.trim(),
        item_name: inputItemName.trim() || '입고 자재',
        qty: inputQty,
        location: activeCellCode,
        slot_no: targetSlotNo
      });
      toast.success(`${activeCellCode} 랙 파레트 ${targetSlotNo}번 슬롯에 LOT (${inputLotNo}) 적재 배치 완료!`);
    } catch {
      // 로컬 마킹
      setRackStatusMap(prev => {
        const cell = prev[activeCellCode] || {
          location_code: activeCellCode,
          pallet1: { slot_no: 1 },
          pallet2: { slot_no: 2 }
        };
        const updated = { ...cell };
        if (targetSlotNo === 1) {
          updated.pallet1 = { slot_no: 1, lot_number: inputLotNo.trim(), item_name: inputItemName.trim() || '입고 자재', qty: inputQty };
        } else {
          updated.pallet2 = { slot_no: 2, lot_number: inputLotNo.trim(), item_name: inputItemName.trim() || '입고 자재', qty: inputQty };
        }
        return { ...prev, [activeCellCode]: updated };
      });
      toast.success(`${activeCellCode} 랙 파레트 ${targetSlotNo}번에 재고 배치가 반영되었습니다!`);
    }

    setInputLotNo('');
    setInputItemName('');
  };

  // 파레트 슬롯 비우기
  const handleClearPallet = (slotNo: 1 | 2) => {
    if (!confirm(`${activeCellCode} 랙의 파레트 ${slotNo}번 적재 내역을 비우시겠습니까?`)) return;
    setRackStatusMap(prev => {
      const cell = prev[activeCellCode];
      if (!cell) return prev;
      const updated = { ...cell };
      if (slotNo === 1) updated.pallet1 = { slot_no: 1 };
      else updated.pallet2 = { slot_no: 2 };
      return { ...prev, [activeCellCode]: updated };
    });
    toast.success(`${activeCellCode} 랙 파레트 ${slotNo}번 슬롯이 비워졌습니다.`);
  };

  // 현재 랙 셀 상태
  const activeCell = rackStatusMap[activeCellCode] || {
    location_code: activeCellCode,
    pallet1: { slot_no: 1 },
    pallet2: { slot_no: 2 }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="🏢 공장 랙 로케이션 2파레트 관리 (54개 랙 / 108 파레트)"
        description="랙당 2개 파레트(P1/P2) 동시 적재 시각화, 보유 재고 자동 불러오기 및 랙별 입출고/배치 관리"
      >
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium shadow-sm"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          현재고 & 랙 현황 불러오기
        </button>
      </PageHeader>

      {/* 요약 카드리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">총 랙 셀 (54개 랙)</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">108 파레트 용량</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">현재 보관 중인 파레트</p>
            <p className="text-lg font-black text-emerald-800 mt-0.5">
              {Object.values(rackStatusMap).reduce((acc, c) => acc + (c.pallet1.lot_number ? 1 : 0) + (c.pallet2.lot_number ? 1 : 0), 0)}개 파레트
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">시스템 보유 LOT 목록</p>
            <p className="text-lg font-black text-indigo-900 mt-0.5">{availableLots.length}개 보유 LOT</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">빈 파레트 용량</p>
            <p className="text-lg font-black text-slate-600 mt-0.5">
              {108 - Object.values(rackStatusMap).reduce((acc, c) => acc + (c.pallet1.lot_number ? 1 : 0) + (c.pallet2.lot_number ? 1 : 0), 0)}개 여유
            </p>
          </div>
        </div>
      </div>

      {/* 2파레트 랙 그래픽 맵 (1구역 O~A / 2구역 P~R) */}
      <GraphicRackMap
        statusMap={rackStatusMap}
        selectedLocation={selectedLocation}
        onSelectCell={handleSelectCell}
      />

      {/* 셀 선택 모달 */}
      {cellModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white text-sm font-black font-mono px-2.5 py-1 rounded">
                  {activeCellCode} 랙 셀
                </span>
                <h3 className="font-bold text-slate-800 text-base">2파레트 적재 현황 및 재고 배치</h3>
              </div>
              <button onClick={() => setCellModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 현재 랙 셀 2개 파레트 상태 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 파레트 1번 (왼쪽) */}
              <div className={cn('p-3 rounded-xl border space-y-1.5', activeCell.pallet1.lot_number ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200')}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black bg-emerald-600 text-white px-2 py-0.5 rounded font-mono">P1 (왼쪽 파레트)</span>
                  {activeCell.pallet1.lot_number && (
                    <button onClick={() => handleClearPallet(1)} className="text-[10px] text-rose-600 font-bold hover:underline">
                      비우기 ✕
                    </button>
                  )}
                </div>
                {activeCell.pallet1.lot_number ? (
                  <div>
                    <p className="font-black text-slate-900 text-xs truncate">{activeCell.pallet1.item_name}</p>
                    <p className="text-[10px] text-slate-600 font-mono">LOT: {activeCell.pallet1.lot_number}</p>
                    <p className="text-[10px] text-emerald-800 font-black font-mono mt-0.5">수량: {Number(activeCell.pallet1.qty||0).toLocaleString()} EA</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 py-3 text-center">P1 (왼쪽) 빈 파레트</p>
                )}
              </div>

              {/* 파레트 2번 (오른쪽) */}
              <div className={cn('p-3 rounded-xl border space-y-1.5', activeCell.pallet2.lot_number ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200')}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded font-mono">P2 (오른쪽 파레트)</span>
                  {activeCell.pallet2.lot_number && (
                    <button onClick={() => handleClearPallet(2)} className="text-[10px] text-rose-600 font-bold hover:underline">
                      비우기 ✕
                    </button>
                  )}
                </div>
                {activeCell.pallet2.lot_number ? (
                  <div>
                    <p className="font-black text-slate-900 text-xs truncate">{activeCell.pallet2.item_name}</p>
                    <p className="text-[10px] text-slate-600 font-mono">LOT: {activeCell.pallet2.lot_number}</p>
                    <p className="text-[10px] text-indigo-900 font-black font-mono mt-0.5">수량: {Number(activeCell.pallet2.qty||0).toLocaleString()} EA</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 py-3 text-center">P2 (오른쪽) 빈 파레트</p>
                )}
              </div>
            </div>

            {/* 재고 불러오기 및 슬롯 선택 폼 */}
            <form onSubmit={handleAssignToPallet} className="bg-slate-100 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-blue-600" /> {activeCellCode} 랙 셀에 현재 보유 재고 불러와서 배치
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">적재할 파레트 위치 선택</label>
                  <select
                    value={targetSlotNo}
                    onChange={e => setTargetSlotNo(Number(e.target.value) as 1 | 2)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold bg-white"
                  >
                    <option value={1}>P1 슬롯 (왼쪽 파레트)</option>
                    <option value={2}>P2 슬롯 (오른쪽 파레트)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-700 mb-1">📦 현재 보유 재고 선택 / 불러오기</label>
                  <select
                    value={selectedLotId}
                    onChange={e => handleSelectAvailableLot(e.target.value)}
                    className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-mono"
                  >
                    <option value="">-- 보유 LOT 목록에서 불러오기 --</option>
                    {availableLots.map(l => (
                      <option key={l.lot_id} value={l.lot_id}>
                        {l.lot_number} ({l.item_name}) - 현재고: {l.remaining_qty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">LOT 번호</label>
                  <input
                    type="text"
                    value={inputLotNo}
                    onChange={e => setInputLotNo(e.target.value)}
                    placeholder="LOT 입력"
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">품목명</label>
                  <input
                    type="text"
                    value={inputItemName}
                    onChange={e => setInputItemName(e.target.value)}
                    placeholder="품목명 입력"
                    className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">수량</label>
                  <input
                    type="number"
                    value={inputQty}
                    onChange={e => setInputQty(Number(e.target.value))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold bg-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow"
              >
                {activeCellCode} 랙 [P{targetSlotNo} 파레트] 슬롯에 적재 배치
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationManagementPage;
