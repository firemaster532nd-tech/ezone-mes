import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Package, ShieldCheck,
  Truck, Settings, Factory, Database,
  Wrench, FlaskConical, Scissors, Box, Layers,
  Hammer, Inbox, FileText, ShoppingCart, Megaphone, ShieldAlert,
  CheckCircle, TrendingUp, HardHat, Boxes, Monitor,
  HeadphonesIcon, Search, X, ChevronDown, LineChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export type SidebarMode = 'shop' | 'admin';

// ── 네비게이션 데이터 타입 ────────────────────────────────────────────────
export interface SubNavItem {
  label: string;
  path: string;
  step?: string;
  disabled?: boolean;
  children?: { label: string; path: string }[];
}

export interface TopNavGroup {
  key: string;
  label: string;
  Icon: React.ElementType;
  path?: string;       // 직접 링크 (하위 없음)
  children?: SubNavItem[];
  dividerBefore?: boolean;
}

// ── 이모티콘 제거 ──────────────────────────────────────────────────────────
const strip = (s: string) =>
  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// 실무 모드 상단 탭 그룹
// ─────────────────────────────────────────────────────────────────────────────
export const shopTopGroups: TopNavGroup[] = [
  {
    key: 'home', label: '홈', Icon: LayoutDashboard, path: '/dashboard',
  },
  {
    key: 'order', label: '수주/발주', Icon: ShoppingCart,
    children: [
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '주문내역 → 입고신청', path: '/orders/material-orders' },
      { label: '자재발주대기', path: '/orders/socket-order-wait' },
    ],
  },
  {
    key: 'sales', label: '영업', Icon: LineChart,
    children: [
      {
        label: '견적서', path: '/sales/quotations',
        children: [
          { label: '견적서 조회', path: '/sales/quotations' },
          { label: '견적서 입력', path: '/sales/quotations/entry' },
          { label: '견적서 현황', path: '/sales/quotations/status' },
          { label: '미주문현황', path: '/sales/quotations/unordered' },
        ],
      },
      {
        label: '판매', path: '/sales/delivery',
        children: [
          { label: '판매 조회', path: '/sales/delivery' },
          { label: '판매 입력', path: '/sales/delivery/entry' },
          { label: '단가일괄변경', path: '/sales/delivery/price-change' },
          { label: '판매현황', path: '/sales/delivery/status' },
          { label: '수금현황', path: '/sales/payment/status' },
          { label: '할인현황', path: '/sales/delivery/discount' },
          { label: '회계미반영현황', path: '/sales/delivery/accounting' },
          { label: '거래처별채권', path: '/sales/receivables' },
        ],
      },
    ],
  },
  {
    key: 'comm', label: '소통', Icon: Inbox,
    children: [
      { label: '결재함', path: '/approval/inbox' },
      { label: '공지 / 쪽지함', path: '/announcements' },
    ],
  },
  {
    key: 'production', label: '생산관리', Icon: ClipboardList,
    children: [
      { label: 'TBM 안전회의', path: '/production/tbm' },
      { label: '일반 작업지시', path: '/production/work-orders' },
      { label: '비인정제품 작업지시', path: '/production/socket-work-orders' },

      { label: '구조체 작업지시', path: '/production/struct-work-orders' },
      { label: '조립생산일지 (J-LOT)', path: '/production/assembly-log' },
      { label: '부자재별 작업지시', path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
    ],
  },
  {
    key: 'process', label: '공정 단계', Icon: Factory,
    children: [
      { label: '②~⑤ 통합 4공정 (배합·압출·재단·조립)', path: '/production/process-stages' },
      { label: '기존 공정 실행 (배합·압출·재단)', path: '/production/process-execution' },
      { label: '배합생산일지 (EZC B-201-1)', path: '/production/mix-log' },
      { label: '압출생산일지 (EZC B-201-2)', path: '/production/extrusion-log' },
      { label: '재단생산일지 (EZC B-201-12/13)', path: '/production/cutting-log' },
      { label: '조립생산일지 (EZC B-201-3/8/9/10/11)', path: '/production/assembly-log' },
    ],
  },



  {
    key: 'inventory', label: '재고관리', Icon: Boxes,
    children: [
      { label: '원부자재 통합 재고관리', path: '/inventory/material-stock' },
      { label: '바코드 스캔 WMS', path: '/inventory/barcode-wms' },
      { label: '랙 로케이션 관리', path: '/inventory/location' },
      { label: '비인정 재고 관리', path: '/inventory/non-certified-stock' },
      { label: '소켓 / 평철 재고', path: '/inventory/socket-stock' },
      { label: '에프엔테크 재고현황', path: '/inventory/fn-tech-stock' },
      { label: 'LOT 라벨 재출력', path: '/inventory/label-reprint' },
      { label: '기초/초기 재고 설정', path: '/inventory/material-init' },
      { label: '수불대장 엑셀 연동', path: '/inventory/import' },
      { label: '월말 실사/마감', path: '/inventory/closing' },
    ],
  },
  {
    key: 'quality', label: '품질관리', Icon: ShieldCheck,
    children: [
      {
        label: '인수검사', path: '/quality/incoming/raw',
        children: [
          { label: '원재료 인수검사', path: '/quality/incoming/raw' },
          { label: '부자재 인수검사', path: '/quality/incoming/sub' },
          { label: '소켓/브라켓 인수검사', path: '/quality/incoming/socket' },
          { label: '⚡ 에프엔테크 인수검사', path: '/quality/incoming/fn-tech' },
          { label: '비인정제품 인수검사', path: '/quality/incoming/non-certified' },
        ],
      },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
      { label: '완제품검사 (C-901)', path: '/quality/fqc-inspection' },
      { label: '검사설비 관리', path: '/quality/equipment/inspection' },
      { label: '제조설비 관리', path: '/quality/equipment/manufacturing' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
  },
  {
    key: 'shipment', label: '출하', Icon: Truck,
    children: [
      { label: '출하대기현황', path: '/shipment/ready' },
      { label: '출하조회', path: '/shipment/orders' },
      { label: '출하현황', path: '/shipment/pending' },
      { label: '포장·출하 스캔', path: '/shipment/staging' },
      { label: '거래명세서 관리', path: '/shipment/statements' },
      { label: '반품입고', path: '/shipment/returns' },
      { label: '출하지시서', path: '/shipment/dispatch' },
    ],
  },
  {
    key: 'monitor', label: '현황판', Icon: Monitor,
    children: [
      { label: '생산 현황', path: '/production/production-dashboard' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '로스 분석', path: '/reports/loss' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
  },
  {
    key: 'master', label: '기초등록', Icon: Database, path: '/master/items',
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },
  {
    key: 'accounting', label: '회계', Icon: TrendingUp, path: '/accounting/setup',
    children: [
      { label: '기초데이터 설정', path: '/accounting/setup' },
      { label: '매출 현황', path: '/accounting/revenue' },
      { label: '원가 현황', path: '/accounting/cost' },
      { label: '손익 분석', path: '/accounting/profit-loss' },
    ],
  },
  {
    key: 'support', label: '고객센터', Icon: HeadphonesIcon, path: '/support',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 관리 모드 상단 탭 그룹
// ─────────────────────────────────────────────────────────────────────────────
export const adminTopGroups: TopNavGroup[] = [
  {
    key: 'home', label: '홈', Icon: LayoutDashboard, path: '/dashboard',
  },
  {
    key: 'order', label: '수주/구매', Icon: ShoppingCart,
    children: [
      { label: '현장별 프로젝트', path: '/orders/projects' },
      { label: '수주 관리 / BOM', path: '/orders' },
      { label: '발주서 관리', path: '/orders/purchase-orders' },
      { label: '자재 발주서', path: '/orders/purchase-requests' },
      { label: '주문내역 → 입고신청', path: '/orders/material-orders' },
      { label: '자재발주대기', path: '/orders/socket-order-wait' },
    ],
  },
  {
    key: 'sales', label: '영업', Icon: LineChart,
    children: [
      {
        label: '견적서', path: '/sales/quotations',
        children: [
          { label: '견적서 조회', path: '/sales/quotations' },
          { label: '견적서 입력', path: '/sales/quotations/entry' },
          { label: '견적서 현황', path: '/sales/quotations/status' },
          { label: '미주문현황', path: '/sales/quotations/unordered' },
        ],
      },
      {
        label: '판매', path: '/sales/delivery',
        children: [
          { label: '판매 조회', path: '/sales/delivery' },
          { label: '판매 입력', path: '/sales/delivery/entry' },
          { label: '단가일괄변경', path: '/sales/delivery/price-change' },
          { label: '판매현황', path: '/sales/delivery/status' },
          { label: '수금현황', path: '/sales/payment/status' },
          { label: '할인현황', path: '/sales/delivery/discount' },
          { label: '회계미반영현황', path: '/sales/delivery/accounting' },
          { label: '거래처별채권', path: '/sales/receivables' },
        ],
      },
    ],
  },
  {
    key: 'approval', label: '결재관리', Icon: Inbox,
    children: [
      { label: '결재함', path: '/approval/inbox' },
      { label: '결재 라인 설정', path: '/approval/lines' },
      { label: '공지 / 쪽지함', path: '/announcements' },
    ],
  },
  {
    key: 'production', label: '생산관리', Icon: ClipboardList,
    children: [
      { label: 'TBM 안전회의', path: '/production/tbm' },
      { label: '작업지시 목록', path: '/production/work-orders' },
      { label: '비인정제품 작업지시', path: '/production/socket-work-orders' },
      { label: '구조체 작업지시', path: '/production/struct-work-orders' },
      { label: '부자재별 작업지시', path: '/production/sub-work-orders' },
      { label: '에프엔테크 작업지시', path: '/production/fn-work-orders' },
      { label: '생산 현황', path: '/production/production-dashboard' },
      { label: '공정일지', path: '/production/daily-log' },
    ],
  },
  {
    key: 'process', label: '공정 단계', Icon: Factory,
    children: [
      { label: '②~⑤ 통합 4공정 (배합·압출·재단·조립)', path: '/production/process-stages' },
      { label: '기존 공정 실행 (배합·압출·재단)', path: '/production/process-execution' },
      { label: '배합생산일지 (EZC B-201-1)', path: '/production/mix-log' },
      { label: '압출생산일지 (EZC B-201-2)', path: '/production/extrusion-log' },
      { label: '재단생산일지 (EZC B-201-12/13)', path: '/production/cutting-log' },
      { label: '조립생산일지 (EZC B-201-3/8/9/10/11)', path: '/production/assembly-log' },
    ],
  },
  {
    key: 'quality', label: '품질관리', Icon: ShieldCheck,
    children: [
      {
        label: '인수검사', path: '/quality/incoming/raw',
        children: [
          { label: '원재료 인수검사', path: '/quality/incoming/raw' },
          { label: '부자재 인수검사', path: '/quality/incoming/sub' },
          { label: '소켓/브라켓 인수검사', path: '/quality/incoming/socket' },
          { label: '⚡ 에프엔테크 인수검사', path: '/quality/incoming/fn-tech' },
          { label: '비인정제품 인수검사', path: '/quality/incoming/non-certified' },
        ],
      },
      { label: '중간검사 (C-701)', path: '/quality/process-inspection' },
      { label: '자주검사', path: '/quality/self-inspection' },
      { label: '완제품검사 (C-901)', path: '/quality/fqc-inspection' },
      { label: '검사설비 관리', path: '/quality/equipment/inspection' },
      { label: '제조설비 관리', path: '/quality/equipment/manufacturing' },
      { label: 'LOT 추적', path: '/quality/lot-trace' },
      { label: '통합 LOT Matrix', path: '/quality/project-lot-matrix' },
      { label: '인정기준 검증', path: '/quality/cert-check' },
      { label: '불량/폐기', path: '/quality/defects' },
      { label: '미비사항 점검', path: '/quality/compliance' },
    ],
  },
  {
    key: 'inventory', label: '재고관리', Icon: Boxes,
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
    key: 'shipment', label: '출하관리', Icon: Truck,
    children: [
      { label: '출하대기현황', path: '/shipment/ready' },
      { label: '출하조회', path: '/shipment/orders' },
      { label: '출하현황', path: '/shipment/pending' },
      { label: '포장·출하 스캔', path: '/shipment/staging' },
      { label: '거래명세서 관리', path: '/shipment/statements' },
      { label: '반품입고', path: '/shipment/returns' },
      { label: '출하지시서', path: '/shipment/dispatch' },
    ],
  },
  {
    key: 'report', label: '보고서', Icon: FileText,
    children: [
      { label: '일일/주간/월간', path: '/reports' },
      { label: '로스 분석', path: '/reports/loss' },
    ],
  },
  {
    key: 'master', label: '기초등록', Icon: Database, path: '/master/items',
    children: [
      { label: '품목 등록/관리', path: '/master/items' },
      { label: '거래처 관리', path: '/master/companies' },
      { label: '인정구조 관리', path: '/master/certifications' },
      { label: 'BOM 관리', path: '/master/bom' },
    ],
  },
  {
    key: 'settings', label: '설정', Icon: Settings, path: '/settings/users',
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
    key: 'accounting', label: '회계', Icon: TrendingUp, path: '/accounting/setup',
    children: [
      { label: '기초데이터 설정', path: '/accounting/setup' },
      { label: '매출 현황', path: '/accounting/revenue' },
      { label: '원가 현황', path: '/accounting/cost' },
      { label: '손익 분석', path: '/accounting/profit-loss' },
    ],
  },
  {
    key: 'support', label: '고객센터', Icon: HeadphonesIcon, path: '/support',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 검색용 플랫 리스트
// ─────────────────────────────────────────────────────────────────────────────
function buildFlat(groups: TopNavGroup[]) {
  const result: { label: string; path: string; group: string }[] = [];
  for (const g of groups) {
    if (g.path) result.push({ label: strip(g.label), path: g.path, group: strip(g.label) });
    if (g.children) {
      for (const c of g.children) {
        result.push({ label: strip(c.label), path: c.path, group: strip(g.label) });
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SubSidebar — 선택된 그룹의 하위 메뉴 표시
// ─────────────────────────────────────────────────────────────────────────────
export function SubSidebar({
  group,
  mode,
  approvalCount,
  socketWaitCount,
}: {
  group: TopNavGroup | null;
  mode: SidebarMode;
  approvalCount: number;
  socketWaitCount: number;
}) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  if (!group || !group.children || group.children.length === 0) return null;

  const accentColor = mode === 'shop' ? '#14b8a6' : '#818cf8';
  const accentBg = mode === 'shop' ? 'rgba(20,184,166,0.12)' : 'rgba(129,140,248,0.12)';

  const toggle = (label: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  return (
    <aside
      className="flex flex-col border-r flex-shrink-0 overflow-y-auto"
      style={{ width: 172, background: '#f8fafc', borderColor: '#e2e8f0' }}
    >
      {/* 그룹 헤더 */}
      <div
        className="flex items-center gap-1.5 px-3 py-2.5 border-b"
        style={{ borderColor: '#e2e8f0', background: '#f1f5f9' }}
      >
        <group.Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span className="text-xs font-bold text-slate-700 truncate">{strip(group.label)}</span>
      </div>

      {/* 메뉴 리스트 */}
      <nav className="flex-1 py-1.5 px-1.5 space-y-0.5">
        {group.children.map((item) => {
          const isActive = location.pathname === item.path;
          const badge =
            item.path === '/approval/inbox' ? approvalCount :
            item.path === '/orders/socket-order-wait' ? socketWaitCount : 0;

          if (item.children && item.children.length > 0) {
            const isOpen = openSections.has(item.label) || item.children.some(c => location.pathname === c.path);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                >
                  {item.step && <span className="text-[10px] font-bold w-4 text-center flex-shrink-0" style={{ color: accentColor }}>{item.step}</span>}
                  <span className="flex-1 truncate">{strip(item.label)}</span>
                  <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l pl-2" style={{ borderColor: accentColor + '40' }}>
                    {item.children.map((child, ci) => {
                      // 섹션 헤더 (isSection: true)
                      if ((child as any).isSection) {
                        return (
                          <div key={`section-${ci}`}
                            className="px-2 pt-3 pb-0.5 text-[10px] font-bold tracking-wide text-slate-400 uppercase select-none border-t border-slate-100 first:border-0 first:pt-1">
                            {child.label.replace('▸ ', '')}
                          </div>
                        );
                      }
                      const childActive = location.pathname === child.path;
                      return (
                        <NavLink key={child.path} to={child.path}
                          className={cn('block rounded px-2 py-1 text-xs transition-colors truncate',
                            childActive ? 'font-semibold text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                          )}
                          style={childActive ? { background: accentColor } : undefined}
                        >
                          {strip(child.label)}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive ? 'text-white font-semibold' : 'text-slate-600 hover:bg-white hover:text-slate-900'
              )}
              style={isActive ? { background: accentColor } : undefined}
            >
              {item.step && (
                <span className="text-[10px] font-bold w-4 text-center flex-shrink-0"
                  style={{ color: isActive ? 'rgba(255,255,255,0.8)' : accentColor }}>
                  {item.step}
                </span>
              )}
              <span className="flex-1 truncate">{strip(item.label)}</span>
              {badge > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white flex-shrink-0">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopNav — 상단 가로 메뉴 바 (AppLayout에서 사용)
// ─────────────────────────────────────────────────────────────────────────────
export function TopNav({
  mode,
  canSwitchMode,
  onModeChange,
  activeGroupKey,
  onGroupChange,
  approvalCount,
  socketWaitCount,
}: {
  mode: SidebarMode;
  canSwitchMode: boolean;
  onModeChange: (m: SidebarMode) => void;
  activeGroupKey: string;
  onGroupChange: (key: string) => void;
  approvalCount: number;
  socketWaitCount: number;
}) {
  const navigate = useNavigate();
  const groups = mode === 'shop' ? shopTopGroups : adminTopGroups;
  const isAdmin = mode === 'admin';

  // 메뉴 검색
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const allItems = useMemo(() => buildFlat(groups), [mode]);
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return allItems.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQ, allItems]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const accentColor = isAdmin ? '#6366f1' : '#0d9488';
  const topBg = isAdmin ? '#1a2035' : '#1e2535';

  return (
    <div
      className="flex-shrink-0 flex items-center border-b"
      style={{ background: topBg, borderColor: 'rgba(255,255,255,0.08)', height: 44 }}
    >
      {/* 로고 */}
      <div className="flex items-center gap-2 px-4 border-r flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)', height: '100%' }}>
        <img src="/ezone-logo-v4.png" alt="EZONE" className="h-6 w-auto object-contain" />
        <span className="text-white font-bold text-sm tracking-wide hidden sm:block">EZONE</span>
      </div>

      {/* 상단 탭 (가로 스크롤) */}
      <nav className="flex items-center flex-1 overflow-x-auto scrollbar-hide" style={{ height: '100%' }}>
        {groups.map((g) => {
          const isActive = activeGroupKey === g.key;
          const badge = g.key === 'comm' || g.key === 'approval'
            ? approvalCount : g.key === 'order' ? socketWaitCount : 0;
          const Icon = g.Icon;
          return (
            <button
              key={g.key}
              onClick={() => {
                onGroupChange(g.key);
                const targetPath = g.path || (g.children && g.children.length > 0 ? g.children[0].path : null);
                if (targetPath) navigate(targetPath);
              }}
              className={cn(
                'relative flex items-center gap-1.5 px-3 h-full flex-shrink-0 text-xs font-medium transition-all border-b-2',
                isActive
                  ? 'text-white border-current'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
              )}
              style={isActive ? { borderColor: accentColor, color: 'white' } : undefined}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">{strip(g.label)}</span>
              {badge > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 우측: 📱 바코드 스캔 바로가기 + 검색 + 모드 전환 */}
      <div className="flex items-center gap-1.5 px-2 flex-shrink-0" style={{ height: '100%' }}>
        {/* 📱 바코드 스캔 WMS 상단 헤더 바로가기 퀵 버튼 */}
        <Link
          to="/inventory/barcode-wms"
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap"
          title="LOT 바코드 스캔 WMS (입고·출고·위치이동) 바로가기"
        >
          <span>📱</span>
          <span>바코드 스캔</span>
        </Link>

        {/* 검색 */}
        <div className="relative">
          {searchOpen ? (
            <div className="flex items-center gap-1 rounded-lg bg-white/10 border border-white/20 px-2">
              <Search className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQ(''); }, 150)}
                placeholder="메뉴 검색..."
                className="bg-transparent text-xs text-white placeholder-slate-400 outline-none py-1.5"
                style={{ width: 140 }}
              />
              <button onClick={() => { setSearchOpen(false); setSearchQ(''); }}>
                <X className="h-3 w-3 text-slate-400 hover:text-white" />
              </button>
              {/* 결과 드롭다운 */}
              {searchResults.length > 0 && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-slate-600 bg-slate-800 shadow-xl z-50 overflow-hidden">
                  {searchResults.map(item => (
                    <button
                      key={item.path + item.label}
                      onMouseDown={() => { navigate(item.path); setSearchOpen(false); setSearchQ(''); }}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-700 transition-colors"
                    >
                      <span className="text-xs font-medium text-white">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.group}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 모드 전환 */}
        {canSwitchMode && (
          <button
            onClick={() => onModeChange(mode === 'shop' ? 'admin' : 'shop')}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all"
            style={isAdmin
              ? { background: 'rgba(99,102,241,0.25)', borderColor: '#6366f1', color: '#a5b4fc' }
              : { background: 'rgba(13,148,136,0.25)', borderColor: '#0d9488', color: '#5eead4' }
            }
          >
            {isAdmin ? '⚙ 관리' : '🔧 실무'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 슈퍼어드민 전용 사이드 섹션
// ─────────────────────────────────────────────────────────────────────────────
export function SuperAdminSidebar() {
  const location = useLocation();
  return (
    <div className="px-1.5 py-1.5 border-t" style={{ borderColor: '#fca5a5' }}>
      <div className="flex items-center gap-1 px-2 py-1 mb-1">
        <ShieldAlert className="h-3 w-3 text-red-400" />
        <span className="text-[9px] font-bold text-red-400 tracking-widest uppercase">Super Admin</span>
      </div>
      <NavLink
        to="/superadmin/reset"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
          location.pathname === '/superadmin/reset'
            ? 'bg-red-600 text-white'
            : 'text-red-400 hover:bg-red-50 hover:text-red-600'
        )}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        시스템 초기화
      </NavLink>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 기존 Sidebar export (AppLayout에서 사용하는 접근자)
// mode / groups 정보 제공
// ─────────────────────────────────────────────────────────────────────────────
export function useSidebarState() {
  const { user, permissions, isAdmin, isSuperAdmin, isManager } = useAuth();
  const canSwitchMode = isAdmin || user?.allowed_modes === 'both';
  const [mode, _setMode] = useState<SidebarMode>(
    () => (localStorage.getItem('sidebar_mode') as SidebarMode) || 'shop'
  );
  const setMode = (m: SidebarMode) => { _setMode(m); localStorage.setItem('sidebar_mode', m); };
  const currentMode: SidebarMode = canSwitchMode ? mode : 'shop';

  const groups = currentMode === 'shop' ? shopTopGroups : adminTopGroups;

  const MANAGER_ONLY_PATHS = [
    '/production/production-dashboard', '/inventory/dashboard',
    '/accounting/setup', '/accounting/revenue', '/accounting/cost', '/accounting/profit-loss',
  ];

  const canViewPath = (path: string) => {
    if (isAdmin) return true;
    if (!isManager && MANAGER_ONLY_PATHS.includes(path)) return false;
    const found = permissions.find((p: any) => p.path === path);
    return !found || found.can_read;
  };

  const filteredGroups = groups.map(g => {
    if (g.path) return canViewPath(g.path) ? g : null;
    if (g.children) {
      const visible = g.children.filter(c => canViewPath(c.path));
      return visible.length ? { ...g, children: visible } : null;
    }
    return g;
  }).filter(Boolean) as TopNavGroup[];

  return { currentMode, setMode, canSwitchMode, filteredGroups, isSuperAdmin };
}

// ─────────────────────────────────────────────────────────────────────────────
// 기존 Sidebar 컴포넌트 (AppLayout에서 import하지만 실제로는 TopNav+SubSidebar 사용)
// AppLayout이 직접 TopNav/SubSidebar를 조립하므로 이 컴포넌트는 미사용
// ─────────────────────────────────────────────────────────────────────────────
export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  return null; // AppLayout에서 직접 TopNav + SubSidebar 사용
}
