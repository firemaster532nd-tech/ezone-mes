import { Link } from 'react-router-dom';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import {
  Factory, Package, Search, FileCheck, ClipboardList, Barcode,
  Calculator, Truck, TrendingUp, Settings, ChevronRight, Layers
} from 'lucide-react';

interface MenuSection {
  title: string;
  items: { label: string; icon: React.ReactNode; path: string }[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: '📦 WMS / 창고',
    items: [
      { label: '바코드 스캔 (WMS)', icon: <Barcode size={18} />, path: '/inventory/barcode-wms' },
      { label: '재고 현황', icon: <Package size={18} />, path: '/inventory' },
      { label: '출하 대기', icon: <Truck size={18} />, path: '/shipment/orders' },
    ],
  },
  {
    title: '🏭 생산',
    items: [
      { label: '작업지시 조회', icon: <ClipboardList size={18} />, path: '/production/work-orders' },
      { label: '공정 실적 입력', icon: <Factory size={18} />, path: '/production/process-stage' },
      { label: '생산 대시보드', icon: <TrendingUp size={18} />, path: '/production/dashboard' },
    ],
  },
  {
    title: '🔍 품질',
    items: [
      { label: 'LOT 추적 조회', icon: <Search size={18} />, path: '/quality/lot-trace' },
      { label: '수입 검사', icon: <FileCheck size={18} />, path: '/quality/incoming' },
      { label: '공정 검사', icon: <FileCheck size={18} />, path: '/quality/process' },
      { label: '자주 검사', icon: <FileCheck size={18} />, path: '/quality/self' },
    ],
  },
  {
    title: '💰 회계 / 영업',
    items: [
      { label: '세금계산서', icon: <Calculator size={18} />, path: '/accounting' },
      { label: '발주서 관리', icon: <ClipboardList size={18} />, path: '/sales/purchase-orders' },
    ],
  },
  {
    title: '⚙️ 설정',
    items: [
      { label: '시스템 설정', icon: <Settings size={18} />, path: '/settings/backup' },
    ],
  },
];

export function MobileMorePage() {
  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-4">
        <div className="flex items-center gap-2.5 h-14">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Layers size={18} className="text-slate-900" />
          </div>
          <div>
            <div className="text-white font-black text-sm">전체 메뉴</div>
            <div className="text-slate-400 text-[10px]">EZONE MES 전체 기능</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-slate-400 text-[11px] font-bold mb-2 pl-1">{section.title}</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/40">
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-700 transition-colors"
                >
                  <span className="text-slate-400 flex-shrink-0">{item.icon}</span>
                  <span className="text-white text-sm font-medium flex-1">{item.label}</span>
                  <ChevronRight size={14} className="text-slate-600" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* PC 전환 */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 text-center mt-4">
          <Link to="/" className="text-slate-400 text-[11px]">
            🖥️ PC 전체 화면으로 전환
          </Link>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
