import { useState, useEffect, useRef } from 'react';
import { UserPlus, Upload, Download, Pencil, Trash2, Search, X, Check, FileSpreadsheet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Worker {
  worker_id: number;
  worker_name: string;
  birth_date: string | null;
  department: string | null;
  position: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  manager: '관리직',
  worker: '작업자',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  manager: 'bg-blue-50 text-blue-700',
  worker: 'bg-gray-50 text-gray-700',
};

// 회사 직급 체계
const POSITIONS = ['사원', '주임', '선임', '리더', '책임', '총괄책임', '파트장', '대표이사'];
const DEPARTMENTS = ['경영', '생산', '생산관리', '생산품질', '품질', '기술품질', '시스템관리', '영업'];

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ worker_name: '', birth_date: '', department: '', position: '', role: 'worker', pin_code: '' });
  const [bulkResult, setBulkResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorkers = async () => {
    try {
      const res = await api.get<{ data: Worker[] }>('/workers');
      setWorkers(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkers(); }, []);

  const filtered = workers.filter((w) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      w.worker_name.toLowerCase().includes(s) ||
      (w.department || '').toLowerCase().includes(s) ||
      (w.position || '').toLowerCase().includes(s)
    );
  });

  const resetForm = () => {
    setForm({ worker_name: '', birth_date: '', department: '', position: '', role: 'worker', pin_code: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (w: Worker) => {
    setForm({
      worker_name: w.worker_name,
      birth_date: w.birth_date || '',
      department: w.department || '',
      position: w.position || '',
      role: w.role,
      pin_code: '',
    });
    setEditingId(w.worker_id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.worker_name.trim()) return;

    try {
      if (editingId) {
        const body: Record<string, unknown> = { ...form };
        if (!body.pin_code) delete body.pin_code;
        await api.patch(`/workers/${editingId}`, body);
      } else {
        await api.post('/workers', form);
      }
      resetForm();
      fetchWorkers();
    } catch (err: any) {
      const msg = err?.body?.message || '저장 실패';
      alert(msg);
    }
  };

  const handleDelete = async (w: Worker) => {
    if (!confirm(`'${w.worker_name}' 사용자를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/workers/${w.worker_id}`);
      fetchWorkers();
    } catch {
      alert('삭제 실패');
    }
  };

  const handleToggleActive = async (w: Worker) => {
    try {
      await api.patch(`/workers/${w.worker_id}`, { is_active: !w.is_active });
      fetchWorkers();
    } catch {
      alert('상태 변경 실패');
    }
  };

  // ── 엑셀 가져오기 ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        alert('데이터가 없습니다. CSV/TSV 파일을 확인해주세요.');
        return;
      }

      const res = await api.post<{ data: { success: number; skipped: number; errors: string[] } }>('/workers/bulk', {
        workers: rows,
      });
      setBulkResult(res.data);
      fetchWorkers();
    } catch (err: any) {
      alert('가져오기 실패: ' + (err?.body?.message || err.message));
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 엑셀 내보내기 (CSV)
  const handleExport = () => {
    const header = '이름,생년월일,부서,직무,권한';
    const rows = workers.map((w) =>
      [w.worker_name, w.birth_date || '', w.department || '', w.position || '', ROLE_LABELS[w.role] || w.role].join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `사용자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const csv = '\uFEFF이름,생년월일,부서,직무,PIN,권한\n홍길동,1990-05-15,생산부,선임,1234,작업자\n김영수,1985-08-20,품질팀,리더,5678,관리직\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '사용자등록_템플릿.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
          <p className="mt-1 text-sm text-gray-500">등록된 사용자: {workers.length}명 (활성: {workers.filter((w) => w.is_active).length}명)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            엑셀 가져오기
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            내보내기
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            사용자 추가
          </button>
        </div>
      </div>

      {/* 엑셀 일괄 등록 패널 */}
      {showBulk && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-3 font-semibold text-gray-900">엑셀(CSV) 일괄 등록</h3>
          <p className="mb-3 text-sm text-gray-500">
            CSV 파일에 <strong>이름, 생년월일, 부서, 직무, PIN, 권한</strong> 열을 포함해주세요.
            탭(TSV) 구분도 지원합니다.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              템플릿 다운로드
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Upload className="h-4 w-4" />
              파일 선택
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          {bulkResult && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex gap-4">
                <span className="text-green-700">성공: {bulkResult.success}건</span>
                <span className="text-yellow-700">스킵: {bulkResult.skipped}건</span>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600">
                  {bulkResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 font-semibold text-gray-900">
            {editingId ? '사용자 수정' : '새 사용자 등록'}
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이름 *</label>
              <input
                type="text"
                value={form.worker_name}
                onChange={(e) => setForm({ ...form, worker_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">생년월일 *</label>
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">부서</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">직급</label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">권한</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="worker">작업자</option>
                <option value="manager">관리직</option>
                {isAdmin && <option value="admin">관리자</option>}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                PIN {editingId ? '(변경 시 입력)' : '(선택)'}
              </label>
              <input
                type="text"
                value={form.pin_code}
                onChange={(e) => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="4~6자리 숫자"
                maxLength={6}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!form.worker_name.trim() || (!editingId && !form.birth_date)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {editingId ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 부서, 직무로 검색..."
          className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm"
        />
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 font-semibold text-gray-600">이름</th>
              <th className="px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">생년월일</th>
              <th className="px-3 py-3 font-semibold text-gray-600">부서</th>
              <th className="px-3 py-3 font-semibold text-gray-600">직급</th>
              <th className="px-3 py-3 font-semibold text-gray-600">권한</th>
              <th className="px-3 py-3 font-semibold text-gray-600">상태</th>
              <th className="w-20 px-2 py-3 font-semibold text-gray-600 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">등록된 사용자가 없습니다.</td></tr>
            ) : (
              filtered.map((w) => (
                <tr key={w.worker_id} className={!w.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{w.worker_name}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs hidden md:table-cell">{w.birth_date || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{w.department || '-'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{w.position || '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[w.role] || ROLE_COLORS.worker}`}>
                      {ROLE_LABELS[w.role] || w.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handleToggleActive(w)}
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                        w.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {w.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="w-20 px-2 py-2.5">
                    <div className="flex justify-center gap-0.5">
                      <button
                        onClick={() => handleEdit(w)}
                        className="rounded-md p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                        title="수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(w)}
                        className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="삭제"
                      >
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

/** CSV/TSV 파서: 헤더 기반 자동 매핑 */
function parseCSV(text: string): Array<Record<string, string>> {
  // 탭 또는 콤마 자동 감지
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes('\t') ? '\t' : ',';
  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));

  // 헤더 매핑
  const fieldMap: Record<string, string> = {
    '이름': 'worker_name',
    'name': 'worker_name',
    'worker_name': 'worker_name',
    '생년월일': 'birth_date',
    'birth_date': 'birth_date',
    'birthday': 'birth_date',
    '부서': 'department',
    'department': 'department',
    'dept': 'department',
    '직무': 'position',
    'position': 'position',
    'PIN': 'pin_code',
    'pin': 'pin_code',
    'pin_code': 'pin_code',
    '권한': 'role',
    'role': 'role',
  };

  // 역할 매핑
  const roleMap: Record<string, string> = {
    '관리자': 'admin',
    '관리직': 'manager',
    '작업자': 'worker',
    'admin': 'admin',
    'manager': 'manager',
    'worker': 'worker',
  };

  const result: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};

    headers.forEach((h, idx) => {
      const field = fieldMap[h] || fieldMap[h.toLowerCase()] || h;
      let val = values[idx] || '';
      if (field === 'role' && val) {
        val = roleMap[val] || roleMap[val.toLowerCase()] || 'worker';
      }
      row[field] = val;
    });

    if (row.worker_name) {
      result.push(row);
    }
  }

  return result;
}
