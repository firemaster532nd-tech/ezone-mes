import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import {
  Calendar, FileText, TrendingUp, Package, ShieldCheck, AlertTriangle,
  Users, ClipboardList, Printer, ChevronLeft, ChevronRight,
} from 'lucide-react';

type ReportType = 'daily' | 'weekly' | 'monthly';

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'daily') {
        const res = await api.get<{ data: any }>(`/reports/daily?date=${date}`);
        setData(res.data);
      } else if (reportType === 'weekly') {
        const monday = getMonday(new Date(date));
        const res = await api.get<{ data: any }>(`/reports/weekly?start=${monday}`);
        setData(res.data);
      } else {
        const [y, m] = date.split('-');
        const res = await api.get<{ data: any }>(`/reports/monthly?year=${y}&month=${m}`);
        setData(res.data);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [reportType, date]);

  const moveDate = (dir: number) => {
    const d = new Date(date);
    if (reportType === 'daily') d.setDate(d.getDate() + dir);
    else if (reportType === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d.toISOString().slice(0, 10));
  };

  const tabs = [
    { key: 'daily' as ReportType, label: '일일 브리핑', icon: Calendar },
    { key: 'weekly' as ReportType, label: '주간 보고', icon: TrendingUp },
    { key: 'monthly' as ReportType, label: '월간 보고', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">보고서</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" /> 인쇄
        </button>
      </div>

      {/* 탭 + 날짜 선택 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setReportType(t.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                reportType === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => moveDate(-1)} className="rounded-md p-1 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <input
            type={reportType === 'monthly' ? 'month' : 'date'}
            value={reportType === 'monthly' ? date.slice(0, 7) : date}
            onChange={(e) => setDate(reportType === 'monthly' ? e.target.value + '-01' : e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
          <button onClick={() => moveDate(1)} className="rounded-md p-1 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">로딩 중...</div>
      ) : !data ? (
        <div className="py-12 text-center text-gray-400">데이터가 없습니다.</div>
      ) : reportType === 'daily' ? (
        <DailyReport data={data} />
      ) : reportType === 'weekly' ? (
        <WeeklyReport data={data} />
      ) : (
        <MonthlyReport data={data} />
      )}
    </div>
  );
}

// ─── 일일 브리핑 ───
function DailyReport({ data }: { data: any }) {
  const wo = data.work_orders || {};
  const insp = data.inspection || {};
  const totalWo = parseInt(wo.total) || 0;
  const completed = parseInt(wo.completed) || 0;
  const rate = totalWo > 0 ? Math.round((completed / totalWo) * 100) : 0;
  const passRate = (parseInt(insp.total) || 0) > 0
    ? Math.round((parseInt(insp.pass_count) / parseInt(insp.total)) * 100)
    : 0;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="text-center mb-4 print:mb-2">
        <h2 className="text-xl font-bold">일일 생산 브리핑</h2>
        <p className="text-gray-500">{data.date}</p>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ClipboardList className="text-blue-600" />} label="작업지시" value={`${totalWo}건`} sub={`완료 ${completed}건 (${rate}%)`} />
        <KpiCard icon={<TrendingUp className="text-green-600" />} label="생산량" value={parseFloat(wo.total_produced || 0).toLocaleString()} sub="완료 수량" />
        <KpiCard icon={<ShieldCheck className="text-emerald-600" />} label="검사 합격률" value={`${passRate}%`} sub={`총 ${insp.total || 0}건`} />
        <KpiCard icon={<AlertTriangle className="text-amber-600" />} label="미해결 이슈" value={String(data.open_issues?.length || 0)} sub="TBM 이슈" />
      </div>

      {/* 공정별 */}
      {data.by_process?.length > 0 && (
        <Section title="공정별 생산 현황">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">공정</th>
              <th className="px-3 py-2 text-right">작업지시</th>
              <th className="px-3 py-2 text-right">계획 수량</th>
              <th className="px-3 py-2 text-right">실적 수량</th>
              <th className="px-3 py-2 text-right">달성률</th>
            </tr></thead>
            <tbody>{data.by_process.map((p: any) => {
              const planned = parseFloat(p.planned_total) || 0;
              const actual = parseFloat(p.actual_total) || 0;
              const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
              return (
                <tr key={p.process_code} className="border-b">
                  <td className="px-3 py-2"><ProcessBadge process={p.process_code} /></td>
                  <td className="px-3 py-2 text-right font-mono">{p.wo_count}건</td>
                  <td className="px-3 py-2 text-right font-mono">{planned.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">{actual.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-bold">{pct}%</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Section>
      )}

      {/* 품질 이슈 */}
      {data.quality_issues?.length > 0 && (
        <Section title="품질 이슈 (불합격)" color="red">
          {data.quality_issues.map((q: any) => (
            <div key={q.insp_id} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 mb-2 text-sm">
              <span className="font-mono text-xs text-red-600">#{q.insp_id}</span>
              <span>{q.item_name || '-'}</span>
              <span className="text-xs text-gray-500">{q.lot_number || '-'}</span>
              <span className="text-xs text-red-600 ml-auto">{q.remarks || '-'}</span>
            </div>
          ))}
        </Section>
      )}

      {/* TBM */}
      {data.tbm_meetings?.length > 0 && (
        <Section title="TBM 안전회의">
          {data.tbm_meetings.map((t: any) => (
            <div key={t.tbm_id} className="rounded-lg border px-3 py-2 mb-2 text-sm">
              <div className="flex gap-2 items-center">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{t.session}</span>
                <span className="font-medium">{t.safety_topics || '안전회의'}</span>
                <span className="text-xs text-gray-400 ml-auto">참석 {t.attendee_count}명</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* 미해결 이슈 */}
      {data.open_issues?.length > 0 && (
        <Section title="미해결 이슈" color="orange">
          {data.open_issues.map((i: any) => (
            <div key={i.issue_id} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 mb-2 text-sm flex items-center gap-2">
              <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold',
                i.status === 'DELAYED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              )}>{i.status}</span>
              <span>{i.title}</span>
            </div>
          ))}
        </Section>
      )}

      {/* ━━━ 미완료 추적 (Human Error 방지) ━━━ */}
      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 space-y-4">
        <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4" /> 미완료 추적 (확인 필요)
        </h3>

        {/* 검사 미완료 작업지시 */}
        {data.missing_inspections?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 mb-2">🔴 검사 미완료 작업지시 ({data.missing_inspections.length}건)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-red-50/50">
                  <th className="px-3 py-1.5 text-left text-xs">작업지시</th>
                  <th className="px-3 py-1.5 text-left text-xs">공정</th>
                  <th className="px-3 py-1.5 text-left text-xs">품목</th>
                  <th className="px-3 py-1.5 text-center text-xs">상태</th>
                  <th className="px-3 py-1.5 text-center text-xs">검사</th>
                  <th className="px-3 py-1.5 text-left text-xs">날짜</th>
                </tr></thead>
                <tbody>{data.missing_inspections.map((m: any) => (
                  <tr key={m.wo_id} className="border-b border-red-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{m.wo_number}</td>
                    <td className="px-3 py-1.5"><ProcessBadge process={m.process_code} /></td>
                    <td className="px-3 py-1.5 text-xs">{m.item_name || '-'}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold',
                        m.wo_status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      )}>{m.wo_status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-xs font-bold">
                        {parseInt(m.insp_count) === 0 ? '미실시' : `${m.pass_count}/${m.insp_count} 합격`}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{m.wo_date?.slice(0, 10)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* 결재 대기 중 */}
        {data.pending_approvals?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-orange-700 mb-2">🟠 결재 대기 중 ({data.pending_approvals.length}건)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-orange-50/50">
                  <th className="px-3 py-1.5 text-left text-xs">문서유형</th>
                  <th className="px-3 py-1.5 text-left text-xs">제목</th>
                  <th className="px-3 py-1.5 text-center text-xs">단계</th>
                  <th className="px-3 py-1.5 text-left text-xs">담당자</th>
                  <th className="px-3 py-1.5 text-right text-xs">대기일</th>
                </tr></thead>
                <tbody>{data.pending_approvals.map((a: any) => (
                  <tr key={a.approval_id} className="border-b border-orange-100">
                    <td className="px-3 py-1.5 text-xs">{a.doc_type}</td>
                    <td className="px-3 py-1.5 text-xs font-medium">{a.doc_title || '-'}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold',
                        a.status === 'REVIEW' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'
                      )}>{a.status === 'REVIEW' ? '검토 대기' : '승인 대기'}</span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {a.status === 'REVIEW' ? a.reviewer_name : a.approver_name}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={cn('text-xs font-bold',
                        parseInt(a.days_pending) >= 3 ? 'text-red-600' : parseInt(a.days_pending) >= 1 ? 'text-orange-600' : 'text-gray-600'
                      )}>{parseInt(a.days_pending) || 0}일</span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* TBM 미실시 */}
        {data.tbm_missing?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-700 mb-2">🔴 TBM 안전회의 미실시</h4>
            <div className="flex gap-2">
              {data.tbm_missing.map((t: any, idx: number) => (
                <div key={idx} className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2 text-sm">
                  <span className="font-bold text-red-700">{t.session === 'AM' ? '오전 (AM)' : '오후 (PM)'}</span>
                  <span className="text-red-600 ml-2 text-xs">미실시</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 공정 실행 멈춤 */}
        {data.stalled_processes?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-orange-700 mb-2">🟡 공정 실행 정체 ({data.stalled_processes.length}건)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-yellow-50/50">
                  <th className="px-3 py-1.5 text-left text-xs">공정</th>
                  <th className="px-3 py-1.5 text-center text-xs">상태</th>
                  <th className="px-3 py-1.5 text-left text-xs">작업자</th>
                  <th className="px-3 py-1.5 text-left text-xs">작업지시</th>
                  <th className="px-3 py-1.5 text-right text-xs">경과시간</th>
                </tr></thead>
                <tbody>{data.stalled_processes.map((s: any) => (
                  <tr key={s.log_id} className="border-b border-yellow-100">
                    <td className="px-3 py-1.5"><ProcessBadge process={s.process_code} /></td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold',
                        s.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                      )}>{s.status}</span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">{s.worker_name || '-'}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.wo_number || '-'}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={cn('text-xs font-bold',
                        parseFloat(s.hours_since_update) >= 4 ? 'text-red-600' : parseFloat(s.hours_since_update) >= 2 ? 'text-orange-600' : 'text-gray-600'
                      )}>{parseFloat(s.hours_since_update || 0).toFixed(1)}시간</span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* 모두 정상일 때 */}
        {(!data.missing_inspections?.length && !data.pending_approvals?.length && !data.tbm_missing?.length && !data.stalled_processes?.length) && (
          <div className="text-center py-4 text-sm text-green-600 font-medium">
            ✅ 모든 항목이 정상입니다. 미완료 사항이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 주간 보고 ───
function WeeklyReport({ data }: { data: any }) {
  return (
    <div className="space-y-6 print:space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold">주간 생산 보고서</h2>
        <p className="text-gray-500">{data.period?.start} ~ {data.period?.end}</p>
      </div>

      {/* 일별 생산 */}
      {data.daily_production?.length > 0 && (
        <Section title="일별 생산 현황">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">날짜</th>
              <th className="px-3 py-2 text-right">작업지시</th>
              <th className="px-3 py-2 text-right">완료</th>
              <th className="px-3 py-2 text-right">생산량</th>
            </tr></thead>
            <tbody>{data.daily_production.map((d: any) => (
              <tr key={d.date} className="border-b">
                <td className="px-3 py-2">{d.date?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right font-mono">{d.total_wo}건</td>
                <td className="px-3 py-2 text-right font-mono">{d.completed}건</td>
                <td className="px-3 py-2 text-right font-mono">{parseFloat(d.produced).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </Section>
      )}

      {/* 검사 통계 */}
      {data.inspection?.length > 0 && (
        <Section title="검사 통계">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">검사유형</th>
              <th className="px-3 py-2 text-right">총건수</th>
              <th className="px-3 py-2 text-right">합격</th>
              <th className="px-3 py-2 text-right">불합격</th>
              <th className="px-3 py-2 text-right">합격률</th>
            </tr></thead>
            <tbody>{data.inspection.map((i: any) => {
              const total = parseInt(i.total) || 0;
              const pass = parseInt(i.pass_count) || 0;
              const rate = total > 0 ? Math.round((pass / total) * 100) : 0;
              return (
                <tr key={i.insp_type} className="border-b">
                  <td className="px-3 py-2">{i.insp_type}</td>
                  <td className="px-3 py-2 text-right font-mono">{total}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">{pass}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{i.fail_count || 0}</td>
                  <td className="px-3 py-2 text-right font-bold">{rate}%</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Section>
      )}

      {/* 작업자별 실적 */}
      {data.worker_performance?.length > 0 && (
        <Section title="작업자별 실적">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">작업자</th>
              <th className="px-3 py-2 text-left">직무</th>
              <th className="px-3 py-2 text-right">작업 수</th>
              <th className="px-3 py-2 text-right">생산량</th>
              <th className="px-3 py-2 text-right">불량</th>
            </tr></thead>
            <tbody>{data.worker_performance.map((w: any, idx: number) => (
              <tr key={idx} className="border-b">
                <td className="px-3 py-2 font-medium">{w.worker_name}</td>
                <td className="px-3 py-2 text-gray-500">{w.position || '-'}</td>
                <td className="px-3 py-2 text-right font-mono">{w.task_count}</td>
                <td className="px-3 py-2 text-right font-mono">{parseFloat(w.total_produced).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-red-600">{parseFloat(w.total_defect).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

// ─── 월간 보고 (재고 실사 포함) ───
function MonthlyReport({ data }: { data: any }) {
  const prod = data.production || {};
  const totalPlanned = parseFloat(prod.total_planned) || 0;
  const totalProduced = parseFloat(prod.total_produced) || 0;
  const achieveRate = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold">월간 생산/재고 보고서</h2>
        <p className="text-gray-500">{data.period?.year}년 {data.period?.month}월</p>
      </div>

      {/* 월간 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ClipboardList className="text-blue-600" />} label="총 작업지시" value={`${prod.total_wo || 0}건`} sub={`완료 ${prod.completed || 0}건`} />
        <KpiCard icon={<TrendingUp className="text-green-600" />} label="총 생산량" value={totalProduced.toLocaleString()} sub={`계획 대비 ${achieveRate}%`} />
        <KpiCard icon={<Package className="text-purple-600" />} label="재고 품목" value={`${data.inventory_snapshot?.length || 0}종`} sub="활성 품목" />
        <KpiCard icon={<Users className="text-amber-600" />} label="입출고" value={`${data.inventory_movement?.length || 0}건`} sub="월간 변동" />
      </div>

      {/* 주차별 */}
      {data.weekly_breakdown?.length > 0 && (
        <Section title="주차별 생산 현황">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">주차</th>
              <th className="px-3 py-2 text-left">시작일</th>
              <th className="px-3 py-2 text-right">작업지시</th>
              <th className="px-3 py-2 text-right">생산량</th>
            </tr></thead>
            <tbody>{data.weekly_breakdown.map((w: any) => (
              <tr key={w.week_num} className="border-b">
                <td className="px-3 py-2 font-medium">W{w.week_num}</td>
                <td className="px-3 py-2">{w.week_start?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right font-mono">{w.wo_count}건</td>
                <td className="px-3 py-2 text-right font-mono">{parseFloat(w.produced).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </Section>
      )}

      {/* ★ 월말 재고 실사 */}
      <Section title="월말 재고 현황 (실사 기준)" color="purple">
        <div className="mb-3 text-sm text-gray-500">
          현재 시스템 기준 재고 잔량입니다. 실물 재고와 대조 후 차이가 있으면 조정 처리하세요.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">품목코드</th>
              <th className="px-3 py-2 text-left">품목명</th>
              <th className="px-3 py-2 text-center">분류</th>
              <th className="px-3 py-2 text-right">시스템 재고</th>
              <th className="px-3 py-2 text-right">안전재고</th>
              <th className="px-3 py-2 text-center">상태</th>
            </tr></thead>
            <tbody>{(data.inventory_snapshot || []).map((item: any) => {
              const bal = parseFloat(item.current_balance) || 0;
              const safety = parseFloat(item.safety_stock) || 0;
              const isLow = safety > 0 && bal < safety;
              return (
                <tr key={item.item_id} className={cn('border-b', isLow && 'bg-red-50')}>
                  <td className="px-3 py-2 font-mono text-xs">{item.item_code}</td>
                  <td className="px-3 py-2">{item.item_name}</td>
                  <td className="px-3 py-2 text-center text-xs">{item.item_category}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{bal.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">{safety > 0 ? safety.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-center">
                    {isLow ? (
                      <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">미달</span>
                    ) : (
                      <span className="rounded-full bg-green-50 text-green-600 px-2 py-0.5 text-xs">정상</span>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Section>

      {/* 월간 입출고 변동 */}
      {data.inventory_movement?.length > 0 && (
        <Section title="월간 입출고 변동">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left">품목</th>
              <th className="px-3 py-2 text-center">분류</th>
              <th className="px-3 py-2 text-right">입고</th>
              <th className="px-3 py-2 text-right">출고</th>
              <th className="px-3 py-2 text-right">조정</th>
            </tr></thead>
            <tbody>{data.inventory_movement.map((m: any, idx: number) => (
              <tr key={idx} className="border-b">
                <td className="px-3 py-2">{m.item_name}</td>
                <td className="px-3 py-2 text-center text-xs">{m.item_category}</td>
                <td className="px-3 py-2 text-right font-mono text-green-600">+{parseFloat(m.total_in).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-red-600">-{parseFloat(m.total_out).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{parseFloat(m.total_adj).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

// ─── 공통 컴포넌트 ───
function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-1.5',
        color === 'red' ? 'text-red-700' : color === 'orange' ? 'text-orange-700' : color === 'purple' ? 'text-purple-700' : 'text-gray-900'
      )}>{title}</h3>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 flex items-center gap-3">
      <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
    </div>
  );
}

function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}
