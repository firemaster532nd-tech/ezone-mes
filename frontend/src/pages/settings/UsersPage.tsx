import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { 
  Plus, 
  KeyRound, 
  UserCheck, 
  Pencil, 
  Settings, 
  ShieldCheck, 
  X, 
  Save, 
  Building2, 
  Trash2, 
  Mail, 
  Phone, 
  Briefcase, 
  ShieldAlert 
} from 'lucide-react';
import { toast } from 'sonner';

interface UserRow {
  worker_id: number;
  employee_no: string | null;
  worker_name: string;
  role: 'admin' | 'manager' | 'worker';
  position: string | null;
  email: string | null;
  phone: string | null;
  dept_id: number | null;
  is_active: boolean;
}

interface DeptRow {
  dept_id: number;
  dept_code: string;
  dept_name: string;
  parent_dept_id: number | null;
  sort_order: number;
  is_active: boolean;
  member_count?: number;
}

interface MenuRow {
  menu_id: number;
  menu_code: string;
  menu_name: string;
  parent_menu_id: number | null;
  sort_order: number;
}

interface OverrideRow {
  override_mode: 'ADD' | 'REVOKE' | 'REPLACE' | 'INHERIT';
  can_read: boolean;
  can_write: boolean;
  can_update: boolean;
  can_delete: boolean;
}

const ROLE_LABELS: Record<string, string> = { admin: '관리자', manager: '매니저', worker: '작업자' };

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [activeDept, setActiveDept] = useState<number | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  
  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState({
    employee_no: '', 
    worker_name: '', 
    dept_id: 0,
    role: 'worker' as 'admin' | 'manager' | 'worker', 
    position: '', 
    email: '', 
    phone: '',
    is_active: true,
    password: ''
  });
  const [userError, setUserError] = useState('');

  // Department Management Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DeptRow | null>(null);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptForm, setDeptForm] = useState({
    dept_code: '',
    dept_name: '',
    parent_dept_id: null as number | null,
    sort_order: 0
  });

  // Permission Override Modal State
  const [showPermModal, setShowPermModal] = useState(false);
  const [permUser, setPermUser] = useState<UserRow | null>(null);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [deptPerms, setDeptPerms] = useState<Record<number, { can_read: boolean; can_write: boolean; can_update: boolean; can_delete: boolean }>>({});
  const [userOverrides, setUserOverrides] = useState<Record<number, OverrideRow>>({});
  const [savingPerms, setSavingPerms] = useState(false);

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

  // --- USER HANDLERS ---
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      employee_no: '',
      worker_name: '',
      dept_id: activeDept ?? 0,
      role: 'worker',
      position: '',
      email: '',
      phone: '',
      is_active: true,
      password: ''
    });
    setUserError('');
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: UserRow) => {
    setEditingUser(u);
    setUserForm({
      employee_no: u.employee_no ?? '',
      worker_name: u.worker_name,
      dept_id: u.dept_id ?? 0,
      role: u.role,
      position: u.position ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
      is_active: u.is_active,
      password: ''
    });
    setUserError('');
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!userForm.employee_no || !userForm.worker_name || !userForm.phone) { 
      setUserError('필수 항목(사번, 이름, 휴대폰 번호)을 입력하세요.'); 
      return; 
    }
    if (userForm.employee_no.length > 10) {
      setUserError('사번은 최대 10자리까지 허용됩니다.');
      return;
    }
    if (!userForm.dept_id) { 
      setUserError('부서를 선택하세요.'); 
      return; 
    }

    try {
      if (editingUser) {
        // Edit Mode
        const payload = {
          ...userForm,
          password: userForm.password ? userForm.password : undefined
        };
        await api.patch(`/auth/users/${editingUser.worker_id}`, payload);
        toast.success(`${userForm.worker_name} 직원의 정보가 수정되었습니다!`);
      } else {
        // Create Mode
        const initialPassword = userForm.password.trim() || userForm.phone.trim();
        await api.post('/auth/users', {
          ...userForm,
          password: initialPassword
        });
        toast.success('신규 직원이 성공적으로 등록되었습니다!');
      }
      setShowUserModal(false);
      if (activeDept) loadMembers(activeDept);
      loadDepts(); // Refresh member counts
    } catch (err: any) {
      if (err?.body?.error === 'duplicate_employee_no') {
        setUserError('이미 사용중인 사번입니다.');
      } else {
        setUserError(editingUser ? '수정 실패' : '생성 실패');
      }
    }
  };

  const handleResetPw = async (worker_id: number, name: string) => {
    const np = prompt(`${name}의 새 비밀번호를 입력하세요 (4자 이상):`);
    if (!np || np.length < 4) return;
    try {
      await api.post(`/auth/users/${worker_id}/reset-password`, { new_password: np });
      toast.success('비밀번호가 초기화되었습니다. 첫 로그인 시 비밀번호 변경을 강제합니다.');
    } catch { 
      toast.error('비밀번호 초기화 실패');
    }
  };

  // --- DEPARTMENT HANDLERS ---
  const handleOpenNewDept = () => {
    setEditingDept(null);
    setDeptForm({ dept_code: '', dept_name: '', sort_order: 0, parent_dept_id: null });
    setShowDeptForm(true);
  };

  const handleOpenEditDept = (d: DeptRow) => {
    setEditingDept(d);
    setDeptForm({ dept_code: d.dept_code, dept_name: d.dept_name, sort_order: d.sort_order, parent_dept_id: d.parent_dept_id });
    setShowDeptForm(true);
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.dept_code || !deptForm.dept_name) {
      toast.error('부서코드와 부서명은 필수입니다.');
      return;
    }
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.dept_id}`, deptForm);
        toast.success('부서가 수정되었습니다.');
      } else {
        await api.post('/departments', deptForm);
        toast.success('신규 부서가 생성되었습니다.');
      }
      setShowDeptForm(false);
      loadDepts();
    } catch (err: any) {
      if (err?.body?.error === 'duplicate_dept_code') {
        toast.error('이미 존재하거나 비활성화된 부서코드입니다.');
      } else {
        toast.error('부서 저장 실패');
      }
    }
  };

  const handleDeactivateDept = async (d: DeptRow) => {
    if (!confirm(`'${d.dept_name}' 부서를 비활성화 하시겠습니까?`)) return;
    try {
      await api.delete(`/departments/${d.dept_id}`);
      toast.success('부서가 비활성화되었습니다.');
      loadDepts();
      if (activeDept === d.dept_id) setActiveDept(null);
    } catch {
      toast.error('부서 비활성화 실패');
    }
  };

  // --- PERMISSION OVERRIDE HANDLERS ---
  const handleOpenPerms = async (u: UserRow) => {
    setPermUser(u);
    setSavingPerms(false);
    try {
      // 1. Load menu list
      const menuRes = await api.get<{ data: MenuRow[] }>('/menus');
      setMenus(menuRes.data);

      // 2. Fetch department default permissions
      if (u.dept_id) {
        const deptPermRes = await api.get<{ data: any[] }>(`/permissions/departments/${u.dept_id}`);
        const deptMap: Record<number, any> = {};
        deptPermRes.data.forEach((p) => {
          deptMap[p.menu_id] = { can_read: p.can_read, can_write: p.can_write, can_update: p.can_update, can_delete: p.can_delete };
        });
        setDeptPerms(deptMap);
      } else {
        setDeptPerms({});
      }

      // 3. Fetch user overrides
      const userOverrideRes = await api.get<{ data: any[] }>(`/permissions/users/${u.worker_id}`);
      const overrideMap: Record<number, OverrideRow> = {};
      userOverrideRes.data.forEach((p) => {
        overrideMap[p.menu_id] = { override_mode: p.override_mode, can_read: p.can_read, can_write: p.can_write, can_update: p.can_update, can_delete: p.can_delete };
      });
      setUserOverrides(overrideMap);

      setShowPermModal(true);
    } catch (err) {
      toast.error('권한 설정을 불러오는데 실패했습니다.');
    }
  };

  const handleOverrideModeChange = (menuId: number, mode: 'ADD' | 'REVOKE' | 'REPLACE' | 'INHERIT') => {
    setUserOverrides((prev) => {
      const next = { ...prev };
      if (mode === 'INHERIT') {
        next[menuId] = { override_mode: 'INHERIT', can_read: false, can_write: false, can_update: false, can_delete: false };
      } else {
        const dept = deptPerms[menuId] || { can_read: false, can_write: false, can_update: false, can_delete: false };
        next[menuId] = {
          override_mode: mode,
          can_read: dept.can_read,
          can_write: dept.can_write,
          can_update: dept.can_update,
          can_delete: dept.can_delete
        };
      }
      return next;
    });
  };

  const handleToggleOverrideCheckbox = (menuId: number, action: 'can_read' | 'can_write' | 'can_update' | 'can_delete') => {
    setUserOverrides((prev) => {
      const next = { ...prev };
      const current = next[menuId] || { override_mode: 'INHERIT', can_read: false, can_write: false, can_update: false, can_delete: false };
      if (current.override_mode === 'INHERIT') return prev; // Cannot toggle on inherit

      next[menuId] = {
        ...current,
        [action]: !current[action]
      };
      return next;
    });
  };

  const handleSavePermOverrides = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    
    // Construct batch payload
    const batchList = Object.entries(userOverrides).map(([menuIdStr, val]) => ({
      menu_id: parseInt(menuIdStr, 10),
      override_mode: val.override_mode,
      can_read: val.can_read,
      can_write: val.can_write,
      can_update: val.can_update,
      can_delete: val.can_delete
    }));

    try {
      await api.put('/permissions/users/batch', {
        worker_id: permUser.worker_id,
        permissions: batchList
      });
      toast.success(`${permUser.worker_name} 직원의 개별 권한이 일괄 저장되었습니다!`);
      setShowPermModal(false);
    } catch {
      toast.error('권한 변경사항 저장 실패');
    } finally {
      setSavingPerms(false);
    }
  };

  // --- MEMU TREE FOR OVERRIDE GRID ---
  const menuTree = useMemo(() => {
    const byParent = new Map<number | null, MenuRow[]>();
    menus.forEach((m) => {
      const arr = byParent.get(m.parent_menu_id) ?? [];
      arr.push(m); byParent.set(m.parent_menu_id, arr);
    });
    const out: Array<{ menu: MenuRow; depth: number }> = [];
    const walk = (pid: number | null, depth: number) => {
      const arr = byParent.get(pid) ?? [];
      arr.sort((a, b) => a.sort_order - b.sort_order);
      for (const m of arr) { 
        out.push({ menu: m, depth }); 
        walk(m.menu_id, depth + 1); 
      }
    };
    walk(null, 0);
    return out;
  }, [menus]);

  // 트리형 부서 정렬
  const deptTree = useMemo(() => {
    const byParent = new Map<number | null, DeptRow[]>();
    depts.forEach((d) => {
      const arr = byParent.get(d.parent_dept_id) ?? [];
      arr.push(d); byParent.set(d.parent_dept_id, arr);
    });
    const out: Array<{ dept: DeptRow; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      const arr = byParent.get(parentId) ?? [];
      arr.sort((a, b) => a.sort_order - b.sort_order || a.dept_code.localeCompare(b.dept_code));
      for (const d of arr) { 
        out.push({ dept: d, depth }); 
        walk(d.dept_id, depth + 1); 
      }
    };
    walk(null, 0);
    return out;
  }, [depts]);

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-700" /> 사용자 및 조직 관리
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeptModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Settings className="h-4 w-4" /> 부서 설정
          </button>
          <button
            onClick={handleOpenCreateUser}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> 신규 직원 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        {/* LEFT BAR: DEPARTMENTS */}
        <aside className="rounded-lg border bg-white p-3 shadow-sm h-fit">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b">
            <span className="text-xs font-semibold text-gray-500">부서 (조직도)</span>
            <button 
              onClick={() => setShowDeptModal(true)}
              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <Settings className="h-3 w-3" /> 관리
            </button>
          </div>
          <ul className="space-y-1">
            {deptTree.map(({ dept, depth }) => (
              <li key={dept.dept_id}>
                <button
                  onClick={() => setActiveDept(dept.dept_id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    activeDept === dept.dept_id 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-gray-700 hover:bg-slate-50'
                  }`}
                >
                  <span style={{ paddingLeft: `${depth * 10}px` }} className="truncate">
                    {depth > 0 && <span className="text-slate-300 mr-1.5">└</span>}
                    {dept.dept_name}
                  </span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                    activeDept === dept.dept_id ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {dept.member_count ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* RIGHT BOARD: MEMBERS */}
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="border-b bg-slate-50 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {depts.find(d => d.dept_id === activeDept)?.dept_name || '부서'} 소속 임직원
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">사번</th>
                  <th className="px-4 py-3 text-left font-semibold">이름</th>
                  <th className="px-4 py-3 text-left font-semibold">직급</th>
                  <th className="px-4 py-3 text-left font-semibold">권한</th>
                  <th className="px-4 py-3 text-left font-semibold">연락처 / 이메일</th>
                  <th className="px-4 py-3 text-center font-semibold w-28">상태</th>
                  <th className="px-4 py-3 text-center font-semibold w-36">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      직원 정보를 불러오는 중...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      소속 직원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.worker_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-700 font-medium">
                        {u.employee_no ?? '-'}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {u.worker_name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {u.position || '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.role === 'admin' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                            : u.role === 'manager' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 space-y-0.5">
                        {u.phone && (
                          <div className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-slate-400" /> {u.phone}
                          </div>
                        )}
                        {u.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" /> {u.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                          u.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          {u.is_active ? '재직' : '퇴사/정지'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-center items-center gap-1.5">
                          <button 
                            onClick={() => handleOpenEditUser(u)} 
                            title="기본 정보 수정" 
                            className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenPerms(u)} 
                            title="개별 권한 설정" 
                            className="rounded p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleResetPw(u.worker_id, u.worker_name)} 
                            title="비밀번호 초기화" 
                            className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          >
                            <KeyRound className="h-4 w-4" />
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
      </div>

      {/* MODAL 1: REGISTER / EDIT USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={handleUserSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <UserCheck className="h-5 w-5 text-blue-600" /> 
                {editingUser ? '임직원 정보 수정' : '신규 임직원 등록'}
              </div>
              <button type="button" onClick={() => setShowUserModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <Field label="사번 *">
                <input 
                  type="text" 
                  value={userForm.employee_no} 
                  onChange={(e) => setUserForm({ ...userForm, employee_no: e.target.value })} 
                  placeholder="사번을 기입해주세요"
                  className="inp font-mono" 
                />
              </Field>
              <Field label="이름 *">
                <input 
                  type="text" 
                  value={userForm.worker_name} 
                  onChange={(e) => setUserForm({ ...userForm, worker_name: e.target.value })} 
                  className="inp" 
                />
              </Field>
              <Field label="휴대폰 번호 *">
                <input 
                  type="text" 
                  value={userForm.phone} 
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} 
                  placeholder="예: 010-1234-5678"
                  className="inp font-mono" 
                />
                {!editingUser && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    입력한 휴대폰 번호가 초기 비밀번호로 설정되며 첫 로그인 시 비밀번호 변경이 강제됩니다.
                  </p>
                )}
              </Field>
              <Field label="소속 부서 *">
                <select 
                  value={userForm.dept_id} 
                  onChange={(e) => setUserForm({ ...userForm, dept_id: parseInt(e.target.value, 10) })} 
                  className="inp"
                >
                  <option value={0}>부서 선택...</option>
                  {depts.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="시스템 권한">
                  <select 
                    value={userForm.role} 
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })} 
                    className="inp font-medium"
                  >
                    <option value="worker">작업자</option>
                    <option value="manager">매니저</option>
                    <option value="admin">관리자</option>
                  </select>
                </Field>
                <Field label="재직 여부">
                  <select 
                    value={userForm.is_active ? 'true' : 'false'} 
                    onChange={(e) => setUserForm({ ...userForm, is_active: e.target.value === 'true' })} 
                    className="inp font-medium"
                  >
                    <option value="true">재직 (Active)</option>
                    <option value="false">정지/퇴사 (Inactive)</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="직책/직급">
                  <input 
                    type="text" 
                    value={userForm.position} 
                    onChange={(e) => setUserForm({ ...userForm, position: e.target.value })} 
                    placeholder="예: 파트장"
                    className="inp" 
                  />
                </Field>
                <Field label="이메일">
                  <input 
                    type="email" 
                    value={userForm.email} 
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} 
                    placeholder="name@domain.com"
                    className="inp" 
                  />
                </Field>
              </div>
              <Field label={editingUser ? "비밀번호 (변경 시에만 입력)" : "비밀번호 (미입력 시 휴대폰 번호가 초기 비밀번호)"}>
                <input 
                  type="password" 
                  value={userForm.password} 
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} 
                  placeholder={editingUser ? "새 비밀번호 입력" : "비밀번호 입력"}
                  className="inp" 
                  autoComplete="new-password"
                />
              </Field>
            </div>

            {userError && <div className="mt-3.5 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{userError}</div>}
            
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setShowUserModal(false)} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors">취소</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: DEPARTMENT SETTINGS */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border flex flex-col max-h-[85vh]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Settings className="h-5 w-5 text-slate-700" /> 부서 조직도 설정
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowDeptModal(false);
                  setShowDeptForm(false);
                }} 
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4 overflow-y-auto pr-1">
              {/* DEPARTMENTS TABLE */}
              <div className="border rounded-lg overflow-hidden h-fit">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">부서명</th>
                      <th className="px-3 py-2">코드</th>
                      <th className="px-3 py-2 text-center w-12">정렬</th>
                      <th className="px-3 py-2 text-center w-12">상태</th>
                      <th className="px-3 py-2 text-center w-20">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deptTree.map(({ dept, depth }) => (
                      <tr key={dept.dept_id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-medium">
                          <span style={{ paddingLeft: `${depth * 12}px` }} className="truncate block">
                            {depth > 0 && <span className="text-slate-300 mr-1">└</span>}
                            {dept.dept_name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{dept.dept_code}</td>
                        <td className="px-3 py-2.5 text-center text-slate-400">{dept.sort_order}</td>
                        <td className="px-3 py-2.5 text-center">
                          {dept.is_active ? (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 font-semibold border border-emerald-100">활성</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 font-semibold border">정지</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => handleOpenEditDept(dept)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {dept.is_active && (
                              <button onClick={() => handleDeactivateDept(dept)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ACTION / FORM AREA */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleOpenNewDept} 
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" /> 신규 부서 추가
                </button>

                {showDeptForm && (
                  <form onSubmit={handleDeptSubmit} className="border rounded-lg p-3 bg-slate-50 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block">
                      {editingDept ? '부서 정보 수정' : '신규 부서 생성'}
                    </span>
                    <Field label="부서코드 *">
                      <input 
                        type="text" 
                        value={deptForm.dept_code} 
                        onChange={(e) => setFormCode(e.target.value)} 
                        disabled={!!editingDept}
                        placeholder="예: SALES"
                        className="inp text-xs font-mono uppercase" 
                      />
                    </Field>
                    <Field label="부서명 *">
                      <input 
                        type="text" 
                        value={deptForm.dept_name} 
                        onChange={(e) => setDeptForm({ ...deptForm, dept_name: e.target.value })} 
                        placeholder="예: 영업부"
                        className="inp text-xs" 
                      />
                    </Field>
                    <Field label="상위 부서">
                      <select 
                        value={deptForm.parent_dept_id ?? ''} 
                        onChange={(e) => setDeptForm({ ...deptForm, parent_dept_id: e.target.value ? parseInt(e.target.value, 10) : null })} 
                        className="inp text-xs"
                      >
                        <option value="">없음 (최상위)</option>
                        {depts.filter((d) => !editingDept || d.dept_id !== editingDept.dept_id).map((d) => (
                          <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="정렬순서">
                      <input 
                        type="number" 
                        value={deptForm.sort_order} 
                        onChange={(e) => setDeptForm({ ...deptForm, sort_order: parseInt(e.target.value, 10) || 0 })} 
                        className="inp text-xs" 
                      />
                    </Field>
                    <div className="flex justify-end gap-1.5 pt-2 border-t">
                      <button type="button" onClick={() => setShowDeptForm(false)} className="rounded px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-slate-200">취소</button>
                      <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700">저장</button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t pt-4">
              <button 
                type="button" 
                onClick={() => {
                  setShowDeptModal(false);
                  setShowDeptForm(false);
                }} 
                className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: INDIVIDUAL PERMISSIONS OVERRIDE */}
      {showPermModal && permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-2xl border flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between border-b pb-3.5">
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5.5 w-5.5 text-purple-600" />
                  개별 권한 오버라이드 설정
                </span>
                <span className="text-xs text-slate-400 mt-0.5">
                  직원명: <strong>{permUser.worker_name}</strong> ({permUser.employee_no}) | 
                  소속 부서: <strong>{depts.find(d => d.dept_id === permUser.dept_id)?.dept_name || '없음'}</strong>
                </span>
              </div>
              <button type="button" onClick={() => setShowPermModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Guide Alert */}
            <div className="mb-4 rounded-lg bg-purple-50/50 border border-purple-100 px-4 py-3 flex gap-2.5 text-xs text-purple-900">
              <ShieldAlert className="h-4.5 w-4.5 text-purple-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">이카운트 스타일 개별 권한 예외 규칙:</p>
                <p className="text-purple-700">
                  - **부서 권한 상속**: 해당 메뉴는 소속 부서에 적용된 공통 권한 설정을 기본으로 따릅니다 (체크박스 고정 표시).<br />
                  - **명시적 추가 (ADD) / 명시적 제거 (REVOKE) / 권한 대체 (REPLACE)**: 해당 사용자에 한해 특정 권한을 개별적으로 오버라이드합니다.
                </p>
              </div>
            </div>

            {/* Table Matrix */}
            <div className="overflow-y-auto flex-1 rounded-lg border bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b font-semibold text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5">메뉴 명세</th>
                    <th className="px-3 py-2.5 w-44">오버라이드 모드</th>
                    <th className="px-3 py-2.5 text-center w-16">조회 (R)</th>
                    <th className="px-3 py-2.5 text-center w-16">입력 (C)</th>
                    <th className="px-3 py-2.5 text-center w-16">수정 (U)</th>
                    <th className="px-3 py-2.5 text-center w-16">삭제 (D)</th>
                    <th className="px-3 py-2.5 text-center w-16">일괄</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {menuTree.map(({ menu, depth }) => {
                    const override = userOverrides[menu.menu_id] || { override_mode: 'INHERIT', can_read: false, can_write: false, can_update: false, can_delete: false };
                    const dept = deptPerms[menu.menu_id] || { can_read: false, can_write: false, can_update: false, can_delete: false };
                    
                    const isInherit = override.override_mode === 'INHERIT';
                    
                    // Effective checks displaying on checkboxes
                    const checkedRead = isInherit ? dept.can_read : override.can_read;
                    const checkedWrite = isInherit ? dept.can_write : override.can_write;
                    const checkedUpdate = isInherit ? dept.can_update : override.can_update;
                    const checkedDelete = isInherit ? dept.can_delete : override.can_delete;

                    return (
                      <tr key={menu.menu_id} className={`hover:bg-slate-50/50 ${isInherit ? 'text-slate-600' : 'bg-purple-50/10 font-medium'}`}>
                        <td className="px-4 py-2.5">
                          <span style={{ paddingLeft: `${depth * 14}px` }} className={`truncate block ${depth === 0 ? 'font-bold text-slate-800 text-xs' : 'text-slate-700'}`}>
                            {depth > 0 && <span className="text-slate-300 mr-1.5">└</span>}
                            {menu.menu_name}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={override.override_mode}
                            onChange={(e) => handleOverrideModeChange(menu.menu_id, e.target.value as any)}
                            className={`w-full py-1 px-2 rounded border outline-none text-[11px] font-medium transition-colors ${
                              isInherit 
                                ? 'bg-slate-50 border-slate-200 text-slate-500' 
                                : 'bg-purple-50 border-purple-200 text-purple-700 font-bold'
                            }`}
                          >
                            <option value="INHERIT">부서 권한 상속</option>
                            <option value="ADD">명시적 추가 (ADD)</option>
                            <option value="REVOKE">명시적 제거 (REVOKE)</option>
                            <option value="REPLACE">권한 완전히 대체 (REPLACE)</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={checkedRead} 
                            disabled={isInherit}
                            onChange={() => handleToggleOverrideCheckbox(menu.menu_id, 'can_read')}
                            className={`h-4.5 w-4.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed ${
                              isInherit ? 'opacity-50' : 'accent-purple-600'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={checkedWrite} 
                            disabled={isInherit}
                            onChange={() => handleToggleOverrideCheckbox(menu.menu_id, 'can_write')}
                            className={`h-4.5 w-4.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed ${
                              isInherit ? 'opacity-50' : 'accent-purple-600'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={checkedUpdate} 
                            disabled={isInherit}
                            onChange={() => handleToggleOverrideCheckbox(menu.menu_id, 'can_update')}
                            className={`h-4.5 w-4.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed ${
                              isInherit ? 'opacity-50' : 'accent-purple-600'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={checkedDelete} 
                            disabled={isInherit}
                            onChange={() => handleToggleOverrideCheckbox(menu.menu_id, 'can_delete')}
                            className={`h-4.5 w-4.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed ${
                              isInherit ? 'opacity-50' : 'accent-purple-600'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            disabled={isInherit}
                            onClick={() => {
                              setUserOverrides((prev) => {
                                const next = { ...prev };
                                const cur = next[menu.menu_id];
                                if (cur && cur.override_mode !== 'INHERIT') {
                                  const all = cur.can_read && cur.can_write && cur.can_update && cur.can_delete;
                                  next[menu.menu_id] = { ...cur, can_read: !all, can_write: !all, can_update: !all, can_delete: !all };
                                }
                                return next;
                              });
                            }}
                            className="rounded px-2.5 py-0.5 border border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            All
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <button 
                type="button" 
                onClick={() => setShowPermModal(false)} 
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button 
                type="button" 
                onClick={handleSavePermOverrides}
                disabled={savingPerms}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                <Save className="h-4 w-4" /> {savingPerms ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inp { 
          width: 100%; 
          border: 1px solid #e2e8f0; 
          border-radius: 0.5rem; 
          padding: 0.45rem 0.75rem; 
          font-size: 0.8125rem; 
          outline: none; 
          background: #ffffff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        } 
        .inp:focus { 
          border-color: #3b82f6; 
          box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1); 
        } 
        .inp:disabled { 
          background: #f8fafc; 
          color: #94a3b8;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );

  // Helper inside submit to make upper case
  function setFormCode(val: string) {
    setDeptForm({ ...deptForm, dept_code: val.toUpperCase() });
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
