import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClipboardCheck, Search, ChevronRight, CheckCircle2, XCircle, Plus, RefreshCw, FileText, Printer } from 'lucide-react';
import { GodexLabelPrinter } from '@/components/label/GodexLabelPrinter';

interface OrderItem {
  item_name: string;
  qty: number;
  spec?: string;
  category?: string;
}

interface Order {
  order_id: string;
  order_no: string;
  supplier_name: string;
  order_date: string;
  status: string;
  items_json: OrderItem[];
}

interface InspectItem {
  id: string;
  item_name: string;
  category: '소켓' | '브라켓' | '보호철판' | '기타';
  qty: number;
  lotNumber: string;
  thickness: { n1: number | ''; n2: number | ''; n3: number | '' };
  height: { n1: number | ''; n2: number | ''; n3: number | '' };
  width: { n1: number | ''; n2: number | ''; n3: number | '' };
  result: 'PASS' | 'FAIL';
}

export function SocketBracketInspectionPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [printLabelData, setPrintLabelData] = useState<any>(null);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [itemsToInspect, setItemsToInspect] = useState<InspectItem[]>([]);
  const [inspector, setInspector] = useState('최진영');

  useEffect(() => {
    fetchOrders();
    fetchHistory();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Order[] }>('/socket-orders');
      // Filter if needed, or rely on API
      const validOrders = res.data?.filter(o => ['RECEIVED', 'ORDERED', 'APPROVED'].includes(o.status)) || [];
      setOrders(validOrders);
    } catch (e) {
      console.error('Failed to fetch orders', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      // Fetching recent material lots for socket/bracket
      const res = await api.get<{ data: any[] }>('/material-lots?category=소켓');
      if (res.data) {
        setHistory(res.data.slice(0, 20)); // Keep top 20
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const generateLotNumber = async (index: number) => {
    try {
      const res = await api.get<{ lot_number: string }>('/material-lots/next-lot?abbrev=GI');
      if (res.data?.lot_number) {
        // Simple increment logic based on index if API only returns next 1
        // Usually, the API might not handle bulk, so we parse and increment
        const baseLot = res.data.lot_number;
        const prefix = baseLot.slice(0, -3);
        const seq = parseInt(baseLot.slice(-3)) + index;
        return `${prefix}${seq.toString().padStart(3, '0')}`;
      }
    } catch {
      // fallback
    }
    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const dd = today.getDate().toString().padStart(2, '0');
    return `${yy}${mm}${dd}GI${(index + 1).toString().padStart(3, '0')}`;
  };

  const handleOrderSelect = async (order: Order) => {
    setSelectedOrder(order);
    
    // Parse items_json
    let parsedItems = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
    if (!Array.isArray(parsedItems)) parsedItems = [];

    const newItems: InspectItem[] = [];
    for (let i = 0; i < parsedItems.length; i++) {
      const p = parsedItems[i];
      const lotNumber = await generateLotNumber(i);
      
      let cat: '소켓' | '브라켓' | '보호철판' | '기타' = '소켓';
      if (p.item_name.includes('브라켓')) cat = '브라켓';
      else if (p.item_name.includes('철판')) cat = '보호철판';

      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        item_name: p.item_name,
        category: cat,
        qty: p.qty,
        lotNumber,
        thickness: { n1: '', n2: '', n3: '' },
        height: { n1: '', n2: '', n3: '' },
        width: { n1: '', n2: '', n3: '' },
        result: 'PASS'
      });
    }

    setItemsToInspect(newItems);
    setStep(2);
  };

  const handleManualEntry = async () => {
    setSelectedOrder(null);
    const lotNumber = await generateLotNumber(0);
    setItemsToInspect([{
      id: Math.random().toString(36).substr(2, 9),
      item_name: '',
      category: '소켓',
      qty: 0,
      lotNumber,
      thickness: { n1: '', n2: '', n3: '' },
      height: { n1: '', n2: '', n3: '' },
      width: { n1: '', n2: '', n3: '' },
      result: 'PASS'
    }]);
    setStep(2);
  };

  const addManualItem = async () => {
    const lotNumber = await generateLotNumber(itemsToInspect.length);
    setItemsToInspect(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      item_name: '',
      category: '소켓',
      qty: 0,
      lotNumber,
      thickness: { n1: '', n2: '', n3: '' },
      height: { n1: '', n2: '', n3: '' },
      width: { n1: '', n2: '', n3: '' },
      result: 'PASS'
    }]);
  };

  const updateItem = (id: string, field: keyof InspectItem, value: any) => {
    setItemsToInspect(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto Result Evaluation
        updated.result = evaluateResult(updated);
        return updated;
      }
      return item;
    }));
  };

  const updateMeasurement = (id: string, type: 'thickness' | 'height' | 'width', n: 'n1'|'n2'|'n3', value: string) => {
    setItemsToInspect(prev => prev.map(item => {
      if (item.id === id) {
        const valNum = value === '' ? '' : Number(value);
        const updated = { ...item, [type]: { ...item[type], [n]: valNum } };
        updated.result = evaluateResult(updated);
        return updated;
      }
      return item;
    }));
  };

  const evaluateResult = (item: InspectItem): 'PASS' | 'FAIL' => {
    // 소켓: 철판두께 >= 1.6, 높이 >= 200
    // 브라켓: 철판두께 >= 1.6, 폭 >= 60
    const checkVals = (obj: { n1: any, n2: any, n3: any }, min: number) => {
      const vals = [obj.n1, obj.n2, obj.n3].filter(v => v !== '');
      if (vals.length === 0) return true; // not filled yet
      return vals.every(v => typeof v === 'number' && v >= min);
    };

    let pass = true;
    if (!checkVals(item.thickness, 1.6)) pass = false;
    
    if (item.category === '소켓') {
      if (!checkVals(item.height, 200)) pass = false;
    } else if (item.category === '브라켓') {
      if (!checkVals(item.width, 60)) pass = false;
    }

    return pass ? 'PASS' : 'FAIL';
  };

  const submitAll = async () => {
    // Validate
    const invalid = itemsToInspect.find(i => !i.item_name || !i.lotNumber || i.qty <= 0);
    if (invalid) {
      alert('품목명, LOT 번호, 수량을 모두 정확히 입력해 주세요.');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      for (const item of itemsToInspect) {
        if (item.result !== 'PASS') continue; // only register passed items to stock

        // 1. Material Lot
        await api.post('/material-lots', {
          lot_number: item.lotNumber,
          category: item.category,
          item_name: item.item_name,
          unit: 'EA',
          qty_current: item.qty,
          qty_initial: item.qty,
          received_date: today
        }).catch(e => console.warn('Lot already exists or error', e));

        // 2. Inspection Record
        await api.post('/inspections', {
          insp_type: 'SOCKET_IN',
          lot_number: item.lotNumber,
          item_name: item.item_name,
          qty: item.qty,
          n1: item.thickness.n1 || 0,
          n2: item.thickness.n2 || 0,
          n3: item.thickness.n3 || 0,
          overall_result: item.result,
          result: item.result,
          inspector: inspector
        }).catch(e => console.error('Inspection post failed', e));
      }

      setStep(3);
      fetchHistory(); // Refresh history
      setTimeout(() => {
        // auto alert toast in a real app, here we use basic alert
      }, 500);

    } catch (err: any) {
      alert(`등록 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  const resetProcess = () => {
    setStep(1);
    setSelectedOrder(null);
    setItemsToInspect([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-emerald-400" />
          소켓/브라켓 인수검사
        </h1>
        <p className="text-slate-400 mt-2 text-sm sm:text-base">
          발주서를 선택하여 인수검사를 수행하고 GI LOT를 발급합니다.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center mb-8 text-sm font-medium">
        <div className={`flex items-center ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>1</div>
          발주서 선택
        </div>
        <div className={`w-8 border-t-2 mx-4 ${step >= 2 ? 'border-emerald-400' : 'border-slate-700'}`}></div>
        <div className={`flex items-center ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>2</div>
          검사 입력
        </div>
        <div className={`w-8 border-t-2 mx-4 ${step >= 3 ? 'border-emerald-400' : 'border-slate-700'}`}></div>
        <div className={`flex items-center ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-emerald-400' : 'border-slate-500'} mr-2`}>3</div>
          완료
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
        
        {/* STEP 1: Select Order */}
        {step === 1 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">입고 대기 중인 발주서</h2>
            
            {loading ? (
              <div className="py-12 flex justify-center items-center text-emerald-400">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <FileText className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300">등록된 소켓 발주서가 없습니다.</p>
                <p className="text-sm text-slate-500 mb-6">발주서를 먼저 등록하시거나 직접 입력 모드를 사용해 주세요.</p>
                <button
                  onClick={handleManualEntry}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                >
                  직접 입력하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {orders.map(order => {
                    const items = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []);
                    return (
                      <div 
                        key={order.order_id || order.order_no}
                        onClick={() => handleOrderSelect(order)}
                        className="group flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-emerald-400 text-sm font-bold">{order.order_no}</span>
                            <span className="font-medium text-white">{order.supplier_name}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-4">
                            <span>발주일: {order.order_date?.slice(0, 10)}</span>
                            <span>품목: {items.length}종</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleManualEntry}
                    className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-600 underline-offset-4"
                  >
                    발주서 없이 직접 입력하기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Inspect Items */}
        {step === 2 && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-semibold text-white">
                {selectedOrder ? `[${selectedOrder.order_no}] 검사 입력` : '직접 검사 입력'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">검사자:</span>
                <input
                  type="text"
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-sm w-32 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              {itemsToInspect.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`bg-slate-900 border-l-4 rounded-xl p-5 shadow-lg ${item.result === 'PASS' ? 'border-l-emerald-500 border border-slate-700' : 'border-l-rose-500 border border-rose-900/50'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    
                    {/* Info Section */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">품목명</label>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                            placeholder="예: 금속소켓 D100"
                          />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 mb-1 block">카테고리</label>
                            <select
                              value={item.category}
                              onChange={e => updateItem(item.id, 'category', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                            >
                              <option value="소켓">소켓</option>
                              <option value="브라켓">브라켓</option>
                              <option value="보호철판">보호철판</option>
                              <option value="기타">기타</option>
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-slate-400 mb-1 block">수량 (EA)</label>
                            <input
                              type="number"
                              value={item.qty || ''}
                              onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm text-right font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs text-emerald-400/80 block">부여될 LOT 번호</label>
                          <button
                            type="button"
                            onClick={() => setPrintLabelData({
                              lot_number: item.lotNumber,
                              item_name: item.item_name,
                              category: item.category,
                              unit: 'EA',
                              qty_current: item.qty || 1,
                              received_date: new Date().toISOString().slice(0, 10),
                            })}
                            className="flex items-center gap-1 text-[11px] bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded px-2 py-0.5 transition"
                          >
                            <Printer className="h-3 w-3" /> 라벨 미리 출력
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.lotNumber}
                          onChange={e => updateItem(item.id, 'lotNumber', e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-900/50 rounded px-3 py-2 text-emerald-400 font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Measurement Section */}
                    <div className="flex-1 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="space-y-4">
                        {/* Thickness */}
                        <div>
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-medium text-slate-200">두께 실측 (mm)</span>
                            <span className="text-xs text-slate-400">기준: ≥1.6</span>
                          </div>
                          <div className="flex gap-2">
                            {['n1', 'n2', 'n3'].map(n => (
                              <div key={n} className="flex-1">
                                <div className="text-[10px] text-slate-500 mb-1 uppercase text-center">{n}</div>
                                <input
                                  type="number" step="0.01"
                                  value={item.thickness[n as keyof typeof item.thickness]}
                                  onChange={e => updateMeasurement(item.id, 'thickness', n as any, e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Height (Socket) or Width (Bracket) */}
                        {item.category === '소켓' && (
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-medium text-slate-200">높이 실측 (mm)</span>
                              <span className="text-xs text-slate-400">기준: ≥200</span>
                            </div>
                            <div className="flex gap-2">
                              {['n1', 'n2', 'n3'].map(n => (
                                <div key={n} className="flex-1">
                                  <input
                                    type="number" step="1"
                                    value={item.height[n as keyof typeof item.height]}
                                    onChange={e => updateMeasurement(item.id, 'height', n as any, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.category === '브라켓' && (
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-sm font-medium text-slate-200">폭 실측 (mm)</span>
                              <span className="text-xs text-slate-400">기준: ≥60</span>
                            </div>
                            <div className="flex gap-2">
                              {['n1', 'n2', 'n3'].map(n => (
                                <div key={n} className="flex-1">
                                  <input
                                    type="number" step="1"
                                    value={item.width[n as keyof typeof item.width]}
                                    onChange={e => updateMeasurement(item.id, 'width', n as any, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-center text-sm font-mono text-white focus:border-emerald-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Result Status */}
                    <div className="w-full md:w-32 flex flex-col justify-center items-center p-4 bg-slate-800 rounded-lg">
                      <div className="text-xs text-slate-400 mb-2">종합 판정</div>
                      {item.result === 'PASS' ? (
                        <div className="flex flex-col items-center text-emerald-400 cursor-pointer" onClick={() => updateItem(item.id, 'result', 'FAIL')}>
                          <CheckCircle2 className="h-10 w-10 mb-1" />
                          <span className="font-bold">합격</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-rose-500 cursor-pointer" onClick={() => updateItem(item.id, 'result', 'PASS')}>
                          <XCircle className="h-10 w-10 mb-1" />
                          <span className="font-bold">불합격</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-2 text-center">클릭하여 수동 변경</div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {!selectedOrder && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={addManualItem}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  <Plus className="h-4 w-4" /> 품목 추가
                </button>
              </div>
            )}

            <div className="mt-8 flex justify-between items-center border-t border-slate-700 pt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
              >
                이전으로
              </button>
              <button
                onClick={submitAll}
                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                전체 합격 등록
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">인수검사 완료</h2>
            <p className="text-slate-400 mb-8 max-w-md">
              모든 합격 품목에 대해 GI LOT가 발급되고, 입고(재고) 처리가 완료되었습니다.
            </p>
            <div className="flex gap-4">
              <button
                onClick={resetProcess}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                새로운 검사 시작
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="mt-12 mb-8">
        <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-slate-500" />
          최근 소켓/브라켓 입고 이력 (최대 20건)
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">LOT 번호</th>
                  <th className="px-4 py-3">품목명</th>
                  <th className="px-4 py-3 text-right">수량</th>
                  <th className="px-4 py-3">분류</th>
                  <th className="px-4 py-3">입고일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">조회된 입고 이력이 없습니다.</td>
                  </tr>
                ) : history.map((h, i) => (
                  <tr key={h.lot_number || i} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">{h.lot_number}</td>
                    <td className="px-4 py-3 text-slate-200">{h.item_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{h.qty_current} EA</td>
                    <td className="px-4 py-3 text-slate-400">{h.category}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{h.received_date?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 라벨 미리 출력 모달 */}
      {printLabelData && (
        <GodexLabelPrinter
          labelData={printLabelData}
          onClose={() => setPrintLabelData(null)}
        />
      )}
    </div>
  );
}

