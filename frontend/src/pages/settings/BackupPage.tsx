import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Download, Upload, AlertTriangle, Database, RefreshCw,
  Trash2, Shield, HardDrive, Lock, CheckCircle2, XCircle,
  RotateCcw, Eye, EyeOff, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface DbStat {
  key: string;
  label: string;
  category: 'master' | 'transaction';
  group?: string;
  count: number;
}

// 초기화 그룹 정의
const RESET_GROUPS = [
  {
    id: 'project',
    label: '📁 프로젝트 (현장)',
    color: 'purple',
    tables: ['project'],
    desc: '등록된 모든 현장(프로젝트) 삭제. 하위 발주서·작업지시도 연쇄 삭제됨.',
    warning: true,
  },
  {
    id: 'order',
    label: '📋 발주서',
    color: 'blue',
    tables: ['purchase_order', 'purchase_order_item', 'socket_order', 'socket_order_item'],
    desc: '발주서, 발주 품목, 소켓 발주서 삭제.',
  },
  {
    id: 'work',
    label: '🔧 작업지시서',
    color: 'indigo',
    tables: ['work_order'],
    desc: '생성된 모든 작업지시서 삭제.',
  },
  {
    id: 'lot',
    label: '🔢 LOT 번호',
    color: 'cyan',
    tables: ['lot_transaction', 'lot_number_sequence'],
    desc: 'LOT 기록 및 시퀀스 초기화. LOT 번호가 001부터 재시작됩니다.',
  },
  {
    id: 'inspection',
    label: '🔍 검사 기록',
    color: 'green',
    tables: ['inspection_result', 'process_inspection_result', 'self_inspection_result', 'socket_incoming', 'socket_incoming_item'],
    desc: '인수검사, 공정검사, 자주검사, 소켓 수입검사 기록 삭제.',
  },
  {
    id: 'process',
    label: '⚙️ 공정 실행',
    color: 'yellow',
    tables: ['process_execution'],
    desc: '공정 실행 이력 삭제.',
  },
  {
    id: 'shipment',
    label: '🚚 출하',
    color: 'orange',
    tables: ['shipment_order', 'shipment_order_item'],
    desc: '출하지시서 및 출하 품목 삭제.',
  },
  {
    id: 'inventory',
    label: '📦 재고 이동',
    color: 'amber',
    tables: ['inventory_transaction'],
    desc: '재고 입출고 이동 기록 삭제.',
  },
  {
    id: 'log',
    label: '📝 로그/결재',
    color: 'gray',
    tables: ['approval', 'audit_logs', 'login_attempt'],
    desc: '결재 기록, 감사 로그, 로그인 시도 기록 삭제.',
  },
] as const;

type GroupId = typeof RESET_GROUPS[number]['id'];

const COLOR_MAP: Record<string, { border: string; bg: string; badge: string; text: string; }> = {
  purple:  { border: 'border-purple-300',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700',   text: 'text-purple-700'  },
  blue:    { border: 'border-blue-300',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',       text: 'text-blue-700'    },
  indigo:  { border: 'border-indigo-300',  bg: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-700',   text: 'text-indigo-700'  },
  cyan:    { border: 'border-cyan-300',    bg: 'bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-700',       text: 'text-cyan-700'    },
  green:   { border: 'border-green-300',   bg: 'bg-green-50',   badge: 'bg-green-100 text-green-700',     text: 'text-green-700'   },
  yellow:  { border: 'border-yellow-300',  bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700',   text: 'text-yellow-700'  },
  orange:  { border: 'border-orange-300',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700',   text: 'text-orange-700'  },
  amber:   { border: 'border-amber-300',   bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-700'   },
  gray:    { border: 'border-gray-300',    bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-700',       text: 'text-gray-700'    },
};

export function BackupPage() {
  const { isAdmin } = useAuth();

  // ── 내보내기/가져오기 상태 ──
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── 선택적 초기화 상태 ──
  const [selectedGroups, setSelectedGroups] = useState<Set<GroupId>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<GroupId>>(new Set());
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
      const res = await api.get<{ data: DbStat[] }>('/backup/stats');
      setStats(res.data || []);
    } catch { /* ignore */ }
    setLoadingStats(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">관리자만 접근 가능합니다.</div>;
  }

  // ── 통계 헬퍼 ──
  const statMap = useMemo(() => {
    const m: Record<string, number> = {};
    stats.forEach(s => { m[s.key] = s.count; });
    return m;
  }, [stats]);

  const masterStats = stats.filter(s => s.category === 'master');
  const totalRecords = stats.reduce((a, b) => a + b.count, 0);

  // 선택된 테이블 목록
  const selectedTables = useMemo(() => {
    const tables: string[] = [];
    for (const g of RESET_GROUPS) {
      if (selectedGroups.has(g.id)) tables.push(...g.tables);
    }
    return tables;
  }, [selectedGroups]);

  // 선택된 총 삭제 예정 건수
  const selectedDeleteCount = useMemo(() =>
    selectedTables.reduce((sum, t) => sum + (statMap[t] || 0), 0),
  [selectedTables, statMap]);

  // 그룹 선택 토글
  const toggleGroup = (groupId: GroupId) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    setConfirmStep(0); setResetResult(null); setResetError('');
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedGroups.size === RESET_GROUPS.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(RESET_GROUPS.map(g => g.id)));
    }
    setConfirmStep(0); setResetResult(null); setResetError('');
  };

  // 그룹 펼침/닫힘
  const toggleExpand = (groupId: GroupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── 내보내기 ──
  const handleExport = async () => {
    setExporting(true);
    try { window.location.href = '/api/backup/export'; }
    catch { alert('백업 다운로드 실패'); }
    finally { setTimeout(() => setExporting(false), 2000); }
  };

  // ── 가져오기 ──
  const handleImport = async () => {
    if (!importFile) return alert('백업 파일을 선택해주세요.');
    if (!confirm('정말 복원하시겠습니까? 기존 데이터가 모두 삭제됩니다.')) return;
    setImporting(true); setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/backup/import', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      setImportResult(data.data?.counts ?? data.counts ?? {});
      setImportFile(null); fetchStats();
    } catch { alert('복원 실패. 올바른 JSON 백업 파일인지 확인해주세요.'); }
    finally { setImporting(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) setImportFile(file);
    else alert('.json 파일만 업로드할 수 있습니다.');
  };

  // ── 선택적 초기화 실행 ──
  const handleReset = async () => {
    if (!resetPassword) { setResetError('비밀번호를 입력해주세요.'); return; }
    if (selectedTables.length === 0) { setResetError('초기화할 항목을 선택해주세요.'); return; }
    setResetError(''); setResetting(true); setResetResult(null);
    try {
      const token = localStorage.getItem('ezone_mes_token');
      const res = await fetch('/api/backup/reset/selective', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: resetPassword, tables: selectedTables }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.message || '초기화 실패'); return; }
      setResetResult(data.data);
      setResetPassword(''); setConfirmStep(0); setSelectedGroups(new Set()); fetchStats();
    } catch { setResetError('서버 통신 오류'); }
    finally { setResetting(false); }
  };

  return (
    <div>
      <PageHeader title="데이터 관리" description="데이터 백업, 복원 및 초기화" />

      {/* ════════ DB 현황 ════════ */}
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
          <div className="border rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
              <Shield size={12} /> 마스터 데이터 (유지됨)
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
          <div className="border rounded-lg p-3">
            <div className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
              <Database size={12} /> 운영 데이터 (초기화 대상)
            </div>
            <div className="space-y-1">
              {RESET_GROUPS.map(g => {
                const cnt = g.tables.reduce((s, t) => s + (statMap[t] || 0), 0);
                return (
                  <div key={g.id} className="flex justify-between text-xs">
                    <span className="text-gray-600">{g.label.replace(/^[^\s]+ /, '')}</span>
                    <span className={`font-mono font-medium ${cnt > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{cnt.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ 내보내기 / 가져오기 ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
          <p className="text-shop-sm text-gray-600 mb-2">현재 데이터베이스의 모든 데이터를 JSON 파일로 다운로드합니다.</p>
          <p className="text-xs text-gray-400 mb-6">마스터 + 운영 데이터 전체 포함. 초기화 전 반드시 백업하세요.</p>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-md text-shop-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {exporting ? <><RefreshCw size={16} className="animate-spin" /> 다운로드 중...</> : <><Download size={16} /> 백업 다운로드</>}
          </button>
        </div>

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
          <p className="text-shop-sm text-gray-600 mb-3">JSON 백업 파일을 업로드하여 데이터를 복원합니다.</p>
          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700">가져오기 시 기존 데이터가 모두 대체됩니다.</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = '.json';
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
                <div className="text-xs text-green-600 mt-1">{(importFile.size / 1024).toFixed(1)} KB</div>
                <div className="text-xs text-gray-500 mt-2">클릭하여 다른 파일 선택</div>
              </div>
            ) : (
              <div>
                <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                <div className="text-shop-sm text-gray-500">여기에 JSON 파일을 드래그하거나 클릭하여 선택</div>
                <div className="text-xs text-gray-400 mt-1">.json 파일만 지원</div>
              </div>
            )}
          </div>
          <button onClick={handleImport} disabled={!importFile || importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-md text-shop-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
            {importing ? <><RefreshCw size={16} className="animate-spin" /> 복원 중...</> : <><Upload size={16} /> 복원 시작</>}
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="mb-6 bg-white rounded-card border p-6">
          <h3 className="text-shop-lg font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-600" /> 복원 완료
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

      {/* ════════ 선택적 초기화 ════════ */}
      <div className="bg-white rounded-card border border-red-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-shop-lg font-bold text-red-800">운영 데이터 선택 초기화</h2>
            <p className="text-xs text-gray-500">삭제할 데이터를 그룹별로 선택하세요</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-5 bg-red-50 border border-red-200 rounded-md">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            초기화를 실행하면 선택한 데이터가 <strong>영구 삭제</strong>됩니다. 반드시 백업 후 진행하세요.
          </span>
        </div>

        {/* 전체 선택/해제 + 삭제 예정 건수 */}
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedGroups.size === RESET_GROUPS.length}
              ref={el => { if (el) el.indeterminate = selectedGroups.size > 0 && selectedGroups.size < RESET_GROUPS.length; }}
              onChange={toggleAll}
              className="h-4 w-4 accent-red-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-700">전체 선택 / 해제</span>
          </label>
          {selectedGroups.size > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              {selectedDeleteCount.toLocaleString()}건 삭제 예정
            </span>
          )}
        </div>

        {/* 그룹 체크박스 목록 */}
        <div className="space-y-2 mb-6">
          {RESET_GROUPS.map(group => {
            const c = COLOR_MAP[group.color] ?? COLOR_MAP.gray;
            const groupCount = group.tables.reduce((s, t) => s + (statMap[t] || 0), 0);
            const checked = selectedGroups.has(group.id);
            const expanded = expandedGroups.has(group.id);

            return (
              <div key={group.id} className={`border rounded-lg overflow-hidden transition-all ${checked ? c.border : 'border-gray-200'}`}>
                <div className={`flex items-center gap-3 px-4 py-3 ${checked ? c.bg : 'bg-white'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGroup(group.id)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <div
                    className="flex-1 flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span className={`text-sm font-semibold ${checked ? c.text : 'text-gray-700'}`}>
                      {group.label}
                    </span>
                    {group.warning && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">CASCADE 주의</span>
                    )}
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    groupCount > 0
                      ? (checked ? c.badge : 'bg-gray-100 text-gray-600')
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {groupCount.toLocaleString()}건
                  </span>
                  <button
                    onClick={() => toggleExpand(group.id)}
                    className="text-gray-400 hover:text-gray-600 p-0.5 ml-1"
                    title="상세 보기"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>

                {/* 세부 테이블 (펼침) */}
                {expanded && (
                  <div className="border-t bg-gray-50 px-4 py-2.5">
                    <p className="text-xs text-gray-500 mb-2">{group.desc}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {group.tables.map(t => (
                        <div key={t} className="flex justify-between text-xs">
                          <span className="text-gray-500 font-mono">{t}</span>
                          <span className={`font-mono font-medium ${(statMap[t] || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {(statMap[t] || 0).toLocaleString()}건
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 선택 없을 때 안내 */}
        {selectedGroups.size === 0 && confirmStep === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">
            위에서 초기화할 항목을 선택하세요
          </div>
        )}

        {/* Step 0: 실행 버튼 */}
        {selectedGroups.size > 0 && confirmStep === 0 && (
          <button
            onClick={() => setConfirmStep(1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-md text-shop-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            선택한 {selectedGroups.size}개 그룹 초기화 ({selectedDeleteCount.toLocaleString()}건)
          </button>
        )}

        {/* Step 1: 1차 확인 */}
        {confirmStep === 1 && (
          <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
            <p className="text-shop-sm font-bold text-red-800 mb-2">정말 초기화하시겠습니까?</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Array.from(selectedGroups).map(gid => {
                const g = RESET_GROUPS.find(x => x.id === gid);
                return g ? (
                  <span key={gid} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                    {g.label}
                  </span>
                ) : null;
              })}
            </div>
            <p className="text-xs text-red-600 mb-4">
              총 <strong>{selectedDeleteCount.toLocaleString()}건</strong>이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
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

        {/* Step 2: 비밀번호 입력 */}
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
                {resetting ? <><RefreshCw size={14} className="animate-spin" /> 초기화 중...</> : <><Trash2 size={14} /> 초기화 실행</>}
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
              <CheckCircle2 size={16} /> 초기화 완료
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
