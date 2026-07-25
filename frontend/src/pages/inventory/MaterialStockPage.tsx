import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Package, Search, RefreshCw, Printer, Plus, Trash2,
  ArrowDownCircle, ArrowUpCircle, MoveRight, Settings2,
  Download, BarChart3, List, BookOpen, Edit3
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
const CATEGORIES = ['세라믹울', '그라스울', '그라스울보드', '차열재', '소켓', '반제품', '기타부자재'];

const TXN_LABEL: Record<string, { text: string; color: string; emoji: string }> = {
  IN:   { text: '입고',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', emoji: '📥' },
  OUT:  { text: '출고',     color: 'text-red-700 bg-red-50 border-red-200',             emoji: '📤' },
  MOVE: { text: '위치이동', color: 'text-amber-700 bg-amber-50 border-amber-200',       emoji: '🚚' },
  ADJ:  { text: '재고조정', color: 'text-indigo-700 bg-indigo-50 border-indigo-200',    emoji: '⚙️' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function fmtDate(s?: string) { return s ? s.slice(0, 10) : '-'; }
function fmtSpec(l: { density?: number; thickness?: number; width_mm?: number; length_mm?: number }) {
  return [l.density && `${l.density}K`, l.thickness && `${l.thickness}T`, l.width_mm && `${l.width_mm}W`, l.length_mm && `${l.length_mm}L`]
    .filter(Boolean).join(' ') || '-';
}
function fmtLoc(loc?: string) {
  if (!loc) return '-';
  const m = loc.match(/^([A-Z]+\d+)-P(\d)$/);
  return m ? `${m[1]}-P${m[2]}(${m[2] === '1' ? '우' : '좌'})` : loc;
}

// ─── LOT 라벨 인쇄 모달 ───────────────────────────────────────────────────────
function LabelModal({ lot, onClose }: { lot: MaterialLot; onClose: () => void }) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(lot.lot_number)}&margin=0`;
  const doPrint = () => {
    const w = window.open('', '_blank', 'width=450,height=380');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>라벨</title>
<style>
@page{size:80mm 60mm;margin:0}
body{font-family:'Malgun Gothic',sans-serif;width:80mm;height:60mm;padding:3mm;box-sizing:border-box;font-size:8pt}
.top{display:flex;justify-content:space-between;border-bottom:0.3mm solid #333;padding-bottom:1.5mm;margin-bottom:1.5mm;font-size:7pt}
.co{font-weight:bold;color:#c00}.title{font-weight:bold}
.row{display:flex;gap:2mm}
.qr img{width:20mm;height:20mm}
.info .lot{font-size:9pt;font-weight:900;word-break:break-all}
.info .field{font-size:6.5pt;margin-top:1mm}
.info .lbl{color:#666}
.qty{border:0.4mm solid #333;text-align:center;padding:1mm;margin-top:1.5mm;font-size:11pt;font-weight:900}
.qty small{display:block;font-size:6pt;color:#555;font-weight:400}
</style></head><body>
<div class="top"><span class="co">(주)이지원</span><span class="title">원자재 LOT 라벨</span></div>
<div class="row">
  <div class="qr"><img src="${qr}"/></div>
  <div class="info">
    <div class="lot">${lot.lot_number}</div>
    <div class="field"><span class="lbl">품목: </span>${lot.item_name}</div>
    <div class="field"><span class="lbl">규격: </span>${fmtSpec(lot)}</div>
    <div class="field"><span class="lbl">위치: </span>${lot.location || '-'}</div>
    <div class="field"><span class="lbl">입고일: </span>${fmtDate(lot.received_date)}</div>
  </div>
</div>
<div class="qty"><small>현재 수량</small>${Number(lot.qty_current).toLocaleString()} ${lot.unit}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 700);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-72 p-5 space-y-4">
        <div className="flex justify-between">
          <h3 className="font-bold flex items-center gap-1.5"><Printer className="h-4 w-4 text-blue-600"/>LOT 라벨 인쇄</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
        </div>
        {/* 미리보기 */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 bg-slate-50" style={{aspectRatio:'80/60'}}>
          <div className="flex gap-2 h-full text-[9px]">
            <img src={qr} alt="QR" className="h-full aspect-square"/>
            <div className="flex-1 space-y-0.5 overflow-hidden">
              <p className="font-black text-[8px] break-all">{lot.lot_number}</p>
              <p>{lot.item_name}</p>
              <p className="text-slate-500">{fmtSpec(lot)}</p>
              <p className="text-slate-500">{lot.location || '-'}</p>
              <p className="font-bold text-emerald-700">{Number(lot.qty_current).toLocaleString()} {lot.unit}</p>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400">용지: 80×60mm</p>
        <button onClick={doPrint} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
          <Printer className="h-4 w-4"/>인쇄
        </button>
      </div>
    </div>
  );
}

// ─── 탭1: 전체 LOT 재고현황 ──────────────────────────────────────────────────
function Tab1Stock({ lots, loading, onRefresh }: { lots: MaterialLot[]; loading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('전체');
  const [printLot, setPrintLot] = useState<MaterialLot | null>(null);

  const filtered = lots.filter(l =>
    (cat === '전체' || l.category === cat) &&
    (!search || l.lot_number.toLowerCase().includes(search.toLowerCase()) || l.item_name.toLowerCase().includes(search.toLowerCase()))
  );

  const catTotals: Record<string, number> = {};
  for (const l of lots) catTotals[l.category] = (catTotals[l.category] || 0) + Number(l.qty_current || 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg"><Package className="h-5 w-5"/></div>
          <div><p className="text-xs text-slate-500 font-bold">전체 LOT</p><p className="text-xl font-black">{lots.length}개</p></div>
        </div>
        {[['세라믹울','amber'],['그라스울','sky'],['그라스울보드','emerald']].map(([c,color]) => (
          <div key={c} className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
            <div className={`p-2.5 bg-${color}-600 text-white rounded-lg`}><BarChart3 className="h-5 w-5"/></div>
            <div><p className="text-xs text-slate-500 font-bold">{c}</p><p className="text-xl font-black">{(catTotals[c] || 0).toLocaleString()}</p></div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="LOT번호 / 품목명 검색"
            className="pl-9 pr-3 py-2 text-sm border rounded-lg focus:border-blue-500 outline-none w-52"/>
        </div>
        <div className="flex gap-1 flex-wrap">
          {['전체', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold',
                cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="ml-auto flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')}/> 새로고침
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white text-xs">
              <tr>
                {['LOT번호','품목명','분류','규격','단위','위치','현재고','금일입고','금일출고','입고일','라벨'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-300"/>
                    <span>로딩 중...</span>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16 text-slate-400">조회된 LOT가 없습니다.</td></tr>
              ) : filtered.map(lot => (
                <tr key={lot.lot_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">{lot.lot_number}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{lot.item_name}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">{lot.category}</span></td>
                  <td className="px-3 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtSpec(lot)}</td>
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
                  <td colSpan={6} className="px-3 py-2 text-slate-600">합계 ({filtered.length}개 LOT)</td>
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

  useEffect(() => { loadLots(); }, [loadLots]);

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-screen">
      <PageHeader
        title="📦 원자재 통합 재고관리"
        description="전체 LOT 재고현황 · 수불대장 · 이력조회 · 수동 수불 입력"
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
