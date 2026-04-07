import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  AlertTriangle, Trash2, FileText, Filter, Plus, X, Check,
} from 'lucide-react';

/* ========== Types ========== */
interface Defect {
  defect_id: number;
  wo_id: number | null;
  log_id: number | null;
  lot_number: string | null;
  process_code: string;
  defect_type: string;
  qty: number;
  unit: string;
  weight: number | null;
  description: string | null;
  disposition: string;
  recorded_by: number | null;
  created_at: string;
}

interface DisposalReport {
  report_id: number;
  defect_ids: number[];
  disposal_method: string | null;
  reason: string | null;
  status: string;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
}

/* ========== Constants ========== */
const defectTypeLabels: Record<string, string> = {
  appearance: '외관불량',
  dimension: '치수불량',
  physical: '물성불량',
  contamination: '이물질혼입',
  other: '기타',
};

const processLabels: Record<string, string> = {
  MIX: '배합',
  EXT: '압출',
  CUT: '재단',
  ASM: '조립',
};

const dispositionConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: '대기', bg: 'bg-gray-100', text: 'text-gray-700' },
  rework: { label: '재작업', bg: 'bg-blue-100', text: 'text-blue-700' },
  scrap: { label: '폐기', bg: 'bg-red-100', text: 'text-red-700' },
  downgrade: { label: '등급하향', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const reportStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: '초안', bg: 'bg-gray-100', text: 'text-gray-700' },
  pending_approval: { label: '승인대기', bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { label: '승인완료', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: '처리완료', bg: 'bg-green-200', text: 'text-green-800' },
};

/* ========== Main Component ========== */
export function DefectsPage() {
  const [tab, setTab] = useState<'defects' | 'disposal'>('defects');

  return (
    <div>
      <PageHeader title="불량/폐기 관리" description="불량 현황 조회 및 폐기 보고서 관리" />

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setTab('defects')}
          className={cn(
            'px-4 py-2.5 text-shop-sm font-semibold transition-colors border-b-2',
            tab === 'defects'
              ? 'border-red-500 text-red-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={15} /> 불량 현황
          </span>
        </button>
        <button
          onClick={() => setTab('disposal')}
          className={cn(
            'px-4 py-2.5 text-shop-sm font-semibold transition-colors border-b-2',
            tab === 'disposal'
              ? 'border-red-500 text-red-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Trash2 size={15} /> 폐기 보고서
          </span>
        </button>
      </div>

      {tab === 'defects' ? <DefectsTab /> : <DisposalTab />}
    </div>
  );
}

/* ========== Defects Tab ========== */
function DefectsTab() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [processFilter, setProcessFilter] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchDefects = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (processFilter) params.set('process_code', processFilter);
    if (dispositionFilter) params.set('disposition', dispositionFilter);
    if (dateFilter) params.set('date', dateFilter);
    const qs = params.toString();
    api.get<{ data: Defect[] }>(`/defects${qs ? '?' + qs : ''}`)
      .then((r) => setDefects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDefects([]))
      .finally(() => setLoading(false));
  }, [processFilter, dispositionFilter, dateFilter]);

  useEffect(() => { fetchDefects(); }, [fetchDefects]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-shop-sm text-gray-500">
          <Filter size={14} /> 필터:
        </div>
        <select
          value={processFilter}
          onChange={(e) => setProcessFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-shop-sm"
        >
          <option value="">전체 공정</option>
          {Object.entries(processLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={dispositionFilter}
          onChange={(e) => setDispositionFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-shop-sm"
        >
          <option value="">전체 처리방향</option>
          {Object.entries(dispositionConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-shop-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">일시</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">LOT</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">공정</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">불량유형</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">수량</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">무게(kg)</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">처리방향</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">상세</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
              ) : defects.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">불량 기록이 없습니다.</td></tr>
              ) : (
                defects.map((d) => {
                  const dc = dispositionConfig[d.disposition] || dispositionConfig.pending;
                  return (
                    <tr key={d.defect_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(d.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{d.lot_number || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">{processLabels[d.process_code] || d.process_code}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{defectTypeLabels[d.defect_type] || d.defect_type}</td>
                      <td className="px-4 py-3 text-right font-mono">{d.qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{d.weight ?? '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', dc.bg, dc.text)}>
                          {dc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{d.description || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========== Disposal Tab ========== */
function DisposalTab() {
  const [reports, setReports] = useState<DisposalReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchReports = useCallback(() => {
    setLoading(true);
    api.get<{ data: DisposalReport[] }>('/disposal-reports')
      .then((r) => setReports(Array.isArray(r.data) ? r.data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-shop-sm font-medium hover:bg-red-700"
        >
          <Plus size={16} /> 폐기 보고서 작성
        </button>
      </div>

      <div className="bg-white rounded-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">보고서 ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">생성일</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">폐기방법</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">불량건수</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">폐기 보고서가 없습니다.</td></tr>
              ) : (
                reports.map((r) => {
                  const sc = reportStatusConfig[r.status] || reportStatusConfig.draft;
                  return (
                    <tr key={r.report_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">#{r.report_id}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-xs">{r.disposal_method || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{r.reason || '-'}</td>
                      <td className="px-4 py-3 text-center font-mono">{r.defect_ids?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', sc.bg, sc.text)}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateDisposalReportModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchReports(); }}
        />
      )}
    </div>
  );
}

/* ========== Create Disposal Report Modal ========== */
function CreateDisposalReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [scrapDefects, setScrapDefects] = useState<Defect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [disposalMethod, setDisposalMethod] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Defect[] }>('/defects?disposition=scrap')
      .then((r) => setScrapDefects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setScrapDefects([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleDefect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      alert('폐기 대상 불량을 선택하세요.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/disposal-reports', {
        defect_ids: Array.from(selectedIds),
        disposal_method: disposalMethod,
        reason,
        created_by: null,
      });
      onCreated();
    } catch {
      alert('보고서 생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-shop-lg font-bold flex items-center gap-2">
            <Trash2 size={18} className="text-red-600" /> 폐기 보고서 작성
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Select scrap defects */}
          <div>
            <span className="text-shop-sm font-medium text-gray-700 block mb-2">폐기 대상 불량 선택</span>
            {loading ? (
              <div className="text-center text-gray-400 py-4 text-shop-sm">불러오는 중...</div>
            ) : scrapDefects.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-shop-sm border rounded-md">
                폐기 처분 대상 불량이 없습니다.
              </div>
            ) : (
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {scrapDefects.map((d) => (
                  <label key={d.defect_id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.defect_id)}
                      onChange={() => toggleDefect(d.defect_id)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-medium">{defectTypeLabels[d.defect_type] || d.defect_type}</span>
                      <span className="text-gray-400 ml-2">{processLabels[d.process_code] || d.process_code}</span>
                      <span className="text-gray-400 ml-2">x{d.qty}{d.unit}</span>
                      {d.weight && <span className="text-gray-400 ml-1">({d.weight}kg)</span>}
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(d.created_at).toLocaleDateString('ko-KR')}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.size > 0 && (
              <div className="mt-1 text-xs text-red-600">{selectedIds.size}건 선택됨</div>
            )}
          </div>

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">폐기방법</span>
            <input
              type="text"
              value={disposalMethod}
              onChange={(e) => setDisposalMethod(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              placeholder="예: 소각, 매립, 전문업체 위탁"
            />
          </label>

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">폐기 사유</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              rows={3}
              placeholder="폐기 사유를 입력하세요"
            />
          </label>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-shop-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? '생성 중...' : '보고서 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
