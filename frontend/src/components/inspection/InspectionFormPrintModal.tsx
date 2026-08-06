import React, { useState, useEffect } from 'react';
import { Printer, X, Edit3, FileText } from 'lucide-react';
import { useInspectors } from '@/hooks/useInspectors';

interface InspectionItem {
  category?: string;
  name: string;
  standard: string;
  standardOptions?: string[]; // 여러 기준치를 ○ 체크로 선택
  method?: string;
  cycle?: string;
  condition?: string;
  n1?: any;
  n2?: any;
  n3?: any;
  isPass?: boolean;
}

interface InspectionFormPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    formCode?: string;
    formTitle: string;
    categoryName?: string;
    itemName: string;
    receivedDate?: string;
    lotNumber?: string;
    supplierLot?: string;
    supplierName?: string;
    qty?: number | string;
    unit?: string;
    inspector?: string;
    n1?: number | string;
    n2?: number | string;
    n3?: number | string;
    items?: InspectionItem[];
    overallResult?: 'PASS' | 'FAIL' | '합격' | '불합격';
    certNotes?: string;
    certInfo?: string;
    certNumber?: string;
    certIssuedDate?: string;
    certAgency?: string;
    certResultText?: string;
    availableSizes?: string[]; // 탭에서 전달받는 규격 목록
  } | null;
}

// 인쇄 모드: 검사결과 성적서 | 빈 수동 양식지
type FormMode = 'result' | 'blank';

export function InspectionFormPrintModal({ isOpen, onClose, data }: InspectionFormPrintModalProps) {
  const { inspectors } = useInspectors();
  const [mode, setMode] = useState<FormMode>('result');

  // ── 편집 가능 상태 (빈양식지 + 결과성적서 공통) ────────────────────────
  const [editInspector, setEditInspector] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLot, setEditLot] = useState('');
  const [editSupplierLot, setEditSupplierLot] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editSpec, setEditSpec] = useState('');       // 입고 규격 (직접 입력)
  const [editThickness, setEditThickness] = useState(''); // 두께

  // ── 검사항목 행별 편집 상태 ────────────────────────────────────────────
  const [itemEdits, setItemEdits] = useState<{
    n1: string; n2: string; n3: string;
    result: 'pass' | 'fail' | '';
    selectedStdIdx: number | null; // standardOptions 선택 인덱스
  }[]>([]);

  // ── 판정 ─────────────────────────────────────────────────────────────
  const [overallResult, setOverallResult] = useState<'pass' | 'fail' | ''>('');

  // ── 비고 ─────────────────────────────────────────────────────────────
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (!data) return;
    setMode('result');
    setEditInspector(data.inspector || '');
    setEditDate(data.receivedDate || new Date().toISOString().slice(0, 10));
    setEditLot(data.lotNumber || '');
    setEditSupplierLot(data.supplierLot || '');
    setEditSupplierName(data.supplierName || '');
    setEditQty(data.qty !== undefined ? String(data.qty) : '');
    setEditSpec('');
    setEditThickness('');
    setEditNotes('');
    setOverallResult(
      data.overallResult === 'PASS' || data.overallResult === '합격' ? 'pass' :
      data.overallResult === 'FAIL' || data.overallResult === '불합격' ? 'fail' : ''
    );
    // 항목별 편집 초기값
    const initItems = (data.items || []).map(it => ({
      n1: it.n1 !== undefined ? String(it.n1) : '',
      n2: it.n2 !== undefined ? String(it.n2) : '',
      n3: it.n3 !== undefined ? String(it.n3) : '',
      result: (it.isPass === true ? 'pass' : it.isPass === false ? 'fail' : '') as 'pass' | 'fail' | '',
      selectedStdIdx: null as number | null,
    }));
    setItemEdits(initItems);
  }, [data]);

  if (!isOpen || !data) return null;

  const isBlank = mode === 'blank';

  const handlePrint = () => {
    window.scrollTo(0, 0);
    window.print();
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItemEdits(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  // 빈칸 또는 값 표시용
  const blankOrVal = (val: string, placeholder = '') =>
    isBlank ? (val || '') : (val || placeholder);

  // 체크박스 렌더: ○ 선택 / ● 선택됨
  const renderCheckOptions = (options: string[], selectedIdx: number | null, onChange: (i: number) => void, isBlankMode: boolean) => (
    <div className="flex flex-col gap-0.5 text-left text-[9.5px]">
      {options.map((opt, i) => (
        <label key={i} className="flex items-center gap-1 cursor-pointer select-none">
          <span
            className={`text-sm leading-none ${selectedIdx === i ? 'text-slate-900 font-black' : 'text-slate-400'}`}
            onClick={() => onChange(i)}
            style={{ cursor: 'pointer' }}
          >
            {selectedIdx === i ? '●' : '○'}
          </span>
          <span className={selectedIdx === i ? 'font-bold text-slate-900' : 'text-slate-600'}>{opt}</span>
        </label>
      ))}
    </div>
  );

  // 인라인 편집 input (인쇄 시 값만 보임)
  const EditInput = ({ value, onChange, placeholder, className = '', type = 'text' }: {
    value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string;
  }) => (
    <>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`print-hide-input bg-transparent border-0 border-b border-dashed border-slate-400 focus:outline-none focus:border-blue-500 text-slate-900 w-full text-[10.5px] font-mono ${className}`}
        style={{ minWidth: 40 }}
      />
      <span className="print-show-val hidden print:inline font-mono">{value}</span>
    </>
  );

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="print-modal-box bg-white rounded-2xl max-w-5xl w-full p-6 space-y-4 shadow-2xl relative border border-slate-300">

        {/* ── 상단 조종 툴바 (인쇄 시 숨김) ── */}
        <div className="print-hidden-toolbar border-b border-slate-200 pb-3 space-y-2.5" style={{ writingMode: 'horizontal-tb', direction: 'ltr' }}>

          {/* Row 1: 제목 + 버튼 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-slate-900 text-blue-400 font-mono font-black text-sm rounded-lg shadow-sm">
                {data.formCode || 'EZC-D-101-1'}
              </span>
              <h3 className="font-extrabold text-slate-900 text-base">
                📄 (주)이지원 품질보증 A4 검사성적서 인쇄
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all"
              >
                <Printer className="h-4 w-4" />
                {isBlank ? '빈 양식지 A4 인쇄' : 'A4 성적서 인쇄'}
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Row 2: 세부 제어 */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">

              {/* 성적서 모드 전환 */}
              <div className="flex bg-white p-1 rounded-lg border border-slate-300 shadow-sm">
                <button type="button" onClick={() => setMode('result')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${mode === 'result' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
                  <FileText className="h-3 w-3" /> 검사 결과 성적서
                </button>
                <button type="button" onClick={() => setMode('blank')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${mode === 'blank' ? 'bg-amber-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
                  <Edit3 className="h-3 w-3" /> 빈 수동 양식지
                </button>
              </div>

              {/* 작성자 (빈칸 옵션 포함) */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="text-xs font-bold text-slate-700">✍️ 작성자:</span>
                <select
                  value={editInspector}
                  onChange={e => setEditInspector(e.target.value)}
                  className="bg-white text-xs font-bold rounded px-1.5 py-0.5 outline-none text-slate-800 border border-slate-200"
                >
                  <option value="">— 비워두기 —</option>
                  {inspectors.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* 제조처 LOT */}
              <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
                <span className="text-xs font-bold text-amber-900">🏷️ 제조처 LOT:</span>
                <input type="text" value={editSupplierLot} onChange={e => setEditSupplierLot(e.target.value)}
                  placeholder="비워두기 가능"
                  className="bg-white border border-amber-300 text-xs font-mono font-bold rounded px-2 py-0.5 outline-none text-slate-900 w-28" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* 규격 직접 입력 */}
              <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-300">
                <span className="text-xs font-bold text-blue-900">📐 규격:</span>
                <input type="text" value={editSpec} onChange={e => setEditSpec(e.target.value)}
                  placeholder="예: 96K 25T 600W 7400L (비워두기 가능)"
                  className="bg-white border border-blue-300 text-xs font-mono rounded px-2 py-0.5 outline-none text-blue-900 w-44" />
              </div>

              {/* 두께 직접 입력 */}
              <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-300">
                <span className="text-xs font-bold text-blue-900">📏 두께:</span>
                <input type="text" value={editThickness} onChange={e => setEditThickness(e.target.value)}
                  placeholder="예: 25mm (비워두기 가능)"
                  className="bg-white border border-blue-300 text-xs font-mono rounded px-2 py-0.5 outline-none text-blue-900 w-24" />
              </div>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs shadow-sm transition-all"
              >
                <Printer className="h-4 w-4" /> 💾 저장 & A4 인쇄
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 사규 원본 성적서 — Printable Area                                     */}
        {/* ===================================================================== */}
        <div>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0 !important; padding: 0 !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; background: #ffffff !important; }
              body * { visibility: hidden !important; }
              .print-hidden-toolbar, .print-hidden-toolbar * { display: none !important; visibility: hidden !important; height: 0 !important; }
              #printable-form, #printable-form * { visibility: visible !important; }
              #printable-form {
                position: fixed !important; left: 5mm !important; top: 5mm !important;
                width: 200mm !important; height: 287mm !important;
                margin: 0 !important; padding: 14px 18px !important;
                border: 2px solid #000000 !important; background: #ffffff !important;
                box-sizing: border-box !important; z-index: 99999999 !important;
                display: flex !important; flex-direction: column !important;
              }
              /* 인쇄 시 input 테두리 숨기고 값만 표시 */
              #printable-form input, #printable-form select {
                border: none !important; border-bottom: 1px solid #999 !important;
                background: transparent !important; outline: none !important;
                -webkit-print-color-adjust: exact !important;
              }
              /* ○● 체크 항목 인쇄 */
              .std-check-label { display: flex !important; align-items: center !important; gap: 2px !important; }
            }
          `}</style>

          <div id="printable-form" className="border-2 border-slate-900 p-4 print:p-2 bg-white text-slate-900 text-xs font-sans space-y-2">

            {/* 헤더 */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1 mb-1">
              <span className="font-mono text-xs font-extrabold text-slate-800">{data.formCode || 'EZC-D-101-1'}</span>
              <span className="font-extrabold text-base tracking-widest text-slate-900">(주) 이 지 원</span>
              <span className="text-[10px] text-slate-500 font-mono">A4 (210×297)㎜</span>
            </div>

            {/* 타이틀 + 결재란 */}
            <div className="grid grid-cols-12 gap-2 mb-1 items-center">
              <div className="col-span-7">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                  {data.formTitle || '인수검사 성적서'}
                </h1>
              </div>
              <div className="col-span-5 flex justify-end">
                <table className="border-collapse border-2 border-slate-900 text-center text-[10.5px]">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className="border border-slate-900 bg-slate-100 font-bold px-1.5 py-0.5 w-6 text-center">결<br/>재</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-0.5 w-16">작 성</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-0.5 w-16">검 토</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-0.5 w-16">승 인</td>
                    </tr>
                    <tr className="h-11 print:h-10">
                      <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1">
                        {isBlank
                          ? <input type="text" value={editInspector} onChange={e => setEditInspector(e.target.value)}
                              placeholder="작성자"
                              className="w-full text-center text-[10.5px] font-bold border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent" />
                          : editInspector}
                      </td>
                      <td className="border border-slate-900 w-16 bg-white"></td>
                      <td className="border border-slate-900 w-16 bg-white"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 기본 정보 표 */}
            <table className="w-full border-collapse border-2 border-slate-900 mb-1 text-[10.5px]">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5 w-24">품    명</td>
                  <td className="border border-slate-900 font-extrabold px-2.5 py-1.5 text-blue-900">{data.itemName}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5 w-24">입고일자</td>
                  <td className="border border-slate-900 font-mono px-2.5 py-1.5">
                    {isBlank
                      ? <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          className="w-full text-[10.5px] font-mono border-0 focus:outline-none bg-transparent" />
                      : editDate}
                  </td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5 w-24">검사일자</td>
                  <td className="border border-slate-900 font-mono px-2.5 py-1.5">
                    {isBlank
                      ? <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          className="w-full text-[10.5px] font-mono border-0 focus:outline-none bg-transparent" />
                      : editDate}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5 text-blue-950">입고 규격</td>
                  <td className="border border-slate-900 font-bold px-2.5 py-1.5" colSpan={5}>
                    {isBlank
                      ? <input type="text" value={editSpec} onChange={e => setEditSpec(e.target.value)}
                          placeholder="규격 직접 입력 (비워두기 가능)"
                          className="w-full text-[10.5px] font-mono border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent text-emerald-900" />
                      : (editSpec || (
                          data.itemName?.includes('세라믹울') ? '세라믹울 두께/너비/길이 — 탭에서 선택한 규격 적용' :
                          data.itemName?.includes('그라스울') ? '그라스울 두께/너비/길이 — 탭에서 선택한 규격 적용' :
                          '도면 지정 표준 규격 충족 (사규 C-701 및 품질관리서)'
                        ))
                    }
                    {editThickness && <span className="ml-2 font-bold text-blue-900">두께: {editThickness}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5">입 고 처</td>
                  <td className="border border-slate-900 px-2.5 py-1.5">
                    {isBlank
                      ? <input type="text" value={editSupplierName} onChange={e => setEditSupplierName(e.target.value)}
                          placeholder="입고처 (비워두기 가능)"
                          className="w-full text-[10.5px] border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent" />
                      : (editSupplierName || data.supplierName || '')}
                  </td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5">제조처 로트번호</td>
                  <td className="border border-slate-900 font-mono font-bold px-2.5 py-1.5 text-slate-900">
                    {isBlank
                      ? <input type="text" value={editSupplierLot} onChange={e => setEditSupplierLot(e.target.value)}
                          placeholder="비워두기 가능"
                          className="w-full text-[10.5px] font-mono border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent" />
                      : editSupplierLot}
                  </td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5">검 사 자</td>
                  <td className="border border-slate-900 font-bold px-2.5 py-1.5">
                    {isBlank
                      ? <input type="text" value={editInspector} onChange={e => setEditInspector(e.target.value)}
                          placeholder="비워두기 가능"
                          className="w-full text-[10.5px] border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent" />
                      : editInspector}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5">인수검사 로트번호</td>
                  <td className="border border-slate-900 font-mono font-extrabold px-2.5 py-1.5 text-blue-900">
                    {isBlank
                      ? <input type="text" value={editLot} onChange={e => setEditLot(e.target.value)}
                          placeholder="비워두기 가능"
                          className="w-full text-[10.5px] font-mono border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent text-blue-900" />
                      : editLot}
                  </td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2.5 py-1.5">로트 수량</td>
                  <td className="border border-slate-900 font-bold px-2.5 py-1.5" colSpan={3}>
                    {isBlank
                      ? <input type="text" value={editQty} onChange={e => setEditQty(e.target.value)}
                          placeholder="수량 (비워두기 가능)"
                          className="w-full text-[10.5px] border-0 border-b border-dashed border-slate-400 focus:outline-none bg-transparent" />
                      : (editQty ? `${editQty} ${data.unit || '개'}` : '')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 검사항목 표 */}
            <div className="mb-1">
              <h4 className="font-bold text-xs mb-1 text-slate-900">■ 검사항목 및 성적치 (측정 실측치 n1, n2, n3)</h4>
              <table className="w-full border-collapse border-2 border-slate-900 text-center text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 py-1.5 px-1 w-24">검사항목</th>
                    <th className="border border-slate-900 py-1.5 px-1">기준 및 허용차</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-16">검사방법</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-14">검사주기</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-14">검사조건</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-10">n1</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-10">n2</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-10">n3</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-20">검사 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items && data.items.length > 0 ? (
                    data.items.map((it, idx) => {
                      const edit = itemEdits[idx] || { n1: '', n2: '', n3: '', result: '', selectedStdIdx: null };
                      const hasOptions = it.standardOptions && it.standardOptions.length > 0;
                      const displayN1 = isBlank ? edit.n1 : (edit.n1 || String(it.n1 || ''));
                      const displayN2 = isBlank ? edit.n2 : (edit.n2 || String(it.n2 || ''));
                      const displayN3 = isBlank ? edit.n3 : (edit.n3 || String(it.n3 || ''));
                      const itemResult = isBlank
                        ? edit.result
                        : (edit.result || (it.isPass === true ? 'pass' : it.isPass === false ? 'fail' : ''));

                      return (
                        <tr key={idx} className="h-11 print:h-10">
                          <td className="border border-slate-900 font-bold bg-slate-50 text-left px-1">{it.name}</td>

                          {/* 기준 및 허용차 — standardOptions가 있으면 ○ 체크, 없으면 텍스트 */}
                          <td className="border border-slate-900 text-left px-2 font-mono font-medium">
                            {hasOptions
                              ? renderCheckOptions(
                                  it.standardOptions!,
                                  edit.selectedStdIdx,
                                  (i) => updateItem(idx, 'selectedStdIdx', edit.selectedStdIdx === i ? null : i),
                                  isBlank
                                )
                              : it.standard
                            }
                          </td>

                          <td className="border border-slate-900">{it.method || '실측'}</td>
                          <td className="border border-slate-900">{it.cycle || '매로트'}</td>
                          <td className="border border-slate-900">{it.condition || 'n=3, c=0'}</td>

                          {/* n1 / n2 / n3 — 빈양식지: 직접 입력, 결과성적서: 값 표시 + 수정 가능 */}
                          <td className="border border-slate-900 font-mono font-bold p-0.5">
                            <input type="text" value={displayN1}
                              onChange={e => updateItem(idx, 'n1', e.target.value)}
                              className="w-full text-center text-[10px] font-mono font-bold border-0 focus:outline-none bg-transparent" />
                          </td>
                          <td className="border border-slate-900 font-mono font-bold p-0.5">
                            <input type="text" value={displayN2}
                              onChange={e => updateItem(idx, 'n2', e.target.value)}
                              className="w-full text-center text-[10px] font-mono font-bold border-0 focus:outline-none bg-transparent" />
                          </td>
                          <td className="border border-slate-900 font-mono font-bold p-0.5">
                            <input type="text" value={displayN3}
                              onChange={e => updateItem(idx, 'n3', e.target.value)}
                              className="w-full text-center text-[10px] font-mono font-bold border-0 focus:outline-none bg-transparent" />
                          </td>

                          {/* 검사 결과 — 클릭으로 적합/부적합 토글 */}
                          <td className="border border-slate-900 font-bold text-slate-900 cursor-pointer select-none">
                            <div className="flex flex-col gap-0.5 items-center text-[9.5px]">
                              <span
                                className={`cursor-pointer ${itemResult === 'pass' ? 'text-emerald-800 font-black' : 'text-slate-400'}`}
                                onClick={() => updateItem(idx, 'result', itemResult === 'pass' ? '' : 'pass')}
                              >
                                {itemResult === 'pass' ? '● 적합' : '○ 적합'}
                              </span>
                              <span
                                className={`cursor-pointer ${itemResult === 'fail' ? 'text-red-800 font-black' : 'text-slate-400'}`}
                                onClick={() => updateItem(idx, 'result', itemResult === 'fail' ? '' : 'fail')}
                              >
                                {itemResult === 'fail' ? '● 부적합' : '○ 부적합'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // 빈 기본 행 (items 없을 때)
                    [1,2,3,4,5].map(i => (
                      <tr key={i} className="h-11 print:h-10">
                        <td className="border border-slate-900 bg-slate-50"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900"></td>
                        <td className="border border-slate-900">
                          <div className="flex flex-col gap-0.5 items-center text-[9.5px]">
                            <span className="text-slate-400">○ 적합</span>
                            <span className="text-slate-400">○ 부적합</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 판정 + 비고 */}
            <div className="grid grid-cols-12 gap-3 border-2 border-slate-900 p-3 mb-2">
              <div className="col-span-8 flex flex-col justify-between gap-2">
                {/* 최종 판정 */}
                <div className="flex items-center gap-4">
                  <span className="font-bold text-xs text-slate-900">판    정:</span>
                  <div className="flex items-center gap-5">
                    <span
                      className={`cursor-pointer font-extrabold text-sm select-none ${overallResult === 'pass' ? 'text-emerald-900' : 'text-slate-400'}`}
                      onClick={() => setOverallResult(overallResult === 'pass' ? '' : 'pass')}
                    >
                      {overallResult === 'pass' ? '● 합 격 (PASS)' : '○ 합 격 (PASS)'}
                    </span>
                    <span
                      className={`cursor-pointer font-bold text-sm select-none ${overallResult === 'fail' ? 'text-red-900' : 'text-slate-400'}`}
                      onClick={() => setOverallResult(overallResult === 'fail' ? '' : 'fail')}
                    >
                      {overallResult === 'fail' ? '● 부적합 (FAIL)' : '○ 부적합 (FAIL)'}
                    </span>
                  </div>
                </div>

                {/* 비고 */}
                <div className="text-[10px] text-slate-800 bg-slate-50 p-2 rounded border border-slate-400">
                  <p className="font-extrabold text-blue-900 mb-1">※ 비고 / 공인성적서 연동 정보:</p>
                  <textarea
                    value={editNotes || (isBlank ? '' : (data.certInfo || ''))}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="비고 내용 입력 (비워두기 가능)"
                    rows={3}
                    className="w-full text-[10px] font-mono text-slate-900 bg-transparent border-0 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* 직인 */}
              <div className="col-span-4 flex flex-col items-center justify-center border-l-2 border-slate-400 pl-3">
                <span className="font-extrabold text-xs text-slate-900 mb-1">(주) 이 지 원 품질보증</span>
                {!isBlank && <img src="/ezone_stamp.png" alt="(주)이지원 품질보증 직인" className="h-16 w-16 object-contain mix-blend-multiply" />}
              </div>
            </div>

            <div className="text-[9px] text-slate-500 text-right font-mono">
              (주)이지원 MES 생산품질시스템 사규 표준성적서 자동발행 (Rev 8.0)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InspectionFormPrintModal;
