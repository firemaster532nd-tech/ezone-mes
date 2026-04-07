import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

/* ─── 타입 ─── */
interface Structure {
  cert_id: number; structure_code: string; structure_name: string;
  product_group: string; install_position: string; socket_name: string;
  opening_w_mm: number; opening_h_mm: number;
  penetration_w_mm: number; penetration_h_mm: number;
  install_qty: number; bom_count: number;
}
interface OrderItem {
  cert_id: number; structure_code: string; structure_name: string;
  qty: number; opening_w_mm: number; opening_h_mm: number;
  penetration_w_mm: number; penetration_h_mm: number;
  install_qty: number; spec_note: string;
}
interface Order {
  order_id: number; order_number: string; order_date: string;
  customer_name: string; project_name: string; delivery_date: string;
  status: string; total_sets: number; items?: any[]; bom_results?: BomResult[];
}
interface BomResult {
  result_id: number; item_id: number; item_code: string; item_name: string;
  item_category: string; required_qty: number; unit: string;
  current_stock: number; shortage_qty: number; component_name: string;
  spec_detail: string; calc_note: string;
  roll_length_m: number | null; roll_spec: string | null;
}
interface DimSummary {
  structure_code: string; qty: number; penetration: string;
  perimeter: number; install_qty: number;
}

/* ─── 구조별 BOM 트리 타입 ─── */
interface BomTreeComponent {
  pbom_id: number; sbom_id: number; item_id: number;
  component_name: string; component_type: string; source_type: string;
  qty_formula: string | null; qty_fixed: string | null;
  length_formula: string | null; unit: string; sort_order: number;
  spec_detail: string | null;
  item_code: string; item_name: string; item_category: string; item_unit: string;
}
interface BomTreeGroup {
  sbom_id: number; cert_id: number; group_code: string; group_name: string;
  group_type: string; source_type: string; output_item_id: number | null;
  qty_formula: string | null; qty_fixed: string | null;
  is_dimension_based: boolean; sort_order: number;
  output_item_code: string | null; output_item_name: string | null;
  components: BomTreeComponent[];
}
interface BomTreeData {
  structure: any;
  groups: BomTreeGroup[];
  summary: { total_groups: number; purchase_groups: number; manufacture_groups: number };
}

const GROUP_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  SOCKET: { label: '방화소켓', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: '🔧' },
  FLASHING: { label: '방화플래싱', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '📐' },
  GAP_SHEET: { label: '틈새복합시트', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: '📋' },
  SUPPORT: { label: '지지구조 단열재', color: 'bg-green-100 text-green-700 border-green-200', icon: '🧱' },
  SEALANT: { label: '실란트', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: '💧' },
  FIXING: { label: '고정자재', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '🔩' },
  OTHER: { label: '기타', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: '📦' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  REGISTERED: { label: '등록', color: 'bg-gray-100 text-gray-700' },
  BOM_EXPLODED: { label: 'BOM전개', color: 'bg-blue-100 text-blue-700' },
  PO_CREATED: { label: '발주생성', color: 'bg-purple-100 text-purple-700' },
  IN_PRODUCTION: { label: '생산중', color: 'bg-yellow-100 text-yellow-700' },
  SHIPPED: { label: '출하완료', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소', color: 'bg-red-100 text-red-700' },
};
const CAT_LABELS: Record<string, string> = { RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품' };
const CAT_COLORS: Record<string, string> = {
  RM: 'bg-green-100 text-green-700', SM: 'bg-blue-100 text-blue-700',
  SA: 'bg-yellow-100 text-yellow-700', FP: 'bg-purple-100 text-purple-700',
};

export default function OrderBomPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [bomResults, setBomResults] = useState<BomResult[]>([]);
  const [dimSummary, setDimSummary] = useState<DimSummary[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [expandedCalc, setExpandedCalc] = useState<number | null>(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingWO, setGeneratingWO] = useState(false);
  const [creatingPR, setCreatingPR] = useState(false);
  const [editingOrder, setEditingOrder] = useState<{ customer_name: string; delivery_date: string } | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemData, setEditItemData] = useState<{
    qty: number; penetration_w_mm: number; penetration_h_mm: number;
    cert_id: number; structure_code: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [bomViewTab, setBomViewTab] = useState<'material' | 'tree'>('material');
  const [bomTreeData, setBomTreeData] = useState<Map<number, BomTreeData>>(new Map());
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0, 10),
    customer_name: '', project_name: '', delivery_date: '', remarks: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await api.get<{ data: Order[] }>('/orders');
      setOrders(r.data || []);
    } catch {}
  }, []);

  const fetchStructures = useCallback(async () => {
    try {
      const r = await api.get<{ data: Structure[] }>('/certifications');
      setStructures(r.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchOrders(); fetchStructures(); }, [fetchOrders, fetchStructures]);

  const selectOrder = async (order: Order) => {
    setShowNewForm(false); setShowExcelUpload(false); setExcelPreview(null);
    setEditingOrder(null); setAddingItem(false); setEditingItemId(null); setEditItemData(null);
    setBomViewTab('material');
    try {
      const r = await api.get<{ data: Order }>(`/orders/${order.order_id}`);
      setSelectedOrder(r.data);
      setBomResults(r.data.bom_results || []);
      // BOM 결과가 있으면 트리 데이터도 로드
      if (r.data.bom_results && r.data.bom_results.length > 0 && r.data.items) {
        loadBomTree(r.data.items);
      }
    } catch { setSelectedOrder(order); setBomResults([]); }
  };

  /* ─── 구조별 BOM 트리 로드 ─── */
  const loadBomTree = async (items: any[]) => {
    if (!items || items.length === 0) return;
    setTreeLoading(true);
    try {
      const treeMap = new Map<number, BomTreeData>();
      for (const item of items) {
        const certId = item.cert_id;
        if (treeMap.has(certId)) continue;
        try {
          const r = await api.get<{ data: BomTreeData }>(`/structure-bom/${certId}`);
          treeMap.set(certId, r.data);
        } catch { /* skip */ }
      }
      setBomTreeData(treeMap);
      // 기본적으로 모든 그룹 펼침
      const allKeys = new Set<string>();
      treeMap.forEach((tree, certId) => {
        tree.groups.forEach(g => allKeys.add(`${certId}-${g.sbom_id}`));
      });
      setExpandedGroups(allKeys);
    } catch { /* ignore */ }
    finally { setTreeLoading(false); }
  };

  /* ─── BOM 전개 ─── */
  const explodeBom = async () => {
    if (!selectedOrder) return;
    setExploding(true);
    try {
      const r = await api.post<{ data: any }>(`/orders/${selectedOrder.order_id}/explode-bom`, {});
      setBomResults(r.data.materials || []);
      setDimSummary(r.data.dimensions || []);
      await fetchOrders();
      // refresh selectedOrder
      const r2 = await api.get<{ data: Order }>(`/orders/${selectedOrder.order_id}`);
      setSelectedOrder(r2.data);
      // 트리 데이터도 로드
      if (r2.data.items) await loadBomTree(r2.data.items);
    } catch (e: any) { alert('BOM 전개 실패: ' + (e.message || '')); }
    finally { setExploding(false); }
  };

  /* ─── 자재발주서 생성 (중복 방지) ─── */
  const createPR = async () => {
    if (!selectedOrder || creatingPR) return;
    // 프론트엔드 1차 방어: 이미 발주 생성된 주문
    if (['PO_CREATED', 'IN_PRODUCTION', 'SHIPPED'].includes(selectedOrder.status)) {
      alert('이미 자재발주서가 생성된 주문입니다.');
      return;
    }
    if (!confirm('자재발주서를 생성하시겠습니까?')) return;
    setCreatingPR(true);
    try {
      const r = await api.post<{ data?: any; error?: string }>(`/orders/${selectedOrder.order_id}/create-pr`, {});
      if (r.error) { alert(r.error); return; }
      alert(`자재발주서 ${r.data.pr_number} 생성 완료 (${r.data.items?.length || 0}건)`);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) { alert('발주서 생성 실패: ' + (e.message || '')); }
    finally { setCreatingPR(false); }
  };

  /* ─── 공정작업지시 생성 (중복 방지) ─── */
  const generateWorkOrders = async () => {
    if (!selectedOrder || generatingWO) return;
    if (['IN_PRODUCTION', 'SHIPPED'].includes(selectedOrder.status)) {
      alert('이미 공정작업지시가 생성된 주문입니다.');
      return;
    }
    if (!confirm('공정작업지시를 생성하시겠습니까?')) return;
    setGeneratingWO(true);
    try {
      const r = await api.post<{ data?: any; error?: string; message?: string }>(
        `/orders/${selectedOrder.order_id}/generate-work-orders`, {}
      );
      if (r.error || r.message) {
        alert(r.message || r.error || '생성 실패');
        return;
      }
      alert(`공정작업지시 ${r.data?.work_orders?.length || 0}건 생성 완료`);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) {
      const msg = e?.body?.message || e?.message || '작업지시 생성 실패';
      alert(msg);
    }
    finally { setGeneratingWO(false); }
  };

  /* ─── 엑셀 업로드 ─── */
  const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.upload<{ data: any }>('/orders/upload-excel', fd);
      setExcelPreview(r.data);
    } catch (e: any) { alert('엑셀 파싱 실패: ' + (e.message || '')); }
  };

  const confirmExcelUpload = async () => {
    if (!excelFile) { alert('파일이 없습니다. 다시 선택해주세요.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', excelFile);
      const r = await api.upload<{ data: any }>('/orders/upload-excel?confirm=true', fd);
      alert(`수주 ${r.data?.order_number || ''} 등록 완료!`);
      setShowExcelUpload(false); setExcelPreview(null); setExcelFile(null);
      await fetchOrders();
    } catch (e: any) { alert('등록 실패: ' + (e.message || '')); }
    finally { setUploading(false); }
  };

  /* ─── 수주 삭제 ─── */
  const deleteOrder = async (orderId: number) => {
    if (!confirm('이 수주를 삭제하시겠습니까? 관련 BOM 결과도 모두 삭제됩니다.')) return;
    try {
      await api.delete(`/orders/${orderId}`);
      setSelectedOrder(null); setBomResults([]);
      await fetchOrders();
    } catch (e: any) { alert('삭제 실패: ' + (e.message || '')); }
  };

  /* ─── 수주 수정 ─── */
  const saveOrderEdit = async () => {
    if (!selectedOrder || !editingOrder) return;
    try {
      await api.patch(`/orders/${selectedOrder.order_id}`, editingOrder);
      setEditingOrder(null);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) { alert('수정 실패: ' + (e.message || '')); }
  };

  /* ─── 수주 품목 추가 ─── */
  const addItemToOrder = async (item: { cert_id: number; structure_code: string; qty: number; penetration_w_mm?: number; penetration_h_mm?: number }) => {
    if (!selectedOrder) return;
    try {
      await api.post(`/orders/${selectedOrder.order_id}/items`, item);
      setAddingItem(false);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) { alert('품목 추가 실패: ' + (e.message || '')); }
  };

  /* ─── 수주 품목 삭제 ─── */
  const deleteOrderItem = async (itemId: number) => {
    if (!selectedOrder) return;
    if (!confirm('이 품목을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/orders/${selectedOrder.order_id}/items/${itemId}`);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) { alert('품목 삭제 실패: ' + (e.message || '')); }
  };

  /* ─── 인라인 품목 수정 ─── */
  const startEditItem = (item: any) => {
    const stRef = structures.find(s => s.cert_id === item.cert_id);
    setEditingItemId(item.order_item_id);
    setEditItemData({
      qty: item.qty,
      penetration_w_mm: item.penetration_w_mm || item.default_pw || stRef?.penetration_w_mm || 0,
      penetration_h_mm: item.penetration_h_mm || item.default_ph || stRef?.penetration_h_mm || 0,
      cert_id: item.cert_id,
      structure_code: item.structure_code,
    });
  };
  const saveEditItem = async () => {
    if (!selectedOrder || !editingItemId || !editItemData) return;
    try {
      await api.patch(`/orders/${selectedOrder.order_id}/items/${editingItemId}`, {
        qty: editItemData.qty,
        penetration_w_mm: editItemData.penetration_w_mm,
        penetration_h_mm: editItemData.penetration_h_mm,
      });
      setEditingItemId(null); setEditItemData(null);
      await fetchOrders(); selectOrder(selectedOrder);
    } catch (e: any) { alert('수정 실패: ' + (e.message || '')); }
  };
  const cancelEditItem = () => { setEditingItemId(null); setEditItemData(null); };

  /* ─── 신규 수주 등록 ─── */
  const createOrder = async () => {
    if (!form.customer_name) { alert('고객사를 입력하세요'); return; }
    if (orderItems.length === 0) { alert('품목을 1건 이상 추가하세요'); return; }
    try {
      const r = await api.post<{ data: Order }>('/orders', {
        ...form,
        items: orderItems.map(it => ({
          cert_id: it.cert_id, structure_code: it.structure_code, qty: it.qty,
          penetration_w_mm: it.penetration_w_mm || null, penetration_h_mm: it.penetration_h_mm || null,
          opening_w_mm: it.opening_w_mm || null, opening_h_mm: it.opening_h_mm || null,
        })),
      });
      setShowNewForm(false);
      setForm({ order_date: new Date().toISOString().slice(0, 10), customer_name: '', project_name: '', delivery_date: '', remarks: '' });
      setOrderItems([]);
      await fetchOrders();
      if (r.data) selectOrder(r.data);
    } catch (e: any) { alert('등록 실패: ' + (e.message || '')); }
  };

  const addOrderItem = () => {
    if (structures.length === 0) return;
    const st = structures[0];
    setOrderItems(prev => [...prev, {
      cert_id: st.cert_id, structure_code: st.structure_code, structure_name: st.structure_name || '',
      qty: 1, opening_w_mm: st.opening_w_mm || 0, opening_h_mm: st.opening_h_mm || 0,
      penetration_w_mm: st.penetration_w_mm || 0, penetration_h_mm: st.penetration_h_mm || 0,
      install_qty: st.install_qty || 1, spec_note: '',
    }]);
  };

  const updateOrderItem = (idx: number, field: string, value: any) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'cert_id') {
        const st = structures.find(s => s.cert_id === Number(value));
        if (!st) return item;
        return {
          ...item, cert_id: st.cert_id, structure_code: st.structure_code,
          structure_name: st.structure_name || '',
          opening_w_mm: st.opening_w_mm || 0, opening_h_mm: st.opening_h_mm || 0,
          penetration_w_mm: st.penetration_w_mm || 0, penetration_h_mm: st.penetration_h_mm || 0,
          install_qty: st.install_qty || 1,
        };
      }
      return { ...item, [field]: value };
    }));
  };

  const removeOrderItem = (idx: number) => setOrderItems(prev => prev.filter((_, i) => i !== idx));

  // ── BOM 결과 통계 ──
  const shortageCount = bomResults.filter(r => Number(r.shortage_qty) > 0).length;
  const rmResults = bomResults.filter(r => r.item_category === 'RM');
  const smResults = bomResults.filter(r => r.item_category === 'SM');
  const saResults = bomResults.filter(r => r.item_category === 'SA');
  const fpResults = bomResults.filter(r => r.item_category === 'FP');

  // 발주/작업지시 생성 여부 판단
  const isPOCreated = selectedOrder && ['PO_CREATED', 'IN_PRODUCTION', 'SHIPPED'].includes(selectedOrder.status);
  const isWOCreated = selectedOrder && ['IN_PRODUCTION', 'SHIPPED'].includes(selectedOrder.status);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수주 관리 / BOM 전개</h1>
          <p className="text-sm text-gray-500 mt-1">주문서 등록 → 구조명/규격 입력 → 둘레 기반 BOM 자동전개 → 자재발주서</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowExcelUpload(true); setShowNewForm(false); setSelectedOrder(null); setBomResults([]); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
            엑셀 업로드
          </button>
          <button onClick={() => { setShowNewForm(true); setShowExcelUpload(false); setSelectedOrder(null); setBomResults([]); setOrderItems([]); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            + 신규 수주
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 좌측: 수주 목록 */}
        <div className="col-span-4">
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
              <h2 className="font-semibold text-sm text-gray-700">수주 목록</h2>
            </div>
            <div className="max-h-[700px] overflow-y-auto divide-y">
              {orders.map(order => (
                <div key={order.order_id}
                  onClick={() => selectOrder(order)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${
                    selectedOrder?.order_id === order.order_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{order.order_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_LABELS[order.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_LABELS[order.status]?.label || order.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{order.customer_name || '-'}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{order.order_date?.slice(0, 10)}</span>
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400">{order.total_sets} 세트</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteOrder(order.order_id); }}
                        className="text-xs text-red-400 hover:text-red-600">삭제</button>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">수주가 없습니다</div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 상세/신규/엑셀 */}
        <div className="col-span-8 space-y-4">

          {/* ──── 엑셀 업로드 ──── */}
          {showExcelUpload && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">엑셀 업로드</h3>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                onChange={handleExcelSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700" />
              {excelPreview && (
                <div className="mt-4">
                  <p className="text-sm text-gray-700 mb-2">
                    미리보기: {excelPreview.customer_name} / {excelPreview.items?.length || 0}건
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">구조</th><th className="px-2 py-1">수량</th><th className="px-2 py-1">W</th><th className="px-2 py-1">H</th></tr></thead>
                      <tbody>
                        {excelPreview.items?.map((item: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{item.structure_code}</td>
                            <td className="px-2 py-1 text-center">{item.qty}</td>
                            <td className="px-2 py-1 text-center">{item.w_mm || item.W || '-'}</td>
                            <td className="px-2 py-1 text-center">{item.h_mm || item.H || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={confirmExcelUpload} disabled={uploading}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                    {uploading ? '등록 중...' : '확인 및 등록'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──── 신규 수주 폼 ──── */}
          {showNewForm && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">신규 수주 등록</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">수주일</label>
                  <input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">고객사 *</label>
                  <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="고객사명" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">프로젝트명</label>
                  <input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                    placeholder="프로젝트명" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">납기일</label>
                  <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              {/* 품목 목록 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">주문 구조 / 규격</span>
                  <button onClick={addOrderItem} className="text-xs text-blue-600 hover:text-blue-800">+ 품목 추가</button>
                </div>
                {orderItems.map((item, idx) => {
                  const perimeter = item.penetration_w_mm && item.penetration_h_mm
                    ? 2 * (item.penetration_w_mm + item.penetration_h_mm) : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-lg">
                      <select value={item.cert_id} onChange={e => updateOrderItem(idx, 'cert_id', e.target.value)}
                        className="flex-1 px-2 py-1.5 border rounded text-sm">
                        {structures.map(s => (
                          <option key={s.cert_id} value={s.cert_id}>{s.structure_code} ({s.socket_name})</option>
                        ))}
                      </select>
                      <input type="number" min={1} value={item.qty} onChange={e => updateOrderItem(idx, 'qty', parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1.5 border rounded text-sm text-center" placeholder="수량" />
                      <input type="number" value={item.penetration_w_mm || ''} onChange={e => updateOrderItem(idx, 'penetration_w_mm', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 border rounded text-sm text-center" placeholder="W(mm)" />
                      <span className="text-gray-400 text-xs">×</span>
                      <input type="number" value={item.penetration_h_mm || ''} onChange={e => updateOrderItem(idx, 'penetration_h_mm', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 border rounded text-sm text-center" placeholder="H(mm)" />
                      {perimeter > 0 && <span className="text-xs text-gray-400 whitespace-nowrap">둘레 {perimeter.toLocaleString()}mm</span>}
                      <button onClick={() => removeOrderItem(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">삭제</button>
                    </div>
                  );
                })}
              </div>
              <button onClick={createOrder} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                수주 등록
              </button>
            </div>
          )}

          {/* ──── 수주 상세 ──── */}
          {selectedOrder && (
            <>
              <div className="bg-white rounded-xl border shadow-sm p-5">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{selectedOrder.order_number}</h3>
                    <span className="text-sm text-gray-500">{selectedOrder.customer_name} - {selectedOrder.project_name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_LABELS[selectedOrder.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                    </span>
                    {!editingOrder ? (
                      <button onClick={() => setEditingOrder({
                        customer_name: selectedOrder.customer_name || '',
                        delivery_date: selectedOrder.delivery_date?.slice(0, 10) || '',
                      })} className="text-xs text-blue-600 hover:underline">수정</button>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={saveOrderEdit} className="text-xs text-green-600 hover:underline">저장</button>
                        <button onClick={() => setEditingOrder(null)} className="text-xs text-gray-400 hover:underline">취소</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 기본정보 */}
                <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                  <div><span className="text-gray-400">수주일:</span> {selectedOrder.order_date?.slice(0, 10)}</div>
                  <div>
                    <span className="text-gray-400">납기일:</span>{' '}
                    {editingOrder ? (
                      <input type="date" value={editingOrder.delivery_date}
                        onChange={e => setEditingOrder(prev => prev ? { ...prev, delivery_date: e.target.value } : null)}
                        className="px-2 py-0.5 border rounded text-sm" />
                    ) : (selectedOrder.delivery_date?.slice(0, 10) || '-')}
                  </div>
                  <div><span className="text-gray-400">총 세트:</span> {selectedOrder.total_sets}</div>
                  <div>
                    <span className="text-gray-400">고객사:</span>{' '}
                    {editingOrder ? (
                      <input value={editingOrder.customer_name}
                        onChange={e => setEditingOrder(prev => prev ? { ...prev, customer_name: e.target.value } : null)}
                        className="px-2 py-0.5 border rounded text-sm" />
                    ) : selectedOrder.customer_name}
                  </div>
                </div>

                {/* 주문 품목 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">주문 구조 / 규격</span>
                  <button onClick={() => setAddingItem(true)} className="text-xs text-blue-600 hover:text-blue-800">+ 품목 추가</button>
                </div>
                {selectedOrder.items?.map((item: any) => {
                  const stRef = structures.find(s => s.cert_id === item.cert_id);
                  const pw = item.penetration_w_mm || item.default_pw || stRef?.penetration_w_mm || 0;
                  const ph = item.penetration_h_mm || item.default_ph || stRef?.penetration_h_mm || 0;
                  const perimeter = pw && ph ? 2 * (pw + ph) : 0;
                  const isEditing = editingItemId === item.order_item_id;

                  if (isEditing && editItemData) {
                    const editPerimeter = editItemData.penetration_w_mm && editItemData.penetration_h_mm
                      ? 2 * (editItemData.penetration_w_mm + editItemData.penetration_h_mm) : 0;
                    return (
                      <div key={item.order_item_id} className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <select value={editItemData.cert_id}
                            onChange={e => {
                              const st = structures.find(s => s.cert_id === Number(e.target.value));
                              if (st) setEditItemData(prev => prev ? {
                                ...prev, cert_id: st.cert_id, structure_code: st.structure_code,
                                penetration_w_mm: st.penetration_w_mm || prev.penetration_w_mm,
                                penetration_h_mm: st.penetration_h_mm || prev.penetration_h_mm,
                              } : null);
                            }}
                            className="px-2 py-1.5 border rounded text-sm">
                            {structures.map(s => (
                              <option key={s.cert_id} value={s.cert_id}>{s.structure_code}</option>
                            ))}
                          </select>
                          <span className="text-xs text-gray-400">수량</span>
                          <input type="number" min={1} value={editItemData.qty}
                            onChange={e => setEditItemData(prev => prev ? { ...prev, qty: parseInt(e.target.value) || 1 } : null)}
                            className="w-16 px-2 py-1.5 border rounded text-sm text-center" />
                          <span className="text-xs text-gray-400">W</span>
                          <input type="number" value={editItemData.penetration_w_mm}
                            onChange={e => setEditItemData(prev => prev ? { ...prev, penetration_w_mm: parseInt(e.target.value) || 0 } : null)}
                            className="w-20 px-2 py-1.5 border rounded text-sm text-center" />
                          <span className="text-xs text-gray-400">× H</span>
                          <input type="number" value={editItemData.penetration_h_mm}
                            onChange={e => setEditItemData(prev => prev ? { ...prev, penetration_h_mm: parseInt(e.target.value) || 0 } : null)}
                            className="w-20 px-2 py-1.5 border rounded text-sm text-center" />
                          {editPerimeter > 0 && <span className="text-xs text-gray-500">둘레 {editPerimeter.toLocaleString()}mm</span>}
                          <button onClick={saveEditItem} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">저장</button>
                          <button onClick={cancelEditItem} className="px-2 py-1 bg-gray-200 rounded text-xs">취소</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.order_item_id}
                      onClick={() => startEditItem(item)}
                      className="mb-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-50 group">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-mono px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">{item.structure_code}</span>
                        <span className="text-sm">x{item.qty}</span>
                        <span className="text-xs text-gray-500">| 관통부 {pw}x{ph}mm</span>
                        {perimeter > 0 && <span className="text-xs text-gray-400">둘레 {perimeter.toLocaleString()}mm</span>}
                        <span className="text-xs text-gray-400">소켓 {item.install_qty || 1}개</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100">수정</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteOrderItem(item.order_item_id); }}
                          className="text-xs text-red-400 hover:text-red-600">삭제</button>
                      </div>
                    </div>
                  );
                })}

                {/* 품목 추가 폼 */}
                {addingItem && (
                  <AddItemForm structures={structures} onAdd={addItemToOrder} onCancel={() => setAddingItem(false)} />
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-3 mt-4">
                  <button onClick={explodeBom} disabled={exploding}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                    {exploding ? 'BOM 전개 중...' : (bomResults.length > 0 ? 'BOM 재전개 (치수 기반)' : 'BOM 자동전개')}
                  </button>
                  {bomResults.length > 0 && shortageCount > 0 && (
                    isPOCreated ? (
                      <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">
                        ✓ 발주서 생성완료
                      </span>
                    ) : (
                      <button onClick={createPR} disabled={creatingPR}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {creatingPR ? '생성 중...' : `자재발주서 생성 (${shortageCount}건 부족)`}
                      </button>
                    )
                  )}
                  {bomResults.length > 0 && (
                    isWOCreated ? (
                      <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">
                        ✓ 작업지시 생성완료
                      </span>
                    ) : (
                      <button onClick={generateWorkOrders} disabled={generatingWO}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50">
                        {generatingWO ? '생성 중...' : '공정작업지시 생성'}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* BOM 전개 결과 */}
              {bomResults.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm">
                  {/* 탭 헤더 */}
                  <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setBomViewTab('tree')}
                        className={`text-sm font-semibold pb-1 border-b-2 transition ${bomViewTab === 'tree' ? 'text-indigo-700 border-indigo-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                        구조별 BOM 트리
                      </button>
                      <button onClick={() => setBomViewTab('material')}
                        className={`text-sm font-semibold pb-1 border-b-2 transition ${bomViewTab === 'material' ? 'text-indigo-700 border-indigo-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                        자재 소요량 (발주용)
                      </button>
                    </div>
                    <span className="text-xs text-gray-400">총 {bomResults.length}건, 부족 {shortageCount}건</span>
                  </div>

                  {/* ── 탭1: 구조별 BOM 트리 ── */}
                  {bomViewTab === 'tree' && (
                    <div className="p-4">
                      {treeLoading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">BOM 트리 로딩 중...</div>
                      ) : bomTreeData.size === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">트리 데이터가 없습니다. BOM 전개를 먼저 실행하세요.</div>
                      ) : (
                        <div className="space-y-4">
                          {selectedOrder?.items?.map((item: any) => {
                            const tree = bomTreeData.get(item.cert_id);
                            if (!tree) return null;
                            const st = tree.structure;
                            const pw = item.penetration_w_mm || st.penetration_w_mm || 0;
                            const ph = item.penetration_h_mm || st.penetration_h_mm || 0;
                            const perimeter = pw && ph ? 2 * (pw + ph) : 0;
                            return (
                              <div key={item.order_item_id} className="border rounded-xl overflow-hidden">
                                {/* 구조 헤더 (Level 0) */}
                                <div className="bg-slate-700 text-white px-4 py-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono px-2 py-0.5 bg-white/20 rounded">{st.structure_code}</span>
                                    <span className="font-medium text-sm">{st.structure_name}</span>
                                    <span className="text-xs opacity-70">x{item.qty}세트</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs opacity-80">
                                    <span>{st.install_position}</span>
                                    <span>관통부 {pw}×{ph}mm</span>
                                    <span>둘레 {perimeter.toLocaleString()}mm</span>
                                    <span>소켓 {st.install_qty}개</span>
                                  </div>
                                </div>

                                {/* 그룹 목록 (Level 1) */}
                                <div className="divide-y">
                                  {tree.groups.map((group) => {
                                    const gKey = `${item.cert_id}-${group.sbom_id}`;
                                    const isExpanded = expandedGroups.has(gKey);
                                    const gStyle = GROUP_TYPE_LABELS[group.group_type] || GROUP_TYPE_LABELS.OTHER;
                                    const srcLabel = group.source_type === 'PURCHASE' ? '구매' : '자체제조';
                                    const srcColor = group.source_type === 'PURCHASE' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50';

                                    return (
                                      <div key={group.sbom_id}>
                                        {/* 그룹 행 */}
                                        <div
                                          onClick={() => {
                                            const next = new Set(expandedGroups);
                                            if (isExpanded) next.delete(gKey); else next.add(gKey);
                                            setExpandedGroups(next);
                                          }}
                                          className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-xs w-4">{isExpanded ? '▼' : '▶'}</span>
                                            <span className="text-sm">{gStyle.icon}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${gStyle.color}`}>{gStyle.label}</span>
                                            <span className="text-sm font-medium text-gray-800">{group.group_name}</span>
                                            {group.output_item_code && (
                                              <span className="text-xs font-mono text-gray-400">({group.output_item_code})</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${srcColor}`}>{srcLabel}</span>
                                            {group.qty_formula && <span className="text-[10px] text-gray-400">수량: {group.qty_formula}</span>}
                                            {group.qty_fixed && <span className="text-[10px] text-gray-400">고정: {group.qty_fixed}</span>}
                                            <span className="text-[10px] text-gray-300">{group.components.length}개 구성</span>
                                          </div>
                                        </div>

                                        {/* 구성자재 (Level 2) */}
                                        {isExpanded && group.components.length > 0 && (
                                          <div className="bg-gray-50/70 border-t">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-gray-400">
                                                  <th className="py-1.5 pl-12 text-left w-8"></th>
                                                  <th className="py-1.5 text-left">구성자재</th>
                                                  <th className="py-1.5 text-left">품목코드</th>
                                                  <th className="py-1.5 text-center">구분</th>
                                                  <th className="py-1.5 text-right">수량</th>
                                                  <th className="py-1.5 text-left">길이산식</th>
                                                  <th className="py-1.5 text-left">규격상세</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100">
                                                {group.components.map((comp, ci) => {
                                                  const isManuf = comp.source_type === 'MANUFACTURE';
                                                  return (
                                                    <tr key={comp.pbom_id} className="hover:bg-white/60">
                                                      <td className="py-1.5 pl-12 text-gray-300">{ci === group.components.length - 1 ? '└' : '├'}</td>
                                                      <td className="py-1.5">
                                                        <span className={`font-medium ${isManuf ? 'text-orange-700' : 'text-gray-700'}`}>
                                                          {comp.component_name}
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 font-mono text-gray-500">{comp.item_code}</td>
                                                      <td className="py-1.5 text-center">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isManuf ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                          {isManuf ? '제조' : '구매'}
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 text-right font-mono">
                                                        {comp.qty_fixed ? Number(comp.qty_fixed) : '-'}
                                                        <span className="text-gray-400 ml-0.5">{comp.unit}</span>
                                                      </td>
                                                      <td className="py-1.5 font-mono text-indigo-500 text-[10px]">
                                                        {comp.length_formula || comp.qty_formula || '-'}
                                                      </td>
                                                      <td className="py-1.5 text-gray-400 text-[10px] max-w-[200px] truncate" title={comp.spec_detail || ''}>
                                                        {comp.spec_detail || '-'}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* 제조 프로세스 안내 */}
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="text-xs font-medium text-amber-700 mb-1">제조 프로세스 안내</div>
                            <div className="text-[11px] text-amber-600 space-y-0.5">
                              <div><span className="bg-orange-50 text-orange-600 px-1 rounded">제조</span> 표시 항목은 자체 생산 대상입니다:</div>
                              <div className="pl-3">차열시트(소켓용/플래싱용) → <span className="font-medium">배합(MIX)</span> → <span className="font-medium">압출(EXT)</span> → <span className="font-medium">재단(CUT)</span> → <span className="font-medium">조립(ASM)</span></div>
                              <div className="pl-3"><span className="bg-blue-50 text-blue-600 px-1 rounded">구매</span> 표시 항목은 자재발주서를 통해 구매합니다.</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 탭2: 기존 자재 소요량 테이블 (발주용) ── */}
                  {bomViewTab === 'material' && (
                    <>
                      {/* 카테고리 요약 카드 */}
                      <div className="grid grid-cols-4 gap-3 p-4">
                        {[
                          { key: 'RM', items: rmResults },
                          { key: 'SM', items: smResults },
                          { key: 'SA', items: saResults },
                          { key: 'FP', items: fpResults },
                        ].map(({ key, items }) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className={`inline-block text-[10px] px-2 py-0.5 rounded mb-1 ${CAT_COLORS[key]}`}>
                              {CAT_LABELS[key]}
                            </div>
                            <div className="text-lg font-bold">{items.length}건</div>
                            <div className="text-xs text-gray-400">
                              소요 {items.length} / 부족 {items.filter(r => Number(r.shortage_qty) > 0).length}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 상세 테이블 */}
                      {[
                        { key: 'SM', label: '부자재', items: smResults },
                        { key: 'RM', label: '원재료', items: rmResults },
                        { key: 'SA', label: '반제품', items: saResults },
                        { key: 'FP', label: '완제품', items: fpResults },
                      ].filter(g => g.items.length > 0).map(({ key, label, items }) => (
                        <div key={key} className="px-4 pb-3">
                          <div className={`inline-block text-[10px] px-2 py-0.5 rounded mb-2 ${CAT_COLORS[key]}`}>
                            {label} ({items.length}건)
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b">
                                <th className="py-1.5 text-left">품목코드</th>
                                <th className="py-1.5 text-left">품목명</th>
                                <th className="py-1.5 text-right">소요량</th>
                                <th className="py-1.5 text-center">단위</th>
                                <th className="py-1.5 text-right">롤수</th>
                                <th className="py-1.5 text-right">현재고</th>
                                <th className="py-1.5 text-right">부족량</th>
                                <th className="py-1.5 text-left">산출근거</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {items.map(r => {
                                const rollLen = r.roll_length_m ? Number(r.roll_length_m) : null;
                                const rollCount = rollLen && rollLen > 0 && (r.unit === 'M' || r.unit === 'm')
                                  ? Math.ceil(Number(r.required_qty) / rollLen) : null;
                                return (
                                <tr key={r.result_id} className={`${Number(r.shortage_qty) > 0 ? 'bg-red-50' : ''}`}>
                                  <td className="py-1.5 font-mono">{r.item_code}</td>
                                  <td className="py-1.5">{r.item_name}</td>
                                  <td className="py-1.5 text-right font-mono">{Number(r.required_qty).toLocaleString()}</td>
                                  <td className="py-1.5 text-center">{r.unit}</td>
                                  <td className="py-1.5 text-right font-mono">
                                    {rollCount !== null ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="font-medium text-indigo-600">{rollCount}</span>
                                        <span className="text-[10px] text-gray-400" title={r.roll_spec || ''}>롤</span>
                                        <span className="text-[9px] text-gray-300">({rollLen}M/롤)</span>
                                      </span>
                                    ) : <span className="text-gray-300">-</span>}
                                  </td>
                                  <td className="py-1.5 text-right font-mono">{Number(r.current_stock).toLocaleString()}</td>
                                  <td className={`py-1.5 text-right font-mono font-medium ${Number(r.shortage_qty) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {Number(r.shortage_qty) > 0 ? `-${Number(r.shortage_qty).toLocaleString()}` : '충분'}
                                  </td>
                                  <td className="py-1.5">
                                    <button onClick={() => setExpandedCalc(expandedCalc === r.result_id ? null : r.result_id)}
                                      className="text-blue-500 hover:underline text-[10px]">
                                      {expandedCalc === r.result_id ? '접기' : '산출식'}
                                    </button>
                                    {expandedCalc === r.result_id && r.calc_note && (
                                      <div className="mt-1 p-2 bg-blue-50 rounded text-[10px] text-gray-600 whitespace-pre-wrap max-w-md">
                                        {r.calc_note}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* 기본 안내 */}
          {!selectedOrder && !showNewForm && !showExcelUpload && (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400">
              <p className="text-lg mb-2">수주를 선택하거나 신규 등록하세요</p>
              <p className="text-sm">좌측 목록에서 수주를 클릭하면 상세 정보와 BOM 전개 결과를 확인할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 품목 추가 서브 컴포넌트 ─── */
function AddItemForm({ structures, onAdd, onCancel }: {
  structures: Structure[];
  onAdd: (item: { cert_id: number; structure_code: string; qty: number; penetration_w_mm?: number; penetration_h_mm?: number }) => void;
  onCancel: () => void;
}) {
  const [certId, setCertId] = useState(structures[0]?.cert_id || 0);
  const [qty, setQty] = useState(1);
  const [pw, setPw] = useState(0);
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const st = structures.find(s => s.cert_id === certId);
    if (st) { setPw(st.penetration_w_mm || 0); setPh(st.penetration_h_mm || 0); }
  }, [certId, structures]);

  const st = structures.find(s => s.cert_id === certId);
  const perimeter = pw && ph ? 2 * (pw + ph) : 0;

  return (
    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={certId} onChange={e => setCertId(Number(e.target.value))}
          className="px-2 py-1.5 border rounded text-sm">
          {structures.map(s => (
            <option key={s.cert_id} value={s.cert_id}>{s.structure_code} ({s.socket_name})</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">수량</span>
        <input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1.5 border rounded text-sm text-center" />
        <span className="text-xs text-gray-400">W</span>
        <input type="number" value={pw} onChange={e => setPw(parseInt(e.target.value) || 0)}
          className="w-20 px-2 py-1.5 border rounded text-sm text-center" />
        <span className="text-xs text-gray-400">× H</span>
        <input type="number" value={ph} onChange={e => setPh(parseInt(e.target.value) || 0)}
          className="w-20 px-2 py-1.5 border rounded text-sm text-center" />
        {perimeter > 0 && <span className="text-xs text-gray-500">둘레 {perimeter.toLocaleString()}mm</span>}
        <button onClick={() => onAdd({
          cert_id: certId, structure_code: st?.structure_code || '', qty,
          penetration_w_mm: pw || undefined, penetration_h_mm: ph || undefined,
        })} className="px-3 py-1 bg-green-600 text-white rounded text-xs">추가</button>
        <button onClick={onCancel} className="px-3 py-1 bg-gray-200 rounded text-xs">취소</button>
      </div>
    </div>
  );
}
