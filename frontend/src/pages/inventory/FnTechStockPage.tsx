import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface FinishedItem {
  id: number;
  diameter_mm: number;
  spec: string;
  qty: number;
}

interface MaterialItem {
  id: number;
  item_name: string;
  spec: string;
  qty: number;
  unit: string;
}

interface TxRecord {
  tx_id: number;
  tx_date: string;
  tx_type: 'IN' | 'OUT';
  item_type: 'FINISHED' | 'MATERIAL';
  item_name: string;
  spec: string;
  qty: number;
  memo: string | null;
  created_by_name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Data (엑셀에서 추출한 현재 재고)
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_FINISHED: FinishedItem[] = [
  { id: 1,  diameter_mm: 100, spec: '몸통', qty: 900 },
  { id: 2,  diameter_mm: 100, spec: '150H', qty: 0 },
  { id: 3,  diameter_mm: 100, spec: '170H', qty: 0 },
  { id: 4,  diameter_mm: 100, spec: '180H', qty: 0 },
  { id: 5,  diameter_mm: 100, spec: '190H', qty: 0 },
  { id: 6,  diameter_mm: 100, spec: '200H', qty: 0 },
  { id: 7,  diameter_mm: 100, spec: '210H', qty: 0 },
  { id: 8,  diameter_mm: 100, spec: '240H', qty: 0 },
  { id: 9,  diameter_mm: 100, spec: '250H', qty: 0 },
  { id: 10, diameter_mm: 100, spec: '260H', qty: 0 },
  { id: 11, diameter_mm: 75,  spec: '몸통', qty: 0 },
  { id: 12, diameter_mm: 50,  spec: '몸통', qty: 1260 },
];

const FALLBACK_MATERIAL: MaterialItem[] = [
  { id: 1, item_name: '보호철판',      spec: '100파이', qty: 5759,  unit: 'ea' },
  { id: 2, item_name: '보호철판',      spec: '75파이',  qty: 1030,  unit: 'ea' },
  { id: 3, item_name: '보호철판',      spec: '50파이',  qty: 2876,  unit: 'ea' },
  { id: 4, item_name: '볼트,너트,와샤', spec: '-',      qty: 35700, unit: 'ea' },
  { id: 5, item_name: '시트(재단)',     spec: '100파이', qty: 1063,  unit: 'ea' },
  { id: 6, item_name: '시트(재단)',     spec: '75파이',  qty: 13,    unit: 'ea' },
  { id: 7, item_name: '시트(재단)',     spec: '50파이',  qty: -533,  unit: 'ea' },
  { id: 8, item_name: '시트(압출)',     spec: '-',      qty: 31,    unit: 'ea' },
];

type TabType = 'finished' | 'material' | 'history';

// ─────────────────────────────────────────────────────────────────────────────
// Qty color helper
// ─────────────────────────────────────────────────────────────────────────────
function qtyColor(qty: number) {
  if (qty > 0) return 'text-green-700 font-bold';
  if (qty < 0) return 'text-red-600 font-bold';
  return 'text-gray-400';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function FnTechStockPage() {
  const [tab, setTab] = useState<TabType>('finished');
  const [finished, setFinished] = useState<FinishedItem[]>(FALLBACK_FINISHED);
  const [material, setMaterial] = useState<MaterialItem[]>(FALLBACK_MATERIAL);
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showMaterialReceiveModal, setShowMaterialReceiveModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState<MaterialItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'finished') {
        const r = await api.get<{ data: FinishedItem[] }>('/fn-stock/finished');
        setFinished(r.data ?? FALLBACK_FINISHED);
      } else if (tab === 'material') {
        const r = await api.get<{ data: MaterialItem[] }>('/fn-stock/material');
        setMaterial(r.data ?? FALLBACK_MATERIAL);
      } else {
        const r = await api.get<{ data: TxRecord[] }>('/fn-stock/transactions');
        setTransactions(r.data ?? []);
      }
    } catch {
      // API 실패 시 fallback 데이터 유지
      if (tab === 'finished') setFinished(FALLBACK_FINISHED);
      if (tab === 'material') setMaterial(FALLBACK_MATERIAL);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs: { key: TabType; label: string; icon: string; color: string; activeColor: string }[] = [
    { key: 'finished', label: '완제품 재고', icon: '🏭', color: 'text-blue-600',  activeColor: 'bg-blue-600 text-white shadow-sm' },
    { key: 'material', label: '부자재 재고', icon: '🔩', color: 'text-green-600', activeColor: 'bg-green-600 text-white shadow-sm' },
    { key: 'history',  label: '입출고 이력', icon: '📋', color: 'text-gray-600',  activeColor: 'bg-gray-600 text-white shadow-sm' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-5 flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">에프엔테크 재고현황</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-400/30 text-blue-200 text-xs font-semibold border border-blue-400/40">
              EZ-FN-P100
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-400/30 text-slate-200 text-xs font-semibold border border-slate-400/40">
              FS-NP24-1112-2
            </span>
          </div>
          <p className="text-blue-200 text-sm">방화소켓·발포소켓 완제품 및 부자재 재고 관리</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white hover:bg-white/20 transition-colors"
        >
          🔄 새로고침
        </button>
      </div>

      {/* ── Tab Bar + Action Buttons ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? t.activeColor : `text-gray-500 hover:${t.color}`
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'finished' && (
            <>
              <button
                onClick={() => setShowReceiveModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
              >
                + 완제품 입고
              </button>
              <button
                onClick={() => setShowShipModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50 shadow-sm transition-colors"
              >
                완제품 출고
              </button>
            </>
          )}
          {tab === 'material' && (
            <button
              onClick={() => setShowMaterialReceiveModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 shadow-sm transition-colors"
            >
              + 부자재 입고
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm py-16 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
          <span className="text-sm text-gray-400">로드 중...</span>
        </div>
      ) : tab === 'finished' ? (
        <FinishedStockView items={finished} />
      ) : tab === 'material' ? (
        <MaterialStockView items={material} onAdjust={setAdjustItem} />
      ) : (
        <HistoryView records={transactions} />
      )}

      {/* ── Modals ── */}
      {showReceiveModal && (
        <StockModal
          title="완제품 입고"
          txType="IN"
          itemType="FINISHED"
          finishedItems={finished}
          materialItems={[]}
          onClose={() => setShowReceiveModal(false)}
          onDone={() => { setShowReceiveModal(false); loadData(); }}
        />
      )}
      {showShipModal && (
        <StockModal
          title="완제품 출고"
          txType="OUT"
          itemType="FINISHED"
          finishedItems={finished}
          materialItems={[]}
          onClose={() => setShowShipModal(false)}
          onDone={() => { setShowShipModal(false); loadData(); }}
        />
      )}
      {showMaterialReceiveModal && (
        <StockModal
          title="부자재 입고"
          txType="IN"
          itemType="MATERIAL"
          finishedItems={[]}
          materialItems={material}
          onClose={() => setShowMaterialReceiveModal(false)}
          onDone={() => { setShowMaterialReceiveModal(false); loadData(); }}
        />
      )}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onDone={() => { setAdjustItem(null); loadData(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 완제품 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function FinishedStockView({ items }: { items: FinishedItem[] }) {
  const d100 = items.filter(i => i.diameter_mm === 100);
  const d75  = items.filter(i => i.diameter_mm === 75);
  const d50  = items.filter(i => i.diameter_mm === 50);
  const totalQty = items.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '100파이 합계', qty: d100.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0), color: 'from-blue-500 to-blue-700' },
          { label: '75파이 합계',  qty: d75.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0),  color: 'from-indigo-500 to-indigo-700' },
          { label: '50파이 합계',  qty: d50.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0),  color: 'from-violet-500 to-violet-700' },
        ].map(({ label, qty, color }) => (
          <div key={label} className={`bg-gradient-to-br ${color} rounded-xl px-5 py-4 text-white shadow-sm`}>
            <p className="text-sm font-medium text-white/80">{label}</p>
            <p className="text-3xl font-bold mt-1">{qty.toLocaleString()}<span className="text-lg font-normal ml-1">ea</span></p>
          </div>
        ))}
      </div>

      {/* 100파이 — 큰 카드 */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100/60 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">100</span>
            <h2 className="font-bold text-blue-900 text-base">100파이 방화소켓</h2>
          </div>
          <span className="text-sm font-semibold text-blue-700">
            합계 {d100.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0).toLocaleString()} ea
          </span>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            {d100.map(item => (
              <div
                key={item.id}
                className={`flex flex-col items-center justify-center rounded-xl border px-4 py-3 min-w-[88px] transition-all ${
                  item.qty > 0
                    ? 'bg-green-50 border-green-200 hover:border-green-400'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span className="text-xs font-semibold text-gray-500 mb-1">{item.spec}</span>
                <span className={`text-lg font-bold ${qtyColor(item.qty)}`}>{item.qty.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">ea</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 75파이 + 50파이 — 나란히 */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '75파이', badge: 75, data: d75, badgeColor: 'bg-indigo-600' },
          { label: '50파이', badge: 50, data: d50, badgeColor: 'bg-violet-600' },
        ].map(({ label, badge, data, badgeColor }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50/80 border-b">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg ${badgeColor} flex items-center justify-center text-white font-bold text-xs`}>{badge}</span>
                <h3 className="font-bold text-gray-800">{label} 방화소켓</h3>
              </div>
              <span className="text-sm font-semibold text-gray-600">
                합계 {data.reduce((s, i) => s + (i.qty > 0 ? i.qty : 0), 0).toLocaleString()} ea
              </span>
            </div>
            <div className="p-5">
              {data.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {data.map(item => (
                    <div
                      key={item.id}
                      className={`flex flex-col items-center justify-center rounded-xl border px-5 py-3 min-w-[90px] ${
                        item.qty > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-xs font-semibold text-gray-500 mb-1">{item.spec}</span>
                      <span className={`text-xl font-bold ${qtyColor(item.qty)}`}>{item.qty.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">ea</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 총 재고 */}
      <div className="flex justify-end">
        <span className="text-sm text-gray-400">
          전체 유효 재고 합계:{' '}
          <span className="font-bold text-blue-700">{totalQty.toLocaleString()} ea</span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 부자재 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function MaterialStockView({
  items,
  onAdjust,
}: {
  items: MaterialItem[];
  onAdjust: (item: MaterialItem) => void;
}) {
  const grouped = new Map<string, MaterialItem[]>();
  for (const item of items) {
    const key = item.item_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const ICON_MAP: Record<string, string> = {
    '보호철판': '🛡',
    '볼트,너트,와샤': '🔩',
    '시트(재단)': '📄',
    '시트(압출)': '📦',
  };

  const COLOR_MAP: Record<string, string> = {
    '보호철판': 'border-green-200 bg-green-50/50',
    '볼트,너트,와샤': 'border-amber-200 bg-amber-50/50',
    '시트(재단)': 'border-teal-200 bg-teal-50/50',
    '시트(압출)': 'border-violet-200 bg-violet-50/50',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...grouped.entries()].map(([name, rows]) => {
        const icon = ICON_MAP[name] ?? '📦';
        const cardColor = COLOR_MAP[name] ?? 'border-gray-200 bg-gray-50/50';
        const totalQty = rows.reduce((s, r) => s + r.qty, 0);
        return (
          <div key={name} className={`bg-white rounded-2xl border ${cardColor} shadow-sm overflow-hidden`}>
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <h3 className="font-bold text-gray-800">{name}</h3>
              <span className="ml-auto text-xs font-semibold text-gray-400">
                합계 <span className={qtyColor(totalQty)}>{totalQty.toLocaleString()}</span> ea
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {rows.map(item => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/80 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.spec === '-' ? item.item_name : item.spec}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${qtyColor(item.qty)}`}>
                      {item.qty.toLocaleString()}
                    </p>
                    {item.qty < 0 && (
                      <p className="text-[10px] text-red-500 font-semibold">⚠ 재고부족</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50/60 border-t flex justify-end">
              <button
                onClick={() => onAdjust(rows[0])}
                className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors"
              >
                수량 조정
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 입출고 이력 뷰
// ─────────────────────────────────────────────────────────────────────────────
function HistoryView({ records }: { records: TxRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm py-16 flex flex-col items-center gap-3 text-gray-400">
        <span className="text-4xl">📋</span>
        <p className="text-sm">입출고 이력이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50/80">
        <h2 className="font-bold text-gray-800">입출고 이력</h2>
        <p className="text-xs text-gray-400 mt-0.5">최근 입출고 기록</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-400">
              <th className="px-4 py-3 text-left">날짜</th>
              <th className="px-4 py-3 text-center">구분</th>
              <th className="px-4 py-3 text-left">품목</th>
              <th className="px-4 py-3 text-left">규격</th>
              <th className="px-4 py-3 text-right text-blue-600 font-semibold">수량</th>
              <th className="px-4 py-3 text-left">메모</th>
              <th className="px-4 py-3 text-left">작업자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.map(r => (
              <tr key={r.tx_id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(r.tx_date).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                    r.tx_type === 'IN'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {r.tx_type === 'IN' ? '입고' : '출고'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.item_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.spec}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                  {r.tx_type === 'OUT' ? '-' : '+'}{r.qty.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.memo ?? '-'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.created_by_name ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 입고/출고 모달
// ─────────────────────────────────────────────────────────────────────────────
interface StockModalProps {
  title: string;
  txType: 'IN' | 'OUT';
  itemType: 'FINISHED' | 'MATERIAL';
  finishedItems: FinishedItem[];
  materialItems: MaterialItem[];
  onClose: () => void;
  onDone: () => void;
}

function StockModal({ title, txType, itemType, finishedItems, materialItems, onClose, onDone }: StockModalProps) {
  const isFinished = itemType === 'FINISHED';
  const endpoint = txType === 'IN' ? '/fn-stock/receive' : '/fn-stock/ship';

  // Spec dropdown options
  const specOptions: string[] = isFinished
    ? [...new Set(finishedItems.map(i => `${i.diameter_mm}파이 / ${i.spec}`))]
    : [...new Set(materialItems.map(i => `${i.item_name} / ${i.spec}`))];

  const [selectedSpec, setSelectedSpec] = useState(specOptions[0] ?? '');
  const [qty, setQty] = useState(1);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parseSpec = () => {
    if (isFinished) {
      const [diamStr, spec] = selectedSpec.split(' / ');
      const diameter_mm = parseInt(diamStr);
      return { item_type: 'FINISHED', spec, diameter_mm };
    } else {
      const [item_name, spec] = selectedSpec.split(' / ');
      return { item_type: 'MATERIAL', item_name, spec };
    }
  };

  const handleSubmit = async () => {
    if (!selectedSpec) { toast.error('품목을 선택하세요'); return; }
    if (qty <= 0) { toast.error('수량을 올바르게 입력하세요'); return; }
    setSubmitting(true);
    try {
      await api.post(endpoint, { ...parseSpec(), qty, memo: memo || undefined });
      toast.success(`${title} 처리 완료!`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? '처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const headerColor = txType === 'IN'
    ? (isFinished ? 'from-blue-600 to-blue-700' : 'from-green-600 to-green-700')
    : 'from-orange-500 to-orange-700';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={`px-6 py-4 bg-gradient-to-r ${headerColor} rounded-t-2xl flex items-center justify-between`}>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* 품목 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              품목 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSpec}
              onChange={e => setSelectedSpec(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {specOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              수량 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">ea</span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="비고, 거래처, 납품지 등"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 bg-gradient-to-r ${headerColor}`}
          >
            {submitting ? '처리 중...' : `${txType === 'IN' ? '입고 등록' : '출고 등록'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 수량 조정 모달 (부자재)
// ─────────────────────────────────────────────────────────────────────────────
function AdjustModal({ item, onClose, onDone }: { item: MaterialItem; onClose: () => void; onDone: () => void }) {
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState(1);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (qty <= 0) { toast.error('수량을 올바르게 입력하세요'); return; }
    setSubmitting(true);
    try {
      const endpoint = adjType === 'IN' ? '/fn-stock/receive' : '/fn-stock/ship';
      await api.post(endpoint, {
        item_type: 'MATERIAL',
        item_name: item.item_name,
        spec: item.spec,
        qty,
        memo: memo || undefined,
      });
      toast.success('수량 조정 완료!');
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? '처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-teal-700 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">수량 조정</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-gray-800">{item.item_name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{item.spec} · 현재 재고: <span className={`font-bold ${qtyColor(item.qty)}`}>{item.qty} ea</span></p>
          </div>

          {/* 입고/출고 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">조정 유형</label>
            <div className="flex gap-2">
              {(['IN', 'OUT'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAdjType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    adjType === t
                      ? t === 'IN' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t === 'IN' ? '📥 입고' : '📤 출고'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">수량</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <span className="text-sm text-gray-500">ea</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="조정 사유 등"
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 ${
              adjType === 'IN' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {submitting ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
