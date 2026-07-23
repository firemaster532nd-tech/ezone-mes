import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ClipboardList, Search, Download, CheckCircle, XCircle,
  RefreshCw, LogIn, Shield, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogRow {
  attempt_id: number;
  employee_no: string;
  worker_name: string | null;
  dept_name: string | null;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  attempted_at: string;
}

const FAILURE_LABELS: Record<string, string> = {
  user_not_found:  '사용자 없음',
  inactive:        '계정 비활성화',
  no_password:     '비밀번호 미설정',
  bad_password:    '비밀번호 불일치',
};

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function LoginLogsPage() {
  const { isAdmin } = useAuth();

  const [logs, setLogs]       = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom]       = useState(weekAgoStr());
  const [to, setTo]           = useState(todayStr());
  const [q, setQ]             = useState('');
  const [success, setSuccess] = useState<'all' | 'true' | 'false'>('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from)              params.set('from', from);
      if (to)                params.set('to', to);
      if (q.trim())          params.set('q', q.trim());
      if (success !== 'all') params.set('success', success);
      const res = await api.get<{ logs: LogRow[] }>(`/auth/login-logs?${params}`);
      setLogs(res.logs);
    } catch {
      toast.error('로그인 기록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [from, to, q, success]);

  useEffect(() => { if (isAdmin) loadLogs(); }, [isAdmin, loadLogs]);

  const exportCsv = () => {
    if (!logs.length) { toast('내보낼 데이터가 없습니다.'); return; }
    const header = ['시각', '사번', '이름', '부서', '결과', '실패사유', 'IP'];
    const rows = logs.map(l => [
      toLocalDateStr(l.attempted_at),
      l.employee_no,
      l.worker_name ?? '-',
      l.dept_name ?? '-',
      l.success ? '성공' : '실패',
      l.failure_reason ? (FAILURE_LABELS[l.failure_reason] ?? l.failure_reason) : '-',
      l.ip_address ?? '-',
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `로그인기록_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">관리자만 접근 가능합니다.</p>
        </div>
      </div>
    );
  }

  const successCount = logs.filter(l => l.success).length;
  const failCount    = logs.filter(l => !l.success).length;

  return (
    <div className="space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <ClipboardList className="h-5 w-5 text-slate-700" />
          로그인 기록
        </h1>
        <div className="flex gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            새로고침
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Download className="h-4 w-4" /> CSV 내보내기
          </button>
        </div>
      </div>

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">전체 시도</p>
          <p className="text-2xl font-bold text-slate-800">{logs.length.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> 성공
          </p>
          <p className="text-2xl font-bold text-emerald-600">{successCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-rose-500 mb-1 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> 실패
          </p>
          <p className="text-2xl font-bold text-rose-500">{failCount.toLocaleString()}</p>
        </div>
      </div>

      {/* ── 필터 ── */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">시작일</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">종료일</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">사번 / 이름</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text" placeholder="검색..." value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadLogs()}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">결과</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['all', 'true', 'false'] as const).map(v => (
                <button key={v} onClick={() => setSuccess(v)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    success === v ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  {v === 'all' ? '전체' : v === 'true' ? '성공' : '실패'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={loadLogs} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            조회
          </button>
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" /> 로그인 이력 (최근 1,000건)
          </span>
          <span className="text-xs text-slate-400">{logs.length.toLocaleString()}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">일시</th>
                <th className="px-4 py-3 text-left font-semibold">사번</th>
                <th className="px-4 py-3 text-left font-semibold">이름</th>
                <th className="px-4 py-3 text-left font-semibold">부서</th>
                <th className="px-4 py-3 text-center font-semibold">결과</th>
                <th className="px-4 py-3 text-left font-semibold">실패사유</th>
                <th className="px-4 py-3 text-left font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                    조회 중...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    해당 조건의 로그인 기록이 없습니다.
                  </td>
                </tr>
              ) : logs.map(l => (
                <tr key={l.attempt_id}
                  className={`hover:bg-slate-50/50 transition-colors ${!l.success ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {toLocalDateStr(l.attempted_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{l.employee_no}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {l.worker_name ?? <span className="text-slate-400 font-normal">-</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.dept_name ?? <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.success ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                        <CheckCircle className="h-3 w-3" /> 성공
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600 border border-rose-100">
                        <XCircle className="h-3 w-3" /> 실패
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {l.failure_reason
                      ? (FAILURE_LABELS[l.failure_reason] ?? l.failure_reason)
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {l.ip_address ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
