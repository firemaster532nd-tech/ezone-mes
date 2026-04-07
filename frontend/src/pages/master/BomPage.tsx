import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { toast } from 'sonner';
import { Plus, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

/* ========== Types ========== */
interface BomItem {
  bom_item_id: number;
  bom_id: number;
  item_id: number | null;
  component_name: string;
  qty: number;
  unit: string;
  spec_detail: string | null;
  is_key_material: boolean;
  sort_order: number;
  item_code?: string;
  item_name?: string;
}

interface Bom {
  bom_id: number;
  bom_code: string;
  bom_name: string;
  process_code: string;
  cert_id: number | null;
  output_item_id: number | null;
  output_qty: number;
  output_unit: string;
  loss_rate: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  cert_number?: string;
  output_item_name?: string;
  item_count?: number;
  items?: BomItem[];
}

interface ItemOption {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
}

interface CertOption {
  cert_id: number;
  cert_number: string;
  structure_code: string;
}

/* ========== Constants ========== */
const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합(MIX)' },
  { key: 'EXT', label: '압출(EXT)' },
  { key: 'CUT', label: '재단(CUT)' },
  { key: 'ASM', label: '조립(ASM)' },
  { key: 'SHP', label: '출하(SHP)' },
];

/* ========== Main Component ========== */
export function BomPage() {
  const [data, setData] = useState<Bom[]>([]);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Bom | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, BomItem[]>>({});

  const fetchData = () => {
    const params = filter ? `?process_code=${filter}` : '';
    api.get<{ data: Bom[] }>(`/process-bom${params}`)
      .then((res) => setData(Array.isArray(res.data) ? res.data : (res as any).data?.data ?? []))
      .catch(() => setData([]));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const toggleExpand = async (bomId: number) => {
    if (expandedId === bomId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(bomId);
    if (!expandedItems[bomId]) {
      try {
        const res = await api.get<{ data: Bom }>(`/process-bom/${bomId}`);
        const detail = (res as any).data?.data ?? (res as any).data;
        if (detail?.items) {
          setExpandedItems((prev) => ({ ...prev, [bomId]: detail.items }));
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div>
      <PageHeader title="공정별 BOM 관리" count={data.length} description="공정별 자재 투입 기준 관리">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> BOM 등록
        </button>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key
                ? 'border-process-mix text-process-mix'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500 w-8"></th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">BOM코드</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">BOM명</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">산출품목</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">산출량</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">로스율</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">자재수</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  등록된 BOM이 없습니다. 'BOM 등록' 버튼을 눌러 추가하세요.
                </td>
              </tr>
            ) : (
              data.map((bom) => (
                <>
                  <tr
                    key={bom.bom_id}
                    className="border-b hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(bom.bom_id)}
                  >
                    <td className="px-4 py-3">
                      {expandedId === bom.bom_id
                        ? <ChevronUp size={14} className="text-gray-400" />
                        : <ChevronDown size={14} className="text-gray-400" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{bom.bom_code}</td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTarget(bom); }}
                        className="text-blue-600 hover:underline"
                      >
                        {bom.bom_name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <ProcessBadge process={bom.process_code} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{bom.output_item_name ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{bom.output_qty} {bom.output_unit}</td>
                    <td className="px-4 py-3 text-right font-mono">{bom.loss_rate}%</td>
                    <td className="px-4 py-3 text-center">{bom.item_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        bom.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {bom.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                  </tr>
                  {expandedId === bom.bom_id && (
                    <tr key={`${bom.bom_id}-items`}>
                      <td colSpan={9} className="px-8 py-3 bg-gray-50 border-b">
                        <div className="text-xs font-medium text-gray-500 mb-2">BOM 구성요소</div>
                        {expandedItems[bom.bom_id] && expandedItems[bom.bom_id].length > 0 ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="px-3 py-1.5 text-left text-gray-500">순서</th>
                                <th className="px-3 py-1.5 text-left text-gray-500">구성요소명</th>
                                <th className="px-3 py-1.5 text-left text-gray-500">자재</th>
                                <th className="px-3 py-1.5 text-right text-gray-500">수량</th>
                                <th className="px-3 py-1.5 text-left text-gray-500">단위</th>
                                <th className="px-3 py-1.5 text-left text-gray-500">규격상세</th>
                                <th className="px-3 py-1.5 text-center text-gray-500">핵심자재</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expandedItems[bom.bom_id].map((item) => (
                                <tr key={item.bom_item_id} className="border-b border-gray-100">
                                  <td className="px-3 py-1.5 font-mono">{item.sort_order}</td>
                                  <td className="px-3 py-1.5 font-medium">{item.component_name}</td>
                                  <td className="px-3 py-1.5 text-gray-600">
                                    {item.item_name ? `${item.item_code} - ${item.item_name}` : '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-mono">{item.qty}</td>
                                  <td className="px-3 py-1.5">{item.unit}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{item.spec_detail ?? '-'}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {item.is_key_material
                                      ? <span className="text-orange-600 font-medium">Y</span>
                                      : <span className="text-gray-400">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-gray-400 py-2">구성요소가 없습니다.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <BomModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchData(); }}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <BomModal
          bom={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); setExpandedId(null); setExpandedItems({}); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ========== BOM Create/Edit Modal ========== */
interface BomItemForm {
  bom_item_id?: number;
  item_id: string;
  component_name: string;
  qty: string;
  unit: string;
  spec_detail: string;
  is_key_material: boolean;
  sort_order: number;
}

function BomModal({ bom, onClose, onSaved }: { bom?: Bom; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!bom;
  const [form, setForm] = useState({
    bom_code: bom?.bom_code ?? '',
    bom_name: bom?.bom_name ?? '',
    process_code: bom?.process_code ?? 'MIX',
    cert_id: bom?.cert_id?.toString() ?? '',
    output_item_id: bom?.output_item_id?.toString() ?? '',
    output_qty: bom?.output_qty?.toString() ?? '1',
    output_unit: bom?.output_unit ?? 'kg',
    loss_rate: bom?.loss_rate?.toString() ?? '0',
    description: bom?.description ?? '',
    is_active: bom?.is_active ?? true,
  });

  const [items, setItems] = useState<BomItemForm[]>([]);
  const [allItems, setAllItems] = useState<ItemOption[]>([]);
  const [certs, setCerts] = useState<CertOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    api.get<{ data: ItemOption[] }>('/items').then((r) => setAllItems(r.data));
    api.get<{ data: CertOption[] }>('/certifications').then((r) => setCerts(r.data));
  }, []);

  // Load existing BOM items for edit
  useEffect(() => {
    if (bom) {
      setLoadingDetail(true);
      api.get<{ data: Bom }>(`/process-bom/${bom.bom_id}`)
        .then((res) => {
          const detail = (res as any).data?.data ?? (res as any).data;
          if (detail?.items) {
            setItems(detail.items.map((it: BomItem) => ({
              bom_item_id: it.bom_item_id,
              item_id: it.item_id?.toString() ?? '',
              component_name: it.component_name,
              qty: it.qty.toString(),
              unit: it.unit,
              spec_detail: it.spec_detail ?? '',
              is_key_material: it.is_key_material,
              sort_order: it.sort_order,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDetail(false));
    }
  }, [bom]);

  const addItem = () => {
    setItems([...items, {
      item_id: '',
      component_name: '',
      qty: '1',
      unit: 'kg',
      spec_detail: '',
      is_key_material: false,
      sort_order: items.length + 1,
    }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        // Update basic info
        await api.patch(`/process-bom/${bom!.bom_id}`, {
          bom_code: form.bom_code,
          bom_name: form.bom_name,
          process_code: form.process_code,
          cert_id: form.cert_id ? parseInt(form.cert_id) : null,
          output_item_id: form.output_item_id ? parseInt(form.output_item_id) : null,
          output_qty: parseFloat(form.output_qty),
          output_unit: form.output_unit,
          loss_rate: parseFloat(form.loss_rate),
          description: form.description || null,
          is_active: form.is_active,
        });

        // Sync items: delete removed, update existing, add new
        const existingIds = new Set(items.filter(i => i.bom_item_id).map(i => i.bom_item_id!));
        // We'll handle items by adding new ones and updating existing ones
        for (const item of items) {
          const payload = {
            item_id: item.item_id ? parseInt(item.item_id) : null,
            component_name: item.component_name,
            qty: parseFloat(item.qty),
            unit: item.unit,
            spec_detail: item.spec_detail || null,
            is_key_material: item.is_key_material,
            sort_order: item.sort_order,
          };
          if (item.bom_item_id) {
            await api.patch(`/process-bom/items/${item.bom_item_id}`, payload);
          } else {
            await api.post(`/process-bom/${bom!.bom_id}/items`, payload);
          }
        }
        toast.success('BOM이 수정되었습니다.');
      } else {
        // Create new BOM with items
        await api.post('/process-bom', {
          bom_code: form.bom_code,
          bom_name: form.bom_name,
          process_code: form.process_code,
          cert_id: form.cert_id ? parseInt(form.cert_id) : null,
          output_item_id: form.output_item_id ? parseInt(form.output_item_id) : null,
          output_qty: parseFloat(form.output_qty),
          output_unit: form.output_unit,
          loss_rate: parseFloat(form.loss_rate),
          description: form.description || null,
          items: items.map((it, idx) => ({
            item_id: it.item_id ? parseInt(it.item_id) : null,
            component_name: it.component_name,
            qty: parseFloat(it.qty),
            unit: it.unit,
            spec_detail: it.spec_detail || null,
            is_key_material: it.is_key_material,
            sort_order: idx + 1,
          })),
        });
        toast.success('BOM이 등록되었습니다.');
      }
      onSaved();
    } catch {
      alert(isEdit ? '수정 실패' : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (bomItemId: number, idx: number) => {
    if (isEdit && bomItemId) {
      try {
        await api.delete(`/process-bom/items/${bomItemId}`);
        toast.success('구성요소가 삭제되었습니다.');
      } catch {
        alert('삭제 실패');
        return;
      }
    }
    removeItem(idx);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-shop-lg font-bold">{isEdit ? 'BOM 수정' : 'BOM 등록'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">BOM코드</span>
              <input
                type="text"
                value={form.bom_code}
                onChange={(e) => setForm({ ...form, bom_code: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                placeholder="예: BOM-MIX-001"
                required
              />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">BOM명</span>
              <input
                type="text"
                value={form.bom_name}
                onChange={(e) => setForm({ ...form, bom_name: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                placeholder="예: 기본 배합 BOM"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">공정</span>
              <select
                value={form.process_code}
                onChange={(e) => setForm({ ...form, process_code: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              >
                <option value="MIX">배합(MIX)</option>
                <option value="EXT">압출(EXT)</option>
                <option value="CUT">재단(CUT)</option>
                <option value="ASM">조립(ASM)</option>
                <option value="SHP">출하(SHP)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">인정구조</span>
              <select
                value={form.cert_id}
                onChange={(e) => setForm({ ...form, cert_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              >
                <option value="">선택 안함</option>
                {certs.map((c) => (
                  <option key={c.cert_id} value={c.cert_id}>
                    {c.cert_number} ({c.structure_code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">산출품목</span>
              <select
                value={form.output_item_id}
                onChange={(e) => setForm({ ...form, output_item_id: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              >
                <option value="">선택 안함</option>
                {allItems.map((i) => (
                  <option key={i.item_id} value={i.item_id}>
                    {i.item_code} - {i.item_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">산출량</span>
              <input
                type="number"
                step="0.01"
                value={form.output_qty}
                onChange={(e) => setForm({ ...form, output_qty: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">단위</span>
              <input
                type="text"
                value={form.output_unit}
                onChange={(e) => setForm({ ...form, output_unit: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
                placeholder="kg, m, ea"
              />
            </label>
            <label className="block">
              <span className="text-shop-sm font-medium text-gray-700">로스율(%)</span>
              <input
                type="number"
                step="0.1"
                value={form.loss_rate}
                onChange={(e) => setForm({ ...form, loss_rate: e.target.value })}
                className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-shop-sm font-medium text-gray-700">활성</span>
            </label>
          </div>

          <label className="block">
            <span className="text-shop-sm font-medium text-gray-700">설명</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-shop-sm"
              rows={2}
            />
          </label>

          {/* Items Table */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-shop-sm font-bold text-gray-800">BOM 구성요소</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-md text-blue-600 hover:bg-blue-50"
              >
                <Plus size={14} /> 구성요소 추가
              </button>
            </div>

            {loadingDetail ? (
              <div className="text-shop-sm text-gray-400 py-4 text-center">로딩 중...</div>
            ) : items.length === 0 ? (
              <div className="text-shop-sm text-gray-400 py-4 text-center border rounded-lg">
                구성요소가 없습니다. '구성요소 추가' 버튼을 눌러 추가하세요.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-gray-500">#</th>
                      <th className="px-2 py-2 text-left text-gray-500">구성요소명</th>
                      <th className="px-2 py-2 text-left text-gray-500">자재</th>
                      <th className="px-2 py-2 text-right text-gray-500">수량</th>
                      <th className="px-2 py-2 text-left text-gray-500">단위</th>
                      <th className="px-2 py-2 text-left text-gray-500">규격상세</th>
                      <th className="px-2 py-2 text-center text-gray-500">핵심</th>
                      <th className="px-2 py-2 text-center text-gray-500 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5 font-mono text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={item.component_name}
                            onChange={(e) => updateItem(idx, 'component_name', e.target.value)}
                            className="w-full rounded border px-2 py-1 text-xs"
                            placeholder="구성요소명"
                            required
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={item.item_id}
                            onChange={(e) => {
                              const selectedItem = allItems.find(i => i.item_id === parseInt(e.target.value));
                              updateItem(idx, 'item_id', e.target.value);
                              if (selectedItem && !item.unit) {
                                updateItem(idx, 'unit', selectedItem.unit);
                              }
                            }}
                            className="w-full rounded border px-2 py-1 text-xs"
                          >
                            <option value="">선택 안함</option>
                            {allItems.map((i) => (
                              <option key={i.item_id} value={i.item_id}>
                                {i.item_code} - {i.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                            className="w-20 rounded border px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                            className="w-16 rounded border px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={item.spec_detail}
                            onChange={(e) => updateItem(idx, 'spec_detail', e.target.value)}
                            className="w-full rounded border px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.is_key_material}
                            onChange={(e) => updateItem(idx, 'is_key_material', e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.bom_item_id!, idx)}
                            className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">취소</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
