import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Package, TrendingDown, Layers, Plus, ArrowUp, List, LayoutGrid, ChevronDown, ChevronRight, AlertTriangle, History, Pencil, Trash2, BookOpen, X, Printer, Tag } from 'lucide-react';

interface DashboardCard {
  category: string;
  total_items: number;
  total_balance: number;
  below_safety_count: number;
  active_lot_count: number;
}

interface InventorySummary {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: string;
  unit: string;
  total_in: number;
  total_out: number;
  balance: number;
  safety_stock: number;
  active_lots: number;
  is_below_safety: boolean;
}

interface LotInventory {
  lot_id: number;
  lot_number: string;
  lot_type: string;
  supplier_lot: string | null;
  inspection_lot: string | null;
  inspection_result: string | null;
  lot_status: string;
  lot_qty: number;
  remaining_qty: number | null;
  lot_date: string;
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: string;
  unit: string;
  total_in: number;
  total_out: number;
  balance: number;
}

const categoryLabels: Record<string, string> = {
  RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품',
};

const categoryColors: Record<string, string> = {
  RM: 'border-l-amber-500 bg-amber-50',
  SM: 'border-l-blue-500 bg-blue-50',
  SA: 'border-l-purple-500 bg-purple-50',
  FP: 'border-l-green-500 bg-green-50',
};

const categoryTabs = [
  { key: '', label: '전체' },
  { key: 'RM', label: '원재료' },
  { key: 'SM', label: '부자재' },
  { key: 'SA', label: '반제품' },
  { key: 'FP', label: '완제품' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '활성', color: 'bg-green-100 text-green-700' },
  CONSUMED: { label: '소진', color: 'bg-gray-100 text-gray-500' },
  SHIPPED: { label: '출하', color: 'bg-blue-100 text-blue-700' },
  SCRAPPED: { label: '폐기', color: 'bg-red-100 text-red-600' },
};

const inspResultLabels: Record<string, { label: string; color: string }> = {
  PASS: { label: '합격', color: 'text-green-600' },
  FAIL: { label: '불합격', color: 'text-red-600' },
  PENDING: { label: '검사중', color: 'text-yellow-600' },
};

interface TxnHistory {
  inv_id: number;
  item_id: number;
  lot_id: number | null;
  txn_type: string;
  txn_date: string;
  qty: number;
  purpose: string | null;
  ref_wo_id: number | null;
  ref_lot_number: string | null;
  worker: string | null;
  confirmed_by: string | null;
  source_lot: string | null;
  linked_lot: string | null;
  issuer_name: string | null;
  verifier_name: string | null;
  created_at: string;
  item_name: string;
  item_code: string;
  item_category: string;
  unit: string;
}

interface LedgerEntry {
  inv_id: number;
  item_id: number;
  lot_id: number | null;
  txn_type: string;
  txn_date: string;
  qty: number;
  running_balance: number;
  purpose: string | null;
  ref_lot_number: string | null;
  worker: string | null;
  confirmed_by: string | null;
  source_lot: string | null;
  linked_lot: string | null;
  issuer_name: string | null;
  verifier_name: string | null;
  item_name: string;
  item_code: string;
  item_category: string;
  unit: string;
  lot_number: string | null;
  supplier_lot: string | null;
  inspection_lot: string | null;
}

export function InventoryDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardCard[]>([]);
  const [summary, setSummary] = useState<InventorySummary[]>([]);
  const [lotInventory, setLotInventory] = useState<LotInventory[]>([]);
  const [txnHistory, setTxnHistory] = useState<TxnHistory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'item' | 'lot' | 'history'>('lot');
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [itemLots, setItemLots] = useState<LotInventory[]>([]);
  const [ledgerItemId, setLedgerItemId] = useState<number | null>(null);
  const [ledgerItemName, setLedgerItemName] = useState('');
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchDashboard = () => {
    api.get<{ data: DashboardCard[] }>('/inventory/dashboard').then((r) => setDashboard(r.data));
  };

  useEffect(() => { fetchDashboard(); }, []);

  const fetchSummary = () => {
    const params = selectedCategory ? `?category=${selectedCategory}` : '';
    api.get<{ data: InventorySummary[] }>(`/inventory/summary${params}`).then((r) => setSummary(r.data));
  };

  const fetchLotInventory = () => {
    const params = selectedCategory ? `?category=${selectedCategory}` : '';
    api.get<{ data: LotInventory[] }>(`/inventory/lot-inventory${params}`).then((r) => setLotInventory(r.data));
  };

  const fetchTxnHistory = () => {
    const params = new URLSearchParams();
    if (selectedCategory) {
      // filter by items in category
    }
    api.get<{ data: TxnHistory[] }>(`/inventory/transactions`).then((r) => setTxnHistory(r.data));
  };

  useEffect(() => {
    fetchSummary();
    fetchLotInventory();
    fetchTxnHistory();
  }, [selectedCategory]);

  const handleExpandItem = (itemId: number) => {
    if (expandedItem === itemId) {
      setExpandedItem(null);
      setItemLots([]);
      return;
    }
    setExpandedItem(itemId);
    api.get<{ data: LotInventory[] }>(`/inventory/lot-inventory?item_id=${itemId}`).then((r) => setItemLots(r.data));
  };

  const openLedger = (itemId: number, itemName: string) => {
    setLedgerItemId(itemId);
    setLedgerItemName(itemName);
    setLedgerLoading(true);
    api.get<{ data: LedgerEntry[] }>(`/inventory/ledger/${itemId}`).then((r) => {
      setLedgerData(r.data);
      setLedgerLoading(false);
    }).catch(() => setLedgerLoading(false));
  };

  const closeLedger = () => {
    setLedgerItemId(null);
    setLedgerData([]);
  };

  const refreshAll = () => {
    fetchDashboard();
    fetchSummary();
    fetchLotInventory();
    fetchTxnHistory();
  };

  const handleDeleteTxn = async (invId: number) => {
    if (!confirm('이 수불 기록을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/inventory/transactions/${invId}`);
      refreshAll();
    } catch { alert('삭제 실패'); }
  };

  // LOT 라벨 출력 함수
  const openLotLabel = (lot: LotInventory) => {
    const params = new URLSearchParams({
      lotNumber: lot.lot_number || '',
      itemName: lot.item_name || '',
      itemCode: lot.item_code || '',
      spec: '',
      qty: '1',
      unit: lot.unit || 'EA',
      lotDate: lot.lot_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      category: lot.item_category || '',
      lotType: lot.lot_type === 'ASSEMBLY' ? 'ASM' : lot.lot_type === 'STRUCT' ? 'STR' : 'IN',
    });
    window.open(
      `/lot-label.html?${params.toString()}`,
      '_blank',
      'width=920,height=760,menubar=no,toolbar=no,scrollbars=yes'
    );
  };

  return (
    <div>
      <PageHeader title="재고 현황" description="원재료/부자재/반제품/완제품 재고 대시보드">
        <button
          onClick={() => navigate('/inventory/label-reprint')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Tag size={16} /> LOT 라벨 재출력
        </button>
        <button
          onClick={() => setShowTxnModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 출고/조정
        </button>
      </PageHeader>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {['RM', 'SM', 'SA', 'FP'].map((cat) => {
          const card = dashboard.find((d) => d.category === cat);
          return (
            <div key={cat}
              className={cn('rounded-lg border-l-4 p-4 cursor-pointer hover:shadow-md transition-shadow',
                categoryColors[cat])}
              onClick={() => setSelectedCategory(cat)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-shop-sm font-medium text-gray-600">{categoryLabels[cat]}</span>
                <Package size={18} className="text-gray-400" />
              </div>
              <div className="text-shop-2xl font-bold text-gray-900">
                {card ? parseFloat(String(card.total_balance)).toLocaleString() : '0'}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Layers size={12} /> {card?.total_items ?? 0}품목
                </span>
                <span className="flex items-center gap-1">
                  <Package size={12} /> {card?.active_lot_count ?? 0}LOT
                </span>
                {card && parseInt(String(card.below_safety_count)) > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertTriangle size={12} /> {card.below_safety_count}부족
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + View Toggle */}
      <div className="flex items-center justify-between mb-4 border-b">
        <div className="flex gap-1">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedCategory(tab.key)}
              className={cn(
                'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
                selectedCategory === tab.key
                  ? 'border-process-cut text-process-cut'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mr-2 mb-1">
          <button
            onClick={() => setViewMode('item')}
            className={cn('p-1.5 rounded', viewMode === 'item' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
            title="품목별 보기"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('lot')}
            className={cn('p-1.5 rounded', viewMode === 'lot' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
            title="LOT별 보기"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={cn('p-1.5 rounded', viewMode === 'history' ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
            title="수불이력"
          >
            <History size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'history' ? (
        /* ========= 수불이력 ========= */
        <div className="overflow-x-auto rounded-card border bg-white">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-3 text-left font-medium text-gray-500">일자</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">유형</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">품목코드</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">품목명</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">입고처LOT</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">수량</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">용도</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">연계LOT</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">불출자</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">확인자</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody>
              {txnHistory.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">수불 이력이 없습니다.</td></tr>
              ) : (
                txnHistory.map((t) => {
                  const typeLabel = t.txn_type === 'IN' ? '입고' : t.txn_type === 'OUT' ? '출고' : '조정';
                  const typeColor = t.txn_type === 'IN' ? 'bg-green-100 text-green-700' :
                    t.txn_type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700';
                  return (
                    <tr key={t.inv_id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs">{t.txn_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeColor)}>{typeLabel}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{t.item_code}</td>
                      <td className="px-3 py-2">{t.item_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.source_lot || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{parseFloat(String(t.qty)).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{t.purpose || '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.linked_lot || '-'}</td>
                      <td className="px-3 py-2 text-xs">{t.issuer_name || t.worker || '-'}</td>
                      <td className="px-3 py-2 text-xs">{t.verifier_name || t.confirmed_by || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {t.purpose !== 'INSP_PASS' && t.purpose !== 'SHP_OUT' && (
                          <button onClick={() => handleDeleteTxn(t.inv_id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="삭제">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'item' ? (
        /* ========= 품목별 재고 (기존 + LOT 펼치기) ========= */
        <div className="overflow-x-auto rounded-card border bg-white">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-8 px-2 py-3"></th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">품목코드</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">품목명</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">구분</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">단위</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">입고</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">출고</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">현재고</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">안전재고</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">활성LOT</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <>
                  <tr key={item.item_id}
                    className={cn('border-b cursor-pointer hover:bg-gray-50', item.is_below_safety && 'bg-red-50')}
                    onClick={() => handleExpandItem(item.item_id)}
                  >
                    <td className="px-2 py-3 text-center text-gray-400">
                      {expandedItem === item.item_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{item.item_code}</td>
                    <td className="px-4 py-3">{item.item_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{categoryLabels[item.item_category]}</span>
                    </td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono">{parseFloat(String(item.total_in)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{parseFloat(String(item.total_out)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{parseFloat(String(item.balance)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{parseFloat(String(item.safety_stock)).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.active_lots}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.is_below_safety ? (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <TrendingDown size={12} /> 부족
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">정상</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openLedger(item.item_id, item.item_name); }}
                          className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                          title="수불이력"
                        >
                          <BookOpen size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedItem === item.item_id && (
                    <tr key={`${item.item_id}-lots`}>
                      <td colSpan={11} className="px-0 py-0 bg-gray-50">
                        <div className="px-8 py-3">
                          <div className="text-xs font-medium text-gray-500 mb-2">LOT 상세</div>
                          {itemLots.length === 0 ? (
                            <div className="text-xs text-gray-400 py-2">등록된 LOT가 없습니다.</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b">
                                  <th className="py-1.5 text-left font-medium">LOT번호</th>
                                  <th className="py-1.5 text-left font-medium">공급처LOT</th>
                                  <th className="py-1.5 text-left font-medium">검사판정</th>
                                  <th className="py-1.5 text-right font-medium">입고량</th>
                                  <th className="py-1.5 text-right font-medium">출고량</th>
                                  <th className="py-1.5 text-right font-medium">잔량</th>
                                  <th className="py-1.5 text-left font-medium">상태</th>
                                  <th className="py-1.5 text-left font-medium">입고일</th>
                                  <th className="py-1.5 text-center font-medium">라벨</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemLots.map((lot) => {
                                  const st = statusLabels[lot.lot_status] || { label: lot.lot_status, color: 'bg-gray-100' };
                                  const ir = lot.inspection_result ? inspResultLabels[lot.inspection_result] : null;
                                  return (
                                    <tr key={lot.lot_id} className="border-b border-gray-200">
                                      <td className="py-1.5 font-mono">{lot.lot_number}</td>
                                      <td className="py-1.5 font-mono text-gray-500">{lot.supplier_lot || '-'}</td>
                                      <td className="py-1.5">
                                        {ir ? <span className={cn('font-medium', ir.color)}>{ir.label}</span> : '-'}
                                      </td>
                                      <td className="py-1.5 text-right font-mono">{parseFloat(String(lot.total_in)).toLocaleString()}</td>
                                      <td className="py-1.5 text-right font-mono">{parseFloat(String(lot.total_out)).toLocaleString()}</td>
                                      <td className="py-1.5 text-right font-mono font-medium">{parseFloat(String(lot.balance)).toLocaleString()}</td>
                                      <td className="py-1.5">
                                        <span className={cn('px-1.5 py-0.5 rounded text-xs', st.color)}>{st.label}</span>
                                      </td>
                                      <td className="py-1.5 text-gray-500">{lot.lot_date ? new Date(lot.lot_date).toLocaleDateString('ko-KR') : '-'}</td>
                                      <td className="py-1.5 text-center">
                                        <button
                                          onClick={() => openLotLabel(lot)}
                                          className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                          title={`${lot.lot_number} 라벨 출력`}
                                        >
                                          <Printer size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========= LOT별 재고 (수불대장 형식) ========= */
        <div className="overflow-x-auto rounded-card border bg-white">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">LOT번호</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">공급처LOT</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">품목코드</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">품목명</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">구분</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">입고량</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">출고량</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">잔량</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">검사판정</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">LOT상태</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">입고일</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">라벨</th>
              </tr>
            </thead>
            <tbody>
              {lotInventory.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    등록된 LOT 재고가 없습니다. 인수검사 합격 시 자동으로 입고됩니다.
                  </td>
                </tr>
              ) : (
                lotInventory.map((lot) => {
                  const st = statusLabels[lot.lot_status] || { label: lot.lot_status, color: 'bg-gray-100' };
                  const ir = lot.inspection_result ? inspResultLabels[lot.inspection_result] : null;
                  const bal = parseFloat(String(lot.balance));
                  return (
                    <tr key={lot.lot_id} className={cn('border-b hover:bg-gray-50', bal <= 0 && 'text-gray-400')}>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{lot.lot_number}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{lot.supplier_lot || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{lot.item_code}</td>
                      <td className="px-4 py-3">{lot.item_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{categoryLabels[lot.item_category]}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{parseFloat(String(lot.total_in)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{parseFloat(String(lot.total_out)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">{bal.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {ir ? <span className={cn('text-xs font-medium', ir.color)}>{ir.label}</span> : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-xs', st.color)}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {lot.lot_date ? new Date(lot.lot_date).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openLotLabel(lot)}
                          className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title={`${lot.lot_number} 라벨 출력`}
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 출고/조정 등록 모달 */}
      {showTxnModal && (
        <CreateTxnModal
          onClose={() => setShowTxnModal(false)}
          onCreated={() => { setShowTxnModal(false); refreshAll(); }}
        />
      )}

      {/* 수불이력 (Ledger) 모달 */}
      {ledgerItemId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-shop-lg font-bold">수불이력 (수불대장)</h2>
                <p className="text-xs text-gray-500 mt-1">{ledgerItemName}</p>
              </div>
              <button onClick={closeLedger} className="p-2 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {ledgerLoading ? (
                <div className="text-center py-8 text-gray-400">불러오는 중...</div>
              ) : ledgerData.length === 0 ? (
                <div className="text-center py-8 text-gray-400">수불 이력이 없습니다.</div>
              ) : (
                <table className="w-full text-shop-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">일자</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">입고처LOT</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">인수검사LOT</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">수량</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 bg-yellow-50">잔량</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">용도</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">연계LOT</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">불출자/작업자</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">확인자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.map((entry) => {
                      const typeLabel = entry.txn_type === 'IN' ? '입고' : entry.txn_type === 'OUT' ? '출고' : '조정';
                      const typeColor = entry.txn_type === 'IN' ? 'bg-green-100 text-green-700' :
                        entry.txn_type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700';
                      const qtyDisplay = entry.txn_type === 'OUT'
                        ? `-${parseFloat(String(entry.qty)).toLocaleString()}`
                        : `+${parseFloat(String(entry.qty)).toLocaleString()}`;
                      return (
                        <tr key={entry.inv_id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{entry.txn_date?.slice(0, 10)}</td>
                          <td className="px-3 py-2">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeColor)}>{typeLabel}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">
                            {entry.source_lot || entry.supplier_lot || '-'}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">
                            {entry.inspection_lot || entry.lot_number || '-'}
                          </td>
                          <td className={cn('px-3 py-2 text-right font-mono text-xs',
                            entry.txn_type === 'IN' ? 'text-green-700' : entry.txn_type === 'OUT' ? 'text-red-700' : 'text-purple-700'
                          )}>
                            {qtyDisplay}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium bg-yellow-50">
                            {entry.running_balance.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{entry.purpose || '-'}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{entry.linked_lot || '-'}</td>
                          <td className="px-3 py-2 text-xs">{entry.issuer_name || entry.worker || '-'}</td>
                          <td className="px-3 py-2 text-xs">{entry.verifier_name || entry.confirmed_by || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTxnModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [items, setItems] = useState<Array<{ item_id: number; item_code: string; item_name: string; item_category: string }>>([]);
  const [lots, setLots] = useState<Array<{ lot_id: number; lot_number: string; supplier_lot: string | null; item_id: number }>>([]);
  const [form, setForm] = useState({
    item_id: '', lot_id: '', txn_type: 'OUT', qty: '', txn_date: new Date().toISOString().slice(0, 10),
    purpose: '', worker: '', source_lot: '', linked_lot: '', issuer_name: '', verifier_name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ data: any[] }>('/items').then((r) => setItems(r.data));
  }, []);

  useEffect(() => {
    if (form.item_id) {
      api.get<{ data: any[] }>(`/inventory/lot-inventory?item_id=${form.item_id}&status=ACTIVE`).then((r) => setLots(r.data));
    } else {
      setLots([]);
    }
  }, [form.item_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id || !form.qty) return alert('품목과 수량을 입력하세요');
    setSubmitting(true);
    try {
      await api.post('/inventory/transactions', {
        item_id: parseInt(form.item_id),
        lot_id: form.lot_id ? parseInt(form.lot_id) : null,
        txn_type: form.txn_type,
        qty: parseFloat(form.qty),
        txn_date: form.txn_date,
        purpose: form.purpose || null,
        worker: form.worker || null,
        source_lot: form.source_lot || null,
        linked_lot: form.linked_lot || null,
        issuer_name: form.issuer_name || null,
        verifier_name: form.verifier_name || null,
      });
      onCreated();
    } catch { alert('등록 실패'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold">출고/조정 등록</h2>
          <p className="text-xs text-gray-500 mt-1">입고는 품질관리 &gt; 인수검사 합격 시 자동 반영됩니다.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">품목</span>
            <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value, lot_id: '' })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
              <option value="">선택</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>{i.item_code} - {i.item_name}</option>
              ))}
            </select>
          </label>
          {lots.length > 0 && (
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">LOT 선택</span>
              <select value={form.lot_id} onChange={(e) => setForm({ ...form, lot_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm font-mono">
                <option value="">LOT 미지정 (전체)</option>
                {lots.map((l: any) => (
                  <option key={l.lot_id} value={l.lot_id}>
                    {l.lot_number} {l.supplier_lot ? `(${l.supplier_lot})` : ''} - 잔량: {parseFloat(String(l.balance)).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">유형</span>
              <div className="mt-1 flex gap-2">
                <button type="button" onClick={() => setForm({ ...form, txn_type: 'OUT' })}
                  className={cn('flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-shop-sm font-medium border',
                    form.txn_type === 'OUT' ? 'bg-red-100 text-red-700 border-red-300' : 'text-gray-500')}>
                  <ArrowUp size={14} /> 출고
                </button>
                <button type="button" onClick={() => setForm({ ...form, txn_type: 'ADJ' })}
                  className={cn('flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-shop-sm font-medium border',
                    form.txn_type === 'ADJ' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'text-gray-500')}>
                  <Layers size={14} /> 조정
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">수량</span>
              <input type="number" step="0.01" value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">일자</span>
              <input type="date" value={form.txn_date}
                onChange={(e) => setForm({ ...form, txn_date: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">담당자</span>
              <input type="text" value={form.worker}
                onChange={(e) => setForm({ ...form, worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">용도</span>
            <input type="text" value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="예: 인정배합, 비인정배합, 생산불출 등" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">입고처/전공정 LOT</span>
              <input type="text" value={form.source_lot}
                onChange={(e) => setForm({ ...form, source_lot: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm font-mono" placeholder="입고처 LOT번호" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">연계 LOT</span>
              <input type="text" value={form.linked_lot}
                onChange={(e) => setForm({ ...form, linked_lot: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm font-mono" placeholder="연계 LOT번호" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">불출자</span>
              <input type="text" value={form.issuer_name}
                onChange={(e) => setForm({ ...form, issuer_name: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="불출자 성명" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">확인자</span>
              <input type="text" value={form.verifier_name}
                onChange={(e) => setForm({ ...form, verifier_name: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="확인자 성명" />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
