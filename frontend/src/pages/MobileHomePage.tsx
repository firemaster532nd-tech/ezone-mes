import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import {
  Package, Factory, Search, FileCheck, ClipboardList,
  Barcode, ChevronRight, Bell, LogOut, RefreshCw,
  Layers, TrendingUp, AlertTriangle, CheckCircle2, Download, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkOrderSummary {
  wo_id: number;
  wo_no: string;
  process_code: string;
  structure_name?: string;
  status: string;
  progress?: number;
}

interface DashboardStats {
  pendingWO: number;
  todayShipments: number;
  openDefects: number;
  pendingInspections: number;
}

const PROCESS_LABELS: Record<string, string> = {
  MIX: '배합', EXT_1: '압출1호기', EXT_2: '압출2호기',
  CUT: '재단', ASM: '조립', FN_ASM: 'FN조립',
  INSP: '검사', SHIP: '출하',
};

const QUICK_MENUS = [
  { label: '바코드 스캔',   sublabel: 'WMS 입출고',    icon: <Barcode size={26} />,      path: '/inventory/barcode-wms',       color: 'from-amber-500 to-orange-600' },
  { label: '인수검사',      sublabel: '수입 검사 기록', icon: <FileCheck size={26} />,    path: '/quality/incoming',            color: 'from-emerald-500 to-teal-600' },
  { label: '품질검사',      sublabel: '공정/FQC 검사',  icon: <Search size={26} />,       path: '/quality/process',             color: 'from-rose-500 to-pink-600' },
  { label: '작업지시',      sublabel: '공정 실행',      icon: <Factory size={26} />,      path: '/production/work-orders',      color: 'from-blue-500 to-indigo-600' },
  { label: 'LOT 추적',     sublabel: '역추적 조회',    icon: <TrendingUp size={26} />,   path: '/quality/lot-trace',           color: 'from-purple-500 to-violet-600' },
  { label: '공정 실적',     sublabel: '생산 입력',      icon: <ClipboardList size={26} />, path: '/production/process-stage',   color: 'from-cyan-500 to-blue-600' },
];

export function MobileHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ pendingWO: 0, todayShipments: 0, openDefects: 0, pendingInspections: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // PWA 앱 설치 배너 (A2HS — Add to Home Screen)
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();                    // 기본 브라우저 프롬프트 막기
      setInstallPrompt(e);                  // 이벤트 저장
      // 이미 설치했거나 배너를 닫은 경우엔 표시 안함
      if (!localStorage.getItem('pwa_install_dismissed')) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('🎉 이지원 MES 앱이 설치되었습니다!');
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', '1');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, dashRes] = await Promise.all([
        api.get<any>('/work-orders?status=IN_PROGRESS&limit=5').catch(() => null),
        api.get<any>('/dashboard/summary').catch(() => null),
      ]);

      const woList: WorkOrderSummary[] = (() => {
        const r = woRes;
        if (!r) return [];
        if (Array.isArray(r)) return r;
        if (Array.isArray(r.data)) return r.data;
        if (Array.isArray(r.data?.data)) return r.data.data;
        return [];
      })();
      setWorkOrders(woList.slice(0, 5));

      if (dashRes?.data) {
        const d = dashRes.data;
        setStats({
          pendingWO: d.pendingWO ?? d.pending_wo ?? woList.length,
          todayShipments: d.todayShipments ?? d.today_shipments ?? 0,
          openDefects: d.openDefects ?? d.open_defects ?? 0,
          pendingInspections: d.pendingInspections ?? d.pending_inspections ?? 0,
        });
      } else {
        setStats({ pendingWO: woList.length, todayShipments: 0, openDefects: 0, pendingInspections: 0 });
      }
    } catch {
      // quiet
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    toast.info('로그아웃되었습니다.');
  };

  const statusColor: Record<string, string> = {
    IN_PROGRESS: 'bg-blue-500',
    PENDING: 'bg-amber-500',
    COMPLETED: 'bg-emerald-500',
    PAUSED: 'bg-slate-400',
  };

  const statusLabel: Record<string, string> = {
    IN_PROGRESS: '진행중',
    PENDING: '대기',
    COMPLETED: '완료',
    PAUSED: '일시정지',
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-24 select-none">
      {/* ─── 상단 헤더 ─── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-4 pt-safe-top">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Layers size={18} className="text-slate-900" />
            </div>
            <div>
              <div className="text-white font-black text-sm leading-tight">이지원 MES</div>
              <div className="text-slate-400 text-[10px] leading-tight">
                {user?.worker_name} · {user?.dept_name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl text-slate-400 hover:text-white active:text-amber-400 transition-colors"
            >
              <RefreshCw size={18} className={cn(loading && 'animate-spin')} />
            </button>
            <Link to="/notifications" className="p-2 rounded-xl text-slate-400 hover:text-white relative">
              <Bell size={18} />
              {stats.pendingInspections > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 active:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── PWA 앱 설치 배너 ─── */}
      {showInstallBanner && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-3.5 flex items-center gap-3 shadow-lg shadow-amber-500/30 animate-in slide-in-from-top-2 duration-300">
          <img src="/icons/icon-192x192.png" alt="앱 아이콘" className="w-10 h-10 rounded-xl flex-shrink-0 shadow-md" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm leading-tight">이지원 MES 앱 설치</p>
            <p className="text-orange-100 text-[11px] mt-0.5">홈 화면에 추가하면 앱처럼 사용 가능!</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 bg-white text-orange-600 font-black text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-sm"
          >
            <Download size={14} className="inline mr-1" />
            설치
          </button>
          <button onClick={dismissInstallBanner} className="text-orange-100 hover:text-white p-1 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="px-4 py-4 space-y-5">
        {/* ─── 인사말 배너 ─── */}
        <div className="bg-gradient-to-br from-blue-900/60 to-indigo-900/60 rounded-2xl p-4 border border-blue-700/30 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-300 text-xs font-medium">안녕하세요,</p>
              <p className="text-white text-xl font-black mt-0.5">
                {user?.worker_name} <span className="text-blue-300 text-base font-bold">{user?.position}</span>
              </p>
              <p className="text-slate-400 text-[11px] mt-1">
                {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px]">마지막 업데이트</p>
              <p className="text-slate-300 text-[11px] font-mono">
                {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 통계 요약 카드 4개 ─── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-xl p-3.5 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Factory size={14} className="text-blue-400" />
              <span className="text-slate-400 text-[11px] font-medium">진행중 작업지시</span>
            </div>
            <p className="text-white text-2xl font-black">{stats.pendingWO}</p>
            <p className="text-blue-400 text-[10px] mt-0.5">건</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3.5 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-emerald-400" />
              <span className="text-slate-400 text-[11px] font-medium">오늘 출하 예정</span>
            </div>
            <p className="text-white text-2xl font-black">{stats.todayShipments}</p>
            <p className="text-emerald-400 text-[10px] mt-0.5">건</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3.5 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-slate-400 text-[11px] font-medium">미처리 불량</span>
            </div>
            <p className="text-white text-2xl font-black">{stats.openDefects}</p>
            <p className="text-amber-400 text-[10px] mt-0.5">건</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3.5 border border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={14} className="text-purple-400" />
              <span className="text-slate-400 text-[11px] font-medium">검사 대기</span>
            </div>
            <p className="text-white text-2xl font-black">{stats.pendingInspections}</p>
            <p className="text-purple-400 text-[10px] mt-0.5">건</p>
          </div>
        </div>

        {/* ─── 빠른 메뉴 그리드 ─── */}
        <div>
          <h2 className="text-slate-300 text-xs font-bold mb-3 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-amber-400 rounded-full" />
            실무 바로가기
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {QUICK_MENUS.map((menu) => (
              <Link
                key={menu.path}
                to={menu.path}
                className="group flex flex-col items-center gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700/50 active:scale-95 transition-all duration-100"
              >
                <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg', menu.color)}>
                  {menu.icon}
                </div>
                <div className="text-center">
                  <p className="text-white text-[11px] font-bold leading-tight">{menu.label}</p>
                  <p className="text-slate-500 text-[9px] mt-0.5">{menu.sublabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── 진행중 작업지시 리스트 ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-300 text-xs font-bold flex items-center gap-1.5">
              <span className="w-1 h-3 bg-blue-400 rounded-full" />
              진행중 작업지시
            </h2>
            <Link to="/production/work-orders" className="text-blue-400 text-[11px] font-bold flex items-center gap-0.5">
              전체보기 <ChevronRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-800 rounded-xl p-3.5 border border-slate-700 animate-pulse">
                  <div className="h-3.5 bg-slate-700 rounded w-1/3 mb-2" />
                  <div className="h-2.5 bg-slate-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : workOrders.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
              <Factory size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">진행중인 작업지시가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {workOrders.map((wo) => (
                <Link
                  key={wo.wo_id}
                  to={`/production/work-orders`}
                  className="block bg-slate-800 rounded-xl p-3.5 border border-slate-700/50 active:bg-slate-750 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor[wo.status] || 'bg-slate-400')} />
                        <span className="text-white text-xs font-black truncate">{wo.wo_no}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] truncate">
                        {PROCESS_LABELS[wo.process_code] || wo.process_code}
                        {wo.structure_name && ` · ${wo.structure_name}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold text-white',
                        statusColor[wo.status] || 'bg-slate-600'
                      )}>
                        {statusLabel[wo.status] || wo.status}
                      </span>
                    </div>
                  </div>
                  {wo.progress !== undefined && (
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>진행률</span>
                        <span className="font-bold text-slate-300">{wo.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${wo.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ─── PC 화면으로 전환 링크 ─── */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 text-center">
          <button
            onClick={() => {
              sessionStorage.setItem('prefer_desktop', '1');
              navigate('/');
            }}
            className="text-slate-400 text-[11px] hover:text-slate-200 transition-colors"
          >
            🖥️ PC 전체 화면으로 전환
          </button>
        </div>
      </div>

      {/* 하단 탭 내비게이션 */}
      <MobileBottomNav />
    </div>
  );
}
