import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  BookOpen, Search, RefreshCw, Filter, ArrowUpRight, ArrowDownRight,
  MinusCircle, PlusCircle, AlertCircle, Layers, Activity, Calendar, Download, ChevronRight, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MasterLedgerRow {
  lot_id: number;
  lot_number: string;
  category: string;
  item_name: string;
  unit: string;
  density?: number;
  thickness?: number;
  width_mm?: number;
  length_mm?: number;
  current_qty: number;
  total_in: number;
  total_out: number;
  total_loss: number;
  total_adj: number;
  last_txn_date?: string;
}

export function MasterMaterialLedgerPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'RAW' | 'SUB' | 'SEMI' | 'PRODUCT'>('ALL');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MasterLedgerRow[]>([]);
  const [selectedLot, setSelectedLot] = useState<MasterLedgerRow | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      let categoryFilter = '';
      if (activeTab === 'RAW') categoryFilter = '원자재(배합원료)';
      else if (activeTab === 'SUB') categoryFilter = '기타부자재';
      else if (activeTab === 'SEMI') categoryFilter = '반제품(조립소켓/틈새시트/플래싱)';
      else if (activeTab === 'PRODUCT') categoryFilter = '완제품';

      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);

      const res = await api.get<{ data: MasterLedgerRow[] }>(`/material-ledger/master-summary?${params.toString()}`);
      setRows(res.data || []);
    } catch (e: any) {
      toast.error('수불대장 데이터를 불러오는데 실패했습니다: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const filteredRows = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.item_name && r.item_name.toLowerCase().includes(q)) ||
      (r.lot_number && r.lot_number.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q))
    );
  });

  // 요약 통계
  const totalItemsCount = filteredRows.length;
  const totalStockSum = filteredRows.reduce((acc, r) => acc + Number(r.current_qty || 0), 0);
  const totalInSum = filteredRows.reduce((acc, r) => acc + Number(r.total_in || 0), 0);
  const totalOutSum = filteredRows.reduce((acc, r) => acc + Number(r.total_out || 0), 0);
  const totalLossSum = filteredRows.reduce((acc, r) => acc + Number(r.total_loss || 0), 0);

  return (
    <div className="p-6 space-y-6 bg-slate-900 text-slate-100 min-h-screen">
      <PageHeader
        title="📑 원부자재 종합 수불대장"
        description="원자재·부자재·반제품·완제품 입고 ➔ 출고 ➔ 로스(Loss) ➔ 최종 잔여재고 100% 실시간 집계"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-all border border-slate-700"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            새로고침
          </button>
        </div>
      </PageHeader>

      {/* 상단 4대 요약 KPI 카드리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>총 품목 수</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">{totalItemsCount.toLocaleString()} <span className="text-sm font-normal text-slate-400">품목</span></div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>기간 내 총 입고량</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">+{totalInSum.toLocaleString()}</div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>기간 내 총 출고량</span>
            <ArrowUpRight className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">-{totalOutSum.toLocaleString()}</div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>자동 산출 총 로스량 (Loss)</span>
            <MinusCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{totalLossSum.toLocaleString()}</div>
        </div>
      </div>

      {/* 검색 & 필터 바 */}
      <div className="bg-slate-800/60 border border-slate-700/80 p-4 rounded-xl space-y-4">
        {/* 탭 구분 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
            {[
              { id: 'ALL', label: '전체 보기' },
              { id: 'RAW', label: '🧪 원자재 (배합원료)' },
              { id: 'SUB', label: '📦 기타 부자재' },
              { id: 'SEMI', label: '✂️ 반제품 (가스켓/재단시트)' },
              { id: 'PRODUCT', label: '🏆 완제품' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">조회 기간:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
            />
            <span className="text-slate-500">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* 검색창 */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="품목명, LOT 번호, 카테고리로 수불 검색..."
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 수불대장 메인 테이블 */}
      <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4 font-semibold">카테고리</th>
                <th className="py-3.5 px-4 font-semibold">품목명</th>
                <th className="py-3.5 px-4 font-semibold">LOT 번호</th>
                <th className="py-3.5 px-4 font-semibold text-right">총 입고(+)</th>
                <th className="py-3.5 px-4 font-semibold text-right">총 출고(-)</th>
                <th className="py-3.5 px-4 font-semibold text-right text-amber-400">자동 로스(Loss)</th>
                <th className="py-3.5 px-4 font-semibold text-right text-emerald-400">최종 잔여재고</th>
                <th className="py-3.5 px-4 font-semibold text-center">단위</th>
                <th className="py-3.5 px-4 font-semibold text-center">최종 수불일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    수불 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    등록되었거나 해당하는 수불 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr
                    key={r.lot_id || idx}
                    onClick={() => setSelectedLot(r)}
                    className="hover:bg-slate-700/50 cursor-pointer transition-all border-b border-slate-700/40"
                  >
                    <td className="py-3 px-4 font-sans text-slate-300">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
                        {r.category || '일반'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-100">{r.item_name}</td>
                    <td className="py-3 px-4 text-blue-300 font-mono">{r.lot_number}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                      +{Number(r.total_in || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-red-400 font-semibold">
                      -{Number(r.total_out || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400 font-semibold">
                      {Number(r.total_loss || 0) > 0 ? `-${Number(r.total_loss).toLocaleString()}` : '0'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sm text-emerald-300 bg-emerald-950/20">
                      {Number(r.current_qty || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 font-sans">{r.unit || '개'}</td>
                    <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                      {r.last_txn_date ? r.last_txn_date.slice(0, 10) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MasterMaterialLedgerPage;
