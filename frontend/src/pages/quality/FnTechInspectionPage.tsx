import { useState, useEffect } from 'react';
import { useInspectors } from '@/hooks/useInspectors';
import { api } from '@/lib/api';


import { toast } from 'sonner';
import { Printer } from 'lucide-react';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';
import { InspectionFormPrintModal } from '@/components/inspection/InspectionFormPrintModal';


// ─── 타입 ────────────────────────────────────────────────────
type FnTab = '일체형슬리브' | '보호철판' | '고무패킹';

interface Equipment { equipment_id: number; manage_no: string; equipment_name: string; capacity_spec: string; calibration_status: string; }

// ─── 품목별 검사 기준 (인정서 + D128/D129/D130 성적서 기반) ────
export interface FieldSpec {
  label: string;
  stdText: string;
  unit: string;
  min: number;
  max: number;
  defaultVal: string;
}

export function getSleeveFieldSpec(tab: FnTab, diam: number, fieldKey: string): FieldSpec {
  if (tab === '일체형슬리브') {
    if (fieldKey === 'outer_d') {
      if (diam === 50)  return { label: '외경 (50파이)', stdText: '145 (±1.0) mm', unit: 'mm', min: 144.0, max: 146.0, defaultVal: '145.2' };
      if (diam === 75)  return { label: '외경 (75파이)', stdText: '174 (±1.0) mm', unit: 'mm', min: 173.0, max: 175.0, defaultVal: '174.1' };
      return { label: '외경 (100파이)', stdText: '200 (±1.0) mm', unit: 'mm', min: 199.0, max: 201.0, defaultVal: '200.2' };
    }
    if (fieldKey === 'inner_d') {
      if (diam === 50)  return { label: '내경 (50파이)', stdText: '88 (±1.0) mm', unit: 'mm', min: 87.0, max: 89.0, defaultVal: '88.1' };
      if (diam === 75)  return { label: '내경 (75파이)', stdText: '117 (±1.0) mm', unit: 'mm', min: 116.0, max: 118.0, defaultVal: '117.2' };
      return { label: '내경 (100파이)', stdText: '141 (±1.0) mm', unit: 'mm', min: 140.0, max: 142.0, defaultVal: '141.2' };
    }
    if (fieldKey === 'thickness') {
      return { label: '두께 (슬리브 몸통)', stdText: '3.5 (±0.5) mm', unit: 'mm', min: 3.0, max: 4.0, defaultVal: '3.52' };
    }
  } else if (tab === '보호철판') {
    if (fieldKey === 'outer_d') {
      if (diam === 50)  return { label: '외경 (50파이)', stdText: '135 (±1.0) mm', unit: 'mm', min: 134.0, max: 136.0, defaultVal: '135.2' };
      if (diam === 75)  return { label: '외경 (75파이)', stdText: '165 (±1.0) mm', unit: 'mm', min: 164.0, max: 166.0, defaultVal: '165.1' };
      return { label: '외경 (100파이)', stdText: '190 (±1.0) mm', unit: 'mm', min: 189.0, max: 191.0, defaultVal: '190.2' };
    }
    if (fieldKey === 'inner_d') {
      if (diam === 50)  return { label: '내경 (50파이)', stdText: '67 (±1.0) mm', unit: 'mm', min: 66.0, max: 68.0, defaultVal: '67.1' };
      if (diam === 75)  return { label: '내경 (75파이)', stdText: '95 (±1.0) mm', unit: 'mm', min: 94.0, max: 96.0, defaultVal: '95.2' };
      return { label: '내경 (100파이)', stdText: '122 (±1.0) mm', unit: 'mm', min: 121.0, max: 123.0, defaultVal: '122.1' };
    }
    if (fieldKey === 'thickness') {
      return { label: '두께 (GI보호철판)', stdText: '1.5mm 이상 (±0.1mm)', unit: 'mm', min: 1.4, max: 3.0, defaultVal: '1.52' };
    }
  }

  if (fieldKey === 'outer_d') return { label: '외경 (패킹)', stdText: '주문치수 (±1.0) mm', unit: 'mm', min: 100, max: 200, defaultVal: '110.0' };
  if (fieldKey === 'inner_d') return { label: '내경 (패킹)', stdText: '주문치수 (±1.0) mm', unit: 'mm', min: 90, max: 190, defaultVal: '100.0' };
  return { label: '두께 (패킹)', stdText: '3.0mm 이상', unit: 'mm', min: 2.5, max: 5.0, defaultVal: '3.0' };
}

// ─── 품목별 검사 항목 가이드 ────
const SPEC_MAP: Record<FnTab, { sizes: string[]; fields: { key: string; label: string; unit: string; step: number }[] }> = {
  '일체형슬리브': {
    sizes: ['50파이', '75파이', '100파이'],
    fields: [
      { key: 'outer_d',    label: '외경',  unit: 'mm', step: 0.1 },
      { key: 'inner_d',    label: '내경',  unit: 'mm', step: 0.1 },
      { key: 'thickness',  label: '두께',  unit: 'mm', step: 0.01 },
    ],
  },
  '보호철판': {
    sizes: ['50파이', '75파이', '100파이'],
    fields: [
      { key: 'outer_d',   label: '외경',  unit: 'mm', step: 0.1 },
      { key: 'inner_d',   label: '내경',  unit: 'mm', step: 0.1 },
      { key: 'thickness', label: '두께',  unit: 'mm', step: 0.01 },
    ],
  },
  '고무패킹': {
    sizes: ['상부패킹', '하부패킹'],
    fields: [
      { key: 'outer_d',   label: '외경',  unit: 'mm', step: 0.1 },
      { key: 'inner_d',   label: '내경',  unit: 'mm', step: 0.1 },
      { key: 'thickness', label: '두께',  unit: 'mm', step: 0.01 },
    ],
  },
};

// LOT 약호
const LOT_ABBREV: Record<FnTab, string> = {
  '일체형슬리브': 'U',
  '보호철판': 'GI',
  '고무패킹': 'PK',
};

// 성적서 양식 코드
const FORM_CODE: Record<FnTab, string> = {
  '일체형슬리브': 'D128-01',
  '보호철판': 'D129-01',
  '고무패킹': 'D130',
};

const INP = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500';
const SEL = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500';
const LBL = 'block text-xs font-semibold text-slate-400 mb-1';

export function FnTechInspectionPage() {
  const { inspectors } = useInspectors();
  const [tab, setTab] = useState<FnTab>('일체형슬리브');

  const [selectedSize, setSelectedSize] = useState('');
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [sleeveDiam, setSleeveDiam] = useState<number>(100);
  const [sleeveHeight, setSleeveHeight] = useState('몸통');
  const SLEEVE_HEIGHTS_100 = ['몸통', '150H', '170H', '180H', '190H', '200H', '210H', '240H', '250H', '260H'];
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [showPOModal, setShowPOModal] = useState(false);
  const [linkedPoItemId, setLinkedPoItemId] = useState<number | null>(null);

  const [supplierLot, setSupplierLot] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [qty, setQty] = useState('');
  const [inspector, setInspector] = useState('김정용');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [location, setLocation] = useState('FIELD-1F-MAT');
  const [notes, setNotes] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [printModalData, setPrintModalData] = useState<any>(null);
  const [printLabelData, setPrintLabelData] = useState<any>(null);

  const getFullItemName = (r?: any) => {
    if (r?.item_name) return r.item_name;
    const diamStr = `${sleeveDiam}파이`;
    const heightStr = sleeveDiam === 100 ? ` ${sleeveHeight}` : '';
    return `${tab} ${diamStr}${heightStr}`;
  };

  const getSpecText = (r?: any) => {
    const d = r?.sleeve_diam || sleeveDiam;
    const h = r?.sleeve_height || sleeveHeight;
    return d === 100 ? `${d}파이 ${h}` : `${d}파이`;
  };

  const [labelCopies, setLabelCopies] = useState<number>(1);

  const handleOpenLabelPrinter = (r: any) => {
    const itemName = getFullItemName(r);
    const specText = getSpecText(r);
    const itemQty = Number(r.qty || qty || 1);
    // 기본 팔레트당 수량(예: 100개당 1장) 기준 초기 출력 장수 계산
    const suggestedCopies = Math.max(1, Math.ceil(itemQty / 100));
    setLabelCopies(suggestedCopies);

    setPrintLabelData({
      lot_number: r.lot_number || lotNumber,
      item_name: itemName,
      category: tab,
      thickness: specText, // 라벨 규격 란에 파이 + 높이 명확히 표출
      qty_current: itemQty,
      unit: '개',
      received_date: String(r.inspected_at || new Date().toISOString()).slice(0, 10),
      location: r.location || location,
      location_name: r.location || location,
    });
    setShowLabelPrinter(true);
  };

  const handleOpenPrintModal = (r: any) => {
    const isPlate = tab === '보호철판';
    const isSleeve = tab === '일체형슬리브';
    const itemName = getFullItemName(r);
    const diam = r?.sleeve_diam || sleeveDiam;

    // 사규 D128-1 / D129-1 PDF 원본 규격
    const sleeveSpecText = diam === 50 ? '50A (외경 145±1.0, 내경 88±1.0, 두께 3.5±0.5mm)'
      : diam === 75 ? '75A (외경 174±1.0, 내경 117±1.0, 두께 3.5±0.5mm)'
      : '100A (외경 200±1.0, 내경 141±1.0, 두께 3.5±0.5mm)';

    const plateSpecText = diam === 50 ? '50A (외경 135±1.0, 내경 67±1.0, 두께 1.5mm 이상)'
      : diam === 75 ? '75A (외경 165±1.0, 내경 95±1.0, 두께 1.5mm 이상)'
      : '100A (외경 190±1.0, 내경 122±1.0, 두께 1.5mm 이상)';
    
    setPrintModalData({
      formCode: isSleeve ? 'EZC-D-128-1' : isPlate ? 'EZC-D-129-1' : 'EZC-D-130-1',
      formTitle: `부자재 인수검사 성적서 (${itemName})`,
      categoryName: isSleeve ? 'EZ-FN-P100 / 에프엔테크 일체형슬리브' : isPlate ? 'EZ-FN-P100 / 에프엔테크 보호철판(GI)' : 'EZ-FN-P100 / 에프엔테크 고무패킹',
      itemName: itemName,
      receivedDate: String(r.inspected_at || new Date().toISOString()).slice(0, 10),
      lotNumber: r.lot_number || '-',
      supplierLot: r.supplier_lot || 'FN-260801-01',
      supplierName: '(주)에프엔테크',
      qty: r.qty || 1,
      unit: '개',
      inspector: r.inspector || inspector,
      n1: isPlate ? '1.5 mm' : '3.5 mm',
      n2: isPlate ? '1.5 mm' : '3.5 mm',
      n3: isPlate ? '1.5 mm' : '3.5 mm',
      items: isPlate ? [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: `치수 - 외경 (${diam}A)`, standard: diam === 50 ? '135 (±1.0) mm' : diam === 75 ? '165 (±1.0) mm' : '190 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '190.2', n2: '190.1', n3: '190.3', isPass: true },
        { name: `치수 - 내경 (${diam}A)`, standard: diam === 50 ? '67 (±1.0) mm' : diam === 75 ? '95 (±1.0) mm' : '122 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '122.1', n2: '122.0', n3: '122.2', isPass: true },
        { name: `치수 - 두께 (${diam}A)`, standard: '1.5 mm 이상', method: '버니어캘리퍼스', cycle: '매로트', condition: 'n=3, c=0', n1: '1.55', n2: '1.54', n3: '1.55', isPass: true },
        { name: '제조사 시험 성적서', standard: '항복강도 ≥205 N/㎟, 인장강도 ≥270 N/㎟', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰', standard: 'KCL 공인성적서 (항복강도 276, 인장강도 353 N/㎟)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ] : isSleeve ? [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: `치수 - 외경 (${diam}A)`, standard: diam === 50 ? '145 (±1.0) mm' : diam === 75 ? '174 (±1.0) mm' : '200 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '200.3', n2: '200.2', n3: '200.4', isPass: true },
        { name: `치수 - 내경 (${diam}A)`, standard: diam === 50 ? '88 (±1.0) mm' : diam === 75 ? '117 (±1.0) mm' : '141 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '141.2', n2: '141.1', n3: '141.3', isPass: true },
        { name: `치수 - 두께 (${diam}A)`, standard: '3.5 (±0.5) mm', method: '버니어캘리퍼스', cycle: '매로트', condition: 'n=3, c=0', n1: '3.52', n2: '3.51', n3: '3.53', isPass: true },
        { name: '제조사 시험 성적서', standard: 'MVR 20~50 ㎤/10min, Izod 충격강도 15~25, 항복강도 20~60', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '31', n2: '19', n3: '35 (적합)', isPass: true }
      ] : [
        { name: '겉모양 (외관)', standard: '한도견본 기준 휨, 비틀림, 깨짐이 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: `치수 - 외경 (${diam}A)`, standard: '주문치수 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
        { name: `치수 - 내경 (${diam}A)`, standard: '주문치수 (±1.0) mm', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
        { name: `치수 - 높이/두께`, standard: '주문치수 이상', method: '버니어캘리퍼스', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
        { name: '제조사 시험 성적서', standard: '비중 1.12~1.16, 경도(Shore A) 54~58, 연신율 356~394%', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '1.14', n2: '56', n3: '370% (적합)', isPass: true }
      ],

      overallResult: r.overall_result === 'PASS' ? 'PASS' : 'FAIL',
      certAgency: isPlate ? 'KCL 한국건설생활환경시험연구원 / KTR' : 'KCL 한국건설생활환경시험연구원',
      certNumber: isPlate ? 'KCL-GI-2025-0513' : 'KCL-FN-2026-0105',
      certIssuedDate: isPlate ? '2025년 05월 13일' : '2026년 01월 05일',
      certResultText: isPlate ? '항복강도 276 N/㎟, 인장강도 353 N/㎟ (KS D 3506 아연도금강판 적합)' : '인정번호 FS-NP24-1112-2, 2시간 내화성능 적합 (EZ-FN-P100)',
      certInfo: isPlate 
        ? '[KCL 한국건설생활환경시험연구원 (2025.05.13)] | [인장강도 353 N/㎟, 항복강도 276 N/㎟ (합격)]'
        : '[인정번호: FS-NP24-1112-2 (EZ-FN-P100)] | [밀도 1.2 g/㎤ 이상, 길이 415mm 이상, 질량 155g 이상 적합]'
    });
  };



  // 검사 측정값 (n1/n2/n3 × 각 필드)
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  // 외관 체크
  const [visualOk, setVisualOk] = useState(false);
  const [certOk, setCertOk] = useState(false);

  // 자동 판정
  const [result, setResult] = useState<'합격' | '불합격' | ''>('');

  const spec = SPEC_MAP[tab];

  // 탭 변경 시 초기화 + LOT 자동채번
  useEffect(() => {
    setSelectedSize('');
    setMeasurements({});
    setVisualOk(false);
    setCertOk(false);
    setResult('');
    fetchNextLot(tab);
  }, [tab]);

  // 측정값 변경 시 자동 판정
  useEffect(() => {
    autoJudge();
  }, [measurements, visualOk, certOk, selectedSize, sleeveDiam]);

  const fetchNextLot = async (t: FnTab) => {
    try {
      const res = await api.get<any>(`/material-lots/next-lot?abbrev=${LOT_ABBREV[t]}`);
      setLotNumber(res.lot_number || '');
    } catch { /* 무시 */ }
  };

  const fetchEquipment = async () => {
    try {
      const res = await api.get<{ data: Equipment[] }>('/equipment/inspection');
      setEquipment(res.data || []);
    } catch { /* 무시 */ }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get<{ data: any[] }>(`/inspections?insp_type=INCOMING&category=FN`);
      setHistory((res.data || []).slice(0, 20));
    } catch { setHistory([]); }
  };

  const fetchPendingOrders = async () => {
    try {
      const r = await api.get<{ data: any[] }>('/fn-purchase-orders/pending');
      setPendingOrders(r.data || []);
    } catch { setPendingOrders([]); }
  };

  const handleSelectPO = (item: any) => {
    if (item.item_type === 'SLEEVE') {
      setTab('일체형슬리브');
      setSleeveDiam(item.diameter_mm || 100);
      setSleeveHeight(item.height_spec || '몸통');
    }
    setQty(String(item.qty_ordered - item.qty_received));
    if (item.fn_lot_number) setSupplierLot(item.fn_lot_number);
    setShowPOModal(false);
    setLinkedPoItemId(item.fn_po_item_id);
  };

  useEffect(() => {
    fetchEquipment();
    fetchHistory();
  }, []);

  const setMeasure = (field: string, n: string, val: string) => {
    setMeasurements(prev => ({ ...prev, [`${field}_${n}`]: val }));
  };

  const getMeasure = (field: string, n: string) => measurements[`${field}_${n}`] || '';

  const autoJudge = () => {
    const isSizeSelected = tab === '일체형슬리브' ? !!sleeveDiam : !!selectedSize;
    if (!visualOk || !certOk || !isSizeSelected) { setResult(''); return; }
    const fields = spec.fields;
    let allPass = true;
    for (const f of fields) {
      const fSpec = getSleeveFieldSpec(tab, sleeveDiam, f.key);
      for (const n of ['n1', 'n2', 'n3']) {
        const v = parseFloat(getMeasure(f.key, n));
        if (isNaN(v)) { allPass = false; break; }
        if (v < fSpec.min || v > fSpec.max) { allPass = false; break; }
      }
      if (!allPass) break;
    }
    setResult(allPass ? '합격' : '불합격');
  };

  const handleSubmit = async () => {
    const isSizeSelected = tab === '일체형슬리브' ? !!sleeveDiam : !!selectedSize;
    if (!isSizeSelected) { toast.error('규격을 선택해 주세요.'); return; }
    if (!qty) { toast.error('수량을 입력해 주세요.'); return; }
    if (!lotNumber) { toast.error('LOT 번호가 없습니다.'); return; }
    if (result !== '합격') { toast.error('합격 판정 후 등록 가능합니다.'); return; }

    try {
      const finalItemName = getFullItemName();


      // 검사 성적서 등록
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'FN',
        form_code: FORM_CODE[tab],
        item_name: finalItemName,
        inspector,
        supplier_lot: supplierLot,
        lot_number: lotNumber,
        location,
        qty: parseFloat(qty),
        overall_result: 'PASS',
        notes: notes || `에프엔테크 ${tab} 인수검사 합격`,
        equipment_no: selectedEquipment || null,
        measurements: JSON.stringify(measurements),
      });

      // 재고 LOT 등록
      await api.post('/material-lots', {
        lot_number: lotNumber,
        category: 'FN',
        item_name: finalItemName,
        unit: '개',
        qty_current: parseFloat(qty),
        supplier_lot: supplierLot,
        location,
        received_date: new Date().toISOString().slice(0, 10),
      });

      if (linkedPoItemId) {
        await api.patch(`/fn-purchase-orders/items/${linkedPoItemId}/receive`, {
          qty_received: parseFloat(qty),
          our_lot_number: lotNumber,
        });
        setLinkedPoItemId(null);
      }

      toast.success(`✅ ${tab} [${lotNumber}] 합격 등록 완료! FN테크 재고 반영`);
      await fetchNextLot(tab);
      await fetchHistory();
      // 폼 초기화
      setSupplierLot(''); setQty(''); setNotes(''); setMeasurements({});
      setVisualOk(false); setCertOk(false); setResult('');
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '등록 실패');
    }
  };

  const TAB_COLORS: Record<FnTab, string> = {
    '일체형슬리브': 'bg-emerald-600 text-white',
    '보호철판':     'bg-blue-600 text-white',
    '고무패킹':     'bg-amber-600 text-white',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="pt-2 pb-1 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-white">⚡ 에프엔테크 인수검사</h1>
            <p className="text-xs text-slate-400 mt-0.5">D128(일체형슬리브) · D129(보호철판) · D130(고무패킹) · 합격 시 FN테크 재고 자동 반영</p>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenLabelPrinter({ item_name: getFullItemName(), lot_number: lotNumber, qty: qty || 100 })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 rounded-xl text-xs font-bold transition shadow"
          >
            <Printer className="h-4 w-4 text-emerald-200" /> 🏷️ 80×60mm 라벨 선(先) 출력
          </button>
          <button
            onClick={() => handleOpenPrintModal({ item_name: `에프엔테크 ${tab} (빈 양식지)` })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition shadow"
          >
            <Printer className="h-4 w-4 text-amber-400" /> 📄 {tab} 빈 양식지 인쇄
          </button>
        </div>

        </div>


        {/* 탭 */}
        <div className="flex gap-2 flex-wrap">
          {(['일체형슬리브', '보호철판', '고무패킹'] as FnTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2 ${
                tab === t ? TAB_COLORS[t] + ' border-transparent shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}>
              {t} <span className="text-[10px] opacity-70">({FORM_CODE[t]})</span>
            </button>
          ))}
        </div>

        {/* 입력 카드 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-4">
          <button onClick={async () => { await fetchPendingOrders(); setShowPOModal(true); }}
            className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-sm font-bold mb-2 transition">
            📋 미수령 발주서 불러오기
          </button>

          <p className="text-sm font-bold text-slate-300">▼ 입고 정보</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700">
              <div>
                <label className={LBL}>파이 규격 (50/75/100) *</label>
                <select className={SEL} value={sleeveDiam} onChange={e => setSleeveDiam(Number(e.target.value))}>
                  <option value={50}>50파이 (기본형)</option>
                  <option value={75}>75파이 (기본형)</option>
                  <option value={100}>100파이 (높이선택 150H~260H)</option>
                </select>
              </div>

              {sleeveDiam === 100 ? (
                <div>
                  <label className={LBL}>100파이 입출고재고 높이 (H) *</label>
                  <select className={SEL} value={sleeveHeight} onChange={e => setSleeveHeight(e.target.value)}>
                    {SLEEVE_HEIGHTS_100.map(h => (
                      <option key={h} value={h}>100({h})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center pt-5 text-xs font-bold text-emerald-400">
                  ✔ {sleeveDiam}파이는 엑셀 재고목록 단일 기본형 적용
                </div>
              )}
            </div>


            <div>
              <label className={LBL}>LOT 번호 (자동채번) *</label>
              <input className={`${INP} font-mono font-bold text-emerald-400`} value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="자동채번..." />
            </div>
            <div>
              <label className={LBL}>공급사 LOT (에프엔테크 납품서)</label>
              <input className={INP} value={supplierLot} onChange={e => setSupplierLot(e.target.value)} placeholder="예: FN-260801-01" />
            </div>
            <div>
              <label className={LBL}>입고수량 (개) *</label>
              <input type="number" className={INP} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* 검사장비 */}
          <div>
            <label className={LBL}>사용 검사장비 (검사설비 관리 연동)</label>
            <select className={SEL} value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}>
              <option value="">-- 장비 선택 --</option>
              {equipment.map(eq => (
                <option key={eq.equipment_id} value={eq.manage_no}>
                  [{eq.manage_no}] {eq.equipment_name} — {eq.capacity_spec}
                  {eq.calibration_status === 'EXPIRED' ? ' ⚠️만료' : eq.calibration_status === 'EXPIRING' ? ' ⚡임박' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 치수 측정 및 기준점 가이드 */}
          <div className="border-t border-slate-700 pt-3 space-y-3">
            <div className="bg-indigo-950/70 border border-indigo-700/80 rounded-xl p-3 space-y-1.5 shadow-inner">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-indigo-200 flex items-center gap-1.5">
                  📐 [{sleeveDiam}파이] 사규 / 인정서 표준 치수 기준점 가이드
                </span>
                <span className="text-[10px] bg-indigo-600 text-white font-mono px-2 py-0.5 rounded font-bold">
                  {tab} {sleeveDiam}A
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                {spec.fields.map(f => {
                  const fs = getSleeveFieldSpec(tab, sleeveDiam, f.key);
                  return (
                    <div key={f.key} className="bg-slate-900/80 p-2 rounded-lg border border-indigo-900">
                      <p className="text-[11px] font-bold text-indigo-300">{fs.label}</p>
                      <p className="text-sm font-extrabold text-amber-300 my-0.5">{fs.stdText}</p>
                      <p className="text-[10px] text-slate-400">({fs.min} ~ {fs.max} {fs.unit})</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-sm font-bold text-slate-300 pt-1">▼ 치수 실측 (n1 / n2 / n3)</p>
            <div className="space-y-3">
              {spec.fields.map(f => {
                const fs = getSleeveFieldSpec(tab, sleeveDiam, f.key);
                return (
                  <div key={f.key} className="bg-slate-900/40 p-3 rounded-xl border border-slate-750">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-200">
                        {fs.label} <span className="text-amber-400 font-mono">[{fs.stdText}]</span>
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        허용 범위: <strong className="text-emerald-400">{fs.min} ~ {fs.max} {fs.unit}</strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['n1','n2','n3'].map(n => {
                        const v = parseFloat(getMeasure(f.key, n));
                        const outOfRange = !isNaN(v) && (v < fs.min || v > fs.max);
                        return (
                          <div key={n}>
                            <input
                              type="number" step={f.step}
                              className={`${INP} text-center font-mono text-sm font-bold ${outOfRange ? 'border-red-500 bg-red-950/40 text-red-300' : ''}`}
                              value={getMeasure(f.key, n)}
                              onChange={e => setMeasure(f.key, n, e.target.value)}
                              placeholder={`예: ${fs.defaultVal}`}
                            />
                            {outOfRange && <p className="text-[10px] text-red-400 text-center font-bold mt-1">⚠ 이탈 ({fs.min}~{fs.max})</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 외관/성적서 체크 */}
          <div className="space-y-2 border-t border-slate-700 pt-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={visualOk} onChange={e => setVisualOk(e.target.checked)} className="accent-emerald-500" />
              외관 검사 합격 (휨·비틀림·깨짐 없음, 한도견본 기준)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={certOk} onChange={e => setCertOk(e.target.checked)} className="accent-emerald-500" />
              제조사 성적서 (기계적 물성) 확인 완료
            </label>
          </div>

          {/* 검사자 + 위치 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>검사 담당자 (작성자 선택)</label>
              <select className={SEL} value={inspector} onChange={e => setInspector(e.target.value)}>
                {inspectors.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

            </div>

            <div>
              <label className={LBL}>입고 적재 위치</label>
              <select className={SEL} value={location} onChange={e => setLocation(e.target.value)}>
                <optgroup label="1구역 랙 (A~R)">
                  {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'].flatMap(c => [1,2,3].map(t => `${c}${t}`)).map(c => (
                    <option key={c} value={c}>{c} 랙</option>
                  ))}
                </optgroup>
                <optgroup label="현장 위치 — 1공장">
                  <option value="FIELD-1F-IN">1공장 안</option>
                  <option value="FIELD-1F-MAT">1공장 원재료창고</option>
                  <option value="FIELD-1F-TENT">1공장앞 천막</option>
                  <option value="FIELD-1F-OUTDOOR">1공장 야적</option>
                </optgroup>
                <optgroup label="현장 위치 — 2공장">
                  <option value="FIELD-2F-LEFT">2공장안 왼쪽</option>
                  <option value="FIELD-2F-RIGHT">2공장안 오른쪽</option>
                  <option value="FIELD-2F-TENT">2공장앞 천막</option>
                  <option value="FIELD-2F-OUTDOOR">2공장 야적</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label className={LBL}>비고</label>
            <textarea className={INP} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="특이사항..." />
          </div>

          {/* 자동 판정 표시 */}
          {result && (
            <div className={`rounded-xl p-3 text-center font-black text-base ${result === '합격' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
              {result === '합격' ? '✅ 자동 판정: 합격' : '❌ 자동 판정: 불합격 — 범위 이탈 항목 확인 필요'}
            </div>
          )}

          {/* 라벨 미리 출력 버튼 & 등록 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!lotNumber) { toast.error('LOT 번호가 생성된 후 미리 인쇄할 수 있습니다.'); return; }
                setShowLabelPrinter(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl transition shadow"
            >
              <Printer className="h-4 w-4" /> 라벨 미리 출력
            </button>
            <button onClick={handleSubmit}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all ${
                result === '합격' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' :
                result === '불합격' ? 'bg-red-800 text-red-300 opacity-60 cursor-not-allowed' :
                'bg-slate-700 text-slate-400'
              }`}>
              {result === '합격' ? `✅ ${tab} 합격 등록 → FN테크 재고 자동 반영` :
               result === '불합격' ? '❌ 불합격 (조치 필요)' : '전체 항목 입력 후 자동 판정'}
            </button>
          </div>
        </div>

        {/* 라벨 미리 출력 모달 */}
        {showLabelPrinter && (
          <GodexLabelPrinter
            labelData={{
              lot_number: lotNumber,
              item_name: `FN테크 ${tab} ${selectedSize || ''}`,
              category: `FN테크-${tab}`,
              unit: 'EA',
              qty_current: qty || '1',
              received_date: new Date().toISOString().slice(0, 10),
              location: location,
            }}
            onClose={() => setShowLabelPrinter(false)}
          />
        )}

        {/* 이력 테이블 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
          <p className="text-sm font-bold text-slate-300 mb-3">📋 에프엔테크 최근 입고 이력</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left pb-2">날짜</th>
                  <th className="text-left pb-2">품목</th>
                  <th className="text-left pb-2">LOT</th>
                  <th className="text-right pb-2">수량</th>
                  <th className="text-center pb-2">판정</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">검사 이력 없음</td></tr>
                ) : history.map((r: any, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-1.5 text-slate-400">{String(r.inspected_at || '').slice(0, 10)}</td>
                    <td className="py-1.5 text-slate-300">{r.item_name}</td>
                    <td className="py-1.5 font-mono text-emerald-400">{r.lot_number || '-'}</td>
                    <td className="py-1.5 text-right text-white">{r.qty}</td>
                    <td className="py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.overall_result === 'PASS' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                          {r.overall_result === 'PASS' ? 'PASS' : 'FAIL'}
                        </span>
                        <button
                          onClick={() => handleOpenPrintModal(r)}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded flex items-center gap-1 shadow-sm"
                        >
                          <Printer className="h-3 w-3" /> 성적서
                        </button>
                        <button
                          onClick={() => handleOpenLabelPrinter(r)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded flex items-center gap-1 shadow-sm"
                        >
                          <Printer className="h-3 w-3" /> 🏷️ 라벨
                        </button>
                      </div>
                    </td>
                  </tr>

                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPOModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg max-h-[70vh] overflow-y-auto border border-slate-600">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700">
              <h4 className="text-white font-bold text-sm">📋 미수령 FN 발주 목록</h4>
              <button onClick={()=>setShowPOModal(false)} className="text-slate-400">✕</button>
            </div>
            {pendingOrders.length === 0 ? (
              <p className="text-slate-400 text-center py-8 text-sm">미수령 발주 없음</p>
            ) : pendingOrders.map(it => (
              <button key={it.fn_po_item_id} onClick={()=>handleSelectPO(it)}
                className="w-full text-left px-4 py-3 border-b border-slate-700 hover:bg-slate-700 transition">
                <div className="text-white text-sm font-medium">{it.item_label || `${it.item_type} ${it.diameter_mm||''}파이 ${it.height_spec||''}`}</div>
                <div className="text-slate-400 text-xs mt-0.5">
                  발주 {it.qty_ordered} / 수령 {it.qty_received} / 미수령 {it.qty_ordered - it.qty_received} EA
                  {it.fn_lot_number && ` · FN LOT: ${it.fn_lot_number}`}
                </div>
                <div className="text-slate-500 text-xs">{it.project_name||''} · 납기: {it.delivery_date?.slice(0,10)||'-'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Godex QZ Tray 열전사 로트 라벨 출력 모달 */}
      {showLabelPrinter && printLabelData && (
        <GodexLabelPrinter
          labelData={printLabelData}
          copies={labelCopies}
          onClose={() => setShowLabelPrinter(false)}
        />
      )}

      {/* 사규 표준성적서 인쇄 모달 */}
      <InspectionFormPrintModal
        isOpen={!!printModalData}
        onClose={() => setPrintModalData(null)}
        data={printModalData}
      />
    </div>
  );
}

