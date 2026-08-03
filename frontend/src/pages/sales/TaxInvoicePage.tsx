import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Printer, ArrowLeft } from 'lucide-react';

export function TaxInvoicePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (id) {
      api.get<{data:any}>(`/tax-invoices/${id}`).then(r=>setSelected(r.data)).catch(()=>toast.error('로드 실패'));
    } else {
      api.get<{data:any[]}>(`/tax-invoices?year=${year}`).then(r=>setList(r.data||[])).catch(()=>{});
    }
  }, [id, year]);

  if (id && selected) {
    // 세금계산서 미리보기 + 인쇄
    const d = selected;
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between no-print">
          <button onClick={()=>navigate('/sales/tax-invoice')} className="flex items-center gap-1 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> 목록
          </button>
          <div className="flex gap-2">
            <button onClick={()=>window.print()} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              <Printer className="h-4 w-4" /> 인쇄/PDF
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center p-8">
          <div className="bg-white w-[210mm] min-h-[297mm] p-8 shadow-lg" id="tax-invoice-print">
            <h2 className="text-2xl font-bold text-center border-b-2 border-black pb-3 mb-4">세 금 계 산 서</h2>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div className="border p-3">
                <p className="font-bold text-xs text-slate-500 mb-1">공급자 (이지원)</p>
                <p>사업자등록번호: 123-45-67890</p>
                <p>상호: (주)이지원</p>
                <p>대표자: 이동민</p>
                <p>주소: 경기도 수원시</p>
              </div>
              <div className="border p-3">
                <p className="font-bold text-xs text-slate-500 mb-1">공급받는자</p>
                <p>사업자등록번호: {d.company_code||'-'}</p>
                <p>상호: {d.company_name}</p>
                <p>대표자: {d.ceo_name||'-'}</p>
                <p>주소: {d.address||'-'}</p>
              </div>
            </div>
            <div className="flex gap-4 text-sm mb-4">
              <div><span className="text-slate-500">발행일:</span> <span className="font-mono">{d.issue_date?.slice(0,10)}</span></div>
              <div><span className="text-slate-500">관리번호:</span> <span className="font-mono">{d.ti_number}</span></div>
            </div>
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border px-3 py-2 text-left">No</th>
                  <th className="border px-3 py-2 text-left">품목명</th>
                  <th className="border px-3 py-2 text-left">규격</th>
                  <th className="border px-3 py-2 text-right">수량</th>
                  <th className="border px-3 py-2 text-right">단가</th>
                  <th className="border px-3 py-2 text-right">공급가액</th>
                  <th className="border px-3 py-2 text-right">세액</th>
                </tr>
              </thead>
              <tbody>
                {(d.items||[]).map((it:any,i:number)=>(
                  <tr key={i}>
                    <td className="border px-3 py-2">{i+1}</td>
                    <td className="border px-3 py-2">{it.item_name}</td>
                    <td className="border px-3 py-2">{it.spec||''}</td>
                    <td className="border px-3 py-2 text-right font-mono">{Number(it.qty).toLocaleString()}</td>
                    <td className="border px-3 py-2 text-right font-mono">{Number(it.unit_price).toLocaleString()}</td>
                    <td className="border px-3 py-2 text-right font-mono">{Number(it.supply_amount).toLocaleString()}</td>
                    <td className="border px-3 py-2 text-right font-mono">{Number(it.vat_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-slate-50">
                  <td colSpan={5} className="border px-3 py-2">합계</td>
                  <td className="border px-3 py-2 text-right font-mono">{Number(d.total_supply).toLocaleString()}</td>
                  <td className="border px-3 py-2 text-right font-mono">{Number(d.total_vat).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            <div className="border-t-2 border-black pt-3 flex justify-end">
              <div className="text-right">
                <p className="text-slate-500 text-sm">합계 금액</p>
                <p className="text-2xl font-bold font-mono">{Number(d.total_amount).toLocaleString()}원</p>
                <p className="text-xs text-slate-500">공급가 {Number(d.total_supply).toLocaleString()} + 세액 {Number(d.total_vat).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 리스트 모드
  return (
    <div className="space-y-4">
      <PageHeader title="세금계산서 발행/조회" description="판매 확정 후 세금계산서 발행 및 PDF 출력" />
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <label className="text-sm font-medium">년도</label>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
          {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}년</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">관리번호</th>
              <th className="px-4 py-3 text-left">발행일</th>
              <th className="px-4 py-3 text-left">거래처</th>
              <th className="px-4 py-3 text-right">공급가</th>
              <th className="px-4 py-3 text-right">세액</th>
              <th className="px-4 py-3 text-right">합계</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.length===0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">세금계산서가 없습니다.</td></tr>
            ) : list.map(t=>(
              <tr key={t.ti_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{t.ti_number}</td>
                <td className="px-4 py-3 text-xs">{t.issue_date?.slice(0,10)}</td>
                <td className="px-4 py-3 font-medium">{t.company_name}</td>
                <td className="px-4 py-3 text-right font-mono">{Number(t.total_supply).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{Number(t.total_vat).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{Number(t.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={()=>navigate(`/sales/tax-invoice/${t.ti_id}`)}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100">
                    <Printer className="h-3 w-3 inline mr-1" />보기/인쇄
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
