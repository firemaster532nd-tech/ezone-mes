import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, ChevronRight, Save, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { useInspectors } from '@/hooks/useInspectors';

// ─── 검사 항목 정의 타입 ─────────────────────────────────────────────────────
export interface InspItem {
  id: string;
  name: string;
  type: 'visual' | 'measure' | 'doc'; // 겉모양육안 | 치수실측 | 서류확인
  unit?: string;
  minVal?: number;
  maxVal?: number;
  step?: number;
  standard: string;
  method: string;
  cycle: string;
  condition: string;
  autoDefault?: string; // 서류확인·공인성적서용 기본값
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tab: string;
  info: { formCode: string; abbrev: string; unit: string; minVal: number; maxVal: number; step: number; sizes: string[] };
  lotNumber: string;
  selectedSpec: string;
  supplierLot: string;
  qty: string;
  location: string;
  inspector: string;
  equipment: any[];
  inspectors: string[];
  onSaved: (data: any) => void; // 저장 완료 콜백 → 인쇄 모달 열기용
}

// ─── 탭별 검사 항목 정의 ────────────────────────────────────────────────────
// 원칙: 두께/너비/길이는 '이상(≥)' 기준 → minVal만 지정, maxVal 없음 (상한 없음)
//       밀도는 규격상 하한만 (이상) → maxVal 없음
//       실란트 비중(용량)만 범위(±허용오차) 적용
function buildItems(tab: string, spec: string): InspItem[] {
  const thickNum = spec.includes('25T') ? 25
    : spec.includes('38T') ? 38
    : spec.includes('50T') ? 50
    : spec.includes('75T') ? 75
    : spec.includes('100T') ? 100
    : 25;
  const widthNum  = parseInt(spec.match(/(\d+)W/)?.[1] || '0');
  const lengthNum = parseInt(spec.match(/(\d+)L/)?.[1] || '0');
  const densityNum = parseInt(spec.match(/^(\d+)K/)?.[1] || '96');

  if (tab === '세라믹울') return [
    { id: 'visual', name: '겉모양 (외관)', type: 'visual',
      standard: '색상 균일, 수지 부착 정상, 파손·이물질 없을 것',
      method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
    // 두께: 이상(≥) — 상한 없음
    { id: 'thick', name: `두께 (㎜)`, type: 'measure', unit: 'mm',
      minVal: thickNum, step: 0.01,
      standard: `${thickNum}mm 이상 (KSM 3803 기준)`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
    // 너비: 이상(≥) — 상한 없음
    ...(widthNum > 0 ? [{ id: 'width', name: '너비/폭 (㎜)', type: 'measure' as const, unit: 'mm',
      minVal: widthNum, step: 1,
      standard: `${widthNum}mm 이상`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }] : []),
    // 길이: 이상(≥) — 상한 없음
    ...(lengthNum > 0 ? [{ id: 'length', name: '길이 (㎜)', type: 'measure' as const, unit: 'mm',
      minVal: lengthNum, step: 1,
      standard: `${lengthNum}mm 이상`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }] : []),
    // 밀도: 이상(≥) — 상한 없음
    { id: 'density', name: `밀도 (kg/㎥)`, type: 'measure', unit: 'kg/㎥',
      minVal: densityNum, step: 0.1,
      standard: `${densityNum} kg/㎥ 이상 (KSM 3803)`,
      method: '계산식', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'mfr_doc', name: '제조사 시험성적서', type: 'doc',
      standard: `밀도 ${densityNum}kg/㎥↑, 숏 ≤25%, 가열선수축율 ≤3%`,
      method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', autoDefault: '확인완료' },
    { id: 'cert', name: '공인기관 의뢰(1회/년)', type: 'doc',
      standard: 'KTR 공인성적서 (숏 ≤7%, 가열선수축율 ≤1.2%)',
      method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', autoDefault: '연동완료' },
  ];

  if (tab === '그라스울-롤') return [
    { id: 'visual', name: '겉모양 (외관)', type: 'visual',
      standard: '오염, 찌그러짐, 찢김 없을 것',
      method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'thick', name: '두께 (㎜)', type: 'measure', unit: 'mm',
      minVal: thickNum, step: 0.1,
      standard: `${thickNum}mm 이상 (KSM 3808)`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
    ...(widthNum > 0 ? [{ id: 'width', name: '너비/폭 (㎜)', type: 'measure' as const, unit: 'mm',
      minVal: widthNum, step: 1,
      standard: `${widthNum}mm 이상`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }] : [
      { id: 'width', name: '너비/폭 (㎜)', type: 'measure' as const, unit: 'mm',
        minVal: 1000, step: 1, standard: '1,000mm 이상',
        method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }
    ]),
    ...(lengthNum > 0 ? [{ id: 'length', name: '길이 (㎜)', type: 'measure' as const, unit: 'mm',
      minVal: lengthNum, step: 1,
      standard: `${lengthNum}mm 이상`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }] : [
      { id: 'length', name: '길이 (㎜)', type: 'measure' as const, unit: 'mm',
        minVal: 1400, step: 1, standard: '1,400mm 이상',
        method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }
    ]),
    { id: 'density', name: `밀도 (kg/㎥)`, type: 'measure', unit: 'kg/㎥',
      minVal: densityNum, step: 0.1,
      standard: `${densityNum} kg/㎥ 이상 (KSM 3808)`,
      method: '계산식', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'mfr_doc', name: '제조사 시험성적서', type: 'doc',
      standard: '열전도율 ≤0.034 W/m·K, 불연성 난연1급',
      method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', autoDefault: '확인완료' },
    { id: 'cert', name: '공인기관 의뢰(1회/년)', type: 'doc',
      standard: 'KCL / KTR 공인성적서 (그라스울 KSM 3808 적합)',
      method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', autoDefault: '연동완료' },
  ];

  if (tab === '그라스울-보드') return [
    { id: 'visual', name: '겉모양 (외관)', type: 'visual',
      standard: '오염, 찌그러짐, 파손 없을 것',
      method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'thick', name: '두께 (㎜)', type: 'measure', unit: 'mm',
      minVal: thickNum, step: 0.1,
      standard: `${thickNum}mm 이상 (KSM 3809)`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
    ...(widthNum > 0 ? [{ id: 'width', name: '너비/폭 (㎜)', type: 'measure' as const, unit: 'mm',
      minVal: widthNum, step: 1,
      standard: `${widthNum}mm 이상`,
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }] : [
      { id: 'width', name: '너비/폭 (㎜)', type: 'measure' as const, unit: 'mm',
        minVal: 600, step: 1, standard: '600mm 이상',
        method: '줄자', cycle: '매로트', condition: 'n=3, c=0' }
    ]),
    { id: 'length', name: '길이 (㎜)', type: 'measure', unit: 'mm',
      minVal: 1200, step: 1,
      standard: '1,200mm 이상 (KSM 3809)',
      method: '줄자', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'density', name: `밀도 (kg/㎥)`, type: 'measure', unit: 'kg/㎥',
      minVal: densityNum, step: 0.1,
      standard: `${densityNum} kg/㎥ 이상 (KSM 3809)`,
      method: '계산식', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'mfr_doc', name: '제조사 시험성적서', type: 'doc',
      standard: '열전도율 ≤0.036 W/m·K, 불연성 난연1급',
      method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', autoDefault: '확인완료' },
    { id: 'cert', name: '공인기관 의뢰(1회/년)', type: 'doc',
      standard: 'KCL / KTR 공인성적서 (그라스울 보드 KSM 3809 적합)',
      method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', autoDefault: '연동완료' },
  ];

  // 실란트 — 비중/용량은 ±허용오차 범위(양방향)
  return [
    { id: 'visual', name: '겉모양 (외관)', type: 'visual',
      standard: '용기 파손, 겔화, 굳음 없을 것',
      method: '육안', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'density_s', name: '비중 (용량 mL)', type: 'measure', unit: 'mL',
      minVal: 290, maxVal: 310, step: 0.1,
      standard: '300mL ±10 (비중 1.35 ± 0.05)',
      method: '비중계', cycle: '매로트', condition: 'n=3, c=0' },
    { id: 'mfr_doc', name: '제조사 시험성적서', type: 'doc',
      standard: '불연성 난연1급, 비중 1.35 시험치 확인',
      method: '성적서확인', cycle: '1회/입고', condition: 'n=1, c=0', autoDefault: '확인완료' },
    { id: 'cert', name: '공인기관 의뢰(1회/년)', type: 'doc',
      standard: '불연 또는 난연 1급 공인성적서 적합',
      method: '공인성적서', cycle: '1회/년', condition: 'n=1, c=0', autoDefault: '연동완료' },
  ];
}

// ─── 항목 결과 상태 ───────────────────────────────────────────────────────────
interface ItemResult {
  visual?: 'pass' | 'fail' | '';  // 겉모양
  n1: string; n2: string; n3: string;
  docVal: string;                  // 서류확인값
  errors: string[];                // 경고/에러 메시지
}

export function InspectionExecutionModal({
  isOpen, onClose, tab, info, lotNumber, selectedSpec, supplierLot, qty, location,
  inspector: initInspector, equipment, inspectors, onSaved
}: Props) {
  const [inspector, setInspector] = useState(initInspector || '');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 항목 결과 맵
  const [results, setResults] = useState<Record<string, ItemResult>>({});

  const items = buildItems(tab, selectedSpec);

  // 초기화
  useEffect(() => {
    if (!isOpen) return;
    setInspector(initInspector || '');
    setNotes('');
    setSaving(false);
    const init: Record<string, ItemResult> = {};
    items.forEach(it => {
      init[it.id] = {
        visual: it.type === 'visual' ? '' : undefined,
        n1: it.autoDefault || '',
        n2: it.autoDefault || '',
        n3: it.autoDefault || '',
        docVal: it.autoDefault || '',
        errors: [],
      };
    });
    setResults(init);
  }, [isOpen, tab, selectedSpec]);

  if (!isOpen) return null;

  // ── 값 변경 및 실시간 검증 ──────────────────────────────────────────────
  // 검증 원칙: minVal만 있으면 '이상(≥)' 검사만 → 하한 미달 시 경고
  //            maxVal도 있으면 '범위' 검사 → 초과도 경고 (실란트 비중 등)
  const updateResult = (id: string, field: string, value: string) => {
    setResults(prev => {
      const item = items.find(it => it.id === id)!;
      const updated = { ...prev[id], [field]: value };
      const errors: string[] = [];

      if (item.type === 'measure' && item.minVal !== undefined) {
        const vals = [updated.n1, updated.n2, updated.n3].map(v => parseFloat(v)).filter(v => !isNaN(v));
        vals.forEach((v, i) => {
          // 하한 검사: 항상 수행 (이상 기준)
          if (v < item.minVal!) {
            const diff = (item.minVal! - v).toFixed(2);
            errors.push(`⚠️ n${i+1} = ${v}${item.unit} → 기준 ${item.minVal}${item.unit} 이상 미달! (${diff}${item.unit} 부족)`);
          }
          // 상한 검사: maxVal이 있을 때만 (실란트 비중 등 ±허용오차 항목)
          else if (item.maxVal !== undefined && v > item.maxVal) {
            const diff = (v - item.maxVal).toFixed(2);
            errors.push(`⚠️ n${i+1} = ${v}${item.unit} → 기준 최대값 ${item.maxVal}${item.unit} 초과! (+${diff}${item.unit})`);
          }
        });
        // 반복값 경고
        if (vals.length === 3 && vals[0] === vals[1] && vals[1] === vals[2]) {
          errors.push('ℹ️ n1=n2=n3 동일값 — 실제 3회 측정 여부를 확인하세요.');
        }
      }
      updated.errors = errors;
      return { ...prev, [id]: updated };
    });
  };


  // ── 전체 판정 ──────────────────────────────────────────────────────────
  const computeOverall = (): 'PASS' | 'FAIL' => {
    for (const it of items) {
      const r = results[it.id];
      if (!r) return 'FAIL';
      if (it.type === 'visual' && r.visual !== 'pass') return 'FAIL';
      if (it.type === 'measure') {
        if (r.errors.some(e => e.startsWith('⚠️'))) return 'FAIL';
        const vals = [r.n1, r.n2, r.n3].map(v => parseFloat(v));
        if (vals.some(isNaN)) return 'FAIL';
      }
    }
    return 'PASS';
  };

  // ── 완료 여부 체크 ──────────────────────────────────────────────────────
  const isComplete = () => {
    return items.every(it => {
      const r = results[it.id];
      if (!r) return false;
      if (it.type === 'visual') return r.visual !== '';
      if (it.type === 'measure') {
        return r.n1 !== '' && r.n2 !== '' && r.n3 !== '';
      }
      return true; // doc은 autoDefault 있음
    });
  };

  // ── 저장 ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isComplete()) { alert('모든 검사 항목을 입력해 주세요.'); return; }
    if (!inspector) { alert('검사 담당자를 선택해 주세요.'); return; }

    const overall = computeOverall();

    // 두께 실측값 대표 (thick 항목)
    const thickResult = results['thick'];
    const n1 = thickResult ? parseFloat(thickResult.n1) : 0;
    const n2 = thickResult ? parseFloat(thickResult.n2) : 0;
    const n3 = thickResult ? parseFloat(thickResult.n3) : 0;

    // 성적서 items 배열 생성
    const inspItems = items.map(it => {
      const r = results[it.id] || { n1: '', n2: '', n3: '', visual: '', docVal: '', errors: [] };
      return {
        name: it.name,
        standard: it.standard,
        method: it.method,
        cycle: it.cycle,
        condition: it.condition,
        n1: it.type === 'visual' ? (r.visual === 'pass' ? '양호' : '불량') :
            it.type === 'doc' ? r.docVal :
            r.n1,
        n2: it.type === 'visual' ? (r.visual === 'pass' ? '양호' : '불량') :
            it.type === 'doc' ? r.docVal :
            r.n2,
        n3: it.type === 'visual' ? (r.visual === 'pass' ? '양호' : '불량') :
            it.type === 'doc' ? r.docVal :
            r.n3,
        isPass: it.type === 'visual' ? r.visual === 'pass' :
                it.type === 'doc' ? true :
                r.errors.filter(e => e.startsWith('⚠️')).length === 0,
      };
    });

    setSaving(true);
    try {
      // 검사 성적서 저장
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
        n1, n2, n3,
        min_value: info.minVal,
        max_value: info.maxVal,
        overall_result: overall,
        notes,
        equipment_no: selectedEquipment || null,
      });

      // 합격 시 재고 등록
      if (overall === 'PASS') {
        await api.post('/material-lots', {
          lot_number: lotNumber,
          category: tab,
          item_name: tab,
          spec: selectedSpec,
          unit: info.unit,
          qty_current: parseFloat(qty),
          supplier_lot: supplierLot,
          location,
          received_date: new Date().toISOString().slice(0, 10),
          inspector,
        });
      }

      alert(`✅ ${tab} 인수검사 저장 완료!\n판정: ${overall === 'PASS' ? '✅ 합격 → 재고 자동 반영' : '❌ 불합격'}`);

      // 인쇄용 데이터 콜백
      onSaved({
        formCode: info.formCode,
        formTitle: `부자재 인수검사 성적서 (${tab})`,
        itemName: `${tab} ${selectedSpec}`,
        lotNumber,
        supplierLot,
        qty,
        unit: info.unit,
        inspector,
        location,
        n1, n2, n3,
        items: inspItems,
        overallResult: overall,
        receivedDate: new Date().toISOString().slice(0, 10),
        certInfo: '[KTR / KCL 공인성적서 100% 연동완료]',
      });

      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const overall = isComplete() ? computeOverall() : null;
  const hasAnyError = Object.values(results).some(r => r.errors.some(e => e.startsWith('⚠️')));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200">

        {/* 헤더 */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-mono font-bold rounded">{info.formCode}</span>
              <h2 className="text-white font-extrabold text-base">🔍 {tab} 인수검사 실행</h2>
            </div>
            <p className="text-slate-300 text-xs mt-0.5">{selectedSpec} · LOT: {lotNumber} · {qty}{info.unit}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 전체 판정 배너 */}
        {overall && (
          <div className={`px-6 py-2.5 flex items-center gap-3 text-sm font-bold border-b ${
            overall === 'PASS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {overall === 'PASS'
              ? <><CheckCircle className="h-5 w-5" /> 자동 판정: ✅ 합격 — 저장 시 재고 자동 반영됩니다</>
              : <><XCircle className="h-5 w-5" /> 자동 판정: ❌ 불합격 — 기준치 이탈 항목을 확인하세요</>
            }
          </div>
        )}

        {/* 검사 항목 */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {items.map((it, idx) => {
            const r = results[it.id] || { n1: '', n2: '', n3: '', visual: '', docVal: '', errors: [] };
            const hasError = r.errors.some(e => e.startsWith('⚠️'));
            const hasInfo = r.errors.some(e => e.startsWith('ℹ️'));
            const isDone = it.type === 'visual' ? r.visual !== '' :
                           it.type === 'doc' ? true :
                           r.n1 !== '' && r.n2 !== '' && r.n3 !== '';

            return (
              <div key={it.id}
                className={`rounded-xl border-2 p-4 transition-all ${
                  hasError ? 'border-red-400 bg-red-50' :
                  hasInfo ? 'border-amber-300 bg-amber-50' :
                  isDone ? 'border-emerald-300 bg-emerald-50' :
                  'border-slate-200 bg-white'
                }`}
              >
                {/* 항목 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      hasError ? 'bg-red-500 text-white' :
                      isDone ? 'bg-emerald-500 text-white' :
                      'bg-slate-300 text-slate-700'
                    }`}>{idx + 1}</span>
                    <span className="font-bold text-slate-900 text-sm">{it.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{it.method}</span>
                    <span className="text-xs text-slate-500">{it.cycle}</span>
                  </div>
                  {isDone && !hasError && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                  {hasError && <XCircle className="h-4 w-4 text-red-600" />}
                </div>

                {/* 기준치 */}
                <p className="text-[11px] text-slate-600 mb-2 font-mono bg-slate-100 px-2 py-1 rounded">
                  📏 기준: {it.standard}
                </p>

                {/* 입력 영역 */}
                {it.type === 'visual' && (
                  <div className="flex gap-3">
                    <label className="text-xs font-bold text-slate-600 self-center w-16">판정:</label>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => updateResult(it.id, 'visual', 'pass')}
                        className={`px-5 py-2 rounded-lg text-sm font-extrabold border-2 transition-all ${
                          r.visual === 'pass'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-105'
                            : 'bg-white border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700'
                        }`}
                      >
                        ✅ 양호 (PASS)
                      </button>
                      <button type="button"
                        onClick={() => updateResult(it.id, 'visual', 'fail')}
                        className={`px-5 py-2 rounded-lg text-sm font-extrabold border-2 transition-all ${
                          r.visual === 'fail'
                            ? 'bg-red-600 border-red-600 text-white shadow-md scale-105'
                            : 'bg-white border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-700'
                        }`}
                      >
                        ❌ 불량 (FAIL)
                      </button>
                    </div>
                  </div>
                )}

                {it.type === 'measure' && (
                  <div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'n1', val: r.n1 },
                        { key: 'n2', val: r.n2 },
                        { key: 'n3', val: r.n3 },
                      ].map(({ key, val }) => {
                        const num = parseFloat(val);
                        const outMin = !isNaN(num) && it.minVal !== undefined && num < it.minVal;
                        const outMax = !isNaN(num) && it.maxVal !== undefined && num > it.maxVal;
                        const out = outMin || outMax;
                        return (
                          <div key={key}>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1 text-center">
                              {key.toUpperCase()} 실측값 ({it.unit})
                            </label>
                            <input
                              type="number"
                              step={it.step}
                              value={val}
                              onChange={e => updateResult(it.id, key, e.target.value)}
                              placeholder={`${key} 입력`}
                              className={`w-full text-center font-mono font-bold text-sm px-2 py-2 rounded-lg border-2 focus:outline-none transition-all ${
                                out
                                  ? 'border-red-500 bg-red-100 text-red-800 focus:border-red-600'
                                  : !isNaN(num) && val !== ''
                                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900 focus:border-emerald-500'
                                  : 'border-slate-300 bg-white focus:border-blue-500'
                              }`}
                            />
                            {out && (
                              <p className="text-[10px] text-red-600 font-bold text-center mt-0.5">
                                {outMin
                                  ? `↓ ${it.minVal}${it.unit} 이상 미달 — FAIL 판정`
                                  : `↑ 최대 ${it.maxVal}${it.unit} 초과 — FAIL 판정`}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 기준 표시: maxVal 없으면 '이상', 있으면 '범위' */}
                    {it.minVal !== undefined && (
                      <p className="text-[10px] text-slate-500 mt-1.5 text-center font-mono">
                        {it.maxVal !== undefined
                          ? <>허용 범위: {it.minVal} ~ {it.maxVal} {it.unit} (±허용오차)</>
                          : <>기준: <span className="font-bold text-slate-700">{it.minVal}{it.unit} 이상 (≥)</span></>}
                        {r.n1 && r.n2 && r.n3 && !hasError && (
                          <span className="ml-2 text-emerald-700 font-bold">
                            평균: {((parseFloat(r.n1)+parseFloat(r.n2)+parseFloat(r.n3))/3).toFixed(2)}{it.unit} ✓
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {it.type === 'doc' && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-600 w-16">확인값:</label>
                    <select
                      value={r.docVal}
                      onChange={e => updateResult(it.id, 'docVal', e.target.value)}
                      className="border-2 border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="확인완료">✅ 확인완료</option>
                      <option value="연동완료">✅ 연동완료</option>
                      <option value="미확인">⚠️ 미확인</option>
                      <option value="해당없음">— 해당없음</option>
                    </select>
                  </div>
                )}

                {/* 에러/경고 메시지 */}
                {r.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.errors.map((err, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg ${
                        err.startsWith('⚠️') ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 검사 담당자 + 장비 + 비고 */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="font-bold text-slate-700 text-sm">📋 검사 메타 정보</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">검사 담당자 *</label>
                <select value={inspector} onChange={e => setInspector(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500 bg-white" required>
                  <option value="">— 선택 —</option>
                  {inspectors.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">사용 검사장비</label>
                <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white">
                  <option value="">— 장비 선택 —</option>
                  {equipment.map(eq => (
                    <option key={eq.equipment_id} value={eq.manage_no}>
                      [{eq.manage_no}] {eq.equipment_name}
                      {eq.calibration_status === 'EXPIRED' ? ' ⚠️만료' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">비고 (이상사항 기록)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="이상사항, 특이점 등 자유 기재"
                className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {hasAnyError && (
              <span className="flex items-center gap-1 text-red-600 font-bold">
                <AlertTriangle className="h-4 w-4" />
                기준치 이탈 항목 있음 — 저장은 가능하나 FAIL 판정됩니다
              </span>
            )}
            {!hasAnyError && isComplete() && overall === 'PASS' && (
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle className="h-4 w-4" />
                전체 기준치 충족 — 합격 저장 가능
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isComplete() || !inspector}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-extrabold shadow-md transition-all ${
                saving || !isComplete() || !inspector
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : overall === 'PASS'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {saving ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {overall === 'PASS' ? '✅ 합격 저장 & 인쇄' : overall === 'FAIL' ? '❌ 불합격 저장 & 인쇄' : '검사 완료 후 저장'}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InspectionExecutionModal;
