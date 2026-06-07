import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SocketStock { stock_id:number; project_id:number; project_name:string; product_type:string; width_mm:number; height_mm:number; depth_mm:number; qty:number; total_qty:number; }
interface BracketStock { stock_id:number; project_id:number; project_name:string; material:string; thickness_t:number; width_mm:number; length_mm:number; qty:number; total_qty:number; }
interface Project { project_id:number; project_name:string; }
interface StockTx { tx_id:number; stock_type:string; project_name:string; tx_type:string; qty:number; source_type:string; memo:string; created_by_name:string; created_at:string; }
interface BWO { bwo_id:number; bwo_number:string; project_id:number; project_name:string; wo_date:string; delivery_date:string|null; worker_name:string|null; status:string; remarks:string|null; item_count:number; total_order_qty:number; created_at:string; }
interface BWOItem { bwoi_id:number; bwo_id:number; stock_id:number|null; material:string; thickness_t:number; width_mm:number; length_mm:number; order_qty:number; completed_qty:number; bending_type:string; remarks:string|null; stock_qty:number|null; stock_deducted:boolean; seq_no:number; }
interface CeramicWool { stock_id:number; density_k:string; insert_type:string; thickness_mm:number; width_mm:number; length_mm:number; qty:number; }
interface ExtrudedSheet { stock_id:number; thickness_mm:number; width_mm:number; qty:number; }

const STRUCT_COLORS: Record<string,string> = {
  'VT-01':'bg-purple-100 text-purple-700','VT-049':'bg-blue-100 text-blue-700',
  'VT-064':'bg-indigo-100 text-indigo-700','VA-064':'bg-cyan-100 text-cyan-700',
  'VAG-1.69':'bg-teal-100 text-teal-700','HTG-064':'bg-orange-100 text-orange-700',
  'HTG-064DC':'bg-amber-100 text-amber-700','HTG-1.69':'bg-rose-100 text-rose-700',
};

const BWO_STATUS: Record<string,{label:string;color:string;icon:string}> = {
  PLANNED:     { label:'계획',   color:'bg-blue-100 text-blue-700',   icon:'📋' },
  IN_PROGRESS: { label:'진행중', color:'bg-amber-100 text-amber-700', icon:'⚙️' },
  COMPLETED:   { label:'완료',   color:'bg-green-100 text-green-700', icon:'✅' },
};

type TabType = 'socket' | 'bracket' | 'bending' | 'ceramic' | 'extruded' | 'history';
type ViewMode = 'all' | 'bysite';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SocketStockPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('socket');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number|null>(null);

  const [socketStock, setSocketStock] = useState<SocketStock[]>([]);
  const [bracketStock, setBracketStock] = useState<BracketStock[]>([]);
  const [summary, setSummary] = useState<{socket:any[];bracket:any[]}>({socket:[],bracket:[]});
  const [history, setHistory] = useState<StockTx[]>([]);
  const [bwoList, setBwoList] = useState<BWO[]>([]);
  const [ceramicWool, setCeramicWool] = useState<{stock_id:number;density_k:string;insert_type:string;thickness_mm:number;width_mm:number;length_mm:number;qty:number}[]>([]);
  const [extrudedSheet, setExtrudedSheet] = useState<{stock_id:number;thickness_mm:number;width_mm:number;qty:number}[]>([]);
  const [loading, setLoading] = useState(false);

  // 세라믹울/압출시트 입고 모달
  const [showCeramicModal, setShowCeramicModal] = useState(false);
  const [showExtrudedModal, setShowExtrudedModal] = useState(false);

  // Use modal
  const [showUseModal, setShowUseModal] = useState(false);
  const [useItems, setUseItems] = useState<{stock_type:'SOCKET'|'BRACKET';stock_id:number;label:string;max:number;qty:number}[]>([]);
  const [useMemo, setUseMemo] = useState('');
  const [useProjectId, setUseProjectId] = useState<number|null>(null);
  const [submittingUse, setSubmittingUse] = useState(false);

  // BWO detail modal
  const [selectedBwo, setSelectedBwo] = useState<{bwo:BWO;items:BWOItem[]}|null>(null);
  const [showBwoModal, setShowBwoModal] = useState(false);
  const [showNewBwoModal, setShowNewBwoModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  useEffect(() => {
    api.get<{data:Project[]}>('/projects').then(r => setProjects(r.data||[])).catch(()=>{});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pid = viewMode==='bysite'&&selectedProject ? `?project_id=${selectedProject}` : '';
      if (tab==='socket') {
        if (viewMode==='all') { const r=await api.get<{data:any}>('/socket-stock/summary'); setSummary({socket:r.data.socket||[],bracket:r.data.bracket||[]}); }
        else { const r=await api.get<{data:SocketStock[]}>(`/socket-stock${pid}`); setSocketStock(r.data||[]); }
      } else if (tab==='bracket') {
        if (viewMode==='all') { const r=await api.get<{data:any}>('/socket-stock/summary'); setSummary({socket:r.data.socket||[],bracket:r.data.bracket||[]}); }
        else { const r=await api.get<{data:BracketStock[]}>(`/bracket-stock${pid}`); setBracketStock(r.data||[]); }
      } else if (tab==='bending') {
        const qp = selectedProject ? `?project_id=${selectedProject}` : '';
        const r = await api.get<{data:BWO[]}>(`/bending-work-orders${qp}`);
        setBwoList(r.data||[]);
      } else if (tab==='ceramic') {
        const r = await api.get<{data:any[]}>('/ceramic-wool-stock');
        setCeramicWool(r.data||[]);
      } else if (tab==='extruded') {
        const r = await api.get<{data:any[]}>('/extruded-sheet-stock');
        setExtrudedSheet(r.data||[]);
      } else {
        const r=await api.get<{data:StockTx[]}>(`/stock-transactions?limit=100${selectedProject?`&project_id=${selectedProject}`:''}`);
        setHistory(r.data||[]);
      }
    } catch { toast.error('데이터 로드 실패'); }
    finally { setLoading(false); }
  }, [tab, viewMode, selectedProject]);

  useEffect(() => { loadData(); }, [loadData]);

  const openUseModal = (stockType:'SOCKET'|'BRACKET', stock:any) => {
    const label = stockType==='SOCKET' ? `${stock.product_type} (${stock.width_mm}×${stock.height_mm}×${stock.depth_mm})` : `GI ${stock.thickness_t}T×${stock.width_mm}×${stock.length_mm}`;
    setUseItems([{stock_type:stockType,stock_id:stock.stock_id,label,max:stock.qty,qty:1}]);
    setUseProjectId(stock.project_id);
    setUseMemo('');
    setShowUseModal(true);
  };

  const handleUseSubmit = async () => {
    const validItems = useItems.filter(i=>i.qty>0);
    if (!validItems.length) { toast.error('사용 수량을 입력하세요'); return; }
    if (!useProjectId) { toast.error('현장을 선택하세요'); return; }
    setSubmittingUse(true);
    try {
      await api.post('/socket-stock/use',{project_id:useProjectId,items:validItems.map(i=>({stock_type:i.stock_type,stock_id:i.stock_id,qty:i.qty})),worker_id:(user as any)?.worker_id,memo:useMemo||undefined});
      toast.success('사용 등록 완료!'); setShowUseModal(false); loadData();
    } catch(e:any){toast.error(e?.message||'등록 실패');}
    finally{setSubmittingUse(false);}
  };

  const openBwoDetail = async (bwo: BWO) => {
    const r = await api.get<{data:any}>(`/bending-work-orders/${bwo.bwo_id}`);
    setSelectedBwo({bwo, items: r.data.items||[]});
    setShowBwoModal(true);
  };

  const handleBwoStart = async (bwoId:number) => {
    try {
      await api.post(`/bending-work-orders/${bwoId}/start`,{});
      toast.success('작업을 시작했습니다.'); loadData();
      if (selectedBwo?.bwo.bwo_id===bwoId) setSelectedBwo(prev=>prev?{...prev,bwo:{...prev.bwo,status:'IN_PROGRESS'}}:null);
    } catch(e:any){toast.error(e?.message||'시작 실패');}
  };

  const handleBwoDelete = async (bwoId:number) => {
    if (!confirm('이 절곡 작업지시를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/bending-work-orders/${bwoId}`);
      toast.success('삭제 완료'); setShowBwoModal(false); loadData();
    } catch(e:any){toast.error(e?.message||'삭제 실패');}
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">소켓/평철 재고 관리</h1>
          <p className="mt-1 text-sm text-gray-500">입고 자재의 현장별·전체 재고 현황, 사용 등록, 절곡 작업지시</p>
        </div>
        <div className="flex gap-2">
          {tab==='bending' && (
            <button onClick={()=>setShowNewBwoModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm">
              ✂️ + 절곡 작업지시 생성
            </button>
          )}
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 shadow-sm">🔄 새로고침</button>
        </div>
      </div>

      {/* Use Modal */}
      {showUseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">사용 등록 (출고)</h3>
            <p className="text-sm text-gray-500 mb-4">사용 수량을 입력하면 재고에서 차감됩니다.</p>
            <div className="space-y-3">
              {useItems.map((item,idx)=>(
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1"><p className="text-sm font-semibold text-gray-800">{item.label}</p><p className="text-xs text-gray-400">보유: {item.max}개</p></div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={item.max} value={item.qty}
                      onChange={e=>setUseItems(prev=>prev.map((p,i)=>i===idx?{...p,qty:Math.min(Number(e.target.value),p.max)}:p))}
                      className="w-20 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <span className="text-sm text-gray-500">개</span>
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
                <input type="text" value={useMemo} onChange={e=>setUseMemo(e.target.value)} placeholder="사용 목적, 작업 번호 등"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={()=>setShowUseModal(false)} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleUseSubmit} disabled={submittingUse} className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-40">
                {submittingUse?'등록 중...':'사용 등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BWO Detail Modal */}
      {showBwoModal && selectedBwo && (
        <BwoDetailModal
          bwo={selectedBwo.bwo} items={selectedBwo.items}
          user={user}
          onClose={()=>setShowBwoModal(false)}
          onStart={()=>handleBwoStart(selectedBwo.bwo.bwo_id)}
          onDelete={()=>handleBwoDelete(selectedBwo.bwo.bwo_id)}
          onComplete={()=>{ setShowBwoModal(false); setShowCompleteModal(true); }}
          onRefresh={()=>openBwoDetail(selectedBwo.bwo)}
        />
      )}

      {/* New BWO Modal */}
      {showNewBwoModal && (
        <NewBwoModal
          projects={projects}
          user={user}
          onClose={()=>setShowNewBwoModal(false)}
          onCreated={()=>{ setShowNewBwoModal(false); loadData(); toast.success('절곡 작업지시 생성 완료!'); }}
        />
      )}

      {/* Complete Modal */}
      {showCompleteModal && selectedBwo && (
        <BwoCompleteModal
          bwo={selectedBwo.bwo} items={selectedBwo.items}
          user={user}
          onClose={()=>setShowCompleteModal(false)}
          onCompleted={()=>{ setShowCompleteModal(false); loadData(); toast.success('절곡 작업 완료! 재고가 차감되었습니다.'); }}
        />
      )}

      {/* Tab + View mode */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['socket','🔌 소켓 재고'],['bracket','🔩 평철 재고'],['bending','✂️ 절곡 작업지시'],['ceramic','🌡 세라믹울 재고'],['extruded','📦 압출시트 재고'],['history','📋 입출고 이력']] as [TabType,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===key?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {(tab==='socket'||tab==='bracket') && (
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([['all','전체 합산'],['bysite','현장별']] as [ViewMode,string][]).map(([m,l])=>(
                <button key={m} onClick={()=>setViewMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode===m?'bg-white text-gray-900 shadow-sm':'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          )}
          {(viewMode==='bysite'||tab==='history'||tab==='bending') && (
            <select value={selectedProject||''} onChange={e=>setSelectedProject(e.target.value?parseInt(e.target.value):null)}
              className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">전체 현장</option>
              {projects.map(p=><option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm py-16 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3"/>
          <span className="text-sm text-gray-400">로드 중...</span>
        </div>
      ) : tab==='socket' ? (
        <SocketStockView viewMode={viewMode} summary={summary.socket} stockList={socketStock} onUse={s=>openUseModal('SOCKET',s)}/>
      ) : tab==='bracket' ? (
        <BracketStockView viewMode={viewMode} summary={summary.bracket} stockList={bracketStock} onUse={s=>openUseModal('BRACKET',s)}/>
      ) : tab==='bending' ? (
        <BendingWorkOrderView bwoList={bwoList} onOpen={openBwoDetail}/>
      ) : tab==='ceramic' ? (
        <CeramicWoolView data={ceramicWool} onReceive={()=>setShowCeramicModal(true)} onRefresh={loadData}/>
      ) : tab==='extruded' ? (
        <ExtrudedSheetView data={extrudedSheet} onReceive={()=>setShowExtrudedModal(true)} onRefresh={loadData}/>
      ) : (
        <HistoryView history={history}/>
      )}
      {showCeramicModal && <CeramicReceiveModal onClose={()=>setShowCeramicModal(false)} onDone={()=>{setShowCeramicModal(false);loadData();}} workerId={user?.worker_id}/>}
      {showExtrudedModal && <ExtrudedReceiveModal onClose={()=>setShowExtrudedModal(false)} onDone={()=>{setShowExtrudedModal(false);loadData();}} workerId={user?.worker_id}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 절곡 작업지시 목록 뷰
// ─────────────────────────────────────────────────────────────────────────────
function BendingWorkOrderView({ bwoList, onOpen }: { bwoList:BWO[]; onOpen:(bwo:BWO)=>void; }) {
  if (bwoList.length===0)
    return <EmptyState icon="✂️" msg="절곡 작업지시가 없습니다" sub="오른쪽 상단의 '절곡 작업지시 생성' 버튼으로 작성하세요"/>;

  return (
    <div className="space-y-3">
      {bwoList.map(bwo=>{
        const st = BWO_STATUS[bwo.status]||{label:bwo.status,color:'bg-gray-100 text-gray-600',icon:'?'};
        return (
          <div key={bwo.bwo_id} onClick={()=>onOpen(bwo)}
            className="bg-white border rounded-xl shadow-sm px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-violet-200 transition-all">
            <div className="flex-shrink-0 w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-2xl">✂️</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-800 text-sm">{bwo.bwo_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>{st.icon} {st.label}</span>
              </div>
              <p className="text-sm text-gray-700 truncate">{bwo.project_name||'-'}</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                <span>📦 {bwo.item_count||0}품목</span>
                <span>🗓 {bwo.wo_date?new Date(bwo.wo_date).toLocaleDateString('ko-KR'):'-'}</span>
                {bwo.delivery_date && <span>🚚 {new Date(bwo.delivery_date).toLocaleDateString('ko-KR')}</span>}
                {bwo.worker_name && <span>👷 {bwo.worker_name}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-violet-700">{bwo.total_order_qty||0}<span className="text-xs font-normal text-gray-400">개</span></p>
              <p className="text-xs text-gray-400">지시 수량</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BWO 상세 모달
// ─────────────────────────────────────────────────────────────────────────────
function BwoDetailModal({bwo,items,user,onClose,onStart,onDelete,onComplete,onRefresh}:{
  bwo:BWO;items:BWOItem[];user:any;
  onClose:()=>void;onStart:()=>void;onDelete:()=>void;onComplete:()=>void;onRefresh:()=>void;
}) {
  const st = BWO_STATUS[bwo.status]||{label:bwo.status,color:'bg-gray-100 text-gray-600',icon:'?'};
  const totalQty = items.reduce((s,i)=>s+i.order_qty,0);
  const isPlanned = bwo.status==='PLANNED';
  const isInProgress = bwo.status==='IN_PROGRESS';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-white">✂️ {bwo.bwo_number}</h2>
            <p className="text-violet-200 text-sm mt-0.5">{bwo.project_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${st.color}`}>{st.icon} {st.label}</span>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 py-3 border-b bg-gray-50 flex gap-6 text-sm">
          <span className="text-gray-500">📅 작업일: <b className="text-gray-800">{bwo.wo_date?new Date(bwo.wo_date).toLocaleDateString('ko-KR'):'-'}</b></span>
          {bwo.delivery_date&&<span className="text-gray-500">🚚 납기: <b className="text-gray-800">{new Date(bwo.delivery_date).toLocaleDateString('ko-KR')}</b></span>}
          {bwo.worker_name&&<span className="text-gray-500">👷 작업자: <b className="text-gray-800">{bwo.worker_name}</b></span>}
          <span className="ml-auto text-violet-700 font-bold">총 {totalQty}개</span>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-xs text-gray-400">
                <th className="px-4 py-2.5 text-center w-8">No</th>
                <th className="px-4 py-2.5 text-center">재질</th>
                <th className="px-4 py-2.5 text-center text-orange-500">두께(T)</th>
                <th className="px-4 py-2.5 text-center text-orange-500">폭(mm)</th>
                <th className="px-4 py-2.5 text-center text-orange-500">길이(mm)</th>
                <th className="px-4 py-2.5 text-center">작업 유형</th>
                <th className="px-4 py-2.5 text-right text-violet-600 font-semibold">지시수량</th>
                <th className="px-4 py-2.5 text-right text-green-600 font-semibold">완료수량</th>
                <th className="px-4 py-2.5 text-center">재고</th>
                <th className="px-4 py-2.5 text-left">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item,idx)=>(
                <tr key={item.bwoi_id} className={`hover:bg-violet-50/20 ${item.width_mm>=200?'bg-amber-50/30':''}`}>
                  <td className="px-4 py-2.5 text-center text-xs text-gray-400">{idx+1}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{item.material}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-orange-600">{item.thickness_t}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{item.width_mm}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{item.length_mm}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-semibold">{item.bending_type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-violet-700">{item.order_qty}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">{item.completed_qty}</td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {item.stock_qty!=null?(
                      <span className={`px-2 py-0.5 rounded ${item.stock_qty>=item.order_qty?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                        재고 {item.stock_qty}
                      </span>
                    ):'-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{item.remarks||'-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-violet-50 border-t-2 border-violet-200">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-bold text-violet-800">합계</td>
                <td className="px-4 py-2.5 text-right font-bold text-violet-700">{totalQty}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-700">{items.reduce((s,i)=>s+i.completed_qty,0)}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          {isPlanned && (
            <>
              <button onClick={onStart} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600">⚙️ 작업 시작</button>
              <button onClick={onDelete} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100">🗑 삭제</button>
            </>
          )}
          {isInProgress && (
            <button onClick={onComplete} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">✅ 작업 완료</button>
          )}
          <button onClick={onClose} className="ml-auto px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-100">닫기</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 신규 BWO 생성 모달
// ─────────────────────────────────────────────────────────────────────────────
function NewBwoModal({projects,user,onClose,onCreated}:{projects:Project[];user:any;onClose:()=>void;onCreated:()=>void;}) {
  const [projectId, setProjectId] = useState<number|null>(null);
  const [woDate, setWoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [bracketStock, setBracketStock] = useState<BracketStock[]>([]);
  const [items, setItems] = useState<{stock_id:number;material:string;thickness_t:number;width_mm:number;length_mm:number;order_qty:number;bending_type:string;max:number}[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(()=>{
    if (!projectId) { setBracketStock([]); setItems([]); return; }
    setLoadingStock(true);
    api.get<{data:BracketStock[]}>(`/bracket-stock?project_id=${projectId}`)
      .then(r=>{ const stocks=r.data||[]; setBracketStock(stocks); setItems(stocks.map(s=>({stock_id:s.stock_id,material:s.material||'GI',thickness_t:Number(s.thickness_t),width_mm:s.width_mm,length_mm:s.length_mm,order_qty:s.qty,bending_type:'절곡',max:s.qty}))); })
      .catch(()=>toast.error('평철 재고 로드 실패'))
      .finally(()=>setLoadingStock(false));
  },[projectId]);

  const handleSubmit = async () => {
    if (!projectId) { toast.error('현장을 선택하세요'); return; }
    const validItems = items.filter(i=>i.order_qty>0);
    if (!validItems.length) { toast.error('절곡 항목이 없습니다'); return; }
    const proj = projects.find(p=>p.project_id===projectId);
    setSubmitting(true);
    try {
      await api.post('/bending-work-orders',{
        project_id:projectId, project_name:proj?.project_name,
        wo_date:woDate||null, delivery_date:deliveryDate||null,
        worker_name:workerName||null, remarks:remarks||null,
        items:validItems.map(i=>({stock_id:i.stock_id,material:i.material,thickness_t:i.thickness_t,width_mm:i.width_mm,length_mm:i.length_mm,order_qty:i.order_qty,bending_type:i.bending_type})),
        created_by:(user as any)?.worker_id,
      });
      onCreated();
    } catch(e:any){toast.error(e?.message||'생성 실패');}
    finally{setSubmitting(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-violet-700 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">✂️ 절곡 작업지시 생성</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">현장 선택 <span className="text-red-500">*</span></label>
              <select value={projectId||''} onChange={e=>setProjectId(e.target.value?parseInt(e.target.value):null)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">-- 현장을 선택하세요 --</option>
                {projects.map(p=><option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">작업일</label>
              <input type="date" value={woDate} onChange={e=>setWoDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">납기일</label>
              <input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">작업자</label>
              <input type="text" value={workerName} onChange={e=>setWorkerName(e.target.value)} placeholder="작업자명"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">비고</label>
              <input type="text" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="특이사항"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"/>
            </div>
          </div>

          {/* 평철 항목 */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">🔩 절곡 항목 (평철 재고에서 자동 로드)</h3>
              {projectId && <span className="text-xs text-violet-600 font-semibold">{items.filter(i=>i.order_qty>0).length}품목 선택됨</span>}
            </div>
            {!projectId ? (
              <div className="text-center py-8 text-gray-400 text-sm">현장을 선택하면 평철 재고가 자동으로 로드됩니다</div>
            ) : loadingStock ? (
              <div className="text-center py-8 text-gray-400 text-sm">재고 로드 중...</div>
            ) : items.length===0 ? (
              <div className="text-center py-8 text-red-400 text-sm">해당 현장의 평철 재고가 없습니다</div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-400">
                      <th className="px-3 py-2.5 text-center">재질</th>
                      <th className="px-3 py-2.5 text-center text-orange-500">두께</th>
                      <th className="px-3 py-2.5 text-center text-orange-500">폭</th>
                      <th className="px-3 py-2.5 text-center text-orange-500">길이</th>
                      <th className="px-3 py-2.5 text-center">작업 유형</th>
                      <th className="px-3 py-2.5 text-center text-violet-600">지시수량</th>
                      <th className="px-3 py-2.5 text-center text-gray-400">재고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item,idx)=>(
                      <tr key={idx} className={`${item.order_qty===0?'opacity-40':''} ${item.width_mm>=200?'bg-amber-50/40':''}`}>
                        <td className="px-3 py-2 text-center text-gray-600">{item.material}</td>
                        <td className="px-3 py-2 text-center font-mono text-orange-600">{item.thickness_t}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-orange-700">{item.width_mm}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-orange-700">{item.length_mm}</td>
                        <td className="px-3 py-2 text-center">
                          <select value={item.bending_type} onChange={e=>setItems(prev=>prev.map((p,i)=>i===idx?{...p,bending_type:e.target.value}:p))}
                            className="text-xs border rounded px-2 py-1 focus:outline-none">
                            <option>절곡</option>
                            <option>타공</option>
                            <option>절곡+타공</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={item.max} value={item.order_qty}
                            onChange={e=>setItems(prev=>prev.map((p,i)=>i===idx?{...p,order_qty:Math.min(parseInt(e.target.value)||0,p.max)}:p))}
                            className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono font-bold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-400">{item.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} disabled={submitting||!projectId}
            className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-40">
            {submitting?'생성 중...':'✂️ 작업지시 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 작업 완료 모달 (실적 입력 + 재고 차감)
// ─────────────────────────────────────────────────────────────────────────────
function BwoCompleteModal({bwo,items,user,onClose,onCompleted}:{bwo:BWO;items:BWOItem[];user:any;onClose:()=>void;onCompleted:()=>void;}) {
  const [completedItems, setCompletedItems] = useState(items.map(i=>({bwoi_id:i.bwoi_id,completed_qty:i.order_qty})));
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.post(`/bending-work-orders/${bwo.bwo_id}/complete`,{
        completed_items:completedItems,
        worker_id:(user as any)?.worker_id,
      });
      onCompleted();
    } catch(e:any){toast.error(e?.message||'완료 처리 실패');}
    finally{setSubmitting(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">✅ 절곡 작업 완료</h2>
            <p className="text-green-200 text-sm mt-0.5">완료 수량 확인 후 저장 시 평철 재고가 차감됩니다</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            ⚠️ 완료 처리 후 평철 재고가 실제 완료 수량만큼 차감됩니다. 신중하게 확인하세요.
          </div>
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-400">
                <th className="px-4 py-2.5 text-center w-8">No</th>
                <th className="px-4 py-2.5 text-center">두께</th>
                <th className="px-4 py-2.5 text-center">폭</th>
                <th className="px-4 py-2.5 text-center">길이</th>
                <th className="px-4 py-2.5 text-center">작업유형</th>
                <th className="px-4 py-2.5 text-center">지시</th>
                <th className="px-4 py-2.5 text-center text-green-600 font-semibold">완료수량</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item,idx)=>(
                <tr key={item.bwoi_id} className="hover:bg-green-50/20">
                  <td className="px-4 py-2.5 text-center text-xs text-gray-400">{idx+1}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-orange-600">{item.thickness_t}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{item.width_mm}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{item.length_mm}</td>
                  <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-xs">{item.bending_type}</span></td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{item.order_qty}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="number" min={0} max={item.order_qty}
                      value={completedItems[idx]?.completed_qty??item.order_qty}
                      onChange={e=>setCompletedItems(prev=>prev.map((p,i)=>i===idx?{...p,completed_qty:Math.min(parseInt(e.target.value)||0,item.order_qty)}:p))}
                      className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleComplete} disabled={submitting}
            className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40">
            {submitting?'처리 중...':'✅ 완료 처리 (재고 차감)'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 소켓 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function SocketStockView({ viewMode, summary, stockList, onUse }: { viewMode:ViewMode; summary:any[]; stockList:SocketStock[]; onUse:(s:any)=>void; }) {
  const data = viewMode==='all' ? summary : stockList;
  if (data.length===0) return <EmptyState icon="🔌" msg="소켓 재고가 없습니다" sub="발주서 입고 처리 후 자동 등록됩니다"/>;
  const grouped = new Map<string,any[]>();
  for (const r of data) { if (!grouped.has(r.product_type)) grouped.set(r.product_type,[]); grouped.get(r.product_type)!.push(r); }
  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([code,rows])=>{
        const clr = STRUCT_COLORS[code]||'bg-gray-100 text-gray-700';
        const total = rows.reduce((s,r)=>s+(viewMode==='all'?Number(r.total_qty):r.qty),0);
        return (
          <div key={code} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/80">
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${clr}`}>{code}</span>
              <span className="text-sm font-bold text-blue-600">합계 {total}ea</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50"><tr className="text-xs text-gray-400">
                {viewMode==='bysite'&&<th className="px-4 py-2.5 text-left">현장</th>}
                <th className="px-4 py-2.5 text-center text-blue-500">가로(mm)</th>
                <th className="px-4 py-2.5 text-center text-blue-500">세로(mm)</th>
                <th className="px-4 py-2.5 text-center text-blue-500">폭(mm)</th>
                <th className="px-4 py-2.5 text-right text-green-600 font-semibold">재고수량</th>
                {viewMode==='bysite'&&<th className="px-4 py-2.5 text-center">사용등록</th>}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r,idx)=>(
                  <tr key={idx} className="hover:bg-blue-50/20">
                    {viewMode==='bysite'&&<td className="px-4 py-2.5 text-sm text-gray-600">{r.project_name||'-'}</td>}
                    <td className="px-4 py-2.5 text-center font-mono font-semibold text-blue-700">{r.width_mm}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-semibold text-blue-700">{r.height_mm}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-blue-500">{r.depth_mm}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">
                      <span className={`inline-block px-2 py-0.5 rounded-lg ${r.qty<=5?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                        {viewMode==='all'?Number(r.total_qty):r.qty} ea
                      </span>
                    </td>
                    {viewMode==='bysite'&&<td className="px-4 py-2.5 text-center"><button onClick={()=>onUse(r)} className="px-3 py-1 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 border border-orange-200">사용 등록</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 평철 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function BracketStockView({ viewMode, summary, stockList, onUse }: { viewMode:ViewMode; summary:any[]; stockList:BracketStock[]; onUse:(s:any)=>void; }) {
  const data = viewMode==='all' ? summary : stockList;
  if (data.length===0) return <EmptyState icon="🔩" msg="평철 재고가 없습니다" sub="소켓 발주서 입고 처리 후 자동 등록됩니다"/>;
  const total = data.reduce((s,r)=>s+(viewMode==='all'?Number(r.total_qty):r.qty),0);
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-orange-50/80">
        <span className="text-sm font-bold text-orange-700">🔩 평철(브라켓) 재고 현황</span>
        <span className="text-sm font-bold text-orange-600">총 {total}개</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50/50"><tr className="text-xs text-gray-400">
          <th className="px-4 py-2.5 text-center w-10">No</th>
          {viewMode==='bysite'&&<th className="px-4 py-2.5 text-left">현장</th>}
          <th className="px-4 py-2.5 text-center">재질</th>
          <th className="px-4 py-2.5 text-center text-orange-500">두께(T)</th>
          <th className="px-4 py-2.5 text-center text-orange-500">폭(mm)</th>
          <th className="px-4 py-2.5 text-center text-orange-500">길이(mm)</th>
          <th className="px-4 py-2.5 text-right text-green-600 font-semibold">재고수량</th>
          {viewMode==='bysite'&&<th className="px-4 py-2.5 text-center">사용등록</th>}
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((r,idx)=>(
            <tr key={idx} className={`hover:bg-orange-50/20 ${r.width_mm>=200?'bg-amber-50/30':''}`}>
              <td className="px-4 py-2.5 text-center text-xs text-gray-400">{idx+1}</td>
              {viewMode==='bysite'&&<td className="px-4 py-2.5 text-sm text-gray-600">{r.project_name||'-'}</td>}
              <td className="px-4 py-2.5 text-center text-gray-600">{r.material||'GI'}</td>
              <td className="px-4 py-2.5 text-center font-mono text-orange-600">{r.thickness_t}</td>
              <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{r.width_mm}</td>
              <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-700">{r.length_mm}</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">
                <span className={`inline-block px-2 py-0.5 rounded-lg ${(viewMode==='all'?Number(r.total_qty):r.qty)<=10?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                  {viewMode==='all'?Number(r.total_qty):r.qty} 개
                </span>
              </td>
              {viewMode==='bysite'&&<td className="px-4 py-2.5 text-center"><button onClick={()=>onUse(r)} className="px-3 py-1 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100 border border-orange-200">사용 등록</button></td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-orange-100 border-t-2 border-orange-200">
          <tr>
            <td colSpan={viewMode==='bysite'?7:5} className="px-4 py-2.5 text-right font-bold text-orange-800 text-sm">총 합계</td>
            <td className="px-4 py-2.5 text-right font-bold text-green-700">{total} 개</td>
            {viewMode==='bysite'&&<td/>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 이력 뷰
// ─────────────────────────────────────────────────────────────────────────────
function HistoryView({ history }: { history:StockTx[] }) {
  if (history.length===0) return <EmptyState icon="📋" msg="입출고 이력이 없습니다" sub="입고 또는 사용 등록 시 이력이 기록됩니다"/>;
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">입출고 이력 (최근 100건)</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50"><tr className="text-xs text-gray-400">
            <th className="px-4 py-2.5 text-left">일시</th>
            <th className="px-4 py-2.5 text-center">유형</th>
            <th className="px-4 py-2.5 text-center">구분</th>
            <th className="px-4 py-2.5 text-left">현장</th>
            <th className="px-4 py-2.5 text-right">수량</th>
            <th className="px-4 py-2.5 text-left">출처</th>
            <th className="px-4 py-2.5 text-left">메모</th>
            <th className="px-4 py-2.5 text-left">처리자</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {history.map(tx=>(
              <tr key={tx.tx_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(tx.created_at).toLocaleDateString('ko-KR')} {new Date(tx.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
                </td>
                <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${tx.stock_type==='SOCKET'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{tx.stock_type==='SOCKET'?'소켓':'평철'}</span></td>
                <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-xs font-bold ${tx.tx_type==='IN'?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{tx.tx_type==='IN'?'↓ 입고':'↑ 출고'}</span></td>
                <td className="px-4 py-2.5 text-sm text-gray-700">{tx.project_name||'-'}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold"><span className={tx.tx_type==='IN'?'text-green-700':'text-red-600'}>{tx.tx_type==='IN'?'+':'-'}{tx.qty}</span></td>
                <td className="px-4 py-2.5 text-xs text-gray-400">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${tx.source_type==='BENDING_WO'?'bg-violet-100 text-violet-700':tx.source_type==='SOCKET_ORDER'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>
                    {tx.source_type==='BENDING_WO'?'절곡작업':tx.source_type==='SOCKET_ORDER'?'소켓발주':tx.source_type||'-'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-500 max-w-[160px] truncate">{tx.memo||'-'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{tx.created_by_name||'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ icon, msg, sub }: { icon:string; msg:string; sub:string }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm py-20 flex flex-col items-center text-gray-400">
      <span className="text-5xl mb-4">{icon}</span>
      <p className="font-semibold text-gray-500">{msg}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 세라믹울 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function CeramicWoolView({ data, onReceive, onRefresh }: { data:any[]; onReceive:()=>void; onRefresh:()=>void }) {
  const total = data.reduce((s,r)=>s+Number(r.qty),0);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">전체 세라믹울 재고</p>
          <p className="text-2xl font-bold text-gray-900">{total.toFixed(2)} <span className="text-sm font-normal text-gray-500">롤</span></p>
          <p className="text-xs text-gray-400 mt-1">{data.length}개 규격</p>
        </div>
        <button onClick={onReceive} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors">＋ 세라믹울 입고</button>
      </div>
      {data.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">🌡</p><p className="font-medium text-gray-500">세라믹울 재고 없음</p>
          <p className="text-sm mt-1">입고 처리 후 재고가 등록됩니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-teal-50 text-teal-800">
              <tr>{['밀도','타입','두께(mm)','폭(mm)','롤길이(mm)','재고(롤)'].map(h=><th key={h} className="px-4 py-3 text-left font-semibold text-xs">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r,i)=>(
                <tr key={r.stock_id} className={i%2===0?'bg-white':'bg-teal-50/30'}>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-bold">{r.density_k}</span></td>
                  <td className="px-4 py-2.5 text-gray-600">{r.insert_type}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold">{r.thickness_mm}T</td>
                  <td className="px-4 py-2.5 font-mono font-semibold">{r.width_mm}W</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500">{Number(r.length_mm)>0?Number(r.length_mm).toLocaleString():'-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold font-mono text-base ${Number(r.qty)<=2?'text-red-600':Number(r.qty)<=5?'text-amber-600':'text-gray-900'}`}>{Number(r.qty).toFixed(2)}</span>
                    <span className="text-xs text-gray-400 ml-1">롤</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 압출시트 재고 뷰
// ─────────────────────────────────────────────────────────────────────────────
function ExtrudedSheetView({ data, onReceive, onRefresh }: { data:any[]; onReceive:()=>void; onRefresh:()=>void }) {
  const total = data.reduce((s,r)=>s+Number(r.qty),0);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">전체 압출시트 재고</p>
          <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()} <span className="text-sm font-normal text-gray-500">장</span></p>
          <p className="text-xs text-gray-400 mt-1">{data.length}개 규격</p>
        </div>
        <button onClick={onReceive} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">＋ 압출시트 입고</button>
      </div>
      {data.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📦</p><p className="font-medium text-gray-500">압출시트 재고 없음</p>
          <p className="text-sm mt-1">압출 공정 완료 후 입고 등록해 주세요</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-indigo-50 text-indigo-800">
              <tr>{['두께(mm)','폭(mm)','재고(장)'].map(h=><th key={h} className="px-4 py-3 text-left font-semibold text-xs">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((r,i)=>(
                <tr key={r.stock_id} className={i%2===0?'bg-white':'bg-indigo-50/30'}>
                  <td className="px-4 py-2.5 font-mono font-semibold">{r.thickness_mm}T</td>
                  <td className="px-4 py-2.5 font-mono font-semibold">{r.width_mm}W</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold font-mono text-base ${Number(r.qty)<=10?'text-red-600':Number(r.qty)<=30?'text-amber-600':'text-gray-900'}`}>{Number(r.qty).toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-1">장</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CeramicReceiveModal({ onClose, onDone, workerId }: { onClose:()=>void; onDone:()=>void; workerId?:number }) {
  const [rows, setRows] = useState([{density_k:'96K',insert_type:'롤',thickness_mm:25,width_mm:200,length_mm:7320,qty:1}]);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addRow = () => setRows(p=>[...p,{density_k:'96K',insert_type:'롤',thickness_mm:25,width_mm:200,length_mm:7320,qty:1}]);
  const removeRow = (i:number) => setRows(p=>p.filter((_,idx)=>idx!==i));
  const updateRow = (i:number,k:string,v:any) => setRows(p=>p.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const handleSubmit = async () => {
    setSubmitting(true);
    try { await api.post('/ceramic-wool-stock/receive',{items:rows,memo}); toast.success('세라믹울 입고 완료!'); onDone(); }
    catch { toast.error('입고 실패'); } finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-teal-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">🌡 세라믹울 입고</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-400">
              {['밀도','타입','두께mm','폭mm','롤길이mm','수량(롤)',''].map((h,i)=><span key={i} className="text-center">{h}</span>)}
            </div>
            {rows.map((row,i)=>(
              <div key={i} className="grid grid-cols-7 gap-2 items-center">
                <select value={row.density_k} onChange={e=>updateRow(i,'density_k',e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
                  {['96K','100K','128K'].map(d=><option key={d}>{d}</option>)}
                </select>
                <select value={row.insert_type} onChange={e=>updateRow(i,'insert_type',e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
                  {['롤','삽입'].map(t=><option key={t}>{t}</option>)}
                </select>
                <input type="number" value={row.thickness_mm} onChange={e=>updateRow(i,'thickness_mm',+e.target.value||0)} className="border rounded-lg px-2 py-1.5 text-sm text-center"/>
                <input type="number" value={row.width_mm} onChange={e=>updateRow(i,'width_mm',+e.target.value||0)} className="border rounded-lg px-2 py-1.5 text-sm text-center"/>
                <input type="number" value={row.length_mm} onChange={e=>updateRow(i,'length_mm',+e.target.value||0)} className="border rounded-lg px-2 py-1.5 text-sm text-center"/>
                <input type="number" step="0.01" value={row.qty} onChange={e=>updateRow(i,'qty',parseFloat(e.target.value)||0)} className="border rounded-lg px-2 py-1.5 text-sm text-center"/>
                <button onClick={()=>removeRow(i)} className="text-red-400 hover:text-red-600 text-lg text-center">🗑</button>
              </div>
            ))}
          </div>
          <button onClick={addRow} className="w-full border-2 border-dashed border-teal-300 text-teal-600 rounded-xl py-2 text-sm hover:bg-teal-50">＋ 행 추가</button>
          <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="비고" className="w-full border rounded-xl px-3 py-2 text-sm"/>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-5 py-2 border rounded-xl text-sm hover:bg-gray-50">취소</button>
            <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">{submitting?'등록 중...':'입고 등록'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtrudedReceiveModal({ onClose, onDone, workerId }: { onClose:()=>void; onDone:()=>void; workerId?:number }) {
  const [rows, setRows] = useState([{thickness_mm:25,width_mm:200,qty:100}]);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addRow = () => setRows(p=>[...p,{thickness_mm:25,width_mm:200,qty:100}]);
  const removeRow = (i:number) => setRows(p=>p.filter((_,idx)=>idx!==i));
  const updateRow = (i:number,k:string,v:any) => setRows(p=>p.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const handleSubmit = async () => {
    setSubmitting(true);
    try { await api.post('/extruded-sheet-stock/receive',{items:rows,memo}); toast.success('압출시트 입고 완료!'); onDone(); }
    catch { toast.error('입고 실패'); } finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">📦 압출시트 입고</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700">💡 압출 공정 완료 후 차열시트를 두께×폭별로 등록하세요</div>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1 text-[10px] text-gray-400">
              {['두께(mm)','폭(mm)','수량(장)',''].map((h,i)=><span key={i} className="text-center">{h}</span>)}
            </div>
            {rows.map((row,i)=>(
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <input type="number" value={row.thickness_mm} onChange={e=>updateRow(i,'thickness_mm',+e.target.value||0)} className="border rounded-lg px-3 py-2 text-sm text-center"/>
                <input type="number" value={row.width_mm} onChange={e=>updateRow(i,'width_mm',+e.target.value||0)} className="border rounded-lg px-3 py-2 text-sm text-center"/>
                <input type="number" value={row.qty} onChange={e=>updateRow(i,'qty',+e.target.value||0)} className="border rounded-lg px-3 py-2 text-sm text-center"/>
                <button onClick={()=>removeRow(i)} className="text-red-400 hover:text-red-600 text-lg text-center">🗑</button>
              </div>
            ))}
          </div>
          <button onClick={addRow} className="w-full border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl py-2 text-sm hover:bg-indigo-50">＋ 행 추가</button>
          <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="비고" className="w-full border rounded-xl px-3 py-2 text-sm"/>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-5 py-2 border rounded-xl text-sm hover:bg-gray-50">취소</button>
            <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">{submitting?'등록 중...':'입고 등록'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
