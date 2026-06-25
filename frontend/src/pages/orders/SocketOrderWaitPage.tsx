import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, CheckCircle2, Clock, Download, Truck,
  RefreshCw, ChevronDown, ChevronRight, FileText,
  ArrowRight, ClipboardCheck, AlertCircle, Mail,
  X, Save, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

// ─── 타입 ──────────────────────────────────────────────────────────────────
interface SocketItem {
  seq: number;
  product_type: string;
  structure: string;
  pipe_width_mm: number;
  pipe_height_mm: number;
  qty: number;
  construction_type?: 'SINGLE' | 'DOUBLE';
  remark?: string;
  sheet_name?: string;
}

interface SocketOrder {
  so_id: number;
  po_id: number | null;
  project_name: string;
  status: 'APPROVED' | 'ORDERED' | 'INSPECTING' | 'RECEIVED';
  items_json: SocketItem[];
  writer_name: string | null;
  biz_name: string | null;
  order_date: string | null;
  vendor_email: string | null;
  ordered_at: string | null;
  order_note: string | null;
  received_at: string | null;
  approved_at: string | null;
  approver_name: string | null;
  approval_id: number | null;
  approval_status: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

// ─── 상태 설정 ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  APPROVED: {
    label: '발주대기',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-400',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  ORDERED: {
    label: '발주완료',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    icon: <Package className="h-3.5 w-3.5" />,
  },
  INSPECTING: {
    label: '인수검사중',
    color: 'text-violet-700 bg-violet-50 border-violet-200',
    dot: 'bg-violet-500',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  RECEIVED: {
    label: '입고완료',
    color: 'text-green-700 bg-green-50 border-green-200',
    dot: 'bg-green-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

// ─── 발주서 행 ─────────────────────────────────────────────────────────────
function OrderCard({ order, onRefresh }: { order: SocketOrder; onRefresh: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailVal, setEmailVal] = useState(order.vendor_email || '');
  const [noteVal, setNoteVal] = useState(order.order_note || '');
  const [loading, setLoading] = useState(false);

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.APPROVED;
  const items: SocketItem[] = order.items_json ?? [];

  // ── Excel 다운로드
  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const resp = await fetch(
        `/api/socket-orders/${order.so_id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j.error || '다운로드 실패');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = resp.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      a.href = url;
      a.download = nameMatch
        ? decodeURIComponent(nameMatch[1].trim())
        : `소켓발주서_${order.project_name}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다');
    }
  };

  // ── 이메일/메모 저장
  const handleSaveEmail = async () => {
    setLoading(true);
    try {
      await api.patch(`/socket-orders/${order.so_id}/vendor-email`, {
        vendor_email: emailVal || null,
        order_note: noteVal || null,
      });
      toast.success('저장했습니다');
      setEmailEdit(false);
      onRefresh();
    } catch {
      toast.error('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  // ── 발주완료 처리
  const handleMarkOrdered = async () => {
    if (!confirm(`"${order.project_name}" 발주서를 발주완료 처리합니까?`)) return;
    setLoading(true);
    try {
      await api.patch(`/socket-orders/${order.so_id}/mark-ordered`, {
        worker_id: user?.worker_id,
        order_note: noteVal || null,
      });
      toast.success('발주완료 처리했습니다');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    } finally {
      setLoading(false);
    }
  };

  // ── 입고확인 → 인수검사 시작 (C302 5.1 기준)
  const handleStartInspection = async () => {
    if (!confirm(`"${order.project_name}" 입고확인을 시작합니까?\n소켓을 1개씩 분리하여 인수검사 목록을 생성합니다.`)) return;
    setLoading(true);
    try {
      await api.post(`/socket-orders/${order.so_id}/start-inspection`, {
        worker_id: user?.worker_id,
      });
      toast.success('인수검사 목록을 생성했습니다. 인수검사 페이지로 이동합니다.');
      navigate(`/quality/socket-incoming/${order.so_id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '처리 실패';
      // 이미 생성된 경우 → 바로 이동
      if (msg.includes('이미')) {
        navigate(`/quality/socket-incoming/${order.so_id}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 인수검사 중 → 검사 페이지로 이동
  const handleGoToInspection = () => {
    navigate(`/quality/socket-incoming/${order.so_id}`);
  };

  // 소켓 규격 집계 (중복 합산)
  const socketSummary = items.reduce((acc, item) => {
    const key = `${item.product_type}||${item.pipe_width_mm}×${item.pipe_height_mm}`;
    if (acc[key]) {
      acc[key].qty += item.qty;
    } else {
      acc[key] = {
        product_type: item.product_type,
        w: item.pipe_width_mm,
        h: item.pipe_height_mm,
        qty: item.qty,
        sheet: item.sheet_name || '',
      };
    }
    return acc;
  }, {} as Record<string, { product_type: string; w: number; h: number; qty: number; sheet: string }>);

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
      order.status === 'RECEIVED' ? 'border-green-200' :
      order.status === 'ORDERED'  ? 'border-blue-200' :
      'border-amber-200'
    )}>
      {/* ── 헤더 ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 상태 배지 */}
          <div className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
            cfg.color
          )}>
            {cfg.icon}
            {cfg.label}
          </div>

          {/* 주요 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm truncate">{order.project_name}</h3>
              {order.biz_name && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {order.biz_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500 flex-wrap">
              {order.writer_name && <span>작성: {order.writer_name}</span>}
              {order.approver_name && <span>승인: {order.approver_name}</span>}
              {order.approved_at && (
                <span>승인일: {new Date(order.approved_at).toLocaleDateString('ko-KR')}</span>
              )}
              {order.ordered_at && (
                <span className="text-blue-600 font-semibold">
                  발주일: {new Date(order.ordered_at).toLocaleDateString('ko-KR')}
                </span>
              )}
              {order.received_at && (
                <span className="text-green-600 font-semibold">
                  입고일: {new Date(order.received_at).toLocaleDateString('ko-KR')}
                </span>
              )}
              <span className="text-gray-400">
                소켓 {order.item_count || items.length}종
              </span>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Excel 다운로드 */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
              title="Excel 다운로드"
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </button>

            {/* 발주완료 버튼 (APPROVED 상태) */}
            {order.status === 'APPROVED' && (
              <button
                onClick={handleMarkOrdered}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="발주완료 처리"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                발주완료
              </button>
            )}

            {/* 입고확인 버튼 (ORDERED 상태) → 인수검사 시작 */}
            {order.status === 'ORDERED' && (
              <button
                onClick={handleStartInspection}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="입고확인 → 인수검사 시작"
              >
                <Truck className="h-3.5 w-3.5" />
                입고확인
              </button>
            )}

            {/* 인수검사 계속 (INSPECTING 상태) */}
            {order.status === 'INSPECTING' && (
              <button
                onClick={handleGoToInspection}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                인수검사 계속
              </button>
            )}

            {/* 입고완료 후 검사결과 보기 */}
            {order.status === 'RECEIVED' && (
              <button
                onClick={handleGoToInspection}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-semibold rounded-lg transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                검사결과 보기
              </button>
            )}


            {/* 상세 토글 */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 이메일 / 메모 (항상 표시, 접기 가능) */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-16 flex-shrink-0">업체 이메일</span>
            {emailEdit ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="email"
                  value={emailVal}
                  onChange={e => setEmailVal(e.target.value)}
                  placeholder="업체 이메일 입력"
                  className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={handleSaveEmail}
                  disabled={loading}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { setEmailEdit(false); setEmailVal(order.vendor_email || ''); }}
                  className="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <span className={cn('text-xs flex-1', order.vendor_email ? 'text-gray-800 font-medium' : 'text-gray-400 italic')}>
                  {order.vendor_email || '미입력'}
                </span>
                <button
                  onClick={() => setEmailEdit(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  편집
                </button>
              </div>
            )}
          </div>
          {order.order_note && !emailEdit && (
            <div className="flex items-start gap-2 mt-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">발주 메모</span>
              <span className="text-xs text-gray-700">{order.order_note}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 소켓 상세 목록 ── */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">소켓 발주 명세</span>
            <button
              onClick={() => setShowDetail(d => !d)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              {showDetail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showDetail ? '집계' : '전체'}
            </button>
          </div>
          <div className="overflow-x-auto">
            {showDetail ? (
              /* 전체 상세 */
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['No', '구조체', '현장/시트', '가로(mm)', '세로(mm)', '시공', '수량'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{item.product_type}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">{item.sheet_name || item.structure || '-'}</td>
                      <td className="px-3 py-2 font-mono text-right">{item.pipe_width_mm}</td>
                      <td className="px-3 py-2 font-mono text-right">{item.pipe_height_mm}</td>
                      <td className="px-3 py-2">
                        {item.construction_type === 'SINGLE' ? (
                          <span className="text-orange-600 font-bold">단면</span>
                        ) : (
                          <span className="text-blue-600">양면</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700">{item.qty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* 집계 뷰 */
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['구조체', '규격 (가로×세로)', '합계수량'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.values(socketSummary).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-800">{row.product_type}</td>
                      <td className="px-3 py-2 font-mono">{row.w} × {row.h}</td>
                      <td className="px-3 py-2 font-bold text-blue-700 text-center">{row.qty}ea</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────
export function SocketOrderWaitPage() {
  const [list, setList] = useState<SocketOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'ALL' | 'APPROVED' | 'ORDERED' | 'RECEIVED'>('ALL');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'ALL') params.append('status', tab);
      const res = await api.get<{ data: SocketOrder[] }>(
        `/socket-orders/wait${params.toString() ? `?${params}` : ''}`
      );
      setList(res.data ?? []);
    } catch {
      toast.error('목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const approvedCount = list.filter(o => o.status === 'APPROVED').length;
  const orderedCount  = list.filter(o => o.status === 'ORDERED').length;
  const receivedCount = list.filter(o => o.status === 'RECEIVED').length;

  const TABS: Array<{ key: typeof tab; label: string; count?: number; color: string }> = [
    { key: 'ALL',      label: '전체',     count: list.length, color: 'text-gray-700 bg-gray-100' },
    { key: 'APPROVED', label: '발주대기', count: approvedCount, color: 'text-amber-700 bg-amber-100' },
    { key: 'ORDERED',  label: '발주완료', count: orderedCount,  color: 'text-blue-700 bg-blue-100' },
    { key: 'RECEIVED', label: '입고완료', count: receivedCount, color: 'text-green-700 bg-green-100' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 자재발주대기</h1>
            <p className="text-sm text-slate-300 mt-0.5">
              결재 승인완료된 소켓발주서를 관리하고 업체에 발주합니다
            </p>
          </div>
          <button
            onClick={fetchList}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            새로고침
          </button>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: '발주대기', count: approvedCount, icon: <AlertCircle className="h-4 w-4" />, color: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
            { label: '발주완료', count: orderedCount,  icon: <Package className="h-4 w-4" />,     color: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
            { label: '입고완료', count: receivedCount, icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500/20 text-green-200 border-green-400/30' },
          ].map(({ label, count, icon, color }) => (
            <div key={label} className={cn('rounded-xl border p-3 flex items-center gap-3', color)}>
              {icon}
              <div>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs opacity-80">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-2 px-6 py-3 bg-white border-b flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              tab === t.key ? t.color : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                tab === t.key ? 'bg-white/60' : 'bg-gray-200 text-gray-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 목록 ── */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
            로드 중...
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <ClipboardCheck className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-base font-semibold">
              {tab === 'APPROVED' ? '발주대기 목록이 없습니다' :
               tab === 'ORDERED'  ? '발주완료 목록이 없습니다' :
               tab === 'RECEIVED' ? '입고완료 목록이 없습니다' :
               '소켓발주서가 없습니다'}
            </p>
            <p className="text-sm mt-1.5">
              {tab === 'ALL' || tab === 'APPROVED'
                ? '결재함에서 소켓발주서가 승인완료되면 여기에 나타납니다'
                : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {list.map(order => (
              <OrderCard key={order.so_id} order={order} onRefresh={fetchList} />
            ))}
          </div>
        )}
      </div>

      {/* ── 안내 배너 ── */}
      <div className="flex-shrink-0 bg-blue-50 border-t border-blue-100 px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-blue-700 max-w-4xl mx-auto">
          <span className="font-bold">워크플로우:</span>
          <span>결재 승인완료</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-amber-700">발주대기</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span>Excel 다운로드 / 이메일 발송</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-blue-700">발주완료</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span>물품 입고 확인</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-green-700">인수검사</span>
        </div>
      </div>
    </div>
  );
}
