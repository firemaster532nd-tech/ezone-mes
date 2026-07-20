import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Plus, Pencil, Trash2, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get<{ data: Dept[] }>('/departments');
      setDepts(res.data);
    } catch {
      toast.error('부서 목록 로드 실패');
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ dept_code: '', dept_name: '', sort_order: 0, parent_dept_id: null });
    setShow(true);
  };

  const openEdit = (d: Dept) => {
    setEditing(d);
    setForm({ dept_code: d.dept_code, dept_name: d.dept_name, sort_order: d.sort_order, parent_dept_id: d.parent_dept_id });
    setShow(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/departments/${editing.dept_id}`, form);
        toast.success(`'${form.dept_name}' 부서가 수정되었습니다.`);
      } else {
        await api.post('/departments', form);
        toast.success(`'${form.dept_name}' 부서가 추가되었습니다.`);
      }
      setShow(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '저장 실패';
      toast.error(msg);
    }
  };

  const remove = async (d: Dept) => {
    if (!confirm(`'${d.dept_name}' 부서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeletingId(d.dept_id);
    try {
      await api.delete(`/departments/${d.dept_id}`);
      toast.success(`'${d.dept_name}' 부서가 삭제되었습니다.`);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '삭제 실패';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // 트리 구조로 정렬 (부모 → 자식)
  const tree = buildTree(depts);

  // 하위 부서 수 맵
  const subDeptCount = new Map<number, number>();
  depts.forEach(d => {
    if (d.parent_dept_id !== null) {
      subDeptCount.set(d.parent_dept_id, (subDeptCount.get(d.parent_dept_id) ?? 0) + 1);
    }
  });

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Building2 className="h-5 w-5" /> 부서 관리 (조직도)
        </h1>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> 부서 추가
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong>소속 직원이 있거나 하위 부서가 있는 경우</strong> 삭제할 수 없습니다.
          먼저 직원의 부서를 다른 부서로 변경하거나, 하위 부서를 삭제해주세요.
        </span>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 border-b">
            <tr>
              <th className="px-4 py-3 text-left">부서명</th>
              <th className="px-3 py-3 text-left">코드</th>
              <th className="px-3 py-3 text-center">소속 인원</th>
              <th className="px-3 py-3 text-center">하위 부서</th>
              <th className="px-3 py-3 text-center">정렬</th>
              <th className="px-3 py-3 text-center w-28">작업</th>
            </tr>
          </thead>
          <tbody>
            {tree.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  등록된 부서가 없습니다.
                </td>
              </tr>
            )}
            {tree.map(({ dept, depth }) => {
              const hasMembers = dept.member_count > 0;
              const hasSubDepts = (subDeptCount.get(dept.dept_id) ?? 0) > 0;
              const canDelete = !hasMembers && !hasSubDepts;
              const isDeleting = deletingId === dept.dept_id;

              return (
                <tr key={dept.dept_id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span style={{ paddingLeft: `${depth * 20}px` }} className="font-medium flex items-center gap-1">
                      {depth > 0 && <span className="text-gray-300 mr-0.5">└</span>}
                      <Building2 size={13} className={depth === 0 ? 'text-blue-500' : 'text-gray-400'} />
                      {dept.dept_name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{dept.dept_code}</td>
                  <td className="px-3 py-2.5 text-center">
                    {hasMembers ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Users size={10} /> {dept.member_count}명
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {hasSubDepts ? (
                      <span className="text-xs text-gray-600 font-medium">{subDeptCount.get(dept.dept_id)}개</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{dept.sort_order}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center gap-1">
                      {/* 수정 버튼 */}
                      <button
                        onClick={() => openEdit(dept)}
                        title="부서 수정"
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => remove(dept)}
                        disabled={!canDelete || isDeleting}
                        title={
                          hasMembers
                            ? `소속 직원 ${dept.member_count}명이 있어 삭제 불가`
                            : hasSubDepts
                            ? `하위 부서 ${subDeptCount.get(dept.dept_id)}개가 있어 삭제 불가`
                            : '부서 삭제'
                        }
                        className={`rounded p-1.5 transition-colors ${
                          canDelete && !isDeleting
                            ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                            : 'text-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {isDeleting ? (
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* 삭제 불가 이유 표시 */}
                    {(hasMembers || hasSubDepts) && (
                      <div className="text-center mt-0.5">
                        <span className="text-[10px] text-gray-400">
                          {hasMembers ? `직원 ${dept.member_count}명` : ''}{hasMembers && hasSubDepts ? ' · ' : ''}{hasSubDepts ? `하위 ${subDeptCount.get(dept.dept_id)}개` : ''}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모달 */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShow(false); }}>
          <form onSubmit={save} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 text-lg font-semibold">{editing ? '부서 수정' : '신규 부서 추가'}</div>
            <div className="space-y-3">
              <Field label="부서코드 *">
                <input
                  type="text"
                  value={form.dept_code}
                  onChange={(e) => setForm({ ...form, dept_code: e.target.value.toUpperCase() })}
                  className="inp font-mono"
                  placeholder="예: PROD, QA, ADMIN"
                  disabled={!!editing}
                  required
                />
                {editing && <p className="text-xs text-gray-400 mt-1">부서코드는 수정할 수 없습니다.</p>}
              </Field>

              <Field label="부서명 *">
                <input
                  type="text"
                  value={form.dept_name}
                  onChange={(e) => setForm({ ...form, dept_name: e.target.value })}
                  className="inp"
                  placeholder="예: 생산팀, 품질팀"
                  required
                />
              </Field>

              <Field label="상위 부서">
                <select
                  value={form.parent_dept_id ?? ''}
                  onChange={(e) => setForm({ ...form, parent_dept_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                  className="inp"
                >
                  <option value="">없음 (최상위)</option>
                  {depts
                    .filter((d) => !editing || d.dept_id !== editing.dept_id)
                    .map((d) => (
                      <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                    ))}
                </select>
              </Field>

              <Field label="정렬순서">
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
                  className="inp"
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .inp { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .inp:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.1); }
        .inp:disabled { background: #f3f4f6; color: #6b7280; }
      `}</style>
    </div>
  );
}

function buildTree(items: Dept[]): Array<{ dept: Dept; depth: number }> {
  const byParent = new Map<number | null, Dept[]>();
  items.forEach((d) => {
    const arr = byParent.get(d.parent_dept_id) ?? [];
    arr.push(d);
    byParent.set(d.parent_dept_id, arr);
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
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}
