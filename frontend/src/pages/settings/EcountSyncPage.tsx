import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Settings, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Package, Building2, BarChart3, ShoppingCart, TrendingUp,
  ChevronDown, ChevronUp, Loader2, Eye, EyeOff, Clock,
  Plug, Zap,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────
interface SyncLog {
  log_id: number;
  sync_type: string;
  status: 'success' | 'error';
  total_count: number;
  synced_count: number;
  error_msg: string | null;
  started_at: string;
  finished_at: string | null;
}

interface SyncSummary {
  summary: Record<string, { status: string; total_count: number; synced_count: number; finished_at: string } | null>;
  counts: Record<string, number>;
}

interface EcountConfig {
  id: number;
  com_code: string;
  user_id: string;
  lan_type: string;
  zone: string | null;
  session_at: string | null;
  is_active: boolean;
}

const syncTypes = [
  { key: 'item',     label: '품목',     icon: Package,      color: 'blue',  endpoint: 'items',     desc: 'item_master 동기화' },
  { key: 'customer', label: '거래처',   icon: Building2,    color: 'purple', endpoint: 'customers', desc: 'company 동기화' },
  { key: 'stock',    label: '재고',     icon: BarChart3,    color: 'green',  endpoint: 'stock',     desc: '이카운트 재고 스냅샷' },
  { key: 'purchase', label: '구매내역', icon: ShoppingCart, color: 'amber',  endpoint: 'purchases', desc: '최근 3개월 구매내역' },
  { key: 'sale',     label: '판매내역', icon: TrendingUp,   color: 'rose',   endpoint: 'sales',     desc: '최근 3개월 판매내역' },
] as const;

const colorMap = {
  blue:   { card: 'border-blue-400 bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   badge: 'bg-blue-100 text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700' },
  purple: { card: 'border-purple-400 bg-purple-50', icon: 'bg-purple-100 text-purple-600', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
  green:  { card: 'border-green-400 bg-green-50', icon: 'bg-green-100 text-green-600', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  amber:  { card: 'border-amber-400 bg-amber-50', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700' },
  rose:   { card: 'border-rose-400 bg-rose-50',   icon: 'bg-rose-100 text-rose-600',   badge: 'bg-rose-100 text-rose-700',   btn: 'bg-rose-600 hover:bg-rose-700' },
};

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────
export function EcountSyncPage() {
  const [config, setConfig] = useState<EcountConfig | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'purchases' | 'sales'>('overview');

  const fetchSummary = useCallback(async () => {
    try {
      const r = await api.get<{ data: SyncSummary }>('/ecount/sync/summary');
      setSummary(r.data);
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await api.get<{ data: SyncLog[] }>('/ecount/sync/logs?limit=20');
      setLogs(r.data);
    } catch {}
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const r = await api.get<{ data: EcountConfig | null }>('/ecount/config');
      setConfig(r.data);
      if (!r.data) setShowConfig(true);
    } catch {}
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchSummary();
    fetchLogs();
  }, []);

  const handleSync = async (endpoint: string, key: string) => {
    setSyncing(p => ({ ...p, [key]: true }));
    try {
      await api.post(`/ecount/sync/${endpoint}`, {});
      await fetchSummary();
      await fetchLogs();
    } catch (e: any) {
      alert(`동기화 실패: ${e?.body?.error || e.message}`);
    } finally {
      setSyncing(p => ({ ...p, [key]: false }));
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('전체 동기화를 시작합니다. 품목·거래처·재고·구매·판매 모두 동기화됩니다.\n계속하시겠습니까?')) return;
    setSyncingAll(true);
    try {
      await api.post('/ecount/sync/all', {});
      await fetchSummary();
      await fetchLogs();
      alert('전체 동기화 완료 ✅');
    } catch (e: any) {
      alert(`동기화 실패: ${e?.body?.error || e.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const isConnected = !!config;

  return (
    <div className="space-y-5">
      <PageHeader title="이카운트 ERP 연동" description="이카운트 ERP 데이터를 MES로 자동 동기화">
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            연동 설정
          </button>
          {isConnected && (
            <button
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {syncingAll ? '동기화 중...' : '전체 일괄 동기화'}
            </button>
          )}
        </div>
      </PageHeader>

      {/* 연결 상태 배너 */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-xl border',
        isConnected
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200',
      )}>
        {isConnected ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">이카운트 연동 설정 완료</p>
              <p className="text-xs text-green-600 mt-0.5">
                회사코드: {config.com_code} · 사용자: {config.user_id}
                {config.zone ? ` · Zone: ${config.zone}` : ''}
                {config.session_at ? ` · 마지막 로그인: ${new Date(config.session_at).toLocaleString('ko-KR')}` : ''}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">이카운트 연동 설정 필요</p>
              <p className="text-xs text-yellow-600 mt-0.5">아래 '연동 설정'에서 API 인증키를 입력해주세요.</p>
            </div>
          </>
        )}
      </div>

      {/* 연동 설정 폼 */}
      {showConfig && <ConfigForm onSaved={() => { fetchConfig(); setShowConfig(false); }} />}

      {/* 동기화 카드 그리드 */}
      <div className="grid grid-cols-5 gap-3">
        {syncTypes.map(({ key, label, icon: Icon, color, endpoint, desc }) => {
          const c = colorMap[color];
          const s = summary?.summary[key];
          const count = summary?.counts[key] ?? 0;
          const isSyncing = syncing[key];
          return (
            <div key={key} className={cn('rounded-xl border-l-4 p-4 flex flex-col gap-3', c.card)}>
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', c.icon)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{label}</p>
                  <p className="text-[10px] text-gray-500">{desc}</p>
                </div>
              </div>

              <div>
                <p className="text-2xl font-bold text-gray-800">{count.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
                {s ? (
                  <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {s.finished_at ? new Date(s.finished_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-0.5">미동기화</p>
                )}
              </div>

              <button
                onClick={() => handleSync(endpoint, key)}
                disabled={isSyncing || !isConnected}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors',
                  c.btn,
                  (isSyncing || !isConnected) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {isSyncing ? '동기화 중...' : '동기화'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 탭: 이카운트 데이터 보기 */}
      {isConnected && summary && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex border-b">
            {[
              { key: 'overview',   label: '동기화 이력' },
              { key: 'stock',      label: `재고 현황 (${(summary.counts.stock || 0).toLocaleString()}건)` },
              { key: 'purchases',  label: `구매내역 (${(summary.counts.purchase || 0).toLocaleString()}건)` },
              { key: 'sales',      label: `판매내역 (${(summary.counts.sale || 0).toLocaleString()}건)` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'overview' && <LogTable logs={logs} onRefresh={fetchLogs} />}
            {activeTab === 'stock'    && <StockTable />}
            {activeTab === 'purchases' && <PurchaseTable />}
            {activeTab === 'sales'    && <SaleTable />}
          </div>
        </div>
      )}

      {/* 로그 (미연결 시) */}
      {!isConnected && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Plug className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">이카운트 연동이 설정되지 않았습니다</p>
          <p className="text-gray-400 text-sm mt-1">위의 '연동 설정' 버튼을 클릭하여 API 인증키를 입력하세요.</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 설정 폼
// ────────────────────────────────────────────────────────────────────────────
function ConfigForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ com_code: '', user_id: '', api_cert_key: '', lan_type: 'ko-KR' });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!form.com_code || !form.user_id || !form.api_cert_key) {
      alert('회사코드, 사용자ID, API 인증키를 모두 입력하세요.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // 저장 먼저
      await api.post('/ecount/config', form);
      // 연결 테스트
      const r = await api.post<{ zone: string; message: string }>('/ecount/test-connect', {});
      setTestResult({ ok: true, message: r.message });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.body?.error || '연결 실패' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.com_code || !form.user_id || !form.api_cert_key) {
      alert('회사코드, 사용자ID, API 인증키를 모두 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/ecount/config', form);
      onSaved();
    } catch (e: any) {
      alert(e?.body?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-bold text-gray-800">이카운트 API 연동 설정</h3>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">API 인증키 발급 방법</p>
        <p>1. 이카운트 ERP 로그인</p>
        <p>2. <strong>[셀프 커스터마이징] → [정보 관리] → [API 인증키 발급]</strong></p>
        <p>3. 발급된 인증키를 아래에 입력</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">회사코드 * <span className="font-normal text-gray-400">(6자리)</span></label>
          <input
            type="text"
            value={form.com_code}
            onChange={e => setForm(f => ({ ...f, com_code: e.target.value.trim() }))}
            placeholder="예: 001234"
            maxLength={20}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">사용자 ID *</label>
          <input
            type="text"
            value={form.user_id}
            onChange={e => setForm(f => ({ ...f, user_id: e.target.value.trim() }))}
            placeholder="이카운트 로그인 ID"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">API 인증키 *</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.api_cert_key}
              onChange={e => setForm(f => ({ ...f, api_cert_key: e.target.value.trim() }))}
              placeholder="발급받은 API 인증키"
              className="w-full border rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">언어</label>
          <select
            value={form.lan_type}
            onChange={e => setForm(f => ({ ...f, lan_type: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ko-KR">한국어 (ko-KR)</option>
            <option value="en-US">English (en-US)</option>
          </select>
        </div>
      </div>

      {/* 연결 테스트 결과 */}
      {testResult && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-lg text-sm',
          testResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800',
        )}>
          {testResult.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />}
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          {testing ? '테스트 중...' : '연결 테스트'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 동기화 이력 테이블
// ────────────────────────────────────────────────────────────────────────────
const typeLabel: Record<string, string> = {
  item: '품목', customer: '거래처', stock: '재고', purchase: '구매내역', sale: '판매내역',
};

function LogTable({ logs, onRefresh }: { logs: SyncLog[]; onRefresh: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">최근 동기화 이력</p>
        <button onClick={onRefresh} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />새로고침
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">종류</th>
              <th className="px-3 py-2 text-left text-gray-500">시작 시각</th>
              <th className="px-3 py-2 text-left text-gray-500">완료 시각</th>
              <th className="px-3 py-2 text-center text-gray-500">전체</th>
              <th className="px-3 py-2 text-center text-gray-500">동기화</th>
              <th className="px-3 py-2 text-center text-gray-500">결과</th>
              <th className="px-3 py-2 text-left text-gray-500">오류</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">동기화 이력이 없습니다.</td></tr>
            ) : logs.map(log => (
              <tr key={log.log_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{typeLabel[log.sync_type] || log.sync_type}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(log.started_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 text-gray-500">{log.finished_at ? new Date(log.finished_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-3 py-2 text-center font-mono">{log.total_count.toLocaleString()}</td>
                <td className="px-3 py-2 text-center font-mono">{log.synced_count.toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  {log.status === 'success'
                    ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" />성공</span>
                    : <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-[10px]"><XCircle className="h-2.5 w-2.5" />실패</span>}
                </td>
                <td className="px-3 py-2 text-red-500 max-w-[200px] truncate">{log.error_msg || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 재고 테이블
// ────────────────────────────────────────────────────────────────────────────
function StockTable() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const r = await api.get<{ data: any[] }>(`/ecount/stock${qs}`);
      setData(r.data);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" placeholder="품목명 또는 품목코드 검색" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={fetch} disabled={loading} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">검색</button>
      </div>
      <DataTable
        loading={loading}
        columns={['품목코드', '품목명', '창고코드', '창고명', '수량', '단위']}
        rows={data.map(d => [d.prod_cd, d.prod_nm, d.wh_cd, d.wh_nm, Number(d.qty).toLocaleString(), d.unit])}
        emptyMsg="재고 데이터가 없습니다. 동기화 후 확인하세요."
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 구매내역 테이블
// ────────────────────────────────────────────────────────────────────────────
function PurchaseTable() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const r = await api.get<{ data: any[] }>(`/ecount/purchases${qs}`);
      setData(r.data);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" placeholder="품목명 또는 거래처명 검색" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={fetch} disabled={loading} className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">검색</button>
      </div>
      <DataTable
        loading={loading}
        columns={['전표일자', '거래처', '품목코드', '품목명', '수량', '단가', '공급가', '부가세', '합계']}
        rows={data.map(d => [
          d.slip_date?.slice(0, 10) || '-',
          d.cust_nm, d.prod_cd, d.prod_nm,
          Number(d.qty).toLocaleString(),
          Number(d.price).toLocaleString(),
          Number(d.supply_amt).toLocaleString(),
          Number(d.vat_amt).toLocaleString(),
          Number(d.total_amt).toLocaleString(),
        ])}
        emptyMsg="구매내역이 없습니다. 동기화 후 확인하세요."
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 판매내역 테이블
// ────────────────────────────────────────────────────────────────────────────
function SaleTable() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const r = await api.get<{ data: any[] }>(`/ecount/sales${qs}`);
      setData(r.data);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetch(); }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" placeholder="품목명 또는 거래처명 검색" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetch()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
        <button onClick={fetch} disabled={loading} className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 disabled:opacity-50">검색</button>
      </div>
      <DataTable
        loading={loading}
        columns={['전표일자', '거래처', '품목코드', '품목명', '수량', '단가', '공급가', '부가세', '합계']}
        rows={data.map(d => [
          d.slip_date?.slice(0, 10) || '-',
          d.cust_nm, d.prod_cd, d.prod_nm,
          Number(d.qty).toLocaleString(),
          Number(d.price).toLocaleString(),
          Number(d.supply_amt).toLocaleString(),
          Number(d.vat_amt).toLocaleString(),
          Number(d.total_amt).toLocaleString(),
        ])}
        emptyMsg="판매내역이 없습니다. 동기화 후 확인하세요."
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 공통 데이터 테이블
// ────────────────────────────────────────────────────────────────────────────
function DataTable({ loading, columns, rows, emptyMsg }: {
  loading: boolean;
  columns: string[];
  rows: (string | number)[][];
  emptyMsg: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b">
          <tr>
            {columns.map(c => (
              <th key={c} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-gray-400">{emptyMsg}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
