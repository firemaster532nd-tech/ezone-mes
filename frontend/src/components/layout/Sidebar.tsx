import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Package, ShieldCheck,
  Truck, Settings, ChevronLeft, ChevronRight, Factory, Database,
  Wrench, FlaskConical, Scissors, Box, Layers,
  ArrowRightLeft, Monitor, HardHat,
  ChevronDown, Hammer, Inbox, FileText, ShoppingCart, Megaphone, ShieldAlert,
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
  step?: string;          // ?ㅻТ紐⑤뱶 ?④퀎 踰덊샇 (e.g. "??)
  path?: string;          // ?⑥씪 留곹겕
  children?: NavChild[];
  dividerAfter?: boolean; // 援щ텇??}

// ??? ?ㅻТ 紐⑤뱶: ?낅Т ?먮쫫 ?쒖꽌 (?섏＜?믩컻二쇄넂?앹궛?믪텧?? ???
const shopNavItems: NavSection[] = [
  {
    label: '?ㅻ뒛???묒뾽',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  // ?? ?섏＜/諛쒖＜ (?낅Т???쒖옉?? ??
  {
    label: '?섏＜/諛쒖＜',
    icon: ShoppingCart,
    children: [
      { label: '?꾩옣蹂??꾨줈?앺듃', path: '/orders/projects' },
      { label: '諛쒖＜??愿由?, path: '/orders/purchase-orders' },
      { label: '寃ъ쟻???깅줉/愿由?, path: '/orders/quotations' },
      { label: '誘몄＜臾명쁽??議고쉶', path: '/orders/unordered' },
      { label: '?섏＜ 愿由?/ BOM', path: '/orders' },
      { label: '?먯옱 諛쒖＜??, path: '/orders/purchase-requests' },
      { label: '二쇰Ц?댁뿭 ???낃퀬?좎껌', path: '/orders/material-orders' },
    ],
  },
  {
    label: '寃곗옱??,
    icon: Inbox,
    path: '/approval/inbox',
  },
  {
    label: '怨듭? / 履쎌???,
    icon: Megaphone,
    path: '/announcements',
  },
  {
    label: '?먯옱諛쒖＜?湲?,
    icon: Package,
    path: '/orders/socket-order-wait',
    dividerAfter: true,
  },
  {
    label: 'TBM ?덉쟾?뚯쓽',
    icon: HardHat,
    path: '/production/tbm',
  },
  {
    label: '?묒뾽吏??,
    icon: ClipboardList,
    children: [
      { label: '?쇰컲 ?묒뾽吏??,      path: '/production/work-orders' },
      { label: '?꾩옣蹂??묒뾽吏??,     path: '/production/project-work-orders' },
      { label: '鍮꾩씤?뺤젣???묒뾽吏??,   path: '/production/socket-work-orders' },
      { label: '援ъ“泥??묒뾽吏??,     path: '/production/struct-work-orders' },
      { label: '遺?먯옱蹂??묒뾽吏??, path: '/production/sub-work-orders' },
      { label: '?먰봽?뷀뀒???묒뾽吏??, path: '/production/fn-work-orders' },
    ],
    dividerAfter: true,
  },
  // ?? ?앹궛 ?먮쫫 ??
  {
    label: '?먯옱猷??낃퀬/寃??,
    icon: Package,
    step: '??,
    children: [
      { label: '?몄닔寃??, path: '/quality/incoming' },
      { label: '?ш퀬 ?꾪솴', path: '/inventory/dashboard' },
      { label: '?ш퀬 ?섎텋???, path: '/inventory/ledger' },
      { label: '珥덇린 ?ш퀬 ?ㅼ젙', path: '/inventory/initialize' },
      { label: '?섎텋????묒? ?곕룞', path: '/inventory/import' },
      { label: '?뚯폆/?됱쿋 ?ш퀬 愿由?, path: '/inventory/socket-stock' },
      { label: '?먰봽?뷀뀒???ш퀬?꾪솴', path: '/inventory/fn-tech-stock' },

    ],
  },
  {
    label: '諛고빀',
    icon: FlaskConical,
    step: '??,
    children: [
      { label: '怨듭젙 ?ㅽ뻾', path: '/production/process-execution' },
      { label: '?먯＜寃??, path: '/quality/self-inspection' },
    ],
  },
  {
    label: '?뺤텧',
    icon: Layers,
    step: '??,
    children: [
      { label: '怨듭젙 ?ㅽ뻾', path: '/production/process-execution' },
      { label: '?먯＜寃??, path: '/quality/self-inspection' },
    ],
  },
  {
    label: '?щ떒',
    icon: Scissors,
    step: '??,
    children: [
      { label: '怨듭젙 ?ㅽ뻾', path: '/production/process-execution' },
      { label: '?먯＜寃??, path: '/quality/self-inspection' },
    ],
  },
  {
    label: '遺?먯옱 ?낃퀬/寃??,
    icon: Box,
    step: '??,
    children: [
      { label: '?몄닔寃??, path: '/quality/incoming' },
      { label: '?ш퀬 ?꾪솴', path: '/inventory/dashboard' },
      { label: '濡쒖??댁뀡 愿由?, path: '/inventory/location' },
      { label: 'LOT ?쇰꺼 ?ъ텧??, path: '/inventory/label-reprint' },
    ],
  },
  {
    label: '議곕┰',
    icon: Hammer,
    step: '??,
    children: [
      { label: '怨듭젙 ?ㅽ뻾', path: '/production/process-execution' },
      { label: '以묎컙寃??(C-701)', path: '/quality/process-inspection' },
      { label: '?먯＜寃??, path: '/quality/self-inspection' },
    ],
    dividerAfter: true,
  },
  // ?? 異쒗븯 ??
  {
    label: '異쒗븯',
    icon: Truck,
    step: '??,
    children: [
      { label: '異쒗븯?湲고쁽??,       path: '/shipment/ready' },
      { label: '異쒗븯議고쉶',           path: '/shipment/orders' },
      { label: '異쒗븯?낅젰',           path: '/shipment/input' },
      { label: '異쒗븯?꾪솴',           path: '/shipment/pending' },
      { label: '?ъ옣쨌異쒗븯 ?ㅼ틪',    path: '/shipment/staging' },
      { label: '嫄곕옒紐낆꽭??愿由?,   path: '/shipment/statements' },
      { label: '諛섑뭹?낃퀬',          path: '/shipment/returns' },
    ],
    dividerAfter: true,
  },
  // ?? ?꾪솴/異붿쟻 ??
  {
    label: '?꾪솴??,
    icon: Monitor,
    children: [
      { label: '?앹궛 ?꾪솴', path: '/production/production-dashboard' },
      { label: 'LOT 異붿쟻', path: '/quality/lot-trace' },
      { label: '?듯빀 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '?몄젙湲곗? 寃利?, path: '/quality/cert-check' },
      { label: '遺덈웾/?먭린', path: '/quality/defects' },
      { label: '濡쒖뒪 遺꾩꽍', path: '/reports/loss' },
      { label: '?붾쭚 ?ㅼ궗/留덇컧', path: '/inventory/closing' },
      { label: '誘몃퉬?ы빆 ?먭?', path: '/quality/compliance' },
    ],
    dividerAfter: true,
  },
  // ?? 湲곗큹?깅줉 ??
  {
    label: '湲곗큹?깅줉',
    icon: Database,
    children: [
      { label: '?덈ぉ ?깅줉/愿由?, path: '/master/items' },
      { label: '嫄곕옒泥?愿由?, path: '/master/companies' },
      { label: '?몄젙援ъ“ 愿由?, path: '/master/certifications' },
      { label: 'BOM 愿由?, path: '/master/bom' },
    ],
  },

];

// ??? 愿由?紐⑤뱶: ?낅Т ?먮쫫 ?쒖꽌 (?섏＜?믩컻二쇄넂?앹궛?믫뭹吏댿넂異쒗븯) ???
const adminNavItems: NavSection[] = [
  { label: '??쒕낫??, icon: LayoutDashboard, path: '/dashboard' },
  {
    label: '?섏＜/援щℓ',
    icon: ShoppingCart,
    children: [
      { label: '?꾩옣蹂??꾨줈?앺듃', path: '/orders/projects' },
      { label: '諛쒖＜??愿由?, path: '/orders/purchase-orders' },
      { label: '寃ъ쟻???깅줉/愿由?, path: '/orders/quotations' },
      { label: '誘몄＜臾명쁽??議고쉶', path: '/orders/unordered' },
      { label: '?섏＜ 愿由?/ BOM', path: '/orders' },
      { label: '?먯옱 諛쒖＜??, path: '/orders/purchase-requests' },
      { label: '二쇰Ц?댁뿭 ???낃퀬?좎껌', path: '/orders/material-orders' },
    ],
  },
  {
    label: '寃곗옱 愿由?,
    icon: Inbox,
    children: [
      { label: '寃곗옱??, path: '/approval/inbox' },
      { label: '寃곗옱 ?쇱씤 ?ㅼ젙', path: '/approval/lines' },
    ],
  },
  {
    label: '?먯옱諛쒖＜?湲?,
    icon: Package,
    path: '/orders/socket-order-wait',
    dividerAfter: true,
  },
  {
    label: '?앹궛愿由?,
    icon: ClipboardList,
    children: [
      { label: '?묒뾽吏??紐⑸줉',       path: '/production/work-orders' },
      { label: '?꾩옣蹂??묒뾽吏??,      path: '/production/project-work-orders' },
      { label: '鍮꾩씤?뺤젣???묒뾽吏??,   path: '/production/socket-work-orders' },
      { label: '援ъ“泥??묒뾽吏??,      path: '/production/struct-work-orders' },
      { label: '遺?먯옱蹂??묒뾽吏??,  path: '/production/sub-work-orders' },
      { label: '?먰봽?뷀뀒???묒뾽吏??, path: '/production/fn-work-orders' },
      { label: '怨듭젙 ?ㅽ뻾',           path: '/production/process-execution' },
      { label: '?앹궛 ?꾪솴',           path: '/production/production-dashboard' },
      { label: '怨듭젙?쇱?',            path: '/production/daily-log' },
      { label: 'TBM ?덉쟾?뚯쓽',        path: '/production/tbm' },
    ],
  },
  {
    label: '?덉쭏愿由?,
    icon: ShieldCheck,
    children: [
      { label: '?몄닔寃??, path: '/quality/incoming' },
      { label: '以묎컙寃??(C-701)', path: '/quality/process-inspection' },
      { label: '?먯＜寃??, path: '/quality/self-inspection' },
      { label: '?꾩젣?덇???(C-901)', path: '/quality/fqc-inspection' },
      { label: 'LOT 異붿쟻', path: '/quality/lot-trace' },
      { label: '?듯빀 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '?몄젙湲곗? 寃利?, path: '/quality/cert-check' },
      { label: '遺덈웾/?먭린', path: '/quality/defects' },
      { label: '誘몃퉬?ы빆 ?먭?', path: '/quality/compliance' },
    ],
  },
  {
    label: '?ш퀬/異쒗븯',
    icon: ArrowRightLeft,
    children: [
      { label: '?ш퀬 ?꾪솴', path: '/inventory/dashboard' },
      { label: '?ш퀬 ?섎텋???, path: '/inventory/ledger' },
      { label: '?섎텋????묒? ?곕룞', path: '/inventory/import' },
      { label: '?붾쭚 ?ㅼ궗/留덇컧', path: '/inventory/closing' },
      { label: '?뚯폆/?됱쿋 ?ш퀬 愿由?, path: '/inventory/socket-stock' },
      { label: '?먰봽?뷀뀒???ш퀬?꾪솴', path: '/inventory/fn-tech-stock' },

      { label: '濡쒖??댁뀡 愿由?, path: '/inventory/location' },
      { label: 'LOT ?쇰꺼 ?ъ텧??, path: '/inventory/label-reprint' },
      { label: '異쒗븯?湲고쁽??, path: '/shipment/ready' },
      { label: '異쒗븯議고쉶', path: '/shipment/orders' },
      { label: '異쒗븯?낅젰', path: '/shipment/input' },
      { label: '異쒗븯?꾪솴', path: '/shipment/pending' },
      { label: '?ъ옣쨌異쒗븯 ?ㅼ틪', path: '/shipment/staging' },
      { label: '嫄곕옒紐낆꽭??愿由?, path: '/shipment/statements' },
      { label: '諛섑뭹?낃퀬', path: '/shipment/returns' },
    ],
  },
  {
    label: '蹂닿퀬??,
    icon: FileText,
    children: [
      { label: '?쇱씪/二쇨컙/?붽컙', path: '/reports' },
      { label: '濡쒖뒪 遺꾩꽍', path: '/reports/loss' },
    ],
  },
  {
    label: '湲곗큹?깅줉',
    icon: Database,
    children: [
      { label: '?덈ぉ ?깅줉/愿由?, path: '/master/items' },
      { label: '嫄곕옒泥?愿由?, path: '/master/companies' },
      { label: '?몄젙援ъ“ 愿由?, path: '/master/certifications' },
      { label: 'BOM 愿由?, path: '/master/bom' },
    ],
  },
  {
    label: '?ㅼ젙',
    icon: Settings,
    children: [
      { label: '?ъ슜??愿由?,       path: '/settings/users' },
      { label: '遺??愿由?,         path: '/settings/departments' },
      { label: '沅뚰븳 愿由?,         path: '/settings/permissions' },
      { label: '濡쒓렇??湲곕줉',        path: '/settings/login-logs' },
      { label: '?댁뭅?댄듃 ERP ?곕룞', path: '/settings/ecount' },
      { label: '諛깆뾽 / 珥덇린??,     path: '/settings/backup' },
    ],
  },

];

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, _setMode] = useState<SidebarMode>(() => (localStorage.getItem('sidebar_mode') as SidebarMode) || 'shop');
  const setMode = (m: SidebarMode) => { _setMode(m); localStorage.setItem('sidebar_mode', m); };
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [approvalCount, setApprovalCount] = useState(0);
  const [socketWaitCount, setSocketWaitCount] = useState(0);
  const location = useLocation();
  const { user, permissions, isAdmin, isSuperAdmin } = useAuth();
  // 愿由щえ???묎렐 媛?? admin ?먮뒗 allowed_modes='both' ?대㈃ 紐⑤뱶 ?좉? ?쒖떆
  const canSwitchMode = isAdmin || user?.allowed_modes === 'both';
  const currentMode = canSwitchMode ? mode : 'shop';

  // path ??can_read 猷⑹뾽 (admin? ??긽 true, 沅뚰븳 DB???녿뒗 寃쎈줈??湲곕낯 ?덉슜)
  const pathReadable = (path?: string) => {
    if (!path) return true;
    if (isAdmin) return true;
    // 沅뚰븳 DB???대떦 path ?덉퐫???먯껜媛 ?놁쑝硫???湲곕낯 ?덉슜 (?좉퇋 硫붾돱 ?먮룞 ?몄텧)
    const found = permissions.find((p: { path: string | null; can_read: boolean }) => p.path === path);
    if (!found) return true;
    return found.can_read;
  };

  // ?뱀뀡/留곹겕瑜?沅뚰븳?쇰줈 ?꾪꽣留? 洹몃９ ?몃뱶???먯떇 1媛??댁긽??蹂댁씪 ?뚮쭔 ?몄텧
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

  // 寃곗옱 ?湲?嫄댁닔 ?대쭅
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get<{ data: { total: number } }>(`/approvals/counts?worker_id=${user.worker_id}`)
        .then((res) => setApprovalCount(res.data.total))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // 1遺꾨쭏??    return () => clearInterval(interval);
  }, [user]);

  // ?먯옱諛쒖＜?湲?嫄댁닔 ?대쭅 (APPROVED ?곹깭)
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

  // ?덊띁愿由ъ옄 ?꾩슜 硫붾돱
  const superAdminNav = isSuperAdmin ? [
    { label: '?쒖뒪??珥덇린??, path: '/superadmin/reset' },
  ] : [];

  const toggleSection = (label: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // 紐⑤뱶蹂??됱긽 ?뚮쭏
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
        label:       '?뵩 ?ㅻТ',
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
        label:       '?숋툘 愿由?,
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
            <img src="/ezone-logo-v3.png" alt="EZONE" className="h-7 w-auto object-contain" />
            <span className={cn('font-bold text-sm tracking-wide', theme.logoText)}>EZONE MES</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('rounded-md p-1.5 transition-colors', theme.collapseBtn)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {/* 紐⑤컮???リ린 踰꾪듉 */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className={cn('lg:hidden rounded-md p-1.5 transition-colors', theme.collapseBtn)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
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
              ?ㅻТ
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
              愿由?            </span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((section) => (
          <div key={`${mode}-${section.label}`}>
            {section.path ? (
              /* ?⑥씪 留곹겕 */
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
              /* ?묒씠???뱀뀡 */
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

        {/* ?덊띁愿由ъ옄 ?꾩슜 硫붾돱 */}
        {isSuperAdmin && (
          <>
            <div className="my-2 border-t border-red-700" />
            {!collapsed && (
              <div className="px-3 py-1 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-bold text-red-400 tracking-widest uppercase">Super Admin</span>
              </div>
            )}
            <NavLink
              to="/superadmin/reset"
              className={({ isActive }) => cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                isActive ? 'bg-red-600 text-white' : 'text-red-400 hover:bg-red-900/50 hover:text-red-300',
                collapsed && 'justify-center'
              )}
              title={collapsed ? '?쒖뒪??珥덇린?? : undefined}
            >
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>?쒖뒪??珥덇린??/span>}
            </NavLink>
          </>
        )}
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
