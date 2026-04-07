import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface ItemMaster {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: string;
  unit: string;
  safety_stock: number;
}

interface StockEntry {
  item_code: string;
  item_name: string;
  unit: string;
  qty: number;
  note: string;
}

interface CurrentStock {
  item_code: string;
  item_name: string;
  item_category: string;
  unit: string;
  balance: number;
}

const CAT_LABELS: Record<string, string> = { RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품' };
const CAT_COLORS: Record<string, string> = {
  RM: 'bg-green-100 text-green-700',
  SM: 'bg-blue-100 text-blue-700',
  SA: 'bg-yellow-100 text-yellow-700',
  FP: 'bg-purple-100 text-purple-700',
};

export default function InitialInventoryPage() {
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [currentStock, setCurrentStock] = useState<CurrentStock[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const r = await api.get<{ data: ItemMaster[] }>('/items');
      setItems(r.data || []);
    } catch {}
  }, []);

  const fetchCurrentStock = useCallback(async () => {
    try {
      const r = await api.get<{ data: CurrentStock[] }>('/inventory/current-stock');
      setCurrentStock(r.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchItems();
    fetchCurrentStock();
  }, [fetchItems, fetchCurrentStock]);

  // Initialize entries when items load
  useEffect(() => {
    if (items.length > 0 && entries.length === 0) {
      setEntries(items.map(it => ({
        item_code: it.item_code,
        item_name: it.item_name,
        unit: it.unit,
        qty: 0,
        note: '',
      })));
    }
  }, [items, entries.length]);

  const filteredItems = activeTab === 'ALL'
    ? items
    : items.filter(it => it.item_category === activeTab);

  const filteredEntries = entries.filter(e => {
    if (activeTab === 'ALL') return true;
    const item = items.find(it => it.item_code === e.item_code);
    return item?.item_category === activeTab;
  });

  const updateQty = (itemCode: string, qty: number) => {
    setEntries(prev =>
      prev.map(e => e.item_code === itemCode ? { ...e, qty } : e)
    );
  };

  const updateNote = (itemCode: string, note: string) => {
    setEntries(prev =>
      prev.map(e => e.item_code === itemCode ? { ...e, note } : e)
    );
  };

  const nonZeroEntries = entries.filter(e => e.qty > 0);

  const handleSave = async () => {
    if (nonZeroEntries.length === 0) {
      alert('1건 이상의 재고 수량을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ data: { lot_number: string; items_initialized: number } }>(
        '/inventory/initialize',
        { items: nonZeroEntries.map(e => ({ item_code: e.item_code, qty: e.qty, note: e.note || undefined })) }
      );
      setSaved(true);
      setShowResult(true);
      alert(`초기 재고 설정 완료! (LOT: ${r.data.lot_number}, ${r.data.items_initialized}건)`);
      await fetchCurrentStock();
    } catch (e: any) {
      alert('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getExistingStock = (itemCode: string) => {
    return currentStock.find(s => s.item_code === itemCode);
  };

  const tabs = [
    { key: 'ALL', label: '전체', count: items.length },
    { key: 'RM', label: '원재료', count: items.filter(i => i.item_category === 'RM').length },
    { key: 'SM', label: '부자재', count: items.filter(i => i.item_category === 'SM').length },
    { key: 'SA', label: '반제품', count: items.filter(i => i.item_category === 'SA').length },
    { key: 'FP', label: '완제품', count: items.filter(i => i.item_category === 'FP').length },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">초기 재고 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          시스템 도입 시점의 실물 재고를 입력합니다. 각 품목별 현재 보유 수량을 정확히 기재하세요.
        </p>
      </div>

      {/* 현재 재고 현황 (이미 등록된 경우) */}
      {currentStock.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800 text-sm">기존 재고 데이터 감지</h3>
              <p className="text-xs text-blue-600 mt-0.5">
                현재 {currentStock.length}개 품목에 재고가 등록되어 있습니다.
                추가 입력 시 기존 재고에 더해집니다.
              </p>
            </div>
            <button
              onClick={() => setShowResult(!showResult)}
              className="text-xs text-blue-700 underline"
            >
              {showResult ? '숨기기' : '현재고 보기'}
            </button>
          </div>
          {showResult && (
            <div className="mt-3 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-blue-600 border-b border-blue-200">
                    <th className="text-left py-1 px-2">품목코드</th>
                    <th className="text-left py-1 px-2">품목명</th>
                    <th className="text-right py-1 px-2">현재고</th>
                    <th className="text-left py-1 px-2">단위</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStock.map(s => (
                    <tr key={s.item_code} className="border-b border-blue-100">
                      <td className="py-1 px-2 font-mono">{s.item_code}</td>
                      <td className="py-1 px-2">{s.item_name}</td>
                      <td className="py-1 px-2 text-right font-mono font-medium">{Number(s.balance).toLocaleString()}</td>
                      <td className="py-1 px-2">{s.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* 재고 입력 테이블 */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-700">
            재고 수량 입력 ({filteredEntries.length}건)
          </h2>
          <div className="text-xs text-gray-400">
            입력된 품목: {nonZeroEntries.length}건
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">카테고리</th>
                <th className="px-3 py-2 text-left">품목코드</th>
                <th className="px-3 py-2 text-left">품목명</th>
                <th className="px-3 py-2 text-center w-20">단위</th>
                <th className="px-3 py-2 text-right w-24">기존재고</th>
                <th className="px-3 py-2 text-right w-32">수량 입력</th>
                <th className="px-3 py-2 text-left">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.map((entry, idx) => {
                const item = items.find(it => it.item_code === entry.item_code);
                const existing = getExistingStock(entry.item_code);
                return (
                  <tr key={entry.item_code} className={`hover:bg-gray-50 ${entry.qty > 0 ? 'bg-green-50' : ''}`}>
                    <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${CAT_COLORS[item?.item_category || ''] || 'bg-gray-100'}`}>
                        {CAT_LABELS[item?.item_category || ''] || item?.item_category}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.item_code}</td>
                    <td className="px-3 py-2 text-sm">{entry.item_name}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{entry.unit}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                      {existing ? Number(existing.balance).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={entry.qty || ''}
                        onChange={e => updateQty(entry.item_code, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-28 px-2 py-1 border rounded text-right text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.note}
                        onChange={e => updateNote(entry.item_code, e.target.value)}
                        placeholder="비고"
                        className="w-full px-2 py-1 border rounded text-sm text-gray-600 focus:ring-2 focus:ring-blue-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {nonZeroEntries.length > 0 && (
            <span>
              총 <span className="font-bold text-gray-900">{nonZeroEntries.length}</span>건의 품목에 재고를 설정합니다.
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {saved && (
            <span className="text-green-600 text-sm font-medium flex items-center gap-1">
              저장 완료
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || nonZeroEntries.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중...' : '초기 재고 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
