import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
    if (newPw.length < 8) { toast.error('비밀번호는 8자 이상이어야 합니다.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPw,
        new_password: newPw,
      });
      toast.success('비밀번호가 변경되었습니다.');
      window.location.href = '/';
    } catch (err: any) {
      const errMsg = err?.body?.message || err?.body?.error || err?.message || '비밀번호 변경 중 오류가 발생했습니다.';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-8 w-8" />
            <h1 className="text-xl font-bold">비밀번호 변경 필요</h1>
          </div>
          <p className="text-sm text-amber-100">
            관리자가 비밀번호를 초기화했습니다.<br />
            보안을 위해 새 비밀번호를 설정해주세요.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              임시 비밀번호 (전화번호)
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="010-xxxx-xxxx"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-12"
                required
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-3 text-gray-400">
                {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">새 비밀번호</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="소문자+숫자+특수문자, 8자 이상"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-12"
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-3 text-gray-400">
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="새 비밀번호를 다시 입력"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>

          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">비밀번호 정책</p>
            <p>• 소문자 1개 이상 포함</p>
            <p>• 숫자 1개 이상 포함</p>
            <p>• 특수문자 1개 이상 포함</p>
            <p>• 8자 이상</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
