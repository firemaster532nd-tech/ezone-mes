import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Download, Upload, AlertTriangle, Database, RefreshCw,
  Trash2, Shield, HardDrive, Lock, CheckCircle2, XCircle,
  RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface DbStat {
  key: string;
  label: string;
  category: 'master' | 'transaction';
  count: number;
}

export function BackupPage() {
  const { isAdmin } = useAuth();

  // ── 내보내기/가져오기 상태 ──
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── 초기화 상태 ──
  const [resetMode, setResetMode] = useState<'transaction' | 'all'>('transaction');
  const [resetPassword, setResetPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{
    success: boolean; mode: string; total_deleted: number; deleted_counts: Record<string, number>;
  } | null>(null);
  const [resetError, setResetError] = useState('');
  const [confirmStep, setConfirmStep] = useState(0); // 0=대기, 1=1차확인, 2=비번입력

  // ── DB 통계 ──
  const [stats, setStats] = useState<DbStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/backup/stats');
      const data = await res.json();
      setStats(data.data || []);
    } catch { /* ignore */ }
    setLoadingStats(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;
  }

  // ── 내보내기 ──
  const handleExport = async () => {
    setExporting(true);
    try {
      window.location.href = '/api/backup/export';
    } catch {
      alert('백업 다운로드 실패');
    } finally {
      setTimeout(() => setExporting(false), 2000);
    }
  };

  // ── 가져오기 ──
  const handleImport = async () => {
    if (!importFile) return alert('백업 파일을 선택해주세요.');
    if (!confirm('정말 복원하시겠습니까? 기존 데이터가 모두 삭제됩니다.')) return;

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/backup/import', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      setImportResult(data.data?.counts ?? data.counts ?? {});
      setImportFile(null);
      fetchStats();
    } catch {
      alert('복원 실패. 올바른 JSON 백업 파일인지 확인해주세요.');
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      setImportFile(file);
    } else {
      alert('.json 파일만 업로드할 수 있습니다.');
    }
  };

  // ── 초기화 실행 ──
  const handleReset = async () => {
    if (!resetPassword) { setResetError('비밀번호를 입력해주세요.'); return; }
    setResetError('');
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch('/api/backup/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword, mode: resetMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.message || '초기화 실패');
        setResetting(false);
        return;
      }
      setResetResult(data.data);
      setResetPassword('');
      setConfirmStep(0);
      fetchStats();
    } catch {
      setResetError('서버 통신 오류');
    } finally {
      setResetting(false);
    }
  };

  const masterStats = stats.filter(s => s.category === 'master');
  const txStats = stats.filter(s => s.category === 'transaction');
  const totalRecords = stats.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      <PageHeader title="데이터 관리" description="데이터 백업, 복원 및 초기화" />

      {/* ════════ DB 현황 카드 ════════ */}
      <div className="bg-white rounded-card border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <HardDrive size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-shop-lg font-bold">현재 데이터 현황</h2>
              <p className="text-xs text-gray-500">전체 {totalRecords.toLocaleString()}건</p>
            </div>
          </div>
          <button onClick={fetchStats} disabled={loadingStats}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <RotateCcw size={12} className={loadingStats ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 마스터 데이터 */}
          <div className="border rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
              <Shield size={12} /> 마스터 데이터 (기초등록)
            </div>
            <div className="space-y-1">
              {masterStats.map(s => (
                <div key={s.key} className="flex justify-between text-xs">
                  <span className="text-gray-600">{s.label}</span>
                  <span className="font-mono font-medium">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 운영 데이터 */}
          <div className="border rounded-lg p-3">
            <div className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
              <Database size={12} /> 운영 데이터 (수주/생산/검사)
            </div>
            <div className="space-y-1">
              {txStats.map(s => (
                <div key={s.key} className="flex justify-between text-xs">
                  <span className="text-gray-600">{s.label}</span>
                  <span className="font-mono font-medium">{s.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ 내보내기 / 가져오기 ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Export Section */}
        <div className="bg-white rounded-card border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Download size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-shop-lg font-bold">데이터 내보내기 (백업)</h2>
              <p className="text-xs text-gray-500">Export</p>
            </div>
          </div>

          <p className="text-shop-sm text-gray-600 mb-2">
            현재 데이터베이스의 모든 데이터를 JSON 파일로 다운로드합니다.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            마스터 + 운영 데이터 전체 포함. 초기화 전 반드시 백업하세요.
          </p>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <><RefreshCw size={16} className="animate-spin" /> 다운로드 중...</>
            ) : (
              <><Download size={16} /> 백업 다운로드</>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-card border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Upload size={20} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-shop-lg font-bold">데이터 가져오기 (복원)</h2>
              <p className="text-xs text-gray-500">Import</p>
            </div>
          </div>

          <p className="text-shop-sm text-gray-600 mb-3">
            JSON 백업 파일을 업로드하여 데이터를 복원합니다.
          </p>

          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700">가져오기 시 기존 데이터가 모두 대체됩니다.</span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) setImportFile(file);
              };
              input.click();
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4 ${
              dragOver ? 'border-blue-400 bg-blue-50' :
              importFile ? 'border-green-400 bg-green-50' :
              'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {importFile ? (
              <div>
                <Database size={24} className="mx-auto mb-2 text-green-600" />
                <div className="text-shop-sm font-medium text-green-700">{importFile.name}</div>
                <div className="text-xs text-green-600 mt-1">
                  {(importFile.size / 1024).toFixed(1)} KB
                </div>
                <div className="text-xs text-gray-500 mt-2">클릭하여 다른 파일 선택</div>
              </div>
            ) : (
              <div>
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                <div className="text-shop-sm text-gray-500">
                  여기에 JSON 파일을 드래그하거나 클릭하여 선택
                </div>
                <div className="text-xs text-gray-400 mt-1">.json 파일만 지원</div>
              </div>
            )}
          </div>

          <button
            onClick={handleImport}
            disabled={!importFile || importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-md text-shop-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {importing ? (
              <><RefreshCw size={16} className="animate-spin" /> 복원 중...</>
            ) : (
              <><Upload size={16} /> 복원 시작</>
            )}
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="mb-6 bg-white rounded-card border p-6">
          <h3 className="text-shop-lg font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600" />
            복원 완료
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-shop-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">테이블</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">가져온 행 수</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(importResult).map(([table, count]) => (
                  <tr key={table} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{table}</td>
                    <td className="px-4 py-2 text-right font-mono">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ 초기화/재설정 ════════ */}
      <div className="bg-white rounded-card border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-shop-lg font-bold text-red-800">초기화 / 재설정</h2>
            <p className="text-xs text-gray-500">Reset</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-5 bg-red-50 border border-red-200 rounded-md">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            초기화를 실행하면 선택한 데이터가 영구 삭제됩니다. 반드시 백업 후 진행하세요.
          </span>
        </div>

        {/* 모드 선택 */}
        <div className="mb-5">
          <label className="text-shop-sm font-semibold text-gray-700 mb-3 block">초기화 범위 선택</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 운영 데이터만 */}
            <button
              onClick={() => { setResetMode('transaction'); setConfirmStep(0); setResetResult(null); setResetError(''); }}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                resetMode === 'transaction'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  resetMode === 'transaction' ? 'border-orange-500' : 'border-gray-300'
                }`}>
                  {resetMode === 'transaction' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                </div>
                <span className="text-shop-sm font-bold text-gray-800">운영 데이터 초기화</span>
                <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">권장</span>
              </div>
              <p className="text-xs text-gray-500 ml-6">
                수주, 발주, 입고, 검사, 작업지시, LOT, 재고이력을 삭제합니다.
                <br />품목 마스터, 인정구조, BOM 등 기초등록 데이터는 유지됩니다.
              </p>
            </button>

            {/* 전체 초기화 */}
            <button
              onClick={() => { setResetMode('all'); setConfirmStep(0); setResetResult(null); setResetError(''); }}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                resetMode === 'all'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  resetMode === 'all' ? 'border-red-500' : 'border-gray-300'
                }`}>
                  {resetMode === 'all' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className="text-shop-sm font-bold text-gray-800">전체 초기화</span>
                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">주의</span>
              </div>
              <p className="text-xs text-gray-500 ml-6">
                운영 데이터 + 품목 마스터, 인정구조, BOM까지 전부 삭제합니다.
                <br />완전히 새로운 상태로 재시작할 때 사용합니다.
              </p>
            </button>
          </div>
        </div>

        {/* 삭제 대상 미리보기 */}
        <div className="mb-5 border rounded-lg p-3 bg-gray-50">
          <div className="text-xs font-semibold text-gray-600 mb-2">삭제 대상 데이터 미리보기</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.filter(s => resetMode === 'all' || s.category === 'transaction').map(s => (
              <div key={s.key} className={`flex justify-between text-xs px-2 py-1 rounded ${
                s.count > 0 ? 'bg-red-50 text-red-700' : 'text-gray-400'
              }`}>
                <span>{s.label}</span>
                <span className="font-mono font-medium">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            총 <span className="font-bold text-red-600">
              {stats.filter(s => resetMode === 'all' || s.category === 'transaction')
                .reduce((a, b) => a + b.count, 0).toLocaleString()}건
            </span> 삭제 예정
          </div>
        </div>

        {/* 초기화 진행 단계 */}
        {confirmStep === 0 && (
          <button
            onClick={() => setConfirmStep(1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-md text-shop-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            {resetMode === 'all' ? '전체 초기화 진행' : '운영 데이터 초기화 진행'}
          </button>
        )}

        {confirmStep === 1 && (
          <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
            <p className="text-shop-sm font-bold text-red-800 mb-3">
              정말 {resetMode === 'all' ? '전체' : '운영'} 데이터를 초기화하시겠습니까?
            </p>
            <p className="text-xs text-red-600 mb-4">
              이 작업은 되돌릴 수 없습니다. 백업을 먼저 수행했는지 확인하세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStep(2)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-shop-sm font-medium hover:bg-red-700"
              >
                <Lock size={14} /> 비밀번호 입력하고 초기화
              </button>
              <button
                onClick={() => { setConfirmStep(0); setResetError(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-shop-sm font-medium hover:bg-gray-300"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {confirmStep === 2 && (
          <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
            <p className="text-shop-sm font-bold text-red-800 mb-3">
              <Lock size={14} className="inline mr-1" />
              초기화 비밀번호를 입력하세요
            </p>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1 max-w-xs">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={e => { setResetPassword(e.target.value); setResetError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleReset(); }}
                  placeholder="초기화 비밀번호"
                  className="w-full border border-red-300 rounded-md px-3 py-2 text-shop-sm focus:outline-none focus:ring-2 focus:ring-red-400 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleReset}
                disabled={resetting || !resetPassword}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-md text-shop-sm font-bold hover:bg-red-800 disabled:opacity-50"
              >
                {resetting ? (
                  <><RefreshCw size={14} className="animate-spin" /> 초기화 중...</>
                ) : (
                  <><Trash2 size={14} /> 초기화 실행</>
                )}
              </button>
              <button
                onClick={() => { setConfirmStep(0); setResetPassword(''); setResetError(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-shop-sm font-medium hover:bg-gray-300"
              >
                취소
              </button>
            </div>
            {resetError && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <XCircle size={14} /> {resetError}
              </div>
            )}
          </div>
        )}

        {/* 초기화 결과 */}
        {resetResult && (
          <div className="mt-4 border rounded-lg p-4 bg-green-50 border-green-200">
            <h3 className="text-shop-sm font-bold text-green-800 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} />
              초기화 완료 ({resetResult.mode === 'all' ? '전체' : '운영 데이터'})
            </h3>
            <p className="text-xs text-green-700 mb-3">
              총 <span className="font-bold">{resetResult.total_deleted.toLocaleString()}건</span> 삭제됨
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(resetResult.deleted_counts)
                .filter(([, cnt]) => cnt > 0)
                .map(([table, cnt]) => (
                  <div key={table} className="flex justify-between text-xs px-2 py-1 bg-white rounded border">
                    <span className="text-gray-600">{table}</span>
                    <span className="font-mono text-red-600">-{cnt}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
