import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Printer, X, FileText, LayoutList, AlertTriangle, Scissors } from 'lucide-react';

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

const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n ?? 0);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공급자 블록 (상단 헤더 테이블) - 두 양식 공통
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SupplierBlock({ data, copyLabel }: { data: StatementDetail; copyLabel: string }) {
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);
  const korean = numToKorean(grandTotal);

  return (
    <>
      {/* 제목 + 사본 구분 */}
      <div className="relative text-center mb-1">
        <h1 className="text-[18px] font-black tracking-[0.5em] underline inline-block" style={{ textDecorationStyle: 'double' }}>
          거 래 명 세 표
        </h1>
        <span className="absolute right-0 top-0 text-[9px] border border-black px-2 py-0.5 font-bold font-mono">
          No. {data.statement_number}
        </span>
        <span className="absolute left-0 top-0 text-[9px] border border-black px-2 py-0.5 font-bold bg-gray-100">
          {copyLabel}
        </span>
      </div>

      <div className="text-right text-[9px] mb-0.5 font-semibold">
        {data.statement_date} &nbsp; 아래와 같이 납품합니다.
      </div>

      {/* 헤더 테이블 */}
      <table className="w-full border-collapse text-[9px]" style={{ border: '1px solid black' }}>
        <tbody>
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold bg-gray-100 w-[64px] whitespace-nowrap">수&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;신</td>
            <td className="border border-black px-1.5 py-0.5 font-bold" colSpan={3}>{data.company_name} 귀중</td>
            <td className="border border-black px-0.5 py-0.5 text-center font-black text-[8px] bg-gray-100 w-[22px]" rowSpan={5}>
              <div style={{ writingMode: 'vertical-rl', letterSpacing: '0.2em', fontWeight: 900 }}>공급자</div>
            </td>
            <td className="border border-black px-1.5 py-0.5 bg-gray-100 font-bold w-[58px] whitespace-nowrap text-[8px]">사업자번호</td>
            <td className="border border-black px-1.5 py-0.5 font-mono font-bold" colSpan={2}>{data.supplier_no || '232-88-00624'}</td>
          </tr>
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold bg-gray-100 whitespace-nowrap">인&nbsp;수&nbsp;자</td>
            <td className="border border-black px-1.5 py-0.5" colSpan={3}>{data.handler_name || ''}</td>
            <td className="border border-black px-1.5 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">상&nbsp;&nbsp;&nbsp;&nbsp;호</td>
            <td className="border border-black px-1.5 py-0.5 font-bold">㈜ 이지원</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]">성명&nbsp;<span className="font-bold">{data.supplier_ceo || '박민선'}</span></td>
          </tr>
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold bg-gray-100 whitespace-nowrap">연&nbsp;락&nbsp;처</td>
            <td className="border border-black px-1.5 py-0.5" colSpan={3}>{data.contact_phone || data.customer_phone || ''}</td>
            <td className="border border-black px-1.5 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">주&nbsp;&nbsp;&nbsp;&nbsp;소</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]" colSpan={2}>{data.supplier_addr || '경기도 화성시 장안면 수촌리 1028-21'}</td>
          </tr>
          <tr>
            <td className="border border-black px-1.5 py-0.5 font-bold bg-gray-100 whitespace-nowrap" rowSpan={2}>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]" colSpan={3} rowSpan={2}>{data.remarks || ''}</td>
            <td className="border border-black px-1.5 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">업&nbsp;&nbsp;&nbsp;&nbsp;태</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]">제조업, 도소매</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]">종목&nbsp;<span className="font-bold">방화재관련건설자재</span></td>
          </tr>
          <tr>
            <td className="border border-black px-1.5 py-0.5 bg-gray-100 font-bold text-[8px] whitespace-nowrap">전&nbsp;&nbsp;&nbsp;&nbsp;화</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]">{data.supplier_phone || '070-8870-0300'}</td>
            <td className="border border-black px-1.5 py-0.5 text-[8px]">FAX&nbsp;<span className="font-bold">{data.supplier_fax || '02-6455-0300'}</span></td>
          </tr>
        </tbody>
      </table>

      {/* 합계금액 */}
      <div className="border border-black border-t-0 px-2 py-0.5 flex items-center gap-2 text-[9px] font-bold bg-gray-50">
        <span>합계금액:</span>
        <span className="underline text-[8px]">개&nbsp;별&nbsp;단&nbsp;가</span>
        <span className="flex-1 text-right">
          (&nbsp;<span className="text-[11px]">{korean}&nbsp;원정</span>&nbsp;)&nbsp;VAT포함
        </span>
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  하단 (납품장소 / 서명란 / 회사명)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BottomBlock({ data }: { data: StatementDetail }) {
  return (
    <>
      <table className="w-full border-collapse text-[9px] mt-0">
        <tbody>
          <tr>
            <td className="border border-black border-t-0 px-1.5 py-0.5 bg-gray-100 font-bold w-[64px] whitespace-nowrap">납&nbsp;품&nbsp;장&nbsp;소</td>
            <td className="border border-black border-t-0 px-1.5 py-0.5">{data.delivery_location || ''}</td>
          </tr>
          <tr>
            <td className="border border-black border-t-0 px-1.5 py-0.5 bg-gray-100 font-bold whitespace-nowrap">E-MAIL</td>
            <td className="border border-black border-t-0 px-1.5 py-0.5 text-[8px]">{data.supplier_email || 'firemaster532nd@gmail.com'}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex items-center justify-between mt-1.5">
        <div className="text-[13px] font-black tracking-widest">㈜&nbsp;이&nbsp;지&nbsp;원&nbsp;&nbsp;(인)</div>
        <div className="flex gap-8 text-[9px] text-center">
          <div>
            <div className="text-gray-500 mb-2">인&nbsp;수&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-6 py-0.5">서명&nbsp;(인)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-2">인&nbsp;도&nbsp;자&nbsp;확&nbsp;인</div>
            <div className="border-b border-black px-6 py-0.5">서명&nbsp;(인)</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TYPE A 명세 테이블: 순번|품명|규격|단위|수량|비고
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TypeATable({ data }: { data: StatementDetail }) {
  const MIN_ROWS = 16;
  const items = data.items;
  const padCount = Math.max(0, MIN_ROWS - items.length);
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);

  return (
    <table className="w-full border-collapse text-[9px]" style={{ border: '1px solid black' }}>
      <thead>
        <tr className="bg-gray-200 font-bold text-center">
          <th className="border border-black py-0.5 w-[22px]">순번</th>
          <th className="border border-black py-0.5 text-left px-1">품&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</th>
          <th className="border border-black py-0.5 text-left px-1 w-[90px]">규&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;격</th>
          <th className="border border-black py-0.5 w-[30px]">단위</th>
          <th className="border border-black py-0.5 w-[34px]">수량</th>
          <th className="border border-black py-0.5">비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={item.statement_item_id ?? idx}>
            <td className="border border-black py-0.5 text-center">{idx + 1}</td>
            <td className="border border-black py-0.5 px-1 font-semibold">{item.item_name}</td>
            <td className="border border-black py-0.5 px-1 text-[8px]">{item.spec || ''}</td>
            <td className="border border-black py-0.5 text-center">{item.unit}</td>
            <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">
              {item.qty ? fmt(item.qty) : ''}
            </td>
            <td className="border border-black py-0.5 px-1">{item.remarks || ''}</td>
          </tr>
        ))}
        {Array.from({ length: padCount }).map((_, i) => (
          <tr key={`pad-${i}`} style={{ height: '16px' }}>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
            <td className="border border-black"></td>
          </tr>
        ))}
        {/* 인수서명 행 */}
        <tr style={{ height: '18px' }}>
          <td className="border border-black" colSpan={5}></td>
          <td className="border border-black px-1 text-right text-[8px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
        </tr>
        {/* 합계 */}
        <tr className="bg-gray-100 font-bold">
          <td className="border border-black py-1 text-center" colSpan={3}>합&nbsp;&nbsp;&nbsp;계</td>
          <td className="border border-black py-1 text-center"></td>
          <td className="border border-black py-1 text-right px-1 font-mono">{fmt(data.total_qty)}</td>
          <td className="border border-black py-1 px-1 text-[8px]">
            공급가: {fmt(data.total_amount)}&nbsp;
            VAT: {fmt(data.total_vat)}&nbsp;
            <span className="font-black">합계: {fmt(grandTotal)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TYPE B 명세 테이블: 순번|품명|규격(밀도·두께·가로·세로)|단위|수량
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TypeBTable({ data }: { data: StatementDetail }) {
  const MIN_ROWS = 18;
  const items = data.items;
  const padCount = Math.max(0, MIN_ROWS - items.length);
  const grandTotal = Number(data.total_amount) + Number(data.total_vat);

  const simpleMode = items.every(i => !i.group_no && !i.is_group_header);
  let simpleGroupNo = 0;
  let prevName = '';

  return (
    <table className="w-full border-collapse text-[8px]" style={{ border: '1px solid black' }}>
      <thead>
        <tr className="bg-gray-200 font-bold text-center text-[8px]">
          <th className="border border-black py-0.5 w-[20px]" rowSpan={2}>순번</th>
          <th className="border border-black py-0.5 text-left px-1 w-[110px]" rowSpan={2}>품&nbsp;&nbsp;&nbsp;&nbsp;명</th>
          <th className="border border-black py-0.5" colSpan={4}>규&nbsp;&nbsp;&nbsp;&nbsp;격</th>
          <th className="border border-black py-0.5 w-[28px]" rowSpan={2}>단위</th>
          <th className="border border-black py-0.5 w-[30px]" rowSpan={2}>수량</th>
          <th className="border border-black py-0.5" rowSpan={2}>비&nbsp;고</th>
        </tr>
        <tr className="bg-gray-200 font-bold text-center text-[7px]">
          <th className="border border-black py-0.5 w-[28px]">밀도</th>
          <th className="border border-black py-0.5 w-[26px]">두께</th>
          <th className="border border-black py-0.5 w-[36px]">가로(㎜)</th>
          <th className="border border-black py-0.5 w-[36px]">세로(㎜)</th>
        </tr>
      </thead>
      <tbody>
        {simpleMode ? items.map((item, idx) => {
          const isNewGroup = item.item_name !== prevName && item.item_name.toUpperCase().includes('DUCT');
          if (isNewGroup) { simpleGroupNo++; prevName = item.item_name; }
          return (
            <tr key={idx} className={isNewGroup ? 'bg-blue-50/30' : ''}>
              <td className="border border-black py-0.5 text-center font-bold text-[9px]">{isNewGroup ? simpleGroupNo : ''}</td>
              <td className="border border-black py-0.5 px-1">{item.item_name}</td>
              <td className="border border-black py-0.5 text-center">{item.density || ''}</td>
              <td className="border border-black py-0.5 text-center">{item.thickness || ''}</td>
              <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
              <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
              <td className="border border-black py-0.5 text-center">{item.unit}</td>
              <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">{item.qty ? fmt(item.qty) : ''}</td>
              <td className="border border-black py-0.5 px-1">{item.remarks || ''}</td>
            </tr>
          );
        }) : items.map((item, idx) => (
          <tr key={idx}>
            <td className="border border-black py-0.5 text-center font-bold">{item.is_group_header ? item.group_no : ''}</td>
            <td className="border border-black py-0.5 px-1 font-semibold">{item.item_name}</td>
            <td className="border border-black py-0.5 text-center">{item.density || ''}</td>
            <td className="border border-black py-0.5 text-center">{item.thickness || ''}</td>
            <td className="border border-black py-0.5 text-center font-mono">{item.width_mm || ''}</td>
            <td className="border border-black py-0.5 text-center font-mono">{item.length_mm || ''}</td>
            <td className="border border-black py-0.5 text-center">{item.unit}</td>
            <td className="border border-black py-0.5 text-right px-1 font-bold font-mono">{item.qty ? fmt(item.qty) : ''}</td>
            <td className="border border-black py-0.5 px-1">{item.remarks || ''}</td>
          </tr>
        ))}

        {Array.from({ length: padCount }).map((_, i) => (
          <tr key={`pad-${i}`} style={{ height: '15px' }}>
            {[0,1,2,3,4,5,6,7,8].map(c => <td key={c} className="border border-black"></td>)}
          </tr>
        ))}
        <tr style={{ height: '16px' }}>
          <td className="border border-black" colSpan={8}></td>
          <td className="border border-black px-1 text-right text-[7px] font-bold">인&nbsp;수&nbsp;서&nbsp;명</td>
        </tr>
        <tr className="bg-gray-100 font-bold">
          <td className="border border-black py-1 text-center" colSpan={6}>합&nbsp;&nbsp;&nbsp;계</td>
          <td className="border border-black py-1 text-center"></td>
          <td className="border border-black py-1 text-right px-1 font-mono">{fmt(data.total_qty)}</td>
          <td className="border border-black py-1 px-1 text-[7px]">
            공급가: {fmt(data.total_amount)}&nbsp;VAT: {fmt(data.total_vat)}&nbsp;
            <span className="font-black">합: {fmt(grandTotal)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  단일 명세서 카드 (1매) — 유형 A 또는 B
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function StatementCard({
  data,
  copyLabel,
  printType,
}: {
  data: StatementDetail;
  copyLabel: string;
  printType: 'A' | 'B';
}) {
  return (
    <div className="bg-white font-sans" style={{ padding: '5mm 6mm 4mm 6mm' }}>
      <SupplierBlock data={data} copyLabel={copyLabel} />
      {printType === 'A' ? (
        <TypeATable data={data} />
      ) : (
        <TypeBTable data={data} />
      )}
      <BottomBlock data={data} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  메인 출력 페이지 — A4 한 장에 2매 (공급자 + 공급받는자)
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
    // URL 쿼리 토큰 처리 (팝업 인증)
    const urlToken = searchParams.get('token');
    if (urlToken) localStorage.setItem(TOKEN_KEY, urlToken);

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { setAuthError(true); setLoading(false); return; }

    api.get<{ data: StatementDetail }>(`/statements/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err?.response?.status === 401 || err?.message?.includes('401')) setAuthError(true);
        else console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();
  const handleClose = () => window.close();

  // ─── 로딩 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          거래명세서를 불러오는 중...
        </div>
      </div>
    );
  }

  // ─── 인증 오류 ───
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center max-w-sm bg-white p-8 rounded-2xl shadow-lg">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">인증 오류</h2>
          <p className="text-sm text-gray-500 mb-6">메인 창에서 로그인 후 다시 인쇄 버튼을 눌러주세요.</p>
          <button onClick={handleClose} className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700">창 닫기</button>
        </div>
      </div>
    );
  }

  // ─── 데이터 없음 ───
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-red-500 font-semibold">명세서 데이터를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-300 min-h-screen print:bg-white print:m-0 print:p-0">

      {/* ─── 인쇄 시 적용되는 전역 스타일 ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body { margin: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            page-break-after: always;
            background: white;
          }
          .copy-block {
            height: 136mm !important;
            overflow: hidden !important;
          }
          .cut-line {
            border-top: 2px dashed #555 !important;
            margin: 0 !important;
          }
        }
        @media screen {
          .print-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            border-radius: 2px;
          }
        }
      `}} />

      {/* ─── 컨트롤 바 (화면 전용, 인쇄 시 숨김) ─── */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-gray-800">거래명세서 인쇄 미리보기</span>
          <span className="text-xs text-gray-400 font-mono">#{data.statement_number}</span>

          {/* 양식 선택 */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setPrintType('A')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors ${
                printType === 'A' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutList size={12} /> 일반기입형
            </button>
            <button
              onClick={() => setPrintType('B')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-300 ${
                printType === 'B' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText size={12} /> 자동연산형
            </button>
          </div>

          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold">
            ✂ A4 한 장 = 공급받는자 보관용 + 공급자 보관용 2매
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow transition-colors"
          >
            <Printer className="h-4 w-4" /> 인쇄
          </button>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" /> 닫기
          </button>
        </div>
      </div>

      {/* ─── A4 미리보기 ─── */}
      <div className="py-6 flex justify-center print:p-0 print:block">
        <div className="print-page">

          {/* ━━ 상단: 공급받는자 보관용 ━━ */}
          <div className="copy-block" style={{ height: '136mm', overflow: 'hidden' }}>
            <StatementCard data={data} copyLabel="공급받는자 보관용" printType={printType} />
          </div>

          {/* ━━ 가위선 ━━ */}
          <div className="cut-line flex items-center" style={{ borderTop: '2px dashed #555', margin: '0 4mm', position: 'relative' }}>
            <span className="no-print absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-300 px-2 text-gray-500 text-[10px] flex items-center gap-1 rounded">
              <Scissors size={11} /> 절취선
            </span>
          </div>

          {/* ━━ 하단: 공급자 보관용 ━━ */}
          <div className="copy-block" style={{ height: '136mm', overflow: 'hidden' }}>
            <StatementCard data={data} copyLabel="공급자 보관용" printType={printType} />
          </div>

        </div>
      </div>
    </div>
  );
}
