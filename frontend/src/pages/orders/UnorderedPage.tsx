import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { 
  Search, X, ShoppingCart, 
  ArrowRightLeft, Calendar, FileText, 
  Building2, ArrowRight, DollarSign, PackageOpen
} from 'lucide-react';

interface UnorderedQuotationItem {
  quotation_item_id: number;
  quotation_id: number;
  item_code: string;
  item_name: string;
  spec: string | null;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  remarks: string | null;
  
  quotation_number: string;
  quotation_date: string;
  project_code: string | null;
  delivery_date: string | null;
  status: string;
  company_name: string;
}

export function UnorderedPage() {
  const [data, setData] = useState<UnorderedQuotationItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: UnorderedQuotationItem[] }>('/quotations/unordered');
      setData(res.data);
    } catch (e: any) {
      toast.error('미주문현황 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 수주 전환 API 호출
  const handleConvertOrder = async (id: number, qNo: string) => {
    if (!confirm(`견적서 [${qNo}]를 수주 주문으로 자동 전환하시겠습니까?\n이 품목이 속한 견적서 전체가 일괄 수주 전환됩니다.`)) return;
    try {
      const res = await api.post<{ message: string }>(`/quotations/${id}/convert-order`, {});
      toast.success(res.message || '수주로 성공적으로 전환되었습니다.');
      fetchData();
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '주문 전환에 실패했습니다.');
    }
  };

  // 검색 필터링
  const filteredData = data.filter(item => {
    const s = search.toLowerCase();
    return (
      item.company_name.toLowerCase().includes(s) ||
      item.quotation_number.toLowerCase().includes(s) ||
      item.item_code.toLowerCase().includes(s) ||
      item.item_name.toLowerCase().includes(s) ||
      (item.spec && item.spec.toLowerCase().includes(s)) ||
      (item.project_code && item.project_code.toLowerCase().includes(s))
    );
  });

  // 전체 합계 집계
  const totalQty = filteredData.reduce((sum, r) => sum + Number(r.qty), 0);
  const totalAmount = filteredData.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="미주문현황" 
        count={filteredData.length} 
        description="진행중인 견적서 중 아직 수주로 확정되지 않은 세부 품목별 미주문 대기 내역 조회 및 수주 전환 처리" 
      />

      {/* 필터 및 검색 바 */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="거래처명, 견적번호, 품목명, 규격, 현장명 실시간 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-sans font-normal">필터링 품목수:</span>
            <span>{filteredData.length}건</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-sans font-normal">미주문 수량합계:</span>
            <span className="text-blue-600">{totalQty.toLocaleString()}매</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-sans font-normal">공급가액 총액:</span>
            <span className="text-slate-800">₩{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 현황 목록 그리드 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="px-5 py-3.5 text-center w-12">No</th>
                <th className="px-5 py-3.5">견적일자</th>
                <th className="px-5 py-3.5">견적번호</th>
                <th className="px-5 py-3.5">거래처</th>
                <th className="px-5 py-3.5">현장명</th>
                <th className="px-5 py-3.5">품목코드</th>
                <th className="px-5 py-3.5">품목명</th>
                <th className="px-5 py-3.5 text-center">규격</th>
                <th className="px-5 py-3.5 text-right">견적수량</th>
                <th className="px-5 py-3.5 text-right">단가</th>
                <th className="px-5 py-3.5 text-right font-bold">공급가액</th>
                <th className="px-5 py-3.5">납기예정일</th>
                <th className="px-5 py-3.5 text-center w-28">즉시주문</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredData.map((item, idx) => (
                <tr key={item.quotation_item_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-4 font-mono text-slate-600">{item.quotation_date}</td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {item.quotation_number}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-700 font-sans text-sm">{item.company_name}</td>
                  <td className="px-5 py-4 text-slate-500 font-sans">{item.project_code || '-'}</td>
                  <td className="px-5 py-4 font-mono font-bold text-blue-600">{item.item_code}</td>
                  <td className="px-5 py-4 font-medium text-slate-800 font-sans text-sm">{item.item_name}</td>
                  <td className="px-5 py-4 text-center font-mono text-slate-500 bg-slate-50/50 font-bold">{item.spec || '-'}</td>
                  <td className="px-5 py-4 text-right font-mono font-semibold text-slate-800 text-sm">
                    {Number(item.qty).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-slate-500">
                    ₩{Number(item.unit_price).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-slate-800 text-sm">
                    ₩{Number(item.amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-mono text-slate-600">{item.delivery_date || '-'}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleConvertOrder(item.quotation_id, item.quotation_number)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition-all border border-blue-200/50 shadow-sm"
                      title="이 품목이 속한 견적서를 일괄 주문 전환"
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                      <span>수주전환</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && !loading && (
                <tr>
                  <td colSpan={13} className="px-5 py-12 text-center text-slate-400 font-sans">
                    <PackageOpen className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                    미주문 대기 품목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
