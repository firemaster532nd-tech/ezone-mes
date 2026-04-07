import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

interface Worker { worker_id: number; worker_name: string; position: string; role: string; }
interface ApprovalLine {
  line_id: number; doc_type: string; line_name: string;
  reviewer_id: number; approver_id: number;
  reviewer_name: string; reviewer_position: string;
  approver_name: string; approver_position: string;
  is_active: boolean;
}

const DOC_TYPES = [
  { value: 'INCOMING_INSP', label: '인수검사' },
  { value: 'PROCESS_INSP', label: '중간검사' },
  { value: 'SELF_INSP', label: '자주검사' },
  { value: 'SHIPMENT', label: '출하' },
  { value: 'WORK_ORDER', label: '작업지시' },
  { value: 'DAILY_LOG', label: '공정일지' },
  { value: 'TBM', label: 'TBM' },
  { value: 'INVENTORY', label: '재고' },
  { value: 'PURCHASE_REQUEST', label: '자재발주서' },
];

export function ApprovalLinePage() {
  const [lines, setLines] = useState<ApprovalLine[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ doc_type: 'INCOMING_INSP', line_name: '', reviewer_id: '', approver_id: '' });

  const fetchData = async () => {
    const [lRes, wRes] = await Promise.all([
      api.get<{ data: ApprovalLine[] }>('/approval-lines'),
      api.get<{ data: Worker[] }>('/workers?is_active=true'),
    ]);
    setLines(lRes.data);
    setWorkers(wRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const mgrs = workers.filter((w) => w.role === 'admin' || w.role === 'manager');

  const resetForm = () => {
    setForm({ doc_type: 'INCOMING_INSP', line_name: '', reviewer_id: '', approver_id: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.reviewer_id || !form.approver_id) return;
    const body = {
      doc_type: form.doc_type,
      line_name: form.line_name || DOC_TYPES.find((d) => d.value === form.doc_type)?.label,
      reviewer_id: parseInt(form.reviewer_id),
      approver_id: parseInt(form.approver_id),
    };
    if (editingId) {
      await api.patch(`/approval-lines/${editingId}`, body);
    } else {
      await api.post('/approval-lines', body);
    }
    resetForm();
    fetchData();
  };

  const handleEdit = (l: ApprovalLine) => {
    setForm({
      doc_type: l.doc_type,
      line_name: l.line_name || '',
      reviewer_id: String(l.reviewer_id),
      approver_id: String(l.approver_id),
    });
    setEditingId(l.line_id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('결재 라인을 삭제하시겠습니까?')) return;
    await api.delete(`/approval-lines/${id}`);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결재 라인 설정</h1>
          <p className="mt-1 text-sm text-gray-500">문서 유형별 검토자/승인자를 지정합니다. (작성 → 검토 → 승인)</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> 결재 라인 추가
        </button>
      </div>

      {/* 워크플로우 설명 */}
      <div className="rounded-xl border bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-blue-800">결재 흐름</h3>
        <div className="flex items-center gap-3 text-sm text-blue-700">
          <span className="rounded-lg bg-white border border-blue-200 px-3 py-1.5 font-medium">
            ① 실무자 작성
          </span>
          <span className="text-blue-400">→</span>
          <span className="rounded-lg bg-white border border-yellow-300 px-3 py-1.5 font-medium">
            ② 직무책임 검토
          </span>
          <span className="text-blue-400">→</span>
          <span className="rounded-lg bg-white border border-green-300 px-3 py-1.5 font-medium">
            ③ 파트장 승인
          </span>
        </div>
      </div>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold">{editingId ? '결재 라인 수정' : '새 결재 라인'}</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">문서 유형</label>
              <select
                value={form.doc_type}
                onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">라인명 (선택)</label>
              <input
                type="text"
                value={form.line_name}
                onChange={(e) => setForm({ ...form, line_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="자동 생성됨"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">검토자 (직무책임) *</label>
              <select
                value={form.reviewer_id}
                onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {workers.map((w) => (
                  <option key={w.worker_id} value={w.worker_id}>
                    {w.worker_name} ({w.position || w.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">승인자 (파트장) *</label>
              <select
                value={form.approver_id}
                onChange={(e) => setForm({ ...form, approver_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {mgrs.map((w) => (
                  <option key={w.worker_id} value={w.worker_id}>
                    {w.worker_name} ({w.position || w.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <X className="inline h-4 w-4 mr-1" />취소
            </button>
            <button
              onClick={handleSave}
              disabled={!form.reviewer_id || !form.approver_id}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              <Save className="inline h-4 w-4 mr-1" />{editingId ? '수정' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 결재 라인 목록 */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">문서 유형</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">라인명</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">검토자</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">승인자</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">상태</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">등록된 결재 라인이 없습니다.</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.line_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {DOC_TYPES.find((d) => d.value === l.doc_type)?.label || l.doc_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.line_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-700 font-medium">{l.reviewer_name}</span>
                    <span className="text-xs text-gray-400 ml-1">({l.reviewer_position || '-'})</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-blue-700 font-medium">{l.approver_name}</span>
                    <span className="text-xs text-gray-400 ml-1">({l.approver_position || '-'})</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {l.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleEdit(l)} className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(l.line_id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
