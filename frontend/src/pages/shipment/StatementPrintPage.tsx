import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Printer, X } from 'lucide-react';

interface StatementItem {
  statement_item_id: number;
  item_name: string;
  spec: string | null;
  unit: string;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  remarks: string | null;
}

interface StatementDetail {
  statement_id: number;
  statement_number: string;
  statement_date: string;
  customer_id: number;
  company_name: string;
  company_code: string;
  ceo_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  
  supplier_name: string;
  supplier_ceo: string;
  supplier_no: string;
  supplier_addr: string;
  supplier_phone: string;
  
  total_qty: number;
  total_amount: number;
  total_vat: number;
  remarks: string | null;
  items: StatementItem[];
}

export function StatementPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get<{ data: StatementDetail }>(`/statements/${id}`);
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  // 숫자를 한글 금액으로 변환하는 함수 (예: 1250000 -> 일백이십오만)
  const convertNumberToKorean = (num: number): string => {
    if (num === 0) return '영';
    const units = ['', '만', '억', '조'];
    const nums = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const smallUnits = ['', '십', '백', '천'];
    
    let result = '';
    let unitCount = 0;
    
    while (num > 0) {
      const chunk = num % 10000;
      num = Math.floor(num / 10000);
      
      if (chunk === 0) {
        unitCount++;
        continue;
      }
      
      let chunkStr = '';
      let temp = chunk;
      for (let i = 0; i < 4; i++) {
        const digit = temp % 10;
        temp = Math.floor(temp / 10);
        
        if (digit > 0) {
          chunkStr = nums[digit] + smallUnits[i] + chunkStr;
        }
      }
      
      // 일십 -> 십, 일백 -> 백 등으로 변환 (맨 앞자리 '일' 생략)
      chunkStr = chunkStr.replace(/^일(십|백|천)/, '$1');
      
      result = chunkStr + units[unitCount] + result;
      unitCount++;
    }
    
    return result;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-semibold">거래명세표 인쇄 양식을 구성 중입니다...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500 font-semibold">명세서 데이터를 찾을 수 없습니다.</div>;
  }

  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const koreanAmount = convertNumberToKorean(grandTotal);

  // 출력 행수 맞춤 (A4 한 장 비율을 유지하기 위해 최소 10개의 행을 채움)
  const minRows = 10;
  const paddingRowsCount = Math.max(0, minRows - data.items.length);
  const paddingRows = Array.from({ length: paddingRowsCount });

  return (
    <div className="bg-gray-100 min-h-screen py-6 print:bg-white print:py-0">
      {/* Top Floating Print Controls (Hidden on Print) */}
      <div className="max-w-[800px] mx-auto mb-4 bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          <span className="text-sm font-semibold text-gray-700">거래명세서 출력 미리보기 (A4 레이아웃)</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow transition-colors"
          >
            <Printer className="h-4 w-4" />
            인쇄 실행 (Print)
          </button>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4" />
            창 닫기
          </button>
        </div>
      </div>

      {/* Actual A4 Printable Sheet Container */}
      <div className="a4-sheet max-w-[800px] mx-auto bg-white p-8 border border-gray-300 shadow-lg print:border-none print:shadow-none print:p-0">
        
        {/* Style block for precise print overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a4-sheet {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
        `}} />

        {/* 1. Header Title */}
        <div className="text-center relative mb-8">
          <h1 className="text-3xl font-extrabold tracking-[0.4em] underline underline-offset-8 decoration-double decoration-gray-400 text-gray-900 print:text-black">
            거래명세서
          </h1>
          <div className="absolute right-0 top-1 text-xs text-gray-500 border border-gray-300 px-2.5 py-1 font-mono rounded">
            일련번호: {data.statement_number}
          </div>
        </div>

        {/* 2. Supplier & Customer Block (Grid Layout) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 공급받는자 (우측 정렬 혹은 좌측 배치) */}
          <div className="border border-gray-300 p-3 rounded space-y-2">
            <div className="text-xs font-bold text-blue-600 print:text-black border-b pb-1 flex justify-between">
              <span>공급받는 자</span>
              <span>貴中</span>
            </div>
            <div className="space-y-1 text-xs text-gray-800">
              <div className="flex"><span className="w-16 font-semibold text-gray-400">등록번호:</span> <span className="font-bold">{data.company_code}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">상호명:</span> <span className="font-bold text-gray-900">{data.company_name}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">대표자:</span> <span>{data.ceo_name || '-'}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">소재지:</span> <span className="flex-1">{data.customer_address || '-'}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">전화번호:</span> <span>{data.customer_phone || '-'}</span></div>
            </div>
          </div>

          {/* 공급자 (이지원) */}
          <div className="border border-gray-300 p-3 rounded space-y-2 relative">
            <div className="text-xs font-bold text-emerald-600 print:text-black border-b pb-1">
              공급자
            </div>
            {/* Stamp Seal Image Placeholder */}
            <div className="absolute right-4 bottom-4 w-12 h-12 border-2 border-red-500/30 rounded-full flex items-center justify-center text-[10px] font-bold text-red-500/40 rotate-12 print:border-red-600 print:text-red-600">
              이지원(인)
            </div>
            <div className="space-y-1 text-xs text-gray-800">
              <div className="flex"><span className="w-16 font-semibold text-gray-400">등록번호:</span> <span className="font-bold">{data.supplier_no}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">상호명:</span> <span className="font-bold text-gray-900">{data.supplier_name}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">대표자:</span> <span>{data.supplier_ceo}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">소재지:</span> <span className="flex-1">{data.supplier_addr}</span></div>
              <div className="flex"><span className="w-16 font-semibold text-gray-400">연락처:</span> <span>{data.supplier_phone}</span></div>
            </div>
          </div>
        </div>

        {/* 3. Transaction Date & Sum Header */}
        <div className="flex items-center justify-between border-t-2 border-b border-gray-800 bg-gray-50/50 py-2.5 px-4 mb-4 text-xs">
          <div>
            거래일자: <span className="font-bold text-gray-900">{data.statement_date}</span>
          </div>
          <div className="font-semibold">
            합계금액 (공급가액 + 세액): <span className="text-sm font-bold text-blue-700 print:text-black">일금 {koreanAmount} 원정</span> (₩{new Intl.NumberFormat('ko-KR').format(grandTotal)})
          </div>
        </div>

        {/* 4. Detail Table Sheet */}
        <div className="border border-gray-300 rounded overflow-hidden mb-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold text-center">
                <th className="py-2.5 border-r border-gray-300 w-8">No</th>
                <th className="py-2.5 border-r border-gray-300">품목 및 규격</th>
                <th className="py-2.5 border-r border-gray-300 w-12">단위</th>
                <th className="py-2.5 border-r border-gray-300 w-16 text-right px-2">수량</th>
                <th className="py-2.5 border-r border-gray-300 w-24 text-right px-2">단가 (원)</th>
                <th className="py-2.5 border-r border-gray-300 w-28 text-right px-2">공급가액</th>
                <th className="py-2.5 border-r border-gray-300 w-20 text-right px-2">세액 (VAT)</th>
                <th className="py-2.5 w-32 px-2 text-left">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item, idx) => (
                <tr key={item.statement_item_id} className="text-gray-800 font-medium">
                  <td className="py-2 text-center border-r border-gray-200 text-gray-400">{idx + 1}</td>
                  <td className="py-2 px-2 border-r border-gray-200 text-gray-900 font-semibold">
                    {item.item_name} {item.spec ? `[${item.spec}]` : ''}
                  </td>
                  <td className="py-2 text-center border-r border-gray-200">{item.unit}</td>
                  <td className="py-2 text-right px-2 border-r border-gray-200 font-bold">
                    {new Intl.NumberFormat('ko-KR').format(item.qty)}
                  </td>
                  <td className="py-2 text-right px-2 border-r border-gray-200 text-gray-600">
                    {new Intl.NumberFormat('ko-KR').format(item.unit_price)}
                  </td>
                  <td className="py-2 text-right px-2 border-r border-gray-200 font-bold text-gray-900">
                    {new Intl.NumberFormat('ko-KR').format(item.amount)}
                  </td>
                  <td className="py-2 text-right px-2 border-r border-gray-200 text-gray-500">
                    {new Intl.NumberFormat('ko-KR').format(item.vat)}
                  </td>
                  <td className="py-2 px-2 text-gray-500 truncate max-w-[120px]">{item.remarks || '-'}</td>
                </tr>
              ))}
              {/* 패딩 행들 (비율 조정을 위한 빈 칸) */}
              {paddingRows.map((_, idx) => (
                <tr key={`pad-${idx}`} className="h-7 border-t border-gray-200">
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td className="border-r border-gray-200"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
            {/* 합계 하단부 */}
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-300 font-bold text-gray-900">
                <td colSpan={3} className="py-2 text-center border-r border-gray-300">합 계</td>
                <td className="py-2 text-right px-2 border-r border-gray-300">{new Intl.NumberFormat('ko-KR').format(data.total_qty)}</td>
                <td className="py-2 border-r border-gray-300"></td>
                <td className="py-2 text-right px-2 border-r border-gray-300">{new Intl.NumberFormat('ko-KR').format(data.total_amount)}</td>
                <td className="py-2 text-right px-2 border-r border-gray-300">{new Intl.NumberFormat('ko-KR').format(data.total_vat)}</td>
                <td className="py-2 text-right px-2 font-extrabold text-blue-800 print:text-black">
                  ₩{new Intl.NumberFormat('ko-KR').format(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. Remarks & Bottom Notes (웰스홈 명세표 스타일) */}
        <div className="border border-gray-300 rounded p-4 bg-gray-50/50 text-xs text-gray-700 print:bg-white print:text-black">
          <div className="font-bold text-gray-900 mb-1 border-b pb-1">
            ■ 비고 및 안내사항 (Remarks)
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">
            {data.remarks || '특이사항 없음'}
          </div>
        </div>

        {/* 6. Signature / Receipt Confirmation Box */}
        <div className="mt-8 flex justify-end gap-12 text-xs font-semibold">
          <div className="text-center">
            <span className="text-gray-400 block mb-4">인수자 확인</span>
            <span className="border-b border-gray-400 px-6 py-1">서명 또는 (인)</span>
          </div>
          <div className="text-center">
            <span className="text-gray-400 block mb-4">인도자 확인</span>
            <span className="border-b border-gray-400 px-6 py-1">서명 또는 (인)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
