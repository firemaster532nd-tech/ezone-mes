import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { Plus, Check, X, Thermometer, Ruler, Eye, Film, Trash2 } from 'lucide-react';

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
  remarks: string | null;
}

interface WorkOrderOption {
  wo_id: number;
  wo_number: string;
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

// 공정별 탭 (자주검사는 공정 기준으로 구분)
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

export function SelfInspectionPage() {
  const [data, setData] = useState<SelfInspection[]>([]);
  const [processFilter, setProcessFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchData = () => {
    const params = processFilter ? `?process_code=${processFilter}` : '';
    api.get<{ data: SelfInspection[] }>(`/self-inspections${params}`).then((res) => setData(res.data));
  };

  useEffect(() => { fetchData(); setSelectedIds(new Set()); }, [processFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/self-inspections/${id}`)));
      setSelectedIds(new Set());
      fetchData();
    } catch { alert('삭제 실패'); }
  };

  // 공정별 건수 집계
  const countByProcess = data.reduce((acc, si) => {
    const pc = si.process_code || 'UNKNOWN';
    acc[pc] = (acc[pc] || 0) + 1;
    return acc;
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
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> 자주검사 등록
          </button>
        </div>
      </PageHeader>

      {/* 공정별 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {['MIX', 'EXT', 'CUT', 'ASM'].map((pc) => (
          <button
            key={pc}
            onClick={() => setProcessFilter(processFilter === pc ? '' : pc)}
            className={cn(
              'bg-white rounded-card border p-3 text-left transition-all',
              processFilter === pc && 'ring-2 ring-process-mix border-process-mix'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <ProcessBadge process={pc as any} />
              <span className="text-lg font-bold">{countByProcess[pc] || 0}</span>
            </div>
            <div className="text-xs text-gray-500">
              {pc === 'MIX' && '중량/온도/외관'}
              {pc === 'EXT' && '6존온도/두께/너비/표면'}
              {pc === 'CUT' && '첫제품치수/외관'}
              {pc === 'ASM' && '접착/체결/틈새/외관'}
            </div>
          </button>
        ))}
      </div>

      {/* 공정 필터 탭 */}
      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setProcessFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              processFilter === tab.key ? 'border-process-mix text-process-mix' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full min-w-[900px] text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-center font-medium text-gray-500 w-8">
                <input type="checkbox"
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(data.map((d) => d.self_insp_id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업지시</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">구분</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">체크포인트</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">기준값</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">공차(±)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">측정값</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">판정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업자</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">시간</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">등록된 자주검사가 없습니다.</td></tr>
            ) : (
              data.map((si) => (
                <tr key={si.self_insp_id} className={cn(
                  'border-b hover:bg-blue-50 transition-colors',
                  si.is_ok === false && 'bg-red-50'
                )}>
                  <td className="px-3 py-3 text-center">
                    <input type="checkbox" checked={selectedIds.has(si.self_insp_id)}
                      onChange={() => toggleSelect(si.self_insp_id)} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{si.wo_number}</td>
                  <td className="px-3 py-3"><ProcessBadge process={si.process_code as any} /></td>
                  <td className="px-3 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', categoryColor[si.check_category] || 'bg-gray-100 text-gray-700')}>
                      {categoryIcon[si.check_category]}
                      {categoryLabel[si.check_category] || si.check_category}
                    </span>
                  </td>
                  <td className="px-3 py-3">{si.check_point || '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {si.standard_value === 1 && si.tolerance === 0 ? 'OK' : si.standard_value ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {si.standard_value === 1 && si.tolerance === 0 ? '-' : `±${si.tolerance ?? '-'}`}
                  </td>
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
                  <td className="px-3 py-3">{si.worker || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {si.check_time ? new Date(si.check_time).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateSelfInspectionModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/**
 * 자주검사 등록 모달
 * 1. 작업지시 선택 → 공정 자동 감지
 * 2. 해당 공정 프리셋 자동 로드
 * 3. 작업자가 측정값 입력
 * 4. 일괄 등록
 */
function CreateSelfInspectionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [woId, setWoId] = useState('');
  const [worker, setWorker] = useState('');
  const [preset, setPreset] = useState<ProcessPreset | null>(null);
  const [items, setItems] = useState<Array<{
    check_category: string;
    check_point: string;
    standard_value: string;
    tolerance: string;
    measured_value: string;
    check_method: string;
    unit: string;
  }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 진행중 + 계획 상태의 작업지시 로드
    api.get<{ data: WorkOrderOption[] }>('/work-orders').then((res) => {
      const filtered = res.data.filter((w: any) => w.status !== 'COMPLETED');
      setWorkOrders(filtered);
    });
  }, []);

  // 작업지시 선택 → 공정 프리셋 자동 로드
  const handleWoChange = async (value: string) => {
    setWoId(value);
    if (!value) { setPreset(null); setItems([]); return; }

    const wo = workOrders.find((w) => String(w.wo_id) === value);
    if (!wo) return;

    try {
      const res = await api.get<{ data: ProcessPreset }>(`/self-inspections/presets/${wo.process_code}`);
      setPreset(res.data);
      setItems(
        res.data.items.map((p) => ({
          check_category: p.check_category,
          check_point: p.check_point,
          standard_value: p.standard_value != null ? String(p.standard_value) : '',
          tolerance: p.tolerance != null ? String(p.tolerance) : '',
          measured_value: '',
          check_method: p.check_method,
          unit: p.unit,
        }))
      );
    } catch {
      setPreset(null);
      setItems([]);
    }
  };

  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const selectedWo = workOrders.find((w) => String(w.wo_id) === woId);

  const handleSubmit = async () => {
    if (!woId) return alert('작업지시를 선택해주세요.');
    const filledItems = items.filter((i) => i.measured_value !== '');
    if (filledItems.length === 0) return alert('최소 1개 항목의 측정값을 입력해주세요.');

    setSaving(true);
    try {
      await api.post('/self-inspections/batch', {
        wo_id: parseInt(woId),
        worker: worker || null,
        items: filledItems.map((i) => ({
          check_category: i.check_category,
          check_point: i.check_point,
          standard_value: i.standard_value ? parseFloat(i.standard_value) : null,
          tolerance: i.tolerance ? parseFloat(i.tolerance) : null,
          measured_value: i.measured_value ? parseFloat(i.measured_value) : null,
        })),
      });
      onSaved();
    } catch {
      alert('등록 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-shop-lg font-bold mb-1">자주검사 등록</h2>
        <p className="text-xs text-gray-500 mb-4">작업지시를 선택하면 해당 공정의 검사항목이 자동으로 로드됩니다.</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">작업지시 선택</label>
            <select value={woId} onChange={(e) => handleWoChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-shop-sm">
              <option value="">작업지시를 선택하세요</option>
              {workOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  {wo.wo_number} ({wo.process_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">작업자</label>
            <input value={worker} onChange={(e) => setWorker(e.target.value)}
              placeholder="작업자명 입력"
              className="w-full border rounded px-3 py-2 text-shop-sm" />
          </div>
        </div>

        {/* 공정 프리셋 정보 */}
        {preset && selectedWo && (
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg mb-4 border',
            selectedWo.process_code === 'MIX' && 'bg-process-mix/5 border-process-mix/30',
            selectedWo.process_code === 'EXT' && 'bg-process-ext/5 border-process-ext/30',
            selectedWo.process_code === 'CUT' && 'bg-process-cut/5 border-process-cut/30',
            selectedWo.process_code === 'ASM' && 'bg-process-asm/5 border-process-asm/30',
          )}>
            <ProcessBadge process={selectedWo.process_code as any} />
            <div>
              <div className="text-shop-sm font-medium">{preset.label}</div>
              <div className="text-xs text-gray-500">{preset.description} ({preset.items.length}개 항목)</div>
            </div>
          </div>
        )}

        {/* 검사항목 테이블 */}
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
                          {categoryIcon[item.check_category]}
                          {categoryLabel[item.check_category]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-medium">{item.check_point}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-500">{item.check_method}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">
                        {isVisual ? (
                          <span className="text-green-600">OK 기준</span>
                        ) : (
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
                            <button
                              onClick={() => updateItem(idx, 'measured_value', '1')}
                              className={cn(
                                'px-3 py-1 rounded text-xs font-medium border transition-colors',
                                item.measured_value === '1' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'
                              )}
                            >
                              OK
                            </button>
                            <button
                              onClick={() => updateItem(idx, 'measured_value', '0')}
                              className={cn(
                                'px-3 py-1 rounded text-xs font-medium border transition-colors',
                                item.measured_value === '0' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                              )}
                            >
                              NG
                            </button>
                          </div>
                        ) : (
                          <input
                            type="number"
                            value={item.measured_value}
                            onChange={(e) => updateItem(idx, 'measured_value', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-right text-shop-sm"
                            placeholder={item.unit}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!woId && (
          <div className="text-center py-8 text-gray-400 text-shop-sm">
            작업지시를 선택하면 해당 공정의 자주검사 항목이 자동으로 표시됩니다.
          </div>
        )}

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
