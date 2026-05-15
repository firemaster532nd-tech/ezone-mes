import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Plus, KeyRound, UserCheck } from 'lucide-react';

interface UserRow {
  worker_id: number;
  employee_no: string | null;
  worker_name: string;
  role: 'admin' | 'manager' | 'worker';
  position: string | null;
  email: string | null;
  dept_id: number | null;
  is_active: boolean;
}

interface DeptRow {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  member_count?: number;
}

const ROLE_LABELS: Record<string, string> = { admin: '관리자', manager: '매니저', worker: '작업자' };

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [activeDept, setActiveDept] = useState<number | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_no: '', worker_name: '', password: '', dept_id: 0,
    role: 'worker' as 'admin' | 'manager' | 'worker', position: '', email: '', phone: '',
  });
  const [error, setError] = useState('');

  useEffect(() => { loadDepts(); }, []);
  useEffect(() => { if (activeDept != null) loadMembers(activeDept); }, [activeDept]);

  const loadDepts = async () => {
    const res = await api.get<{ data: DeptRow[] }>('/departments');
    setDepts(res.data);
    if (res.data.length && activeDept == null) setActiveDept(res.data[0].dept_id);
  };

  const loadMembers = async (dept_id: number) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: UserRow[] }>(`/departments/${dept_id}/members`);
      setUsers(res.data);
    } finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.employee_no || !form.worker_name || !form.password) { setError('필수 항목을 입력하세요.'); return; }
    if (!form.dept_id) { setError('부서를 선택하세요.'); return; }
    try {
      await api.post('/auth/users', form);
      setShowForm(false);
      setForm({ employee_no: '', worker_name: '', password: '', dept_id: activeDept ?? 0, role: 'worker', position: '', email: '', phone: '' });
      if (activeDept) loadMembers(activeDept);
    } catch (err: any) {
      setError(err?.body?.error === 'duplicate_employee_no' ? '이미 사용중인 사번입니다.' : '생성 실패');
    }
  };

  const handleResetPw = async (worker_id: number, name: string) => {
    const np = prompt(`${name}의 새 비밀번호를 입력하세요 (4자 이상):`);
    if (!np || np.length < 4) return;
    try {
      await api.post(`/auth/users/${worker_id}/reset-password`, { new_password: np });
      alert('비밀번호가 초기화되었습니다.');
    } catch { alert('초기화 실패'); }
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">사용자 관리</h1>
        <button
          onClick={() => { setForm((f) => ({ ...f, dept_id: activeDept ?? 0 })); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> 신규 직원 등록
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border bg-white p-2">
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">부서 (조직도)</div>
          <ul>
            {depts.map((d) => (
              <li key={d.dept_id}>
                <button
                  onClick={() => setActiveDept(d.dept_id)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-gray-50 ${activeDept === d.dept_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <span>{d.dept_name}</span>
                  <span className="text-xs text-gray-400">{d.member_count ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">사번</th>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">직책</th>
                <th className="px-3 py-2 text-left">권한</th>
                <th className="px-3 py-2 text-left">이메일</th>
                <th className="px-3 py-2 text-center w-24">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">불러오는 중...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">소속 직원이 없습니다.</td></tr>
              ) : users.map((u) => (
                <tr key={u.worker_id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{u.employee_no ?? '-'}</td>
                  <td className="px-3 py-2 font-medium">{u.worker_name}</td>
                  <td className="px-3 py-2 text-gray-600">{u.position ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'manager' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{u.email ?? '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => handleResetPw(u.worker_id, u.worker_name)} title="비밀번호 초기화" className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
                        <KeyRound className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <UserCheck className="h-5 w-5 text-blue-600" /> 신규 직원 등록
            </div>
            <div className="space-y-3">
              <Field label="사번 *"><input type="text" value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} className="inp" /></Field>
              <Field label="이름 *"><input type="text" value={form.worker_name} onChange={(e) => setForm({ ...form, worker_name: e.target.value })} className="inp" /></Field>
              <Field label="초기 비밀번호 *"><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="inp font-mono" placeholder="첫 로그인 시 변경 요구됨" /></Field>
              <Field label="부서 *">
                <select value={form.dept_id} onChange={(e) => setForm({ ...form, dept_id: parseInt(e.target.value, 10) })} className="inp">
                  <option value={0}>선택...</option>
                  {depts.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                </select>
              </Field>
              <Field label="권한">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })} className="inp">
                  <option value="worker">작업자</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </Field>
              <Field label="직책"><input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="inp" /></Field>
              <Field label="이메일"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" /></Field>
            </div>
            {error && <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">취소</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">생성</button>
            </div>
          </form>
        </div>
      )}

      <style>{`.inp { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; } .inp:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.1); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}
