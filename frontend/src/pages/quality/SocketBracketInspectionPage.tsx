import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Plug, Plus, CheckCircle } from 'lucide-react';

export function SocketBracketInspectionPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/inspections?insp_type=SOCKET_IN');
      setInspections(res.data || []);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader 
        title="🔌 소켓 / 브라켓류 인수검사" 
        description="금속소켓(D101~D130 계열) 및 브라켓류 (BK, FSB, 상하/좌우 평철 브라켓) 통합 인수검사 및 재고 승인"
      >
        <button
          onClick={() => alert('소켓/브라켓 인수검사는 소켓 발주/입고 관리 화면과 연동되어 통합 검사등록 처리됩니다.')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow"
        >
          <Plus className="h-4 w-4" />
          신규 소켓/브라켓 인수검사 등록
        </button>
      </PageHeader>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">소켓 및 브라켓 인수검사 성적서 내역</h3>
          <span className="text-xs text-slate-500">총 {inspections.length}건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일시</th>
              <th className="px-4 py-3">품목명 / 구조체</th>
              <th className="px-4 py-3">채번된 사규 LOT</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">검사 수량</th>
              <th className="px-4 py-3 text-center">판정</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 소켓/브라켓 인수검사 내역이 없습니다.</td></tr>
            ) : inspections.map(row => (
              <tr key={row.insp_id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.inspected_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{row.item_name || '금속소켓/브라켓'}</td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-700">{row.lot_number || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.supplier_lot || '-'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{Number(row.qty||0).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    row.overall_result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {row.overall_result === 'PASS' ? 'PASS (합격/재고승인)' : 'FAIL (불합격)'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.inspector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
