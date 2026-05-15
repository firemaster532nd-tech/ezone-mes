import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ShieldCheck, Save } from 'lucide-react';

interface Dept { dept_id: number; dept_code: string; dept_name: string }

interface PermRow {
  menu_id: number;
  menu_code: string;
  menu_name: string;
  parent_menu_id: number | null;
  sort_order: number;
  can_read: boolean;
  can_write: boolean;
  can_update: boolean;
  can_delete: boolean;
}

type Action = 'can_read' | 'can_write' | 'can_update' | 'can_delete';

export function PermissionsPage() {
  const { isAdmin } = useAuth();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [activeDept, setActiveDept] = useState<number | null>(null);
  const [rows, setRows] = useState<PermRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const r = await api.get<{ data: Dept[] }>('/departments');
    setDepts(r.data);
    if (r.data.length) setActiveDept(r.data[0].dept_id);
  })(); }, []);

  useEffect(() => { if (activeDept) loadPerms(activeDept); }, [activeDept]);

  const loadPerms = async (dept_id: number) => {
    const r = await api.get<{ data: PermRow[] }>(`/permissions/departments/${dept_id}`);
    setRows(r.data);
    setDirty(false);
  };

  const toggle = (menu_id: number, action: Action) => {
    setRows((rs) => rs.map((r) => r.menu_id === menu_id ? { ...r, [action]: !r[action] } : r));
    setDirty(true);
  };

  const toggleAllInRow = (menu_id: number) => {
    setRows((rs) => rs.map((r) => {
      if (r.menu_id !== menu_id) return r;
      const all = r.can_read && r.can_write && r.can_update && r.can_delete;
      return { ...r, can_read: !all, can_write: !all, can_update: !all, can_delete: !all };
    }));
    setDirty(true);
  };

  const save = async () => {
    if (!activeDept) return;
    setSaving(true);
    try {
      await api.put('/permissions/departments', {
        dept_id: activeDept,
        permissions: rows.map((r) => ({ menu_id: r.menu_id, can_read: r.can_read, can_write: r.can_write, can_update: r.can_update, can_delete: r.can_delete })),
      });
      setDirty(false);
      alert('저장되었습니다.');
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  // 트리: 부모(parent_menu_id null) → 자식
  const grouped = useMemo(() => {
    const byParent = new Map<number | null, PermRow[]>();
    rows.forEach((r) => {
      const arr = byParent.get(r.parent_menu_id) ?? [];
      arr.push(r); byParent.set(r.parent_menu_id, arr);
    });
    const out: Array<{ row: PermRow; depth: number }> = [];
    const walk = (pid: number | null, depth: number) => {
      const arr = byParent.get(pid) ?? [];
      arr.sort((a, b) => a.sort_order - b.sort_order);
      for (const r of arr) { out.push({ row: r, depth }); walk(r.menu_id, depth + 1); }
    };
    walk(null, 0);
    return out;
  }, [rows]);

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="h-5 w-5" /> 권한 관리</h1>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          <Save className="h-4 w-4" /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <strong>이카운트 스타일 2-Track 권한.</strong> 여기서는 <strong>부서별 기본 권한</strong>을 설정합니다.
        개인별 예외(특정 직원에게만 권한 추가/제거)는 사용자 관리 → 개별 직원 → "권한 오버라이드"에서 처리합니다.
      </div>

      <div className="flex gap-2 overflow-x-auto border-b">
        {depts.map((d) => (
          <button
            key={d.dept_id}
            onClick={() => {
              if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
              setActiveDept(d.dept_id);
            }}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${activeDept === d.dept_id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {d.dept_name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">메뉴</th>
              <th className="px-3 py-2 text-center w-20">조회 (R)</th>
              <th className="px-3 py-2 text-center w-20">입력 (C)</th>
              <th className="px-3 py-2 text-center w-20">수정 (U)</th>
              <th className="px-3 py-2 text-center w-20">삭제 (D)</th>
              <th className="px-3 py-2 text-center w-20">전체</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ row, depth }) => (
              <tr key={row.menu_id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span style={{ paddingLeft: `${depth * 16}px` }} className={depth === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                    {depth > 0 && <span className="text-gray-300 mr-1">└</span>}
                    {row.menu_name}
                  </span>
                  <span className="ml-2 text-xs font-mono text-gray-400">{row.menu_code}</span>
                </td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={row.can_read} onChange={() => toggle(row.menu_id, 'can_read')} className="h-4 w-4 cursor-pointer" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={row.can_write} onChange={() => toggle(row.menu_id, 'can_write')} className="h-4 w-4 cursor-pointer" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={row.can_update} onChange={() => toggle(row.menu_id, 'can_update')} className="h-4 w-4 cursor-pointer" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={row.can_delete} onChange={() => toggle(row.menu_id, 'can_delete')} className="h-4 w-4 cursor-pointer" /></td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => toggleAllInRow(row.menu_id)} className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50">All</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
