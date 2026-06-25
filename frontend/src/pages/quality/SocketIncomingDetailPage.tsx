import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ClipboardCheck, Tag, CheckCircle2, XCircle, Clock,
  ChevronLeft, Printer, RefreshCw, PackageCheck,
  AlertCircle, Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

// ─── 타입 ───────────────────────────────────────────────────────────────────
interface InspItem {
  sii_id: number;
  so_id: number;
  seq_no: number;
  construction_seq: number;
  product_type: string;
  pipe_width_mm: number;
  pipe_height_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  insp_lot_no: string | null;
  insp_result: 'PENDING' | 'PASS' | 'FAIL';
  insp_note: string | null;
  inspected_by_name: string | null;
  inspected_at: string | null;
}

interface InspSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  lotAssigned: number;
}

interface InspData {
  so: {
    so_id: number;
    project_name: string;
    status: string;
    biz_name: string | null;
  };
  items: InspItem[];
  summary: InspSummary;
}

// ─── 라벨 출력 컴포넌트 ─────────────────────────────────────────────────────
function LabelPrint({ items, projectName }: { items: InspItem[]; projectName: string }) {
  const printItems = items.filter(i => i.insp_lot_no && i.insp_result !== 'FAIL');

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const labels = printItems.map(item => `
      <div class="label">
        <div class="lot">${item.insp_lot_no}</div>
        <div class="type">${item.product_type}</div>
        <div class="spec">${item.pipe_width_mm} × ${item.pipe_height_mm} mm</div>
        <div class="project">${projectName}</div>
        <div class="date">입고일: ${item.inspected_at
          ? new Date(item.inspected_at).toLocaleDateString('ko-KR')
          : new Date().toLocaleDateString('ko-KR')}</div>
        <div class="result ${item.insp_result === 'PASS' ? 'pass' : 'pending'}">
          ${item.insp_result === 'PASS' ? '인수검사 합격 ✓' : '인수검사 대기'}
        </div>
        <div class="seq">No.${String(item.seq_no).padStart(3, '0')}</div>
      </div>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>소켓 인수검사 라벨</title>
        <style>
          @page { margin: 5mm; }
          body { font-family: 'Malgun Gothic', sans-serif; margin: 0; }
          .labels { display: flex; flex-wrap: wrap; gap: 4mm; }
          .label {
            width: 55mm; height: 40mm; border: 1px solid #333;
            padding: 3mm; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 1mm;
            page-break-inside: avoid;
          }
          .lot { font-size: 10pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
          .type { font-size: 9pt; font-weight: bold; color: #1a56db; }
          .spec { font-size: 9pt; }
          .project { font-size: 7pt; color: #555; flex: 1; }
          .date { font-size: 7pt; color: #555; }
          .result { font-size: 7pt; font-weight: bold; }
          .result.pass { color: #15803d; }
          .result.pending { color: #b45309; }
          .seq { font-size: 7pt; color: #888; text-align: right; }
        </style>
      </head>
      <body>
        <div class="labels">${labels}</div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <button
      onClick={handlePrint}
      disabled={printItems.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
    >
      <Printer className="h-4 w-4" />
      라벨 출력 ({printItems.length}개)
    </button>
  );
}

// ─── 개별 소켓 행 ──────────────────────────────────────────────────────────
function ItemRow({
  item, onUpdate,
}: {
  item: InspItem;
  onUpdate: (siiId: number, patch: Partial<InspItem>) => void;
}) {
  const [note, setNote] = useState(item.insp_note || '');
  const [saving, setSaving] = useState(false);

  const handleResult = async (result: 'PASS' | 'FAIL') => {
    setSaving(true);
    try {
      await api.patch(`/socket-incoming/${item.sii_id}`, { insp_result: result, insp_note: note || null });
      onUpdate(item.sii_id, { insp_result: result, insp_note: note || null });
      toast.success(result === 'PASS' ? '합격 처리했습니다' : '불합격 처리했습니다');
    } catch {
      toast.error('처리 실패');
    } finally {
      setSaving(false);
    }
  };

  const resultColor =
    item.insp_result === 'PASS'  ? 'bg-green-50 border-green-200'  :
    item.insp_result === 'FAIL'  ? 'bg-red-50 border-red-200'      :
    'bg-white border-gray-200';

  return (
    <div className={cn('border rounded-xl p-3 transition-colors', resultColor)}>
      <div className="flex items-start gap-3">
        {/* 순번 */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
          {String(item.seq_no).padStart(3, '0')}
        </div>

        {/* 스펙 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{item.product_type}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {item.pipe_width_mm} × {item.pipe_height_mm} mm
            </span>
            {item.construction_seq > 1 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {item.construction_seq}차
              </span>
            )}
          </div>

          {/* LOT 번호 */}
          <div className="mt-1 flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            {item.insp_lot_no ? (
              <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                {item.insp_lot_no}
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">LOT 미부여</span>
            )}
          </div>
        </div>

        {/* 결과 버튼 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => handleResult('PASS')}
            disabled={saving}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              item.insp_result === 'PASS'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            합격
          </button>
          <button
            onClick={() => handleResult('FAIL')}
            disabled={saving}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              item.insp_result === 'FAIL'
                ? 'bg-red-600 text-white'
                : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            불합격
          </button>
        </div>
      </div>

      {/* 비고 */}
      {item.insp_result === 'FAIL' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.insp_note || '')) {
                api.patch(`/socket-incoming/${item.sii_id}`, { insp_note: note })
                  .then(() => onUpdate(item.sii_id, { insp_note: note }))
                  .catch(() => {});
              }
            }}
            placeholder="불합격 사유 입력..."
            className="flex-1 text-xs px-2.5 py-1.5 border border-red-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────
export default function SocketIncomingDetailPage() {
  const { soId } = useParams<{ soId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<InspData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [assigningLots, setAssigningLots] = useState(false);

  const fetchData = useCallback(async () => {
    if (!soId) return;
    try {
      setLoading(true);
      const res = await api.get(`/socket-orders/${soId}/inspections`) as any;
      setData(res.data);
    } catch {
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [soId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = useCallback((siiId: number, patch: Partial<InspItem>) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => i.sii_id === siiId ? { ...i, ...patch } : i),
        summary: {
          ...prev.summary,
          passed: prev.items.filter(i => (i.sii_id === siiId ? (patch.insp_result ?? i.insp_result) : i.insp_result) === 'PASS').length,
          failed: prev.items.filter(i => (i.sii_id === siiId ? (patch.insp_result ?? i.insp_result) : i.insp_result) === 'FAIL').length,
          pending: prev.items.filter(i => (i.sii_id === siiId ? (patch.insp_result ?? i.insp_result) : i.insp_result) === 'PENDING').length,
        }
      };
    });
  }, []);

  // LOT 일괄 부여
  const handleAssignLots = async () => {
    if (!soId) return;
    if (!confirm('LOT를 일괄 부여합니다. (C302 5.1 기준: YYMMDDGI+순번)\n계속합니까?')) return;
    setAssigningLots(true);
    try {
      const res = await api.post(`/socket-orders/${soId}/assign-lots-bulk`, { worker_id: user?.worker_id }) as any;
      toast.success(`LOT ${res.data.count}개를 부여했습니다`);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'LOT 부여 실패');
    } finally {
      setAssigningLots(false);
    }
  };

  // 입고완료 처리
  const handleCompleteReceive = async () => {
    if (!soId || !data) return;
    const { passed, pending } = data.summary;
    if (passed === 0) {
      toast.error('합격 처리된 항목이 없습니다. 인수검사를 먼저 진행해 주세요.');
      return;
    }
    if (!confirm(
      `입고완료 처리합니까?\n\n` +
      `합격: ${passed}개 → socket_stock에 반영\n` +
      `${pending > 0 ? `미검사 ${pending}개는 제외됩니다.\n` : ''}` +
      `이 작업은 되돌릴 수 없습니다.`
    )) return;

    setCompleting(true);
    try {
      const res = await api.post(`/socket-orders/${soId}/complete-receive`, { worker_id: user?.worker_id }) as any;
      toast.success(`입고완료! 합격 ${res.data.passed_count}개가 재고에 반영됐습니다.`);
      navigate('/orders/socket-order-wait');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '입고완료 처리 실패');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-teal-500 animate-spin" />
          <p className="text-slate-500 text-sm">인수검사 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { so, items, summary } = data;
  const allDone = summary.pending === 0;
  const isReceived = so.status === 'RECEIVED';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/orders/socket-order-wait')}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">
                소켓 인수검사
              </h1>
              <p className="text-xs text-slate-500 truncate">{so.project_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
              {!isReceived && <LabelPrint items={items} projectName={so.project_name} />}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* ── 진행 요약 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">검사 현황</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className={cn(
                'px-2 py-0.5 rounded-full font-semibold',
                isReceived ? 'bg-green-100 text-green-700' :
                'bg-violet-100 text-violet-700'
              )}>
                {isReceived ? '입고완료' : '인수검사중'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: '전체', val: summary.total, color: 'text-slate-700 bg-slate-100' },
              { label: 'LOT부여', val: summary.lotAssigned, color: 'text-teal-700 bg-teal-50' },
              { label: '합격', val: summary.passed, color: 'text-green-700 bg-green-50' },
              { label: '불합격', val: summary.failed, color: 'text-red-700 bg-red-50' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-xl p-3 text-center', s.color)}>
                <div className="text-xl font-bold">{s.val}</div>
                <div className="text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 진행 바 */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-green-500 transition-all duration-500"
              style={{ width: `${summary.total > 0 ? ((summary.passed + summary.failed) / summary.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>검사 완료: {summary.passed + summary.failed}/{summary.total}</span>
            <span>미검사: {summary.pending}</span>
          </div>
        </div>

        {/* ── 액션 버튼 ── */}
        {!isReceived && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAssignLots}
              disabled={assigningLots || summary.lotAssigned === summary.total}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              {assigningLots
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Tag className="h-4 w-4" />
              }
              {summary.lotAssigned === summary.total ? 'LOT 부여 완료' : `LOT 일괄 부여 (미부여 ${summary.total - summary.lotAssigned}개)`}
            </button>

            <button
              onClick={handleCompleteReceive}
              disabled={completing || summary.passed === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 ml-auto"
            >
              {completing
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <PackageCheck className="h-4 w-4" />
              }
              입고완료 처리 (합격 {summary.passed}개)
            </button>
          </div>
        )}

        {/* ── 안내 ── */}
        {!isReceived && summary.lotAssigned < summary.total && (
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>LOT를 먼저 부여하세요.</strong> C302 5.1 기준: 형식 <code className="bg-amber-100 px-1 rounded">YYMMDDGI+순번</code> (예: 260615GI001)
            </span>
          </div>
        )}

        {/* ── 소켓 목록 ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-teal-600" />
            소켓 목록 ({items.length}개) — 차수 → 구조체 → 가로↑ → 세로↑ 정렬
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>인수검사 항목이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <ItemRow key={item.sii_id} item={item} onUpdate={handleUpdate} />
              ))}
            </div>
          )}
        </div>

        {/* ── 입고완료 후 메시지 ── */}
        {isReceived && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <PackageCheck className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-700">입고완료</p>
              <p className="text-xs text-slate-500 mt-1">합격품이 소켓 재고에 반영됐습니다</p>
            </div>
            <button
              onClick={() => navigate('/orders/socket-order-wait')}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              자재발주대기로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
