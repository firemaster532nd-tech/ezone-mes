import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import {
  Play, Pause, RotateCcw, CheckCircle, UserCheck, Plus,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Package,
  Scale, PackageCheck, Trash2, Wrench, BarChart3,
} from 'lucide-react';

/* ========== Types ========== */
interface ProcessLog {
  log_id: number;
  wo_id: number;
  wo_number: string;
  wo_date: string;
  process_code: string;
  shift: string;
  worker_id: number | null;
  worker_name: string | null;
  department: string | null;
  status: string;
  planned_qty: number | null;
  produced_qty: number | null;
  defect_qty: number | null;
  started_at: string | null;
  completed_at: string | null;
  remarks: string | null;
  created_at: string;
  loss_rate: number | null;
  inventory_applied: boolean | null;
  weighed_input: number | null;
  weighed_output: number | null;
  weighed_loss: number | null;
  worker_ids?: string;   // JSON array string
  worker_names?: string; // JSON array string
}

interface LotProperty {
  prop_id: number;
  lot_number: string;
  density: number | null;
  output_length_m: number | null;
  loss_length_m: number | null;
  log_id: number | null;
}

interface ProcessEvent {
  event_id: number;
  log_id: number;
  event_type: string;
  worker_id: number | null;
  worker_name: string | null;
  reason: string | null;
  qty_at_event: number | null;
  created_at: string;
}

interface Worker {
  worker_id: number;
  worker_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
}

interface WorkOrder {
  wo_id: number;
  wo_number: string;
  process_code: string;
  status: string;
  planned_qty: number | null;
  actual_qty: number;
  item_name?: string;
  cert_name?: string;
  customer_name?: string;
  lot_number?: string;
  input_lot_numbers?: string;
}

/* ========== Constants ========== */
const shiftTabs = [
  { key: '', label: '전체' },
  { key: 'AM', label: '오전' },
  { key: 'PM', label: '오후' },
  { key: 'NIGHT', label: '야간' },
];

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합' },
  { key: 'EXT', label: '압출' },
  { key: 'CUT', label: '재단' },
  { key: 'ASM', label: '조립' },
];

const shiftLabel: Record<string, string> = { AM: '오전', PM: '오후', NIGHT: '야간' };

const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  READY: { color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300', label: '대기' },
  RUNNING: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-400', label: '작업중' },
  PAUSED: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-400', label: '일시정지' },
  COMPLETED: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-400', label: '완료' },
  CANCELLED: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400', label: '취소' },
};

const statusDot: Record<string, string> = {
  READY: 'bg-gray-400',
  RUNNING: 'bg-green-500',
  PAUSED: 'bg-yellow-500',
  COMPLETED: 'bg-blue-500',
  CANCELLED: 'bg-red-500',
};

const pauseReasons = ['자재부족', '장비고장', '품질이슈', '휴식', '기타'];

const defectTypes = [
  { value: 'appearance', label: '외관불량' },
  { value: 'dimension', label: '치수불량' },
  { value: 'physical', label: '물성불량' },
  { value: 'contamination', label: '이물질혼입' },
  { value: 'other', label: '기타' },
];

const dispositionOptions = [
  { value: 'pending', label: '대기' },
  { value: 'rework', label: '재작업' },
  { value: 'scrap', label: '폐기' },
  { value: 'downgrade', label: '등급하향' },
];

const issueTypes = [
  { value: '설비고장', label: '설비고장' },
  { value: '원료불량', label: '원료불량' },
  { value: '온도이탈', label: '온도이탈' },
  { value: '압력이상', label: '압력이상' },
  { value: '작업자실수', label: '작업자실수' },
  { value: '금형마모', label: '금형마모' },
  { value: '기타', label: '기타' },
];

/* ========== Helpers ========== */
function elapsed(startedAt: string | null): string {
  if (!startedAt) return '-';
  const ms = Date.now() - new Date(startedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function timeStr(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function yieldRate(produced: number | null, defect: number | null): string {
  const p = Number(produced) || 0;
  const d = Number(defect) || 0;
  if (p === 0) return '-';
  return ((p - d) / p * 100).toFixed(1) + '%';
}

/* ========== Main Component ========== */
export function ProcessExecutionPage() {
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [shiftFilter, setShiftFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [showCreate, setShowCreate] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<number, ProcessEvent[]>>({});

  // LOT density properties (keyed by log_id)
  const [lotProps, setLotProps] = useState<Record<number, LotProperty>>({});

  // Modal states
  const [pauseTarget, setPauseTarget] = useState<ProcessLog | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ProcessLog | null>(null);
  const [changeWorkerTarget, setChangeWorkerTarget] = useState<ProcessLog | null>(null);

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams();
    if (dateFilter) params.set('date', dateFilter);
    if (shiftFilter) params.set('shift', shiftFilter);
    if (processFilter) params.set('process_code', processFilter);
    const qs = params.toString();
    api.get<{ data: ProcessLog[] }>(`/process-logs${qs ? '?' + qs : ''}`).then((r) => setLogs(r.data));
  }, [dateFilter, shiftFilter, processFilter]);

  const fetchWorkOrders = useCallback(() => {
    api.get<{ data: WorkOrder[] }>('/work-orders?status=PLANNED,IN_PROGRESS').then((r) => setWorkOrders(r.data));
  }, []);

  useEffect(() => { fetchLogs(); fetchWorkOrders(); }, [fetchLogs, fetchWorkOrders]);

  // Fetch lot_properties for displayed logs
  useEffect(() => {
    if (logs.length === 0) return;
    const dateFrom = dateFilter || new Date().toISOString().slice(0, 10);
    api.get<{ data: LotProperty[] }>(`/lot-properties/by-process?date_from=${dateFrom}&date_to=${dateFrom}`)
      .then((r) => {
        const map: Record<number, LotProperty> = {};
        (r.data || []).forEach((lp) => {
          if (lp.log_id) map[lp.log_id] = lp;
        });
        setLotProps(map);
      })
      .catch(() => {});
  }, [logs, dateFilter]);

  const woMap = useMemo(() => {
    const m: Record<number, WorkOrder> = {};
    workOrders.forEach((w) => { m[w.wo_id] = w; });
    return m;
  }, [workOrders]);

  // Auto-refresh every 30 seconds for running processes
  useEffect(() => {
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const toggleEvents = async (logId: number) => {
    if (expandedLog === logId) {
      setExpandedLog(null);
      return;
    }
    setExpandedLog(logId);
    if (!events[logId]) {
      const res = await api.get<{ data: { events: ProcessEvent[] } }>(`/process-logs/${logId}`);
      setEvents((prev) => ({ ...prev, [logId]: res.data.events }));
    }
  };

  const handleStart = async (log: ProcessLog) => {
    try {
      await api.post(`/process-logs/${log.log_id}/start`, {});
      fetchLogs();
    } catch { alert('시작 실패'); }
  };

  return (
    <div>
      <PageHeader title="공정 실행 관리" count={logs.length} description="실시간 공정 실행 현황 및 제어">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 새 작업 시작
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-shop-sm"
        />

        {/* Shift tabs */}
        <div className="flex gap-1 border rounded-md overflow-hidden">
          {shiftTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setShiftFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 text-shop-sm font-medium transition-colors',
                shiftFilter === tab.key
                  ? 'bg-process-mix text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Process tabs */}
        <div className="flex gap-1 border rounded-md overflow-hidden">
          {processTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setProcessFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 text-shop-sm font-medium transition-colors',
                processFilter === tab.key
                  ? 'bg-process-mix text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Process Log Cards */}
      {logs.length === 0 ? (
        <div className="bg-white rounded-card border p-12 text-center text-gray-400">
          공정 실행 기록이 없습니다. '새 작업 시작' 버튼을 눌러 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {logs.map((log) => {
            const sc = statusConfig[log.status] || statusConfig.READY;
            const isExpanded = expandedLog === log.log_id;
            return (
              <div key={log.log_id} className={cn('bg-white rounded-card border-2 overflow-hidden', sc.border)}>
                {/* Header */}
                <div className={cn('px-4 py-3 flex items-center justify-between', sc.bg)}>
                  <div className="flex items-center gap-3">
                    <ProcessBadge process={log.process_code} />
                    <span className="font-mono text-shop-sm font-medium">{log.wo_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', statusDot[log.status])} />
                    <span className={cn('text-shop-sm font-semibold', sc.color)}>{sc.label}</span>
                  </div>
                </div>

                {/* Worker & Shift */}
                <div className="px-4 py-2 flex items-center justify-between text-shop-sm border-b">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-500">작업자:</span>
                    {(() => {
                      let names: string[] = [];
                      try { names = JSON.parse(log.worker_names || '[]'); } catch { names = log.worker_name ? [log.worker_name] : []; }
                      return names.length > 0 ? names.map((n, i) => (
                        <span key={i} className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-xs font-medium">{n}</span>
                      )) : <span className="text-gray-400">-</span>;
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    {(log.shift || '').split(',').filter(Boolean).map(s => (
                      <span key={s} className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {shiftLabel[s.trim()] || s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quantities */}
                <div className="px-4 py-3 grid grid-cols-4 gap-2 text-center border-b">
                  <div>
                    <div className="text-xs text-gray-500">계획</div>
                    <div className="font-mono font-bold">{log.planned_qty ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">생산</div>
                    <div className="font-mono font-bold text-green-700">{log.produced_qty ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">불량</div>
                    <div className="font-mono font-bold text-red-600">{log.defect_qty ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">수율</div>
                    <div className="font-mono font-bold">{yieldRate(log.produced_qty, log.defect_qty)}</div>
                  </div>
                </div>

                {/* Time */}
                <div className="px-4 py-2 flex items-center justify-between text-shop-sm text-gray-600 border-b">
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> 시작: {timeStr(log.started_at)}
                  </span>
                  {log.status === 'RUNNING' && (
                    <span className="text-green-700 font-medium">경과: {elapsed(log.started_at)}</span>
                  )}
                  {log.status === 'COMPLETED' && (
                    <span className="text-blue-700">완료: {timeStr(log.completed_at)}</span>
                  )}
                </div>

                {/* Status Badges */}
                {(log.loss_rate != null && Number(log.loss_rate) > 0) || (log.defect_qty != null && Number(log.defect_qty) > 0) || log.status === 'COMPLETED' ? (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b">
                    {log.loss_rate != null && Number(log.loss_rate) > 0 && (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                        Number(log.loss_rate) >= 10 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        <Scale size={11} /> 로스 {Number(log.loss_rate).toFixed(2)}%
                      </span>
                    )}
                    {lotProps[log.log_id]?.density != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700">
                        밀도 {Number(lotProps[log.log_id].density).toFixed(2)}
                      </span>
                    )}
                    {lotProps[log.log_id]?.output_length_m != null && Number(lotProps[log.log_id].output_length_m) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                        산출 {Number(lotProps[log.log_id].output_length_m).toFixed(1)}m
                      </span>
                    )}
                    {log.defect_qty != null && Number(log.defect_qty) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                        <AlertTriangle size={11} /> 불량 {Number(log.defect_qty)}ea
                      </span>
                    )}
                    {log.inventory_applied && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                        <PackageCheck size={11} /> 재고반영 &#10003;
                      </span>
                    )}
                    {!log.inventory_applied && log.status === 'COMPLETED' && (
                      <button
                        onClick={async () => {
                          try {
                            const wo = woMap[log.wo_id];
                            await api.post('/inventory/apply-process-result', {
                              log_id: log.log_id,
                              wo_id: log.wo_id,
                              process_code: log.process_code,
                              lot_number: wo?.lot_number || '',
                              input_items: [],
                              output_item_id: null,
                              output_qty: log.produced_qty || 0,
                              loss_qty: log.weighed_loss || 0,
                            });
                            fetchLogs();
                          } catch { alert('재고 반영 실패'); }
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
                      >
                        <Package size={11} /> 재고미반영
                      </button>
                    )}
                  </div>
                ) : null}

                {/* LOT 정보 */}
                {log.wo_id && woMap[log.wo_id] && (
                  <div className="px-4 py-2 border-b">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                      <Package className="h-3.5 w-3.5" /> LOT 추적 정보
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">생산 LOT:</span>
                        <span className="ml-1 font-mono font-medium">{woMap[log.wo_id]?.lot_number || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">납품처:</span>
                        <span className="ml-1">{woMap[log.wo_id]?.customer_name || '-'}</span>
                      </div>
                    </div>
                    {woMap[log.wo_id]?.input_lot_numbers && (() => {
                      const raw = woMap[log.wo_id].input_lot_numbers!;
                      let lotItems: Array<{ item_name?: string; item_code?: string; lot_number?: string; qty?: number; shortage?: boolean }> = [];
                      try { const p = JSON.parse(raw); if (Array.isArray(p)) lotItems = p; } catch { /* fallback */ }
                      return (
                        <div className="mt-1">
                          <span className="text-xs text-gray-400">투입 원료 LOT:</span>
                          {lotItems.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {lotItems.filter(it => it.lot_number).map((it, i) => (
                                <span key={i} className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono text-amber-800">
                                  {it.item_name || it.item_code} → {it.lot_number}
                                </span>
                              ))}
                              {lotItems.some(it => it.shortage) && (
                                <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] text-red-600 font-medium">
                                  일부 자재 부족
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {raw.split(',').map((lot: string, i: number) => (
                                <span key={i} className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono text-amber-800">
                                  {lot.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {log.status === 'READY' && (
                    <button
                      onClick={() => handleStart(log)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
                    >
                      <Play size={14} /> 시작
                    </button>
                  )}
                  {log.status === 'RUNNING' && (
                    <>
                      <button
                        onClick={() => setPauseTarget(log)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white rounded-md text-xs font-medium hover:bg-yellow-600"
                      >
                        <Pause size={14} /> 일시정지
                      </button>
                      <button
                        onClick={() => setChangeWorkerTarget(log)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white rounded-md text-xs font-medium hover:bg-purple-600"
                      >
                        <UserCheck size={14} /> 작업자 변경
                      </button>
                      <button
                        onClick={() => setCompleteTarget(log)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700"
                      >
                        <CheckCircle size={14} /> 완료
                      </button>
                    </>
                  )}
                  {log.status === 'PAUSED' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/process-logs/${log.log_id}/resume`, {});
                            fetchLogs();
                          } catch { alert('재개 실패'); }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
                      >
                        <RotateCcw size={14} /> 재개
                      </button>
                      <button
                        onClick={() => setCompleteTarget(log)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700"
                      >
                        <CheckCircle size={14} /> 완료
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleEvents(log.log_id)}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 ml-auto"
                  >
                    이벤트 로그
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Event Timeline */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <EventTimeline events={events[log.log_id] || []} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateProcessLogModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchLogs(); }}
        />
      )}
      {pauseTarget && (
        <PauseModal
          log={pauseTarget}
          onClose={() => setPauseTarget(null)}
          onDone={() => { setPauseTarget(null); fetchLogs(); }}
        />
      )}
      {completeTarget && (
        <CompleteModal
          log={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onDone={() => { setCompleteTarget(null); fetchLogs(); }}
        />
      )}
      {changeWorkerTarget && (
        <ChangeWorkerModal
          log={changeWorkerTarget}
          onClose={() => setChangeWorkerTarget(null)}
          onDone={() => { setChangeWorkerTarget(null); fetchLogs(); }}
        />
      )}
    </div>
  );
}

/* ========== Event Timeline ========== */
function EventTimeline({ events }: { events: ProcessEvent[] }) {
  if (events.length === 0) {
    return <div className="py-4 text-center text-gray-400 text-shop-sm">이벤트 기록이 없습니다.</div>;
  }

  const eventIcons: Record<string, { icon: string; color: string }> = {
    START: { icon: '🟢', color: 'text-green-700' },
    PAUSE: { icon: '🟡', color: 'text-yellow-700' },
    RESUME: { icon: '🟢', color: 'text-green-700' },
    COMPLETE: { icon: '✅', color: 'text-blue-700' },
    WORKER_CHANGE: { icon: '🔄', color: 'text-purple-700' },
    DEFECT: { icon: '⚠️', color: 'text-red-700' },
    NOTE: { icon: '📝', color: 'text-gray-700' },
  };

  const eventLabel: Record<string, string> = {
    START: '시작',
    PAUSE: '일시정지',
    RESUME: '재개',
    COMPLETE: '완료',
    WORKER_CHANGE: '작업자 변경',
    DEFECT: '불량 기록',
    NOTE: '메모',
  };

  return (
    <div className="pt-3 space-y-2">
      {events.map((ev) => {
        const cfg = eventIcons[ev.event_type] || { icon: '📌', color: 'text-gray-700' };
        return (
          <div key={ev.event_id} className="flex items-start gap-3 text-shop-sm">
            <span className="text-base leading-none mt-0.5">{cfg.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{timeStr(ev.created_at)}</span>
                <span className={cn('font-medium', cfg.color)}>{eventLabel[ev.event_type] || ev.event_type}</span>
                {ev.worker_name && <span className="text-gray-500">- {ev.worker_name}</span>}
              </div>
              {ev.reason && <div className="text-xs text-gray-500 mt-0.5">사유: {ev.reason}</div>}
              {ev.event_type === 'COMPLETE' && ev.qty_at_event !== null && (
                <div className="text-xs text-gray-500 mt-0.5">생산: {ev.qty_at_event}</div>
              )}
              {ev.event_type === 'DEFECT' && ev.qty_at_event !== null && (
                <div className="text-xs text-red-500 mt-0.5">불량수량: {ev.qty_at_event}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========== BOM Types ========== */
interface ProcessBomOption {
  bom_id: number;
  bom_code: string;
  bom_name: string;
  process_code: string;
  is_active: boolean;
}

/* ========== Create Process Log Modal ========== */
function CreateProcessLogModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [form, setForm] = useState({
    wo_id: '',
    process_code: 'MIX',
    planned_qty: '',
    bom_id: '',
    actual_input_qty: '',
  });
  const [selectedShifts, setSelectedShifts] = useState<string[]>(['AM']);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [processBoms, setProcessBoms] = useState<ProcessBomOption[]>([]);

  useEffect(() => {
    api.get<{ data: Worker[] }>('/workers?is_active=true').then((r) => setWorkers(r.data));
    api.get<{ data: WorkOrder[] }>('/work-orders?status=PLANNED,IN_PROGRESS').then((r) => setWorkOrders(r.data));
  }, []);

  // Fetch BOMs for selected process
  useEffect(() => {
    if (form.process_code) {
      api.get<{ data: ProcessBomOption[] }>(`/process-bom?process_code=${form.process_code}`)
        .then((r) => setProcessBoms(Array.isArray(r.data) ? r.data : (r as any).data?.data ?? []))
        .catch(() => setProcessBoms([]));
    }
    setForm(f => ({ ...f, bom_id: '' }));
  }, [form.process_code]);

  const selectedWo = workOrders.find((wo) => wo.wo_id === parseInt(form.wo_id));

  useEffect(() => {
    if (selectedWo) {
      setForm((f) => ({
        ...f,
        process_code: selectedWo.process_code,
        planned_qty: selectedWo.planned_qty?.toString() || f.planned_qty,
      }));
    }
  }, [form.wo_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShifts.length === 0 || selectedWorkerIds.length === 0) return;
    setSubmitting(true);
    try {
      const workerNames = selectedWorkerIds.map(id => workers.find(w => w.worker_id === id)?.worker_name || '');
      await api.post('/process-logs', {
        wo_id: parseInt(form.wo_id),
        process_code: form.process_code,
        shift: selectedShifts.join(','),
        worker_id: selectedWorkerIds[0],
        worker_ids: selectedWorkerIds,
        worker_names: workerNames,
        planned_qty: form.planned_qty ? parseFloat(form.planned_qty) : undefined,
      });
      onCreated();
    } catch {
      alert('생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold">새 공정 작업 시작</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">작업지시 선택</span>
            <select
              value={form.wo_id}
              onChange={(e) => setForm({ ...form, wo_id: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              required
            >
              <option value="">선택하세요</option>
              {workOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  {wo.wo_number} ({wo.process_code}) {wo.status === 'PLANNED' ? '[계획]' : '[진행중]'}
                </option>
              ))}
            </select>
          </label>

          {selectedWo?.input_lot_numbers && (() => {
            // input_lot_numbers: JSON array string 또는 comma-separated string
            let lotItems: Array<{ item_name?: string; item_code?: string; lot_number?: string; qty?: number; shortage?: boolean }> = [];
            try {
              const parsed = JSON.parse(selectedWo.input_lot_numbers);
              if (Array.isArray(parsed)) lotItems = parsed;
            } catch {
              // 단순 문자열이면 쉼표로 분리
            }

            return (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> 투입 원료 LOT 확인
                </div>
                {selectedWo.lot_number && (
                  <div className="text-xs text-amber-700 mb-1.5">
                    생산 LOT: <span className="font-mono font-medium">{selectedWo.lot_number}</span>
                  </div>
                )}
                {lotItems.length > 0 ? (
                  <div className="space-y-1">
                    {lotItems.map((item, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded bg-white border px-2 py-1 text-xs ${item.shortage ? 'border-red-300 bg-red-50' : ''}`}>
                        <span className="font-medium text-gray-800 min-w-[120px] truncate">{item.item_name || item.item_code}</span>
                        {item.lot_number ? (
                          <span className="font-mono text-blue-700">{item.lot_number}</span>
                        ) : (
                          <span className="text-red-500 font-medium">미배정</span>
                        )}
                        <span className="text-gray-500 ml-auto">{item.qty != null ? `${item.qty}` : ''}</span>
                        {item.shortage && <span className="text-[10px] text-red-600 font-medium">부족</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {selectedWo.input_lot_numbers.split(',').map((lot: string, i: number) => (
                      <span key={i} className="rounded bg-white border px-2 py-0.5 text-xs font-mono">{lot.trim()}</span>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-amber-600">위 LOT를 사용하여 작업을 진행하세요. (선입선출)</p>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">공정</span>
              <select
                value={form.process_code}
                onChange={(e) => setForm({ ...form, process_code: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              >
                <option value="MIX">배합(MIX)</option>
                <option value="EXT">압출(EXT)</option>
                <option value="CUT">재단(CUT)</option>
                <option value="ASM">조립(ASM)</option>
                <option value="SHP">출하(SHP)</option>
              </select>
            </label>
            <div className="space-y-1">
              <span className="text-shop-sm font-medium text-gray-700">교대 선택</span>
              <div className="flex gap-3 mt-1">
                {[{key:'AM',label:'오전'},{key:'PM',label:'오후'},{key:'NIGHT',label:'야간'}].map(s => (
                  <label key={s.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedShifts.includes(s.key)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedShifts(prev => [...prev, s.key]);
                        else setSelectedShifts(prev => prev.filter(x => x !== s.key));
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-shop-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-shop-sm font-medium text-gray-700">작업자 선택 ({selectedWorkerIds.length}명)</span>
            {selectedWorkerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {selectedWorkerIds.map(id => {
                  const w = workers.find(w => w.worker_id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                      {w?.worker_name}
                      <button type="button" onClick={() => setSelectedWorkerIds(prev => prev.filter(x => x !== id))} className="hover:text-red-600">x</button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                const id = parseInt(e.target.value);
                if (id && !selectedWorkerIds.includes(id)) setSelectedWorkerIds(prev => [...prev, id]);
              }}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
            >
              <option value="">+ 작업자 추가</option>
              {workers.filter(w => !selectedWorkerIds.includes(w.worker_id)).map(w => (
                <option key={w.worker_id} value={w.worker_id}>{w.worker_name} ({w.department || '-'})</option>
              ))}
            </select>
          </div>

          {/* BOM 및 실투입량 */}
          {processBoms.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-shop-sm font-medium text-gray-700">적용 BOM</span>
                <select
                  value={form.bom_id}
                  onChange={(e) => setForm({ ...form, bom_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                >
                  <option value="">선택 안함</option>
                  {processBoms.filter(b => b.is_active).map((b) => (
                    <option key={b.bom_id} value={b.bom_id}>
                      {b.bom_name} ({b.bom_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-shop-sm font-medium text-gray-700">실투입량</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.actual_input_qty}
                  onChange={(e) => setForm({ ...form, actual_input_qty: e.target.value })}
                  className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                  placeholder="실제 투입량"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">계획수량</span>
            <input
              type="number"
              value={form.planned_qty}
              onChange={(e) => setForm({ ...form, planned_qty: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !form.wo_id || selectedShifts.length === 0 || selectedWorkerIds.length === 0}
              className="px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== Pause Modal ========== */
function PauseModal({ log, onClose, onDone }: { log: ProcessLog; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/process-logs/${log.log_id}/pause`, {
        reason: reason === '기타' ? customReason : reason,
      });
      onDone();
    } catch {
      alert('일시정지 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold flex items-center gap-2">
            <Pause size={18} className="text-yellow-500" /> 일시정지
          </h2>
          <p className="text-shop-sm text-gray-500 mt-1">{log.wo_number}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="text-shop-sm font-medium text-gray-700 block mb-2">정지 사유</span>
            <div className="flex flex-wrap gap-2">
              {pauseReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border',
                    reason === r ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {reason === '기타' && (
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="block w-full rounded-md border px-3 py-2 text-shop-sm"
              placeholder="사유 입력"
            />
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button
              onClick={handleSubmit}
              disabled={!reason || submitting}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md text-shop-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '일시정지'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== Complete Modal ========== */
function CompleteModal({ log, onClose, onDone }: { log: ProcessLog; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    produced_qty: log.produced_qty?.toString() || '',
    actual_input_qty: '',
    remarks: '',
  });
  // Weight measurement
  const [weighedInput, setWeighedInput] = useState('');
  const [weighedOutput, setWeighedOutput] = useState('');
  const [weighedLossManual, setWeighedLossManual] = useState('');
  const [lossManualOverride, setLossManualOverride] = useState(false);

  // Defect registration
  const [defectEnabled, setDefectEnabled] = useState(false);
  const [defectForm, setDefectForm] = useState({
    defect_type: '',
    qty: '',
    weight: '',
    description: '',
    disposition: 'pending',
  });

  // Process issue registration
  const [issueEnabled, setIssueEnabled] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issue_type: '',
    severity: 'minor',
    description: '',
    root_cause: '',
    corrective_action: '',
    loss_impact_kg: '',
  });

  // Density conversion state (EXT/CUT)
  const [densityEnabled] = useState(log.process_code === 'EXT' || log.process_code === 'CUT');
  const [densityVal, setDensityVal] = useState('');
  const [thicknessVal, setThicknessVal] = useState(() => {
    // Pre-fill based on product type heuristic
    return '5.0';
  });
  const [widthVal, setWidthVal] = useState(() => {
    return '190';
  });

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [inventoryApplying, setInventoryApplying] = useState(false);

  // KG -> M conversion helper (same formula as backend)
  const kgToMetersCalc = (weightKg: number, d: number, tMm: number, wMm: number): number => {
    if (!weightKg || !d || !tMm || !wMm) return 0;
    const weightG = weightKg * 1000;
    const tCm = tMm / 10;
    const wCm = wMm / 10;
    const lengthCm = weightG / (d * tCm * wCm);
    return Math.round(lengthCm) / 100;
  };

  // Density conversion values
  const densityNum = parseFloat(densityVal) || 0;
  const thicknessNum = parseFloat(thicknessVal) || 0;
  const widthNum = parseFloat(widthVal) || 0;

  // Auto-calculate loss from weighed data
  const wInput = parseFloat(weighedInput) || 0;
  const wOutput = parseFloat(weighedOutput) || 0;
  const autoLoss = wInput > 0 ? Math.max(0, wInput - wOutput) : 0;
  const effectiveLoss = lossManualOverride ? (parseFloat(weighedLossManual) || 0) : autoLoss;
  const lossRate = wInput > 0 ? (effectiveLoss / wInput * 100) : 0;

  // Also compute from actual_input_qty for the PATCH
  const actualInput = parseFloat(form.actual_input_qty) || wInput;
  const producedQty = parseFloat(form.produced_qty) || 0;
  const lossQtyCalc = actualInput > 0 ? Math.max(0, actualInput - producedQty) : 0;
  const lossRateCalc = actualInput > 0 ? (lossQtyCalc / actualInput * 100) : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Complete the process log
      await api.post(`/process-logs/${log.log_id}/complete`, {
        produced_qty: producedQty,
        defect_qty: defectEnabled ? (parseFloat(defectForm.qty) || 0) : 0,
        remarks: form.remarks || undefined,
      });

      // PATCH with weighed data and loss info
      const patchData: Record<string, unknown> = {};
      if (wInput > 0) {
        patchData.weighed_input = wInput;
        patchData.weighed_output = wOutput;
        patchData.weighed_loss = effectiveLoss;
      }
      if (actualInput > 0) {
        patchData.actual_input_qty = actualInput;
        patchData.loss_qty = lossQtyCalc;
        patchData.loss_rate = parseFloat(lossRateCalc.toFixed(2));
      }
      if (Object.keys(patchData).length > 0) {
        try {
          await api.patch(`/process-logs/${log.log_id}`, patchData);
        } catch {
          console.warn('Patch weighed data failed');
        }
      }

      // Post loss record if we have actual input data
      if (actualInput > 0) {
        try {
          await api.post('/loss-records', {
            log_id: log.log_id,
            wo_id: log.wo_id,
            process_code: log.process_code,
            actual_input_qty: actualInput,
            produced_qty: producedQty,
            loss_qty: lossQtyCalc,
            loss_rate: parseFloat(lossRateCalc.toFixed(2)),
          });
        } catch {
          console.warn('Loss record save failed');
        }
      }

      // 1.5 Apply density data if provided (EXT/CUT)
      if (densityEnabled && densityNum > 0 && thicknessNum > 0 && widthNum > 0) {
        try {
          await api.post(`/process-logs/${log.log_id}/apply-density`, {
            density: densityNum,
            thickness: thicknessNum,
            width: widthNum,
          });
        } catch {
          console.warn('Density apply failed');
        }
      }

      // 2. Post defect if enabled
      if (defectEnabled && defectForm.defect_type && defectForm.qty) {
        try {
          await api.post('/defects', {
            wo_id: log.wo_id,
            log_id: log.log_id,
            lot_number: '',
            process_code: log.process_code,
            defect_type: defectForm.defect_type,
            qty: parseFloat(defectForm.qty) || 0,
            unit: 'ea',
            weight: defectForm.weight ? parseFloat(defectForm.weight) : null,
            description: defectForm.description || '',
            disposition: defectForm.disposition,
            recorded_by: log.worker_id,
          });
        } catch {
          console.warn('Defect record save failed');
        }
      }

      // 3. Post process issue if enabled
      if (issueEnabled && issueForm.issue_type && issueForm.description) {
        try {
          await api.post('/process-issues', {
            log_id: log.log_id,
            wo_id: log.wo_id,
            process_code: log.process_code,
            issue_type: issueForm.issue_type,
            severity: issueForm.severity,
            description: issueForm.description,
            root_cause: issueForm.root_cause || undefined,
            corrective_action: issueForm.corrective_action || undefined,
            loss_impact_kg: issueForm.loss_impact_kg ? parseFloat(issueForm.loss_impact_kg) : undefined,
            recorded_by: log.worker_id,
          });
        } catch {
          console.warn('Process issue save failed');
        }
      }

      setCompleted(true);
    } catch {
      alert('완료 처리 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInventoryApply = async () => {
    setInventoryApplying(true);
    try {
      await api.post('/inventory/apply-process-result', {
        log_id: log.log_id,
        wo_id: log.wo_id,
        process_code: log.process_code,
        lot_number: '',
        input_items: [],
        output_item_id: null,
        output_qty: producedQty,
        loss_qty: effectiveLoss || lossQtyCalc,
      });
      onDone();
    } catch {
      alert('재고 반영 실패');
      setInventoryApplying(false);
    }
  };

  // After completion, show inventory apply option
  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="px-6 py-4 border-b">
            <h2 className="text-shop-lg font-bold flex items-center gap-2 text-green-700">
              <CheckCircle size={18} /> 완료 처리 성공
            </h2>
          </div>
          <div className="p-6 space-y-4 text-center">
            <p className="text-shop-sm text-gray-700">작업이 성공적으로 완료되었습니다.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleInventoryApply}
                disabled={inventoryApplying}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-shop-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <PackageCheck size={16} /> {inventoryApplying ? '반영 중...' : '재고 반영'}
              </button>
              <button
                onClick={onDone}
                className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-shop-lg font-bold flex items-center gap-2">
            <CheckCircle size={18} className="text-blue-600" /> 작업 완료
          </h2>
          <p className="text-shop-sm text-gray-500 mt-1">{log.wo_number} | 계획: {log.planned_qty}</p>
        </div>
        <div className="p-6 space-y-4">
          {/* 산출수량 */}
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">산출수량 (생산수량)</span>
            <input
              type="number"
              value={form.produced_qty}
              onChange={(e) => setForm({ ...form, produced_qty: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              required
            />
          </label>

          {/* 실측 데이터 섹션 */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="text-shop-sm font-bold text-amber-800 mb-3 flex items-center gap-1.5">
              <Scale size={14} /> 실측 데이터 입력
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-amber-700">실투입량(kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={weighedInput}
                  onChange={(e) => {
                    setWeighedInput(e.target.value);
                    if (!lossManualOverride) setWeighedLossManual('');
                    setForm({ ...form, actual_input_qty: e.target.value });
                  }}
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                  placeholder="0.00"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-amber-700">실산출량(kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={weighedOutput}
                  onChange={(e) => {
                    setWeighedOutput(e.target.value);
                    if (!lossManualOverride) setWeighedLossManual('');
                  }}
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                  placeholder="0.00"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-amber-700">로스 실측(kg)</span>
                <input
                  type="number"
                  step="0.01"
                  value={lossManualOverride ? weighedLossManual : (wInput > 0 ? autoLoss.toFixed(2) : '')}
                  onChange={(e) => {
                    setLossManualOverride(true);
                    setWeighedLossManual(e.target.value);
                  }}
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                  placeholder="자동 계산"
                />
              </label>
            </div>
            {wInput > 0 && (
              <div className="mt-3 flex items-center gap-4 text-shop-sm">
                <span className="text-amber-700">로스량: <b className={effectiveLoss > 0 ? 'text-orange-600' : 'text-green-700'}>{effectiveLoss.toFixed(2)} kg</b></span>
                <span className="text-amber-700">로스율: <b className={cn(
                  'font-mono',
                  lossRate > 20 ? 'text-red-600' : lossRate > 0 ? 'text-green-700' : 'text-gray-500'
                )}>{lossRate.toFixed(2)}%</b></span>
              </div>
            )}
          </div>

          {/* 밀도·환산 정보 (EXT/CUT only) */}
          {densityEnabled && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
              <div className="text-shop-sm font-bold text-indigo-800 mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} /> 밀도·환산 정보
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-indigo-700">밀도(g/cm3)</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={densityVal}
                    onChange={(e) => setDensityVal(e.target.value)}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    placeholder="1.3200"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-indigo-700">두께(mm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={thicknessVal}
                    onChange={(e) => setThicknessVal(e.target.value)}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    placeholder="5.0"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-indigo-700">너비(mm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={widthVal}
                    onChange={(e) => setWidthVal(e.target.value)}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    placeholder="190"
                  />
                </label>
              </div>
              {densityNum > 0 && thicknessNum > 0 && widthNum > 0 && (
                <div className="mt-3 flex items-center gap-4 text-shop-sm">
                  {wOutput > 0 && (
                    <span className="text-indigo-700">
                      산출 환산: <b className="text-indigo-900 font-mono">{kgToMetersCalc(wOutput, densityNum, thicknessNum, widthNum).toFixed(2)} m</b>
                    </span>
                  )}
                  {effectiveLoss > 0 && (
                    <span className="text-indigo-700">
                      로스 환산: <b className="text-orange-600 font-mono">{kgToMetersCalc(effectiveLoss, densityNum, thicknessNum, widthNum).toFixed(2)} m</b>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 불량 등록 섹션 */}
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={defectEnabled}
                onChange={(e) => setDefectEnabled(e.target.checked)}
                className="rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-shop-sm font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle size={14} /> 불량 발생
              </span>
            </label>
            {defectEnabled && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-red-700">불량유형</span>
                    <select
                      value={defectForm.defect_type}
                      onChange={(e) => setDefectForm({ ...defectForm, defect_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    >
                      <option value="">선택</option>
                      {defectTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-red-700">불량수량</span>
                    <input
                      type="number"
                      value={defectForm.qty}
                      onChange={(e) => setDefectForm({ ...defectForm, qty: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                      placeholder="0"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-red-700">불량무게(kg)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={defectForm.weight}
                      onChange={(e) => setDefectForm({ ...defectForm, weight: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                      placeholder="선택사항"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-red-700">처리방향</span>
                    <select
                      value={defectForm.disposition}
                      onChange={(e) => setDefectForm({ ...defectForm, disposition: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    >
                      {dispositionOptions.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-red-700">상세내용</span>
                  <textarea
                    value={defectForm.description}
                    onChange={(e) => setDefectForm({ ...defectForm, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    rows={2}
                    placeholder="불량 상세 내용 입력"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 공정 이슈 등록 섹션 */}
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={issueEnabled}
                onChange={(e) => setIssueEnabled(e.target.checked)}
                className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-shop-sm font-bold text-purple-800 flex items-center gap-1.5">
                <Wrench size={14} /> 공정 이슈 기록
              </span>
            </label>
            {issueEnabled && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-purple-700">이슈 유형</span>
                    <select
                      value={issueForm.issue_type}
                      onChange={(e) => setIssueForm({ ...issueForm, issue_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    >
                      <option value="">선택</option>
                      {issueTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-purple-700">심각도</span>
                    <select
                      value={issueForm.severity}
                      onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    >
                      <option value="minor">경미 (minor)</option>
                      <option value="major">주요 (major)</option>
                      <option value="critical">심각 (critical)</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-purple-700">상세 내용</span>
                  <textarea
                    value={issueForm.description}
                    onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    rows={2}
                    placeholder="이슈 상세 내용 입력"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-purple-700">원인 분석 (선택)</span>
                    <textarea
                      value={issueForm.root_cause}
                      onChange={(e) => setIssueForm({ ...issueForm, root_cause: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                      rows={2}
                      placeholder="원인 분석"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-purple-700">개선 조치 (선택)</span>
                    <textarea
                      value={issueForm.corrective_action}
                      onChange={(e) => setIssueForm({ ...issueForm, corrective_action: e.target.value })}
                      className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                      rows={2}
                      placeholder="개선 조치 내용"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-purple-700">로스 영향(kg)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={issueForm.loss_impact_kg}
                    onChange={(e) => setIssueForm({ ...issueForm, loss_impact_kg: e.target.value })}
                    className="mt-1 block w-full rounded-md border px-2 py-1.5 text-shop-sm"
                    placeholder="선택사항"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 비고 */}
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">비고</span>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              rows={2}
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button
              onClick={handleSubmit}
              disabled={!form.produced_qty || submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '완료 처리'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== Change Worker Modal ========== */
function ChangeWorkerModal({ log, onClose, onDone }: { log: ProcessLog; onClose: () => void; onDone: () => void }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>(() => {
    try {
      const ids = JSON.parse(log.worker_ids || '[]');
      return Array.isArray(ids) ? ids : (log.worker_id ? [log.worker_id] : []);
    } catch {
      return log.worker_id ? [log.worker_id] : [];
    }
  });
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ data: Worker[] }>('/workers?is_active=true').then((r) => setWorkers(r.data));
  }, []);

  const handleSubmit = async () => {
    if (selectedWorkerIds.length === 0) return;
    setSubmitting(true);
    try {
      const workerNames = selectedWorkerIds.map(id => workers.find(w => w.worker_id === id)?.worker_name || '');
      await api.post(`/process-logs/${log.log_id}/change-worker`, {
        new_worker_id: selectedWorkerIds[0],
        new_worker_ids: selectedWorkerIds,
        new_worker_names: workerNames,
        reason: reason || `작업자 변경: ${workerNames.join(', ')}`,
      });
      onDone();
    } catch {
      alert('작업자 변경 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold flex items-center gap-2">
            <UserCheck size={18} className="text-purple-600" /> 작업자 변경
          </h2>
          <p className="text-shop-sm text-gray-500 mt-1">
            현재: {(() => {
              let names: string[] = [];
              try { names = JSON.parse(log.worker_names || '[]'); } catch { names = log.worker_name ? [log.worker_name] : []; }
              return names.length > 0 ? names.join(', ') : '-';
            })()}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <span className="text-shop-sm font-medium text-gray-700">작업자 선택 ({selectedWorkerIds.length}명)</span>
            {selectedWorkerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {selectedWorkerIds.map(id => {
                  const w = workers.find(w => w.worker_id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                      {w?.worker_name}
                      <button type="button" onClick={() => setSelectedWorkerIds(prev => prev.filter(x => x !== id))} className="hover:text-red-600">x</button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                const id = parseInt(e.target.value);
                if (id && !selectedWorkerIds.includes(id)) setSelectedWorkerIds(prev => [...prev, id]);
              }}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
            >
              <option value="">+ 작업자 추가</option>
              {workers.filter(w => !selectedWorkerIds.includes(w.worker_id)).map(w => (
                <option key={w.worker_id} value={w.worker_id}>{w.worker_name} ({w.department || '-'})</option>
              ))}
            </select>
          </div>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">변경 사유</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              placeholder="예: 점심 교대"
            />
          </label>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button
              onClick={handleSubmit}
              disabled={selectedWorkerIds.length === 0 || submitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-shop-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '변경'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
