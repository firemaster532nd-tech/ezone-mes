import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';

interface Dept {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  parent_dept_id: number | null;
  sort_order: number;
  is_active: boolean;
  member_count: number;
}

export function DepartmentsPage() {
  const { isAdmin } = useAuth();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({ dept_code: '', dept_name: '', sort_order: 0, parent_dept_id: null as number | null });
  const [show, setShow] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const res = await api.get<{ data: Dept[] }>('/departments');
    setDepts(res.data);
  };

  const openNew = () => { setEditing(null); setForm({ dept_code: '', dept_name: '', sort_order: 0, parent_dept_id: null }); setShow(true); };
  const openEdit = (d: Dept) => {
    setEditing(d);
    setForm({ dept_code: d.dept_code, dept_name: d.dept_name, sort_order: d.sort_order, parent_dept_id: d.parent_dept_id });
    setShow(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/departments/${editing.dept_id}`, form);
      else await api.post('/departments', form);
      setShow(false);
      load();
    } catch { alert('저장 실패'); }
  };

  const remove = async (d: Dept) => {
    if (!confirm(`'${d.dept_name}' 부서를 비활성화 하시겠습니까?`)) return;
    await api.delete(`/departments/${d.dept_id}`);
    load();
  };

  // 트리 구조로 정렬 (부모 → 자식)
  const tree = buildTree(depts);

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Building2 className="h-5 w-5" /> 부서 관리 (조직도)</h1>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> 부서 추가
        </button>
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">부서명</th>
              <th className="px-3 py-2 text-left">코드</th>
              <th className="px-3 py-2 text-center">소속 인원</th>
              <th className="px-3 py-2 text-center">정렬</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-center w-24">작업</th>
            </tr>
          </thead>
          <tbody>
            {tree.map(({ dept, depth }) => (
              <tr key={dept.dept_id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span style={{ paddingLeft: `${depth * 16}px` }} className="font-medium">
                    {depth > 0 && <span className="text-gray-300 mr-1">└</span>}
                    {dept.dept_name}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{dept.dept_code}</td>
                <td className="px-3 py-2 text-center">{dept.member_count}</td>
                <td className="px-3 py-2 text-center text-gray-500">{dept.sort_order}</td>
                <td className="px-3 py-2 text-center">
                  {dept.is_active
                    ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">활성</span>
                    : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">비활성</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => openEdit(dept)} className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(dept)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 text-lg font-semibold">{editing ? '부서 수정' : '신규 부서'}</div>
            <div className="space-y-3">
              <Field label="부서코드 *"><input type="text" value={form.dept_code} onChange={(e) => setForm({ ...form, dept_code: e.target.value.toUpperCase() })} className="inp font-mono" disabled={!!editing} /></Field>
              <Field label="부서명 *"><input type="text" value={form.dept_name} onChange={(e) => setForm({ ...form, dept_name: e.target.value })} className="inp" /></Field>
              <Field label="상위 부서">
                <select value={form.parent_dept_id ?? ''} onChange={(e) => setForm({ ...form, parent_dept_id: e.target.value ? parseInt(e.target.value, 10) : null })} className="inp">
                  <option value="">없음 (최상위)</option>
                  {depts.filter((d) => !editing || d.dept_id !== editing.dept_id).map((d) => (
                    <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="정렬순서"><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })} className="inp" /></Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShow(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">취소</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">저장</button>
            </div>
          </form>
        </div>
      )}

      <style>{`.inp { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .inp:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.1); } .inp:disabled { background: #f3f4f6; }`}</style>
    </div>
  );
}

function buildTree(items: Dept[]): Array<{ dept: Dept; depth: number }> {
  const byParent = new Map<number | null, Dept[]>();
  items.forEach((d) => {
    const arr = byParent.get(d.parent_dept_id) ?? [];
    arr.push(d); byParent.set(d.parent_dept_id, arr);
  });
  const out: Array<{ dept: Dept; depth: number }> = [];
  const walk = (parentId: number | null, depth: number) => {
    const arr = byParent.get(parentId) ?? [];
    arr.sort((a, b) => a.sort_order - b.sort_order || a.dept_code.localeCompare(b.dept_code));
    for (const d of arr) { out.push({ dept: d, depth }); walk(d.dept_id, depth + 1); }
  };
  walk(null, 0);
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}
