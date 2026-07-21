import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuperWelcome, setShowSuperWelcome] = useState(false);
  const { login, refreshMe, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated && !showSuperWelcome) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, authLoading, navigate, showSuperWelcome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!employeeNo.trim()) { setError('?¬ë²ˆ???…ë ¥?´ì£¼?¸ìš”.'); return; }
    if (!password) { setError('ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'); return; }

    setLoading(true);
    const res = await login(employeeNo.trim(), password);
    if (!res.ok) {
      const errCode = res.error || '';
      if (errCode === 'invalid_credentials' || errCode.includes('401')) {
        setError('?¬ë²ˆ ?ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.');
      } else if (errCode === 'account_disabled') {
        setError('ë¹„í™œ?±í™”??ê³„ì •?…ë‹ˆ?? ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì„¸??');
      } else if (errCode === 'password_not_set') {
        setError('ë¹„ë?ë²ˆí˜¸ê°€ ?¤ì •?˜ì? ?Šì•˜?µë‹ˆ?? ê´€ë¦¬ì?ê²Œ ë¬¸ì˜?˜ì„¸??');
      } else if (errCode.includes('Failed to fetch') || errCode.includes('NetworkError')) {
        setError('?œë²„???°ê²°?????†ìŠµ?ˆë‹¤. ?¤íŠ¸?Œí¬ ?íƒœë¥??•ì¸??ì£¼ì„¸??');
      } else {
        setError(`ë¡œê·¸??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤. (${errCode})`);
      }
      setLoading(false);
      return;
    }

    // ?ˆí¼ê´€ë¦¬ì ë¡œê·¸?????˜ì˜ ë©”ì‹œì§€ ?œì‹œ
    if (res.isSuperAdmin) {
      setShowSuperWelcome(true);
      await refreshMe();
      setTimeout(() => {
        setShowSuperWelcome(false);
        navigate('/dashboard', { replace: true });
      }, 2500);
      return;
    }

    await refreshMe();
    navigate('/dashboard', { replace: true });
  };

  // ?ˆí¼ê´€ë¦¬ì ?˜ì˜ ?”ë©´
  if (showSuperWelcome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center animate-pulse">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900">
            <ShieldAlert className="h-11 w-11 text-white" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">?˜ì˜?©ë‹ˆ??/p>
          <p className="text-2xl font-semibold text-red-400">?ˆí¼ê´€ë¦¬ì??/p>
          <p className="mt-4 text-sm text-gray-500">?œìŠ¤?œì— ?‘ì†?˜ëŠ” ì¤?..</p>
        </div>
      </div>
    );
  }

  // ?€?¥ëœ ? í° ? íš¨???•ì¸ ì¤????¤í”¼???œì‹œ
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <img src="/ezone-logo.png" alt="EZONE MES" className="mx-auto mb-4 h-16 object-contain" />
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">?¸ì…˜ ?•ì¸ ì¤?..</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/ezone-logo.png" alt="EZONE MES" className="mx-auto mb-4 h-16 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900">EZONE MES</h1>
          <p className="mt-1 text-sm text-gray-500">ë°©í™”êµ¬íš ê´€?µë? MES</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">ë¡œê·¸??/h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">?¬ë²ˆ</label>
              <input
                type="text"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="?¬ë²ˆ???…ë ¥?˜ì„¸??
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">ë¹„ë?ë²ˆí˜¸</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ë¹„ë?ë²ˆí˜¸"
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
            {loading ? 'ë¡œê·¸??ì¤?..' : 'ë¡œê·¸??}
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            ?±ë¡???¬ìš©?ë§Œ ë¡œê·¸??ê°€?¥í•©?ˆë‹¤. ê³„ì • ë¬¸ì˜: ê´€ë¦¬ì
          </p>
        </form>
      </div>
    </div>
  );
}
