import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { 
  LogOut, User, KeyRound, Lock, ShieldAlert, 
  ChevronDown, CheckCircle2, Eye, EyeOff, X 
} from 'lucide-react';
import { toast } from 'sonner';

export function validatePasswordComplexity(password: string): string | null {
  if (!/[a-z]/.test(password)) {
    return '비밀번호에는 영어 소문자가 반드시 포함되어야 합니다.';
  }
  if (!/\d/.test(password)) {
    return '비밀번호에는 숫자가 반드시 포함되어야 합니다.';
  }
  if (!/[\W_]/.test(password)) {
    return '비밀번호에는 특수문자가 반드시 포함되어야 합니다.';
  }
  if (/(\d)\1\1/.test(password)) {
    return '비밀번호에 3개 이상의 반복된 숫자(예: 111)를 사용할 수 없습니다.';
  }
  for (let i = 0; i < password.length - 2; i++) {
    const c1 = password.charCodeAt(i);
    const c2 = password.charCodeAt(i + 1);
    const c3 = password.charCodeAt(i + 2);
    if (c1 >= 48 && c1 <= 57 && c2 >= 48 && c2 <= 57 && c3 >= 48 && c3 <= 57) {
      if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
        return '비밀번호에 3개 이상의 연속된 숫자(예: 123, 321)를 사용할 수 없습니다.';
      }
    }
  }
  return null;
}

export function AppLayout() {
  const { user, logout, refreshMe } = useAuth();
  const navigate = useNavigate();

  // Dropdown & Modal States
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Self-Service Change Password State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Force Password Change State
  const [forceCurrentPw, setForceCurrentPw] = useState('');
  const [forceNewPw, setForceNewPw] = useState('');
  const [forceConfirmPw, setForceConfirmPw] = useState('');
  const [showForcePw, setShowForcePw] = useState(false);
  const [forcePwError, setForcePwError] = useState('');
  const [forcePwLoading, setForcePwLoading] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    toast.info('로그아웃되었습니다.');
  };

  // Self-Service Password Change Handler
  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (!currentPw || !newPw || !confirmPw) {
      setPwError('모든 필드를 입력해 주세요.');
      return;
    }
    const complexityErr = validatePasswordComplexity(newPw);
    if (complexityErr) {
      setPwError(complexityErr);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setPwLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPw,
        new_password: newPw
      });
      
      toast.success('비밀번호가 성공적으로 변경되었습니다!');
      setChangePwOpen(false);
      
      // Clear fields
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      
      // Refresh Auth Context
      await refreshMe();
    } catch (err: any) {
      const errorMsg = err?.body?.error;
      if (errorMsg === 'wrong_current_password') {
        setPwError('현재 비밀번호가 올바르지 않습니다.');
      } else {
        setPwError('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  // Force Password Change Handler
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setForcePwError('');

    if (!forceCurrentPw || !forceNewPw || !forceConfirmPw) {
      setForcePwError('모든 필드를 입력해 주세요.');
      return;
    }
    const complexityErr = validatePasswordComplexity(forceNewPw);
    if (complexityErr) {
      setForcePwError(complexityErr);
      return;
    }
    if (forceNewPw !== forceConfirmPw) {
      setForcePwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setForcePwLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: forceCurrentPw,
        new_password: forceNewPw
      });
      
      toast.success('비밀번호가 안전하게 변경되어 로그인이 완료되었습니다!');
      
      // Clear fields
      setForceCurrentPw('');
      setForceNewPw('');
      setForceConfirmPw('');
      
      // Refresh Auth Context to unlock UI
      await refreshMe();
    } catch (err: any) {
      const errorMsg = err?.body?.error;
      if (errorMsg === 'wrong_current_password') {
        setForcePwError('현재 비밀번호가 올바르지 않습니다.');
      } else {
        setForcePwError('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setForcePwLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-12 items-center justify-end border-b border-gray-200 bg-white px-6 gap-4 shadow-sm z-30">
          {user && (
            <div className="relative" ref={dropdownRef}>
              {/* Trigger Button */}
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg hover:bg-slate-50 px-3 py-1.5 transition-all text-xs font-semibold text-slate-700 border border-slate-200/80 shadow-sm bg-white"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]">
                  {user.worker_name[0]}
                </div>
                <span className="font-bold">{user.worker_name}</span>
                <span className="text-slate-400 font-normal">
                  ({user.dept_name || '-'} / {user.position || '-'})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Card Dropdown Panel */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Avatar Profile Header */}
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-sm shadow-md">
                      {user.worker_name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{user.worker_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">사번: {user.employee_no}</div>
                    </div>
                  </div>

                  {/* Info Body */}
                  <div className="py-3.5 space-y-2.5 text-xs border-b border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">부서</span>
                      <span className="font-semibold text-slate-800">{user.dept_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">직급</span>
                      <span className="font-semibold text-slate-800">{user.position || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">이메일</span>
                      <span className="font-semibold text-slate-800">{user.email || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">시스템 권한</span>
                      <span className="font-black text-blue-700 bg-blue-50/80 border border-blue-100 px-2 py-0.5 rounded-full text-[9px]">
                        {user.role === 'admin' ? '최고 관리자' : user.role === 'manager' ? '부서 책임자' : '일반 작업자'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 flex gap-2">
                    <button
                      onClick={() => { setProfileOpen(false); setChangePwOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 py-2 text-xs font-bold text-slate-700 transition-colors shadow-sm"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                      비밀번호 변경
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100/80 py-2 text-xs font-black text-red-600 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors />

      {/* ─── 모달 1: 일반 비밀번호 변경 모달 ─── */}
      {changePwOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 flex flex-col relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-blue-600" /> 비밀번호 변경
              </h3>
              <button 
                onClick={() => setChangePwOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSelfPasswordChange} className="mt-4 space-y-4">
              <div className="text-[10px] bg-slate-50 text-slate-500 rounded-xl p-3 space-y-1 leading-relaxed border border-slate-100/60">
                <p className="font-bold text-slate-700 text-xs mb-1">⚠️ 필수 보안 비밀번호 수칙:</p>
                <p>• <strong>영어 소문자, 숫자, 특수문자</strong>가 모두 최소 1자 이상 포함되어야 합니다.</p>
                <p>• <strong>3개 이상의 연속된 숫자</strong>(예: 123, 876)는 사용할 수 없습니다.</p>
                <p>• <strong>3개 이상의 반복된 숫자</strong>(예: 111, 999)는 사용할 수 없습니다.</p>
              </div>

              {pwError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex gap-2 animate-shake">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">현재 비밀번호 *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="현재 설정되어 있는 비밀번호 입력"
                    className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 pr-10 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">새 비밀번호 *</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="새로운 비밀번호 입력 (4자 이상)"
                  className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">새 비밀번호 확인 *</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="새로운 비밀번호 재입력"
                  className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 border-slate-200"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setChangePwOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 hover:bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 py-2.5 text-xs font-bold text-white transition-colors shadow-md"
                >
                  {pwLoading ? '변경 중...' : '비밀번호 변경 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 모달 2: [보안 필수] 비밀번호 강제 변경 모달 오버레이 ─── */}
      {user?.must_change_pw && user?.role !== 'admin' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md p-7 shadow-2xl border border-slate-200 flex flex-col relative animate-in zoom-in-95 duration-200">
            {/* Warning Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3 shadow-inner">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg">비밀번호 변경이 필요합니다</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-xs">
                현재 최초 로그인 상태이거나 관리자에 의해 비밀번호가 초기화되었습니다. 안전한 MES 정보 보호를 위해 비밀번호 변경 완료 후 사용이 허용됩니다.
              </p>
              <div className="text-[10px] bg-slate-50 text-slate-500 rounded-xl p-3 space-y-1 text-left leading-relaxed border border-slate-100/60 mt-3 w-full">
                <p className="font-bold text-slate-700 text-[11px] mb-1">⚠️ 필수 보안 비밀번호 수칙:</p>
                <p>• <strong>영어 소문자, 숫자, 특수문자</strong>가 모두 최소 1자 이상 포함되어야 합니다.</p>
                <p>• <strong>3개 이상의 연속된 숫자</strong>(예: 123, 876)는 사용할 수 없습니다.</p>
                <p>• <strong>3개 이상의 반복된 숫자</strong>(예: 111, 999)는 사용할 수 없습니다.</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleForcePasswordChange} className="mt-5 space-y-4">
              {forcePwError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex gap-2">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>{forcePwError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">현재 임시 비밀번호 *</label>
                <div className="relative">
                  <input
                    type={showForcePw ? 'text' : 'password'}
                    value={forceCurrentPw}
                    onChange={(e) => setForceCurrentPw(e.target.value)}
                    placeholder="로그인할 때 사용한 초기 비밀번호 입력"
                    className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 pr-10 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForcePw(!showForcePw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showForcePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">새로운 비밀번호 설정 *</label>
                <input
                  type="password"
                  value={forceNewPw}
                  onChange={(e) => setForceNewPw(e.target.value)}
                  placeholder="보안 수준 높은 새 비밀번호 입력 (4자 이상)"
                  className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 border-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">새로운 비밀번호 확인 *</label>
                <input
                  type="password"
                  value={forceConfirmPw}
                  onChange={(e) => setForceConfirmPw(e.target.value)}
                  placeholder="새로운 비밀번호 동일하게 다시 입력"
                  className="w-full text-xs rounded-lg border px-3 py-2.5 outline-none focus:border-blue-500 border-slate-200"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col gap-2 pt-3">
                <button
                  type="submit"
                  disabled={forcePwLoading}
                  className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 py-3 text-xs font-extrabold text-white transition-all shadow-md active:scale-95"
                >
                  {forcePwLoading ? '보안 변경 적용 중...' : '비밀번호 재설정 및 로그인 완료'}
                </button>
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg border border-slate-200 hover:bg-slate-50 py-2.5 text-xs font-bold text-slate-500 transition-colors mt-1"
                >
                  로그아웃하고 나가기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
