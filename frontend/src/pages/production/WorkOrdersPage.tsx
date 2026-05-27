import { useEffect, useState, useMemo, Fragment, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Pencil, Trash2, MoreHorizontal, FlaskConical, Calculator, Layers, ChevronRight, ChevronDown, Zap, ChevronsUpDown, Play, Table2, List } from 'lucide-react';

interface WorkOrder {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  process_code: string;
  status: string;
  item_name: string | null;
  item_code: string | null;
  cert_number: string | null;
  structure_code: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  lot_number: string | null;
  inspector: string | null;
  equipment_id: string | null;
  am_worker: string | null;
  pm_worker: string | null;
  night_worker: string | null;
  start_time: string | null;
  end_time: string | null;
  input_weight_kg: number | null;
  production_length_m: number | null;
  scrap_kg: number | null;
  downtime_minutes: number | null;
  downtime_reason: string | null;
  remarks: string | null;
  cert_id: number | null;
  item_id: number | null;
  customer_name: string | null;
  input_lot_numbers: string | null;
  bom_version: string | null;
  order_id?: number | null;
  cut_spec_details?: string | null;
}

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합(MIX)' },
  { key: 'EXT', label: '압출(EXT)' },
  { key: 'CUT', label: '재단(CUT)' },
  { key: 'ASM', label: '조립(ASM)' },
];

const statusMap: Record<string, string> = {
  PLANNED: 'PENDING',
  IN_PROGRESS: 'INFO',
  COMPLETED: 'PASS',
  HOLD: 'HOLD',
};

const statusLabel: Record<string, string> = {
  PLANNED: '계획', IN_PROGRESS: '진행중', COMPLETED: '완료', HOLD: '보류',
};

export function WorkOrdersPage() {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkOrder | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([new Date().toISOString().slice(0, 10)]));
  const [showCascade, setShowCascade] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'sheet'>('list');

  const processOrderMap: Record<string, number> = { MIX: 0, EXT: 1, CUT: 2, ASM: 3, SHP: 4 };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, WorkOrder[]> = {};
    data.forEach(wo => {
      const date = wo.wo_date?.slice(0, 10) || '';
      if (!groups[date]) groups[date] = [];
      groups[date].push(wo);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, orders]) => ({
        date,
        orders: orders.sort((a, b) =>
          (processOrderMap[a.process_code] ?? 9) - (processOrderMap[b.process_code] ?? 9)
        ),
      }));
  }, [data]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleAllDates = () => {
    if (expandedDates.size === groupedByDate.length) {
      setExpandedDates(new Set());
    } else {
      setExpandedDates(new Set(groupedByDate.map(g => g.date)));
    }
  };

  const getDateSummary = (orders: WorkOrder[]) => {
    const summary: Record<string, { planned: number; actual: number; count: number; unit: string }> = {};
    orders.forEach(wo => {
      const pc = wo.process_code;
      if (!summary[pc]) summary[pc] = { planned: 0, actual: 0, count: 0, unit: ['MIX', 'EXT'].includes(pc) ? 'kg' : 'ea' };
      summary[pc].planned += wo.planned_qty || 0;
      summary[pc].actual += wo.actual_qty || 0;
      summary[pc].count++;
    });
    return summary;
  };

  const getDayLabel = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const fetchData = () => {
    const params = filter ? `?process_code=${filter}` : '';
    api.get<{ data: WorkOrder[] }>(`/work-orders${params}`).then((res) => setData(res.data));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleDelete = async (wo: WorkOrder) => {
    if (wo.status === 'COMPLETED') {
      alert('완료된 작업지시는 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`작업지시 ${wo.wo_number}을(를) 삭제하시겠습니까?\n연결된 LOT와 재고 기록도 함께 삭제됩니다.`)) return;
    try {
      await api.delete(`/work-orders/${wo.wo_id}`);
      fetchData();
    } catch {
      alert('삭제 실패');
    }
    setMenuOpen(null);
  };

  const handleStatusChange = async (wo: WorkOrder, newStatus: string) => {
    try {
      await api.patch(`/work-orders/${wo.wo_id}`, { status: newStatus });
      fetchData();
    } catch {
      alert('상태 변경 실패');
    }
    setMenuOpen(null);
  };

  // 체크박스: 선택 가능한 항목 (PLANNED 상태만)
  const selectableOrders = useMemo(() => data.filter(wo => wo.status === 'PLANNED'), [data]);

  const toggleSelect = (woId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    // 현재 보이는(expanded) PLANNED 항목만 대상
    const visibleSelectable = selectableOrders.filter(wo => expandedDates.has(wo.wo_date?.slice(0, 10) || ''));
    if (visibleSelectable.length > 0 && visibleSelectable.every(wo => selectedIds.has(wo.wo_id))) {
      // 전체 해제
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleSelectable.forEach(wo => next.delete(wo.wo_id));
        return next;
      });
    } else {
      // 전체 선택
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleSelectable.forEach(wo => next.add(wo.wo_id));
        return next;
      });
    }
  };

  const handleBatchStart = async () => {
    const targets = data.filter(wo => selectedIds.has(wo.wo_id) && wo.status === 'PLANNED');
    if (targets.length === 0) return;
    if (!confirm(`선택한 ${targets.length}건의 작업지시를 일괄 진행시작 하시겠습니까?`)) return;

    setBatchLoading(true);
    const results = await Promise.allSettled(
      targets.map(wo => api.patch(`/work-orders/${wo.wo_id}`, { status: 'IN_PROGRESS' }))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      alert(`${targets.length}건 중 ${failed}건 실패. (수입검사 미완료 등 확인 필요)`);
    }
    setSelectedIds(new Set());
    setBatchLoading(false);
    fetchData();
  };

  return (
    <div>
      <PageHeader title="작업지시 관리" count={data.length} description="MIX/EXT/CUT/ASM 4공정 작업지시">
        <div className="flex gap-2 items-center">
          {/* 뷰 전환 토글 */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                viewMode === 'list' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
              title="목록 보기"
            >
              <List size={14} /> 목록
            </button>
            <button
              onClick={() => setViewMode('sheet')}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-gray-300',
                viewMode === 'sheet' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
              title="스프레드시트 편집기"
            >
              <Table2 size={14} /> 일괄편집
            </button>
          </div>
          <button
            onClick={() => setShowCascade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-shop-sm font-medium hover:bg-indigo-700"
          >
            <Zap size={16} /> 일일 생산계획
          </button>
          {viewMode === 'list' && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90"
            >
              <Plus size={16} /> 개별 작업지시
            </button>
          )}
        </div>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key
                ? 'border-process-mix text-process-mix'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        {viewMode === 'list' && (
          <button
            onClick={toggleAllDates}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md mb-1"
          >
            <ChevronsUpDown size={14} />
            {expandedDates.size === groupedByDate.length ? '전체 접기' : '전체 펼치기'}
          </button>
        )}
      </div>

      {/* ══ 스프레드시트 편집기 ══ */}
      {viewMode === 'sheet' && (
        <SpreadsheetWorkOrderEditor
          filter={filter}
          onRefresh={fetchData}
          onEditTarget={(wo) => { setViewMode('list'); setEditTarget(wo); }}
        />
      )}

      {/* Tree Table - 날짜별 그룹 (목록 뷰에서만 표시) */}
      {viewMode === 'list' && (
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full min-w-[1050px] text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-8 px-2 py-3">
                <input
                  type="checkbox"
                  checked={selectableOrders.length > 0 && selectableOrders.filter(wo => expandedDates.has(wo.wo_date?.slice(0, 10) || '')).every(wo => selectedIds.has(wo.wo_id))}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  title="계획 상태 전체 선택"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">지시번호</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">품목</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">납품처</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">계획</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">실적</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT번호</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {groupedByDate.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  작업지시가 없습니다. '일일 생산계획' 또는 '개별 작업지시' 버튼으로 추가하세요.
                </td>
              </tr>
            ) : (
              groupedByDate.map(({ date, orders }) => {
                const isExpanded = expandedDates.has(date);
                const summary = getDateSummary(orders);
                const allCompleted = orders.every(wo => wo.status === 'COMPLETED');
                const anyInProgress = orders.some(wo => wo.status === 'IN_PROGRESS');
                const today = new Date().toISOString().slice(0, 10);

                return (
                  <Fragment key={date}>
                    {/* ── 날짜 그룹 헤더 ── */}
                    <tr
                      onClick={() => toggleDate(date)}
                      className={cn(
                        'cursor-pointer transition-colors border-b',
                        date === today ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                      )}
                    >
                      <td className="px-2 py-3 text-center">
                        {isExpanded
                          ? <ChevronDown size={16} className="text-gray-500 inline" />
                          : <ChevronRight size={16} className="text-gray-500 inline" />
                        }
                      </td>
                      <td colSpan={9} className="px-3 py-3">
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* 날짜 */}
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'font-bold text-sm',
                              date === today ? 'text-blue-800' : 'text-gray-800'
                            )}>
                              {date}
                            </span>
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-medium',
                              date === today
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-gray-200 text-gray-600'
                            )}>
                              {getDayLabel(date)}{date === today ? ' · 오늘' : ''}
                            </span>
                            {allCompleted && (
                              <span className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">전체완료</span>
                            )}
                            {anyInProgress && !allCompleted && (
                              <span className="text-[11px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">진행중</span>
                            )}
                          </div>

                          {/* 공정별 요약 뱃지 */}
                          <div className="flex items-center gap-2 ml-auto">
                            {(['MIX', 'EXT', 'CUT', 'ASM'] as const).map(pc => {
                              const s = summary[pc];
                              if (!s) return null;
                              const colorMap: Record<string, string> = {
                                MIX: 'bg-amber-100 text-amber-800 border-amber-200',
                                EXT: 'bg-green-100 text-green-800 border-green-200',
                                CUT: 'bg-purple-100 text-purple-800 border-purple-200',
                                ASM: 'bg-rose-100 text-rose-800 border-rose-200',
                              };
                              return (
                                <span
                                  key={pc}
                                  className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border', colorMap[pc])}
                                >
                                  <span className="font-bold">{pc}</span>
                                  <span className="font-mono">
                                    {s.planned.toLocaleString()}{s.unit}
                                  </span>
                                  {s.actual > 0 && (
                                    <span className="text-[10px] opacity-70">
                                      → {s.actual.toLocaleString()}{s.unit}
                                    </span>
                                  )}
                                  <span className="text-[10px] opacity-60">({s.count}건)</span>
                                </span>
                              );
                            })}
                            <span className="text-xs text-gray-500 font-medium ml-1">
                              총 {orders.length}건
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* ── 개별 작업지시 행들 ── */}
                    {isExpanded && orders.map((wo) => (
                      <tr key={wo.wo_id} className={cn("border-b hover:bg-blue-50/50 transition-colors", selectedIds.has(wo.wo_id) && "bg-blue-50")}>
                        <td className="px-2 py-2.5 text-center">
                          {wo.status === 'PLANNED' ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(wo.wo_id)}
                              onChange={() => toggleSelect(wo.wo_id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                          ) : (
                            <div className="w-4 h-px bg-gray-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          <button
                            onClick={() => setEditTarget(wo)}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {wo.wo_number}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <ProcessBadge process={wo.process_code as any} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={statusMap[wo.status] || wo.status} label={statusLabel[wo.status] || wo.status} />
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px] truncate">{wo.item_name ?? '-'}</td>
                        <td className="px-3 py-2.5 max-w-[120px] truncate">{wo.customer_name ?? '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{wo.planned_qty != null ? wo.planned_qty.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{wo.actual_qty != null ? wo.actual_qty.toLocaleString() : '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{wo.lot_number ?? '-'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (menuOpen === wo.wo_id) { setMenuOpen(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setMenuOpen(wo.wo_id);
                            }}
                            className="p-1 rounded hover:bg-gray-200"
                          >
                            <MoreHorizontal size={16} className="text-gray-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )} {/* end viewMode === 'list' */}

      {/* 드롭다운 메뉴 (fixed로 overflow 문제 해결) */}
      {menuOpen !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div
            className="fixed z-50 w-36 bg-white border rounded-md shadow-lg py-1"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {(() => {
              const wo = data.find((w) => w.wo_id === menuOpen);
              if (!wo) return null;
              return (
                <>
                  <button
                    onClick={() => { setEditTarget(wo); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Pencil size={14} /> 수정
                  </button>
                  {wo.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleStatusChange(wo, wo.status === 'PLANNED' ? 'IN_PROGRESS' : 'COMPLETED')}
                      className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      {wo.status === 'PLANNED' ? '진행 시작' : '완료 처리'}
                    </button>
                  )}
                  {wo.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleDelete(wo)}
                      className="w-full px-3 py-2 text-left text-shop-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 일괄 진행시작 플로팅 바 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl">
          <span className="text-sm font-medium">{selectedIds.size}건 선택됨</span>
          <button
            onClick={handleBatchStart}
            disabled={batchLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={14} />
            {batchLoading ? '처리중...' : '일괄 진행시작'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 일일 생산계획 일괄 생성 모달 */}
      {showCascade && (
        <CascadeCreateModal
          onClose={() => setShowCascade(false)}
          onCreated={() => { setShowCascade(false); fetchData(); }}
        />
      )}

      {/* 작업지시 생성 모달 */}
      {showCreate && (
        <CreateWorkOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}

      {/* 작업지시 수정 모달 */}
      {editTarget && (
        <EditWorkOrderModal
          wo={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchData(); }}
          onDeleted={() => { setEditTarget(null); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ========== 배합 레시피 타입 ========== */
interface CompoundingRecipe {
  recipe_id: number;
  recipe_name: string;
  recipe_code: string;
  batch_size: number;
  batch_unit: string;
  is_certified: boolean;
  is_active: boolean;
}

interface MaterialAllocation {
  item_id: number;
  item_code: string;
  item_name: string;
  qty_per_batch: number;
  ratio: number;
  required_qty: number;
  allocated_qty: number;
  shortage: number;
  lot_allocations: Array<{
    lot_id: number;
    lot_number: string;
    available_qty: number;
    allocated_qty: number;
  }>;
}

interface CalculationResult {
  recipe: { recipe_id: number; recipe_name: string; batch_size: number };
  batch_count: number;
  total_output: number;
  total_output_unit: string;
  has_shortage: boolean;
  materials: MaterialAllocation[];
}

/* ========== BOM 타입 ========== */
interface ProcessBomOption {
  bom_id: number;
  bom_code: string;
  bom_name: string;
  process_code: string;
  output_qty: number;
  output_unit: string;
  loss_rate: number;
  is_active: boolean;
}

interface BomCalcItem {
  component_name: string;
  item_name: string | null;
  item_code: string | null;
  qty_per_unit: number;
  total_qty: number;
  total_with_loss: number;
  unit: string;
  available_stock: number | null;
  is_key_material: boolean;
}

interface BomCalcResult {
  bom_id: number;
  bom_name: string;
  planned_qty: number;
  loss_rate: number;
  items: BomCalcItem[];
}

interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
}

/* ========== 생성 모달 ========== */
function CreateWorkOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    wo_date: today,
    process_code: 'MIX',
    cert_id: '',
    item_id: '',
    planned_qty: '',
    equipment_id: '',
    purpose: '',
    remarks: '',
    customer_name: '',
    lot_number: '',
    input_lot_numbers: '',
    bom_version: '',
    am_worker: '',
    pm_worker: '',
    night_worker: '',
    inspector: '',
    // MIX 전용
    mix_time_minutes: '',
    actual_weight_kg: '',
    incoming_inspection_status: '',
    raw_material_lots: '',
    // EXT 전용
    thickness_mm: '',
    width_mm: '',
    density_gcm3: '',
    expansion_mm: '',
    ext_spec: '',
    // CUT 전용
    project_site: '',
    structure_name: '',
    dimension_width: '',
    dimension_height: '',
    inner_width: '',
    inner_height: '',
    // ASM 전용
    socket_lot: '',
    sheet_lot: '',
    ceramic_lot: '',
    sealant_lot: '',
    asm_structure: '',
    asm_width: '',
    asm_height: '',
  });
  const [certs, setCerts] = useState<Array<{ cert_id: number; cert_number: string; structure_code: string }>>([]);
  const [items, setItems] = useState<Array<{ item_id: number; item_code: string; item_name: string }>>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [availableLots, setAvailableLots] = useState<any[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [lotsLoading, setLotsLoading] = useState(false);

  // Compounding (배합) state
  const [recipes, setRecipes] = useState<CompoundingRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [batchCount, setBatchCount] = useState(8);
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const isMixProcess = form.process_code === 'MIX';

  // BOM state (for all processes)
  const [processBoms, setProcessBoms] = useState<ProcessBomOption[]>([]);
  const [selectedBomId, setSelectedBomId] = useState('');
  const [bomQty, setBomQty] = useState('');
  const [bomBatchCount, setBomBatchCount] = useState(12);
  const [bomCalcResult, setBomCalcResult] = useState<BomCalcResult | null>(null);
  const [bomCalcLoading, setBomCalcLoading] = useState(false);
  // MIX BOM 품목별 사용량 (item_code → qty_per_batch)
  const [mixBomUsage, setMixBomUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    api.get<{ data: any[] }>('/certifications').then((r) => setCerts(r.data));
    api.get<{ data: any[] }>('/items').then((r) => setItems(r.data));
    api.get<{ data: Company[] }>('/companies?active=true').then((r) => setCompanies(r.data));
  }, []);

  // Fetch compounding recipes when MIX process is selected
  useEffect(() => {
    if (isMixProcess) {
      api.get<{ data: CompoundingRecipe[] }>('/compounding/recipes')
        .then((r) => setRecipes(Array.isArray(r.data) ? r.data : (r as any).data?.data ?? []))
        .catch(() => setRecipes([]));
    } else {
      setRecipes([]);
      setSelectedRecipeId('');
      setCalcResult(null);
    }
  }, [form.process_code]);

  // Fetch BOM options for selected process
  useEffect(() => {
    if (form.process_code) {
      api.get<{ data: ProcessBomOption[] }>(`/process-bom?process_code=${form.process_code}`)
        .then((r) => setProcessBoms(Array.isArray(r.data) ? r.data : (r as any).data?.data ?? []))
        .catch(() => setProcessBoms([]));
    } else {
      setProcessBoms([]);
    }
    setSelectedBomId('');
    setBomCalcResult(null);
    // 배치 기반 공정 기본값 설정
    setBomBatchCount(form.process_code === 'EXT' ? 2 : 12);
    // MIX BOM 사용량 조회
    if (form.process_code === 'MIX') {
      api.get<{ data: any[] }>('/process-bom?process_code=MIX')
        .then((r: any) => {
          const boms = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
          if (boms.length > 0 && boms[0].items) {
            const usage: Record<string, number> = {};
            boms[0].items.forEach((item: any) => { usage[item.item_code] = parseFloat(item.qty); });
            setMixBomUsage(usage);
          }
        }).catch(() => setMixBomUsage({}));
    } else {
      setMixBomUsage({});
    }
  }, [form.process_code]);

  // BOM calculate
  const handleBomCalculate = async () => {
    if (!selectedBomId) return;
    const qty = bomQty || form.planned_qty;
    if (!qty) { alert('수량을 입력하세요.'); return; }
    setBomCalcLoading(true);
    try {
      const res = await api.get<{ data: any }>(
        `/process-bom/calculate/${selectedBomId}?qty=${qty}`
      );
      const raw = (res as any).data?.data ?? (res as any).data;
      // Map API response to frontend interface
      const mapped: BomCalcResult = {
        bom_id: raw.bom?.bom_id,
        bom_name: raw.bom?.bom_name,
        planned_qty: raw.requested_output_qty,
        loss_rate: raw.bom?.loss_rate || 0,
        items: (raw.materials || []).map((m: any) => ({
          component_name: m.component_name,
          item_name: m.item_name,
          item_code: m.item_code,
          qty_per_unit: m.qty_per_unit,
          total_qty: m.qty_per_unit * raw.requested_output_qty,
          total_with_loss: m.required_qty,
          unit: m.unit || 'ea',
          available_stock: m.allocated_qty > 0 || m.lot_allocations?.length > 0 ? m.allocated_qty : null,
          is_key_material: m.is_key_material ?? true,
        })),
      };
      setBomCalcResult(mapped);
    } catch {
      alert('BOM 소요량 계산 실패');
    } finally {
      setBomCalcLoading(false);
    }
  };

  // Calculate material requirements
  const handleCalculate = async () => {
    if (!selectedRecipeId || !batchCount) return;
    setCalcLoading(true);
    try {
      const res = await api.get<{ data: CalculationResult }>(
        `/compounding/calculate?recipe_id=${selectedRecipeId}&batch_count=${batchCount}`
      );
      const result = (res as any).data?.data ?? (res as any).data;
      setCalcResult(result);

      // Auto-populate: planned_qty from API result
      if (result?.total_output) {
        setForm(prev => ({
          ...prev,
          planned_qty: result.total_output.toString(),
        }));
      }

      // Auto-select LOTs from calculation result
      if (result?.materials) {
        const autoLotIds = new Set<number>();
        result.materials.forEach((mat: MaterialAllocation) => {
          mat.lot_allocations.forEach(lot => {
            if (lot.allocated_qty > 0) autoLotIds.add(lot.lot_id);
          });
        });
        setSelectedLotIds(autoLotIds);
      }
    } catch {
      alert('소요량 계산 실패');
    } finally {
      setCalcLoading(false);
    }
  };

  // Fetch available LOTs based on selected process (FIFO order)
  useEffect(() => {
    if (!form.process_code) return;
    const categoryMap: Record<string, string> = {
      MIX: 'RM', EXT: 'SA', CUT: 'SA', ASM: 'SM',
    };
    const cat = categoryMap[form.process_code];
    if (!cat) return;
    setLotsLoading(true);
    setSelectedLotIds(new Set());
    api.get(`/inventory/available-lots?item_category=${cat}`)
      .then((res: any) => setAvailableLots(Array.isArray(res.data) ? res.data : res.data?.data ?? []))
      .catch(() => setAvailableLots([]))
      .finally(() => setLotsLoading(false));
  }, [form.process_code]);

  const toggleLot = (lotId: number) => {
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  // LOT번호 자동 제안
  const suggestLotNumber = () => {
    const d = form.wo_date.replace(/-/g, '').slice(2); // YYMMDD
    if (form.process_code === 'MIX') {
      // MIX: 배치수만큼 LOT 범위 표시 (예: 260414-S01~260414-S08)
      const count = batchCount || 1;
      if (count <= 1) return `${d}-S01`;
      return `${d}-S01~${d}-S${String(count).padStart(2, '0')}`;
    }
    if (form.process_code === 'ASM') return `J${d}D01`;
    return `${d}-S01`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Build input_lot_numbers: from calcResult (MIX) or manual selection
    let finalInputLots = form.input_lot_numbers;
    if (isMixProcess && calcResult) {
      const calcLotNumbers: string[] = [];
      calcResult.materials.forEach(mat => {
        mat.lot_allocations.filter(l => l.allocated_qty > 0).forEach(l => calcLotNumbers.push(l.lot_number));
      });
      finalInputLots = calcLotNumbers.join(', ') || finalInputLots;
    } else {
      const selectedLotNumbers = availableLots
        .filter(l => selectedLotIds.has(l.lot_id))
        .map(l => l.lot_number)
        .join(', ');
      finalInputLots = selectedLotNumbers || form.input_lot_numbers;
    }

    try {
      await api.post('/work-orders', {
        wo_date: form.wo_date,
        process_code: form.process_code,
        product_type: form.purpose || undefined,
        cert_id: form.cert_id ? parseInt(form.cert_id) : undefined,
        item_id: form.item_id ? parseInt(form.item_id) : undefined,
        planned_qty: form.planned_qty ? parseFloat(form.planned_qty) : undefined,
        equipment_id: form.equipment_id || undefined,
        purpose: form.purpose || undefined,
        remarks: form.remarks || undefined,
        customer_name: form.customer_name || undefined,
        lot_number: form.lot_number || undefined,
        input_lot_numbers: finalInputLots || undefined,
        bom_version: form.bom_version || undefined,
        am_worker: form.am_worker || undefined,
        pm_worker: form.pm_worker || undefined,
        night_worker: form.night_worker || undefined,
        inspector: form.inspector || undefined,
        // MIX 전용
        mix_time_minutes: form.mix_time_minutes ? parseInt(form.mix_time_minutes) : undefined,
        actual_weight_kg: form.actual_weight_kg ? parseFloat(form.actual_weight_kg) : undefined,
        incoming_inspection_status: form.incoming_inspection_status || undefined,
        raw_material_lots: form.raw_material_lots || undefined,
        // EXT 전용
        thickness_mm: form.thickness_mm ? parseFloat(form.thickness_mm) : undefined,
        width_mm: form.width_mm ? parseFloat(form.width_mm) : undefined,
        density_gcm3: form.density_gcm3 ? parseFloat(form.density_gcm3) : undefined,
        expansion_mm: form.expansion_mm ? parseFloat(form.expansion_mm) : undefined,
        ext_spec: form.ext_spec || undefined,
        // CUT 전용
        project_site: form.project_site || undefined,
        structure_name: form.structure_name || undefined,
        dimension_width: form.dimension_width ? parseFloat(form.dimension_width) : undefined,
        dimension_height: form.dimension_height ? parseFloat(form.dimension_height) : undefined,
        inner_width: form.inner_width ? parseFloat(form.inner_width) : undefined,
        inner_height: form.inner_height ? parseFloat(form.inner_height) : undefined,
        // ASM 전용
        socket_lot: form.socket_lot || undefined,
        sheet_lot: form.sheet_lot || undefined,
        ceramic_lot: form.ceramic_lot || undefined,
        sealant_lot: form.sealant_lot || undefined,
        asm_structure: form.asm_structure || undefined,
        asm_width: form.asm_width ? parseFloat(form.asm_width) : undefined,
        asm_height: form.asm_height ? parseFloat(form.asm_height) : undefined,
        // Compounding-specific fields (MIX recipe)
        ...(isMixProcess && selectedRecipeId ? {
          recipe_id: parseInt(selectedRecipeId),
          batch_count: batchCount,
        } : {}),
        // BOM-based batch fields (EXT, etc.)
        ...(!isMixProcess && selectedBomId ? {
          process_bom_id: parseInt(selectedBomId),
          batch_count: bomBatchCount,
        } : {}),
      });
      onCreated();
    } catch (err) {
      alert('생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold">작업지시 생성</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">작업일자</span>
              <input type="date" value={form.wo_date}
                onChange={(e) => setForm({ ...form, wo_date: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">공정</span>
              <select value={form.process_code}
                onChange={(e) => setForm({ ...form, process_code: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
                <option value="MIX">배합(MIX)</option>
                <option value="EXT">압출(EXT)</option>
                <option value="CUT">재단(CUT)</option>
                <option value="ASM">조립(ASM)</option>
                <option value="SHP">출하(SHP)</option>
              </select>
            </label>
          </div>

          {/* 배합 설정 섹션 (MIX 공정 전용) */}
          {isMixProcess && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical size={18} className="text-amber-700" />
                <span className="text-shop-sm font-bold text-amber-800">배합 설정</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-shop-sm font-medium text-amber-900">배합 레시피</span>
                  <select
                    value={selectedRecipeId}
                    onChange={(e) => { setSelectedRecipeId(e.target.value); setCalcResult(null); }}
                    className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-shop-sm"
                  >
                    <option value="">레시피 선택</option>
                    {recipes.map((r) => (
                      <option key={r.recipe_id} value={r.recipe_id}>
                        {r.recipe_name} — {r.batch_size}{r.batch_unit}/배치
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-shop-sm font-medium text-amber-900">배치 수</span>
                  <input
                    type="number"
                    value={batchCount}
                    min={1}
                    max={50}
                    onChange={(e) => {
                      const cnt = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                      setBatchCount(cnt);
                      setCalcResult(null);
                      // 배치 수 변경 시 계획수량 자동 업데이트
                      const recipe = recipes.find(r => r.recipe_id === parseInt(selectedRecipeId));
                      if (recipe) {
                        const total = recipe.batch_size * cnt;
                        setForm(prev => ({ ...prev, planned_qty: String(total) }));
                      }
                    }}
                    className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-shop-sm text-center font-mono"
                  />
                </label>
              </div>

              {/* 배치 요약: "12배치 × 300kg = 3,600 kg" */}
              {selectedRecipeId && (() => {
                const recipe = recipes.find(r => r.recipe_id === parseInt(selectedRecipeId));
                if (!recipe) return null;
                const totalQty = recipe.batch_size * batchCount;
                return (
                  <div className="flex items-center gap-3 bg-amber-100 border border-amber-300 rounded-lg px-4 py-3">
                    <div className="text-lg font-bold text-amber-900">
                      {batchCount}배치 × {recipe.batch_size.toLocaleString()}{recipe.batch_unit}
                    </div>
                    <div className="text-lg font-bold text-amber-600">=</div>
                    <div className="text-xl font-bold text-amber-900">
                      {totalQty.toLocaleString()} {recipe.batch_unit}
                    </div>
                    <div className="ml-auto text-xs text-amber-700">(기본 12배치/일)</div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleCalculate}
                disabled={!selectedRecipeId || calcLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-md text-shop-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator size={14} />
                {calcLoading ? '계산 중...' : '투입 원재료 소요량 계산'}
              </button>

              {/* 소요량 계산 결과 테이블 */}
              {calcResult && (
                <div className="mt-2 space-y-2">
                  <div className="border border-amber-300 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-amber-900">원재료</th>
                          <th className="px-3 py-2 text-right font-medium text-amber-900">배치당</th>
                          <th className="px-3 py-2 text-right font-medium text-amber-900">총 소요량</th>
                          <th className="px-3 py-2 text-center font-medium text-amber-900">가용</th>
                          <th className="px-3 py-2 text-center font-medium text-amber-900">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcResult.materials.map((mat, idx) => (
                          <tr key={idx} className="border-t border-amber-200">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800">{mat.item_name}</div>
                              <div className="text-[10px] text-gray-400">{mat.item_code} ({mat.ratio}%)</div>
                              {mat.lot_allocations.filter(l => l.allocated_qty > 0).map((lot) => (
                                <div key={lot.lot_id} className="ml-3 text-[11px] text-gray-500 mt-0.5">
                                  └ {lot.lot_number}: {lot.allocated_qty.toLocaleString()}kg (잔량 {lot.available_qty.toLocaleString()})
                                </div>
                              ))}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {mat.qty_per_batch.toLocaleString()}kg
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                              {mat.required_qty.toLocaleString()}kg
                            </td>
                            <td className="px-3 py-2 text-center">
                              {mat.allocated_qty > 0 ? (
                                <span className="text-[11px] text-gray-500">
                                  {mat.allocated_qty.toLocaleString()}kg
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {mat.shortage === 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800">
                                  ✅
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
                                  ❌ -{mat.shortage.toLocaleString()}kg
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs font-medium text-amber-800 bg-amber-100 rounded-md px-3 py-2 text-center">
                    총 배합량: {calcResult.total_output.toLocaleString()} {calcResult.total_output_unit} ({calcResult.batch_count}배치 × {calcResult.recipe?.batch_size || 300}kg)
                  </div>
                  {calcResult.has_shortage && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      일부 원재료 재고가 부족합니다. 재고 확인 후 배치 수를 조정하거나 원재료를 입고해주세요.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BOM 소요량 계산 섹션 (전 공정 - 배치 기반) */}
          {!isMixProcess && processBoms.length > 0 && (
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={18} className="text-blue-700" />
                <span className="text-shop-sm font-bold text-blue-800">BOM 소요량 계산</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-shop-sm font-medium text-blue-900">BOM 선택</span>
                  <select
                    value={selectedBomId}
                    onChange={(e) => {
                      setSelectedBomId(e.target.value);
                      setBomCalcResult(null);
                      // 선택한 BOM의 output_qty 기반으로 배치 계산
                      const bom = processBoms.find(b => b.bom_id === parseInt(e.target.value));
                      if (bom) {
                        const isBatchProcess = ['MIX', 'EXT'].includes(form.process_code);
                        if (isBatchProcess) {
                          const defBatch = form.process_code === 'EXT' ? 2 : 12;
                          setBomBatchCount(defBatch);
                          const total = bom.output_qty * defBatch;
                          setBomQty(String(total));
                          setForm(prev => ({ ...prev, planned_qty: String(total) }));
                        }
                      }
                    }}
                    className="mt-1 block w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-shop-sm"
                  >
                    <option value="">BOM 선택</option>
                    {processBoms.filter(b => b.is_active).map((b) => (
                      <option key={b.bom_id} value={b.bom_id}>
                        {b.bom_name} ({b.bom_code}) — {b.output_qty}{b.output_unit}/배치
                      </option>
                    ))}
                  </select>
                </label>

                {/* 배치 기반 공정(MIX/EXT): 배치 수 입력 */}
                {['MIX', 'EXT'].includes(form.process_code) && selectedBomId ? (
                  <label className="block">
                    <span className="text-shop-sm font-medium text-blue-900">배치 수</span>
                    <input
                      type="number"
                      value={bomBatchCount}
                      min={1}
                      max={50}
                      onChange={(e) => {
                        const cnt = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                        setBomBatchCount(cnt);
                        setBomCalcResult(null);
                        const bom = processBoms.find(b => b.bom_id === parseInt(selectedBomId));
                        if (bom) {
                          const total = bom.output_qty * cnt;
                          setBomQty(String(total));
                          setForm(prev => ({ ...prev, planned_qty: String(total) }));
                        }
                      }}
                      className="mt-1 block w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-shop-sm text-center font-mono"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-shop-sm font-medium text-blue-900">수량</span>
                    <input
                      type="number"
                      value={bomQty || form.planned_qty}
                      onChange={(e) => { setBomQty(e.target.value); setBomCalcResult(null); }}
                      className="mt-1 block w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-shop-sm text-center font-mono"
                      placeholder="계획수량"
                    />
                  </label>
                )}
              </div>

              {/* 배치 기반: "X배치 × 300kg = Y kg" 표시 */}
              {['MIX', 'EXT'].includes(form.process_code) && selectedBomId && (() => {
                const bom = processBoms.find(b => b.bom_id === parseInt(selectedBomId));
                if (!bom) return null;
                const totalQty = bom.output_qty * bomBatchCount;
                return (
                  <div className="flex items-center gap-3 bg-blue-100 border border-blue-300 rounded-lg px-4 py-3">
                    <div className="text-lg font-bold text-blue-900">
                      {bomBatchCount}배치 × {bom.output_qty.toLocaleString()}{bom.output_unit}
                    </div>
                    <div className="text-lg font-bold text-blue-600">=</div>
                    <div className="text-xl font-bold text-blue-900">
                      {totalQty.toLocaleString()} {bom.output_unit}
                    </div>
                    <div className="ml-auto text-xs text-blue-700">
                      ({form.process_code === 'EXT' ? '기본 2배치/일' : '기본 12배치/일'})
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleBomCalculate}
                disabled={!selectedBomId || bomCalcLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator size={14} />
                {bomCalcLoading ? '계산 중...' : '투입 원재료 소요량 계산'}
              </button>

              {/* BOM 계산 결과 테이블 */}
              {bomCalcResult && (
                <div className="mt-2 space-y-2">
                  <div className="border border-blue-300 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-blue-900">구성요소</th>
                          <th className="px-3 py-2 text-left font-medium text-blue-900">자재명</th>
                          <th className="px-3 py-2 text-right font-medium text-blue-900">단위소요</th>
                          <th className="px-3 py-2 text-right font-medium text-blue-900">총소요(로스포함)</th>
                          <th className="px-3 py-2 text-center font-medium text-blue-900">가용재고</th>
                          <th className="px-3 py-2 text-center font-medium text-blue-900">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomCalcResult.items?.map((item, idx) => (
                          <tr key={idx} className="border-t border-blue-200">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800">
                                {item.component_name}
                                {item.is_key_material && (
                                  <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1 rounded">핵심</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {item.item_name ? `${item.item_code} - ${item.item_name}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {item.qty_per_unit?.toLocaleString()} {item.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                              {item.total_with_loss?.toLocaleString()} {item.unit}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.available_stock !== null ? (
                                <span className="text-[11px] text-gray-500">
                                  {item.available_stock.toLocaleString()} {item.unit}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.available_stock === null || item.available_stock >= item.total_with_loss ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-800">
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
                                  부족
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs font-medium text-blue-800 bg-blue-100 rounded-md px-3 py-2 text-center">
                    {['MIX', 'EXT'].includes(form.process_code)
                      ? `${bomBatchCount}배치 × ${processBoms.find(b => b.bom_id === parseInt(selectedBomId))?.output_qty || 0}${processBoms.find(b => b.bom_id === parseInt(selectedBomId))?.output_unit || 'kg'} = 계획수량 ${bomCalcResult.planned_qty?.toLocaleString()} | 로스율 ${bomCalcResult.loss_rate}%`
                      : `로스율: ${bomCalcResult.loss_rate}% | 계획수량: ${bomCalcResult.planned_qty}`
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MIX 공정: 통합 BOM 안내 */}
          {isMixProcess && processBoms.length > 0 && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              통합 BOM도 사용 가능합니다. 마스터 관리 &gt; BOM 관리에서 확인하세요. (현재 배합 레시피를 사용 중입니다.)
            </div>
          )}

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">인정구조</span>
            <select value={form.cert_id}
              onChange={(e) => setForm({ ...form, cert_id: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
              <option value="">선택 안함</option>
              {certs.map((c) => (
                <option key={c.cert_id} value={c.cert_id}>
                  {c.cert_number} ({c.structure_code})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">품목</span>
            <select value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm">
              <option value="">선택 안함</option>
              {items.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.item_code} - {i.item_name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">
                계획수량
                {(isMixProcess && selectedRecipeId) || (!isMixProcess && selectedBomId && ['MIX', 'EXT'].includes(form.process_code))
                  ? <span className="ml-1 text-xs text-blue-500">(배치 수에 따라 자동 계산)</span>
                  : null
                }
              </span>
              <input type="number" value={form.planned_qty}
                onChange={(e) => setForm({ ...form, planned_qty: e.target.value })}
                readOnly={(isMixProcess && !!selectedRecipeId) || (!isMixProcess && !!selectedBomId && ['MIX', 'EXT'].includes(form.process_code))}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm font-mono ${
                  (isMixProcess && selectedRecipeId) || (!isMixProcess && selectedBomId && ['MIX', 'EXT'].includes(form.process_code))
                    ? 'bg-gray-100 text-gray-600' : ''
                }`} />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">설비</span>
              <input type="text" value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                placeholder="예: EXT-01" />
            </label>
          </div>
          {/* 납품처/LOT/BOM */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">납품처명</span>
              <select value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm bg-white font-medium text-gray-700">
                <option value="">거래처 선택...</option>
                {companies.map(c => (
                  <option key={c.company_id} value={c.company_name}>
                    {c.company_name} ({c.company_code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">BOM 버전</span>
              <input type="text" value={form.bom_version}
                onChange={(e) => setForm({ ...form, bom_version: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                placeholder="예: v1.0" />
            </label>
          </div>
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">LOT번호</span>
            <div className="flex gap-2 mt-1">
              <input type="text" value={form.lot_number}
                onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                className="block w-full rounded-md border px-3 py-2 text-shop-sm font-mono"
                placeholder="자동채번 또는 직접 입력" />
              <button type="button"
                onClick={() => setForm({ ...form, lot_number: suggestLotNumber() })}
                className="px-3 py-2 border rounded-md text-shop-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                자동생성
              </button>
            </div>
          </label>

          {/* 작업자/검사자 */}
          <div className="grid grid-cols-4 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">오전 작업자</span>
              <input type="text" value={form.am_worker}
                onChange={(e) => setForm({ ...form, am_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">오후 작업자</span>
              <input type="text" value={form.pm_worker}
                onChange={(e) => setForm({ ...form, pm_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">야간 작업자</span>
              <input type="text" value={form.night_worker}
                onChange={(e) => setForm({ ...form, night_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">검사자</span>
              <input type="text" value={form.inspector}
                onChange={(e) => setForm({ ...form, inspector: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>

          {/* 투입 LOT 선택 (FIFO) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                투입 원료 LOT 선택 <span className="text-xs text-blue-500">(FIFO 순서)</span>
              </label>
              {availableLots.length > 0 && (
                <div className="flex gap-1.5">
                  <button type="button"
                    onClick={() => setSelectedLotIds(new Set(availableLots.map(l => l.lot_id)))}
                    className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
                    전체선택(FIFO)
                  </button>
                  {selectedLotIds.size > 0 && (
                    <button type="button"
                      onClick={() => setSelectedLotIds(new Set())}
                      className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded hover:bg-gray-200">
                      선택해제
                    </button>
                  )}
                </div>
              )}
            </div>
            {lotsLoading ? (
              <div className="text-sm text-gray-400 py-2">LOT 조회 중...</div>
            ) : availableLots.length === 0 ? (
              <div className="text-sm text-gray-400 py-2 border rounded-lg px-3">
                {form.process_code ? '사용 가능한 LOT가 없습니다.' : '공정을 먼저 선택하세요.'}
              </div>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-8"></th>
                      <th className="px-2 py-1.5 text-left">LOT번호</th>
                      <th className="px-2 py-1.5 text-left">품목</th>
                      <th className="px-2 py-1.5 text-right">재고</th>
                      {isMixProcess && <th className="px-2 py-1.5 text-right">사용량</th>}
                      {isMixProcess && <th className="px-2 py-1.5 text-right">잔여</th>}
                      <th className="px-2 py-1.5 text-left">입고일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableLots.map((lot, idx) => {
                      const balance = parseFloat(lot.balance);
                      const usage = isMixProcess ? (mixBomUsage[lot.item_code] || 0) * batchCount : 0;
                      const remaining = balance - usage;
                      return (
                      <tr key={lot.lot_id}
                        className={cn('border-t cursor-pointer hover:bg-blue-50',
                          selectedLotIds.has(lot.lot_id) && 'bg-blue-50'
                        )}
                        onClick={() => toggleLot(lot.lot_id)}
                      >
                        <td className="px-2 py-1.5">
                          <input type="checkbox" checked={selectedLotIds.has(lot.lot_id)} readOnly className="rounded" />
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {lot.lot_number}
                          {idx === 0 && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">선입선출</span>}
                          {lot.wo_number && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">{lot.wo_number}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {lot.item_name}
                          {lot.ext_spec && <span className="ml-1 text-[9px] text-green-600 font-mono">({lot.ext_spec})</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{balance.toLocaleString()} {lot.unit}</td>
                        {isMixProcess && (
                          <td className="px-2 py-1.5 text-right font-mono text-red-600 font-medium">
                            {usage > 0 ? `-${usage.toLocaleString()}` : '-'}
                          </td>
                        )}
                        {isMixProcess && (
                          <td className={cn("px-2 py-1.5 text-right font-mono font-medium", remaining < 0 ? 'text-red-600' : 'text-green-600')}>
                            {usage > 0 ? remaining.toLocaleString() : '-'}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-gray-500">{lot.created_at?.slice(0, 10)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selectedLotIds.size > 0 && (
              <div className="mt-1.5 text-xs text-blue-600">
                선택된 LOT: {selectedLotIds.size}건 — {availableLots.filter(l => selectedLotIds.has(l.lot_id)).map(l => l.lot_number).join(', ')}
              </div>
            )}
          </div>

          {/* ===== 공정별 전용 필드 ===== */}
          {/* MIX: 배합시간, 무게실측, 입고검사 완료여부, 투입원료LOT 상세 */}
          {form.process_code === 'MIX' && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
              <div className="text-shop-sm font-bold text-orange-800">배합 공정 상세</div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-orange-900">배합시간 (분)</span>
                  <input type="number" value={form.mix_time_minutes}
                    onChange={(e) => setForm({ ...form, mix_time_minutes: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-orange-200 px-3 py-1.5 text-shop-sm" placeholder="예: 30" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-orange-900">무게 실측 (kg)</span>
                  <input type="number" step="0.01" value={form.actual_weight_kg}
                    onChange={(e) => setForm({ ...form, actual_weight_kg: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-orange-200 px-3 py-1.5 text-shop-sm" placeholder="예: 298.5" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-orange-900">입고검사 완료 여부</span>
                  <select value={form.incoming_inspection_status}
                    onChange={(e) => setForm({ ...form, incoming_inspection_status: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-orange-200 px-3 py-1.5 text-shop-sm">
                    <option value="">선택</option>
                    <option value="완료">완료</option>
                    <option value="미완료">미완료</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-orange-900">투입원료 LOT 상세 (원자재별)</span>
                <textarea value={form.raw_material_lots}
                  onChange={(e) => setForm({ ...form, raw_material_lots: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-orange-200 px-3 py-1.5 text-shop-sm" rows={2}
                  placeholder="예: 난연컴파운드-260317MB001, 흑연#50-260309EG#5001, EA33045-260303EA002" />
              </label>
            </div>
          )}

          {/* EXT: 규격(선택), 두께, 너비, 밀도, 팩창력 */}
          {form.process_code === 'EXT' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
              <div className="text-shop-sm font-bold text-green-800">압출 공정 상세</div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-green-900">두께</span>
                  <select value={form.thickness_mm}
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm({ ...form, thickness_mm: t, ext_spec: t && form.width_mm ? `${t}T×${form.width_mm}mm` : form.ext_spec });
                    }}
                    className="mt-1 block w-full rounded-md border border-green-200 px-3 py-1.5 text-shop-sm">
                    <option value="">선택</option>
                    <option value="4">4T</option>
                    <option value="5">5T</option>
                    <option value="6.5">6.5T</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-green-900">폭 (mm)</span>
                  <select value={form.width_mm}
                    onChange={(e) => {
                      const w = e.target.value;
                      setForm({ ...form, width_mm: w, ext_spec: form.thickness_mm && w ? `${form.thickness_mm}T×${w}mm` : form.ext_spec });
                    }}
                    className="mt-1 block w-full rounded-md border border-green-200 px-3 py-1.5 text-shop-sm">
                    <option value="">선택</option>
                    <option value="125">125mm</option>
                    <option value="185">185mm</option>
                    <option value="190">190mm</option>
                    <option value="225">225mm</option>
                    <option value="415">415mm</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-green-900">규격</span>
                  <input type="text" value={form.ext_spec} readOnly
                    className="mt-1 block w-full rounded-md border border-green-200 bg-green-100 px-3 py-1.5 text-shop-sm font-mono text-green-800" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-green-900">밀도 (g/cm3)</span>
                  <input type="number" step="0.0001" value={form.density_gcm3}
                    onChange={(e) => setForm({ ...form, density_gcm3: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-green-200 px-3 py-1.5 text-shop-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-green-900">팩창력 (mm)</span>
                  <input type="number" step="0.01" value={form.expansion_mm}
                    onChange={(e) => setForm({ ...form, expansion_mm: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-green-200 px-3 py-1.5 text-shop-sm" />
                </label>
              </div>
            </div>
          )}

          {/* CUT: 현장명, 구조, 규격 + 재단 규격 상세 */}
          {form.process_code === 'CUT' && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
              <div className="text-shop-sm font-bold text-purple-800">재단 공정 상세</div>
              <label className="block">
                <span className="text-xs font-medium text-purple-900">현장명 (프로젝트)</span>
                <input type="text" value={form.project_site}
                  onChange={(e) => setForm({ ...form, project_site: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm"
                  placeholder="예: 26.03.20 엘티엔지니어링_롯데건설_검단신도시" />
              </label>
              <div className="grid grid-cols-5 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">구조</span>
                  <input type="text" value={form.structure_name}
                    onChange={(e) => setForm({ ...form, structure_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm"
                    placeholder="VT-049" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">가로 (mm)</span>
                  <input type="number" value={form.dimension_width}
                    onChange={(e) => setForm({ ...form, dimension_width: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">세로 (mm)</span>
                  <input type="number" value={form.dimension_height}
                    onChange={(e) => setForm({ ...form, dimension_height: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">내부 가로</span>
                  <input type="number" value={form.inner_width}
                    onChange={(e) => setForm({ ...form, inner_width: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">내부 세로</span>
                  <input type="number" value={form.inner_height}
                    onChange={(e) => setForm({ ...form, inner_height: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-purple-200 px-3 py-1.5 text-shop-sm" />
                </label>
              </div>

              {/* 재단 규격 상세는 투입 LOT 위에 별도 표시 */}
            </div>
          )}

          {/* ASM: 투입LOT 4종, 구조명, 규격 */}
          {form.process_code === 'ASM' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-3">
              <div className="text-shop-sm font-bold text-rose-800">조립 공정 상세</div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">구조명</span>
                  <input type="text" value={form.asm_structure}
                    onChange={(e) => setForm({ ...form, asm_structure: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm"
                    placeholder="VT-049" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">규격 가로 (mm)</span>
                  <input type="number" value={form.asm_width}
                    onChange={(e) => setForm({ ...form, asm_width: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">규격 세로 (mm)</span>
                  <input type="number" value={form.asm_height}
                    onChange={(e) => setForm({ ...form, asm_height: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">투입 소켓/철판 LOT</span>
                  <input type="text" value={form.socket_lot}
                    onChange={(e) => setForm({ ...form, socket_lot: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm"
                    placeholder="예: 260324GI073" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">투입 시트 LOT</span>
                  <input type="text" value={form.sheet_lot}
                    onChange={(e) => setForm({ ...form, sheet_lot: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm"
                    placeholder="예: 260313-S05" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">투입 차열재 LOT</span>
                  <input type="text" value={form.ceramic_lot}
                    onChange={(e) => setForm({ ...form, ceramic_lot: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm"
                    placeholder="예: 260203CW001" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">투입 실란트 LOT</span>
                  <input type="text" value={form.sealant_lot}
                    onChange={(e) => setForm({ ...form, sealant_lot: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-rose-200 px-3 py-1.5 text-shop-sm"
                    placeholder="예: 260220SS001" />
                </label>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">비고</span>
            <textarea value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" rows={2} />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== 수정 모달 ========== */
function EditWorkOrderModal({ wo, onClose, onSaved, onDeleted }: { wo: WorkOrder; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [form, setForm] = useState({
    status: wo.status,
    planned_qty: wo.planned_qty?.toString() || '',
    actual_qty: wo.actual_qty?.toString() || '',
    equipment_id: wo.equipment_id || '',
    am_worker: wo.am_worker || '',
    pm_worker: wo.pm_worker || '',
    night_worker: wo.night_worker || '',
    inspector: wo.inspector || '',
    start_time: wo.start_time?.slice(0, 5) || '',
    end_time: wo.end_time?.slice(0, 5) || '',
    input_weight_kg: wo.input_weight_kg?.toString() || '',
    production_length_m: wo.production_length_m?.toString() || '',
    scrap_kg: wo.scrap_kg?.toString() || '',
    downtime_minutes: wo.downtime_minutes?.toString() || '',
    downtime_reason: wo.downtime_reason || '',
    remarks: wo.remarks || '',
    customer_name: wo.customer_name || '',
    lot_number: wo.lot_number || '',
    input_lot_numbers: wo.input_lot_numbers || '',
    bom_version: wo.bom_version || '',
    order_id: wo.order_id || null,
    cut_spec_details: wo.cut_spec_details || '',
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [availableLots, setAvailableLots] = useState<any[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [lotsLoading, setLotsLoading] = useState(false);
  const [editMixBomUsage, setEditMixBomUsage] = useState<Record<string, number>>({});
  const isMixWo = wo.process_code === 'MIX';
  const editBatchCount = isMixWo ? Math.round((parseFloat(wo.planned_qty?.toString() || '0')) / 300) || 1 : 1;

  useEffect(() => {
    api.get<{ data: Company[] }>('/companies?active=true')
      .then((r) => setCompanies(r.data))
      .catch(() => setCompanies([]));
  }, []);

  // CUT Spec spreadsheet state and effects
  const [cutSpecRows, setCutSpecRows] = useState<any[]>([]);
  const [cutSpecsLoaded, setCutSpecsLoaded] = useState(false);
  const isCutWo = wo.process_code === 'CUT';

  useEffect(() => {
    if (!isCutWo) return;
    api.get(`/work-orders/${wo.wo_id}/cut-specs`)
      .then((res: any) => {
        const d = res.data?.data ?? res.data ?? null;
        if (d?.structures) {
          setCutSpecRows(d.structures);
        } else {
          setCutSpecRows([]);
        }
        setCutSpecsLoaded(true);
      })
      .catch(() => {
        setCutSpecRows([]);
        setCutSpecsLoaded(true);
      });
  }, [wo.wo_id, isCutWo]);

  // Sync spreadsheet rows with main planned/actual sets and serialize JSON
  useEffect(() => {
    if (!isCutWo || !cutSpecsLoaded) return;
    const totalPlanned = cutSpecRows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
    const totalActual = cutSpecRows.reduce((sum, r) => sum + (parseFloat(r.actual_qty ?? r.qty) || 0), 0);
    setForm(f => ({
      ...f,
      planned_qty: String(totalPlanned),
      actual_qty: String(totalActual),
      cut_spec_details: JSON.stringify(cutSpecRows.map(r => ({
        structure_code: r.structure_code || '',
        structure_name: r.structure_name || '',
        qty: parseFloat(r.qty) || 0,
        actual_qty: parseFloat(r.actual_qty ?? r.qty) || 0,
        penetration_w: parseFloat(r.penetration_w || r.dimension_width) || 0,
        penetration_h: parseFloat(r.penetration_h || r.dimension_height) || 0,
      })))
    }));
  }, [cutSpecRows, cutSpecsLoaded, isCutWo]);

  // Fetch available LOTs for the work order's process
  useEffect(() => {
    if (!wo.process_code) return;
    const categoryMap: Record<string, string> = {
      MIX: 'RM', EXT: 'SA', CUT: 'SA', ASM: 'SM',
    };
    const cat = categoryMap[wo.process_code];
    if (!cat) return;
    setLotsLoading(true);
    api.get(`/inventory/available-lots?item_category=${cat}`)
      .then((res: any) => setAvailableLots(Array.isArray(res.data) ? res.data : res.data?.data ?? []))
      .catch(() => setAvailableLots([]))
      .finally(() => setLotsLoading(false));
    // MIX BOM 사용량 조회
    if (isMixWo) {
      api.get<{ data: any[] }>('/process-bom?process_code=MIX')
        .then((r: any) => {
          const boms = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
          if (boms[0]?.items) {
            const usage: Record<string, number> = {};
            boms[0].items.forEach((item: any) => { usage[item.item_code] = parseFloat(item.qty); });
            setEditMixBomUsage(usage);
          }
        }).catch(() => {});
    }
  }, [wo.process_code]);

  // Pre-select LOTs that match current input_lot_numbers
  useEffect(() => {
    if (availableLots.length === 0 || !wo.input_lot_numbers) return;
    const existingNums = wo.input_lot_numbers.split(',').map(s => s.trim()).filter(Boolean);
    const matchIds = new Set<number>();
    availableLots.forEach(lot => {
      if (existingNums.includes(lot.lot_number)) matchIds.add(lot.lot_id);
    });
    if (matchIds.size > 0) setSelectedLotIds(matchIds);
  }, [availableLots, wo.input_lot_numbers]);

  const toggleLot = (lotId: number) => {
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  // 투입 LOT 선택 시 투입량(kg) 자동계산
  useEffect(() => {
    if (selectedLotIds.size === 0) return;
    if (isMixWo && Object.keys(editMixBomUsage).length > 0) {
      // MIX: BOM 사용량 합계 (배치수 × 1배치당 사용량)
      const totalUsage = Object.values(editMixBomUsage).reduce((sum, qty) => sum + qty, 0) * editBatchCount;
      setForm(f => ({ ...f, input_weight_kg: String(Math.round(totalUsage * 100) / 100) }));
    } else {
      // 기타 공정: 선택 LOT 잔량 합계
      const totalWeight = availableLots
        .filter(l => selectedLotIds.has(l.lot_id))
        .reduce((sum, l) => sum + parseFloat(l.balance || 0), 0);
      if (totalWeight > 0) {
        setForm(f => ({ ...f, input_weight_kg: String(Math.round(totalWeight * 100) / 100) }));
      }
    }
  }, [selectedLotIds, availableLots, editMixBomUsage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Build input_lot_numbers from selected LOTs (or fallback to manual text)
    const selectedLotNumbers = availableLots
      .filter(l => selectedLotIds.has(l.lot_id))
      .map(l => l.lot_number)
      .join(', ');
    const finalInputLots = selectedLotNumbers || form.input_lot_numbers;
    try {
      const payload: Record<string, unknown> = {};
      if (form.status !== wo.status) payload.status = form.status;
      if (form.planned_qty) payload.planned_qty = parseFloat(form.planned_qty);
      if (form.actual_qty) payload.actual_qty = parseFloat(form.actual_qty);
      if (form.equipment_id) payload.equipment_id = form.equipment_id;
      if (form.am_worker) payload.am_worker = form.am_worker;
      if (form.pm_worker) payload.pm_worker = form.pm_worker;
      if (form.inspector) payload.inspector = form.inspector;
      if (form.start_time) payload.start_time = form.start_time;
      if (form.end_time) payload.end_time = form.end_time;
      if (form.input_weight_kg) payload.input_weight_kg = parseFloat(form.input_weight_kg);
      if (form.production_length_m) payload.production_length_m = parseFloat(form.production_length_m);
      if (form.scrap_kg) payload.scrap_kg = parseFloat(form.scrap_kg);
      if (form.downtime_minutes) payload.downtime_minutes = parseInt(form.downtime_minutes);
      if (form.night_worker) payload.night_worker = form.night_worker;
      if (form.downtime_reason) payload.downtime_reason = form.downtime_reason;
      payload.remarks = form.remarks;
      payload.customer_name = form.customer_name || null;
      payload.lot_number = form.lot_number || null;
      payload.input_lot_numbers = finalInputLots || null;
      payload.bom_version = form.bom_version || null;

      if (wo.process_code === 'CUT') {
        payload.order_id = form.order_id || null;
        payload.cut_spec_details = form.cut_spec_details || null;
      }

      await api.patch(`/work-orders/${wo.wo_id}`, payload);
      onSaved();
    } catch {
      alert('수정 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const isCompleted = wo.status === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-shop-lg font-bold">작업지시 수정</h2>
            <p className="text-shop-sm text-gray-500">{wo.wo_number} · {wo.wo_date?.slice(0, 10)}</p>
          </div>
          <ProcessBadge process={wo.process_code} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 상태 변경 */}
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">상태</span>
              <select value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                disabled={isCompleted}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm disabled:bg-gray-100">
                <option value="PLANNED">계획</option>
                <option value="IN_PROGRESS">진행중</option>
                <option value="COMPLETED">완료</option>
                <option value="HOLD">보류</option>
              </select>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">계획수량</span>
              <input type="number" value={form.planned_qty}
                readOnly={wo.process_code === 'CUT'}
                onChange={(e) => setForm({ ...form, planned_qty: e.target.value })}
                className={cn("mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm", wo.process_code === 'CUT' && "bg-gray-100 cursor-not-allowed")} />
              {wo.process_code === 'CUT' && <span className="text-[10px] text-purple-600 font-medium">재단 규격 수량 자동 합산</span>}
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">실적수량</span>
              <input type="number" value={form.actual_qty}
                readOnly={wo.process_code === 'CUT'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (wo.process_code === 'MIX') {
                    setForm({ ...form, actual_qty: v, production_length_m: v });
                  } else {
                    setForm({ ...form, actual_qty: v });
                  }
                }}
                className={cn("mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm", wo.process_code === 'CUT' && "bg-gray-100 cursor-not-allowed")} />
              {wo.process_code === 'CUT' && <span className="text-[10px] text-purple-600 font-medium">재단 규격 수량 자동 합산</span>}
            </label>
          </div>

          {/* 납품처/LOT/BOM */}
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">납품처명</span>
              <select value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm bg-white font-medium text-gray-700">
                <option value="">거래처 선택...</option>
                {companies.map(c => (
                  <option key={c.company_id} value={c.company_name}>
                    {c.company_name} ({c.company_code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">LOT번호</span>
              <input type="text" value={form.lot_number}
                onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm font-mono" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">BOM 버전</span>
              <input type="text" value={form.bom_version}
                onChange={(e) => setForm({ ...form, bom_version: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>

          {/* 작업자/설비 */}
          <div className="grid grid-cols-4 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">설비</span>
              <input type="text" value={form.equipment_id}
                onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">오전 작업자</span>
              <input type="text" value={form.am_worker}
                onChange={(e) => setForm({ ...form, am_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">오후 작업자</span>
              <input type="text" value={form.pm_worker}
                onChange={(e) => setForm({ ...form, pm_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">야간 작업자</span>
              <input type="text" value={form.night_worker}
                onChange={(e) => setForm({ ...form, night_worker: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>

          {/* 시간/검사 */}
          <div className="grid grid-cols-4 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">시작시간</span>
              <input type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">종료시간</span>
              <input type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">검사자</span>
              <input type="text" value={form.inspector}
                onChange={(e) => setForm({ ...form, inspector: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">중단시간(분)</span>
              <input type="number" value={form.downtime_minutes}
                onChange={(e) => setForm({ ...form, downtime_minutes: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>

          {/* 생산실적 */}
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">투입량(kg)</span>
              <input type="number" step="0.01" value={form.input_weight_kg} readOnly={wo.process_code === 'MIX'}
                onChange={(e) => setForm({ ...form, input_weight_kg: e.target.value })}
                className={cn("mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm",
                  wo.process_code === 'MIX' && "bg-gray-50")} />
              {wo.process_code === 'MIX' && <span className="text-[10px] text-gray-400">투입 LOT 선택 시 자동계산</span>}
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">
                {wo.process_code === 'MIX' ? '생산량(kg)' : '생산길이(m)'}
              </span>
              <input type="number" step="0.01" value={form.production_length_m}
                onChange={(e) => {
                  const v = e.target.value;
                  if (wo.process_code === 'MIX') {
                    setForm({ ...form, production_length_m: v, actual_qty: v });
                  } else {
                    setForm({ ...form, production_length_m: v });
                  }
                }}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">스크랩(kg)</span>
              <input type="number" step="0.01" value={form.scrap_kg}
                onChange={(e) => setForm({ ...form, scrap_kg: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
            </label>
          </div>

          {/* MIX: 배치별 LOT 상세 */}
          {wo.process_code === 'MIX' && wo?.wo_id && (
            <MixBatchLotsDetail woId={wo.wo_id} actualQty={parseFloat(form.actual_qty) || parseFloat(form.planned_qty) || 0}
              onTotalChange={(total) => setForm(f => ({ ...f, actual_qty: String(total), production_length_m: String(total) }))} />
          )}

          {/* CUT: 재단 규격 상세 - 투입 LOT 위에 바로 표시 */}
          {wo.process_code === 'CUT' && wo?.wo_id && (
            <CutSpecsDetail
              woId={wo.wo_id}
              itemCode={wo.item_code}
              isEdit={!isCompleted}
              rows={cutSpecRows}
              onChange={setCutSpecRows}
            />
          )}

          {/* 투입 LOT 선택 (FIFO) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              투입 원료 LOT 선택 <span className="text-xs text-blue-500">(FIFO 순서)</span>
            </label>
            {lotsLoading ? (
              <div className="text-sm text-gray-400 py-2">LOT 조회 중...</div>
            ) : availableLots.length === 0 ? (
              <div className="text-sm text-gray-400 py-2 border rounded-lg px-3">
                사용 가능한 LOT가 없습니다.
              </div>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-8">
                        <input type="checkbox"
                          checked={availableLots.length > 0 && selectedLotIds.size === availableLots.length}
                          onChange={() => {
                            if (selectedLotIds.size === availableLots.length) {
                              setSelectedLotIds(new Set());
                            } else {
                              setSelectedLotIds(new Set(availableLots.map(l => l.lot_id)));
                            }
                          }}
                          className="rounded" />
                      </th>
                      <th className="px-2 py-1.5 text-left">LOT번호</th>
                      <th className="px-2 py-1.5 text-left">품목</th>
                      <th className="px-2 py-1.5 text-right">재고</th>
                      {isMixWo && <th className="px-2 py-1.5 text-right">사용량</th>}
                      {isMixWo && <th className="px-2 py-1.5 text-right">잔여</th>}
                      <th className="px-2 py-1.5 text-left">입고일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableLots.map((lot, idx) => {
                      const bal = parseFloat(lot.balance);
                      const usg = isMixWo ? (editMixBomUsage[lot.item_code] || 0) * editBatchCount : 0;
                      const rem = bal - usg;
                      return (
                      <tr key={lot.lot_id}
                        className={cn('border-t cursor-pointer hover:bg-blue-50',
                          selectedLotIds.has(lot.lot_id) && 'bg-blue-50'
                        )}
                        onClick={() => toggleLot(lot.lot_id)}
                      >
                        <td className="px-2 py-1.5">
                          <input type="checkbox" checked={selectedLotIds.has(lot.lot_id)} readOnly className="rounded" />
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {lot.lot_number}
                          {idx === 0 && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">선입선출</span>}
                          {lot.wo_number && <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">{lot.wo_number}</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {lot.item_name}
                          {lot.ext_spec && <span className="ml-1 text-[9px] text-green-600 font-mono">({lot.ext_spec})</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{bal.toLocaleString()} {lot.unit}</td>
                        {isMixWo && (
                          <td className="px-2 py-1.5 text-right font-mono text-red-600 font-medium">
                            {usg > 0 ? `-${usg.toLocaleString()}` : '-'}
                          </td>
                        )}
                        {isMixWo && (
                          <td className={cn("px-2 py-1.5 text-right font-mono font-medium", rem < 0 ? 'text-red-600' : 'text-green-600')}>
                            {usg > 0 ? rem.toLocaleString() : '-'}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-gray-500">{lot.created_at?.slice(0, 10)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selectedLotIds.size > 0 && (
              <div className="mt-1.5 text-xs text-blue-600">
                선택된 LOT: {selectedLotIds.size}건 — {availableLots.filter(l => selectedLotIds.has(l.lot_id)).map(l => l.lot_number).join(', ')}
              </div>
            )}
          </div>

          {/* 비고 */}
          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">비고</span>
            <textarea value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" rows={2} />
          </label>

          <div className="flex items-center pt-2">
            {/* 삭제 버튼 (완료 상태가 아닐 때만) */}
            {wo.status !== 'COMPLETED' && onDeleted && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`작업지시 ${wo.wo_number}을(를) 삭제하시겠습니까?\n연결된 LOT와 재고 기록도 함께 삭제됩니다.`)) return;
                  try {
                    await api.delete(`/work-orders/${wo.wo_id}`);
                    onDeleted();
                  } catch {
                    alert('삭제 실패');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-md text-shop-sm font-medium hover:bg-red-50"
              >
                <Trash2 size={14} /> 삭제
              </button>
            )}
            <div className="flex-1" />
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== 일일 생산계획 일괄 생성 모달 ========== */
interface CascadeResult {
  wo_id: number;
  wo_number: string;
  process_code: string;
  planned_qty: number;
  lot_number: string;
  item_name: string;
  ext_spec?: string;
}

function CascadeCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [woDate, setWoDate] = useState(today);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CascadeResult[] | null>(null);

  // 공정별 설정
  const [mixEnabled, setMixEnabled] = useState(true);
  const [mixBatch, setMixBatch] = useState(12);
  const [extEnabled, setExtEnabled] = useState(true);
  const [extBatch, setExtBatch] = useState(2);
  const [extPlannedM, setExtPlannedM] = useState(0);
  const [extThickness, setExtThickness] = useState('5');
  const [extWidth, setExtWidth] = useState('190');

  // EXT 규격별 다건 설정
  const [extSpecs, setExtSpecs] = useState([
    { thickness: '5', width: '190', plannedM: 0, label: '소켓용' },
  ]);
  const addExtSpec = () => {
    setExtSpecs(prev => [...prev, { thickness: '5', width: '125', plannedM: 0, label: '' }]);
  };
  const removeExtSpec = (idx: number) => {
    setExtSpecs(prev => prev.filter((_, i) => i !== idx));
  };
  const updateExtSpec = (idx: number, field: string, value: any) => {
    setExtSpecs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // 규격 라벨 자동결정
  const getSpecLabel = (t: string, w: string) => {
    if (t === '5' && w === '190') return '소켓용';
    if (t === '5' && w === '125') return '플래싱(I형)';
    if (t === '4' && w === '125') return '플래싱(Z형)';
    if (t === '6.5' && w === '415') return 'FN용';
    return `${t}T×${w}`;
  };
  const [cutEnabled, setCutEnabled] = useState(false);
  const [cutQty, setCutQty] = useState(0);
  const [asmEnabled, setAsmEnabled] = useState(false);
  const [asmQty, setAsmQty] = useState(0);

  const mixTotal = mixBatch * 300;
  const extTotal = extPlannedM || extBatch * 300;

  const handleSubmit = async () => {
    const processes: string[] = [];
    if (mixEnabled) processes.push('MIX');
    if (extEnabled) processes.push('EXT');
    if (cutEnabled) processes.push('CUT');
    if (asmEnabled) processes.push('ASM');

    if (processes.length === 0) {
      alert('최소 1개 공정을 선택하세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ data: CascadeResult[] }>('/work-orders/cascade', {
        wo_date: woDate,
        customer_name: customerName || undefined,
        processes,
        mix_batch_count: mixBatch,
        ext_batch_count: extBatch,
        ext_planned_m: extPlannedM || undefined,
        ext_thickness_mm: extEnabled ? parseFloat(extThickness) : undefined,
        ext_width_mm: extEnabled ? parseFloat(extWidth) : undefined,
        ext_specs: extEnabled ? extSpecs.map(s => ({
          thickness: parseFloat(s.thickness),
          width: parseFloat(s.width),
          planned_m: s.plannedM || undefined,
          label: getSpecLabel(s.thickness, s.width),
        })) : undefined,
        cut_qty: cutQty || undefined,
        asm_qty: asmQty || undefined,
      });
      const created = (res as any).data?.data ?? (res as any).data;
      setResult(Array.isArray(created) ? created : []);
    } catch {
      alert('일괄 생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-auto">
        <div className="px-6 py-4 border-b bg-indigo-50">
          <h2 className="text-shop-lg font-bold text-indigo-900 flex items-center gap-2">
            <Zap size={20} /> 일일 생산계획 일괄 생성
          </h2>
          <p className="text-xs text-indigo-600 mt-1">
            배합→압출→재단→조립 전 공정 작업지시를 한 번에 생성합니다.
          </p>
        </div>

        {result ? (
          /* ── 생성 결과 ── */
          <div className="p-6 space-y-4">
            <div className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
              {result.length}건의 작업지시가 생성되었습니다
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">공정</th>
                    <th className="px-3 py-2 text-left">지시번호</th>
                    <th className="px-3 py-2 text-left">품목</th>
                    <th className="px-3 py-2 text-right">계획수량</th>
                    <th className="px-3 py-2 text-left">LOT</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((wo, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2"><ProcessBadge process={wo.process_code as any} /></td>
                      <td className="px-3 py-2 font-mono">{wo.wo_number}</td>
                      <td className="px-3 py-2">
                        {wo.item_name ?? '-'}
                        {wo.ext_spec && <span className="ml-1 text-[10px] text-green-600 font-mono">({wo.ext_spec})</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {wo.planned_qty?.toLocaleString()}
                        <span className="text-[10px] text-gray-400 ml-0.5">
                          {wo.process_code === 'MIX' ? 'kg' : wo.process_code === 'EXT' ? 'm' : 'ea'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{wo.lot_number ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={onCreated}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md text-shop-sm font-medium hover:bg-indigo-700">
                확인
              </button>
            </div>
          </div>
        ) : (
          /* ── 입력 폼 ── */
          <div className="p-6 space-y-5">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-shop-sm font-medium text-gray-700">작업일자</span>
                <input type="date" value={woDate} onChange={(e) => setWoDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" />
              </label>
              <label className="block">
                <span className="text-shop-sm font-medium text-gray-700">납품처 (선택)</span>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                  placeholder="예: 현대건설" />
              </label>
            </div>

            {/* MIX 배합 */}
            <div className={cn('rounded-lg border-2 p-4 transition-colors', mixEnabled ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" checked={mixEnabled} onChange={(e) => setMixEnabled(e.target.checked)}
                  className="rounded text-amber-600 w-4 h-4" />
                <span className="font-bold text-amber-800">배합 (MIX)</span>
              </div>
              {mixEnabled && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-amber-900">배치 수</span>
                      <input type="number" value={mixBatch} min={1} max={50}
                        onChange={(e) => setMixBatch(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-shop-sm text-center font-mono" />
                    </label>
                    <div className="flex items-end pb-1">
                      <div className="text-sm font-bold text-amber-900">
                        {mixBatch}배치 × 300kg = <span className="text-lg">{mixTotal.toLocaleString()}kg</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* EXT 압출 - 규격별 다건 */}
            <div className={cn('rounded-lg border-2 p-4 transition-colors', extEnabled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={extEnabled} onChange={(e) => setExtEnabled(e.target.checked)}
                    className="rounded text-green-600 w-4 h-4" />
                  <span className="font-bold text-green-800">압출 (EXT)</span>
                  {extEnabled && <span className="text-[10px] text-green-600">{extSpecs.length}건</span>}
                </div>
                {extEnabled && (
                  <button type="button" onClick={addExtSpec}
                    className="text-xs text-green-700 border border-green-300 rounded px-2 py-0.5 hover:bg-green-100">
                    + 규격 추가
                  </button>
                )}
              </div>
              {extEnabled && (
                <div className="space-y-2">
                  {extSpecs.map((spec, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end bg-white rounded-md border border-green-200 p-2">
                      <label className="block">
                        <span className="text-[10px] font-medium text-green-800">두께</span>
                        <select value={spec.thickness}
                          onChange={(e) => updateExtSpec(idx, 'thickness', e.target.value)}
                          className="mt-0.5 block w-full rounded border border-green-200 bg-white px-2 py-1.5 text-xs font-mono">
                          <option value="4">4T</option>
                          <option value="5">5T</option>
                          <option value="6.5">6.5T</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium text-green-800">폭</span>
                        <select value={spec.width}
                          onChange={(e) => updateExtSpec(idx, 'width', e.target.value)}
                          className="mt-0.5 block w-full rounded border border-green-200 bg-white px-2 py-1.5 text-xs font-mono">
                          <option value="125">125mm</option>
                          <option value="185">185mm</option>
                          <option value="190">190mm</option>
                          <option value="225">225mm</option>
                          <option value="415">415mm</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium text-green-800">생산길이(m)</span>
                        <input type="number" value={spec.plannedM || ''}
                          onChange={(e) => updateExtSpec(idx, 'plannedM', parseInt(e.target.value) || 0)}
                          className="mt-0.5 block w-full rounded border border-green-200 bg-white px-2 py-1.5 text-xs font-mono text-center"
                          placeholder="0=배치" />
                      </label>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-green-600 font-medium whitespace-nowrap">
                          {getSpecLabel(spec.thickness, spec.width)}
                        </span>
                        {extSpecs.length > 1 && (
                          <button type="button" onClick={() => removeExtSpec(idx)}
                            className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <label className="block">
                      <span className="text-xs font-medium text-green-900">공통 배치 수 (투입량)</span>
                      <input type="number" value={extBatch} min={1} max={50}
                        onChange={(e) => setExtBatch(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 block w-full rounded-md border border-green-300 bg-white px-3 py-2 text-shop-sm text-center font-mono" />
                    </label>
                    <div className="flex items-end pb-1">
                      <div className="text-xs text-green-800">
                        {extSpecs.map((s, i) => (
                          <div key={i} className="font-mono">
                            {s.thickness}T×{s.width}mm <span className="text-green-600">({getSpecLabel(s.thickness, s.width)})</span>
                            {s.plannedM > 0 && <span className="font-bold ml-1">{s.plannedM.toLocaleString()}m</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CUT 재단 */}
            <div className={cn('rounded-lg border-2 p-4 transition-colors', cutEnabled ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" checked={cutEnabled} onChange={(e) => setCutEnabled(e.target.checked)}
                  className="rounded text-purple-600 w-4 h-4" />
                <span className={cn('font-bold', cutEnabled ? 'text-purple-800' : 'text-gray-500')}>재단 (CUT)</span>
                <span className="text-[10px] text-gray-400">수주생산</span>
              </div>
              {cutEnabled && (
                <label className="block">
                  <span className="text-xs font-medium text-purple-900">수량 (ea)</span>
                  <input type="number" value={cutQty} min={1}
                    onChange={(e) => setCutQty(parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-shop-sm text-center font-mono"
                    placeholder="재단 수량" />
                </label>
              )}
            </div>

            {/* ASM 조립 */}
            <div className={cn('rounded-lg border-2 p-4 transition-colors', asmEnabled ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" checked={asmEnabled} onChange={(e) => setAsmEnabled(e.target.checked)}
                  className="rounded text-rose-600 w-4 h-4" />
                <span className={cn('font-bold', asmEnabled ? 'text-rose-800' : 'text-gray-500')}>조립 (ASM)</span>
                <span className="text-[10px] text-gray-400">수주생산</span>
              </div>
              {asmEnabled && (
                <label className="block">
                  <span className="text-xs font-medium text-rose-900">수량 (ea)</span>
                  <input type="number" value={asmQty} min={1}
                    onChange={(e) => setAsmQty(parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-shop-sm text-center font-mono"
                    placeholder="조립 수량" />
                </label>
              )}
            </div>

            {/* 요약 바 */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <div className="text-xs font-bold text-indigo-800 mb-1">일일 생산계획 요약</div>
              <div className="flex flex-wrap gap-3 text-xs">
                {mixEnabled && <span className="text-amber-800 font-mono">MIX {mixTotal.toLocaleString()}kg ({mixBatch}배치)</span>}
                {mixEnabled && extEnabled && <span className="text-gray-400">→</span>}
                {extEnabled && extSpecs.map((s, i) => (
                  <span key={i} className="text-green-800 font-mono">
                    EXT {s.thickness}T×{s.width}({getSpecLabel(s.thickness, s.width)})
                    {s.plannedM > 0 ? ` ${s.plannedM.toLocaleString()}m` : ''}
                  </span>
                ))}
                {(mixEnabled || extEnabled) && cutEnabled && <span className="text-gray-400">→</span>}
                {cutEnabled && <span className="text-purple-800 font-mono">CUT {cutQty}ea</span>}
                {cutEnabled && asmEnabled && <span className="text-gray-400">→</span>}
                {asmEnabled && <span className="text-rose-800 font-mono">ASM {asmQty}ea</span>}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={onClose}
                className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md text-shop-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {submitting ? '생성 중...' : '일괄 생성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ 재단 규격 상세 컴포넌트 ═══════ */
/* ═══════ MIX 배치별 LOT 상세 컴포넌트 ═══════ */
function MixBatchLotsDetail({ woId, actualQty, onTotalChange }: { woId: number; actualQty: number; onTotalChange?: (total: number) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lotQtys, setLotQtys] = useState<Record<number, string>>({});

  useEffect(() => {
    setLoading(true);
    api.get(`/work-orders/${woId}/batch-lots`)
      .then((res: any) => {
        const d = res.data?.data ?? res.data ?? null;
        setData(d);
        // 초기값: DB값 있으면 DB값, 없으면 빈값
        if (d?.lots) {
          const qtys: Record<number, string> = {};
          d.lots.forEach((lot: any) => {
            const q = parseFloat(lot.qty || 0);
            qtys[lot.lot_id] = q > 0 ? String(q) : '';
          });
          setLotQtys(qtys);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [woId]);

  if (loading) return <div className="text-xs text-gray-400 py-2">배치 LOT 로딩중...</div>;
  if (!data || !data.lots?.length || data.count <= 1) return null;

  const lotCount = data.count;
  const isProduced = data.lots.some((l: any) => parseFloat(l.qty || 0) > 0);
  const inputTotal = Object.values(lotQtys).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  // 수량 변경 핸들러
  const handleQtyChange = (lotId: number, value: string) => {
    const next = { ...lotQtys, [lotId]: value };
    setLotQtys(next);
    // 합계를 상위에 전달
    if (onTotalChange) {
      const total = Object.values(next).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      onTotalChange(Math.round(total * 100) / 100);
    }
  };

  return null;
}

function CutSpecsDetail({
  woId,
  itemCode,
  isEdit = false,
  rows: propRows,
  onChange
}: {
  woId: number;
  itemCode?: string | null;
  isEdit?: boolean;
  rows?: any[];
  onChange?: (rows: any[]) => void;
}) {
  const [internalSpecs, setInternalSpecs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isEdit) { setLoading(false); return; }
    setLoading(true);
    api.get(`/work-orders/${woId}/cut-specs`)
      .then((res: any) => setInternalSpecs(res.data?.data ?? res.data ?? null))
      .catch(() => setInternalSpecs(null))
      .finally(() => setLoading(false));
  }, [woId, isEdit]);

  if (loading) return <div className="text-xs text-gray-400 py-2">재단 규격 로딩중...</div>;

  const isFlashing = itemCode === 'SA-CUT-FL';
  const rows = isEdit ? (propRows || []) : [];

  // ── 소켓 치수 자동계산 (VM 타입) ──
  const socketDims = (w: number, h: number) => ({
    innerW: w - 5,
    innerH: h - 30,
    outerUD: w + 60,
    outerLR: h,
  });

  // ── 플래싱 치수 자동계산 (VT/FL 타입) ──
  const flashingDims = (w: number, h: number) => {
    const perimeter = (w + 250) * 2 + h * 2;
    const totalSets = Math.ceil((perimeter / 1000) * 2);
    return { totalSets };
  };

  const handleCellChange = (idx: number, field: string, value: any) => {
    if (!onChange) return;
    onChange(rows.map((r, i) => i !== idx ? r : { ...r, [field]: value }));
  };

  const addRow = () => {
    if (!onChange) return;
    onChange([...rows, {
      structure_code: isFlashing ? `FL-${String(rows.length + 1).padStart(2,'0')}` : `VA-${String(rows.length + 1).padStart(2,'0')}`,
      structure_name: '신규 규격',
      penetration_w: 900,
      penetration_h: 600,
      qty: 1,
      actual_qty: 0,
    }]);
  };

  const removeRow = (idx: number) => {
    if (!onChange) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  const totalPlanSets = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalActualSets = rows.reduce((s, r) => s + (Number(r.actual_qty) || 0), 0);
  const totalSheets = isFlashing ? 0 : rows.reduce((s, r) => s + 12 * (Number(r.qty) || 0), 0);

  const theme = isFlashing
    ? { border: 'border-teal-300', hd: 'bg-teal-50 text-teal-900', dot: 'bg-teal-500', btnCls: 'bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100', ring: 'focus:ring-teal-400', rowHover: 'hover:bg-teal-50/20' }
    : { border: 'border-purple-300', hd: 'bg-purple-50 text-purple-900', dot: 'bg-purple-500', btnCls: 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100', ring: 'focus:ring-purple-400', rowHover: 'hover:bg-purple-50/20' };

  // ─── 자동계산 셀들 ───
  const AutoSocketCells = ({ w, h }: { w: number; h: number }) => {
    const d = socketDims(w, h);
    return (
      <>
        <td className="px-2 py-1.5 text-right bg-purple-50/50 font-mono font-bold text-purple-800 text-[11px]">{w > 0 ? d.innerW : '—'}</td>
        <td className="px-2 py-1.5 text-center bg-purple-50/50 font-mono text-purple-600 text-[11px]">4</td>
        <td className="px-2 py-1.5 text-right bg-purple-50/50 font-mono font-bold text-purple-800 text-[11px]">{h > 0 ? d.innerH : '—'}</td>
        <td className="px-2 py-1.5 text-center bg-purple-50/50 font-mono text-purple-600 text-[11px]">4</td>
        <td className="px-2 py-1.5 text-right bg-purple-100/50 font-mono font-bold text-purple-900 text-[11px]">{w > 0 ? d.outerUD : '—'}</td>
        <td className="px-2 py-1.5 text-center bg-purple-100/50 font-mono text-purple-700 text-[11px]">2</td>
        <td className="px-2 py-1.5 text-right bg-purple-100/50 font-mono font-bold text-purple-900 text-[11px]">{h > 0 ? d.outerLR : '—'}</td>
        <td className="px-2 py-1.5 text-center bg-purple-100/50 font-mono text-purple-700 text-[11px]">2</td>
      </>
    );
  };

  const AutoFlashCells = ({ w, h }: { w: number; h: number }) => {
    const { totalSets: fSets } = flashingDims(w, h);
    return (
      <>
        <td className="px-2 py-1.5 text-center bg-teal-50/50 font-mono font-bold text-teal-800 text-[11px]">L=1000</td>
        <td className="px-2 py-1.5 text-center bg-teal-50/50 font-mono text-teal-700 text-[11px]">{w > 0 ? fSets : '—'}</td>
      </>
    );
  };

  // ─── 공통 2레벨 헤더 ───
  const TableHeader = ({ showActual }: { showActual: boolean }) => (
    <thead className={cn('sticky top-0 z-10 text-[10px] font-bold', theme.hd)}>
      <tr className="border-b-2 border-gray-300">
        <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 text-center w-8">No</th>
        <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 w-24">구조코드</th>
        <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 w-28">구조명</th>
        <th colSpan={2} className="px-2 py-1 text-center border-r border-gray-200">규격 (mm)</th>
        <th rowSpan={2} className="px-2 py-1.5 text-center border-r border-gray-200 w-14">계획<br/>세트</th>
        {showActual && <th rowSpan={2} className="px-2 py-1.5 text-center border-r border-gray-200 w-14">실적<br/>세트</th>}
        {!isFlashing ? (
          <>
            <th colSpan={4} className="px-2 py-1 text-center border-r border-gray-200 bg-purple-100/60">소켓 내부용 (자동)</th>
            <th colSpan={4} className="px-2 py-1 text-center border-r border-gray-200 bg-purple-200/50">소켓 외부용 (자동)</th>
          </>
        ) : (
          <th colSpan={2} className="px-2 py-1 text-center border-r border-gray-200 bg-teal-100/60">플래싱 (자동)</th>
        )}
        {showActual && <th rowSpan={2} className="px-2 py-1.5 text-center w-10">삭제</th>}
      </tr>
      <tr className="border-b border-gray-200 text-[9px]">
        <th className="px-2 py-1 border-r border-gray-200 text-center">가로</th>
        <th className="px-2 py-1 border-r border-gray-200 text-center">세로</th>
        {!isFlashing ? (
          <>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">가로규격</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">수량(EA)</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">세로규격</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">수량(EA)</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">상하규격</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">수량</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">좌우규격</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">수량</th>
          </>
        ) : (
          <>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-teal-50/80">규격</th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-teal-50/80">총매수</th>
          </>
        )}
        {showActual && <th className="w-10" />}
      </tr>
    </thead>
  );

  const totalCols = isFlashing ? 11 : 17;

  // ════════════════ 편집 모드 ════════════════
  if (isEdit) {
    const inp = (extra = '') =>
      `text-[11px] px-1.5 py-1 rounded border border-gray-200 focus:outline-none focus:ring-1 ${theme.ring} bg-white font-mono ${extra}`;

    return (
      <div className={cn('border rounded-xl overflow-hidden shadow-sm bg-white', theme.border)}>
        <div className={cn('flex items-center justify-between px-4 py-2.5 border-b', theme.hd)}>
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full animate-pulse', theme.dot)} />
            <h3 className="text-xs font-bold">
              재단작업지시서 — {isFlashing ? '플래싱용 (VT / SA-CUT-FL)' : '소켓용 (VM / SA-CUT-SK)'}
            </h3>
          </div>
          <button type="button" onClick={addRow}
            className={cn('px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1 transition shadow-sm', theme.btnCls)}>
            <Plus size={13} /> + 규격 행 추가
          </button>
        </div>

        {rows.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-5 text-[11px] text-gray-500">
            <span>총 <strong className={isFlashing ? 'text-teal-700' : 'text-purple-700'}>{rows.length}종</strong></span>
            <span>계획: <strong className="text-indigo-700">{totalPlanSets}세트</strong></span>
            <span>실적: <strong className="text-emerald-700">{totalActualSets}세트</strong></span>
            {!isFlashing && <span>재단 총 매수: <strong className="text-gray-800">{totalSheets.toLocaleString()}매</strong></span>}
          </div>
        )}

        <div className="overflow-x-auto" style={{ maxHeight: '460px', overflowY: 'auto' }}>
          <table className="w-full text-left border-collapse" style={{ minWidth: isFlashing ? '760px' : '1060px' }}>
            <TableHeader showActual={true} />
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-10 text-center text-gray-400 italic text-xs">
                    등록된 규격이 없습니다. [+ 규격 행 추가] 버튼을 눌러 추가하세요.
                  </td>
                </tr>
              ) : rows.map((r, idx) => {
                const w = Number(r.penetration_w) || 0;
                const h = Number(r.penetration_h) || 0;
                return (
                  <tr key={idx} className={cn('divide-x divide-gray-100 transition-colors', theme.rowHover)}>
                    <td className="px-2 py-1.5 text-center font-mono text-gray-400 text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={r.structure_code || ''} onChange={e => handleCellChange(idx, 'structure_code', e.target.value)}
                        className={inp('w-full')} placeholder={isFlashing ? 'FL-001' : 'VA-064'} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" value={r.structure_name || ''} onChange={e => handleCellChange(idx, 'structure_name', e.target.value)}
                        className={inp('w-full')} placeholder="구조명" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.penetration_w || ''} onChange={e => handleCellChange(idx, 'penetration_w', Number(e.target.value) || 0)}
                        className={inp('w-16 text-right')} placeholder="850" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.penetration_h || ''} onChange={e => handleCellChange(idx, 'penetration_h', Number(e.target.value) || 0)}
                        className={inp('w-16 text-right')} placeholder="550" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.qty || ''} onChange={e => handleCellChange(idx, 'qty', Number(e.target.value) || 0)}
                        className={inp('w-12 text-right text-indigo-700 font-semibold')} placeholder="1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={r.actual_qty ?? ''} onChange={e => handleCellChange(idx, 'actual_qty', Number(e.target.value) || 0)}
                        className={inp('w-12 text-right text-emerald-700 font-semibold')} placeholder="0" />
                    </td>
                    {!isFlashing ? <AutoSocketCells w={w} h={h} /> : <AutoFlashCells w={w} h={h} />}
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeRow(idx)}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 text-[11px] font-bold sticky bottom-0 z-10">
                <tr className="divide-x divide-gray-200">
                  <td colSpan={5} className="px-3 py-2 text-center text-[10px] text-gray-600">합 계</td>
                  <td className="px-2 py-2 text-right font-mono text-indigo-700">{totalPlanSets}</td>
                  <td className="px-2 py-2 text-right font-mono text-emerald-700">{totalActualSets}</td>
                  {!isFlashing ? (
                    <td colSpan={9} className="px-3 py-2 text-[10px] text-gray-500 font-mono">
                      재단 총 매수: <strong className="text-gray-800">{totalSheets.toLocaleString()}매</strong>
                      <span className="text-gray-400 ml-2">(소켓 1세트 = 12매)</span>
                    </td>
                  ) : (
                    <td colSpan={3} className="px-3 py-2 text-[10px] text-teal-600">플래싱 합산</td>
                  )}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-t flex justify-between text-[10px] text-gray-400 font-medium">
          <span>💡 음영 열은 가로(W)·세로(H) 입력 시 자동으로 계산됩니다.</span>
          <span>⚡ 계획/실적 세트 합계가 메인 작업지시 수량에 실시간 연동됩니다.</span>
        </div>
      </div>
    );
  }

  // ════════════════ 읽기 전용 모드 ════════════════
  if (!internalSpecs) return null;

  const structures: any[] = internalSpecs.structures
    || (internalSpecs.socket?.specs?.length > 0 ? internalSpecs.socket.specs : null)
    || internalSpecs.flashing?.specs
    || [];

  const displayIsFlashing = !internalSpecs.socket?.specs?.length && (internalSpecs.flashing?.specs?.length > 0);

  if (structures.length === 0) return null;

  const roTheme = displayIsFlashing
    ? { border: 'border-teal-300', hd: 'bg-teal-50 text-teal-900', dot: 'bg-teal-400', rowHover: 'hover:bg-teal-50/20' }
    : { border: 'border-purple-300', hd: 'bg-purple-50 text-purple-900', dot: 'bg-purple-400', rowHover: 'hover:bg-purple-50/20' };

  return (
    <div className={cn('border rounded-xl overflow-hidden shadow-sm bg-white', roTheme.border)}>
      <div className={cn('px-4 py-2.5 border-b flex items-center gap-2', roTheme.hd)}>
        <span className={cn('w-2 h-2 rounded-full', roTheme.dot)} />
        <span className="text-xs font-bold">재단작업지시서 — {displayIsFlashing ? '플래싱용' : '소켓용(VM)'}</span>
        <span className="text-[10px] text-gray-400 font-normal ml-2">
          총 {structures.length}종 · {internalSpecs.total_sets ?? 0}세트 · 재단 {(internalSpecs.total_sheets ?? 0).toLocaleString()}매
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse"
          style={{ minWidth: displayIsFlashing ? '700px' : '920px' }}>
          <thead className={cn('text-[10px] font-bold', displayIsFlashing ? 'bg-teal-50 text-teal-900' : 'bg-purple-50 text-purple-900')}>
            <tr className="border-b-2 border-gray-300">
              <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 text-center w-8">No</th>
              <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 w-24">구조코드</th>
              <th rowSpan={2} className="px-2 py-1.5 border-r border-gray-200 w-28">구조명</th>
              <th colSpan={2} className="px-2 py-1 text-center border-r border-gray-200">규격 (mm)</th>
              <th rowSpan={2} className="px-2 py-1.5 text-center border-r border-gray-200 w-14">계획<br/>세트</th>
              {!displayIsFlashing ? (
                <>
                  <th colSpan={4} className="px-2 py-1 text-center border-r border-gray-200 bg-purple-100/60">소켓 내부용</th>
                  <th colSpan={4} className="px-2 py-1 text-center border-r border-gray-200 bg-purple-200/50">소켓 외부용</th>
                </>
              ) : (
                <th colSpan={2} className="px-2 py-1 text-center border-r border-gray-200 bg-teal-100/60">플래싱</th>
              )}
            </tr>
            <tr className="border-b border-gray-200 text-[9px]">
              <th className="px-2 py-1 border-r border-gray-200 text-center">가로</th>
              <th className="px-2 py-1 border-r border-gray-200 text-center">세로</th>
              {!displayIsFlashing ? (
                <>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">가로규격</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">수량(EA)</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">세로규격</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-50/80">수량(EA)</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">상하규격</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">수량</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">좌우규격</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-purple-100/60">수량</th>
                </>
              ) : (
                <>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-teal-50/80">규격</th>
                  <th className="px-1.5 py-1 border-r border-gray-200 text-center bg-teal-50/80">총매수</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {structures.map((s: any, idx: number) => {
              const w = Number(s.penetration_w) || 0;
              const h = Number(s.penetration_h) || 0;
              return (
                <tr key={idx} className={cn('divide-x divide-gray-100 transition-colors', roTheme.rowHover)}>
                  <td className="px-2 py-1.5 text-center font-mono text-gray-400 text-[10px]">{String(idx + 1).padStart(2, '0')}</td>
                  <td className="px-2 py-1.5 font-mono font-bold text-[11px]">{s.structure_code || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-700 text-[11px]">{s.structure_name || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-gray-800 text-[11px]">{w || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-gray-800 text-[11px]">{h || '—'}</td>
                  <td className="px-2 py-1.5 text-center font-mono font-semibold text-indigo-700 text-[11px]">{s.qty}</td>
                  {!displayIsFlashing
                    ? <AutoSocketCells w={w} h={h} />
                    : <AutoFlashCells w={w} h={h} />
                  }
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-300 text-[11px] font-bold">
            <tr className="divide-x divide-gray-200">
              <td colSpan={5} className="px-3 py-2 text-center text-[10px] text-gray-600">합 계</td>
              <td className="px-2 py-2 text-center font-mono text-indigo-700">{internalSpecs.total_sets ?? 0}</td>
              {!displayIsFlashing ? (
                <td colSpan={8} className="px-3 py-2 text-[10px] text-gray-500 font-mono">
                  재단 총 매수: <strong className="text-gray-800">{(internalSpecs.total_sheets ?? 0).toLocaleString()}매</strong>
                </td>
              ) : (
                <td colSpan={2} className="px-3 py-2 text-[10px] text-teal-600">플래싱 합산</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   스프레드시트 일괄 편집기 (엑셀 스타일)
   ═══════════════════════════════════════════════════════ */
function SpreadsheetWorkOrderEditor({
  filter,
  onRefresh,
  onEditTarget,
}: {
  filter: string;
  onRefresh: () => void;
  onEditTarget: (wo: WorkOrder) => void;
}) {
  // ── 데이터 & 상태 ──
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null); // wo_id being saved
  const [editingCell, setEditingCell] = useState<{ rowId: number | 'new'; field: string } | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, string>>>({});
  const [newRows, setNewRows] = useState<Array<{ _tmpId: string; wo_date: string; process_code: string; planned_qty: string; remarks: string }>>([]);
  const [items, setItems] = useState<Array<{ item_id: number; item_code: string; item_name: string }>>([]);
  const [companies, setCompanies] = useState<Array<{ company_id: number; company_name: string }>>([]);

  const today = new Date().toISOString().slice(0, 10);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = filter ? `?process_code=${filter}` : '';
    api.get<{ data: WorkOrder[] }>(`/work-orders${params}`)
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const dateDiff = (b.wo_date || '').localeCompare(a.wo_date || '');
          if (dateDiff !== 0) return dateDiff;
          const pMap: Record<string, number> = { MIX: 0, EXT: 1, CUT: 2, ASM: 3 };
          return (pMap[a.process_code] ?? 9) - (pMap[b.process_code] ?? 9);
        });
        setRows(sorted);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchRows();
    api.get<{ data: any[] }>('/items').then((r) => setItems(r.data));
    api.get<{ data: any[] }>('/companies?active=true').then((r) => setCompanies(r.data));
  }, [fetchRows]);

  // ── 셀 값 가져오기 (로컬 편집값 우선) ──
  const getCellVal = (woId: number, field: string, defaultVal: any) => {
    return cellValues[woId]?.[field] ?? String(defaultVal ?? '');
  };

  // ── 셀 변경 ──
  const handleCellChange = (woId: number, field: string, value: string) => {
    setCellValues(prev => ({
      ...prev,
      [woId]: { ...(prev[woId] || {}), [field]: value }
    }));
  };

  // ── 행 저장 (blur 또는 Enter 시) ──
  const saveRow = async (wo: WorkOrder) => {
    const changes = cellValues[wo.wo_id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(wo.wo_id);
    try {
      const payload: Record<string, any> = {};
      if (changes.planned_qty !== undefined) payload.planned_qty = Number(changes.planned_qty) || 0;
      if (changes.actual_qty !== undefined) payload.actual_qty = Number(changes.actual_qty) || 0;
      if (changes.remarks !== undefined) payload.remarks = changes.remarks;
      if (changes.lot_number !== undefined) payload.lot_number = changes.lot_number;
      if (changes.customer_name !== undefined) payload.customer_name = changes.customer_name;
      if (changes.wo_date !== undefined) payload.wo_date = changes.wo_date;
      if (changes.status !== undefined) payload.status = changes.status;

      await api.patch(`/work-orders/${wo.wo_id}`, payload);
      // 저장 후 로컬 상태 정리
      setCellValues(prev => {
        const next = { ...prev };
        delete next[wo.wo_id];
        return next;
      });
      fetchRows();
    } catch {
      // keep local changes so user can retry
    } finally {
      setSaving(null);
    }
  };

  // ── 새 행 추가 ──
  const addNewRow = () => {
    const tmpId = `new-${Date.now()}`;
    setNewRows(prev => [...prev, {
      _tmpId: tmpId,
      wo_date: today,
      process_code: filter || 'MIX',
      planned_qty: '',
      remarks: '',
    }]);
    // 새 행의 첫 셀로 포커스
    setTimeout(() => {
      document.getElementById(`cell-${tmpId}-wo_date`)?.focus();
    }, 50);
  };

  // ── 새 행 저장 ──
  const saveNewRow = async (row: typeof newRows[0]) => {
    if (!row.planned_qty) return; // 수량 없으면 저장 안함
    try {
      await api.post('/work-orders', {
        wo_date: row.wo_date,
        process_code: row.process_code,
        planned_qty: Number(row.planned_qty) || 0,
        remarks: row.remarks || '',
        status: 'PLANNED',
      });
      setNewRows(prev => prev.filter(r => r._tmpId !== row._tmpId));
      fetchRows();
    } catch {
      // ignore
    }
  };

  // ── 행 삭제 ──
  const deleteRow = async (wo: WorkOrder) => {
    if (wo.status === 'COMPLETED') { alert('완료된 작업지시는 삭제할 수 없습니다.'); return; }
    if (!confirm(`[${wo.wo_number}] 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/work-orders/${wo.wo_id}`);
      fetchRows();
    } catch {
      alert('삭제 실패');
    }
  };

  const procColors: Record<string, { bg: string; text: string; badge: string }> = {
    MIX: { bg: 'bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    EXT: { bg: 'bg-green-50', text: 'text-green-900', badge: 'bg-green-100 text-green-800 border-green-300' },
    CUT: { bg: 'bg-purple-50', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
    ASM: { bg: 'bg-rose-50', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
  };

  const statusColors: Record<string, string> = {
    PLANNED: 'bg-gray-100 text-gray-700 border-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-green-100 text-green-800 border-green-300',
    HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };
  const statusLabel: Record<string, string> = { PLANNED: '계획', IN_PROGRESS: '진행중', COMPLETED: '완료', HOLD: '보류' };

  // ── 인라인 셀 컴포넌트 ──
  const InlineCell = ({
    wo, field, type = 'text', width = 'w-full', align = '',
    options, readOnly = false
  }: {
    wo: WorkOrder; field: string; type?: 'text' | 'number' | 'date' | 'select';
    width?: string; align?: string; options?: { value: string; label: string }[];
    readOnly?: boolean;
  }) => {
    const rawVal = (wo as any)[field];
    const localVal = cellValues[wo.wo_id]?.[field];
    const displayVal = localVal ?? String(rawVal ?? '');
    const isEditing = editingCell?.rowId === wo.wo_id && editingCell?.field === field;
    const isDirty = cellValues[wo.wo_id]?.[field] !== undefined;

    if (readOnly) {
      return (
        <span className={cn('px-2 py-1 text-[11px] font-mono', align)}>
          {rawVal != null ? rawVal.toLocaleString() : '—'}
        </span>
      );
    }

    if (type === 'select' && options) {
      return (
        <select
          id={`cell-${wo.wo_id}-${field}`}
          value={displayVal}
          onChange={e => handleCellChange(wo.wo_id, field, e.target.value)}
          onBlur={() => { saveRow(wo); setEditingCell(null); }}
          onFocus={() => setEditingCell({ rowId: wo.wo_id, field })}
          className={cn(
            'px-1.5 py-1 text-[11px] border-0 focus:ring-1 focus:ring-blue-400 rounded bg-transparent cursor-pointer',
            width, isDirty && 'font-semibold text-blue-700'
          )}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }

    return (
      <input
        id={`cell-${wo.wo_id}-${field}`}
        type={type}
        value={displayVal}
        onFocus={() => setEditingCell({ rowId: wo.wo_id, field })}
        onChange={e => handleCellChange(wo.wo_id, field, e.target.value)}
        onBlur={() => { saveRow(wo); setEditingCell(null); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { saveRow(wo); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') {
            setCellValues(prev => {
              const next = { ...prev };
              if (next[wo.wo_id]) { const r = { ...next[wo.wo_id] }; delete r[field]; next[wo.wo_id] = r; }
              return next;
            });
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'px-2 py-1 text-[11px] border border-transparent focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded bg-transparent transition-colors',
          width, align,
          isDirty && 'bg-blue-50/60 font-semibold text-blue-800 border-blue-300',
          isEditing && 'bg-white shadow-sm'
        )}
        placeholder={type === 'number' ? '0' : '—'}
      />
    );
  };

  // ── 상태별 그룹화 통계 ──
  const stats = useMemo(() => {
    const s = { total: rows.length, planned: 0, inProgress: 0, completed: 0, hold: 0 };
    rows.forEach(r => {
      if (r.status === 'PLANNED') s.planned++;
      else if (r.status === 'IN_PROGRESS') s.inProgress++;
      else if (r.status === 'COMPLETED') s.completed++;
      else if (r.status === 'HOLD') s.hold++;
    });
    return s;
  }, [rows]);

  const dirtyCount = Object.keys(cellValues).length;

  return (
    <div className="space-y-3">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-md">
        <div className="flex items-center gap-3">
          <Table2 size={16} className="text-emerald-300" />
          <span className="text-sm font-bold tracking-wide">작업지시 일괄 편집 (스프레드시트)</span>
          <span className="text-[11px] text-emerald-300 font-mono">
            총 {stats.total}건 · 계획 {stats.planned} · 진행 {stats.inProgress} · 완료 {stats.completed}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {dirtyCount > 0 && (
            <span className="text-[11px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold animate-pulse">
              {dirtyCount}행 미저장 (셀 이탈 시 자동저장)
            </span>
          )}
          <button
            onClick={addNewRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus size={13} /> + 새 행 추가
          </button>
          <button
            onClick={() => { fetchRows(); onRefresh(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-semibold transition-colors border border-emerald-500"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="flex items-center gap-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-700">
        <span>💡 <strong>셀 클릭</strong>하여 직접 편집</span>
        <span>⌨️ <strong>Enter</strong>: 저장 / <strong>Esc</strong>: 취소</span>
        <span>💾 셀에서 벗어나면 <strong>자동 저장</strong></span>
        <span>📋 지시번호 클릭 → <strong>상세 수정 모달</strong> 열기</span>
      </div>

      {/* 스프레드시트 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="w-full border-collapse text-[11px]" style={{ minWidth: '1100px' }}>
            {/* 헤더 */}
            <thead className="sticky top-0 z-20 bg-gray-800 text-white text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2.5 text-center w-8 border-r border-gray-700">#</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700 w-28">지시번호</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700 w-24">지시일</th>
                <th className="px-3 py-2.5 text-center border-r border-gray-700 w-20">공정</th>
                <th className="px-3 py-2.5 text-center border-r border-gray-700 w-20">상태</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700 w-40">품목명</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700 w-32">납품처</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-700 w-24">계획 수량</th>
                <th className="px-3 py-2.5 text-right border-r border-gray-700 w-24">실적 수량</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700 w-32">LOT번호</th>
                <th className="px-3 py-2.5 text-left border-r border-gray-700">비고</th>
                <th className="px-2 py-2.5 text-center w-16">작업</th>
              </tr>
            </thead>

            <tbody>
              {/* 새 행 (임시) */}
              {newRows.map((nr, idx) => (
                <tr key={nr._tmpId} className="bg-emerald-50 border-b border-emerald-200 hover:bg-emerald-100/60 transition-colors">
                  <td className="px-2 py-1.5 text-center text-gray-400 border-r border-gray-100 text-[10px]">
                    <span className="text-emerald-600 font-bold">NEW</span>
                  </td>
                  <td className="px-3 py-1.5 border-r border-gray-100 text-[11px] text-gray-400 italic">자동생성</td>
                  <td className="px-2 py-1.5 border-r border-gray-100">
                    <input
                      id={`cell-${nr._tmpId}-wo_date`}
                      type="date"
                      value={nr.wo_date}
                      onChange={e => setNewRows(prev => prev.map(r => r._tmpId === nr._tmpId ? { ...r, wo_date: e.target.value } : r))}
                      className="text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 bg-white w-full"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-100">
                    <select
                      value={nr.process_code}
                      onChange={e => setNewRows(prev => prev.map(r => r._tmpId === nr._tmpId ? { ...r, process_code: e.target.value } : r))}
                      className="text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 bg-white w-full"
                    >
                      {['MIX', 'EXT', 'CUT', 'ASM'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-100 text-center">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300">계획</span>
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-100 text-gray-400 italic text-[11px]">—</td>
                  <td className="px-2 py-1.5 border-r border-gray-100 text-gray-400 italic text-[11px]">—</td>
                  <td className="px-2 py-1.5 border-r border-gray-100">
                    <input
                      type="number"
                      value={nr.planned_qty}
                      onChange={e => setNewRows(prev => prev.map(r => r._tmpId === nr._tmpId ? { ...r, planned_qty: e.target.value } : r))}
                      className="text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 bg-white w-full text-right font-mono"
                      placeholder="수량 입력"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-100 text-gray-400 text-[11px]">—</td>
                  <td className="px-2 py-1.5 border-r border-gray-100 text-gray-400 text-[11px]">—</td>
                  <td className="px-2 py-1.5 border-r border-gray-100">
                    <input
                      type="text"
                      value={nr.remarks}
                      onChange={e => setNewRows(prev => prev.map(r => r._tmpId === nr._tmpId ? { ...r, remarks: e.target.value } : r))}
                      className="text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-400 bg-white w-full"
                      placeholder="비고"
                      onKeyDown={e => { if (e.key === 'Enter') saveNewRow(nr); }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => saveNewRow(nr)}
                        className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded hover:bg-emerald-600 transition"
                        title="저장"
                      >저장</button>
                      <button
                        onClick={() => setNewRows(prev => prev.filter(r => r._tmpId !== nr._tmpId))}
                        className="px-1.5 py-1 bg-gray-200 text-gray-600 text-[10px] rounded hover:bg-gray-300 transition"
                        title="취소"
                      >✕</button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* 기존 데이터 행 */}
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      데이터 로딩 중...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 && newRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-400">
                    작업지시가 없습니다. [+ 새 행 추가] 버튼으로 추가하세요.
                  </td>
                </tr>
              ) : rows.map((wo, idx) => {
                const pc = procColors[wo.process_code] || { bg: 'bg-gray-50', text: 'text-gray-800', badge: 'bg-gray-100 text-gray-700 border-gray-300' };
                const isSavingThis = saving === wo.wo_id;
                const isDirtyRow = !!cellValues[wo.wo_id] && Object.keys(cellValues[wo.wo_id]).length > 0;
                const isCompleted = wo.status === 'COMPLETED';

                return (
                  <tr
                    key={wo.wo_id}
                    className={cn(
                      'border-b border-gray-100 transition-colors group',
                      pc.bg,
                      isDirtyRow && 'ring-1 ring-inset ring-blue-300',
                      isSavingThis && 'opacity-60',
                      isCompleted && 'opacity-70'
                    )}
                  >
                    {/* 번호 */}
                    <td className="px-2 py-1.5 text-center text-gray-400 border-r border-gray-200 text-[10px] font-mono">
                      {idx + 1}
                    </td>

                    {/* 지시번호 */}
                    <td className="px-3 py-1.5 border-r border-gray-200">
                      <button
                        onClick={() => onEditTarget(wo)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-[11px] font-medium"
                        title="상세 수정 열기"
                      >
                        {wo.wo_number}
                      </button>
                      {isSavingThis && (
                        <span className="ml-1 text-[9px] text-emerald-600 animate-pulse">저장중...</span>
                      )}
                    </td>

                    {/* 지시일 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="wo_date" type="date" width="w-28" />
                    </td>

                    {/* 공정 */}
                    <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border font-mono', pc.badge)}>
                        {wo.process_code}
                      </span>
                    </td>

                    {/* 상태 */}
                    <td className="px-1 py-1.5 border-r border-gray-200 text-center">
                      <InlineCell
                        wo={wo}
                        field="status"
                        type="select"
                        options={[
                          { value: 'PLANNED', label: '계획' },
                          { value: 'IN_PROGRESS', label: '진행중' },
                          { value: 'COMPLETED', label: '완료' },
                          { value: 'HOLD', label: '보류' },
                        ]}
                        width="w-20"
                      />
                    </td>

                    {/* 품목명 */}
                    <td className="px-2 py-1.5 border-r border-gray-200 text-[11px] text-gray-700 max-w-[160px]">
                      <span className="truncate block">{wo.item_name || '—'}</span>
                    </td>

                    {/* 납품처 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="customer_name" type="text" width="w-full" />
                    </td>

                    {/* 계획 수량 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="planned_qty" type="number" width="w-20" align="text-right" />
                    </td>

                    {/* 실적 수량 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="actual_qty" type="number" width="w-20" align="text-right" />
                    </td>

                    {/* LOT번호 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="lot_number" type="text" width="w-full" />
                    </td>

                    {/* 비고 */}
                    <td className="px-1 py-1.5 border-r border-gray-200">
                      <InlineCell wo={wo} field="remarks" type="text" width="w-full" />
                    </td>

                    {/* 작업 버튼 */}
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditTarget(wo)}
                          className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                          title="상세 수정"
                        >
                          <Pencil size={12} />
                        </button>
                        {!isCompleted && (
                          <button
                            onClick={() => deleteRow(wo)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* 합계 푸터 */}
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-800 text-white text-[11px] font-bold z-10">
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-right text-gray-300 text-[10px]">
                    합 계 ({rows.length}건)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-yellow-300">
                    {rows.reduce((s, r) => s + (r.planned_qty || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-300">
                    {rows.reduce((s, r) => s + (r.actual_qty || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={3} className="px-3 py-2.5 text-gray-400 text-[10px]">
                    달성률: {rows.reduce((s, r) => s + (r.planned_qty || 0), 0) > 0
                      ? Math.round(rows.reduce((s, r) => s + (r.actual_qty || 0), 0) / rows.reduce((s, r) => s + (r.planned_qty || 0), 0) * 100)
                      : 0}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
