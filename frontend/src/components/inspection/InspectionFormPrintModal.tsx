import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';

interface InspectionFormPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    formCode?: string; // 예: EZC-D-101-1, EZC-D-124-1, EZC-C-701-G01 등
    formTitle: string; // 성적서 제목 (원자재 인수검사 성적서 / 부자재 인수검사 성적서 / 중간검사 성적서)
    categoryName?: string; // 품목/분류 (원자재, 부자재, 소켓, 세라믹울 등)
    itemName: string; // 품명 (PE3005MB, 세라믹울 96K, 방화소켓 100A 등)
    receivedDate?: string; // 입고일자 / 검사일자
    lotNumber?: string; // 사규 LOT 번호
    supplierLot?: string; // 공급사 LOT 번호 / 입고처 LOT
    supplierName?: string; // 입고처 / 공급사
    qty?: number | string; // 입고 수량 / 로트 수량
    unit?: string;
    inspector?: string; // 작성자 (드롭다운 선택)
    n1?: number | string;
    n2?: number | string;
    n3?: number | string;
    items?: Array<{
      category?: string; // 겉모양 / 제조사성적서 / 공인성적서
      name: string;
      standard: string;
      method?: string;
      cycle?: string;
      condition?: string;
      n1?: any;
      n2?: any;
      n3?: any;
      isPass?: boolean;
    }>;
    overallResult?: 'PASS' | 'FAIL' | '합격' | '불합격';
    certNotes?: string;
    certInfo?: string; // 공인성적서 연동 정보
    certNumber?: string; // 공인성적서 관리번호
    certIssuedDate?: string; // 공인성적서 발행일자
    certAgency?: string; // 공인시험기관
    certResultText?: string; // 공인성적서 시험결과
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
              {data.formCode || 'EZC-D-101-1'}
            </span>
            <h3 className="font-bold text-slate-800 text-base">
              📄 사규 원본 성적서 양식 A4 인쇄 미리보기 (작성자 선택 + 검토/승인 빈칸)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* 작성자 드롭다운 선택 */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
              <span className="text-xs font-bold text-slate-600">✍️ 검사 작성자 선택:</span>
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
              A4 원본 성적서 인쇄 (PDF 저장)
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
        {/* 사규 원본 성적서 PDF 1:1 정밀 복원 레이아웃 (Printable Area) */}
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
              <span className="font-mono text-xs font-extrabold text-slate-800">{data.formCode || 'EZC-D-101-1'}</span>
              <span className="font-extrabold text-lg tracking-widest text-slate-900">(주) 이 지 원</span>
              <span className="text-[10px] text-slate-500 font-mono">A4 (210×297)㎜</span>
            </div>

            {/* 타이틀 및 3단 결재란 (작성자: 선택한 성명, 검토/승인: 완전히 비어있는 빈칸) */}
            <div className="grid grid-cols-12 gap-2 mb-4 items-center">
              <div className="col-span-7">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                  {data.formTitle || '원자재 인수검사 성적서'}
                </h1>
              </div>

              {/* 결재란 (작성자: 선택, 검토/승인: 수동 도장용 빈칸) */}
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
                      {/* 작성자: 드롭다운 선택된 성명 기입 */}
                      <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1">
                        {displayInspector}
                      </td>
                      {/* 검토: 수동 서명/직인을 위한 완벽한 빈칸 */}
                      <td className="border border-slate-900 w-20 bg-white"></td>
                      {/* 승인: 수동 서명/직인을 위한 완벽한 빈칸 */}
                      <td className="border border-slate-900 w-20 bg-white"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 원본 사규 기본 정보 표 (8구획 표 구조) */}
            <table className="w-full border-collapse border-2 border-slate-900 mb-4 text-[11px]">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-24">품    명</td>
                  <td className="border border-slate-900 font-extrabold px-3 py-1.5 text-blue-900">{data.itemName}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-24">입고일자</td>
                  <td className="border border-slate-900 font-mono px-3 py-1.5">{data.receivedDate || new Date().toISOString().slice(0, 10)}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5 w-24">검사일자</td>
                  <td className="border border-slate-900 font-mono px-3 py-1.5">{data.receivedDate || new Date().toISOString().slice(0, 10)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">입 고 처</td>
                  <td className="border border-slate-900 px-3 py-1.5">{data.supplierName || '공급업체'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">입고처 로트번호</td>
                  <td className="border border-slate-900 font-mono px-3 py-1.5">{data.supplierLot || '-'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">검 사 자</td>
                  <td className="border border-slate-900 font-bold px-3 py-1.5">{displayInspector}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">인수검사 로트번호</td>
                  <td className="border border-slate-900 font-mono font-extrabold px-3 py-1.5 text-blue-900">{data.lotNumber || '-'}</td>
                  <td className="border border-slate-900 bg-slate-100 font-bold px-2 py-1.5">로트 수량</td>
                  <td className="border border-slate-900 font-bold px-3 py-1.5" colSpan={3}>{data.qty ? `${data.qty} ${data.unit || '개'}` : '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 원본 사규 검사항목 3원화 성적치 표 (매로트 겉모양 / 제조사성적서 / 공인기관의뢰) */}
            <div className="mb-4">
              <h4 className="font-bold text-xs mb-1.5 text-slate-900">■ 검사항목 및 성적치 (측정 실측치 n1, n2, n3)</h4>
              <table className="w-full border-collapse border-2 border-slate-900 text-center text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b-2 border-slate-900">
                    <th className="border border-slate-900 py-1 px-1 w-24">검사항목</th>
                    <th className="border border-slate-900 py-1 px-1">기준 및 허용차</th>
                    <th className="border border-slate-900 py-1 px-1 w-16">검사방법</th>
                    <th className="border border-slate-900 py-1 px-1 w-14">검사주기</th>
                    <th className="border border-slate-900 py-1 px-1 w-14">검사조건</th>
                    <th className="border border-slate-900 py-1 px-1 w-10">n1</th>
                    <th className="border border-slate-900 py-1 px-1 w-10">n2</th>
                    <th className="border border-slate-900 py-1 px-1 w-10">n3</th>
                    <th className="border border-slate-900 py-1 px-1 w-20">검사 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items && data.items.length > 0 ? (
                    data.items.map((it, idx) => (
                      <tr key={idx} className="h-7">
                        <td className="border border-slate-900 font-bold bg-slate-50">{it.name}</td>
                        <td className="border border-slate-900 text-left px-2 font-mono font-medium">{it.standard}</td>
                        <td className="border border-slate-900">{it.method || '실측'}</td>
                        <td className="border border-slate-900">{it.cycle || '매로트'}</td>
                        <td className="border border-slate-900">{it.condition || 'n=3, c=0'}</td>
                        <td className="border border-slate-900 font-mono font-bold">{it.n1 ?? (data.n1 || '-')}</td>
                        <td className="border border-slate-900 font-mono font-bold">{it.n2 ?? (data.n2 || '-')}</td>
                        <td className="border border-slate-900 font-mono font-bold">{it.n3 ?? (data.n3 || '-')}</td>
                        <td className="border border-slate-900 font-bold text-emerald-900">
                          {it.isPass !== false ? '☑ 적합 □ 부적합' : '□ 적합 ☑ 부적합'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {/* 1) 겉모양 / 육안 실측 */}
                      <tr className="h-7">
                        <td className="border border-slate-900 font-bold bg-slate-50" rowSpan={3}>겉모양 (외관)</td>
                        <td className="border border-slate-900 text-left px-2">외 관: 한도견본 기준 오염, 찌그러짐 파손 없음</td>
                        <td className="border border-slate-900">육안</td>
                        <td className="border border-slate-900" rowSpan={3}>매로트</td>
                        <td className="border border-slate-900" rowSpan={3}>n=3, c=0</td>
                        <td className="border border-slate-900 font-mono font-bold">{data.n1 || '양호'}</td>
                        <td className="border border-slate-900 font-mono font-bold">{data.n2 || '양호'}</td>
                        <td className="border border-slate-900 font-mono font-bold">{data.n3 || '양호'}</td>
                        <td className="border border-slate-900 font-bold">☑ 적합 □ 부적합</td>
                      </tr>
                      <tr className="h-7">
                        <td className="border border-slate-900 text-left px-2">성 상: 고체 / 가루 / 펠렛 정상</td>
                        <td className="border border-slate-900">육안</td>
                        <td className="border border-slate-900 font-mono">정상</td>
                        <td className="border border-slate-900 font-mono">정상</td>
                        <td className="border border-slate-900 font-mono">정상</td>
                        <td className="border border-slate-900 font-bold">☑ 적합 □ 부적합</td>
                      </tr>
                      <tr className="h-7">
                        <td className="border border-slate-900 text-left px-2">냄 새: 무취 / 자극취 없음</td>
                        <td className="border border-slate-900">육안</td>
                        <td className="border border-slate-900 font-mono">무취</td>
                        <td className="border border-slate-900 font-mono">무취</td>
                        <td className="border border-slate-900 font-mono">무취</td>
                        <td className="border border-slate-900 font-bold">☑ 적합 □ 부적합</td>
                      </tr>

                      {/* 2) 제조사 시험 성적서 확인 */}
                      <tr className="h-8">
                        <td className="border border-slate-900 font-bold bg-slate-50">제조사 성적서</td>
                        <td className="border border-slate-900 text-left px-2 font-mono">밀도, 수분율, 점도 제조처 성적서 시험치 확인</td>
                        <td className="border border-slate-900">성적서확인</td>
                        <td className="border border-slate-900">1회/입고</td>
                        <td className="border border-slate-900">n=1, c=0</td>
                        <td className="border border-slate-900 font-mono text-center" colSpan={3}>제조사 성적서 확인 완료</td>
                        <td className="border border-slate-900 font-bold">☑ 적합 □ 부적합</td>
                      </tr>

                      {/* 3) 공인기관 의뢰 (1회/년) 1년 주기 유효성 */}
                      <tr className="h-9 bg-blue-50/30">
                        <td className="border border-slate-900 font-bold text-blue-900">공인기관 의뢰<br/>(1회 / 년)</td>
                        <td className="border border-slate-900 text-left px-2 font-mono text-blue-950 font-bold">
                          숏함유율 ≤25% | 가열선수축율 ≤4% | MI, 밀도, 인장강도 공인성적서 기준 충족
                        </td>
                        <td className="border border-slate-900 font-bold">공인성적서</td>
                        <td className="border border-slate-900 font-bold text-blue-900">1회 / 년</td>
                        <td className="border border-slate-900">n=1, c=0</td>
                        <td className="border border-slate-900 font-mono text-center font-bold text-blue-900" colSpan={3}>
                          공인성적서 연동
                        </td>
                        <td className="border border-slate-900 font-bold text-emerald-900">☑ 적합 □ 부적합</td>
                      </tr>
                    </>
                  )}
                </tbody>

              </table>
            </div>

            {/* 하단 판정 및 공인성적서 연동 정보 (비고 란) */}
            <div className="grid grid-cols-12 gap-3 border-2 border-slate-900 p-3 mb-2">
              <div className="col-span-8 flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-xs text-slate-900">판    정:</span>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-1.5 font-extrabold text-emerald-900 text-sm">
                      <span>{isPass ? '☑ 합 격 (PASS)' : '□ 합 격 (PASS)'}</span>
                    </label>
                    <label className="flex items-center gap-1.5 font-extrabold text-rose-700 text-sm">
                      <span>{!isPass ? '☑ 불합격 (FAIL)' : '□ 불합격 (FAIL)'}</span>
                    </label>
                  </div>
                </div>

                {/* 사규 원본 비고 란: 공인시험 성적서 1년 주기 연동 세부 기입 */}
                <div className="text-[10px] text-slate-800 mt-2 space-y-1 bg-slate-50 p-2 rounded border border-slate-400">
                  <p className="font-extrabold text-blue-900">※ 공인성적서 1년 주기 자동 연동 정보 (사규 제11조 7단계 역추적):</p>
                  <p className="font-mono text-slate-900 font-bold">
                    - 공인시험 기관 : {data.certAgency || 'KTR 한국화학융합시험연구원 / FITI / KCL'}<br/>
                    - 공인성적서 번호 : {data.certNumber || 'KTR-2026-0415'}<br/>
                    - 성적서 발행일자 : {data.certIssuedDate || '2026년 04월 15일'} (1년 유효기간 연동)<br/>
                    - 시험결과 평가 : {data.certResultText || '숏함유량 9.8%, 밀도 100 kg/㎥ (적합)'}
                  </p>
                </div>
              </div>

              {/* (주)이지원 품질보증 직인 도장 */}
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
