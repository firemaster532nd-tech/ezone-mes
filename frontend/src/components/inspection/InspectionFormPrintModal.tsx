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
    certNumber?: string;
    certIssuedDate?: string;
    certAgency?: string;
  } | null;
}

const INSPECTOR_LIST = ['김정용 책임', '최진영 책임', '임병용 파트장', '이동민 파트장', '김봉민 책임', '생산 작업자'];

export function InspectionFormPrintModal({ isOpen, onClose, data }: InspectionFormPrintModalProps) {
  const [selectedInspector, setSelectedInspector] = useState<string>('김정용 책임');

  if (!isOpen || !data) return null;

  const isPass = data.overallResult === 'PASS' || data.overallResult === '합격';
  const displayInspector = data.inspector || selectedInspector;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative border border-slate-300 print:shadow-none print:border-none print:w-full print:max-w-none print:p-0">
        
        {/* 모달 상단 조종 바 (인쇄 시 숨김) */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-slate-900 text-blue-400 font-mono font-bold text-xs rounded-lg">
              {data.formCode || 'EZC-C-701-G01'}
            </span>
            <h3 className="font-bold text-slate-800 text-base">
              📄 사규 서식 A4 성적서 인쇄 미리보기 (작성자 선택 + 검토/승인 빈칸)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* 작성자 드롭다운 선택 */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
              <span className="text-xs font-bold text-slate-600">✍️ 작성자 선택:</span>
              <select
                value={displayInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold rounded-lg px-2 py-1 outline-none text-slate-800"
              >
                {INSPECTOR_LIST.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition-all"
            >
              <Printer className="h-4 w-4" />
              A4 양식 성적서 인쇄 (PDF 저장)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* A4 사규 원본 서식 1:1 복원 레이아웃 (Printable Area) */}
        {/* ========================================================================= */}
        <div className="print:m-0 print:p-0">
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              body * { visibility: hidden; }
              #printable-form, #printable-form * { visibility: visible; }
              #printable-form { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
              .print\\:hidden { display: none !important; }
            }
          `}</style>

          <div id="printable-form" className="border-2 border-slate-900 p-6 bg-white text-slate-900 text-xs font-sans">
            
            {/* 서식 헤더: 코드명 | (주)이지원 | A4 규격 */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-1.5 mb-3">
              <span className="font-mono text-xs font-extrabold text-slate-800">{data.formCode || 'EZC-C-701-G01'}</span>
              <span className="font-extrabold text-lg tracking-widest text-slate-900">(주) 이 지 원</span>
              <span className="text-[10px] text-slate-500 font-mono">A4 (210×297)㎜</span>
            </div>

            {/* 타이틀 및 3단 결재란 (작성자: 선택 이름, 검토/승인: 완전히 비어있는 빈칸) */}
            <div className="grid grid-cols-12 gap-2 mb-4 items-center">
              <div className="col-span-7">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                  {data.formTitle}
                </h1>
              </div>

              {/* 결재란 */}
              <div className="col-span-5 flex justify-end">
                <table className="border-collapse border-2 border-slate-900 text-center text-[11px]">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className="border border-slate-900 bg-slate-100 font-bold px-1.5 py-1 w-7 text-center">결<br/>재</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-3 py-0.5 w-20">작 성</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-3 py-0.5 w-20">검 토</td>
                      <td className="border border-slate-900 bg-slate-100 font-bold px-3 py-0.5 w-20">승 인</td>
                    </tr>
                    <tr className="h-12">
                      {/* 작성자: 선택한 담당자 이름 표출 */}
                      <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1">
                        {displayInspector}
                      </td>
                      {/* 검토: 나중에 종이 수동 서명/도장을 위한 완벽한 빈칸 */}
                      <td className="border border-slate-900 w-20 bg-white"></td>
                      {/* 승인: 나중에 종이 수동 서명/도장을 위한 완벽한 빈칸 */}
                      <td className="border border-slate-900 w-20 bg-white"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 기본 공정 및 상품 관리 표 */}
            <table className="w-full border-collapse border-2 border-slate-900 mb-4 text-[11px]">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-24">상 품 명</td>
                  <td className="border border-slate-900 font-extrabold px-3 py-1.5 text-blue-900">{data.itemName}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-24">검사일자</td>
                  <td className="border border-slate-900 font-mono px-3 py-1.5">{data.receivedDate || new Date().toISOString().slice(0, 10)}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-20">검 사 자</td>
                  <td className="border border-slate-900 font-bold px-3 py-1.5">{displayInspector}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">생산부위</td>
                  <td className="border border-slate-900 px-3 py-1.5">{data.categoryName || 'EZ F.B Duct 방화소켓 / 내화채움재'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">구 조 명</td>
                  <td className="border border-slate-900 px-3 py-1.5 font-bold">{data.supplierLot || 'EZ-덕트내화채움구조'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">검사주기</td>
                  <td className="border border-slate-900 font-bold px-3 py-1.5">매 로 트</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">사규 LOT 번호</td>
                  <td className="border border-slate-900 font-mono font-extrabold px-3 py-1.5 text-blue-900">{data.lotNumber || '-'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">로트 수량</td>
                  <td className="border border-slate-900 font-bold px-3 py-1.5">{data.qty ? `${data.qty} ${data.unit || '개'}` : '-'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">입고처</td>
                  <td className="border border-slate-900 px-3 py-1.5">{data.supplierName || '(주)이지원'}</td>
                </tr>
              </tbody>
            </table>

            {/* 실측 검사 항목 및 성적치 표 (n1, n2, n3 실측치 + 적합/부적합 선택) */}
            <div className="mb-4">
              <h4 className="font-bold text-xs mb-1.5 text-slate-900">■ 공정 검사 항목 및 성적치 (측정 실측치 n1, n2, n3)</h4>
              <table className="w-full border-collapse border-2 border-slate-900 text-center text-[11px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 py-1.5 px-2 w-28">공정명 / 검사항목</th>
                    <th className="border border-slate-900 py-1.5 px-2">기준 및 허용차 (사규/공인)</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-20">검사방법</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-14">n1</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-14">n2</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-14">n3</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-24">중간검사 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items && data.items.length > 0 ? (
                    data.items.map((item, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-900 font-bold text-slate-900 px-2">{item.name}</td>
                        <td className="border border-slate-900 text-left px-2 font-mono">{item.standard}</td>
                        <td className="border border-slate-900 text-slate-700">{item.method || '줄자/버니어/육안'}</td>
                        <td className="border border-slate-900 font-mono font-bold">{item.n1 ?? (data.n1 || '-')}</td>
                        <td className="border border-slate-900 font-mono font-bold">{item.n2 ?? (data.n2 || '-')}</td>
                        <td className="border border-slate-900 font-mono font-bold">{item.n3 ?? (data.n3 || '-')}</td>
                        <td className="border border-slate-900 font-bold px-1">
                          <div className="flex items-center justify-center gap-2">
                            <span>{item.isPass !== false ? '☑ 적합' : '□ 적합'}</span>
                            <span>{item.isPass === false ? '☑ 부적합' : '□ 부적합'}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="h-10">
                      <td className="border border-slate-900 font-bold">재단/조립 규격 실측치</td>
                      <td className="border border-slate-900 text-left px-2">사규 min/max 규격 허용차 이내 (미달 시 저장차단)</td>
                      <td className="border border-slate-900">줄자/버니어캘리퍼스</td>
                      <td className="border border-slate-900 font-mono font-extrabold text-blue-900">{data.n1 || '양호'}</td>
                      <td className="border border-slate-900 font-mono font-extrabold text-blue-900">{data.n2 || '양호'}</td>
                      <td className="border border-slate-900 font-mono font-extrabold text-blue-900">{data.n3 || '양호'}</td>
                      <td className="border border-slate-900 font-bold text-emerald-800">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-extrabold text-emerald-800">☑ 적합</span>
                          <span className="text-slate-400">□ 부적합</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 최종 판정 & 이지원 직인 도장 및 연동 성적서 정보 */}
            <div className="grid grid-cols-12 gap-3 border-2 border-slate-900 p-3 mb-2">
              <div className="col-span-8 flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-xs text-slate-900">최종 판정:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 font-extrabold text-emerald-800 text-sm">
                      <span>{isPass ? '☑ 합 격 (PASS)' : '□ 합 격 (PASS)'}</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-extrabold text-rose-700 text-sm">
                      <span>{!isPass ? '☑ 불합격 (FAIL)' : '□ 불합격 (FAIL)'}</span>
                    </label>
                  </div>
                </div>

                {/* 공인시험 성적서 1년 주기 자동 연동 기입 안내 */}
                <div className="text-[10px] text-slate-800 mt-2 space-y-0.5 bg-slate-50 p-2 rounded border border-slate-400">
                  <p className="font-extrabold text-blue-900">※ 공인시험 성적서 1년 주기 자동 연동 정보:</p>
                  <p className="font-mono text-slate-900 font-bold">
                    {data.certInfo || `[공인성적서 번호: ${data.certNumber || 'KTR-2026-0415'}] | [발행일자: ${data.certIssuedDate || '2026-04-15'}] | [시험기관: ${data.certAgency || 'KTR 한국화학융합시험연구원'}]`}
                  </p>
                </div>
              </div>

              {/* (주)이지원 직인 도장 */}
              <div className="col-span-4 flex flex-col items-center justify-center border-l-2 border-slate-400 pl-3">
                <span className="font-extrabold text-xs text-slate-900 mb-1">(주) 이 지 원 품질보증</span>
                <img src="/이지원도장.png" alt="이지원 도장" className="h-14 w-14 object-contain" />
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
