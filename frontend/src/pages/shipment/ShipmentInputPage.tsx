import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Search, Truck, Plus, Trash2, Calendar, Building2, MapPin,
  Car, User, Phone, FileText, CheckCircle2, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────
interface PurchaseOrder {
  po_id: number;
  po_number: string;
  project_name: string | null;
  contractor: string | null;
  biz_name: string | null;
  construction_site: string | null;
  site_address: string | null;
  delivery_date: string | null;
  item_count: number;
  created_at: string;
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
  linked_item_id: number | null;
}

interface ActiveLot {
  lot_id: number;
  lot_number: string;
  qty: number;
  remaining_qty: number;
  unit: string;
}

interface ShipmentInputItem {
  item_name: string;
  spec: string;
  unit: string;
  qty: string;
  lot_id: string;
  lot_number: string;
  unit_price: string;
  amount: string;
  linked_item_id: number | null;
  availableLots: ActiveLot[];
  loadingLots: boolean;
}

export function ShipmentInputPage() {
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poSearch, setPoSearch] = useState('');

  // Shipment Form states
  const [soDate, setSoDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [destination, setDestination] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Items State
  const [items, setItems] = useState<ShipmentInputItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load Purchase Orders
  const fetchPurchaseOrders = () => {
    setLoadingPOs(true);
    api.get<{ data: PurchaseOrder[] }>('/purchase-orders')
      .then(res => {
        // Filter out PO source_type = 'PROJECT_ONLY' or check po_id exists
        setPurchaseOrders((res.data || []).filter(p => p.po_id !== null));
      })
      .catch(() => toast.error('발주서 목록 로드 실패'))
      .finally(() => setLoadingPOs(false));
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  // Filter POs by search input
  const filteredPOs = purchaseOrders.filter(po => {
    const term = poSearch.toLowerCase();
    return (
      (po.project_name || '').toLowerCase().includes(term) ||
      (po.po_number || '').toLowerCase().includes(term) ||
      (po.contractor || '').toLowerCase().includes(term) ||
      (po.biz_name || '').toLowerCase().includes(term)
    );
  });

  // Handle PO selection and item parsing
  const handleSelectPO = async (po: PurchaseOrder) => {
    setSelectedPo(po);
    setCustomerName(po.contractor || po.biz_name || '');
    setDestination(po.construction_site || po.site_address || po.project_name || '');
    
    try {
      const res = await api.get<{ data: { items: PurchaseOrderItem[] } }>(`/purchase-orders/${po.po_id}`);
      const poItems = res.data.items || [];
      
      const parsedItems: ShipmentInputItem[] = poItems.map(it => {
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
          lot_id: '',
          lot_number: '',
          unit_price: '0',
          amount: '0',
          linked_item_id: it.linked_item_id,
          availableLots: [],
          loadingLots: false
        };
      });

      setItems(parsedItems);
      setStep(2);

      // Trigger asynchronous loading of LOTs for each item
      parsedItems.forEach((item, idx) => {
        if (item.linked_item_id) {
          loadLotsForItem(idx, item.linked_item_id);
        }
      });

    } catch (err) {
      toast.error('발주서 품목 로드 실패');
    }
  };

  // Asynchronously load available lots for a single item
  const loadLotsForItem = async (index: number, itemId: number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], loadingLots: true };
      return next;
    });

    try {
      // Query active lots from /api/lots
      const res = await api.get<{ data: any[] }>(`/lots?item_id=${itemId}&status=ACTIVE`);
      const lotsData: ActiveLot[] = (res.data || []).map(l => ({
        lot_id: l.lot_id,
        lot_number: l.lot_number,
        qty: parseFloat(l.qty) || 0,
        remaining_qty: parseFloat(l.remaining_qty) || 0,
        unit: l.unit || 'EA'
      })).filter(l => l.remaining_qty > 0);

      setItems(prev => {
        const next = [...prev];
        next[index] = { ...next[index], availableLots: lotsData, loadingLots: false };
        return next;
      });
    } catch {
      setItems(prev => {
        const next = [...prev];
        next[index] = { ...next[index], loadingLots: false };
        return next;
      });
    }
  };

  // Direct manual input mode (without PO link)
  const handleManualInputMode = () => {
    setSelectedPo(null);
    setCustomerName('');
    setDestination('');
    setItems([{
      item_name: '',
      spec: '',
      unit: 'EA',
      qty: '1',
      lot_id: '',
      lot_number: '',
      unit_price: '0',
      amount: '0',
      linked_item_id: null,
      availableLots: [],
      loadingLots: false
    }]);
    setStep(2);
  };

  // Add a new row to manual items table
  const addRow = () => {
    setItems(prev => [...prev, {
      item_name: '',
      spec: '',
      unit: 'EA',
      qty: '1',
      lot_id: '',
      lot_number: '',
      unit_price: '0',
      amount: '0',
      linked_item_id: null,
      availableLots: [],
      loadingLots: false
    }]);
  };

  // Update item field values and compute amount
  const updateItem = (idx: number, field: keyof ShipmentInputItem, value: any) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[idx], [field]: value };
      
      // Auto-compute amount if qty or unit_price changes
      if (field === 'qty' || field === 'unit_price') {
        const qty = parseFloat(field === 'qty' ? value : target.qty) || 0;
        const price = parseFloat(field === 'unit_price' ? value : target.unit_price) || 0;
        target.amount = String(Math.round(qty * price));
      }

      // If selecting a LOT from the dropdown
      if (field === 'lot_id') {
        const lot = target.availableLots.find(l => String(l.lot_id) === String(value));
        if (lot) {
          target.lot_number = lot.lot_number;
          // Pre-fill ship quantity if it is larger than remaining
          const currentQty = parseFloat(target.qty) || 0;
          if (currentQty === 0 || currentQty > lot.remaining_qty) {
            target.qty = String(lot.remaining_qty);
            const price = parseFloat(target.unit_price) || 0;
            target.amount = String(Math.round(lot.remaining_qty * price));
          }
        } else {
          target.lot_number = '';
        }
      }

      next[idx] = target as ShipmentInputItem;
      return next;
    });
  };

  // Submit form to create shipment order
  const handleSubmitShipment = async () => {
    const validItems = items.filter(i => i.item_name.trim() && parseFloat(i.qty) > 0);
    if (validItems.length === 0) {
      toast.error('출하 품목 정보를 정확히 입력하세요.');
      return;
    }

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
        po_id: selectedPo?.po_id || null,
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

      toast.success('출하지시서가 등록되었습니다.');
      navigate('/shipment/orders');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '출하지시 등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="출하 입력"
        description="발주서(PO) 및 LOT 정보와 연동하여 출하를 등록하고 재고 거래를 생성합니다."
      >
        <button
          onClick={() => navigate('/shipment/orders')}
          className="px-4 py-2 border rounded-xl hover:bg-white text-sm font-semibold transition-colors"
        >
          출하 목록으로 돌아가기
        </button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* STEP 1: PO Selection */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  발주서(PO) 선택
                </h2>
                <p className="text-xs text-slate-400 mt-1">출하 등록할 대상 발주서를 선택하십시오.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleManualInputMode}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5"
                >
                  발주서 없이 수동 입력하기 →
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="현장명, 발주번호, 거래처 검색..."
                  value={poSearch}
                  onChange={e => setPoSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50 bg-slate-50/30"
                />
              </div>

              {loadingPOs ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-sm">발주서 정보를 로드하고 있습니다...</p>
                </div>
              ) : filteredPOs.length === 0 ? (
                <div className="text-center py-20 border border-dashed rounded-2xl border-slate-200 bg-slate-50/20">
                  <FileText className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 font-semibold text-sm">일치하는 발주서가 없습니다.</p>
                  <button
                    onClick={handleManualInputMode}
                    className="mt-3 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    직접 입력 진행
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                  {filteredPOs.map(po => (
                    <div
                      key={po.po_id}
                      onClick={() => handleSelectPO(po)}
                      className="group border border-slate-200/80 rounded-2xl p-5 bg-white hover:border-blue-400 hover:shadow-md hover:bg-blue-50/5 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                            {po.po_number || 'PO-NONE'}
                          </span>
                          <h3 className="font-bold text-slate-800 group-hover:text-blue-700 text-sm truncate">
                            {po.project_name || '(미지정 현장)'}
                          </h3>
                          <div className="space-y-1">
                            {po.contractor && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{po.contractor}</span>
                              </div>
                            )}
                            {po.construction_site && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{po.construction_site}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                            {po.item_count}개 품목
                          </span>
                          {po.delivery_date && (
                            <span className="text-[10px] text-slate-400">
                              납기: {po.delivery_date.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        선택 및 진행 <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Input Details */}
        {step === 2 && (
          <div className="space-y-6 transition-all duration-300">
            {/* Header / Notice */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">
                    {selectedPo ? `발주서 연동 출하 정보 기입: ${selectedPo.project_name}` : '수동 출하 정보 기입'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPo ? `발주서 품목 ${items.length}개를 로드했습니다.` : '발주서 없이 수동으로 출하를 기입합니다.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
              >
                발주서 재선택
              </button>
            </div>

            {/* Basic Info Fields Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <h4 className="font-bold text-slate-700 text-sm border-b pb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                기본 출하 정보
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">출하일자 *</label>
                  <input
                    type="date"
                    value={soDate}
                    onChange={e => setSoDate(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">납품 거래처</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="거래처명"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">납품지 (현장)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="납품현장명 또는 상세 주소"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">차량 번호</label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="00가 0000"
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">배송 기사명</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="성함"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">현장 담당자</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="담당자 이름"
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">담당자 연락처</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="010-0000-0000"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  출하 품목 내역 및 LOT 지정
                </h4>
                {!selectedPo && (
                  <button
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    품목 수동 추가
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/70 text-slate-500 text-xs font-bold border-b">
                    <tr>
                      <th className="px-4 py-3 text-left w-64">품목명 *</th>
                      <th className="px-4 py-3 text-left w-44">규격</th>
                      <th className="px-4 py-3 text-center w-24">단위</th>
                      <th className="px-4 py-3 text-right w-28">출하수량</th>
                      <th className="px-4 py-3 text-left w-64">생산 LOT 선택 (작업지시서 연동)</th>
                      <th className="px-4 py-3 text-right w-32">단가</th>
                      <th className="px-4 py-3 text-right w-32">금액</th>
                      {!selectedPo && <th className="px-2 py-3 w-10 text-center">작업</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20">
                        {/* 품목명 */}
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={e => updateItem(idx, 'item_name', e.target.value)}
                            disabled={!!selectedPo}
                            className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-700"
                            placeholder="품목 입력"
                          />
                        </td>
                        {/* 규격 */}
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.spec}
                            onChange={e => updateItem(idx, 'spec', e.target.value)}
                            disabled={!!selectedPo}
                            className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-600"
                            placeholder="규격 입력"
                          />
                        </td>
                        {/* 단위 */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="w-16 border rounded-lg px-1 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                            placeholder="단위"
                          />
                        </td>
                        {/* 출하수량 */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                            className="w-24 border rounded-lg px-2.5 py-1.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                            placeholder="0"
                          />
                        </td>
                        {/* LOT 선택 */}
                        <td className="px-4 py-3">
                          {item.loadingLots ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
                              <RefreshCw className="h-3 w-3 animate-spin" /> LOT 로드 중...
                            </div>
                          ) : item.availableLots.length > 0 ? (
                            <select
                              value={item.lot_id}
                              onChange={e => updateItem(idx, 'lot_id', e.target.value)}
                              className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                            >
                              <option value="">-- LOT 선택 (필수) --</option>
                              {item.availableLots.map(l => (
                                <option key={l.lot_id} value={l.lot_id}>
                                  {l.lot_number} (잔량: {l.remaining_qty} {l.unit})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                placeholder="LOT번호 직접 입력 또는 선택"
                                value={item.lot_number}
                                onChange={e => updateItem(idx, 'lot_number', e.target.value)}
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                              />
                              <span className="text-[10px] text-slate-400 block px-1">
                                {item.linked_item_id ? '⚠️ 생산완료된 활성 LOT 재고 없음' : '💡 수동 기입 전용 품목'}
                              </span>
                            </div>
                          )}
                        </td>
                        {/* 단가 */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                            className="w-28 border rounded-lg px-2.5 py-1.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                            placeholder="0"
                          />
                        </td>
                        {/* 금액 */}
                        <td className="px-4 py-3 text-right font-semibold font-mono text-slate-700">
                          {Number(item.amount || 0).toLocaleString()}
                        </td>
                        {/* 삭제 액션 (수동 추가 시에만 노출) */}
                        {!selectedPo && (
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              disabled={items.length <= 1}
                              className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-20 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-sm font-bold text-slate-700">
                <span>합계 금액</span>
                <span className="text-lg text-blue-600 font-mono">
                  ₩{items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Remarks Area */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">출하 비고 사항</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                placeholder="출하 시 인수 서명이나 차량 인수 조건 등 비고 기입"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/50 resize-none"
              />
            </div>

            {/* Actions Bar */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={handleSubmitShipment}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                출하지시 등록 완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
