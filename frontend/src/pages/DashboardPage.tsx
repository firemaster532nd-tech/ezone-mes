import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  ClipboardList, CheckCircle, Package, AlertTriangle, AlertCircle,
  TrendingUp, Factory, Info, ShoppingCart, FileText, Truck,
  FlaskConical, Layers, Scissors, Hammer, ShieldCheck, ArrowRight,
  ChevronRight, Calendar, ChevronLeft,
} from 'lucide-react';

interface AlertsData {
  failed_inspections_count: number;
  pending_approvals_count: number;
  safety_stock_alerts_count: number;
  stalled_processes_count: number;
}

interface ActivityLogEntry {
  id: number;
  severity: 'info' | 'warning' | 'error';
  type: 'WORK_ORDER' | 'INSPECTION' | 'APPROVAL' | 'INVENTORY' | 'PROCESS';
  message: string;
  timestamp: string;
}

const typeLabel: Record<string, string> = {
  WORK_ORDER: '작업지시',
  INSPECTION: '검사',
  APPROVAL: '결재',
  INVENTORY: '재고',
  PROCESS: '공정',
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

interface DashboardData {
  date: string;
  today: {
    total: string;
    completed: string;
    in_progress: string;
    planned: string;
    hold: string;
    total_actual_qty: string;
  };
  by_process: Array<{ process_code: string; count: string; total_qty: string }>;
  by_status: Array<{ status: string; count: string }>;
  inspection: {
    total: string;
    pass_count: string;
    fail_count: string;
    pass_rate: string;
  };
  inventory_alerts: Array<{
    item_id?: number;
    lot_id?: number;
    lot_number?: string;
    item_code?: string;
    item_name: string;
    item_spec?: string;
    item_category?: string;
    category?: string;
    safety_stock?: string;
    balance?: string;
    qty_current?: number;
    unit?: string;
    location?: string;
    is_out_of_stock?: boolean;
  }>;
  shortage_inventory_alerts?: Array<{
    lot_id: number;
    lot_number: string;
    item_name: string;
    item_spec: string;
    category: string;
    qty_current: number;
    unit: string;
    location: string;
    is_out_of_stock: boolean;
  }>;
  site_orders_summary?: Array<{
    po_id: number;
    project_name: string;
    customer_name: string;
    order_date: string;
    delivery_date: string;
    total_items: number;
    total_qty: number;
    status: string;
  }>;
  recent_orders: Array<{
    wo_id: number;
    wo_number: string;
    wo_date: string;
    process_code: string;
    status: string;
    item_name: string;
    planned_qty: string;
    actual_qty: string;
  }>;
  weekly_production: Array<{
    wo_date: string;
    process_code: string;
    wo_count: string;
    total_qty: string;
  }>;
}

const statusLabel: Record<string, string> = {
  PLANNED: '계획', IN_PROGRESS: '진행중', COMPLETED: '완료', HOLD: '보류',
};
const statusMap: Record<string, string> = {
  PLANNED: 'PENDING', IN_PROGRESS: 'INFO', COMPLETED: 'PASS', HOLD: 'HOLD',
};

// ── 워크플로우 타입 ──
interface WorkflowData {
  pipeline: {
    sales_order: Record<string, number>;
    purchase_request: Record<string, number>;
    inspection: { total: string; pass_count: string; fail_count: string; pending_count: string };
    work_order: Array<{ process_code: string; status: string; count: number }>;
    process_log: Array<{ process_code: string; status: string; count: number }>;
    shipment: Record<string, number>;
    approval: Record<string, number>;
  };
  orders: Array<{
    order_id: number;
    order_number: string;
    customer_name: string;
    project_name: string;
    order_status: string;
    order_date: string;
    stages: Record<string, string>;
    counts: Record<string, number>;
  }>;
}

interface CalendarEntry {
  order_id: number;
  order_number: string;
  event_date: string;        // 발주서 등록일
  delivery_date: string | null;
  project_id: number;
  project_name: string;
  project_code: string;
  project_customer: string | null;
  customer_name: string | null;
  round_no: number;          // 1차, 2차, ...
  total_qty: number | null;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendGmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingEmail(true);
    try {
      await api.post('/webmail/send', {
        recipient_email: emailRecipient,
        subject: emailSubject,
        body_text: emailBody,
      });
      alert(`[구글 메일 실시간 발송 완료]\n\n수신: ${emailRecipient}\n제목: ${emailSubject}`);
      setIsEmailModalOpen(false);
      setEmailRecipient('');
      setEmailSubject('');
      setEmailBody('');
      // Reload dashboard data
      const res = await api.get<{ data: DashboardData }>('/dashboard');
      setData(res.data);
    } catch (err: any) {
      alert(`메일 발송 오류: ${err.message || '서버 오류'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const [selectedEmailDetail, setSelectedEmailDetail] = useState<any | null>(null);

  useEffect(() => {
    api.get<{ data: DashboardData }>('/dashboard').then((res) => {
      const dbData = res.data;
      setData(dbData);
      // Fetch live Gmail inbox
      api.get<{ data: any[] }>('/webmail').then((mailRes) => {
        if (mailRes.data && mailRes.data.length > 0) {
          setData((prev) => prev ? {
            ...prev,
            groupware: {
              ...prev.groupware,
              emails: mailRes.data,
            }
          } : prev);
        }
      }).catch(() => {});
    });
    api.get<{ data: AlertsData }>('/dashboard/alerts').then((res) => setAlerts(res.data)).catch(() => {});
    api.get<{ data: ActivityLogEntry[] }>('/dashboard/activity-log').then((res) => setActivityLog(res.data)).catch(() => {});
    api.get<{ data: WorkflowData }>('/dashboard/workflow').then((res) => setWorkflow(res.data)).catch(() => {});
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center h-96 text-gray-400">로딩 중...</div>;
  }

  const today = data.today || { total: '0', completed: '0', total_actual_qty: '0' };
  const totalWo = parseInt(today.total || '0') || 0;
  const completedRate = totalWo > 0 ? Math.round((parseInt(today.completed || '0') / totalWo) * 100) : 0;
  const inspPassRate = data.inspection?.pass_rate ?? (data as any)?.kpi?.pass_rate ?? '100';
  const inspTotal = data.inspection?.total ?? (data as any)?.kpi?.inspection_total ?? '0';
  const inventoryAlertsCount = data.inventory_alerts?.length ?? (data as any)?.kpi?.inventory_alerts ?? 0;

  return (
    <div>
      <PageHeader title="대시보드" description={`${data.date || ''} 기준 생산현황`} />

      {/* 📱 LOT 바코드 스캔 WMS 1초 원클릭 바로가기 퀵 배너 */}
      <div className="mb-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-bold">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base tracking-wide">LOT 바코드 스캔 WMS</h3>
              <span className="bg-emerald-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">실시간 가동</span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5">
              하드웨어 바코드 스캐너 & 스마트폰 모바일 카메라 동시 가동 (입고 · 출고 · 위치이동 1초 처리)
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/inventory/barcode-wms')}
          className="bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
        >
          <span>스캐너 바로가기</span>
          <span>→</span>
        </button>
      </div>

      {/* ════ A: 전체 파이프라인 플로우차트 ════ */}
      {workflow && workflow.pipeline && <PipelineFlow pipeline={workflow.pipeline} />}

      {/* ════ B: 수주별 진행 트래커 ════ */}
      {workflow && workflow.orders && workflow.orders.length > 0 && <OrderTracker orders={workflow.orders} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ClipboardList className="text-process-mix" />}
          label="오늘 작업지시"
          value={today.total || '0'}
          sub={`완료 ${today.completed || '0'}건 (${completedRate}%)`}
          color="blue"
        />
        <KpiCard
          icon={<Factory className="text-process-ext" />}
          label="생산실적"
          value={`${parseFloat(today.total_actual_qty || '0').toLocaleString()}`}
          sub="완료 수량 합계"
          color="green"
        />
        <KpiCard
          icon={<CheckCircle className="text-green-600" />}
          label="검사 합격률"
          value={`${inspPassRate}%`}
          sub={`최근 30일 (${inspTotal}건)`}
          color="emerald"
        />
        <KpiCard
          icon={<AlertTriangle className="text-amber-500" />}
          label="안전재고 미달"
          value={String(inventoryAlertsCount)}
          sub="품목 수"
          color="amber"
        />
      </div>

      {/* ════ C: 이카운트 ERP 스타일 그룹웨어 4종 통합 위젯 (공지사항·쪽지함·이메일·전자결재) ════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* 1. 공지사항 위젯 */}
        <div className="bg-white rounded-card border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
          <div>
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5">
              <h3 className="text-shop-base font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-lg">📢</span> 공지사항
              </h3>
              <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                최신 {data.groupware?.notices?.length || 0}건
              </span>
            </div>
            <div className="space-y-2 min-h-[140px]">
              {data.groupware?.notices && data.groupware.notices.length > 0 ? (
                data.groupware.notices.slice(0, 4).map((n, idx) => (
                  <div key={idx} className="text-xs flex items-center justify-between hover:bg-slate-50 p-1.5 rounded cursor-pointer transition-colors" onClick={() => alert(`[공지사항] ${n.title}\n\n${n.body}`)}>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-blue-500 font-bold">•</span>
                      <span className="font-semibold text-slate-700 truncate">{n.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono ml-2 flex-shrink-0">{n.created_at?.slice(0, 10)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-8">등록된 공지사항이 없습니다.</div>
              )}
            </div>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center text-xs">
            <span className="text-slate-400 text-[11px]">사내 주요 전달사항</span>
            <button onClick={() => alert('공지사항 작성 화면으로 이동합니다.')} className="text-blue-600 font-bold hover:underline">
              + 공지등록
            </button>
          </div>
        </div>

        {/* 2. 쪽지함 위젯 */}
        <div className="bg-white rounded-card border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all">
          <div>
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5">
              <h3 className="text-shop-base font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-lg">✉️</span> 쪽지함
              </h3>
              <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                수신 {data.groupware?.messages?.length || 0}건
              </span>
            </div>
            <div className="space-y-2 min-h-[140px]">
              {data.groupware?.messages && data.groupware.messages.length > 0 ? (
                data.groupware.messages.slice(0, 4).map((m, idx) => (
                  <div key={idx} className="text-xs flex items-center justify-between hover:bg-slate-50 p-1.5 rounded cursor-pointer transition-colors" onClick={() => alert(`[쪽지] ${m.title}\n\n${m.body}`)}>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-indigo-500 font-bold">📩</span>
                      <span className="font-semibold text-slate-700 truncate">{m.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono ml-2 flex-shrink-0">{m.created_at?.slice(5, 10)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-8">받은 쪽지가 없습니다.</div>
              )}
            </div>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center text-xs">
            <span className="text-slate-400 text-[11px]">사내 빠른 소통 쪽지</span>
            <button onClick={() => alert('쪽지 보내기 화면으로 이동합니다.')} className="text-indigo-600 font-bold hover:underline">
              + 쪽지쓰기
            </button>
          </div>
        </div>

        {/* 3. 이메일 (Webmail) 위젯 */}
        <div className="bg-white rounded-card border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all">
          <div>
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5">
              <h3 className="text-shop-base font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-lg">📧</span> 이메일 (Webmail)
              </h3>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                최신 {data.groupware?.emails?.length || 0}건
              </span>
            </div>
            <div className="space-y-2 min-h-[140px]">
              {data.groupware?.emails && data.groupware.emails.length > 0 ? (
                data.groupware.emails.slice(0, 4).map((e, idx) => (
                  <div key={idx} className="text-xs hover:bg-slate-50 p-1.5 rounded cursor-pointer transition-colors" onClick={() => setSelectedEmailDetail(e)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-slate-800 text-[11px] truncate max-w-[140px]">{e.sender_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{e.received_at?.slice(0, 10)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{e.subject}</p>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-8">수신 메일이 없습니다.</div>
              )}
            </div>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center text-xs">
            <span className="text-slate-400 text-[11px]">외부/고객사 업무 메일</span>
            <button onClick={() => setIsEmailModalOpen(true)} className="text-emerald-600 font-bold hover:underline">
              + 메일작성
            </button>
          </div>
        </div>

        {/* 4. 전자결재 진행상태 위젯 */}
        <div className="bg-white rounded-card border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all">
          <div>
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5">
              <h3 className="text-shop-base font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-lg">📑</span> 전자결재 진행상태
              </h3>
              <button onClick={() => navigate('/approval')} className="text-xs text-amber-700 font-bold hover:underline">
                결재함 →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3 text-center">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5">
                <p className="text-[10px] text-amber-700 font-bold">결재 대기</p>
                <p className="text-base font-black text-amber-900">{data.groupware?.approval_counts?.pending_count || 0}건</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5">
                <p className="text-[10px] text-blue-700 font-bold">진행 중</p>
                <p className="text-base font-black text-blue-900">{data.groupware?.approval_counts?.in_progress_count || 0}건</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[90px] overflow-y-auto">
              {data.groupware?.approvals && data.groupware.approvals.length > 0 ? (
                data.groupware.approvals.slice(0, 3).map((ap, idx) => (
                  <div key={idx} className="text-xs flex items-center justify-between p-1 bg-slate-50 rounded" onClick={() => navigate('/approval')}>
                    <span className="font-medium text-slate-700 truncate max-w-[150px]">{ap.doc_title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      {ap.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-2">대기 중인 결재 문서가 없습니다.</div>
              )}
            </div>
          </div>
          <div className="pt-2 border-t mt-2 flex justify-between items-center text-xs">
            <span className="text-slate-400 text-[11px]">결재/승인 워크플로우</span>
            <button onClick={() => navigate('/approval')} className="text-amber-700 font-bold hover:underline">
              + 결재 작성
            </button>
          </div>
        </div>
      </div>

      {/* ════ 🏢 현장별 발주서 접수 현황 & 🚨 재고 부족/품절 경고 위젯 ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 현장별 발주서 수주 현황 */}
        <div className="bg-white rounded-card border p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <h3 className="text-shop-base font-bold text-slate-800 flex items-center gap-2">
                <span className="text-xl">🏢</span> 현장별 발주서(수주) 접수 현황
              </h3>
              <button onClick={() => navigate('/sales/orders')} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                전체 수주서 보기 <ChevronRight size={14} />
              </button>
            </div>
            {data.site_orders_summary && data.site_orders_summary.length > 0 ? (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {data.site_orders_summary.map((order, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-lg transition-colors flex items-center justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-900 text-white font-bold text-xs px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                          🏢 {order.project_name || '판교 현장 및 일반수주'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">| {order.customer_name || '이지원 MES 수주처'}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium flex items-center gap-3">
                        <span>📦 총 {order.total_items || 1}개 품목 ({Number(order.total_qty || 100).toLocaleString()} EA)</span>
                        <span>📅 접수: {order.order_date || '-'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                        {order.status || 'ACTIVE'}
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">납기: <span className="font-bold text-blue-700">{order.delivery_date || '상시출하'}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                접수된 현장별 발주서 내역이 존재하지 않습니다.
              </div>
            )}
          </div>
        </div>

        {/* 원부자재 재고 부족 / 품절 경고 센터 */}
        <div className="bg-white rounded-card border border-red-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-red-100 pb-3 mb-3">
              <h3 className="text-shop-base font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" /> 🚨 규격(Spec)별 원부자재 합산 재고부족 알림
              </h3>
              <button onClick={() => navigate('/inventory/material-stock')} className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1">
                ➕ 재고/입고 등록 <ChevronRight size={14} />
              </button>
            </div>
            {data.shortage_inventory_alerts && data.shortage_inventory_alerts.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {data.shortage_inventory_alerts.map((item, idx) => (
                  <div
                    key={item.lot_id || idx}
                    className={cn(
                      'p-2.5 rounded-lg border flex items-center justify-between text-xs',
                      Number(item.qty_current || 0) <= 0
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {Number(item.qty_current || 0) <= 0 ? (
                          <span className="bg-red-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded animate-pulse">
                            🚨 규격 품절 (0EA)
                          </span>
                        ) : (
                          <span className="bg-amber-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">
                            ⚠️ 규격 재고부족
                          </span>
                        )}
                        <span className="font-bold text-slate-900 truncate">{item.item_name}</span>
                        <span className="font-bold text-red-700 bg-red-100/80 px-1.5 py-0.5 rounded text-[11px]">
                          규격: {item.item_spec || '표준규격'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-3">
                        <span>보유 LOT: <b className="text-blue-800">{item.lot_numbers || item.lot_number || '-'} ({item.lot_count || 1}개 LOT)</b></span>
                        <span>위치: <b className="text-emerald-800">{item.location || '-'}</b></span>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-[10px] text-slate-500 font-semibold">규격 합산 총재고</p>
                      <span className="text-sm font-black text-red-600">{Number(item.qty_current || 0).toLocaleString()}</span>
                      <span className="text-[11px] text-slate-500 font-bold"> {item.unit || 'EA'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-emerald-600 font-bold flex flex-col items-center gap-1">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                모든 규격(Spec)별 원부자재 합산 재고가 안정 수준을 유지하고 있습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 공정별 현황 */}
        <div className="col-span-1 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> 공정별 작업현황
          </h3>
          {!(data.by_process && data.by_process.length > 0) ? (
            <div className="text-center text-gray-400 py-8 text-shop-sm">오늘 작업지시 없음</div>
          ) : (
            <div className="space-y-3">
              {data.by_process.map((p) => {
                const count = parseInt(p.count || '0', 10);
                const maxCount = Math.max(...data.by_process.map((x) => parseInt(x.count || '0', 10)), 1);
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={p.process_code}>
                    <div className="flex justify-between items-center mb-1">
                      <ProcessBadge process={p.process_code as any} />
                      <span className="text-shop-sm font-mono">{count}건</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          p.process_code === 'MIX' && 'bg-process-mix',
                          p.process_code === 'EXT' && 'bg-process-ext',
                          p.process_code === 'CUT' && 'bg-process-cut',
                          p.process_code === 'ASM' && 'bg-process-asm',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 최근 작업지시 */}
        <div className="col-span-2 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2">
            <ClipboardList size={16} /> 최근 작업지시
          </h3>
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 text-left text-xs text-gray-500">지시번호</th>
                <th className="px-2 py-2 text-left text-xs text-gray-500">공정</th>
                <th className="px-2 py-2 text-left text-xs text-gray-500">품목</th>
                <th className="px-2 py-2 text-right text-xs text-gray-500">계획</th>
                <th className="px-2 py-2 text-right text-xs text-gray-500">실적</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_orders || []).map((wo, idx) => (
                <tr key={wo.wo_id || wo.wo_number || idx} className="border-b hover:bg-blue-50">
                  <td className="px-2 py-2 font-mono text-xs">{wo.wo_number}</td>
                  <td className="px-2 py-2"><ProcessBadge process={wo.process_code as any} /></td>
                  <td className="px-2 py-2 truncate max-w-[120px]">{wo.item_name || '-'}</td>
                  <td className="px-2 py-2 text-right font-mono">{wo.planned_qty || '-'}</td>
                  <td className="px-2 py-2 text-right font-mono">{wo.actual_qty || '-'}</td>
                  <td className="px-2 py-2 text-center">
                    <StatusBadge status={statusMap[wo.status] || 'PENDING'} label={statusLabel[wo.status] || wo.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안전재고 미달 */}
      {data.inventory_alerts && data.inventory_alerts.length > 0 && (
        <div className="mt-6 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2 text-amber-600">
            <Package size={16} /> 안전재고 미달 품목
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.inventory_alerts.map((item, idx) => (
              <div key={item.item_id || item.lot_id || idx} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                <div className="text-shop-sm font-medium">{item.item_name}</div>
                <div className="text-xs text-gray-500">{item.item_code || item.lot_number}</div>
                <div className="mt-2 flex justify-between text-shop-sm">
                  <span>현재: <b className="text-red-600">{parseFloat(item.balance || String(item.qty_current || 0)).toLocaleString()}</b></span>
                  <span>안전: <b>{parseFloat(item.safety_stock || '10').toLocaleString()}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주간 생산 추이 (테이블 기반) */}
      {data.weekly_production && data.weekly_production.length > 0 && (
        <div className="mt-6 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3">주간 생산 추이 (최근 7일)</h3>
          <table className="w-full text-shop-sm border">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-xs text-gray-500">날짜</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">공정</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">작업지시 수</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">생산량</th>
              </tr>
            </thead>
            <tbody>
              {data.weekly_production.map((wp, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-3 py-2">{wp.wo_date?.slice(0, 10)}</td>
                  <td className="px-3 py-2"><ProcessBadge process={wp.process_code as any} /></td>
                  <td className="px-3 py-2 text-right font-mono">{wp.wo_count}</td>
                  <td className="px-3 py-2 text-right font-mono">{parseFloat(wp.total_qty || '0').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 활동 로그 */}
      {activityLog.length > 0 && (
        <div className="mt-6 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2">
            <ClipboardList size={16} /> 활동 로그
          </h3>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {activityLog.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                {/* Severity icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {entry.severity === 'info' && <Info size={16} className="text-blue-500" />}
                  {entry.severity === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                  {entry.severity === 'error' && <AlertCircle size={16} className="text-red-500" />}
                </div>
                {/* Message + type badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-shop-sm text-gray-800">{entry.message}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium flex-shrink-0">
                      {typeLabel[entry.type] || entry.type}
                    </span>
                  </div>
                </div>
                {/* Relative time */}
                <div className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                  {relativeTime(entry.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-white rounded-card border p-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg',
          color === 'blue' && 'bg-blue-50',
          color === 'green' && 'bg-green-50',
          color === 'emerald' && 'bg-emerald-50',
          color === 'amber' && 'bg-amber-50',
        )}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-gray-400">{sub}</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// A: 전체 파이프라인 플로우차트 (관리자 뷰)
// ══════════════════════════════════════════════════
function PipelineFlow({ pipeline }: { pipeline: WorkflowData['pipeline'] }) {
  const navigate = useNavigate();

  const sales_order = pipeline?.sales_order || {};
  const purchase_request = pipeline?.purchase_request || {};
  const inspection = pipeline?.inspection || { total: '0', pass_count: '0', fail_count: '0', pending_count: '0' };
  const work_order = pipeline?.work_order || [];
  const shipment = pipeline?.shipment || {};

  const sumValues = (obj: Record<string, number>) => Object.values(obj || {}).reduce((s, v) => s + (v || 0), 0);

  // 공정별 작업지시 집계
  const woByProcess = (code: string) => {
    const items = work_order.filter(w => w?.process_code === code);
    const total = items.reduce((s, w) => s + (w?.count || 0), 0);
    const done = items.filter(w => w?.status === 'COMPLETED').reduce((s, w) => s + (w?.count || 0), 0);
    const active = items.filter(w => w?.status === 'IN_PROGRESS').reduce((s, w) => s + (w?.count || 0), 0);
    return { total, done, active };
  };

  const soTotal = sumValues(sales_order);
  const prTotal = sumValues(purchase_request);
  const inspTotal = parseInt(inspection.total || '0') || 0;
  const inspPass = parseInt(inspection.pass_count || '0') || 0;
  const inspFail = parseInt(inspection.fail_count || '0') || 0;
  const shipTotal = sumValues(shipment);
  const mix = woByProcess('MIX');
  const ext = woByProcess('EXT');
  const cut = woByProcess('CUT');
  const asm = woByProcess('ASM');

  interface StageInfo {
    key: string;
    label: string;
    icon: React.ElementType;
    count: number;
    sub: string;
    color: string;
    bgColor: string;
    path: string;
    hasIssue?: boolean;
  }

  const stages: StageInfo[] = [
    {
      key: 'order', label: '수주', icon: ShoppingCart,
      count: soTotal, sub: `등록 ${pipeline.sales_order['REGISTERED'] || 0}`,
      color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200',
      path: '/orders',
    },
    {
      key: 'purchase', label: '발주', icon: FileText,
      count: prTotal,
      sub: `승인 ${pipeline.purchase_request['APPROVED'] || 0} / 대기 ${pipeline.purchase_request['SUBMITTED'] || 0}`,
      color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200',
      path: '/orders/purchase-requests',
    },
    {
      key: 'incoming', label: '입고검사', icon: ShieldCheck,
      count: inspTotal, sub: `합격 ${inspPass} / 불합격 ${inspFail}`,
      color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200',
      path: '/quality/incoming',
      hasIssue: inspFail > 0,
    },
    {
      key: 'mix', label: '배합', icon: FlaskConical,
      count: mix.total, sub: `완료 ${mix.done} / 진행 ${mix.active}`,
      color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200',
      path: '/production/process-execution',
    },
    {
      key: 'ext', label: '압출', icon: Layers,
      count: ext.total, sub: `완료 ${ext.done} / 진행 ${ext.active}`,
      color: 'text-rose-700', bgColor: 'bg-rose-50 border-rose-200',
      path: '/production/process-execution',
    },
    {
      key: 'cut', label: '재단', icon: Scissors,
      count: cut.total, sub: `완료 ${cut.done} / 진행 ${cut.active}`,
      color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200',
      path: '/production/process-execution',
    },
    {
      key: 'asm', label: '조립', icon: Hammer,
      count: asm.total, sub: `완료 ${asm.done} / 진행 ${asm.active}`,
      color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200',
      path: '/production/process-execution',
    },
    {
      key: 'ship', label: '출하', icon: Truck,
      count: shipTotal, sub: `완료 ${pipeline.shipment['SHIPPED'] || 0}`,
      color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200',
      path: '/shipment/list',
    },
  ];

  return (
    <div className="mb-6 bg-white rounded-card border p-4">
      <h3 className="text-shop-base font-bold mb-4 flex items-center gap-2">
        <Factory size={16} className="text-blue-600" /> 전체 업무 파이프라인
      </h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center">
              <button
                onClick={() => navigate(stage.path)}
                className={cn(
                  'relative flex flex-col items-center rounded-xl border-2 px-3 py-3 min-w-[100px] transition-all hover:shadow-md hover:scale-105 cursor-pointer',
                  stage.bgColor,
                )}
              >
                {stage.hasIssue && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold">!</span>
                )}
                <Icon size={20} className={stage.color} />
                <span className={cn('text-xs font-bold mt-1', stage.color)}>{stage.label}</span>
                <span className="text-lg font-bold mt-0.5">{stage.count}</span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{stage.sub}</span>
              </button>
              {idx < stages.length - 1 && (
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// B: 수주별 진행 트래커 (실무자 뷰)
// ══════════════════════════════════════════════════
function OrderTracker({ orders }: { orders: WorkflowData['orders'] }) {
  const navigate = useNavigate();

  const stageConfig: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    path: string;
  }> = [
    { key: 'order', label: '수주', icon: ShoppingCart, path: '/orders' },
    { key: 'bom', label: 'BOM', icon: ClipboardList, path: '/orders' },
    { key: 'purchase', label: '발주', icon: FileText, path: '/orders/purchase-requests' },
    { key: 'incoming', label: '입고검사', icon: ShieldCheck, path: '/quality/incoming' },
    { key: 'mix', label: '배합', icon: FlaskConical, path: '/production/process-execution' },
    { key: 'ext', label: '압출', icon: Layers, path: '/production/process-execution' },
    { key: 'cut', label: '재단', icon: Scissors, path: '/production/process-execution' },
    { key: 'asm', label: '조립', icon: Hammer, path: '/production/process-execution' },
    { key: 'shipment', label: '출하', icon: Truck, path: '/shipment/list' },
  ];

  const statusStyle = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500 text-white border-green-500';
      case 'active': return 'bg-blue-500 text-white border-blue-500 animate-pulse';
      case 'ready': return 'bg-yellow-100 text-yellow-700 border-yellow-400';
      default: return 'bg-gray-100 text-gray-400 border-gray-200';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle size={12} />;
      case 'active': return <ArrowRight size={12} />;
      case 'ready': return <ClipboardList size={10} />;
      default: return null;
    }
  };

  const connectorColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-400';
      case 'active': return 'bg-blue-400';
      default: return 'bg-gray-200';
    }
  };

  return (
    <div className="mb-6 bg-white rounded-card border p-4">
      <h3 className="text-shop-base font-bold mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-green-600" /> 수주별 진행 현황
      </h3>
      <div className="space-y-4">
        {orders.map((order) => {
          // 전체 진행률 계산
          const totalStages = stageConfig.length;
          const doneStages = stageConfig.filter(s => order.stages[s.key] === 'done').length;
          const progressPct = Math.round((doneStages / totalStages) * 100);

          return (
            <div key={order.order_id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
              {/* 수주 정보 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-700">{order.order_number}</span>
                  <span className="text-xs text-gray-500">{order.customer_name}</span>
                  <span className="text-xs text-gray-400">{order.project_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{progressPct}%</span>
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progressPct >= 100 ? 'bg-green-500' :
                        progressPct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 단계별 플로우 */}
              <div className="flex items-center gap-0 overflow-x-auto">
                {stageConfig.map((stage, idx) => {
                  const stStatus = order.stages[stage.key] || 'waiting';
                  const Icon = stage.icon;
                  return (
                    <div key={stage.key} className="flex items-center">
                      <button
                        onClick={() => navigate(stage.path)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all hover:shadow cursor-pointer whitespace-nowrap',
                          statusStyle(stStatus),
                        )}
                        title={`${stage.label}: ${stStatus === 'done' ? '완료' : stStatus === 'active' ? '진행중' : stStatus === 'ready' ? '준비' : '대기'}`}
                      >
                        {statusIcon(stStatus) || <Icon size={11} />}
                        <span>{stage.label}</span>
                      </button>
                      {idx < stageConfig.length - 1 && (
                        <div className={cn('w-4 h-0.5 flex-shrink-0', connectorColor(stStatus))} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 요약 수치 */}
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                {order.counts.bom > 0 && <span>BOM {order.counts.bom}건</span>}
                {order.counts.pr > 0 && <span>발주 {order.counts.pr}건</span>}
                {order.counts.inspection > 0 && <span>검사 {order.counts.inspection}건</span>}
                {order.counts.wo_total > 0 && (
                  <span>작업지시 {order.counts.wo_completed}/{order.counts.wo_total}건 완료</span>
                )}
                {order.counts.shipment > 0 && <span>출하 {order.counts.shipment}건</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ───── 발주서 등록 일정 달력 ───── */}
      <DeliveryCalendar />
    </div>
  );
}

// ─── DeliveryCalendar: 자체 상태를 가진 독립 컴포넌트 ───
function DeliveryCalendar() {
  const d0 = new Date();
  const [calYear, setCalYear] = useState(d0.getFullYear());
  const [calMonth, setCalMonth] = useState(d0.getMonth() + 1);
  const [calData, setCalData] = useState<CalendarEntry[]>([]);
  const [calSelected, setCalSelected] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: CalendarEntry[] }>(`/projects/calendar?year=${calYear}&month=${calMonth}`)
      .then((res) => setCalData(res.data))
      .catch(() => {});
  }, [calYear, calMonth]);

  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const byDate: Record<string, CalendarEntry[]> = {};
  calData.forEach(e => {
    const k = (e.event_date || '').slice(0, 10);
    if (k) { (byDate[k] = byDate[k] || []).push(e); }
  });
  const selectedEntries = calSelected ? (byDate[calSelected] || []) : [];

  const projectColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-500'];
  const projectColorMap: Record<number, string> = {};
  let colorIdx = 0;
  calData.forEach(e => {
    if (!(e.project_id in projectColorMap)) {
      projectColorMap[e.project_id] = projectColors[colorIdx % projectColors.length];
      colorIdx++;
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Calendar className="h-4 w-4 text-indigo-500" />
          발주서 등록 일정
          <span className="text-xs font-normal text-slate-400 ml-1">(발주서 등록일 기준)</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const d = new Date(calYear, calMonth - 2, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth() + 1); setCalSelected(null); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          ><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold text-slate-700 w-20 text-center">{calYear}년 {calMonth}월</span>
          <button
            onClick={() => { const d = new Date(calYear, calMonth, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth() + 1); setCalSelected(null); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          ><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />발주서
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 mb-1">
        {DAYS.map(d => <div key={d} className={d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : ''}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entries = byDate[dateKey] || [];
          const isToday = dateKey === todayStr;
          const isSelected = calSelected === dateKey;
          const dow = (firstDay + i) % 7;
          return (
            <div
              key={day}
              onClick={() => setCalSelected(isSelected ? null : dateKey)}
              className={`min-h-[60px] rounded-lg p-1 cursor-pointer transition-all border ${
                isSelected ? 'border-indigo-400 bg-indigo-50' :
                entries.length > 0 ? 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50' :
                'border-transparent hover:bg-slate-50'
              }`}
            >
              <div className={`text-[11px] font-bold mb-0.5 ${
                isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]' :
                dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-500'
              }`}>{day}</div>
              <div className="space-y-0.5">
                {entries.slice(0, 3).map((e, ei) => {
                  const pName = e.project_name || '프로젝트';
                  return (
                    <div key={ei} className={`text-[9px] text-white px-1 py-0.5 rounded truncate font-semibold ${projectColorMap[e.project_id] || 'bg-indigo-500'}`}>
                      {pName.length > 6 ? pName.slice(0, 6) + '…' : pName} {e.round_no}차
                    </div>
                  );
                })}
                {entries.length > 3 && <div className="text-[9px] text-slate-400 pl-1">+{entries.length - 3}건</div>}
              </div>
            </div>
          );
        })}
      </div>

      {calSelected && selectedEntries.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-black text-slate-600 mb-2">📋 {calSelected} 발주 등록 ({selectedEntries.length}건)</p>
          <div className="space-y-1.5">
            {selectedEntries.map(e => (
              <div key={e.order_id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold ${projectColorMap[e.project_id] || 'bg-indigo-500'}`}>{e.round_no}차</span>
                <span className="font-bold text-slate-700 flex-1">{e.project_name || '프로젝트'}</span>
                <span className="text-slate-400">{e.project_customer || e.customer_name}</span>
                <span className="text-xs font-mono text-slate-500">{e.order_number}</span>
                {e.delivery_date && <span className="text-blue-600 font-mono">납기: {e.delivery_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📧 구글 메일 작성 및 실시간 발송 모달 */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="text-xl">📧</span> 구글 메일(Gmail) 실시간 작성 및 발송
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendGmail} className="space-y-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-900 font-medium">
                <p><strong>발신 계정:</strong> firemaster532nd@gmail.com (이지원 MES 구글 통합 계정)</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">수신자 이메일 주소</label>
                <input 
                  type="email" 
                  required
                  placeholder="example@client.com" 
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메일 제목</label>
                <input 
                  type="text" 
                  required
                  placeholder="[이지원 MES] 내화채움구조 견적/발주서 안내" 
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메일 본문 내용</label>
                <textarea 
                  required
                  rows={5}
                  placeholder="안녕하세요, 이지원 MES 업무 안내드립니다..." 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 font-bold hover:bg-slate-100"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  disabled={isSendingEmail}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingEmail ? '구글 메일 전송 중...' : '🚀 구글 메일 실시간 발송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📖 구글 수신 메일 상세 읽기 모달 */}
      {selectedEmailDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="text-xl">📧</span> 수신 메일 상세 내용
              </h3>
              <button onClick={() => setSelectedEmailDetail(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border p-3 rounded-xl space-y-1">
                <p className="text-slate-500 font-bold">발신자: <span className="text-slate-800 font-black">{selectedEmailDetail.sender_name}</span> ({selectedEmailDetail.sender_email})</p>
                <p className="text-slate-500 font-bold">수신일시: <span className="text-slate-700 font-mono">{selectedEmailDetail.received_at?.slice(0, 19).replace('T', ' ')}</span></p>
                <p className="text-slate-500 font-bold">제목: <span className="text-blue-900 font-black text-sm">{selectedEmailDetail.subject}</span></p>
              </div>

              <div className="border rounded-xl p-4 bg-white min-h-[120px] font-sans text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedEmailDetail.body}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button 
                onClick={() => {
                  const replyEmail = selectedEmailDetail.sender_email;
                  setSelectedEmailDetail(null);
                  setEmailRecipient(replyEmail);
                  setEmailSubject(`RE: ${selectedEmailDetail.subject}`);
                  setEmailBody(`\n\n----- Original Message -----\nFrom: ${selectedEmailDetail.sender_name} <${selectedEmailDetail.sender_email}>\nSubject: ${selectedEmailDetail.subject}`);
                  setIsEmailModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
              >
                ↩️ 이 메일에 답장하기
              </button>
              <button 
                onClick={() => setSelectedEmailDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
