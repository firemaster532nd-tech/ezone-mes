import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Package, Search, Filter } from 'lucide-react';

interface MaterialLot {
  id: string;
  lot_number: string;
  item_name: string;
  category: string;
  density?: number;
  thickness?: number;
  width?: number;
  length?: number;
  unit: string;
  location: string;
  current_stock: number;
  today_in?: number;
  today_out?: number;
  received_date: string;
  notes?: string;
}

interface StockSummary {
  total_lots: number;
  categories: {
    name: string;
    total_stock: number;
  }[];
}

const CATEGORIES = ['전체', '세라믹울', '차열재', '그라스울', '그라스울보드', '소켓', '기타부자재'];
const LOCATIONS = ['전체', '시험용', '출하대기', '본재고'];

export function MaterialStockPage() {
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedLocation, setSelectedLocation] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lotsRes, summaryRes] = await Promise.all([
        api.get('/api/material-lots'),
        api.get('/api/material-stock-summary')
      ]);
      // 응답 데이터 구조에 맞춰 할당합니다.
      setLots(lotsRes.data || lotsRes || []);
      setSummary(summaryRes.data || summaryRes || null);
    } catch (error) {
      console.error('Failed to fetch material stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = lots.filter(lot => {
    const matchCategory = selectedCategory === '전체' || lot.category === selectedCategory;
    const matchLocation = selectedLocation === '전체' || lot.location === selectedLocation;
    const matchSearch = searchTerm === '' || 
      lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchLocation && matchSearch;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Package className="w-6 h-6 mr-2" />
          LOT 재고현황
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">총 LOT 수</div>
          <div className="text-2xl font-bold text-gray-900">{summary?.total_lots || 0}</div>
        </div>
        {summary?.categories?.map(cat => (
          <div key={cat.name} className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">{cat.name} 재고</div>
            <div className="text-2xl font-bold text-gray-900">{cat.total_stock.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 w-16 flex items-center gap-1">
                <Filter className="w-4 h-4" />
                분류
              </span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedCategory === cat 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 w-16">위치</span>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map(loc => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(loc)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedLocation === loc 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="LOT번호, 품목명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LOT번호</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목명</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">밀도(K)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">두께(T)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">폭(W)</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">길이(L)</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">단위</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">위치</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">현재고</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금일입고</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금일출고</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">입고일</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">비고</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    조건에 맞는 재고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredLots.map((lot) => (
                  <tr key={lot.id} className={lot.current_stock === 0 ? 'text-gray-400 bg-gray-50/50' : 'text-gray-900 hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{lot.lot_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{lot.item_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{lot.density ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{lot.thickness ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{lot.width ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{lot.length ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{lot.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${
                        lot.location === '시험용' ? 'bg-purple-100 text-purple-800' :
                        lot.location === '출하대기' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {lot.location}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${lot.current_stock > 0 ? 'text-blue-700' : ''}`}>
                      {lot.current_stock.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600">{lot.today_in || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-500">{lot.today_out || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{lot.received_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{lot.notes || '-'}</td>
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
