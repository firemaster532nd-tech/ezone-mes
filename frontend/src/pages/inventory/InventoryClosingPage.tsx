import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  ClipboardCheck, Plus, AlertTriangle, CheckCircle2,
  XCircle, ArrowUpDown, Filter, Printer, ChevronRight,
  Package, Search, Clock, ShieldCheck, Edit2, Save, RotateCcw,
} from 'lucide-react';

/** 관리 영역별 승인권자 (프론트엔드용) */
function getApprover(zone: string): string {
  return zone === 'RM_EXT' ? '이동민' : '임병용';
}

/* ─── Types ─── */
interface Closing {
  closing_id: number;
  closing_year: number;
  closing_month: number;
  closing_date: string;
  status: string;
  created_by: string | null;
  created_at: string;
  finalized_at: string | null;
  notes: string | null;
  total_items?: number;
  counted_items?: number;
  diff_items?: number;
  pending_adjustments?: number;
}

interface ClosingItem {
  ci_id: number;
  closing_id: number;
  item_id: number;
  lot_id: number | null;
  lot_number: string | null;
  item_category: string;
  item_code: string;
  item_name: string;
  process_zone: string;
  system_qty: string;
  physical_qty: string | null;
  difference: string | null;
  diff_rate: string | null;
  unit: string;
  count_status: string;
  counted_by: string | null;
  counted_at: string | null;
  note: string | null;
}

interface Adjustment {
  adj_id: number;
  closing_id: number;
  ci_id: number | null;
  item_id: number;
  lot_id: number | null;
  lot_number: string | null;
  item_code: string;
  item_name: string;
  item_category: string;
  adj_type: string;
  adj_qty: string;
  reason: string;
  process_zone: string;
  approver_name: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  approved_at: string | null;
  applied_at: string | null;
  note: string | null;
}

interface Summary {
  total_items: string;
  counted: string;
  verified: string;
  pending: string;
  with_diff: string;
  total_abs_diff: string;
  zone_rm_ext: string;
  zone_cut_sm_fp: string;
  zone_rm_ext_counted: string;
  zone_cut_sm_fp_counted: string;
}

/* ─── Helpers ─── */
const statusLabels: Record<string, string> = {
  draft: '초안',
  counting: '실사 진행중',
  review: '검토 중',
  approved: '승인완료',
  finalized: '확정',
};
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  counting: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  finalized: 'bg-purple-100 text-purple-700',
};
const adjTypeLabels: Record<string, string> = { INCREASE: '증가', DECREASE: '감소', WRITE_OFF: '폐기' };
const adjStatusLabels: Record<string, string> = { pending: '승인대기', approved: '승인', rejected: '반려', applied: '반영완료' };
const adjStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  applied: 'bg-blue-100 text-blue-700',
};
const categoryLabels: Record<string, string> = { RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품' };
const zoneLabels: Record<string, string> = { RM_EXT: '이동민 파트장 (원재료/압출)', CUT_SM_FP: '임병용 파트장 (재단/부자재/완제품)' };
const fmtDate = (d: string | null) => d ? d.slice(0, 10) : '-';

export function InventoryClosingPage() {
  const [closings, setClosings] = useState<Closing[]>([]);
  const [selected, setSelected] = useState<Closing | null>(null);
  const [items, setItems] = useState<ClosingItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [tab, setTab] = useState<'items' | 'adjustments' | 'report'>('items');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [catFilter, setCatFilter] = useState<string>('');
  const [diffOnly, setDiffOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCi, setEditingCi] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjTarget, setAdjTarget] = useState<ClosingItem | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Fetch ───
  const fetchClosings = useCallback(async () => {
    try {
      const res = await api.get<{ data: Closing[] }>('/inventory-closing');
      setClosings(res.data);
    } catch {}
  }, []);

  const fetchItems = useCallback(async (closingId: number) => {
    try {
      const params = new URLSearchParams();
      if (zoneFilter) params.set('zone', zoneFilter);
      if (catFilter) params.set('category', catFilter);
      if (diffOnly) params.set('diff_only', 'true');
      const res = await api.get<{ data: ClosingItem[]; summary: Summary }>(
        `/inventory-closing/${closingId}/items?${params}`
      );
      setItems(res.data);
      setSummary(res.summary);
    } catch {}
  }, [zoneFilter, catFilter, diffOnly]);

  const fetchAdjustments = useCallback(async (closingId: number) => {
    try {
      const res = await api.get<{ data: Adjustment[] }>(`/inventory-closing/${closingId}/adjustments`);
      setAdjustments(res.data);
    } catch {}
  }, []);

  const fetchReport = useCallback(async (closingId: number) => {
    try {
      const res = await api.get<{ data: any }>(`/inventory-closing/${closingId}/report`);
      setReportData(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchClosings(); }, [fetchClosings]);

  useEffect(() => {
    if (selected) {
      fetchItems(selected.closing_id);
      fetchAdjustments(selected.closing_id);
      if (tab === 'report') fetchReport(selected.closing_id);
    }
  }, [selected, fetchItems, fetchAdjustments, fetchReport, tab]);

  // ─── Actions ───
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const year = parseInt(form.get('year') as string, 10);
    const month = parseInt(form.get('month') as string, 10);
    const date = form.get('closing_date') as string;
    try {
      const res = await api.post<{ data: Closing }>('/inventory-closing', {
        closing_year: year,
        closing_month: month,
        closing_date: date,
        created_by: form.get('created_by') || null,
        notes: form.get('notes') || null,
      });
      setShowCreate(false);
      await fetchClosings();
      setSelected(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.error || '생성 실패');
    }
  };

  const handleSaveCount = async (ci: ClosingItem) => {
    if (!selected || editQty === '') return;
    try {
      await api.patch(`/inventory-closing/${selected.closing_id}/items/${ci.ci_id}`, {
        physical_qty: parseFloat(editQty),
        counted_by: '실사자',
        note: editNote || undefined,
      });
      setEditingCi(null);
      setEditQty('');
      setEditNote('');
      fetchItems(selected.closing_id);
    } catch {}
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    try {
      await api.patch(`/inventory-closing/${selected.closing_id}/status`, { status });
      await fetchClosings();
      setSelected(prev => prev ? { ...prev, status } : null);
    } catch (err: any) {
      alert(err?.response?.data?.error || '상태 변경 실패');
    }
  };

  const handleApproveAdj = async (adjId: number, approve: boolean) => {
    if (!selected) return;
    try {
      await api.patch(`/inventory-closing/adjustments/${adjId}`, {
        status: approve ? 'approved' : 'rejected',
      });
      fetchAdjustments(selected.closing_id);
    } catch {}
  };

  const handleApplyAdj = async (adjId: number) => {
    if (!selected) return;
    try {
      await api.post(`/inventory-closing/adjustments/${adjId}/apply`, {});
      fetchAdjustments(selected.closing_id);
      fetchItems(selected.closing_id);
    } catch (err: any) {
      alert(err?.response?.data?.error || '재고 반영 실패');
    }
  };

  const handleCreateAdj = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || !adjTarget) return;
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/inventory-closing/${selected.closing_id}/adjustments`, {
        ci_id: adjTarget.ci_id,
        item_id: adjTarget.item_id,
        lot_id: adjTarget.lot_id,
        lot_number: adjTarget.lot_number,
        adj_type: form.get('adj_type'),
        adj_qty: parseFloat(form.get('adj_qty') as string),
        reason: form.get('reason'),
        process_zone: adjTarget.process_zone,
        requested_by: form.get('requested_by') || '실무자',
      });
      setShowAdjForm(false);
      setAdjTarget(null);
      fetchAdjustments(selected.closing_id);
    } catch (err: any) {
      alert(err?.response?.data?.error || '조정 요청 실패');
    }
  };

  const filtered = items.filter(it => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (it.item_code?.toLowerCase().includes(s) ||
            it.item_name?.toLowerCase().includes(s) ||
            it.lot_number?.toLowerCase().includes(s));
  });

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-indigo-600" />
            월말 재고 실사 / 마감
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            매월 말 실물재고 실사 → LOT 확인 → 차이 분석 → 파트장 승인 후 조정
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> 월마감 생성
        </button>
      </div>

      {/* 관리 영역 안내 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm font-semibold text-blue-800">이동민 파트장</div>
          <div className="text-xs text-blue-600 mt-1">원재료(RM) + 배합/압출(MIX/EXT) 재고 관리</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-sm font-semibold text-green-800">임병용 파트장</div>
          <div className="text-xs text-green-600 mt-1">재단(CUT) + 부자재(SM) + 소켓/완제품(SA/FP) 재고 관리</div>
        </div>
      </div>

      {/* 마감 목록 */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">월마감 이력</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">기간</th>
                <th className="px-4 py-2 text-left">마감일</th>
                <th className="px-4 py-2 text-center">상태</th>
                <th className="px-4 py-2 text-center">총 항목</th>
                <th className="px-4 py-2 text-center">실사완료</th>
                <th className="px-4 py-2 text-center">차이발생</th>
                <th className="px-4 py-2 text-center">조정대기</th>
                <th className="px-4 py-2 text-left">생성자</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {closings.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">월마감 기록이 없습니다</td></tr>
              ) : closings.map((c) => (
                <tr
                  key={c.closing_id}
                  onClick={() => setSelected(c)}
                  className={`border-t cursor-pointer hover:bg-gray-50 ${selected?.closing_id === c.closing_id ? 'bg-indigo-50' : ''}`}
                >
                  <td className="px-4 py-2.5 font-medium">{c.closing_year}년 {c.closing_month}월</td>
                  <td className="px-4 py-2.5">{fmtDate(c.closing_date)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[c.status] || 'bg-gray-100'}`}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">{c.total_items ?? '-'}</td>
                  <td className="px-4 py-2.5 text-center">{c.counted_items ?? '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {Number(c.diff_items) > 0 ? (
                      <span className="text-red-600 font-medium">{c.diff_items}</span>
                    ) : (c.diff_items ?? '-')}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {Number(c.pending_adjustments) > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        {c.pending_adjustments}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{c.created_by || '-'}</td>
                  <td className="px-4 py-2.5">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 영역 */}
      {selected && (
        <div className="rounded-xl border bg-white shadow-sm">
          {/* 상세 헤더 */}
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">
                {selected.closing_year}년 {selected.closing_month}월 재고 실사
              </h2>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[selected.status]}`}>
                {statusLabels[selected.status]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selected.status === 'counting' && (
                <button
                  onClick={() => handleStatusChange('review')}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
                >
                  검토 요청
                </button>
              )}
              {selected.status === 'review' && (
                <>
                  <button
                    onClick={() => handleStatusChange('counting')}
                    className="rounded-lg bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
                  >
                    <RotateCcw className="h-3 w-3 inline mr-1" />반려
                  </button>
                  <button
                    onClick={() => handleStatusChange('approved')}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />승인
                  </button>
                </>
              )}
              {selected.status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('finalized')}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                >
                  <ShieldCheck className="h-3 w-3 inline mr-1" />확정
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Printer className="h-3 w-3 inline mr-1" />인쇄
              </button>
            </div>
          </div>

          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 border-b">
              <SummaryCard label="전체 항목" value={summary.total_items} icon={Package} color="gray" />
              <SummaryCard label="실사 완료" value={`${summary.counted}/${summary.total_items}`} icon={CheckCircle2} color="blue" />
              <SummaryCard label="미실사" value={summary.pending} icon={Clock} color="yellow" />
              <SummaryCard label="차이 발생" value={summary.with_diff} icon={AlertTriangle} color="red" />
              <SummaryCard
                label="총 차이량"
                value={Number(summary.total_abs_diff).toFixed(1)}
                icon={ArrowUpDown}
                color="orange"
              />
            </div>
          )}

          {/* 관리영역별 진행률 */}
          {summary && (
            <div className="grid grid-cols-2 gap-4 p-4 border-b">
              <ZoneProgress
                label="이동민 파트장 (원재료/압출)"
                counted={Number(summary.zone_rm_ext_counted)}
                total={Number(summary.zone_rm_ext)}
                color="blue"
              />
              <ZoneProgress
                label="임병용 파트장 (재단/부자재/완제품)"
                counted={Number(summary.zone_cut_sm_fp_counted)}
                total={Number(summary.zone_cut_sm_fp)}
                color="green"
              />
            </div>
          )}

          {/* 탭 */}
          <div className="flex border-b">
            {(['items', 'adjustments', 'report'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'items' ? '실사 항목' : t === 'adjustments' ? '재고 조정' : '보고서'}
                {t === 'adjustments' && adjustments.filter(a => a.status === 'pending').length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white">
                    {adjustments.filter(a => a.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {tab === 'items' && (
            <div>
              {/* 필터 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 border-b flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-gray-400" />
                  <select
                    value={zoneFilter}
                    onChange={(e) => setZoneFilter(e.target.value)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="">전체 관리영역</option>
                    <option value="RM_EXT">이동민 (원재료/압출)</option>
                    <option value="CUT_SM_FP">임병용 (재단/부자재/완제품)</option>
                  </select>
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="">전체 카테고리</option>
                    <option value="RM">원재료</option>
                    <option value="SM">부자재</option>
                    <option value="SA">반제품</option>
                    <option value="FP">완제품</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={diffOnly}
                      onChange={(e) => setDiffOnly(e.target.checked)}
                      className="rounded"
                    />
                    차이만
                  </label>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="품목/LOT 검색"
                    className="rounded border px-2 py-1 text-xs w-40"
                  />
                </div>
              </div>

              {/* 실사 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">관리</th>
                      <th className="px-3 py-2 text-left">구분</th>
                      <th className="px-3 py-2 text-left">품목코드</th>
                      <th className="px-3 py-2 text-left">품목명</th>
                      <th className="px-3 py-2 text-left">LOT번호</th>
                      <th className="px-3 py-2 text-right">시스템 수량</th>
                      <th className="px-3 py-2 text-right">실사 수량</th>
                      <th className="px-3 py-2 text-right">차이</th>
                      <th className="px-3 py-2 text-right">차이율%</th>
                      <th className="px-3 py-2 text-center">상태</th>
                      <th className="px-3 py-2 text-left">비고</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={12} className="py-8 text-center text-gray-400">실사 항목이 없습니다</td></tr>
                    ) : filtered.map((it) => {
                      const isEditing = editingCi === it.ci_id;
                      const diff = it.difference ? parseFloat(it.difference) : null;
                      const diffRate = it.diff_rate ? parseFloat(it.diff_rate) : null;
                      return (
                        <tr key={it.ci_id} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${it.process_zone === 'RM_EXT' ? 'bg-blue-500' : 'bg-green-500'}`} />
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium">
                              {categoryLabels[it.item_category] || it.item_category}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600">{it.item_code}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{it.item_name}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{it.lot_number || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(it.system_qty).toFixed(1)}</td>
                          <td className="px-3 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="w-20 rounded border px-1.5 py-0.5 text-right text-xs"
                                autoFocus
                              />
                            ) : (
                              <span className="font-mono">
                                {it.physical_qty !== null ? Number(it.physical_qty).toFixed(1) : '-'}
                              </span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-medium ${
                            diff !== null && diff > 0 ? 'text-blue-600' : diff !== null && diff < 0 ? 'text-red-600' : ''
                          }`}>
                            {diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(1) : '-'}
                          </td>
                          <td className={`px-3 py-2 text-right text-[10px] ${
                            diffRate !== null && Math.abs(diffRate) > 5 ? 'text-red-600 font-bold' : 'text-gray-500'
                          }`}>
                            {diffRate !== null ? diffRate.toFixed(2) + '%' : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {it.count_status === 'counted' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                            ) : it.count_status === 'verified' ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-blue-500 inline" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-gray-300 inline" />
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[120px] truncate text-gray-500">
                            {isEditing ? (
                              <input
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="사유"
                                className="w-full rounded border px-1.5 py-0.5 text-xs"
                              />
                            ) : (it.note || '')}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveCount(it)}
                                    className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-700"
                                  >
                                    <Save className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingCi(null); setEditQty(''); setEditNote(''); }}
                                    className="rounded bg-gray-300 p-1 text-gray-700 hover:bg-gray-400"
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {selected.status !== 'finalized' && (
                                    <button
                                      onClick={() => {
                                        setEditingCi(it.ci_id);
                                        setEditQty(it.physical_qty || '');
                                        setEditNote(it.note || '');
                                      }}
                                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600"
                                      title="실사 입력"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  )}
                                  {diff !== null && diff !== 0 && selected.status !== 'finalized' && (
                                    <button
                                      onClick={() => { setAdjTarget(it); setShowAdjForm(true); }}
                                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                      title="조정 요청"
                                    >
                                      <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'adjustments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">품목</th>
                    <th className="px-3 py-2 text-left">LOT</th>
                    <th className="px-3 py-2 text-center">조정유형</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-left">사유</th>
                    <th className="px-3 py-2 text-center">승인권자</th>
                    <th className="px-3 py-2 text-center">상태</th>
                    <th className="px-3 py-2 text-left">요청자</th>
                    <th className="px-3 py-2 text-left">요청일</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr><td colSpan={10} className="py-8 text-center text-gray-400">조정 요청이 없습니다</td></tr>
                  ) : adjustments.map((adj) => (
                    <tr key={adj.adj_id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{adj.item_name}</div>
                        <div className="text-[10px] text-gray-400">{adj.item_code}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">{adj.lot_number || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          adj.adj_type === 'INCREASE' ? 'bg-blue-100 text-blue-700' :
                          adj.adj_type === 'DECREASE' ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {adjTypeLabels[adj.adj_type] || adj.adj_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{Number(adj.adj_qty).toFixed(1)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{adj.reason}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          adj.process_zone === 'RM_EXT' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {adj.approver_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${adjStatusColors[adj.status]}`}>
                          {adjStatusLabels[adj.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{adj.requested_by || '-'}</td>
                      <td className="px-3 py-2 text-gray-400">{adj.requested_at?.slice(0, 10)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {adj.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveAdj(adj.adj_id, true)}
                                className="rounded bg-green-100 p-1 text-green-700 hover:bg-green-200"
                                title="승인"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleApproveAdj(adj.adj_id, false)}
                                className="rounded bg-red-100 p-1 text-red-700 hover:bg-red-200"
                                title="반려"
                              >
                                <XCircle className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          {adj.status === 'approved' && !adj.applied_at && (
                            <button
                              onClick={() => handleApplyAdj(adj.adj_id)}
                              className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-200"
                            >
                              재고반영
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'report' && reportData && (
            <div className="p-4 space-y-6 print:p-0" id="closing-report">
              {/* 보고서 헤더 */}
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold">(주)이지원 월말 재고 실사 보고서</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {reportData.closing.closing_year}년 {reportData.closing.closing_month}월 (마감일: {fmtDate(reportData.closing.closing_date)})
                </p>
              </div>

              {/* 관리영역별 요약 */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-2">관리영역별 요약</h3>
                <table className="w-full text-xs border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-3 py-1.5 text-left">관리영역</th>
                      <th className="border px-3 py-1.5 text-center">총 항목</th>
                      <th className="border px-3 py-1.5 text-center">실사완료</th>
                      <th className="border px-3 py-1.5 text-right">시스템 재고</th>
                      <th className="border px-3 py-1.5 text-right">실물 재고</th>
                      <th className="border px-3 py-1.5 text-center">과잉</th>
                      <th className="border px-3 py-1.5 text-center">부족</th>
                      <th className="border px-3 py-1.5 text-center">일치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.zone_summary.map((z: any) => (
                      <tr key={z.process_zone}>
                        <td className="border px-3 py-1.5 font-medium">
                          {zoneLabels[z.process_zone] || z.process_zone}
                        </td>
                        <td className="border px-3 py-1.5 text-center">{z.total_items}</td>
                        <td className="border px-3 py-1.5 text-center">{z.counted_items}</td>
                        <td className="border px-3 py-1.5 text-right">{Number(z.total_system_qty).toFixed(1)}</td>
                        <td className="border px-3 py-1.5 text-right">{Number(z.total_physical_qty).toFixed(1)}</td>
                        <td className="border px-3 py-1.5 text-center text-blue-600">{z.surplus_count}</td>
                        <td className="border px-3 py-1.5 text-center text-red-600">{z.shortage_count}</td>
                        <td className="border px-3 py-1.5 text-center text-green-600">{z.match_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 카테고리별 요약 */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-2">카테고리별 요약</h3>
                <table className="w-full text-xs border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-3 py-1.5 text-left">카테고리</th>
                      <th className="border px-3 py-1.5 text-center">항목 수</th>
                      <th className="border px-3 py-1.5 text-right">시스템</th>
                      <th className="border px-3 py-1.5 text-right">실물</th>
                      <th className="border px-3 py-1.5 text-right">순차이</th>
                      <th className="border px-3 py-1.5 text-center">차이건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.category_summary.map((c: any) => (
                      <tr key={c.item_category}>
                        <td className="border px-3 py-1.5 font-medium">{categoryLabels[c.item_category] || c.item_category}</td>
                        <td className="border px-3 py-1.5 text-center">{c.total_items}</td>
                        <td className="border px-3 py-1.5 text-right">{Number(c.total_system).toFixed(1)}</td>
                        <td className="border px-3 py-1.5 text-right">{Number(c.total_physical).toFixed(1)}</td>
                        <td className={`border px-3 py-1.5 text-right font-medium ${Number(c.net_diff) < 0 ? 'text-red-600' : Number(c.net_diff) > 0 ? 'text-blue-600' : ''}`}>
                          {Number(c.net_diff).toFixed(1)}
                        </td>
                        <td className="border px-3 py-1.5 text-center">{c.diff_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 차이 상위 10건 */}
              {reportData.top_diffs.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-2">차이 상위 10건</h3>
                  <table className="w-full text-xs border">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="border px-3 py-1.5 text-left">품목</th>
                        <th className="border px-3 py-1.5 text-left">LOT</th>
                        <th className="border px-3 py-1.5 text-right">시스템</th>
                        <th className="border px-3 py-1.5 text-right">실물</th>
                        <th className="border px-3 py-1.5 text-right">차이</th>
                        <th className="border px-3 py-1.5 text-right">차이율</th>
                        <th className="border px-3 py-1.5 text-left">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.top_diffs.map((d: any) => (
                        <tr key={d.ci_id}>
                          <td className="border px-3 py-1.5">
                            <div className="font-medium">{d.item_name}</div>
                            <div className="text-[10px] text-gray-400">{d.item_code}</div>
                          </td>
                          <td className="border px-3 py-1.5 font-mono">{d.lot_number || '-'}</td>
                          <td className="border px-3 py-1.5 text-right">{Number(d.system_qty).toFixed(1)}</td>
                          <td className="border px-3 py-1.5 text-right">{Number(d.physical_qty).toFixed(1)}</td>
                          <td className={`border px-3 py-1.5 text-right font-bold ${Number(d.difference) < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {Number(d.difference) > 0 ? '+' : ''}{Number(d.difference).toFixed(1)}
                          </td>
                          <td className="border px-3 py-1.5 text-right">{Number(d.diff_rate).toFixed(2)}%</td>
                          <td className="border px-3 py-1.5 text-gray-500">{d.note || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 조정 현황 */}
              {reportData.adjustment_summary.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-2">조정 현황</h3>
                  <div className="flex gap-3">
                    {reportData.adjustment_summary.map((a: any) => (
                      <div key={a.status} className={`rounded-lg border px-4 py-2 ${adjStatusColors[a.status] || 'bg-gray-50'}`}>
                        <div className="text-xs font-medium">{adjStatusLabels[a.status] || a.status}</div>
                        <div className="text-lg font-bold">{a.count}건</div>
                        <div className="text-[10px]">수량: {Number(a.total_qty).toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 결재란 */}
              <div className="border-t pt-4 mt-6">
                <table className="w-64 ml-auto border text-xs text-center">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-3 py-1">작성</th>
                      <th className="border px-3 py-1">검토</th>
                      <th className="border px-3 py-1">승인</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-3 py-4"></td>
                      <td className="border px-3 py-4"></td>
                      <td className="border px-3 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 월마감 생성 모달 ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">월마감 생성</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">연도</label>
                  <input name="year" type="number" defaultValue={new Date().getFullYear()} required
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">월</label>
                  <input name="month" type="number" min={1} max={12} defaultValue={new Date().getMonth() + 1} required
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">마감일 (마지막 생산일)</label>
                <input name="closing_date" type="date" required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">생성자</label>
                <input name="created_by" placeholder="이름" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">비고</label>
                <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                생성 시 현재 시스템 재고를 LOT별로 스냅샷하여 실사 항목이 자동 생성됩니다.
              </p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">취소</button>
                <button type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 조정 요청 모달 ─── */}
      {showAdjForm && adjTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">재고 조정 요청</h3>
            <div className="text-xs bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
              <div><span className="text-gray-500">품목:</span> {adjTarget.item_name} ({adjTarget.item_code})</div>
              <div><span className="text-gray-500">LOT:</span> {adjTarget.lot_number || '없음'}</div>
              <div><span className="text-gray-500">시스템:</span> {Number(adjTarget.system_qty).toFixed(1)} / <span className="text-gray-500">실사:</span> {adjTarget.physical_qty !== null ? Number(adjTarget.physical_qty).toFixed(1) : '-'}</div>
              <div><span className="text-gray-500">차이:</span> <span className="font-bold text-red-600">{adjTarget.difference !== null ? Number(adjTarget.difference).toFixed(1) : '-'}</span></div>
              <div>
                <span className="text-gray-500">승인권자:</span>{' '}
                <span className="font-medium">{getApprover(adjTarget.process_zone)}</span>
              </div>
            </div>
            <form onSubmit={handleCreateAdj} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">조정 유형</label>
                <select name="adj_type" required className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  {adjTarget.difference && parseFloat(adjTarget.difference) > 0 ? (
                    <option value="INCREASE">증가 (실물이 더 많음)</option>
                  ) : (
                    <>
                      <option value="DECREASE">감소 (실물이 더 적음)</option>
                      <option value="WRITE_OFF">폐기 처리</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">조정 수량</label>
                <input name="adj_qty" type="number" step="0.01" required
                  defaultValue={adjTarget.difference ? Math.abs(parseFloat(adjTarget.difference)).toFixed(2) : ''}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">사유 (필수)</label>
                <textarea name="reason" required rows={2} placeholder="차이 발생 사유를 상세히 기재"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">요청자</label>
                <input name="requested_by" placeholder="이름" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                조정은 파트장({getApprover(adjTarget.process_zone)}) 승인 후에만 재고에 반영됩니다.
              </p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowAdjForm(false); setAdjTarget(null); }}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">취소</button>
                <button type="submit"
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">조정 요청</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub Components ─── */
function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  const bg = color === 'blue' ? 'bg-blue-50' : color === 'red' ? 'bg-red-50' : color === 'yellow' ? 'bg-yellow-50' : color === 'orange' ? 'bg-orange-50' : 'bg-gray-50';
  const text = color === 'blue' ? 'text-blue-600' : color === 'red' ? 'text-red-600' : color === 'yellow' ? 'text-yellow-600' : color === 'orange' ? 'text-orange-600' : 'text-gray-600';
  return (
    <div className={`rounded-lg ${bg} p-3 text-center`}>
      <Icon className={`h-4 w-4 mx-auto ${text} mb-1`} />
      <div className={`text-lg font-bold ${text}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function ZoneProgress({ label, counted, total, color }: { label: string; counted: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((counted / total) * 100) : 0;
  const barColor = color === 'blue' ? 'bg-blue-500' : 'bg-green-500';
  const barBg = color === 'blue' ? 'bg-blue-100' : 'bg-green-100';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{counted}/{total} ({pct}%)</span>
      </div>
      <div className={`h-2 rounded-full ${barBg}`}>
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
