import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Plus, X, ChevronRight, AlertTriangle, CheckCircle2,
  ClipboardList, Calendar, User, Play, CheckCheck,
  Trash2, Pencil, Loader2, AlertCircle, RefreshCw,
  Package, Info,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────
type WoType = 'INSPECT' | 'CUT_VM' | 'CUT_VT' | 'CUT_THERMAL' | 'BEND_VM' | 'BEND_VT' | 'BEND_VT_RE' | 'LABEL';
type WoStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

interface Project {
  project_id: number;
  project_name: string;
}

interface PO {
  po_id: number;
  project_id: number;
  project_name: string;
  biz_name: string | null;
  delivery_date: string | null;
  item_count: number;
  file_name: string;
}

interface PoItem {
  po_item_id: number;
  seq_no: number;
  product_type: string | null;
  structure: string | null;
  width_mm: number | null;    // pipe_width_mm alias
  height_mm: number | null;   // pipe_height_mm alias
  qty: number;                // 항상 1 (백엔드에서 분리됨)
  division: string | null;
  install_location: string | null;
  remark: string | null;
  sheet_name: string | null;
  // qty > 1 분리 정보
  global_seq: number;         // 전체 일련번호
  explode_index: number;      // 같은 소켓의 n번째 (1-based)
  explode_total: number;      // 원래 수량
}

interface CalcRow {
  label: string;
  length: number | null;
  qty: number | null;
}

interface StructWO {
  swo_id: number;
  swo_number: string;
  wo_type: WoType;
  po_id: number;
  project_id: number | null;
  project_name: string;
  wo_date: string;
  delivery_date: string | null;
  status: WoStatus;
  worker: string | null;
  remarks: string | null;
  item_count: number;
  po_biz_name: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 탭 설정
// ────────────────────────────────────────────────────────────────────────────
const WO_TABS: { type: WoType; label: string; color: string; accent: string; iconColor: string }[] = [
  { type: 'INSPECT',      label: '🔍 소켓 인수검사',    color: 'border-blue-500',    accent: 'bg-blue-500',    iconColor: 'text-blue-600' },
  { type: 'CUT_VM',       label: '✂️ 재단-VM형',         color: 'border-emerald-500', accent: 'bg-emerald-500', iconColor: 'text-emerald-600' },
  { type: 'CUT_VT',       label: '✂️ 재단-VT형',         color: 'border-emerald-500', accent: 'bg-emerald-500', iconColor: 'text-emerald-600' },
  { type: 'CUT_THERMAL',  label: '🌡 차열재 재단',       color: 'border-teal-500',    accent: 'bg-teal-500',    iconColor: 'text-teal-600' },
  { type: 'BEND_VM',      label: '🔨 절곡-VM브라켓',     color: 'border-orange-500',  accent: 'bg-orange-500',  iconColor: 'text-orange-600' },
  { type: 'BEND_VT',      label: '🔨 절곡-VT브라켓',     color: 'border-amber-500',   accent: 'bg-amber-500',   iconColor: 'text-amber-600' },
  { type: 'BEND_VT_RE',   label: '🔨 절곡-VT보강대',     color: 'border-amber-500',   accent: 'bg-amber-500',   iconColor: 'text-amber-600' },
  { type: 'LABEL',        label: '🏷 라벨 소요량',        color: 'border-purple-500',  accent: 'bg-purple-500',  iconColor: 'text-purple-600' },
];

const TAB_ACCENT_TEXT: Record<WoType, string> = {
  INSPECT:     'text-blue-700',
  CUT_VM:      'text-emerald-700',
  CUT_VT:      'text-emerald-700',
  CUT_THERMAL: 'text-teal-700',
  BEND_VM:     'text-orange-700',
  BEND_VT:     'text-amber-700',
  BEND_VT_RE:  'text-amber-700',
  LABEL:       'text-purple-700',
};

const TAB_ACCENT_BG: Record<WoType, string> = {
  INSPECT:     'bg-blue-50',
  CUT_VM:      'bg-emerald-50',
  CUT_VT:      'bg-emerald-50',
  CUT_THERMAL: 'bg-teal-50',
  BEND_VM:     'bg-orange-50',
  BEND_VT:     'bg-amber-50',
  BEND_VT_RE:  'bg-amber-50',
  LABEL:       'bg-purple-50',
};

const TAB_ACCENT_RING: Record<WoType, string> = {
  INSPECT:     'ring-blue-400',
  CUT_VM:      'ring-emerald-400',
  CUT_VT:      'ring-emerald-400',
  CUT_THERMAL: 'ring-teal-400',
  BEND_VM:     'ring-orange-400',
  BEND_VT:     'ring-amber-400',
  BEND_VT_RE:  'ring-amber-400',
  LABEL:       'ring-purple-400',
};

// ────────────────────────────────────────────────────────────────────────────
// 공정별 계산 함수
// ────────────────────────────────────────────────────────────────────────────
function calcData(type: WoType, W: number, H: number, qty: number): CalcRow[] {
  switch (type) {
    case 'CUT_VM':
      return [
        { label: '내부 가로 (W-5)',     length: W - 5,        qty: qty * 4 },
        { label: '내부 세로 (H-30)',    length: H - 30,       qty: qty * 4 },
        { label: '외부 상하 (W+60)',    length: W + 60,       qty: qty * 2 },
        { label: '외부 좌우 (H)',       length: H,            qty: qty * 2 },
      ];
    case 'CUT_VT':
      return [
        { label: '내부 가로 (W/2-20)', length: Math.round(W / 2 - 20), qty: qty * 16 },
        { label: '내부 세로 (H/2-20)', length: Math.round(H / 2 - 20), qty: qty * 16 },
        { label: '외부 상하 (W+60)',   length: W + 60,                  qty: qty * 4  },
        { label: '외부 좌우 (H)',      length: H,                       qty: qty * 4  },
      ];
    case 'CUT_THERMAL':
      return [
        { label: '외부 상하 (W+60) 세라믹울', length: W + 60, qty: qty * 2 },
        { label: '외부 좌우 (H) 세라믹울',    length: H,      qty: qty * 2 },
      ];
    case 'BEND_VM':
      return [
        { label: '상하 브라켓 (W-1)',   length: W - 1,  qty: qty * 4 },
        { label: '좌우 브라켓 (H-30)', length: H - 30, qty: qty * 4 },
      ];
    case 'BEND_VT':
      return [
        { label: '상하 브라켓 (W/2-16)', length: Math.round(W / 2 - 16), qty: qty * 16 },
        { label: '좌우 브라켓 (H/2-20)', length: Math.round(H / 2 - 20), qty: qty * 32 },
      ];
    case 'BEND_VT_RE':
      return [
        { label: '받침대 225mm (W/2-16)', length: Math.round(W / 2 - 16), qty: qty * 8  },
        { label: '보강대 237mm (H)',       length: H,                       qty: qty * 4  },
      ];
    case 'INSPECT':
      return [];
    case 'LABEL':
      return [
        { label: '라벨 (합계)',          length: null, qty: qty },
      ];
    default:
      return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 상태 배지
// ────────────────────────────────────────────────────────────────────────────
const statusConfig: Record<WoStatus, { label: string; icon: string; bg: string; text: string }> = {
  PLANNED:     { label: '📋 계획',  icon: '📋', bg: 'bg-blue-100',  text: 'text-blue-700'  },
  IN_PROGRESS: { label: '⚙️ 진행중', icon: '⚙️', bg: 'bg-amber-100', text: 'text-amber-700' },
  COMPLETED:   { label: '✅ 완료',  icon: '✅', bg: 'bg-green-100', text: 'text-green-700' },
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
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export function StructWorkOrderPage() {
  useAuth(); // 인증 확인
  const [activeTab, setActiveTab] = useState<WoType>('INSPECT');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [orders, setOrders] = useState<StructWO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // 프로젝트 목록
  useEffect(() => {
    api.get<{ data: Project[] }>('/projects')
      .then(r => setProjects(r.data ?? []))
      .catch(() => {});
  }, []);

  // 발주서 목록
  useEffect(() => {
    setSelectedPoId('');
    if (!selectedProjectId) { setPos([]); return; }
    api.get<{ data: PO[] }>(`/purchase-orders?project_id=${selectedProjectId}`)
      .then(r => setPos(r.data ?? []))
      .catch(() => setPos([]));
  }, [selectedProjectId]);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ wo_type: activeTab });
    if (selectedProjectId) qs.set('project_id', String(selectedProjectId));
    if (selectedPoId) qs.set('po_id', String(selectedPoId));
    api.get<{ data: StructWO[] }>(`/struct-work-orders?${qs}`)
      .then(r => setOrders(r.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [activeTab, selectedProjectId, selectedPoId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const currentTabConfig = WO_TABS.find(t => t.type === activeTab)!;

  const counts = useMemo(() => ({
    planned:    orders.filter(o => o.status === 'PLANNED').length,
    inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
    completed:  orders.filter(o => o.status === 'COMPLETED').length,
  }), [orders]);

  const handleStart = async (id: number) => {
    try {
      await api.patch(`/struct-work-orders/${id}/start`, {});
      fetchOrders();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async (id: number) => {
    if (!confirm('작업을 완료 처리하시겠습니까? (재고가 차감됩니다)')) return;
    try {
      await api.post(`/struct-work-orders/${id}/complete`, {});
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleDelete = async (wo: StructWO) => {
    if (wo.status === 'COMPLETED') { alert('완료된 작업지시는 삭제할 수 없습니다.'); return; }
    if (!confirm(`${wo.swo_number} 작업지시를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/struct-work-orders/${wo.swo_id}`);
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '삭제 실패'); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 다크 그래디언트 헤더 */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">구조체 작업지시</h1>
            <p className="text-slate-400 text-xs mt-0.5">소켓 구조체 전 공정 작업지시 관리</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4" />
            작업지시 생성
          </button>
        </div>

        {/* 필터 바 */}
        <div className="flex gap-3 mt-4">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-56 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="" className="text-gray-900 bg-white">전체 프로젝트</option>
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id} className="text-gray-900 bg-white">
                {p.project_name}
              </option>
            ))}
          </select>
          <select
            value={selectedPoId}
            onChange={e => setSelectedPoId(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!selectedProjectId}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-56 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="" className="text-gray-900 bg-white">전체 발주서</option>
            {pos.map(p => (
              <option key={p.po_id} value={p.po_id} className="text-gray-900 bg-white">
                {p.biz_name ? `[${p.biz_name}] ` : ''}{p.file_name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchOrders}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
            title="새로고침"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 탭 (수평 스크롤) */}
      <div className="bg-white border-b shadow-sm">
        <div className="flex overflow-x-auto no-scrollbar px-4">
          {WO_TABS.map(tab => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                activeTab === tab.type
                  ? `${tab.color} ${TAB_ACCENT_TEXT[tab.type]}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: '📋 계획', value: counts.planned,    color: 'border-l-blue-400  bg-blue-50  text-blue-700'  },
            { label: '⚙️ 진행중', value: counts.inProgress, color: 'border-l-amber-400 bg-amber-50 text-amber-700' },
            { label: '✅ 완료',  value: counts.completed,  color: 'border-l-green-400 bg-green-50 text-green-700' },
          ].map(c => (
            <div key={c.label} className={cn('rounded-xl border-l-4 p-3', c.color)}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs font-medium opacity-70 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* 목록 테이블 */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">지시번호</th>
                <th className="px-4 py-3 text-left font-medium">프로젝트</th>
                <th className="px-4 py-3 text-left font-medium">발주처</th>
                <th className="px-4 py-3 text-left font-medium">작업일</th>
                <th className="px-4 py-3 text-left font-medium">납기일</th>
                <th className="px-4 py-3 text-left font-medium">작업자</th>
                <th className="px-4 py-3 text-center font-medium">품목수</th>
                <th className="px-4 py-3 text-center font-medium">상태</th>
                <th className="px-4 py-3 text-center font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="h-8 w-8 text-gray-300 animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">불러오는 중...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <ClipboardList className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm font-medium">작업지시가 없습니다</p>
                    <p className="text-gray-300 text-xs mt-1">
                      위 [작업지시 생성] 버튼으로 새 작업지시를 만드세요.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map(wo => (
                  <tr key={wo.swo_id} className="border-b hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailId(wo.swo_id)}
                        className={cn('font-mono text-xs hover:underline', TAB_ACCENT_TEXT[wo.wo_type])}
                      >
                        {wo.swo_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate font-medium text-gray-800 text-xs">
                      {wo.project_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                      {wo.po_biz_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{wo.wo_date?.slice(0, 10) || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{wo.delivery_date?.slice(0, 10) || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{wo.worker || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{wo.item_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {wo.status === 'PLANNED' && (
                          <button
                            onClick={() => handleStart(wo.swo_id)}
                            title="작업 시작"
                            className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {wo.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleComplete(wo.swo_id)}
                            title="작업 완료 (재고 차감)"
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDetailId(wo.swo_id)}
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
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <CreateModal
          defaultWoType={activeTab}
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

      {/* 상세 모달 */}
      {detailId !== null && (
        <DetailModal
          woId={detailId}
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
function CreateModal({
  defaultWoType,
  projects,
  onClose,
  onCreated,
}: {
  defaultWoType: WoType;
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [woType, setWoType] = useState<WoType>(defaultWoType);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [poItems, setPoItems] = useState<PoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [form, setForm] = useState({
    wo_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    worker: '',
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // 발주서 목록 로드
  useEffect(() => {
    setSelectedPoId('');
    setPoItems([]);
    if (!selectedProjectId) { setPos([]); return; }
    api.get<{ data: PO[] }>(`/purchase-orders?project_id=${selectedProjectId}`)
      .then(r => setPos(r.data ?? []))
      .catch(() => setPos([]));
  }, [selectedProjectId]);

  // 발주서 + 공정 선택 시 항목 로드
  useEffect(() => {
    setPoItems([]);
    if (!selectedPoId || !woType) return;
    setLoadingItems(true);
    api.get<{ data: PoItem[] }>(`/po-items-for-wo?po_id=${selectedPoId}&wo_type=${woType}`)
      .then(r => setPoItems(r.data ?? []))
      .catch(() => setPoItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedPoId, woType]);

  const handleSubmit = async () => {
    if (!selectedPoId) { alert('발주서를 선택하세요.'); return; }
    if (poItems.length === 0) { alert('항목이 없습니다.'); return; }
    setSubmitting(true);
    try {
      // 백엔드에서 이미 qty=1로 분리된 항목들 — 그대로 저장
      const itemsWithCalc = poItems.map(item => {
        const W = item.width_mm ?? 0;
        const H = item.height_mm ?? 0;
        return {
          po_item_id: item.po_item_id,
          seq_no: item.global_seq,           // 분리 후 전체 일련번호
          product_type: item.product_type || item.structure,
          structure: item.structure || item.product_type,
          width_mm: W,
          height_mm: H,
          qty: 1,                            // 항상 1개
          division: item.division,
          install_location: item.install_location,
          remark: item.remark,
          // 분리 메타
          explode_index: item.explode_index,
          explode_total: item.explode_total,
          calc_data: calcData(woType, W, H, 1),
        };
      });

      const res = await api.post<{ data: any }>('/struct-work-orders', {
        wo_type: woType,
        po_id: selectedPoId,
        project_id: selectedProjectId || null,
        ...form,
        delivery_date: form.delivery_date || null,
        items: itemsWithCalc,
      });

      alert(`✅ ${res.data?.swo_number ?? ''} 생성 완료`);
      onCreated();
    } catch (e: any) {
      alert(e?.body?.error || '생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const tabConfig = WO_TABS.find(t => t.type === woType)!;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-700 to-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">구조체 작업지시 생성</h2>
            <p className="text-slate-400 text-xs mt-0.5">발주서를 선택하여 공정별 작업지시를 생성합니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[76vh] overflow-y-auto">
          {/* 공정 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">공정 선택 *</label>
            <div className="flex flex-wrap gap-2">
              {WO_TABS.map(tab => (
                <button
                  key={tab.type}
                  onClick={() => setWoType(tab.type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    woType === tab.type
                      ? `${tab.color.replace('border', 'border')} ${TAB_ACCENT_BG[tab.type]} ${TAB_ACCENT_TEXT[tab.type]} ring-1 ${TAB_ACCENT_RING[tab.type]}`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 프로젝트 + 발주서 선택 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">프로젝트 *</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">프로젝트 선택</option>
                {projects.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">발주서 *</label>
              <select
                value={selectedPoId}
                onChange={e => setSelectedPoId(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!selectedProjectId}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
              >
                <option value="">발주서 선택</option>
                {pos.map(p => (
                  <option key={p.po_id} value={p.po_id}>
                    {p.biz_name ? `[${p.biz_name}] ` : ''}{p.file_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 항목 테이블 */}
          {selectedPoId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">
                  발주 항목 {loadingItems ? '(로딩중...)' : `(${poItems.length}건 — 소켓 ${poItems.length}개 개별)`}
                </label>
                {!loadingItems && poItems.length === 0 && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />항목 없음
                  </span>
                )}
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-8 border rounded-xl bg-gray-50">
                  <Loader2 className="h-6 w-6 text-gray-400 animate-spin mr-2" />
                  <span className="text-gray-400 text-sm">항목 불러오는 중...</span>
                </div>
              ) : poItems.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">No</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">구조체</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">가로(W)</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">세로(H)</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                          {woType === 'INSPECT' && (
                            <>
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">분할</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">설치위치</th>
                            </>
                          )}
                          {woType !== 'INSPECT' && woType !== 'LABEL' && (
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">공정 계산</th>
                          )}
                          {woType === 'LABEL' && (
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">라벨 소요</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {poItems.map((item, rowIdx) => {
                          const W = item.width_mm;
                          const H = item.height_mm;
                          const rows = calcData(woType, W ?? 0, H ?? 0, 1);
                          const isMulti = item.explode_total > 1;
                          return (
                            <tr key={`${item.po_item_id}-${item.explode_index}`}
                              className={rowIdx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-100/60'}>
                              {/* 일련번호 */}
                              <td className="px-3 py-2 text-gray-400 font-mono">{item.global_seq}</td>
                              {/* 구조체 + 분리표시 */}
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-800 text-xs">{item.structure || item.product_type || '-'}</div>
                                {isMulti && (
                                  <div className="text-[10px] text-blue-500 font-mono mt-0.5">
                                    {item.explode_index}/{item.explode_total}번
                                  </div>
                                )}
                              </td>
                              {/* 가로(W) — 항상 표시 */}
                              <td className="px-3 py-2 text-center">
                                {W != null && W > 0
                                  ? <span className="font-mono font-semibold text-gray-800">{W}</span>
                                  : <span className="text-gray-300 text-xs">미입력</span>}
                              </td>
                              {/* 세로(H) — 항상 표시 */}
                              <td className="px-3 py-2 text-center">
                                {H != null && H > 0
                                  ? <span className="font-mono font-semibold text-gray-800">{H}</span>
                                  : <span className="text-gray-300 text-xs">미입력</span>}
                              </td>
                              {/* 수량 — 항상 1 */}
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                              </td>
                              {woType === 'INSPECT' && (
                                <>
                                  <td className="px-3 py-2 text-gray-500 text-xs">{item.division || '-'}</td>
                                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[100px] truncate">{item.install_location || '-'}</td>
                                </>
                              )}
                              {woType !== 'INSPECT' && woType !== 'LABEL' && (
                                <td className="px-3 py-2">
                                  {W && H ? (
                                    <div className="space-y-0.5">
                                      {rows.map((row, i) => (
                                        <div key={i} className="flex gap-2 text-[10px]">
                                          <span className="text-gray-400 truncate max-w-[110px]">{row.label}</span>
                                          <span className={cn('font-mono font-bold shrink-0', TAB_ACCENT_TEXT[woType])}>
                                            {row.length !== null ? `${row.length}mm` : ''} × {row.qty}ea
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-amber-500 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> 규격 없음
                                    </span>
                                  )}
                                </td>
                              )}
                              {woType === 'LABEL' && (
                                <td className="px-3 py-2 text-center">
                                  <span className={cn('font-mono font-bold text-sm', TAB_ACCENT_TEXT[woType])}>1</span>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* 작업 기본정보 */}
          {selectedPoId && poItems.length > 0 && (
            <div className={cn('rounded-xl p-4 space-y-3 border', TAB_ACCENT_BG[woType])}>
              <h3 className={cn('text-xs font-semibold flex items-center gap-1.5', TAB_ACCENT_TEXT[woType])}>
                <Info className="h-3.5 w-3.5" />
                작업 기본정보
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">작업일 *</label>
                  <input
                    type="date"
                    value={form.wo_date}
                    onChange={e => setForm(f => ({ ...f, wo_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">납기일</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">비고</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="비고사항"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPoId || poItems.length === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-medium transition-all',
              submitting || !selectedPoId || poItems.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-900 text-white',
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? '저장 중...' : `작업지시 생성 (${poItems.length}건)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 상세 모달
// ────────────────────────────────────────────────────────────────────────────
function DetailModal({
  woId,
  onClose,
  onRefresh,
}: {
  woId: number;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editWorker, setEditWorker] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<{ data: any }>(`/struct-work-orders/${woId}`)
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
      await api.patch(`/struct-work-orders/${woId}/start`, {});
      const r = await api.get<{ data: any }>(`/struct-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async () => {
    if (!confirm('작업을 완료 처리하시겠습니까? (재고가 차감됩니다)')) return;
    try {
      await api.post(`/struct-work-orders/${woId}/complete`, {});
      const r = await api.get<{ data: any }>(`/struct-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/struct-work-orders/${woId}`, {
        worker: editWorker || null,
        remarks: editRemarks || null,
      });
      onRefresh();
      onClose();
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  const d = detail;
  const woType: WoType = d?.wo_type ?? 'INSPECT';
  const tabCfg = WO_TABS.find(t => t.type === woType) ?? WO_TABS[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-700 to-slate-900 rounded-t-2xl">
          <div>
            <p className={cn('font-mono text-xs', TAB_ACCENT_TEXT[woType]?.replace('700', '300') || 'text-slate-300')}>
              {d?.swo_number ?? '...'}
            </p>
            <h2 className="text-base font-bold text-white mt-0.5">{d?.project_name ?? '로딩 중...'}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{tabCfg.label}</p>
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
                  <CheckCircle2 className="h-3.5 w-3.5" />작업 완료 (재고 차감)
                </button>
              )}
            </div>

            {/* 기본 정보 그리드 */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '작업일',  val: d?.wo_date?.slice(0, 10) },
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '납기일',  val: d?.delivery_date?.slice(0, 10) },
                { icon: <Package  className="h-3.5 w-3.5" />, label: '발주처',  val: d?.po_biz_name },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-gray-400 mb-0.5">
                    {f.icon}<span>{f.label}</span>
                  </div>
                  <p className="font-medium text-gray-800">{f.val || '-'}</p>
                </div>
              ))}
            </div>

            {/* 수정 가능 필드 */}
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
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-gray-50 disabled:text-gray-400"
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
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-gray-50 disabled:text-gray-400"
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">No</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">구조체</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">W×H</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                          {woType !== 'INSPECT' && woType !== 'LABEL' && (
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">공정 계산값</th>
                          )}
                          {woType === 'INSPECT' && (
                            <>
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">분할</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">설치위치</th>
                            </>
                          )}
                          {woType === 'LABEL' && (
                            <th className="px-3 py-2 text-center text-gray-500 font-medium">라벨</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {d.items.map((item: any) => {
                          const calcRows: CalcRow[] = item.calc_data
                            ?? calcData(woType, item.width_mm ?? 0, item.height_mm ?? 0, item.qty ?? 1);
                          return (
                            <tr key={item.item_id ?? item.po_item_id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400">{item.seq_no}</td>
                              <td className="px-3 py-2 font-medium text-gray-800 max-w-[120px] truncate">
                                {item.structure || '-'}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">
                                {item.width_mm && item.height_mm
                                  ? `${item.width_mm}×${item.height_mm}`
                                  : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-bold">{item.qty ?? '-'}</td>
                              {woType !== 'INSPECT' && woType !== 'LABEL' && (
                                <td className="px-3 py-2">
                                  <div className="space-y-0.5">
                                    {calcRows.map((row, i) => (
                                      <div key={i} className="flex gap-2 text-[10px]">
                                        <span className="text-gray-400 truncate max-w-[110px]">{row.label}</span>
                                        <span className={cn('font-mono font-bold shrink-0', TAB_ACCENT_TEXT[woType])}>
                                          {row.length !== null ? `${row.length}mm` : ''} × {row.qty}ea
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              )}
                              {woType === 'INSPECT' && (
                                <>
                                  <td className="px-3 py-2 text-gray-500">{item.division || '-'}</td>
                                  <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">
                                    {item.install_location || '-'}
                                  </td>
                                </>
                              )}
                              {woType === 'LABEL' && (
                                <td className="px-3 py-2 text-center">
                                  <span className={cn('font-mono font-bold', TAB_ACCENT_TEXT[woType])}>
                                    {item.qty ?? '-'}
                                  </span>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            닫기
          </button>
          {d?.status !== 'COMPLETED' && !loading && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-slate-700 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
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
