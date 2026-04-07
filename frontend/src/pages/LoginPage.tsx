import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Shield, KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, type User } from '@/lib/auth';

type LoginMode = 'normal' | 'admin';

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('normal');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleNormalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!birthDate) { setError('생년월일을 입력해주세요.'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ data: User }>('/workers/login', {
        worker_name: name.trim(),
        birth_date: birthDate,
      });
      login(res.data);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.status === 401 ? '이름 또는 생년월일이 올바르지 않습니다.' : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!adminPin) { setError('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ data: User }>('/workers/admin-login', {
        pin_code: adminPin,
      });
      login(res.data);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.status === 401 ? '비밀번호가 올바르지 않습니다.' : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <Factory className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EZONE MES</h1>
          <p className="mt-1 text-sm text-gray-500">방화구획 관통부 MES</p>
        </div>

        {/* 모드 토글 */}
        <div className="mb-4 flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => { setMode('normal'); setError(''); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'normal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            일반 로그인
          </button>
          <button
            onClick={() => { setMode('admin'); setError(''); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Shield className="h-3.5 w-3.5" /> 관리자
          </button>
        </div>

        {mode === 'normal' ? (
          /* 일반 로그인 */
          <form onSubmit={handleNormalLogin} className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">로그인</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">생년월일</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              등록된 사용자만 로그인 가능합니다.
            </p>
          </form>
        ) : (
          /* 관리자 퀵 로그인 */
          <form onSubmit={handleAdminLogin} className="rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <KeyRound className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">관리자 로그인</h2>
              <p className="mt-1 text-xs text-gray-500">관리자 비밀번호를 입력하세요</p>
            </div>
            <div>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="비밀번호"
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
                maxLength={10}
              />
            </div>
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? '로그인 중...' : '관리자 로그인'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
