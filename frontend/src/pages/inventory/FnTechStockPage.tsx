import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Package, BarChart3, ArrowDownToLine, RefreshCw, Plus,
  AlertTriangle, ChevronDown, CheckCircle, XCircle, Clock,
  Calendar
} from 'lucide-react';

// ─── 타입 ───────────────────────────────────────────────────────────────────
interface FinishedStock { stock_id?: number; id?: number; diameter_mm: number; spec: string; qty: number; }
interface MaterialStock  { stock_id?: number; id?: number; item_name: string; spec: string; qty: number; unit?: string; }
interface TxRecord {
  tx_id: number; tx_date: string; tx_type: string; stock_type: string;
  item_name: string; spec: string; qty: number; lot_number?: string;
  inspect_result?: string; memo?: string; created_at: string;
}
interface DailyProd {
  prod_id: number; prod_date: string; item_name: string; spec: string;
  qty: number; lot_number?: string; worker_name?: string;
}

// ─── 초기값 (엑셀 통합현황 기준) ─────────────────────────────────────────
const FALLBACK_FINISHED: FinishedStock[] = [
  { id:1, diameter_mm:100, spec:'몸통', qty:900 },
  { id:2, diameter_mm:100, spec:'150H', qty:0 },{ id:3, diameter_mm:100, spec:'170H', qty:0 },
  { id:4, diameter_mm:100, spec:'180H', qty:0 },{ id:5, diameter_mm:100, spec:'190H', qty:0 },
  { id:6, diameter_mm:100, spec:'200H', qty:0 },{ id:7, diameter_mm:100, spec:'210H', qty:0 },
  { id:8, diameter_mm:100, spec:'240H', qty:0 },{ id:9, diameter_mm:100, spec:'250H', qty:0 },
  { id:10, diameter_mm:100, spec:'260H', qty:0 },
  { id:11, diameter_mm:75, spec:'몸통', qty:0 },
  { id:12, diameter_mm:50, spec:'몸통', qty:1260 },
];
const FALLBACK_MATERIAL: MaterialStock[] = [
  { id:1, item_name:'보호철판',     spec:'100파이', qty:5759,  unit:'ea' },
  { id:2, item_name:'보호철판',     spec:'75파이',  qty:1030,  unit:'ea' },
  { id:3, item_name:'보호철판',     spec:'50파이',  qty:2876,  unit:'ea' },
  { id:4, item_name:'볼트,너트,와샤',spec:'-',      qty:35700, unit:'ea' },
  { id:5, item_name:'시트(재단)',   spec:'100파이', qty:1063,  unit:'ea' },
  { id:6, item_name:'시트(재단)',   spec:'75파이',  qty:13,    unit:'ea' },
  { id:7, item_name:'시트(재단)',   spec:'50파이',  qty:-533,  unit:'ea' },
  { id:8, item_name:'시트(압출)',   spec:'-',       qty:31,    unit:'ea' },
];

const DAILY_ITEMS = [
  { item_name:'발포소켓 몸체(100)-몸통', diameter_mm:100, spec:'몸통' },
  { item_name:'발포소켓 몸체(100)(210H)', diameter_mm:100, spec:'210H' },
  { item_name:'발포소켓 몸체(75)',       diameter_mm:75,  spec:'몸통' },
  { item_name:'발포소켓 몸체(50)',       diameter_mm:50,  spec:'몸통' },
  { item_name:'보호철판 / 100',          diameter_mm:100, spec:'보호철판' },
  { item_name:'보호철판 / 75',           diameter_mm:75,  spec:'보호철판' },
  { item_name:'보호철판 / 50',           diameter_mm:50,  spec:'보호철판' },
  { item_name:'볼트,너트,와샤',          diameter_mm:null, spec:'-' },
  { item_name:'시트(압출)',              diameter_mm:null, spec:'-' },
];

function qtyColor(qty: number) {
  if (qty > 0) return 'text-emerald-700 font-bold';
  if (qty < 0) return 'text-red-600 font-bold';
  return 'text-gray-400';
}

function inspectBadge(result?: string) {
  if (result === 'PASS')    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3"/>합격</span>;
  if (result === 'FAIL')    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="h-3 w-3"/>불합격</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><Clock className="h-3 w-3"/>검사중</span>;
}

// ─── 입고 모달 (로트번호 + 인수검사 포함) ─────────────────────────────────
function ReceiveModal({ open, onClose, onSubmit, finished, material }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: any) => void;
  finished: FinishedStock[]; material: MaterialStock[];
}) {
  const [stockType, setStockType]       = useState<'FINISHED'|'MATERIAL'>('FINISHED');
  const [diameter, setDiameter]         = useState(100);
  const [spec, setSpec]                 = useState('몸통');
  const [itemName, setItemName]         = useState('보호철판');
  const [matSpec, setMatSpec]           = useState('100파이');
  const [qty, setQty]                   = useState<number>(0);
  const [lotNumber, setLotNumber]       = useState('');
  const [inspectResult, setInspectResult] = useState<'PASS'|'FAIL'|'PENDING'>('PASS');
  const [txDate, setTxDate]             = useState(new Date().toISOString().slice(0,10));
  const [memo, setMemo]                 = useState('');

  const finishedSpecs = finished.filter(f => f.diameter_mm === diameter).map(f => f.spec);
  const materialItems = [...new Set(material.map(m => m.item_name))];
  const materialSpecs = material.filter(m => m.item_name === itemName).map(m => m.spec);

  const handleSubmit = () => {
    if (qty <= 0) { alert('수량을 입력하세요.'); return; }
    if (!lotNumber.trim()) { alert('입고 로트번호는 필수입니다.'); return; }
    onSubmit({ stock_type:stockType, diameter_mm:diameter, spec, item_name:itemName,
               mat_spec:matSpec, qty, lot_number:lotNumber, inspect_result:inspectResult,
               tx_date:txDate, memo });
    onClose();
    setQty(0); setLotNumber(''); setMemo('');
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 rounded-t-2xl">
          <h3 className="text-white font-semibold text-lg">재고 입고 / 인수검사</h3>
          <p className="text-blue-200 text-xs mt-0.5">입고 로트번호는 필수 기재사항입니다</p>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 구분 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">구분</label>
            <div className="flex gap-2">
              {(['FINISHED','MATERIAL'] as const).map(t => (
                <button key={t} onClick={() => setStockType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${stockType===t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                  {t==='FINISHED' ? '완제품' : '부자재'}
                </button>
              ))}
            </div>
          </div>

          {/* 입고일 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">입고일</label>
            <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {stockType === 'FINISHED' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">지름 (파이)</label>
                <div className="flex gap-2">
                  {[100,75,50].map(d => (
                    <button key={d} onClick={() => { setDiameter(d); setSpec('몸통'); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${diameter===d ? 'bg-slate-700 text-white' : 'border-gray-300 text-gray-600'}`}>
                      {d}파이
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">규격</label>
                <select value={spec} onChange={e => setSpec(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {finishedSpecs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">품목</label>
                <select value={itemName} onChange={e => setItemName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {materialItems.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">규격</label>
                <select value={matSpec} onChange={e => setMatSpec(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {materialSpecs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">수량 (ea)</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* ★ 입고 로트번호 */}
          <div>
            <label className="text-xs font-semibold text-red-600 mb-1 block">
              <span className="text-red-500">*</span> 입고 로트번호 (필수)
            </label>
            <input value={lotNumber} onChange={e => setLotNumber(e.target.value)}
              className="w-full border-2 border-red-200 focus:border-red-400 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder={stockType === 'FINISHED'
                ? `예: ${new Date().toISOString().slice(2,4)}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}U001/${new Date().toISOString().slice(2,4)}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}GI001`
                : '예: 260602U002/260602GI001'} />
            {/* 로트번호 형식 안내 */}
            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
              <p className="text-xs font-semibold text-blue-700 mb-1">📋 로트번호 형식 (엑셀 수불대장 기준)</p>
              {stockType === 'FINISHED' ? (
                <>
                  <p className="text-xs text-blue-600 font-mono">반제품 입고: <span className="font-bold">260602U002/260602GI001</span></p>
                  <p className="text-xs text-gray-500">→ YYMMDD + U순번 / YYMMDD + GI순번</p>
                  <p className="text-xs text-blue-600 font-mono mt-1">생산LOT 예시: <span className="font-bold">260602-FN-100(0001~0960)</span></p>
                  <p className="text-xs text-gray-500">→ YYMMDD-FN-파이(시작번호~끝번호)</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-blue-600 font-mono">보호철판: <span className="font-bold">260602U002/260602GI001</span></p>
                  <p className="text-xs text-blue-600 font-mono">시트(재단): <span className="font-bold">260518-S06(778~1350)573</span></p>
                  <p className="text-xs text-gray-500">→ YYMMDD-S롤번호(시작~끝)재단수량</p>
                  <p className="text-xs text-blue-600 font-mono">시트(압출): <span className="font-bold">260527-S04(1~487)487</span></p>
                </>
              )}
            </div>
          </div>

          {/* 인수검사 결과 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">인수검사 결과</label>
            <div className="flex gap-2">
              {([['PASS','✅ 합격','border-green-400 bg-green-50 text-green-700'],
                 ['FAIL','❌ 불합격','border-red-400 bg-red-50 text-red-700'],
                 ['PENDING','⏳ 검사중','border-gray-300 bg-gray-50 text-gray-600']] as const).map(([v,label,cls]) => (
                <button key={v} onClick={() => setInspectResult(v)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition ${inspectResult===v ? cls : 'border-gray-200 text-gray-400'}`}>
                  {label}
                </button>
              ))}
            </div>
            {inspectResult === 'FAIL' && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                ⚠️ 불합격 시 재고에 반영되지 않으며 이력만 기록됩니다.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">메모</label>
            <input value={memo} onChange={e => setMemo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="특이사항" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">취소</button>
          <button onClick={handleSubmit}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white transition ${
              inspectResult==='FAIL' ? 'bg-red-500 hover:bg-red-400' : 'bg-blue-600 hover:bg-blue-500'
            }`}>
            {inspectResult==='FAIL' ? '불합격 기록' : '입고 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 일일 생산량 탭 ─────────────────────────────────────────────────────────
function DailyProductionTab() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyData, setDailyData] = useState<DailyProd[]>([]);
  const [editCell, setEditCell] = useState<{item:string;spec:string;day:number}|null>(null);
  const [editQty, setEditQty]   = useState(0);
  const [editLot, setEditLot]   = useState('');
  const [saving, setSaving]     = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const loadDaily = useCallback(async () => {
    try {
      const r = await api.get<{data: DailyProd[]}>(`/fn-stock/daily?year=${year}&month=${month}`);
      if (r.data) setDailyData(r.data);
    } catch { /* ignore */ }
  }, [year, month]);

  useEffect(() => { loadDaily(); }, [loadDaily]);

  const getCellQty = (item: string, spec: string, day: number): number => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return dailyData.find(d => d.item_name === item && d.spec === spec && d.prod_date.slice(0,10) === dateStr)?.qty ?? 0;
  };

  const getCellLot = (item: string, spec: string, day: number): string => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return dailyData.find(d => d.item_name === item && d.spec === spec && d.prod_date.slice(0,10) === dateStr)?.lot_number ?? '';
  };

  const openEdit = (item: string, spec: string, day: number) => {
    setEditCell({ item, spec, day });
    setEditQty(getCellQty(item, spec, day));
    setEditLot(getCellLot(item, spec, day));
  };

  const saveCell = async () => {
    if (!editCell) return;
    setSaving(true);
    const { item, spec, day } = editCell;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const rowInfo = DAILY_ITEMS.find(r => r.item_name === item);
    try {
      await api.post('/fn-stock/daily', {
        prod_date: dateStr, item_name: item, diameter_mm: rowInfo?.diameter_mm,
        spec, qty: editQty, lot_number: editLot || null,
      });
      await loadDaily();
      setEditCell(null);
    } catch { alert('저장 실패'); }
    finally { setSaving(false); }
  };

  const rowTotal = (item: string, spec: string) =>
    days.reduce((s, d) => s + getCellQty(item, spec, d), 0);

  return (
    <div className="space-y-4">
      {/* 연월 선택 */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <Calendar className="h-5 w-5 text-blue-500" />
        <span className="font-semibold text-gray-700">일일 생산량 기록표</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm">
            {[2025,2026,2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm">
            {Array.from({length:12},(_,i)=>i+1).map(m =>
              <option key={m} value={m}>{m}월</option>)}
          </select>
          <button onClick={loadDaily}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition">
            <RefreshCw className="h-3.5 w-3.5" /> 불러오기
          </button>
        </div>
      </div>

      {/* 생산량 격자표 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-auto shadow-sm">
        <table className="text-xs min-w-max">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-slate-800 z-10 min-w-[160px]">품명</th>
              {days.map(d => (
                <th key={d} className={`px-2 py-2.5 text-center min-w-[52px] font-medium ${
                  [0,6].includes(new Date(year,month-1,d).getDay()) ? 'bg-slate-600' : ''
                }`}>
                  <div>{d}일</div>
                  <div className="text-slate-300 text-[10px]">
                    {['일','월','화','수','목','금','토'][new Date(year,month-1,d).getDay()]}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold bg-blue-700 min-w-[60px]">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DAILY_ITEMS.map((row, ri) => (
              <tr key={row.item_name} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-inherit z-10 border-r border-gray-200">
                  {row.item_name}
                </td>
                {days.map(d => {
                  const qty = getCellQty(row.item_name, row.spec, d);
                  const isWeekend = [0,6].includes(new Date(year,month-1,d).getDay());
                  return (
                    <td key={d}
                      onClick={() => openEdit(row.item_name, row.spec, d)}
                      className={`px-1 py-1.5 text-center cursor-pointer hover:bg-blue-50 transition border-r border-gray-100 ${isWeekend ? 'bg-gray-50' : ''}`}>
                      {qty > 0 ? (
                        <span className="font-bold text-blue-700">{qty.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-50">
                  {rowTotal(row.item_name, row.spec).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">셀을 클릭하면 수량과 생산 로트를 입력할 수 있습니다.</p>

      {/* 셀 편집 모달 */}
      {editCell && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <h4 className="font-semibold text-gray-800 mb-1">{editCell.item}</h4>
            <p className="text-xs text-gray-500 mb-4">
              {year}년 {month}월 {editCell.day}일 생산량
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">생산 수량 (ea)</label>
                <input type="number" min="0" value={editQty} onChange={e => setEditQty(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm text-center text-lg font-bold" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">생산 로트번호</label>
                <input value={editLot} onChange={e => setEditLot(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="예: 260602-FN-100(0001~0960)" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditCell(null)}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-600">취소</button>
              <button onClick={saveCell} disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export function FnTechStockPage() {
  type TabKey = 'FINISHED' | 'MATERIAL' | 'DAILY' | 'TX';
  const [activeTab, setActiveTab] = useState<TabKey>('FINISHED');
  const [finished, setFinished]   = useState<FinishedStock[]>(FALLBACK_FINISHED);
  const [material, setMaterial]   = useState<MaterialStock[]>(FALLBACK_MATERIAL);
  const [txList, setTxList]       = useState<TxRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [adjustId, setAdjustId]   = useState<number | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [f, m] = await Promise.all([
        api.get<{data:FinishedStock[]}>('/fn-stock/finished').catch(() => ({data: FALLBACK_FINISHED})),
        api.get<{data:MaterialStock[]}>('/fn-stock/material').catch(() => ({data: FALLBACK_MATERIAL})),
      ]);
      if (f.data?.length) setFinished(f.data);
      if (m.data?.length) setMaterial(m.data);
    } finally { setLoading(false); }
  }, []);

  const loadTx = useCallback(async () => {
    try {
      const r = await api.get<{data:TxRecord[]}>('/fn-stock/transactions?limit=100');
      if (r.data) setTxList(r.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeTab === 'TX') loadTx(); }, [activeTab, loadTx]);

  const handleReceive = async (data: any) => {
    try {
      await api.post('/fn-stock/receive', {
        stock_type: data.stock_type,
        diameter_mm: data.stock_type==='FINISHED' ? data.diameter_mm : undefined,
        spec: data.stock_type==='FINISHED' ? data.spec : data.mat_spec,
        item_name: data.stock_type==='MATERIAL' ? data.item_name : undefined,
        qty: data.qty, lot_number: data.lot_number,
        inspect_result: data.inspect_result, tx_date: data.tx_date, memo: data.memo,
      });
      const msg = data.inspect_result==='FAIL' ? '불합격 이력 기록됨 (재고 미반영)' : '입고 처리 완료';
      alert(msg);
      await loadData();
    } catch (e: any) {
      alert(e?.message ?? '입고 처리 실패');
    }
  };

  const handleAdjust = async (stockId: number, delta: number) => {
    try {
      await api.patch(`/fn-stock/material/${stockId}/adjust`, { qty_delta: delta, memo: '수동 조정' });
      alert('수량 조정 완료');
      await loadData();
      setAdjustId(null);
    } catch { alert('조정 실패'); }
  };

  const byDiameter = (d: number) => finished.filter(f => f.diameter_mm === d);
  const totalFinished = finished.reduce((s,f) => s + Math.max(0,f.qty), 0);

  const TABS = [
    { key:'FINISHED' as TabKey, label:'완제품 재고',  icon:Package,          color:'border-blue-500 text-blue-700' },
    { key:'MATERIAL' as TabKey, label:'부자재 재고',  icon:BarChart3,        color:'border-emerald-500 text-emerald-700' },
    { key:'DAILY'    as TabKey, label:'일일 생산량',  icon:Calendar,         color:'border-purple-500 text-purple-700' },
    { key:'TX'       as TabKey, label:'입출고 이력',  icon:ArrowDownToLine,  color:'border-gray-400 text-gray-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">에프엔테크 재고현황</h1>
              <p className="text-blue-200 text-sm mt-1">EZ-FN-P100 · FS-NP24-1112-2 | 입고 시 로트번호 필수</p>
            </div>
            <div className="flex gap-3">
              <button onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm border border-white/20 transition">
                <RefreshCw className="h-4 w-4" /> 새로고침
              </button>
              <button onClick={() => setShowReceive(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-semibold transition">
                <Plus className="h-4 w-4" /> 입고 / 인수검사
              </button>
            </div>
          </div>
          {/* 요약 */}
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <p className="text-blue-200 text-xs">완제품 합계</p>
              <p className="text-white text-3xl font-bold mt-1">{totalFinished.toLocaleString()}</p>
              <p className="text-blue-200 text-xs mt-1">ea (발포소켓)</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <p className="text-blue-200 text-xs">부자재 품목</p>
              <p className="text-white text-3xl font-bold mt-1">{material.length}</p>
              <p className="text-blue-200 text-xs mt-1">종류</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <p className="text-blue-200 text-xs">재고부족 경보</p>
              <p className="text-red-300 text-3xl font-bold mt-1">
                {material.filter(m => m.qty < 0).length}
              </p>
              <p className="text-blue-200 text-xs mt-1">품목 (음수 재고)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex border-b border-gray-200 bg-white">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition ${
                activeTab===tab.key ? `${tab.color} bg-white` : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        <div className="py-6 space-y-6">
          {loading && <div className="text-center py-10 text-gray-400 text-sm">로딩 중...</div>}

          {/* ── 완제품 탭 ── */}
          {activeTab==='FINISHED' && !loading && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex justify-between items-center">
                  <h3 className="font-bold text-blue-800">100파이 방화소켓 (FN-100)</h3>
                  <span className="text-xs text-blue-600 font-medium">
                    합계: {byDiameter(100).reduce((s,f) => s+Math.max(0,f.qty),0).toLocaleString()} ea
                  </span>
                </div>
                <div className="p-5 grid grid-cols-5 gap-3">
                  {byDiameter(100).map(f => (
                    <div key={f.spec} className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">{f.spec}</p>
                      <p className={`text-xl ${qtyColor(f.qty)}`}>{f.qty.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">ea</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[75,50].map(d => (
                  <div key={d} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between">
                      <h3 className="font-bold text-slate-700">{d}파이 방화소켓 (FN-{d})</h3>
                      <span className="text-xs text-slate-500">
                        {byDiameter(d).reduce((s,f)=>s+Math.max(0,f.qty),0)} ea
                      </span>
                    </div>
                    <div className="p-5">
                      {byDiameter(d).map(f => (
                        <div key={f.spec} className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">{f.spec}</p>
                          <p className={`text-2xl ${qtyColor(f.qty)}`}>{f.qty.toLocaleString()}</p>
                          <p className="text-xs text-gray-400 mt-0.5">ea</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 부자재 탭 ── */}
          {activeTab==='MATERIAL' && !loading && (
            <div className="space-y-4">
              {[
                { title:'보호철판', filter:(m:MaterialStock)=>m.item_name==='보호철판', color:'bg-emerald-50 border-emerald-100 text-emerald-800' },
                { title:'시트(재단) — 100/75/50파이', filter:(m:MaterialStock)=>m.item_name==='시트(재단)', color:'bg-amber-50 border-amber-100 text-amber-800' },
              ].map(group => (
                <div key={group.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <div className={`px-5 py-3 border-b ${group.color}`}>
                    <h3 className="font-bold">{group.title}</h3>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-4">
                    {material.filter(group.filter).map(m => (
                      <div key={m.spec} className="relative text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">{m.spec}</p>
                        <p className={`text-3xl font-bold ${qtyColor(m.qty)}`}>{m.qty.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-1">{m.unit ?? 'ea'}</p>
                        {m.qty < 0 && <div className="mt-2 flex items-center justify-center gap-1 text-red-500 text-xs"><AlertTriangle className="h-3 w-3"/>재고부족</div>}
                        <button onClick={() => setAdjustId(m.stock_id ?? m.id ?? 0)}
                          className="absolute top-2 right-2 text-gray-300 hover:text-blue-500 transition">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-700">기타 부자재</h3>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  {material.filter(m => !['보호철판','시트(재단)'].includes(m.item_name)).map(m => (
                    <div key={`${m.item_name}-${m.spec}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div><p className="text-sm font-medium text-gray-700">{m.item_name}</p><p className="text-xs text-gray-400">{m.spec}</p></div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${qtyColor(m.qty)}`}>{m.qty.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{m.unit ?? 'ea'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 일일 생산량 탭 ── */}
          {activeTab==='DAILY' && <DailyProductionTab />}

          {/* ── 입출고 이력 탭 ── */}
          {activeTab==='TX' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">일자</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">구분</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">유형</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">품목</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">규격</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">수량</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 font-mono">입고 로트번호</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">인수검사</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">메모</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {txList.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">이력 없음</td></tr>
                    ) : txList.map(tx => (
                      <tr key={tx.tx_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{tx.tx_date}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            tx.tx_type==='IN' ? 'bg-green-100 text-green-700' :
                            tx.tx_type==='OUT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {tx.tx_type==='IN'?'입고':tx.tx_type==='OUT'?'출고':'조정'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">
                          {tx.stock_type==='FINISHED'?'완제품':'부자재'}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 text-xs">{tx.item_name}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{tx.spec}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          <span className={tx.tx_type==='IN'?'text-green-600':'text-red-600'}>
                            {tx.tx_type==='IN'?'+':'-'}{Math.abs(tx.qty ?? 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-blue-700">
                          {tx.lot_number ?? <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5">{inspectBadge(tx.inspect_result)}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{tx.memo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 입고/인수검사 모달 ── */}
      <ReceiveModal open={showReceive} onClose={() => setShowReceive(false)}
        onSubmit={handleReceive} finished={finished} material={material} />

      {/* ── 수량 조정 미니 모달 ── */}
      {adjustId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
            <h4 className="font-semibold text-gray-800 mb-3">수량 조정</h4>
            <p className="text-xs text-gray-500 mb-2">양수 = 추가 / 음수 = 차감</p>
            <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setAdjustId(null)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600">취소</button>
              <button onClick={() => handleAdjust(adjustId, adjustDelta)}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
