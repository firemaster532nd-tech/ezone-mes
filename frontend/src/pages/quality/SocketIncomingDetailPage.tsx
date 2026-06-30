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
  // 2차 검사 필드
  insp_result_2: 'PENDING' | 'PASS' | 'FAIL' | null;
  insp_note_2: string | null;
  inspected_by_2_name?: string | null;
  inspected_at_2?: string | null;
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
    insp_worker_id: number | null;
    insp_reviewer_id: number | null;
    insp_approver_id: number | null;
  };
  items: InspItem[];
  summary: InspSummary;
}

// ─── 라벨 출력 컴포넌트 ─────────────────────────────────────────────────────
function LabelPrint({ items, projectName }: { items: InspItem[]; projectName: string }) {
  const printItems = items.filter(i => i.insp_lot_no && (i.insp_result !== 'FAIL' || i.insp_result_2 === 'PASS'));

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const labels: string[] = [];
    for (const item of printItems) {
      const qty = Number(item.print_qty) || 1;
      for (let k = 0; k < qty; k++) {
        labels.push(`
          <div class="label">
            <div class="lot">${item.insp_lot_no}</div>
            <div class="type">${item.product_type}</div>
            <div class="spec">${item.pipe_width_mm} × ${item.pipe_height_mm} mm</div>
            <div class="project">${projectName}</div>
            <div class="date">입고일: ${item.inspected_at
              ? new Date(item.inspected_at).toLocaleDateString('ko-KR')
              : new Date().toLocaleDateString('ko-KR')}</div>
            <div class="result pass">
              인수검사 합격 ✓
            </div>
            <div class="seq">No.${String(item.seq_no).padStart(3, '0')}</div>
          </div>
        `);
      }
    }
    const labelsHtml = labels.join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>소켓 인수검사 라벨</title>
        <style>
          @page { size: 80mm 60mm; margin: 0; }
          body { font-family: 'Malgun Gothic', sans-serif; margin: 0; padding: 0; }
          .labels { display: flex; flex-direction: column; }
          .label {
            width: 80mm; height: 60mm; border: none;
            padding: 5mm; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 1.5mm;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .lot { font-size: 14pt; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 1.5mm; }
          .type { font-size: 12pt; font-weight: bold; color: #1a56db; }
          .spec { font-size: 12pt; font-weight: bold; }
          .project { font-size: 9pt; color: #555; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .date { font-size: 9pt; color: #555; }
          .result { font-size: 9.5pt; font-weight: bold; color: #15803d; }
          .seq { font-size: 9pt; color: #888; text-align: right; }
        </style>
      </head>
      <body>
        <div class="labels">${labelsHtml}</div>
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
  item, onUpdate, isReadOnly, projectName,
}: {
  item: InspItem;
  onUpdate: (siiId: number, patch: Partial<InspItem>) => void;
  isReadOnly?: boolean;
  projectName: string;
}) {
  const [note, setNote] = useState(item.insp_note || '');
  const [note2, setNote2] = useState(item.insp_note_2 || '');
  const [lotNo, setLotNo] = useState(item.insp_lot_no || '');
  const [printQty, setPrintQty] = useState(item.print_qty || 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLotNo(item.insp_lot_no || '');
  }, [item.insp_lot_no]);

  useEffect(() => {
    setPrintQty(item.print_qty || 1);
  }, [item.print_qty]);

  const handleResult = async (result: 'PASS' | 'FAIL') => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      await api.patch(`/socket-incoming/${item.sii_id}`, { insp_result: result, insp_note: note || null });
      onUpdate(item.sii_id, { insp_result: result, insp_note: note || null });
      toast.success(result === 'PASS' ? '1차 합격 처리했습니다' : '1차 불합격 처리했습니다');
    } catch {
      toast.error('처리 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResult2 = async (result: 'PASS' | 'FAIL') => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      await api.patch(`/socket-incoming/${item.sii_id}`, { insp_result_2: result, insp_note_2: note2 || null });
      onUpdate(item.sii_id, { insp_result_2: result, insp_note_2: note2 || null });
      toast.success(result === 'PASS' ? '2차 합격 처리했습니다' : '2차 불합격 처리했습니다');
    } catch {
      toast.error('처리 실패');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintSingle = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const labels: string[] = [];
    const qty = Number(item.print_qty) || 1;
    for (let k = 0; k < qty; k++) {
      labels.push(`
        <div class="label">
          <div class="lot">${item.insp_lot_no || 'LOT 미부여'}</div>
          <div class="type">${item.product_type}</div>
          <div class="spec">${item.pipe_width_mm} × ${item.pipe_height_mm} mm</div>
          <div class="project">${projectName}</div>
          <div class="date">입고일: ${item.inspected_at
            ? new Date(item.inspected_at).toLocaleDateString('ko-KR')
            : new Date().toLocaleDateString('ko-KR')}</div>
          <div class="result">인수검사 합격 ✓</div>
          <div class="seq">No.${String(item.seq_no).padStart(3, '0')}</div>
        </div>
      `);
    }
    const labelsHtml = labels.join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>소켓 인수검사 라벨 (단건/사본)</title>
        <style>
          @page { size: 80mm 60mm; margin: 0; }
          body { font-family: 'Malgun Gothic', sans-serif; margin: 0; padding: 0; }
          .labels { display: flex; flex-direction: column; }
          .label {
            width: 80mm; height: 60mm; border: none;
            padding: 5mm; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 1.5mm;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .lot { font-size: 14pt; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 1.5mm; }
          .type { font-size: 12pt; font-weight: bold; color: #1a56db; }
          .spec { font-size: 12pt; font-weight: bold; }
          .project { font-size: 9pt; color: #555; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .date { font-size: 9pt; color: #555; }
          .result { font-size: 9.5pt; font-weight: bold; color: #15803d; }
          .seq { font-size: 9pt; color: #888; text-align: right; }
        </style>
      </head>
      <body>
        <div class="labels">${labelsHtml}</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };


  // 최종 판정 색상 (1차 합격 또는 2차 합격 시 초록색)
  const isFinalPass = item.insp_result === 'PASS' || item.insp_result_2 === 'PASS';
  const isFinalFail = item.insp_result === 'FAIL' && (item.insp_result_2 === 'FAIL' || !item.insp_result_2 || item.insp_result_2 === 'PENDING');
  
  const resultColor =
    isFinalPass   ? 'bg-green-50/50 border-green-200'  :
    isFinalFail   ? 'bg-red-50/50 border-red-200'      :
    'bg-white border-slate-200';

  return (
    <div className={cn('border rounded-xl p-4 transition-all duration-200 shadow-sm', resultColor)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 스펙 및 LOT */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
            {String(item.seq_no).padStart(3, '0')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800">{item.product_type}</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {item.pipe_width_mm} × {item.pipe_height_mm} mm
              </span>
              {item.construction_seq > 1 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {item.construction_seq}차
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={lotNo}
                  disabled={isReadOnly}
                  onChange={e => setLotNo(e.target.value)}
                  onBlur={() => {
                    if (isReadOnly) return;
                    if (lotNo !== (item.insp_lot_no || '')) {
                      api.patch(`/socket-incoming/${item.sii_id}`, { insp_lot_no: lotNo || null })
                        .then(() => onUpdate(item.sii_id, { insp_lot_no: lotNo || null }))
                        .catch(() => {
                          toast.error('LOT 번호 저장 실패');
                        });
                    }
                  }}
                  placeholder="LOT/시리얼번호 입력..."
                  className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white font-mono w-[180px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Printer className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-[10px] text-slate-500 font-bold">인쇄 매수:</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={printQty}
                  disabled={isReadOnly}
                  onChange={e => setPrintQty(Number(e.target.value))}
                  onBlur={() => {
                    if (isReadOnly) return;
                    if (printQty !== (item.print_qty || 1)) {
                      api.patch(`/socket-incoming/${item.sii_id}`, { print_qty: printQty })
                        .then(() => onUpdate(item.sii_id, { print_qty: printQty }))
                        .catch(() => {
                          toast.error('인쇄 수량 저장 실패');
                        });
                    }
                  }}
                  className="text-xs px-2 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white font-mono w-[60px]"
                />
              </div>
            </div>

          </div>
        </div>

        {/* 1차 & 2차 인수검사 결재 패널 */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-shrink-0">
          {/* 1차 점검 */}
          <div className="border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm flex flex-col gap-1.5 min-w-[200px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">1차 점검</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-bold',
                item.insp_result === 'PASS' ? 'text-green-700 bg-green-50' :
                item.insp_result === 'FAIL' ? 'text-red-700 bg-red-50' : 'text-slate-500 bg-slate-100'
              )}>
                {item.insp_result === 'PASS' ? '합격' : item.insp_result === 'FAIL' ? '불합격' : '대기'}
              </span>
            </div>
            {!isReadOnly && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleResult('PASS')}
                  disabled={saving}
                  className={cn(
                    'flex-1 text-center py-1 text-[11px] font-semibold rounded transition-colors',
                    item.insp_result === 'PASS'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  합격
                </button>
                <button
                  onClick={() => handleResult('FAIL')}
                  disabled={saving}
                  className={cn(
                    'flex-1 text-center py-1 text-[11px] font-semibold rounded transition-colors',
                    item.insp_result === 'FAIL'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  불합격
                </button>
              </div>
            )}
            <input
              type="text"
              value={note}
              disabled={isReadOnly}
              onChange={e => setNote(e.target.value)}
              onBlur={() => {
                if (isReadOnly) return;
                if (note !== (item.insp_note || '')) {
                  api.patch(`/socket-incoming/${item.sii_id}`, { insp_note: note })
                    .then(() => onUpdate(item.sii_id, { insp_note: note }))
                    .catch(() => {});
                }
              }}
              placeholder="1차 점검 메모..."
              className="text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
            />
          </div>

          {/* 2차 점검 */}
          <div className="border border-slate-200 rounded-lg p-2.5 bg-white shadow-sm flex flex-col gap-1.5 min-w-[200px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500">2차 점검</span>
                <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded font-semibold">(재검사)</span>
              </div>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-bold',
                item.insp_result_2 === 'PASS' ? 'text-green-700 bg-green-50' :
                item.insp_result_2 === 'FAIL' ? 'text-red-700 bg-red-50' : 'text-slate-500 bg-slate-100'
              )}>
                {item.insp_result_2 === 'PASS' ? '합격' : item.insp_result_2 === 'FAIL' ? '불합격' : '대기'}
              </span>
            </div>
            {!isReadOnly && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleResult2('PASS')}
                  disabled={saving}
                  className={cn(
                    'flex-1 text-center py-1 text-[11px] font-semibold rounded transition-colors',
                    item.insp_result_2 === 'PASS'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  합격
                </button>
                <button
                  onClick={() => handleResult2('FAIL')}
                  disabled={saving}
                  className={cn(
                    'flex-1 text-center py-1 text-[11px] font-semibold rounded transition-colors',
                    item.insp_result_2 === 'FAIL'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  불합격
                </button>
              </div>
            )}
            <input
              type="text"
              value={note2}
              disabled={isReadOnly}
              onChange={e => setNote2(e.target.value)}
              onBlur={() => {
                if (isReadOnly) return;
                if (note2 !== (item.insp_note_2 || '')) {
                  api.patch(`/socket-incoming/${item.sii_id}`, { insp_result_2: item.insp_result_2, insp_note_2: note2 })
                    .then(() => onUpdate(item.sii_id, { insp_note_2: note2 }))
                    .catch(() => {});
                }
              }}
              placeholder="2차 점검 메모..."
              className="text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
            />
          </div>

          {/* 단건 라벨 출력 */}
          {isFinalPass && (
            <button
              onClick={handlePrintSingle}
              className="flex items-center justify-center p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-sm self-center sm:self-auto"
              title="라벨 1장 출력"
            >
              <Printer className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── 메인 페이지 ───────────────────────────────────────────────────────────
export default function SocketIncomingDetailPage() {
  const { soId } = useParams<{ soId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<InspData | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [assigningLots, setAssigningLots] = useState(false);
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await api.get<any>('/workers');
      // res.data 가 작업자 리스트 배열입니다.
      setWorkers(res.data || []);
    } catch (e) {
      console.error('작업자 목록 조회 실패', e);
    }
  }, []);



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

  const handleUpdateApprovers = async (field: 'insp_worker_id' | 'insp_reviewer_id' | 'insp_approver_id', value: number | null) => {
    if (!soId || !data) return;
    try {
      const nextApprovers = {
        insp_worker_id: data.so.insp_worker_id,
        insp_reviewer_id: data.so.insp_reviewer_id,
        insp_approver_id: data.so.insp_approver_id,
        [field]: value
      };
      await api.patch(`/socket-orders/${soId}/inspection-approvers`, nextApprovers);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          so: {
            ...prev.so,
            [field]: value
          }
        };
      });
      toast.success('결재선이 업데이트되었습니다.');
    } catch {
      toast.error('결재선 저장 실패');
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchWorkers();
  }, [fetchData, fetchWorkers]);

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
    if (!confirm(`선택한 날짜(${assignDate}) 기준 접두사에 3자리 순번을 더해 LOT를 일괄 부여합니다.\n계속합니까?`)) return;
    setAssigningLots(true);
    try {
      const res = await api.post(`/socket-orders/${soId}/assign-lots-bulk`, { 
        worker_id: user?.worker_id,
        date: assignDate
      }) as any;
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
  const isReceived = so.status === 'RECEIVED' || so.status === 'INSPECTED';
  const isReadOnly = so.status === 'RECEIVED' || so.status === 'INSPECTED';

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
        {/* ── 인수검사 결재선 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-4.5 w-4.5 text-teal-600" />
            인수검사 결재선 지정
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 담당자 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500">검사담당자</label>
              <select
                disabled={isReadOnly}
                value={so.insp_worker_id || ''}
                onChange={e => handleUpdateApprovers('insp_worker_id', e.target.value ? Number(e.target.value) : null)}
                className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">담당자 선택...</option>
                {workers.map(w => (
                  <option key={w.worker_id} value={w.worker_id}>{w.worker_name} ({w.department || '부서없음'})</option>
                ))}
              </select>
            </div>

            {/* 검토자 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500">검사검토자</label>
              <select
                disabled={isReadOnly}
                value={so.insp_reviewer_id || ''}
                onChange={e => handleUpdateApprovers('insp_reviewer_id', e.target.value ? Number(e.target.value) : null)}
                className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">검토자 선택...</option>
                {workers.map(w => (
                  <option key={w.worker_id} value={w.worker_id}>{w.worker_name} ({w.department || '부서없음'})</option>
                ))}
              </select>
            </div>

            {/* 승인자 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500">검사승인자</label>
              <select
                disabled={isReadOnly}
                value={so.insp_approver_id || ''}
                onChange={e => handleUpdateApprovers('insp_approver_id', e.target.value ? Number(e.target.value) : null)}
                className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">승인자 선택...</option>
                {workers.map(w => (
                  <option key={w.worker_id} value={w.worker_id}>{w.worker_name} ({w.department || '부서없음'})</option>
                ))}
              </select>
            </div>

          </div>
        </div>

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
          <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold">LOT 기준 날짜:</span>
              <input
                type="date"
                value={assignDate}
                onChange={e => setAssignDate(e.target.value)}
                className="text-xs focus:outline-none border-none font-mono"
              />
            </div>

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
                <ItemRow key={item.sii_id} item={item} onUpdate={handleUpdate} isReadOnly={isReadOnly} projectName={so.project_name} />
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
