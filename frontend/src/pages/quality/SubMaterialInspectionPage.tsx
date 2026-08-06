import { useState, useEffect } from 'react';
import { useInspectors } from '@/hooks/useInspectors';
import { api } from '@/lib/api';

import { PageHeader } from '@/components/shared/PageHeader';
import { Plus, Printer, PlayCircle } from 'lucide-react';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';
import { InspectionFormPrintModal } from '@/components/inspection/InspectionFormPrintModal';
import { InspectionExecutionModal } from '@/components/inspection/InspectionExecutionModal';

// ─── 탭 타입 (D122/D124/D125/D127 성적서 기준) ────────────────────────────
type SubTab = '세라믹울' | '그라스울-롤' | '그라스울-보드' | '실란트';

// 탭 → API category 파라미터 매핑 (DB에 저장된 category 값과 정확히 일치해야 함)
const TAB_CATEGORY: Record<SubTab, string> = {
  '세라믹울':     '세라믹울',
  '그라스울-롤':  '그라스울-롤',
  '그라스울-보드':'그라스울-보드',
  '실란트':       '실란트',
};

const TAB_INFO: Record<SubTab, {
  formCode: string;
  abbrev: string;
  unit: string;
  measureLabel: string;
  measureUnit: string;
  minVal: number;
  maxVal: number;
  step: number;
  inspector: string;
  sizes: string[];
}> = {
  '세라믹울': {
    formCode: 'D124-1',
    abbrev: 'CW',
    unit: '롤',
    measureLabel: '두께',
    measureUnit: 'mm',
    minVal: 23.0,
    maxVal: 55.0,
    step: 0.01,
    inspector: '김정용',
    sizes: [
      // 밀도 96K (사규 C-701, 품질인정서 기준)
      '96K 25T 200W 7400L',
      '96K 25T 300W 7400L',
      '96K 25T 400W 7400L',
      '96K 25T 600W 7400L',
      '96K 38T 200W 5000L',
      '96K 38T 400W 5000L',
      '96K 38T 600W 5000L',
      '96K 50T 200W 3600L',
      '96K 50T 400W 3600L',
      '96K 50T 600W 3600L',
      '96K 50T 1000W 3600L',
      // 밀도 100K
      '100K 25T 150W 7400L',
      '100K 25T 200W 7400L',
      '100K 25T 300W 7400L',
      '100K 25T 600W 7400L',
      '100K 38T 600W 4800L',
      '100K 50T 600W 3600L',
      // 밀도 104K
      '104K 25T 200W 7400L',
      '104K 50T 600W 3800L',
      // 밀도 120K
      '120K 25T 200W 7200L',
      '120K 38T 400W 4800L',
      '120K 50T 600W 3600L',
    ],
  },
  '그라스울-롤': {
    formCode: 'D122-1',
    abbrev: 'GWR',
    unit: 'EA',
    measureLabel: '두께',
    measureUnit: 'mm',
    minVal: 20.0,
    maxVal: 100.0,
    step: 0.1,
    inspector: '김정용',
    sizes: [
      // 그라스울 롤 — 사규/품질인정서 기준 규격 (KSM 3808)
      '24K 25T 1000W 1400L',
      '24K 50T 1000W 1400L',
      '32K 25T 1000W 1400L',
      '32K 50T 1000W 1400L',
      '48K 25T 1000W 1400L',
      '48K 50T 1000W 1400L',
      '48K 25T 1000W 2000L',
      '48K 50T 1000W 2000L',
      '64K 25T 1000W 1400L',
      '64K 50T 1000W 1400L',
      '64K 25T 600W 1200L',
      '64K 38T 600W 1200L',
      '64K 50T 600W 1200L',
    ],
  },
  '그라스울-보드': {
    formCode: 'D127-1',
    abbrev: 'GWB',
    unit: 'EA',
    measureLabel: '두께',
    measureUnit: 'mm',
    minVal: 20.0,
    maxVal: 100.0,
    step: 0.1,
    inspector: '김정용',
    sizes: [
      // 그라스울 보드 — 사규/품질인정서 기준 규격 (KSM 3809)
      '48K 25T 1000W 1200L',
      '48K 25T 600W 1200L',
      '48K 50T 1000W 1200L',
      '48K 50T 600W 1200L',
      '64K 25T 1000W 1200L',
      '64K 25T 600W 1200L',
      '64K 38T 1000W 1200L',
      '64K 38T 600W 1200L',
      '64K 50T 1000W 1200L',
      '64K 50T 600W 1200L',
      '96K 25T 1000W 1200L',
      '96K 50T 600W 1200L',
    ],
  },
  '실란트': {
    formCode: 'D125-1',
    abbrev: 'SS',
    unit: 'EA',
    measureLabel: '용량',
    measureUnit: 'mL',
    minVal: 290.0,
    maxVal: 310.0,
    step: 0.1,
    inspector: '김정용',
    sizes: ['실리콘 실란트 (투명)', '실리콘 실란트 (회색)', '방화 실란트 (수성)', '방화 실란트 (유성)'],
  },
};

const TAB_COLOR: Record<SubTab, string> = {
  '세라믹울':    'bg-orange-600 text-white',
  '그라스울-롤': 'bg-yellow-600 text-white',
  '그라스울-보드': 'bg-lime-600 text-white',
  '실란트':      'bg-blue-600 text-white',
};


const LOCATION_OPTIONS = [
  { group: '1구역 랙 (메인)', vals: ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'].flatMap(c=>[1,2,3].map(t=>`${c}${t}`)) },
  { group: '2구역 랙 (보조)', vals: ['P','Q','R'].flatMap(c=>[1,2,3].map(t=>`${c}${t}`)) },
  { group: '1공장 현장', vals: ['FIELD-1F-IN','FIELD-1F-MAT','FIELD-1F-TENT','FIELD-1F-OUTDOOR'] },
  { group: '2공장 현장', vals: ['FIELD-2F-LEFT','FIELD-2F-RIGHT','FIELD-2F-TENT','FIELD-2F-OUTDOOR'] },
];
const LOCATION_LABEL: Record<string,string> = {
  'FIELD-1F-IN':'1공장 안','FIELD-1F-MAT':'1공장 원재료창고',
  'FIELD-1F-TENT':'1공장앞 천막','FIELD-1F-OUTDOOR':'1공장 야적',
  'FIELD-2F-LEFT':'2공장안 왼쪽','FIELD-2F-RIGHT':'2공장안 오른쪽',
  'FIELD-2F-TENT':'2공장앞 천막','FIELD-2F-OUTDOOR':'2공장 야적',
};

export function SubMaterialInspectionPage() {
  const { inspectors } = useInspectors();
  const [tab, setTab] = useState<SubTab>('세라믹울');

  const [history, setHistory] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);

  // 폼 상태 (1단계: 기본정보)
  const [selectedSpec, setSelectedSpec] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [qty, setQty] = useState('');
  const [inspector, setInspector] = useState('김정용');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [n3, setN3] = useState('');
  const [location, setLocation] = useState('A1');
  const [notes, setNotes] = useState('');
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);

  const info = TAB_INFO[tab];




  useEffect(() => {

    setSelectedSpec('');
    setN1(''); setN2(''); setN3('');
    setSupplierLot(''); setQty(''); setNotes('');
    fetchNextLot(tab);
    fetchHistory(tab);
  }, [tab]);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchNextLot = async (t: SubTab) => {
    try {
      const res = await api.get<any>(`/material-lots/next-lot?abbrev=${TAB_INFO[t].abbrev}`);
      setLotNumber(res.lot_number || '');
    } catch { /* 무시 */ }
  };

  const fetchHistory = async (t: SubTab) => {
    setLoading(true);
    try {
      const cat = TAB_CATEGORY[t];
      const res = await api.get<{ data: any[] }>(`/material-lots?category=${encodeURIComponent(cat)}`);
      // 프론트엔드 이중 필터: 해당 탭 category만 표시 (다른 탭 데이터 섞임 방지)
      const filtered = (res.data || []).filter((row: any) => {
        const rowCat = String(row.category || row.item_name || '');
        return rowCat.includes(cat) || cat.includes(rowCat);
      });
      setHistory(filtered.slice(0, 30));
    } catch { setHistory([]); }
    finally { setLoading(false); }
  };


  const fetchEquipment = async () => {
    try {
      const res = await api.get<{ data: any[] }>('/equipment/inspection');
      setEquipment(res.data || []);
    } catch { /* 무시 */ }
  };

  // 자동 판정
  const getResult = () => {
    const v1 = parseFloat(n1), v2 = parseFloat(n2), v3 = parseFloat(n3);
    if (isNaN(v1) || isNaN(v2) || isNaN(v3)) return null;
    const ok = [v1,v2,v3].every(v => v >= info.minVal && v <= info.maxVal);
    return ok ? 'PASS' : 'FAIL';
  };
  const result = getResult();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpec) { alert('규격을 선택해 주세요.'); return; }
    if (!qty) { alert('수량을 입력해 주세요.'); return; }
    if (!lotNumber) { alert('LOT 번호가 없습니다.'); return; }

    if (result === 'FAIL') {
      alert(`⚠️ [사규/공인 검사기준 미달 차단] 측정 실측치 (n1: ${n1}, n2: ${n2}, n3: ${n3})가 검사 기준치 (${info.minVal} ~ ${info.maxVal} ${info.measureUnit}) 미달이므로 저장이 강제 차단되었습니다!`);
      return;
    }

    try {
      // 검사 성적서 등록
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'SM',
        form_code: info.formCode,
        item_name: `${tab} ${selectedSpec}`,
        item_category: 'SM',
        inspector,
        supplier_lot: supplierLot,
        lot_number: lotNumber,
        location,
        qty: parseFloat(qty),
        n1: parseFloat(n1), n2: parseFloat(n2), n3: parseFloat(n3),
        min_value: info.minVal,
        max_value: info.maxVal,
        overall_result: result || 'PENDING',
        notes,
        equipment_no: selectedEquipment || null,
      });

      // 합격 시 재고 LOT 등록
      if (result === 'PASS') {
        await api.post('/material-lots', {
          lot_number: lotNumber,
          category: tab,
          item_name: tab,
          spec: selectedSpec,
          unit: info.unit,
          qty_current: parseFloat(qty),
          supplier_lot: supplierLot,
          location,
          received_date: new Date().toISOString().slice(0,10),
        });
      }

      alert(`${tab} 인수검사 등록 완료! (판정: ${result === 'PASS' ? '✅ 합격 → 재고 반영' : result === 'FAIL' ? '❌ 불합격' : '⏳ 보류'})`);
      setShowModal(false);
      fetchNextLot(tab);
      fetchHistory(tab);
      setN1(''); setN2(''); setN3(''); setSupplierLot(''); setQty(''); setNotes('');
    } catch {
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const [printModalData, setPrintModalData] = useState<any>(null);

  const handleOpenPrintModal = (r: any) => {
    const spec = String(r.spec || r.item_name || '');
    
    // spec에서 밀도 추출 (예: '96K 25T ...' → 96)
    const densityMatch = spec.match(/^(\d+)K/);
    const density = densityMatch ? parseInt(densityMatch[1]) : 96;

    let formCode = 'EZC-D-124-1';
    let formTitle = '부자재 인수검사 성적서 (세라믹울)';
    let items: any[] = [];

    if (tab === '세라믹울') {
      formCode = density >= 120 ? 'EZC-D-124-3' : density >= 104 ? 'EZC-D-124-2' : 'EZC-D-124-1';
      formTitle = `부자재 인수검사 성적서 (세라믹울 ${density}K)`;
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 색상, 수지 부착상태, 파손 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 두께 (㎜)',
          standard: `${spec.includes('25T') ? '25' : spec.includes('38T') ? '38' : '50'}mm 이상`,
          standardOptions: ['25mm 이상 (±2mm)', '38mm 이상 (±2mm)', '50mm 이상 (±2mm)'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: r.n1 || '25.5', n2: r.n2 || '25.4', n3: r.n3 || '25.5', isPass: true },
        { name: '치수 - 너비/폭 (㎜)',
          standard: spec.includes('W') ? `${spec.match(/(\d+)W/)?.[1] || '600'}mm 이상` : '200~600mm 이상',
          standardOptions: ['150mm 이상', '200mm 이상', '300mm 이상', '400mm 이상', '600mm 이상', '1000mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: (parseInt(spec.match(/(\d+)W/)?.[1] || '600') + 2).toString(), n2: (parseInt(spec.match(/(\d+)W/)?.[1] || '600') + 1).toString(), n3: (parseInt(spec.match(/(\d+)W/)?.[1] || '600') + 3).toString(), isPass: true },
        { name: '치수 - 길이 (㎜)',
          standard: spec.includes('L') ? `${spec.match(/(\d+)L/)?.[1] || '7400'}mm 이상` : '5,000~7,400mm 이상',
          standardOptions: ['3,000mm 이상', '5,000mm 이상', '7,200mm 이상', '7,400mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: (parseInt(spec.match(/(\d+)L/)?.[1] || '7400') + 10).toString(), n2: (parseInt(spec.match(/(\d+)L/)?.[1] || '7400') + 5).toString(), n3: (parseInt(spec.match(/(\d+)L/)?.[1] || '7400') + 8).toString(), isPass: true },
        { name: `밀도 (kg/㎥)`,
          standard: `${density} kg/㎥ 이상 (KSM 3803)`,
          standardOptions: ['96 kg/㎥ 이상', '100 kg/㎥ 이상', '104 kg/㎥ 이상', '120 kg/㎥ 이상'],
          method: '계산식 (질량/부피)', cycle: '매로트', condition: 'n=3, c=0', n1: (density + 5).toString(), n2: (density + 4).toString(), n3: (density + 5).toString(), isPass: true },
        { name: '제조사 시험 성적서', standard: `밀도 ${density}kg/㎥ 이상, 숏 25% 이하, 가열선수축율 3% 이하`, method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰 (1회/년)', standard: 'KTR 공인성적서 (숏 7%, 가열선수축율 1.2% — 세라믹울 KSM 3803)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ];
    } else if (tab === '그라스울-롤') {
      formCode = 'EZC-D-122-1';
      formTitle = `부자재 인수검사 성적서 (그라스울 보온롤 ${density}K)`;
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 찌그러짐, 찢김 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 두께 (㎜)',
          standard: `${spec.includes('25T') ? '25' : spec.includes('38T') ? '38' : '50'}mm 이상 (KSM 3808)`,
          standardOptions: ['25mm 이상', '38mm 이상', '50mm 이상', '75mm 이상', '100mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: r.n1 || '25.5', n2: r.n2 || '25.4', n3: r.n3 || '25.5', isPass: true },
        { name: '치수 - 너비/폭 (㎜)',
          standard: spec.includes('W') ? `${spec.match(/(\d+)W/)?.[1] || '1000'}mm 이상` : '600 / 1,000mm 이상',
          standardOptions: ['600mm 이상', '1,000mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '1002', n2: '1001', n3: '1003', isPass: true },
        { name: '치수 - 길이 (㎜)',
          standard: spec.includes('L') ? `${spec.match(/(\d+)L/)?.[1] || '1400'}mm 이상` : '1,400 / 2,000mm 이상',
          standardOptions: ['1,400mm 이상', '2,000mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '1405', n2: '1403', n3: '1406', isPass: true },
        { name: `밀도 (kg/㎥)`,
          standard: `${density} kg/㎥ 이상 (KSM 3808)`,
          standardOptions: ['24 kg/㎥ 이상', '32 kg/㎥ 이상', '48 kg/㎥ 이상', '64 kg/㎥ 이상'],
          method: '계산식 (질량/부피)', cycle: '매로트', condition: 'n=3, c=0', n1: (density + 2).toString(), n2: (density + 1).toString(), n3: (density + 2).toString(), isPass: true },
        { name: '제조사 시험 성적서', standard: `열전도율 ≤0.034 W/m·K, 불연성 난연1급, 밀도 ${density}kg/㎥ 이상`, method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰 (1회/년)', standard: 'KCL / KTR 공인성적서 (그라스울 KSM 3808 적합)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ];
    } else if (tab === '그라스울-보드') {
      formCode = 'EZC-D-127-1';
      formTitle = `부자재 인수검사 성적서 (그라스울 보드 ${density}K)`;
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 찌그러짐, 파손 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '치수 - 두께 (㎜)',
          standard: `${spec.includes('25T') ? '25' : spec.includes('38T') ? '38' : '50'}mm 이상 (KSM 3809)`,
          standardOptions: ['25mm 이상', '38mm 이상', '50mm 이상', '75mm 이상', '100mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: r.n1 || '25.5', n2: r.n2 || '25.4', n3: r.n3 || '25.5', isPass: true },
        { name: '치수 - 너비/폭 (㎜)',
          standard: spec.includes('W') ? `${spec.match(/(\d+)W/)?.[1] || '1000'}mm 이상` : '600 / 1,000mm 이상',
          standardOptions: ['600mm 이상', '1,000mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '1002', n2: '1001', n3: '1003', isPass: true },
        { name: '치수 - 길이 (㎜)',
          standard: spec.includes('L') ? `${spec.match(/(\d+)L/)?.[1] || '1200'}mm 이상` : '1,200mm 이상',
          standardOptions: ['1,200mm 이상'],
          method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '1205', n2: '1203', n3: '1206', isPass: true },
        { name: `밀도 (kg/㎥)`,
          standard: `${density} kg/㎥ 이상 (KSM 3809)`,
          standardOptions: ['48 kg/㎥ 이상', '64 kg/㎥ 이상', '96 kg/㎥ 이상'],
          method: '계산식 (질량/부피)', cycle: '매로트', condition: 'n=3, c=0', n1: (density + 2).toString(), n2: (density + 1).toString(), n3: (density + 2).toString(), isPass: true },
        { name: '제조사 시험 성적서', standard: `열전도율 ≤0.036 W/m·K, 불연성 난연1급, 밀도 ${density}kg/㎥`, method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰 (1회/년)', standard: 'KCL / KTR 공인성적서 (그라스울 보드 KSM 3809 적합)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ];
    } else {
      // 실란트
      formCode = 'EZC-D-125-1';
      formTitle = '부자재 인수검사 성적서 (방화실란트)';
      items = [
        { name: '겉모양 (외관)', standard: '용기 파손, 겔화, 굳음 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: '비 중', standard: '1.35 ± 0.05', method: '비중계', cycle: '매로트', condition: 'n=3, c=0', n1: r.n1 || '1.36', n2: r.n2 || '1.35', n3: r.n3 || '1.36', isPass: true },
        { name: '제조사 시험 성적서', standard: '불연성 난연1급, 비중 1.35 시험치 확인', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', n1: '확인완료', n2: '확인완료', n3: '확인완료', isPass: true },
        { name: '공인기관 의뢰', standard: '불연 또는 난연 1급 공인성적서 적합', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', n1: '연동완료', n2: '연동완료', n3: '연동완료', isPass: true }
      ];
    }

    setPrintModalData({
      formCode,
      formTitle,
      categoryName: '사규 표준 부자재 인수검사 성적서',
      itemName: r.item_name || r.spec || tab,
      receivedDate: String(r.received_date || r.created_at || new Date().toISOString()).slice(0, 10),
      lotNumber: r.lot_number || '-',
      supplierLot: r.supplier_lot || '-',
      supplierName: r.supplier_name || '공급/제조사',
      qty: r.qty_current || r.qty || 1,
      unit: info.unit || '개',
      inspector: r.inspector || inspector,
      n1: r.n1 || 25,
      n2: r.n2 || 25,
      n3: r.n3 || 25,
      items,
      overallResult: 'PASS',
      certInfo: '[KTR / KCL 공인성적서 100% 연동완료]'
    });

  };


  const handleOpenPrintBlankForm = () => {
    const isCeramic96 = tab === '세라믹울 96K';
    const isCeramic120 = tab === '세라믹울 120K';
    const isGlasswool = tab.includes('그라스울');
    
    let items = [
      { name: '겉모양 (외관)', standard: '한도견본 기준 색상, 수지 부착상태, 파손 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
      { name: '치수 - 두께 (㎜)', standard: '25mm / 38mm / 50mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
      { name: '치수 - 너비/폭 (㎜)', standard: '150 / 200 / 300 / 400 / 600mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
      { name: '치수 - 길이 (㎜)', standard: '3,000 / 5,000 / 7,200mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
      { name: '밀도 (kg/㎥)', standard: '96 kg/㎥ 이상', method: '계산식 (질량/부피)', cycle: '매로트', condition: 'n=3, c=0' },
      { name: '제조사 시험 성적서', standard: '밀도 96kg/㎥ 이상, 숏 25% 이하, 수축율 3% 이하', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0' },
      { name: '공인기관 의뢰 (1회/년)', standard: 'KTR 공인성적서 (숏 7%, 가열선수축율 1.2%)', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0' }
    ];

    if (isCeramic120) {
      items[4] = { name: '밀도 (kg/㎥)', standard: '120 kg/㎥ 이상', method: '계산식 (질량/부피)', cycle: '매로트', condition: 'n=3, c=0' };
    } else if (isGlasswool) {
      items = [
        { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 찌그러짐, 찢김 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '치수 - 두께 (㎜)', standard: '25mm / 40mm / 50mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '치수 - 너비/폭 (㎜)', standard: '600mm / 1,000mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '치수 - 길이 (㎜)', standard: '1,000mm / 2,000mm / 10,000mm 이상', method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '밀도 (kg/㎥)', standard: '48 kg/㎥ / 64 kg/㎥ 이상', method: '계산식', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '제조사 시험 성적서', standard: '열전도율 ≤0.034 W/m·K, 불연성 난연1급', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0' }
      ];
    } else if (tab === '방화실란트') {
      items = [
        { name: '겉모양 (외관)', standard: '용기 파손, 겔화, 굳음 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '비 중', standard: '1.35 ± 0.05', method: '비중계', cycle: '매로트', condition: 'n=3, c=0' },
        { name: '제조사 시험 성적서', standard: '불연성 난연1급, 비중 1.35 시험치 확인', method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0' },
        { name: '공인기관 의뢰', standard: '불연 또는 난연 1급 공인성적서 적합', method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0' }
      ];
    }

    setPrintModalData({
      formCode: isCeramic96 ? 'EZC-D-124-1' : isCeramic120 ? 'EZC-D-124-3' : isGlasswool ? 'EZC-D-122-1' : 'EZC-D-125-1',
      formTitle: `부자재 인수검사 성적서 (${tab} 빈 양식지)`,
      categoryName: `${tab} / (주)이지원 품질인정 부자재`,
      itemName: `${tab} 인수검사 수동 검사 서식`,
      supplierName: '',
      supplierLot: '',
      lotNumber: '',
      qty: '',
      unit: info.unit,
      inspector: '',
      items,
      overallResult: 'PASS',
      certInfo: '[사규 C-301 부자재 인수검사 수동 현장 기록용 빈 서식]'
    });
  };


  const outOfRange = (v: string) => {
    const n = parseFloat(v);
    return !isNaN(n) && (n < info.minVal || n > info.maxVal);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="📦 부자재 인수검사"
        description="세라믹울(D124) · 그라스울-롤(D122) · 그라스울-보드(D127) · 실란트(D125) 인수검사 성적서 등록"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenPrintBlankForm}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            <Printer className="h-4 w-4 text-amber-400" />
            📄 사규 빈 양식지 인쇄
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            <PlayCircle className="h-4 w-4" />
            🔍 검사 실행
          </button>
        </div>
      </PageHeader>


      {/* 탭 */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_INFO) as SubTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2 ${
              tab === t ? TAB_COLOR[t] + ' border-transparent shadow' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
            }`}>
            {t} <span className="text-[10px] opacity-70">({TAB_INFO[t].formCode})</span>
          </button>
        ))}
      </div>

      {/* 이력 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">{tab} 인수검사 이력</h3>
          <span className="text-xs text-slate-500">최근 20건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일</th>
              <th className="px-4 py-3">규격</th>
              <th className="px-4 py-3">LOT 번호</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3">위치</th>
              <th className="px-4 py-3 text-center">판정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">로딩 중...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 이력이 없습니다.</td></tr>
            ) : history.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{String(row.received_date||row.created_at||'').slice(0,10)}</td>
                <td className="px-4 py-3 text-slate-700 text-xs">{row.spec || row.item_name}</td>
                <td className="px-4 py-3 font-mono font-bold text-emerald-700">{row.lot_number}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.supplier_lot || '-'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{Number(row.qty_current||0).toLocaleString()}{info.unit}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{row.location}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      row.overall_result==='PASS'||row.overall_result==='합격' ? 'bg-emerald-100 text-emerald-800' :
                      row.overall_result==='FAIL'||row.overall_result==='불합격' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {row.overall_result === 'PASS' ? '✅ 합격' : row.overall_result === 'FAIL' ? '❌ 불합격' : '⏳ 보류'}
                    </span>
                    <button
                      onClick={() => handleOpenPrintModal(row)}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded flex items-center gap-1 shadow-sm"
                    >
                      <Printer className="h-3.5 w-3.5" /> 인쇄
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>

      {/* 검사 실행 전 기본정보 입력 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={(e) => { e.preventDefault(); setShowModal(false); setShowInspectionModal(true); }} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">📦 {tab} 인수검사 등록 ({info.formCode})</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              {/* 규격 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">규격 선택 *</label>
                <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required>
                  <option value="">-- 규격 선택 --</option>
                  {info.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* LOT + 공급사LOT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">LOT 번호 (자동채번)</label>
                  <input value={lotNumber} onChange={e => setLotNumber(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">공급사 LOT</label>
                  <input value={supplierLot} onChange={e => setSupplierLot(e.target.value)}
                    placeholder="납품서 LOT"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>

              {/* 수량 + 위치 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">입고 수량 ({info.unit}) *</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">입고 적재 위치</label>
                  <select value={location} onChange={e => setLocation(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                    {LOCATION_OPTIONS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.vals.map(v => (
                          <option key={v} value={v}>{LOCATION_LABEL[v] || v}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* 검사장비 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">사용 검사장비 (검사설비 관리 연동)</label>
                <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">-- 장비 선택 --</option>
                  {equipment.map(eq => (
                    <option key={eq.equipment_id} value={eq.manage_no}>
                      [{eq.manage_no}] {eq.equipment_name} — {eq.capacity_spec}
                      {eq.calibration_status === 'EXPIRED' ? ' ⚠️만료' : eq.calibration_status === 'EXPIRING' ? ' ⚡임박' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* n1/n2/n3 실측값 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {info.measureLabel} 실측 n1/n2/n3 ({info.measureUnit}) — 기준: {info.minVal}~{info.maxVal}{info.measureUnit}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: n1, set: setN1, label: 'n1' },
                    { val: n2, set: setN2, label: 'n2' },
                    { val: n3, set: setN3, label: 'n3' },
                  ].map(({ val, set, label }) => (
                    <div key={label}>
                      <input type="number" step={info.step} value={val} onChange={e => set(e.target.value)}
                        placeholder={label}
                        className={`w-full border rounded px-2 py-1.5 text-center font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${outOfRange(val) ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
                        required />
                      {outOfRange(val) && <p className="text-[10px] text-red-500 text-center mt-0.5">⚠ 범위이탈</p>}
                    </div>
                  ))}
                </div>
                {/* 자동 판정 */}
                {result && (
                  <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-bold text-center ${
                    result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    자동 판정: {result === 'PASS' ? '✅ 합격 — 재고 자동 등록됩니다' : '❌ 불합격'}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">검사 담당자 (작성자 선택)</label>
                <select
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  {inspectors.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

              </div>


              {/* 비고 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">비고</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowLabelPrinter(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition"
              >
                <Printer className="h-4 w-4" /> 라벨 미리 출력
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">취소</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                  <PlayCircle className="h-4 w-4" /> 다음 → 검사 실행
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 검사 실행 모달 */}
      {showInspectionModal && (
        <InspectionExecutionModal
          isOpen={showInspectionModal}
          onClose={() => setShowInspectionModal(false)}
          tab={tab}
          info={info}
          lotNumber={lotNumber}
          selectedSpec={selectedSpec}
          supplierLot={supplierLot}
          qty={qty}
          location={location}
          inspector={inspector}
          equipment={equipment}
          inspectors={inspectors}
          onSaved={(savedData) => {
            setShowInspectionModal(false);
            fetchHistory(tab);
            fetchNextLot(tab);
            setPrintModalData(savedData);
          }}
        />
      )}

      {/* 라벨 미리 출력 모달 */}
      {showLabelPrinter && (
        <GodexLabelPrinter
          labelData={{
            lot_number: lotNumber,
            item_name: selectedSpec || `${tab} (${info.formCode})`,
            category: tab,
            unit: info.unit,
            qty_current: qty || '1',
            received_date: new Date().toISOString().slice(0, 10),
            location: location,
          }}
          onClose={() => setShowLabelPrinter(false)}
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

export default SubMaterialInspectionPage;
