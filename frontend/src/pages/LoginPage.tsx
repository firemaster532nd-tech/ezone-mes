import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, refreshMe, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!employeeNo.trim()) { setError('사번을 입력해주세요.'); return; }
    if (!password) { setError('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    const res = await login(employeeNo.trim(), password);
    if (!res.ok) {
      const errCode = res.error || '';
      if (errCode === 'invalid_credentials' || errCode.includes('401')) {
        setError('사번 또는 비밀번호가 올바르지 않습니다.');
      } else if (errCode === 'account_disabled') {
        setError('비활성화된 계정입니다. 관리자에게 문의하세요.');
      } else if (errCode === 'password_not_set') {
        setError('비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.');
      } else if (errCode.includes('Failed to fetch') || errCode.includes('NetworkError')) {
        setError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
      } else {
        setError(`로그인 중 오류가 발생했습니다. (${errCode})`);
      }
      setLoading(false);
      return;
    }
    await refreshMe();
    navigate('/dashboard', { replace: true });
  };

  // 저장된 토큰 유효성 확인 중 → 스피너 표시
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <Factory className="h-9 w-9 text-white" />
          </div>
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">세션 확인 중...</p>
        </div>
      </div>
    );
  }

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
