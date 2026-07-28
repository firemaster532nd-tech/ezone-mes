import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';

// 유틸: cn을 간단히 구현
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface ProcessYield {
  process_code: string;
  log_count: number;
  total_planned: number;
  total_produced: number;
  total_defect: number;
  yield_pct: number | null;
  defect_pct: number | null;
}

interface MonthlyYield {
  year_month: string;
  process_code: string;
  total_produced: number;
  total_defect: number;
  yield_pct: number | null;
}

interface Summary {
  total_planned: number;
  total_produced: number;
  total_defect: number;
  overall_yield_pct: number | null;
}

interface Target {
  target_yield: number;
}

const PROCESS_LABEL: Record<string, string> = {
  MIX: '배합', EXT_1: '압출1호', EXT_2: '압출2호',
  CUT: '재단', ASM: '조립', FN_ASM: 'FN조립',
  INSP: '검사', SHIP: '출하',
};
const PROCESS_FACTORY: Record<string, string> = {
  MIX: '1공장', EXT_1: '1공장', EXT_2: '1공장',
  CUT: '2공장', ASM: '2공장', FN_ASM: '2공장', INSP: '2공장', SHIP: '2공장',
};

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4', '#ec4899', '#64748b'];

const YieldLineChart = ({ data, processes }: { data: MonthlyYield[], processes: string[] }) => {
  const months = [...new Set(data.map(d => d.year_month))].sort();
  const chartW = 600, chartH = 200, padL = 40, padB = 30, padT = 10, padR = 20;
  const w = chartW - padL - padR;
  const h = chartH - padT - padB;
  const minY = 80, maxY = 100;
  
  const xScale = (i: number) => padL + (w / Math.max(months.length - 1, 1)) * i;
  const yScale = (v: number) => padT + h - ((v - minY) / (maxY - minY)) * h;
  
  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
      {/* Y축 그리드라인 */}
      {[80,85,90,95,100].map(y => (
        <g key={y}>
          <line x1={padL} x2={chartW-padR} y1={yScale(y)} y2={yScale(y)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padL-4} y={yScale(y)+4} textAnchor="end" fontSize={9} fill="#9ca3af">{y}%</text>
        </g>
      ))}
      {/* X축 레이블 */}
      {months.map((m, i) => (
        <text key={m} x={xScale(i)} y={chartH-5} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {m.slice(5)}월
        </text>
      ))}
      {/* 차트 라인 */}
      {processes.map((proc, ci) => {
        const pts = months.map((m, i) => {
          const row = data.find(d => d.year_month === m && d.process_code === proc);
          return row?.yield_pct != null ? `${xScale(i)},${yScale(row.yield_pct)}` : null;
        }).filter(Boolean);
        if (pts.length < 2) return null;
        return (
          <polyline key={proc} points={pts.join(' ')} fill="none"
            stroke={COLORS[ci % COLORS.length]} strokeWidth={2} />
        );
      })}
    </svg>
  );
};

const KpiCard = ({ label, value, sub, color }: { label: string, value: string, sub: string, color: 'emerald'|'blue'|'rose' }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]} shadow-sm flex flex-col items-center justify-center`}>
      <div className="text-sm opacity-80 mb-1 font-medium">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75 mt-1">{sub}</div>
    </div>
  );
};

export const YieldDashboardPage: React.FC = () => {
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);
  
  const [summary, setSummary] = useState<Partial<Summary>>({});
  const [byProcess, setByProcess] = useState<ProcessYield[]>([]);
  const [monthlyYields, setMonthlyYields] = useState<MonthlyYield[]>([]);
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);

  const fetchData = async () => {
    try {
      const [resRange, resMonthly, resTarget] = await Promise.all([
        api.get(`/api/production/yield?from=${from}&to=${to}`),
        api.get('/api/production/yield/monthly?months=12'),
        api.get(`/api/production/kpi-target?year_month=${today.toISOString().substring(0,7)}`).catch(() => ({ data: { data: null } }))
      ]);

      setSummary(resRange.data.data.summary || {});
      setByProcess(resRange.data.data.by_process || []);
      setMonthlyYields(resMonthly.data.data.monthly || []);
      setCurrentTarget(resTarget.data.data);
    } catch (err) {
      console.error('Failed to fetch yield data', err);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const setRange = (type: 'week' | 'month') => {
    const end = new Date();
    const start = new Date();
    if (type === 'week') {
      start.setDate(end.getDate() - end.getDay() + (end.getDay() === 0 ? -6 : 1)); // 월요일
    } else if (type === 'month') {
      start.setDate(1);
    }
    setFrom(start.toISOString().split('T')[0]);
    setTo(end.toISOString().split('T')[0]);
    setTimeout(fetchData, 100);
  };

  const defectPct = summary.total_produced 
    ? ((summary.total_defect! / summary.total_produced) * 100).toFixed(2) 
    : '-';

  const processes = [...new Set(monthlyYields.map(d => d.process_code))];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="작업 수율 현황" />

      {/* 필터 */}
      <div className="flex gap-3 items-center bg-white p-4 rounded-xl border shadow-sm">
        <label className="text-sm font-medium text-gray-700">기간:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-3 py-1 shadow-sm text-sm" />
        <span className="text-gray-400">~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-3 py-1 shadow-sm text-sm" />
        <button onClick={fetchData} className="px-4 py-1 bg-slate-800 text-white rounded shadow-sm text-sm font-medium hover:bg-slate-700">조회</button>
        <div className="h-6 w-px bg-gray-300 mx-2"></div>
        <button onClick={() => setRange('week')} className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">이번주</button>
        <button onClick={() => setRange('month')} className="text-sm px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100">이번달</button>
      </div>

      {/* 요약 KPI 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="전체 평균 수율" value={`${summary.overall_yield_pct ?? '-'}%`} sub="조회기간 합산" color="emerald" />
        <KpiCard label="전체 생산량" value={`${(summary.total_produced || 0).toLocaleString()} EA`} sub="조회기간" color="blue" />
        <KpiCard label="총 불량수량" value={`${(summary.total_defect || 0).toLocaleString()} EA`} sub={`불량율 ${defectPct}%`} color="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 공정별 수율 테이블 */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 font-bold border-b bg-slate-50 text-slate-800">공정별 수율 현황</div>
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-2 border-b">공장</th>
                <th className="px-4 py-2 border-b">공정</th>
                <th className="px-4 py-2 border-b text-right">생산량</th>
                <th className="px-4 py-2 border-b text-right">불량</th>
                <th className="px-4 py-2 border-b text-right">수율</th>
                <th className="px-4 py-2 border-b text-right">목표</th>
                <th className="px-4 py-2 border-b text-right">편차</th>
                <th className="px-4 py-2 border-b text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {byProcess.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">데이터가 없습니다.</td></tr>
              ) : byProcess.map(row => {
                const target = currentTarget?.target_yield;
                const diff = target && row.yield_pct ? (row.yield_pct - target).toFixed(1) : null;
                const status = !row.yield_pct ? '-'
                  : !target ? '\u2014'
                  : row.yield_pct >= target ? '\u2705 달성' : '⚠️ 미달';
                
                return (
                  <tr key={row.process_code} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{PROCESS_FACTORY[row.process_code] ?? '-'}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800">{PROCESS_LABEL[row.process_code] ?? row.process_code}</td>
                    <td className="px-4 py-2 text-right">{Number(row.total_produced || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-rose-600">{Number(row.total_defect || 0).toLocaleString()}</td>
                    <td className={cn('px-4 py-2 text-right font-bold', row.yield_pct && row.yield_pct >= 97 ? 'text-emerald-700' : 'text-amber-600')}>
                      {row.yield_pct != null ? `${row.yield_pct}%` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400">{target ? `${target}%` : '-'}</td>
                    <td className={cn('px-4 py-2 text-right', diff ? (parseFloat(diff) >= 0 ? 'text-emerald-600' : 'text-rose-600') : '')}>
                      {diff ? `${parseFloat(diff) >= 0 ? '+' : ''}${diff}%p` : '-'}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 12개월 수율 추이 차트 */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-4">최근 12개월 공정별 수율 추이</div>
          <div className="w-full bg-slate-50 border rounded-lg p-2">
            <YieldLineChart data={monthlyYields} processes={processes} />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
            {processes.map((proc, i) => (
              <div key={proc} className="flex items-center gap-2">
                <div className="w-4 h-1 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-gray-600 font-medium">{PROCESS_LABEL[proc] ?? proc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
