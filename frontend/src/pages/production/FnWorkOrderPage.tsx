import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Plus, X, CheckCircle2,
  ClipboardList, Calendar, User, Play, CheckCheck,
  Trash2, Pencil, Loader2, AlertCircle, RefreshCw,
  Package, Info, Scissors, Wrench, BarChart3,
  ArrowDownToLine, AlertTriangle,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────
type FnWoType = 'FN_SHEET_CUT' | 'FN_SOCKET_ASSY';
type ActiveTabType = FnWoType | 'SLEEVE_STOCK';
type WoStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
type SleeveSize = 100 | 75 | 50;

interface Project {
  project_id: number;
  project_name: string;
}

interface FnWO {
  fn_wo_id: number;
  fn_wo_number: string;
  wo_type: FnWoType;
  project_id: number | null;
  project_name: string;
  wo_date: string;
  delivery_date: string | null;
  status: WoStatus;
  worker: string | null;
  remarks: string | null;
  item_count: number;
}

interface SleeveStock {
  size_100: number;
  size_75: number;
  size_50: number;
}

interface SleeveHistory {
  history_id: number;
  action_date: string;
  action_type: 'IN' | 'OUT';
  size_mm: number;
  qty: number;
  remarks: string | null;
}

interface ExtrudedSheetStock {
  stock_id: number;
  thickness_mm: number;
  width_mm: number;
  length_mm: number;
  qty: number;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 탭 설정
// ────────────────────────────────────────────────────────────────────────────
const FN_WO_TABS: {
  type: FnWoType;
  label: string;
  color: string;
  accentText: string;
  accentBg: string;
  accentRing: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'FN_SHEET_CUT',
    label: '✂️ 차열시트 재단',
    color: 'border-orange-500',
    accentText: 'text-orange-700',
    accentBg: 'bg-orange-50',
    accentRing: 'ring-orange-400',
    icon: <Scissors className="h-3.5 w-3.5" />,
  },
  {
    type: 'FN_SOCKET_ASSY',
    label: '🔧 방화소켓 조립',
    color: 'border-blue-500',
    accentText: 'text-blue-700',
    accentBg: 'bg-blue-50',
    accentRing: 'ring-blue-400',
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// 상태 배지
// ────────────────────────────────────────────────────────────────────────────
const statusConfig: Record<WoStatus, { label: string; bg: string; text: string }> = {
  PLANNED:     { label: '📋 계획',   bg: 'bg-blue-100',  text: 'text-blue-700'  },
  IN_PROGRESS: { label: '⚙️ 진행중', bg: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED:   { label: '✅ 완료',   bg: 'bg-green-100', text: 'text-green-700' },
};

function StatusBadge({ status }: { status: WoStatus }) {
  const cfg = statusConfig[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 인수검사 배지
// ────────────────────────────────────────────────────────────────────────────
const inspectConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: '검사전', bg: 'bg-gray-100',   text: 'text-gray-600'   },
  PASS:    { label: '합격',   bg: 'bg-green-100',  text: 'text-green-700'  },
  FAIL:    { label: '불합격', bg: 'bg-red-100',    text: 'text-red-700'    },
};

function InspectBadge({ status }: { status: string }) {
  const cfg = inspectConfig[status] ?? inspectConfig.PENDING;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 슬리브 재고 탭
// ────────────────────────────────────────────────────────────────────────────
function SleeveStockTab() {
  const [stock, setStock] = useState<SleeveStock | null>(null);
  const [history, setHistory] = useState<SleeveHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  const fetchStock = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<{ data: SleeveStock }>('/sleeve-stock'),
      api.get<{ data: SleeveHistory[] }>('/sleeve-stock/history'),
    ])
      .then(([s, h]) => {
        setStock(s.data);
        setHistory(h.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const stockCards = [
    { label: '100파이', value: stock?.size_100 ?? 0, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    { label: '75파이',  value: stock?.size_75 ?? 0,  color: 'from-teal-500 to-cyan-600',     bg: 'bg-teal-50',  border: 'border-teal-200',  text: 'text-teal-700'  },
    { label: '50파이',  value: stock?.size_50 ?? 0,  color: 'from-sky-500 to-blue-600',      bg: 'bg-sky-50',   border: 'border-sky-200',   text: 'text-sky-700'   },
  ];

  return (
    <div className="space-y-5">
      {/* 재고 현황 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {stockCards.map(card => (
          <div key={card.label} className={cn('rounded-2xl border p-5 relative overflow-hidden shadow-sm', card.bg, card.border)}>
            <div className="relative z-10">
              <p className={cn('text-sm font-semibold', card.text)}>{card.label} 슬리브</p>
              {loading ? (
                <div className="mt-2"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
              ) : (
                <p className={cn('text-5xl font-black mt-2', card.text)}>{card.value}</p>
              )}
              <p className={cn('text-xs mt-1 opacity-70', card.text)}>개 재고</p>
            </div>
            <div className={cn(
              'absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br',
              card.color
            )} />
          </div>
        ))}
      </div>

      {/* 입고 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowReceive(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <ArrowDownToLine className="h-4 w-4" />
          + 슬리브 입고
        </button>
      </div>

      {/* 재고 이력 */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-700">재고 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">일자</th>
                <th className="px-4 py-2 text-center text-gray-500 font-medium">구분</th>
                <th className="px-4 py-2 text-center text-gray-500 font-medium">지름</th>
                <th className="px-4 py-2 text-center text-gray-500 font-medium">수량</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400 text-xs">
                    재고 이력이 없습니다
                  </td>
                </tr>
              ) : (
                history.map(h => (
                  <tr key={h.history_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{h.action_date?.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        h.action_type === 'IN'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      )}>
                        {h.action_type === 'IN' ? '▲ 입고' : '▼ 출고'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-semibold text-gray-700">
                      {h.size_mm}파이
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-gray-800">
                      {h.qty}개
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{h.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 입고 모달 */}
      {showReceive && (
        <SleeveReceiveModal
          onClose={() => setShowReceive(false)}
          onReceived={() => { setShowReceive(false); fetchStock(); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 슬리브 입고 모달
// ────────────────────────────────────────────────────────────────────────────
function SleeveReceiveModal({
  onClose,
  onReceived,
}: {
  onClose: () => void;
  onReceived: () => void;
}) {
  const [form, setForm] = useState<{ size_mm: SleeveSize; qty: number; remarks: string }>({
    size_mm: 100,
    qty: 1,
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (form.qty <= 0) { alert('수량을 입력하세요.'); return; }
    setSubmitting(true);
    try {
      await api.post('/sleeve-stock/receive', form);
      alert(`✅ ${form.size_mm}파이 슬리브 ${form.qty}개 입고 완료`);
      onReceived();
    } catch (e: any) {
      alert(e?.body?.error || '입고 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-600 to-emerald-700 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">슬리브 입고</h2>
            <p className="text-green-200 text-xs mt-0.5">슬리브 재고를 등록합니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 지름 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">지름 선택 *</label>
            <div className="grid grid-cols-3 gap-2">
              {([100, 75, 50] as SleeveSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => setForm(f => ({ ...f, size_mm: size }))}
                  className={cn(
                    'py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                    form.size_mm === size
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {size}파이
                </button>
              ))}
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">수량 *</label>
            <input
              type="number"
              min={1}
              value={form.qty}
              onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="입고 수량"
            />
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">비고</label>
            <input
              type="text"
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="비고사항"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? '저장 중...' : '입고 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 작업지시 목록 탭 (FN_SHEET_CUT / FN_SOCKET_ASSY)
// ────────────────────────────────────────────────────────────────────────────
function FnWoListTab({
  woType,
  projects,
}: {
  woType: FnWoType;
  projects: Project[];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [orders, setOrders] = useState<FnWO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [extrudedStock, setExtrudedStock] = useState<ExtrudedSheetStock[]>([]);

  const tabCfg = FN_WO_TABS.find(t => t.type === woType)!;

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ wo_type: woType });
    if (selectedProjectId) qs.set('project_id', String(selectedProjectId));
    api.get<{ data: FnWO[] }>(`/fn-work-orders?${qs}`)
      .then(r => setOrders(r.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [woType, selectedProjectId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (woType === 'FN_SHEET_CUT') {
      api.get<{ data: ExtrudedSheetStock[] }>('/extruded-sheet-stock')
        .then(r => setExtrudedStock(r.data ?? []))
        .catch(() => setExtrudedStock([]));
    }
  }, [woType]);

  const counts = useMemo(() => ({
    planned:    orders.filter(o => o.status === 'PLANNED').length,
    inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
    completed:  orders.filter(o => o.status === 'COMPLETED').length,
  }), [orders]);

  const handleStart = async (id: number) => {
    try {
      await api.patch(`/fn-work-orders/${id}/start`, {});
      fetchOrders();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async (id: number) => {
    if (!confirm('작업을 완료 처리하시겠습니까?')) return;
    try {
      await api.post(`/fn-work-orders/${id}/complete`, {});
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleDelete = async (wo: FnWO) => {
    if (wo.status === 'COMPLETED') { alert('완료된 작업지시는 삭제할 수 없습니다.'); return; }
    if (!confirm(`${wo.fn_wo_number} 작업지시를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/fn-work-orders/${wo.fn_wo_id}`);
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '삭제 실패'); }
  };

  return (
    <div className="space-y-4">
      {/* 필터 + 생성 버튼 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">전체 프로젝트</option>
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
            ))}
          </select>
          <button
            onClick={fetchOrders}
            className="p-1.5 rounded-lg border hover:bg-gray-100 text-gray-500 transition-all"
            title="새로고침"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-white',
            woType === 'FN_SHEET_CUT'
              ? 'bg-orange-500 hover:bg-orange-600'
              : 'bg-blue-600 hover:bg-blue-700',
          )}
        >
          <Plus className="h-4 w-4" />
          작업지시 생성
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '📋 계획',   value: counts.planned,    color: 'border-l-blue-400  bg-blue-50  text-blue-700'  },
          { label: '⚙️ 진행중', value: counts.inProgress, color: 'border-l-amber-400 bg-amber-50 text-amber-700' },
          { label: '✅ 완료',   value: counts.completed,  color: 'border-l-green-400 bg-green-50 text-green-700' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl border-l-4 p-3', c.color)}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-medium opacity-70 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 차열시트 재단 탭: 압출시트 재고 현황 */}
      {woType === 'FN_SHEET_CUT' && extrudedStock.length > 0 && (
        <div className="rounded-xl border bg-orange-50 border-orange-200 p-4">
          <h3 className="text-xs font-semibold text-orange-700 mb-3 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />압출시트 재고 현황
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-orange-100/60 border-b border-orange-200">
                <tr>
                  <th className="px-3 py-2 text-left text-orange-600 font-medium">두께(T)</th>
                  <th className="px-3 py-2 text-center text-orange-600 font-medium">폭(W)</th>
                  <th className="px-3 py-2 text-center text-orange-600 font-medium">길이(L)</th>
                  <th className="px-3 py-2 text-center text-orange-600 font-medium">재고</th>
                  <th className="px-3 py-2 text-left text-orange-600 font-medium">갱신일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {extrudedStock.map(s => (
                  <tr key={s.stock_id} className="hover:bg-orange-50">
                    <td className="px-3 py-2 font-mono font-semibold text-orange-800">T{s.thickness_mm}</td>
                    <td className="px-3 py-2 text-center font-mono">{s.width_mm}mm</td>
                    <td className="px-3 py-2 text-center font-mono">{s.length_mm}mm</td>
                    <td className="px-3 py-2 text-center font-bold text-orange-700">{s.qty}장</td>
                    <td className="px-3 py-2 text-gray-500">{s.updated_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 목록 테이블 */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-500 text-xs">
              <th className="px-4 py-3 text-left font-medium">지시번호</th>
              <th className="px-4 py-3 text-left font-medium">프로젝트</th>
              <th className="px-4 py-3 text-left font-medium">작업일</th>
              <th className="px-4 py-3 text-left font-medium">납기일</th>
              <th className="px-4 py-3 text-left font-medium">작업자</th>
              <th className="px-4 py-3 text-center font-medium">품목수</th>
              {woType === 'FN_SOCKET_ASSY' && (
                <th className="px-4 py-3 text-center font-medium">인수검사</th>
              )}
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-center font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={woType === 'FN_SOCKET_ASSY' ? 9 : 8} className="py-16 text-center">
                  <Loader2 className="h-8 w-8 text-gray-300 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">불러오는 중...</p>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={woType === 'FN_SOCKET_ASSY' ? 9 : 8} className="py-16 text-center">
                  <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm font-medium">작업지시가 없습니다</p>
                  <p className="text-gray-300 text-xs mt-1">위 [작업지시 생성] 버튼으로 새 작업지시를 만드세요.</p>
                </td>
              </tr>
            ) : (
              orders.map(wo => (
                <tr key={wo.fn_wo_id} className="border-b hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailId(wo.fn_wo_id)}
                      className={cn('font-mono text-xs hover:underline', tabCfg.accentText)}
                    >
                      {wo.fn_wo_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate font-medium text-gray-800 text-xs">
                    {wo.project_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{wo.wo_date?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{wo.delivery_date?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{wo.worker || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{wo.item_count}</span>
                  </td>
                  {woType === 'FN_SOCKET_ASSY' && (
                    <td className="px-4 py-3 text-center">
                      <InspectBadge status={(wo as any).inspect_status ?? 'PENDING'} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={wo.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {wo.status === 'PLANNED' && (
                        <button
                          onClick={() => handleStart(wo.fn_wo_id)}
                          title="작업 시작"
                          className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {wo.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleComplete(wo.fn_wo_id)}
                          title="작업 완료"
                          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setDetailId(wo.fn_wo_id)}
                        title="상세 보기"
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-500 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {wo.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleDelete(wo)}
                          title="삭제"
                          className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <FnCreateModal
          woType={woType}
          projects={projects}
          extrudedStock={extrudedStock}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

      {/* 상세 모달 */}
      {detailId !== null && (
        <FnDetailModal
          woId={detailId}
          woType={woType}
          onClose={() => setDetailId(null)}
          onRefresh={fetchOrders}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 작업지시 생성 모달
// ────────────────────────────────────────────────────────────────────────────
function FnCreateModal({
  woType,
  projects,
  extrudedStock,
  onClose,
  onCreated,
}: {
  woType: FnWoType;
  projects: Project[];
  extrudedStock: ExtrudedSheetStock[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const tabCfg = FN_WO_TABS.find(t => t.type === woType)!;
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [form, setForm] = useState({
    wo_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    worker: '',
    remarks: '',
  });
  // 차열시트 재단 전용
  const [cutItems, setCutItems] = useState([{
    thickness_mm: 5,
    width_mm: 125,
    length_mm: 4000,
    qty: 1,
    remark: '',
  }]);
  // 방화소켓 조립 전용
  const [assyItems, setAssyItems] = useState([{
    sleeve_size: 100 as SleeveSize,
    sleeve_qty: 1,
    remark: '',
  }]);
  const [submitting, setSubmitting] = useState(false);

  const addCutItem = () => setCutItems(prev => [...prev, { thickness_mm: 5, width_mm: 125, length_mm: 4000, qty: 1, remark: '' }]);
  const removeCutItem = (i: number) => setCutItems(prev => prev.filter((_, idx) => idx !== i));
  const addAssyItem = () => setAssyItems(prev => [...prev, { sleeve_size: 100, sleeve_qty: 1, remark: '' }]);
  const removeAssyItem = (i: number) => setAssyItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!selectedProjectId) { alert('프로젝트를 선택하세요.'); return; }
    const items = woType === 'FN_SHEET_CUT'
      ? cutItems
      : assyItems;
    if (items.length === 0) { alert('항목을 추가하세요.'); return; }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: any }>('/fn-work-orders', {
        wo_type: woType,
        project_id: selectedProjectId,
        ...form,
        delivery_date: form.delivery_date || null,
        items,
      });
      alert(`✅ ${res.data?.fn_wo_number ?? ''} 생성 완료`);
      onCreated();
    } catch (e: any) {
      alert(e?.body?.error || '생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const headerGrad = woType === 'FN_SHEET_CUT'
    ? 'from-orange-500 to-orange-700'
    : 'from-blue-600 to-blue-800';
  const ringColor = woType === 'FN_SHEET_CUT' ? 'focus:ring-orange-400' : 'focus:ring-blue-400';
  const btnColor = woType === 'FN_SHEET_CUT' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={cn('flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r rounded-t-2xl', headerGrad)}>
          <div>
            <h2 className="text-base font-bold text-white">
              {woType === 'FN_SHEET_CUT' ? '차열시트 재단 작업지시 생성' : '방화소켓 조립 작업지시 생성'}
            </h2>
            <p className="text-white/70 text-xs mt-0.5">에프엔테크 작업지시를 생성합니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[76vh] overflow-y-auto">
          {/* 프로젝트 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">프로젝트 *</label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', ringColor)}
            >
              <option value="">프로젝트 선택</option>
              {projects.map(p => (
                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
              ))}
            </select>
          </div>

          {/* 차열시트 재단: 항목 입력 */}
          {woType === 'FN_SHEET_CUT' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">재단 항목</label>
                <button
                  onClick={addCutItem}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />항목 추가
                </button>
              </div>
              {extrudedStock.length > 0 && (
                <div className="mb-3 p-2 rounded-lg bg-orange-50 border border-orange-100 text-xs text-orange-700">
                  💡 압출시트 재고: {extrudedStock.map(s => `T${s.thickness_mm}×W${s.width_mm}×L${s.length_mm} (${s.qty}장)`).join(', ')}
                </div>
              )}
              <div className="space-y-2">
                {cutItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center p-3 bg-gray-50 rounded-xl border">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">두께(T)</label>
                      <input
                        type="number"
                        value={item.thickness_mm}
                        onChange={e => setCutItems(prev => prev.map((it, idx) => idx === i ? { ...it, thickness_mm: Number(e.target.value) } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">폭(W)</label>
                      <input
                        type="number"
                        value={item.width_mm}
                        onChange={e => setCutItems(prev => prev.map((it, idx) => idx === i ? { ...it, width_mm: Number(e.target.value) } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">길이(L)</label>
                      <input
                        type="number"
                        value={item.length_mm}
                        onChange={e => setCutItems(prev => prev.map((it, idx) => idx === i ? { ...it, length_mm: Number(e.target.value) } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">수량</label>
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={e => setCutItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Number(e.target.value) } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
                      />
                    </div>
                    <div className="flex items-end pb-0.5">
                      {cutItems.length > 1 && (
                        <button
                          onClick={() => removeCutItem(i)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 방화소켓 조립: 슬리브 항목 */}
          {woType === 'FN_SOCKET_ASSY' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">소켓 항목 (슬리브 지름 × 수량)</label>
                <button
                  onClick={addAssyItem}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />항목 추가
                </button>
              </div>
              <div className="space-y-2">
                {assyItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center p-3 bg-gray-50 rounded-xl border">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">슬리브 지름</label>
                      <select
                        value={item.sleeve_size}
                        onChange={e => setAssyItems(prev => prev.map((it, idx) => idx === i ? { ...it, sleeve_size: Number(e.target.value) as SleeveSize } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      >
                        <option value={100}>100파이</option>
                        <option value={75}>75파이</option>
                        <option value={50}>50파이</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">수량</label>
                      <input
                        type="number"
                        min={1}
                        value={item.sleeve_qty}
                        onChange={e => setAssyItems(prev => prev.map((it, idx) => idx === i ? { ...it, sleeve_qty: Number(e.target.value) } : it))}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">비고</label>
                      <input
                        type="text"
                        value={item.remark}
                        onChange={e => setAssyItems(prev => prev.map((it, idx) => idx === i ? { ...it, remark: e.target.value } : it))}
                        placeholder="비고"
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex items-end pb-0.5">
                      {assyItems.length > 1 && (
                        <button
                          onClick={() => removeAssyItem(i)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-blue-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                완료 처리 시 해당 슬리브 재고에서 수량이 차감됩니다
              </p>
            </div>
          )}

          {/* 작업 기본정보 */}
          <div className={cn('rounded-xl p-4 space-y-3 border', tabCfg.accentBg)}>
            <h3 className={cn('text-xs font-semibold flex items-center gap-1.5', tabCfg.accentText)}>
              <Info className="h-3.5 w-3.5" />작업 기본정보
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">작업일 *</label>
                <input
                  type="date"
                  value={form.wo_date}
                  onChange={e => setForm(f => ({ ...f, wo_date: e.target.value }))}
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2', ringColor)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">납기일</label>
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2', ringColor)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <User className="h-3 w-3 inline mr-0.5" />작업자
                </label>
                <input
                  type="text"
                  value={form.worker}
                  onChange={e => setForm(f => ({ ...f, worker: e.target.value }))}
                  placeholder="작업자 이름"
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2', ringColor)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">비고</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="비고사항"
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2', ringColor)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedProjectId}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-medium transition-all text-white',
              submitting || !selectedProjectId ? 'opacity-50 cursor-not-allowed bg-gray-400' : btnColor,
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? '저장 중...' : '작업지시 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 상세 모달
// ────────────────────────────────────────────────────────────────────────────
function FnDetailModal({
  woId,
  woType,
  onClose,
  onRefresh,
}: {
  woId: number;
  woType: FnWoType;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editWorker, setEditWorker] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const tabCfg = FN_WO_TABS.find(t => t.type === woType) ?? FN_WO_TABS[0];
  const headerGrad = woType === 'FN_SHEET_CUT' ? 'from-orange-500 to-orange-700' : 'from-blue-600 to-blue-800';
  const ringColor = woType === 'FN_SHEET_CUT' ? 'focus:ring-orange-400' : 'focus:ring-blue-400';
  const btnColor = woType === 'FN_SHEET_CUT' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700';

  useEffect(() => {
    setLoading(true);
    api.get<{ data: any }>(`/fn-work-orders/${woId}`)
      .then(r => {
        setDetail(r.data);
        setEditWorker(r.data?.worker ?? '');
        setEditRemarks(r.data?.remarks ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [woId]);

  const handleStart = async () => {
    try {
      await api.patch(`/fn-work-orders/${woId}/start`, {});
      const r = await api.get<{ data: any }>(`/fn-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async () => {
    if (!confirm('작업을 완료 처리하시겠습니까?' + (woType === 'FN_SOCKET_ASSY' ? ' (슬리브 재고가 차감됩니다)' : ''))) return;
    try {
      await api.post(`/fn-work-orders/${woId}/complete`, {});
      const r = await api.get<{ data: any }>(`/fn-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/fn-work-orders/${woId}`, {
        worker: editWorker || null,
        remarks: editRemarks || null,
      });
      onRefresh();
      onClose();
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  const d = detail;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={cn('flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r rounded-t-2xl', headerGrad)}>
          <div>
            <p className="font-mono text-xs text-white/60">{d?.fn_wo_number ?? '...'}</p>
            <h2 className="text-base font-bold text-white mt-0.5">{d?.project_name ?? '로딩 중...'}</h2>
            <p className="text-white/70 text-xs mt-0.5">{tabCfg.label}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
            {/* 상태 + 액션 */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={d?.status ?? 'PLANNED'} />
              {woType === 'FN_SOCKET_ASSY' && (
                <InspectBadge status={d?.inspect_status ?? 'PENDING'} />
              )}
              {d?.status === 'PLANNED' && (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />작업 시작
                </button>
              )}
              {d?.status === 'IN_PROGRESS' && (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  작업 완료{woType === 'FN_SOCKET_ASSY' ? ' (슬리브 차감)' : ''}
                </button>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '작업일', val: d?.wo_date?.slice(0, 10) },
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '납기일', val: d?.delivery_date?.slice(0, 10) },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                    {f.icon}<span>{f.label}</span>
                  </div>
                  <p className="font-medium text-gray-800">{f.val || '-'}</p>
                </div>
              ))}
            </div>

            {/* 수정 필드 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" />작업자
                </label>
                <input
                  type="text"
                  value={editWorker}
                  onChange={e => setEditWorker(e.target.value)}
                  disabled={d?.status === 'COMPLETED'}
                  placeholder="작업자 이름"
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400', ringColor)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">비고</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  disabled={d?.status === 'COMPLETED'}
                  placeholder="비고사항"
                  className={cn('w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400', ringColor)}
                />
              </div>
            </div>

            {/* 항목 목록 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">
                작업 항목 ({d?.items?.length ?? 0}건)
              </h3>
              {d?.items?.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">No</th>
                        {woType === 'FN_SHEET_CUT' ? (
                          <>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">두께(T)</th>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">폭(W)</th>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">길이(L)</th>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">슬리브 지름</th>
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                          </>
                        )}
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.items.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          {woType === 'FN_SHEET_CUT' ? (
                            <>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-orange-700">T{item.thickness_mm}</td>
                              <td className="px-3 py-2 text-center font-mono">{item.width_mm}mm</td>
                              <td className="px-3 py-2 text-center font-mono">{item.length_mm}mm</td>
                              <td className="px-3 py-2 text-center font-bold">{item.qty}장</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-blue-700">{item.sleeve_size}파이</td>
                              <td className="px-3 py-2 text-center font-bold">{item.sleeve_qty}개</td>
                            </>
                          )}
                          <td className="px-3 py-2 text-gray-500">{item.remark || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 border rounded-xl bg-gray-50">
                  <ClipboardList className="h-6 w-6 text-gray-300 mr-2" />
                  <span className="text-gray-400 text-sm">항목이 없습니다</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">닫기</button>
          {d?.status !== 'COMPLETED' && !loading && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50 text-white rounded-lg font-medium transition-colors',
                btnColor,
              )}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export function FnWorkOrderPage() {
  useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTabType>('FN_SHEET_CUT');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.get<{ data: Project[] }>('/projects')
      .then(r => setProjects(r.data ?? []))
      .catch(() => {});
  }, []);

  const tabs: { key: ActiveTabType; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
    {
      key: 'FN_SHEET_CUT',
      label: '✂️ 차열시트 재단',
      icon: <Scissors className="h-3.5 w-3.5" />,
      color: 'border-orange-500',
      activeColor: 'text-orange-700',
    },
    {
      key: 'FN_SOCKET_ASSY',
      label: '🔧 방화소켓 조립',
      icon: <Wrench className="h-3.5 w-3.5" />,
      color: 'border-blue-500',
      activeColor: 'text-blue-700',
    },
    {
      key: 'SLEEVE_STOCK',
      label: '📦 슬리브 재고',
      icon: <Package className="h-3.5 w-3.5" />,
      color: 'border-green-500',
      activeColor: 'text-green-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">에프엔테크 작업지시</h1>
            <p className="text-slate-400 text-xs mt-0.5">차열시트 재단 · 방화소켓 조립 · 슬리브 재고 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-1 rounded-lg font-mono">
              EZ-FN-P100 · FS-NP24-1112-2
            </span>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b shadow-sm">
        <div className="flex overflow-x-auto no-scrollbar px-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5',
                activeTab === tab.key
                  ? `${tab.color} ${tab.activeColor}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="px-6 py-4">
        {activeTab === 'SLEEVE_STOCK' ? (
          <SleeveStockTab />
        ) : (
          <FnWoListTab woType={activeTab as FnWoType} projects={projects} />
        )}
      </div>
    </div>
  );
}
