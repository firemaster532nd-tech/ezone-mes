import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  Plus, X, AlertTriangle, CheckCircle2,
  ClipboardList, Calendar, User, Play, CheckCheck,
  Trash2, Pencil, Loader2, AlertCircle, RefreshCw,
  Package, Info, Layers, Zap, Flame,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────
type SubWoType =
  | 'OUTER_SHEET_CUT'
  | 'OUTER_WOOL_CUT'
  | 'OUTER_ASSY'
  | 'THERMAL_ATTACH'
  | 'GAP_SHEET_CUT'
  | 'GAP_WOOL_CUT'
  | 'GAP_ASSY'
  | 'FLASH_I'
  | 'FLASH_Z'
  | 'FLASH_L';

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
  width_mm: number | null;
  height_mm: number | null;
  qty: number;
  division: string | null;
  install_location: string | null;
  remark: string | null;
  sheet_name: string | null;
  global_seq: number;
  explode_index: number;
  explode_total: number;
}

interface CalcRow {
  label: string;
  value: string;
}

interface SubWO {
  sub_wo_id: number;
  sub_wo_number: string;
  wo_type: SubWoType;
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

interface AssemblyLot {
  lot_id: number;
  lot_number: string;
  status: string;
  qty: number;
  created_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 탭 설정
// ────────────────────────────────────────────────────────────────────────────
type TabGroup = 'OUTER' | 'GAP' | 'FLASH';

const WO_TABS: {
  type: SubWoType;
  label: string;
  group: TabGroup;
  color: string;
  accent: string;
  iconColor: string;
  accentText: string;
  accentBg: string;
  accentRing: string;
}[] = [
  {
    type: 'OUTER_SHEET_CUT',
    label: '🔥 외부-차열시트 재단',
    group: 'OUTER',
    color: 'border-rose-500',
    accent: 'bg-rose-500',
    iconColor: 'text-rose-600',
    accentText: 'text-rose-700',
    accentBg: 'bg-rose-50',
    accentRing: 'ring-rose-400',
  },
  {
    type: 'OUTER_WOOL_CUT',
    label: '🔥 외부-세라믹울 재단',
    group: 'OUTER',
    color: 'border-rose-500',
    accent: 'bg-rose-500',
    iconColor: 'text-rose-600',
    accentText: 'text-rose-700',
    accentBg: 'bg-rose-50',
    accentRing: 'ring-rose-400',
  },
  {
    type: 'OUTER_ASSY',
    label: '🔥 외부차열재 조립',
    group: 'OUTER',
    color: 'border-red-500',
    accent: 'bg-red-500',
    iconColor: 'text-red-600',
    accentText: 'text-red-700',
    accentBg: 'bg-red-50',
    accentRing: 'ring-red-400',
  },
  {
    type: 'THERMAL_ATTACH',
    label: '🔥 외부차열재 부착',
    group: 'OUTER',
    color: 'border-red-600',
    accent: 'bg-red-600',
    iconColor: 'text-red-700',
    accentText: 'text-red-800',
    accentBg: 'bg-red-50',
    accentRing: 'ring-red-500',
  },
  {
    type: 'GAP_SHEET_CUT',
    label: '📋 틈새-차열시트 재단',
    group: 'GAP',
    color: 'border-amber-500',
    accent: 'bg-amber-500',
    iconColor: 'text-amber-600',
    accentText: 'text-amber-700',
    accentBg: 'bg-amber-50',
    accentRing: 'ring-amber-400',
  },
  {
    type: 'GAP_WOOL_CUT',
    label: '📋 틈새-세라믹울 재단',
    group: 'GAP',
    color: 'border-amber-500',
    accent: 'bg-amber-500',
    iconColor: 'text-amber-600',
    accentText: 'text-amber-700',
    accentBg: 'bg-amber-50',
    accentRing: 'ring-amber-400',
  },
  {
    type: 'GAP_ASSY',
    label: '📋 틈새시트 조립',
    group: 'GAP',
    color: 'border-yellow-500',
    accent: 'bg-yellow-500',
    iconColor: 'text-yellow-600',
    accentText: 'text-yellow-700',
    accentBg: 'bg-yellow-50',
    accentRing: 'ring-yellow-400',
  },
  {
    type: 'FLASH_I',
    label: '⚡ 플래싱 I형',
    group: 'FLASH',
    color: 'border-cyan-500',
    accent: 'bg-cyan-500',
    iconColor: 'text-cyan-600',
    accentText: 'text-cyan-700',
    accentBg: 'bg-cyan-50',
    accentRing: 'ring-cyan-400',
  },
  {
    type: 'FLASH_Z',
    label: '⚡ 플래싱 Z형',
    group: 'FLASH',
    color: 'border-sky-500',
    accent: 'bg-sky-500',
    iconColor: 'text-sky-600',
    accentText: 'text-sky-700',
    accentBg: 'bg-sky-50',
    accentRing: 'ring-sky-400',
  },
  {
    type: 'FLASH_L',
    label: '⚡ 플래싱 L형',
    group: 'FLASH',
    color: 'border-sky-600',
    accent: 'bg-sky-600',
    iconColor: 'text-sky-700',
    accentText: 'text-sky-800',
    accentBg: 'bg-sky-50',
    accentRing: 'ring-sky-500',
  },
];

// ────────────────────────────────────────────────────────────────────────────
// 공정별 계산
// ────────────────────────────────────────────────────────────────────────────
function calcSubData(type: SubWoType, W: number, H: number, qty: number): CalcRow[] {
  switch (type) {
    case 'OUTER_SHEET_CUT':
      return [
        { label: '상하 (W+60) × 수량×2', value: `${W + 60}mm × ${qty * 2}ea` },
        { label: '좌우 (H) × 수량×2',    value: `${H}mm × ${qty * 2}ea` },
      ];
    case 'OUTER_WOOL_CUT': {
      // 128K, 폭200mm, 두께25T
      const totalLen = (W + 60) * 2 + H * 2;
      const rolls = Math.ceil(totalLen / 4000);
      return [
        { label: '세라믹울 128K/폭200/25T 총길이', value: `${totalLen}mm` },
        { label: '롤 수량 (4000mm/롤)',             value: `${rolls}롤` },
      ];
    }
    case 'OUTER_ASSY':
      return [
        { label: '조립 수량',      value: `${qty}ea` },
        { label: '로트 생성 예정', value: '생성됨' },
      ];
    case 'THERMAL_ATTACH':
      return [
        { label: 'Assembly Lot 사용', value: '드롭다운 선택' },
        { label: '부착 수량',         value: `${qty}ea` },
      ];
    case 'GAP_SHEET_CUT':
      // 차열시트(압출): W185 × L4000 × T4
      return [
        { label: '차열시트 W185×L4000×T4', value: `${qty}장` },
      ];
    case 'GAP_WOOL_CUT':
      // 세라믹울: 200폭 × 25T × 96K
      return [
        { label: '세라믹울 200폭×25T×96K', value: `${qty}ea` },
      ];
    case 'GAP_ASSY':
      // 틈새복합시트 = 차열시트(W185×L4000×T4) + 세라믹울(200폭×25T×96K)
      return [
        { label: '차열시트(압출) W185×L4000×T4',  value: `${qty}장` },
        { label: '세라믹울 200폭×25T×96K',        value: `${qty}ea` },
        { label: '틈새복합시트 완성(재고 등록)',   value: `${qty}ea` },
      ];
    case 'FLASH_I':
      // I형: 아연철판(W125×L1000×T0.5) + 차열시트(T5×W125×L4000)
      return [
        { label: '아연철판 I형 W125×L1000×T0.5', value: `${qty}ea` },
        { label: '차열시트 T5×W125×L4000',       value: `${qty}ea` },
      ];
    case 'FLASH_Z':
      // Z형: 아연철판(W170×L1000×T0.5) + 차열시트(T4×W125×L4000)
      return [
        { label: '아연철판 Z형 W170×L1000×T0.5', value: `${qty}ea` },
        { label: '차열시트 T4×W125×L4000',       value: `${qty}ea` },
      ];
    case 'FLASH_L':
      // L형: 아연철판(W185×L1000×T0.5) + 차열시트(T5×W125×L4000)
      return [
        { label: '아연철판 L형 W185×L1000×T0.5', value: `${qty}ea` },
        { label: '차열시트 T5×W125×L4000',       value: `${qty}ea` },
      ];
    default:
      return [];
  }
}

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
// 그룹 헤더 배지
// ────────────────────────────────────────────────────────────────────────────
function GroupBadge({ group }: { group: TabGroup }) {
  if (group === 'OUTER') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-100 text-rose-700 mr-1">
      <Flame className="h-2.5 w-2.5" />외부차열재
    </span>
  );
  if (group === 'GAP') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 mr-1">
      <Layers className="h-2.5 w-2.5" />틈새시트
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-cyan-100 text-cyan-700 mr-1">
      <Zap className="h-2.5 w-2.5" />플래싱
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 하단 재고 카드
// ────────────────────────────────────────────────────────────────────────────
function BottomStockPanel({ activeTab }: { activeTab: SubWoType }) {
  const [lots, setLots] = useState<AssemblyLot[]>([]);
  const [gapStock, setGapStock] = useState<any>(null);
  const [flashStock, setFlashStock] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'OUTER_ASSY' || activeTab === 'THERMAL_ATTACH') {
      setLoading(true);
      api.get<{ data: AssemblyLot[] }>('/assembly-lots?status=ACTIVE')
        .then(r => setLots(r.data ?? []))
        .catch(() => setLots([]))
        .finally(() => setLoading(false));
    } else if (activeTab === 'GAP_ASSY') {
      setLoading(true);
      api.get<{ data: any }>('/gap-sheet-stock')
        .then(r => setGapStock(r.data))
        .catch(() => setGapStock(null))
        .finally(() => setLoading(false));
    } else if (activeTab === 'FLASH_I' || activeTab === 'FLASH_Z' || activeTab === 'FLASH_L') {
      setLoading(true);
      api.get<{ data: any }>('/flashing-stock')
        .then(r => setFlashStock(r.data))
        .catch(() => setFlashStock(null))
        .finally(() => setLoading(false));
    }
  }, [activeTab]);

  if (!['OUTER_ASSY', 'THERMAL_ATTACH', 'GAP_ASSY', 'FLASH_I', 'FLASH_Z', 'FLASH_L'].includes(activeTab)) {
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border bg-white shadow-sm p-4">
      {(activeTab === 'OUTER_ASSY' || activeTab === 'THERMAL_ATTACH') && (
        <>
          <h3 className="text-xs font-semibold text-rose-700 mb-3 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />Assembly Lot 현황 (ACTIVE)
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
              <Loader2 className="h-4 w-4 animate-spin" />불러오는 중...
            </div>
          ) : lots.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">ACTIVE 상태의 Assembly Lot이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-rose-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-rose-600 font-medium">Lot 번호</th>
                    <th className="px-3 py-2 text-center text-rose-600 font-medium">수량</th>
                    <th className="px-3 py-2 text-center text-rose-600 font-medium">상태</th>
                    <th className="px-3 py-2 text-left text-rose-600 font-medium">생성일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lots.map(lot => (
                    <tr key={lot.lot_id} className="hover:bg-rose-50/40">
                      <td className="px-3 py-2 font-mono text-rose-700 font-semibold">{lot.lot_number}</td>
                      <td className="px-3 py-2 text-center font-bold">{lot.qty}ea</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-medium">
                          {lot.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{lot.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'GAP_ASSY' && (
        <>
          <h3 className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />틈새시트 재고 현황
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
              <Loader2 className="h-4 w-4 animate-spin" />불러오는 중...
            </div>
          ) : gapStock ? (
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(gapStock).map(([key, val]) => (
                <div key={key} className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium">{key}</p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">{String(val)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">재고 정보를 불러올 수 없습니다</p>
          )}
        </>
      )}

      {(activeTab === 'FLASH_I' || activeTab === 'FLASH_Z' || activeTab === 'FLASH_L') && (
        <>
          <h3 className="text-xs font-semibold text-cyan-700 mb-3 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />플래싱 재고 현황
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
              <Loader2 className="h-4 w-4 animate-spin" />불러오는 중...
            </div>
          ) : flashStock ? (
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'I형', val: flashStock.flash_i ?? 0, color: 'bg-cyan-50 border-cyan-100 text-cyan-700 text-cyan-800' },
                { key: 'Z형', val: flashStock.flash_z ?? 0, color: 'bg-sky-50 border-sky-100 text-sky-700 text-sky-800' },
                { key: 'L형', val: flashStock.flash_l ?? 0, color: 'bg-teal-50 border-teal-100 text-teal-700 text-teal-800' },
              ].map(item => (
                <div key={item.key} className={cn('rounded-lg p-3 border', item.color.split(' ').slice(0, 2).join(' '))}>
                  <p className={cn('text-xs font-medium', item.color.split(' ')[2])}>{item.key}</p>
                  <p className={cn('text-2xl font-bold mt-1', item.color.split(' ')[3])}>{item.val}ea</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">재고 정보를 불러올 수 없습니다</p>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export function SubWorkOrderPage() {
  useAuth();
  const [activeTab, setActiveTab] = useState<SubWoType>('OUTER_SHEET_CUT');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [orders, setOrders] = useState<SubWO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const currentTab = WO_TABS.find(t => t.type === activeTab)!;

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
    api.get<{ data: SubWO[] }>(`/sub-work-orders?${qs}`)
      .then(r => setOrders(r.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [activeTab, selectedProjectId, selectedPoId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const counts = useMemo(() => ({
    planned:    orders.filter(o => o.status === 'PLANNED').length,
    inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
    completed:  orders.filter(o => o.status === 'COMPLETED').length,
  }), [orders]);

  const handleStart = async (id: number) => {
    try {
      await api.patch(`/sub-work-orders/${id}/start`, {});
      fetchOrders();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async (id: number) => {
    if (!confirm('작업을 완료 처리하시겠습니까?')) return;
    try {
      await api.post(`/sub-work-orders/${id}/complete`, {});
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleDelete = async (wo: SubWO) => {
    if (wo.status === 'COMPLETED') { alert('완료된 작업지시는 삭제할 수 없습니다.'); return; }
    if (!confirm(`${wo.sub_wo_number} 작업지시를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/sub-work-orders/${wo.sub_wo_id}`);
      fetchOrders();
    } catch (e: any) { alert(e?.body?.error || '삭제 실패'); }
  };

  // 그룹 구분선 여부
  let prevGroup: TabGroup | null = null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 px-6 py-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">부자재 작업지시</h1>
            <p className="text-rose-300 text-xs mt-0.5">외부차열재 · 틈새시트 · 플래싱 전 공정 작업지시 관리</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
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
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="" className="text-gray-900 bg-white">전체 프로젝트</option>
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id} className="text-gray-900 bg-white">{p.project_name}</option>
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

      {/* 탭 (수평 스크롤, 그룹 구분선 포함) */}
      <div className="bg-white border-b shadow-sm">
        <div className="flex overflow-x-auto no-scrollbar px-4 items-center">
          {WO_TABS.map(tab => {
            const showDivider = prevGroup !== null && prevGroup !== tab.group;
            prevGroup = tab.group;
            return (
              <span key={tab.type} className="flex items-center shrink-0">
                {showDivider && <span className="w-px h-5 bg-gray-200 mx-2 shrink-0" />}
                <button
                  onClick={() => setActiveTab(tab.type)}
                  className={cn(
                    'shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
                    activeTab === tab.type
                      ? `${tab.color} ${tab.accentText}`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  )}
                >
                  {tab.label}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4">
        {/* 현재 탭 그룹 배지 */}
        <div className="flex items-center gap-2 mb-3">
          <GroupBadge group={currentTab.group} />
          <span className="text-sm font-semibold text-gray-700">{currentTab.label}</span>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
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
                    <p className="text-gray-300 text-xs mt-1">위 [작업지시 생성] 버튼으로 새 작업지시를 만드세요.</p>
                  </td>
                </tr>
              ) : (
                orders.map(wo => (
                  <tr key={wo.sub_wo_id} className="border-b hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailId(wo.sub_wo_id)}
                        className={cn('font-mono text-xs hover:underline', currentTab.accentText)}
                      >
                        {wo.sub_wo_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate font-medium text-gray-800 text-xs">
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
                            onClick={() => handleStart(wo.sub_wo_id)}
                            title="작업 시작"
                            className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {wo.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleComplete(wo.sub_wo_id)}
                            title="작업 완료"
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDetailId(wo.sub_wo_id)}
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

        {/* 하단 재고 패널 */}
        <BottomStockPanel activeTab={activeTab} />
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <SubCreateModal
          defaultWoType={activeTab}
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

      {/* 상세 모달 */}
      {detailId !== null && (
        <SubDetailModal
          woId={detailId}
          woType={activeTab}
          onClose={() => setDetailId(null)}
          onRefresh={fetchOrders}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 생성 모달
// ────────────────────────────────────────────────────────────────────────────
function SubCreateModal({
  defaultWoType,
  projects,
  onClose,
  onCreated,
}: {
  defaultWoType: SubWoType;
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [woType, setWoType] = useState<SubWoType>(defaultWoType);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [poItems, setPoItems] = useState<PoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [assemblyLots, setAssemblyLots] = useState<AssemblyLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<number | ''>('');
  const [form, setForm] = useState({
    wo_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    worker: '',
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const currentTabCfg = WO_TABS.find(t => t.type === woType)!;

  useEffect(() => {
    setSelectedPoId('');
    setPoItems([]);
    if (!selectedProjectId) { setPos([]); return; }
    api.get<{ data: PO[] }>(`/purchase-orders?project_id=${selectedProjectId}`)
      .then(r => setPos(r.data ?? []))
      .catch(() => setPos([]));
  }, [selectedProjectId]);

  useEffect(() => {
    setPoItems([]);
    if (!selectedPoId || !woType) return;
    setLoadingItems(true);
    api.get<{ data: PoItem[] }>(`/po-items-for-wo?po_id=${selectedPoId}&wo_type=${woType}`)
      .then(r => setPoItems(r.data ?? []))
      .catch(() => setPoItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedPoId, woType]);

  useEffect(() => {
    if (woType === 'THERMAL_ATTACH') {
      api.get<{ data: AssemblyLot[] }>('/assembly-lots?status=ACTIVE')
        .then(r => setAssemblyLots(r.data ?? []))
        .catch(() => setAssemblyLots([]));
    }
  }, [woType]);

  const handleSubmit = async () => {
    if (!selectedPoId) { alert('발주서를 선택하세요.'); return; }
    if (poItems.length === 0) { alert('항목이 없습니다.'); return; }
    setSubmitting(true);
    try {
      const itemsWithCalc = poItems.map(item => {
        const W = item.width_mm ?? 0;
        const H = item.height_mm ?? 0;
        return {
          po_item_id: item.po_item_id,
          seq_no: item.global_seq,
          product_type: item.product_type || item.structure,
          structure: item.structure || item.product_type,
          width_mm: W,
          height_mm: H,
          qty: item.qty ?? 1,
          division: item.division,
          install_location: item.install_location,
          remark: item.remark,
          explode_index: item.explode_index,
          explode_total: item.explode_total,
          calc_data: calcSubData(woType, W, H, item.qty ?? 1),
        };
      });

      const payload: any = {
        wo_type: woType,
        po_id: selectedPoId,
        project_id: selectedProjectId || null,
        ...form,
        delivery_date: form.delivery_date || null,
        items: itemsWithCalc,
      };
      if (woType === 'THERMAL_ATTACH' && selectedLotId) {
        payload.assembly_lot_id = selectedLotId;
      }

      const res = await api.post<{ data: any }>('/sub-work-orders', payload);
      alert(`✅ ${res.data?.sub_wo_number ?? ''} 생성 완료`);
      onCreated();
    } catch (e: any) {
      alert(e?.body?.error || '생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-white">부자재 작업지시 생성</h2>
            <p className="text-rose-300 text-xs mt-0.5">발주서를 선택하여 공정별 작업지시를 생성합니다</p>
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
                      ? `${tab.color} ${tab.accentBg} ${tab.accentText} ring-1 ${tab.accentRing}`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 프로젝트 + 발주서 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">프로젝트 *</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
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
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
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

          {/* THERMAL_ATTACH: Assembly Lot 선택 */}
          {woType === 'THERMAL_ATTACH' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assembly Lot 선택</label>
              <select
                value={selectedLotId}
                onChange={e => setSelectedLotId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <option value="">Lot 선택 (선택사항)</option>
                {assemblyLots.map(lot => (
                  <option key={lot.lot_id} value={lot.lot_id}>
                    {lot.lot_number} — {lot.qty}ea
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 항목 테이블 */}
          {selectedPoId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">
                  발주 항목 {loadingItems ? '(로딩중...)' : `(${poItems.length}건)`}
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
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">W</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">H</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">수량</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">공정 계산</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {poItems.map((item, rowIdx) => {
                          const W = item.width_mm ?? 0;
                          const H = item.height_mm ?? 0;
                          const rows = calcSubData(woType, W, H, item.qty ?? 1);
                          return (
                            <tr
                              key={`${item.po_item_id}-${item.explode_index}`}
                              className={rowIdx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/60 hover:bg-gray-100/60'}
                            >
                              <td className="px-3 py-2 text-gray-400 font-mono">{item.global_seq}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-800">{item.structure || item.product_type || '-'}</div>
                                {item.explode_total > 1 && (
                                  <div className="text-[10px] text-blue-500 font-mono mt-0.5">
                                    {item.explode_index}/{item.explode_total}번
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-gray-800">
                                {W > 0 ? W : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-gray-800">
                                {H > 0 ? H : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                                  {item.qty ?? 1}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {W > 0 && H > 0 ? (
                                  <div className="space-y-0.5">
                                    {rows.map((row, i) => (
                                      <div key={i} className="flex gap-2 text-[10px]">
                                        <span className="text-gray-400 truncate max-w-[110px]">{row.label}</span>
                                        <span className={cn('font-mono font-bold shrink-0', currentTabCfg.accentText)}>
                                          {row.value}
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
            <div className={cn('rounded-xl p-4 space-y-3 border', currentTabCfg.accentBg)}>
              <h3 className={cn('text-xs font-semibold flex items-center gap-1.5', currentTabCfg.accentText)}>
                <Info className="h-3.5 w-3.5" />작업 기본정보
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">작업일 *</label>
                  <input
                    type="date"
                    value={form.wo_date}
                    onChange={e => setForm(f => ({ ...f, wo_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">납기일</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
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
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">비고</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="비고사항"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPoId || poItems.length === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-medium transition-all',
              submitting || !selectedPoId || poItems.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-rose-700 hover:bg-rose-900 text-white',
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
function SubDetailModal({
  woId,
  woType,
  onClose,
  onRefresh,
}: {
  woId: number;
  woType: SubWoType;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editWorker, setEditWorker] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const tabCfg = WO_TABS.find(t => t.type === woType) ?? WO_TABS[0];

  useEffect(() => {
    setLoading(true);
    api.get<{ data: any }>(`/sub-work-orders/${woId}`)
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
      await api.patch(`/sub-work-orders/${woId}/start`, {});
      const r = await api.get<{ data: any }>(`/sub-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch { alert('작업 시작 실패'); }
  };

  const handleComplete = async () => {
    if (!confirm('작업을 완료 처리하시겠습니까?')) return;
    try {
      await api.post(`/sub-work-orders/${woId}/complete`, {});
      const r = await api.get<{ data: any }>(`/sub-work-orders/${woId}`);
      setDetail(r.data);
      onRefresh();
    } catch (e: any) { alert(e?.body?.error || '완료 처리 실패'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/sub-work-orders/${woId}`, {
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
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 rounded-t-2xl">
          <div>
            <p className="font-mono text-xs text-rose-300">{d?.sub_wo_number ?? '...'}</p>
            <h2 className="text-base font-bold text-white mt-0.5">{d?.project_name ?? '로딩 중...'}</h2>
            <p className="text-rose-200 text-xs mt-0.5">{tabCfg.label}</p>
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
                  <CheckCircle2 className="h-3.5 w-3.5" />작업 완료
                </button>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '작업일', val: d?.wo_date?.slice(0, 10) },
                { icon: <Calendar className="h-3.5 w-3.5" />, label: '납기일', val: d?.delivery_date?.slice(0, 10) },
                { icon: <Package  className="h-3.5 w-3.5" />, label: '발주처', val: d?.po_biz_name },
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
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-50 disabled:text-gray-400"
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
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-50 disabled:text-gray-400"
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
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">공정 계산값</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {d.items.map((item: any) => {
                          const calcRows: CalcRow[] = item.calc_data
                            ?? calcSubData(woType, item.width_mm ?? 0, item.height_mm ?? 0, item.qty ?? 1);
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
                              <td className="px-3 py-2">
                                <div className="space-y-0.5">
                                  {calcRows.map((row, i) => (
                                    <div key={i} className="flex gap-2 text-[10px]">
                                      <span className="text-gray-400 truncate max-w-[110px]">{row.label}</span>
                                      <span className={cn('font-mono font-bold shrink-0', tabCfg.accentText)}>
                                        {row.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">닫기</button>
          {d?.status !== 'COMPLETED' && !loading && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-rose-700 hover:bg-rose-900 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
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
