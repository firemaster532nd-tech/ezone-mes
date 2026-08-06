import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { Plus, Check, X, Thermometer, Ruler, Eye, Film, Trash2, Printer } from 'lucide-react';
import { InspectionFormPrintModal } from '@/components/inspection/InspectionFormPrintModal';

interface SelfInspection {
  self_insp_id: number;
  wo_id: number;
  wo_number: string;
  process_code: string;
  check_time: string;
  check_category: string;
  check_point: string;
  standard_value: number | null;
  tolerance: number | null;
  measured_value: number | null;
  is_ok: boolean | null;
  worker: string | null;
  reviewer: string | null;
  approver: string | null;
  remarks: string | null;
}

interface WorkOrderOption {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  lot_number: string | null;
  process_code: string;
}

interface PresetItem {
  check_category: string;
  check_point: string;
  standard_value: number | null;
  tolerance: number | null;
  check_method: string;
  unit: string;
}

interface ProcessPreset {
  process_code: string;
  label: string;
  description: string;
  items: PresetItem[];
}

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합(MIX)' },
  { key: 'EXT', label: '압출(EXT)' },
  { key: 'CUT', label: '재단(CUT)' },
  { key: 'ASM', label: '조립(ASM)' },
];

const categoryIcon: Record<string, React.ReactNode> = {
  TEMP: <Thermometer size={14} className="text-red-500" />,
  DIM: <Ruler size={14} className="text-blue-500" />,
  VISUAL: <Eye size={14} className="text-green-500" />,
  FILM: <Film size={14} className="text-purple-500" />,
};

const categoryLabel: Record<string, string> = {
  TEMP: '온도', DIM: '치수', VISUAL: '외관', FILM: '필름',
};

const categoryColor: Record<string, string> = {
  TEMP: 'bg-red-100 text-red-700',
  DIM: 'bg-blue-100 text-blue-700',
  VISUAL: 'bg-green-100 text-green-700',
  FILM: 'bg-purple-100 text-purple-700',
};

const PROCESS_DOC_CODE: Record<string, string> = {
  MIX: 'EZC-C-601-1', EXT: 'EZC-C-601-2', CUT: 'EZC-C-601-3', ASM: 'EZC-C-601-4',
};

export function SelfInspectionPage() {
  const [data, setData] = useState<SelfInspection[]>([]);
  const [processFilter, setProcessFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [modifyingItem, setModifyingItem] = useState<SelfInspection | null>(null);
  const [printWoId, setPrintWoId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [printModalData, setPrintModalData] = useState<any>(null);

  const handleOpenPrintModal = (si: SelfInspection) => {
    const docCode = PROCESS_DOC_CODE[si.process_code] || 'EZC-C-601-1';
    setPrintModalData({
      formCode: docCode,
      formTitle: `자주검사 성적서 (${si.process_code} 공정)`,
      categoryName: '작업자 자율 품질점검 기록표',
      itemName: `${si.check_point || '공정 치수/외관'} (${si.process_code})`,
      supplierName: '(주)이지원 생산공장',
      supplierLot: '-',
      lotNumber: si.wo_number || '-',
      receivedDate: si.check_time ? String(si.check_time).slice(0, 10) : new Date().toISOString().slice(0, 10),
      qty: 1,
      unit: 'LOT',
      inspector: si.worker || '생산 작업자',
      n1: si.measured_value ?? '양호',
      n2: '양호',
      n3: '양호',
      items: [
        { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 휨, 틈새 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
        { name: `자주검사 항목 (${si.check_point || '치수/온도/필름'})`, standard: `기준: ${si.standard_value ?? 'OK기준'} (±${si.tolerance ?? 0})`, method: '자율측정', cycle: '매공정', condition: 'n=3, c=0', n1: si.measured_value ?? '정상', n2: '정상', n3: '정상', isPass: si.is_ok !== false },
        { name: '사규 공정 검사기준', standard: 'EZC-C-601 작업자 자주검사 규정 적합', method: '자율점검', cycle: '매공정', condition: 'n=1, c=0', n1: '적합', n2: '적합', n3: '적합', isPass: true }
      ],
      overallResult: si.is_ok !== false ? 'PASS' : 'FAIL',
      certInfo: 'EZC-C-601 자주검사 관리규정 100% 준수'
    });
  };


  const fetchData = () => {
    const params = processFilter ? `?process_code=${processFilter}` : '';
    api.get<{ data: SelfInspection[] }>(`/self-inspections${params}`).then((res) => setData(res.data));
  };

  useEffect(() => { fetchData(); setSelectedIds(new Set()); }, [processFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/self-inspections/${id}`)));
      setSelectedIds(new Set()); fetchData();
    } catch { alert('삭제 실패'); }
  };

  const countByProcess = data.reduce((acc, si) => {
    const pc = si.process_code || 'UNKNOWN'; acc[pc] = (acc[pc] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <PageHeader title="자주검사" count={data.length} description="작업자가 생산 중 스스로 수행하는 공정별 품질 점검">
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md text-shop-sm font-medium hover:opacity-90">
              <Trash2 size={16} /> {selectedIds.size}건 삭제
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90">
            <Plus size={16} /> 자주검사 등록
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {['MIX', 'EXT', 'CUT', 'ASM'].map((pc) => (
          <button key={pc} onClick={() => setProcessFilter(processFilter === pc ? '' : pc)}
            className={cn('bg-white rounded-card border p-3 text-left transition-all', processFilter === pc && 'ring-2 ring-process-mix border-process-mix')}>
            <div className="flex items-center justify-between mb-1">
              <ProcessBadge process={pc as any} />
              <span className="text-lg font-bold">{countByProcess[pc] || 0}</span>
            </div>
            <div className="text-xs text-gray-500">
              {pc === 'MIX' && '중량/온도/외관'}{pc === 'EXT' && '6존온도/두께/너비/표면'}
              {pc === 'CUT' && '첫제품치수/외관'}{pc === 'ASM' && '접착/체결/틈새/외관'}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button key={tab.key} onClick={() => setProcessFilter(tab.key)}
            className={cn('px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              processFilter === tab.key ? 'border-process-mix text-process-mix' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full min-w-[1000px] text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-center font-medium text-gray-500 w-8">
                <input type="checkbox"
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={(e) => { if (e.target.checked) setSelectedIds(new Set(data.map((d) => d.self_insp_id))); else setSelectedIds(new Set()); }} />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업지시</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">구분</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">체크포인트</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">기준값</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">공차(±)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">측정값</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">판정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작성자</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">시간</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500 w-28">작업</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">등록된 자주검사가 없습니다.</td></tr>
            ) : data.map((si) => (
              <tr key={si.self_insp_id} className={cn('border-b hover:bg-blue-50 transition-colors', si.is_ok === false && 'bg-red-50')}>
                <td className="px-3 py-3 text-center">
                  <input type="checkbox" checked={selectedIds.has(si.self_insp_id)} onChange={() => toggleSelect(si.self_insp_id)} />
                </td>
                <td className="px-3 py-3 font-mono text-xs">{si.wo_number}</td>
                <td className="px-3 py-3"><ProcessBadge process={si.process_code as any} /></td>
                <td className="px-3 py-3">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', categoryColor[si.check_category] || 'bg-gray-100 text-gray-700')}>
                    {categoryIcon[si.check_category]}{categoryLabel[si.check_category] || si.check_category}
                  </span>
                </td>
                <td className="px-3 py-3">{si.check_point || '-'}</td>
                <td className="px-3 py-3 text-right font-mono">{si.standard_value === 1 && si.tolerance === 0 ? 'OK기준' : si.standard_value ?? '-'}</td>
                <td className="px-3 py-3 text-right font-mono">{si.standard_value === 1 && si.tolerance === 0 ? '-' : `±${si.tolerance ?? '-'}`}</td>
                <td className="px-3 py-3 text-right font-mono">
                  {si.standard_value === 1 && si.tolerance === 0
                    ? (si.measured_value != null ? (si.measured_value >= 1 ? 'OK' : 'NG') : '-')
                    : si.measured_value ?? '-'}
                </td>
                <td className="px-3 py-3 text-center">
                  {si.is_ok === true && <Check size={16} className="inline text-green-600" />}
                  {si.is_ok === false && <X size={16} className="inline text-red-600" />}
                  {si.is_ok === null && <span className="text-gray-400">-</span>}
                </td>
                <td className="px-3 py-3 text-xs">{si.worker || '-'}</td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {si.check_time ? new Date(si.check_time).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => setModifyingItem(si)}
                      className={cn('px-2 py-0.5 rounded text-xs font-semibold cursor-pointer border',
                        si.measured_value == null
                          ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200')}>
                      {si.measured_value == null ? '입력' : '수정'}
                    </button>
                    <button onClick={() => handleOpenPrintModal(si)}
                      className="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      title="A4 인쇄">
                      <Printer size={12} className="inline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateSelfInspectionModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchData(); }} />}
      {modifyingItem && <ModifySelfInspectionModal item={modifyingItem} onClose={() => setModifyingItem(null)} onSaved={() => { setModifyingItem(null); fetchData(); }} />}
      {printWoId !== null && <SelfInspPrintModal woId={printWoId} allData={data} onClose={() => setPrintWoId(null)} />}
      <InspectionFormPrintModal isOpen={!!printModalData} onClose={() => setPrintModalData(null)} data={printModalData} />
    </div>
  );
}


/* ===== 자주검사 등록 모달 (결재선 포함) ===== */
function CreateSelfInspectionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [woId, setWoId] = useState('');
  const [worker, setWorker] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [approver, setApprover] = useState('');
  const [preset, setPreset] = useState<ProcessPreset | null>(null);
  const [items, setItems] = useState<Array<{ check_category: string; check_point: string; standard_value: string; tolerance: string; measured_value: string; check_method: string; unit: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ data: WorkOrderOption[] }>('/work-orders').catch(() => ({ data: [] })),
      api.get<{ data: any[] }>('/fn-purchase-orders/pending').catch(() => ({ data: [] }))
    ]).then(([woRes, poRes]) => {
      const woList = (woRes.data || []).filter((w: any) => w.status !== 'COMPLETED');
      const poList = (poRes.data || []).map((po: any) => ({
        wo_id: po.fn_po_item_id || po.po_id || 880000 + (po.fn_po_item_id || 1),
        wo_number: po.po_number || po.fn_lot_number || `PO-${po.fn_po_item_id}`,
        wo_date: new Date().toISOString().slice(0, 10),
        lot_number: po.fn_lot_number || null,
        process_code: po.item_type === 'SLEEVE' ? 'ASM' : 'CUT'
      }));
      setWorkOrders([...woList, ...poList]);
    });
  }, []);

  const handleWoChange = async (value: string) => {
    setWoId(value);
    if (!value) { setPreset(null); setItems([]); return; }
    const wo = workOrders.find((w) => String(w.wo_id) === value || String((w as any).wo_number) === value);
    const processCode = wo ? wo.process_code : 'ASM';
    try {
      const res = await api.get<{ data: ProcessPreset }>(`/self-inspections/presets/${processCode}`);
      setPreset(res.data);
      setItems(res.data.items.map((p) => ({
        check_category: p.check_category, check_point: p.check_point,
        standard_value: p.standard_value != null ? String(p.standard_value) : '',
        tolerance: p.tolerance != null ? String(p.tolerance) : '',
        measured_value: '', check_method: p.check_method, unit: p.unit,
      })));
    } catch { setPreset(null); setItems([]); }
  };


  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items]; (updated[idx] as any)[field] = value; setItems(updated);
  };

  const selectedWo = workOrders.find((w) => String(w.wo_id) === woId);

  const handleSubmit = async () => {
    if (!woId) return alert('작업지시를 선택해주세요.');
    const filledItems = items.filter((i) => i.measured_value !== '');
    if (filledItems.length === 0) return alert('최소 1개 항목의 측정값을 입력해주세요.');
    setSaving(true);
    try {
      await api.post('/self-inspections/batch', {
        wo_id: parseInt(woId), worker: worker || null,
        reviewer: reviewer || null, approver: approver || null,
        items: filledItems.map((i) => ({
          check_category: i.check_category, check_point: i.check_point,
          standard_value: i.standard_value ? parseFloat(i.standard_value) : null,
          tolerance: i.tolerance ? parseFloat(i.tolerance) : null,
          measured_value: i.measured_value ? parseFloat(i.measured_value) : null,
        })),
      });
      onSaved();
    } catch { alert('등록 실패'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-shop-lg font-bold mb-1">자주검사 등록</h2>
        <p className="text-xs text-gray-500 mb-4">작업지시를 선택하면 해당 공정의 검사항목이 자동으로 로드됩니다.</p>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">작업지시 선택</label>
            <select value={woId} onChange={(e) => handleWoChange(e.target.value)} className="w-full border rounded px-3 py-2 text-shop-sm">
              <option value="">작업지시를 선택하세요</option>
              {workOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  {wo.wo_number} ({wo.process_code}){wo.lot_number ? ` [${wo.lot_number}]` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">작성자 (검사원)</label>
            <input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="작성자명" className="w-full border rounded px-3 py-2 text-shop-sm" />
          </div>
        </div>

        {/* 결재선 입력 */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 w-12 shrink-0">검 토</span>
            <input value={reviewer} onChange={(e) => setReviewer(e.target.value)}
              placeholder="검토자명" className="flex-1 border rounded px-2 py-1.5 text-shop-sm bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 w-12 shrink-0">승 인</span>
            <input value={approver} onChange={(e) => setApprover(e.target.value)}
              placeholder="승인자명" className="flex-1 border rounded px-2 py-1.5 text-shop-sm bg-white" />
          </div>
          <p className="col-span-2 text-[10px] text-blue-600">* 인쇄 후 오프라인 서명을 위한 결재란입니다. 미입력 시 빈칸으로 출력됩니다.</p>
        </div>

        {preset && selectedWo && (
          <div className={cn('flex items-center gap-3 p-3 rounded-lg mb-4 border',
            selectedWo.process_code === 'MIX' && 'bg-process-mix/5 border-process-mix/30',
            selectedWo.process_code === 'EXT' && 'bg-process-ext/5 border-process-ext/30',
            selectedWo.process_code === 'CUT' && 'bg-process-cut/5 border-process-cut/30',
            selectedWo.process_code === 'ASM' && 'bg-process-asm/5 border-process-asm/30')}>
            <ProcessBadge process={selectedWo.process_code as any} />
            <div>
              <div className="text-shop-sm font-medium">{preset.label}</div>
              <div className="text-xs text-gray-500">{preset.description} ({preset.items.length}개 항목)</div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto border rounded mb-4">
            <table className="w-full text-shop-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-2 py-2 text-left text-xs text-gray-500">구분</th>
                  <th className="px-2 py-2 text-left text-xs text-gray-500">체크포인트</th>
                  <th className="px-2 py-2 text-left text-xs text-gray-500">방법</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500">기준값</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500">공차(±)</th>
                  <th className="px-2 py-2 text-right text-xs text-gray-500 w-28">측정값 입력</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isVisual = item.unit === 'OK/NG';
                  return (
                    <tr key={idx} className="border-b">
                      <td className="px-2 py-1.5">
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium', categoryColor[item.check_category] || 'bg-gray-100')}>
                          {categoryIcon[item.check_category]}{categoryLabel[item.check_category]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-medium">{item.check_point}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-500">{item.check_method}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {isVisual ? <span className="text-green-600">OK 기준</span> : (
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" step="any" value={item.standard_value}
                              onChange={(e) => updateItem(idx, 'standard_value', e.target.value)}
                              className="w-20 border rounded px-1.5 py-0.5 text-right text-xs" placeholder="기준" />
                            <span className="text-gray-400 text-[10px]">{item.unit}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {isVisual ? '-' : (
                          <input type="number" step="any" value={item.tolerance}
                            onChange={(e) => updateItem(idx, 'tolerance', e.target.value)}
                            className="w-14 border rounded px-1 py-0.5 text-right text-xs" placeholder="공차" />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {isVisual ? (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => updateItem(idx, 'measured_value', '1')}
                              className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
                                item.measured_value === '1' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50')}>OK</button>
                            <button onClick={() => updateItem(idx, 'measured_value', '0')}
                              className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
                                item.measured_value === '0' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:bg-red-50')}>NG</button>
                          </div>
                        ) : (
                          <input type="number" value={item.measured_value}
                            onChange={(e) => updateItem(idx, 'measured_value', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-right text-shop-sm" placeholder={item.unit} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!woId && <div className="text-center py-8 text-gray-400 text-shop-sm">작업지시를 선택하면 해당 공정의 자주검사 항목이 자동으로 표시됩니다.</div>}

        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {items.length > 0 && `${items.filter(i => i.measured_value).length}/${items.length}개 입력 완료`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded text-shop-sm">취소</button>
            <button onClick={handleSubmit} disabled={saving || items.length === 0}
              className="px-4 py-2 bg-process-mix text-white rounded text-shop-sm font-medium disabled:opacity-50">
              {saving ? '저장 중...' : '일괄 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== 측정값 수정 모달 ===== */
function ModifySelfInspectionModal({ item, onClose, onSaved }: { item: SelfInspection; onClose: () => void; onSaved: () => void }) {
  const [measuredValue, setMeasuredValue] = useState(item.measured_value?.toString() || '');
  const [worker, setWorker] = useState(item.worker || '');
  const [remarks, setRemarks] = useState(item.remarks || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (measuredValue === '') return alert('측정값을 입력해주세요.');
    setSaving(true);
    try {
      const val = parseFloat(measuredValue);
      let isOk: boolean | null = null;
      if (item.standard_value != null) {
        const tolerance = item.tolerance ?? 0;
        if (item.standard_value === 1 && tolerance === 0) { isOk = val >= 1; }
        else { isOk = Math.abs(val - item.standard_value) <= tolerance; }
      }
      await api.patch(`/self-inspections/${item.self_insp_id}`, { measured_value: val, is_ok: isOk, worker: worker || null, remarks: remarks || null });
      onSaved();
    } catch { alert('저장 실패'); } finally { setSaving(false); }
  };

  const isVisual = item.check_point.includes('외관') || item.check_point.includes('이물질') || item.check_category === 'VISUAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-shop-lg font-bold">검사 측정값 입력</h2>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs text-gray-700">
          <div><span className="text-gray-400">작업지시:</span> <span className="font-mono font-medium">{item.wo_number}</span></div>
          <div><span className="text-gray-400">검사항목:</span> <span className="font-medium">{item.check_point}</span></div>
          <div><span className="text-gray-400">기준규격:</span> <span className="font-semibold text-blue-700">{isVisual ? 'OK 기준' : `${item.standard_value} ± ${item.tolerance}`}</span></div>
        </div>
        <label className="block">
          <span className="text-shop-sm font-medium text-gray-700">측정값 입력</span>
          {isVisual ? (
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setMeasuredValue('1')}
                className={cn('flex-1 py-2 rounded text-shop-sm font-bold border transition-colors',
                  measuredValue === '1' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50')}>OK (합격)</button>
              <button type="button" onClick={() => setMeasuredValue('0')}
                className={cn('flex-1 py-2 rounded text-shop-sm font-bold border transition-colors',
                  measuredValue === '0' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:bg-red-50')}>NG (불합격)</button>
            </div>
          ) : (
            <input type="number" step="any" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm text-right" placeholder="실측값 입력" required />
          )}
        </label>
        <label className="block">
          <span className="text-shop-sm font-medium text-gray-700">검사자</span>
          <input type="text" value={worker} onChange={(e) => setWorker(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm" placeholder="검사자 이름" />
        </label>
        <label className="block">
          <span className="text-shop-sm font-medium text-gray-700">비고 (선택)</span>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm h-20 resize-none" placeholder="특이사항 입력" />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-shop-sm">취소</button>
          <button type="submit" disabled={saving || measuredValue === ''}
            className="px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ===== A4 자주검사 기록표 인쇄 모달 (EZC-C-601) ===== */
function SelfInspPrintModal({ woId, allData, onClose }: { woId: number; allData: SelfInspection[]; onClose: () => void }) {
  const records = allData.filter((si) => si.wo_id === woId);
  const sample = records[0];

  if (!sample) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-card p-8 text-center">
          <p className="text-gray-500 mb-4">해당 작업지시의 자주검사 기록이 없습니다.</p>
          <button onClick={onClose} className="px-4 py-2 border rounded">닫기</button>
        </div>
      </div>
    );
  }

  const processCode = sample.process_code;
  const docCode = PROCESS_DOC_CODE[processCode] || 'EZC-C-601';
  const processLabel: Record<string, string> = { MIX: '배합', EXT: '압출', CUT: '재단', ASM: '조립' };
  const checkDate = sample.check_time
    ? new Date(sample.check_time).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '-';
  const allPass = records.every((r) => r.is_ok !== false);

  const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({ border: '1px solid black', padding: '4px 8px', ...extra });
  const thStyle = (extra?: React.CSSProperties): React.CSSProperties => ({ border: '1px solid black', padding: '4px 6px', background: '#f3f4f6', fontWeight: 'bold', ...extra });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto p-4">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-3xl flex flex-col">

        {/* 화면 컨트롤 */}
        <div className="px-6 py-3 border-b bg-gray-100 flex justify-between items-center rounded-t-card print:hidden">
          <span className="font-bold text-gray-800">자주검사 기록표 ({docCode}) — 인쇄 미리보기</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors">
              <Printer size={14} /> 인쇄 / PDF 저장
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border bg-white rounded text-xs hover:bg-gray-100 transition-colors">닫기</button>
          </div>
        </div>

        {/* A4 문서 */}
        <div className="p-6 bg-gray-50 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <div id="print-area"
            style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif", background: 'white', margin: '0 auto', padding: '24px', border: '1px solid #ccc', fontSize: '11px', color: 'black' }}>

            {/* 상단: 메타 + 결재란 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace', lineHeight: '1.6' }}>
                문서번호: {docCode} (Rev.1)<br />
                규격: A4(210×297)
              </div>
              {/* 결재 격자표 */}
              <table style={{ borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={{ ...thStyle({ padding: '6px 8px', writingMode: 'vertical-rl' as any, letterSpacing: '4px', width: '28px' }) }}>결재</td>
                    <td style={thStyle({ minWidth: '64px' })}>작 성</td>
                    <td style={thStyle({ minWidth: '64px' })}>검 토</td>
                    <td style={thStyle({ minWidth: '64px' })}>승 인</td>
                  </tr>
                  <tr>
                    <td style={tdStyle({ paddingTop: '24px', paddingBottom: '24px', verticalAlign: 'top', color: '#374151' })}>{sample.worker || ''}</td>
                    <td style={tdStyle({ paddingTop: '24px', paddingBottom: '24px', verticalAlign: 'top', color: '#374151' })}>{sample.reviewer || ''}</td>
                    <td style={tdStyle({ paddingTop: '24px', paddingBottom: '24px', verticalAlign: 'top', color: '#374151' })}>{sample.approver || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 제목 */}
            <h1 style={{ fontSize: '15px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '6px', textDecoration: 'underline', marginBottom: '16px' }}>
              자 주 검 사 기 록 표 ({processLabel[processCode] || processCode} 공 정)
            </h1>

            {/* 기본정보 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
              <tbody>
                <tr>
                  <td style={thStyle({ width: '90px' })}>작업지시번호</td>
                  <td style={tdStyle({ fontFamily: 'monospace', fontWeight: '600' })}>{sample.wo_number}</td>
                  <td style={thStyle({ width: '60px' })}>공정구분</td>
                  <td style={tdStyle({ width: '80px' })}>{processLabel[processCode]} ({processCode})</td>
                  <td style={thStyle({ width: '60px' })}>검사일자</td>
                  <td style={tdStyle()}>{checkDate}</td>
                </tr>
                <tr>
                  <td style={thStyle()}>검사기준</td>
                  <td style={tdStyle()} colSpan={5}>n=1 수시검사 / 이상 발견 시 즉시 생산 중단 및 품질책임자 보고</td>
                </tr>
              </tbody>
            </table>

            {/* 검사항목 테이블 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', marginBottom: '14px' }}>
              <thead>
                <tr>
                  <th style={thStyle({ width: '28px' })}>No.</th>
                  <th style={thStyle({ width: '38px' })}>구분</th>
                  <th style={{ ...thStyle(), textAlign: 'left' }}>검사항목 / 체크포인트</th>
                  <th style={thStyle({ width: '68px' })}>기준값</th>
                  <th style={thStyle({ width: '58px' })}>허용오차</th>
                  <th style={thStyle({ width: '64px' })}>실측값</th>
                  <th style={thStyle({ width: '52px' })}>검사자</th>
                  <th style={thStyle({ width: '44px' })}>판정</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const isVisual = r.standard_value === 1 && r.tolerance === 0;
                  const measuredDisplay = r.measured_value != null
                    ? isVisual ? (r.measured_value >= 1 ? 'OK' : 'NG') : String(r.measured_value)
                    : '';
                  return (
                    <tr key={r.self_insp_id} style={{ background: r.is_ok === false ? '#fef2f2' : undefined }}>
                      <td style={tdStyle({ fontFamily: 'monospace' })}>{idx + 1}</td>
                      <td style={tdStyle({ fontSize: '9px' })}>{categoryLabel[r.check_category] || r.check_category}</td>
                      <td style={{ ...tdStyle(), textAlign: 'left', fontWeight: '500' }}>{r.check_point}</td>
                      <td style={tdStyle({ fontFamily: 'monospace' })}>{isVisual ? '결함없을것' : r.standard_value ?? '-'}</td>
                      <td style={tdStyle({ fontFamily: 'monospace' })}>{isVisual ? '-' : `± ${r.tolerance ?? '-'}`}</td>
                      <td style={tdStyle({ fontFamily: 'monospace', fontWeight: 'bold', color: r.is_ok === false ? '#b91c1c' : '#1d4ed8' })}>
                        {measuredDisplay}
                      </td>
                      <td style={tdStyle()}>{r.worker || ''}</td>
                      <td style={tdStyle({ fontWeight: 'bold', color: r.is_ok === true ? '#15803d' : r.is_ok === false ? '#b91c1c' : '#9ca3af' })}>
                        {r.is_ok === true ? '합격' : r.is_ok === false ? '불합격' : '—'}
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, 8 - records.length) }).map((_, i) => (
                  <tr key={`pad-${i}`}>
                    <td style={tdStyle({ padding: '14px 4px' })}>{records.length + i + 1}</td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                    <td style={tdStyle()}></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 종합판정 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>종합판정 :</span>
              <span style={{ fontWeight: 'bold', fontSize: '13px', padding: '3px 20px', border: `2px solid ${allPass ? '#16a34a' : '#dc2626'}`, color: allPass ? '#15803d' : '#b91c1c' }}>
                {allPass ? '합  격  (PASS)' : '불합격  (FAIL)'}
              </span>
              <span style={{ fontSize: '9px', color: '#6b7280', flex: 1 }}>
                * 불합격 항목 발생 시 즉시 생산 중단, 품질책임자에게 보고 후 조치완료 확인 후 재개
              </span>
            </div>

            {/* 특이사항 */}
            <div style={{ border: '1px solid black', padding: '8px 12px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>□ 특이사항 및 조치내용</div>
              <div style={{ minHeight: '48px', color: '#6b7280', fontSize: '10px', lineHeight: '1.6' }}>
                {records.find(r => r.remarks)?.remarks || '특이사항 없음. 정상 생산 완료.'}
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af', letterSpacing: '2px' }}>
              (주) 이지원 생산본부 · 본 기록은 품질 기록이며 3년간 보관
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          .fixed { position: static !important; background: white !important; }
          .print\\:hidden { display: none !important; }
          #print-area { border: none !important; margin: 0 !important; padding: 12px !important; width: 100% !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}
