import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Package, Search, RefreshCw, Printer, Plus, Trash2,
  ArrowDownCircle, ArrowUpCircle, MoveRight, Settings2,
  Download, BarChart3, List, BookOpen, Edit3, ShieldCheck, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface MaterialLot {
  lot_id: number;
  lot_number: string;
  category: string;
  item_name: string;
  density?: number;
  thickness?: number;
  width_mm?: number;
  length_mm?: number;
  unit: string;
  qty_current: number;
  location?: string;
  today_in?: number;
  today_out?: number;
  received_date?: string;
  supplier_name?: string;
  notes?: string;
}

interface Transaction {
  txn_id: number;
  txn_date: string;
  lot_id: number;
  lot_number: string;
  txn_type: 'IN' | 'OUT' | 'MOVE' | 'ADJ';
  qty: number;
  qty_before: number;
  qty_after: number;
  location_from?: string;
  location_to?: string;
  project_name?: string;
  source_type?: string;
  notes?: string;
  item_name?: string;
}

interface LedgerRow {
  txn_date: string;
  lot_id: number;
  lot_number: string;
  category: string;
  item_name: string;
  unit: string;
  location?: string;
  qty_current: number;
  qty_in: number;
  qty_out: number;
  qty_adj: number;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['원자재(배합원료)', '세라믹울', '그라스울', '그라스울보드', '차열재/차열시트', '소켓', '강판', '반제품(조립소켓/틈새시트/플래싱)', '기타부자재'];

const TXN_LABEL: Record<string, { text: string; color: string; emoji: string }> = {
  IN:   { text: '입고',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', emoji: '📥' },
  OUT:  { text: '출고',     color: 'text-red-700 bg-red-50 border-red-200',             emoji: '📤' },
  MOVE: { text: '위치이동', color: 'text-amber-700 bg-amber-50 border-amber-200',       emoji: '🚚' },
  ADJ:  { text: '재고조정', color: 'text-indigo-700 bg-indigo-50 border-indigo-200',    emoji: '⚙️' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function fmtDate(s?: string) { return s ? s.slice(0, 10) : '-'; }
function fmtSpec(l: { density?: number; thickness?: number; width_mm?: number; length_mm?: number; item_spec?: string; item_name?: string }) {
  if (l.item_spec && l.item_spec.trim()) return l.item_spec.trim();
  const nums = [
    l.density && `${Number(l.density)}K`,
    l.thickness && `${Number(l.thickness)}T`,
    l.width_mm && `${Number(l.width_mm)}W`,
    l.length_mm && `${Number(l.length_mm)}L`
  ].filter(Boolean).join(' ');

  if (nums) return nums;

  // item_name에서 규격 문자열 (128K, 25T, 400W, 7400L 등) 추출
  if (l.item_name) {
    const match = l.item_name.match(/(\d+K|\d+T|\d+W|\d+L|\d+\*\d+|\d+mm|\d+kg)/gi);
    if (match && match.length > 0) return match.join(' ');
  }

  return '-';
}
function fmtLoc(loc?: string) {
  if (!loc) return '-';
  const m = loc.match(/^([A-Z]+\d+)-P(\d)$/);
  return m ? `${m[1]}-P${m[2]}(${m[2] === '1' ? '우' : '좌'})` : loc;
}

import { generateStandardLotLabelHtml, generateSerializedLotLabelBatchHtml, generateQrDataUrl, generateCode128Svg } from '@/lib/barcodeGenerator';

// ─── LOT 라벨 인쇄 모달 ───────────────────────────────────────────────────────
function LabelModal({ lot, onClose }: { lot: MaterialLot; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string>('');
  const totalQty = Math.max(1, Math.round(Number(lot.qty_current || 1)));
  const [printCount, setPrintCount] = useState<number>(totalQty);

  useEffect(() => {
    generateQrDataUrl(lot.lot_number, 200).then(setQrUrl);
  }, [lot.lot_number]);

  const doPrint = async () => {
    const count = Math.max(1, printCount);
    
    const labelHtml = await generateSerializedLotLabelBatchHtml(
      lot.lot_number,
      lot.item_name,
      fmtSpec(lot),
      lot.location || '-',
      totalQty,
      lot.unit,
      fmtDate(lot.received_date),
      count
    );

    const w = window.open('', '_blank', 'width=500,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>라벨 출력 (${count}매)</title>
<style>
@page{size:80mm 60mm;margin:0}
html,body{width:80mm;height:60mm;margin:0;padding:0;background:#fff;font-family:'Malgun Gothic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden;}
.label-card{width:75mm;height:55mm;margin:1.5mm auto;padding:1.8mm 2.2mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;border:0.3mm solid #94a3b8;overflow:hidden;page-break-after:always;page-break-inside:avoid;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:0.4mm solid #1a237e;padding-bottom:0.4mm;font-size:7.5pt;font-weight:bold;}
.company{color:#c00;}.title{color:#1a237e;}.date{color:#666;font-size:6.5pt;}
.body-row{display:flex;gap:2.5mm;align-items:center;flex:1;margin-top:0.8mm;margin-bottom:0.8mm;overflow:hidden;}
.qr-box .qr-img{width:18mm;height:18mm;border:0.2mm solid #cbd5e1;flex-shrink:0;}
.info-box{flex:1;overflow:hidden;}
.lot-number{font-size:9pt;font-weight:900;font-family:monospace;color:#1d4ed8;letter-spacing:-0.2px;white-space:nowrap;}
.field{font-size:6.5pt;margin-top:0.2mm;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.field .lbl{color:#64748b;}
.field .val{font-weight:bold;color:#0f172a;}
.item-val{color:#0f172a;}
.loc-val{color:#065f46;}
.qty-bar{background:#f8fafc;border:0.2mm solid #cbd5e1;padding:0.6mm 1.2mm;font-size:7.5pt;margin-top:0.4mm;display:flex;justify-content:space-between;align-items:center;}
.barcode-box{text-align:center;border-top:0.2mm dashed #cbd5e1;padding-top:0.6mm;margin-top:0.4mm;}
.barcode-box svg{width:52mm;height:8mm;margin:0 auto;display:block;}
.barcode-text{font-size:6pt;font-family:monospace;color:#475569;letter-spacing:0.8px;margin-top:0.2mm;}
</style></head><body>${labelHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-84 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Printer className="h-4 w-4 text-blue-600"/>LOT 라벨 발행 (순번 1/N~N/N)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
        </div>
        {/* 라벨 실물 미리보기 (80×60mm 비율) */}
        <div className="border-2 border-slate-800 rounded-lg p-3 bg-white flex flex-col justify-between shadow-sm space-y-2">
          <div className="flex justify-between items-center border-b pb-1 text-[9px]">
            <span className="font-bold text-rose-600">(주)이지원</span>
            <span className="font-bold text-indigo-900 font-extrabold">
              {lot.stock_type === 'CERTIFIED_AUDIT' ? '🛡️ 인정시험용 LOT' : '🏷️ 원부자재 LOT'}
            </span>
            <span className="bg-blue-900 text-white font-bold text-[8px] px-1.5 py-0.5 rounded">1/{printCount}</span>
          </div>
          <div className="flex gap-2 text-[9px] items-center">
            {qrUrl ? (
              <img src={qrUrl} alt="QR" className="h-16 w-16 aspect-square border border-slate-200 p-0.5 rounded flex-shrink-0"/>
            ) : (
              <div className="h-16 w-16 bg-slate-100 animate-pulse rounded"/>
            )}
            <div className="flex-1 space-y-0.5 overflow-hidden">
              <p className="font-black text-[10px] text-indigo-700 font-mono tracking-tight">{lot.lot_number}</p>
              <p className="font-bold text-slate-900 truncate">{lot.item_name}</p>
              <p className="text-red-700 font-bold text-[8.5px] truncate">규격: {fmtSpec(lot)}</p>
              <p className="text-emerald-700 text-[8px] font-semibold">위치: {lot.location || '-'}</p>
              <p className="font-bold text-slate-800 text-[9px]">총 수량: {Number(lot.qty_current).toLocaleString()} {lot.unit}</p>
            </div>
          </div>
          <div className="border-t border-dashed border-slate-300 pt-1 text-center">
            <div dangerouslySetInnerHTML={{ __html: generateCode128Svg(lot.lot_number, 24) }} />
            <div className="font-mono text-[8px] text-slate-500 font-bold tracking-wider mt-0.5">{lot.lot_number}</div>
          </div>
        </div>

        {/* 인쇄 매수 및 1/N 순번 설정 컨트롤 */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-700">라벨 출력 매수 (순번 1/{printCount}):</label>
            <button
              type="button"
              onClick={() => setPrintCount(Math.max(1, Number(lot.qty_current || 1)))}
              className="text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200"
            >
              총 수량({lot.qty_current}개) 매수 자동 적용
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1000}
              value={printCount}
              onChange={e => setPrintCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="flex-1 px-3 py-1.5 border rounded-md text-sm font-bold font-mono text-center focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-slate-600">장 (1/{printCount} ~ {printCount}/{printCount})</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={doPrint} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow transition">
            <Printer className="h-4 w-4"/> 라벨 {printCount}장 순번 출력 (1/{printCount}~{printCount}/{printCount})
          </button>
          
          <button
            type="button"
            onClick={() => {
              const headers = ['LOT_NUMBER', 'ITEM_NAME', 'SPEC', 'QTY', 'UNIT', 'LOCATION', 'STOCK_TYPE'];
              const row = [
                `"${lot.lot_number}"`,
                `"${lot.item_name}"`,
                `"${fmtSpec(lot)}"`,
                `"${lot.qty_current}"`,
                `"${lot.unit}"`,
                `"${lot.location || '-'}"`,
                `"${lot.stock_type === 'CERTIFIED_AUDIT' ? '인정시험용' : '비인정용'}"`
              ];
              const csvContent = '\uFEFF' + headers.join(',') + '\n' + row.join(',');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `GoLabel_${lot.lot_number}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('📥 GoLabel 소프트웨어 연동용 CSV 파일이 다운로드되었습니다.');
            }}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-slate-300 transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600"/> GoLabel 소프트웨어 연동용 CSV 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

function matchesCategory(lotCategory: string | undefined, filterCat: string, itemName?: string, lotNumber?: string): boolean {
  if (!filterCat || filterCat === '전체') return true;
  const c = (lotCategory || '').trim().toLowerCase();
  const f = filterCat.trim().toLowerCase();
  const n = (itemName || '').trim().toLowerCase();
  const l = (lotNumber || '').trim().toLowerCase();

  if (f.includes('ep-100') || f.includes('ep100')) {
    return n.includes('ep100') || n.includes('ep-100') || l.includes('ep') || c.includes('ep');
  }
  if (f.includes('흑연')) {
    return n.includes('흑연') || n.includes('graphite') || l.includes('gr');
  }
  if (f.includes('ea-33045') || f.includes('ea33045')) {
    return n.includes('ea33045') || n.includes('ea-33045') || l.includes('ea');
  }
  if (f.includes('난연컴파운드') || f.includes('컴파운드')) {
    return n.includes('컴파운드') || n.includes('mb') || l.includes('mb') || c.includes('컴파운드');
  }
  if (f.includes('세라믹울')) {
    return c.includes('세라믹울') || n.includes('세라믹울') || l.includes('cw');
  }
  if (f.includes('그라스울보드')) {
    return c.includes('그라스울보드') || n.includes('보드') || l.includes('gwb');
  }
  if (f.includes('그라스울')) {
    return (c === '그라스울' || n.includes('그라스울') || l.includes('gw')) && !c.includes('보드') && !n.includes('보드');
  }

  if (c === f || c.includes(f) || f.includes(c)) return true;
  return false;
}

// ─── 탭1: 전체 LOT 재고현황 ──────────────────────────────────────────────────
function Tab1Stock({ lots, loading, onRefresh }: { lots: MaterialLot[]; loading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('전체');
  const [stockTypeTab, setStockTypeTab] = useState<'ALL' | 'CERTIFIED' | 'CERTIFIED_AUDIT' | 'NON_CERTIFIED'>('ALL');
  const [includeZero, setIncludeZero] = useState(true);
  const [printLot, setPrintLot] = useState<MaterialLot | null>(null);

  // URL Query param ?stock_type=... 자동 인식
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = params.get('stock_type');
    if (st === 'CERTIFIED_AUDIT') setStockTypeTab('CERTIFIED_AUDIT');
    else if (st === 'CERTIFIED') setStockTypeTab('CERTIFIED');
    else if (st === 'NON_CERTIFIED') setStockTypeTab('NON_CERTIFIED');
  }, []);

  const filtered = lots.filter(l => {
    if (stockTypeTab === 'CERTIFIED_AUDIT' && l.stock_type !== 'CERTIFIED_AUDIT') return false;
    if (stockTypeTab === 'CERTIFIED' && (l.stock_type === 'CERTIFIED_AUDIT' || l.stock_type === 'NON_CERTIFIED')) return false;
    if (stockTypeTab === 'NON_CERTIFIED' && l.stock_type !== 'NON_CERTIFIED') return false;
    if (!matchesCategory(l.category, cat, l.item_name, l.lot_number)) return false;
    if (!includeZero && Number(l.qty_current || 0) <= 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const specText = fmtSpec(l).toLowerCase();
      if (!l.lot_number.toLowerCase().includes(q) &&
          !l.item_name.toLowerCase().includes(q) &&
          !specText.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const auditLots = lots.filter(l => l.stock_type === 'CERTIFIED_AUDIT' && Number(l.qty_current || 0) > 0);
  const certLots = lots.filter(l => l.stock_type !== 'CERTIFIED_AUDIT' && l.stock_type !== 'NON_CERTIFIED' && Number(l.qty_current || 0) > 0);
  const nonCertLots = lots.filter(l => l.stock_type === 'NON_CERTIFIED' && Number(l.qty_current || 0) > 0);

  const auditTotalQty = auditLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const certTotalQty = certLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const nonCertTotalQty = nonCertLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);

  // 배합원료 4종 & 단열재 3종 상세 집계
  const epLots = lots.filter(l => matchesCategory(l.category, 'EP-100', l.item_name, l.lot_number));
  const grLots = lots.filter(l => matchesCategory(l.category, '흑연', l.item_name, l.lot_number));
  const eaLots = lots.filter(l => matchesCategory(l.category, 'EA-33045', l.item_name, l.lot_number));
  const mbLots = lots.filter(l => matchesCategory(l.category, '난연컴파운드', l.item_name, l.lot_number));

  const cwLots = lots.filter(l => matchesCategory(l.category, '세라믹울', l.item_name, l.lot_number));
  const gwLots = lots.filter(l => matchesCategory(l.category, '그라스울', l.item_name, l.lot_number));
  const gwbLots = lots.filter(l => matchesCategory(l.category, '그라스울보드', l.item_name, l.lot_number));

  const epQty = epLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const grQty = grLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const eaQty = eaLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const mbQty = mbLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);

  const cwQty = cwLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const gwQty = gwLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);
  const gwbQty = gwbLots.reduce((a, b) => a + Number(b.qty_current || 0), 0);

  return (
    <div className="space-y-4">
      {/* 🛡️/🏭 재고 분류 선택 상단 대형 탭 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <button
          onClick={() => setStockTypeTab('ALL')}
          className={cn(
            'p-3 rounded-2xl border text-left transition flex items-center justify-between shadow-sm',
            stockTypeTab === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn('p-2 rounded-xl', stockTypeTab === 'ALL' ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-700')}>
              <Package className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold opacity-80">통합 재고 전체</p>
              <p className="text-base font-black">{lots.length}개 LOT</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStockTypeTab('CERTIFIED_AUDIT')}
          className={cn(
            'p-3 rounded-2xl border text-left transition flex items-center justify-between shadow-sm',
            stockTypeTab === 'CERTIFIED_AUDIT'
              ? 'bg-indigo-900 text-white border-indigo-700 ring-2 ring-indigo-500'
              : 'bg-indigo-50/50 text-indigo-950 border-indigo-200 hover:bg-indigo-100/60'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold text-indigo-300">🛡️ 인정시험용 (공정심사)</p>
              <p className="text-base font-black text-white">{auditLots.length}개 LOT</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStockTypeTab('CERTIFIED')}
          className={cn(
            'p-3 rounded-2xl border text-left transition flex items-center justify-between shadow-sm',
            stockTypeTab === 'CERTIFIED'
              ? 'bg-emerald-900 text-white border-emerald-700 ring-2 ring-emerald-500'
              : 'bg-emerald-50/40 text-emerald-950 border-emerald-200 hover:bg-emerald-100/60'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold text-emerald-300">🏭 인정용 (양산/출하용)</p>
              <p className="text-base font-black text-white">{certLots.length}개 LOT</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStockTypeTab('NON_CERTIFIED')}
          className={cn(
            'p-3 rounded-2xl border text-left transition flex items-center justify-between shadow-sm',
            stockTypeTab === 'NON_CERTIFIED'
              ? 'bg-rose-900 text-white border-rose-700 ring-2 ring-rose-500'
              : 'bg-rose-50/40 text-rose-950 border-rose-200 hover:bg-rose-100/60'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold text-rose-300">❌ 비인정용 (현재 미등록)</p>
              <p className="text-base font-black text-white">{nonCertLots.length}개 LOT</p>
            </div>
          </div>
        </button>
      </div>

      {/* 🧪🔥🌾🧱 배합원료 4종 (EP-100, 흑연, EA-33045, 난연컴파운드) & 단열재 3종 실시간 재고 카드 */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">배합원료 4종 &amp; 단열재 실시간 재고 나열</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">클릭 시 해당 품목 즉시 필터링</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* 1. EP-100 */}
          <button
            onClick={() => setCat('EP-100')}
            className={cn(
              'p-3 rounded-xl border text-left transition flex items-center justify-between shadow-sm',
              cat === 'EP-100' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800/90 hover:bg-slate-800 text-white border-slate-700'
            )}
          >
            <div>
              <p className="text-[11px] font-extrabold opacity-90">🧪 1. EP-100 (바인더)</p>
              <p className="text-base font-black mt-0.5">{epLots.length}개 LOT</p>
            </div>
            <span className="text-xs font-mono font-bold">{epQty.toLocaleString()} kg</span>
          </button>

          {/* 2. 흑연 */}
          <button
            onClick={() => setCat('흑연')}
            className={cn(
              'p-3 rounded-xl border text-left transition flex items-center justify-between shadow-sm',
              cat === '흑연' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800/90 hover:bg-slate-800 text-white border-slate-700'
            )}
          >
            <div>
              <p className="text-[11px] font-extrabold opacity-90">⬛ 2. 팽창흑연 (흑연)</p>
              <p className="text-base font-black mt-0.5">{grLots.length}개 LOT</p>
            </div>
            <span className="text-xs font-mono font-bold">{grQty.toLocaleString()} kg</span>
          </button>

          {/* 3. EA-33045 */}
          <button
            onClick={() => setCat('EA-33045')}
            className={cn(
              'p-3 rounded-xl border text-left transition flex items-center justify-between shadow-sm',
              cat === 'EA-33045' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800/90 hover:bg-slate-800 text-white border-slate-700'
            )}
          >
            <div>
              <p className="text-[11px] font-extrabold opacity-90">🧪 3. EA-33045 (첨가제)</p>
              <p className="text-base font-black mt-0.5">{eaLots.length}개 LOT</p>
            </div>
            <span className="text-xs font-mono font-bold">{eaQty.toLocaleString()} kg</span>
          </button>

          {/* 4. 난연컴파운드(MB) */}
          <button
            onClick={() => setCat('난연컴파운드')}
            className={cn(
              'p-3 rounded-xl border text-left transition flex items-center justify-between shadow-sm',
              cat === '난연컴파운드' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800/90 hover:bg-slate-800 text-white border-slate-700'
            )}
          >
            <div>
              <p className="text-[11px] font-extrabold opacity-90">🔥 4. 난연컴파운드 (MB)</p>
              <p className="text-base font-black mt-0.5">{mbLots.length}개 LOT</p>
            </div>
            <span className="text-xs font-mono font-bold">{mbQty.toLocaleString()} kg</span>
          </button>
        </div>

        {/* 단열재 3종 서브 그리드 */}
        <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/80">
          <button
            onClick={() => setCat('세라믹울')}
            className={cn(
              'p-2.5 rounded-lg border text-left transition flex items-center justify-between',
              cat === '세라믹울' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750'
            )}
          >
            <span className="text-[11px] font-bold">🔥 세라믹울: {cwLots.length}개</span>
            <span className="text-xs font-mono font-extrabold">{cwQty.toLocaleString()} 롤</span>
          </button>

          <button
            onClick={() => setCat('그라스울')}
            className={cn(
              'p-2.5 rounded-lg border text-left transition flex items-center justify-between',
              cat === '그라스울' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750'
            )}
          >
            <span className="text-[11px] font-bold">🌾 그라스울: {gwLots.length}개</span>
            <span className="text-xs font-mono font-extrabold">{gwQty.toLocaleString()} 롤</span>
          </button>

          <button
            onClick={() => setCat('그라스울보드')}
            className={cn(
              'p-2.5 rounded-lg border text-left transition flex items-center justify-between',
              cat === '그라스울보드' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750'
            )}
          >
            <span className="text-[11px] font-bold">🧱 그라스울보드: {gwbLots.length}개</span>
            <span className="text-xs font-mono font-extrabold">{gwbQty.toLocaleString()} 매</span>
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="LOT번호 / 품목명 검색"
            className="pl-9 pr-3 py-2 text-sm border rounded-lg focus:border-blue-500 outline-none w-52"/>
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {['전체', 'EP-100', '흑연', 'EA-33045', '난연컴파운드', '세라믹울', '그라스울', '그라스울보드', '차열재/차열시트', '소켓', '강판', '반제품(조립소켓/플래싱)', '기타부자재'].map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors',
                cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {c}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 ml-2 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-lg hover:bg-slate-200">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={e => setIncludeZero(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          수량 0인 LOT 포함
        </label>

        <button onClick={onRefresh} className="ml-auto flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-semibold">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')}/> 새로고침
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white text-xs">
              <tr>
                {['재고구분', 'LOT번호', '품목명', '분류', '규격', '단위', '위치', '현재고', '금일입고', '금일출고', '입고일', '라벨'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={12} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-300"/>
                    <span>로딩 중...</span>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-16 text-slate-400">조회된 LOT가 없습니다.</td></tr>
              ) : filtered.map(lot => (
                <tr key={lot.lot_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    {lot.stock_type === 'CERTIFIED_AUDIT' ? (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded text-[10px] font-black flex items-center gap-1 w-fit">
                        <ShieldCheck className="w-3 h-3 text-indigo-600" />
                        인정시험용
                      </span>
                    ) : lot.stock_type === 'NON_CERTIFIED' ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                        <Building2 className="w-3 h-3 text-rose-600" />
                        비인정용
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                        <Building2 className="w-3 h-3 text-emerald-600" />
                        인정용
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">{lot.lot_number}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{lot.item_name}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">{lot.category}</span></td>
                  <td className="px-3 py-2 text-xs font-mono font-bold text-red-700 whitespace-nowrap bg-red-50/30">{fmtSpec(lot)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{lot.unit}</td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono font-bold">{fmtLoc(lot.location)}</span></td>
                  <td className="px-3 py-2 text-right font-black text-slate-900">{Number(lot.qty_current || 0).toLocaleString()}</td>
                  <td className={cn('px-3 py-2 text-right font-bold', Number(lot.today_in || 0) > 0 ? 'text-emerald-600' : 'text-slate-300')}>
                    {Number(lot.today_in || 0) > 0 ? `+${Number(lot.today_in).toLocaleString()}` : '-'}
                  </td>
                  <td className={cn('px-3 py-2 text-right font-bold', Number(lot.today_out || 0) > 0 ? 'text-red-600' : 'text-slate-300')}>
                    {Number(lot.today_out || 0) > 0 ? `-${Number(lot.today_out).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{fmtDate(lot.received_date)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setPrintLot(lot)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="라벨 인쇄">
                      <Printer className="h-3.5 w-3.5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold">
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-slate-600">합계 ({filtered.length}개 LOT)</td>
                  <td className="px-3 py-2 text-right text-slate-900">{filtered.reduce((a,l)=>a+Number(l.qty_current||0),0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">+{filtered.reduce((a,l)=>a+Number(l.today_in||0),0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-red-600">-{filtered.reduce((a,l)=>a+Number(l.today_out||0),0).toLocaleString()}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {printLot && <LabelModal lot={printLot} onClose={() => setPrintLot(null)}/>}
    </div>
  );
}

// ─── 탭2: 수불대장 (기간별) ──────────────────────────────────────────────────
function Tab2Ledger() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [catFilter, setCatFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (catFilter) params.set('category', catFilter);
      if (lotFilter) params.set('lot_number', lotFilter);
      const res = await api.get<{ data: LedgerRow[] }>(`/material-ledger?${params}`);
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      toast.error('수불대장 조회 실패');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, catFilter, lotFilter]);

  useEffect(() => { doFetch(); }, []);

  const doExport = () => {
    const hdr = '날짜,LOT번호,품목,분류,단위,위치,당일입고,당일출고,당일조정,현재고';
    const body = rows.map(r =>
      [r.txn_date, r.lot_number, r.item_name, r.category, r.unit, r.location||'',
       r.qty_in, r.qty_out, r.qty_adj, r.qty_current].join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF'+hdr+'\n'+body], { type:'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `수불대장_${dateFrom}_${dateTo}.csv` });
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div><label className="block text-xs font-bold text-slate-600 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">분류</label>
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">전체</option>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">LOT 검색</label>
          <input value={lotFilter} onChange={e=>setLotFilter(e.target.value)} placeholder="LOT번호 일부"
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 w-36"/></div>
        <button onClick={doFetch} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center gap-2">
          <Search className="h-4 w-4"/> 조회
        </button>
        <button onClick={doExport} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2">
          <Download className="h-4 w-4"/> CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs">
              <tr>
                {['날짜','LOT번호','품목명','분류','단위','위치','당일입고(+)','당일출고(-)','재고조정','현재고'].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center gap-2"><RefreshCw className="h-6 w-6 animate-spin text-slate-300"/><span>조회 중...</span></div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-slate-400">해당 기간에 수불 내역이 없습니다.</td></tr>
              ) : rows.map((r,i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">{r.txn_date}</td>
                  <td className="px-3 py-2 text-xs font-mono font-bold text-blue-700">{r.lot_number}</td>
                  <td className="px-3 py-2 text-slate-800">{r.item_name}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold">{r.category}</span></td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.unit}</td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500">{fmtLoc(r.location)}</td>
                  <td className={cn('px-3 py-2 text-right font-bold', Number(r.qty_in)>0 ? 'text-emerald-600' : 'text-slate-300')}>{Number(r.qty_in)>0 ? `+${r.qty_in}` : '-'}</td>
                  <td className={cn('px-3 py-2 text-right font-bold', Number(r.qty_out)>0 ? 'text-red-600' : 'text-slate-300')}>{Number(r.qty_out)>0 ? `-${r.qty_out}` : '-'}</td>
                  <td className={cn('px-3 py-2 text-right font-bold', Number(r.qty_adj)!==0 ? 'text-indigo-600' : 'text-slate-300')}>{Number(r.qty_adj)!==0 ? r.qty_adj : '-'}</td>
                  <td className="px-3 py-2 text-right font-black text-slate-900">{Number(r.qty_current).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 탭3: 수불 이력 조회 ─────────────────────────────────────────────────────
function Tab3History({ isManager }: { isManager: boolean }) {
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [txnType, setTxnType] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: '500' });
      if (txnType) params.set('txn_type', txnType);
      if (search)  params.set('search', search);
      const res = await api.get<{ data: Transaction[] }>(`/material-transactions?${params}`);
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      toast.error('이력 조회 실패');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, txnType, search]);

  useEffect(() => { doFetch(); }, []);

  const handleDelete = async (r: Transaction) => {
    if (!confirm(`수불 기록 #${r.txn_id} 삭제 시 재고가 원복됩니다.\n계속하시겠습니까?`)) return;
    try {
      await api.delete(`/material-transactions/${r.txn_id}`);
      toast.success('삭제 완료, 재고 원복됨');
      doFetch();
    } catch (e: any) {
      toast.error(e?.body?.message || '삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div><label className="block text-xs font-bold text-slate-600 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">거래유형</label>
          <select value={txnType} onChange={e=>setTxnType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">전체</option>
            <option value="IN">📥 입고</option>
            <option value="OUT">📤 출고</option>
            <option value="MOVE">🚚 위치이동</option>
            <option value="ADJ">⚙️ 재고조정</option>
          </select></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">LOT/품목 검색</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색어"
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 w-36"/></div>
        <button onClick={doFetch} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center gap-2">
          <Search className="h-4 w-4"/> 조회
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b text-xs text-slate-500 flex gap-2 items-center">
          <List className="h-3.5 w-3.5"/> {rows.length}건 조회됨
          {isManager && <span className="text-amber-600 font-bold">· 삭제 권한: 매니저 이상</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs">
              <tr>
                {['일시','구분','LOT번호','품목명','수량','이전→이후','위치From','위치To','현장/프로젝트','비고','삭제'].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center gap-2"><RefreshCw className="h-6 w-6 animate-spin text-slate-300"/><span>조회 중...</span></div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16 text-slate-400">해당 기간에 거래 내역이 없습니다.</td></tr>
              ) : rows.map(r => {
                const info = TXN_LABEL[r.txn_type] || TXN_LABEL.IN;
                return (
                  <tr key={r.txn_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtDate(r.txn_date)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-bold', info.color)}>
                        {info.emoji} {info.text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono font-bold text-blue-700">{r.lot_number}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{r.item_name || '-'}</td>
                    <td className={cn('px-3 py-2 text-right font-black', Number(r.qty)>0 ? 'text-emerald-600' : 'text-red-600')}>
                      {Number(r.qty)>0?'+':''}{Number(r.qty).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{Number(r.qty_before).toLocaleString()}→{Number(r.qty_after).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{r.location_from || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{r.location_to || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.project_name || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[100px] truncate">{r.notes || '-'}</td>
                    <td className="px-3 py-2">
                      {isManager && (
                        <button onClick={() => handleDelete(r)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="삭제(재고원복)">
                          <Trash2 className="h-3.5 w-3.5"/>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 탭4: 수동 수불 입력 ─────────────────────────────────────────────────────
function Tab4Manual({ lots, onSuccess }: { lots: MaterialLot[]; onSuccess: () => void }) {
  const [mode, setMode] = useState<'txn' | 'newlot'>('txn');

  // 거래 폼
  const [txnDate, setTxnDate] = useState(todayStr());
  const [lotSearch, setLotSearch] = useState('');
  const [selLotId, setSelLotId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [txnType, setTxnType] = useState<'IN'|'OUT'|'MOVE'|'ADJ'>('IN');
  const [qty, setQty] = useState('');
  const [adjTarget, setAdjTarget] = useState('');
  const [locationTo, setLocationTo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 신규 LOT 폼
  const [nl, setNl] = useState({ lot_number:'', category:'세라믹울', item_name:'', density:'', thickness:'', width_mm:'', length_mm:'', unit:'롤', qty_current:'', location:'', received_date:todayStr(), supplier_name:'', notes:'' });
  const [nlSub, setNlSub] = useState(false);

  const selLot = lots.find(l => l.lot_id === selLotId);
  const filteredLots = lots.filter(l =>
    lotSearch.length >= 1 && (
      l.lot_number.toLowerCase().includes(lotSearch.toLowerCase()) ||
      l.item_name.toLowerCase().includes(lotSearch.toLowerCase())
    )
  );

  const handleTxnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selLotId) { toast.error('LOT를 선택해주세요.'); return; }
    let finalQty = txnType === 'ADJ'
      ? Number(adjTarget) - Number(selLot?.qty_current || 0)
      : Number(qty);
    if (txnType !== 'MOVE' && txnType !== 'ADJ' && !qty) { toast.error('수량을 입력해주세요.'); return; }
    if (txnType === 'MOVE' && !locationTo) { toast.error('이동 후 위치를 입력해주세요.'); return; }
    if (txnType === 'ADJ' && !adjTarget) { toast.error('실재고 수량을 입력해주세요.'); return; }

    setSubmitting(true);
    try {
      await api.post('/material-transactions', {
        lot_id: selLotId,
        txn_type: txnType,
        qty: txnType === 'MOVE' ? Number(qty) || 0 : Math.abs(finalQty),
        txn_date: txnDate,
        location_to: locationTo || undefined,
        project_name: projectName || undefined,
        notes: notes || undefined,
        source_type: 'MANUAL',
      });
      toast.success(`✅ ${TXN_LABEL[txnType].text} 등록 완료`);
      setQty(''); setAdjTarget(''); setNotes(''); setLocationTo(''); setProjectName('');
      setSelLotId(null); setLotSearch('');
      onSuccess();
    } catch (e: any) {
      toast.error(e?.body?.message || '등록 실패');
    } finally { setSubmitting(false); }
  };

  const handleNewLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nl.lot_number || !nl.item_name) { toast.error('LOT번호와 품목명은 필수입니다.'); return; }
    setNlSub(true);
    try {
      await api.post('/material-lots', {
        ...nl,
        density:    nl.density    ? Number(nl.density)    : null,
        thickness:  nl.thickness  ? Number(nl.thickness)  : null,
        width_mm:   nl.width_mm   ? Number(nl.width_mm)   : null,
        length_mm:  nl.length_mm  ? Number(nl.length_mm)  : null,
        qty_current: nl.qty_current ? Number(nl.qty_current) : 0,
      });
      toast.success(`신규 LOT [${nl.lot_number}] 등록 완료!`);
      setNl({ lot_number:'', category:'세라믹울', item_name:'', density:'', thickness:'', width_mm:'', length_mm:'', unit:'롤', qty_current:'', location:'', received_date:todayStr(), supplier_name:'', notes:'' });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.body?.message || '등록 실패');
    } finally { setNlSub(false); }
  };

  const TX_BTN = (['IN','OUT','MOVE','ADJ'] as const).map(t => ({
    key: t,
    emoji: TXN_LABEL[t].emoji,
    label: TXN_LABEL[t].text,
    active: `${t==='IN'?'bg-emerald-600':t==='OUT'?'bg-red-600':t==='MOVE'?'bg-amber-500':'bg-indigo-600'} text-white shadow-lg`,
    idle: 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100',
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={()=>setMode('txn')} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors', mode==='txn' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
          <Edit3 className="h-4 w-4"/> 입출고 · 이동 · 조정
        </button>
        <button onClick={()=>setMode('newlot')} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors', mode==='newlot' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
          <Plus className="h-4 w-4"/> 신규 LOT 등록
        </button>
      </div>

      {mode === 'txn' && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Edit3 className="h-4 w-4 text-blue-600"/> 수동 수불 입력</h3>
          <form onSubmit={handleTxnSubmit} className="space-y-5">
            {/* 거래유형 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">거래 유형 *</label>
              <div className="grid grid-cols-4 gap-2">
                {TX_BTN.map(b => (
                  <button key={b.key} type="button" onClick={()=>setTxnType(b.key)}
                    className={cn('py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all', txnType===b.key ? b.active : b.idle)}>
                    <span className="text-xl">{b.emoji}</span><span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">거래일 *</label>
                <input type="date" value={txnDate} onChange={e=>setTxnDate(e.target.value)} required
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">LOT 검색 후 선택 *</label>
                <input value={lotSearch}
                  onChange={e=>{ setLotSearch(e.target.value); setSelLotId(null); setShowDropdown(true); }}
                  onFocus={()=>setShowDropdown(true)}
                  placeholder="LOT번호 또는 품목명 입력"
                  className={cn('w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500', selLotId ? 'border-emerald-400 bg-emerald-50' : '')}/>
                {showDropdown && filteredLots.length > 0 && !selLotId && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredLots.slice(0,15).map(l=>(
                      <button key={l.lot_id} type="button"
                        onClick={()=>{ setSelLotId(l.lot_id); setLotSearch(`${l.lot_number} | ${l.item_name}`); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0">
                        <span className="font-mono font-bold text-blue-700 text-xs">{l.lot_number}</span>
                        <span className="text-slate-500 text-xs ml-2">{l.item_name} · 현재고 {Number(l.qty_current).toLocaleString()}{l.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selLot && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 grid grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-blue-400 font-bold">품목</p><p className="font-bold text-blue-900">{selLot.item_name}</p></div>
                <div><p className="text-xs text-blue-400 font-bold">현재고</p><p className="text-xl font-black text-blue-900">{Number(selLot.qty_current).toLocaleString()} {selLot.unit}</p></div>
                <div><p className="text-xs text-blue-400 font-bold">위치</p><p className="font-bold text-blue-900">{fmtLoc(selLot.location)}</p></div>
                <div><p className="text-xs text-blue-400 font-bold">규격</p><p className="font-bold text-blue-900">{fmtSpec(selLot)}</p></div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {txnType === 'ADJ' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">실재고 수량 (직접 입력) *</label>
                  <input type="number" min="0" value={adjTarget} onChange={e=>setAdjTarget(e.target.value)} required
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 font-bold"/>
                  {selLot && adjTarget && (
                    <p className={cn('text-xs mt-1 font-bold', Number(adjTarget)>=Number(selLot.qty_current) ? 'text-emerald-600' : 'text-red-600')}>
                      조정량: {Number(adjTarget)-Number(selLot.qty_current)>=0?'+':''}{Number(adjTarget)-Number(selLot.qty_current)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">수량 *</label>
                  <input type="number" min="0" step="any" value={qty} onChange={e=>setQty(e.target.value)}
                    required={txnType !== 'MOVE'}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-bold"/>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {txnType==='MOVE' ? '이동 후 위치 *' : '배치 위치'}
                  <span className="ml-2 text-[10px] font-normal text-blue-500">📱 파레트 위치 라벨 스캔 or 직접 입력</span>
                </label>
                <div className="flex gap-1.5">
                  <input value={locationTo} onChange={e=>setLocationTo(e.target.value)}
                    onKeyDown={e => {
                      // 바코드 스캐너 Enter 자동 감지
                      if (e.key === 'Enter') { e.preventDefault(); }
                    }}
                    placeholder="📷 스캔 또는 A1-P1 형식 입력"
                    required={txnType==='MOVE'}
                    className="flex-1 border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500"/>
                  <select
                    value={locationTo}
                    onChange={e => setLocationTo(e.target.value)}
                    className="border rounded-lg px-2 py-2.5 text-xs font-mono outline-none focus:border-blue-500 bg-white max-w-[110px]">
                    <option value="">위치 선택</option>
                    {['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A','P','Q','R'].flatMap(col =>
                      [3,2,1].flatMap(tier =>
                        [1,2].map(p => {
                          const loc = `${col}${tier}-P${p}`;
                          return <option key={loc} value={loc}>{loc} {p===1?'(우)':'(좌)'}</option>;
                        })
                      )
                    )}
                  </select>
                </div>
                {locationTo && (
                  <p className="text-[11px] text-blue-600 font-bold mt-1">📍 선택된 위치: {locationTo} {locationTo.endsWith('-P1') ? '(오른쪽 파레트)' : locationTo.endsWith('-P2') ? '(왼쪽 파레트)' : ''}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{txnType==='OUT' ? '출하처/현장' : '비고'}</label>
                <input value={txnType==='OUT' ? projectName : notes}
                  onChange={e=>txnType==='OUT' ? setProjectName(e.target.value) : setNotes(e.target.value)}
                  placeholder={txnType==='OUT' ? '판교현장 등' : ''}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"/>
              </div>
            </div>

            <button type="submit" disabled={submitting || !selLotId}
              className={cn('w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50',
                txnType==='IN'?'bg-emerald-600 hover:bg-emerald-700':txnType==='OUT'?'bg-red-600 hover:bg-red-700':txnType==='MOVE'?'bg-amber-500 hover:bg-amber-600':'bg-indigo-600 hover:bg-indigo-700')}>
              {submitting ? '등록 중...' : `${TXN_LABEL[txnType].emoji} ${TXN_LABEL[txnType].text} 등록`}
            </button>
          </form>
        </div>
      )}

      {mode === 'newlot' && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-600"/> 신규 LOT 기초재고 등록</h3>
          <form onSubmit={handleNewLot} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">LOT 번호 *</label>
                <input value={nl.lot_number} onChange={e=>setNl(p=>({...p,lot_number:e.target.value}))} required placeholder="260722CW001"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-mono"/></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">품목명 *</label>
                <input value={nl.item_name} onChange={e=>setNl(p=>({...p,item_name:e.target.value}))} required placeholder="세라믹울 104K 25T"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"/></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">입고일 *</label>
                <input type="date" value={nl.received_date} onChange={e=>setNl(p=>({...p,received_date:e.target.value}))} required
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"/></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">분류 *</label>
                <select value={nl.category} onChange={e=>setNl(p=>({...p,category:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">단위</label>
                <select value={nl.unit} onChange={e=>setNl(p=>({...p,unit:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none">
                  {['롤','장','EA','kg','m'].map(u=><option key={u}>{u}</option>)}
                </select></div>
              {[{k:'qty_current',label:'기초수량',ph:'0'},{k:'location',label:'적재위치',ph:'A1-P1'},
                {k:'density',label:'밀도(K)',ph:'104'},{k:'thickness',label:'두께(T)',ph:'25'},
                {k:'width_mm',label:'폭(W)mm',ph:'200'},{k:'length_mm',label:'길이(L)mm',ph:'7400'},
                {k:'supplier_name',label:'공급업체',ph:''},{k:'notes',label:'비고',ph:''}
              ].map(f=>(
                <div key={f.k}><label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <input value={(nl as any)[f.k]} onChange={e=>setNl(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"/></div>
              ))}
            </div>
            <button type="submit" disabled={nlSub}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              <Plus className="h-4 w-4"/> {nlSub ? '등록 중...' : '신규 LOT 등록'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'stock',   icon: '📦', label: '전체 LOT 재고현황' },
  { id: 'ledger',  icon: '📑', label: '수불대장 (기간별)' },
  { id: 'history', icon: '📋', label: '수불 이력 조회' },
  { id: 'manual',  icon: '✏️', label: '수동 수불 입력' },
] as const;

export function MaterialStockPage() {
  const { user, isManager } = useAuth();
  const [tab, setTab] = useState<typeof TABS[number]['id']>('stock');
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: MaterialLot[] }>('/material-lots');
      setLots(res.data || []);
    } catch (e) {
      console.error('material-lots error:', e);
      toast.error('LOT 재고 조회 실패');
    } finally { setLoading(false); }
  }, []);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLotsWithTimestamp = useCallback(async () => {
    await loadLots();
    setLastUpdated(new Date());
  }, [loadLots]);

  useEffect(() => { loadLotsWithTimestamp(); }, [loadLotsWithTimestamp]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 매일 오후 4시 자동 갱신
  useEffect(() => {
    const msUntilNext4PM = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(16, 0, 0, 0);
      if (now >= next) next.setDate(next.getDate() + 1);
      return next.getTime() - now.getTime();
    };
    timeoutRef.current = setTimeout(() => {
      loadLotsWithTimestamp();
      autoRefreshRef.current = setInterval(loadLotsWithTimestamp, 24 * 60 * 60 * 1000);
    }, msUntilNext4PM());
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [loadLotsWithTimestamp]);

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-screen">
      <PageHeader
        title="📦 원부자재 통합 재고관리"
        description={`배합원료 4종(원자재) 및 소켓·강판·그라스울·세라믹울·차열시트(부자재)의 통합 LOT 재고 관리 및 QR+Code128 바코드 인쇄${lastUpdated ? ` · 🕐 ${lastUpdated.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})} 업데이트` : ''}`}
      />

      {/* 탭 */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
              tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock'   && <Tab1Stock lots={lots} loading={loading} onRefresh={loadLots}/>}
      {tab === 'ledger'  && <Tab2Ledger/>}
      {tab === 'history' && <Tab3History isManager={!!(isManager)}/>}
      {tab === 'manual'  && <Tab4Manual lots={lots} onSuccess={loadLots}/>}
    </div>
  );
}

export default MaterialStockPage;
