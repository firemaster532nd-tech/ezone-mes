import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, refreshMe, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!employeeNo.trim()) { setError('사번을 입력해주세요.'); return; }
    if (!password) { setError('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    const res = await login(employeeNo.trim(), password);
    if (!res.ok) {
      setError(res.error === 'invalid_credentials' || res.error?.includes('401')
        ? '사번 또는 비밀번호가 올바르지 않습니다.'
        : res.error === 'account_disabled'
          ? '비활성화된 계정입니다. 관리자에게 문의하세요.'
          : '로그인 중 오류가 발생했습니다.');
      setLoading(false);
      return;
    }
    await refreshMe();
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <Factory className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EZONE MES</h1>
          <p className="mt-1 text-sm text-gray-500">방화구획 관통부 MES</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">로그인</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">사번</label>
              <input
                type="text"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="사번을 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoComplete="current-password"
              />
            </div>
          </div>
          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            등록된 사용자만 로그인 가능합니다. 계정 문의: 관리자
          </p>
        </form>
      </div>
    </div>
  );
}
