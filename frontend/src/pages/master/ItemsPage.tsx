import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { Search, X, Plus, Pencil, Trash2, Package } from 'lucide-react';

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  item_category: string;
  item_subcategory: string | null;
  spec: string | null;
  unit: string;
  cert_min_density: number | null;
  cert_min_thickness: number | null;
  cert_min_mass: number | null;
  production_value: number | null;
  tolerance_plus: number | null;
  value_direction: string | null;
  safety_stock: number;
  is_active: boolean;
  roll_length_m: number | null;
  roll_spec: string | null;
}

const categoryTabs = [
  { key: '', label: '전체' },
  { key: 'RM', label: '원재료' },
  { key: 'SM', label: '부자재' },
  { key: 'SA', label: '반제품' },
  { key: 'FP', label: '완제품' },
];

const categoryColors: Record<string, string> = {
  RM: 'bg-blue-50 text-blue-700',
  SM: 'bg-purple-50 text-purple-700',
  SA: 'bg-teal-50 text-teal-700',
  FP: 'bg-orange-50 text-orange-700',
};

const categoryLabels: Record<string, string> = {
  RM: '원재료', SM: '부자재', SA: '반제품', FP: '완제품',
};

export function ItemsPage() {
  const [data, setData] = useState<Item[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchData = () => {
    const params = new URLSearchParams();
    if (filter) params.set('category', filter);
    if (search) params.set('search', search);
    const qs = params.toString();
    api.get<{ data: Item[] }>(`/items${qs ? `?${qs}` : ''}`).then((res) => setData(res.data));
  };

  useEffect(fetchData, [filter, search]);

  const handleSave = async (itemId: number, updates: Partial<Item>) => {
    try {
      await api.patch(`/items/${itemId}`, updates);
      toast.success('품목이 수정되었습니다.');
      setEditItem(null);
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || '수정 실패');
    }
  };

  const handleCreate = async (newItem: Partial<Item>) => {
    try {
      await api.post('/items', newItem);
      toast.success('품목이 등록되었습니다.');
      setShowAddForm(false);
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || '등록 실패');
    }
  };

  const handleDelete = async (itemId: number, itemCode: string) => {
    if (!confirm(`${itemCode} 품목을 비활성화하시겠습니까?`)) return;
    try {
      await api.delete(`/items/${itemId}`);
      toast.success('품목이 비활성화되었습니다.');
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || '삭제 실패');
    }
  };

  return (
    <div>
      <PageHeader title="품목 관리" count={data.length} description="원재료·부자재·반제품·완제품 기초 등록 및 관리" />

      {/* Filter Tabs + Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 border-b">
          {categoryTabs.map((tab) => (
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
              {tab.key && (
                <span className="ml-1 text-[10px] text-gray-400">
                  ({data.filter(d => tab.key ? d.item_category === tab.key : true).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="품목코드 또는 품목명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-input text-shop-sm w-64 focus:outline-none focus:ring-2 focus:ring-process-mix/20 focus:border-process-mix"
            />
          </div>
          {/* Add Button */}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-process-mix text-white text-shop-sm font-medium rounded-button hover:bg-blue-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            신규 등록
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">품목코드</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">품목명</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">분류</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">세분류</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">규격</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">단위</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">롤 길이</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">안전재고</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">관리</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.item_id}
                className="border-b hover:bg-blue-50/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{item.item_code}</td>
                <td className="px-4 py-3 font-medium">{item.item_name}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', categoryColors[item.item_category])}>
                    {categoryLabels[item.item_category] || item.item_category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.item_subcategory ?? '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={item.spec ?? ''}>
                  {item.spec ?? '-'}
                </td>
                <td className="px-4 py-3 text-center">{item.unit}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {item.roll_length_m ? (
                    <span className="text-indigo-600" title={item.roll_spec || ''}>
                      {Number(item.roll_length_m)}M/롤
                    </span>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono">{Number(item.safety_stock)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1.5 rounded hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
                      title="수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.item_id, item.item_code); }}
                      className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                      title="비활성화"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  등록된 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <ItemFormModal
          mode="edit"
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={(updates) => handleSave(editItem.item_id, updates)}
        />
      )}

      {/* Add Modal */}
      {showAddForm && (
        <ItemFormModal
          mode="add"
          onClose={() => setShowAddForm(false)}
          onSave={(newItem) => handleCreate(newItem)}
        />
      )}
    </div>
  );
}

/* ─── 품목 등록/수정 통합 모달 ─── */
function ItemFormModal({
  mode,
  item,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit';
  item?: Item;
  onClose: () => void;
  onSave: (data: Partial<Item>) => void;
}) {
  const [form, setForm] = useState({
    item_code: item?.item_code ?? '',
    item_name: item?.item_name ?? '',
    item_category: item?.item_category ?? 'SM',
    item_subcategory: item?.item_subcategory ?? '',
    spec: item?.spec ?? '',
    unit: item?.unit ?? 'EA',
    cert_min_density: item?.cert_min_density != null ? String(item.cert_min_density) : '',
    cert_min_thickness: item?.cert_min_thickness != null ? String(item.cert_min_thickness) : '',
    cert_min_mass: item?.cert_min_mass != null ? String(item.cert_min_mass) : '',
    production_value: item?.production_value != null ? String(item.production_value) : '',
    tolerance_plus: item?.tolerance_plus != null ? String(item.tolerance_plus) : '',
    value_direction: item?.value_direction ?? '',
    safety_stock: item?.safety_stock != null ? String(item.safety_stock) : '0',
    roll_length_m: item?.roll_length_m != null ? String(item.roll_length_m) : '',
    roll_spec: item?.roll_spec ?? '',
  });

  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    if (!form.item_code.trim() || !form.item_name.trim()) {
      toast.error('품목코드와 품목명은 필수입니다.');
      return;
    }
    const data: any = {
      item_code: form.item_code.trim(),
      item_name: form.item_name.trim(),
      item_category: form.item_category,
      item_subcategory: form.item_subcategory || null,
      spec: form.spec || null,
      unit: form.unit,
      cert_min_density: form.cert_min_density ? Number(form.cert_min_density) : null,
      cert_min_thickness: form.cert_min_thickness ? Number(form.cert_min_thickness) : null,
      cert_min_mass: form.cert_min_mass ? Number(form.cert_min_mass) : null,
      production_value: form.production_value ? Number(form.production_value) : null,
      tolerance_plus: form.tolerance_plus ? Number(form.tolerance_plus) : null,
      value_direction: form.value_direction || null,
      safety_stock: Number(form.safety_stock) || 0,
      roll_length_m: form.roll_length_m ? Number(form.roll_length_m) : null,
      roll_spec: form.roll_spec || null,
    };
    onSave(data);
  };

  const isRollable = form.unit === 'M' || form.unit === 'm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-process-mix" />
            {mode === 'add' ? '품목 신규 등록' : '품목 수정'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">기본 정보</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="품목코드 *" value={form.item_code} onChange={(v) => set('item_code', v)}
                disabled={mode === 'edit'} placeholder="예: SM-CW-128" mono />
              <Field label="품목명 *" value={form.item_name} onChange={(v) => set('item_name', v)}
                placeholder="예: 세라믹차열재(128K)" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">분류 *</label>
                <select
                  value={form.item_category}
                  onChange={(e) => set('item_category', e.target.value)}
                  disabled={mode === 'edit'}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-process-mix/20 disabled:bg-gray-100"
                >
                  <option value="RM">원재료 (RM)</option>
                  <option value="SM">부자재 (SM)</option>
                  <option value="SA">반제품 (SA)</option>
                  <option value="FP">완제품 (FP)</option>
                </select>
              </div>
              <Field label="세분류" value={form.item_subcategory} onChange={(v) => set('item_subcategory', v)}
                placeholder="예: 세라믹차열재" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">단위 *</label>
                <select
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-process-mix/20"
                >
                  <option value="EA">EA (개)</option>
                  <option value="M">M (미터)</option>
                  <option value="m">m (미터)</option>
                  <option value="kg">kg (킬로그램)</option>
                  <option value="SET">SET (세트)</option>
                  <option value="매">매</option>
                  <option value="롤">롤</option>
                </select>
              </div>
            </div>
            <Field label="규격" value={form.spec} onChange={(v) => set('spec', v)}
              placeholder="예: 밀도128kg/m3, t50, W600" />
          </div>

          {/* 인정 기준값 */}
          <div className="bg-blue-50/50 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">인정 기준값</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="인정최소밀도 (kg/m3)" type="number" value={form.cert_min_density}
                onChange={(v) => set('cert_min_density', v)} placeholder="예: 128" mono />
              <Field label="인정최소두께 (mm)" type="number" value={form.cert_min_thickness}
                onChange={(v) => set('cert_min_thickness', v)} placeholder="예: 0.5" mono />
              <Field label="인정최소질량 (g)" type="number" value={form.cert_min_mass}
                onChange={(v) => set('cert_min_mass', v)} placeholder="" mono />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="생산관리값" type="number" value={form.production_value}
                onChange={(v) => set('production_value', v)} placeholder="" mono />
              <Field label="공차 (+)" type="number" value={form.tolerance_plus}
                onChange={(v) => set('tolerance_plus', v)} placeholder="" mono />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기준방향</label>
                <select
                  value={form.value_direction}
                  onChange={(e) => set('value_direction', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-process-mix/20"
                >
                  <option value="">-</option>
                  <option value="MIN">MIN (이상)</option>
                  <option value="MAX">MAX (이하)</option>
                  <option value="RANGE">RANGE (범위)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 재고 & 롤 정보 */}
          <div className="bg-purple-50/50 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wider">재고 / 롤 정보</h4>
            <div className="grid grid-cols-3 gap-3">
              <Field label="안전재고" type="number" value={form.safety_stock}
                onChange={(v) => set('safety_stock', v)} placeholder="0" mono />
              <Field label={`롤 길이 (M/롤)${isRollable ? '' : ' - 단위 M일 때 사용'}`}
                type="number" value={form.roll_length_m}
                onChange={(v) => set('roll_length_m', v)} placeholder="예: 3.6" mono
                disabled={!isRollable} />
              <Field label="롤 규격 상세" value={form.roll_spec}
                onChange={(v) => set('roll_spec', v)}
                placeholder="예: t50/W600=3.6M, t38/W400=4.8M"
                disabled={!isRollable} />
            </div>
            {isRollable && form.roll_length_m && (
              <div className="text-xs text-purple-600 bg-purple-100 rounded px-3 py-1.5">
                BOM 산출 시 M 단위 소요량을 <strong>{form.roll_length_m}M/롤</strong> 기준으로 롤 수량 자동 환산
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 text-sm rounded-lg bg-process-mix text-white hover:bg-blue-800 font-medium"
          >
            {mode === 'add' ? '등록' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 필드 컴포넌트 ─── */
function Field({
  label, value, onChange, placeholder, disabled, type, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string; mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-process-mix/20',
          disabled && 'bg-gray-100 text-gray-500',
          mono && 'font-mono',
        )}
      />
    </div>
  );
}
