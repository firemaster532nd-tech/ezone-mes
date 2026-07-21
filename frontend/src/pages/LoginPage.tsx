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
    if (!employeeNo.trim()) { setError('?щ쾲???낅젰?댁＜?몄슂.'); return; }
    if (!password) { setError('鍮꾨?踰덊샇瑜??낅젰?댁＜?몄슂.'); return; }

    setLoading(true);
    const res = await login(employeeNo.trim(), password);
    if (!res.ok) {
      const errCode = res.error || '';
      if (errCode === 'invalid_credentials' || errCode.includes('401')) {
        setError('?щ쾲 ?먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎.');
      } else if (errCode === 'account_disabled') {
        setError('鍮꾪솢?깊솕??怨꾩젙?낅땲?? 愿由ъ옄?먭쾶 臾몄쓽?섏꽭??');
      } else if (errCode === 'password_not_set') {
        setError('鍮꾨?踰덊샇媛 ?ㅼ젙?섏? ?딆븯?듬땲?? 愿由ъ옄?먭쾶 臾몄쓽?섏꽭??');
      } else if (errCode.includes('Failed to fetch') || errCode.includes('NetworkError')) {
        setError('?쒕쾭???곌껐?????놁뒿?덈떎. ?ㅽ듃?뚰겕 ?곹깭瑜??뺤씤??二쇱꽭??');
      } else {
        setError(`濡쒓렇??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. (${errCode})`);
      }
      setLoading(false);
      return;
    }

    // ?덊띁愿由ъ옄 濡쒓렇?????섏쁺 硫붿떆吏 ?쒖떆
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

  // ?덊띁愿由ъ옄 ?섏쁺 ?붾㈃
  if (showSuperWelcome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center animate-pulse">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900">
            <ShieldAlert className="h-11 w-11 text-white" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">?섏쁺?⑸땲??/p>
          <p className="text-2xl font-semibold text-red-400">?덊띁愿由ъ옄??/p>
          <p className="mt-4 text-sm text-gray-500">?쒖뒪?쒖뿉 ?묒냽?섎뒗 以?..</p>
        </div>
      </div>
    );
  }

  // ??λ맂 ?좏겙 ?좏슚???뺤씤 以????ㅽ뵾???쒖떆
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <img src="/ezone-logo-v3.png" alt="EZONE MES" className="mx-auto mb-4 h-14 object-contain" />
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">?몄뀡 ?뺤씤 以?..</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/ezone-logo-v3.png" alt="EZONE MES" className="mx-auto mb-4 h-14 object-contain" />
          <h1 className="text-2xl font-bold text-gray-900">EZONE MES</h1>
          <p className="mt-1 text-sm text-gray-500">諛⑺솕援ы쉷 愿?듬? MES</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-center text-lg font-semibold text-gray-900">濡쒓렇??/h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">?щ쾲</label>
              <input
                type="text"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="?щ쾲???낅젰?섏꽭??
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">鍮꾨?踰덊샇</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="鍮꾨?踰덊샇"
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
            {loading ? '濡쒓렇??以?..' : '濡쒓렇??}
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            ?깅줉???ъ슜?먮쭔 濡쒓렇??媛?ν빀?덈떎. 怨꾩젙 臾몄쓽: 愿由ъ옄
          </p>
        </form>
      </div>
    </div>
  );
}
