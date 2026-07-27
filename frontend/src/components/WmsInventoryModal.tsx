import { useState } from 'react';
import { X, Package, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { LocationPicker } from './LocationPicker';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
export interface WmsInventoryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type InputMethod = 'pallet' | 'single';
type Category = 'non_certified' | 'sub_material' | 'semi_finished' | 'finished' | 'return';
type StockStatus = 'normal' | 'ready_to_ship';
type UnitType = 'EA' | '롤' | 'kg' | 'm' | '본';

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'non_certified',  label: '비인정' },
  { value: 'sub_material',   label: '부자재' },
  { value: 'semi_finished',  label: '반제품' },
  { value: 'finished',       label: '완제품' },
  { value: 'return',         label: '반품' },
];

const UNIT_OPTIONS: UnitType[] = ['EA', '롤', 'kg', 'm', '본'];

// ─── 모달 컴포넌트 ────────────────────────────────────────────────────────────
export function WmsInventoryModal({ onClose, onSuccess }: WmsInventoryModalProps) {
  const [inputMethod, setInputMethod] = useState<InputMethod>('pallet');
  const [category, setCategory]       = useState<Category>('finished');
  const [lotNumber, setLotNumber]     = useState('');
  const [itemName, setItemName]       = useState('');
  const [spec, setSpec]               = useState('');
  const [unit, setUnit]               = useState<UnitType>('EA');
  const [qty, setQty]                 = useState<number>(0);
  const [palletCount, setPalletCount] = useState<number>(1);
  const [qtyPerPallet, setQtyPerPallet] = useState<number>(0);
  const [locationCode, setLocationCode] = useState('A1-P1');
  const [locationId, setLocationId]   = useState<number | undefined>(undefined);
  const [stockStatus, setStockStatus] = useState<StockStatus>('normal');
  const [siteName, setSiteName]       = useState('');
  const [orderDate, setOrderDate]     = useState('');
  const [memo, setMemo]               = useState('');
  const [saving, setSaving]           = useState(false);

  // 파레트 단위일 때 총 수량 자동계산
  const totalQty = inputMethod === 'pallet'
    ? palletCount * qtyPerPallet
    : qty;

  // 반품이면 LOT 번호 앞에 'R' 접두어 표시용
  const displayLotNumber = category === 'return' && lotNumber && !lotNumber.startsWith('R')
    ? `R${lotNumber}`
    : lotNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim()) { toast.error('LOT 번호를 입력하세요.'); return; }
    if (!itemName.trim())  { toast.error('품목명을 입력하세요.'); return; }
    if (!locationCode)     { toast.error('위치를 선택하세요.'); return; }
    if (totalQty <= 0)     { toast.error('수량을 올바르게 입력하세요.'); return; }

    setSaving(true);
    try {
      await api.post('/wms/inventory', {
        input_method:    inputMethod,
        category,
        lot_number:      displayLotNumber,
        item_name:       itemName.trim(),
        spec:            spec.trim() || null,
        unit,
        qty:             totalQty,
        pallet_count:    inputMethod === 'pallet' ? palletCount : null,
        qty_per_pallet:  inputMethod === 'pallet' ? qtyPerPallet : null,
        location_code:   locationCode,
        location_id:     locationId ?? null,
        stock_status:    stockStatus,
        site_name:       stockStatus === 'ready_to_ship' ? siteName.trim() || null : null,
        order_date:      stockStatus === 'ready_to_ship' ? orderDate || null : null,
        memo:            memo.trim() || null,
      });
      toast.success(`재고 등록 완료 — LOT: ${displayLotNumber}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : '등록 실패';
      toast.error(`등록 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg">
              <Plus className="h-4 w-4" />
            </span>
            <h2 className="font-black text-slate-800 text-base">WMS 재고 등록</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* 입고 방식 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">입고 방식</label>
            <div className="flex gap-2">
              {(['pallet', 'single'] as InputMethod[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInputMethod(m)}
                  className={[
                    'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                    inputMethod === m
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {m === 'pallet' ? '📦 파레트 단위' : '📋 개별'}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* LOT 번호 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              LOT 번호{category === 'return' && <span className="ml-1 text-amber-600 font-normal">(반품: R 접두어 자동 추가)</span>}
            </label>
            <div className="relative">
              {category === 'return' && lotNumber && !lotNumber.startsWith('R') && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-amber-600 font-mono">R</span>
              )}
              <input
                type="text"
                value={lotNumber}
                onChange={e => setLotNumber(e.target.value)}
                placeholder="LOT 번호 입력"
                className={[
                  'w-full border rounded-lg py-2 text-sm font-mono bg-white',
                  (category === 'return' && lotNumber && !lotNumber.startsWith('R')) ? 'pl-7 pr-3' : 'px-3',
                ].join(' ')}
                required
              />
            </div>
            {category === 'return' && lotNumber && (
              <p className="text-[10px] text-amber-600 mt-0.5 font-mono">최종 LOT: {displayLotNumber}</p>
            )}
          </div>

          {/* 품목명 / 규격 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">품목명</label>
              <input
                type="text"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="품목명"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">규격</label>
              <input
                type="text"
                value={spec}
                onChange={e => setSpec(e.target.value)}
                placeholder="규격 (선택)"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          {/* 단위 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">단위</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as UnitType)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* 파레트 단위 수량 */}
          {inputMethod === 'pallet' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-blue-800">📦 파레트 단위 수량 입력</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">파레트 수</label>
                  <input
                    type="number"
                    min={1}
                    value={palletCount}
                    onChange={e => setPalletCount(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">파레트당 수량</label>
                  <input
                    type="number"
                    min={0}
                    value={qtyPerPallet}
                    onChange={e => setQtyPerPallet(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold bg-white"
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">총 수량: </span>
                <span className="text-sm font-black text-blue-800 font-mono">
                  {totalQty.toLocaleString()} {unit}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">수량</label>
              <input
                type="number"
                min={0}
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold bg-white"
              />
            </div>
          )}

          {/* 위치 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">위치</label>
            <LocationPicker
              value={locationCode}
              onChange={(code, id) => {
                setLocationCode(code);
                setLocationId(id);
              }}
            />
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">상태</label>
            <div className="flex gap-2">
              {(['normal', 'ready_to_ship'] as StockStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStockStatus(s)}
                  className={[
                    'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                    stockStatus === s
                      ? s === 'ready_to_ship'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {s === 'normal' ? '✅ 일반재고' : '🚚 출하대기'}
                </button>
              ))}
            </div>

            {/* 출하대기 추가 입력 */}
            {stockStatus === 'ready_to_ship' && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">현장명</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    placeholder="출하 현장명"
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">발주일자</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={e => setOrderDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">메모</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={2}
              placeholder="메모 (선택)"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white resize-none"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow transition-all disabled:opacity-60"
            >
              {saving ? '등록 중…' : (
                <span className="flex items-center justify-center gap-1.5">
                  <Package className="h-4 w-4" /> 재고 등록
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WmsInventoryModal;
