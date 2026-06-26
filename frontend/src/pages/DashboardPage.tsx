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
    item_id: number;
    item_code: string;
    item_name: string;
    item_category: string;
    safety_stock: string;
    balance: string;
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

  useEffect(() => {
    api.get<{ data: DashboardData }>('/dashboard').then((res) => setData(res.data));
    api.get<{ data: AlertsData }>('/dashboard/alerts').then((res) => setAlerts(res.data)).catch(() => {});
    api.get<{ data: ActivityLogEntry[] }>('/dashboard/activity-log').then((res) => setActivityLog(res.data)).catch(() => {});
    api.get<{ data: WorkflowData }>('/dashboard/workflow').then((res) => setWorkflow(res.data)).catch(() => {});
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center h-96 text-gray-400">로딩 중...</div>;
  }

  const today = data.today;
  const totalWo = parseInt(today.total) || 0;
  const completedRate = totalWo > 0 ? Math.round((parseInt(today.completed) / totalWo) * 100) : 0;

  return (
    <div>
      <PageHeader title="대시보드" description={`${data.date} 기준 생산현황`} />

      {/* ════ A: 전체 파이프라인 플로우차트 ════ */}
      {workflow && <PipelineFlow pipeline={workflow.pipeline} />}

      {/* ════ B: 수주별 진행 트래커 ════ */}
      {workflow && workflow.orders.length > 0 && <OrderTracker orders={workflow.orders} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ClipboardList className="text-process-mix" />}
          label="오늘 작업지시"
          value={today.total}
          sub={`완료 ${today.completed}건 (${completedRate}%)`}
          color="blue"
        />
        <KpiCard
          icon={<Factory className="text-process-ext" />}
          label="생산실적"
          value={`${parseFloat(today.total_actual_qty).toLocaleString()}`}
          sub="완료 수량 합계"
          color="green"
        />
        <KpiCard
          icon={<CheckCircle className="text-green-600" />}
          label="검사 합격률"
          value={`${data.inspection.pass_rate}%`}
          sub={`최근 30일 (${data.inspection.total}건)`}
          color="emerald"
        />
        <KpiCard
          icon={<AlertTriangle className="text-amber-500" />}
          label="안전재고 미달"
          value={String(data.inventory_alerts.length)}
          sub="품목 수"
          color="amber"
        />
      </div>

      {/* 시스템 알림 */}
      {alerts && (
        <div className="mb-6 bg-white rounded-card border p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {alerts.failed_inspections_count === 0 &&
             alerts.pending_approvals_count === 0 &&
             alerts.safety_stock_alerts_count === 0 &&
             alerts.stalled_processes_count === 0 ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                ✅ 알림 없음
              </span>
            ) : (
              <>
                {alerts.failed_inspections_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                    <AlertCircle size={12} /> 검사 불합격 {alerts.failed_inspections_count}건
                  </span>
                )}
                {alerts.pending_approvals_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    <AlertTriangle size={12} /> 결재 대기 {alerts.pending_approvals_count}건
                  </span>
                )}
                {alerts.safety_stock_alerts_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                    <Package size={12} /> 안전재고 미달 {alerts.safety_stock_alerts_count}건
                  </span>
                )}
                {alerts.stalled_processes_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                    <Factory size={12} /> 공정 정체 {alerts.stalled_processes_count}건
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* 공정별 현황 */}
        <div className="col-span-1 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> 공정별 작업현황
          </h3>
          {data.by_process.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-shop-sm">오늘 작업지시 없음</div>
          ) : (
            <div className="space-y-3">
              {data.by_process.map((p) => {
                const count = parseInt(p.count);
                const maxCount = Math.max(...data.by_process.map((x) => parseInt(x.count)));
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
              {data.recent_orders.map((wo) => (
                <tr key={wo.wo_id} className="border-b hover:bg-blue-50">
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
      {data.inventory_alerts.length > 0 && (
        <div className="mt-6 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-3 flex items-center gap-2 text-amber-600">
            <Package size={16} /> 안전재고 미달 품목
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.inventory_alerts.map((item) => (
              <div key={item.item_id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                <div className="text-shop-sm font-medium">{item.item_name}</div>
                <div className="text-xs text-gray-500">{item.item_code}</div>
                <div className="mt-2 flex justify-between text-shop-sm">
                  <span>현재: <b className="text-red-600">{parseFloat(item.balance).toLocaleString()}</b></span>
                  <span>안전: <b>{parseFloat(item.safety_stock).toLocaleString()}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주간 생산 추이 (테이블 기반) */}
      {data.weekly_production.length > 0 && (
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
                  <td className="px-3 py-2 text-right font-mono">{parseFloat(wp.total_qty).toLocaleString()}</td>
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

  const sumValues = (obj: Record<string, number>) => Object.values(obj).reduce((s, v) => s + v, 0);

  // 공정별 작업지시 집계
  const woByProcess = (code: string) => {
    const items = pipeline.work_order.filter(w => w.process_code === code);
    const total = items.reduce((s, w) => s + w.count, 0);
    const done = items.filter(w => w.status === 'COMPLETED').reduce((s, w) => s + w.count, 0);
    const active = items.filter(w => w.status === 'IN_PROGRESS').reduce((s, w) => s + w.count, 0);
    return { total, done, active };
  };

  const soTotal = sumValues(pipeline.sales_order);
  const prTotal = sumValues(pipeline.purchase_request);
  const inspTotal = parseInt(pipeline.inspection.total) || 0;
  const inspPass = parseInt(pipeline.inspection.pass_count) || 0;
  const inspFail = parseInt(pipeline.inspection.fail_count) || 0;
  const shipTotal = sumValues(pipeline.shipment);
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
                {entries.slice(0, 3).map((e, ei) => (
                  <div key={ei} className={`text-[9px] text-white px-1 py-0.5 rounded truncate font-semibold ${projectColorMap[e.project_id] || 'bg-indigo-500'}`}>
                    {e.project_name.length > 6 ? e.project_name.slice(0, 6) + '…' : e.project_name} {e.round_no}차
                  </div>
                ))}
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
                <span className="font-bold text-slate-700 flex-1">{e.project_name}</span>
                <span className="text-slate-400">{e.project_customer || e.customer_name}</span>
                <span className="text-xs font-mono text-slate-500">{e.order_number}</span>
                {e.delivery_date && <span className="text-blue-600 font-mono">납기: {e.delivery_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
