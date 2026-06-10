import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, Truck, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronRight, FlaskConical, Search,
  ArrowRight, RefreshCw, FileText, ExternalLink
} from 'lucide-react';

// ─── 인터페이스 ──────────────────────────────────────
interface PrItem {
  pri_id: number;
  pr_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_subcategory: string | null;
  required_qty: number;
  order_qty: number;
  unit: string;
  spec_detail: string | null;
  item_spec: string | null;
  roll_spec: string | null;
  receiving_status: 'PENDING' | 'INSPECTING' | 'PARTIAL' | 'RECEIVED' | 'REJECTED';
  received_qty: number;
  lot_id: number | null;
  insp_id: number | null;
  // 조인 필드
  lot_number: string | null;
  supplier_lot: string | null;
  inspection_lot: string | null;
  linked_insp_id: number | null;
  insp_result: 'PENDING' | 'PASS' | 'FAIL' | null;
  insp_form_code: string | null;
  inspected_at: string | null;
  // 아이템마스터 form_code 추론용
  item_spec_master: string | null;
}

interface PR {
  pr_id: number;
  pr_number: string;
  pr_date: string;
  supplier_name: string | null;
  status: 'ORDERED' | 'RECEIVED' | 'PARTIAL';
  remarks: string | null;
  order_number: string | null;
  customer_name: string | null;
  project_name: string | null;
  item_count: number;
  received_count: number;
  ordered_at: string | null;
  items: PrItem[];
}

// ─── 품목 수신상태 배지 ──────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:    { label: '대기중',   color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  icon: <Clock    className="h-3 w-3" /> },
  INSPECTING: { label: '검사중',   color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-200',   icon: <FlaskConical className="h-3 w-3" /> },
  PARTIAL:    { label: '부분입고', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: <Package  className="h-3 w-3" /> },
  RECEIVED:   { label: '입고완료', color: 'text-green-700',  bg: 'bg-green-50  border-green-200',  icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED:   { label: '불합격',   color: 'text-red-700',    bg: 'bg-red-50    border-red-200',    icon: <AlertCircle  className="h-3 w-3" /> },
};

const PR_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ORDERED:  { label: '주문중',   color: 'text-blue-700 bg-blue-100',   dot: 'bg-blue-500' },
  PARTIAL:  { label: '부분입고', color: 'text-indigo-700 bg-indigo-100', dot: 'bg-indigo-500' },
  RECEIVED: { label: '입고완료', color: 'text-green-700 bg-green-100', dot: 'bg-green-500' },
};

// form_code 추론 (item_code prefix 기반)
function inferFormCode(itemCode: string, subcategory?: string | null): string | null {
  const code = itemCode || '';
  if (code.startsWith('SM-SK') || code.startsWith('SM-GI-SK')) return 'D121-2';
  if (code.startsWith('SM-GW'))  return 'D122-1';
  if (code.startsWith('SM-PE'))  return 'D123-1';
  if (code.startsWith('SM-CW'))  return 'D124-1';
  if (code.startsWith('SM-SIL') || code.startsWith('SM-SL')) return 'D125-1';
  if (code.startsWith('SM-BRK') || code.startsWith('SM-GI')) return 'D126-2';
  if (code.startsWith('SM-FN'))  return 'D128-1';
  if (code.startsWith('SM-SP'))  return 'D129-1';
  if (code.startsWith('RM-MB'))  return 'D101-1';
  if (code.startsWith('RM-EG'))  return 'D102-1';
  if (code.startsWith('RM-EA'))  return 'D103-1';
  if (code.startsWith('RM-EP'))  return 'D104-1';
  return null;
}

// ─── 품목 행 컴포넌트 ──────────────────────────────────────
function ItemRow({ item, prId, onRefresh }: { item: PrItem; prId: number; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[item.receiving_status] || STATUS_CONFIG.PENDING;
  const formCode = item.insp_form_code || inferFormCode(item.item_code, item.item_subcategory);

  const handleReceive = async () => {
    // 자재입고 클릭 → INSPECTING 상태 전환 후 인수검사 페이지로 이동
    setLoading(true);
    try {
      // 인수검사 페이지로 이동 (URL 파라미터로 품목 정보 전달)
      const params = new URLSearchParams({
        pri_id: String(item.pri_id),
        pr_id: String(prId),
        item_name: item.item_name || '',
        qty: String(item.order_qty || item.required_qty || ''),
        unit: item.unit || '',
      });
      if (formCode) params.append('form_code', formCode);
      if (item.spec_detail) params.append('spec', item.spec_detail);
      navigate(`/quality/incoming?${params.toString()}`);
    } catch {
      toast.error('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        <div>
          <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
          <p className="text-xs text-gray-400 font-mono">{item.item_code}</p>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px]">
        <p className="truncate">{item.spec_detail || item.item_spec || item.roll_spec || '-'}</p>
      </td>
      <td className="px-4 py-2.5 text-sm text-center text-gray-700 font-mono">
        {item.order_qty || item.required_qty} {item.unit}
      </td>
      <td className="px-4 py-2.5">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
          cfg.bg, cfg.color
        )}>
          {cfg.icon}
          {cfg.label}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {/* LOT 정보 */}
        {item.lot_number ? (
          <div className="space-y-0.5">
            <button
              onClick={() => navigate(`/quality/lot-trace?lot=${item.lot_number}`)}
              className="inline-flex items-center gap-1 text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
            >
              {item.lot_number}
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
            {item.insp_result && (
              <span className={cn(
                'block text-[10px] font-semibold',
                item.insp_result === 'PASS' ? 'text-green-600' : item.insp_result === 'FAIL' ? 'text-red-600' : 'text-amber-600'
              )}>
                {item.insp_result === 'PASS' ? '✅ 합격' : item.insp_result === 'FAIL' ? '❌ 불합격' : '🔍 검사중'}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {item.receiving_status === 'PENDING' && (
            <button
              onClick={handleReceive}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Truck className="h-3 w-3" />
              )}
              자재입고
            </button>
          )}
          {item.receiving_status === 'INSPECTING' && item.linked_insp_id && (
            <button
              onClick={() => navigate(`/quality/incoming?insp_id=${item.linked_insp_id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <FlaskConical className="h-3 w-3" />
              검사진행
            </button>
          )}
          {item.receiving_status === 'INSPECTING' && (
            <button
              onClick={handleReceive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
              인수검사로
            </button>
          )}
          {item.receiving_status === 'RECEIVED' && item.linked_insp_id && (
            <button
              onClick={() => navigate(`/quality/incoming?insp_id=${item.linked_insp_id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-semibold rounded-lg transition-colors"
            >
              <FileText className="h-3 w-3" />
              검사서 보기
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── 발주서 카드 ──────────────────────────────────────
function PrCard({ pr, onRefresh }: { pr: PR; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const statusCfg = PR_STATUS_CONFIG[pr.status] || PR_STATUS_CONFIG.ORDERED;
  const progress = pr.item_count > 0 ? Math.round((Number(pr.received_count) / Number(pr.item_count)) * 100) : 0;

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200',
      pr.status === 'RECEIVED' ? 'border-green-200' : 'border-gray-200'
    )}>
      {/* 헤더 */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* 상태 아이콘 */}
          <div className={cn(
            'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
            pr.status === 'RECEIVED' ? 'bg-green-100' : pr.status === 'PARTIAL' ? 'bg-indigo-100' : 'bg-blue-100'
          )}>
            {pr.status === 'RECEIVED'
              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
              : pr.status === 'PARTIAL'
              ? <Package className="h-5 w-5 text-indigo-600" />
              : <Truck className="h-5 w-5 text-blue-600" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm">{pr.pr_number}</span>
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', statusCfg.color)}>
                {statusCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
              {pr.supplier_name && <span>📦 {pr.supplier_name}</span>}
              {pr.project_name && <span>🏗️ {pr.project_name}</span>}
              <span>📅 {new Date(pr.pr_date).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* 진행률 */}
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500 mb-1">입고 진행률</p>
            <div className="flex items-center gap-2">
              <div className="w-20 bg-gray-100 rounded-full h-1.5">
                <div
                  className={cn('h-1.5 rounded-full transition-all', pr.status === 'RECEIVED' ? 'bg-green-500' : 'bg-blue-500')}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700">
                {pr.received_count}/{pr.item_count}
              </span>
            </div>
          </div>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </div>
      </div>

      {/* 품목 테이블 */}
      {expanded && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['품목명', '규격', '수량', '입고상태', 'LOT / 검사결과', '작업'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pr.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                    품목이 없습니다.
                  </td>
                </tr>
              ) : (
                pr.items.map(item => (
                  <ItemRow key={item.pri_id} item={item} prId={pr.pr_id} onRefresh={onRefresh} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────
export default function MaterialOrdersPage() {
  const [list, setList] = useState<PR[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ORDERED' | 'PARTIAL' | 'RECEIVED'>('ALL');
  const navigate = useNavigate();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api.get<{ data: PR[] }>(
        `/purchase-requests/ordered${params.toString() ? `?${params}` : ''}`
      );
      setList(res.data ?? []);
    } catch {
      toast.error('주문내역 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const tabs: Array<{ key: typeof statusFilter; label: string; color: string }> = [
    { key: 'ALL',      label: '전체',     color: 'text-gray-700 bg-gray-100' },
    { key: 'ORDERED',  label: '주문중',   color: 'text-blue-700 bg-blue-100' },
    { key: 'PARTIAL',  label: '부분입고', color: 'text-indigo-700 bg-indigo-100' },
    { key: 'RECEIVED', label: '입고완료', color: 'text-green-700 bg-green-100' },
  ];

  const orderedCount  = list.filter(p => p.status === 'ORDERED').length;
  const partialCount  = list.filter(p => p.status === 'PARTIAL').length;
  const receivedCount = list.filter(p => p.status === 'RECEIVED').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="주문내역"
        description="자재발주서에서 주문 확정된 품목을 관리하고 자재입고를 진행합니다"
      />

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* 상태 요약 카드 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '주문중', count: orderedCount,  icon: <Truck className="h-5 w-5 text-blue-600" />,    bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
            { label: '부분입고', count: partialCount, icon: <Package className="h-5 w-5 text-indigo-600" />,  bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
            { label: '입고완료', count: receivedCount, icon: <CheckCircle2 className="h-5 w-5 text-green-600" />, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
          ].map(({ label, count, icon, bg, border, text }) => (
            <div key={label} className={cn('rounded-2xl border p-4 flex items-center gap-3', bg, border)}>
              <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-2xl font-bold', text)}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 필터 & 검색 */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 상태 탭 */}
            <div className="flex gap-1.5">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    statusFilter === tab.key ? tab.color : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 검색 */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchList()}
                  placeholder="발주번호, 공급업체 검색..."
                  className="pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-52"
                />
              </div>
              <button
                onClick={fetchList}
                disabled={loading}
                className="p-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn('h-4 w-4 text-gray-600', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* 주문내역 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
            로드 중...
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Truck className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-base font-semibold">주문내역이 없습니다</p>
            <p className="text-sm mt-1.5">자재발주서에서 [주문 확정]을 클릭하면 이곳에 나타납니다</p>
            <button
              onClick={() => navigate('/orders/purchase-requests')}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              자재발주서로 이동
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map(pr => (
              <PrCard key={pr.pr_id} pr={pr} onRefresh={fetchList} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
