import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Plus, Truck, FileText, Printer, Trash2, RefreshCw,
  Search, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight,
  Building2, MapPin, Car, User, AlertTriangle, Package, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 인터페이스 ──────────────────────────────────────────────────────────────
interface PurchaseOrder {
  po_id: number;
  project_name: string | null;
  contractor: string | null;
  biz_name: string | null;
  construction_site: string | null;
  site_address: string | null;
  delivery_date: string | null;
  item_count: number;
}

interface PurchaseOrderItem {
  po_item_id: number;
  item_type: string;
  structure: string | null;
  product_type: string | null;
  item_name: string | null;
  spec: string | null;
  pipe_width_mm: number | null;
  pipe_height_mm: number | null;
  qty: number;
  remark: string | null;
}

interface ShipmentOrder {
  so_id: number;
  so_number: string;
  so_date: string;
  customer_name: string | null;
  destination: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  status: 'DRAFT' | 'SHIPPED' | 'CANCELLED';
  statement_id: number | null;
  item_count: number;
  total_amount: number | null;
  remarks: string | null;
  po_id: number | null;
}

interface ShipmentItem {
  soi_id: number;
  item_name: string;
  spec: string | null;
  unit: string;
  qty: number;
  lot_number: string | null;
  unit_price: number;
  amount: number;
}

const STATUS_CONFIG = {
  DRAFT:   { label: '작성중',   color: 'text-amber-700 bg-amber-100 border-amber-200',  icon: <Clock className="h-3 w-3" /> },
  SHIPPED: { label: '출하완료', color: 'text-green-700 bg-green-100 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { label: '취소',   color: 'text-red-700 bg-red-100 border-red-200',       icon: <XCircle className="h-3 w-3" /> },
};

// ─── 출하지시서 행 (테이블 내 확장 가능한 row) ────────────────────────────
function ShipmentRow({ so, onRefresh }: { so: ShipmentOrder; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cfg = STATUS_CONFIG[so.status] || STATUS_CONFIG.DRAFT;

  const toggleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    if (items.length > 0) { setExpanded(true); return; }
    setLoadingItems(true);
    try {
      const res = await api.get<{ data: { items: ShipmentItem[] } }>(`/shipment-orders/${so.so_id}`);
      setItems(res.data.items || []);
      setExpanded(true);
    } catch { toast.error('품목 로드 실패'); }
    finally { setLoadingItems(false); }
  };

  const handleConfirm = async () => {
    if (!confirm(`[${so.so_number}] 출하확정 하시겠습니까?\n재고 차감 + 거래명세서가 자동 생성됩니다.`)) return;
    setConfirming(true);
    try {
      const res = await api.patch<{ data: any }>(`/shipment-orders/${so.so_id}/confirm`, {
        ship_date: so.so_date,
      });
      toast.success(`출하완료! 거래명세서 ${res.data.statement_number} 자동생성`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '출하확정 실패');
    } finally { setConfirming(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`[${so.so_number}] 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/shipment-orders/${so.so_id}`);
      toast.success('삭제됨');
      onRefresh();
    } catch { toast.error('삭제 실패 (작성중 상태만 삭제 가능)'); }
  };

  return (
    <>
      <tr className={cn(
        'border-b transition-colors hover:bg-blue-50/40',
        expanded && 'bg-blue-50/20',
        so.status === 'SHIPPED' && 'bg-green-50/20'
      )}>
        <td className="px-3 py-3 w-8">
          <button onClick={toggleExpand} disabled={loadingItems}
            className="p-1 rounded hover:bg-gray-200 text-gray-500">
            {loadingItems
              ? <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              : expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
        </td>
        {/* 출하번호 */}
        <td className="px-3 py-3 font-mono text-xs text-blue-700 font-bold whitespace-nowrap">
          {so.so_number}
        </td>
        {/* 출하일 */}
        <td className="px-3 py-3 text-sm whitespace-nowrap text-gray-700">
          {so.so_date?.slice(0, 10)}
        </td>
        {/* 상태 */}
        <td className="px-3 py-3">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', cfg.color)}>
            {cfg.icon} {cfg.label}
          </span>
        </td>
        {/* 거래처 */}
        <td className="px-3 py-3 text-sm max-w-[150px] truncate" title={so.customer_name || ''}>
          {so.customer_name || '-'}
        </td>
        {/* 납품현장 */}
        <td className="px-3 py-3 text-sm max-w-[200px] truncate" title={so.destination || ''}>
          {so.destination || '-'}
        </td>
        {/* 차량/기사 */}
        <td className="px-3 py-3 text-xs text-gray-500">
          {so.vehicle_number && <span className="block">{so.vehicle_number}</span>}
          {so.driver_name && <span className="text-gray-400">{so.driver_name}</span>}
        </td>
        {/* 품목수/금액 */}
        <td className="px-3 py-3 text-sm text-right font-mono text-gray-700">
          {so.item_count}종
          {so.total_amount != null && Number(so.total_amount) > 0 && (
            <span className="block text-xs text-indigo-600">₩{Number(so.total_amount).toLocaleString()}</span>
          )}
        </td>
        {/* 액션 */}
        <td className="px-3 py-3 text-center">
          <div className="flex items-center justify-end gap-1.5">
            {so.status === 'DRAFT' && (
              <>
                <button onClick={handleConfirm} disabled={confirming}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50 whitespace-nowrap">
                  {confirming
                    ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Truck className="h-3 w-3" />
                  }
                  출하확정
                </button>
                <button onClick={handleDelete}
                  className="p-1 border border-red-200 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {so.status === 'SHIPPED' && (
              <>
                <button onClick={() => window.open(`/print/exit-pass/${so.so_id}`, '_blank', 'width=850,height=650,toolbar=no,menubar=no')}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-semibold rounded-lg whitespace-nowrap">
                  <Printer className="h-3 w-3" /> 출차증
                </button>
                {so.statement_id && (
                  <button onClick={() => window.open(`/print/statements/${so.statement_id}?type=A`, '_blank', 'width=900,height=700,toolbar=no,menubar=no')}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-[11px] font-semibold rounded-lg whitespace-nowrap">
                    <FileText className="h-3 w-3" /> 거래명세서
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* 품목 상세 펼치기 */}
      {expanded && (
        <tr>
          <td colSpan={9} className="p-0 bg-blue-50/30">
            <div className="overflow-x-auto border-t border-blue-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-6 py-2 text-left text-xs font-semibold text-blue-700">품목명</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">규격</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-blue-700">수량</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-blue-700">LOT번호</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-blue-700">단가</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-blue-700">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {items.length === 0
                    ? <tr><td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-400">품목 없음</td></tr>
                    : items.map(item => (
                      <tr key={item.soi_id} className="hover:bg-white">
                        <td className="px-6 py-2.5 text-sm font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{item.spec || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-center font-mono">{item.qty} {item.unit}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-blue-600">{item.lot_number || '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-mono">{Number(item.unit_price || 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-mono font-semibold">{Number(item.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── 출하지시서 작성 모달 (발주서 품목 자동 불러오기) ────────────────────────
function CreateShipmentModal({
  onClose, onCreated
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: 발주서 선택
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Step 2: 출하 정보 입력
  const [soDate, setSoDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [destination, setDestination] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  // 품목 목록
  const [items, setItems] = useState<Array<{
    item_name: string; spec: string; unit: string; qty: string;
    lot_number: string; unit_price: string; amount: string;
    lot_id: string;
  }>>([]);

  const [submitting, setSubmitting] = useState(false);

  // 발주서 목록 로드
  useEffect(() => {
    setLoadingPOs(true);
    api.get<{ data: PurchaseOrder[] }>('/purchase-orders')
      .then(res => setPurchaseOrders(res.data || []))
      .catch(() => toast.error('발주서 로드 실패'))
      .finally(() => setLoadingPOs(false));
  }, []);

  // 발주서 선택 시 품목 자동 불러오기
  const handleSelectPO = async (poId: number) => {
    setSelectedPoId(poId);
    const po = purchaseOrders.find(p => p.po_id === poId);
    if (po) {
      setCustomerName(po.contractor || po.biz_name || '');
      setDestination(po.construction_site || po.site_address || po.project_name || '');
    }
    // 품목 로드
    try {
      const res = await api.get<{ data: { items: PurchaseOrderItem[] } }>(`/purchase-orders/${poId}`);
      const poItems = res.data.items || [];
      setItems(poItems.map(it => {
        const name = it.item_name ||
          (it.product_type
            ? `${it.product_type} ${it.pipe_width_mm ? `(${it.pipe_width_mm}×${it.pipe_height_mm})` : ''}`
            : it.structure || '소켓');
        const spec = it.spec ||
          (it.pipe_width_mm ? `${it.pipe_width_mm}W × ${it.pipe_height_mm}H` : '');
        return {
          item_name: name,
          spec,
          unit: 'EA',
          qty: String(it.qty || 1),
          lot_number: '',
          unit_price: '0',
          amount: '0',
          lot_id: '',
        };
      }));
      setStep(2);
    } catch { toast.error('품목 로드 실패'); }
  };

  // 직접 입력 모드 (발주서 없이)
  const handleManualMode = () => {
    setSelectedPoId(null);
    setItems([{ item_name: '', spec: '', unit: 'EA', qty: '', lot_number: '', unit_price: '0', amount: '0', lot_id: '' }]);
    setStep(2);
  };

  const addItem = () => setItems(prev => [...prev, { item_name: '', spec: '', unit: 'EA', qty: '', lot_number: '', unit_price: '0', amount: '0', lot_id: '' }]);

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'qty' || field === 'unit_price') {
        const qty = parseFloat(field === 'qty' ? value : next[idx].qty) || 0;
        const price = parseFloat(field === 'unit_price' ? value : next[idx].unit_price) || 0;
        next[idx].amount = String(Math.round(qty * price));
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.item_name.trim() && parseFloat(i.qty) > 0);
    if (validItems.length === 0) { toast.error('품목을 입력하세요'); return; }
    setSubmitting(true);
    try {
      await api.post('/shipment-orders', {
        so_date: soDate,
        customer_name: customerName || null,
        destination: destination || null,
        contact_person: contactPerson || null,
        contact_phone: contactPhone || null,
        vehicle_number: vehicleNumber || null,
        driver_name: driverName || null,
        remarks: remarks || null,
        po_id: selectedPoId || null,
        items: validItems.map((it, i) => ({
          item_name: it.item_name,
          spec: it.spec || null,
          unit: it.unit || 'EA',
          qty: parseFloat(it.qty) || 0,
          lot_id: it.lot_id ? parseInt(it.lot_id) : null,
          lot_number: it.lot_number || null,
          unit_price: parseFloat(it.unit_price) || 0,
          amount: parseFloat(it.amount) || 0,
          sort_order: i,
        })),
      });
      toast.success('출하지시서가 등록되었습니다');
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '등록 실패');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">출하지시서 작성</h2>
              <p className="text-xs text-gray-400">
                {step === 1 ? '발주서를 선택하면 품목이 자동으로 불러와집니다' : '출하 정보를 확인하고 저장하세요'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* STEP 1: 발주서 선택 */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">📋 발주서 선택 (품목 자동 연동)</h3>
                <button onClick={handleManualMode}
                  className="text-sm text-blue-600 hover:underline">
                  발주서 없이 직접 입력 →
                </button>
              </div>

              {loadingPOs ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <div className="h-5 w-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                  발주서 목록 로드 중...
                </div>
              ) : purchaseOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>등록된 발주서가 없습니다</p>
                  <button onClick={handleManualMode} className="mt-2 text-sm text-blue-600 hover:underline">
                    직접 입력하기
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {purchaseOrders.map(po => (
                    <button
                      key={po.po_id}
                      onClick={() => handleSelectPO(po.po_id)}
                      className="w-full text-left border rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 truncate">
                            {po.project_name || '(현장명 없음)'}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            {po.contractor && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{po.contractor}</span>}
                            {po.construction_site && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{po.construction_site}</span>}
                            {po.delivery_date && <span>납기: {po.delivery_date?.slice(0, 10)}</span>}
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                            {po.item_count}개 품목
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: 출하 정보 입력 */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              {selectedPoId && (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                  <Package className="h-4 w-4" />
                  <span>발주서 연동 — 품목 {items.length}개 자동 불러옴</span>
                  <button onClick={() => setStep(1)} className="ml-auto text-blue-600 hover:underline text-xs">
                    발주서 변경
                  </button>
                </div>
              )}

              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">출하일자 *</label>
                  <input type="date" value={soDate} onChange={e => setSoDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">거래처 / 현장</label>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                    placeholder="거래처 또는 건설사명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">납품 현장</label>
                  <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
                    placeholder="납품 현장명 또는 주소" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">차량번호</label>
                  <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)}
                    placeholder="00가 0000" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">기사명</label>
                  <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)}
                    placeholder="기사 성명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">현장 담당자</label>
                  <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">연락처</label>
                  <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                    placeholder="010-0000-0000" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>

              {/* 품목 목록 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800">출하 품목 ({items.length}개)</h3>
                  <button onClick={addItem}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100">
                    <Plus className="h-3 w-3" /> 품목 추가
                  </button>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">품목명</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">규격</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">수량</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">단위</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">LOT번호</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">단가</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">금액</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                              className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 min-w-28" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                              className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 min-w-24" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}
                              className="w-16 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                              className="w-10 border rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-center" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" value={item.lot_number} onChange={e => updateItem(idx, 'lot_number', e.target.value)}
                              placeholder="LOT-..." className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 font-mono min-w-24" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                              className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-right" />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="text-xs font-semibold text-gray-700 px-2">
                              {Number(item.amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-1">
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              disabled={items.length <= 1}
                              className="p-1 text-red-400 hover:text-red-600 disabled:opacity-20">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-2 text-sm font-semibold text-gray-700">
                  합계: ₩{items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString()}
                </div>
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">비고</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-2">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">
              ← 발주서 변경
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">취소</button>
          {step === 2 && (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2">
              {submitting && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <Truck className="h-4 w-4" />
              출하지시서 저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function ShipmentOrdersPage() {
  const [list, setList] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'SHIPPED'>('ALL');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('from', fromDate);
      params.append('to', toDate);
      const res = await api.get<{ data: ShipmentOrder[] }>(`/shipment-orders?${params}`);
      setList(res.data ?? []);
    } catch { toast.error('목록 로드 실패'); }
    finally { setLoading(false); }
  }, [search, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const draftCount   = list.filter(s => s.status === 'DRAFT').length;
  const shippedCount = list.filter(s => s.status === 'SHIPPED').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="출하 관리"
        count={list.length}
        description="발주서 기반 출하지시서 작성 — 출하확정 시 재고 차감 + 거래명세서 자동 생성 + 출차증 출력"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = '/shipment/pending'}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <AlertTriangle className="h-4 w-4" /> 미출하현황
          </button>
          <button
            onClick={() => window.location.href = '/shipment/returns'}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> 반품입고
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> 출하지시서 등록
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '작성중',   count: draftCount,   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <Clock className="h-4 w-4 text-amber-500" /> },
            { label: '출하완료', count: shippedCount, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
            { label: '전체',     count: list.length,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Truck className="h-4 w-4 text-blue-500" /> },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={cn('rounded-xl border p-3 flex items-center gap-3', bg, border)}>
              <div className="p-1.5 bg-white rounded-lg shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-xl font-bold', color)}>{count}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 필터 바 */}
        <div className="bg-white rounded-xl border shadow-sm px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 상태 필터 탭 */}
            <div className="flex gap-1">
              {([['ALL','전체'], ['DRAFT','작성중'], ['SHIPPED','출하완료']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    statusFilter === key ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100')}>
                  {label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-gray-200" />

            {/* 날짜 필터 */}
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {/* 검색 */}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchList()}
                placeholder="번호, 거래처 검색..."
                className="pl-8 pr-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 w-44" />
            </div>
            <button onClick={fetchList} disabled={loading}
              className="p-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50">
              <RefreshCw className={cn('h-4 w-4 text-gray-600', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">출하번호</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">출하일</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">거래처</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">납품 현장</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">차량/기사</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">품목수/금액</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      로드 중...
                    </div>
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-20 text-center text-gray-400">
                    <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-base font-semibold">출하지시서가 없습니다</p>
                    <p className="text-sm mt-1">발주서를 선택해 출하지시서를 등록해 보세요</p>
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
                      <Plus className="h-4 w-4" /> 출하지시서 등록
                    </button>
                  </td>
                </tr>
              ) : (
                list.map(so => <ShipmentRow key={so.so_id} so={so} onRefresh={fetchList} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchList(); }}
        />
      )}
    </div>
  );
}
