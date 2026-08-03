import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── 타입 ────────────────────────────────────────────────────
type FnTab = '일체형슬리브' | '보호철판' | '고무패킹';

interface Equipment { equipment_id: number; manage_no: string; equipment_name: string; capacity_spec: string; calibration_status: string; }

// ─── 품목별 검사 기준 (인정서 + D128/D129/D130 성적서 기반) ────
const SPEC_MAP: Record<FnTab, { sizes: string[]; fields: { key: string; label: string; unit: string; min: number; max: number; step: number }[] }> = {
  '일체형슬리브': {
    sizes: ['50파이', '75파이', '100파이'],
    fields: [
      { key: 'outer_d',    label: '외경',  unit: 'mm', min: 50,   max: 200,  step: 0.1 },
      { key: 'inner_d',    label: '내경',  unit: 'mm', min: 40,   max: 195,  step: 0.1 },
      { key: 'thickness',  label: '두께',  unit: 'mm', min: 3.0,  max: 5.0,  step: 0.01 },
    ],
  },
  '보호철판': {
    sizes: ['50파이', '75파이', '100파이'],
    fields: [
      { key: 'outer_d',   label: '외경',  unit: 'mm', min: 100,  max: 230,  step: 0.1 },
      { key: 'inner_d',   label: '내경',  unit: 'mm', min: 90,   max: 225,  step: 0.1 },
      { key: 'thickness', label: '두께',  unit: 'mm', min: 1.5,  max: 3.0,  step: 0.01 },
    ],
  },
  '고무패킹': {
    sizes: ['상부패킹', '하부패킹'],
    fields: [
      { key: 'outer_d',   label: '외경',  unit: 'mm', min: 100,  max: 130,  step: 0.1 },
      { key: 'inner_d',   label: '내경',  unit: 'mm', min: 100,  max: 125,  step: 0.1 },
      { key: 'thickness', label: '두께',  unit: 'mm', min: 2.0,  max: 4.0,  step: 0.01 },
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
  const [tab, setTab] = useState<FnTab>('일체형슬리브');
  const [selectedSize, setSelectedSize] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [qty, setQty] = useState('');
  const [inspector, setInspector] = useState('김정용');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [location, setLocation] = useState('FIELD-1F-SUB-MAT');
  const [notes, setNotes] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [history, setHistory] = useState<any[]>([]);

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
  }, [measurements, visualOk, certOk, selectedSize]);

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

  useEffect(() => {
    fetchEquipment();
    fetchHistory();
  }, []);

  const setMeasure = (field: string, n: string, val: string) => {
    setMeasurements(prev => ({ ...prev, [`${field}_${n}`]: val }));
  };

  const getMeasure = (field: string, n: string) => measurements[`${field}_${n}`] || '';

  const autoJudge = () => {
    if (!visualOk || !certOk || !selectedSize) { setResult(''); return; }
    const fields = spec.fields;
    let allPass = true;
    for (const f of fields) {
      for (const n of ['n1', 'n2', 'n3']) {
        const v = parseFloat(getMeasure(f.key, n));
        if (isNaN(v)) { allPass = false; break; }
        if (v < f.min || v > f.max) { allPass = false; break; }
      }
      if (!allPass) break;
    }
    setResult(allPass ? '합격' : '불합격');
  };

  const handleSubmit = async () => {
    if (!selectedSize) { toast.error('규격을 선택해 주세요.'); return; }
    if (!qty) { toast.error('수량을 입력해 주세요.'); return; }
    if (!lotNumber) { toast.error('LOT 번호가 없습니다.'); return; }
    if (result !== '합격') { toast.error('합격 판정 후 등록 가능합니다.'); return; }

    try {
      // 검사 성적서 등록
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'FN',
        form_code: FORM_CODE[tab],
        item_name: `${tab} ${selectedSize}`,
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
        item_name: `${tab} ${selectedSize}`,
        unit: '개',
        qty_current: parseFloat(qty),
        supplier_lot: supplierLot,
        location,
        received_date: new Date().toISOString().slice(0, 10),
      });

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
        <div className="pt-2 pb-1">
          <h1 className="text-xl font-black text-white">⚡ 에프엔테크 인수검사</h1>
          <p className="text-xs text-slate-400 mt-0.5">D128(일체형슬리브) · D129(보호철판) · D130(고무패킹) · 합격 시 FN테크 재고 자동 반영</p>
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
          <p className="text-sm font-bold text-slate-300">▼ 입고 정보</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>규격 *</label>
              <select className={SEL} value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
                <option value="">선택</option>
                {spec.sizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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

          {/* 치수 측정 */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-sm font-bold text-slate-300 mb-3">▼ 치수 실측 (n1 / n2 / n3)</p>
            <div className="space-y-3">
              {spec.fields.map(f => (
                <div key={f.key}>
                  <p className="text-xs text-slate-400 mb-1.5">
                    {f.label} ({f.unit}) — 기준: {f.min}~{f.max}{f.unit}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {['n1','n2','n3'].map(n => {
                      const v = parseFloat(getMeasure(f.key, n));
                      const outOfRange = !isNaN(v) && (v < f.min || v > f.max);
                      return (
                        <div key={n}>
                          <input
                            type="number" step={f.step}
                            className={`${INP} text-center ${outOfRange ? 'border-red-500 text-red-400' : ''}`}
                            value={getMeasure(f.key, n)}
                            onChange={e => setMeasure(f.key, n, e.target.value)}
                            placeholder={n}
                          />
                          {outOfRange && <p className="text-[10px] text-red-400 text-center mt-0.5">⚠ 범위이탈</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
              <label className={LBL}>검사자</label>
              <input className={INP} value={inspector} onChange={e => setInspector(e.target.value)} />
            </div>
            <div>
              <label className={LBL}>입고 적재 위치</label>
              <select className={SEL} value={location} onChange={e => setLocation(e.target.value)}>
                <optgroup label="1공장">
                  <option value="FIELD-1F-MAIN">1공장 메인</option>
                  <option value="FIELD-1F-MAT">1공장 창고</option>
                  <option value="FIELD-1F-SUB-MAT">1공장 부자재실</option>
                  <option value="FIELD-1F-TENT">1공장 천막안</option>
                  <option value="FIELD-1F-RACK-FRONT">1공장 렉앞</option>
                </optgroup>
                <optgroup label="2공장 랙 (S~U, 3구역)">
                  {['S','T','U'].flatMap(c => [1,2,3].map(t => `${c}${t}`)).map(c => (
                    <option key={c} value={c}>{c} 랙 셀</option>
                  ))}
                </optgroup>
                <optgroup label="2공장 현장">
                  <option value="FIELD-2F-CUTTING">2공장 재단실방향</option>
                  <option value="FIELD-2F-CENTER">2공장 중앙</option>
                  <option value="FIELD-2F-RACKS">2공장 랙쪽</option>
                  <option value="FIELD-2F-RACK-FRONT">2공장 렉앞</option>
                  <option value="FIELD-2F-TENT">2공장 천막안</option>
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

          {/* 등록 버튼 */}
          <button onClick={handleSubmit}
            className={`w-full py-3 rounded-xl font-black text-base transition-all ${
              result === '합격' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' :
              result === '불합격' ? 'bg-red-800 text-red-300 opacity-60 cursor-not-allowed' :
              'bg-slate-700 text-slate-400'
            }`}>
            {result === '합격' ? `✅ ${tab} 합격 등록 → FN테크 재고 자동 반영` :
             result === '불합격' ? '❌ 불합격 (조치 필요)' : '전체 항목 입력 후 자동 판정'}
          </button>
        </div>

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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.overall_result === 'PASS' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                        {r.overall_result === 'PASS' ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
