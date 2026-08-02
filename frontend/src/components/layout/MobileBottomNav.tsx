import { Link, useLocation } from 'react-router-dom';
import { Home, Package, Factory, Search, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavTab {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const TABS: NavTab[] = [
  { key: 'scan',       label: '스캔',    icon: <Barcode size={22} />,    path: '/inventory/barcode-wms' },
  { key: 'incoming',   label: '인수검사', icon: <FileCheck size={22} />,  path: '/quality/incoming' },
  { key: 'quality',    label: '품질검사', icon: <Search size={22} />,     path: '/quality/process' },
  { key: 'workorder',  label: '작업지시', icon: <Factory size={22} />,    path: '/production/work-orders' },
  { key: 'more',       label: '더보기',  icon: <Grid3X3 size={22} />,    path: '/mobile/more' },
];

export function MobileBottomNav() {
  const location = useLocation();

  const getActive = (tab: NavTab) => {
    if (tab.key === 'home') return location.pathname === '/mobile' || location.pathname === '/';
    return location.pathname.startsWith(tab.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 safe-area-pb">
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const active = getActive(tab);
          return (
            <Link
              key={tab.key}
              to={tab.path}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-150 active:opacity-70',
                active
                  ? 'text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <span className={cn('transition-transform duration-150', active && 'scale-110')}>
                {tab.icon}
              </span>
              <span className={cn('text-[10px] font-bold leading-none', active ? 'text-amber-400' : 'text-slate-500')}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-amber-400 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
      {/* iOS safe area spacing */}
      <div className="h-safe-area-inset-bottom bg-slate-900" />
    </nav>
  );
}
