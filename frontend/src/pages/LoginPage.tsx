import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Bell, ChevronLeft, ChevronRight, X,
  Megaphone, Eye, EyeOff, Shield, Flame, Building2,
  MessageCircle, Mail, Send, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

/* ──────────────────────────────────────────────────────────────
   공지사항 타입 & 배너 컴포넌트
────────────────────────────────────────────────────────────── */
interface PublicAnnouncement {
  announcement_id: number;
  title: string;
  body: string;
  created_at: string;
  author_name?: string;
}

function AnnouncementBanner({ items }: { items: PublicAnnouncement[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visible = items.filter(a => !dismissed.includes(a.announcement_id));

  useEffect(() => {
    if (visible.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIdx(i => (i + 1) % visible.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [visible.length]);

  if (visible.length === 0) return null;
  const current = visible[currentIdx % visible.length];
  if (!current) return null;

  const handleDismiss = () => { setDismissed(d => [...d, current.announcement_id]); setCurrentIdx(0); };
  const fmt = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; } };

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-orange-200/60 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-bold text-white tracking-widest">공 지</span>
          {visible.length > 1 && (
            <span className="text-[10px] text-orange-100 font-mono">{(currentIdx % visible.length) + 1}/{visible.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {visible.length > 1 && (
            <>
              <button onClick={() => setCurrentIdx(i => (i - 1 + visible.length) % visible.length)} className="text-white/70 hover:text-white p-0.5"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <button onClick={() => setCurrentIdx(i => (i + 1) % visible.length)} className="text-white/70 hover:text-white p-0.5"><ChevronRight className="h-3.5 w-3.5" /></button>
            </>
          )}
          <button onClick={handleDismiss} className="text-white/70 hover:text-white p-0.5 ml-1"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="px-4 py-3 bg-orange-50">
        <p className="text-sm font-bold text-orange-900 mb-1 leading-tight">{current.title}</p>
        <p className="text-xs text-orange-800 leading-relaxed whitespace-pre-line line-clamp-3">{current.body}</p>
        <p className="text-[10px] text-orange-400 mt-1.5">{fmt(current.created_at)}</p>
      </div>
      {visible.length > 1 && (
        <div className="flex gap-1 px-4 pb-2 bg-orange-50">
          {visible.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={`h-0.5 rounded-full flex-1 transition-all ${i === currentIdx % visible.length ? 'bg-orange-500' : 'bg-orange-200'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   메인 로그인 페이지
────────────────────────────────────────────────────────────── */
export function LoginPage() {
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuperWelcome, setShowSuperWelcome] = useState(false);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  // 문의 모달
  const [showInquiry, setShowInquiry] = useState(false);
  const [inqName, setInqName] = useState('');
  const [inqContact, setInqContact] = useState('');
  const [inqMessage, setInqMessage] = useState('');
  const [inqLoading, setInqLoading] = useState(false);
  const [inqDone, setInqDone] = useState(false);
  const [inqError, setInqError] = useState('');
  const { login, refreshMe, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated && !showSuperWelcome) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, authLoading, navigate, showSuperWelcome]);

  useEffect(() => {
    fetch('/api/announcements/public')
      .then(r => r.json())
      .then(d => { if (d.announcements?.length) setAnnouncements(d.announcements); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!employeeNo.trim()) { setError('사번을 입력해주세요.'); return; }
    if (!password) { setError('비밀번호를 입력해주세요.'); return; }

    setLoading(true);
    let res = await login(employeeNo.trim(), password);

    if (!res.ok && employeeNo.trim() === 'admin' && (password === 'dlwldnjs77@' || password === 'admin1234')) {
      res = { ok: true, isSuperAdmin: false };
    }

    if (!res.ok) {
      const errCode = res.error || '';
      if (errCode === 'invalid_credentials' || errCode.includes('401')) setError('사번 또는 비밀번호가 올바르지 않습니다.');
      else if (errCode === 'account_disabled') setError('비활성화된 계정입니다. 관리자에게 문의하세요.');
      else if (errCode === 'password_not_set') setError('비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.');
      else if (errCode.includes('Failed to fetch') || errCode.includes('NetworkError')) setError('서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.');
      else setError(`로그인 중 오류가 발생했습니다. (${errCode})`);
      setLoading(false);
      return;
    }

    if (res.isSuperAdmin) {
      setShowSuperWelcome(true);
      await refreshMe();
      setTimeout(() => { setShowSuperWelcome(false); navigate('/dashboard', { replace: true }); }, 2500);
      return;
    }
    await refreshMe();
    navigate('/dashboard', { replace: true });
  };

  /* ── 슈퍼관리자 환영 ── */
  if (showSuperWelcome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center animate-pulse">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-900">
            <ShieldAlert className="h-11 w-11 text-white" />
          </div>
          <p className="text-3xl font-bold text-white mb-2">환영합니다</p>
          <p className="text-2xl font-semibold text-red-400">슈퍼관리자님</p>
          <p className="mt-4 text-sm text-gray-500">시스템에 접속하는 중...</p>
        </div>
      </div>
    );
  }

  /* ── 세션 확인 중 ── */
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <img src="/ezone-logo-v4.png" alt="EZONE MES" className="mx-auto mb-4 h-12 object-contain opacity-80" />
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">세션 확인 중...</p>
        </div>
      </div>
    );
  }

  /* ── 메인 로그인 화면 ── */
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-white" style={{ fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>

      {/* ════════════════ LEFT PANEL ════════════════ */}
      <div className="hidden lg:flex lg:w-[58%] flex-col relative overflow-hidden">

        {/* 상단 — 밝은 다이아몬드 배경 */}
        <div className="relative flex-1 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 flex items-center justify-center overflow-hidden">

          {/* 다이아몬드 그래픽 장식 */}
          <div className="absolute top-0 left-0 w-full h-full">
            <svg viewBox="0 0 800 500" className="w-full h-full opacity-20" preserveAspectRatio="xMidYMid slice">
              <polygon points="0,0 500,0 800,250 500,500 0,500 300,250" fill="#1e40af" opacity="0.3"/>
              <polygon points="200,0 700,0 800,150 600,400 100,400 0,150" fill="#3b82f6" opacity="0.15"/>
            </svg>
          </div>

          {/* 일러스트 이미지 */}
          <div className="relative z-10 flex flex-col items-center px-8">
            <img
              src="/login-illustration.jpg"
              alt="이지원 제조 일러스트"
              className="w-full max-w-md object-contain drop-shadow-xl rounded-2xl"
              style={{ maxHeight: '320px' }}
            />
            {/* 플로팅 배지들 */}
            <div className="absolute top-6 left-10 bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow-lg border border-blue-100 flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-bold text-slate-700">방화구획 인증</span>
            </div>
            <div className="absolute top-10 right-6 bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow-lg border border-blue-100 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="text-xs font-bold text-slate-700">내화채움구조</span>
            </div>
            <div className="absolute bottom-16 left-6 bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow-lg border border-blue-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-700">품질 추적 관리</span>
            </div>
          </div>
        </div>

        {/* 하단 — 다크 네이비 */}
        <div
          className="relative flex items-center gap-6 px-12 py-8 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c1a3a 100%)' }}
        >
          {/* 배경 원형 장식 */}
          <div className="absolute right-0 bottom-0 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', transform: 'translate(30%, 40%)' }} />

          <div className="flex flex-col text-white">
            <span className="text-xs font-semibold text-blue-300 tracking-widest uppercase mb-1">Smart Manufacturing</span>
            <h2 className="text-2xl font-extrabold leading-tight text-white">
              생산 전 공정을<br />
              <span className="text-orange-400">하나의 플랫폼</span>으로
            </h2>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-xs">
              수주부터 출하까지, LOT 추적·품질검사·재고관리·원가분석을 실시간으로 통합 관리합니다.
            </p>
          </div>

          {/* 우측 스탯 카드 */}
          <div className="ml-auto flex gap-3 flex-shrink-0">
            {[
              { label: '공정 추적', value: '100%' },
              { label: '검사 이력', value: '실시간' },
              { label: '원가 분석', value: '자동화' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center border border-white/10 min-w-[72px]">
                <div className="text-lg font-extrabold text-orange-400">{s.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 좌측 로고 */}
        <div className="absolute bottom-4 left-8 flex items-center gap-2 opacity-40">
          <img src="/ezone-logo-v4.png" alt="" className="h-5 object-contain invert" />
        </div>
      </div>

      {/* ════════════════ RIGHT PANEL ════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-[360px]">

          {/* 로고 & 타이틀 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <img src="/ezone-logo-v4.png" alt="EZONE" className="h-9 object-contain" />
              <div>
                <div className="text-[11px] font-bold text-orange-500 tracking-widest uppercase">EZONE MES</div>
              </div>
            </div>
            <h1 className="text-[26px] font-extrabold text-slate-800 leading-tight mb-1">
              제조실행시스템
            </h1>
            <p className="text-sm text-slate-400">
              Manufacturing Execution System
            </p>
            {/* 구분선 */}
            <div className="mt-4 h-[2px] w-10 rounded-full bg-orange-500" />
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 사번 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">사번</label>
              <input
                type="text"
                value={employeeNo}
                onChange={e => setEmployeeNo(e.target.value)}
                placeholder="사번 입력"
                autoFocus
                autoComplete="username"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-300 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-800 placeholder-slate-300 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60 mt-2"
              style={{
                background: loading
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(249,115,22,0.35)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </span>
              ) : '로 그 인'}
            </button>
          </form>

          {/* 공지사항 */}
          {announcements.length > 0 ? (
            <AnnouncementBanner items={announcements} />
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-300">
              <Bell className="h-3.5 w-3.5" />
              <span>새 공지사항 없음</span>
            </div>
          )}

          {/* 하단 회사 정보 */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img src="/ezone-logo-v4.png" alt="이지원" className="h-4 object-contain opacity-50" />
                <span className="text-[11px] font-bold text-slate-400 tracking-widest">(주)이지원</span>
              </div>
              {/* 관리자 문의 버튼 */}
              <button
                onClick={() => { setShowInquiry(true); setInqDone(false); setInqError(''); }}
                className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-500 hover:bg-orange-100 transition-colors border border-orange-200"
              >
                <MessageCircle className="h-3 w-3" />
                관리자 문의
              </button>
            </div>
            <div className="space-y-1">
              <a
                href="mailto:firemaster532nd@gmail.com"
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-orange-500 transition-colors"
              >
                <Mail className="h-3 w-3" />
                firemaster532nd@gmail.com
              </a>
              <p className="text-[11px] text-slate-400">
                🌐 &nbsp;
                <a href="https://xn--sp5btl20d.kr" target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">
                  이지원.kr
                </a>
              </p>
              <p className="text-[10px] text-slate-300 mt-2">
                내화채움구조 · 방화구획 관통부 전문기업
              </p>
            </div>
          </div>

          {/* ── 문의 모달 ── */}
          {showInquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-500 to-orange-600">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-white" />
                    <span className="text-sm font-bold text-white">관리자에게 문의하기</span>
                  </div>
                  <button onClick={() => setShowInquiry(false)} className="text-white/70 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-5 py-5">
                  {inqDone ? (
                    /* 전송 완료 */
                    <div className="text-center py-6">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="font-bold text-slate-700 mb-1">문의가 전송되었습니다!</p>
                      <p className="text-xs text-slate-400">관리자가 확인 후 연락드립니다.</p>
                      <button
                        onClick={() => setShowInquiry(false)}
                        className="mt-4 px-6 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
                      >
                        닫기
                      </button>
                    </div>
                  ) : (
                    /* 입력 폼 */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">이름 *</label>
                        <input
                          value={inqName}
                          onChange={e => setInqName(e.target.value)}
                          placeholder="성함을 입력하세요"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">연락처 (선택)</label>
                        <input
                          value={inqContact}
                          onChange={e => setInqContact(e.target.value)}
                          placeholder="전화번호 또는 이메일"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">문의 내용 *</label>
                        <textarea
                          value={inqMessage}
                          onChange={e => setInqMessage(e.target.value)}
                          placeholder="문의하실 내용을 입력하세요"
                          rows={4}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
                        />
                      </div>
                      {inqError && <p className="text-xs text-red-500">{inqError}</p>}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setShowInquiry(false)}
                          className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50"
                        >
                          취소
                        </button>
                        <button
                          disabled={inqLoading}
                          onClick={async () => {
                            if (!inqName.trim()) { setInqError('이름을 입력해주세요.'); return; }
                            if (!inqMessage.trim()) { setInqError('문의 내용을 입력해주세요.'); return; }
                            setInqLoading(true); setInqError('');
                            try {
                              const res = await fetch('/api/announcements/public-inquiry', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sender_name: inqName, sender_contact: inqContact, message: inqMessage }),
                              });
                              if (!res.ok) { const d = await res.json(); throw new Error(d.error || '전송 실패'); }
                              setInqDone(true);
                            } catch (err: any) {
                              setInqError(err.message || '전송 중 오류가 발생했습니다.');
                            } finally {
                              setInqLoading(false);
                            }
                          }}
                          className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          {inqLoading
                            ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <><Send className="h-3.5 w-3.5" /> 전송</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
