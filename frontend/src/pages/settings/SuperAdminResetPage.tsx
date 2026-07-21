import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Download, Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'backup' | 'confirm' | 'done';

export function SuperAdminResetPage() {
  const { isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('backup');
  const [backupDone, setBackupDone] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 슈퍼관리자만 접근 가능
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-white">접근 거부</p>
          <p className="text-gray-400 mt-2">슈퍼관리자만 접근할 수 있습니다.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 전체 백업 다운로드
  const handleBackup = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Record<string, any[]> }>('/superadmin/backup');
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
      a.download = `ezone_mes_backup_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupDone(true);
    } catch {
      alert('백업 다운로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 전체 초기화 실행
  const handleReset = async () => {
    if (confirmText !== 'RESET-ALL') return;
    setLoading(true);
    try {
      await api.post('/superadmin/reset', {});
      setResult({ ok: true, message: '전체 초기화가 완료되었습니다. 시스템이 초기 상태로 돌아갔습니다.' });
      setStep('done');
      setTimeout(() => { logout(); navigate('/login'); }, 4000);
    } catch (e: any) {
      setResult({ ok: false, message: e?.body?.error ?? '초기화 중 오류가 발생했습니다.' });
      setStep('done');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900 border-2 border-red-600">
            <ShieldAlert className="h-9 w-9 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">시스템 초기화</h1>
          <p className="text-gray-500 text-sm mt-1">슈퍼관리자 전용 — 전체 데이터 초기화</p>
        </div>

        {/* 단계 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['backup', 'confirm', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-red-600 text-white' :
                ['backup','confirm','done'].indexOf(step) > i ? 'bg-green-700 text-white' :
                'bg-gray-800 text-gray-500'
              }`}>
                {['backup','confirm','done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 ${['backup','confirm','done'].indexOf(step) > i ? 'bg-green-700' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* 단계 1: 백업 */}
        {step === 'backup' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">초기화 전 백업 필수</p>
                <p className="text-gray-400 text-sm mt-1">
                  초기화를 진행하면 모든 업무 데이터가 삭제됩니다.<br />
                  아래 버튼을 눌러 백업 파일을 먼저 다운로드하세요.
                </p>
                <ul className="text-gray-500 text-xs mt-3 space-y-1">
                  <li>• 발주서, 작업지시, 소켓발주</li>
                  <li>• 재고, 입출고 기록</li>
                  <li>• 직원 계정 (admin 포함)</li>
                  <li>• 로그인 기록, 감사 로그</li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleBackup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              {loading ? '백업 생성 중...' : '전체 데이터 백업 다운로드'}
            </button>

            {backupDone && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                백업이 완료되었습니다.
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!backupDone}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* 단계 2: 확인 입력 */}
        {step === 'confirm' && (
          <div className="bg-gray-900 border border-red-900 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <Trash2 className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold">최종 확인</p>
                <p className="text-gray-400 text-sm mt-1">
                  이 작업은 <span className="text-red-400 font-bold">되돌릴 수 없습니다.</span><br />
                  아래에 <span className="text-white font-mono font-bold">RESET-ALL</span> 을 입력하고 실행하세요.
                </p>
              </div>
            </div>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET-ALL 입력"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-900 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep('backup')}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl text-sm transition-colors"
              >
                ← 이전
              </button>
              <button
                onClick={handleReset}
                disabled={confirmText !== 'RESET-ALL' || loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                {loading ? '초기화 중...' : '🔴 전체 초기화 실행'}
              </button>
            </div>
          </div>
        )}

        {/* 단계 3: 완료 */}
        {step === 'done' && result && (
          <div className={`bg-gray-900 border rounded-2xl p-6 text-center ${result.ok ? 'border-green-800' : 'border-red-800'}`}>
            {result.ok ? (
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
            ) : (
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            )}
            <p className={`font-bold text-lg ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.ok ? '초기화 완료' : '오류 발생'}
            </p>
            <p className="text-gray-400 text-sm mt-2">{result.message}</p>
            {result.ok && (
              <p className="text-gray-600 text-xs mt-3">4초 후 로그인 화면으로 이동합니다...</p>
            )}
            {!result.ok && (
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm"
              >
                대시보드로 이동
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
