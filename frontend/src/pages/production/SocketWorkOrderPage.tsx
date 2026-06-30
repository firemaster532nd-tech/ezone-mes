import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Plus, X, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2,
  ClipboardList, Building2, Calendar, User, MapPin, FileText,
  AlertCircle, Trash2, Pencil, Play, CheckCheck,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────
interface SWO {
  swo_id: number;
  swo_number: string;
  po_id: number;
  project_name: string;
  sheet_name: string | null;
  wo_date: string;
  delivery_date: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  worker: string | null;
  remarks: string | null;
  warnings: string | null;
  item_count: number;
  incomplete_count: number;
  has_duplicate: boolean;
  po_file_name: string | null;
  po_biz_name: string | null;
}

interface POItem {
  po_item_id: number;
  sheet_name: string;
  seq_no: number;
  item_type: string;
  material: string | null;
  structure: string | null;
  pipe_width_mm: number | null;
  pipe_height_mm: number | null;
  opening_width_mm: number | null;
  opening_height_mm: number | null;
  qty: number;
  product_type: string | null;
  item_name: string | null;
  remark: string | null;
  is_incomplete: boolean;
  is_duplicate: boolean;
}

interface PO {
  po_id: number;
  project_name: string;
  biz_name: string | null;
  delivery_date: string | null;
  item_count: number;
  file_name: string;
  site_address: string | null;
  consignee: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 상태 색상
// ────────────────────────────────────────────────────────────────────────────
const statusConfig = {
  PLANNED:     { label: '계획',   bg: 'bg-blue-100',   text: 'text-blue-700'   },
  IN_PROGRESS: { label: '진행중', bg: 'bg-amber-100',  text: 'text-amber-700'  },
  COMPLETED:   { label: '완료',   bg: 'bg-green-100',  text: 'text-green-700'  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 경고 배지
// ────────────────────────────────────────────────────────────────────────────
function WarningBadge({ incomplete, duplicate }: { incomplete: number; duplicate: boolean }) {
  if (!incomplete && !duplicate) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {incomplete > 0 && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">
          <AlertTriangle className="h-3 w-3" />미완성 {incomplete}건
        </span>
      )}
      {duplicate && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
          <AlertCircle className="h-3 w-3" />중복
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export function SocketWorkOrderPage() {
  const [data, setData] = useState<SWO[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SWO | null>(null);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { key: '', label: '전체' },
    { key: 'PLANNED', label: '계획' },
    { key: 'IN_PROGRESS', label: '진행중' },
    { key: 'COMPLETED', label: '완료' },
  ];

  const fetch = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    api.get<{ data: SWO[] }>(`/socket-work-orders${qs}`)
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [statusFilter]);

  const handleStatusChange = async (swo: SWO, newStatus: string) => {
    try {
      await api.patch(`/socket-work-orders/${swo.swo_id}`, { status: newStatus });
      fetch();
    } catch {
      alert('상태 변경 실패');
    }
  };

  const handleDelete = async (swo: SWO) => {
    if (swo.status === 'COMPLETED') { alert('완료된 작업지시는 삭제할 수 없습니다.'); return; }
    if (!confirm(`${swo.swo_number} 작업지시를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/socket-work-orders/${swo.swo_id}`);
      fetch();
    } catch (e: any) {
      alert(e?.body?.error || '삭제 실패');
    }
  };

  const counts = useMemo(() => ({
    planned: data.filter(s => s.status === 'PLANNED').length,
    inProgress: data.filter(s => s.status === 'IN_PROGRESS').length,
    completed: data.filter(s => s.status === 'COMPLETED').length,
    warnings: data.filter(s => s.incomplete_count > 0 || s.has_duplicate).length,
  }), [data]);

  return (
    <div>
      <PageHeader title="소켓 작업지시서" count={data.length} description="발주서 연동 소켓 조립 작업지시">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> 신규 작성
        </button>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: '계획', value: counts.planned, color: 'border-blue-400 text-blue-700 bg-blue-50' },
          { label: '진행중', value: counts.inProgress, color: 'border-amber-400 text-amber-700 bg-amber-50' },
          { label: '완료', value: counts.completed, color: 'border-green-400 text-green-700 bg-green-50' },
          { label: '⚠️ 경고', value: counts.warnings, color: 'border-red-400 text-red-700 bg-red-50' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-xl border-l-4 p-3', c.color)}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-medium opacity-70">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              statusFilter === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-500 text-xs">
              <th className="px-4 py-3 text-left font-medium">지시번호</th>
              <th className="px-4 py-3 text-left font-medium">현장명 (프로젝트)</th>
              <th className="px-4 py-3 text-left font-medium">시트(동)</th>
              <th className="px-4 py-3 text-left font-medium">발주처</th>
              <th className="px-4 py-3 text-left font-medium">작업일</th>
              <th className="px-4 py-3 text-left font-medium">납기일</th>
              <th className="px-4 py-3 text-center font-medium">품목수</th>
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">경고</th>
              <th className="px-4 py-3 text-center font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">로딩 중...</td></tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center">
                  <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">소켓 작업지시서가 없습니다.</p>
                  <p className="text-gray-300 text-xs mt-1">'신규 작성' 버튼으로 발주서에서 작업지시를 생성하세요.</p>
                </td>
              </tr>
            ) : (
              data.map(swo => (
                <tr key={swo.swo_id} className="border-b hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailTarget(swo)}
                      className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {swo.swo_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 max-w-[180px] truncate font-medium text-gray-800">{swo.project_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{swo.sheet_name || '전체'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{swo.po_biz_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{swo.wo_date?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{swo.delivery_date?.slice(0, 10) || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{swo.item_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={swo.status} /></td>
                  <td className="px-4 py-3">
                    <WarningBadge incomplete={swo.incomplete_count} duplicate={swo.has_duplicate} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {swo.status === 'PLANNED' && (
                        <button
                          onClick={() => handleStatusChange(swo, 'IN_PROGRESS')}
                          title="진행 시작"
                          className="p-1.5 rounded hover:bg-amber-100 text-amber-600 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {swo.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleStatusChange(swo, 'COMPLETED')}
                          title="완료 처리"
                          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setDetailTarget(swo)}
                        title="상세 보기"
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-500 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {swo.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleDelete(swo)}
                          title="삭제"
                          className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 신규 작성 모달 */}
      {showCreate && (
        <CreateSwoModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetch(); }}
        />
      )}

      {/* 상세 모달 */}
      {detailTarget && (
        <DetailSwoModal
          swo={detailTarget}
          onClose={() => setDetailTarget(null)}
          onRefresh={fetch}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 신규 작성 모달 (3단계)
// ────────────────────────────────────────────────────────────────────────────
function CreateSwoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pos, setPos] = useState<PO[]>([]);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [checkResult, setCheckResult] = useState<{
    items: any[];
    sheets: string[];
    sheet_items: Record<string, any[]>;
    incomplete_count: number;
    duplicate_count: number;
  } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    wo_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    worker: '',
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  // 발주서 목록 로드 (소켓 인수검사가 완료된 발주서만 필터링)
  useEffect(() => {
    api.get<{ data: PO[] }>('/purchase-orders?has_socket_inspected=true').then(r => setPos(r.data)).catch(() => {});
  }, []);

  // 발주서 선택 시 체크
  const handlePoSelect = async (po: PO) => {
    setSelectedPo(po);
    setSelectedSheet('');
    setCheckResult(null);
    setSelectedItems(new Set());
    setChecking(true);
    try {
      const r = await api.get<{ data: any }>(`/socket-work-orders/po/${po.po_id}/check`);
      setCheckResult(r.data);
      setSheets(r.data.sheets || []);
    } catch {
      setCheckResult(null);
    } finally {
      setChecking(false);
    }
  };

  // 현재 시트 품목
  const currentItems = useMemo(() => {
    if (!checkResult) return [];
    if (!selectedSheet) return checkResult.items;
    return checkResult.sheet_items?.[selectedSheet] || [];
  }, [checkResult, selectedSheet]);

  const toggleItem = (siiId: number) => {
    setSelectedItems(prev => {
      const n = new Set(prev);
      if (n.has(siiId)) n.delete(siiId); else n.add(siiId);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(i => i.sii_id)));
    }
  };

  const selectedItemData = useMemo(
    () => currentItems.filter(i => selectedItems.has(i.sii_id)),
    [currentItems, selectedItems],
  );

  const handleSubmit = async () => {
    if (!selectedPo || selectedItemData.length === 0) return;
    setSubmitting(true);
    try {
      const items = selectedItemData.map(it => ({
        po_item_id: it.po_item_id,
        seq_no: it.seq_no,
        material: it.material,
        structure: it.structure,
        pipe_width_mm: it.pipe_width_mm,
        pipe_height_mm: it.pipe_height_mm,
        opening_width_mm: it.opening_width_mm,
        opening_height_mm: it.opening_height_mm,
        product_type: it.product_type,
        item_name: it.item_name,
        item_type: it.item_type,
        qty: 1,
        planned_qty: 1,
        remark: it.remark,
        construction_seq: it.construction_seq,
        insp_lot_no: it.insp_lot_no,
        sii_id: it.sii_id
      }));

      const res = await api.post<{ data: any }>('/socket-work-orders', {
        po_id: selectedPo.po_id,
        project_name: selectedPo.project_name,
        sheet_name: selectedSheet || null,
        ...form,
        items,
      });

      const warnings = res.data?.warnings as string[] | undefined;
      if (warnings?.length) {
        alert(`✅ ${res.data?.swo_number} 생성 완료\n\n⚠️ 경고:\n${warnings.join('\n')}`);
      } else {
        alert(`✅ ${res.data?.swo_number} 생성 완료`);
      }
      onCreated();
    } catch (e: any) {
      alert(e?.body?.error || '생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel = ['발주서 선택', '시트(동) 선택', '품목 선택 및 작업 정보'];


  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">소켓 작업지시서 신규 작성</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400',
                  )}>{s}</div>
                  <span className={cn('text-xs', step >= s ? 'text-indigo-600 font-medium' : 'text-gray-400')}>
                    {stepLabel[s - 1]}
                  </span>
                  {s < 3 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* STEP 1: 발주서 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">발주서 선택 *</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-xl p-2">
              {pos.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">등록된 발주서가 없습니다.</p>
              )}
              {pos.map(po => (
                <button
                  key={po.po_id}
                  onClick={() => handlePoSelect(po)}
                  className={cn(
                    'w-full text-left rounded-lg p-3 border transition-colors',
                    selectedPo?.po_id === po.po_id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900 line-clamp-1">{po.project_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{po.biz_name || '-'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {po.delivery_date && (
                        <span className="text-xs text-gray-500">납기: {po.delivery_date.slice(0, 10)}</span>
                      )}
                      <p className="text-xs text-indigo-600 font-medium">{po.item_count}건</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 발주서 선택 후 경고 요약 */}
          {selectedPo && checkResult && (
            <div className="flex gap-2">
              {checkResult.incomplete_count > 0 && (
                <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-800">
                    <span className="font-bold">미완성 발주내용</span> {checkResult.incomplete_count}건 — 규격/수량 미입력 품목
                  </p>
                </div>
              )}
              {checkResult.duplicate_count > 0 && (
                <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-xs text-red-800">
                    <span className="font-bold">중복 작업지시</span> {checkResult.duplicate_count}건 — 이미 계획/진행 중
                  </p>
                </div>
              )}
              {checkResult.incomplete_count === 0 && checkResult.duplicate_count === 0 && (
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-green-800 font-medium">발주 내용 정상 — 이상 없음</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: 시트(동) 선택 */}
          {selectedPo && sheets.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">시트(동) 선택</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setSelectedSheet(''); setStep(2); }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                    !selectedSheet ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300',
                  )}
                >
                  전체
                </button>
                {sheets.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSelectedSheet(s); setStep(2); }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                      selectedSheet === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: 품목 선택 */}
          {selectedPo && (step >= 2 || selectedSheet !== '') && currentItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">
                  품목 선택 * ({selectedItems.size}/{currentItems.length}개 선택됨)
                </label>
                <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
                  {selectedItems.size === currentItems.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === currentItems.length && currentItems.length > 0}
                          onChange={toggleAll}
                          className="w-3.5 h-3.5"
                        />
                      </th>
                      <th className="px-2 py-2 text-left text-gray-500">NO</th>
                      <th className="px-2 py-2 text-left text-gray-500">재질</th>
                      <th className="px-2 py-2 text-left text-gray-500">구조체</th>
                      <th className="px-2 py-2 text-left text-gray-500">규격(가로×세로)</th>
                      <th className="px-2 py-2 text-center text-gray-500">차수</th>
                      <th className="px-2 py-2 text-center text-gray-500">인수검사 LOT 번호</th>
                      <th className="px-2 py-2 text-left text-gray-500">경고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentItems.map(item => {
                      const isSelected = selectedItems.has(item.sii_id);
                      return (
                        <tr
                          key={item.sii_id}
                          onClick={() => toggleItem(item.sii_id)}
                          className={cn(
                            'cursor-pointer transition-colors',
                            isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50',
                            item.is_incomplete && 'opacity-80',
                          )}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItem(item.sii_id)}
                              onClick={e => e.stopPropagation()}
                              className="w-3.5 h-3.5"
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-500">{item.seq_no}</td>
                          <td className="px-2 py-2 font-mono">{item.material || item.item_name || '-'}</td>
                          <td className="px-2 py-2 max-w-[100px] truncate">{item.structure || item.product_type || '-'}</td>
                          <td className="px-2 py-2 font-mono">
                            {item.pipe_width_mm && item.pipe_height_mm
                              ? `${item.pipe_width_mm}×${item.pipe_height_mm}`
                              : <span className="text-gray-300">미입력</span>}
                          </td>
                          <td className="px-2 py-2 text-center font-mono">{item.construction_seq ?? 1}차</td>
                          <td className="px-2 py-2 text-center">
                            <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">
                              {item.insp_lot_no || '미부여'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              {item.is_incomplete && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5" />미완성
                                </span>
                              )}
                              {item.is_duplicate && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">
                                  <AlertCircle className="h-2.5 w-2.5" />중복
                                </span>
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


          {/* 작업 기본정보 */}
          {selectedPo && selectedItems.size > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-700">작업 기본정보</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">작업일 *</label>
                  <input
                    type="date"
                    value={form.wo_date}
                    onChange={e => setForm(f => ({ ...f, wo_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">납기일</label>
                  <input
                    type="date"
                    value={form.delivery_date || selectedPo.delivery_date?.slice(0, 10) || ''}
                    onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">작업자</label>
                  <input
                    type="text"
                    value={form.worker}
                    onChange={e => setForm(f => ({ ...f, worker: e.target.value }))}
                    placeholder="작업자 이름"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">비고</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="비고사항"
                    className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="flex items-center justify-between p-5 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">취소</button>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => (s - 1) as any)} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-100">
                이전
              </button>
            )}
            {step < 3 && selectedPo && (
              <button
                onClick={() => setStep(s => (s + 1) as any)}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                다음
              </button>
            )}
            {selectedPo && selectedItems.size > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {submitting ? '저장 중...' : `작업지시 생성 (${selectedItems.size}건)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 상세 모달
// ────────────────────────────────────────────────────────────────────────────
function DetailSwoModal({ swo, onClose, onRefresh }: { swo: SWO; onClose: () => void; onRefresh: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [editStatus, setEditStatus] = useState(swo.status);
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: any }>(`/socket-work-orders/${swo.swo_id}`)
      .then(r => {
        setDetail(r.data);
        const a: Record<number, number> = {};
        r.data.items?.forEach((it: any) => { a[it.swi_id] = it.actual_qty ?? 0; });
        setActuals(a);
      })
      .catch(() => {});
  }, [swo.swo_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const item_actuals = Object.entries(actuals).map(([swi_id, actual_qty]) => ({
        swi_id: parseInt(swi_id), actual_qty,
      }));
      await api.patch(`/socket-work-orders/${swo.swo_id}`, { status: editStatus, item_actuals });
      onRefresh();
      onClose();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const d = detail;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <p className="font-mono text-xs text-indigo-600">{swo.swo_number}</p>
            <h2 className="text-base font-bold text-gray-900">{swo.project_name}</h2>
            {swo.warnings && (
              <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{swo.warnings}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 기본 정보 */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { icon: <Building2 className="h-3.5 w-3.5" />, label: '발주처', val: d?.biz_name },
              { icon: <MapPin className="h-3.5 w-3.5" />, label: '시트(동)', val: swo.sheet_name },
              { icon: <Calendar className="h-3.5 w-3.5" />, label: '작업일', val: swo.wo_date?.slice(0,10) },
              { icon: <Calendar className="h-3.5 w-3.5" />, label: '납기일', val: swo.delivery_date?.slice(0,10) },
              { icon: <User className="h-3.5 w-3.5" />, label: '작업자', val: swo.worker },
              { icon: <MapPin className="h-3.5 w-3.5" />, label: '납품지', val: d?.site_address },
              { icon: <User className="h-3.5 w-3.5" />, label: '인수자', val: d?.consignee },
              { icon: <FileText className="h-3.5 w-3.5" />, label: '특기사항', val: d?.po_special_notes },
            ].map(f => (
              <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                  {f.icon}{f.label}
                </div>
                <p className="text-xs font-medium text-gray-800 truncate">{f.val || '-'}</p>
              </div>
            ))}
          </div>

          {/* 상태 변경 */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <span className="text-xs font-medium text-gray-600">상태 변경:</span>
            {(['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setEditStatus(s)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                  editStatus === s
                    ? statusConfig[s].bg + ' ' + statusConfig[s].text + ' font-bold ring-2 ring-indigo-300'
                    : 'bg-white border text-gray-500 hover:border-indigo-300',
                )}
              >
                {statusConfig[s].label}
              </button>
            ))}
          </div>

          {/* 품목 목록 + 실적 입력 — 구조체별 그룹 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              작업 항목 ({d?.items?.length || 0}건)
            </h3>

            {(() => {
              if (!d?.items?.length) return (
                <div className="text-center py-8 text-gray-400 text-sm border rounded-xl">항목 없음</div>
              );

              // ── 구조체별 색상 팔레트 (C302 표5 순서)
              const STRUCT_COLORS: Record<string, {
                header: string; badge: string; row: string; rowAlt: string; border: string;
              }> = {
                'V-03':       { header:'bg-slate-700 text-white',   badge:'bg-slate-200 text-slate-800',   row:'bg-slate-50',    rowAlt:'bg-white',       border:'border-slate-300' },
                'VS-01':      { header:'bg-stone-600 text-white',   badge:'bg-stone-200 text-stone-800',   row:'bg-stone-50',    rowAlt:'bg-white',       border:'border-stone-300' },
                'VT-01':      { header:'bg-blue-700 text-white',    badge:'bg-blue-100 text-blue-800',     row:'bg-blue-50/60',  rowAlt:'bg-blue-50/20',  border:'border-blue-300' },
                'VT-049':     { header:'bg-indigo-700 text-white',  badge:'bg-indigo-100 text-indigo-800', row:'bg-indigo-50/60',rowAlt:'bg-indigo-50/20',border:'border-indigo-300' },
                'VT-064':     { header:'bg-violet-700 text-white',  badge:'bg-violet-100 text-violet-800', row:'bg-violet-50/60',rowAlt:'bg-violet-50/20',border:'border-violet-300' },
                'VA-064':     { header:'bg-purple-700 text-white',  badge:'bg-purple-100 text-purple-800', row:'bg-purple-50/60',rowAlt:'bg-purple-50/20',border:'border-purple-300' },
                'VAG-1.69':   { header:'bg-fuchsia-700 text-white', badge:'bg-fuchsia-100 text-fuchsia-800',row:'bg-fuchsia-50/60',rowAlt:'bg-fuchsia-50/20',border:'border-fuchsia-300' },
                'HAG-1.69':   { header:'bg-pink-700 text-white',    badge:'bg-pink-100 text-pink-800',     row:'bg-pink-50/60',  rowAlt:'bg-pink-50/20',  border:'border-pink-300' },
                'HTG(DC)-064':{ header:'bg-rose-700 text-white',    badge:'bg-rose-100 text-rose-800',     row:'bg-rose-50/60',  rowAlt:'bg-rose-50/20',  border:'border-rose-300' },
                'HTG-064DC':  { header:'bg-rose-700 text-white',    badge:'bg-rose-100 text-rose-800',     row:'bg-rose-50/60',  rowAlt:'bg-rose-50/20',  border:'border-rose-300' },
                'HTG-1.69':   { header:'bg-orange-700 text-white',  badge:'bg-orange-100 text-orange-800', row:'bg-orange-50/60',rowAlt:'bg-orange-50/20',border:'border-orange-300' },
                'HTG-064':    { header:'bg-amber-700 text-white',   badge:'bg-amber-100 text-amber-800',   row:'bg-amber-50/60', rowAlt:'bg-amber-50/20', border:'border-amber-300' },
                'VTI-064':    { header:'bg-yellow-700 text-white',  badge:'bg-yellow-100 text-yellow-800', row:'bg-yellow-50/60',rowAlt:'bg-yellow-50/20',border:'border-yellow-300' },
                'BDCV-1S':    { header:'bg-teal-700 text-white',    badge:'bg-teal-100 text-teal-800',     row:'bg-teal-50/60',  rowAlt:'bg-teal-50/20',  border:'border-teal-300' },
                'BDRV-3S':    { header:'bg-cyan-700 text-white',    badge:'bg-cyan-100 text-cyan-800',     row:'bg-cyan-50/60',  rowAlt:'bg-cyan-50/20',  border:'border-cyan-300' },
              };
              const DEFAULT_COLOR = { header:'bg-gray-600 text-white', badge:'bg-gray-100 text-gray-800', row:'bg-gray-50/60', rowAlt:'bg-white', border:'border-gray-300' };

              // 구조체 키: construction_seq + product_type
              const getGroupKey = (item: any) =>
                `${item.construction_seq ?? 1}__${item.product_type || item.structure || '미지정'}`;

              // 그룹화 (순서 유지)
              const groupOrder: string[] = [];
              const groups: Record<string, any[]> = {};
              for (const item of d.items) {
                const key = getGroupKey(item);
                if (!groups[key]) { groupOrder.push(key); groups[key] = []; }
                groups[key].push(item);
              }

              return (
                <div className="space-y-3">
                  {groupOrder.map(key => {
                    const [cSeq, ptRaw] = key.split('__');
                    const pt = ptRaw || '미지정';
                    const col = STRUCT_COLORS[pt] || DEFAULT_COLOR;
                    const groupItems = groups[key];
                    const groupTotal = groupItems.length;
                    const groupDone = groupItems.filter((it: any) => (actuals[it.swi_id] ?? 0) >= it.planned_qty).length;

                    return (
                      <div key={key} className={cn('rounded-xl border overflow-hidden', col.border)}>
                        {/* 구조체 헤더 행 */}
                        <div className={cn('flex items-center justify-between px-3 py-2', col.header)}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{pt}</span>
                            {parseInt(cSeq) > 1 && (
                              <span className="text-[10px] font-semibold opacity-80 bg-white/20 px-1.5 py-0.5 rounded">
                                {cSeq}차
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs opacity-90">
                            <span>{groupTotal}개</span>
                            {groupDone > 0 && (
                              <span className="bg-white/30 px-1.5 py-0.5 rounded font-semibold">
                                완료 {groupDone}/{groupTotal}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 소켓 항목 테이블 */}
                        <table className="w-full text-xs">
                          <thead className="border-b border-gray-200">
                            <tr className="bg-white/60">
                              <th className="px-3 py-1.5 text-left text-gray-500 w-10">No</th>
                              <th className="px-3 py-1.5 text-center text-gray-500">규격 W×H (mm)</th>
                              <th className="px-3 py-1.5 text-center text-gray-500">인수검사 LOT 번호</th>
                              <th className="px-3 py-1.5 text-center text-gray-500 w-16">지시수량</th>
                              <th className="px-3 py-1.5 text-center text-gray-500 w-20">실적수량</th>
                              <th className="px-3 py-1.5 text-center text-gray-500 w-14">상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {groupItems.map((item: any, idx: number) => {
                              const actual = actuals[item.swi_id] ?? 0;
                              const isDone = actual >= item.planned_qty;
                              return (
                                <tr
                                  key={item.swi_id}
                                  className={cn(
                                    'transition-colors',
                                    idx % 2 === 0 ? col.row : col.rowAlt,
                                    item.is_incomplete && 'opacity-70',
                                  )}
                                >
                                  <td className="px-3 py-1.5 text-gray-400 tabular-nums">{item.seq_no}</td>
                                  <td className="px-3 py-1.5 text-center font-mono font-semibold text-gray-800">
                                    {item.pipe_width_mm && item.pipe_height_mm
                                      ? `${item.pipe_width_mm} × ${item.pipe_height_mm}`
                                      : <span className="text-gray-300 font-normal">미입력</span>}
                                    {item.is_incomplete && (
                                      <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1" />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center font-mono text-xs text-blue-700 font-bold">
                                    {item.insp_lot_no || '미부여'}
                                  </td>
                                  <td className="px-3 py-1.5 text-center font-bold text-gray-700">
                                    {item.planned_qty ?? 1}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      value={actual}
                                      onChange={e => setActuals(prev => ({
                                        ...prev,
                                        [item.swi_id]: parseInt(e.target.value) || 0,
                                      }))}
                                      className="w-14 text-center border rounded px-1 py-0.5 text-xs bg-white"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {isDone
                                      ? <span className="text-green-600 text-[10px] font-semibold bg-green-50 px-1.5 py-0.5 rounded-full">완료</span>
                                      : <span className="text-gray-400 text-[10px]">진행</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">닫기</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
