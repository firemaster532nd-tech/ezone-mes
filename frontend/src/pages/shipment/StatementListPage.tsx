import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, Plus, Trash2, Printer, 
  Building2, Calendar, FileSpreadsheet 
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Statement {
  statement_id: number;
  statement_number: string;
  statement_date: string;
  order_id: number | null;
  customer_id: number;
  company_name: string;
  company_code: string;
  ceo_name: string | null;
  total_qty: number;
  total_amount: number;
  total_vat: number;
  remarks: string | null;
  created_at: string;
}

interface Company {
  company_id: number;
  company_name: string;
}

export function StatementListPage() {
  const navigate = useNavigate();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // 필터 상태
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Statement[] }>(
        `/statements?from=${fromDate}&to=${toDate}&customerId=${customerId}`
      );
      setStatements(res.data);
    } catch (err) {
      console.error(err);
      toast.error('거래명세서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get<{ data: Company[] }>('/companies?active=true');
      setCompanies(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchStatements();
  }, [fromDate, toDate, customerId]);

  const handleDelete = async (id: number, number: string) => {
    if (!window.confirm(`[${number}] 거래명세서를 정말 삭제하시겠습니까?\n삭제된 전표는 복구할 수 없습니다.`)) return;

    try {
      await api.delete(`/statements/${id}`);
      toast.success('거래명세서가 삭제되었습니다.');
      fetchStatements();
    } catch (err) {
      console.error(err);
      toast.error('거래명세서 삭제에 실패했습니다.');
    }
  };

  const handlePrint = (id: number) => {
    // 팝업 창으로 인쇄 화면 띄우기
    const printUrl = `/shipment/statements/print/${id}`;
    window.open(printUrl, 'EZONE_MES_PRINT', 'width=900,height=900,scrollbars=yes');
  };

  // 포맷팅 함수들
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">거래명세서 관리/발급</h1>
            <p className="text-sm text-gray-500">발급 완료된 거래명세표 목록을 검토하고 정밀하게 인쇄합니다.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            수주 연동 거래명세표 발급
          </button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
        {/* 날짜 범위 */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">거래 기간</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* 거래처 필터 */}
        <div className="flex items-center gap-2 ml-2">
          <Building2 className="h-4.5 w-4.5 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">거래처</span>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none max-w-[200px]"
          >
            <option value="">전체 거래처</option>
            {companies.map((c) => (
              <option key={c.company_id} value={c.company_id}>
                {c.company_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchStatements}
          className="ml-auto rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          조회
        </button>
      </div>

      {/* List Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                <th className="px-6 py-3.5">일련번호</th>
                <th className="px-6 py-3.5">거래일자</th>
                <th className="px-6 py-3.5">거래처명</th>
                <th className="px-6 py-3.5 text-center">총 수량</th>
                <th className="px-6 py-3.5 text-right">공급가액</th>
                <th className="px-6 py-3.5 text-right">세액 (VAT)</th>
                <th className="px-6 py-3.5 text-right">합계금액</th>
                <th className="px-6 py-3.5 text-center">출력</th>
                <th className="px-6 py-3.5 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    전표 데이터를 가져오는 중입니다...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    조회 기간 동안 발급된 거래명세서가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                statements.map((stmt) => {
                  const totalSum = Number(stmt.total_amount) + Number(stmt.total_vat);
                  return (
                    <tr key={stmt.statement_id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-blue-600">{stmt.statement_number}</td>
                      <td className="px-6 py-3.5 font-medium">{stmt.statement_date}</td>
                      <td className="px-6 py-3.5 font-semibold text-gray-900">{stmt.company_name}</td>
                      <td className="px-6 py-3.5 text-center font-semibold text-gray-600">
                        {formatNumber(stmt.total_qty)} EA
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium text-gray-900">
                        {formatNumber(stmt.total_amount)} 원
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-500">
                        {formatNumber(stmt.total_vat)} 원
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-gray-900">
                        {formatNumber(totalSum)} 원
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={() => handlePrint(stmt.statement_id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors shadow-sm"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          인쇄
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(stmt.statement_id, stmt.statement_number)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-gray-50 transition-colors"
                          title="명세서 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
