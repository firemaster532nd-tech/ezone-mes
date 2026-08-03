import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search, Plus, Eye, Trash2, CheckCircle, FileText } from 'lucide-react';

interface SalesDelivery {
  sl_id: number;
  sl_number: string;
  company_name: string;
  project_code: string | null;
  sl_date: string;
  delivery_date: string | null;
  total_qty: number;
  total_supply: number;
  total_vat: number;
  total_amount: number;
  status: string;
  created_at: string;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    INVOICED: 'bg-emerald-100 text-emerald-700',
    ACCOUNTED: 'bg-purple-100 text-purple-700',
    CANCELLED: 'bg-red-100 text-red-500',
  };
  const label: Record<string, string> = {
    DRAFT: '임시', CONFIRMED: '확정', INVOICED: '계산서발행', ACCOUNTED: '지급완료', CANCELLED: '취소'
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${map[s]||'bg-slate-100 text-slate-500'}`}>{label[s]||s}</span>;
}

export function SalesDeliveryPage({ mode }: { mode?: 'accounting' }) {
  const navigate = useNavigate();
  const [data, setData] = useState<SalesDelivery[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(mode === 'accounting' ? 'CONFIRMED' : '');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (startDate) p.set('startDate', startDate);
      if (endDate) p.set('endDate', endDate);
      if (statusFilter) p.set('status', statusFilter);
      const r = await api.get<{ data: SalesDelivery[] }>(`/sales-delivery?${p}`);
      setData(r.data || []);
    } catch { toast.error('로드 실패'); }
    finally { setLoading(false); }
  }, [search, startDate, endDate, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = async (id: number) => {
    if (!confirm('판매를 확정하시겠습니까?')) return;
    try {
      await api.patch(`/sales-delivery/${id}/confirm`, {});
      toast.success('판매 확정되었습니다.');
      fetchData();
    } catch { toast.error('확정 실패'); }
  };

  const handleTaxInvoice = async (id: number) => {
    if (!confirm('세금계산서를 발행하시겠습니까?')) return;
    try {
      const r = await api.post<{ data: { ti_id: number } }>(`/sales-delivery/${id}/tax-invoice`, {});
      toast.success('세금계산서 발행 완료');
      navigate(`/sales/tax-invoice/${r.data.ti_id}`);
    } catch { toast.error('세금계산서 발행 실패'); }
  };

  const title = mode === 'accounting' ? '판매 일괄회계반영' : '판매 조회';

  return (
    <div className="space-y-4">
      <PageHeader title={title} count={data.length} description="판매 확정 및 세금계산서 발행 관리" />
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">검색어</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key==='Enter' && fetchData()}
                placeholder="판매번호, 거래처, 현장명..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">판매기간</label>
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
              <span className="text-slate-400 self-center">~</span>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">상태</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">전체</option>
              <option value="DRAFT">임시</option>
              <option value="CONFIRMED">확정</option>
              <option value="INVOICED">계산서발행</option>
              <option value="ACCOUNTED">지급완료</option>
            </select>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg">조회</button>
          <button onClick={() => navigate('/sales/delivery/entry')}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">
            <Plus className="h-4 w-4" /> 신규 판매
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">판매번호</th>
              <th className="px-4 py-3 text-left">판매일</th>
              <th className="px-4 py-3 text-left">거래처</th>
              <th className="px-4 py-3 text-left">현장명</th>
              <th className="px-4 py-3 text-right">공급가</th>
              <th className="px-4 py-3 text-right">세액</th>
              <th className="px-4 py-3 text-right">합계금액</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center text-slate-400">로딩 중...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-slate-400">판매 내역이 없습니다.</td></tr>
            ) : data.map(d => (
              <tr key={d.sl_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/sales/delivery/entry/${d.sl_id}`)}>                <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.sl_number}</td>
                <td className="px-4 py-3 text-xs">{d.sl_date?.slice(0,10)}</td>
                <td className="px-4 py-3 font-medium">{d.company_name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{d.project_code||'-'}</td>
                <td className="px-4 py-3 text-right font-mono">{Number(d.total_supply).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{Number(d.total_vat).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{Number(d.total_amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-center" onClick={e=>e.stopPropagation()}>{statusBadge(d.status)}</td>
                <td className="px-4 py-3 text-center" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-center gap-1">
                    {d.status === 'DRAFT' && (
                      <button onClick={()=>handleConfirm(d.sl_id)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100">
                        <CheckCircle className="h-3 w-3 inline" /> 확정
                      </button>
                    )}
                    {d.status === 'CONFIRMED' && (
                      <button onClick={()=>handleTaxInvoice(d.sl_id)}
                        className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100">
                        <FileText className="h-3 w-3 inline" /> 세금계산서
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
