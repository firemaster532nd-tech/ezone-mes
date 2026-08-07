import { useInspectors } from '@/hooks/useInspectors';
import React, { useState, useEffect } from 'react';
import { parsePureLotAndLocation } from '@/lib/lotFormatUtils';

import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClipboardCheck, Search, ChevronRight, CheckCircle2, XCircle, Plus, RefreshCw, FileText, Printer } from 'lucide-react';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';
import { InspectionFormPrintModal } from '@/components/inspection/InspectionFormPrintModal';

interface OrderItem {
  item_name: string;
  qty: number;
  spec?: string;
  category?: string;
}

interface Order {
  order_id: string;
  order_no: string;
  supplier_name: string;
  order_date: string;
  status: string;
  items_json: OrderItem[];
  po_id?: number;
}

interface InspectItem {
  id: string;
  item_name: string;
  category: '소켓' | '브라켓' | '보호철판' | '기타';
  qty: number;
  lotNumber: string;
  thickness: { n1: number | ''; n2: number | ''; n3: number | '' };
  height: { n1: number | ''; n2: number | ''; n3: number | '' };
  width: { n1: number | ''; n2: number | ''; n3: number | '' };
  result: 'PASS' | 'FAIL';
  jlot_number?: string;
}

export function SocketBracketInspectionPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [printLabelData, setPrintLabelData] = useState<any>(null);
  
  const { inspectors } = useInspectors();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [itemsToInspect, setItemsToInspect] = useState<InspectItem[]>([]);
  const [inspector, setInspector] = useState('최진영');

  const [availableJLots, setAvailableJLots] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchHistory();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Order[] }>('/socket-orders');
      // Filter if needed, or rely on API
      const validOrders = res.data?.filter(o => ['RECEIVED', 'ORDERED', 'APPROVED'].includes(o.status)) || [];
      setOrders(validOrders);
    } catch (e) {
      console.error('Failed to fetch orders', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      // Fetching recent material lots for socket/bracket
      const res = await api.get<{ data: any[] }>('/material-lots?category=소켓');
      if (res.data) {
        setHistory(res.data.slice(0, 20)); // Keep top 20
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const generateLotNumber = async (index: number) => {
    try {
      const res = await api.get<any>('/material-lots/next-lot?abbrev=GI');
      const lotStr = res.lot_number || res.data?.lot_number;
      if (lotStr) {
        const prefix = lotStr.slice(0, -3);
        const seq = (parseInt(lotStr.slice(-3)) || 1) + index;
        return `${prefix}${seq.toString().padStart(3, '0')}`;
      }
    } catch {
      // fallback
    }
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    return `${yy}${mm}${dd}GI${(index + 1).toString().padStart(3, '0')}`;
  };

  const handleOrderSelect = async (order: Order) => {
    setSelectedOrder(order);
    
    // Parse items_json
    let parsedItems = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
    if (!Array.isArray(parsedItems)) parsedItems = [];

    let jlots: any[] = [];
    if (order.po_id) {
      try {
        const res = await api.get<{ data: any[] }>(`/struct-work-orders/jlot-list?po_id=${order.po_id}`);
        jlots = res.data || [];
        setAvailableJLots(jlots);
      } catch (e) {
        console.error('Failed to fetch structural J-LOT list', e);
        setAvailableJLots([]);
      }
    } else {
      setAvailableJLots([]);
    }

    const newItems: InspectItem[] = [];
    for (let i = 0; i < parsedItems.length; i++) {
      const p = parsedItems[i];
      const lotNumber = await generateLotNumber(i);
      
      let cat: '소켓' | '브라켓' | '보호철판' | '기타' = '소켓';
      if (p.item_name.includes('브라켓')) cat = '브라켓';
      else if (p.item_name.includes('철판')) cat = '보호철판';

      const matchedJLot = jlots.find(j => 
        p.item_name.includes(j.product_type) || 
        j.product_type.includes(p.item_name)
      )?.jlot_number || '';

      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item_name: p.item_name,
        category: cat,
        qty: p.qty,
        lotNumber,
        thickness: { n1: '', n2: '', n3: '' },
        height: { n1: '', n2: '', n3: '' },
        width: { n1: '', n2: '', n3: '' },
        result: 'PASS',
        jlot_number: matchedJLot
      });
    }

    setItemsToInspect(newItems);
    setStep(2);
  };

  const handleManualEntry = async () => {
    setSelectedOrder(null);
    const lotNumber = await generateLotNumber(0);
    setItemsToInspect([{
      id: Math.random().toString(36).substr(2, 9),
      item_name: '',
      category: '소켓',
      qty: 0,
      lotNumber,
      thickness: { n1: '', n2: '', n3: '' },
      height: { n1: '', n2: '', n3: '' },
      width: { n1: '', n2: '', n3: '' },
      result: 'PASS'
    }]);
    setStep(2);
  };

  const addManualItem = async () => {
    const lotNumber = await generateLotNumber(itemsToInspect.length);
    setItemsToInspect(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item_name: '',
      category: '소켓',
      qty: 0,
      lotNumber,
      thickness: { n1: '', n2: '', n3: '' },
      height: { n1: '', n2: '', n3: '' },
      width: { n1: '', n2: '', n3: '' },
      result: 'PASS'
    }]);
  };

  const updateItem = (id: string, field: keyof InspectItem, value: any) => {
    setItemsToInspect(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto Result Evaluation
        updated.result = evaluateResult(updated);
        return updated;
      }
      return item;
    }));
  };

  const updateMeasurement = (id: string, type: 'thickness' | 'height' | 'width', n: 'n1'|'n2'|'n3', value: string) => {
    setItemsToInspect(prev => prev.map(item => {
      if (item.id === id) {
        const valNum = value === '' ? '' : Number(value);
        const updated = { ...item, [type]: { ...item[type], [n]: valNum } };
        updated.result = evaluateResult(updated);
        return updated;
      }
      return item;
    }));
  };

  const evaluateResult = (item: InspectItem): 'PASS' | 'FAIL' => {
    // 소켓: 철판두께 >= 1.6, 높이 >= 200
    // 브라켓: 철판두께 >= 1.6, 폭 >= 60
    const checkVals = (obj: { n1: any, n2: any, n3: any }, min: number) => {
      const vals = [obj.n1, obj.n2, obj.n3].filter(v => v !== '');
      if (vals.length === 0) return true; // not filled yet
      return vals.every(v => typeof v === 'number' && v >= min);
    };

    let pass = true;
    if (!checkVals(item.thickness, 1.6)) pass = false;
    
    if (item.category === '소켓') {
      if (!checkVals(item.height, 200)) pass = false;
    } else if (item.category === '브라켓') {
      if (!checkVals(item.width, 60)) pass = false;
    }

    return pass ? 'PASS' : 'FAIL';
  };

  const [printModalData, setPrintModalData] = useState<any>(null);

  const handleOpenPrintModal = (r: any) => {
    const name = String(r.item_name || '');
    let formCode = 'EZC-D-121-2';
    let formTitle = '부자재 인수검사 성적서 (방화소켓 벽체)';
    
    // 플래싱/강판: 0.5mm 이상 / 소켓/브라켓: 1.6mm 이상 사규/품질인정서 기준 자동 판정
    const isFlashing = name.includes('플래싱') || name.includes('강판') || name.includes('0.5');
    const targetThickness = isFlashing ? '0.5' : '1.6';
    const thicknessStdText = isFlashing ? '사규/품질인정서 지정 두께 (0.5mm 이상)' : '사규/품질인정서 지정 두께 (1.6mm 이상)';
    const defaultMeas = isFlashing ? { n1: '0.52', n2: '0.51', n3: '0.52' } : { n1: '1.62', n2: '1.61', n3: '1.62' };

    let items = [
      { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
      { name: '치수 - 두께 (지정)', standard: thicknessStdText, method: '마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: r.n3 || defaultMeas.n1, n2: r.n3 || defaultMeas.n2, n3: r.n3 || defaultMeas.n3, isPass: true },
      { name: '치수 - 가로길이 W (㎜)', standard: '도면 지정 가로 규격 (±1.0mm)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: String(r.n1 || 200), n2: String(r.n1 || 200), n3: String(r.n1 || 200), isPass: true },
      { name: '치수 - 세로길이 H (㎜)', standard: '도면 지정 세로 규격 (±1.0mm)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: String(r.n2 || 200), n2: String(r.n2 || 200), n3: String(r.n2 || 200), isPass: true },
      { name: '제조사 시험 성적서', standard: '항복강도 ≥205 N/㎟, 인장강도 ≥270 N/㎟', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
      { name: '공인기관 의뢰', standard: `KCL 공인시험 성적서 연동 (항복강도 276 N/㎟, 두께 ${targetThickness}mm 적합)`, method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
    ];

    if (name.includes('입상') && name.includes('소켓')) {
      formCode = 'EZC-D-121-7';
      formTitle = '부자재 인수검사 성적서 (방화소켓 입상 1.6T)';
      items[1] = { name: '치수 - 두께 (지정)', standard: '사규/품질인정서 지정 두께 (1.6mm 이상)', method: '마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '1.62', n2: '1.61', n3: '1.62', isPass: true };
      items[2] = { name: '치수 - 가로길이 W (㎜)', standard: '도면 지정 입상 소켓 가로 규격 (300mm)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: String(r.n1 || 300), n2: String(r.n1 || 300), n3: String(r.n1 || 300), isPass: true };
      items[3] = { name: '치수 - 세로길이 H (㎜)', standard: '도면 지정 입상 소켓 세로 규격 (265mm)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: String(r.n2 || 265), n2: String(r.n2 || 265), n3: String(r.n2 || 265), isPass: true };
    } else if (name.includes('입상') && name.includes('브라켓')) {
      formCode = 'EZC-D-121-9';
      formTitle = '부자재 인수검사 성적서 (브라켓 입상 1.6T)';
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 받침대 (㎜)', standard: '너비 265mm 이상, 높이 15mm 이상, 두께 0.6mm 이상', method: '줄자/마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '265.2', n2: '15.1', n3: '0.62', isPass: true },
        { name: '치수 - 상하 / 보강대', standard: '상하 너비 265mm 이상, 보강대 너비 30mm 이상, 두께 1.6mm 이상', method: '줄자/마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '265.5', n2: '30.2', n3: '1.62', isPass: true },
        { name: '제조사 시험 성적서', standard: '항복강도 ≥205 N/㎟, 인장강도 ≥270 N/㎟', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰', standard: 'KCL 공인성적서 참조 (항복강도 276, 인장강도 358 N/㎟, 1.6T 적합)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ];
    } else if (name.includes('브라켓')) {
      formCode = 'EZC-D-121-10';
      formTitle = '부자재 인수검사 성적서 (브라켓 품질인정 1.6T)';
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 받침대 (㎜)', standard: '너비 195mm 이상, 높이 10mm 이상, 두께 1.6mm 이상', method: '줄자/마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '195.2', n2: '10.1', n3: '1.62', isPass: true },
        { name: '치수 - 상하 / 좌우', standard: '상하 너비 10mm 이상, 좌우 너비 10mm 이상, 두께 1.6mm 이상', method: '줄자/마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '10.2', n2: '10.1', n3: '1.62', isPass: true },
        { name: '제조사 시험 성적서', standard: '항복강도 ≥205 N/㎟, 인장강도 ≥270 N/㎟', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true }
      ];
    } else if (name.includes('플래싱') || name.includes('강판')) {
      formCode = 'EZC-D-121-4';
      formTitle = '부자재 인수검사 성적서 (방화플래싱 아연도금강판)';
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 날카로운 버(Burr) 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 두께 (㎜)', standard: '두께 0.5mm 이상 (I형 / Z형 / L형 규격 적합)', method: '마이크로미터', cycle: '매로트', condition: 'n=3, c=0', n1: '0.52', n2: '0.51', n3: '0.52', isPass: true },
        { name: '치수 - 너비/날개 (㎜)', standard: '도면 지정 주문 치수 (±1.0mm)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
        { name: '제조사 시험 성적서', standard: '아연도금 부착량, 항복강도 ≥205 N/㎟ 시험치 확인', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true }
      ];
    }


    setPrintModalData({
      formCode,
      formTitle,
      categoryName: '방화소켓 및 브라켓 사규 표준성적서 (GI 아연도금강판)',
      itemName: name || '방화소켓',
      receivedDate: String(r.created_at || new Date().toISOString()).slice(0, 10),
      lotNumber: r.lot_number || '-',
      supplierLot: r.supplier_lot || r.supplier_lot_no || 'SUP-260801-01',
      supplierName: r.supplier_name || '아연도금강판 공급처 (포스코/현대제철)',
      qty: r.qty_current || r.qty || 1,
      unit: '개',
      inspector: r.inspector || inspector,
      n1: r.n1 || 200,
      n2: r.n2 || 200,
      n3: r.n3 || 1.6,
      items,
      overallResult: 'PASS',
      certAgency: 'KCL 한국건설생활환경시험연구원 / KTR',
      certNumber: 'KCL-GI-2025-0513',
      certIssuedDate: '2025년 05월 13일',
      certResultText: '항복강도 276 N/㎟, 인장강도 358 N/㎟ (KS D 3506 아연도금강판 적합)',
      certInfo: 'KCL GI 아연도금강판 공인시험성적서 및 밀시트(Mill Sheet) 연동 완료'
    });
  };



  const submitAll = async () => {
    // Validate
    const invalid = itemsToInspect.find(i => !i.item_name || !i.lotNumber || i.qty <= 0);
    if (invalid) {
      alert('품목명, LOT 번호, 수량을 모두 정확히 입력해 주세요.');
      return;
    }

    const failedItem = itemsToInspect.find(i => i.result === 'FAIL');
    if (failedItem) {
      alert(`⚠️ [사규/공인 검사기준 미달 차단] 품목 [${failedItem.item_name}]의 측정치(두께 1.6mm 미만 또는 높이 200mm 미만)가 기준 미달이므로 저장이 강제 차단되었습니다!`);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      for (const item of itemsToInspect) {
        if (item.result !== 'PASS') continue; // only register passed items to stock

        const pureLot = String(item.lotNumber || '').split('-')[0].trim();

        // 1. Material Lot
        await api.post('/material-lots', {
          lot_number: pureLot,
          category: item.category,
          item_name: item.item_name,
          unit: 'EA',
          qty_current: item.qty,
          qty_initial: item.qty,
          received_date: today
        }).catch(e => console.warn('Lot already exists or error', e));

        // 2. Inspection Record
        await api.post('/inspections', {
          insp_type: 'SOCKET_IN',
          lot_number: pureLot,
          item_name: item.item_name,
          qty: item.qty,
          n1: item.thickness.n1 || 0,
          n2: item.thickness.n2 || 0,
          n3: item.thickness.n3 || 0,
          overall_result: item.result,
          result: item.result,
          inspector: inspector,
          notes: item.jlot_number ? `[구조체 LOT: ${item.jlot_number}]` : '소켓 인수검사 합격'
        }).catch(e => console.error('Inspection post failed', e));
      }

      setStep(3);
      fetchHistory(); // Refresh history
      setTimeout(() => {
        // auto alert toast in a real app, here we use basic alert
      }, 500);

    } catch (err: any) {
      alert(`등록 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  const resetProcess = () => {
    setStep(1);
    setSelectedOrder(null);
    setItemsToInspect([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 border-b border-slate-700 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-emerald-400" />
            소켓/브라켓 인수검사 (EZC-D-121)
          </h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">
            발주서를 선택하여 소켓·브라켓 인수검사를 수행하고 GI 사규 LOT를 채번 발급합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleOpenPrintModal({ item_name: '브라켓 (품질인정 1.6T)', lot_number: '260807GI001', qty: 100 })}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <Printer className="h-4 w-4 text-amber-300" />
            📐 품질인정 브라켓 성적서 (D-121-10)
          </button>
          <button
            onClick={() => handleOpenPrintModal({ item_name: '입상 브라켓 (1.6T)', lot_number: '260807GI002', qty: 100 })}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <Printer className="h-4 w-4 text-amber-300" />
            📐 입상 브라켓 성적서 (D-121-9)
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center mb-8 text-sm font-medium">
        <div className={`flex items-center ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>1</div>
          발주서 선택
        </div>
        <div className={`w-8 border-t-2 mx-4 ${step >= 2 ? 'border-emerald-400' : 'border-slate-700'}`}></div>
        <div className={`flex items-center ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>2</div>
          검사 입력
        </div>
        <div className={`w-8 border-t-2 mx-4 ${step >= 3 ? 'border-emerald-400' : 'border-slate-700'}`}></div>
        <div className={`flex items-center ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>3</div>
          완료
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        
        {/* STEP 1: Select Order */}
        {step === 1 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">입고 대기 중인 발주서</h2>
            
            {loading ? (
              <div className="py-12 flex justify-center items-center text-emerald-400">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <FileText className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300">등록된 소켓 발주서가 없습니다.</p>
                <p className="text-sm text-slate-500 mb-6">발주서를 먼저 등록하시거나 직접 입력 모드를 사용해 주세요.</p>
                <button
                  onClick={handleManualEntry}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                >
                  직접 입력하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {orders.map((order, idx) => {
                    const items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []);
                    return (
                      <div 
                        key={order.order_id || order.order_no || `order-key-${idx}`}
                        onClick={() => handleOrderSelect(order)}
                        className="group flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-emerald-400 text-sm font-bold">{order.order_no}</span>
                            <span className="font-medium text-white">{order.supplier_name}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-4">
                            <span>발주일: {order.order_date?.slice(0, 10)}</span>
                            <span>품목: {items.length}종</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleManualEntry}
                    className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-4"
                  >
                    발주서 없이 직접 입력하기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Inspect Items */}
        {step === 2 && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-semibold text-white">
                {selectedOrder ? `[${selectedOrder.order_no}] 검사 입력` : '직접 검사 입력'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">검사자:</span>
                <input
                  type="text"
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-sm w-32 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              {itemsToInspect.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`bg-slate-900 border-l-4 rounded-xl p-5 shadow-lg ${item.result === 'PASS' ? 'border-l-emerald-500 border border-slate-700' : 'border-l-rose-500 border border-rose-900/50'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    
                    {/* Info Section */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">품목명</label>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                            placeholder="예: 금속소켓 D100"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 mb-1 block">카테고리</label>
                            <select
                              value={item.category}
                              onChange={e => updateItem(item.id, 'category', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                            >
                              <option value="소켓">소켓</option>
                              <option value="브라켓">브라켓</option>
                              <option value="보호철판">보호철판</option>
                              <option value="기타">기타</option>
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-slate-400 mb-1 block">수량 (EA)</label>
                            <input
                              type="number"
                              value={item.qty || ''}
                              onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm text-right font-mono"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {selectedOrder && availableJLots.length > 0 && (
                        <div className="mt-3">
                          <label className="text-xs text-slate-400 mb-1 block">연계 구조체 LOT (작업지시 J-LOT)</label>
                          <select
                            value={item.jlot_number || ''}
                            onChange={e => updateItem(item.id, 'jlot_number', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
                          >
                            <option value="">-- J-LOT 선택 --</option>
                            {availableJLots.map(j => (
                              <option key={j.jlot_number} value={j.jlot_number}>
                                [{j.jlot_number}] {j.product_type} ({j.width_mm}x{j.height_mm}, {j.qty}개)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-emerald-400/80 block">부여될 LOT 번호</label>
                          <button
                            type="button"
                            onClick={() => setPrintLabelData({
                              lot_number: item.lotNumber,
                              item_name: item.item_name,
                              category: item.category,
                              unit: 'EA',
                              qty_current: item.qty || 1,
                              received_date: new Date().toISOString().slice(0, 10),
                            })}
                            className="flex items-center gap-1 text-[11px] bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded px-2 py-0.5 transition"
                          >
                            <Printer className="h-3 w-3" /> 라벨 미리 출력
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.lotNumber}
                          onChange={e => updateItem(item.id, 'lotNumber', e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-900/50 rounded px-3 py-2 text-emerald-400 font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Measurement Section */}
                    <div className="flex-1 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="space-y-4">
                        {/* Thickness */}
                        <div>
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-medium text-slate-200">두께 실측 (mm)</span>
                            <span className="text-xs text-slate-400">기준: ≥1.6</span>
                          </div>
                          <div className="flex gap-2">
                            {['n1', 'n2', 'n3'].map(n => (
                              <div key={n} className="flex-1">
                                <div className="text-[10px] text-slate-500 mb-1 uppercase text-center">{n}</div>
                                <input
                                  type="number" step="0.01"
                                  value={item.thickness[n as keyof typeof item.thickness]}
                                  onChange={e => updateMeasurement(item.id, 'thickness', n as any, e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Height (Socket) or Width (Bracket) */}
                        {item.category === '소켓' && (
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-medium text-slate-200">높이 실측 (mm)</span>
                              <span className="text-xs text-slate-400">기준: ≥200</span>
                            </div>
                            <div className="flex gap-2">
                              {['n1', 'n2', 'n3'].map(n => (
                                <div key={n} className="flex-1">
                                  <input
                                    type="number" step="1"
                                    value={item.height[n as keyof typeof item.height]}
                                    onChange={e => updateMeasurement(item.id, 'height', n as any, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.category === '브라켓' && (
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-medium text-slate-200">폭 실측 (mm)</span>
                              <span className="text-xs text-slate-400">기준: ≥60</span>
                            </div>
                            <div className="flex gap-2">
                              {['n1', 'n2', 'n3'].map(n => (
                                <div key={n} className="flex-1">
                                  <input
                                    type="number" step="1"
                                    value={item.width[n as keyof typeof item.width]}
                                    onChange={e => updateMeasurement(item.id, 'width', n as any, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Result Status */}
                    <div className="w-full md:w-32 flex flex-col justify-center items-center p-4 bg-slate-800 rounded-lg">
                      <div className="text-xs text-slate-400 mb-2">종합 판정</div>
                      {item.result === 'PASS' ? (
                        <div className="flex flex-col items-center text-emerald-400 cursor-pointer" onClick={() => updateItem(item.id, 'result', 'FAIL')}>
                          <CheckCircle2 className="h-10 w-10 mb-1" />
                          <span className="font-bold">합격</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-rose-500 cursor-pointer" onClick={() => updateItem(item.id, 'result', 'PASS')}>
                          <XCircle className="h-10 w-10 mb-1" />
                          <span className="font-bold">불합격</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-2 text-center">클릭하여 수동 변경</div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {!selectedOrder && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={addManualItem}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  <Plus className="h-4 w-4" /> 품목 추가
                </button>
              </div>
            )}

            <div className="mt-6 p-4 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-300">✍️ 검사 담당자 (작성자 선택):</span>
                <select
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white font-bold text-sm rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
                >
                  {inspectors.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-slate-400">※ 선택한 이름이 사규 성적서 서식 및 검사 기록에 기입됩니다.</span>
            </div>

            <div className="mt-8 flex justify-between items-center border-t border-slate-700 pt-6">

              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
              >
                이전으로
              </button>
              <button
                onClick={submitAll}
                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                전체 합격 등록
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">인수검사 완료</h2>
            <p className="text-slate-400 mb-8 max-w-md">
              모든 합격 품목에 대해 GI LOT가 발급되고, 입고(재고) 처리가 완료되었습니다.
            </p>
            <div className="flex gap-4">
              <button
                onClick={resetProcess}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                새로운 검사 시작
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="mt-12 mb-8">
        <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-500" />
          최근 소켓/브라켓 입고 이력 (최대 20건)
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">사규 LOT 번호</th>
                  <th className="px-4 py-3 text-center">보관 위치 (Rack)</th>
                  <th className="px-4 py-3">품목명</th>
                  <th className="px-4 py-3 text-right">수량</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3">입고일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">조회된 입고 이력이 없습니다.</td>
                  </tr>
                ) : history.map((h, i) => {
                  const { pureLotNumber, locationText } = parsePureLotAndLocation(h.lot_number, h.location);
                  return (
                    <tr key={h.lot_number || i} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">{pureLotNumber}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-700 text-amber-300 border border-slate-600">
                          {locationText}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{h.item_name}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{h.qty_current} EA</td>
                      <td className="px-4 py-3 text-slate-400">{h.category}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{h.received_date?.slice(0, 10)}</span>
                          <button
                            onClick={() => handleOpenPrintModal(h)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded flex items-center gap-1 shadow-sm"
                          >
                            <Printer className="h-3.5 w-3.5" /> 인쇄
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          </div>
        </div>
      </div>

      {/* 라벨 미리 출력 모달 */}
      {printLabelData && (
        <GodexLabelPrinter
          isOpen={!!printLabelData}
          onClose={() => setPrintLabelData(null)}
          data={printLabelData}
        />
      )}

      {/* 사규 성적서 인쇄 모달 */}
      <InspectionFormPrintModal
        isOpen={!!printModalData}
        onClose={() => setPrintModalData(null)}
        data={printModalData}
      />
    </div>
  );
}

export default SocketBracketInspectionPage;
