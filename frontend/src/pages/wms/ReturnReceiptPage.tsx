import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useInspectors } from '@/hooks/useInspectors';
import { PageHeader } from '@/components/shared/PageHeader';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';
import {
  RotateCcw, Search, Building2, FileText, Package, ArrowRight, Printer, CheckCircle2,
  Calendar, UserCheck, ShieldCheck, RefreshCw, Layers, MapPin
} from 'lucide-react';

interface ProjectOption {
  project_id: number;
  project_name: string;
  client_name?: string;
}

interface PurchaseOrderOption {
  po_id: number;
  po_no: string;
  order_date?: string;
}

interface ShippedStructureItem {
  wo_id: number;
  structure_lot: string;
  struct_name: string;
  struct_code: string;
  spec: string;
  shipped_qty: number;
  project_id: number;
  project_name: string;
  po_id: number;
  po_no: string;
  shipped_at: string;
}

interface DecomposedComponentItem {
  parent_structure_lot: string;
  original_component_lot: string;
  return_lot: string; // RJ251010FL01, R251025CW001
  target_category: 'ASM_SOCKET' | 'RAW_WOOL' | 'RAW_GLASS';
  item_name: string;
  spec: string;
  qty: number;
  unit: string;
  location: string;
}

interface ReturnLedgerItem {
  return_id: number;
  return_no: string;
  project_id: number;
  project_name: string;
  po_no?: string;
  shipment_no?: string;
  returned_at: string;
  inspector: string;
  memo?: string;
  items: DecomposedComponentItem[];
}

export function ReturnReceiptPage() {
  const rawInspectors = useInspectors();
  const inspectorList: string[] = Array.isArray(rawInspectors) 
    ? rawInspectors 
    : (Array.isArray((rawInspectors as any)?.inspectors) 
        ? (rawInspectors as any).inspectors 
        : ['김정용 책임', '최진영 책임', '김봉민 책임', '임병용 파트장', '이동민 파트장']);

  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LIST'>('REGISTER');

  // ── 검색 조건 상태 (프로젝트 종속 필터링) ─────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── 출고된 완제품 구조체 목록 ─────────────────────────────────────────
  const [shippedStructures, setShippedStructures] = useState<ShippedStructureItem[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<ShippedStructureItem | null>(null);

  // ── 완제품 분해(Decomposition) 항목 ─────────────────────────────────────
  const [decomposedItems, setDecomposedItems] = useState<DecomposedComponentItem[]>([]);
  const [loadingDecompose, setLoadingDecompose] = useState(false);

  // ── 입력 폼 상태 ─────────────────────────────────────────────────────
  const [inspectorName, setInspectorName] = useState('김정용 책임');
  const [returnMemo, setReturnMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── R-로트 라벨 인쇄 모달 ─────────────────────────────────────────────
  const [printLabelData, setPrintLabelData] = useState<any | null>(null);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);

  // ── 반품 대장 조회 & A4 결재 인쇄 상태 ─────────────────────────────────
  const [returnLedger, setReturnLedger] = useState<ReturnLedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterProjectName, setFilterProjectName] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportInspector, setReportInspector] = useState('김정용 책임');

  // 초기 프로젝트 목록 로드
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await api.get<{ data: ProjectOption[] }>('/returns/projects');
      setProjects(res.data || []);
    } catch {
      // alert('프로젝트 목록을 불러오지 못했습니다.');
    }
  };

  // 프로젝트 선택 시 종속 발주서(PO) 목록 로드 (100% 종속 필터링)
  useEffect(() => {
    if (selectedProjectId) {
      loadPurchaseOrders(Number(selectedProjectId));
    } else {
      setPurchaseOrders([]);
      setSelectedPoId('');
    }
    loadShippedStructures();
  }, [selectedProjectId]);

  const loadPurchaseOrders = async (projId: number) => {
    try {
      const res = await api.get<{ data: PurchaseOrderOption[] }>(`/returns/projects/${projId}/pos`);
      setPurchaseOrders(res.data || []);
    } catch {}
  };

  // 출고 완제품 구조체 LOT 검색
  const loadShippedStructures = async () => {
    setLoadingStructures(true);
    try {
      const params: any = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      if (selectedPoId) params.po_id = selectedPoId;
      if (searchQuery) params.query = searchQuery;

      const res = await api.get<{ data: ShippedStructureItem[] }>('/returns/shipments', { params });
      setShippedStructures(res.data || []);
    } catch {
      setShippedStructures([]);
    } finally {
      setLoadingStructures(false);
    }
  };

  // 구조체 선택 시 C302 계보 역추적 자동 분해
  const handleSelectStructure = async (st: ShippedStructureItem) => {
    setSelectedStructure(st);
    setLoadingDecompose(true);
    try {
      const res = await api.get<{ items: DecomposedComponentItem[] }>(`/returns/decompose/${encodeURIComponent(st.structure_lot)}`);
      setDecomposedItems(res.items || []);
    } catch {
      alert('구조체 분해 계보 정보를 불러오지 못했습니다.');
    } finally {
      setLoadingDecompose(false);
    }
  };

  // 수량 및 창고 수정
  const handleItemQtyChange = (idx: number, qty: number) => {
    setDecomposedItems(prev => prev.map((item, i) => i === idx ? { ...item, qty: Math.max(1, qty) } : item));
  };

  const handleItemLocationChange = (idx: number, loc: string) => {
    setDecomposedItems(prev => prev.map((item, i) => i === idx ? { ...item, location: loc } : item));
  };

  // 반품 입고 처리 확정
  const handleSubmitReturn = async () => {
    if (!selectedStructure) {
      alert('반품 처리할 완제품 구조체 LOT를 선택해 주세요.');
      return;
    }
    if (decomposedItems.length === 0) {
      alert('분해된 구성품 항목이 없습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_id: selectedStructure.project_id,
        project_name: selectedStructure.project_name,
        po_id: selectedStructure.po_id,
        po_no: selectedStructure.po_no,
        shipment_no: selectedStructure.structure_lot,
        inspector: inspectorName,
        memo: returnMemo,
        items: decomposedItems
      };

      const res = await api.post<{ success: boolean; return_no: string; message: string }>('/returns/receipt', payload);
      alert(`[반품입고 완료] 반품번호 ${res.return_no}가 정상 등록되었습니다!\nR-로트 재고로 (+) 입고 되었습니다.`);
      
      // 즉시 R-로트 라벨 인쇄용 첫번째 항목 설정
      const firstRItem = decomposedItems[0];
      if (firstRItem) {
        setPrintLabelData({
          lot_number: firstRItem.return_lot, // RJ251010FL01 또는 R251025CW001
          item_name: firstRItem.item_name,
          category: firstRItem.target_category === 'ASM_SOCKET' ? '조립소켓' : '원부자재',
          spec: firstRItem.spec,
          thickness: firstRItem.spec,
          qty_current: firstRItem.qty,
          unit: firstRItem.unit,
          received_date: new Date().toISOString().slice(0, 10),
          location: firstRItem.location,
          location_name: firstRItem.location
        });
        setShowLabelPrinter(true);
      }

      // 초기화
      setSelectedStructure(null);
      setDecomposedItems([]);
      setReturnMemo('');
      loadShippedStructures();
    } catch (err: any) {
      alert(err.response?.data?.error || '반품 입고 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // R-로트 개별 인쇄 팝업
  const handlePrintRLabel = (item: DecomposedComponentItem) => {
    setPrintLabelData({
      lot_number: item.return_lot,
      item_name: item.item_name,
      category: item.target_category === 'ASM_SOCKET' ? '조립소켓' : '원부자재',
      spec: item.spec,
      thickness: item.spec,
      qty_current: item.qty,
      unit: item.unit,
      received_date: new Date().toISOString().slice(0, 10),
      location: item.location,
      location_name: item.location
    });
    setShowLabelPrinter(true);
  };

  // 반품 대장 조회
  const loadReturnLedger = async () => {
    setLoadingLedger(true);
    try {
      const params = {
        startDate: filterStartDate,
        endDate: filterEndDate,
        project_name: filterProjectName
      };
      const res = await api.get<{ data: ReturnLedgerItem[] }>('/returns', { params });
      setReturnLedger(res.data || []);
    } catch {
      setReturnLedger([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LIST') {
      loadReturnLedger();
    }
  }, [activeTab, filterStartDate, filterEndDate, filterProjectName]);

  return (
    <div className="space-y-6 p-6 pb-24 text-slate-100 max-w-[1600px] mx-auto">
      <PageHeader
        title="📦 반품 입고 & 구조체 해체 리턴재고(R-LOT) 관리"
        description="과거 출하현황/거래명세서 연동 조회 → 구조체 C302 역추적 분해 → 소켓(RJ...) 및 원자재(R25...) R-로트 재고 입고 & 결재대장 인쇄"
      />

      {/* ── 메인 탭 ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('REGISTER')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'REGISTER'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          신규 반품 입고 & 구조체 해체 등록
        </button>
        <button
          onClick={() => setActiveTab('LIST')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'LIST'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          반품 입고 대장 & 결재 인쇄 보고서
        </button>
      </div>

      {/* ── 탭 1: 신규 반품 입고 등록 ─────────────────────────────────────── */}
      {activeTab === 'REGISTER' && (
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측 5컬럼: 프로젝트/발주서 연동 종속 검색 및 완제품 구조체 선택 */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building2 className="h-5 w-5 text-amber-400" />
                1. 현장(프로젝트) & 발주서 검색 (100% 종속)
              </h3>

              {/* 프로젝트 선택 드롭다운 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  프로젝트(현장명) 선택
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-amber-400"
                >
                  <option value="">전체 프로젝트 (현장 선택)</option>
                  {projects.map(p => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} {p.client_name ? `(${p.client_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 종속 발주서(PO) 드롭다운 (프로젝트 선택 시 연동 한정) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                  연동 발주서(PO) 선택
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedProjectId}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-amber-400 disabled:opacity-50"
                >
                  <option value="">
                    {selectedProjectId ? '선택된 프로젝트의 모든 발주서' : '← 프로젝트를 먼저 선택하세요'}
                  </option>
                  {purchaseOrders.map(po => (
                    <option key={po.po_id} value={po.po_id}>
                      PO: {po.po_no} ({po.order_date ? po.order_date.slice(0, 10) : '일자미상'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 키워드 직접 검색 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="구조체 LOT / 거래명세서 번호 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadShippedStructures()}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
                <button
                  onClick={loadShippedStructures}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Search className="h-3.5 w-3.5" /> 검색
                </button>
              </div>

              {/* 완제품 구조체 출하 카드 목록 */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                <div className="text-xs font-bold text-slate-400 flex justify-between items-center px-1">
                  <span>출하 완제품 구조체 LOT 목록 ({shippedStructures.length}건)</span>
                  {loadingStructures && <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />}
                </div>

                {shippedStructures.length === 0 ? (
                  <div className="text-center py-10 bg-slate-800/40 rounded-xl border border-dashed border-slate-700">
                    <Package className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">조건에 일치하는 출하 구조체 LOT가 없습니다.</p>
                  </div>
                ) : (
                  shippedStructures.map((st) => {
                    const isSelected = selectedStructure?.wo_id === st.wo_id;
                    return (
                      <div
                        key={st.wo_id}
                        onClick={() => handleSelectStructure(st)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                            : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono text-xs font-extrabold text-amber-300">{st.structure_lot}</span>
                          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            출하 {st.shipped_qty}개
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white mb-1">{st.struct_name} ({st.struct_code})</div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>🏢 {st.project_name}</span>
                          <span>PO: {st.po_no || '직접출하'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 우측 7컬럼: 완제품 C302 역추적 분해 & R-로트 부여 입고 확정 */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-emerald-400" />
                  2. C302 계보 역추적 분해 & R-로트 입고 등록
                </h3>
                {loadingDecompose && <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />}
              </div>

              {!selectedStructure ? (
                <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-dashed border-slate-700 space-y-3">
                  <ArrowRight className="h-10 w-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">좌측에서 반품할 완제품 구조체 LOT를 먼저 선택하세요.</p>
                  <p className="text-xs text-slate-500">선택 시 소켓(RJ...) 및 원자재(R25...)로 계보가 자동 분해됩니다.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* 선택한 구조체 정보 카드 */}
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-amber-400 font-mono font-bold mb-0.5">선택 완제품: {selectedStructure.structure_lot}</div>
                      <div className="text-sm font-extrabold text-white">{selectedStructure.struct_name} ({selectedStructure.project_name})</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 font-mono block">PO: {selectedStructure.po_no}</span>
                      <span className="text-xs font-bold text-emerald-400">출하일: {selectedStructure.shipped_at?.slice(0, 10)}</span>
                    </div>
                  </div>

                  {/* 분해된 R-로트 구성품 테이블 및 일괄 라벨 인쇄 툴바 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                      <span>■ 해체된 구성품 및 부여된 R-로트 목록 ({decomposedItems.length}건)</span>
                      <button
                        onClick={() => {
                          if (decomposedItems.length > 0) {
                            const first = decomposedItems[0];
                            setPrintLabelData({
                              lot_number: first.return_lot,
                              item_name: first.item_name,
                              category: first.target_category === 'ASM_SOCKET' ? '조립소켓' : '원부자재',
                              spec: first.spec,
                              thickness: first.spec,
                              qty_current: first.qty,
                              unit: first.unit,
                              received_date: new Date().toISOString().slice(0, 10),
                              location: first.location,
                              location_name: first.location
                            });
                            setShowLabelPrinter(true);
                          }
                        }}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow transition"
                      >
                        <Printer className="h-3.5 w-3.5" /> 🏷️ R-로트 라벨 인쇄
                      </button>
                    </div>

                    <table className="w-full text-xs border-collapse border border-slate-700 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                          <th className="p-2.5 text-left">구분</th>
                          <th className="p-2.5 text-left">품명 / 규격</th>
                          <th className="p-2.5 text-left">원본 LOT</th>
                          <th className="p-2.5 text-left">부여된 R-로트</th>
                          <th className="p-2.5 text-center w-20">수량</th>
                          <th className="p-2.5 text-left w-28">입고 창고</th>
                          <th className="p-2.5 text-center w-20">라벨인쇄</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {decomposedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.target_category === 'ASM_SOCKET'
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {item.target_category === 'ASM_SOCKET' ? '소켓(반제품)' : '원자재(울/시트)'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-white">{item.item_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{item.spec}</div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-400">{item.original_component_lot}</td>
                            <td className="p-2.5 font-mono font-extrabold text-amber-300">{item.return_lot}</td>
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                                className="w-14 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-center font-mono font-bold text-white outline-none"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.location}
                                onChange={(e) => handleItemLocationChange(idx, e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-xs font-mono text-white outline-none"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handlePrintRLabel(item)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] flex items-center gap-1 mx-auto transition"
                              >
                                <Printer className="h-3 w-3" /> 인쇄
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 반품 입고 작성자 & 비고 입력 */}
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">작성자 (반품 담당자)</label>
                      <select
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                      >
                        {inspectorList.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300">반품 사유 / 비고</label>
                      <input
                        type="text"
                        placeholder="현장 남은 자재 반품, 사유 기재..."
                        value={returnMemo}
                        onChange={(e) => setReturnMemo(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* 반품 입고 확정 버튼 */}
                  <button
                    onClick={handleSubmitReturn}
                    disabled={submitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 transition"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {submitting ? '반품 처리 중...' : '반품 입고 확정 & R-로트 재고 입고 연동'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 2: 반품 입고 대장 & 결재 인쇄 보고서 ───────────────────────── */}
      {activeTab === 'LIST' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          {/* 검색 및 필터 툴바 */}
          <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <Calendar className="h-4 w-4 text-amber-400" />
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-white outline-none"
                />
                <span className="text-slate-500">~</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-white outline-none"
                />
              </div>

              <input
                type="text"
                placeholder="현장명 / 반품번호 검색..."
                value={filterProjectName}
                onChange={(e) => setFilterProjectName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              />

              <button
                onClick={loadReturnLedger}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Search className="h-3.5 w-3.5" /> 조회
              </button>
            </div>

            {/* A4 결재 보고서 인쇄 버튼 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-slate-300 font-bold">인쇄 작성자:</span>
                <select
                  value={reportInspector}
                  onChange={(e) => setReportInspector(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-bold rounded px-2 py-0.5 outline-none"
                >
                  {inspectorList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowReportModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="h-4 w-4" /> 3단 결재란 A4 반품대장 인쇄
              </button>
            </div>
          </div>

          {/* 대장 테이블 */}
          <div className="space-y-3">
            {loadingLedger ? (
              <div className="text-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">반품 대장 목록을 불러오는 중입니다...</p>
              </div>
            ) : returnLedger.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/40 rounded-xl border border-dashed border-slate-700">
                <FileText className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-300">조회된 반품 입고 기록이 없습니다.</p>
              </div>
            ) : (
              returnLedger.map((row) => (
                <div key={row.return_id} className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-700/60 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-black text-amber-300">{row.return_no}</span>
                      <span className="font-extrabold text-sm text-white">{row.project_name}</span>
                      {row.po_no && <span className="text-xs text-slate-400 font-mono">(PO: {row.po_no})</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      반품일자: <strong className="text-white font-mono">{row.returned_at?.slice(0, 10)}</strong> | 작성자: <strong className="text-emerald-400">{row.inspector}</strong>
                    </div>
                  </div>

                  <table className="w-full text-xs border-collapse border border-slate-700 rounded-lg">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 font-bold border-b border-slate-700">
                        <th className="p-2 text-left">구분</th>
                        <th className="p-2 text-left">품명 / 규격</th>
                        <th className="p-2 text-left">출하 완제품 LOT</th>
                        <th className="p-2 text-left">입고 R-로트</th>
                        <th className="p-2 text-center w-20">수량</th>
                        <th className="p-2 text-left w-24">창고</th>
                        <th className="p-2 text-center w-16">라벨</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {row.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-slate-300">
                            {it.target_category === 'ASM_SOCKET' ? '소켓(반제품)' : '원자재'}
                          </td>
                          <td className="p-2 font-bold text-white">{it.item_name} ({it.spec})</td>
                          <td className="p-2 font-mono text-slate-400">{it.parent_structure_lot}</td>
                          <td className="p-2 font-mono font-extrabold text-amber-300">{it.return_lot}</td>
                          <td className="p-2 text-center font-mono font-bold text-white">{it.qty} {it.unit}</td>
                          <td className="p-2 font-mono text-slate-400">{it.location}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handlePrintRLabel(it)}
                              className="p-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/30 transition"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 80×60mm R-로트 전용 바코드 라벨 인쇄 모달 ──────────────────────── */}
      {showLabelPrinter && printLabelData && (
        <GodexLabelPrinter
          data={printLabelData}
          onClose={() => setShowLabelPrinter(false)}
        />
      )}

      {/* ── 3단 결재란 포함 A4 반품대장 보고서 인쇄 모달 ──────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-slate-200">
            {/* 상단 툴바 */}
            <div className="px-6 py-4 border-b bg-slate-900 text-white flex justify-between items-center print:hidden rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-amber-300">📋 반품 입고 대장 A4 정식 보고서</h3>
                  <p className="text-[11px] text-slate-300">3단 결재란 수록 사규 표준 대장</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow"
                >
                  <Printer className="h-4 w-4" /> 인쇄 실행
                </button>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                  ×
                </button>
              </div>
            </div>

            {/* A4 실제 인쇄 영역 */}
            <div className="p-6 overflow-y-auto flex-1 bg-white print:p-0 text-slate-900">
              <style>{`
                @media print {
                  @page { size: A4 portrait; margin: 8mm; }
                  body * { visibility: hidden; }
                  #printable-return-report, #printable-return-report * { visibility: visible; }
                  #printable-return-report {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                  }
                  .print\\:hidden { display: none !important; }
                }
              `}</style>

              <div id="printable-return-report" className="border-2 border-slate-900 p-5 bg-white text-slate-900 text-xs font-sans space-y-4">
                {/* 상단 타이틀 & 3단 결재란 */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 underline decoration-2 underline-offset-4">
                      반 품 입 고 대 장 (Return Receipt Ledger)
                    </h1>
                    <p className="text-xs font-bold text-slate-700 mt-1 font-mono">
                      조회 기간: {filterStartDate} ~ {filterEndDate} {filterProjectName ? `| 현장: ${filterProjectName}` : ''}
                    </p>
                  </div>

                  {/* 3단 결재란 */}
                  <table className="border-collapse border-2 border-slate-900 text-center text-[10px] ml-auto">
                    <tbody>
                      <tr>
                        <td rowSpan={2} className="bg-slate-100 font-bold border border-slate-900 px-1.5 py-1 w-6 text-center">결<br/>재</td>
                        <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">작 성</td>
                        <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">검 토</td>
                        <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">승 인</td>
                      </tr>
                      <tr className="h-10">
                        <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1 text-center">{reportInspector}</td>
                        <td className="border border-slate-900 w-16 bg-white"></td>
                        <td className="border border-slate-900 w-16 bg-white"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 메인 테이블 */}
                <table className="w-full text-xs border-collapse border-2 border-slate-900 text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-900 text-center font-bold">
                      <th className="p-2 border border-slate-900 w-24">반품일자</th>
                      <th className="p-2 border border-slate-900 w-36">현장명</th>
                      <th className="p-2 border border-slate-900">해체 입고 R-로트</th>
                      <th className="p-2 border border-slate-900">품명 / 규격</th>
                      <th className="p-2 border border-slate-900 w-16 text-center">수량</th>
                      <th className="p-2 border border-slate-900 w-20 text-center">창고</th>
                      <th className="p-2 border border-slate-900 w-16 text-center">담당자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnLedger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-6 text-slate-500 font-bold">반품 입고 내역이 없습니다.</td>
                      </tr>
                    ) : (
                      returnLedger.flatMap((m) =>
                        m.items.map((it, idx) => (
                          <tr key={`${m.return_id}-${idx}`} className="h-7">
                            <td className="p-1.5 border border-slate-900 text-center font-mono text-[11px]">{m.returned_at?.slice(0, 10)}</td>
                            <td className="p-1.5 border border-slate-900 font-bold text-[11px]">{m.project_name}</td>
                            <td className="p-1.5 border border-slate-900 font-mono font-bold text-blue-900 text-[11px]">{it.return_lot}</td>
                            <td className="p-1.5 border border-slate-900 font-semibold">{it.item_name} ({it.spec})</td>
                            <td className="p-1.5 border border-slate-900 text-center font-bold font-mono">{it.qty} {it.unit}</td>
                            <td className="p-1.5 border border-slate-900 text-center font-mono">{it.location}</td>
                            <td className="p-1.5 border border-slate-900 text-center font-bold">{m.inspector}</td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                </table>

                {/* 풋터 */}
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 pt-2 border-t border-slate-300">
                  <span>EZC-RETURN-01</span>
                  <span className="font-bold text-slate-900 font-sans">(주) 이지원 반품관리 대장</span>
                  <span>A4 (210 × 297)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
