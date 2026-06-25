import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Plus, Download, RefreshCw, X, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const COLUMN_SPECS: { item_spec: string; label: string }[] = [
  { item_spec: '글라스울(24K)',           label: '글라스울\n(24K)' },
  { item_spec: '글라스울(25T×1400)',      label: '글라스울\n(25T×1400)' },
  { item_spec: '글라스울(25T×1000)',      label: '글라스울\n(25T×1000)' },
  { item_spec: '세라믹블랭킷(96K)',        label: '세라믹\n(96K)' },
  { item_spec: '세라믹블랭킷(128K)',       label: '세라믹\n(128K)' },
  { item_spec: '세라믹블랭킷(25T×200)',   label: '세라믹\n(25T×200)' },
  { item_spec: '세라믹블랭킷(38T×600)',   label: '세라믹\n(38T×600)' },
  { item_spec: '세라믹블랭킷(50T×400)',   label: '세라믹\n(50T×400)' },
  { item_spec: '세라믹블랭킷(50T×600)',   label: '세라믹\n(50T×600)' },
  { item_spec: 'VT-01',                  label: 'VT-01' },
  { item_spec: 'VT-049',                 label: 'VT-049' },
  { item_spec: 'VT-064',                 label: 'VT-064' },
  { item_spec: 'VA-064',                 label: 'VA-064' },
  { item_spec: 'HTG-064',                label: 'HTG-064' },
  { item_spec: 'HTG-1.69',               label: 'HTG-1.69' },
  { item_spec: '틈새복합시트',             label: '틈새\n복합시트' },
  { item_spec: 'FL-Z',                   label: 'FL-Z' },
  { item_spec: 'FL-I',                   label: 'FL-I' },
  { item_spec: 'Z형플래싱',               label: 'Z형\n플래싱' },
  { item_spec: 'I형플래싱',               label: 'I형\n플래싱' },
  { item_spec: 'I형플래싱(4T)',           label: 'I형플래싱\n(4T)' },
];

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface SRItem {
  sri_id: number;
  item_id: number;
  item_spec: string;
  item_category: string;
  item_name: string;
  planned_qty: number;
  lot_number: string | null;
  is_deferred: boolean;
  stock_status: 'AVAILABLE' | 'RESERVED' | 'DEFERRED';
}

interface ShipmentReadyRow {
  sr_id: number;
  delivery_date: string | null;
  distributor: string | null;
  contractor: string | null;
  main_contractor: string | null;
  site_name: string | null;
  status: 'PENDING' | 'SHIPPED';
  is_new: boolean;
  items: SRItem[];
}

interface SummaryItem {
  item_spec: string;
  item_name: string;
  total_planned: number;
  deferred_qty: number;
}

interface PurchaseOrder {
  po_id: number;
  project_name: string | null;
  order_date: string | null;
  delivery_date: string | null;
  construction_site: string | null;
  contractor: string | null;
  supervisor: string | null;
}

interface Project {
  project_id: number;
  project_name: string;
  customer_name: string | null;
  order_date: string | null;
  delivery_date: string | null;
}

interface ItemMaster {
  item_id: number;
  item_name: string;
  item_code: string;
  item_category: string;
  unit: string;
}

interface LotOption {
  lot_id: number;
  lot_number: string;
  available_qty: number;
  net_available: number;
  unit: string;
}

// ─── 상태 색상 ───────────────────────────────────────────────────────────────

const STOCK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: '재고확보', className: 'bg-green-100 text-green-700 border-green-200' },
  RESERVED:  { label: '예약중',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  DEFERRED:  { label: '차후재고', className: 'bg-red-100 text-red-700 border-red-200' },
};

// ─── 사이드 패널 (행 클릭 상세) ──────────────────────────────────────────────

function DetailPanel({
  row,
  onClose,
}: {
  row: ShipmentReadyRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-slide-in">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div>
            <p className="font-bold text-gray-900 text-sm">{row.site_name || '(현장명 없음)'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {row.distributor || '-'} / {row.contractor || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className="px-5 py-3 border-b grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">납품예정일</p>
            <p className="font-semibold text-gray-800">{row.delivery_date?.slice(0, 10) || '-'}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">상태</p>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                row.status === 'SHIPPED'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200',
              )}
            >
              {row.status === 'SHIPPED' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {row.status === 'SHIPPED' ? '출하완료' : '대기중'}
            </span>
          </div>
          {row.main_contractor && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-0.5">원청사</p>
              <p className="font-semibold text-gray-800">{row.main_contractor}</p>
            </div>
          )}
        </div>

        {/* 품목 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="text-xs font-bold text-gray-700 mb-2">
            품목 목록 ({row.items.length}개)
          </p>
          <div className="space-y-2">
            {row.items.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">품목 없음</p>
            ) : (
              row.items.map((item) => {
                const cfg = STOCK_STATUS_CONFIG[item.stock_status] ?? STOCK_STATUS_CONFIG.DEFERRED;
                return (
                  <div
                    key={item.sri_id}
                    className="bg-gray-50 border rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.item_name}</p>
                        <p className="text-[11px] text-gray-500">{item.item_spec}</p>
                      </div>
                      <span
                        className={cn(
                          'flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border',
                          cfg.className,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      <span>
                        계획: <strong>{item.planned_qty}</strong>
                      </span>
                      {item.lot_number && (
                        <span className="font-mono text-blue-600">{item.lot_number}</span>
                      )}
                      {item.is_deferred && (
                        <span className="text-red-500 font-semibold">차후</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 등록 모달 ───────────────────────────────────────────────────────────────

interface PoAggItem {
  po_item_id:        number | null;
  po_item_seq:       number | null;
  sheet_name:        string | null;
  seq_no:            number | null;
  item_type:         string;
  product_type:      string | null;
  item_id:           number | null;
  item_name:         string;
  item_code:         string | null;
  item_category:     string;
  item_spec:         string;
  pipe_width_mm:     number | null;
  pipe_height_mm:    number | null;
  opening_width_mm:  number | null;
  opening_height_mm: number | null;
  total_qty:         number;
  lot_id:            number | null;
  lot_number:        string | null;
  is_deferred:       boolean;
}

interface InspectedLot {
  lot_id: number;
  lot_number: string;
  lot_type: string;
  item_id: number;
  item_name: string;
  item_code: string;
  item_category: string;
  unit: string;
  total_qty: string;
  remaining_qty: string;
  net_available: string;
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [showPOList, setShowPOList] = useState(false);
  const [showProjList, setShowProjList] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [selectedProj, setSelectedProj] = useState<Project | null>(null);
  const [siteName, setSiteName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [distributor, setDistributor] = useState('');
  const [contractor, setContractor] = useState('');
  const [mainContractor, setMainContractor] = useState('');
  const [items, setItems] = useState<PoAggItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [lotPopover, setLotPopover] = useState<number | null>(null);
  const [lotSearch, setLotSearch] = useState('');
  const [lotList, setLotList] = useState<InspectedLot[]>([]);
  const [loadingLot, setLoadingLot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingPOs(true);
    Promise.all([
      api.get<{ data: PurchaseOrder[] }>('/purchase-orders'),
      api.get<{ data: Project[] }>('/projects'),
    ]).then(([pr, pj]) => {
      setPurchaseOrders(pr.data ?? []);
      setProjects(pj.data ?? []);
    }).catch(() => toast.error('목록 로드 실패')).finally(() => setLoadingPOs(false));
  }, []);

  const handleSelectPO = async (po: PurchaseOrder) => {
    setSelectedPo(po);
    setSelectedProj(null);
    setShowPOList(false);
    setSiteName(po.construction_site ?? po.project_name ?? '');
    setContractor(po.contractor ?? '');
    if (po.delivery_date) setDeliveryDate(po.delivery_date.slice(0, 10));
    setLoadingItems(true);
    try {
      const res = await api.get<{ items: PoAggItem[] }>(`/shipment-ready/po/${po.po_id}/items`);
      setItems(res.items ?? []);
      if ((res.items ?? []).length === 0) toast.info('발주서에 등록된 품목이 없습니다');
      else toast.success(`구조체 ${res.items.length}개 자동 불러오기 완료`);
    } catch {
      toast.error('품목 로드 실패');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectProject = (proj: Project) => {
    setSelectedProj(proj);
    setSelectedPo(null);
    setShowProjList(false);
    setSiteName(proj.project_name ?? '');
    setContractor(proj.customer_name ?? '');
    if (proj.delivery_date) setDeliveryDate(proj.delivery_date.slice(0, 10));
  };

  const searchLots = useCallback(async (q: string, idx: number | null) => {
    setLoadingLot(true);
    try {
      const currentItem = idx !== null ? items[idx] : null;
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (currentItem?.item_id) params.append('item_id', String(currentItem.item_id));
      const res = await api.get<{ lots: InspectedLot[] }>(`/lots/inspected?${params}`);
      setLotList(res.lots ?? []);
    } catch {
      toast.error('LOT 조회 실패');
    } finally {
      setLoadingLot(false);
    }
  }, [items]);

  useEffect(() => {
    if (lotPopover === null) return;
    const t = setTimeout(() => { void searchLots(lotSearch, lotPopover); }, 300);
    return () => clearTimeout(t);
  }, [lotSearch, lotPopover, searchLots]);

  const openLotPopover = async (idx: number) => {
    setLotPopover(idx);
    setLotSearch('');
    await searchLots('', idx);
  };

  const assignLot = (lot: InspectedLot) => {
    if (lotPopover === null) return;
    setItems(prev => {
      const next = [...prev];
      next[lotPopover] = { ...next[lotPopover], lot_id: lot.lot_id, lot_number: lot.lot_number, is_deferred: false };
      return next;
    });
    setLotPopover(null);
    toast.success(`LOT ${lot.lot_number} 매핑 완료`);
  };

  const clearLot = (idx: number) => {
    setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], lot_id: null, lot_number: null, is_deferred: true }; return n; });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const addBlankItem = () => {
    setItems(prev => [...prev, {
      po_item_id: null, po_item_seq: null, sheet_name: null, seq_no: null,
      item_type: 'socket', product_type: null, item_id: null, item_name: '', item_code: null,
      item_category: 'SOCKET', item_spec: '',
      pipe_width_mm: null, pipe_height_mm: null, opening_width_mm: null, opening_height_mm: null,
      total_qty: 1, lot_id: null, lot_number: null, is_deferred: true,
    }]);
  };

  const handleSubmit = async () => {
    if (!siteName.trim()) { toast.error('현장명을 입력하세요'); return; }
    const validItems = items.filter(it => it.item_id && it.total_qty > 0);
    if (validItems.length === 0) { toast.error('품목이 없습니다'); return; }
    setSubmitting(true);
    try {
      await api.post('/shipment-ready', {
        delivery_date: deliveryDate || null,
        distributor: distributor || null,
        contractor: contractor || null,
        main_contractor: mainContractor || null,
        site_name: siteName,
        po_id: selectedPo?.po_id || null,
        project_id: selectedProj?.project_id || null,
        items: validItems.map(it => ({
          item_id: it.item_id,
          item_spec: it.item_spec || it.product_type || '',
          item_category: it.item_category || 'SOCKET',
          planned_qty: it.total_qty,
          lot_id: it.lot_id || null,
          lot_number: it.lot_number || null,
          is_deferred: it.is_deferred,
          po_item_id: it.po_item_id || null,
          po_item_seq: it.po_item_seq || null,
        })),
      });
      toast.success('출하예정 등록 완료');
      onCreated();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const lotMapped = items.filter(it => it.lot_id).length;
  const lotPending = items.filter(it => !it.lot_id && it.total_qty > 0).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">출하예정 등록</h2>
              <p className="text-xs text-gray-400 mt-0.5">발주서 선택 → 구조체별 1개 단위 자동 분리 → LOT 매핑</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">① 발주서 또는 프로젝트 선택</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <button onClick={() => { setShowPOList(v => !v); setShowProjList(false); }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-colors',
                      selectedPo ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white hover:bg-gray-50 text-gray-700')}>
                    <span className="font-semibold truncate">
                      {selectedPo ? (selectedPo.project_name ?? selectedPo.construction_site ?? `발주서#${selectedPo.po_id}`) : '📋 발주서에서 불러오기'}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
                  </button>
                  {showPOList && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {loadingPOs ? <div className="py-6 text-center text-gray-400 text-sm">로드 중...</div>
                        : purchaseOrders.length === 0 ? <div className="py-6 text-center text-gray-400 text-sm">발주서 없음</div>
                        : purchaseOrders.map(po => (
                          <button key={po.po_id} onClick={() => handleSelectPO(po)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{po.project_name ?? po.construction_site ?? `발주서 #${po.po_id}`}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{po.contractor && `${po.contractor} · `}납기: {po.delivery_date?.slice(0, 10) || '-'}</p>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div className="relative flex-1">
                  <button onClick={() => { setShowProjList(v => !v); setShowPOList(false); }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm transition-colors',
                      selectedProj ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white hover:bg-gray-50 text-gray-700')}>
                    <span className="font-semibold truncate">{selectedProj ? selectedProj.project_name : '📁 프로젝트에서 불러오기'}</span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
                  </button>
                  {showProjList && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {projects.length === 0 ? <div className="py-6 text-center text-gray-400 text-sm">프로젝트 없음</div>
                        : projects.map(proj => (
                          <button key={proj.project_id} onClick={() => handleSelectProject(proj)}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b last:border-0">
                            <p className="text-sm font-semibold text-gray-900">{proj.project_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{proj.customer_name && `${proj.customer_name} · `}납기: {proj.delivery_date?.slice(0, 10) || '-'}</p>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">② 기본 정보</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">납품예정일</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">현장명 <span className="text-red-500">*</span></label>
                  <input type="text" value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="현장명"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">대리점</label>
                  <input type="text" value={distributor} onChange={e => setDistributor(e.target.value)} placeholder="대리점명"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">시공사</label>
                  <input type="text" value={contractor} onChange={e => setContractor(e.target.value)} placeholder="시공사"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">원청사</label>
                  <input type="text" value={mainContractor} onChange={e => setMainContractor(e.target.value)} placeholder="원청사"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">③ 구조체별 품목 + 완제품 LOT 매핑</p>
                  {items.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      총 <span className="font-bold text-gray-700">{items.length}개</span> 구조체 ·
                      <span className="text-green-600 font-semibold"> LOT매핑 {lotMapped}개</span>
                      {lotPending > 0 && <span className="text-red-500 font-semibold"> · 미매핑 {lotPending}개</span>}
                    </p>
                  )}
                </div>
                <button onClick={addBlankItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg">
                  <Plus className="h-3 w-3" /> 직접추가
                </button>
              </div>
              {loadingItems ? (
                <div className="py-10 text-center text-gray-400 flex items-center justify-center gap-2">
                  <div className="h-5 w-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  발주서 구조체 불러오는 중...
                </div>
              ) : items.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-sm">
                  발주서를 선택하면 구조체별(1개 단위) 품목이 채워집니다
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">
                    <div className="col-span-1">No.</div>
                    <div className="col-span-3">품목</div>
                    <div className="col-span-3">관통재 치수</div>
                    <div className="col-span-4">완제품 LOT 매핑</div>
                    <div className="col-span-1"></div>
                  </div>
                  {(() => {
                    const rendered: React.ReactNode[] = [];
                    let lastSheet: string | null = undefined as unknown as string | null;
                    items.forEach((item, idx) => {
                      if (item.sheet_name !== null && item.sheet_name !== lastSheet) {
                        lastSheet = item.sheet_name;
                        rendered.push(
                          <div key={`s-${idx}`} className="flex items-center gap-2 mt-2 mb-1 px-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              📋 {item.sheet_name} 차수
                            </span>
                            <div className="flex-1 h-px bg-indigo-100" />
                          </div>
                        );
                      }
                      rendered.push(
                        <div key={`i-${idx}`}
                          className={cn(
                            'grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-xl border',
                            item.lot_id ? 'bg-green-50 border-green-200'
                              : item.item_category === 'SOCKET' ? 'bg-orange-50/40 border-orange-100'
                              : 'bg-gray-50 border-gray-200'
                          )}>
                          <div className="col-span-1 text-[10px] text-gray-400 font-mono text-center">
                            {item.sheet_name ? `${item.seq_no}-${item.po_item_seq}` : `#${idx + 1}`}
                          </div>
                          <div className="col-span-3 min-w-0">
                            <p className="font-bold text-gray-900 text-xs">{item.product_type || item.item_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{item.item_code || item.item_category}</p>
                          </div>
                          <div className="col-span-3">
                            {item.pipe_width_mm ? (
                              <div className="text-[10px] font-mono font-semibold text-blue-700">
                                {item.pipe_width_mm}×{item.pipe_height_mm}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-mono">{item.item_spec}</span>
                            )}
                          </div>
                          <div className="col-span-4 relative">
                            {item.lot_id ? (
                              <div className="flex items-center gap-1">
                                <span className="flex-1 font-mono text-[10px] text-green-700 bg-green-100 border border-green-200 rounded-lg px-2 py-1 truncate">✓ {item.lot_number}</span>
                                <button onClick={() => openLotPopover(idx)} className="px-1.5 py-1 text-[10px] text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg">변경</button>
                                <button onClick={() => clearLot(idx)} className="p-1 text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                              </div>
                            ) : (
                              <button onClick={() => openLotPopover(idx)}
                                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg text-[10px] text-gray-400 hover:text-blue-600 transition-colors">
                                <AlertTriangle className="h-2.5 w-2.5 text-orange-400" />
                                {item.item_category === 'SOCKET' ? '완제품 LOT' : 'LOT 매핑'}
                              </button>
                            )}
                            {lotPopover === idx && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white border border-blue-200 rounded-xl shadow-2xl">
                                <div className="p-2 border-b bg-blue-50 rounded-t-xl">
                                  <p className="text-[10px] font-bold text-blue-700 mb-1.5">
                                    {item.product_type || item.item_name} LOT 선택
                                    {item.pipe_width_mm && <span className="font-normal text-gray-500 ml-1">({item.pipe_width_mm}×{item.pipe_height_mm})</span>}
                                  </p>
                                  <input autoFocus type="text" value={lotSearch} onChange={e => setLotSearch(e.target.value)}
                                    placeholder="LOT번호 검색..."
                                    className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                                <div className="max-h-44 overflow-y-auto">
                                  {loadingLot ? <div className="py-4 text-center text-xs text-gray-400">검색 중...</div>
                                    : lotList.length === 0 ? <div className="py-4 text-center text-xs text-gray-400">검색 결과 없음</div>
                                    : lotList.map(lot => (
                                      <button key={lot.lot_id} onClick={() => assignLot(lot)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-mono font-semibold text-gray-900">{lot.lot_number}</p>
                                          <p className="text-[10px] text-gray-500 truncate">{lot.item_name}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-xs font-bold text-green-700">{parseFloat(lot.net_available).toFixed(0)}</p>
                                          <p className="text-[10px] text-gray-400">{lot.unit} 가용</p>
                                        </div>
                                      </button>
                                    ))}
                                </div>
                                <div className="p-2 border-t">
                                  <button onClick={() => setLotPopover(null)} className="w-full py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button onClick={() => removeItem(idx)} className="p-1 text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      );
                    });
                    return rendered;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {items.length > 0 && (<>LOT 미매핑 {lotPending}개 → <span className="text-red-500 font-semibold">차후재고</span>로 등록됩니다</>)}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">취소</button>
            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
              {submitting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              출하예정 등록
            </button>
          </div>
        </div>
      </div>
      {lotPopover !== null && <div className="fixed inset-0 z-40" onClick={() => setLotPopover(null)} />}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export function ShipmentReadyPage() {
  const [rows, setRows] = useState<ShipmentReadyRow[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ShipmentReadyRow | null>(null);

  // 필터
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'SHIPPED'>('');

  // 요약 토글
  const [showSummary, setShowSummary] = useState(true);

  // 동적 열: summary에 있는 item_spec만 표시
  const activeSpecs = new Set(summary.map((s) => s.item_spec));
  const visibleCols = COLUMN_SPECS.filter((col) => activeSpecs.has(col.item_spec));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('from', fromDate);
      params.append('to', toDate);
      if (statusFilter !== '') params.append('status', statusFilter);

      const res = await api.get<{ rows: ShipmentReadyRow[]; summary: SummaryItem[] }>(
        `/shipment-ready?${params.toString()}`,
      );
      setRows(res.rows ?? []);
      setSummary(res.summary ?? []);
    } catch {
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 요약 카드 계산
  const totalSites = rows.length;
  const availableSites = rows.filter((r) =>
    r.items.every((it) => it.stock_status === 'AVAILABLE'),
  ).length;
  const deferredIncludedSites = rows.filter((r) =>
    r.items.some((it) => it.is_deferred),
  ).length;

  // 특정 row에서 item_spec에 해당하는 품목 찾기
  const getItemBySpec = (row: ShipmentReadyRow, spec: string): SRItem | undefined => {
    return row.items.find((it) => it.item_spec === spec);
  };

  // 합계 행
  const getTotalForSpec = (spec: string) => {
    const s = summary.find((sm) => sm.item_spec === spec);
    return s ? { total: s.total_planned, deferred: s.deferred_qty } : null;
  };

  // 셀 색상
  const getCellClass = (item: SRItem | undefined) => {
    if (!item) return '';
    if (item.is_deferred) return 'bg-red-50 text-red-700';
    if (item.stock_status === 'AVAILABLE') return 'bg-green-50 text-green-700';
    if (item.stock_status === 'RESERVED') return 'bg-yellow-50 text-yellow-700';
    return 'bg-red-50 text-red-600';
  };

  const statusTabs: Array<{ key: '' | 'PENDING' | 'SHIPPED'; label: string }> = [
    { key: '', label: '전체' },
    { key: 'PENDING', label: '대기중' },
    { key: 'SHIPPED', label: '출하완료' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="출하예정 현황"
        count={rows.length}
        description="납품 예정 현장별 재고 확보 현황 — 품목별 교차 테이블"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border rounded-xl hover:bg-white disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-gray-600', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> 출하예정 등록
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto px-4 pb-4 space-y-3">
        {/* 요약 카드 3개 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: '전체 현장수',
              value: totalSites,
              icon: <Package className="h-4 w-4 text-blue-500" />,
              color: 'text-blue-700',
              bg: 'bg-blue-50',
              border: 'border-blue-200',
            },
            {
              label: '재고확보 현장',
              value: availableSites,
              icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
              color: 'text-green-700',
              bg: 'bg-green-50',
              border: 'border-green-200',
            },
            {
              label: '차후재고 포함',
              value: deferredIncludedSites,
              icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
              color: 'text-red-600',
              bg: 'bg-red-50',
              border: 'border-red-200',
            },
          ].map(({ label, value, icon, color, bg, border }) => (
            <div
              key={label}
              className={cn('rounded-xl border p-3 flex items-center gap-3', bg, border)}
            >
              <div className="p-1.5 bg-white rounded-lg shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 색상 범례 + 요약 토글 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-200 inline-block" />
              재고확보
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-200 inline-block" />
              예약중
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
              차후재고
            </span>
          </div>
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showSummary ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            합계 행 {showSummary ? '숨기기' : '보기'}
          </button>
        </div>

        {/* 필터 바 */}
        <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 상태 탭 */}
            <div className="flex gap-1">
              {statusTabs.map(({ key, label }) => (
                <button
                  key={key === '' ? 'ALL' : key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    statusFilter === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-gray-200" />
            {/* 기간 */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="text-gray-400 text-xs">~</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>

        {/* 교차 테이블 */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[60px]">
                    납품일
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap sticky left-[60px] bg-gray-50 z-10 min-w-[100px]">
                    대리점
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[100px]">
                    시공사
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[140px]">
                    현장명
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[70px]">
                    상태
                  </th>
                  {visibleCols.map((col) => (
                    <th
                      key={col.item_spec}
                      className="px-2 py-2 text-center font-semibold text-gray-600 min-w-[64px] leading-tight"
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5 + visibleCols.length}
                      className="px-4 py-16 text-center text-gray-400"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-5 w-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                        로드 중...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + visibleCols.length}
                      className="px-4 py-20 text-center text-gray-400"
                    >
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-semibold">출하예정 데이터가 없습니다</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.sr_id}
                      onClick={() => setSelectedRow(row)}
                      className={cn(
                        'transition-colors hover:bg-blue-50/40 cursor-pointer',
                        row.is_new && 'bg-blue-50/30',
                        row.status === 'SHIPPED' && 'opacity-60',
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700 sticky left-0 bg-inherit z-10">
                        {row.delivery_date?.slice(0, 10) || '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[100px] truncate sticky left-[60px] bg-inherit z-10 text-gray-700">
                        {row.distributor || '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[100px] truncate text-gray-700">
                        {row.contractor || '-'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900 max-w-[140px] truncate">
                        {row.site_name || '-'}
                        {row.is_new && (
                          <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 font-bold">
                            NEW
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border',
                            row.status === 'SHIPPED'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200',
                          )}
                        >
                          {row.status === 'SHIPPED' ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <Clock className="h-2.5 w-2.5" />
                          )}
                          {row.status === 'SHIPPED' ? '완료' : '대기'}
                        </span>
                      </td>
                      {visibleCols.map((col) => {
                        const item = getItemBySpec(row, col.item_spec);
                        return (
                          <td
                            key={col.item_spec}
                            className={cn(
                              'px-2 py-2 text-center font-mono font-semibold',
                              getCellClass(item),
                            )}
                          >
                            {item ? item.planned_qty : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}

                {/* 합계 행 */}
                {showSummary && !loading && rows.length > 0 && (
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                    <td
                      colSpan={5}
                      className="px-3 py-2 text-xs font-bold text-gray-700 sticky left-0 bg-gray-100 z-10"
                    >
                      합계 ({rows.length}개 현장)
                    </td>
                    {visibleCols.map((col) => {
                      const totals = getTotalForSpec(col.item_spec);
                      return (
                        <td key={col.item_spec} className="px-2 py-2 text-center">
                          {totals ? (
                            <div>
                              <p className="text-gray-900 font-bold">{totals.total}</p>
                              {totals.deferred > 0 && (
                                <p className="text-red-500 text-[10px]">차후 {totals.deferred}</p>
                              )}
                            </div>
                          ) : (
                            ''
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 상세 사이드 패널 */}
      {selectedRow && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setSelectedRow(null)}
          />
          <DetailPanel row={selectedRow} onClose={() => setSelectedRow(null)} />
        </>
      )}

      {/* 등록 모달 */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchData();
          }}
        />
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.22s ease-out; }
      `}</style>
    </div>
  );
}
