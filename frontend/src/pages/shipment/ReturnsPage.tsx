import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  RotateCcw, RefreshCw, Search, CheckCircle2, Clock,
  Trash2, ChevronDown, ChevronRight, Package, AlertTriangle,
  Plus, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

interface Project {
  project_id: number;
  project_name: string;
  project_code?: string;
}

interface PurchaseOrder {
  po_id: number;
  project_name: string | null;
  construction_site: string | null;
  order_date: string | null;
}

interface ShipmentHistoryRow {
  sri_id: number;
  sr_id: number;
  item_id: number | null;
  item_name: string | null;
  item_code: string | null;
  item_category: string | null;
  spec: string | null;
  unit: string | null;
  planned_qty: number;
  shipped_qty: number;
  original_lot_id: number | null;
  original_lot_number: string | null;
  site_name: string | null;
  delivery_date: string | null;
  distributor: string | null;
  contractor: string | null;
  project_id: number | null;
  project_name: string | null;
  po_id: number | null;
}

interface ReturnLineItem {
  // source from shipment history
  sri_id: number;
  sr_id: number;
  item_id: number | null;
  item_name: string | null;
  item_code: string | null;
  item_category: string | null;
  spec: string | null;
  unit: string | null;
  shipped_qty: number;
  original_lot_id: number | null;
  original_lot_number: string | null;
  site_name: string | null;
  delivery_date: string | null;
  // user inputs
  return_qty: string;
  return_type: 'REUSE' | 'DISPOSE';
  dispose_reason: string;
  item_remarks: string;
}

interface ReturnReceipt {
  rr_id: number;
  rr_number: string;
  rr_date: string;
  customer_name: string | null;
  reason: string | null;
  status: 'PENDING' | 'COMPLETED';
  item_count: number;
  worker: string | null;
  remarks: string | null;
}

interface ReturnReceiptDetail {
  rri_id: number;
  item_name: string | null;
  item_code: string | null;
  spec: string | null;
  unit: string | null;
  qty: number;
  original_lot_number: string | null;
  return_type: string;
  new_lot_number: string | null;
  dispose_reason: string | null;
}

// ─── 반품 목록 카드 ──────────────────────────────────────────────────────────

function RRCard({ rr, onRefresh }: { rr: ReturnReceipt; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ReturnReceiptDetail[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadItems = async () => {
    if (expanded && items.length > 0) { setExpanded(false); return; }
    setLoadingItems(true);
    try {
      const res = await api.get<{ data: { items: ReturnReceiptDetail[] } }>(`/returns/${rr.rr_id}`);
      setItems(res.data.items || []);
      setExpanded(true);
    } catch {
      toast.error('품목 로드 실패');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm(`반품 ${rr.rr_number} 처리를 완료하시겠습니까?\n\n재입고 품목은 새 LOT가 생성되고, 폐기 품목은 OUT 처리됩니다.`)) return;
    setProcessing(true);
    try {
      const res = await api.post<{ data: { processed: any[] } }>(`/returns/${rr.rr_id}/complete`, {
        process_date: rr.rr_date,
      });
      toast.success(`반품 처리 완료! ${res.data.processed?.length || 0}건 처리됨`);
      onRefresh();
    } catch {
      toast.error('반품 처리 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`반품입고 ${rr.rr_number}을(를) 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/returns/${rr.rr_id}`);
      toast.success('삭제되었습니다');
      onRefresh();
    } catch {
      toast.error('삭제 실패 (접수중 상태만 삭제 가능)');
    }
  };

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md',
      rr.status === 'COMPLETED' ? 'border-emerald-200' : 'border-violet-200',
    )}>
      <div className="p-4 flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
          rr.status === 'COMPLETED' ? 'bg-emerald-100' : 'bg-violet-100',
        )}>
          {rr.status === 'COMPLETED'
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            : <RotateCcw className="h-5 w-5 text-violet-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{rr.rr_number}</span>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-semibold',
              rr.status === 'COMPLETED'
                ? 'text-emerald-700 bg-emerald-100'
                : 'text-violet-700 bg-violet-100',
            )}>
              {rr.status === 'COMPLETED' ? '처리완료' : '접수중'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            {rr.customer_name && <span>🏢 {rr.customer_name}</span>}
            <span>📅 {new Date(rr.rr_date).toLocaleDateString('ko-KR')}</span>
            <span>📦 {rr.item_count}종</span>
            {rr.worker && <span>👤 {rr.worker}</span>}
            {rr.reason && <span className="text-red-600">사유: {rr.reason}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rr.status === 'PENDING' && (
            <>
              <button
                onClick={handleComplete}
                disabled={processing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {processing
                  ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <RotateCcw className="h-3 w-3" />
                }
                반품처리
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={loadItems}
            disabled={loadingItems}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {loadingItems
              ? <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              : expanded
                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            }
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['품목명', '규격', '수량', '원본 LOT', '처리방식', '신규 LOT / 비고'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.rri_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{item.item_name || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{item.spec || '-'}</td>
                  <td className="px-4 py-2.5 text-sm font-mono">{item.qty} {item.unit}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{item.original_lot_number || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                      item.return_type === 'REUSE'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700',
                    )}>
                      {item.return_type === 'REUSE' ? '재입고' : '폐기'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-emerald-600">
                    {item.new_lot_number
                      ? item.new_lot_number
                      : item.return_type === 'DISPOSE'
                        ? <span className="text-red-500">{item.dispose_reason || '폐기처리'}</span>
                        : '-'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  // ── 기본 상태 ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [rrList, setRrList] = useState<ReturnReceipt[]>([]);
  const [loadingRR, setLoadingRR] = useState(false);

  // ── 출하이력 조회 필터 ──
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterPoId, setFilterPoId] = useState('');
  const [filterSiteName, setFilterSiteName] = useState('');
  const [filterFromDate, setFilterFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [filterToDate, setFilterToDate] = useState(new Date().toISOString().slice(0, 10));

  // ── 출하이력 ──
  const [historyRows, setHistoryRows] = useState<ShipmentHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearched, setHistorySearched] = useState(false);

  // ── 선택된 반품 라인 ──
  const [returnLines, setReturnLines] = useState<ReturnLineItem[]>([]);

  // ── 반품 공통 정보 ──
  const [rrDate, setRrDate] = useState(new Date().toISOString().slice(0, 10));
  const [rrWorker, setRrWorker] = useState('');
  const [rrReason, setRrReason] = useState('');
  const [rrRemarks, setRrRemarks] = useState('');
  const [rrCustomerName, setRrCustomerName] = useState('');

  // ── 반품 목록 필터 ──
  const [rrStatusFilter, setRrStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // ── 제출 ──
  const [submitting, setSubmitting] = useState(false);

  // ── 탭 ──
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');

  // ── 초기 로드 ──
  useEffect(() => {
    Promise.all([
      api.get<{ data: Project[] }>('/projects'),
      api.get<{ data: PurchaseOrder[] }>('/purchase-orders'),
    ]).then(([pr, po]) => {
      setProjects(pr.data ?? []);
      setPurchaseOrders(po.data ?? []);
    }).catch(() => toast.error('기초 데이터 로드 실패'));
  }, []);

  // ── 반품 목록 로드 ──
  const fetchRRList = useCallback(async () => {
    setLoadingRR(true);
    try {
      const params = new URLSearchParams();
      if (rrStatusFilter !== 'ALL') params.append('status', rrStatusFilter);
      const res = await api.get<{ data: ReturnReceipt[] }>(`/returns?${params}`);
      setRrList(res.data ?? []);
    } catch {
      toast.error('반품 목록 로드 실패');
    } finally {
      setLoadingRR(false);
    }
  }, [rrStatusFilter]);

  useEffect(() => { fetchRRList(); }, [fetchRRList]);

  // ── 출하이력 조회 ──
  const handleSearchHistory = async () => {
    setLoadingHistory(true);
    setHistorySearched(true);
    try {
      const params = new URLSearchParams();
      if (filterProjectId) params.append('project_id', filterProjectId);
      if (filterPoId) params.append('po_id', filterPoId);
      if (filterSiteName) params.append('site_name', filterSiteName);
      if (filterFromDate) params.append('from_date', filterFromDate);
      if (filterToDate) params.append('to_date', filterToDate);

      const res = await api.get<{ data: ShipmentHistoryRow[] }>(
        `/returns/shipment-history?${params}`
      );
      setHistoryRows(res.data ?? []);
      if ((res.data ?? []).length === 0) toast.info('출하이력이 없습니다');
    } catch {
      toast.error('출하이력 조회 실패');
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── 행 선택 → 반품 라인 추가 ──
  const isSelected = (sri_id: number) => returnLines.some(l => l.sri_id === sri_id);

  const toggleRow = (row: ShipmentHistoryRow) => {
    if (isSelected(row.sri_id)) {
      setReturnLines(prev => prev.filter(l => l.sri_id !== row.sri_id));
    } else {
      setReturnLines(prev => [...prev, {
        sri_id: row.sri_id,
        sr_id: row.sr_id,
        item_id: row.item_id,
        item_name: row.item_name,
        item_code: row.item_code,
        item_category: row.item_category,
        spec: row.spec,
        unit: row.unit,
        shipped_qty: row.shipped_qty,
        original_lot_id: row.original_lot_id,
        original_lot_number: row.original_lot_number,
        site_name: row.site_name,
        delivery_date: row.delivery_date,
        return_qty: String(row.shipped_qty),
        return_type: 'REUSE',
        dispose_reason: '',
        item_remarks: '',
      }]);
    }
  };

  const updateLine = (sri_id: number, field: keyof ReturnLineItem, value: string) => {
    setReturnLines(prev => prev.map(l => l.sri_id === sri_id ? { ...l, [field]: value } : l));
  };

  const removeLine = (sri_id: number) => {
    setReturnLines(prev => prev.filter(l => l.sri_id !== sri_id));
  };

  // ── 반품 등록 제출 ──
  const handleSubmit = async () => {
    if (!rrDate) { toast.error('반품일자를 입력하세요'); return; }
    if (returnLines.length === 0) { toast.error('반품할 품목을 선택하세요'); return; }

    const invalidQty = returnLines.find(l => {
      const q = parseFloat(l.return_qty);
      return isNaN(q) || q <= 0 || q > l.shipped_qty;
    });
    if (invalidQty) {
      toast.error(`반품수량이 올바르지 않습니다: ${invalidQty.item_name || ''} (최대 ${invalidQty.shipped_qty})`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/returns', {
        rr_date: rrDate,
        customer_name: rrCustomerName || null,
        reason: rrReason || null,
        remarks: rrRemarks || null,
        worker: rrWorker || null,
        items: returnLines.map(l => ({
          item_id: l.item_id,
          item_name: l.item_name,
          item_code: l.item_code,
          item_category: l.item_category,
          spec: l.spec,
          unit: l.unit || 'EA',
          qty: parseFloat(l.return_qty),
          original_lot_id: l.original_lot_id,
          original_lot_number: l.original_lot_number,
          return_type: l.return_type,
          dispose_reason: l.dispose_reason || null,
          remarks: l.item_remarks || null,
        })),
      });
      toast.success('반품입고가 등록되었습니다');
      setReturnLines([]);
      setRrReason('');
      setRrRemarks('');
      setRrWorker('');
      setRrCustomerName('');
      fetchRRList();
      setActiveTab('history');
    } catch {
      toast.error('등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 통계 ──
  const pendingCount = rrList.filter(r => r.status === 'PENDING').length;
  const completedCount = rrList.filter(r => r.status === 'COMPLETED').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="반품입고등록"
        count={rrList.length}
        description="출하된 품목 중 반품 접수 — 재입고(REUSE) 또는 폐기(DISPOSE) 처리"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'register' ? 'history' : 'register')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-sm',
              activeTab === 'register'
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-white border hover:bg-gray-50 text-gray-700',
            )}
          >
            {activeTab === 'register'
              ? <><Package className="h-4 w-4" /> 반품목록 보기</>
              : <><Plus className="h-4 w-4" /> 반품 신규 등록</>
            }
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* ── 요약 카드 ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: '접수중', count: pendingCount,
              color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
              icon: <Clock className="h-5 w-5 text-violet-600" />,
            },
            {
              label: '처리완료', count: completedCount,
              color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
            },
            {
              label: '전체', count: rrList.length,
              color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
              icon: <RotateCcw className="h-5 w-5 text-blue-600" />,
            },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={cn('rounded-2xl border p-4 flex items-center gap-3', bg, border)}>
              <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-2xl font-bold', color)}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {activeTab === 'register' ? (
          <>
            {/* ══ 출하이력 조회 영역 ══ */}
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-violet-500" />
                출하이력 조회
                <span className="text-xs font-normal text-gray-400">반품할 품목을 출하이력에서 선택하세요</span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">프로젝트</label>
                  <select
                    value={filterProjectId}
                    onChange={e => setFilterProjectId(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                  >
                    <option value="">전체</option>
                    {projects.map(p => (
                      <option key={p.project_id} value={String(p.project_id)}>{p.project_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">발주서</label>
                  <select
                    value={filterPoId}
                    onChange={e => setFilterPoId(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                  >
                    <option value="">전체</option>
                    {purchaseOrders.map(po => (
                      <option key={po.po_id} value={String(po.po_id)}>
                        {po.project_name || po.construction_site || `PO#${po.po_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">현장명</label>
                  <input
                    type="text"
                    value={filterSiteName}
                    onChange={e => setFilterSiteName(e.target.value)}
                    placeholder="현장명 검색"
                    className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                    onKeyDown={e => e.key === 'Enter' && handleSearchHistory()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">시작일</label>
                    <input
                      type="date"
                      value={filterFromDate}
                      onChange={e => setFilterFromDate(e.target.value)}
                      className="w-full border rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">종료일</label>
                    <input
                      type="date"
                      value={filterToDate}
                      onChange={e => setFilterToDate(e.target.value)}
                      className="w-full border rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSearchHistory}
                disabled={loadingHistory}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {loadingHistory
                  ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Search className="h-3.5 w-3.5" />
                }
                출하이력 조회
              </button>
            </div>

            {/* ══ 출하이력 테이블 ══ */}
            {historySearched && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">
                    출하이력
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {historyRows.length}건 — 체크박스로 반품 대상 선택
                    </span>
                  </h3>
                  {returnLines.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {returnLines.length}건 선택됨
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <div className="h-5 w-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mr-2" />
                      조회 중...
                    </div>
                  ) : historyRows.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                      <Package className="h-12 w-12 mb-3 text-gray-300" />
                      <p className="font-semibold">출하이력이 없습니다</p>
                      <p className="text-xs mt-1">필터 조건을 변경해 다시 조회하세요</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2.5 text-center text-gray-500 font-semibold w-10">선택</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">현장명</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">납기일</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">품목명</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">규격</th>
                          <th className="px-3 py-2.5 text-center text-gray-500 font-semibold">카테고리</th>
                          <th className="px-3 py-2.5 text-right text-gray-500 font-semibold">출하수량</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">LOT번호</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">프로젝트</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historyRows.map(row => {
                          const selected = isSelected(row.sri_id);
                          return (
                            <tr
                              key={row.sri_id}
                              onClick={() => toggleRow(row)}
                              className={cn(
                                'cursor-pointer transition-colors hover:bg-violet-50/40',
                                selected && 'bg-violet-50 border-l-4 border-l-violet-400',
                              )}
                            >
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleRow(row)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-3.5 h-3.5 accent-violet-600"
                                />
                              </td>
                              <td className="px-3 py-2.5 font-semibold text-gray-900 max-w-[120px] truncate">
                                {row.site_name || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                {row.delivery_date?.slice(0, 10) || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-800 max-w-[150px] truncate">
                                {row.item_name || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 max-w-[100px] truncate">
                                {row.spec || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                                  {row.item_category || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">
                                {row.shipped_qty} <span className="text-gray-400 font-normal">{row.unit}</span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-blue-600 text-[11px] max-w-[120px] truncate">
                                {row.original_lot_number || '-'}
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 max-w-[100px] truncate">
                                {row.project_name || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ══ 반품 등록 목록 ══ */}
            {returnLines.length > 0 && (
              <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-bold text-violet-800">
                    반품 등록 목록
                    <span className="ml-2 text-xs font-normal text-violet-500">
                      수량·처리방식·폐기사유를 입력 후 등록
                    </span>
                  </h3>
                </div>

                {/* 공통 정보 */}
                <div className="px-5 py-4 border-b bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">반품일자 *</label>
                      <input
                        type="date"
                        value={rrDate}
                        onChange={e => setRrDate(e.target.value)}
                        className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">반품처리자</label>
                      <input
                        type="text"
                        value={rrWorker}
                        onChange={e => setRrWorker(e.target.value)}
                        placeholder="처리자 이름"
                        className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">반품처 (거래처)</label>
                      <input
                        type="text"
                        value={rrCustomerName}
                        onChange={e => setRrCustomerName(e.target.value)}
                        placeholder="현장명 또는 거래처"
                        className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">반품사유 (공통)</label>
                      <input
                        type="text"
                        value={rrReason}
                        onChange={e => setRrReason(e.target.value)}
                        placeholder="반품 공통 사유"
                        className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                  </div>
                </div>

                {/* 품목별 입력 */}
                <div className="divide-y">
                  {returnLines.map((line, idx) => (
                    <div key={line.sri_id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center text-xs font-bold text-violet-700">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm text-gray-900">{line.item_name || '-'}</span>
                            {line.spec && <span className="text-xs text-gray-500">{line.spec}</span>}
                            {line.site_name && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {line.site_name}
                              </span>
                            )}
                            {line.original_lot_number && (
                              <span className="text-xs font-mono text-gray-400">
                                LOT: {line.original_lot_number}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                                반품수량 * (최대 {line.shipped_qty} {line.unit})
                              </label>
                              <input
                                type="number"
                                min={0.01}
                                max={line.shipped_qty}
                                step={0.01}
                                value={line.return_qty}
                                onChange={e => updateLine(line.sri_id, 'return_qty', e.target.value)}
                                className={cn(
                                  'w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300',
                                  parseFloat(line.return_qty) > line.shipped_qty && 'border-red-400 bg-red-50',
                                )}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 mb-1">처리방식 *</label>
                              <select
                                value={line.return_type}
                                onChange={e => updateLine(line.sri_id, 'return_type', e.target.value)}
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300"
                              >
                                <option value="REUSE">재입고 (REUSE)</option>
                                <option value="DISPOSE">폐기 (DISPOSE)</option>
                              </select>
                            </div>

                            {line.return_type === 'DISPOSE' && (
                              <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                                  폐기사유
                                </label>
                                <input
                                  type="text"
                                  value={line.dispose_reason}
                                  onChange={e => updateLine(line.sri_id, 'dispose_reason', e.target.value)}
                                  placeholder="폐기 사유 입력"
                                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 border-red-200"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 mb-1">품목 메모</label>
                              <input
                                type="text"
                                value={line.item_remarks}
                                onChange={e => updateLine(line.sri_id, 'item_remarks', e.target.value)}
                                placeholder="선택사항"
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300"
                              />
                            </div>
                          </div>

                          {/* 처리방식 뱃지 */}
                          <div className="mt-2">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                              line.return_type === 'REUSE'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700',
                            )}>
                              {line.return_type === 'REUSE'
                                ? <><CheckCircle2 className="h-2.5 w-2.5" /> 재입고 — 새 LOT 생성 (RTN날짜-원래LOT번호)</>
                                : <><AlertTriangle className="h-2.5 w-2.5" /> 폐기 — OUT 트랜잭션 처리</>
                              }
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => removeLine(line.sri_id)}
                          className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 등록 버튼 */}
                <div className="px-5 py-4 bg-gray-50 border-t flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    총 {returnLines.length}종 반품 예정
                    {' '}({returnLines.filter(l => l.return_type === 'REUSE').length}건 재입고 /
                    {' '}{returnLines.filter(l => l.return_type === 'DISPOSE').length}건 폐기)
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {submitting
                      ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <RotateCcw className="h-4 w-4" />
                    }
                    반품입고 등록
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ══ 반품 이력 탭 ══ */
          <>
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center gap-3">
                {(['ALL', 'PENDING', 'COMPLETED'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setRrStatusFilter(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                      rrStatusFilter === key
                        ? 'bg-violet-100 text-violet-700'
                        : 'text-gray-500 hover:bg-gray-100',
                    )}
                  >
                    {key === 'ALL' ? '전체' : key === 'PENDING' ? '접수중' : '처리완료'}
                  </button>
                ))}
                <button
                  onClick={fetchRRList}
                  disabled={loadingRR}
                  className="ml-auto p-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-4 w-4 text-gray-600', loadingRR && 'animate-spin')} />
                </button>
              </div>
            </div>

            {loadingRR ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <div className="h-6 w-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin mr-3" />
                로드 중...
              </div>
            ) : rrList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <RotateCcw className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-base font-semibold">반품입고 내역이 없습니다</p>
                <p className="text-xs mt-1 text-gray-400">신규 등록 탭에서 반품을 접수하세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rrList.map(rr => (
                  <RRCard key={rr.rr_id} rr={rr} onRefresh={fetchRRList} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
