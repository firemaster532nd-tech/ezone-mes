import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Package, Search, RefreshCw, Printer, Plus, Trash2,
  ArrowDownCircle, ArrowUpCircle, MoveRight, Settings2,
  Download, Filter, ChevronDown, X, AlertCircle, CheckCircle2,
  BarChart3, List, BookOpen, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── 공통 타입 ───────────────────────────────────────────────────────────────
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
  created_at?: string;
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

interface SummaryRow {
  category: string;
  location: string;
  lot_count: number;
  total_qty: number;
}

const CATEGORIES = ['세라믹울', '그라스울', '그라스울보드', '차열재', '소켓', '반제품', '기타부자재'];
const TXN_TYPE_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  IN:   { label: '입고',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <ArrowDownCircle className="h-3.5 w-3.5" /> },
  OUT:  { label: '출고',     color: 'text-red-700 bg-red-50 border-red-200',             icon: <ArrowUpCircle className="h-3.5 w-3.5" /> },
  MOVE: { label: '위치이동', color: 'text-amber-700 bg-amber-50 border-amber-200',       icon: <MoveRight className="h-3.5 w-3.5" /> },
  ADJ:  { label: '재고조정', color: 'text-indigo-700 bg-indigo-50 border-indigo-200',    icon: <Settings2 className="h-3.5 w-3.5" /> },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('ko-KR') : '-';
const fmtSpec = (l: MaterialLot) => {
  const parts = [];
  if (l.density)    parts.push(`${l.density}K`);
  if (l.thickness)  parts.push(`${l.thickness}T`);
  if (l.width_mm)   parts.push(`${l.width_mm}W`);
  if (l.length_mm)  parts.push(`${l.length_mm}L`);
  return parts.join(' ') || '-';
};
const fmtLoc = (loc?: string) => {
  if (!loc) return '-';
  const m = loc.match(/^([A-Z]+\d+)-P(\d)$/);
  if (m) return `${m[1]} (P${m[2]}${m[2] === '1' ? '오른쪽' : '왼쪽'})`;
  return loc;
};

// ─── LOT 라벨 인쇄 모달 (80×60mm) ───────────────────────────────────────────
function LabelPrintModal({ lot, onClose }: { lot: MaterialLot; onClose: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(lot.lot_number)}&margin=0`;
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=400,height=350');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>LOT 라벨 - ${lot.lot_number}</title>
<style>
  @page { size: 80mm 60mm; margin: 0; }
  @media print { body { margin: 0; } }
  body { font-family: 'Malgun Gothic', sans-serif; width: 80mm; height: 60mm;
         padding: 3mm; box-sizing: border-box; font-size: 8pt; overflow: hidden; }
  .row { display: flex; align-items: flex-start; gap: 3mm; }
  .qr { width: 22mm; height: 22mm; flex-shrink: 0; }
  .qr img { width: 100%; height: 100%; }
  .info { flex: 1; min-width: 0; }
  .lot { font-size: 9pt; font-weight: bold; word-break: break-all; }
  .field { display: flex; gap: 1mm; margin-top: 1.5mm; font-size: 7pt; }
  .label { color: #666; min-width: 8mm; }
  .value { font-weight: 600; }
  .header { display: flex; justify-content: space-between; align-items: center; 
             border-bottom: 0.5mm solid #333; margin-bottom: 2mm; padding-bottom: 1mm; }
  .co { font-size: 7pt; font-weight: bold; color: #c00; }
  .title { font-size: 8pt; font-weight: bold; }
  .qty-box { border: 0.5mm solid #333; text-align: center; padding: 1mm;
              margin-top: 2mm; font-size: 10pt; font-weight: bold; }
  .qty-label { font-size: 6pt; color: #555; }
</style>
</head><body>
<div class="header">
  <span class="co">(주)이지원</span>
  <span class="title">원자재 LOT 라벨</span>
</div>
<div class="row">
  <div class="qr"><img src="${qrUrl}" alt="QR" /></div>
  <div class="info">
    <div class="lot">${lot.lot_number}</div>
    <div class="field"><span class="label">품목:</span><span class="value">${lot.item_name}</span></div>
    <div class="field"><span class="label">규격:</span><span class="value">${fmtSpec(lot)}</span></div>
    <div class="field"><span class="label">위치:</span><span class="value">${lot.location || '-'}</span></div>
    <div class="field"><span class="label">입고일:</span><span class="value">${lot.received_date ? fmtDate(lot.received_date) : '-'}</span></div>
  </div>
</div>
<div class="qty-box">
  <div class="qty-label">현재 수량</div>
  ${Number(lot.qty_current).toLocaleString()} ${lot.unit}
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-80 p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Printer className="h-4 w-4 text-blue-600" /> LOT 라벨 인쇄</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        {/* 미리보기 */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 bg-slate-50" style={{ width: '100%', aspectRatio: '80/60' }}>
          <div className="flex gap-2 h-full">
            <img src={qrUrl} alt="QR" className="h-full aspect-square" />
            <div className="flex-1 min-w-0 text-[10px] space-y-0.5">
              <p className="font-black text-[9px] break-all">{lot.lot_number}</p>
              <p className="text-slate-600">품목: <strong>{lot.item_name}</strong></p>
              <p className="text-slate-600">규격: <strong>{fmtSpec(lot)}</strong></p>
              <p className="text-slate-600">위치: <strong>{lot.location || '-'}</strong></p>
              <p className="text-slate-600">수량: <strong className="text-emerald-700">{Number(lot.qty_current).toLocaleString()} {lot.unit}</strong></p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 text-center">용지 크기: 80×60mm</p>
        <button onClick={handlePrint}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
          <Printer className="h-4 w-4" /> 인쇄하기
        </button>
      </div>
    </div>
  );
}

// ─── 탭1: 전체 LOT 재고현황 ──────────────────────────────────────────────────
function Tab1LotStock({ lots, loading, onRefresh, summaries }: {
  lots: MaterialLot[]; loading: boolean; onRefresh: () => void; summaries: SummaryRow[];
}) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('전체');
  const [printLot, setPrintLot] = useState<MaterialLot | null>(null);

  const filtered = lots.filter(l => {
    const matchCat = catFilter === '전체' || l.category === catFilter;
    const matchSearch = !search || l.lot_number.toLowerCase().includes(search.toLowerCase()) ||
      l.item_name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // 카테고리별 집계
  const catTotals: Record<string, number> = {};
  for (const l of lots) {
    catTotals[l.category] = (catTotals[l.category] || 0) + Number(l.qty_current || 0);
  }
  const totalLots = lots.length;
  const totalQty = lots.reduce((a, l) => a + Number(l.qty_current || 0), 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg"><Package className="h-5 w-5" /></div>
          <div><p className="text-xs text-slate-500 font-bold">전체 LOT</p><p className="text-lg font-black">{totalLots}개</p></div>
        </div>
        {['세라믹울', '그라스울', '그라스울보드'].map(cat => (
          <div key={cat} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={cn('p-2.5 rounded-lg text-white', cat === '세라믹울' ? 'bg-amber-600' : cat === '그라스울' ? 'bg-sky-600' : 'bg-emerald-600')}>
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold">{cat}</p>
              <p className="text-lg font-black">{(catTotals[cat] || 0).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="LOT번호 / 품목명 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['전체', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                catFilter === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="ml-auto flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 새로고침
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white text-xs">
              <tr>
                {['LOT번호','품목명','분류','규격','단위','위치','현재고','금일입고','금일출고','입고일','라벨'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">로딩 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">조회된 LOT가 없습니다.</td></tr>
              ) : filtered.map(lot => (
                <tr key={lot.lot_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">{lot.lot_number}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{lot.item_name}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-bold">{lot.category}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">{fmtSpec(lot)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{lot.unit}</td>
                  <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold">{fmtLoc(lot.location)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-slate-900">{Number(lot.qty_current).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                    {Number(lot.today_in || 0) > 0 ? `+${Number(lot.today_in).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-600">
                    {Number(lot.today_out || 0) > 0 ? `-${Number(lot.today_out).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{fmtDate(lot.received_date || '')}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setPrintLot(lot)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="라벨 인쇄">
                      <Printer className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-xs font-bold text-slate-600">합계 ({filtered.length}개 LOT)</td>
                  <td className="px-3 py-2 text-right font-black text-slate-900">
                    {filtered.reduce((a, l) => a + Number(l.qty_current || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">
                    +{filtered.reduce((a, l) => a + Number(l.today_in || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">
                    -{filtered.reduce((a, l) => a + Number(l.today_out || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {printLot && <LabelPrintModal lot={printLot} onClose={() => setPrintLot(null)} />}
    </div>
  );
}

// ─── 탭2: 수불대장 (기간별 이력) ─────────────────────────────────────────────
function Tab2Ledger() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(today());
  const [catFilter, setCatFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dateFrom, date_to: dateTo };
      if (catFilter) params.category = catFilter;
      if (lotFilter) params.lot_number = lotFilter;
      const res = await api.get<{ data: LedgerRow[] }>('/material-ledger', { params });
      setRows(res.data || []);
    } catch { toast.error('수불대장 조회 실패'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, catFilter, lotFilter]);

  useEffect(() => { fetch(); }, []);

  const handleExport = () => {
    const header = ['날짜','LOT번호','품목','분류','단위','위치','당일입고','당일출고','당일조정','잔고'].join(',');
    const body = rows.map(r => [
      r.txn_date, r.lot_number, r.item_name, r.category, r.unit, r.location || '',
      r.qty_in, r.qty_out, r.qty_adj, r.qty_current
    ].join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `수불대장_${dateFrom}_${dateTo}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-bold text-slate-600 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">분류</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
            <option value="">전체</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">LOT번호 검색</label>
          <input value={lotFilter} onChange={e => setLotFilter(e.target.value)} placeholder="LOT 번호"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <button onClick={fetch}
          className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center gap-2">
          <Search className="h-4 w-4" /> 조회
        </button>
        <button onClick={handleExport}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2">
          <Download className="h-4 w-4" /> CSV 다운로드
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white text-xs">
              <tr>
                {['날짜','LOT번호','품목명','분류','단위','위치','당일입고(+)','당일출고(-)','재고조정','현재고'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">조회 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">해당 기간에 수불 내역이 없습니다.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-600 whitespace-nowrap">{r.txn_date}</td>
                  <td className="px-3 py-2.5 text-xs font-mono font-bold text-blue-700">{r.lot_number}</td>
                  <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">{r.item_name}</td>
                  <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">{r.category}</span></td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.unit}</td>
                  <td className="px-3 py-2.5 text-xs font-mono">{fmtLoc(r.location)}</td>
                  <td className={cn('px-3 py-2.5 text-right font-bold', Number(r.qty_in) > 0 ? 'text-emerald-600' : 'text-slate-300')}>
                    {Number(r.qty_in) > 0 ? `+${Number(r.qty_in).toLocaleString()}` : '-'}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-bold', Number(r.qty_out) > 0 ? 'text-red-600' : 'text-slate-300')}>
                    {Number(r.qty_out) > 0 ? `-${Number(r.qty_out).toLocaleString()}` : '-'}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-bold', Number(r.qty_adj) !== 0 ? 'text-indigo-600' : 'text-slate-300')}>
                    {Number(r.qty_adj) !== 0 ? (Number(r.qty_adj) > 0 ? '+' : '') + Number(r.qty_adj).toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-slate-900">{Number(r.qty_current).toLocaleString()}</td>
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
function Tab3History({ user }: { user: any }) {
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [txnType, setTxnType] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { date_from: dateFrom, date_to: dateTo, limit: '500' };
      if (txnType) params.txn_type = txnType;
      if (search)  params.search = search;
      const res = await api.get<{ data: Transaction[] }>('/material-transactions', { params });
      setRows(res.data || []);
    } catch { toast.error('이력 조회 실패'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, txnType, search]);

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (txn: Transaction) => {
    if (!confirm(`수불 기록 #${txn.txn_id}을 삭제하시겠습니까?\n재고가 원복됩니다.`)) return;
    try {
      await api.delete(`/material-transactions/${txn.txn_id}`);
      toast.success('삭제 완료. 재고 원복됨.');
      fetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-bold text-slate-600 mb-1">시작일</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">종료일</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">거래유형</label>
          <select value={txnType} onChange={e => setTxnType(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">전체</option>
            <option value="IN">입고</option>
            <option value="OUT">출고</option>
            <option value="MOVE">위치이동</option>
            <option value="ADJ">재고조정</option>
          </select></div>
        <div><label className="block text-xs font-bold text-slate-600 mb-1">LOT / 품목 검색</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색어 입력"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" /></div>
        <button onClick={fetch}
          className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center gap-2">
          <Search className="h-4 w-4" /> 조회
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b text-xs font-bold text-slate-500 flex items-center gap-2">
          <List className="h-3.5 w-3.5" /> 총 {rows.length}건 조회됨
          {isManager && <span className="text-amber-600">· 매니저: 삭제 권한 있음</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs">
              <tr>
                {['일시','구분','LOT번호','품목명','수량','이전수량→이후수량','위치From','위치To','현장/프로젝트','비고','삭제'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">조회 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-400">해당 기간에 거래 내역이 없습니다.</td></tr>
              ) : rows.map(r => {
                const typeInfo = TXN_TYPE_LABEL[r.txn_type] || TXN_TYPE_LABEL.IN;
                return (
                  <tr key={r.txn_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap font-mono">{r.txn_date}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border w-fit', typeInfo.color)}>
                        {typeInfo.icon}{typeInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono font-bold text-blue-700">{r.lot_number}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.item_name}</td>
                    <td className={cn('px-3 py-2.5 text-right font-black whitespace-nowrap',
                      Number(r.qty) > 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {Number(r.qty) > 0 ? '+' : ''}{Number(r.qty).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                      {Number(r.qty_before).toLocaleString()} → {Number(r.qty_after).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{r.location_from || '-'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{r.location_to || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.project_name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[120px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                    <td className="px-3 py-2.5">
                      {isManager && (
                        <button onClick={() => handleDelete(r)}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="삭제 (재고 원복)">
                          <Trash2 className="h-3.5 w-3.5" />
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

// ─── 탭4: 수동 수불 입력 ──────────────────────────────────────────────────────
function Tab4Manual({ lots, onSuccess }: { lots: MaterialLot[]; onSuccess: () => void }) {
  const [mode, setMode] = useState<'txn' | 'newlot'>('txn');

  // 거래 입력 폼
  const [txnDate, setTxnDate] = useState(today());
  const [selLotId, setSelLotId] = useState('');
  const [lotSearch, setLotSearch] = useState('');
  const [txnType, setTxnType] = useState<'IN'|'OUT'|'MOVE'|'ADJ'>('IN');
  const [qty, setQty] = useState<number | ''>('');
  const [adjTarget, setAdjTarget] = useState<number | ''>('');  // ADJ용 실재고
  const [locationTo, setLocationTo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [txnNotes, setTxnNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 신규 LOT 폼
  const [newLot, setNewLot] = useState({
    lot_number: '', category: '세라믹울', item_name: '', density: '', thickness: '',
    width_mm: '', length_mm: '', unit: '롤', qty_current: '', location: '', received_date: today(), notes: ''
  });
  const [newSubmitting, setNewSubmitting] = useState(false);

  const filteredLots = lots.filter(l =>
    !lotSearch || l.lot_number.toLowerCase().includes(lotSearch.toLowerCase()) ||
    l.item_name.toLowerCase().includes(lotSearch.toLowerCase())
  );
  const selectedLot = lots.find(l => String(l.lot_id) === selLotId);

  const handleTxnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selLotId) { toast.error('LOT를 선택해주세요.'); return; }

    let finalQty = Number(qty);
    if (txnType === 'ADJ') {
      if (adjTarget === '') { toast.error('실재고 수량을 입력해주세요.'); return; }
      finalQty = Number(adjTarget) - Number(selectedLot?.qty_current || 0);
    }
    if (finalQty === 0 && txnType !== 'MOVE') { toast.error('수량이 0입니다.'); return; }

    setSubmitting(true);
    try {
      await api.post('/material-transactions', {
        lot_id: Number(selLotId),
        txn_type: txnType,
        qty: finalQty,
        txn_date: txnDate,
        location_to: locationTo || undefined,
        project_name: projectName || undefined,
        notes: txnNotes || undefined,
        source_type: 'MANUAL',
      });
      toast.success(`${TXN_TYPE_LABEL[txnType].label} 등록 완료 (LOT: ${selectedLot?.lot_number})`);
      setQty(''); setAdjTarget(''); setTxnNotes(''); setLocationTo(''); setProjectName('');
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '등록 실패');
    } finally { setSubmitting(false); }
  };

  const handleNewLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLot.lot_number || !newLot.item_name) { toast.error('LOT번호와 품목명은 필수입니다.'); return; }
    setNewSubmitting(true);
    try {
      await api.post('/material-lots', {
        ...newLot,
        density:    newLot.density    ? Number(newLot.density)    : null,
        thickness:  newLot.thickness  ? Number(newLot.thickness)  : null,
        width_mm:   newLot.width_mm   ? Number(newLot.width_mm)   : null,
        length_mm:  newLot.length_mm  ? Number(newLot.length_mm)  : null,
        qty_current: newLot.qty_current ? Number(newLot.qty_current) : 0,
      });
      toast.success(`신규 LOT (${newLot.lot_number}) 등록 완료!`);
      setNewLot({ lot_number:'', category:'세라믹울', item_name:'', density:'', thickness:'',
        width_mm:'', length_mm:'', unit:'롤', qty_current:'', location:'', received_date:today(), notes:'' });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '등록 실패');
    } finally { setNewSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      {/* 모드 선택 */}
      <div className="flex gap-2">
        {[
          { key: 'txn', icon: <Edit3 className="h-4 w-4" />, label: '입출고 · 위치이동 · 재고조정' },
          { key: 'newlot', icon: <Plus className="h-4 w-4" />, label: '신규 LOT 등록' }
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key as any)}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors',
              mode === m.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>

      {mode === 'txn' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-blue-600" /> 수동 수불 입력
          </h3>
          <form onSubmit={handleTxnSubmit} className="space-y-5">
            {/* 거래 유형 버튼 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">거래 유형 *</label>
              <div className="grid grid-cols-4 gap-2">
                {(['IN','OUT','MOVE','ADJ'] as const).map(t => {
                  const info = TXN_TYPE_LABEL[t];
                  return (
                    <button key={t} type="button" onClick={() => setTxnType(t)}
                      className={cn('py-3 rounded-xl border-2 font-bold text-sm flex flex-col items-center gap-1.5 transition-all',
                        txnType === t
                          ? (t==='IN' ? 'bg-emerald-600 border-emerald-600 text-white' :
                             t==='OUT' ? 'bg-red-600 border-red-600 text-white' :
                             t==='MOVE' ? 'bg-amber-500 border-amber-500 text-white' :
                             'bg-indigo-600 border-indigo-600 text-white')
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100')}>
                      <span className="text-lg">{t==='IN'?'📥':t==='OUT'?'📤':t==='MOVE'?'🚚':'⚙️'}</span>
                      <span>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 날짜 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">거래일 *</label>
                <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" required />
              </div>
              {/* LOT 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LOT 선택 *</label>
                <input value={lotSearch} onChange={e => { setLotSearch(e.target.value); setSelLotId(''); }}
                  placeholder="LOT번호 또는 품목명으로 검색 후 선택"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                {lotSearch && !selLotId && filteredLots.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg shadow-lg bg-white max-h-48 overflow-y-auto z-10 relative">
                    {filteredLots.slice(0, 20).map(l => (
                      <button key={l.lot_id} type="button"
                        onClick={() => { setSelLotId(String(l.lot_id)); setLotSearch(`${l.lot_number} (${l.item_name})`); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between items-center">
                        <span className="font-mono font-bold text-blue-700">{l.lot_number}</span>
                        <span className="text-slate-500 text-xs">{l.item_name} | 현재고: {Number(l.qty_current).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 선택된 LOT 정보 */}
            {selectedLot && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-6 text-sm">
                <div><span className="text-blue-400 text-xs font-bold">품목</span><p className="font-bold text-blue-900">{selectedLot.item_name}</p></div>
                <div><span className="text-blue-400 text-xs font-bold">현재고</span><p className="font-black text-blue-900 text-lg">{Number(selectedLot.qty_current).toLocaleString()} {selectedLot.unit}</p></div>
                <div><span className="text-blue-400 text-xs font-bold">위치</span><p className="font-bold text-blue-900">{fmtLoc(selectedLot.location)}</p></div>
                <div><span className="text-blue-400 text-xs font-bold">규격</span><p className="font-bold text-blue-900">{fmtSpec(selectedLot)}</p></div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {/* 수량 (ADJ는 실재고) */}
              {txnType === 'ADJ' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">실재고 수량 (직접 입력) *</label>
                  <input type="number" min="0" value={adjTarget} onChange={e => setAdjTarget(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="실제 재고 수량"
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 font-bold" required />
                  {selectedLot && adjTarget !== '' && (
                    <p className={cn('text-xs mt-1 font-bold', Number(adjTarget) >= Number(selectedLot.qty_current) ? 'text-emerald-600' : 'text-red-600')}>
                      조정량: {Number(adjTarget) - Number(selectedLot.qty_current) >= 0 ? '+' : ''}{Number(adjTarget) - Number(selectedLot.qty_current)} {selectedLot.unit}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">수량 *</label>
                  <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={txnType === 'MOVE' ? '이동할 수량' : '수량 입력'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-bold"
                    required={txnType !== 'MOVE'} />
                </div>
              )}
              {/* 이동 후 위치 (MOVE, IN에서도 위치 지정 가능) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {txnType === 'MOVE' ? '이동 후 위치 *' : '배치 위치'}
                </label>
                <input value={locationTo} onChange={e => setLocationTo(e.target.value)}
                  placeholder="예: A1-P1, H3-P2"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-mono" />
              </div>
              {/* 현장/프로젝트 (OUT) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {txnType === 'OUT' ? '출하처/현장명' : '비고'}
                </label>
                <input value={txnType === 'OUT' ? projectName : txnNotes}
                  onChange={e => txnType === 'OUT' ? setProjectName(e.target.value) : setTxnNotes(e.target.value)}
                  placeholder={txnType === 'OUT' ? '판교현장, 부산현장 등' : '비고 입력'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <button type="submit" disabled={submitting || !selLotId}
              className={cn('w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors',
                txnType==='IN' ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300' :
                txnType==='OUT' ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300' :
                txnType==='MOVE' ? 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300' :
                'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300')}>
              {submitting ? '등록 중...' : `${TXN_TYPE_LABEL[txnType].label} 등록`}
            </button>
          </form>
        </div>
      )}

      {mode === 'newlot' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" /> 신규 LOT 기초재고 등록
          </h3>
          <form onSubmit={handleNewLotSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'lot_number', label: 'LOT 번호 *', ph: '260722CW001', type: 'text', required: true },
                { key: 'item_name',  label: '품목명 *',   ph: '세라믹울 104K 25T', type: 'text', required: true },
                { key: 'received_date', label: '입고일 *', ph: '', type: 'date', required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <input type={f.type} value={(newLot as any)[f.key]} placeholder={f.ph} required={f.required}
                    onChange={e => setNewLot(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">분류 *</label>
                <select value={newLot.category} onChange={e => setNewLot(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">단위</label>
                <select value={newLot.unit} onChange={e => setNewLot(p => ({ ...p, unit: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none">
                  {['롤','장','EA','kg','m'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              {[
                { key: 'qty_current', label: '기초수량', ph: '0', type: 'number' },
                { key: 'location',    label: '적재위치', ph: 'A1-P1', type: 'text' },
                { key: 'density',     label: '밀도 (K)', ph: '104', type: 'number' },
                { key: 'thickness',   label: '두께 (T)', ph: '25', type: 'number' },
                { key: 'width_mm',    label: '폭 (W)', ph: '200', type: 'number' },
                { key: 'length_mm',   label: '길이 (L)', ph: '7400', type: 'number' },
                { key: 'supplier_name', label: '공급업체', ph: '', type: 'text' },
                { key: 'notes',       label: '비고', ph: '', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{f.label}</label>
                  <input type={f.type} value={(newLot as any)[f.key]} placeholder={f.ph}
                    onChange={e => setNewLot(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
            <button type="submit" disabled={newSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              {newSubmitting ? '등록 중...' : '신규 LOT 기초재고 등록'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'stock',   label: '전체 LOT 재고현황', icon: <Package className="h-4 w-4" /> },
  { id: 'ledger',  label: '수불대장 (기간별)',  icon: <BookOpen className="h-4 w-4" /> },
  { id: 'history', label: '수불 이력 조회',     icon: <List className="h-4 w-4" /> },
  { id: 'manual',  label: '수동 수불 입력',     icon: <Edit3 className="h-4 w-4" /> },
] as const;

export function MaterialStockPage() {
  const { me: user } = useAuth();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('stock');
  const [lots, setLots] = useState<MaterialLot[]>([]);
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    try {
      const [lotsRes, sumRes] = await Promise.all([
        api.get<{ data: MaterialLot[] }>('/material-lots?active=1'),
        api.get<{ data: SummaryRow[] }>('/material-stock-summary').catch(() => ({ data: [] })),
      ]);
      setLots(lotsRes.data || []);
      setSummaries(sumRes.data || []);
    } catch { toast.error('LOT 재고 조회 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLots(); }, [loadLots]);

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-screen">
      <PageHeader
        title="📦 원자재 통합 재고관리"
        description="LOT별 재고현황 · 수불대장 · 이력조회 · 수동입력 통합 관리"
      />

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            )}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'stock'   && <Tab1LotStock lots={lots} loading={loading} onRefresh={loadLots} summaries={summaries} />}
      {activeTab === 'ledger'  && <Tab2Ledger />}
      {activeTab === 'history' && <Tab3History user={user} />}
      {activeTab === 'manual'  && <Tab4Manual lots={lots} onSuccess={loadLots} />}
    </div>
  );
}

export default MaterialStockPage;
