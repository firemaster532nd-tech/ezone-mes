import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { Factory, Users, Activity, TrendingUp, Target } from 'lucide-react';

interface ProcessStat {
  process_code: string;
  total_logs: string;
  running: string;
  completed: string;
  paused: string;
  ready: string;
  planned_qty: string;
  produced_qty: string;
  defect_qty: string;
  yield_rate: string;
}

interface WorkerStat {
  worker_name: string;
  department: string | null;
  hours_worked: string;
  produced_qty: string;
  defect_qty: string;
}

interface OverallStat {
  total_planned: string;
  total_produced: string;
  total_defect: string;
  overall_yield: string;
  process_rate: string;
  active_processes: string;
  active_workers: string;
}

interface DailySummary {
  date: string;
  total_logs: string;
  completed: string;
  produced_qty: string;
  defect_qty: string;
}

interface StatsData {
  date: string;
  by_process: ProcessStat[];
  by_worker: WorkerStat[];
  overall: OverallStat;
}

interface WeeklyData {
  daily_summary: DailySummary[];
}

export function ProductionDashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.get<{ data: StatsData }>(`/production/stats?date=${date}`).then((r) => setStats(r.data));
    api.get<{ data: WeeklyData }>('/production/stats/weekly').then((r) => setWeekly(r.data));
  }, [date]);

  if (!stats) {
    return <div className="flex items-center justify-center h-96 text-gray-400">로딩 중...</div>;
  }

  const overall = stats.overall;

  return (
    <div>
      <PageHeader title="생산 현황" description="일별/주간 생산 통계">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border px-3 py-2 text-shop-sm"
        />
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          icon={<Target className="text-process-mix" />}
          label="계획 수량"
          value={parseFloat(overall.total_planned).toLocaleString()}
          color="blue"
        />
        <KpiCard
          icon={<Factory className="text-green-600" />}
          label="생산 수량"
          value={parseFloat(overall.total_produced).toLocaleString()}
          color="green"
        />
        <KpiCard
          icon={<TrendingUp className="text-emerald-600" />}
          label="수율"
          value={`${overall.overall_yield}%`}
          color="emerald"
        />
        <KpiCard
          icon={<Activity className="text-orange-500" />}
          label="가동중 공정"
          value={overall.active_processes}
          color="orange"
        />
        <KpiCard
          icon={<Users className="text-purple-600" />}
          label="투입 작업자"
          value={overall.active_workers}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 공정별 현황 */}
        <div className="bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-4">공정별 생산 현황</h3>
          {stats.by_process.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-shop-sm">오늘 공정 실행 기록 없음</div>
          ) : (
            <div className="space-y-4">
              {stats.by_process.map((p) => {
                const planned = parseFloat(p.planned_qty) || 0;
                const produced = parseFloat(p.produced_qty) || 0;
                const progressPct = planned > 0 ? Math.min((produced / planned) * 100, 100) : 0;
                return (
                  <div key={p.process_code} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <ProcessBadge process={p.process_code} />
                      <div className="flex items-center gap-3 text-shop-sm">
                        <span className="text-gray-500">
                          진행 <b className="text-green-600">{p.running}</b> /
                          완료 <b className="text-blue-600">{p.completed}</b> /
                          대기 <b className="text-gray-600">{p.ready}</b>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-shop-sm">
                      <span>계획: <b className="font-mono">{planned.toLocaleString()}</b></span>
                      <span>생산: <b className="font-mono text-green-700">{produced.toLocaleString()}</b></span>
                      <span>불량: <b className="font-mono text-red-600">{parseFloat(p.defect_qty).toLocaleString()}</b></span>
                      <span>수율: <b className="font-mono">{p.yield_rate}%</b></span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 작업자별 현황 */}
        <div className="bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-4">작업자별 실적</h3>
          {stats.by_worker.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-shop-sm">오늘 작업 기록 없음</div>
          ) : (
            <table className="w-full text-shop-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs text-gray-500">작업자</th>
                  <th className="px-2 py-2 text-left text-xs text-gray-500">부서</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500">작업시간</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500">생산량</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500">불량</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_worker.map((w, idx) => (
                  <tr key={idx} className="border-b hover:bg-blue-50">
                    <td className="px-2 py-2 font-medium">{w.worker_name}</td>
                    <td className="px-2 py-2 text-gray-500">{w.department || '-'}</td>
                    <td className="px-2 py-2 text-right font-mono">{parseFloat(w.hours_worked).toFixed(1)}h</td>
                    <td className="px-2 py-2 text-right font-mono text-green-700">{parseFloat(w.produced_qty).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-600">{parseFloat(w.defect_qty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 주간 추이 */}
      {weekly && weekly.daily_summary.length > 0 && (
        <div className="mt-6 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-4">주간 생산 추이 (최근 7일)</h3>
          <table className="w-full text-shop-sm border">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left text-xs text-gray-500">날짜</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">총 작업</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">완료</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">생산량</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">불량</th>
                <th className="px-3 py-2 text-right text-xs text-gray-500">달성률</th>
              </tr>
            </thead>
            <tbody>
              {weekly.daily_summary.map((d, idx) => {
                const produced = parseFloat(d.produced_qty) || 0;
                const defect = parseFloat(d.defect_qty) || 0;
                const yieldPct = produced > 0 ? ((produced - defect) / produced * 100).toFixed(1) : '-';
                return (
                  <tr key={idx} className="border-b hover:bg-blue-50">
                    <td className="px-3 py-2">{d.date?.toString().slice(0, 10)}</td>
                    <td className="px-3 py-2 text-right font-mono">{d.total_logs}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-600">{d.completed}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{produced.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">{defect.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{yieldPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className="bg-white rounded-card border p-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg',
          color === 'blue' && 'bg-blue-50',
          color === 'green' && 'bg-green-50',
          color === 'emerald' && 'bg-emerald-50',
          color === 'orange' && 'bg-orange-50',
          color === 'purple' && 'bg-purple-50',
        )}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}
