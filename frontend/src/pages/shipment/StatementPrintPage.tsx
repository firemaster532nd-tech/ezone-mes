import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Printer, X, FileText, LayoutList, AlertTriangle } from 'lucide-react';

const TOKEN_KEY = 'ezone_mes_token';

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
  // 자동연산형 추가 필드
  density?: string | null;    // 밀도 (예: 24K, 96K)
  thickness?: string | null;  // 두께 (예: 25T, 50T)
  width_mm?: number | null;   // 가로 (mm)
  length_mm?: number | null;  // 세로 (mm)
  group_no?: number | null;   // 구조 그룹번호 (자동연산형)
  is_group_header?: boolean;  // 구조 그룹 헤더 여부
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
  recipient_name?: string | null;   // 수신자 (수     신:)
  handler_name?: string | null;     // 인수자
  contact_phone?: string | null;    // 연락처

  supplier_name: string;
  supplier_ceo: string;
  supplier_no: string;
  supplier_addr: string;
  supplier_phone: string;
  supplier_fax?: string | null;
  supplier_email?: string | null;

  total_qty: number;
  total_amount: number;
  total_vat: number;
  remarks: string | null;
  delivery_location?: string | null; // 납품장소
  items: StatementItem[];
}

// 숫자 → 한글 금액 변환
function numToKorean(num: number): string {
  if (!num || num === 0) return '영';
  const units = ['', '만', '억', '조'];
  const nums = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const small = ['', '십', '백', '천'];
  let result = '';
  let unitCount = 0;
  let n = num;
  while (n > 0) {
    const chunk = n % 10000;
    n = Math.floor(n / 10000);
    if (chunk === 0) { unitCount++; continue; }
    let str = '';
    let tmp = chunk;
    for (let i = 0; i < 4; i++) {
      const d = tmp % 10;
      tmp = Math.floor(tmp / 10);
      if (d > 0) str = nums[d] + small[i] + str;
    }
    str = str.replace(/^일(십|백|천)/, '$1');
    result = str + units[unitCount] + result;
    unitCount++;
  }
  return result;
}

const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공급자 / 공급받는자 블록 (공통)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SupplierBlock({ data }: { data: StatementDetail }) {
  return (
    <table className="w-full border border-black text-[10px] mb-0" style={{ borderCollapse: 'collapse' }}>
      <tbody>
        {/* 수 신 */}
        <tr>
          <td className="border border-black px-2 py-1 font-bold bg-gray-100 w-[80px] whitespace-nowrap">수&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;신</td>
          <td className="border border-black px-2 py-1 font-bold" colSpan={3}>{data.company_name} 貴中</td>
          <td className="border border-black px-1 py-0.5 align-middle text-center font-black text-[9px] bg-gray-100 w-[30px]" rowSpan={5}>
            <div style={{ writingMode: 'vertical-rl', letterSpacing: '0.3em', fontSize: '11px', fontWeight: 900 }}>공급자</div>
          </td>
          <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold w-[60px] whitespace-nowrap text-[9px]">사업자번호</td>
          <td className="border border-black px-2 py-0.5 font-mono font-bold" colSpan={2}>{data.supplier_no}</td>
        </tr>
        <tr>
          <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap">인&nbsp;수&nbsp;자</td>
          <td className="border border-black px-2 py-1" colSpan={3}>{data.handler_name || ''}</td>
          <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">상&nbsp;&nbsp;&nbsp;&nbsp;호</td>
          <td className="border border-black px-2 py-0.5 font-bold">{data.supplier_name}</td>
          <td className="border border-black px-2 py-0.5 text-[9px]">성명&nbsp;<span className="font-bold">{data.supplier_ceo}</span></td>
        </tr>
        <tr>
          <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap">연&nbsp;락&nbsp;처</td>
          <td className="border border-black px-2 py-1" colSpan={3}>{data.contact_phone || data.customer_phone || ''}</td>
          <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">주&nbsp;&nbsp;&nbsp;&nbsp;소</td>
          <td className="border border-black px-2 py-0.5" colSpan={2}>{data.supplier_addr}</td>
        </tr>
        <tr>
          <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap" rowSpan={2}>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
          <td className="border border-black px-2 py-1 align-top text-[9px]" colSpan={3} rowSpan={2}>
            {data.remarks || ''}
          </td>
          <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
          <td className="border border-black px-2 py-0.5">제조업, 도소매</td>
          <td className="border border-black px-2 py-0.5 text-[9px]">종목&nbsp;<span className="font-bold">방화재관련건설자재</span></td>
        </tr>
        <tr>
          <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">전&nbsp;&nbsp;&nbsp;&nbsp;화</td>
          <td className="border border-black px-2 py-0.5">{data.supplier_phone}</td>
          <td className="border border-black px-2 py-0.5 text-[9px]">FAX&nbsp;<span className="font-bold">{data.supplier_fax || '02-6455-0300'}</span></td>
        </tr>
      </tbody>
    </table>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TYPE A: 일반기입형 거래명세서
//  구성: 순번 | 품명 | 규격 | 단위 | 수량 | 비고
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TypeASheet({ data }: { data: StatementDetail }) {
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const korean = numToKorean(grandTotal);

  // 최소 22행 보장 (A4 비율)
  const MIN_ROWS = 22;
  const items = data.items;
  const padCount = Math.max(0, MIN_ROWS - items.length);

  return (
    <div className="font-sans text-[11px] bg-white" style={{ width: '210mm', minHeight: '297mm', padding: '8mm 8mm 6mm 8mm', boxSizing: 'border-box' }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0 !important; }
          .print-sheet { width: 210mm !important; padding: 8mm !important; }
        }
      `}</style>

      {/* 제목 */}
      <div className="text-center mb-2 relative">
        <h1 className="text-[22px] font-black tracking-[0.5em] underline" style={{ textDecorationStyle: 'double' }}>
          거 래 명 세 표
        </h1>
        <div className="absolute right-0 top-1 border border-black px-2 py-0.5 text-[9px] font-mono">
          No. {data.statement_number}
        </div>
      </div>

      {/* 날짜 */}
      <div className="text-right text-[10px] mb-1 font-semibold">
        {data.statement_date} &nbsp;&nbsp; 아래와 같이 납품합니다.
      </div>

      {/* 공급자/공급받는자 */}
      <SupplierBlock data={data} />

      {/* 합계금액 */}
      <div className="border border-black border-t-0 px-3 py-1 flex items-center gap-3 text-[10px] font-bold bg-gray-50">
        <span>합계금액:</span>
        <span className="underline">개&nbsp;&nbsp;별&nbsp;&nbsp;단&nbsp;&nbsp;가</span>
        <span className="flex-1 text-right">
          ( &nbsp;<span className="text-[13px]">{korean}&nbsp;원정</span>&nbsp;)&nbsp;&nbsp;VAT포함
        </span>
      </div>

      {/* 명세 테이블 */}
      <table className="w-full border-collapse text-[10px] mt-0" style={{ border: '1px solid black' }}>
        <thead>
          <tr className="bg-gray-200 font-bold text-center">
            <th className="border border-black py-1 w-[28px]">순번</th>
            <th className="border border-black py-1 w-[200px] text-left px-1">품&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</th>
            <th className="border border-black py-1 w-[100px] text-left px-1">규&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;격</th>
            <th className="border border-black py-1 w-[36px]">단위</th>
            <th className="border border-black py-1 w-[40px]">수량</th>
            <th className="border border-black py-1">비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.statement_item_id ?? idx} className="border-b border-gray-300">
              <td className="border border-black py-1 text-center">{idx + 1}</td>
              <td className="border border-black py-1 px-1 font-semibold">{item.item_name}</td>
              <td className="border border-black py-1 px-1 text-[9px]">{item.spec || ''}</td>
              <td className="border border-black py-1 text-center">{item.unit}</td>
              <td className="border border-black py-1 text-right px-1 font-bold font-mono">
                {item.qty ? fmt(item.qty) : ''}
              </td>
              <td className="border border-black py-1 px-1">{item.remarks || ''}</td>
            </tr>
          ))}
          {/* 빈 행 패딩 */}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`} className="border-b border-gray-200" style={{ height: '20px' }}>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
            </tr>
          ))}
          {/* 인수서명 행 */}
          <tr style={{ height: '24px' }}>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black px-2 text-right text-[9px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
          </tr>
          {/* 합계 */}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black py-1.5 text-center" colSpan={3}>합&nbsp;&nbsp;&nbsp;계</td>
            <td className="border border-black py-1.5 text-center"></td>
            <td className="border border-black py-1.5 text-right px-1 font-mono text-[11px]">
              {fmt(data.total_qty)}
            </td>
            <td className="border border-black py-1.5 px-2 text-[10px]">
              <span className="font-semibold">공급가액:</span>&nbsp;{fmt(data.total_amount)}&nbsp;&nbsp;
              <span className="font-semibold">VAT:</span>&nbsp;{fmt(data.total_vat)}&nbsp;&nbsp;
              <span className="font-bold text-[11px]">합계: {fmt(grandTotal)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 납품장소 / 비고 / 서명 */}
      <table className="w-full border-collapse text-[10px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black border-t-0 px-2 py-1 bg-gray-100 font-bold w-[70px] whitespace-nowrap">납&nbsp;품&nbsp;장&nbsp;소</td>
            <td className="border border-black border-t-0 px-2 py-1">{data.delivery_location || ''}</td>
          </tr>
          <tr>
            <td className="border border-black border-t-0 px-2 py-1 bg-gray-100 font-bold whitespace-nowrap">비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
            <td className="border border-black border-t-0 px-2 py-1 text-[9px]">{data.supplier_email || 'firemaster532nd@gmail.com'}</td>
          </tr>
        </tbody>
      </table>

      {/* 하단 공급자명 + 서명란 */}
      <div className="flex items-end justify-between mt-3">
        <div className="text-[16px] font-black tracking-widest">{data.supplier_name}&nbsp;&nbsp;(인)</div>
        <div className="flex gap-12 text-[10px] text-center">
          <div>
            <div className="text-gray-500 mb-3">인&nbsp;수&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-8 py-1 font-semibold">서명&nbsp;또는&nbsp;(인)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-3">인&nbsp;도&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-8 py-1 font-semibold">서명&nbsp;또는&nbsp;(인)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TYPE B: 자동연산형 거래명세서 (종합)
//  구성: 순번 | 품명 | 규격(밀도·두께·가로·세로) | 단위 | 수량
//        구조 그룹별 행 묶음
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TypeBSheet({ data }: { data: StatementDetail }) {
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const korean = numToKorean(grandTotal);

  // 그룹 헤더 행 (group_no 변경 시)
  type Row = { type: 'group'; no: number; duct_code: string; w: number; h: number; qty: number } | { type: 'item'; item: StatementItem };

  // items를 group_no 기준으로 구조화
  const rows: Row[] = [];
  let currentGroup = -1;
  let groupCounter = 0;
  const items = data.items;

  items.forEach((item) => {
    const gno = item.group_no ?? 0;
    if (item.is_group_header || (gno !== currentGroup && gno > 0)) {
      currentGroup = gno;
      groupCounter++;
      rows.push({
        type: 'group',
        no: groupCounter,
        duct_code: item.item_name,
        w: item.width_mm ?? 0,
        h: item.length_mm ?? 0,
        qty: item.qty ?? 0,
      });
    } else {
      rows.push({ type: 'item', item });
    }
  });

  // group_no 없는 경우 (일반 자동연산형)는 단순 순서 출력
  const simpleMode = items.every(i => !i.group_no && !i.is_group_header);
  let simpleGroupNo = 0;
  let prevName = '';

  const MIN_ROWS = 26;
  const totalDataRows = rows.length;
  const padCount = Math.max(0, MIN_ROWS - totalDataRows);

  return (
    <div className="font-sans text-[10px] bg-white" style={{ width: '210mm', minHeight: '297mm', padding: '6mm 6mm 5mm 6mm', boxSizing: 'border-box' }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0 !important; }
        }
      `}</style>

      {/* 제목 */}
      <div className="text-center mb-1.5 relative">
        <h1 className="text-[20px] font-black tracking-[0.5em] underline" style={{ textDecorationStyle: 'double' }}>
          거 래 명 세 표
        </h1>
        <div className="absolute right-0 top-1 border border-black px-2 py-0.5 text-[9px] font-mono">
          No. {data.statement_number}
        </div>
      </div>

      <div className="text-right text-[9px] mb-1 font-semibold">
        {data.statement_date} &nbsp;&nbsp; 아래와 같이 납품합니다.
      </div>

      <SupplierBlock data={data} />

      {/* 합계금액 */}
      <div className="border border-black border-t-0 px-3 py-0.5 flex items-center gap-2 text-[10px] font-bold bg-gray-50">
        <span>합계금액:</span>
        <span className="underline">개&nbsp;&nbsp;별&nbsp;&nbsp;단&nbsp;&nbsp;가</span>
        <span className="flex-1 text-right">
          ( &nbsp;<span className="text-[12px]">{korean}&nbsp;원정</span>&nbsp;)&nbsp;&nbsp;VAT포함
        </span>
      </div>

      {/* 명세 테이블 (2단 헤더) */}
      <table className="w-full border-collapse text-[9px]" style={{ border: '1px solid black' }}>
        <thead>
          <tr className="bg-gray-200 font-bold text-center">
            <th className="border border-black py-1 w-[24px]" rowSpan={2}>순번</th>
            <th className="border border-black py-1 w-[130px] text-left px-1" rowSpan={2}>품&nbsp;&nbsp;&nbsp;&nbsp;명</th>
            <th className="border border-black py-1" colSpan={4}>규&nbsp;&nbsp;&nbsp;&nbsp;격</th>
            <th className="border border-black py-1 w-[32px]" rowSpan={2}>단위</th>
            <th className="border border-black py-1 w-[36px]" rowSpan={2}>수량</th>
            <th className="border border-black py-1" rowSpan={2}>비&nbsp;고</th>
          </tr>
          <tr className="bg-gray-200 font-bold text-center text-[8px]">
            <th className="border border-black py-0.5 w-[32px]">밀도</th>
            <th className="border border-black py-0.5 w-[30px]">두께</th>
            <th className="border border-black py-0.5 w-[42px]">가로(mm)</th>
            <th className="border border-black py-0.5 w-[42px]">세로(mm)</th>
          </tr>
        </thead>
        <tbody>
          {simpleMode ? (
            // 단순 모드: group_no 없는 경우 — 이름이 바뀌면 번호 증가
            items.map((item, idx) => {
              const isNewGroup = item.item_name !== prevName && item.item_name.toUpperCase().includes('DUCT');
              if (isNewGroup) { simpleGroupNo++; prevName = item.item_name; }
              return (
                <tr key={idx} className={`border-b border-gray-300 ${isNewGroup ? 'bg-blue-50/30' : ''}`}>
                  <td className="border border-black py-0.5 text-center font-bold">
                    {isNewGroup ? simpleGroupNo : ''}
                  </td>
                  <td className="border border-black py-0.5 px-1 font-semibold">{item.item_name}</td>
                  <td className="border border-black py-0.5 text-center text-[8px]">{item.density || ''}</td>
                  <td className="border border-black py-0.5 text-center text-[8px]">{item.thickness || ''}</td>
                  <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
                  <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
                  <td className="border border-black py-0.5 text-center">{item.unit}</td>
                  <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">
                    {item.qty ? fmt(item.qty) : ''}
                  </td>
                  <td className="border border-black py-0.5 px-1 text-[8px]">{item.remarks || ''}</td>
                </tr>
              );
            })
          ) : (
            // 그룹 모드
            rows.map((row, idx) => {
              if (row.type === 'group') {
                return (
                  <tr key={`g-${idx}`} className="bg-blue-50/50 font-bold">
                    <td className="border border-black py-0.5 text-center font-black text-[11px]">{row.no}</td>
                    <td className="border border-black py-0.5 px-1 font-bold text-[10px]">{row.duct_code}</td>
                    <td className="border border-black py-0.5 text-center text-[8px]"></td>
                    <td className="border border-black py-0.5 text-center text-[8px]"></td>
                    <td className="border border-black py-0.5 text-center font-mono">{row.w || ''}</td>
                    <td className="border border-black py-0.5 text-center font-mono">{row.h || ''}</td>
                    <td className="border border-black py-0.5 text-center">EA</td>
                    <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">{row.qty || ''}</td>
                    <td className="border border-black py-0.5 px-1"></td>
                  </tr>
                );
              }
              const item = row.item;
              return (
                <tr key={`i-${idx}`} className="border-b border-gray-200">
                  <td className="border border-black py-0.5 text-center"></td>
                  <td className="border border-black py-0.5 px-2 text-[9px]">└ {item.item_name}</td>
                  <td className="border border-black py-0.5 text-center text-[8px]">{item.density || ''}</td>
                  <td className="border border-black py-0.5 text-center text-[8px]">{item.thickness || ''}</td>
                  <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
                  <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
                  <td className="border border-black py-0.5 text-center">{item.unit}</td>
                  <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">
                    {item.qty ? fmt(item.qty) : ''}
                  </td>
                  <td className="border border-black py-0.5 px-1 text-[8px]">{item.remarks || ''}</td>
                </tr>
              );
            })
          )}

          {/* 패딩 */}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`} style={{ height: '17px' }}>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
              <td className="border border-black"></td>
            </tr>
          ))}

          {/* 인수서명 */}
          <tr style={{ height: '22px' }}>
            <td className="border border-black" colSpan={8}></td>
            <td className="border border-black px-2 text-right text-[9px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
          </tr>

          {/* 합계 */}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black py-1.5 text-center font-black" colSpan={6}>합&nbsp;&nbsp;&nbsp;계</td>
            <td className="border border-black py-1.5 text-center"></td>
            <td className="border border-black py-1.5 text-right px-1 font-mono">{fmt(data.total_qty)}</td>
            <td className="border border-black py-1.5 px-2 text-[9px]">
              공급가: {fmt(data.total_amount)}&nbsp; VAT: {fmt(data.total_vat)}&nbsp;
              <span className="font-black text-[10px]">합계: {fmt(grandTotal)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 납품장소 / 비고 */}
      <table className="w-full border-collapse text-[10px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black border-t-0 px-2 py-1 bg-gray-100 font-bold w-[68px] whitespace-nowrap">납&nbsp;품&nbsp;장&nbsp;소</td>
            <td className="border border-black border-t-0 px-2 py-0.5">{data.delivery_location || ''}</td>
          </tr>
          <tr>
            <td className="border border-black border-t-0 px-2 py-0.5 bg-gray-100 font-bold whitespace-nowrap">비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
            <td className="border border-black border-t-0 px-2 py-0.5 text-[9px]">{data.supplier_email || 'firemaster532nd@gmail.com'}</td>
          </tr>
        </tbody>
      </table>

      {/* 하단 */}
      <div className="flex items-end justify-between mt-2">
        <div className="text-[14px] font-black tracking-widest">{data.supplier_name}&nbsp;&nbsp;(인)</div>
        <div className="flex gap-10 text-[9px] text-center">
          <div>
            <div className="text-gray-500 mb-2">인&nbsp;수&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-6 py-1">서명&nbsp;또는&nbsp;(인)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-2">인&nbsp;도&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-6 py-1">서명&nbsp;또는&nbsp;(인)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 출력 페이지 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function StatementPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as 'A' | 'B') || 'A';

  const [data, setData] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [printType, setPrintType] = useState<'A' | 'B'>(initialType);

  useEffect(() => {
    if (!id) return;

    // URL 쿼리에서 토큰을 받은 경우 localStorage에 임시 저장 (팝업 창 지원)
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
    }

    // localStorage에 토큰이 없으면 인증 오류
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    api.get<{ data: StatementDetail }>(`/statements/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 401 || err?.message?.includes('401')) {
          setAuthError(true);
        } else {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();
  const handleClose = () => window.close();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          거래명세서를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center max-w-sm mx-auto bg-white p-8 rounded-2xl shadow-lg">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">인증 오류</h2>
          <p className="text-sm text-gray-600 mb-4">
            로그인 세션이 만료되었거나 인증 정보가 없습니다.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            메인 창에서 로그인 후 다시 인쇄 버튼을 눌러주세요.
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
          >
            창 닫기
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center text-red-500 font-semibold">명세서 데이터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen print:bg-white print:m-0 print:p-0">
      {/* 컨트롤 바 (인쇄 시 숨김) */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-gray-800">거래명세서 출력 미리보기</span>
          <span className="text-xs text-gray-500 font-mono">#{data.statement_number}</span>

          {/* 양식 선택 토글 */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setPrintType('A')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                printType === 'A'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutList size={13} />
              일반기입형 (Type A)
            </button>
            <button
              onClick={() => setPrintType('B')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-l border-gray-300 ${
                printType === 'B'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText size={13} />
              자동연산형 (Type B)
            </button>
          </div>

          <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-1 rounded">
            {printType === 'A'
              ? '📋 순번·품명·규격·단위·수량·비고 — 단순 납품형'
              : '📊 규격 세분화(밀도·두께·가로·세로) — 구조별 그룹핑 상세형'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow transition-colors"
          >
            <Printer className="h-4 w-4" />
            인쇄 (Print)
          </button>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4" />
            닫기
          </button>
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div className="py-6 flex justify-center print:p-0 print:block">
        <div className="shadow-2xl rounded-sm print:shadow-none print:rounded-none">
          {printType === 'A' ? (
            <TypeASheet data={data} />
          ) : (
            <TypeBSheet data={data} />
          )}
        </div>
      </div>
    </div>
  );
}
