import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { 
  Calendar, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownLeft, 
  Layers, Package, AlertCircle, TrendingUp, Info, List, FileSpreadsheet, Grid3X3
} from 'lucide-react';
import { toast } from 'sonner';

interface LedgerItem {
  txn_id: number;
  txn_date: string;
  txn_type: 'IN' | 'OUT' | 'LOSS' | 'ADJ';
  qty: number;
  purpose: string;
  worker: string;
  created_at: string;
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  item_category: string;
  lot_id: number | null;
  lot_number: string | null;
  opening_qty: number;
  balance: number;
}

interface SummaryLedgerItem {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  item_category: string;
  opening_qty: number;
  incoming_qty: number;
  outgoing_qty: number;
  balance: number;
}

interface MatrixData {
  dates: string[];
  rows: Array<{
    type: string;
    data: number[];
  }>;
}

interface ItemInfo {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  item_category: string;
}

interface SummaryData {
  fromDate: string;
  toDate: string;
  total_transactions: number;
  total_in: number;
  total_out: number;
  total_loss: number;
}

interface LedgerResponse {
  ok: boolean;
  ledger: LedgerItem[];
  summaryLedger: SummaryLedgerItem[];
  matrix: MatrixData | null;
  itemsList: ItemInfo[];
  summary: SummaryData;
}

const CAT_LABELS: Record<string, string> = { RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품' };
const TXN_LABELS: Record<string, string> = {
  IN: '입고',
  OUT: '출고',
  LOSS: '폐기/손실',
  ADJ: '조정'
};

export default function InventoryLedgerPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().slice(0, 10);

  const [from, setFrom] = useState(oneMonthAgoStr);
  const [to, setTo] = useState(todayStr);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'LIST' | 'EXCEL_SUMMARY' | 'MATRIX'>('EXCEL_SUMMARY');

  const [loading, setLoading] = useState(false);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [summaryLedger, setSummaryLedger] = useState<SummaryLedgerItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [itemsList, setItemsList] = useState<ItemInfo[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (selectedItemId) params.append('item_id', selectedItemId);
      if (lotNumber) params.append('lot_number', lotNumber);
      if (searchText) params.append('search', searchText);

      const res = await api.get<LedgerResponse>(`/inventory/ledger?${params.toString()}`);
      if (res.ok) {
        setLedger(res.ledger || []);
        setSummaryLedger(res.summaryLedger || []);
        setMatrix(res.matrix || null);
        setItemsList(res.itemsList || []);
        setSummary(res.summary);
      } else {
        toast.error('수불대장 데이터를 가져오지 못했습니다.');
      }
    } catch (err) {
      toast.error('수불대장 조회 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedItemId, lotNumber, searchText]);

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLedger();
  };

  const handleReset = () => {
    setFrom(oneMonthAgoStr);
    setTo(todayStr);
    setSelectedItemId('');
    setLotNumber('');
    setSearchText('');
    setTimeout(fetchLedger, 50);
  };

  // 품목 대분류 그룹핑 (자재수불합계 엑셀 스타일용)
  const groupedSummary = summaryLedger.reduce((acc, curr) => {
    let groupName = '기타 자재';
    const name = curr.item_name;
    const cat = curr.item_category;

    if (name.includes('그라스울') || name.includes('글라스울')) {
      groupName = '■ 그라스울 (Glass Wool)';
    } else if (name.includes('차열재') || name.includes('세라믹울') || name.includes('블랭킷')) {
      groupName = '■ 차열재 (Ceramic Wool)';
    } else if (name.includes('소켓') || name.includes('FN')) {
      groupName = '■ 소켓 및 반제품 (Socket)';
    } else if (name.includes('플래싱') || name.includes('강재') || name.includes('도금')) {
      groupName = '■ 플래싱 및 강재류 (Flashing)';
    } else if (cat === 'RM') {
      groupName = '■ 배합 원재료 (Raw Materials)';
    } else if (cat === 'SM') {
      groupName = '■ 부자재 및 기타 (Sub Materials)';
    }

    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(curr);
    return acc;
  }, {} as Record<string, SummaryLedgerItem[]>);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="재고 수불대장" 
        description="품목별/LOT별 월별 및 일자별 입출고 수불 기록을 엑셀 스타일로 시각화하여 확인합니다." 
      />

      {/* 1. 검색 및 필터 패널 */}
      <form onSubmit={handleSearch} className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5 col-span-1 md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Calendar size={13} /> 조회 기간
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Layers size={13} /> 품목 선택
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
            >
              <option value="">전체 품목</option>
              {itemsList.map(item => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name} {item.spec ? `(${item.spec})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Package size={13} /> 로트 번호
            </label>
            <input
              type="text"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="LOT 번호 검색"
              className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Search size={13} /> 통합 검색
            </label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="품목명 또는 코드 검색"
              className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-gray-600 border px-4 py-2 rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
          >
            초기화
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-all font-medium shadow-sm"
          >
            {loading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Filter size={14} />
            )}
            조회
          </button>
        </div>
      </form>

      {/* 2. 요약 패널 */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">조회 품목 수</div>
              <div className="text-xl font-bold text-gray-800 mt-1">
                {summaryLedger.length} <span className="text-sm font-normal text-gray-500">품목</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 text-gray-500 rounded-lg">
              <Info size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">기간 입고 합계</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {summary.total_in.toLocaleString()} <span className="text-sm font-normal text-gray-500">개</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <ArrowDownLeft size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">기간 출고 합계</div>
              <div className="text-xl font-bold text-red-600 mt-1">
                {summary.total_out.toLocaleString()} <span className="text-sm font-normal text-gray-500">개</span>
              </div>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <ArrowUpRight size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">기간 조정/손실</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {summary.total_loss.toLocaleString()} <span className="text-sm font-normal text-gray-500">개</span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertCircle size={20} />
            </div>
          </div>
        </div>
      )}

      {/* 3. 뷰 모드 탭 스위치 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('EXCEL_SUMMARY')}
          className={`flex items-center gap-1.5 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'EXCEL_SUMMARY' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet size={16} /> 자재 수불 요약 (엑셀 시트 스타일)
        </button>
        <button
          onClick={() => setActiveTab('MATRIX')}
          className={`flex items-center gap-1.5 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'MATRIX' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Grid3X3 size={16} /> 수불 흐름 매트릭스 (가로 날짜 전개)
        </button>
        <button
          onClick={() => setActiveTab('LIST')}
          className={`flex items-center gap-1.5 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'LIST' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <List size={16} /> 수불대장 상세 내역 (리스트형)
        </button>
      </div>

      {/* 4. 탭 콘텐츠 영역 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        
        {/* ─── 탭 1: 자재 수불 요약 (엑셀 '자재수불합계' 시트 스타일) ─── */}
        {activeTab === 'EXCEL_SUMMARY' && (
          <div className="p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
              <FileSpreadsheet size={15} /> 자재 수불 요약현황
            </h3>

            {Object.keys(groupedSummary).length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                표시할 재고 요약 데이터가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 font-semibold">
                      <th className="px-4 py-3">품목명</th>
                      <th className="px-4 py-3">규격</th>
                      <th className="px-4 py-3">단위</th>
                      <th className="px-4 py-3 text-right">기초 재고</th>
                      <th className="px-4 py-3 text-right">입고 수량</th>
                      <th className="px-4 py-3 text-right">출고 수량</th>
                      <th className="px-4 py-3 text-right bg-blue-50/50 text-blue-700">현재고 (기말)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedSummary).map(([groupName, items]) => (
                      <React.Fragment key={groupName}>
                        {/* 엑셀 스타일 대분류 구분선 */}
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <td colSpan={7} className="px-4 py-2.5 font-bold text-gray-700 text-xs md:text-sm">
                            {groupName}
                          </td>
                        </tr>
                        {items.map((item) => (
                          <tr key={item.item_id} className="border-b hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{item.item_name}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono">{item.spec || '-'}</td>
                            <td className="px-4 py-3 text-gray-400">{item.unit}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-600">{item.opening_qty.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-blue-600 font-medium">
                              {item.incoming_qty > 0 ? `+${item.incoming_qty.toLocaleString()}` : '0'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-red-600 font-medium">
                              {item.outgoing_qty > 0 ? `-${item.outgoing_qty.toLocaleString()}` : '0'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold bg-blue-50/20 text-blue-800">
                              {item.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── 탭 2: 수불 흐름 매트릭스 (가로 날짜 전개) ─── */}
        {activeTab === 'MATRIX' && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Grid3X3 size={15} /> 일자별 입출고/재고 흐름 매트릭스
              </h3>
              {selectedItemId && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-bold">
                  {itemsList.find(i => i.item_id === parseInt(selectedItemId))?.item_name}
                </span>
              )}
            </div>

            {!selectedItemId ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-slate-50/50 rounded-xl border border-dashed p-6">
                💡 상단 필터에서 <strong>품목을 선택</strong>하시면 해당 품목의 일자별 입출고 및 재고 추이 매트릭스가 나타납니다.
              </div>
            ) : !matrix ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                해당 기간 내의 매트릭스 데이터를 생성할 수 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-xl shadow-inner max-w-full">
                <table className="w-full border-collapse text-xs md:text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 font-semibold">
                      <th className="px-4 py-3 border-r bg-gray-150 text-left min-w-[100px] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">구분 (날짜)</th>
                      {matrix.dates.map(date => (
                        <th key={date} className="px-3 py-3 border-r font-mono min-w-[90px]">
                          {date.slice(5)} {/* MM-DD 포맷 */}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, idx) => (
                      <tr 
                        key={row.type} 
                        className={`border-b hover:bg-slate-50/50 ${
                          row.type === '재고' ? 'bg-blue-50/20 font-bold' : ''
                        }`}
                      >
                        <td className={`px-4 py-3 border-r text-left font-bold sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${
                          row.type === '입고' ? 'text-blue-700 bg-blue-50/60' :
                          row.type === '출고' ? 'text-red-700 bg-red-50/60' :
                          'text-gray-800 bg-slate-100'
                        }`}>
                          {row.type}
                        </td>
                        {row.data.map((val, valIdx) => (
                          <td 
                            key={valIdx} 
                            className={`px-3 py-3 border-r font-mono ${
                              row.type === '입고' && val > 0 ? 'text-blue-600 font-semibold' :
                              row.type === '출고' && val > 0 ? 'text-red-600 font-semibold' :
                              row.type === '재고' ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {val.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── 탭 3: 수불대장 상세 내역 (기존 리스트 형태) ─── */}
        {activeTab === 'LIST' && (
          <div>
            {ledger.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                해당 조건의 입출고 상세 내역이 존재하지 않습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-100/70 border-b text-gray-600 font-semibold">
                      <th className="px-4 py-3">일자</th>
                      <th className="px-4 py-3">구분</th>
                      <th className="px-4 py-3">품목명 / 코드</th>
                      <th className="px-4 py-3">규격</th>
                      <th className="px-4 py-3">로트 번호</th>
                      <th className="px-4 py-3 text-right">이월 수량</th>
                      <th className="px-4 py-3 text-right">거래량</th>
                      <th className="px-4 py-3 text-right">기말 수량</th>
                      <th className="px-4 py-3">작업자</th>
                      <th className="px-4 py-3">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700">
                    {ledger.map((row) => (
                      <tr key={row.txn_id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-4 py-3 font-mono">{row.txn_date}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            row.txn_type === 'IN' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            row.txn_type === 'OUT' ? 'bg-red-50 text-red-700 border-red-200' :
                            row.txn_type === 'LOSS' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                            {TXN_LABELS[row.txn_type] || row.txn_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{row.item_name}</div>
                          <div className="text-gray-400 text-[10px] font-mono mt-0.5">{row.item_code}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[150px] truncate">{row.spec || '-'}</td>
                        <td className="px-4 py-3 font-mono">
                          {row.lot_number ? (
                            <span className="text-blue-600 hover:underline cursor-pointer" onClick={() => setLotNumber(row.lot_number || '')}>
                              {row.lot_number}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">
                          {row.opening_qty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                          <span className={row.txn_type === 'IN' ? 'text-blue-600' : row.txn_type === 'OUT' ? 'text-red-600' : 'text-gray-900'}>
                            {row.txn_type === 'IN' ? '+' : row.txn_type === 'OUT' || row.txn_type === 'LOSS' ? '-' : ''}
                            {row.qty.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-500 font-normal ml-0.5">{row.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                          {row.balance.toLocaleString()}
                          <span className="text-[10px] text-gray-500 font-normal ml-0.5">{row.unit}</span>
                        </td>
                        <td className="px-4 py-3">{row.worker || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{row.purpose || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
