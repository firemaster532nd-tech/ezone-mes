import React, { useEffect } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

export interface OfficialFormPrintData {
  formNumber: string; // 'EZC B-201-1', 'EZC B-201-2', 'EZC B-201-3', 'EZC B-201-8', 'EZC B-201-9', 'EZC B-201-10', 'EZC B-201-11', 'EZC B-201-12', 'EZC B-201-13'
  formTitle: string;
  date: string;
  worker: string;
  equipNo?: string;
  stopReason?: string;
  qualityRemarks?: string;
  items: any[];
  extraConfig?: any;
}

interface Props {
  data: OfficialFormPrintData;
  onClose: () => void;
  autoPrint?: boolean;
}

export function OfficialFormPrinter({ data, onClose, autoPrint = true }: Props) {
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const tdBorder: React.CSSProperties = {
    border: '1px solid black',
    padding: '4px 6px',
    fontSize: '11px',
    color: '#000',
  };

  const thBorder: React.CSSProperties = {
    ...tdBorder,
    backgroundColor: '#f1f5f9',
    fontWeight: 700,
    textAlign: 'center',
  };

  const [year, month, day] = (data.date || '').split('-');

  // 15~20행 채우기
  const padRows = (arr: any[], count: number) => {
    const padded = [...(arr || [])];
    while (padded.length < count) {
      padded.push({});
    }
    return padded;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative print:p-0 print:shadow-none print:max-w-none">
        {/* 상단 컨트롤 버튼 (인쇄 시 숨김) */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              작성 완료! 실물 사규 양치 인쇄 미리보기 [{data.formNumber}]
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition text-sm"
            >
              <Printer className="w-4 h-4" />
              즉시 인쇄 (A4)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* ═══ 실물 사규 A4 종이 렌더링 영역 ═══ */}
        <div
          id="official-form-paper"
          style={{
            width: '100%',
            maxWidth: '210mm',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: 'Malgun Gothic, NanumGothic, Dotum, sans-serif',
            fontSize: '11px',
            lineHeight: 1.3,
            padding: '10mm 8mm',
            boxSizing: 'border-box',
          }}
        >
          {/* 헤더 & 결재란 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
            <tbody>
              <tr>
                <td style={{ ...tdBorder, width: '110px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                  (주) 이지원
                </td>
                <td style={{ ...tdBorder, textAlign: 'center', fontSize: '18px', fontWeight: 900, letterSpacing: '2px' }}>
                  {data.formTitle}
                </td>
                <td style={{ ...tdBorder, padding: 0, width: '190px', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ ...thBorder, width: '24px', writingMode: 'vertical-lr', padding: '4px' }}>
                          결재
                        </td>
                        <td style={{ border: '1px solid black', padding: 0, textAlign: 'center', width: '55px' }}>
                          <div style={{ borderBottom: '1px solid black', fontSize: '10px', padding: '2px' }}>작 성</div>
                          <div style={{ height: '36px', display: 'flex', itemsAlign: 'center', justifyContent: 'center', paddingTop: '10px' }}>
                            {data.worker}
                          </div>
                        </td>
                        <td style={{ border: '1px solid black', padding: 0, textAlign: 'center', width: '55px' }}>
                          <div style={{ borderBottom: '1px solid black', fontSize: '10px', padding: '2px' }}>검 토</div>
                          <div style={{ height: '36px' }}></div>
                        </td>
                        <td style={{ border: '1px solid black', padding: 0, textAlign: 'center', width: '55px' }}>
                          <div style={{ borderBottom: '1px solid black', fontSize: '10px', padding: '2px' }}>승 인</div>
                          <div style={{ height: '36px' }}></div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 설비번호 & 생산일자 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '11px', fontWeight: 'bold' }}>
            <div>
              {data.equipNo && <span>설비번호: {data.equipNo}</span>}
            </div>
            <div>
              생산일자 : &nbsp; {year || '202    '} 년 &nbsp; {month || '  '} 월 &nbsp; {day || '  '} 일
            </div>
          </div>

          {/* 1. EZC B-201-1 배합생산일지 양식 */}
          {data.formNumber === 'EZC B-201-1' && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>■ 배합생산현황 (단위 : 중량(kg))</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thBorder, width: '40px' }}>No</th>
                    <th style={{ ...thBorder, width: '140px' }}>생산LOT No.</th>
                    <th style={{ ...thBorder, width: '90px' }}>시작시간</th>
                    <th style={{ ...thBorder, width: '90px' }}>종료시간</th>
                    <th style={{ ...thBorder }}>용도</th>
                    <th style={{ ...thBorder, width: '80px' }}>투입량</th>
                    <th style={{ ...thBorder }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {padRows(data.items, 16).map((item, i) => (
                    <tr key={i} style={{ height: '22px' }}>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {item.lotNumber || ''}
                      </td>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{item.startTime || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{item.endTime || ''}</td>
                      <td style={{ ...tdBorder }}>{item.usage || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>
                        {item.inputKg ? `${item.inputKg}` : ''}
                      </td>
                      <td style={{ ...tdBorder }}>{item.remarks || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 2. EZC B-201-2 압출생산일지 양식 */}
          {data.formNumber === 'EZC B-201-2' && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thBorder, width: '40px' }}>순번</th>
                    <th style={{ ...thBorder, width: '140px' }}>투입 생산 LOT 번호</th>
                    <th style={{ ...thBorder, width: '70px' }}>배합(㎏)</th>
                    <th style={{ ...thBorder }}>규격</th>
                    <th style={{ ...thBorder, width: '90px' }}>생산길이(m)</th>
                    <th style={{ ...thBorder, width: '80px' }}>생산량</th>
                    <th style={{ ...thBorder, width: '70px' }}>더미(㎏)</th>
                    <th style={{ ...thBorder }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {padRows(data.items, 18).map((item, i) => (
                    <tr key={i} style={{ height: '22px' }}>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {item.mixLotNumber || ''}
                      </td>
                      <td style={{ ...tdBorder, textAlign: 'right' }}>{item.mixKg ? `${item.mixKg}` : ''}</td>
                      <td style={{ ...tdBorder }}>{item.spec || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>
                        {item.lengthMeters ? `${item.lengthMeters}` : ''}
                      </td>
                      <td style={{ ...tdBorder, textAlign: 'right' }}>{item.outputKg ? `${item.outputKg}` : ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'right' }}>{item.dummyKg ? `${item.dummyKg}` : ''}</td>
                      <td style={{ ...tdBorder }}>{item.remarks || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 3. EZC B-201-12 / 13 재단생산일지 양식 */}
          {(data.formNumber === 'EZC B-201-12' || data.formNumber === 'EZC B-201-13' || data.formNumber === 'EZC B-201-14') && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '6px', fontSize: '10px', fontWeight: 'bold' }}>
                <span>□ 입상 (폭:300)</span>
                <span>□ 벽체 (폭:200)</span>
                <span>□ 틈새 (폭:200)</span>
                <span>□ 틈새 (폭:150)</span>
                <span>■ 규격: 두께 25T</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thBorder, width: '35px' }} rowSpan={2}>No</th>
                    <th style={{ ...thBorder }} rowSpan={2}>구조명</th>
                    <th style={{ ...thBorder }} colSpan={2}>규격 (㎜)</th>
                    <th style={{ ...thBorder, width: '130px' }} rowSpan={2}>인수검사 로트번호</th>
                    <th style={{ ...thBorder, width: '70px' }} rowSpan={2}>밀도(K)</th>
                    <th style={{ ...thBorder, width: '75px' }} rowSpan={2}>생산수량</th>
                    <th style={{ ...thBorder }} rowSpan={2}>비 고</th>
                  </tr>
                  <tr>
                    <th style={{ ...thBorder, width: '55px' }}>가로</th>
                    <th style={{ ...thBorder, width: '55px' }}>세로</th>
                  </tr>
                </thead>
                <tbody>
                  {padRows(data.items, 15).map((item, i) => (
                    <tr key={i} style={{ height: '22px' }}>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ ...tdBorder, fontWeight: 'bold' }}>{item.structName || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.widthMm || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.lengthMm || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.incomingLot || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{item.densityK ? `${item.densityK}` : ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>{item.qty ? `${item.qty}` : ''}</td>
                      <td style={{ ...tdBorder }}>{item.remarks || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 4. 조립생산일지 양식 (EZC B-201-3/8/9/10/11) */}
          {(data.formNumber.startsWith('EZC B-201-3') ||
            data.formNumber.startsWith('EZC B-201-8') ||
            data.formNumber.startsWith('EZC B-201-9') ||
            data.formNumber.startsWith('EZC B-201-10') ||
            data.formNumber.startsWith('EZC B-201-11')) && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thBorder, width: '35px' }}>no</th>
                    <th style={{ ...thBorder }}>규격 / 구조명</th>
                    <th style={{ ...thBorder, width: '55px' }}>투입량</th>
                    <th style={{ ...thBorder, width: '60px' }}>생산수량</th>
                    <th style={{ ...thBorder, width: '130px' }}>생산 LOT 번호</th>
                    <th style={{ ...thBorder, width: '110px' }}>소켓/슬리브 LOT</th>
                    <th style={{ ...thBorder, width: '110px' }}>차열시트 LOT</th>
                    <th style={{ ...thBorder, width: '110px' }}>차열재/철판 LOT</th>
                  </tr>
                </thead>
                <tbody>
                  {padRows(data.items, 15).map((item, i) => (
                    <tr key={i} style={{ height: '22px' }}>
                      <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ ...tdBorder, fontWeight: 'bold' }}>{item.structName || item.product_name || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'right' }}>{item.inputQty || '1'}</td>
                      <td style={{ ...tdBorder, textAlign: 'right', fontWeight: 'bold' }}>{item.qty || item.produced_qty || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.jlot_number || item.lotNumber || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.socketLot || item.sleeveLot || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.sheetLot || ''}</td>
                      <td style={{ ...tdBorder, textAlign: 'center', fontFamily: 'monospace' }}>{item.woolLot || item.steelLot || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 하단 공통 비고 & 조치사항 */}
          <div style={{ border: '1px solid black', padding: '6px', minHeight: '40px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '2px' }}>
              ☐ 품질적 특이사항 및 조치사항 / 생산정지 사유
            </div>
            <div style={{ fontSize: '11px' }}>{data.stopReason || data.qualityRemarks || '특이사항 없음.'}</div>
          </div>

          {/* 하단 서식 꼬리표 (EZC 문서번호 표준) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
            <span>{data.formNumber}</span>
            <span>(주)이지원</span>
            <span>A4(210⨯297)㎜</span>
          </div>
        </div>

        {/* 인쇄 스타일 */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #official-form-paper, #official-form-paper * { visibility: visible !important; }
            #official-form-paper {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 10mm 10mm !important;
              box-shadow: none !important;
            }
            .fixed.inset-0 {
              position: static !important;
              background: white !important;
            }
            @page {
              size: A4 portrait;
              margin: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
