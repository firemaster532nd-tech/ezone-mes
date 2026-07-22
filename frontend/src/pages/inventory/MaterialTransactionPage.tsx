import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: 'IN' | 'OUT';
  quantity: number;
  site_name?: string;
  notes?: string;
  material_lot_id: string;
  material_lots?: {
    lot_number: string;
    items?: {
      name: string;
      code: string;
    };
  };
}

interface Lot {
  id: string;
  lot_number: string;
  item_id: string;
  current_stock: number;
  location?: string;
  items?: {
    name: string;
    code: string;
  };
}

export function MaterialTransactionPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form State
  const [transactionDate, setTransactionDate] = useState(todayDate);
  const [lotSearch, setLotSearch] = useState('');
  const [searchedLots, setSearchedLots] = useState<Lot[]>([]);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [siteName, setSiteName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lotInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/material-transactions', {
        params: {
          date_from: todayDate,
          date_to: todayDate,
        },
      });
      if (response.data) {
        setTransactions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [todayDate]);

  const searchLots = async (query: string) => {
    if (!query) {
      setSearchedLots([]);
      return;
    }
    try {
      const response = await api.get('/api/material-lots', {
        params: { search: query },
      });
      setSearchedLots(response.data || []);
    } catch (error) {
      console.error('Failed to search lots', error);
      setSearchedLots([]);
    }
  };

  const handleLotSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchLots(lotSearch);
    }
  };

  const selectLot = (lot: Lot) => {
    setSelectedLot(lot);
    setLotSearch(lot.lot_number);
    setSearchedLots([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot || quantity === '') {
      alert('LOT 정보와 수량을 정확히 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/material-transactions', {
        transaction_date: transactionDate,
        transaction_type: transactionType,
        quantity: Number(quantity),
        site_name: transactionType === 'OUT' ? siteName : undefined,
        notes,
        material_lot_id: selectedLot.id,
      });
      
      alert('저장되었습니다.');
      
      // Reset form
      setSelectedLot(null);
      setLotSearch('');
      setQuantity('');
      setSiteName('');
      setNotes('');
      setTransactionType('IN');
      
      // Refetch table
      fetchTransactions();
      
      // Keep focus on lot input
      if (lotInputRef.current) {
        lotInputRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to submit transaction', error);
      alert('입출고 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col md:flex-row gap-6">
      {/* Left side: Transactions Table */}
      <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">오늘의 입출고 내역 ({todayDate})</h2>
        {loading ? (
          <p>로딩 중...</p>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-2 px-3">유형</th>
                <th className="py-2 px-3">LOT 번호</th>
                <th className="py-2 px-3">품목</th>
                <th className="py-2 px-3 text-right">수량</th>
                <th className="py-2 px-3">현장명</th>
                <th className="py-2 px-3">비고</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    내역이 없습니다.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">
                      <span className={`px-2 py-1 rounded text-xs ${t.transaction_type === 'IN' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        {t.transaction_type === 'IN' ? '입고' : '출고'}
                      </span>
                    </td>
                    <td className="py-2 px-3">{t.material_lots?.lot_number || '-'}</td>
                    <td className="py-2 px-3">{t.material_lots?.items?.name || '-'}</td>
                    <td className="py-2 px-3 text-right font-semibold">{t.quantity.toLocaleString()}</td>
                    <td className="py-2 px-3">{t.site_name || '-'}</td>
                    <td className="py-2 px-3 text-gray-600">{t.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Right side: Input Form */}
      <div className="w-full md:w-96 bg-white p-4 rounded-lg shadow-sm border border-gray-200 shrink-0">
        <h2 className="text-xl font-bold mb-4">입출고 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">일자</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded p-2"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium mb-1">LOT 검색 (바코드 스캔)</label>
            <div className="flex gap-2">
              <input
                ref={lotInputRef}
                type="text"
                className="w-full border border-gray-300 rounded p-2"
                placeholder="LOT 번호 입력 후 Enter"
                value={lotSearch}
                onChange={(e) => setLotSearch(e.target.value)}
                onKeyDown={handleLotSearchKeyDown}
              />
              <button
                type="button"
                className="bg-gray-100 border border-gray-300 rounded px-3 hover:bg-gray-200"
                onClick={() => searchLots(lotSearch)}
              >
                검색
              </button>
            </div>
            
            {/* Search Results Dropdown */}
            {searchedLots.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 shadow-lg max-h-48 overflow-y-auto">
                {searchedLots.map((lot) => (
                  <li
                    key={lot.id}
                    className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                    onClick={() => selectLot(lot)}
                  >
                    <div className="font-semibold">{lot.lot_number}</div>
                    <div className="text-xs text-gray-600">
                      품목: {lot.items?.name} | 재고: {lot.current_stock}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedLot && (
            <div className="bg-blue-50 p-3 rounded border border-blue-100 text-sm">
              <p><strong>선택된 품목:</strong> {selectedLot.items?.name} ({selectedLot.items?.code})</p>
              <p><strong>현재 재고:</strong> {selectedLot.current_stock.toLocaleString()}</p>
              <p><strong>위치:</strong> {selectedLot.location || '미지정'}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">유형</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="transactionType"
                  value="IN"
                  checked={transactionType === 'IN'}
                  onChange={() => setTransactionType('IN')}
                  className="w-4 h-4 text-blue-600"
                />
                입고 (IN)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="transactionType"
                  value="OUT"
                  checked={transactionType === 'OUT'}
                  onChange={() => setTransactionType('OUT')}
                  className="w-4 h-4 text-red-600"
                />
                출고 (OUT)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">수량</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded p-2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              min={0.001}
              step="any"
              required
            />
          </div>

          {transactionType === 'OUT' && (
            <div>
              <label className="block text-sm font-medium mb-1">현장명</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded p-2"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="출고 시 필수/권장"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">비고</label>
            <textarea
              className="w-full border border-gray-300 rounded p-2"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedLot}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>
    </div>
  );
}
