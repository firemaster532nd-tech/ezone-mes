import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface WorkOrder {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  process_code: string;
  status: string;
  item_name: string | null;
  structure_code: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  lot_number: string | null;
  am_worker: string | null;
  pm_worker: string | null;
  start_time: string | null;
  end_time: string | null;
  input_weight_kg: number | null;
  production_length_m: number | null;
  scrap_kg: number | null;
  equipment_id: string | null;
  downtime_minutes: number | null;
}

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합' },
  { key: 'EXT', label: '압출' },
  { key: 'CUT', label: '재단' },
  { key: 'ASM', label: '조립' },
];

export function DailyLogPage() {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('process_code', filter);
    if (date) params.set('date', date);
    const qs = params.toString();
    api.get<{ data: WorkOrder[] }>(`/work-orders${qs ? '?' + qs : ''}`).then((res) => setData(res.data));
  }, [filter, date]);

  return (
    <div>
      <PageHeader title="공정일지" count={data.length} description="일자별 생산실적 통합 조회">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-md text-shop-sm"
        />
      </PageHeader>

      {/* Process Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key
                ? 'border-process-ext text-process-ext'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daily Log Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-left font-medium text-gray-500">지시번호</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">품목</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">설비</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">시작/종료</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">투입(kg)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">생산길이(m)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">스크랩(kg)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">계획</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">실적</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업자</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                  {date} 작업 기록이 없습니다.
                </td>
              </tr>
            ) : (
              data.map((wo) => (
                <tr key={wo.wo_id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs">{wo.wo_number}</td>
                  <td className="px-3 py-3">
                    <ProcessBadge process={wo.process_code as any} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={wo.status === 'COMPLETED' ? 'PASS' : wo.status === 'IN_PROGRESS' ? 'INFO' : 'PENDING'}
                      label={wo.status === 'COMPLETED' ? '완료' : wo.status === 'IN_PROGRESS' ? '진행' : '계획'}
                    />
                  </td>
                  <td className="px-3 py-3 truncate max-w-[120px]">{wo.item_name ?? '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs">{wo.lot_number ?? '-'}</td>
                  <td className="px-3 py-3">{wo.equipment_id ?? '-'}</td>
                  <td className="px-3 py-3 text-xs">
                    {wo.start_time && wo.end_time
                      ? `${wo.start_time.slice(0, 5)}~${wo.end_time.slice(0, 5)}`
                      : '-'}
                    {wo.downtime_minutes ? ` (중단${wo.downtime_minutes}분)` : ''}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{wo.input_weight_kg ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.production_length_m ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.scrap_kg ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.planned_qty ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.actual_qty ?? '-'}</td>
                  <td className="px-3 py-3 text-xs">{wo.am_worker ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
