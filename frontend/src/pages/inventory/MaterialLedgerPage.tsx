import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Package, MapPin, Filter, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── 랙 로케이션 마스터 (1구역 O1~A3 / 2구역 U1~P3 거꾸로 배치) ──────────────────────
const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
const ZONE_2_COLS = ['U','T','S','R','Q','P'];
const RACK_TIERS = [3, 2, 1]; // 3층, 2층, 1층

interface LedgerEntry {
  id?: string;
  date: string;
  lotNumber: string;
  itemName: string;
  density?: number;
  thickness?: number;
  width?: number;
  length?: number;
  location: string;
  inQuantity: number;
  outQuantity: number;
  adjustQuantity: number;
  currentStock: number;
}

interface RackStatus {
  location_code: string;
  lot_number: string | null;
  item_name: string | null;
  currentStock: number;
}

export function MaterialLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [lotSearch, setLotSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 랙 위치별 재고 맵 상태
  const [rackMap, setRackMap] = useState<Record<string, RackStatus>>({});

  useEffect(() => {
    // 기본 날짜: 오늘
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  }, []);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (category) params.append('category', category);
      if (locationFilter) params.append('location', locationFilter);
      
      const res = await api.get<{ data?: LedgerEntry[] } | LedgerEntry[]>(`/api/material-ledger?${params.toString()}`);
      const dataList: LedgerEntry[] = Array.isArray(res) ? res : (res.data || []);
      setEntries(dataList);

      // 랙별 최신 수불/재고 현황 집계
      const map: Record<string, RackStatus> = {};
      for (const entry of dataList) {
        if (entry.location) {
          map[entry.location] = {
            location_code: entry.location,
            lot_number: entry.lotNumber,
            item_name: entry.itemName,
            currentStock: entry.currentStock
          };
        }
      }
      setRackMap(map);
    } catch (error) {
      console.error('Failed to fetch material ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, category, locationFilter]);

  const filteredEntries = entries.filter(entry => {
    const matchLot = entry.lotNumber.toLowerCase().includes(lotSearch.toLowerCase()) ||
                     entry.itemName.toLowerCase().includes(lotSearch.toLowerCase());
    const matchLoc = !locationFilter || entry.location === locationFilter;
    return matchLot && matchLoc;
  });

  const totalIn = filteredEntries.reduce((sum, entry) => sum + (entry.inQuantity || 0), 0);
  const totalOut = filteredEntries.reduce((sum, entry) => sum + (entry.outQuantity || 0), 0);

  // 랙 선택 시 클릭 핸들러
  const handleToggleRackFilter = (code: string) => {
    if (locationFilter === code) {
      setLocationFilter(''); // 선택 해제
    } else {
      setLocationFilter(code); // 선택 필터링
    }
  };

  // 그래픽 랙 그림 렌더링 함수
  const renderGraphicRack = (title: string, subtitle: string, cols: string[], bgHeader: string) => {
    return (
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-4">
        <div className={cn('px-4 py-2 text-white font-bold flex justify-between items-center text-xs', bgHeader)}>
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5" />
            <span>{title}</span>
            <span className="font-normal opacity-85">({subtitle})</span>
          </div>
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-[11px]">
            클릭하여 랙 위치별 수불대장 즉시 필터링
          </span>
        </div>

        <div className="p-3 overflow-x-auto bg-slate-50">
          <div className="min-w-[720px] space-y-2">
            {RACK_TIERS.map((tier) => (
              <div key={tier} className="flex items-center gap-2">
                <div className="w-14 h-12 shrink-0 bg-slate-800 text-white rounded-md font-black text-xs flex flex-col items-center justify-center">
                  <span>{tier}층</span>
                </div>
                <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                  {cols.map((col) => {
                    const code = `${col}${tier}`;
                    const st = rackMap[code];
                    const occupied = !!st?.currentStock && st.currentStock > 0;
                    const isSelected = locationFilter === code;

                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleToggleRackFilter(code)}
                        className={cn(
                          'h-12 rounded-lg border-2 p-1 text-left transition-all relative overflow-hidden flex flex-col justify-between',
                          isSelected
                            ? 'ring-4 ring-blue-500 border-blue-600 bg-blue-100 scale-105 z-10'
                            : occupied
                              ? 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100'
                              : 'border-slate-300 bg-white hover:bg-slate-100 border-dashed'
                        )}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className={cn('text-[10px] font-black font-mono px-1 rounded', isSelected ? 'bg-blue-600 text-white' : occupied ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700')}>
                            {code}
                          </span>
                          {occupied && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        </div>

                        {occupied ? (
                          <div className="text-[9px] font-mono leading-tight truncate">
                            <p className="font-bold text-slate-800 truncate" title={st.item_name || ''}>{st.item_name}</p>
                            <p className="text-emerald-700 font-black">{Number(st.currentStock).toLocaleString()} EA</p>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 text-center block">비어있음</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 칸 레벨 표기 */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
              <div className="w-14 text-center text-[10px] font-bold text-slate-500">칸 (Bay)</div>
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((col) => (
                  <div key={col} className="text-center font-bold text-[10px] font-mono text-slate-600 bg-slate-200/70 py-0.5 rounded">
                    {col}칸
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="📊 재고수불대장 & 랙 위치별 그래픽 맵"
        description="1구역 (A1~O3 15칸×3층) & 2구역 (P1~U3 6칸×3층) 그래픽 랙 그림 시각화 및 위치별 수불 내역 필터링"
      >
        <div className="flex gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium text-xs">총입고:</span>
            <span className="text-blue-600 font-black text-base">{totalIn.toLocaleString()}</span>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium text-xs">총출고:</span>
            <span className="text-rose-600 font-black text-base">{totalOut.toLocaleString()}</span>
          </div>
        </div>
      </PageHeader>

      {/* 🖼️ 상단 시각적 그래픽 랙 맵 그림 뷰어 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            🖼️ 공장 랙 위치별 그래픽 맵 (랙 클릭 시 수불대장 즉시 필터링)
          </h3>
          {locationFilter && (
            <button
              onClick={() => setLocationFilter('')}
              className="text-xs bg-blue-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
            >
              선택 랙({locationFilter}) 필터 해제 ✕
            </button>
          )}
        </div>

        {renderGraphicRack('1구역 랙 맵 (A~O 15칸 × 3층)', '총 45개 셀', ZONE_1_COLS, 'bg-slate-900')}
        {renderGraphicRack('2구역 랙 맵 (P~U 6칸 × 3층)', '총 18개 셀', ZONE_2_COLS, 'bg-indigo-900')}
      </div>

      {/* 필터 및 검색 바 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">시작일</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-[130px]"
            />
          </div>
          <div className="flex items-end pb-2">
            <span className="text-slate-400 text-xs">~</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">종료일</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-[130px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">카테고리</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
              <option value="">전체 카테고리</option>
              <option value="raw_material">원자재 (D101~D104)</option>
              <option value="finished_good">완제품</option>
              <option value="subsidiary">부자재 (FN테크 등)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">랙 위치 선택 (A1~U3)</label>
            <select 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            >
              <option value="">전체 랙 위치 (63개 셀)</option>
              <optgroup label="1구역 (A~O 15칸 × 3층)">
                {ZONE_1_COLS.flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                  <option key={c} value={c}>{c} 랙 셀 {rackMap[c]?.currentStock ? `(${rackMap[c].item_name})` : '(공실)'}</option>
                ))}
              </optgroup>
              <optgroup label="2구역 (P~U 6칸 × 3층)">
                {ZONE_2_COLS.flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                  <option key={c} value={c}>{c} 랙 셀 {rackMap[c]?.currentStock ? `(${rackMap[c].item_name})` : '(공실)'}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">LOT / 품목 검색</label>
            <input 
              type="text" 
              placeholder="LOT번호 또는 품목명 입력..."
              value={lotSearch} 
              onChange={(e) => setLotSearch(e.target.value)}
              className="border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <button 
            onClick={fetchLedger}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 text-xs transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            수불대장 조회
          </button>
        </div>
      </div>

      {/* 수불 대장 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">
            📋 입출고 수불 내역 {locationFilter && <span className="text-blue-700 font-mono font-black ml-1">[{locationFilter} 랙 필터 적용 중]</span>}
          </h3>
          <span className="text-xs text-slate-500">총 {filteredEntries.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-center whitespace-nowrap">날짜</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">LOT번호</th>
                <th className="px-4 py-3 whitespace-nowrap">품목명</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">밀도K</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">두께T</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">폭W</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">길이L</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">랙 위치</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">당일입고</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">당일출고</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">조정</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">현재고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    수불 데이터를 로딩하는 중입니다...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    조회된 수불 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{entry.date}</td>
                    <td className="px-4 py-2.5 text-center font-bold font-mono text-slate-800">{entry.lotNumber}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{entry.itemName}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{entry.density || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{entry.thickness || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{entry.width || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{entry.length || '-'}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-black text-blue-700 bg-blue-50/50">
                      {entry.location}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${entry.inQuantity > 0 ? 'text-blue-600 bg-blue-50/40' : 'text-slate-400'}`}>
                      {entry.inQuantity > 0 ? entry.inQuantity.toLocaleString() : '-'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${entry.outQuantity > 0 ? 'text-rose-600 bg-rose-50/40' : 'text-slate-400'}`}>
                      {entry.outQuantity > 0 ? entry.outQuantity.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      {entry.adjustQuantity !== 0 ? entry.adjustQuantity.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900 bg-slate-100/60">
                      {entry.currentStock.toLocaleString()}
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

