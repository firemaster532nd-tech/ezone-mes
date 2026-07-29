import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Package, ShieldCheck,
  Truck, Settings, ChevronLeft, ChevronRight, Factory, Database,
  Wrench, FlaskConical, Scissors, Box, Layers,
  ArrowRightLeft, Monitor, HardHat, Boxes, PackageCheck,
  ChevronDown, Hammer, Inbox, FileText, ShoppingCart, Megaphone, ShieldAlert, CheckCircle, TrendingUp,
  Search, X, HeadphonesIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type SidebarMode = 'shop' | 'admin';

interface NavChild {
  label: string;
  path: string;
  disabled?: boolean;
}

interface NavSection {
  label: string;
  icon: React.ElementType;
  step?: string;
  path?: string;
  children?: NavChild[];
  dividerAfter?: boolean;
}

// ─── 이모티콘 제거 헬퍼 ───────────────────────────────────────────
const stripEmoji = (s: string) =>
  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();

// ─── 실무 모드 ───────────────────────────────────────────────────
const shopNavItems: NavSection[] = [
  { label: '오늘의 작업', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: '수주/발주', icon: ShoppingCart,
    children: [
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '견적서 등록/관리', path: '/orders/quotations' },
      { label: '미주문현황 조회', path: '/orders/unordered' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '주문내역 입고신청', path: '/orders/material-orders' },
    ],
  },
  { label: '결재함', icon: Inbox, path: '/approval/inbox' },
  { label: '공지 / 쪽지함', icon: Megaphone, path: '/announcements' },
  { label: '자재발주대기', icon: Package, path: '/orders/socket-order-wait', dividerAfter: true },
  { label: 'TBM 안전회의', icon: HardHat, path: '/production/tbm' },
  {
    label: '작업지시', icon: ClipboardList,
    children: [
      { label: '일반 작업지시', path: '/production/work-orders' },
      { label: '비인정제품 작업지시', path: '/production/socket-work-orders' },
      { label: '구조체 작업지시', path: '/production/struct-work-orders' },
      { label: '조립생산일지(J-LOT)', path: '/production/assembly-log' },
      { label: '부자재별 작업지시', path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
    ],
    dividerAfter: true,
  },
  {
    label: '통합 재고 관리', icon: Boxes,
    children: [
      { label: '원자재 통합 재고관리', path: '/inventory/material-stock' },
      { label: '바코드 스캔 WMS', path: '/inventory/barcode-wms' },
      { label: '랙 로케이션 관리', path: '/inventory/location' },
      { label: '비인정 재고 관리', path: '/inventory/non-certified-stock' },
      { label: '기초/초기 재고 설정', path: '/inventory/material-init' },
      { label: '수불대장 엑셀 연동', path: '/inventory/import' },
      { label: '소켓 / 평철 재고', path: '/inventory/socket-stock' },
      { label: '에프엔테크 재고현황', path: '/inventory/fn-tech-stock' },
      { label: 'LOT 라벨 재출력', path: '/inventory/label-reprint' },
      { label: '월말 실사/마감', path: '/inventory/closing' },
    ],
    dividerAfter: true,
  },
  {
    label: '인수검사 관리', icon: CheckCircle,
    children: [
      { label: '원재료 인수검사 (D101~D104)', path: '/quality/incoming/raw' },
      { label: '부자재 인수검사 (FN테크 연동)', path: '/quality/incoming/sub' },
      { label: '소켓 / 브라켓류 인수검사', path: '/quality/incoming/socket' },
      { label: '비인정제품 인수검사 (기준등록)', path: '/quality/incoming/non-certified' },
    ],
    dividerAfter: true,
  },
  { label: '원재료 입고/검사', icon: Package, step: '①', children: [{ label: '원재료 인수검사', path: '/quality/incoming/raw' }] },
  { label: '배합', icon: FlaskConical, step: '②', children: [{ label: '공정 실행', path: '/production/process-execution' }, { label: '자주검사', path: '/quality/self-inspection' }] },
  { label: '압출', icon: Layers, step: '③', children: [{ label: '공정 실행', path: '/production/process-execution' }, { label: '자주검사', path: '/quality/self-inspection' }] },
  { label: '재단', icon: Scissors, step: '④', children: [{ label: '공정 실행', path: '/production/process-execution' }, { label: '자주검사', path: '/quality/self-inspection' }] },
  {
    label: '부자재 입고/검사', icon: Box, step: '⑤',
    children: [
      { label: '부자재 인수검사 (FN테크)', path: '/quality/incoming/sub' },
      { label: '소켓/브라켓 인수검사', path: '/quality/incoming/socket' },
      { label: '비인정제품 인수검사', path: '/quality/incoming/non-certified' },
      { label: '부자재 입출고 등록', path: '/inventory/material-tx' },
    ],
  },
  {
    label: '조립', icon: Hammer, step: '⑥',
    children: [
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
    ],
    dividerAfter: true,
  },
  {
    label: '출하', icon: Truck, step: '⑦',
    children: [
      { label: '출하대기현황', path: '/shipment/ready' },
      { label: '출하조회', path: '/shipment/orders' },
      { label: '출하입력', path: '/shipment/input' },
      { label: '출하현황', path: '/shipment/pending' },
      { label: '포장·출하 스캔', path: '/shipment/staging' },
      { label: '거래명세서 관리', path: '/shipment/statements' },
      { label: '반품입고', path: '/shipment/returns' },
    ],
    dividerAfter: true,
  },
  {
    label: '현황판', icon: Monitor,
    children: [
      { label: '생산 현황', path: '/production/production-dashboard' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '로스 분석', path: '/reports/loss' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
    dividerAfter: true,
  },
  {
    label: '기초등록', icon: Database,
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },
  {
    label: '회계 관리', icon: TrendingUp,
    children: [
      { label: '기초데이터 설정', path: '/accounting/setup' },
      { label: '매출 현황', path: '/accounting/revenue' },
      { label: '원가 현황', path: '/accounting/cost' },
      { label: '손익 분석', path: '/accounting/profit-loss' },
    ],
    dividerAfter: true,
  },
  { label: '고객센터', icon: HeadphonesIcon, path: '/support' },
];

// ─── 관리 모드 ───────────────────────────────────────────────────
const adminNavItems: NavSection[] = [
  { label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: '수주/구매', icon: ShoppingCart,
    children: [
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '견적서 등록/관리', path: '/orders/quotations' },
      { label: '미주문현황 조회', path: '/orders/unordered' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '주문내역 입고신청', path: '/orders/material-orders' },
    ],
  },
  {
    label: '결재 관리', icon: Inbox,
    children: [
      { label: '결재함', path: '/approval/inbox' },
      { label: '결재 라인 설정', path: '/approval/lines' },
    ],
  },
  { label: '자재발주대기', icon: Package, path: '/orders/socket-order-wait', dividerAfter: true },
  {
    label: '생산관리', icon: ClipboardList,
    children: [
      { label: '작업지시 목록', path: '/production/work-orders' },
      { label: '비인정제품 작업지시', path: '/production/socket-work-orders' },
      { label: '구조체 작업지시', path: '/production/struct-work-orders' },
      { label: '부자재별 작업지시', path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '생산 현황', path: '/production/production-dashboard' },
      { label: '공정일지', path: '/production/daily-log' },
      { label: 'TBM 안전회의', path: '/production/tbm' },
    ],
  },
  {
    label: '품질관리', icon: ShieldCheck,
    children: [
      { label: '인수검사', path: '/quality/incoming' },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
      { label: '완제품검사 (C-901)', path: '/quality/fqc-inspection' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
  },
  {
    label: '통합 재고 관리', icon: Boxes,
    children: [
      { label: '전체 LOT 재고현황', path: '/inventory/dashboard' },
      { label: '통합 재고수불대장', path: '/inventory/ledger' },
      { label: '초기/기초 재고 설정', path: '/inventory/initialize' },
      { label: '수불대장 엑셀 연동', path: '/inventory/import' },
      { label: '소켓/평철 재고 관리', path: '/inventory/socket-stock' },
      { label: '에프엔테크 재고현황', path: '/inventory/fn-tech-stock' },
      { label: '로케이션 관리', path: '/inventory/location' },
      { label: 'LOT 라벨 재출력', path: '/inventory/label-reprint' },
    ],
  },
  {
    label: '출하 관리', icon: Truck,
    children: [
      { label: '출하대기현황', path: '/shipment/ready' },
      { label: '출하조회', path: '/shipment/orders' },
      { label: '출하입력', path: '/shipment/input' },
      { label: '출하현황', path: '/shipment/pending' },
      { label: '포장·출하 스캔', path: '/shipment/staging' },
      { label: '거래명세서 관리', path: '/shipment/statements' },
      { label: '반품입고', path: '/shipment/returns' },
    ],
  },
  {
    label: '보고서', icon: FileText,
    children: [
      { label: '일일/주간/월간', path: '/reports' },
      { label: '로스 분석', path: '/reports/loss' },
    ],
  },
  {
    label: '기초등록', icon: Database,
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },
  {
    label: '설정', icon: Settings,
    children: [
      { label: '사용자 관리', path: '/settings/users' },
      { label: '부서 관리', path: '/settings/departments' },
      { label: '권한 관리', path: '/settings/permissions' },
      { label: '로그인 기록', path: '/settings/login-logs' },
      { label: '이카운트 ERP 연동', path: '/settings/ecount' },
      { label: '백업 / 초기화', path: '/settings/backup' },
    ],
  },
  {
    label: '회계 관리', icon: TrendingUp,
    children: [
      { label: '기초데이터 설정', path: '/accounting/setup' },
      { label: '매출 현황', path: '/accounting/revenue' },
      { label: '원가 현황', path: '/accounting/cost' },
      { label: '손익 분석', path: '/accounting/profit-loss' },
    ],
  },
  { label: '고객센터', icon: HeadphonesIcon, path: '/support' },
];

// ─── 전체 검색용 플랫 메뉴 목록 ────────────────────────────────
function buildFlatMenu(items: NavSection[]) {
  const result: { label: string; path: string; parent?: string }[] = [];
  for (const s of items) {
    if (s.path) result.push({ label: stripEmoji(s.label), path: s.path });
    if (s.children) {
      for (const c of s.children) {
        result.push({ label: stripEmoji(c.label), path: c.path, parent: stripEmoji(s.label) });
      }
    }
  }
  return result;
}

// ─── 메뉴 검색 바 ──────────────────────────────────────────────
function MenuSearchBar({ currentMode }: { currentMode: SidebarMode }) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const allItems = useMemo(() =>
    buildFlatMenu(currentMode === 'shop' ? shopNavItems : adminNavItems),
    [currentMode]
  );
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allItems.filter(i => i.label.toLowerCase().includes(q) || i.parent?.toLowerCase().includes(q)).slice(0, 8);
  }, [query, allItems]);

  const isAdmin = currentMode === 'admin';
  const accentBg = isAdmin ? 'bg-indigo-700/40' : 'bg-teal-700/40';
  const accentBorder = isAdmin ? 'border-indigo-600/50' : 'border-teal-600/50';
  const accentFocus = isAdmin ? 'focus:border-indigo-400' : 'focus:border-teal-400';
  const accentHover = isAdmin ? 'hover:bg-indigo-700/50' : 'hover:bg-teal-700/50';
  const accentText = isAdmin ? 'text-indigo-300' : 'text-teal-300';

  return (
    <div className="relative px-2 py-2">
      <div className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all', accentBg, accentBorder)}>
        <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setShow(true); }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 150)}
          placeholder="메뉴 검색..."
          className={cn('flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none', accentFocus)}
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* 검색 결과 드롭다운 */}
      {show && filtered.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-slate-600 bg-slate-800 shadow-xl overflow-hidden">
          {filtered.map((item) => (
            <button
              key={item.path}
              onMouseDown={() => { navigate(item.path); setQuery(''); setShow(false); }}
              className={cn('flex w-full flex-col px-3 py-2 text-left transition-colors', accentHover)}
            >
              <span className="text-xs font-medium text-white">{item.label}</span>
              {item.parent && <span className={cn('text-[10px]', accentText)}>{item.parent}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 테마 정의 ──────────────────────────────────────────────────
function getTheme(mode: SidebarMode) {
  if (mode === 'shop') {
    return {
      aside:        'border-slate-700',
      asideBg:      '#1e2535',          // 딥 네이비 슬레이트
      logo:         'border-slate-700/60',
      logoText:     'text-white',
      collapseBtn:  'text-slate-400 hover:text-white',
      modeBar:      'border-slate-700/60',
      modeActiveBg: 'bg-teal-600',
      modeInactive: 'text-slate-400 hover:text-white',
      navDivider:   'border-slate-700/60',
      accent:       '#14b8a6',          // teal-500
      accentLight:  'rgba(20,184,166,0.15)',
      accentText:   'text-teal-300',
      stepColor:    'text-teal-400',
      sectionText:  'text-slate-300',
      childText:    'text-slate-400',
      label:        '실무',
    };
  }
  return {
    aside:        'border-slate-700',
    asideBg:      '#1a2035',          // 딥 다크 인디고 (보라 아님)
    logo:         'border-slate-700/60',
    logoText:     'text-white',
    collapseBtn:  'text-slate-400 hover:text-white',
    modeBar:      'border-slate-700/60',
    modeActiveBg: 'bg-indigo-600',
    modeInactive: 'text-slate-400 hover:text-white',
    navDivider:   'border-slate-700/60',
    accent:       '#818cf8',          // indigo-400
    accentLight:  'rgba(129,140,248,0.15)',
    accentText:   'text-indigo-300',
    stepColor:    'text-indigo-400',
    sectionText:  'text-slate-300',
    childText:    'text-slate-400',
    label:        '관리',
  };
}

// ─── 3D 입체 버튼 스타일 헬퍼 ───────────────────────────────────
function btn3dStyle(active: boolean, accent: string, accentLight: string) {
  if (active) {
    return {
      background: `linear-gradient(180deg, ${accent}dd 0%, ${accent}99 100%)`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(0,0,0,0.4), 0 1px 0 rgba(0,0,0,0.3)`,
      border: `1px solid ${accent}80`,
    };
  }
  return {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.08) 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.06)',
  };
}

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, _setMode] = useState<SidebarMode>(() => (localStorage.getItem('sidebar_mode') as SidebarMode) || 'shop');
  const setMode = (m: SidebarMode) => { _setMode(m); localStorage.setItem('sidebar_mode', m); };
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [approvalCount, setApprovalCount] = useState(0);
  const [socketWaitCount, setSocketWaitCount] = useState(0);
  const location = useLocation();
  const { user, permissions, isAdmin, isSuperAdmin, isManager } = useAuth();
  const canSwitchMode = isAdmin || user?.allowed_modes === 'both';
  const currentMode = canSwitchMode ? mode : 'shop';
  const theme = getTheme(currentMode);

  const pathReadable = (path?: string) => {
    if (!path) return true;
    if (isAdmin) return true;
    const found = permissions.find((p: { path: string | null; can_read: boolean }) => p.path === path);
    if (!found) return true;
    return found.can_read;
  };

  const MANAGER_ONLY_PATHS = [
    '/production/production-dashboard', '/inventory/dashboard',
    '/production/yield-dashboard', '/accounting/setup',
    '/accounting/revenue', '/accounting/cost', '/accounting/profit-loss',
  ];

  const filterNav = (items: NavSection[]): NavSection[] => {
    const canViewPath = (path?: string) => {
      if (!path) return true;
      if (!isManager && !isAdmin && MANAGER_ONLY_PATHS.includes(path)) return false;
      return pathReadable(path);
    };
    return items
      .map((s) => {
        if (s.path) return canViewPath(s.path) ? s : null;
        if (s.children) {
          const visible = s.children.filter((c) => canViewPath(c.path));
          return visible.length ? { ...s, children: visible } : null;
        }
        return s;
      })
      .filter((s): s is NavSection => s !== null);
  };

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get<{ data: { total: number } }>(`/approvals/counts?worker_id=${user.worker_id}`)
        .then((res) => setApprovalCount(res.data.total))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchWaitCount = () => {
      api.get<{ data: any[] }>('/socket-orders/wait?status=APPROVED')
        .then((res) => setSocketWaitCount(res.data?.length ?? 0))
        .catch(() => {});
    };
    fetchWaitCount();
    const interval = setInterval(fetchWaitCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const navItems = filterNav(currentMode === 'shop' ? shopNavItems : adminNavItems);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isSectionActive = (section: NavSection) => {
    if (section.path) return location.pathname === section.path;
    return section.children?.some((c) => location.pathname === c.path);
  };

  return (
    <aside
      className={cn('flex flex-col border-r transition-all duration-200', theme.aside, collapsed ? 'w-16' : 'w-64')}
      style={{ background: theme.asideBg }}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center justify-between border-b px-3', theme.logo)}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/ezone-logo-v4.png" alt="EZONE" className="h-7 w-auto object-contain" />
            <span className={cn('font-bold text-sm tracking-wide', theme.logoText)}>EZONE MES</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('rounded-md p-1.5 transition-colors', theme.collapseBtn)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {onMobileClose && (
          <button onClick={onMobileClose} className={cn('lg:hidden rounded-md p-1.5', theme.collapseBtn)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Mode Toggle — 3D 버튼 */}
      {!collapsed && canSwitchMode && (
        <div className={cn('flex gap-1.5 border-b px-2 py-2', theme.modeBar)}>
          {(['shop', 'admin'] as const).map((m) => {
            const active = currentMode === m;
            const label = m === 'shop' ? '실무' : '관리';
            const Icon = m === 'shop' ? Wrench : Settings;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setOpenSections(new Set()); }}
                className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all', active ? 'text-white' : 'text-slate-400 hover:text-slate-200')}
                style={btn3dStyle(active, theme.accent, theme.accentLight)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 메뉴 검색 */}
      {!collapsed && <MenuSearchBar currentMode={currentMode} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {navItems.map((section) => (
          <div key={`${mode}-${section.label}`}>
            {section.path ? (
              <SidebarLink
                item={{ label: stripEmoji(section.label), icon: section.icon, path: section.path }}
                collapsed={collapsed}
                step={section.step}
                theme={theme}
                badge={
                  section.path === '/approval/inbox' ? approvalCount :
                  section.path === '/orders/socket-order-wait' ? socketWaitCount :
                  undefined
                }
              />
            ) : (
              <SidebarSection
                section={{ ...section, label: stripEmoji(section.label), children: section.children?.map(c => ({ ...c, label: stripEmoji(c.label) })) }}
                collapsed={collapsed}
                isOpen={openSections.has(section.label) || !!isSectionActive(section)}
                onToggle={() => toggleSection(section.label)}
                theme={theme}
                childBadges={{ '/orders/socket-order-wait': socketWaitCount }}
              />
            )}
            {section.dividerAfter && !collapsed && (
              <div className={cn('my-1.5 border-t', theme.navDivider)} />
            )}
            {section.dividerAfter && collapsed && (
              <div className={cn('my-1 border-t mx-2', theme.navDivider)} />
            )}
          </div>
        ))}

        {/* 슈퍼관리자 전용 */}
        {isSuperAdmin && (
          <>
            <div className="my-2 border-t border-red-700/50" />
            {!collapsed && (
              <div className="px-3 py-1 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-bold text-red-400 tracking-widest uppercase">Super Admin</span>
              </div>
            )}
            <NavLink
              to="/superadmin/reset"
              className={({ isActive }) => cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive ? 'bg-red-600 text-white' : 'text-red-400 hover:bg-red-900/40 hover:text-red-300',
                collapsed && 'justify-center'
              )}
              title={collapsed ? '시스템 초기화' : undefined}
            >
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>시스템 초기화</span>}
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}

// ─── SidebarSection ─────────────────────────────────────────────
function SidebarSection({
  section, collapsed, isOpen, onToggle, theme, childBadges = {},
}: {
  section: NavSection;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof getTheme>;
  childBadges?: Record<string, number>;
}) {
  const Icon = section.icon;
  const location = useLocation();
  const hasActiveChild = section.children?.some((c) => location.pathname === c.path);

  if (collapsed) {
    const firstChild = section.children?.[0];
    if (!firstChild) return null;
    return (
      <NavLink
        to={firstChild.path}
        className={() => cn(
          'flex items-center justify-center rounded-lg px-2 py-2.5 transition-colors',
          hasActiveChild ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
        )}
        title={section.label}
        style={hasActiveChild ? btn3dStyle(true, theme.accent, theme.accentLight) : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
          hasActiveChild ? 'text-white' : 'text-slate-300 hover:text-white'
        )}
        style={btn3dStyle(hasActiveChild ?? false, theme.accent, theme.accentLight)}
      >
        {section.step && (
          <span className={cn('text-xs font-bold w-4 text-center flex-shrink-0', theme.stepColor)}>
            {section.step}
          </span>
        )}
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform opacity-50', isOpen && 'rotate-180')} />
      </button>
      {isOpen && section.children && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: theme.accent + '40' }}>
          {section.children.map((child) => {
            const isActive = location.pathname === child.path;
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all',
                  isActive ? 'font-semibold text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
                  child.disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
                )}
                style={isActive ? { background: theme.accentLight, color: theme.accent } : undefined}
              >
                <span className="flex-1">{child.label}</span>
                {childBadges[child.path] > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                    {childBadges[child.path]}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SidebarLink ────────────────────────────────────────────────
function SidebarLink({
  item, collapsed, step, badge, theme,
}: {
  item: { label: string; icon: React.ElementType; path?: string; disabled?: boolean };
  collapsed: boolean;
  step?: string;
  badge?: number;
  theme: ReturnType<typeof getTheme>;
}) {
  const Icon = item.icon;

  if (item.disabled || !item.path) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs opacity-30 cursor-not-allowed',
        'text-slate-400', collapsed && 'justify-center'
      )}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all relative',
        isActive ? 'text-white' : 'text-slate-300 hover:text-white',
        collapsed && 'justify-center'
      )}
      style={({ isActive }) => isActive ? btn3dStyle(true, theme.accent, theme.accentLight) : btn3dStyle(false, theme.accent, theme.accentLight)}
      title={collapsed ? item.label : undefined}
    >
      {!collapsed && step && (
        <span className={cn('text-xs font-bold w-4 text-center flex-shrink-0', theme.stepColor)}>{step}</span>
      )}
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
