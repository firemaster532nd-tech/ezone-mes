import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';

interface InspectionFormPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    formCode?: string; // 예: EZC-D-101-1, EZC-C-701-G01 등
    formTitle: string; // 성적서 제목
    categoryName?: string; // 품목/부위
    itemName: string; // 품명
    receivedDate?: string; // 입고일자 / 검사일자
    lotNumber?: string; // 사규 LOT 번호
    supplierLot?: string; // 공급사 LOT 번호
    supplierName?: string; // 입고처 / 공급사
    qty?: number | string; // 입고 수량 / 로트 수량
    unit?: string;
    inspector?: string; // 작성자
    n1?: number | string;
    n2?: number | string;
    n3?: number | string;
    items?: Array<{
      category?: string;
      name: string;
      standard: string;
      method?: string;
      n1?: any;
      n2?: any;
      n3?: any;
      isPass?: boolean;
    }>;
    overallResult?: 'PASS' | 'FAIL' | '합격' | '불합격';
    certNotes?: string;
    certInfo?: string; // 공인성적서 연동 정보
  } | null;
}

const INSPECTORS = ['김정용', '최진영', '임병용', '이동민', '김봉민', '직접입력'];

export function InspectionFormPrintModal({ isOpen, onClose, data }: InspectionFormPrintModalProps) {
  const [selectedInspector, setSelectedInspector] = useState(data?.inspector || '김정용');
  const [customInspector, setCustomInspector] = useState('');

  if (!isOpen || !data) return null;

  const displayInspector = selectedInspector === '직접입력' ? (customInspector || '작성자') : selectedInspector;
  const isPass = data.overallResult === 'PASS' || data.overallResult === '합격';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* 상단 컨트롤 헤더 (인쇄 시 숨김) */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center print:hidden flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-xs font-extrabold px-2.5 py-1 rounded">사규 양식 인쇄</span>
            <h3 className="font-bold text-base">{data.formTitle} ({data.formCode || 'EZC-FORM'})</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <label className="text-xs text-slate-300 font-bold">작성자 선택:</label>
              <select
                value={selectedInspector}
                onChange={e => setSelectedInspector(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold border border-slate-600 rounded px-2 py-1"
              >
                {INSPECTORS.map(ins => <option key={ins} value={ins}>{ins}</option>)}
              </select>
              {selectedInspector === '직접입력' && (
                <input
                  type="text"
                  placeholder="이름 입력"
                  value={customInspector}
                  onChange={e => setCustomInspector(e.target.value)}
                  className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-600 w-24"
                />
              )}
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 shadow"
            >
              <Printer className="h-4 w-4" />
              A4 양식 인쇄 (Print)
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 성적서 서식 본문 (A4 1페이지 규격) */}
        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible font-sans">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #printable-form, #printable-form * { visibility: visible; }
              #printable-form { position: absolute; left: 0; top: 0; width: 100%; padding: 15mm; }
              .print\\:hidden { display: none !important; }
            }
          `}</style>

          <div id="printable-form" className="border-2 border-slate-800 p-6 bg-white text-slate-900 text-xs">
            {/* 서식 상단 헤더 */}
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
              <span className="font-mono text-xs font-bold text-slate-600">{data.formCode || 'EZC-D-101-1'}</span>
              <span className="font-bold text-base tracking-wider text-slate-900">(주) 이 지원</span>
              <span className="text-[11px] text-slate-500 font-mono">A4 (210×297)㎜</span>
            </div>

            {/* 타이틀 & 결재란 */}
            <div className="grid grid-cols-12 gap-2 mb-4 items-center">
              <div className="col-span-7">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                  {data.formTitle}
                </h1>
              </div>

              {/* 결재란 (작성자: 선택, 검토/승인: 빈칸) */}
              <div className="col-span-5 flex justify-end">
                <table className="border-collapse border border-slate-800 text-center text-[11px]">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className="border border-slate-800 bg-slate-100 font-bold px-1 py-1 w-8">결<br/>재</td>
                      <td className="border border-slate-800 bg-slate-100 font-bold px-3 py-0.5 w-20">작 성</td>
                      <td className="border border-slate-800 bg-slate-100 font-bold px-3 py-0.5 w-20">검 토</td>
                      <td className="border border-slate-800 bg-slate-100 font-bold px-3 py-0.5 w-20">승 인</td>
                    </tr>
                    <tr className="h-12">
                      {/* 작성자 칸: 드롭다운 선택값 성명 표출 */}
                      <td className="border border-slate-800 font-bold align-middle text-slate-800">
                        {displayInspector}
                      </td>
                      {/* 검토 칸: 빈칸 */}
                      <td className="border border-slate-800"></td>
                      {/* 승인 칸: 빈칸 */}
                      <td className="border border-slate-800"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 기본 인수/공정 정보 테이블 */}
            <table className="w-full border-collapse border border-slate-800 mb-4 text-[11px]">
              <tbody>
                <tr>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5 w-24">품 명</td>
                  <td className="border border-slate-800 font-bold px-3 py-1.5 text-blue-900">{data.itemName}</td>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5 w-24">입고/검사일자</td>
                  <td className="border border-slate-800 font-mono px-3 py-1.5">{data.receivedDate || new Date().toISOString().slice(0, 10)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5">입고처/공급사</td>
                  <td className="border border-slate-800 px-3 py-1.5">{data.supplierName || '공급업체'}</td>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5">공급사 LOT</td>
                  <td className="border border-slate-800 font-mono px-3 py-1.5">{data.supplierLot || '-'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5">사규 LOT 번호</td>
                  <td className="border border-slate-800 font-mono font-extrabold px-3 py-1.5 text-blue-800">{data.lotNumber || '-'}</td>
                  <td className="border border-slate-800 bg-slate-100 font-bold px-2 py-1.5">로트 수량</td>
                  <td className="border border-slate-800 font-bold px-3 py-1.5">{data.qty ? `${data.qty} ${data.unit || '개'}` : '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 검사항목 및 기준치/실측치 성적 테이블 */}
            <div className="mb-4">
              <h4 className="font-bold text-xs mb-1 text-slate-800">■ 검사 항목 및 성적치 (측정치 n1, n2, n3)</h4>
              <table className="w-full border-collapse border border-slate-800 text-center text-[11px]">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-slate-800 py-1.5 px-2 w-28">검사항목</th>
                    <th className="border border-slate-800 py-1.5 px-2">기준 및 허용차 (공인/사규)</th>
                    <th className="border border-slate-800 py-1.5 px-2 w-20">검사방법</th>
                    <th className="border border-slate-800 py-1.5 px-2 w-14">n1</th>
                    <th className="border border-slate-800 py-1.5 px-2 w-14">n2</th>
                    <th className="border border-slate-800 py-1.5 px-2 w-14">n3</th>
                    <th className="border border-slate-800 py-1.5 px-2 w-16">판정결과</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items && data.items.length > 0 ? (
                    data.items.map((item, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-800 font-bold text-slate-800 px-2">{item.name}</td>
                        <td className="border border-slate-800 text-left px-2 font-mono">{item.standard}</td>
                        <td className="border border-slate-800 text-slate-600">{item.method || '육안/실측'}</td>
                        <td className="border border-slate-800 font-mono">{item.n1 ?? (data.n1 || '-')}</td>
                        <td className="border border-slate-800 font-mono">{item.n2 ?? (data.n2 || '-')}</td>
                        <td className="border border-slate-800 font-mono">{item.n3 ?? (data.n3 || '-')}</td>
                        <td className="border border-slate-800 font-bold">
                          <span className={item.isPass !== false ? 'text-emerald-700' : 'text-rose-600'}>
                            {item.isPass !== false ? '적합 (PASS)' : '부적합'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="h-10">
                      <td className="border border-slate-800 font-bold">두께/외관 치수</td>
                      <td className="border border-slate-800 text-left px-2">사규 min/max 합격 기준 범위 내</td>
                      <td className="border border-slate-800">실측 검사</td>
                      <td className="border border-slate-800 font-mono font-bold">{data.n1 || '-'}</td>
                      <td className="border border-slate-800 font-mono font-bold">{data.n2 || '-'}</td>
                      <td className="border border-slate-800 font-mono font-bold">{data.n3 || '-'}</td>
                      <td className="border border-slate-800 font-bold text-emerald-700">적합 (PASS)</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 최종 판정 & 이지원 직인 도장 및 연동 성적서 정보 */}
            <div className="grid grid-cols-12 gap-3 border border-slate-800 p-3 mb-2">
              <div className="col-span-8 flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-xs">최종 판정:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 font-bold text-emerald-800">
                      <input type="checkbox" checked={isPass} readOnly className="w-4 h-4 text-emerald-600" />
                      <span>■ 합 격 (PASS)</span>
                    </label>
                    <label className="flex items-center gap-1 font-bold text-rose-700">
                      <input type="checkbox" checked={!isPass} readOnly className="w-4 h-4 text-rose-600" />
                      <span>□ 불합격 (FAIL)</span>
                    </label>
                  </div>
                </div>
                <div className="text-[10px] text-slate-600 mt-2 space-y-0.5">
                  <p>※ 성적서 정보 (공인성적서 1년 주기 연동):</p>
                  <p className="font-mono text-slate-700">{data.certInfo || '- FITI / KTR / KCL 한국건설생활환경시험연구원 성적서 참조'}</p>
                </div>
              </div>

              <div className="col-span-4 flex flex-col items-center justify-center border-l border-slate-300 pl-3">
                <span className="font-extrabold text-xs text-slate-900 mb-1">(주) 이 지 원 품질보증</span>
                <img src="/이지원도장.png" alt="이지원 도장" className="h-14 w-14 object-contain" />
              </div>
            </div>

            <div className="text-[9px] text-slate-400 text-right font-mono">
              (주)이지원 MES 생산품질시스템 성적서 자동발행 (Rev 8.0)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
