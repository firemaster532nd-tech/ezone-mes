import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Printer, X } from 'lucide-react';

interface QuotationItem {
  quotation_item_id: number;
  item_code: string;
  item_name: string;
  spec: string | null;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  remarks: string | null;
}

interface QuotationDetail {
  quotation_id: number;
  quotation_number: string;
  quotation_date: string;
  customer_id: number;
  company_name: string;
  customer_business_no: string | null;
  customer_ceo: string | null;
  customer_phone: string | null;
  customer_addr: string | null;
  project_code: string | null;
  manager_name: string | null;
  tax_type: 'TAX_INCLUDED' | 'TAX_EXCLUDED' | 'FREE';
  currency: string;
  delivery_date: string | null;
  remarks: string | null;
  total_qty: number;
  total_amount: number;
  total_vat: number;
  status: string;
  items: QuotationItem[];
}

// 한글 금액 변환 헬퍼 함수
function convertNumberToKoreanWon(num: number): string {
  if (num === 0) return '영';
  const units = ['', '만', '억', '조'];
  const nums = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const smallUnits = ['', '십', '백', '천'];
  
  let result = '';
  let unitIndex = 0;
  
  let tempNum = num;
  while (tempNum > 0) {
    const chunk = tempNum % 10000;
    tempNum = Math.floor(tempNum / 10000);
    
    if (chunk === 0) {
      unitIndex++;
      continue;
    }
    
    let chunkResult = '';
    let tempChunk = chunk;
    let place = 0;
    
    while (tempChunk > 0) {
      const digit = tempChunk % 10;
      tempChunk = Math.floor(tempChunk / 10);
      
      if (digit > 0) {
        // 일십, 일백 등에서 '일'은 생략하는 경우 처리
        const digitStr = (digit === 1 && place > 0) ? '' : nums[digit];
        chunkResult = digitStr + smallUnits[place] + chunkResult;
      }
      place++;
    }
    
    result = chunkResult + units[unitIndex] + result;
    unitIndex++;
  }
  
  return result + ' 원정';
}

export function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: QuotationDetail }>(`/quotations/${id}`)
      .then((res) => {
        setData(res.data.data);
      })
      .catch((e) => {
        toast.error('견적 상세 데이터를 가져오지 못했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 text-slate-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="font-semibold text-sm">인쇄 데이터를 로딩 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 text-red-600">
        <div className="text-center font-bold">견적서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const grandTotal = Number(data.total_amount) + Number(data.total_vat);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased p-0 sm:p-6 print:p-0 print:bg-white">
      {/* 상단 액션 바 (인쇄 시 숨김) */}
      <div className="max-w-[800px] mx-auto mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between no-print print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-sm">견적 인쇄 미리보기</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
            {data.quotation_number}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer className="h-4 w-4" />
            인쇄 (Print)
          </button>
          <button
            onClick={handleClose}
            className="flex items-center gap-1 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
          >
            <X className="h-4 w-4" />
            창 닫기
          </button>
        </div>
      </div>

      {/* A4 용지 영역 */}
      <div className="max-w-[800px] mx-auto bg-white border border-slate-300 shadow-lg p-10 print:shadow-none print:border-none print:p-0 flex flex-col justify-between min-h-[1050px]">
        <div>
          {/* 대제목 */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold tracking-widest border-b-4 border-slate-800 pb-2 inline-block px-12">
              견 적 서
            </h1>
          </div>

          {/* 공급자 / 공급받는자 영역 */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* 공급받는자 (왼쪽) */}
            <div className="border border-slate-300 p-4 rounded-lg flex flex-col justify-between">
              <div>
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                  공급받는자 (귀하)
                </div>
                <div className="text-lg font-bold text-slate-900 border-b border-dashed pb-1.5 mb-2.5">
                  {data.company_name} 귀중
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex">
                  <span className="w-16 font-semibold text-slate-400">참 조:</span>
                  <span className="text-slate-800 font-bold">{data.manager_name || '구매담당자 귀하'}</span>
                </div>
                <div className="flex">
                  <span className="w-16 font-semibold text-slate-400">현 장 명:</span>
                  <span className="text-slate-800 font-bold">{data.project_code || '일반 현장'}</span>
                </div>
                <div className="flex">
                  <span className="w-16 font-semibold text-slate-400">견적일자:</span>
                  <span className="text-slate-800 font-mono">{data.quotation_date}</span>
                </div>
                <div className="flex">
                  <span className="w-16 font-semibold text-slate-400">견적번호:</span>
                  <span className="text-slate-800 font-mono">{data.quotation_number}</span>
                </div>
              </div>
            </div>

            {/* 공급자 (오른쪽) */}
            <table className="w-full border-collapse border border-slate-300 text-xs text-left">
              <tbody>
                <tr>
                  <td rowSpan={5} className="w-6 border border-slate-300 bg-slate-50 text-center font-bold text-slate-500 py-2 leading-tight">
                    공<br/>급<br/>자
                  </td>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500 w-20">등록번호</td>
                  <td colSpan={3} className="px-2.5 py-1.5 border border-slate-300 font-bold font-mono text-sm">137-81-70092</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">상 호</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 font-bold">㈜이지원테크</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500 w-12">대 표</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 font-bold text-center relative w-16">
                    홍길동
                    {/* 도장/인감 도트 이미지 표시용 */}
                    <div className="absolute right-0.5 top-0 w-8 h-8 rounded-full border border-red-500/30 flex items-center justify-center text-[6px] text-red-500 font-bold rotate-12 select-none pointer-events-none opacity-80">
                      이지원印
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">주 소</td>
                  <td colSpan={3} className="px-2.5 py-1.5 border border-slate-300 text-slate-700">
                    경기도 김포시 통진읍 옹정리 123-45
                  </td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">업 태</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 text-slate-700">제조업</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">종 목</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 text-slate-700">방화문부재</td>
                </tr>
                <tr>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">전화번호</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 font-mono">031-987-6543</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 bg-slate-50/50 font-semibold text-slate-500">팩 스</td>
                  <td className="px-2.5 py-1.5 border border-slate-300 font-mono">031-987-6544</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 총 합계금액 명시 판넬 */}
          <div className="bg-slate-900 text-white rounded-lg px-6 py-4.5 mb-6 flex justify-between items-center shadow-md print:shadow-none">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">합계금액 (공급가액 + 부가세)</span>
              <span className="text-xl font-extrabold tracking-wide">
                일금 {convertNumberToKoreanWon(grandTotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-mono font-normal">G.Total (KRW)</span>
              <div className="text-2xl font-black font-mono">
                ₩{grandTotal.toLocaleString()}
              </div>
            </div>
          </div>

          {/* 견적 명세 테이블 */}
          <table className="w-full border-collapse border border-slate-300 text-left text-xs mb-8">
            <thead>
              <tr className="border border-slate-300 bg-slate-100 text-slate-700 font-bold text-center">
                <th className="px-2.5 py-2.5 border border-slate-300 w-10">번호</th>
                <th className="px-2.5 py-2.5 border border-slate-300">품목코드</th>
                <th className="px-2.5 py-2.5 border border-slate-300">품목명</th>
                <th className="px-2.5 py-2.5 border border-slate-300 w-24">규격</th>
                <th className="px-2.5 py-2.5 border border-slate-300 w-16 text-right">수량</th>
                <th className="px-2.5 py-2.5 border border-slate-300 w-24 text-right">단가(원)</th>
                <th className="px-2.5 py-2.5 border border-slate-300 w-28 text-right">공급가액(원)</th>
                <th className="px-2.5 py-2.5 border border-slate-300 w-24 text-right">세액(원)</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row, idx) => (
                <tr key={row.quotation_item_id} className="hover:bg-slate-50">
                  <td className="px-2.5 py-2 border border-slate-300 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="px-2.5 py-2 border border-slate-300 font-mono font-semibold text-blue-700">{row.item_code}</td>
                  <td className="px-2.5 py-2 border border-slate-300 font-bold text-slate-800">{row.item_name}</td>
                  <td className="px-2.5 py-2 border border-slate-300 text-center font-mono text-slate-600 bg-slate-50/30">{row.spec || '-'}</td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right font-mono font-medium text-slate-800">{row.qty.toLocaleString()}</td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right font-mono text-slate-500">₩{row.unit_price.toLocaleString()}</td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right font-mono font-bold text-slate-800">₩{row.amount.toLocaleString()}</td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right font-mono text-slate-500">₩{row.vat.toLocaleString()}</td>
                </tr>
              ))}
              
              {/* 공백 행 패딩 (A4 비율 맞춤용) */}
              {data.items.length < 8 && Array.from({ length: 8 - data.items.length }).map((_, idx) => (
                <tr key={`pad-${idx}`} className="h-8">
                  <td className="px-2.5 py-2 border border-slate-300 text-center font-mono text-slate-300">{data.items.length + idx + 1}</td>
                  <td className="px-2.5 py-2 border border-slate-300"></td>
                  <td className="px-2.5 py-2 border border-slate-300"></td>
                  <td className="px-2.5 py-2 border border-slate-300"></td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right"></td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right"></td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right"></td>
                  <td className="px-2.5 py-2 border border-slate-300 text-right"></td>
                </tr>
              ))}

              {/* 소계 / 합계 행 */}
              <tr className="bg-slate-50 font-bold border border-slate-300 text-center">
                <td colSpan={4} className="px-2.5 py-2.5 border border-slate-300 text-slate-500 font-semibold">소계 (Sub Total)</td>
                <td className="px-2.5 py-2.5 border border-slate-300 text-right font-mono text-slate-800">{data.total_qty.toLocaleString()}</td>
                <td className="px-2.5 py-2.5 border border-slate-300 text-right"></td>
                <td className="px-2.5 py-2.5 border border-slate-300 text-right font-mono text-slate-900">₩{Number(data.total_amount).toLocaleString()}</td>
                <td className="px-2.5 py-2.5 border border-slate-300 text-right font-mono text-slate-500">₩{Number(data.total_vat).toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-100 font-bold border border-slate-300 text-center">
                <td colSpan={4} className="px-2.5 py-3 border border-slate-300 text-slate-600 text-sm">합계금액 (G.Total - 부가세 포함)</td>
                <td colSpan={4} className="px-2.5 py-3 border border-slate-300 text-right font-mono text-base text-blue-700 bg-blue-50/30">
                  ₩{grandTotal.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 하단 비고 및 조건 서명란 */}
        <div className="border-t border-slate-800 pt-6">
          <div className="grid grid-cols-4 gap-4.5 text-[11px] text-slate-600 leading-relaxed">
            <div className="col-span-3">
              <div className="font-bold text-slate-800 mb-1">【 견적 조건 및 특이사항 】</div>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>과세 구분: {data.tax_type === 'TAX_EXCLUDED' ? '부가세 별도 (10%)' : data.tax_type === 'TAX_INCLUDED' ? '부가세 포함' : '면세'}</li>
                <li>본 견적은 견적일로부터 30일간 유효합니다.</li>
                <li>납기 기한: {data.delivery_date || '협의 결정'}</li>
                {data.remarks && <li className="font-bold text-slate-900">특기 사항: {data.remarks}</li>}
              </ul>
            </div>
            <div className="border border-slate-300 rounded p-2 text-center flex flex-col justify-between h-20 bg-slate-50/30">
              <span className="font-semibold text-slate-400">인수 확인</span>
              <div className="text-[10px] text-slate-400 mt-2 font-medium">서명 또는 날인</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
