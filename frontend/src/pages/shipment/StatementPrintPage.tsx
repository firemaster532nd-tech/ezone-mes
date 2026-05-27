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
  density?: string | null;
  thickness?: string | null;
  width_mm?: number | null;
  length_mm?: number | null;
  group_no?: number | null;
  is_group_header?: boolean;
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
  recipient_name?: string | null;
  handler_name?: string | null;
  contact_phone?: string | null;
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
  delivery_location?: string | null;
  items: StatementItem[];
}

// ─── 유틸리티 ───────────────────────────────────────────
function numToKorean(num: number): string {
  if (!num || num === 0) return '영';
  const units = ['', '만', '억', '조'];
  const nums  = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const small = ['', '십', '백', '천'];
  let result = ''; let unitCount = 0; let n = num;
  while (n > 0) {
    const chunk = n % 10000; n = Math.floor(n / 10000);
    if (chunk === 0) { unitCount++; continue; }
    let str = ''; let tmp = chunk;
    for (let i = 0; i < 4; i++) {
      const d = tmp % 10; tmp = Math.floor(tmp / 10);
      if (d > 0) str = nums[d] + small[i] + str;
    }
    str = str.replace(/^일(십|백|천)/, '$1');
    result = str + units[unitCount] + result; unitCount++;
  }
  return result;
}
const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n ?? 0);

// ─── ㈜이지원 도장 SVG ────────────────────────────────────
function EzoneStamp({ size = 70 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
         style={{ display: 'inline-block', flexShrink: 0 }}>
      {/* 외부 원 */}
      <circle cx="50" cy="50" r="47" fill="rgba(180,0,0,0.04)" stroke="#bb0000" strokeWidth="3.5" />
      {/* 내부 원 */}
      <circle cx="50" cy="50" r="39" fill="none" stroke="#bb0000" strokeWidth="1.8" />
      {/* 상단: 주식회사 */}
      <text x="50" y="23" textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontWeight="800" fill="#bb0000" fontFamily="serif" letterSpacing="1.5">
        주 식 회 사
      </text>
      {/* 중앙: 이지원 (크게) */}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
            fontSize="20" fontWeight="900" fill="#bb0000" fontFamily="serif" letterSpacing="3">
        이지원
      </text>
      {/* 하단: 대표이사인 */}
      <text x="50" y="77" textAnchor="middle" dominantBaseline="middle"
            fontSize="10.5" fontWeight="800" fill="#bb0000" fontFamily="serif" letterSpacing="1">
        대 표 이 사 인
      </text>
    </svg>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  A4 전체 1장 — 거래명세서 (Type A: 일반기입형)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PageTypeA({ data, copyLabel }: { data: StatementDetail; copyLabel: string }) {
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const korean = numToKorean(grandTotal);
  const MIN_ROWS = 22;
  const padCount = Math.max(0, MIN_ROWS - data.items.length);

  return (
    <div className="a4-page bg-white font-sans text-[11px]"
         style={{ width:'210mm', height:'297mm', padding:'10mm 10mm 8mm 10mm',
                  boxSizing:'border-box', overflow:'hidden', position:'relative' }}>

      {/* 사본 구분 레이블 */}
      <div className="flex items-center justify-between mb-1">
        <span className="border border-black px-3 py-0.5 text-[10px] font-bold bg-yellow-50">
          {copyLabel}
        </span>
        <span className="border border-black px-2 py-0.5 text-[9px] font-mono">
          No. {data.statement_number}
        </span>
      </div>

      {/* 제목 */}
      <div className="text-center mb-2">
        <h1 className="text-[26px] font-black tracking-[0.6em] underline inline-block"
            style={{ textDecorationStyle:'double' }}>
          거 래 명 세 표
        </h1>
      </div>

      <div className="text-right text-[10px] mb-1 font-semibold">
        {data.statement_date}&nbsp;&nbsp;아래와 같이 납품합니다.
      </div>

      {/* 헤더 테이블 */}
      <table className="w-full border-collapse text-[10px] mb-0" style={{border:'1px solid black'}}>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-100 w-[80px] whitespace-nowrap">수&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;신</td>
            <td className="border border-black px-2 py-1 font-bold" colSpan={3}>{data.company_name} 귀중</td>
            <td className="border border-black px-1 py-0.5 text-center font-black bg-gray-100 w-[28px]" rowSpan={5}>
              <div style={{writingMode:'vertical-rl', letterSpacing:'0.3em', fontSize:'12px', fontWeight:900}}>공&nbsp;급&nbsp;자</div>
            </td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold w-[70px] whitespace-nowrap text-[9px]">사업자번호</td>
            <td className="border border-black px-2 py-0.5 font-mono font-bold" colSpan={2}>{data.supplier_no || '232-88-00624'}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap">인&nbsp;수&nbsp;자</td>
            <td className="border border-black px-2 py-1" colSpan={3}>{data.handler_name || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">상&nbsp;&nbsp;&nbsp;&nbsp;호</td>
            <td className="border border-black px-2 py-0.5 font-bold">㈜ 이지원</td>
            <td className="border border-black px-2 py-0.5 text-[9px]">성명&nbsp;<span className="font-bold">{data.supplier_ceo || '박민선'}</span></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap">연&nbsp;락&nbsp;처</td>
            <td className="border border-black px-2 py-1" colSpan={3}>{data.contact_phone || data.customer_phone || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">주&nbsp;&nbsp;&nbsp;&nbsp;소</td>
            <td className="border border-black px-2 py-0.5 text-[9px]" colSpan={2}>{data.supplier_addr || '경기도 화성시 장안면 수촌리 1028-21'}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-100 whitespace-nowrap" rowSpan={2}>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
            <td className="border border-black px-2 py-1 text-[9px]" colSpan={3} rowSpan={2}>{data.remarks || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
            <td className="border border-black px-2 py-0.5 text-[9px]">제조업, 도소매</td>
            <td className="border border-black px-2 py-0.5 text-[9px]">종목&nbsp;<span className="font-bold">방화재관련건설자재</span></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[9px] whitespace-nowrap">전&nbsp;&nbsp;&nbsp;&nbsp;화</td>
            <td className="border border-black px-2 py-0.5 text-[9px]">{data.supplier_phone || '070-8870-0300'}</td>
            <td className="border border-black px-2 py-0.5 text-[9px]">FAX&nbsp;<span className="font-bold">{data.supplier_fax || '02-6455-0300'}</span></td>
          </tr>
        </tbody>
      </table>

      {/* 합계금액 */}
      <div className="border border-black border-t-0 px-3 py-1 flex items-center gap-3 text-[10px] font-bold bg-gray-50">
        <span>합계금액:</span>
        <span className="underline text-[9px]">개&nbsp;&nbsp;별&nbsp;&nbsp;단&nbsp;&nbsp;가</span>
        <span className="flex-1 text-right">
          (&nbsp;<span className="text-[14px]">{korean}&nbsp;원정</span>&nbsp;)&nbsp;&nbsp;VAT포함
        </span>
      </div>

      {/* 명세 테이블 */}
      <table className="w-full border-collapse text-[10px]" style={{border:'1px solid black'}}>
        <thead>
          <tr className="bg-gray-200 font-bold text-center">
            <th className="border border-black py-1 w-[30px]">순번</th>
            <th className="border border-black py-1 text-left px-1">품&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</th>
            <th className="border border-black py-1 text-left px-1 w-[110px]">규&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;격</th>
            <th className="border border-black py-1 w-[36px]">단위</th>
            <th className="border border-black py-1 w-[42px]">수량</th>
            <th className="border border-black py-1">비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.statement_item_id ?? idx}>
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
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`} style={{ height: '20px' }}>
              {[0,1,2,3,4,5].map(c => <td key={c} className="border border-black" />)}
            </tr>
          ))}
          {/* 인수서명 */}
          <tr style={{ height: '26px' }}>
            {[0,1,2,3,4].map(c => <td key={c} className="border border-black" />)}
            <td className="border border-black px-2 text-right text-[10px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
          </tr>
          {/* 합계 */}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black py-1.5 text-center" colSpan={3}>합&nbsp;&nbsp;&nbsp;계</td>
            <td className="border border-black py-1.5" />
            <td className="border border-black py-1.5 text-right px-1 font-mono">{fmt(data.total_qty)}</td>
            <td className="border border-black py-1.5 px-2 text-[10px]">
              공급가: {fmt(data.total_amount)}&nbsp;&nbsp;VAT: {fmt(data.total_vat)}&nbsp;&nbsp;
              <span className="font-black text-[11px]">합계: {fmt(grandTotal)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 납품장소/비고 */}
      <table className="w-full border-collapse text-[10px]">
        <tbody>
          <tr>
            <td className="border border-black border-t-0 px-2 py-1 bg-gray-100 font-bold w-[80px] whitespace-nowrap">납&nbsp;품&nbsp;장&nbsp;소</td>
            <td className="border border-black border-t-0 px-2 py-1">{data.delivery_location || ''}</td>
          </tr>
          <tr>
            <td className="border border-black border-t-0 px-2 py-0.5 bg-gray-100 font-bold whitespace-nowrap">E-MAIL</td>
            <td className="border border-black border-t-0 px-2 py-0.5 text-[9px]">{data.supplier_email || 'firemaster532nd@gmail.com'}</td>
          </tr>
        </tbody>
      </table>

      {/* 하단 서명 */}
      <div className="flex items-end justify-between mt-3">
        <div className="flex items-end gap-1">
          <div className="text-[18px] font-black tracking-widest">㈜&nbsp;이&nbsp;지&nbsp;원</div>
          <EzoneStamp size={72} />
        </div>
        <div className="flex gap-12 text-[10px] text-center">
          <div>
            <div className="text-gray-500 mb-4">인&nbsp;수&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-8 py-1">서명&nbsp;또는&nbsp;(인)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-4">인&nbsp;도&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-8 py-1">서명&nbsp;또는&nbsp;(인)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  A4 전체 1장 — 거래명세서 (Type B: 자동연산형)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PageTypeB({ data, copyLabel }: { data: StatementDetail; copyLabel: string }) {
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const korean = numToKorean(grandTotal);
  const MIN_ROWS = 24;
  const items = data.items;
  const padCount = Math.max(0, MIN_ROWS - items.length);
  const simpleMode = items.every(i => !i.group_no && !i.is_group_header);
  let simpleGroupNo = 0;
  let prevName = '';

  return (
    <div className="a4-page bg-white font-sans text-[10px]"
         style={{ width:'210mm', height:'297mm', padding:'8mm 8mm 6mm 8mm',
                  boxSizing:'border-box', overflow:'hidden', position:'relative' }}>

      {/* 사본 구분 */}
      <div className="flex items-center justify-between mb-1">
        <span className="border border-black px-3 py-0.5 text-[10px] font-bold bg-yellow-50">{copyLabel}</span>
        <span className="border border-black px-2 py-0.5 text-[9px] font-mono">No. {data.statement_number}</span>
      </div>

      {/* 제목 */}
      <div className="text-center mb-1.5">
        <h1 className="text-[22px] font-black tracking-[0.6em] underline inline-block" style={{ textDecorationStyle:'double' }}>
          거 래 명 세 표
        </h1>
      </div>

      <div className="text-right text-[9px] mb-1 font-semibold">
        {data.statement_date}&nbsp;&nbsp;아래와 같이 납품합니다.
      </div>

      {/* 헤더 테이블 */}
      <table className="w-full border-collapse text-[9px] mb-0" style={{border:'1px solid black'}}>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-0.5 font-bold bg-gray-100 w-[72px] whitespace-nowrap">수&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;신</td>
            <td className="border border-black px-2 py-0.5 font-bold" colSpan={3}>{data.company_name} 귀중</td>
            <td className="border border-black px-1 py-0.5 text-center font-black bg-gray-100 w-[24px]" rowSpan={5}>
              <div style={{writingMode:'vertical-rl', letterSpacing:'0.2em', fontSize:'10px', fontWeight:900}}>공&nbsp;급&nbsp;자</div>
            </td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold w-[62px] whitespace-nowrap text-[8px]">사업자번호</td>
            <td className="border border-black px-2 py-0.5 font-mono font-bold text-[9px]" colSpan={2}>{data.supplier_no || '232-88-00624'}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-0.5 font-bold bg-gray-100 whitespace-nowrap">인&nbsp;수&nbsp;자</td>
            <td className="border border-black px-2 py-0.5" colSpan={3}>{data.handler_name || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">상&nbsp;&nbsp;&nbsp;&nbsp;호</td>
            <td className="border border-black px-2 py-0.5 font-bold">㈜ 이지원</td>
            <td className="border border-black px-2 py-0.5 text-[8px]">성명&nbsp;<span className="font-bold">{data.supplier_ceo || '박민선'}</span></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-0.5 font-bold bg-gray-100 whitespace-nowrap">연&nbsp;락&nbsp;처</td>
            <td className="border border-black px-2 py-0.5" colSpan={3}>{data.contact_phone || data.customer_phone || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">주&nbsp;&nbsp;&nbsp;&nbsp;소</td>
            <td className="border border-black px-2 py-0.5 text-[8px]" colSpan={2}>{data.supplier_addr || '경기도 화성시 장안면 수촌리 1028-21'}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-0.5 font-bold bg-gray-100 whitespace-nowrap" rowSpan={2}>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
            <td className="border border-black px-2 py-0.5 text-[8px]" colSpan={3} rowSpan={2}>{data.remarks || ''}</td>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
            <td className="border border-black px-2 py-0.5 text-[8px]">제조업, 도소매</td>
            <td className="border border-black px-2 py-0.5 text-[8px]">종목&nbsp;<span className="font-bold">방화재관련건설자재</span></td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">전&nbsp;&nbsp;&nbsp;&nbsp;화</td>
            <td className="border border-black px-2 py-0.5 text-[8px]">{data.supplier_phone || '070-8870-0300'}</td>
            <td className="border border-black px-2 py-0.5 text-[8px]">FAX&nbsp;<span className="font-bold">{data.supplier_fax || '02-6455-0300'}</span></td>
          </tr>
        </tbody>
      </table>

      {/* 합계금액 */}
      <div className="border border-black border-t-0 px-2 py-0.5 flex items-center gap-2 text-[9px] font-bold bg-gray-50">
        <span>합계금액:</span>
        <span className="underline text-[8px]">개&nbsp;별&nbsp;단&nbsp;가</span>
        <span className="flex-1 text-right">(&nbsp;<span className="text-[12px]">{korean}&nbsp;원정</span>&nbsp;)&nbsp;VAT포함</span>
      </div>

      {/* 명세 테이블 (2단 헤더) */}
      <table className="w-full border-collapse text-[9px]" style={{border:'1px solid black'}}>
        <thead>
          <tr className="bg-gray-200 font-bold text-center text-[9px]">
            <th className="border border-black py-0.5 w-[24px]" rowSpan={2}>순번</th>
            <th className="border border-black py-0.5 text-left px-1 w-[130px]" rowSpan={2}>품&nbsp;&nbsp;&nbsp;&nbsp;명</th>
            <th className="border border-black py-0.5" colSpan={4}>규&nbsp;&nbsp;&nbsp;&nbsp;격</th>
            <th className="border border-black py-0.5 w-[32px]" rowSpan={2}>단위</th>
            <th className="border border-black py-0.5 w-[36px]" rowSpan={2}>수량</th>
            <th className="border border-black py-0.5" rowSpan={2}>비&nbsp;고</th>
          </tr>
          <tr className="bg-gray-200 font-bold text-center text-[8px]">
            <th className="border border-black py-0.5 w-[30px]">밀도</th>
            <th className="border border-black py-0.5 w-[28px]">두께</th>
            <th className="border border-black py-0.5 w-[40px]">가로㎜</th>
            <th className="border border-black py-0.5 w-[40px]">세로㎜</th>
          </tr>
        </thead>
        <tbody>
          {simpleMode ? items.map((item, idx) => {
            const isNew = item.item_name !== prevName && item.item_name.toUpperCase().includes('DUCT');
            if (isNew) { simpleGroupNo++; prevName = item.item_name; }
            return (
              <tr key={idx} className={isNew ? 'bg-blue-50/30' : ''}>
                <td className="border border-black py-0.5 text-center font-bold">{isNew ? simpleGroupNo : ''}</td>
                <td className="border border-black py-0.5 px-1 font-semibold">{item.item_name}</td>
                <td className="border border-black py-0.5 text-center text-[8px]">{item.density || ''}</td>
                <td className="border border-black py-0.5 text-center text-[8px]">{item.thickness || ''}</td>
                <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
                <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
                <td className="border border-black py-0.5 text-center">{item.unit}</td>
                <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">{item.qty ? fmt(item.qty) : ''}</td>
                <td className="border border-black py-0.5 px-1 text-[8px]">{item.remarks || ''}</td>
              </tr>
            );
          }) : items.map((item, idx) => (
            <tr key={idx}>
              <td className="border border-black py-0.5 text-center font-bold">{item.is_group_header ? item.group_no : ''}</td>
              <td className="border border-black py-0.5 px-1">{item.item_name}</td>
              <td className="border border-black py-0.5 text-center text-[8px]">{item.density || ''}</td>
              <td className="border border-black py-0.5 text-center text-[8px]">{item.thickness || ''}</td>
              <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
              <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
              <td className="border border-black py-0.5 text-center">{item.unit}</td>
              <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">{item.qty ? fmt(item.qty) : ''}</td>
              <td className="border border-black py-0.5 px-1 text-[8px]">{item.remarks || ''}</td>
            </tr>
          ))}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`} style={{ height: '17px' }}>
              {[0,1,2,3,4,5,6,7,8].map(c => <td key={c} className="border border-black" />)}
            </tr>
          ))}
          <tr style={{ height: '22px' }}>
            <td className="border border-black" colSpan={8} />
            <td className="border border-black px-1 text-right text-[8px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black py-1.5 text-center" colSpan={6}>합&nbsp;&nbsp;&nbsp;계</td>
            <td className="border border-black py-1.5" />
            <td className="border border-black py-1.5 text-right px-1 font-mono">{fmt(data.total_qty)}</td>
            <td className="border border-black py-1.5 px-1 text-[8px]">
              공급가: {fmt(data.total_amount)}&nbsp;VAT: {fmt(data.total_vat)}&nbsp;
              <span className="font-black">합: {fmt(grandTotal)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 납품장소/이메일 */}
      <table className="w-full border-collapse text-[9px]">
        <tbody>
          <tr>
            <td className="border border-black border-t-0 px-2 py-0.5 bg-gray-100 font-bold w-[72px] whitespace-nowrap">납&nbsp;품&nbsp;장&nbsp;소</td>
            <td className="border border-black border-t-0 px-2 py-0.5">{data.delivery_location || ''}</td>
          </tr>
          <tr>
            <td className="border border-black border-t-0 px-2 py-0.5 bg-gray-100 font-bold whitespace-nowrap">E-MAIL</td>
            <td className="border border-black border-t-0 px-2 py-0.5">{data.supplier_email || 'firemaster532nd@gmail.com'}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex items-end justify-between mt-2">
        <div className="flex items-end gap-1">
          <div className="text-[16px] font-black tracking-widest">㈜&nbsp;이&nbsp;지&nbsp;원</div>
          <EzoneStamp size={64} />
        </div>
        <div className="flex gap-10 text-[10px] text-center">
          <div>
            <div className="text-gray-500 mb-3">인&nbsp;수&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-7 py-1">서명&nbsp;(인)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-3">인&nbsp;도&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-7 py-1">서명&nbsp;(인)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 출력 컴포넌트
//  인쇄 시: 2페이지 출력 (공급받는자 보관용 → 공급자 보관용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function StatementPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as 'A' | 'B') || 'A';

  const [data, setData]           = useState<StatementDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [authError, setAuthError] = useState(false);
  const [printType, setPrintType] = useState<'A' | 'B'>(initialType);

  useEffect(() => {
    if (!id) return;
    const urlToken = searchParams.get('token');
    if (urlToken) localStorage.setItem(TOKEN_KEY, urlToken);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setAuthError(true); setLoading(false); return; }

    api.get<{ data: StatementDetail }>(`/statements/${id}`)
      .then(res => setData(res.data))
      .catch(err => {
        if (err?.response?.status === 401 || String(err?.message).includes('401'))
          setAuthError(true);
        else console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center text-gray-500">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        거래명세서를 불러오는 중...
      </div>
    </div>
  );

  if (authError) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center max-w-sm bg-white p-8 rounded-2xl shadow-lg">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">인증 오류</h2>
        <p className="text-sm text-gray-500 mb-6">메인 창에서 로그인 후 다시 인쇄 버튼을 눌러주세요.</p>
        <button onClick={() => window.close()} className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold">창 닫기</button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <p className="text-red-500 font-semibold">명세서를 찾을 수 없습니다.</p>
    </div>
  );

  const PageComponent = printType === 'A' ? PageTypeA : PageTypeB;

  return (
    <div className="bg-gray-300 min-h-screen print:bg-white">

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body  { margin: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .a4-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always;
            overflow: hidden !important;
            background: white !important;
          }
          .a4-page:last-child { page-break-after: auto; }
        }
      `}} />

      {/* ─── 컨트롤 바 (화면 전용) ─── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-md px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-gray-800">거래명세서 출력 미리보기</span>
          <span className="text-xs text-gray-400 font-mono">#{data.statement_number}</span>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button onClick={() => setPrintType('A')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors ${printType==='A' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <LayoutList size={12} /> 일반기입형
            </button>
            <button onClick={() => setPrintType('B')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-l border-gray-300 transition-colors ${printType==='B' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <FileText size={12} /> 자동연산형
            </button>
          </div>

          <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded font-semibold">
            📄 인쇄 시 2장 출력 — 공급받는자 보관용 + 공급자 보관용
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow transition-colors">
            <Printer className="h-4 w-4" /> 인쇄
          </button>
          <button onClick={() => window.close()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
            <X className="h-4 w-4" /> 닫기
          </button>
        </div>
      </div>

      {/* ─── 미리보기 — 화면에서는 두 장이 세로로 나란히 ─── */}
      <div className="py-6 flex flex-col items-center gap-4 print:gap-0 print:p-0">

        {/* 1장: 공급받는자 보관용 */}
        <div className="shadow-2xl print:shadow-none">
          <PageComponent data={data} copyLabel="공급받는자 보관용" />
        </div>

        {/* 2장: 공급자 보관용 */}
        <div className="shadow-2xl print:shadow-none">
          <PageComponent data={data} copyLabel="공급자 보관용" />
        </div>

      </div>
    </div>
  );
}
