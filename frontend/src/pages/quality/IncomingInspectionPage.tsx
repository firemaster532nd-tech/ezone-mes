import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, ClipboardCheck, MoreHorizontal, Trash2, FileText, Printer, Info, ChevronDown, ChevronUp, AlertTriangle, Pencil, X, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AttachmentSection } from '@/components/shared/AttachmentSection';

interface Inspection {
  insp_id: number;
  insp_type: string;
  form_code: string | null;
  lot_id: number;
  lot_number: string | null;
  item_name: string | null;
  item_code: string | null;
  item_category: string | null;
  cert_number: string | null;
  result: string | null;
  inspector: string | null;
  inspected_at: string | null;
  sampling_n: number;
  remarks: string | null;
  pr_number: string | null;
}

interface FormPreset {
  form_code: string;
  form_name: string;
  category: string;
  category_label: string;
  material: string;
  spec_ref: string;
  ks_type: 'KS' | 'NON_KS' | 'KS_PROC';
  ks_number: string | null;
  cert_test_required: boolean;
  item_count: number;
}

interface CertDocument {
  cert_doc_id: number;
  supplier_name: string | null;
  supplier_lot: string | null;
  test_institution: string;
  cert_number: string | null;
  issued_date: string;
  expiry_date: string;
  test_items: string | null;
  test_results: string | null;
  is_valid: boolean;
}

interface CertStatus {
  item_id: number;
  item_code: string;
  item_name: string;
  ks_type: string;
  ks_number: string | null;
  needs_cert_doc: boolean;
  has_valid_cert: boolean;
  inspection_ready: boolean;
  warning: string | null;
  valid_cert_documents: CertDocument[];
  cert_stats: { total: number; expired: number; valid: number };
}

interface FormDetail {
  form_code: string;
  form_name: string;
  category?: string;
  item_category?: string;
  material?: string;
  spec_ref?: string;
  file_path?: string | null;
  items: Array<{
    item_no?: number;
    seq_no?: number;
    quality_item: string;
    check_item: string;
    check_method: string;
    cert_standard?: number | string;
    prod_standard?: string;
    unit?: string;
    frequency?: string;
    direction?: string;
    lower_limit?: number | null;
    upper_limit?: number | null;
  }>;
}

const categoryTabs = [
  { key: '', label: '전체' },
  { key: 'RM', label: '원재료 (D101~D104)' },
  { key: 'SM', label: '부자재 (D121~D130)' },
];

const categoryBadge: Record<string, { bg: string; text: string; label: string }> = {
  RM: { bg: 'bg-amber-100', text: 'text-amber-700', label: '원재료' },
  SM: { bg: 'bg-blue-100', text: 'text-blue-700', label: '부자재' },
};

interface PendingReceiving {
  insp_id: number;
  form_code: string | null;
  lot_number: string;
  lot_qty: number;
  supplier_lot: string | null;
  item_name: string;
  item_code: string;
  item_category: string;
  pr_number: string;
  so_number: string | null;
  customer_name: string | null;
}

export function IncomingInspectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<Inspection[]>([]);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSocketCreate, setShowSocketCreate] = useState(false); // ★ 소켓 인수검사
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'PASS' | 'FAIL' } | null>(null);
  const [pendingList, setPendingList] = useState<PendingReceiving[]>([]);
  const [socketPendingList, setSocketPendingList] = useState<any[]>([]);
  // URL 파라미터로 전달받은 주문내역 정보
  const urlPriId = searchParams.get('pri_id');
  const urlFormCode = searchParams.get('form_code');
  const urlItemName = searchParams.get('item_name');
  const urlQty = searchParams.get('qty');
  const urlSpec = searchParams.get('spec');

  const fetchData = () => {
    let params = '?insp_type=INCOMING';
    if (filter) params += `&material_category=${filter}`;
    api.get<{ data: Inspection[] }>(`/inspections${params}`).then((r) => setData(r.data));
  };

  const fetchPending = () => {
    api.get<{ data: PendingReceiving[] }>('/inspections/pending-from-receiving')
      .then((r) => setPendingList(r.data || []))
      .catch(() => setPendingList([]));
  };

  const fetchSocketPending = () => {
    api.get<{ data: any[] }>('/socket-orders/wait')
      .then((r) => {
        const filtered = (r.data || []).filter(
          (item: any) => item.status === 'RECEIVED' || item.status === 'INSPECTING'
        );
        setSocketPendingList(filtered);
      })
      .catch(() => setSocketPendingList([]));
  };

  // URL 파라미터 있을 경우 검사 모달 자동 오픈
  useEffect(() => {
    if (urlPriId || urlFormCode) {
      setShowCreate(true);
    }
  }, [urlPriId, urlFormCode]);

  useEffect(() => { 
    fetchData(); 
    fetchPending(); 
    fetchSocketPending();
  }, [filter]);


  const handleDelete = async (ins: Inspection) => {
    if (!confirm(`검사 INS-${String(ins.insp_id).padStart(4, '0')}을(를) 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/inspections/${ins.insp_id}`);
      fetchData();
    } catch { alert('삭제 실패'); }
    setMenuOpen(null);
  };

  // 원재료/부자재 건수
  const rmCount = data.filter((d) => d.item_category === 'RM').length;
  const smCount = data.filter((d) => d.item_category === 'SM').length;

  return (
    <div>
      <PageHeader title="인수검사" count={data.length} description="원재료(D101~D104) · 부자재(D121~D130) 입고검사 (n=3, c=0)">
        {/* ★ 소켓 인수검사 버튼 (발주서 기반) */}
        <button
          onClick={() => setShowSocketCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> 소켓 인수검사 (발주서)
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 검사 등록
        </button>
      </PageHeader>

      {/* 입고 → 검사대기 배너 */}
      {pendingList.length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-600" />
            <span className="font-semibold text-sm text-orange-800">
              검사대기 {pendingList.length}건
            </span>
            <span className="text-xs text-orange-600">입고등록 후 검사 미진행 자재</span>
          </div>
          <div className="space-y-1.5">
            {pendingList.map((p) => (
              <div key={p.insp_id}
                onClick={() => setShowDetail(p.insp_id)}
                className="flex items-center justify-between bg-white rounded px-3 py-2 border border-orange-100 cursor-pointer hover:bg-orange-50/50 transition"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-gray-400">INS-{String(p.insp_id).padStart(4, '0')}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    p.item_category === 'RM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>{p.item_category}</span>
                  <span className="font-medium">{p.item_name}</span>
                  <span className="text-gray-400 font-mono text-xs">{p.lot_number}</span>
                  {p.supplier_lot && <span className="text-gray-400 text-xs">({p.supplier_lot})</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{p.pr_number}</span>
                  {p.customer_name && <span className="text-gray-400">{p.customer_name}</span>}
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">검사 진행 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 소켓 → 검사대기 배너 */}
      {socketPendingList.length > 0 && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck size={16} className="text-teal-600" />
            <span className="font-semibold text-sm text-teal-800">
              소켓 인수검사 대기/진행 {socketPendingList.length}건
            </span>
            <span className="text-xs text-teal-600">입고완료된 소켓 자재 인수검사 대상</span>
          </div>
          <div className="space-y-1.5">
            {socketPendingList.map((p) => (
              <div key={p.so_id}
                onClick={() => navigate(`/quality/socket-incoming/${p.so_id}`)}
                className="flex items-center justify-between bg-white rounded px-3 py-2 border border-teal-100 cursor-pointer hover:bg-teal-50/50 transition"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-gray-400">SO-{String(p.so_id).padStart(4, '0')}</span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    p.status === 'INSPECTING' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
                  )}>
                    {p.status === 'INSPECTING' ? '검사중' : '검사대기'}
                  </span>
                  <span className="font-medium">{p.project_name || '프로젝트명 없음'}</span>
                  <span className="text-gray-400 text-xs">({p.vendor_name || '공급사 없음'})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>품목 {p.item_count}종</span>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded font-medium">검사 페이지로 이동 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* 카테고리 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => setFilter(filter === 'RM' ? '' : 'RM')}
          className={cn('bg-white rounded-card border p-3 text-left transition-all',
            filter === 'RM' && 'ring-2 ring-amber-400 border-amber-400')}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">원재료</span>
            <span className="text-lg font-bold">{rmCount}</span>
          </div>
          <div className="text-xs text-gray-500">D101 난연컴파운드 · D102 팽창흑연 · D103 EVA · D104 EP100</div>
        </button>
        <button
          onClick={() => setFilter(filter === 'SM' ? '' : 'SM')}
          className={cn('bg-white rounded-card border p-3 text-left transition-all',
            filter === 'SM' && 'ring-2 ring-blue-400 border-blue-400')}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">부자재</span>
            <span className="text-lg font-bold">{smCount}</span>
          </div>
          <div className="text-xs text-gray-500">강재류 · 그라스울 · 세라믹울 · FN테크 슬리브 · 보호철판 등</div>
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 border-b">
        {categoryTabs.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={cn('px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key ? 'border-process-cut text-process-cut' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full min-w-[900px] text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-left font-medium text-gray-500">검사ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">구분</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">양식</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT번호</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">품목</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">발주서</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">판정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">검사자</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">검사일시</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  <ClipboardCheck size={36} strokeWidth={1} className="mx-auto mb-2 text-gray-300" />
                  인수검사 기록이 없습니다.
                </td>
              </tr>
            ) : (
              data.map((ins) => {
                const cat = ins.item_category && categoryBadge[ins.item_category];
                return (
                  <tr key={ins.insp_id} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs">
                      <button
                        onClick={() => setShowDetail(ins.insp_id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        INS-{String(ins.insp_id).padStart(4, '0')}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {cat ? (
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cat.bg, cat.text)}>{cat.label}</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{ins.form_code ?? '-'}</td>
                    <td className="px-3 py-3 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowDetail(ins.insp_id)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {ins.lot_number ?? '-'}
                        </button>
                        {ins.lot_number && (
                          <button
                            title="라벨 출력"
                            onClick={(e) => {
                              e.stopPropagation();
                              const params = new URLSearchParams({
                                lotNumber: ins.lot_number || '',
                                itemName:  ins.item_name || '',
                                itemCode:  ins.item_code || '',
                                spec:      '',
                                qty:       '1',
                                unit:      'EA',
                                lotDate:   ins.inspected_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                                category:  ins.item_category || '',
                                lotType:   'IN',
                              });
                              window.open(
                                `/lot-label.html?${params.toString()}`,
                                '_blank',
                                'width=920,height=760,menubar=no,toolbar=no,scrollbars=yes'
                              );
                            }}
                            className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            🏷️
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setShowDetail(ins.insp_id)}
                        className="text-left hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {ins.item_name ?? '-'}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-gray-500">{ins.pr_number ?? '-'}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge
                        status={ins.result === 'PASS' ? 'PASS' : ins.result === 'FAIL' ? 'FAIL' : 'PENDING'}
                        label={ins.result === 'PASS' ? '합격' : ins.result === 'FAIL' ? '불합격' : '검사중'}
                      />
                    </td>
                    <td className="px-3 py-3">{ins.inspector ?? '-'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {ins.inspected_at ? new Date(ins.inspected_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuOpen === ins.insp_id) { setMenuOpen(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setMenuOpen(ins.insp_id);
                        }}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        <MoreHorizontal size={16} className="text-gray-500" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 드롭다운 메뉴 */}
      {menuOpen !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="fixed z-50 w-36 bg-white border rounded-md shadow-lg py-1"
            style={{ top: menuPos.top, right: menuPos.right }}>
            {(() => {
              const ins = data.find((i) => i.insp_id === menuOpen);
              if (!ins) return null;
              return (
                <>
                  <button onClick={() => { setShowDetail(ins.insp_id); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2">
                    <FileText size={14} /> 상세보기
                  </button>
                  <button onClick={() => { navigate(`/quality/inspection-print/${ins.insp_id}`); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2">
                    <Printer size={14} /> 성적서 인쇄
                  </button>
                  <button onClick={() => {
                    const params = new URLSearchParams({
                      lotNumber: ins.lot_number || '',
                      itemName:  ins.item_name || '',
                      itemCode:  ins.item_code || '',
                      spec:      '',
                      qty:       '1',
                      unit:      'EA',
                      lotDate:   ins.inspected_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                      category:  ins.item_category || '',
                      lotType:   'IN',
                    });
                    window.open(
                      `/lot-label.html?${params.toString()}`,
                      '_blank',
                      'width=920,height=760,menubar=no,toolbar=no,scrollbars=yes'
                    );
                    setMenuOpen(null);
                  }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2">
                    <Printer size={14} /> 라벨 출력
                  </button>
                  <button onClick={() => handleDelete(ins)}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                    <Trash2 size={14} /> 삭제
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 상세보기 모달 */}
      {showDetail !== null && (
        <InspectionDetailModal inspId={showDetail} onClose={() => setShowDetail(null)} onUpdated={fetchData} />
      )}

      {/* ★ 소켓 인수검사 모달 (발주서 기반) */}
      {showSocketCreate && (
        <SocketInspectionModal
          onClose={() => setShowSocketCreate(false)}
          onCreated={() => { setShowSocketCreate(false); fetchData(); }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2',
          toast.type === 'PASS' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'
        )}>
          <span className="font-medium text-shop-sm">
            자동판정 결과: {toast.type === 'PASS' ? '합격' : '불합격'}
          </span>
        </div>
      )}

      {/* 검사 등록 모달 */}
      {showCreate && (
        <CreateInspectionModal
          onClose={() => setShowCreate(false)}
          onCreated={(judgeResult?: string) => {
            setShowCreate(false);
            fetchData();
            if (judgeResult) {
              setToast({ message: judgeResult, type: judgeResult === 'PASS' ? 'PASS' : 'FAIL' });
              setTimeout(() => setToast(null), 3000);
            }
          }}
          initialPriId={urlPriId ? parseInt(urlPriId) : undefined}
          initialFormCode={urlFormCode || undefined}
          initialItemName={urlItemName || undefined}
          initialQty={urlQty || undefined}
          initialSpec={urlSpec || undefined}
        />
      )}
    </div>
  );
}

function InspectionDetailModal({ inspId, onClose, onUpdated }: { inspId: number; onClose: () => void; onUpdated?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editDetails, setEditDetails] = useState<any[]>([]);
  const [editInspector, setEditInspector] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    api.get(`/inspections/${inspId}`).then((r: any) => {
      setData(r.data);
      setEditInspector(r.data.inspector || '');
      setEditRemarks(r.data.remarks || '');
      setEditDetails((r.data.details || []).map((d: any) => ({
        detail_id: d.detail_id,
        measured_n1: d.measured_n1 ?? '',
        measured_n2: d.measured_n2 ?? '',
        measured_n3: d.measured_n3 ?? '',
        is_applicable: d.is_applicable !== false,
      })));
    });
  };

  useEffect(() => { fetchData(); }, [inspId]);

  const startEdit = () => setEditing(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        inspector: editInspector || undefined,
        remarks: editRemarks || undefined,
        details: editDetails.map(d => ({
          detail_id: d.detail_id,
          measured_n1: d.measured_n1 !== '' ? Number(d.measured_n1) : null,
          measured_n2: d.measured_n2 !== '' ? Number(d.measured_n2) : null,
          measured_n3: d.measured_n3 !== '' ? Number(d.measured_n3) : null,
          is_applicable: d.is_applicable,
        })),
      };
      const res = await api.patch(`/inspections/${inspId}/details`, payload);
      setData((res as any).data);
      setEditing(false);
      onUpdated?.();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const updateDetail = (detailId: number, field: string, value: string | boolean) => {
    setEditDetails(prev => prev.map(d =>
      d.detail_id === detailId ? { ...d, [field]: value } : d
    ));
  };

  // n1=n2=n3 동일값 경고 체크
  const checkIdentical = (d: any) => {
    const n1 = d.measured_n1, n2 = d.measured_n2, n3 = d.measured_n3;
    if (n1 !== '' && n2 !== '' && n3 !== '' && n1 === n2 && n2 === n3) return true;
    return false;
  };

  if (!data) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-8">로딩중...</div>
    </div>
  );

  const methodColor: Record<string, string> = {
    '육안': 'bg-green-100 text-green-700',
    '성적서': 'bg-blue-100 text-blue-700',
    '공인기관': 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-auto">
        {/* 헤더: 양식 정보 */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-shop-lg font-bold">
              인수검사 성적서
              {editing && <span className="ml-2 text-sm font-normal text-blue-600">(수정중)</span>}
            </h2>
            <span className={cn(
              'inline-flex items-center rounded-md border px-3 py-1 text-sm font-bold',
              data.result === 'PASS' ? 'bg-green-100 text-green-700 border-green-300' :
              data.result === 'FAIL' ? 'bg-red-100 text-red-700 border-red-300' :
              'bg-yellow-100 text-yellow-700 border-yellow-300'
            )}>
              {data.result === 'PASS' ? '합격' : data.result === 'FAIL' ? '불합격' : '검사중'}
            </span>
          </div>

          {/* 양식 기본정보 */}
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-400">양식번호</span>
              <div className="font-mono font-medium">{data.form_code ?? '-'}</div>
            </div>
            <div>
              <span className="text-gray-400">검사ID</span>
              <div className="font-mono font-medium">INS-{String(data.insp_id).padStart(4, '0')}</div>
            </div>
            <div>
              <span className="text-gray-400">LOT번호</span>
              <div className="font-mono font-medium text-blue-700">{data.lot_number ?? '-'}</div>
            </div>
            <div>
              <span className="text-gray-400">품목</span>
              <div className="font-medium">{data.item_name ?? '-'} <span className="text-gray-400">({data.item_code})</span></div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-xs mt-2">
            <div>
              <span className="text-gray-400">검사조건</span>
              <div className="font-medium">n={data.sampling_n ?? 3}, c={data.accept_c ?? 0}</div>
            </div>
            <div>
              <span className="text-gray-400">검사자</span>
              {editing ? (
                <input type="text" value={editInspector} onChange={(e) => setEditInspector(e.target.value)}
                  className="block w-full rounded border px-2 py-0.5 font-medium" />
              ) : (
                <div className="font-medium">{data.inspector ?? '-'}</div>
              )}
            </div>
            <div>
              <span className="text-gray-400">검사일시</span>
              <div className="font-medium">{data.inspected_at ? new Date(data.inspected_at).toLocaleString('ko-KR') : '-'}</div>
            </div>
            <div>
              <span className="text-gray-400">KS인증</span>
              <div className="font-medium">
                {data.item_ks_number
                  ? <span className="text-blue-700">{data.item_ks_number}</span>
                  : <span className="text-gray-400">해당없음</span>
                }
              </div>
            </div>
          </div>

          {/* 공인시험 성적서 정보 */}
          {data.cert_institution && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs">
              <span className="font-medium text-blue-800">공인시험성적서:</span>
              <span className="ml-2">{data.cert_institution}</span>
              {data.cert_doc_number && <span className="ml-2 font-mono">({data.cert_doc_number})</span>}
              {data.cert_issued_date && <span className="ml-2 text-gray-500">발행: {data.cert_issued_date?.slice(0, 10)}</span>}
              {data.cert_expiry_date && <span className="ml-2 text-gray-500">만료: {data.cert_expiry_date?.slice(0, 10)}</span>}
              {data.cert_is_valid === false && <span className="ml-2 text-red-600 font-bold">만료됨</span>}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* 자동판정 안내 */}
          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-blue-50 border border-blue-200 rounded-md">
            <Info size={14} className="text-blue-600 flex-shrink-0" />
            <span className="text-xs text-blue-700">
              판정은 기준값에 따라 자동 결정됩니다. 측정값을 입력/수정하면 자동 재판정됩니다.
            </span>
            <div className="ml-auto flex items-center gap-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">육안 n=3</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">성적서 n=1</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">공인기관 1회/년</span>
            </div>
          </div>

          {data.details && data.details.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-2 py-2.5 text-left w-8">No</th>
                    <th className="px-2 py-2.5 text-left">품질항목</th>
                    <th className="px-2 py-2.5 text-left">검사항목</th>
                    <th className="px-2 py-2.5 text-center w-16">방법</th>
                    <th className="px-2 py-2.5 text-right w-16">기준</th>
                    <th className="px-2 py-2.5 text-center w-14">단위</th>
                    <th className="px-2 py-2.5 text-right w-20">n1</th>
                    <th className="px-2 py-2.5 text-right w-20">n2</th>
                    <th className="px-2 py-2.5 text-right w-20">n3</th>
                    <th className="px-2 py-2.5 text-center w-14">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.map((d: any, idx: number) => {
                    const ed = editDetails.find((e: any) => e.detail_id === d.detail_id);
                    const isVisual = d.check_method === '육안';
                    const isCert = d.check_method === '성적서' || d.check_method === '공인기관';
                    const mColor = methodColor[d.check_method] || 'bg-gray-100 text-gray-600';
                    const identicalWarn = editing && ed && !isVisual && !isCert && checkIdentical(ed);

                    return (
                      <tr key={d.detail_id} className={cn('border-b', identicalWarn && 'bg-red-50')}>
                        <td className="px-2 py-2">{d.item_no}</td>
                        <td className="px-2 py-2 font-medium">{d.quality_item}</td>
                        <td className="px-2 py-2">{d.check_item}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', mColor)}>
                            {d.check_method}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-medium">
                          {d.cert_standard != null ? `${d.direction === 'MAX' ? '≤' : '≥'}${d.cert_standard}` : '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-gray-400">{d.unit || '-'}</td>

                        {/* n1/n2/n3 */}
                        {editing && ed ? (
                          <>
                            {[1, 2, 3].map(n => {
                              const field = `measured_n${n}`;
                              // 성적서/공인기관은 n1만 입력
                              if (isCert && n > 1) return <td key={n} className="px-2 py-2 text-center text-gray-300">-</td>;
                              return (
                                <td key={n} className="px-1 py-1">
                                  {isVisual ? (
                                    <select value={ed[field]} onChange={(e) => updateDetail(d.detail_id, field, e.target.value)}
                                      className="w-full rounded border px-1 py-1 text-xs text-center">
                                      <option value="">-</option>
                                      <option value="1">OK</option>
                                      <option value="0">NG</option>
                                    </select>
                                  ) : (
                                    <input type="number" step="any" value={ed[field]}
                                      onChange={(e) => updateDetail(d.detail_id, field, e.target.value)}
                                      className="w-full rounded border px-1.5 py-1 text-xs text-right font-mono"
                                      placeholder="-" />
                                  )}
                                </td>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-right font-mono">
                              {isVisual ? (d.measured_n1 != null ? (Number(d.measured_n1) === 1 ? 'OK' : 'NG') : '-') : (d.measured_n1 ?? '-')}
                            </td>
                            <td className="px-2 py-2 text-right font-mono">
                              {isCert ? '-' : isVisual ? (d.measured_n2 != null ? (Number(d.measured_n2) === 1 ? 'OK' : 'NG') : '-') : (d.measured_n2 ?? '-')}
                            </td>
                            <td className="px-2 py-2 text-right font-mono">
                              {isCert ? '-' : isVisual ? (d.measured_n3 != null ? (Number(d.measured_n3) === 1 ? 'OK' : 'NG') : '-') : (d.measured_n3 ?? '-')}
                            </td>
                          </>
                        )}

                        <td className="px-2 py-2 text-center">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                            d.item_result === 'PASS' ? 'bg-green-100 text-green-700' :
                            d.item_result === 'FAIL' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                          )}>{d.item_result === 'PASS' ? '합격' : d.item_result === 'FAIL' ? '불합격' : '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">측정 상세가 없습니다.</p>
          )}

          {/* n1=n2=n3 동일값 경고 */}
          {editing && editDetails.some(ed => {
            const d = data.details?.find((dd: any) => dd.detail_id === ed.detail_id);
            return d && d.check_method !== '육안' && d.check_method !== '성적서' && d.check_method !== '공인기관' && checkIdentical(ed);
          }) && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              <AlertTriangle size={12} className="inline mr-1" />
              n1, n2, n3 값이 모두 동일한 항목이 있습니다. 독립 측정값인지 확인하세요. (C-701 Rev.5 7.3.4항)
            </div>
          )}

          {/* 비고 */}
          <div className="mt-4">
            <label className="text-xs font-medium text-gray-500">비고</label>
            {editing ? (
              <textarea value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)}
                className="block w-full rounded border px-3 py-2 text-xs mt-1" rows={2}
                placeholder="비고란(성적서 정보): 기관명, 발행일, 주요 시험결과 수치 기재" />
            ) : (
              <div className="text-xs mt-1 text-gray-700">{data.remarks || '-'}</div>
            )}
          </div>

          {/* Attachment section */}
          <AttachmentSection refType="INSPECTION" refId={inspId} />
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t flex items-center">
          {!editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700">
              <Pencil size={14} /> 입력
            </button>
          )}
          <div className="flex-1" />
          {editing ? (
            <div className="flex gap-3">
              <button onClick={() => { setEditing(false); fetchData(); }}
                className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장 (자동 재판정)'}
              </button>
            </div>
          ) : (
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">닫기</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 라벨 수량 입력 + 출력 버튼 컴포넌트 (React state 기반) ──
function LabelQtyButton({
  defaultQty, unit, onPrint,
}: {
  defaultQty: number;
  unit: string;
  onPrint: (qty: number) => void;
}) {
  const [labelQty, setLabelQty] = useState(defaultQty);
  return (
    <div className="space-y-2">
      {/* 수량 조절 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 whitespace-nowrap font-semibold">라벨 수량</span>
        <button
          onClick={() => setLabelQty(q => Math.max(1, q - 1))}
          className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
        >−</button>
        <input
          type="number"
          min={1} max={9999}
          value={labelQty}
          onChange={e => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 border-2 border-blue-300 rounded-lg px-2 py-1.5 text-base font-bold text-center text-blue-700 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setLabelQty(q => Math.min(9999, q + 1))}
          className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-lg flex items-center justify-center"
        >+</button>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      {/* 빠른 선택 */}
      <div className="flex gap-1.5 flex-wrap">
        {[1, 5, 10, 20, 50].map(n => (
          <button key={n} onClick={() => setLabelQty(n)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
              labelQty === n
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            )}>{n}장</button>
        ))}
        <button onClick={() => setLabelQty(defaultQty)}
          className="px-3 py-1 rounded-lg text-xs font-bold border border-blue-200 text-blue-600 hover:bg-blue-50">
          입고수량({defaultQty})
        </button>
      </div>
      {/* 출력 버튼 */}
      <button
        onClick={() => onPrint(labelQty)}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        🖨️ QR 라벨 {labelQty}장 출력 (Godex ZA120U)
      </button>
    </div>
  );
}

function CreateInspectionModal({
  onClose, onCreated,
  initialPriId, initialFormCode, initialItemName, initialQty, initialSpec
}: {
  onClose: () => void;
  onCreated: (judgeResult?: string) => void;
  initialPriId?: number;
  initialFormCode?: string;
  initialItemName?: string;
  initialQty?: string;
  initialSpec?: string;
}) {
  const [presets, setPresets] = useState<FormPreset[]>([]);
  const [items, setItems] = useState<Array<{ item_id: number; item_code: string; item_name: string; item_category: string; unit: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<'RM' | 'SM'>('SM');
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [qty, setQty] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [inspector, setInspector] = useState('');
  const [inspDate, setInspDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDetail, setFormDetail] = useState<FormDetail | null>(null);
  const [measurements, setMeasurements] = useState<Array<{
    item_no: number; quality_item: string; check_item: string; check_method: string;
    cert_standard: string; unit: string; frequency: string;
    n1: string; n2: string; n3: string; is_applicable: boolean;
    direction?: string;
  }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ pass: boolean; lot_number: string; inventory_created: boolean } | null>(null);

  // 스펙 치수 (SM 자재용: T/W/L/밀도)
  const [specThickness, setSpecThickness] = useState('');
  const [specWidth, setSpecWidth] = useState('');
  const [specLength, setSpecLength] = useState('');
  const [specDensity, setSpecDensity] = useState('');

  // 울(Wool)류 판단: 그라스울, 세라믹울 = 밀도 필드 있음
  const selectedItemObj = items.find(i => String(i.item_id) === selectedItem);
  const isWoolType = !!(selectedItemObj && (
    selectedItemObj.item_name.includes('그라스울') ||
    selectedItemObj.item_name.includes('세라믹울') ||
    selectedItemObj.item_name.includes('세라믹') ||
    selectedItemObj.item_name.toUpperCase().includes('GLASSWOOL') ||
    selectedItemObj.item_name.toUpperCase().includes('CERAMIC')
  ));
  // 전체 길이 자동 계산 (mm)
  const totalLengthMm = (specLength && qty && parseFloat(specLength) > 0 && parseFloat(qty) > 0)
    ? Math.round(parseFloat(specLength) * parseFloat(qty))
    : null;


  // LOT 검증 상태
  const [lotNumber, setLotNumber] = useState('');
  const [lotValidation, setLotValidation] = useState<{
    valid: boolean;
    warnings: Array<{ code: string; message: string; severity: 'error' | 'warning' }>;
    suggestion?: string;
  } | null>(null);
  const [lotValidating, setLotValidating] = useState(false);
  const [lotWarningDismissed, setLotWarningDismissed] = useState(false);
  const lotValidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 샘플링 모드 상태
  const [samplingMode, setSamplingMode] = useState<{ mode: string; n: number; c: number; description: string } | null>(null);

  // 검사 기준 안내 토글
  const [showStandards, setShowStandards] = useState(false);

  // n1/n2/n3 동일값 경고 상태 (항목별)
  const [identicalWarnings, setIdenticalWarnings] = useState<Record<number, boolean>>({});

  // KS/공인성적서 상태
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);
  const [selectedCertDocId, setSelectedCertDocId] = useState<number | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  //  탭: 'GENERAL'(입고검사) | 'CERT'(공인시험)
  const [inspectionTab, setInspectionTab] = useState<'GENERAL' | 'CERT'>('GENERAL');

  // 공인시험 항목 비고 (check_method='CERT' 항목의 측정값 저장)
  const [certMeasurements, setCertMeasurements] = useState<Array<{
    item_no: number; quality_item: string; check_item: string; check_method: string;
    cert_standard: string; prod_standard: string; unit: string;
    n1: string; is_applicable: boolean; direction?: string;
  }>>([]);

  useEffect(() => {
    api.get<{ data: FormPreset[] }>('/inspections/incoming-presets').then((r) => setPresets(r.data));
    api.get<{ data: any[] }>('/items').then((r) => setItems(r.data));
  }, []);

  // URL 파라미터 초기값 적용 (아이템 목록 로드 후)
  useEffect(() => {
    if (items.length === 0) return;
    if (initialFormCode) {
      setSelectedForm(initialFormCode);
      // 카테고리 자동 설정
      if (initialFormCode.startsWith('D10')) setSelectedCategory('RM');
      else setSelectedCategory('SM');
      // 양식 상세 로드
      api.get<{ data: FormDetail }>(`/inspections/incoming-presets/${initialFormCode}`)
        .then((r) => {
          setFormDetail(r.data);
          setMeasurements(
            r.data.items.map((item: any) => ({
              item_no: item.item_no, quality_item: item.quality_item, check_item: item.check_item,
              check_method: item.check_method, cert_standard: item.cert_standard?.toString() ?? '',
              direction: item.direction || 'MIN',
              unit: item.unit, frequency: item.frequency,
              n1: '', n2: '', n3: '', is_applicable: true,
            }))
          );
        })
        .catch(() => {});
    }
    if (initialItemName) {
      // 품목명으로 item_id 매칭
      const matched = items.find(i =>
        i.item_name.includes(initialItemName) || initialItemName.includes(i.item_name)
      );
      if (matched) setSelectedItem(String(matched.item_id));
    }
    if (initialQty) setQty(initialQty);
  }, [items.length, initialFormCode, initialItemName, initialQty]);

  // DB 기반(신규): item_category 필드 / 하드코딩(기존): category 필드 지원
  const filteredPresets = presets.filter((p: any) =>
    (p.category ?? p.item_category) === selectedCategory ||
    (selectedCategory === 'SM' && ['SK','BR','FL','CW','GW'].includes(p.item_category ?? ''))
  );

  const filteredItems = items.filter((i) => i.item_category === selectedCategory);
  const isRM = selectedCategory === 'RM';

  // LOT 번호 검증 (디바운스 500ms)
  const validateLot = useCallback((lotNum: string) => {
    if (lotValidateTimer.current) clearTimeout(lotValidateTimer.current);
    setLotWarningDismissed(false);

    if (!lotNum.trim()) {
      setLotValidation(null);
      return;
    }

    setLotValidating(true);
    lotValidateTimer.current = setTimeout(async () => {
      try {
        const res = await api.post<{
          valid: boolean;
          warnings: Array<{ code: string; message: string; severity: 'error' | 'warning' }>;
          suggestion?: string;
        }>('/lots/validate', {
          item_id: selectedItem ? parseInt(selectedItem) : 0,
          lot_number: lotNum,
          supplier_lot: supplierLot || undefined,
          lot_date: inspDate,
        });
        setLotValidation(res);
      } catch {
        setLotValidation(null);
      } finally {
        setLotValidating(false);
      }
    }, 500);
  }, [selectedItem, supplierLot, inspDate]);

  // LOT 자동생성 (C302 Rev.8 형식: YYMMDD[약호]NNN)
  const handleAutoLot = async () => {
    try {
      const itemParam = selectedItem ? `&item_id=${selectedItem}` : '';
      const res = await api.get<{ next_number: string; format_guide?: any }>(
        `/lots/next-number?date=${inspDate}${itemParam}`
      );
      if (res.next_number) {
        setLotNumber(res.next_number);
        validateLot(res.next_number);
      }
    } catch {
      alert('LOT 번호 자동생성 실패\n(C302 형식: YYMMDD[약호]NNN, 예: 260203CW001)');
    }
  };

  // 검사 기준 안내 내용 결정 (품목 카테고리 기반)
  const getStandardsInfo = () => {
    const formCode = selectedForm || '';
    const standards: { label: string; ref: string }[] = [];

    if (formCode.startsWith('D121') || formCode.startsWith('D129')) {
      standards.push({ label: '원재료 강재류', ref: '사규 EZC-D-121 (강재류 rev3) / EZC-D-126 (SUS304 rev0)' });
    }
    if (formCode.startsWith('D122')) {
      standards.push({ label: '그라스울', ref: '사규 EZC-D-122 (그라스울 rev1), KS L 9102' });
    }
    if (formCode.startsWith('D124')) {
      standards.push({ label: '세라믹울', ref: '사규 EZC-D-124 (세라믹울 rev4)' });
    }
    if (formCode.startsWith('D126')) {
      standards.push({ label: 'SUS304 강재', ref: '사규 EZC-D-126 (강재류 SUS304 rev0)' });
    }
    if (standards.length === 0) {
      standards.push({ label: '해당 품목', ref: formDetail?.spec_ref || '사규 참조' });
    }
    return standards;
  };

  const handleCategoryChange = (cat: 'RM' | 'SM') => {
    setSelectedCategory(cat);
    setSelectedForm(''); setFormDetail(null); setMeasurements([]);
    setSelectedItem(''); setQty(''); setSupplierLot('');
    setLotNumber(''); setLotValidation(null); setSamplingMode(null);
    setCertStatus(null); setSelectedCertDocId(null);
  };

  // 품목 선택 시 KS/공인성적서 상태 조회
  const fetchCertStatus = async (itemId: string) => {
    if (!itemId) { setCertStatus(null); setSelectedCertDocId(null); return; }
    setCertLoading(true);
    try {
      const res = await api.get<{ data: CertStatus }>(`/inspections/cert-status/${itemId}`);
      setCertStatus(res.data);
      // 유효한 성적서가 1개면 자동 선택
      if (res.data.valid_cert_documents.length === 1) {
        setSelectedCertDocId(res.data.valid_cert_documents[0].cert_doc_id);
      } else {
        setSelectedCertDocId(null);
      }
    } catch {
      setCertStatus(null);
    } finally {
      setCertLoading(false);
    }
  };

  const handleItemChange = (itemId: string) => {
    setSelectedItem(itemId);
    fetchCertStatus(itemId);
  };

  const handleFormChange = async (formCode: string) => {
    setSelectedForm(formCode);
    setInspectionTab('GENERAL');
    if (!formCode) { setFormDetail(null); setMeasurements([]); setCertMeasurements([]); return; }
    const res = await api.get<{ data: FormDetail }>(`/inspections/incoming-presets/${formCode}`);
    setFormDetail(res.data);

    // DB 기반 항목(어노테이션에 check_method='VISUAL'/'MEASURE'/'CERT')
    // 기존 하드코딩(어노테이션에 check_method='육안'/'성적서'/'공인기관') 모두 지원
    const isCertMethod = (m: string) =>
      m === 'CERT' || m === '성적서' || m === '공인기관';

    const allItems = res.data.items;
    const generalItems = allItems.filter(item => !isCertMethod(item.check_method));
    const certItems = allItems.filter(item => isCertMethod(item.check_method));

    setMeasurements(
      generalItems.map((item, idx) => ({
        item_no: item.item_no ?? item.seq_no ?? idx + 1,
        quality_item: item.quality_item,
        check_item: item.check_item,
        check_method: item.check_method,
        cert_standard: item.cert_standard?.toString() ?? '',
        direction: item.direction || 'MIN',
        unit: item.unit ?? '',
        frequency: item.frequency ?? '매로트',
        n1: '', n2: '', n3: '', is_applicable: true,
      }))
    );

    setCertMeasurements(
      certItems.map((item, idx) => ({
        item_no: item.item_no ?? item.seq_no ?? idx + 1,
        quality_item: item.quality_item,
        check_item: item.check_item,
        check_method: item.check_method,
        cert_standard: item.cert_standard?.toString() ?? '',
        prod_standard: item.prod_standard ?? '',
        unit: item.unit ?? '',
        direction: item.direction || 'MIN',
        n1: '', is_applicable: true,
      }))
    );
    setIdenticalWarnings({});
  };

  const updateMeasurement = (idx: number, field: string, value: string | boolean) => {
    setMeasurements((prev) => {
      const updated = prev.map((m, i) => i === idx ? { ...m, [field]: value } : m);
      // Task 3: n1/n2/n3 동일값 경고 체크
      const m = updated[idx];
      if (field === 'n1' || field === 'n2' || field === 'n3') {
        const n1 = m.n1.trim();
        const n2 = m.n2.trim();
        const n3 = m.n3.trim();
        if (n1 && n2 && n3 && n1 === n2 && n2 === n3) {
          setIdenticalWarnings((prev) => ({ ...prev, [m.item_no]: true }));
        } else {
          setIdenticalWarnings((prev) => ({ ...prev, [m.item_no]: false }));
        }
      }
      return updated;
    });
  };

  const [autoJudgeResult, setAutoJudgeResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedForm) return alert('검사양식을 선택하세요');
    if (!selectedItem) return alert('품목을 선택하세요');
    if (!qty || parseFloat(qty) <= 0) return alert('입고수량을 입력하세요');
    if (isRM && !supplierLot) return alert('원재료는 공급업체 LOT/COA 번호가 필수입니다');
    // LOT 검증 에러가 있으면 제출 차단
    if (lotValidation && lotValidation.warnings.some(w => w.severity === 'error')) {
      return alert('LOT 번호 오류를 먼저 수정하세요.');
    }
    // NON_KS 공인성적서 미선택 경고
    if (certStatus && certStatus.needs_cert_doc && !certStatus.has_valid_cert) {
      if (!confirm('유효한 공인시험성적서가 없습니다. 검사를 계속 진행하시겠습니까?\n(비규격 제품은 공인성적서가 필수입니다)')) return;
    } else if (certStatus && certStatus.needs_cert_doc && !selectedCertDocId) {
      if (!confirm('공인시험성적서를 선택하지 않았습니다. 검사를 계속 진행하시겠습니까?')) return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: any }>('/inspections', {
        insp_type: 'INCOMING',
        form_code: selectedForm,
        item_id: parseInt(selectedItem),
        qty: parseFloat(qty),
        supplier_lot: supplierLot || null,
        inspector: inspector || null,
        insp_date: inspDate,
        cert_doc_id: selectedCertDocId || null,
        // SM 자재 스펙 치수
        spec_thickness_mm: specThickness ? parseFloat(specThickness) : null,
        spec_width_mm: specWidth ? parseFloat(specWidth) : null,
        spec_length_mm: specLength ? parseFloat(specLength) : null,
        spec_density: specDensity || null,
        details: [
          // 일반 검사항목
          ...measurements.map((m) => ({
            item_no: m.item_no,
            quality_item: m.quality_item,
            check_item: m.check_item,
            check_method: m.check_method,
            cert_standard: m.cert_standard ? parseFloat(m.cert_standard) : null,
            direction: m.direction || 'MIN',
            is_applicable: m.is_applicable,
            measured_n1: m.n1 ? parseFloat(m.n1) : null,
            measured_n2: m.n2 ? parseFloat(m.n2) : null,
            measured_n3: m.n3 ? parseFloat(m.n3) : null,
          })),
          // 공인시험 항목 (n1만 사용 — 성적서 기재값)
          ...certMeasurements.map((m) => ({
            item_no: m.item_no,
            quality_item: m.quality_item,
            check_item: m.check_item,
            check_method: m.check_method,
            cert_standard: m.cert_standard ? parseFloat(m.cert_standard) : null,
            direction: m.direction || 'MIN',
            is_applicable: m.is_applicable,
            measured_n1: m.n1 ? parseFloat(m.n1) : null,
            measured_n2: null,
            measured_n3: null,
          })),
        ],
      });


      // Call auto-judge after saving
      let finalResult = res.data.result;
      const inspId = res.data.insp_id;
      if (inspId) {
        try {
          const judgeRes = await api.post<{ data: any }>(`/inspections/${inspId}/auto-judge`, {});
          finalResult = judgeRes.data?.result ?? res.data.result;
          setAutoJudgeResult(finalResult);
        } catch {
          // Fall back to the original result if auto-judge fails
        }
      }

      setResult({
        pass: finalResult === 'PASS',
        lot_number: res.data.lot?.lot_number ?? '',
        inventory_created: res.data.inventory_created ?? false,
      });
    } catch { alert('검사 등록 실패'); }
    finally { setSubmitting(false); }
  };

  // LOT 검증 결과 분류
  const lotErrors = lotValidation?.warnings.filter(w => w.severity === 'error') ?? [];
  const lotWarnings = lotValidation?.warnings.filter(w => w.severity === 'warning') ?? [];
  const hasLotError = lotErrors.length > 0;
  const hasLotWarning = lotWarnings.length > 0 && !lotWarningDismissed;

  // 샘플링 모드에 따라 n2/n3 표시 여부 결정
  const showN2N3 = !samplingMode || samplingMode.mode !== 'FULL';

  // ── 결과 화면 (인수검사 완료 후) ───────────────────────────
  if (result) {
    const itemObj   = items.find(i => String(i.item_id) === selectedItem);
    const thickness = specThickness || (itemObj?.item_name.match(/(\d+\.?\d*)T/)?.[1] ?? '');
    // 규격 문자열 조합
    const specStr = [
      specThickness ? `${specThickness}T` : '',
      specWidth     ? `${specWidth}mm`     : '',
      specLength    ? `× ${specLength}mm`  : '',
      specDensity   ? `${specDensity}kg/m³` : '',
    ].filter(Boolean).join(' × ').replace(' × ×', ' ×');

    // 라벨 팝업 오픈
    const openLabel = (labelQty: number) => {
      const params = new URLSearchParams({
        lotNumber: result.lot_number,
        itemName:  itemObj?.item_name ?? '',
        itemCode:  itemObj?.item_code ?? '',
        spec:      specStr,
        qty:       String(labelQty),
        unit:      itemObj?.unit ?? 'EA',
        lotDate:   inspDate,
        category:  selectedCategory,
        thickness: thickness,
        lotType:   'IN',
      });
      window.open(
        `/lot-label.html?${params.toString()}`,
        '_blank',
        'width=920,height=760,menubar=no,toolbar=no,scrollbars=yes'
      );
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">

          {/* 판정 결과 헤더 */}
          <div className={cn('rounded-t-2xl px-6 py-5 text-center',
            result.pass ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200')}>
            <div className={cn('w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3',
              result.pass ? 'bg-green-100' : 'bg-red-100')}>
              <ClipboardCheck size={28} className={result.pass ? 'text-green-600' : 'text-red-600'} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              인수검사 {result.pass ? '✅ 합격' : '❌ 불합격'}
            </h3>
            {result.pass
              ? <p className="text-xs text-green-600 mt-1">재고 자동 입고 완료</p>
              : <p className="text-xs text-red-600 mt-1">재고 미반영 — 반품 또는 재검사 진행</p>
            }
          </div>

          {/* LOT 정보 미리보기 */}
          <div className="px-6 py-4 space-y-2 border-b">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">라벨 출력 정보</p>
            {/* 로트번호 */}
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-blue-400 w-12">로트번호</span>
              <span className="font-mono font-bold text-blue-700 text-sm flex-1">{result.lot_number}</span>
            </div>
            {/* 품목명 */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-gray-400 w-12">품목명</span>
              <span className="font-semibold text-gray-800 text-sm flex-1">{itemObj?.item_name || '-'}</span>
            </div>
            {/* 규격 */}
            {specStr && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-gray-400 w-12">규격</span>
                <span className="text-gray-700 text-sm flex-1">{specStr}</span>
                {thickness && (
                  <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">
                    {thickness}T
                  </span>
                )}
              </div>
            )}
            {supplierLot && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-gray-400 w-12">공급LOT</span>
                <span className="font-mono text-gray-600 text-xs flex-1">{supplierLot}</span>
              </div>
            )}
          </div>

          {/* 라벨 수량 지정 + 출력 */}
          <div className="px-6 py-4 space-y-3 border-b">
            <p className="text-xs font-bold text-gray-700">🏷️ Godex ZA120U 라벨 출력 (80×60mm)</p>
            <p className="text-xs text-gray-500">
              라벨 수량을 지정하세요. 수량만큼 개별 QR 라벨이 생성됩니다.<br/>
              각 라벨에 <strong>로트번호 · 품목명 · 규격</strong>이 인쇄됩니다.
            </p>

            {/* 수량 입력 — React state */}
            <LabelQtyButton
              defaultQty={Math.ceil(parseFloat(qty) || 1)}
              unit={itemObj?.unit || 'EA'}
              onPrint={openLabel}
            />
          </div>

          {/* 확인 버튼 */}
          <div className="px-6 py-4">
            <button
              onClick={() => onCreated(autoJudgeResult ?? (result.pass ? 'PASS' : 'FAIL'))}
              className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-medium"
            >
              확인 (닫기)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b">
          <h2 className="text-shop-lg font-bold">인수검사 등록</h2>
          <p className="text-shop-sm text-gray-500">인수검사 → 합격 시 재고 자동 입고 (n=3, c=0)</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Step 1: 원재료/부자재 선택 */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">검사 구분</label>
            <div className="flex gap-2">
              <button onClick={() => handleCategoryChange('RM')}
                className={cn('flex-1 px-4 py-3 rounded-md border text-shop-sm font-medium text-left',
                  selectedCategory === 'RM' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'text-gray-500 hover:bg-gray-50')}>
                <div className="font-bold">원재료 검사</div>
                <div className="text-xs mt-0.5">D101~D104 · 배합원료 4종</div>
              </button>
              <button onClick={() => handleCategoryChange('SM')}
                className={cn('flex-1 px-4 py-3 rounded-md border text-shop-sm font-medium text-left',
                  selectedCategory === 'SM' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'text-gray-500 hover:bg-gray-50')}>
                <div className="font-bold">부자재 검사</div>
                <div className="text-xs mt-0.5">D121~D130 · 강재류/그라스울/세라믹울/FN테크 등</div>
              </button>
            </div>
          </div>

          {/* Step 2: 양식 선택 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">검사양식 <span className="text-red-500">*</span></label>
            <select value={selectedForm} onChange={(e) => handleFormChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-shop-sm">
              <option value="">선택</option>
              {filteredPresets.map((p) => (
                <option key={p.form_code} value={p.form_code}>
                  {p.form_code} - {p.material} ({p.item_count}항목) {p.ks_type === 'KS' ? `[KS ${p.ks_number || ''}]` : '[비규격]'}
                </option>
              ))}
            </select>
          </div>

          {/* 양식 정보 배너 + KS 배지 */}
          {formDetail && (() => {
            const preset = presets.find(p => p.form_code === selectedForm);
            const ksType = preset?.ks_type || 'NON_KS';
            return (
              <div className={cn('px-4 py-3 rounded-md text-shop-sm',
                isRM ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200')}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formDetail.form_name}</span>
                  {ksType === 'KS' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-300">
                      KS {preset?.ks_number || ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                      NON-KS (공인성적서 필수)
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {formDetail.material} · {formDetail.spec_ref} · {formDetail.items.length}개 검사항목
                </div>
              </div>
            );
          })()}

          {/* KS/공인성적서 확인 패널 */}
          {selectedItem && certStatus && (
            <div className={cn('rounded-md border p-4 space-y-2',
              certStatus.inspection_ready
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200')}>
              <div className="flex items-center gap-2">
                {certStatus.inspection_ready ? (
                  <ClipboardCheck size={16} className="text-green-600" />
                ) : (
                  <AlertTriangle size={16} className="text-red-600" />
                )}
                <span className={cn('text-sm font-medium',
                  certStatus.inspection_ready ? 'text-green-700' : 'text-red-700')}>
                  {certStatus.ks_type === 'KS'
                    ? `KS 인증 제품 (${certStatus.ks_number}) - 제조사 성적서 대체 가능`
                    : certStatus.has_valid_cert
                      ? `비규격 제품 - 유효 공인성적서 ${certStatus.cert_stats.valid}건 보유`
                      : '비규격 제품 - 유효한 공인시험성적서 없음'}
                </span>
              </div>

              {/* 공인성적서 선택 (NON_KS인 경우) */}
              {certStatus.needs_cert_doc && certStatus.valid_cert_documents.length > 0 && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">공인시험성적서 선택</label>
                  <select
                    value={selectedCertDocId || ''}
                    onChange={(e) => setSelectedCertDocId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full border rounded px-3 py-2 text-shop-sm bg-white"
                  >
                    <option value="">선택하세요</option>
                    {certStatus.valid_cert_documents.map((doc) => (
                      <option key={doc.cert_doc_id} value={doc.cert_doc_id}>
                        {doc.test_institution} ({doc.cert_number || '번호없음'}) - 만료: {doc.expiry_date} {doc.supplier_name ? `[${doc.supplier_name}]` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedCertDocId && (() => {
                    const doc = certStatus.valid_cert_documents.find(d => d.cert_doc_id === selectedCertDocId);
                    return doc ? (
                      <div className="mt-1.5 text-xs text-gray-600 bg-white rounded p-2 border">
                        <div><strong>시험기관:</strong> {doc.test_institution}</div>
                        <div><strong>시험항목:</strong> {doc.test_items || '-'}</div>
                        <div><strong>시험결과:</strong> {doc.test_results || '-'}</div>
                        <div><strong>유효기간:</strong> {doc.issued_date} ~ {doc.expiry_date}</div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* 경고: 유효 성적서 없음 */}
              {certStatus.warning && (
                <div className="text-xs text-red-600 font-medium mt-1">
                  {certStatus.warning}
                </div>
              )}

              {/* 성적서 통계 */}
              {certStatus.needs_cert_doc && (
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>전체: {certStatus.cert_stats.total}건</span>
                  <span className="text-green-600">유효: {certStatus.cert_stats.valid}건</span>
                  <span className="text-red-500">만료: {certStatus.cert_stats.expired}건</span>
                </div>
              )}
            </div>
          )}
          {selectedItem && certLoading && (
            <div className="text-xs text-gray-400 animate-pulse">공인성적서 현황 조회 중...</div>
          )}

          {/* Task 2c: 검사 기준 안내 (접이식 패널) */}
          {formDetail && (
            <div className="border border-blue-200 rounded-md overflow-hidden">
              <button
                onClick={() => setShowStandards(!showStandards)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 text-shop-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText size={14} />
                  검사 기준 안내 (사규 참조)
                </span>
                {showStandards ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showStandards && (
                <div className="px-4 py-3 bg-blue-50/50 border-t border-blue-200 space-y-3">
                  {/* 적용 사규 */}
                  <div>
                    <div className="text-xs font-medium text-blue-800 mb-1">적용 사규</div>
                    {getStandardsInfo().map((s, i) => (
                      <div key={i} className="text-xs text-blue-700">
                        {s.label}: {s.ref}
                      </div>
                    ))}
                  </div>
                  {/* 공통 규칙 */}
                  <div>
                    <div className="text-xs font-medium text-blue-800 mb-1">공통 검사 규칙</div>
                    <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
                      <li>실측항목: n=3, c=0 (3개 시료, 불합격 허용 0)</li>
                      <li>성적서 대체: n=1, c=0 (제조사/공인기관 성적서 1건)</li>
                      <li>공인기관 의뢰: 1회/년</li>
                      <li>n1, n2, n3는 동일 LOT 내 랜덤 3개 시료의 독립 측정값</li>
                      <li className="text-amber-700 font-medium">세 값이 모두 동일하면 부적합 의심 대상</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 검사 대상 정보 (품목/수량/LOT) */}
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="text-xs font-medium text-gray-700 mb-1">검사 대상 정보</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">품목 <span className="text-red-500">*</span></label>
                <select value={selectedItem} onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-shop-sm bg-white">
                  <option value="">선택</option>
                  {filteredItems.map((i) => (
                    <option key={i.item_id} value={i.item_id}>{i.item_code} - {i.item_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">입고수량 <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)}
                  placeholder="수량 입력" className="w-full border rounded px-3 py-2 text-shop-sm bg-white" />
              </div>
            </div>

            {/* SM 부자재 전용: 규격 치수 입력 (T/W/L, 울류는 밀도 추가) */}
            {!isRM && (
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-blue-700">규격 치수</span>
                  {isWoolType && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                      🌀 울류 — 밀도 포함 · 총 길이 자동 계산
                    </span>
                  )}
                </div>
                <div className={`grid gap-2 ${isWoolType ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {/* 밀도 — 울류만 */}
                  {isWoolType && (
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">밀도 (kg/m³)</label>
                      <input type="text" value={specDensity} onChange={e => setSpecDensity(e.target.value)}
                        placeholder="예: 24K, 96K"
                        className="w-full border rounded px-2 py-1.5 text-xs bg-white" />
                    </div>
                  )}
                  {/* T (두께) */}
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">T · 두께 (mm)</label>
                    <input type="number" step="0.1" value={specThickness} onChange={e => setSpecThickness(e.target.value)}
                      placeholder="예: 25"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-white font-mono" />
                  </div>
                  {/* W (폭) */}
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">W · 폭 (mm)</label>
                    <input type="number" step="1" value={specWidth} onChange={e => setSpecWidth(e.target.value)}
                      placeholder="예: 600"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-white font-mono" />
                  </div>
                  {/* L (길이) */}
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">L · 길이 (mm)</label>
                    <input type="number" step="1" value={specLength} onChange={e => setSpecLength(e.target.value)}
                      placeholder="예: 10000"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-white font-mono" />
                  </div>
                </div>
                {/* 총 길이 자동 계산 표시 */}
                {totalLengthMm !== null && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">총 길이:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                      {qty} EA × {Number(specLength).toLocaleString()}mm
                      = {totalLengthMm.toLocaleString()}mm
                      ({(totalLengthMm / 1000).toFixed(1)}m)
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  공급업체 LOT / COA {isRM && <span className="text-red-500">*</span>}
                </label>
                <input type="text" value={supplierLot} onChange={(e) => setSupplierLot(e.target.value)}
                  placeholder={isRM ? '필수 (제조사 LOT/COA 번호)' : '있는 경우 기입'}
                  className="w-full border rounded px-3 py-2 text-shop-sm bg-white font-mono" />
              </div>
              {/* Task 2a: LOT 번호 입력 + 검증 */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">인수검사 LOT 번호</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text" value={lotNumber}
                      onChange={(e) => { setLotNumber(e.target.value); validateLot(e.target.value); }}
                      placeholder="C302형식: YYMMDD[약호]NNN (예: 260203CW001)"
                      className={cn(
                        'w-full border rounded px-3 py-2 text-shop-sm bg-white font-mono',
                        hasLotError && 'border-red-400 focus:ring-red-300',
                        hasLotWarning && !hasLotError && 'border-yellow-400 focus:ring-yellow-300'
                      )}
                    />
                    {lotValidating && (
                      <span className="absolute right-2 top-2.5 text-xs text-gray-400">검증중...</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoLot}
                    className="px-3 py-2 bg-gray-100 border rounded text-xs font-medium text-gray-600 hover:bg-gray-200 whitespace-nowrap"
                  >
                    LOT 자동생성
                  </button>
                </div>
                {/* LOT 검증 에러 표시 */}
                {hasLotError && (
                  <div className="mt-1 space-y-0.5">
                    {lotErrors.map((w, i) => (
                      <p key={i} className="text-xs text-red-600">{w.message}</p>
                    ))}
                    {lotValidation?.suggestion && (
                      <p className="text-xs text-gray-500">
                        추천: <button type="button" className="text-blue-600 underline font-mono"
                          onClick={() => { setLotNumber(lotValidation!.suggestion!); validateLot(lotValidation!.suggestion!); }}>
                          {lotValidation.suggestion}
                        </button>
                      </p>
                    )}
                  </div>
                )}
                {/* LOT 검증 경고 표시 */}
                {hasLotWarning && !hasLotError && (
                  <div className="mt-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    {lotWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-yellow-700">{w.message}</p>
                    ))}
                    <button type="button" onClick={() => setLotWarningDismissed(true)}
                      className="mt-1 text-xs text-yellow-800 font-medium underline hover:text-yellow-900">
                      계속 진행
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">검사일</label>
                  <input type="date" value={inspDate} onChange={(e) => setInspDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-shop-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">검사자</label>
                  <input value={inspector} onChange={(e) => setInspector(e.target.value)}
                    placeholder="검사원 성명" className="w-full border rounded px-3 py-2 text-shop-sm bg-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Task 2b: 샘플링 모드 표시 */}
          {samplingMode && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md border',
              samplingMode.mode === 'SAMPLING'
                ? 'bg-green-50 border-green-200'
                : 'bg-blue-50 border-blue-200'
            )}>
              <Info size={14} className={samplingMode.mode === 'SAMPLING' ? 'text-green-600' : 'text-blue-600'} />
              <span className={cn('text-xs font-medium', samplingMode.mode === 'SAMPLING' ? 'text-green-700' : 'text-blue-700')}>
                {samplingMode.description} (n={samplingMode.n}, c={samplingMode.c})
              </span>
            </div>
          )}

          {/* Auto-judgment notice */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
            <Info size={14} className="text-blue-600 flex-shrink-0" />
            <span className="text-xs text-blue-700">판정은 기준값에 따라 자동으로 결정됩니다</span>
          </div>

          {/* Task 3: n1/n2/n3 동일값 경고 (전체) */}
          {Object.values(identicalWarnings).some(Boolean) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md">
              <AlertTriangle size={14} className="text-yellow-600 flex-shrink-0" />
              <span className="text-xs text-yellow-700 font-medium">
                n1, n2, n3 값이 모두 동일한 항목이 있습니다. 독립 측정 여부를 확인하세요.
              </span>
            </div>
          )}

          {/* Step 4: 검사항목 탭 — 일반검사 | 공인시험 */}
          {(measurements.length > 0 || certMeasurements.length > 0) && (
            <div className="flex border-b mb-0">
              <button
                type="button"
                onClick={() => setInspectionTab('GENERAL')}
                className={cn(
                  'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
                  inspectionTab === 'GENERAL'
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                입고 검사항목
                <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">
                  {measurements.length}
                </span>
              </button>
              {certMeasurements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setInspectionTab('CERT')}
                  className={cn(
                    'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
                    inspectionTab === 'CERT'
                      ? 'border-orange-500 text-orange-700 bg-orange-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  🔬 공인시험 항목
                  <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5">
                    {certMeasurements.length}
                  </span>
                  <span className="ml-1 text-xs text-orange-500">(별도 입력)</span>
                </button>
              )}
            </div>
          )}

          {/* 공인시험 탭 안내 */}
          {inspectionTab === 'CERT' && certMeasurements.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
              <Info size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-orange-700">
                공인시험 항목은 시험성적서 수령 후 입력합니다. 지금 바로 입력하거나, 입고검사 완료 후 수정 메뉴에서 추가 입력할 수 있습니다.
              </span>
            </div>
          )}

          {/* Step 4a: 일반 검사항목 */}
          {inspectionTab === 'GENERAL' && measurements.length > 0 && (
            <div className="overflow-x-auto border rounded">

              <table className="w-full text-shop-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-2 py-2 text-center text-xs text-gray-500 w-8">#</th>
                    <th className="px-2 py-2 text-center text-xs text-gray-500 w-8">적용</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">품질항목</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">검사항목</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">방법</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">주기</th>
                    <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">기준값</th>
                    <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">n1</th>
                    {showN2N3 && <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">n2</th>}
                    {showN2N3 && <th className="px-2 py-2 text-right text-xs text-gray-500 w-20">n3</th>}
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, idx) => (
                    <tr key={idx} className={cn(
                      'border-b',
                      !m.is_applicable && 'bg-gray-50 opacity-50',
                      identicalWarnings[m.item_no] && 'bg-yellow-50'
                    )}>
                      <td className="px-2 py-1 text-center text-xs">{m.item_no}</td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={m.is_applicable}
                          onChange={(e) => updateMeasurement(idx, 'is_applicable', e.target.checked)} />
                      </td>
                      <td className="px-2 py-1 text-xs">{m.quality_item}</td>
                      <td className="px-2 py-1 text-xs">
                        {m.check_item}
                        {identicalWarnings[m.item_no] && (
                          <span className="ml-1 text-yellow-600" title="n1=n2=n3 동일값 경고">&#9888;</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs text-gray-500">{m.check_method}</td>
                      <td className="px-2 py-1">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded',
                          m.frequency === '매로트' ? 'bg-green-100 text-green-700' :
                          m.frequency === '1회/입고' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        )}>{m.frequency}</span>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.01" value={m.cert_standard}
                          onChange={(e) => updateMeasurement(idx, 'cert_standard', e.target.value)}
                          disabled={!m.is_applicable}
                          className="w-full border rounded px-1 py-0.5 text-right text-xs" />
                      </td>
                      <td className="px-2 py-1">
                        {m.check_method === '성적서' || m.check_method === '공인기관' ? (
                          <span className="text-xs text-gray-400 block text-right">성적서</span>
                        ) : (
                          <input type="number" step="0.01" value={m.n1}
                            onChange={(e) => updateMeasurement(idx, 'n1', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-right text-xs" placeholder="n1" />
                        )}
                      </td>
                      {showN2N3 && (
                        <td className="px-2 py-1">
                          {m.check_method === '성적서' || m.check_method === '공인기관' ? (
                            <span className="text-xs text-gray-400 block text-right">대체</span>
                          ) : (
                            <input type="number" step="0.01" value={m.n2}
                              onChange={(e) => updateMeasurement(idx, 'n2', e.target.value)}
                              disabled={!m.is_applicable}
                              className="w-full border rounded px-1 py-0.5 text-right text-xs" placeholder="n2" />
                          )}
                        </td>
                      )}
                      {showN2N3 && (
                        <td className="px-2 py-1">
                          {m.check_method === '성적서' || m.check_method === '공인기관' ? (
                            <span className="text-xs text-gray-400 block text-right">확인</span>
                          ) : (
                            <input type="number" step="0.01" value={m.n3}
                              onChange={(e) => updateMeasurement(idx, 'n3', e.target.value)}
                              disabled={!m.is_applicable}
                              className="w-full border rounded px-1 py-0.5 text-right text-xs" placeholder="n3" />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 4b: 공인시험 항목 탭 */}
          {inspectionTab === 'CERT' && certMeasurements.length > 0 && (
            <div className="overflow-x-auto border rounded border-orange-200">
              <table className="w-full text-shop-sm">
                <thead>
                  <tr className="bg-orange-50 border-b border-orange-200">
                    <th className="px-2 py-2 text-center text-xs text-gray-500 w-8">#</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">품질특성</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">검사항목</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">인정기준</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-500">단위</th>
                    <th className="px-2 py-2 text-right text-xs text-orange-600 w-28">측정값(성적서)</th>
                    <th className="px-2 py-2 text-center text-xs text-gray-500 w-16">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {certMeasurements.map((m, idx) => {
                    const val = parseFloat(m.n1);
                    const std = parseFloat(m.cert_standard);
                    let judgment: 'PASS' | 'FAIL' | '-' = '-';
                    if (!isNaN(val) && !isNaN(std)) {
                      if (m.direction === 'MAX') judgment = val <= std ? 'PASS' : 'FAIL';
                      else judgment = val >= std ? 'PASS' : 'FAIL';
                    }
                    return (
                      <tr key={idx} className="border-b hover:bg-orange-50/30">
                        <td className="px-2 py-2 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-2 text-xs">
                          <span className="inline-flex items-center rounded bg-orange-100 text-orange-700 px-1.5 py-0.5 text-xs font-medium">
                            {m.quality_item}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs font-medium">{m.check_item}</td>
                        <td className="px-2 py-2 text-xs text-gray-600">{m.cert_standard} {m.unit}</td>
                        <td className="px-2 py-2 text-xs text-gray-500">{m.unit}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number" step="0.001"
                            value={m.n1}
                            onChange={(e) => setCertMeasurements(prev => prev.map((c, i) => i === idx ? { ...c, n1: e.target.value } : c))}
                            placeholder="성적서 값 입력"
                            className="w-full border rounded px-2 py-1 text-right text-xs border-orange-200 focus:border-orange-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {judgment === '-' ? (
                            <span className="text-xs text-gray-400">미입력</span>
                          ) : judgment === 'PASS' ? (
                            <span className="inline-flex items-center rounded bg-green-100 text-green-700 px-2 py-0.5 text-xs font-bold">합격</span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">불합격</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button onClick={handleSubmit} disabled={submitting || !selectedForm}
              className="px-4 py-2 bg-process-cut text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? '검사 진행 중...' : '검사 실행 및 판정'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ 소켓 인수검사 모달 (발주서 기반)
// 흐름: 프로젝트 선택 → 발주서 선택 → 소켓 항목 표시 → 항목별 LOT 입력 → 검사 등록
// ─────────────────────────────────────────────────────────────────────────────
interface SocketPoItem {
  po_item_id: number;
  seq_no: number;
  sheet_name: string | null;
  product_type: string | null;
  structure: string | null;
  width_mm: number | null;
  height_mm: number | null;
  construction_type: string | null;
  qty: number;
  global_seq: number;
  explode_index: number;
}

interface SocketInspRow {
  po_item_id: number;
  global_seq: number;
  sheet_name: string | null;
  product_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  construction_type: string | null;
  lotNumber: string;
  skip: boolean; // 이미 검사 완료 등 건너뛸 경우
}

function SocketInspectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [projects, setProjects] = useState<Array<{ project_id: number; project_name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [pos, setPos] = useState<Array<{ po_id: number; file_name: string; biz_name: string | null }>>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [items, setItems] = useState<SocketInspRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [inspector, setInspector] = useState('');
  const [inspDate, setInspDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ seq: number; lot: string; status: 'ok' | 'err'; msg?: string }>>([]);
  const [done, setDone] = useState(false);

  // 프로젝트 로드
  useEffect(() => {
    api.get<{ data: any[] }>('/projects')
      .then(r => setProjects(r.data ?? []))
      .catch(() => {});
  }, []);

  // 프로젝트 선택 → 발주서 로드
  useEffect(() => {
    setSelectedPoId('');
    setItems([]);
    if (!selectedProjectId) { setPos([]); return; }
    api.get<{ data: any[] }>(`/purchase-orders?project_id=${selectedProjectId}`)
      .then(r => setPos((r.data ?? []).filter((p: any) => p.po_id)))
      .catch(() => setPos([]));
  }, [selectedProjectId]);

  // 발주서 선택 → 소켓 항목 로드
  useEffect(() => {
    setItems([]);
    if (!selectedPoId) return;
    setLoadingItems(true);
    api.get<{ data: SocketPoItem[] }>(`/po-items-for-wo?po_id=${selectedPoId}&wo_type=INSPECT`)
      .then(r => {
        const raw = r.data ?? [];
        // 차수→구조체→W→H 정렬
        const sorted = [...raw].sort((a, b) => {
          const sa = a.sheet_name || ''; const sb = b.sheet_name || '';
          if (sa !== sb) return sa.localeCompare(sb, 'ko');
          const ptOrder: Record<string, number> = { 'VT-01': 1, 'VT-049': 2, 'VT-064': 3, 'VA-064': 4, 'VAG-1.69': 5, 'HTG-064': 6, 'HTG-1.69': 7 };
          const pa = ptOrder[a.product_type || ''] ?? 99;
          const pb = ptOrder[b.product_type || ''] ?? 99;
          if (pa !== pb) return pa - pb;
          if ((a.width_mm ?? 0) !== (b.width_mm ?? 0)) return (a.width_mm ?? 0) - (b.width_mm ?? 0);
          return (a.height_mm ?? 0) - (b.height_mm ?? 0);
        });
        setItems(sorted.map(item => ({
          po_item_id: item.po_item_id,
          global_seq: item.global_seq,
          sheet_name: item.sheet_name,
          product_type: item.product_type,
          width_mm: item.width_mm,
          height_mm: item.height_mm,
          construction_type: item.construction_type,
          lotNumber: '',
          skip: false,
        })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedPoId]);

  const updateRow = (idx: number, field: 'lotNumber' | 'skip', value: string | boolean) => {
    setItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  // LOT 자동채우기: 같은 W×H 규격이면 같은 번호 채우기
  const autoFillSameSpec = (idx: number, lotNum: string) => {
    const target = items[idx];
    setItems(prev => prev.map((row, i) => {
      if (i === idx) return { ...row, lotNumber: lotNum };
      if (!row.skip && row.lotNumber === '' &&
          row.width_mm === target.width_mm && row.height_mm === target.height_mm &&
          row.product_type === target.product_type && row.sheet_name === target.sheet_name) {
        return { ...row, lotNumber: lotNum };
      }
      return row;
    }));
  };

  const readyCount = items.filter(r => !r.skip && r.lotNumber.trim()).length;
  const skipCount = items.filter(r => r.skip).length;

  const handleSubmit = async () => {
    const toRegister = items.filter(r => !r.skip && r.lotNumber.trim());
    if (toRegister.length === 0) { alert('LOT 번호를 입력한 항목이 없습니다.'); return; }
    if (!confirm(`${toRegister.length}건의 소켓 인수검사를 등록합니다.`)) return;

    setSubmitting(true);
    const res: typeof results = [];
    for (const row of toRegister) {
      try {
        await api.post('/inspections/socket', {
          po_item_id: row.po_item_id,
          po_id: selectedPoId,
          lot_number: row.lotNumber.trim(),
          inspector: inspector || undefined,
          inspected_at: inspDate,
          product_type: row.product_type,
          width_mm: row.width_mm,
          height_mm: row.height_mm,
          construction_type: row.construction_type,
        });
        res.push({ seq: row.global_seq, lot: row.lotNumber.trim(), status: 'ok' });
      } catch (e: any) {
        res.push({ seq: row.global_seq, lot: row.lotNumber.trim(), status: 'err', msg: e?.body?.error || '등록 실패' });
      }
    }
    setResults(res);
    setDone(true);
    setSubmitting(false);
  };

  // 현재 차수별 그룹
  const sheetGroups = items.reduce((acc, row, idx) => {
    const key = row.sheet_name || '(차수 미지정)';
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...row, _idx: idx });
    return acc;
  }, {} as Record<string, Array<SocketInspRow & { _idx: number }>>);

  const STRUCT_COLORS: Record<string, string> = {
    'VT-049': 'bg-indigo-50 border-indigo-200',
    'VT-01':  'bg-blue-50 border-blue-200',
    'VT-064': 'bg-cyan-50 border-cyan-200',
    'VA-064': 'bg-purple-50 border-purple-200',
    'HTG-064':'bg-amber-50 border-amber-200',
    'HTG-1.69':'bg-orange-50 border-orange-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">📦 소켓 인수검사 등록</h2>
            <p className="text-blue-200 text-xs mt-0.5">발주서 기반으로 소켓 항목을 불러와 LOT를 등록합니다</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {done ? (
            // ── 결과 화면 ──
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl mb-2">{results.every(r => r.status === 'ok') ? '✅' : '⚠️'}</div>
                <p className="font-bold text-lg">
                  {results.filter(r => r.status === 'ok').length}건 등록 완료
                  {results.filter(r => r.status === 'err').length > 0 && ` / ${results.filter(r => r.status === 'err').length}건 실패`}
                </p>
              </div>
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">LOT 번호</th>
                      <th className="px-3 py-2 text-center">결과</th>
                      <th className="px-3 py-2 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map(r => (
                      <tr key={r.seq} className={r.status === 'err' ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-gray-400">{r.seq}</td>
                        <td className="px-3 py-2 font-mono font-semibold">{r.lot}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{r.status === 'ok' ? '✅ 등록' : '❌ 실패'}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{r.msg || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={onCreated} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">확인</button>
              </div>
            </div>
          ) : (
            <>
              {/* ① 프로젝트 · 발주서 선택 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">프로젝트 *</label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">-- 프로젝트 선택 --</option>
                    {projects.map(p => (
                      <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">발주서 *</label>
                  <select
                    value={selectedPoId}
                    onChange={e => setSelectedPoId(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!selectedProjectId || pos.length === 0}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">-- 발주서 선택 --</option>
                    {pos.map(p => (
                      <option key={p.po_id} value={p.po_id}>
                        {p.biz_name ? `[${p.biz_name}] ` : ''}{p.file_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ② 검사자 · 검사일 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">검사자</label>
                  <input
                    type="text" value={inspector} onChange={e => setInspector(e.target.value)}
                    placeholder="검사자 이름"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">검사일</label>
                  <input
                    type="date" value={inspDate} onChange={e => setInspDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* ③ 소켓 항목 목록 */}
              {loadingItems ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  발주 항목 불러오는 중...
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      소켓 항목 <span className="text-blue-600">{items.length}건</span>
                    </p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="text-blue-600 font-medium">LOT 입력: {readyCount}건</span>
                      {skipCount > 0 && <span className="text-gray-400">건너뜀: {skipCount}건</span>}
                    </div>
                  </div>

                  {/* 차수별 그룹 */}
                  {Object.entries(sheetGroups).map(([sheet, rows]) => (
                    <div key={sheet} className="border rounded-xl overflow-hidden">
                      <div className="bg-slate-700 text-white px-4 py-2 text-xs font-bold">
                        📋 {sheet} — {rows.length}건
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-2 py-2 text-left w-10">No</th>
                              <th className="px-2 py-2 text-left">구조체</th>
                              <th className="px-2 py-2 text-center">규격 (W×H)</th>
                              <th className="px-2 py-2 text-center w-12">단/양면</th>
                              <th className="px-3 py-2 text-left">LOT 번호 입력 <span className="text-gray-400 font-normal">(입력 후 Enter → 같은 규격 자동 채움)</span></th>
                              <th className="px-2 py-2 text-center w-16">건너뜀</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {rows.map(row => {
                              const colClass = STRUCT_COLORS[row.product_type || ''] || 'bg-white border-transparent';
                              return (
                                <tr key={row._idx} className={cn('transition-colors', row.skip ? 'opacity-40' : colClass.split(' ')[0])}>
                                  <td className="px-2 py-1.5 text-gray-400">{row.global_seq}</td>
                                  <td className="px-2 py-1.5">
                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', colClass)}>
                                      {row.product_type || '-'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono font-semibold">
                                    {row.width_mm && row.height_mm ? `${row.width_mm}×${row.height_mm}` : '-'}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${
                                      row.construction_type === 'SINGLE' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {row.construction_type === 'SINGLE' ? '단' : '양'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1">
                                    <input
                                      type="text"
                                      disabled={row.skip}
                                      value={row.lotNumber}
                                      onChange={e => updateRow(row._idx, 'lotNumber', e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && row.lotNumber.trim()) {
                                          autoFillSameSpec(row._idx, row.lotNumber.trim());
                                        }
                                      }}
                                      placeholder="예: 260616GI001"
                                      className={cn(
                                        'w-full border rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none',
                                        row.lotNumber ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                                      )}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={row.skip}
                                      onChange={e => updateRow(row._idx, 'skip', e.target.checked)}
                                      className="rounded border-gray-300 text-gray-500"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  {/* 안내 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
                    💡 LOT 번호 입력 후 <kbd className="bg-white border rounded px-1">Enter</kbd>를 누르면 같은 구조체·규격·차수의 미입력 항목에 동일 LOT가 자동 입력됩니다.
                  </div>
                </div>
              ) : selectedPoId ? (
                <div className="text-center py-12 text-gray-400">
                  <ClipboardCheck size={36} className="mx-auto mb-2 text-gray-300" />
                  <p>발주서에 소켓 항목이 없습니다.</p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        {!done && (
          <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-2xl">
            <div className="text-sm text-gray-500">
              {items.length > 0 && (
                <span>LOT 입력: <strong className="text-blue-700">{readyCount}</strong>건 / 전체 {items.length}건</span>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">취소</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || readyCount === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> 등록 중...</> : `📦 인수검사 등록 (${readyCount}건)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
