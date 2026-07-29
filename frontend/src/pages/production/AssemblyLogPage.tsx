import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ClipboardList, PlusCircle, CheckCircle2, Package, Layers, Calendar, User } from 'lucide-react';
import { LocationPicker } from '@/components/LocationPicker';

interface AssemblyTypeConfig {
  type: string;
  code: string;
  name: string;
  formNumber: string;
  color: string;
  bgColor: string;
  inputMaterials: string[];
}

const ASSEMBLY_TYPES: AssemblyTypeConfig[] = [
  {
    type: 'FLASHING',
    code: 'F',
    name: '방화플래싱 조립',
    formNumber: 'EZC B-201-10',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    inputMaterials: ['플래싱 강판 인수검사 LOT', '차열시트 LOT (SA-EXT-4125Z)']
  },
  {
    type: 'GAP_SHEET',
    code: 'TS',
    name: '틈새복합시트 조립',
    formNumber: 'EZC B-201-11',
    color: 'text-sky-700',
    bgColor: 'bg-sky-50 border-sky-200',
    inputMaterials: ['세라믹울/그라스울 인수검사 LOT', '차열시트 LOT']
  },
  {
    type: 'SOCKET',
    code: 'D',
    name: '방화소켓류 조립',
    formNumber: 'EZC B-201-3',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
    inputMaterials: ['소켓 인수검사 LOT', '차열시트 LOT', '차열재 인수검사 LOT']
  },
  {
    type: 'BUS_DUCT',
    code: 'BD',
    name: '버스덕트 조립',
    formNumber: 'EZC B-201-9',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    inputMaterials: ['소켓 LOT', '차열시트 LOT', '차열재 LOT', '실란트 LOT']
  },
  {
    type: 'SLEEVE',
    code: 'FN',
    name: '일체형슬리브 조립',
    formNumber: 'EZC B-201-8',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    inputMaterials: ['슬리브 인수검사 LOT', '차열시트 LOT', '보호철판 인수검사 LOT']
  }
];

// ─── 플래싱 서브타입 및 규격 ──────────────────────────────────────────────────
const FLASHING_SUBTYPES = [
  { code: 'FZ', label: 'Z형 플래싱', color: 'bg-amber-100 text-amber-800' },
  { code: 'FI', label: 'I형 플래싱', color: 'bg-orange-100 text-orange-800' },
  { code: 'FL', label: 'L형 플래싱', color: 'bg-red-100 text-red-800' },
] as const;

const FLASHING_SPECS: Record<string, { value: string; label: string }[]> = {
  FZ: [
    { value: 'W170×L1000 (t0.5)', label: 'W170×L1000 (t0.5) — 표준' },
    { value: 'W205×L1000 (t0.5)', label: 'W205×L1000 (t0.5)' },
    { value: 'W250×L1000 (t0.5)', label: 'W250×L1000 (t0.5)' },
    { value: 'W300×L1000 (t0.5)', label: 'W300×L1000 (t0.5)' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
  FI: [
    { value: 'W95×L195',   label: 'W95×L195 (소형)' },
    { value: 'W175×L1100', label: 'W175×L1100 (대형)' },
    { value: 'W125×L500',  label: 'W125×L500' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
  FL: [
    { value: 'W190×L380 (SUS)', label: 'W190×L380 (SUS)' },
    { value: 'W175×L500 (SUS)', label: 'W175×L500 (SUS)' },
    { value: 'W125×L380',      label: 'W125×L380' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
};

// ─── 틈새복합시트 3종 서브타입 ──────────────────────────────────────────────────
const GAP_SHEET_SUBTYPES = [
  {
    code: 'BD_CV1S',
    label: 'BD CV-1S용',
    desc: '버스덝트 수직 1소켓 (200A)',
    color: 'bg-sky-100 text-sky-800',
    bom: [
      '차열시트 t5.0×W125×L300 ×4새트 (상하)',
      '세라믹 96K t25 H150 L300 ×2 (상하)',
      '차열시트 t5.0×W125×L230 ×4세트 (좌우)',
      '세라믹 96K t25 H150 L230 ×2 (좌우)',
      'SUS304 플래싱 W190×L380 ×4개',
    ],
  },
  {
    code: 'BD_RV3S',
    label: 'BD RV-3S용',
    desc: '버스덝트 수직 3소켓 (025M)',
    color: 'bg-purple-100 text-purple-800',
    bom: [
      '차열시트 t5.0×W125×L1000 ×4세트 (상하)',
      '세라믹 96K t25 H150 L1000 ×2 (상하)',
      '차열시트 t5.0×W125×L180 ×4세트 (좌우/틈새)',
      '세라믹 96K t25 H150 L180 ×2 (좌우)',
      '아연도금 플래싱 W175×L1100(상하)·4 + W95×L195(좌우)·4',
    ],
  },
  {
    code: 'HTG',
    label: '입상(HTG)용',
    desc: 'HTG 입상형 관통 구조',
    color: 'bg-emerald-100 text-emerald-800',
    bom: [
      '차열시트 t5.0×W185×L150',
      '세라믹 96K t25 H150',
    ],
  },
] as const;

type GapSheetSubType = 'BD_CV1S' | 'BD_RV3S' | 'HTG';

const GAP_SHEET_SPECS: Record<GapSheetSubType, { value: string; label: string }[]> = {
  BD_CV1S: [
    { value: 't5.0×W125×L300 (상하)', label: 't5.0×W125×L300 — 상하 차열시트' },
    { value: 't5.0×W125×L230 (좌우)', label: 't5.0×W125×L230 — 좌우 차열시트' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
  BD_RV3S: [
    { value: 't5.0×W125×L1000 (상하)', label: 't5.0×W125×L1000 — 상하 차열시트' },
    { value: 't5.0×W125×L180 (좌우/틈새)', label: 't5.0×W125×L180 — 좌우/틈새 차열시트' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
  HTG: [
    { value: 't5.0×W185×L150', label: 't5.0×W185×L150 — 입상 표준' },
    { value: 't5.0×W125×L150', label: 't5.0×W125×L150' },
    { value: 'CUSTOM', label: '직접 입력' },
  ],
};

// 랙 로케이션 옵션 (RACK_OPTIONS는 LocationPicker로 대체 — 이하 미사용)

export function AssemblyLogPage() {
  const [selectedType, setSelectedType] = useState<AssemblyTypeConfig>(ASSEMBLY_TYPES[0]);
  const [assemblyDate, setAssemblyDate] = useState(new Date().toISOString().slice(0, 10));
  // 플래싱 서브타입 (FZ/FI/FL)
  const [flashingSubType, setFlashingSubType] = useState<'FZ'|'FI'|'FL'>('FZ');
  // 틈새복합시트 서브타입 (BD_CV1S/BD_RV3S/HTG)
  const [gapSheetSubType, setGapSheetSubType] = useState<GapSheetSubType>('BD_CV1S');
  const [spec, setSpec] = useState('W170×L1000 (t0.5)');
  const [specCustom, setSpecCustom] = useState('');
  const [inputQty, setInputQty] = useState<number>(10);
  const [producedQty, setProducedQty] = useState<number>(10);
  const [rackLocation, setRackLocation] = useState('');
  const [workerName, setWorkerName] = useState('조립담당자');
  const [remarks, setRemarks] = useState('');
  
  // 투입 LOT 관리
  const [inputLots, setInputLots] = useState<{ label: string; lot_number: string; qty: number }[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 공정 타입 변경 시 투입 LOT 폼 및 규격 기본값 초기화
    setInputLots(
      selectedType.inputMaterials.map(matLabel => ({
        label: matLabel,
        lot_number: '',
        qty: producedQty
      }))
    );
    // 공정별 규격 기본값 초기화
    if (selectedType.type === 'FLASHING') {
      setSpec(FLASHING_SPECS[flashingSubType]?.[0]?.value ?? '');
    } else if (selectedType.type === 'GAP_SHEET') {
      setSpec(GAP_SHEET_SPECS[gapSheetSubType]?.[0]?.value ?? '');
    } else {
      setSpec('');
    }
  }, [selectedType, producedQty]);

  // 플래싱 서브타입 변경 시 규격 기본값 업데이트
  useEffect(() => {
    if (selectedType.type === 'FLASHING') {
      setSpec(FLASHING_SPECS[flashingSubType]?.[0]?.value ?? '');
      setSpecCustom('');
    }
  }, [flashingSubType]);

  // 틈새복합시트 서브타입 변경 시 규격 기본값 업데이트
  useEffect(() => {
    if (selectedType.type === 'GAP_SHEET') {
      setSpec(GAP_SHEET_SPECS[gapSheetSubType]?.[0]?.value ?? '');
      setSpecCustom('');
    }
  }, [gapSheetSubType]);

  useEffect(() => {
    fetchLogs();
  }, [selectedType]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/production/assembly-logs?type=${selectedType.type}`);
      setLogs(res.data || res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producedQty || producedQty <= 0) {
      alert('생산수량을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const finalSpec = (spec === 'CUSTOM') ? specCustom : spec;
      const assemblyTypeStr =
        selectedType.type === 'FLASHING' ? `FLASHING_${flashingSubType}` :
        selectedType.type === 'GAP_SHEET' ? `GAP_SHEET_${gapSheetSubType}` :
        selectedType.type;
      const res = await api.post('/api/production/assembly-logs', {
        assembly_type: assemblyTypeStr,
        assembly_date: assemblyDate,
        spec: finalSpec,
        input_qty: inputQty,
        produced_qty: producedQty,
        rack_location: rackLocation || null,
        input_lots: inputLots,
        worker_name: workerName,
        remarks
      });

      alert(`✅ ${res.message || '조립생산일지 작성 및 반제품 J-LOT가 생성되었습니다!'}`);
      // 폼 초기화 및 새로고침
      fetchLogs();
    } catch (err: any) {
      alert(`저장 실패: ${err?.response?.data?.message || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <ClipboardList className="w-7 h-7 mr-2 text-indigo-600" />
            전자 조립생산일지 및 반제품 J-LOT 관리
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            사규 EZC-C-302 Rev8 제7조 및 실물 서식 기준 (원/부자재 ➔ 조립 ➔ J-LOT 생성 ➔ 반제품 재고 자동 입고 & 랙 적재)
          </p>
        </div>
      </div>

      {/* Assembly Type Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {ASSEMBLY_TYPES.map(cfg => {
          const isSelected = selectedType.type === cfg.type;
          return (
            <button
              key={cfg.type}
              onClick={() => setSelectedType(cfg)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? `${cfg.bgColor} ring-2 ring-indigo-500 shadow-sm font-bold`
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs text-slate-400 font-mono">{cfg.formNumber}</div>
              <div className={`text-sm mt-1 flex items-center justify-between ${cfg.color}`}>
                <span>{cfg.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-white border font-semibold">약호 {cfg.code}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left Form / Right Log History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-indigo-600" />
              {selectedType.name} 작성 ({selectedType.formNumber})
            </h2>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold">
              J-LOT 자동 채번 (JYYMMDD{selectedType.code}01)
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> 생산일자
                </label>
                <input
                  type="date"
                  value={assemblyDate}
                  onChange={e => setAssemblyDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <User className="w-3.5 h-3.5 mr-1 text-slate-400" /> 작업자 성명
                </label>
                <input
                  type="text"
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            {/* 조립 규격 — 공정별 드롭다운 */}
            <div className="grid grid-cols-3 gap-4">
              <div className={selectedType.type === 'FLASHING' ? 'col-span-3' : ''}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">조립 규격 (Spec)</label>

                {/* 플래싱 전용: Z/I/L 서브타입 선택 */}
                {selectedType.type === 'FLASHING' && (
                  <div className="mb-2">
                    <div className="flex gap-2 mb-2">
                      {FLASHING_SUBTYPES.map(ft => (
                        <button
                          key={ft.code}
                          type="button"
                          onClick={() => setFlashingSubType(ft.code)}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${
                            flashingSubType === ft.code
                              ? `${ft.color} ring-2 ring-offset-1 ring-amber-400`
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {ft.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={spec}
                      onChange={e => setSpec(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {FLASHING_SPECS[flashingSubType]?.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {spec === 'CUSTOM' && (
                      <input
                        type="text"
                        value={specCustom}
                        onChange={e => setSpecCustom(e.target.value)}
                        placeholder="규격 직접 입력 (예: W180×L1200)"
                        className="mt-1 w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                      />
                    )}
                  </div>
                )}

                {/* 틈새복합시트 3종 서브타입 선택 */}
                {selectedType.type === 'GAP_SHEET' && (
                  <div>
                    {/* 서브타입 선택 */}
                    <div className="flex gap-2 mb-2">
                      {GAP_SHEET_SUBTYPES.map(st => (
                        <button
                          key={st.code}
                          type="button"
                          onClick={() => setGapSheetSubType(st.code as GapSheetSubType)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                            gapSheetSubType === st.code
                              ? `${st.color} ring-2 ring-offset-1 ring-sky-400`
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <div>{st.label}</div>
                          <div className="text-[10px] font-normal opacity-70 mt-0.5">{st.desc}</div>
                        </button>
                      ))}
                    </div>
                    {/* BOM 구성 안내 */}
                    {(() => {
                      const st = GAP_SHEET_SUBTYPES.find(s => s.code === gapSheetSubType);
                      return st ? (
                        <div className="mb-2 p-2 bg-sky-50 border border-sky-100 rounded-lg">
                          <p className="text-[10px] font-bold text-sky-700 mb-1">📋 {st.label} BOM 구성</p>
                          {st.bom.map((b, i) => (
                            <p key={i} className="text-[10px] text-sky-600">• {b}</p>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    {/* 규격 드롭다운 */}
                    <select
                      value={spec}
                      onChange={e => setSpec(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      {GAP_SHEET_SPECS[gapSheetSubType]?.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {spec === 'CUSTOM' && (
                      <input
                        type="text"
                        value={specCustom}
                        onChange={e => setSpecCustom(e.target.value)}
                        placeholder="규격 직접 입력"
                        className="mt-1 w-full px-3 py-2 border border-sky-300 rounded-lg text-sm"
                      />
                    )}
                  </div>
                )}

                {/* 기타 공정: 자유 텍스트 */}
                {selectedType.type !== 'FLASHING' && selectedType.type !== 'GAP_SHEET' && (
                  <input
                    type="text"
                    value={spec}
                    onChange={e => setSpec(e.target.value)}
                    placeholder="예: 100H, W170×L1000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* 생산수량 */}
              {selectedType.type !== 'FLASHING' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">생산수량 (EA)</label>
                  <input
                    type="number"
                    value={producedQty}
                    onChange={e => {
                      const q = parseInt(e.target.value) || 0;
                      setProducedQty(q);
                      setInputQty(q);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    min={1}
                    required
                  />
                </div>
              )}
            </div>

            {/* 플래싱일 때 수량을 별도 줄로 */}
            {selectedType.type === 'FLASHING' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">생산수량 (EA)</label>
                  <input
                    type="number"
                    value={producedQty}
                    onChange={e => {
                      const q = parseInt(e.target.value) || 0;
                      setProducedQty(q);
                      setInputQty(q);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    min={1}
                    required
                  />
                </div>
              </div>
            )}

            {/* 입고 위치 — LocationPicker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <Package className="w-3.5 h-3.5 mr-1 text-slate-400" /> 입고 위치 (적재장소)
              </label>
              <LocationPicker
                value={rackLocation}
                onChange={(code) => setRackLocation(code)}
                allowNone={true}
              />
            </div>

            {/* Input Materials LOT Matrix */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center">
                <Layers className="w-4 h-4 mr-1 text-indigo-600" />
                투입 원/부자재 LOT 지정 (실물 조립일지 투입란 매칭)
              </h3>
              <div className="space-y-2">
                {inputLots.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <span className="col-span-5 font-semibold text-slate-700">{item.label}</span>
                    <input
                      type="text"
                      value={item.lot_number}
                      onChange={e => {
                        const newLots = [...inputLots];
                        newLots[idx].lot_number = e.target.value;
                        setInputLots(newLots);
                      }}
                      placeholder="LOT 번호 (예: 251025MB001)"
                      className="col-span-5 px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                    />
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => {
                        const newLots = [...inputLots];
                        newLots[idx].qty = parseInt(e.target.value) || 0;
                        setInputLots(newLots);
                      }}
                      className="col-span-2 px-2 py-1.5 border border-slate-300 rounded bg-white text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">비고 및 특이사항</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                placeholder="품질적 특이사항 및 조치사항 기재"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center text-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {submitting ? '조립 LOT 생성 및 반제품 입고 중...' : '조립생산일지 저장 및 반제품 J-LOT 생성'}
            </button>
          </form>
        </div>

        {/* Right Log History (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <span>📋 최근 {selectedType.name} 이력</span>
            <span className="text-xs text-slate-400 font-normal">총 {logs.length}건</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">등록된 조립 일지가 없습니다.</div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
              {logs.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all text-xs">
                  <div className="flex items-center justify-between font-mono font-bold text-indigo-700 mb-1">
                    <span>{item.assembly_lot}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-sans text-[11px]">
                      {item.rack_location} 랙 적재
                    </span>
                  </div>
                  <div className="text-slate-700 font-semibold mb-1">
                    {item.spec} — <span className="text-indigo-600 font-bold">{item.produced_qty} EA</span>
                  </div>
                  <div className="text-slate-400 flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-200/60">
                    <span>작업자: {item.worker_name}</span>
                    <span>{item.assembly_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
