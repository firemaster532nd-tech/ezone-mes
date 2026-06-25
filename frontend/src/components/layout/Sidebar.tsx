import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Package, ShieldCheck,
  Truck, Settings, ChevronLeft, ChevronRight, Factory, Database,
  Wrench, FlaskConical, Scissors, Box, Layers,
  ArrowRightLeft, Monitor, HardHat,
  ChevronDown, Hammer, Inbox, FileText, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
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
  step?: string;          // 실무모드 단계 번호 (e.g. "①")
  path?: string;          // 단일 링크
  children?: NavChild[];
  dividerAfter?: boolean; // 구분선
}

// ─── 실무 모드: 업무 흐름 순서 (수주→발주→생산→출하) ───
const shopNavItems: NavSection[] = [
  {
    label: '오늘의 작업',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  // ── 수주/발주 (업무의 시작점) ──
  {
    label: '수주/발주',
    icon: ShoppingCart,
    children: [
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '견적서 등록/관리', path: '/orders/quotations' },
      { label: '미주문현황 조회', path: '/orders/unordered' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '주문내역 → 입고신청', path: '/orders/material-orders' },
    ],
  },
  {
    label: '결재함',
    icon: Inbox,
    path: '/approval/inbox',
  },
  {
    label: '자재발주대기',
    icon: Package,
    path: '/orders/socket-order-wait',
    dividerAfter: true,
  },
  {
    label: 'TBM 안전회의',
    icon: HardHat,
    path: '/production/tbm',
  },
  {
    label: '작업지시',
    icon: ClipboardList,
    children: [
      { label: '일반 작업지시',      path: '/production/work-orders' },
      { label: '현장별 작업지시',     path: '/production/project-work-orders' },
      { label: '소켓 작업지시서',     path: '/production/socket-work-orders' },
      { label: '구조체 작업지시',     path: '/production/struct-work-orders' },
      { label: '부자재별 작업지시', path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
    ],
    dividerAfter: true,
  },
  // ── 생산 흐름 ──
  {
    label: '원재료 입고/검사',
    icon: Package,
    step: '①',
    children: [
      { label: '인수검사', path: '/quality/incoming' },
      { label: '재고 현황', path: '/inventory/dashboard' },
      { label: '초기 재고 설정', path: '/inventory/initialize' },
      { label: '수불대장 엑셀 연동', path: '/inventory/import' },
      { label: '소켓/평철 재고 관리', path: '/inventory/socket-stock' },
      { label: '에프엔테크 재고현황', path: '/inventory/fn-tech-stock' },
    ],
  },
  {
    label: '배합',
    icon: FlaskConical,
    step: '②',
    children: [
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '자주검사', path: '/quality/self-inspection' },
    ],
  },
  {
    label: '압출',
    icon: Layers,
    step: '③',
    children: [
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '자주검사', path: '/quality/self-inspection' },
    ],
  },
  {
    label: '재단',
    icon: Scissors,
    step: '④',
    children: [
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '자주검사', path: '/quality/self-inspection' },
    ],
  },
  {
    label: '부자재 입고/검사',
    icon: Box,
    step: '⑤',
    children: [
      { label: '인수검사', path: '/quality/incoming' },
      { label: '재고 현황', path: '/inventory/dashboard' },
      { label: '로케이션 관리', path: '/inventory/location' },
      { label: 'LOT 라벨 재출력', path: '/inventory/label-reprint' },
    ],
  },
  {
    label: '조립',
    icon: Hammer,
    step: '⑥',
    children: [
      { label: '공정 실행', path: '/production/process-execution' },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
    ],
    dividerAfter: true,
  },
  // ── 출하 ──
  {
    label: '출하',
    icon: Truck,
    step: '⑦',
    children: [
      { label: '출하대기현황',       path: '/shipment/ready' },
      { label: '출하조회',           path: '/shipment/orders' },
      { label: '출하입력',           path: '/shipment/input' },
      { label: '출하현황',           path: '/shipment/pending' },
      { label: '포장·출하 스캔',    path: '/shipment/staging' },
      { label: '거래명세서 관리',   path: '/shipment/statements' },
      { label: '반품입고',          path: '/shipment/returns' },
    ],
    dividerAfter: true,
  },
  // ── 현황/추적 ──
  {
    label: '현황판',
    icon: Monitor,
    children: [
      { label: '생산 현황', path: '/production/production-dashboard' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '로스 분석', path: '/reports/loss' },
      { label: '월말 실사/마감', path: '/inventory/closing' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
    dividerAfter: true,
  },
  // ── 기초등록 ──
  {
    label: '기초등록',
    icon: Database,
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },

];

// ─── 관리 모드: 업무 흐름 순서 (수주→발주→생산→품질→출하) ───
const adminNavItems: NavSection[] = [
  { label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: '수주/구매',
    icon: ShoppingCart,
    children: [
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '견적서 등록/관리', path: '/orders/quotations' },
      { label: '미주문현황 조회', path: '/orders/unordered' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '주문내역 → 입고신청', path: '/orders/material-orders' },
    ],
  },
  {
    label: '결재 관리',
    icon: Inbox,
    children: [
      { label: '결재함', path: '/approval/inbox' },
      { label: '결재 라인 설정', path: '/approval/lines' },
    ],
  },
  {
    label: '자재발주대기',
    icon: Package,
    path: '/orders/socket-order-wait',
    dividerAfter: true,
  },
  {
    label: '생산관리',
    icon: ClipboardList,
    children: [
      { label: '작업지시 목록',       path: '/production/work-orders' },
      { label: '현장별 작업지시',      path: '/production/project-work-orders' },
      { label: '소켓 작업지시서',      path: '/production/socket-work-orders' },
      { label: '구조체 작업지시',      path: '/production/struct-work-orders' },
      { label: '부자재별 작업지시',  path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
      { label: '공정 실행',           path: '/production/process-execution' },
      { label: '생산 현황',           path: '/production/production-dashboard' },
      { label: '공정일지',            path: '/production/daily-log' },
      { label: 'TBM 안전회의',        path: '/production/tbm' },
    ],
  },
  {
    label: '품질관리',
    icon: ShieldCheck,
    children: [
      { label: '인수검사', path: '/quality/incoming' },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
  },
  {
    label: '재고/출하',
    icon: ArrowRightLeft,
    children: [
      { label: '재고 현황', path: '/inventory/dashboard' },
      { label: '수불대장 엑셀 연동', path: '/inventory/import' },
      { label: '월말 실사/마감', path: '/inventory/closing' },
      { label: '소켓/평철 재고 관리', path: '/inventory/socket-stock' },
      { label: '에프엔테크 재고현황', path: '/inventory/fn-tech-stock' },
      { label: '로케이션 관리', path: '/inventory/location' },
      { label: 'LOT 라벨 재출력', path: '/inventory/label-reprint' },
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
    label: '보고서',
    icon: FileText,
    children: [
      { label: '일일/주간/월간', path: '/reports' },
      { label: '로스 분석', path: '/reports/loss' },
    ],
  },
  {
    label: '기초등록',
    icon: Database,
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },
  {
    label: '설정',
    icon: Settings,
    children: [
      { label: '사용자 관리',       path: '/settings/users' },
      { label: '부서 관리',         path: '/settings/departments' },
      { label: '권한 관리',         path: '/settings/permissions' },
      { label: '이카운트 ERP 연동', path: '/settings/ecount' },
      { label: '백업 / 초기화',     path: '/settings/backup' },
    ],
  },

];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, _setMode] = useState<SidebarMode>(() => (localStorage.getItem('sidebar_mode') as SidebarMode) || 'shop');
  const setMode = (m: SidebarMode) => { _setMode(m); localStorage.setItem('sidebar_mode', m); };
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [approvalCount, setApprovalCount] = useState(0);
  const [socketWaitCount, setSocketWaitCount] = useState(0);
  const location = useLocation();
  const { user, permissions, isAdmin } = useAuth();
  // 관리모드 접근 가능: admin 또는 allowed_modes='both' 이면 모드 토글 표시
  const canSwitchMode = isAdmin || user?.allowed_modes === 'both';
  const currentMode = canSwitchMode ? mode : 'shop';

  // path → can_read 룩업 (admin은 항상 true, 권한 DB에 없는 경로는 기본 허용)
  const pathReadable = (path?: string) => {
    if (!path) return true;
    if (isAdmin) return true;
    // 권한 DB에 해당 path 레코드 자체가 없으면 → 기본 허용 (신규 메뉴 자동 노출)
    const found = permissions.find((p: { path: string | null; can_read: boolean }) => p.path === path);
    if (!found) return true;
    return found.can_read;
  };

  // 섹션/링크를 권한으로 필터링: 그룹 노드는 자식 1개 이상이 보일 때만 노출
  const filterNav = (items: NavSection[]): NavSection[] => {
    return items
      .map((s) => {
        if (s.path) return pathReadable(s.path) ? s : null;
        if (s.children) {
          const visible = s.children.filter((c) => pathReadable(c.path));
          return visible.length ? { ...s, children: visible } : null;
        }
        return s;
      })
      .filter((s): s is NavSection => s !== null);
  };

  // 결재 대기 건수 폴링
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get<{ data: { total: number } }>(`/approvals/counts?worker_id=${user.worker_id}`)
        .then((res) => setApprovalCount(res.data.total))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // 1분마다
    return () => clearInterval(interval);
  }, [user]);

  // 자재발주대기 건수 폴링 (APPROVED 상태)
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

  // 모드별 색상 테마
  const theme = currentMode === 'shop'
    ? {
        aside:       'bg-slate-800 border-slate-700',
        logo:        'border-slate-700',
        logoText:    'text-white',
        logoIcon:    'text-teal-400',
        collapseBtn: 'text-slate-400 hover:bg-slate-700 hover:text-white',
        modeBar:     'border-slate-700',
        modeActive:  'bg-teal-600 text-white',
        modeInactive:'text-slate-400 hover:bg-slate-700 hover:text-white',
        navDivider:  'border-slate-700',
        linkActive:  'bg-teal-600/30 text-teal-300 font-semibold',
        linkHover:   'text-slate-300 hover:bg-slate-700 hover:text-white',
        linkText:    'text-slate-300',
        childBorder: 'border-slate-600',
        childActive: 'bg-teal-600/25 text-teal-300 font-semibold',
        childHover:  'text-slate-400 hover:bg-slate-700 hover:text-white',
        sectionActive:'text-teal-300 font-semibold',
        sectionHover: 'text-slate-300 hover:bg-slate-700',
        stepColor:   'text-teal-400',
        label:       '🔧 실무',
      }
    : {
        aside:       'bg-violet-950 border-violet-800',
        logo:        'border-violet-800',
        logoText:    'text-white',
        logoIcon:    'text-violet-400',
        collapseBtn: 'text-violet-400 hover:bg-violet-800 hover:text-white',
        modeBar:     'border-violet-800',
        modeActive:  'bg-violet-600 text-white',
        modeInactive:'text-violet-400 hover:bg-violet-800 hover:text-white',
        navDivider:  'border-violet-800',
        linkActive:  'bg-violet-600/30 text-violet-300 font-semibold',
        linkHover:   'text-violet-300 hover:bg-violet-900 hover:text-white',
        linkText:    'text-violet-300',
        childBorder: 'border-violet-800',
        childActive: 'bg-violet-600/25 text-violet-300 font-semibold',
        childHover:  'text-violet-400 hover:bg-violet-900 hover:text-white',
        sectionActive:'text-violet-300 font-semibold',
        sectionHover: 'text-violet-300 hover:bg-violet-900',
        stepColor:   'text-violet-400',
        label:       '⚙️ 관리',
      };

  // Auto-open section containing active route
  const isSectionActive = (section: NavSection) => {
    if (section.path) return location.pathname === section.path;
    return section.children?.some((c) => location.pathname === c.path);
  };

  return (
    <aside className={cn(
      'flex flex-col border-r transition-all duration-200',
      theme.aside,
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn('flex h-16 items-center justify-between border-b px-4', theme.logo)}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Factory className={cn('h-6 w-6', theme.logoIcon)} />
            <span className={cn('font-bold text-shop-lg', theme.logoText)}>EZONE MES</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('rounded-md p-1.5 transition-colors', theme.collapseBtn)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Mode Toggle */}
      {!collapsed && canSwitchMode && (
        <div className={cn('flex border-b', theme.modeBar)}>
          <button
            onClick={() => { setMode('shop'); setOpenSections(new Set()); }}
            className={cn(
              'flex-1 py-2.5 text-xs font-bold transition-all',
              currentMode === 'shop' ? theme.modeActive : theme.modeInactive
            )}
          >
            <span className="flex items-center justify-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              실무
            </span>
          </button>
          <button
            onClick={() => { setMode('admin'); setOpenSections(new Set()); }}
            className={cn(
              'flex-1 py-2.5 text-xs font-bold transition-all',
              currentMode === 'admin' ? theme.modeActive : theme.modeInactive
            )}
          >
            <span className="flex items-center justify-center gap-1">
              <Settings className="h-3.5 w-3.5" />
              관리
            </span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((section) => (
          <div key={`${mode}-${section.label}`}>
            {section.path ? (
              /* 단일 링크 */
              <SidebarLink
                item={{ label: section.label, icon: section.icon, path: section.path }}
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
              /* 접이식 섹션 */
              <SidebarSection
                section={section}
                collapsed={collapsed}
                isOpen={openSections.has(section.label) || !!isSectionActive(section)}
                onToggle={() => toggleSection(section.label)}
                theme={theme}
                childBadges={{ '/orders/socket-order-wait': socketWaitCount }}
              />
            )}
            {section.dividerAfter && !collapsed && (
              <div className={cn('my-2 border-t', theme.navDivider)} />
            )}
            {section.dividerAfter && collapsed && (
              <div className={cn('my-1 border-t mx-2', theme.navDivider)} />
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SidebarSection({
  section,
  collapsed,
  isOpen,
  onToggle,
  theme,
  childBadges = {},
}: {
  section: NavSection;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  theme: Record<string, string>;
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
          'flex items-center justify-center rounded-button px-3 py-2 text-shop-sm transition-colors mb-0.5',
          hasActiveChild ? theme.linkActive : theme.linkHover
        )}
        title={section.label}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
      </NavLink>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-button px-3 py-2 text-shop-sm transition-colors',
          hasActiveChild ? theme.sectionActive : theme.sectionHover
        )}
      >
        {section.step && (
          <span className={cn('text-xs font-bold w-5 text-center flex-shrink-0', theme.stepColor)}>
            {section.step}
          </span>
        )}
        <Icon className="h-4.5 w-4.5 flex-shrink-0" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown className={cn(
          'h-3.5 w-3.5 transition-transform opacity-60',
          isOpen && 'rotate-180'
        )} />
      </button>
      {isOpen && section.children && (
        <div className={cn('ml-5 mt-0.5 space-y-0.5 border-l pl-3', theme.childBorder)}>
          {section.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) => cn(
                'flex items-center gap-2 rounded-button px-3 py-1.5 text-shop-sm transition-colors',
                isActive ? theme.childActive : theme.childHover,
                child.disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
              )}
            >
              <span className="flex-1">{child.label}</span>
              {childBadges[child.path] > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {childBadges[child.path]}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  step,
  badge,
  theme,
}: {
  item: { label: string; icon: React.ElementType; path?: string; disabled?: boolean };
  collapsed: boolean;
  step?: string;
  badge?: number;
  theme: Record<string, string>;
}) {
  const Icon = item.icon;

  if (item.disabled || !item.path) {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-button px-3 py-2 text-shop-sm opacity-30 cursor-not-allowed mb-0.5',
        theme.linkText,
        collapsed && 'justify-center'
      )}>
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => cn(
        'flex items-center gap-2 rounded-button px-3 py-2 text-shop-sm transition-colors mb-0.5 relative',
        isActive ? theme.linkActive : theme.linkHover,
        collapsed && 'justify-center'
      )}
      title={collapsed ? item.label : undefined}
    >
      {!collapsed && step && (
        <span className={cn('text-xs font-bold w-5 text-center flex-shrink-0', theme.stepColor)}>
          {step}
        </span>
      )}
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
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
