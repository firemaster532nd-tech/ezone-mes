import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Package, MapPin, CheckCircle, RefreshCw, X, Plus, AlertTriangle, HelpCircle, Printer, LogOut, Search, ArrowLeftRight
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WmsInventoryModal } from '@/components/WmsInventoryModal';
import { RackTransferModal } from '@/components/RackTransferModal';
import { generateRackLocationLabelHtml, generateRackLotLabelHtml, generateSerializedLotLabelBatchHtml } from '@/lib/barcodeGenerator';
import { printHtmlViaQzTray, printLabelsViaQzTray } from '@/lib/qzTrayPrinter';
import { PrintPreviewModal } from '@/components/common/PrintPreviewModal';

// ─── 랙 로케이션 마스터 ────────────────────────────────────────────────────────
export const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
export const ZONE_2_COLS = ['P','Q','R'];
export const RACK_TIERS = [3, 2, 1];
export const FIELD_ZONES = [
  { code: 'FIELD-1F-IN',      label: '1공장 안',       emoji: '🏭' },
  { code: 'FIELD-1F-MAT',     label: '1공장 원재료창고', emoji: '📦' },
  { code: 'FIELD-1F-TENT',    label: '1공장 천막',      emoji: '🎪' },
  { code: 'FIELD-1F-OUTDOOR', label: '1공장 야적',      emoji: '⛺' },
  { code: 'FIELD-2F-LEFT',    label: '2공장 왼쪽',      emoji: '🏢' },
  { code: 'FIELD-2F-RIGHT',   label: '2공장 오른쪽',    emoji: '🏗️' },
  { code: 'FIELD-2F-TENT',    label: '2공장 천막',      emoji: '🎨' },
  { code: 'FIELD-2F-OUTDOOR', label: '2공장 야적',      emoji: '📌' },
];

// 파레트 슬롯 타입
export type PalletType = 'certified' | 'non_certified' | 'empty';

export interface PalletSlot {
  slot_no: 1 | 2;
  type: PalletType;            // 인정재고 / 비인정재고 / 공실
  lot_id?: number | null;
  lot_number?: string | null;
  item_name?: string | null;
  qty?: number | null;
  notes?: string | null;       // 비인정재고 추가 메모
}

export interface RackCellStatus {
  location_code: string;
  pallet1: PalletSlot;         // P1 = 오른쪽
  pallet2: PalletSlot;         // P2 = 왼쪽
}

interface AvailableLot {
  lot_id: number;
  lot_number: string;
  item_name: string;
  remaining_qty: number;
  location?: string | null;
}

// ─── 색상 팔레트별 스타일 헬퍼 ────────────────────────────────────────────────
function palletStyle(type: PalletType, active = false) {
  if (type === 'certified')     return active ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 border-emerald-300 text-emerald-900';
  if (type === 'non_certified') return active ? 'bg-amber-500 text-white border-amber-600'   : 'bg-amber-50 border-amber-300 text-amber-900';
  return 'bg-slate-100 text-slate-400 border-dashed border-slate-300';
}

function palletBadgeColor(type: PalletType) {
  if (type === 'certified')     return 'bg-emerald-600';
  if (type === 'non_certified') return 'bg-amber-500';
  return 'bg-slate-300';
}

function cellBorderStyle(p1: PalletSlot, p2: PalletSlot, selected: boolean) {
  if (selected) return 'ring-4 ring-blue-500 border-blue-600 scale-[1.03] z-10 bg-blue-50';
  if (p1.type === 'non_certified' || p2.type === 'non_certified')
    return 'border-amber-400 bg-white hover:bg-amber-50/50 shadow-sm';
  if (p1.type === 'certified' || p2.type === 'certified')
    return 'border-emerald-500 bg-white hover:bg-emerald-50/50 shadow-sm';
  return 'border-slate-300 bg-white hover:bg-slate-50 border-dashed';
}

// ─── 입체 2파레트 랙 그래픽 맵 ───────────────────────────────────────────────
function GraphicRackMap({
  statusMap, selectedLocation, onSelectCell
}: {
  statusMap: Record<string, RackCellStatus>;
  selectedLocation: string;
  onSelectCell: (code: string) => void;
}) {
  const renderPalletSlot = (p: PalletSlot, label: string) => {
    const isFilled = p.type !== 'empty';
    return (
      <div className={cn(
        'p-1 rounded flex flex-col justify-between truncate border transition-all',
        isFilled
          ? p.type === 'certified'
            ? 'bg-emerald-600 text-white font-bold border-emerald-700'
            : 'bg-amber-500 text-white font-bold border-amber-600'
          : 'bg-slate-100 text-slate-400 border-dashed border-slate-300'
      )}>
        <div className="flex justify-between items-center text-[7px] opacity-90">
          <span>{label}</span>
          {isFilled && <span className="h-1 w-1 rounded-full bg-white animate-pulse" />}
        </div>
        <span className="truncate text-[8px] font-bold mt-0.5 block" title={p.item_name || ''}>
          {isFilled
            ? (p.item_name?.length && p.item_name.length > 6 ? p.item_name.slice(0, 6) + '…' : (p.item_name || p.lot_number?.slice(-4)))
            : '공실'}
        </span>
        {isFilled && <span className="text-[7px] text-right font-black mt-0.5">{p.type === 'certified' ? `${Number(p.qty||0).toLocaleString()}` : '비인정'}</span>}
      </div>
    );
  };

  const renderZoneRack = (title: string, subtitle: string, cols: string[], bgHeader: string) => (
    <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-6">
      <div className={cn('px-4 py-2.5 text-white font-bold flex justify-between items-center text-sm', bgHeader)}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span>{title}</span>
          <span className="text-xs font-normal opacity-85">({subtitle})</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />LOT인정재고</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />비인정재고</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />공실</span>
        </div>
      </div>

      <div className="p-4 overflow-x-auto bg-slate-100/60">
        <div className="min-w-[880px] space-y-3">
          {RACK_TIERS.map((tier) => (
            <div key={tier} className="flex items-center gap-2">
              <div className="w-16 h-20 shrink-0 bg-slate-900 text-white rounded-lg font-black text-sm flex flex-col items-center justify-center shadow-inner border border-slate-700">
                <span>{tier}층</span>
                <span className="text-[10px] text-slate-400 font-normal">Layer {tier}</span>
              </div>

              <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((col) => {
                  const code = `${col}${tier}`;
                  const cell = statusMap[code] || {
                    location_code: code,
                    pallet1: { slot_no: 1 as const, type: 'empty' as PalletType },
                    pallet2: { slot_no: 2 as const, type: 'empty' as PalletType }
                  };
                  const { pallet1: p1, pallet2: p2 } = cell;
                  const isSelected = selectedLocation === code;
                  const hasNonCert = p1.type === 'non_certified' || p2.type === 'non_certified';

                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSelectCell(code)}
                      className={cn(
                        'h-20 rounded-lg border-2 p-1 flex flex-col justify-between text-left transition-all relative overflow-hidden group',
                        cellBorderStyle(p1, p2, isSelected)
                      )}
                    >
                      {/* 랙 셀 제목 */}
                      <div className="flex justify-between items-center w-full px-0.5 border-b border-slate-200 pb-0.5">
                        <span className="text-[11px] font-black font-mono text-slate-800">{code}</span>
                        <span className={cn(
                          'text-[8px] font-bold px-1 py-0.5 rounded',
                          hasNonCert ? 'bg-amber-100 text-amber-700' :
                          (p1.type !== 'empty' || p2.type !== 'empty') ? 'text-emerald-600' : 'text-slate-400'
                        )}>
                          {p1.type !== 'empty' && p2.type !== 'empty' ? '2/2 꽉참' :
                           p1.type !== 'empty' || p2.type !== 'empty' ? '1/2 적재' : '0/2 공실'}
                        </span>
                      </div>

                      {/* P2 왼쪽 / P1 오른쪽 */}
                      <div className="grid grid-cols-2 gap-0.5 mt-0.5 text-[8px] font-mono leading-none h-full">
                        {renderPalletSlot(p2, 'P2(좌)')}
                        {renderPalletSlot(p1, 'P1(우)')}
                      </div>

                      {/* 비인정 경고 아이콘 */}
                      {hasNonCert && (
                        <div className="absolute top-0.5 right-0.5">
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 하단 알파벳 칸(Bay) 표기 */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
            <div className="w-16 text-center text-xs font-bold text-slate-500">칸 (Bay)</div>
            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
              {cols.map((col) => (
                <div key={col} className="text-center font-black text-xs font-mono text-slate-700 bg-slate-200/80 py-1 rounded">
                  {col}칸
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const FACTORY_ZONES_3 = [
    { code: 'FIELD-1F-MAIN',     label: '1공장 메인',        emoji: '🏭', desc: '1공장 메인 생산/작업장' },
    { code: 'FIELD-1F-MAT',      label: '1공장 창고',        emoji: '📦', desc: '1공장 원/부자재 창고' },
    { code: 'FIELD-1F-TENT',     label: '1공장 천막안',      emoji: '🎪', desc: '1공장 천막 야외 보관장' },
    { code: 'FIELD-2F-CUTTING',  label: '2공장 재단실구역',  emoji: '✂️', desc: '2공장 차열시트/세라믹울 재단구역' },
    { code: 'FIELD-2F-CENTER',   label: '2공장 중앙구역',    emoji: '🏢', desc: '2공장 중앙 스테이징 필드' },
    { code: 'FIELD-2F-RACKS',    label: '2공장 렉구역',      emoji: '🏗️', desc: '2공장 메인 A~R 렉 주변 구역' },
    { code: 'FIELD-2F-PAINTING', label: '2공장 도색실',      emoji: '🎨', desc: '2공장 플래싱/금속 도색구역' },
    { code: 'FIELD-2F-TENT',     label: '2공장 천막안',      emoji: '⛺', desc: '2공장 천막 출하대기구역' },
  ];

  return (
    <div className="space-y-6">
      {/* 3구역: 8대 세분화 공장 구역 시각화 맵 */}
      <div className="bg-white rounded-xl border border-blue-300 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-blue-900 text-white font-bold flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-300" />
            <span>🏭 3구역: 8대 세분화 공장 구역 맵 (1공장/2공장 메인 및 작업구역)</span>
          </div>
          <span className="text-xs text-blue-200 font-normal">비렉 / 공장 필드 적재 구역 (8개 공장 구역)</span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50">
          {FACTORY_ZONES_3.map((z) => {
            // Find items stored in this zone
            const itemsInZone = Object.values(statusMap).filter(
              c => c.location_code === z.code || c.location_code?.startsWith(z.code)
            );
            const activePallets = itemsInZone.reduce(
              (acc, c) => acc + (c.pallet1.type !== 'empty' ? 1 : 0) + (c.pallet2.type !== 'empty' ? 1 : 0), 0
            );

            return (
              <div
                key={z.code}
                className="bg-white border-2 border-slate-200 hover:border-blue-500 rounded-xl p-3.5 space-y-2 shadow-xs transition-all cursor-pointer"
                onClick={() => onSelectCell(z.code)}
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{z.emoji}</span>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900">{z.label}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{z.code}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    activePallets > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  )}>
                    {activePallets > 0 ? `${activePallets}개 적재` : '공실'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">{z.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2구역 & 1구역 랙 맵 */}
      {renderZoneRack('🏬 2구역 랙 맵 (P~R칸, 왼쪽 구역)', '3칸 × 3층 = 총 9개 셀 (18 파레트 용량)', ZONE_2_COLS, 'bg-indigo-900')}
      {renderZoneRack('🏢 1구역 랙 맵 (O→A칸, 오른쪽 구역)', '15칸 × 3층 = 총 45개 셀 (90 파레트 용량)', ZONE_1_COLS, 'bg-slate-900')}
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────
// ─── 랙/파레트 위치 라벨 일괄 인쇄 (80×60mm) ──────────────────────────────
// printAllPalletLabels는 컴포넌트 내부로 이동 (setPreviewHtml 접근 필요)

// printRackLabel는 컴포넌트 내부로 이동 (setPreviewHtml 접근 필요)

export function LocationManagementPage() {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [rackStatusMap, setRackStatusMap] = useState<Record<string, RackCellStatus>>({});
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── 인쇄 미리보기 상태 ─────────────────────────────────────────────────────
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // 랙 위치 라벨 미리보기
  const printRackLocationLabelOnly = async (code: string, p?: 1 | 2) => {
    const locFull = p ? `${code}-P${p}` : code;
    const sideText = p === 1 ? '오른쪽 파레트 (P1)' : p === 2 ? '왼쪽 파레트 (P2)' : '구역 바코드';
    // rackStatusMap에서 해당 슬롯 재고 조회
    const cellData = rackStatusMap[code];
    const slot = p === 1 ? cellData?.pallet1 : p === 2 ? cellData?.pallet2 : null;
    const stockInfo = slot && slot.type !== 'empty' ? {
      lotNumber: slot.lot_number,
      itemName: slot.item_name,
      qty: slot.qty,
      type: slot.type,
    } : null;
    const html = await generateRackLocationLabelHtml(locFull, sideText, code, stockInfo);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>랙 위치 라벨</title>
<style>
@page { size: 80mm 60mm; margin: 0; }
html, body { width:80mm; height:60mm; margin:0; padding:0; overflow:hidden; font-family:'Malgun Gothic',sans-serif; background:white; }
@media print { @page { size: 80mm 60mm; margin: 0; } html,body { margin:0; padding:0; } }
</style></head><body>${html}</body></html>`;
    setPreviewHtml(fullHtml);
  };

  // 랙 LOT(제품) 라벨 미리보기 — 기존 디자인 CSS 완전 유지
  const printRackLabel = async (locationCode: string, slotNo: 1 | 2, slot: PalletSlot) => {
    const locFull = `${locationCode}-P${slotNo}`;
    const lotNo = slot.lot_number || '-';
    const item = slot.item_name || '-';
    const qty = `${Number(slot.qty || 0).toLocaleString()} EA`;
    const sideText = slotNo === 1 ? 'P1 오른쪽' : 'P2 왼쪽';
    const labelHtml = await generateRackLotLabelHtml(locFull, sideText, lotNo, item, qty);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>랙 라벨</title>
<style>
@page { size: 80mm 60mm; margin: 0 !important; }
@media print { @page { size: 80mm 60mm; margin: 0 !important; } html,body { width:80mm !important; height:60mm !important; margin:0 !important; padding:0 !important; overflow:hidden !important; } }
html,body{width:80mm;height:60mm;margin:0;padding:0;font-family:'Malgun Gothic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden;}
.label-card{width:70mm;height:44mm;margin:2mm auto;padding:1mm 1.5mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;border:0.3mm solid #334155;overflow:hidden;page-break-inside:avoid;break-inside:avoid;}
.label-card:not(:last-child){page-break-after:always;break-after:always;}
.label-card:last-child{page-break-after:avoid;break-after:avoid;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:0.3mm solid #1a237e;padding-bottom:0.2mm;font-size:6.5pt;font-weight:bold;}
.company{color:#c00;}.title{color:#1a237e;}.date{color:#666;font-size:5.5pt;}
.body-row{display:flex;gap:1.5mm;align-items:center;flex:1;margin-top:0.3mm;margin-bottom:0.3mm;overflow:hidden;}
.qr-box .qr-img{width:12mm;height:12mm;border:0.2mm solid #cbd5e1;flex-shrink:0;}
.info-box{flex:1;overflow:hidden;}
.loc-code{font-size:9.5pt;font-weight:900;font-family:monospace;color:#1a237e;}
.field{font-size:6pt;margin-top:0.3mm;}
.field .lbl{color:#777;}
.field .val{font-weight:bold;color:#111;}
.lot-val{font-family:monospace;color:#1d4ed8;}
.qty-val{font-size:8pt;color:#047857;}
.barcode-box{text-align:center;border-top:0.2mm dashed #bbb;padding-top:0.5mm;margin-top:0.5mm;}
.barcode-box svg{width:45mm;height:6mm;margin:0 auto;display:block;}
.barcode-text{font-size:5pt;font-family:monospace;color:#555;letter-spacing:0.5px;margin-top:0.2mm;}
</style></head><body>${labelHtml}</body></html>`;
    setPreviewHtml(fullHtml);
  };

  // 파레트 위치 라벨 일괄 미리보기
  const printAllPalletLabels = async () => {
    const rows = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'];
    const levels = [1, 2, 3];
    const allLocations: { code: string; p: 1 | 2 }[] = [];
    for (const r of rows) {
      for (const l of levels) {
        const code = `${r}${l}`;
        allLocations.push({ code, p: 1 });
        allLocations.push({ code, p: 2 });
      }
    }
    const labelCards = await Promise.all(
      allLocations.map(({ code, p }) => {
        const locFull = `${code}-P${p}`;
        const sideText = p === 1 ? '오른쪽 파레트 (P1)' : '왼쪽 파레트 (P2)';
        return generateRackLocationLabelHtml(locFull, sideText, code);
      })
    );
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>파레트 위치 라벨 일괄</title>
<style>
@page { size: 80mm 60mm; margin: 0 !important; }
@media print { @page { size: 80mm 60mm; margin: 0 !important; } html,body { width:80mm !important; height:60mm !important; margin:0 !important; padding:0 !important; overflow:hidden !important; } }
html,body{width:80mm;height:60mm;margin:0;padding:0;font-family:'Malgun Gothic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden;}
.label-card{width:70mm;height:44mm;margin:2mm auto;padding:1mm 1.5mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;border:0.3mm solid #334155;overflow:hidden;page-break-inside:avoid;break-inside:avoid;}
.label-card:not(:last-child){page-break-after:always;break-after:always;}
.label-card:last-child{page-break-after:avoid;break-after:avoid;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:0.3mm solid #1a237e;padding-bottom:0.2mm;font-size:6.5pt;font-weight:bold;}
.company{color:#c00;}.title{color:#1a237e;}
.body-row{display:flex;gap:1.5mm;align-items:center;flex:1;margin-top:0.3mm;margin-bottom:0.3mm;overflow:hidden;}
.qr-box .qr-img{width:12mm;height:12mm;border:0.2mm solid #cbd5e1;flex-shrink:0;}
.info-box{flex:1;overflow:hidden;}
.loc-code{font-size:11pt;font-weight:900;font-family:monospace;color:#1a237e;line-height:1.1;}
.side-badge{font-size:6.5pt;color:#15803d;font-weight:bold;margin-top:0.2mm;}
.rack-zone{font-size:5.5pt;color:#64748b;margin-top:0.1mm;}
.barcode-box{text-align:center;border-top:0.2mm dashed #cbd5e1;padding-top:0.3mm;margin-top:0.2mm;}
.barcode-box svg{width:45mm;height:6mm;margin:0 auto;display:block;}
.barcode-text{font-size:5pt;font-family:monospace;color:#475569;letter-spacing:0.5px;margin-top:0.1mm;}
</style></head><body>${labelCards.join('')}</body></html>`;
    setPreviewHtml(fullHtml);
  };

  // 셀 모달 상태
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [activeCellCode, setActiveCellCode] = useState('');
  const [targetSlotNo, setTargetSlotNo] = useState<1 | 2>(1);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [inputLotNo, setInputLotNo] = useState('');
  const [inputItemName, setInputItemName] = useState('');
  const [inputQty, setInputQty] = useState<number>(100);

  // 렉 이동 모달
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // 재고 등록 모달
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);

  // 출고 처리 모달
  const [outModalOpen, setOutModalOpen] = useState(false);
  const [outSearchQuery, setOutSearchQuery] = useState('');
  const [outSearchResult, setOutSearchResult] = useState<any | null>(null);
  const [outQty, setOutQty] = useState<number>(0);
  const [outSearching, setOutSearching] = useState(false);
  const [outProcessing, setOutProcessing] = useState(false);

  // 일괄 위치 라벨 선택 모달
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [selectedBulkLocs, setSelectedBulkLocs] = useState<Set<string>>(new Set());
  const [bulkCopies, setBulkCopies] = useState(1);

  const toggleBulkLoc = (loc: string) => {
    setSelectedBulkLocs(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc); else next.add(loc);
      return next;
    });
  };

  const selectAllBulk = () => {
    const all = new Set<string>();
    [...ZONE_1_COLS, ...ZONE_2_COLS].forEach(col =>
      RACK_TIERS.forEach(tier => { all.add(`${col}${tier}-P1`); all.add(`${col}${tier}-P2`); })
    );
    FIELD_ZONES.forEach(z => all.add(z.code));
    setSelectedBulkLocs(all);
  };

  const handleBulkPrint = async () => {
    if (selectedBulkLocs.size === 0) { toast.error('하나 이상 선택하세요.'); return; }
    const locsArray = [...selectedBulkLocs];
    const totalLabels = locsArray.length * bulkCopies;

    toast.info(`📄 ${totalLabels}장 라벨 생성 중...`);

    // 모든 라벨 HTML(div 조각) 사전 생성
    const labelDivs: string[] = [];
    for (const loc of locsArray) {
      const isField = loc.startsWith('FIELD-');
      const sideText = isField ? '구역 바코드' : loc.endsWith('-P1') ? '오른쪽 파레트 (P1)' : '왼쪽 파레트 (P2)';
      const code = isField ? loc : loc.replace(/-P[12]$/, '');
      const div = await generateRackLocationLabelHtml(loc, sideText, code, (() => {
        if (isField) return null;
        const cellKey = loc.replace(/-P[12]$/, '');
        const slotKey = loc.endsWith('-P1') ? 'pallet1' : 'pallet2';
        const slot = rackStatusMap[cellKey]?.[slotKey];
        return slot && slot.type !== 'empty' ? { lotNumber: slot.lot_number, itemName: slot.item_name, qty: slot.qty, type: slot.type } : null;
      })());
      for (let i = 0; i < bulkCopies; i++) labelDivs.push(div);
    }

    // JSON으로 직렬화해서 새 창에 embed (XSS 없음, 동일 origin)
    const labelsJson = JSON.stringify(labelDivs);

    // 새 창에서 1장씩 순차 print() — page-break CSS 완전 우회
    const winHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>위치라벨 순차인쇄</title>
<style>
  @page { size: 80mm 60mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: 80mm; height: 60mm; overflow: hidden; background: white; font-family: 'Malgun Gothic', Arial, sans-serif; }
  #container { width: 80mm; height: 60mm; overflow: hidden; }
</style>
</head>
<body>
  <div id="container"></div>
  <script>
    var labels = ${labelsJson};
    var idx = 0;
    function printNext() {
      if (idx >= labels.length) {
        document.title = '완료';
        document.body.innerHTML = '<div style="font-family:sans-serif;padding:16px;font-size:13px;color:#333;">✅ ' + labels.length + '장 인쇄 완료. 창을 닫으세요.</div>';
        return;
      }
      document.getElementById('container').innerHTML = labels[idx++];
      setTimeout(function() {
        window.print();
        setTimeout(printNext, 400);
      }, 150);
    }
    window.onload = function() { setTimeout(printNext, 300); };
  </script>
</body></html>`;

    setBulkPrintOpen(false);

    const w = window.open('', '_blank', 'width=420,height=320');
    if (w) {
      w.document.open();
      w.document.write(winHtml);
      w.document.close();
      toast.success(`✅ ${totalLabels}장 순차 인쇄 시작 — 인쇄 다이얼로그를 ${totalLabels}번 확인하세요.`);
    } else {
      // 팝업 차단 시 QZ Tray 모달로 폴백
      const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>위치라벨(${totalLabels}장)</title>
<style>
  @page { size: 80mm 60mm; margin: 0; }
  html, body { margin: 0; padding: 0; width: 80mm; background: white; font-family: 'Malgun Gothic', Arial, sans-serif; }
  * { page-break-inside: auto !important; break-inside: auto !important; }
  .lp { display: block; width: 80mm; height: 60mm; overflow: hidden; page-break-after: always; break-after: page; }
  .lp:last-child { page-break-after: avoid; break-after: avoid; }
</style></head><body>
${labelDivs.map(d => `<div class="lp">${d}</div>`).join('')}
</body></html>`;
      setPreviewHtml(fallbackHtml);
      toast.warning('팝업이 차단됨 — 주소창 팝업 허용 후 다시 시도하거나 QZ Tray 인쇄를 사용하세요.');
    }
  };

  // QZ Tray 전용 일괄 인쇄 — 라벨당 qz.print() 1회 직접 호출
  const handleBulkPrintQz = async () => {
    if (selectedBulkLocs.size === 0) { toast.error('하나 이상 선택하세요.'); return; }
    const locsArray = [...selectedBulkLocs];
    const totalLabels = locsArray.length * bulkCopies;

    toast.info(`📄 QZ Tray 전송 준비 중 (${totalLabels}장)...`);

    const labelDivs: string[] = [];
    for (const loc of locsArray) {
      const isField = loc.startsWith('FIELD-');
      const sideText = isField ? '구역 바코드' : loc.endsWith('-P1') ? '오른쪽 파레트 (P1)' : '왼쪽 파레트 (P2)';
      const code = isField ? loc : loc.replace(/-P[12]$/, '');
      const div = await generateRackLocationLabelHtml(loc, sideText, code, (() => {
        if (isField) return null;
        const cellKey = loc.replace(/-P[12]$/, '');
        const slotKey = loc.endsWith('-P1') ? 'pallet1' : 'pallet2';
        const slot = rackStatusMap[cellKey]?.[slotKey];
        return slot && slot.type !== 'empty' ? { lotNumber: slot.lot_number, itemName: slot.item_name, qty: slot.qty, type: slot.type } : null;
      })());
      for (let i = 0; i < bulkCopies; i++) labelDivs.push(div);
    }

    setBulkPrintOpen(false);
    try {
      await printLabelsViaQzTray(labelDivs);
      toast.success(`✅ ${totalLabels}장 고덱스 인쇄 완료!`);
    } catch (err: any) {
      toast.error(`QZ Tray 오류: ${err.message || 'QZ Tray 실행 중인지 확인하세요.'}`);
    }
  };

  // 데이터 로드 — /api/wms/rack-map 단일 엔드포인트

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { non_certified: any[]; lots: any[]; material_lots: any[] } }>('/wms/rack-map');
      const { non_certified = [], lots = [], material_lots = [] } = res.data ?? {};

      // 인정재고 목록 구성 (lots + material_lots)
      const availList: AvailableLot[] = [
        ...lots.map((l: any) => ({
          lot_id: l.lot_id,
          lot_number: l.lot_number,
          item_name: l.item_name || '완제품',
          remaining_qty: l.remaining_qty ?? l.qty ?? 0,
          location: l.staging_location || l.location || null,
        })),
        ...material_lots.map((ml: any) => ({
          lot_id: ml.lot_id ?? ml.material_lot_id,
          lot_number: ml.lot_number,
          item_name: ml.item_name || '자재',
          remaining_qty: ml.qty_current ?? ml.remaining_qty ?? 0,
          location: ml.location || null,
        })),
      ].filter(l => !!l.lot_number);
      setAvailableLots(availList);

      // 랙맵 구성
      const map: Record<string, RackCellStatus> = {};

      const ensureCell = (code: string) => {
        if (!map[code]) {
          map[code] = {
            location_code: code,
            pallet1: { slot_no: 1, type: 'empty' },
            pallet2: { slot_no: 2, type: 'empty' },
          };
        }
      };

      // 인정재고 배치 (A1-P1 / A1-P2 포맷 파싱)
      for (const l of availList) {
        if (!l.location) continue;
        let rackCode = l.location;
        let palletSlot: 1 | 2 | null = null;

        const pMatch = l.location.match(/^([A-Z]+\d+)-P(\d)$/);
        if (pMatch) {
          rackCode = pMatch[1];
          palletSlot = parseInt(pMatch[2]) as 1 | 2;
        }

        ensureCell(rackCode);
        const slot: PalletSlot = {
          slot_no: palletSlot || 1,
          type: 'certified',
          lot_id: l.lot_id,
          lot_number: l.lot_number,
          item_name: l.item_name,
          qty: l.remaining_qty ?? 0,   // ← remaining_qty를 qty로 매핑
        };

        if (palletSlot === 1) {
          map[rackCode].pallet1 = slot;
        } else if (palletSlot === 2) {
          map[rackCode].pallet2 = slot;
        } else {
          if (map[rackCode].pallet1.type === 'empty') {
            map[rackCode].pallet1 = { ...slot, slot_no: 1 };
          } else if (map[rackCode].pallet2.type === 'empty') {
            map[rackCode].pallet2 = { ...slot, slot_no: 2 };
          }
        }
      }

      // 비인정재고 배치
      for (const nc of non_certified) {
        const rackCode = nc.rack_code;
        const palletNo = nc.pallet_no as 1 | 2;
        if (!rackCode) continue;

        ensureCell(rackCode);
        const slot: PalletSlot = {
          slot_no: palletNo,
          type: 'non_certified',
          lot_number: nc.lot_number || null,
          item_name: nc.item_name,
          qty: nc.qty ?? 0,
          notes: nc.notes || nc.reason,
        };

        if (palletNo === 1) {
          if (map[rackCode].pallet1.type === 'empty') map[rackCode].pallet1 = slot;
        } else {
          if (map[rackCode].pallet2.type === 'empty') map[rackCode].pallet2 = slot;
        }
      }

      setRackStatusMap(map);
    } catch (e) {
      console.error('loadData error', e);
      toast.error('랙맵 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 출고 LOT 검색
  const handleOutSearch = async () => {
    if (!outSearchQuery.trim()) return;
    setOutSearching(true);
    setOutSearchResult(null);
    try {
      const res = await api.get<{ data: any }>(`/wms/search?q=${encodeURIComponent(outSearchQuery.trim())}`);
      if (res.data) {
        setOutSearchResult(res.data);
        setOutQty(res.data.remaining_qty ?? res.data.qty_current ?? 0);
      } else {
        toast.error('해당 LOT/바코드를 찾을 수 없습니다.');
      }
    } catch {
      toast.error('검색 실패');
    } finally {
      setOutSearching(false);
    }
  };

  // 출고 처리
  const handleOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outSearchResult) return;
    if (outQty <= 0) { toast.error('출고 수량을 입력하세요.'); return; }
    setOutProcessing(true);
    try {
      await api.post('/wms/out', {
        lot_number: outSearchResult.lot_number,
        lot_id: outSearchResult.lot_id,
        qty: outQty,
      });
      toast.success(`출고 완료 — LOT: ${outSearchResult.lot_number}, 수량: ${outQty}`);
      setOutModalOpen(false);
      setOutSearchQuery('');
      setOutSearchResult(null);
      loadData();
    } catch (err: unknown) {
      const msg = (err instanceof Error) ? err.message : '출고 실패';
      toast.error(msg);
    } finally {
      setOutProcessing(false);
    }
  };

  const handleSelectCell = (code: string) => {
    setActiveCellCode(code);
    setSelectedLocation(code);
    setCellModalOpen(true);
    setTargetSlotNo(1);
    setSelectedLotId('');
    setInputLotNo('');
    setInputItemName('');
  };

  const handleSelectAvailableLot = (lotIdStr: string) => {
    setSelectedLotId(lotIdStr);
    const found = availableLots.find(l => String(l.lot_id) === lotIdStr || l.lot_number === lotIdStr);
    if (found) {
      setInputLotNo(found.lot_number);
      setInputItemName(found.item_name);
      setInputQty(found.remaining_qty);
      toast.info(`현재 보유 재고 LOT (${found.lot_number})가 선택되었습니다.`);
    }
  };

  const handleAssignToPallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLotNo.trim()) {
      toast.error('배치할 LOT 번호를 입력하거나 현재 재고에서 선택해 주세요.');
      return;
    }
    const locationStr = `${activeCellCode}-P${targetSlotNo}`;
    try {
      await api.post('/lots/assign-location', {
        lot_number: inputLotNo.trim(),
        item_name: inputItemName.trim() || '입고 자재',
        qty: inputQty,
        location: locationStr,
        slot_no: targetSlotNo
      });
      toast.success(`${activeCellCode} 랙 P${targetSlotNo} 파레트에 LOT (${inputLotNo}) 배치 완료!`);
    } catch {
      // 로컬 반영
      setRackStatusMap(prev => {
        const cell = prev[activeCellCode] || {
          location_code: activeCellCode,
          pallet1: { slot_no: 1 as const, type: 'empty' as PalletType },
          pallet2: { slot_no: 2 as const, type: 'empty' as PalletType }
        };
        const updated = { ...cell };
        const slot: PalletSlot = { slot_no: targetSlotNo, type: 'certified', lot_number: inputLotNo.trim(), item_name: inputItemName.trim() || '입고 자재', qty: inputQty };
        if (targetSlotNo === 1) updated.pallet1 = slot;
        else updated.pallet2 = slot;
        return { ...prev, [activeCellCode]: updated };
      });
      toast.success(`${activeCellCode} 랙 P${targetSlotNo} 파레트 배치 반영!`);
    }
    setInputLotNo('');
    setInputItemName('');
  };

  const handleClearPallet = (slotNo: 1 | 2) => {
    if (!confirm(`${activeCellCode} 랙의 P${slotNo} 파레트 적재 내역을 비우시겠습니까?`)) return;
    setRackStatusMap(prev => {
      const cell = prev[activeCellCode];
      if (!cell) return prev;
      const updated = { ...cell };
      if (slotNo === 1) updated.pallet1 = { slot_no: 1, type: 'empty' };
      else updated.pallet2 = { slot_no: 2, type: 'empty' };
      return { ...prev, [activeCellCode]: updated };
    });
    toast.success(`${activeCellCode} 랙 P${slotNo} 파레트가 비워졌습니다.`);
  };

  const activeCell = rackStatusMap[activeCellCode] || {
    location_code: activeCellCode,
    pallet1: { slot_no: 1 as const, type: 'empty' as PalletType },
    pallet2: { slot_no: 2 as const, type: 'empty' as PalletType }
  };

  // 통계
  const certCount = Object.values(rackStatusMap).reduce((a, c) =>
    a + (c.pallet1.type === 'certified' ? 1 : 0) + (c.pallet2.type === 'certified' ? 1 : 0), 0);
  const nonCertCount = Object.values(rackStatusMap).reduce((a, c) =>
    a + (c.pallet1.type === 'non_certified' ? 1 : 0) + (c.pallet2.type === 'non_certified' ? 1 : 0), 0);
  const totalUsed = certCount + nonCertCount;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="🏢 공장 랙 로케이션 관리"
        description="2파레트/셀 기준 랙맵 시각화 — 🟢 인정재고(LOT있음) / 🟡 비인정재고(LOT없음·인정심사·반품) / ⬜ 공실"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white border border-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
          >
            <ArrowLeftRight className="h-4 w-4" />
            🔄 렉 이동
          </button>
          <button
            onClick={() => setInventoryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            재고 등록
          </button>
          <button
            onClick={() => setOutModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 text-white border border-rose-700 rounded-lg text-sm font-bold hover:bg-rose-700 shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            출고 처리
          </button>
          <button
            onClick={() => setBulkPrintOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white border border-blue-700 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            파레트 위치 라벨 일괄 출력
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium shadow-sm"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            현황 새로고침
          </button>
        </div>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl"><Package className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">총 파레트 용량</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">108 파레트</p>
            <p className="text-[10px] text-slate-400">54셀 × 2파레트</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl"><CheckCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">LOT 인정재고</p>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{certCount}개 파레트</p>
            <p className="text-[10px] text-slate-400">정식 LOT 등록</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-xl"><HelpCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">비인정재고</p>
            <p className="text-lg font-black text-amber-800 mt-0.5">{nonCertCount}개 파레트</p>
            <p className="text-[10px] text-slate-400">인정심사용·반품·기타</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl"><MapPin className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">공실 파레트</p>
            <p className="text-lg font-black text-slate-600 mt-0.5">{108 - totalUsed}개 여유</p>
            <p className="text-[10px] text-slate-400">사용률 {Math.round(totalUsed/108*100)}%</p>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-6 text-xs font-medium text-slate-700">
        <span className="font-bold text-slate-500">범례:</span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-emerald-600 inline-block" />
          <span>P1 오른쪽 파레트 — LOT 인정재고</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-indigo-600 inline-block" />
          <span>P2 왼쪽 파레트 — LOT 인정재고</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-amber-500 inline-block" />
          <span>비인정재고 (인정심사용·소켓반품·미출하 등)</span>
        </span>
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>비인정재고 포함 셀 표시</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-slate-200 border border-dashed border-slate-400 inline-block" />
          <span>공실</span>
        </span>
      </div>

      {/* 2파레트 랙 그래픽 맵 */}
      <GraphicRackMap
        statusMap={rackStatusMap}
        selectedLocation={selectedLocation}
        onSelectCell={handleSelectCell}
      />

      {/* 셀 / 공장 구역 선택 모달 */}
      {cellModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* 3구역 (8대 공장/비렉 구역) 선택 시 전용 상세 모달 */}
            {activeCellCode.startsWith('FIELD-') ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-900 text-white text-xs font-black font-mono px-3 py-1 rounded-lg">
                      3구역 🏭 {activeCellCode}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base">공장 작업구역 자재 & 발주서 적재 관리</h3>
                  </div>
                  <button onClick={() => setCellModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* 현재 이 3구역에 보관 중인 자재/LOT 내역 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span>현재 구역 보관 자재/LOT 목록</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-bold">
                      위치: {activeCellCode}
                    </span>
                  </div>

                  {availableLots.filter(l => l.location === activeCellCode || l.location?.startsWith(activeCellCode)).length > 0 ? (
                    <div className="divide-y border rounded-xl overflow-hidden bg-slate-50">
                      {availableLots
                        .filter(l => l.location === activeCellCode || l.location?.startsWith(activeCellCode))
                        .map((lot) => (
                          <div key={lot.lot_id} className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'text-[9px] font-black px-1.5 py-0.5 rounded',
                                  lot.item_name?.includes('세라믹') ? 'bg-amber-100 text-amber-900' :
                                  lot.item_name?.includes('그라스') ? 'bg-emerald-100 text-emerald-900' :
                                  lot.item_name?.includes('소켓') ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-800'
                                )}>
                                  {lot.item_name?.includes('세라믹') ? '세라믹울' : lot.item_name?.includes('그라스') ? '그라스울' : lot.item_name?.includes('소켓') ? '소켓' : '구조체'}
                                </span>
                                <span className="font-mono font-extrabold text-sm text-slate-900">{lot.lot_number}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-800">{lot.item_name}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm font-black text-indigo-900">{Number(lot.remaining_qty).toLocaleString()} EA</p>
                              <a href="/shipment/statements" className="text-[10px] text-blue-600 font-bold hover:underline block">
                                📄 거래명세표 발행 →
                              </a>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400 border-2 border-dashed rounded-xl bg-slate-50 space-y-1">
                      <p className="font-bold">현재 [{activeCellCode}] 구역에 적재된 자재가 없습니다.</p>
                      <p className="text-[11px] text-slate-400">아래 폼에서 보유 재고 LOT를 선택하여 이 구역에 즉시 배치할 수 있습니다.</p>
                    </div>
                  )}
                </div>

                {/* ─── 🖨️ 3구역 라벨 인쇄 ─── */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <Printer className="h-4 w-4 text-indigo-600" />
                    🖨️ [{activeCellCode}] 구역 라벨 인쇄
                  </p>

                  {/* 구역 위치 라벨 */}
                  <button
                    type="button"
                    onClick={() => printRackLocationLabelOnly(activeCellCode)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-indigo-300 hover:bg-indigo-100 hover:border-indigo-500 rounded-lg text-xs font-bold text-indigo-800 transition-all shadow-sm"
                  >
                    📍 구역 위치 라벨 출력 ({activeCellCode})
                  </button>

                  {/* 보관 중인 LOT별 라벨 */}
                  {availableLots.filter(l => l.location === activeCellCode || l.location?.startsWith(activeCellCode)).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-500">보관 중인 LOT 라벨:</p>
                      {availableLots
                        .filter(l => l.location === activeCellCode || l.location?.startsWith(activeCellCode))
                        .map((lot) => (
                          <button
                            key={lot.lot_id}
                            type="button"
                            onClick={() => printRackLabel(activeCellCode, 1, {
                              slot_no: 1,
                              type: 'certified',
                              lot_number: lot.lot_number,
                              item_name: lot.item_name,
                              qty: lot.remaining_qty,
                            })}
                            className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-white border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-400 rounded-lg text-xs font-bold text-blue-800 transition-all shadow-sm"
                          >
                            <span>🏷 {lot.lot_number}</span>
                            <span className="text-slate-600 font-mono">{lot.item_name} · {lot.remaining_qty} EA</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* 폼: 이 구역에 자재 배치 */}
                <form onSubmit={handleAssignToPallet} className="bg-slate-50 border-2 border-blue-200 p-4 rounded-xl space-y-3">
                  <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1">
                    <Plus className="h-4 w-4 text-blue-600" />
                    <span>➕ [{activeCellCode}] 구역에 자재/LOT 배치하기</span>
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">1. 보유 재고 LOT 선택 *</label>
                    <select
                      value={selectedLotId}
                      onChange={(e) => handleSelectAvailableLot(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white"
                    >
                      <option value="">-- 배치할 LOT 선택 --</option>
                      {availableLots.map((l) => (
                        <option key={l.lot_id} value={l.lot_id}>
                          [{l.lot_number}] {l.item_name} ({l.remaining_qty} EA)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">LOT 번호 *</label>
                      <input
                        value={inputLotNo}
                        onChange={(e) => setInputLotNo(e.target.value)}
                        placeholder="예: 260227CW005"
                        required
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">수량 *</label>
                      <input
                        type="number"
                        min="1"
                        value={inputQty}
                        onChange={(e) => setInputQty(Number(e.target.value))}
                        required
                        className="w-full border rounded-lg px-3 py-2 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>[{activeCellCode}] 구역에 배치 저장</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-sm font-black font-mono px-2.5 py-1 rounded">{activeCellCode} 랙 셀</span>
                    <h3 className="font-bold text-slate-800 text-base">2파레트 적재 현황</h3>
                  </div>
                  <button onClick={() => setCellModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

            {/* P2(왼쪽) / P1(오른쪽) 현황 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {/* P2 왼쪽 */}
              <div className={cn('p-3 rounded-xl border space-y-1.5',
                activeCell.pallet2.type === 'certified' ? 'bg-indigo-50 border-indigo-300' :
                activeCell.pallet2.type === 'non_certified' ? 'bg-amber-50 border-amber-300' :
                'bg-slate-50 border-slate-200'
              )}>
                <div className="flex justify-between items-center">
                  <span className={cn('text-xs font-black text-white px-2 py-0.5 rounded font-mono',
                    activeCell.pallet2.type !== 'empty' ? (activeCell.pallet2.type === 'non_certified' ? 'bg-amber-500' : 'bg-indigo-600') : 'bg-slate-400'
                  )}>P2 (왼쪽)</span>
                  <div className="flex items-center gap-1.5">
                    {/* 위치 라벨 — 빈 파레트도 출력 가능 */}
                    <button
                      type="button"
                      onClick={() => printRackLocationLabelOnly(activeCellCode, 2)}
                      className="text-[10px] text-slate-500 font-bold hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-1.5 py-0.5 rounded transition-colors"
                      title="P2 위치 라벨 인쇄"
                    >📍 위치</button>
                    {/* LOT 라벨 — 재고 있을 때 (인정/비인정 모두) */}
                    {activeCell.pallet2.type !== 'empty' && activeCell.pallet2.item_name && (
                      <button
                        type="button"
                        onClick={() => printRackLabel(activeCellCode, 2, activeCell.pallet2)}
                        className="text-[10px] text-blue-600 font-bold hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded transition-colors"
                        title="P2 LOT 라벨 인쇄"
                      >🖨 LOT</button>
                    )}
                    {activeCell.pallet2.type !== 'empty' && (
                      <button onClick={() => handleClearPallet(2)} className="text-[10px] text-rose-600 font-bold hover:underline">비우기 ✕</button>
                    )}
                  </div>
                </div>
                {activeCell.pallet2.type !== 'empty' ? (
                  <div>
                    <p className="font-black text-slate-900 text-xs truncate">{activeCell.pallet2.item_name}</p>
                    {activeCell.pallet2.lot_number && <p className="text-[10px] text-slate-600 font-mono">LOT: {activeCell.pallet2.lot_number}</p>}
                    {activeCell.pallet2.type === 'certified' && (
                      <p className="text-[10px] text-indigo-900 font-black font-mono mt-0.5">수량: {Number(activeCell.pallet2.qty || 0).toLocaleString()} EA</p>
                    )}
                    {activeCell.pallet2.type === 'non_certified' && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">⚠ 비인정재고</span>
                    )}
                    {activeCell.pallet2.notes && <p className="text-[9px] text-slate-400 mt-0.5">{activeCell.pallet2.notes}</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 py-3 text-center">P2 (왼쪽) 빈 파레트</p>
                )}
              </div>

              {/* P1 오른쪽 */}
              <div className={cn('p-3 rounded-xl border space-y-1.5',
                activeCell.pallet1.type === 'certified' ? 'bg-emerald-50 border-emerald-300' :
                activeCell.pallet1.type === 'non_certified' ? 'bg-amber-50 border-amber-300' :
                'bg-slate-50 border-slate-200'
              )}>
                <div className="flex justify-between items-center">
                  <span className={cn('text-xs font-black text-white px-2 py-0.5 rounded font-mono',
                    activeCell.pallet1.type !== 'empty' ? (activeCell.pallet1.type === 'non_certified' ? 'bg-amber-500' : 'bg-emerald-600') : 'bg-slate-400'
                  )}>P1 (오른쪽)</span>
                  <div className="flex items-center gap-1.5">
                    {/* 위치 라벨 — 빈 파레트도 출력 가능 */}
                    <button
                      type="button"
                      onClick={() => printRackLocationLabelOnly(activeCellCode, 1)}
                      className="text-[10px] text-slate-500 font-bold hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 px-1.5 py-0.5 rounded transition-colors"
                      title="P1 위치 라벨 인쇄"
                    >📍 위치</button>
                    {/* LOT 라벨 — 재고 있을 때 (인정/비인정 모두) */}
                    {activeCell.pallet1.type !== 'empty' && activeCell.pallet1.item_name && (
                      <button
                        type="button"
                        onClick={() => printRackLabel(activeCellCode, 1, activeCell.pallet1)}
                        className="text-[10px] text-blue-600 font-bold hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded transition-colors"
                        title="P1 LOT 라벨 인쇄"
                      >🖨 LOT</button>
                    )}
                    {activeCell.pallet1.type !== 'empty' && (
                      <button onClick={() => handleClearPallet(1)} className="text-[10px] text-rose-600 font-bold hover:underline">비우기 ✕</button>
                    )}
                  </div>
                </div>
                {activeCell.pallet1.type !== 'empty' ? (
                  <div>
                    <p className="font-black text-slate-900 text-xs truncate">{activeCell.pallet1.item_name}</p>
                    {activeCell.pallet1.lot_number && <p className="text-[10px] text-slate-600 font-mono">LOT: {activeCell.pallet1.lot_number}</p>}
                    {activeCell.pallet1.type === 'certified' && (
                      <p className="text-[10px] text-emerald-800 font-black font-mono mt-0.5">수량: {Number(activeCell.pallet1.qty || 0).toLocaleString()} EA</p>
                    )}
                    {activeCell.pallet1.type === 'non_certified' && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">⚠ 비인정재고</span>
                    )}
                    {activeCell.pallet1.notes && <p className="text-[9px] text-slate-400 mt-0.5">{activeCell.pallet1.notes}</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 py-3 text-center">P1 (오른쪽) 빈 파레트</p>
                )}
              </div>
            </div>

            {/* ─── 🖨️ 라벨 인쇄 전용 섹션 ─── */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-indigo-600" />
                🖨️ [{activeCellCode}] 라벨 인쇄
              </p>

              {/* 위치 라벨 행 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => printRackLocationLabelOnly(activeCellCode, 2)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border-2 border-indigo-300 hover:bg-indigo-100 hover:border-indigo-500 rounded-lg text-xs font-bold text-indigo-800 transition-all shadow-sm"
                >
                  📍 P2(왼쪽) 위치라벨
                </button>
                <button
                  type="button"
                  onClick={() => printRackLocationLabelOnly(activeCellCode, 1)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border-2 border-indigo-300 hover:bg-indigo-100 hover:border-indigo-500 rounded-lg text-xs font-bold text-indigo-800 transition-all shadow-sm"
                >
                  📍 P1(오른쪽) 위치라벨
                </button>
              </div>

              {/* LOT 라벨 행 — 재고 있을 때만 */}
              {(activeCell.pallet2.type !== 'empty' || activeCell.pallet1.type !== 'empty') && (
                <div className="grid grid-cols-2 gap-2">
                  {activeCell.pallet2.type !== 'empty' && activeCell.pallet2.item_name ? (
                    <button
                      type="button"
                      onClick={() => printRackLabel(activeCellCode, 2, activeCell.pallet2)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-500 rounded-lg text-xs font-bold text-blue-800 transition-all shadow-sm"
                    >
                      🏷 P2 LOT 라벨
                    </button>
                  ) : <div />}
                  {activeCell.pallet1.type !== 'empty' && activeCell.pallet1.item_name ? (
                    <button
                      type="button"
                      onClick={() => printRackLabel(activeCellCode, 1, activeCell.pallet1)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-500 rounded-lg text-xs font-bold text-blue-800 transition-all shadow-sm"
                    >
                      🏷 P1 LOT 라벨
                    </button>
                  ) : <div />}
                </div>
              )}
            </div>

            {/* 재고 배치 폼 (인정재고만) */}
            <form onSubmit={handleAssignToPallet} className="bg-slate-100 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-blue-600" /> {activeCellCode} 랙에 LOT 인정재고 배치
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">파레트 위치</label>
                  <select
                    value={targetSlotNo}
                    onChange={e => setTargetSlotNo(Number(e.target.value) as 1 | 2)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold bg-white"
                  >
                    <option value={2}>P2 슬롯 (왼쪽)</option>
                    <option value={1}>P1 슬롯 (오른쪽)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-blue-700 mb-1">📦 보유 재고에서 선택</label>
                  <select
                    value={selectedLotId}
                    onChange={e => handleSelectAvailableLot(e.target.value)}
                    className="w-full border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-mono"
                  >
                    <option value="">-- 보유 LOT 목록 --</option>
                    {availableLots.map(l => (
                      <option key={l.lot_id} value={l.lot_id}>
                        {l.lot_number} ({l.item_name}) - {l.remaining_qty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">LOT 번호</label>
                  <input type="text" value={inputLotNo} onChange={e => setInputLotNo(e.target.value)}
                    placeholder="LOT 입력" className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono bg-white" required />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">품목명</label>
                  <input type="text" value={inputItemName} onChange={e => setInputItemName(e.target.value)}
                    placeholder="품목명" className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white" required />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-600 mb-1">수량</label>
                  <input type="number" value={inputQty} onChange={e => setInputQty(Number(e.target.value))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold bg-white" required />
                </div>
              </div>

              <button type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow">
                {activeCellCode} 랙 [P{targetSlotNo} 파레트] 배치
              </button>
              </form>
            </div>
          )}
        </div>
      </div>
    )}

      {/* 재고 등록 모달 */}
      {inventoryModalOpen && (
        <WmsInventoryModal
          onClose={() => setInventoryModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {/* 출고 처리 모달 */}
      {outModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-600 text-white rounded-lg">
                  <LogOut className="h-4 w-4" />
                </span>
                <h2 className="font-black text-slate-800 text-base">출고 처리</h2>
              </div>
              <button onClick={() => { setOutModalOpen(false); setOutSearchResult(null); setOutSearchQuery(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleOutSubmit} className="p-5 space-y-4">
              {/* LOT 검색 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LOT번호 또는 바코드 입력</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outSearchQuery}
                    onChange={e => setOutSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleOutSearch())}
                    placeholder="LOT 번호 또는 바코드"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleOutSearch}
                    disabled={outSearching}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-60"
                  >
                    {outSearching ? '검색 중…' : <Search className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 검색 결과 */}
              {outSearchResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-slate-800">{outSearchResult.item_name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">LOT: {outSearchResult.lot_number}</p>
                  <p className="text-[10px] text-slate-500">현재위치: {outSearchResult.location || '-'}</p>
                  <p className="text-[10px] text-emerald-700 font-black">재고: {Number(outSearchResult.remaining_qty ?? outSearchResult.qty_current ?? 0).toLocaleString()} EA</p>
                </div>
              )}

              {/* 출고 수량 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">출고 수량</label>
                <input
                  type="number"
                  min={1}
                  value={outQty}
                  onChange={e => setOutQty(Number(e.target.value))}
                  disabled={!outSearchResult}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold bg-white disabled:bg-slate-100"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setOutModalOpen(false); setOutSearchResult(null); setOutSearchQuery(''); }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!outSearchResult || outProcessing}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow transition-all disabled:opacity-60"
                >
                  {outProcessing ? '처리 중…' : '출고 확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 렉 이동 모달 */}
      <RackTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={loadData}
        initialFromLocation={selectedLocation}
      />

      {/* 파레트 위치 라벨 선택 모달 */}
      {bulkPrintOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* 헤더 */}
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-blue-600" />
                  파레트 위치 라벨 선택 인쇄
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">인쇄할 라벨을 클릭으로 선택 — 선택: <b className="text-blue-700">{selectedBulkLocs.size}개</b> / 웉수: <b className="text-blue-700">{bulkCopies}매</b> = 총 <b className="text-emerald-700">{selectedBulkLocs.size * bulkCopies}장</b></p>
              </div>
              <button onClick={() => setBulkPrintOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* 콘텐츠 스크롤 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* 1구역 (A~O) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-slate-800">🏢 1구역 랙 A~O · 45셀 × 2 = <span className="text-blue-700">90 파레트</span></h3>
                  <button
                    onClick={() => { const s = new Set(selectedBulkLocs); [...ZONE_1_COLS].forEach(c => RACK_TIERS.forEach(t => { s.add(`${c}${t}-P1`); s.add(`${c}${t}-P2`); })); setSelectedBulkLocs(s); }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >존 전체 선택</button>
                </div>
                <div className="grid gap-1.5" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))'}}>
                  {[...ZONE_1_COLS].flatMap(col =>
                    RACK_TIERS.flatMap(tier =>
                      (['P1','P2'] as const).map(p => {
                        const loc = `${col}${tier}-${p}`;
                        const sel = selectedBulkLocs.has(loc);
                        return (
                          <button key={loc} onClick={() => toggleBulkLoc(loc)}
                            className={`text-[11px] font-mono font-bold py-1.5 px-1 rounded-lg border-2 transition-all select-none ${sel ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                            {loc}
                          </button>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* 2구역 (P~R) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-slate-800">🏬 2구역 랙 P~R · 9셀 × 2 = <span className="text-indigo-700">18 파레트</span></h3>
                  <button
                    onClick={() => { const s = new Set(selectedBulkLocs); [...ZONE_2_COLS].forEach(c => RACK_TIERS.forEach(t => { s.add(`${c}${t}-P1`); s.add(`${c}${t}-P2`); })); setSelectedBulkLocs(s); }}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >존 전체 선택</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...ZONE_2_COLS].flatMap(col =>
                    RACK_TIERS.flatMap(tier =>
                      (['P1','P2'] as const).map(p => {
                        const loc = `${col}${tier}-${p}`;
                        const sel = selectedBulkLocs.has(loc);
                        return (
                          <button key={loc} onClick={() => toggleBulkLoc(loc)}
                            className={`text-[11px] font-mono font-bold py-1.5 px-2 rounded-lg border-2 transition-all select-none ${sel ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                            {loc}
                          </button>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* 3구역 FIELD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-slate-800">🏭 3구역 공장 필드 <span className="text-emerald-700">8 구역</span></h3>
                  <button
                    onClick={() => { const s = new Set(selectedBulkLocs); FIELD_ZONES.forEach(z => s.add(z.code)); setSelectedBulkLocs(s); }}
                    className="text-xs text-emerald-600 font-bold hover:underline"
                  >구역 전체 선택</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FIELD_ZONES.map(z => {
                    const sel = selectedBulkLocs.has(z.code);
                    return (
                      <button key={z.code} onClick={() => toggleBulkLoc(z.code)}
                        className={`text-xs font-bold py-2 px-3 rounded-xl border-2 transition-all flex items-center gap-1.5 select-none ${sel ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                        <span>{z.emoji}</span><span>{z.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 푸터 툴링 */}
            <div className="p-4 border-t bg-slate-50 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={selectAllBulk} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100">전체 선택 (람108+필드8)</button>
                <button onClick={() => setSelectedBulkLocs(new Set())} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100">전체 해제</button>
                <div className="flex items-center gap-2 ml-1">
                  <label className="text-xs font-bold text-slate-700">인쇄 매수:</label>
                  <input
                    type="number" min={1} max={10} value={bulkCopies}
                    onChange={e => setBulkCopies(Math.max(1, Math.min(10, Number(e.target.value))))}
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-center"
                  />
                  <span className="text-xs text-slate-500">매 × {selectedBulkLocs.size}개 = 총 <b className="text-blue-700">{selectedBulkLocs.size * bulkCopies}장</b></span>
                </div>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setBulkPrintOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-100">취소</button>
                  <button
                    onClick={handleBulkPrintQz}
                    disabled={selectedBulkLocs.size === 0}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow"
                  >
                    <Printer className="h-4 w-4" />
                    고덱스 QZ Tray ({selectedBulkLocs.size * bulkCopies}장)
                  </button>
                  <button
                    onClick={handleBulkPrint}
                    disabled={selectedBulkLocs.size === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow"
                  >
                    <Printer className="h-4 w-4" />
                    브라우저 인쇄 ({selectedBulkLocs.size * bulkCopies}장)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 미리보기 모달 */}
      <PrintPreviewModal
        isOpen={!!previewHtml}
        onClose={() => setPreviewHtml('')}
        htmlContent={previewHtml}
      />
    </div>
  );
}

export default LocationManagementPage;
