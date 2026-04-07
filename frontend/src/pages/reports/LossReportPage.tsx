import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import {
  Printer, ChevronLeft, ChevronRight, TrendingUp, Package,
  AlertTriangle, Scale, FileText, Wrench, BarChart3,
} from 'lucide-react';

/* ========== Types ========== */
interface ProcessSummary {
  process_code: string;
  batches: number;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_rate: number;
}

interface DailyTrend {
  date: string;
  process_code: string;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_rate: number;
  batch_count: number;
}

interface WorstDay {
  date: string;
  process_code: string;
  loss_rate: number;
  loss_kg: number;
  reason: string;
}

interface Issue {
  issue_date: string;
  process_code: string;
  issue_type: string;
  severity: string;
  description: string;
  loss_impact_kg: number | null;
  resolved: boolean;
}

interface DensityComparisonRow {
  lot_number: string;
  process_code: string;
  date: string;
  density: number;
  thickness_mm: number;
  width_mm: number;
  input_kg: number;
  output_kg: number;
  output_m: number;
  loss_actual_kg: number;
  loss_calculated_kg: number;
  diff_kg: number;
  loss_rate_actual: number;
  loss_rate_calculated: number;
  diff_rate: number;
}

interface DensityComparison {
  lots_with_density: number;
  lots_without_density: number;
  comparison_data: DensityComparisonRow[];
  summary: {
    avg_density: number;
    avg_actual_loss_rate: number;
    avg_calculated_loss_rate: number;
    avg_diff: number;
    insight: string;
  };
}

interface MonthlyLossReport {
  period: string;
  summary: {
    total_batches: number;
    total_input_kg: number;
    total_output_kg: number;
    total_loss_kg: number;
    overall_loss_rate: number;
    by_process: ProcessSummary[];
  };
  daily_trend: DailyTrend[];
  worst_days: WorstDay[];
  issues: Issue[];
  defects: {
    total_count: number;
    by_type: { defect_type: string; count: number }[];
    total_scrap_kg: number;
    scrap_count: number;
  };
  recommendations: string[];
  density_comparison?: DensityComparison;
}

/* ========== Constants ========== */
const processFilter = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합' },
  { key: 'EXT', label: '압출' },
  { key: 'CUT', label: '재단' },
];

const issueTypeLabel: Record<string, string> = {
  '설비고장': '설비고장',
  '원료불량': '원료불량',
  '온도이탈': '온도이탈',
  '압력이상': '압력이상',
  '작업자실수': '작업자실수',
  '금형마모': '금형마모',
  '기타': '기타',
};

const severityLabel: Record<string, string> = {
  minor: '경미',
  major: '주요',
  critical: '심각',
};

const severityColor: Record<string, string> = {
  minor: 'bg-gray-100 text-gray-700',
  major: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const processBarColor: Record<string, string> = {
  MIX: 'bg-amber-500',
  EXT: 'bg-blue-500',
  CUT: 'bg-green-500',
  ASM: 'bg-purple-500',
};

/* ========== Main Component ========== */
export function LossReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeProcess, setActiveProcess] = useState('');
  const [data, setData] = useState<MonthlyLossReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: MonthlyLossReport }>(
        `/reports/monthly-loss?year=${year}&month=${month}`
      );
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [year, month]);

  const moveMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setYear(y);
    setMonth(m);
  };

  // Filter daily trend by process
  const filteredTrend = data?.daily_trend?.filter(
    (d) => !activeProcess || d.process_code === activeProcess
  ) || [];

  // Filter by_process summary
  const filteredProcesses = data?.summary?.by_process?.filter(
    (p) => !activeProcess || p.process_code === activeProcess
  ) || [];

  // BOM reference rates (hardcoded for display)
  const bomRates: Record<string, number> = { MIX: 2, EXT: 3, CUT: 5 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">로스 분석 보고서</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" /> 인쇄
        </button>
      </div>

      {/* Year/Month selector + Process Filter */}
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => moveMonth(-1)} className="rounded-md p-1 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold min-w-[120px] text-center">
            {year}년 {month}월
          </span>
          <button onClick={() => moveMonth(1)} className="rounded-md p-1 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {processFilter.map((pf) => (
            <button
              key={pf.key}
              onClick={() => setActiveProcess(pf.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeProcess === pf.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}
            >
              {pf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Print Title */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-xl font-bold">로스 분석 보고서</h2>
        <p className="text-gray-500">{year}년 {month}월</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">로딩 중...</div>
      ) : !data ? (
        <div className="py-12 text-center text-gray-400">데이터가 없습니다.</div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* A. Summary Cards */}
          <SummaryCards summary={data.summary} />

          {/* B. Process Table */}
          <Section title="공정별 로스 현황" icon={<BarChart3 className="h-4 w-4 text-blue-600" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left">공정</th>
                    <th className="px-3 py-2 text-right">배치수</th>
                    <th className="px-3 py-2 text-right">투입(kg)</th>
                    <th className="px-3 py-2 text-right">산출(kg)</th>
                    <th className="px-3 py-2 text-right">로스(kg)</th>
                    <th className="px-3 py-2 text-right">로스율(%)</th>
                    <th className="px-3 py-2 text-right">BOM기준</th>
                    <th className="px-3 py-2 text-right">차이</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.map((p) => {
                    const bom = bomRates[p.process_code] || 0;
                    const rate = parseFloat(String(p.loss_rate)) || 0;
                    const diff = bom > 0 ? +(rate - bom).toFixed(2) : 0;
                    return (
                      <tr key={p.process_code} className="border-b">
                        <td className="px-3 py-2"><ProcessBadge process={p.process_code} /></td>
                        <td className="px-3 py-2 text-right font-mono">{p.batches}</td>
                        <td className="px-3 py-2 text-right font-mono">{num(p.input_kg)}</td>
                        <td className="px-3 py-2 text-right font-mono">{num(p.output_kg)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600">{num(p.loss_kg)}</td>
                        <td className="px-3 py-2 text-right">
                          <LossRateBadge rate={rate} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{bom > 0 ? `${bom}%` : '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {bom > 0 ? (
                            <span className={cn('font-mono font-bold text-xs', diff > 0 ? 'text-red-600' : 'text-green-600')}>
                              {diff > 0 ? '+' : ''}{diff}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProcesses.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-4 text-gray-400">데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* C. Daily Trend Chart (pure CSS bar chart) */}
          <Section title="일별 로스 추이" icon={<TrendingUp className="h-4 w-4 text-green-600" />}>
            <DailyTrendChart data={filteredTrend} year={year} month={month} />
          </Section>

          {/* C2. Density Comparison */}
          {data.density_comparison && (
            <Section title="밀도 환산 비교 분석" icon={<BarChart3 className="h-4 w-4 text-indigo-600" />}>
              <DensityComparisonSection data={data.density_comparison} />
            </Section>
          )}

          {/* D. Worst 5 Days */}
          <Section title="로스 상위 5일" icon={<AlertTriangle className="h-4 w-4 text-red-600" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">공정</th>
                    <th className="px-3 py-2 text-right">로스율(%)</th>
                    <th className="px-3 py-2 text-right">로스량(kg)</th>
                    <th className="px-3 py-2 text-left">관련 이슈</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.worst_days || []).map((w, idx) => {
                    const dateStr = w.date?.slice?.(0, 10) || String(w.date).slice(0, 10);
                    return (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-2 font-mono text-xs">{dateStr}</td>
                        <td className="px-3 py-2"><ProcessBadge process={w.process_code} /></td>
                        <td className="px-3 py-2 text-right">
                          <LossRateBadge rate={parseFloat(String(w.loss_rate))} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600">{num(w.loss_kg)}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{w.reason || '-'}</td>
                      </tr>
                    );
                  })}
                  {(!data.worst_days || data.worst_days.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-4 text-gray-400">데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* E. Process Issues */}
          <Section title="공정 이슈 현황" icon={<Wrench className="h-4 w-4 text-purple-600" />}>
            <IssueSection issues={data.issues || []} />
          </Section>

          {/* F. Recommendations */}
          <Section title="개선 권고사항" icon={<FileText className="h-4 w-4 text-blue-600" />}>
            {data.recommendations && data.recommendations.length > 0 ? (
              <ul className="space-y-2">
                {data.recommendations.map((rec, idx) => {
                  const icon = rec.includes('초과') ? '!!' : rec.includes('미해결') ? '[ ]' : '>>';
                  const color = rec.includes('초과') ? 'text-red-600' : rec.includes('미해결') ? 'text-amber-600' : 'text-blue-600';
                  return (
                    <li key={idx} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className={cn('font-bold text-xs mt-0.5', color)}>{icon}</span>
                      <span>{rec}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-green-600 py-4 text-center">
                특이사항 없음. 모든 공정이 기준 내에서 운영되고 있습니다.
              </p>
            )}
          </Section>

          {/* G. Defects Summary */}
          <Section title="불량/폐기 요약" icon={<Package className="h-4 w-4 text-red-600" />}>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{data.defects?.total_count || 0}건</div>
                <div className="text-xs text-red-600 mt-1">불량</div>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{data.defects?.scrap_count || 0}건</div>
                <div className="text-xs text-orange-600 mt-1">폐기처분</div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{num(data.defects?.total_scrap_kg || 0)}kg</div>
                <div className="text-xs text-gray-600 mt-1">폐기 총량</div>
              </div>
            </div>
            {data.defects?.by_type && data.defects.by_type.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.defects.by_type.map((d) => (
                  <span key={d.defect_type} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {d.defect_type}: {d.count}건
                  </span>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

/* ========== Sub-Components ========== */

function SummaryCards({ summary }: { summary: MonthlyLossReport['summary'] }) {
  const rate = summary.overall_loss_rate || 0;
  const rateColor = rate <= 5 ? 'text-green-700' : rate <= 10 ? 'text-amber-700' : 'text-red-700';
  const rateBg = rate <= 5 ? 'bg-green-50 border-green-200' : rate <= 10 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard
        label="총 배치수"
        value={`${summary.total_batches}회`}
        icon={<Scale className="h-5 w-5 text-blue-600" />}
      />
      <SummaryCard
        label="총 투입량"
        value={`${num(summary.total_input_kg)} kg`}
        icon={<Package className="h-5 w-5 text-green-600" />}
      />
      <SummaryCard
        label="총 산출량"
        value={`${num(summary.total_output_kg)} kg`}
        icon={<Package className="h-5 w-5 text-emerald-600" />}
      />
      <div className={cn('rounded-xl border p-4 flex items-center gap-3', rateBg)}>
        <div className="rounded-lg bg-white/80 p-2">
          <TrendingUp className={cn('h-5 w-5', rateColor)} />
        </div>
        <div>
          <div className="text-xs text-gray-500">평균 로스율</div>
          <div className={cn('text-xl font-bold', rateColor)}>{rate.toFixed(2)}%</div>
          <div className="text-xs text-gray-400">로스 {num(summary.total_loss_kg)} kg</div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
      <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5 text-gray-900">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function LossRateBadge({ rate }: { rate: number }) {
  const color = rate <= 5 ? 'bg-green-100 text-green-700' : rate <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', color)}>
      {rate.toFixed(2)}%
    </span>
  );
}

/* ========== Daily Trend Chart (pure CSS) ========== */
function DailyTrendChart({ data, year, month }: { data: DailyTrend[]; year: number; month: number }) {
  const daysInMonth = new Date(year, month, 0).getDate();

  // Aggregate by date
  const byDate: Record<number, { bars: { process_code: string; loss_rate: number }[]; totalRate: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    byDate[d] = { bars: [], totalRate: 0 };
  }
  for (const row of data) {
    const dateStr = row.date?.slice?.(0, 10) || String(row.date).slice(0, 10);
    const dayNum = parseInt(dateStr.split('-')[2], 10);
    if (byDate[dayNum]) {
      const rate = parseFloat(String(row.loss_rate)) || 0;
      byDate[dayNum].bars.push({ process_code: row.process_code, loss_rate: rate });
      byDate[dayNum].totalRate = Math.max(byDate[dayNum].totalRate, rate);
    }
  }

  // Find max for scaling
  const maxRate = Math.max(
    ...Object.values(byDate).map((d) => d.totalRate),
    5 // minimum scale
  );
  const chartHeight = 160;

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: chartHeight + 32 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const entry = byDate[day];
          const hasData = entry.bars.length > 0;
          return (
            <div key={day} className="flex-1 flex flex-col items-center group relative" style={{ minWidth: 0 }}>
              {/* Bars stacked */}
              <div className="w-full flex flex-col justify-end" style={{ height: chartHeight }}>
                {hasData ? entry.bars.map((bar, bi) => {
                  const h = maxRate > 0 ? (bar.loss_rate / maxRate) * chartHeight : 0;
                  return (
                    <div
                      key={bi}
                      className={cn('w-full rounded-t-sm', processBarColor[bar.process_code] || 'bg-gray-400')}
                      style={{ height: Math.max(h, 2) }}
                      title={`${bar.process_code}: ${bar.loss_rate}%`}
                    />
                  );
                }) : (
                  <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: 2 }} />
                )}
              </div>
              {/* Day label */}
              <span className={cn(
                'text-[9px] mt-1',
                day % 5 === 1 || day === daysInMonth ? 'text-gray-500' : 'text-transparent'
              )}>
                {day}
              </span>
              {/* Tooltip */}
              {hasData && (
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                  <div className="rounded bg-gray-900 text-white text-[10px] px-2 py-1 whitespace-nowrap">
                    {month}/{day}
                    {entry.bars.map((b, i) => (
                      <span key={i} className="ml-1">{b.process_code}:{b.loss_rate}%</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Y-axis labels */}
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>0%</span>
        <span>{(maxRate / 2).toFixed(1)}%</span>
        <span>{maxRate.toFixed(1)}%</span>
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        {Object.entries(processBarColor).map(([code, color]) => (
          <div key={code} className="flex items-center gap-1 text-xs text-gray-600">
            <div className={cn('w-3 h-3 rounded-sm', color)} />
            {code === 'MIX' ? '배합' : code === 'EXT' ? '압출' : code === 'CUT' ? '재단' : code}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Issue Section ========== */
function IssueSection({ issues }: { issues: Issue[] }) {
  const totalIssues = issues.length;
  const unresolved = issues.filter((i) => !i.resolved).length;
  const critical = issues.filter((i) => i.severity === 'critical').length;

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-center">
          <div className="text-lg font-bold text-blue-700">{totalIssues}건</div>
          <div className="text-[10px] text-blue-600">총 이슈</div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
          <div className="text-lg font-bold text-amber-700">{unresolved}건</div>
          <div className="text-[10px] text-amber-600">미해결</div>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
          <div className="text-lg font-bold text-red-700">{critical}건</div>
          <div className="text-[10px] text-red-600">심각(critical)</div>
        </div>
      </div>

      {/* Issue table */}
      {totalIssues > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left text-xs">날짜</th>
                <th className="px-3 py-2 text-left text-xs">공정</th>
                <th className="px-3 py-2 text-left text-xs">유형</th>
                <th className="px-3 py-2 text-center text-xs">심각도</th>
                <th className="px-3 py-2 text-left text-xs">설명</th>
                <th className="px-3 py-2 text-right text-xs">로스영향(kg)</th>
                <th className="px-3 py-2 text-center text-xs">해결</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, idx) => {
                const dateStr = issue.issue_date?.slice?.(0, 10) || String(issue.issue_date).slice(0, 10);
                return (
                  <tr key={idx} className="border-b">
                    <td className="px-3 py-2 text-xs font-mono">{dateStr}</td>
                    <td className="px-3 py-2"><ProcessBadge process={issue.process_code} /></td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                        {issueTypeLabel[issue.issue_type] || issue.issue_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', severityColor[issue.severity] || 'bg-gray-100')}>
                        {severityLabel[issue.severity] || issue.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate">{issue.description}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-orange-600">
                      {issue.loss_impact_kg ? num(issue.loss_impact_kg) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {issue.resolved ? (
                        <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-bold">해결</span>
                      ) : (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">미해결</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">등록된 이슈가 없습니다.</p>
      )}
    </div>
  );
}

/* ========== Density Comparison Section ========== */
function DensityComparisonSection({ data }: { data: DensityComparison }) {
  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-center">
          <div className="text-lg font-bold text-indigo-700">{data.lots_with_density}건</div>
          <div className="text-[10px] text-indigo-600">밀도 ���록 LOT</div>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-center">
          <div className="text-lg font-bold text-gray-600">{data.lots_without_density}건</div>
          <div className="text-[10px] text-gray-500">밀도 미기록 LOT</div>
        </div>
        {data.summary.avg_density > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-700">{data.summary.avg_density} g/cm3</div>
            <div className="text-[10px] text-blue-600">평균 밀도</div>
          </div>
        )}
      </div>

      {/* Comparison table */}
      {data.comparison_data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-2 text-left text-xs">LOT</th>
                <th className="px-2 py-2 text-left text-xs">공정</th>
                <th className="px-2 py-2 text-right text-xs">밀도</th>
                <th className="px-2 py-2 text-right text-xs">두께</th>
                <th className="px-2 py-2 text-right text-xs">투입(kg)</th>
                <th className="px-2 py-2 text-right text-xs">산출(kg)</th>
                <th className="px-2 py-2 text-right text-xs">환산(m)</th>
                <th className="px-2 py-2 text-right text-xs">실측로스</th>
                <th className="px-2 py-2 text-right text-xs">환산로스</th>
                <th className="px-2 py-2 text-right text-xs">차이(kg)</th>
                <th className="px-2 py-2 text-right text-xs">실측율</th>
                <th className="px-2 py-2 text-right text-xs">환산율</th>
              </tr>
            </thead>
            <tbody>
              {data.comparison_data.map((row, idx) => {
                const diffHighlight = Math.abs(row.diff_kg) > 1;
                return (
                  <tr key={idx} className={cn('border-b', diffHighlight ? 'bg-red-50' : '')}>
                    <td className="px-2 py-1.5 font-mono text-xs">{row.lot_number}</td>
                    <td className="px-2 py-1.5"><ProcessBadge process={row.process_code} /></td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{row.density.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{row.thickness_mm}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{num(row.input_kg)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{num(row.output_kg)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs text-blue-700 font-medium">{num(row.output_m)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs text-orange-600">{num(row.loss_actual_kg)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{num(row.loss_calculated_kg)}</td>
                    <td className={cn('px-2 py-1.5 text-right font-mono text-xs font-bold', diffHighlight ? 'text-red-700' : 'text-gray-600')}>
                      {row.diff_kg > 0 ? '+' : ''}{row.diff_kg.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <LossRateBadge rate={row.loss_rate_actual} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs">{row.loss_rate_calculated.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">밀도 기록 데이터가 없습니다.</p>
      )}

      {/* Insight */}
      {data.summary.insight && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
          {data.summary.insight}
        </div>
      )}
    </div>
  );
}

/* ========== Utility ========== */
function num(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
