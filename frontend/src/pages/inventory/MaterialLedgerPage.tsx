import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

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

export function MaterialLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [lotSearch, setLotSearch] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (location) params.append('location', location);
      
      const res = await api.get(`/api/material-ledger?${params.toString()}`);
      if (res.data) {
        setEntries(res.data);
      }
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
  }, [dateFrom, dateTo, category, location]);

  const filteredEntries = entries.filter(entry => 
    entry.lotNumber.toLowerCase().includes(lotSearch.toLowerCase())
  );

  const totalIn = filteredEntries.reduce((sum, entry) => sum + (entry.inQuantity || 0), 0);
  const totalOut = filteredEntries.reduce((sum, entry) => sum + (entry.outQuantity || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">재고수불대장</h1>
        <div className="flex gap-6 bg-white px-4 py-2 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">총입고:</span>
            <span className="text-blue-600 font-bold text-lg">{totalIn.toLocaleString()}</span>
          </div>
          <div className="w-px bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">총출고:</span>
            <span className="text-red-600 font-bold text-lg">{totalOut.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
            />
          </div>
          <div className="flex items-end pb-2">
            <span className="text-gray-500">~</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
              <option value="">전체</option>
              <option value="raw_material">원자재</option>
              <option value="finished_good">완제품</option>
              <option value="subsidiary">부자재</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
              <option value="">전체</option>
              <option value="warehouse_a">A창고</option>
              <option value="warehouse_b">B창고</option>
              <option value="production">생산라인</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">LOT 검색</label>
            <input 
              type="text" 
              placeholder="LOT번호 입력..."
              value={lotSearch} 
              onChange={(e) => setLotSearch(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <button 
            onClick={fetchLedger}
            className="bg-blue-600 text-white px-5 py-2 rounded font-medium hover:bg-blue-700 text-sm transition-colors"
          >
            조회
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">날짜</th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">LOT번호</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">품목명</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">밀도K</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">두께T</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">폭W</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">길이L</th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">위치</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">당일입고</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">당일출고</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">조정</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">현재고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-600">{entry.date}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">{entry.lotNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{entry.itemName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{entry.density || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{entry.thickness || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{entry.width || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{entry.length || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{entry.location}</td>
                    <td className={`px-4 py-3 text-right font-medium ${entry.inQuantity > 0 ? 'text-blue-600 bg-blue-50/30' : 'text-gray-400'}`}>
                      {entry.inQuantity > 0 ? entry.inQuantity.toLocaleString() : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${entry.outQuantity > 0 ? 'text-red-600 bg-red-50/30' : 'text-gray-400'}`}>
                      {entry.outQuantity > 0 ? entry.outQuantity.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {entry.adjustQuantity !== 0 ? entry.adjustQuantity.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 bg-gray-50">
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
