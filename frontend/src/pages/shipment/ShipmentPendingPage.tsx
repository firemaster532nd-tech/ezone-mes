import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshCw, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PendingItem {
  po_id: number;
  po_number: string;
  po_date: string;
  customer_name: string | null;
  project_name: string | null;
  site_name: string | null;
  poi_id: number;
  item_name: string;
  spec: string | null;
  ordered_qty: number;
  shipped_qty: number;
  unit: string;
}

interface GroupedPO {
  po_id: number;
  po_number: string;
  po_date: string;
  customer_name: string | null;
  project_name: string | null;
  site_name: string | null;
  items: PendingItem[];
  total_ordered: number;
  total_shipped: number;
}

export default function ShipmentPendingPage() {
  const [list, setList] = useState<GroupedPO[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('PENDING');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PendingItem[] }>('/shipment-orders/pending');
      const raw = res.data ?? [];

      // 발주서별 그룹핑
      const grouped: Record<number, GroupedPO> = {};
      for (const item of raw) {
        if (!grouped[item.po_id]) {
          grouped[item.po_id] = {
            po_id: item.po_id,
            po_number: item.po_number,
            po_date: item.po_date,
            customer_name: item.customer_name,
            project_name: item.project_name,
            site_name: item.site_name,
            items: [],
            total_ordered: 0,
            total_shipped: 0,
          };
        }
        grouped[item.po_id].items.push(item);
        grouped[item.po_id].total_ordered += Number(item.ordered_qty || 0);
        grouped[item.po_id].total_shipped += Number(item.shipped_qty || 0);
      }

      setList(Object.values(grouped));
    } catch { toast.error('목록 로드 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const filtered = list.filter(po => {
    if (filter === 'PENDING') return po.total_shipped < po.total_ordered;
    if (filter === 'DONE') return po.total_shipped >= po.total_ordered;
    return true;
  });

  const pendingCount = list.filter(po => po.total_shipped < po.total_ordered).length;
  const doneCount    = list.filter(po => po.total_shipped >= po.total_ordered).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PageHeader
        title="미출하현황"
        count={pendingCount}
        description="발주서 기준 출하 잔량 현황 — 미출하 품목을 한눈에 파악"
      >
        <button onClick={fetchList} disabled={loading} className="p-2 border rounded-xl hover:bg-white disabled:opacity-50">
          <RefreshCw className={cn('h-4 w-4 text-gray-600', loading && 'animate-spin')} />
        </button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '미출하', count: pendingCount, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertTriangle className="h-5 w-5 text-red-600" /> },
            { label: '출하완료', count: doneCount, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
            { label: '전체 발주', count: list.length, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Package className="h-5 w-5 text-blue-600" /> },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={cn('rounded-2xl border p-4 flex items-center gap-3', bg, border)}>
              <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
              <div>
                <p className={cn('text-2xl font-bold', color)}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex gap-1.5">
            {([['ALL', '전체'], ['PENDING', '미출하만'], ['DONE', '완료만']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  filter === key ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-100')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
            로드 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <CheckCircle2 className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-base font-semibold">
              {filter === 'PENDING' ? '모든 발주서의 출하가 완료되었습니다!' : '데이터가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(po => {
              const isComplete = po.total_shipped >= po.total_ordered;
              const progress = po.total_ordered > 0 ? Math.min(100, Math.round((po.total_shipped / po.total_ordered) * 100)) : 0;
              return (
                <div key={po.po_id} className={cn('bg-white rounded-2xl border shadow-sm overflow-hidden',
                  isComplete ? 'border-green-200' : 'border-red-200')}>
                  {/* 헤더 */}
                  <div className={cn('p-4 flex items-center gap-3', isComplete ? 'bg-green-50' : 'bg-red-50')}>
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center',
                      isComplete ? 'bg-green-100' : 'bg-red-100')}>
                      {isComplete
                        ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                        : <AlertTriangle className="h-5 w-5 text-red-600" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{po.po_number}</span>
                        {po.customer_name && <span className="text-xs text-gray-500">🏢 {po.customer_name}</span>}
                        {po.project_name && <span className="text-xs text-gray-500">🏗️ {po.project_name}</span>}
                        {po.site_name && <span className="text-xs text-gray-500">📍 {po.site_name}</span>}
                        <span className="text-xs text-gray-400">📅 {new Date(po.po_date).toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 max-w-32 bg-gray-200 rounded-full h-1.5">
                          <div className={cn('h-1.5 rounded-full transition-all', isComplete ? 'bg-green-500' : 'bg-red-500')}
                            style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{progress}%</span>
                        <span className={cn('text-xs font-bold', isComplete ? 'text-green-700' : 'text-red-700')}>
                          {isComplete ? '출하완료' : `잔량: ${(po.total_ordered - po.total_shipped).toFixed(1)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 품목 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-y">
                        <tr>
                          {['품목명', '규격', '발주수량', '출하수량', '잔량', '상태'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {po.items.map(item => {
                          const remain = Number(item.ordered_qty) - Number(item.shipped_qty);
                          const done = remain <= 0;
                          return (
                            <tr key={item.poi_id} className={cn('hover:bg-gray-50', done ? 'opacity-60' : '')}>
                              <td className="px-4 py-2.5 text-sm font-medium">{item.item_name}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-500">{item.spec || '-'}</td>
                              <td className="px-4 py-2.5 text-sm font-mono">{Number(item.ordered_qty).toLocaleString()} {item.unit}</td>
                              <td className="px-4 py-2.5 text-sm font-mono text-green-600">{Number(item.shipped_qty).toLocaleString()} {item.unit}</td>
                              <td className={cn('px-4 py-2.5 text-sm font-mono font-bold', done ? 'text-green-600' : 'text-red-600')}>
                                {done ? '0' : remain.toFixed(1)} {item.unit}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold',
                                  done ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                  {done ? '완료' : '미출하'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
