import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { LocationPicker } from '@/components/LocationPicker';
import {
  Factory, Layers, Scissors, Hammer, Flame,
  CheckCircle, AlertCircle, Play, ChevronRight, Scale,
  BarChart3, RefreshCw, Plus, Clock, User, Package, ShieldCheck
} from 'lucide-react';

// ─── 4공정 타입 정의 ──────────────────────────────────────────────────────────
type StageTab = 'MIX' | 'EXT' | 'CUT' | 'ASM';

interface WorkOrderOption {
  wo_id: number;
  wo_number: string;
  wo_type?: string;
  item_name?: string;
  planned_qty?: number;
  customer_name?: string;
  po_number?: string;
}

interface ExtrusionMachine {
  id: 'EXT_1' | 'EXT_2';
  name: string;
  code: string;
  color: string;
}

const EXTRUDERS: ExtrusionMachine[] = [
  { id: 'EXT_1', name: '압출 1호기 (메인라인)', code: '1호기', color: 'border-blue-500 bg-blue-50 text-blue-800' },
  { id: 'EXT_2', name: '압출 2호기 (서브라인)', code: '2호기', color: 'border-indigo-500 bg-indigo-50 text-indigo-800' },
];

// 재단용 소켓 파이프 규격 목록 (에프엔테크 & 표준 파이프)
const CUTTING_PIPE_SPECS = [
  { id: '100_BODY', diameter: 100, spec: '몸통', label: '100파이 - 몸통' },
  { id: '100_150H', diameter: 100, spec: '150H', label: '100파이 - 150H' },
  { id: '100_170H', diameter: 100, spec: '170H', label: '100파이 - 170H' },
  { id: '100_180H', diameter: 100, spec: '180H', label: '100파이 - 180H' },
  { id: '100_190H', diameter: 100, spec: '190H', label: '100파이 - 190H' },
  { id: '100_200H', diameter: 100, spec: '200H', label: '100파이 - 200H' },
  { id: '100_210H', diameter: 100, spec: '210H', label: '100파이 - 210H' },
  { id: '100_240H', diameter: 100, spec: '240H', label: '100파이 - 240H' },
  { id: '100_250H', diameter: 100, spec: '250H', label: '250H' },
  { id: '100_260H', diameter: 100, spec: '260H', label: '100파이 - 260H' },
  { id: '75_BODY',  diameter: 75,  spec: '몸통', label: '75파이 - 몸통' },
  { id: '50_BODY',  diameter: 50,  spec: '몸통', label: '50파이 - 몸통' },
];

export function ProcessStagePage() {
  const [activeTab, setActiveTab] = useState<StageTab>('MIX');
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [selectedWo, setSelectedWo] = useState<WorkOrderOption | null>(null);

  // 최근 공정 로그 (이전단계 LOT 계보 상속용)
  const [mixLogs, setMixLogs] = useState<any[]>([]);
  const [extLogs, setExtLogs] = useState<any[]>([]);
  const [cutLogs, setCutLogs] = useState<any[]>([]);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. 배합(MIX) 폼 상태
  // ───────────────────────────────────────────────────────────────────────────
  const [mixDate, setMixDate]           = useState(new Date().toISOString().slice(0, 10));
  const [mixLotNumber, setMixLotNumber] = useState('');
  const [mixRawLot, setMixRawLot]       = useState('');
  const [mixInputKg, setMixInputKg]     = useState<number>(100);
  const [mixWorker, setMixWorker]       = useState('배합작업자');
  const [mixRemarks, setMixRemarks]     = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // 2. 압출(EXT) 폼 상태
  // ───────────────────────────────────────────────────────────────────────────
  const [extDate, setExtDate]           = useState(new Date().toISOString().slice(0, 10));
  const [selectedMixLot, setSelectedMixLot] = useState('');
  const [extMachine, setExtMachine]     = useState<'EXT_1'|'EXT_2'>('EXT_1');
  const [extInputKg, setExtInputKg]     = useState<number>(100);
  const [extOutputMeters, setExtOutputMeters] = useState<number>(50);
  const [extLossMeters, setExtLossMeters]     = useState<number>(2);
  const [extDensity, setExtDensity]     = useState<number>(1.2);
  const [extWorker, setExtWorker]       = useState('압출작업자');
  const [extRemarks, setExtRemarks]     = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // 3. 재단(CUT) 폼 상태 (50/75/100파이 동시 재단)
  // ───────────────────────────────────────────────────────────────────────────
  const [cutDate, setCutDate]           = useState(new Date().toISOString().slice(0, 10));
  const [selectedExtLot, setSelectedExtLot] = useState('');
  const [cutInputs, setCutInputs]       = useState<Record<string, { qty: number; scrap: number }>>({});
  const [cutWorker, setCutWorker]       = useState('재단작업자');
  const [cutRemarks, setCutRemarks]     = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // 4. 조립(ASM) 폼 상태
  // ───────────────────────────────────────────────────────────────────────────
  const [asmDate, setAsmDate]           = useState(new Date().toISOString().slice(0, 10));
  const [asmCategory, setAsmCategory]   = useState<'FLASHING'|'GAP_SHEET'|'SOCKET'|'BUS_DUCT'|'SLEEVE'>('FLASHING');
  const [asmFlashingType, setAsmFlashingType] = useState<'FZ'|'FI'|'FL'>('FZ');
  const [asmGapSheetType, setAsmGapSheetType] = useState<'BD_CV1S'|'BD_RV3S'|'HTG'>('BD_CV1S');
  const [asmSpec, setAsmSpec]           = useState('W170×L1000 (t0.5)');
  const [asmQty, setAsmQty]             = useState<number>(10);
  const [asmLocation, setAsmLocation]   = useState('');
  const [selectedCutLot, setSelectedCutLot]   = useState('');
  const [asmWorker, setAsmWorker]       = useState('조립작업자');
  const [asmRemarks, setAsmRemarks]     = useState('');

  // 자동 채번 생성
  const generateMixLot = useCallback(() => {
    const d = mixDate.replace(/-/g, '').slice(2);
    setMixLotNumber(`${d}-S01`);
  }, [mixDate]);

  useEffect(() => {
    generateMixLot();
  }, [generateMixLot]);

  // 공정 로그 및 작업지시 로드
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 작업지시 목록
      const woRes = await api.get<any>('/work-orders?status=RELEASED,IN_PROGRESS,PLANNED');
      const wos = woRes.data || woRes.work_orders || woRes || [];
      setWorkOrders(Array.isArray(wos) ? wos : []);

      // 공정 로그
      const logRes = await api.get<any>('/process-logs');
      const logs = logRes.data || logRes || [];
      if (Array.isArray(logs)) {
        setMixLogs(logs.filter((l: any) => l.process_code === 'MIX'));
        setExtLogs(logs.filter((l: any) => l.process_code === 'EXT_1' || l.process_code === 'EXT_2' || l.process_code === 'EXT'));
        setCutLogs(logs.filter((l: any) => l.process_code === 'CUT'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 압출 수율 자동 계산 (% = (생산미터 / (투입Kg * 환산계수)) * 100)
  const extYieldRate = useMemo(() => {
    if (!extInputKg || extInputKg <= 0) return 0;
    const netMeters = Math.max(0, extOutputMeters - extLossMeters);
    // 표준 환산: 1kg 당 약 0.55m 생산 기준
    const expectedMeters = extInputKg * 0.55;
    const rate = (netMeters / expectedMeters) * 100;
    return Math.min(100, Math.max(0, Number(rate.toFixed(1))));
  }, [extInputKg, extOutputMeters, extLossMeters]);

  // 재단 총 수량 & 총 손실 계산
  const cutTotals = useMemo(() => {
    let totalQty = 0;
    let totalScrap = 0;
    Object.values(cutInputs).forEach(val => {
      totalQty += Number(val.qty || 0);
      totalScrap += Number(val.scrap || 0);
    });
    const yieldPct = totalQty + totalScrap > 0
      ? Number(((totalQty / (totalQty + totalScrap)) * 100).toFixed(1))
      : 100;
    return { totalQty, totalScrap, yieldPct };
  }, [cutInputs]);

  // ───────────────────────────────────────────────────────────────────────────
  // Submit 핸들러들
  // ───────────────────────────────────────────────────────────────────────────

  // 1. 배합(MIX) 저장
  const handleMixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mixLotNumber.trim()) { alert('배합 LOT 번호를 입력하세요.'); return; }
    try {
      await api.post('/process-logs', {
        process_code: 'MIX',
        wo_id: selectedWo?.wo_id || null,
        lot_number: mixLotNumber,
        input_raw_lot: mixRawLot,
        weighed_input: mixInputKg,
        worker_name: mixWorker,
        remarks: mixRemarks,
        status: 'COMPLETED',
      });
      alert(`✅ 배합 LOT [${mixLotNumber}] 등록이 완료되었습니다!`);
      fetchData();
      setActiveTab('EXT'); // 압출 단계로 빠른 이동
      setSelectedMixLot(mixLotNumber);
    } catch (err: any) {
      alert(`배합 저장 실패: ${err?.message || err}`);
    }
  };

  // 2. 압출(EXT) 저장
  const handleExtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMixLot) { alert('상속할 배합 LOT를 선택하세요.'); return; }
    try {
      await api.post('/process-logs', {
        process_code: extMachine, // EXT_1 or EXT_2 (1호기/2호기 분리!)
        wo_id: selectedWo?.wo_id || null,
        lot_number: selectedMixLot,
        weighed_input: extInputKg,
        weighed_output: extOutputMeters,
        weighed_loss: extLossMeters,
        density: extDensity,
        yield_rate: extYieldRate,
        worker_name: extWorker,
        remarks: `[${extMachine === 'EXT_1' ? '1호기' : '2호기'}] 수율 ${extYieldRate}% | ${extRemarks}`,
        status: 'COMPLETED',
      });
      alert(`✅ 압출 [${extMachine === 'EXT_1' ? '1호기' : '2호기'}] 저장 완료 (수율: ${extYieldRate}%)`);
      fetchData();
      setActiveTab('CUT'); // 재단 단계로 이동
      setSelectedExtLot(selectedMixLot);
    } catch (err: any) {
      alert(`압출 저장 실패: ${err?.message || err}`);
    }
  };

  // 3. 재단(CUT) 저장 (동시 재단 수량)
  const handleCutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cutTotals.totalQty <= 0) { alert('재단 수량을 1개 이상 입력하세요.'); return; }
    try {
      const cutDetails = Object.entries(cutInputs)
        .filter(([_, v]) => (v.qty || 0) > 0)
        .map(([specId, v]) => {
          const specObj = CUTTING_PIPE_SPECS.find(s => s.id === specId);
          return `${specObj?.label || specId}: ${v.qty}ea (손실 ${v.scrap}ea)`;
        })
        .join(' / ');

      await api.post('/process-logs', {
        process_code: 'CUT',
        wo_id: selectedWo?.wo_id || null,
        lot_number: selectedExtLot ? `${selectedExtLot}-CUT` : `CUT-${new Date().toISOString().slice(2,10)}`,
        parent_lot_number: selectedExtLot,
        produced_qty: cutTotals.totalQty,
        defect_qty: cutTotals.totalScrap,
        worker_name: cutWorker,
        remarks: `[동시 재단] ${cutDetails} | 수율: ${cutTotals.yieldPct}% | ${cutRemarks}`,
        status: 'COMPLETED',
      });
      alert(`✅ 재단 완료 (총 ${cutTotals.totalQty}ea, 수율 ${cutTotals.yieldPct}%)`);
      fetchData();
      setActiveTab('ASM');
    } catch (err: any) {
      alert(`재단 저장 실패: ${err?.message || err}`);
    }
  };

  // 4. 조립(ASM) 저장
  const handleAsmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asmQty || asmQty <= 0) { alert('조립 수량을 입력하세요.'); return; }
    try {
      const typeStr =
        asmCategory === 'FLASHING' ? `FLASHING_${asmFlashingType}` :
        asmCategory === 'GAP_SHEET' ? `GAP_SHEET_${asmGapSheetType}` :
        asmCategory;

      const res = await api.post('/production/assembly-logs', {
        assembly_type: typeStr,
        assembly_date: asmDate,
        spec: asmSpec,
        produced_qty: asmQty,
        input_qty: asmQty,
        rack_location: asmLocation || null,
        worker_name: asmWorker,
        remarks: `[재단상속: ${selectedCutLot || '선택없음'}] ${asmRemarks}`,
      });
      alert(`✅ ${res.message || '조립생산일지 작성 및 반제품 J-LOT 생성이 완료되었습니다!'}`);
      fetchData();
    } catch (err: any) {
      alert(`조립 저장 실패: ${err?.message || err}`);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* 상단 헤더 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Factory className="w-8 h-8 text-blue-600" />
            통합 4공정 파이프라인 (배합 ➔ 압출 ➔ 재단 ➔ 조립)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            작업지시 연결 · 1/2호기 압출 수율 계산 · 50/75/100파이 동시 재단 · J-LOT 완제품 조립
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 공통: 작업지시 선택 카세트 */}
      <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">작업지시 연결</span>
          <select
            value={selectedWo?.wo_id || ''}
            onChange={e => {
              const id = Number(e.target.value);
              const found = workOrders.find(w => w.wo_id === id) || null;
              setSelectedWo(found);
            }}
            className="border-2 border-blue-200 focus:border-blue-500 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 bg-blue-50/50 min-w-[280px]"
          >
            <option value="">-- 작업지시 선택 안함 (기존 재고 활용) --</option>
            {workOrders.map(wo => (
              <option key={wo.wo_id} value={wo.wo_id}>
                [{wo.wo_number}] {wo.item_name || '제품'} ({wo.planned_qty}ea) - {wo.customer_name || '자체'}
              </option>
            ))}
          </select>
        </div>
        {selectedWo && (
          <div className="flex items-center gap-4 text-xs">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md">
              연결됨: {selectedWo.wo_number}
            </span>
            <span className="text-slate-600 font-semibold">계획수량: {selectedWo.planned_qty} EA</span>
          </div>
        )}
      </div>

      {/* 4공정 단계 스텝버튼 / 탭 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* 탭 1: 배합 */}
        <button
          onClick={() => setActiveTab('MIX')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'MIX'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-4 ring-blue-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase opacity-80">STEP 1</span>
            <Flame className="w-5 h-5" />
          </div>
          <div className="font-bold text-base">🔵 배합 (MIX)</div>
          <div className="text-[11px] mt-1 opacity-90">원료 투입 & 배합 LOT 생성</div>
        </button>

        {/* 탭 2: 압출 */}
        <button
          onClick={() => setActiveTab('EXT')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'EXT'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-4 ring-indigo-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase opacity-80">STEP 2</span>
            <Layers className="w-5 h-5" />
          </div>
          <div className="font-bold text-base">🟡 압출 (EXT)</div>
          <div className="text-[11px] mt-1 opacity-90">1·2호기 분류 & 수율 계산</div>
        </button>

        {/* 탭 3: 재단 */}
        <button
          onClick={() => setActiveTab('CUT')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'CUT'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-4 ring-amber-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase opacity-80">STEP 3</span>
            <Scissors className="w-5 h-5" />
          </div>
          <div className="font-bold text-base">🟠 재단 (CUT)</div>
          <div className="text-[11px] mt-1 opacity-90">50·75·100파이 동시 재단</div>
        </button>

        {/* 탭 4: 조립 */}
        <button
          onClick={() => setActiveTab('ASM')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeTab === 'ASM'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-4 ring-emerald-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-black uppercase opacity-80">STEP 4</span>
            <Hammer className="w-5 h-5" />
          </div>
          <div className="font-bold text-base">🟢 조립 (ASM)</div>
          <div className="text-[11px] mt-1 opacity-90">J-LOT 채번 & 랙/야적 입고</div>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 탭 1: 배합 (MIX) 영역 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'MIX' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-blue-600" />
              배합 공정 등록 (MIX)
            </h2>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
              LOT 규격: YYMMDD-S01
            </span>
          </div>

          <form onSubmit={handleMixSubmit} className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">배합일자</label>
                <input
                  type="date"
                  value={mixDate}
                  onChange={e => setMixDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">작업자</label>
                <input
                  type="text"
                  value={mixWorker}
                  onChange={e => setMixWorker(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">
                  * 배합 LOT 번호 (자동 채번)
                </label>
                <input
                  type="text"
                  value={mixLotNumber}
                  onChange={e => setMixLotNumber(e.target.value)}
                  className="w-full border-2 border-blue-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-900 bg-blue-50/30"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  투입 원료 LOT (난연컴파운드 MB)
                </label>
                <input
                  type="text"
                  value={mixRawLot}
                  onChange={e => setMixRawLot(e.target.value)}
                  placeholder="예: 260729MB001"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                실측 중량 (kg)
              </label>
              <input
                type="number"
                value={mixInputKg}
                onChange={e => setMixInputKg(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                min={1}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">비고 / 메모</label>
              <textarea
                value={mixRemarks}
                onChange={e => setMixRemarks(e.target.value)}
                placeholder="배합 특이사항 입력"
                className="w-full border rounded-lg px-3 py-2 text-sm h-20"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              배합 완료 ➔ 다음 (압출) 단계로 이동
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 탭 2: 압출 (EXT) 영역 — 1호기/2호기 분리 & 수율 계산 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'EXT' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              압출 공정 등록 (1호기 / 2호기 필수 분류)
            </h2>
            <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
              압출 수율: {extYieldRate}%
            </span>
          </div>

          <form onSubmit={handleExtSubmit} className="space-y-4 max-w-3xl">
            {/* ★ 핵심: 1호기 vs 2호기 선택 */}
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-2">
                ⚙️ 압출 호기 선택 (필수)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {EXTRUDERS.map(ex => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setExtMachine(ex.id)}
                    className={`p-3.5 rounded-xl border-2 font-bold text-sm transition flex items-center justify-between ${
                      extMachine === ex.id
                        ? `${ex.color} ring-2 ring-indigo-500 shadow-sm`
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{ex.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white border font-bold">
                      {ex.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  상속할 배합 LOT 선택
                </label>
                <select
                  value={selectedMixLot}
                  onChange={e => setSelectedMixLot(e.target.value)}
                  className="w-full border-2 border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono font-bold bg-indigo-50/20"
                >
                  <option value="">-- 배합 LOT 선택 --</option>
                  {mixLogs.map(l => (
                    <option key={l.log_id} value={l.lot_number}>
                      {l.lot_number} ({l.weighed_input || 0}kg)
                    </option>
                  ))}
                  {/* 선택이 없으면 직접입력용 옵션 */}
                  {mixLotNumber && <option value={mixLotNumber}>최근생성: {mixLotNumber}</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">작업자</label>
                <input
                  type="text"
                  value={extWorker}
                  onChange={e => setExtWorker(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* 수율 계산 입력 란 */}
            <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-600" />
                수율 계산용 실측 입력
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">투입 중량 (kg)</label>
                  <input
                    type="number"
                    value={extInputKg}
                    onChange={e => setExtInputKg(Number(e.target.value))}
                    className="w-full border rounded px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">생산 길이 (m)</label>
                  <input
                    type="number"
                    value={extOutputMeters}
                    onChange={e => setExtOutputMeters(Number(e.target.value))}
                    className="w-full border rounded px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">손실 길이 (m)</label>
                  <input
                    type="number"
                    value={extLossMeters}
                    onChange={e => setExtLossMeters(Number(e.target.value))}
                    className="w-full border rounded px-2.5 py-1.5 font-bold text-red-600"
                  />
                </div>
              </div>

              {/* 실시간 수율 게이지 */}
              <div className="mt-2 bg-white p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-600">계산된 압출 수율: </span>
                  <span className={`text-lg font-black ${extYieldRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {extYieldRate}%
                  </span>
                </div>
                <div className="w-48 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${extYieldRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${extYieldRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">특이사항</label>
              <input
                type="text"
                value={extRemarks}
                onChange={e => setExtRemarks(e.target.value)}
                placeholder="예: 1호기 노즐 교체 후 가동"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              압출 완료 ➔ 다음 (재단) 단계로 이동
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 탭 3: 재단 (CUT) 영역 — 50/75/100파이 동시 재단 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'CUT' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-amber-600" />
              재단 공정 (50 / 75 / 100파이 동시 재단)
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full">
                총 재단: {cutTotals.totalQty} EA
              </span>
              <span className="bg-red-100 text-red-900 px-3 py-1 rounded-full">
                손실: {cutTotals.totalScrap} EA
              </span>
              <span className="bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full">
                수율: {cutTotals.yieldPct}%
              </span>
            </div>
          </div>

          <form onSubmit={handleCutSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  상속할 압출/재고 LOT 선택
                </label>
                <select
                  value={selectedExtLot}
                  onChange={e => setSelectedExtLot(e.target.value)}
                  className="w-full border-2 border-amber-200 rounded-lg px-3 py-2 text-sm font-mono font-bold bg-amber-50/20"
                >
                  <option value="">-- 압출 LOT 선택 --</option>
                  {extLogs.map(l => (
                    <option key={l.log_id} value={l.lot_number}>
                      {l.lot_number} ({l.process_code})
                    </option>
                  ))}
                  {mixLotNumber && <option value={mixLotNumber}>배합상속: {mixLotNumber}</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">작업자</label>
                <input
                  type="text"
                  value={cutWorker}
                  onChange={e => setCutWorker(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* ★ 핵심: 50 / 75 / 100파이 동시 재단 그리드 폼 */}
            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
                <span>✂️ 소켓 구경별 동시 재단 수량 입력</span>
                <span className="text-[11px] font-normal text-amber-700">
                  한 번의 재단으로 여러 높이/구경을 동시에 입력합니다
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {CUTTING_PIPE_SPECS.map(spec => {
                  const val = cutInputs[spec.id] || { qty: 0, scrap: 0 };
                  return (
                    <div key={spec.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono">
                          {spec.diameter}파이
                        </span>
                        <span>{spec.spec}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">재단수량 (ea)</label>
                          <input
                            type="number"
                            min={0}
                            value={val.qty || ''}
                            onChange={e => {
                              const q = Number(e.target.value);
                              setCutInputs(prev => ({
                                ...prev,
                                [spec.id]: { ...prev[spec.id], qty: q }
                              }));
                            }}
                            className="w-full border rounded px-2 py-1 font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-red-500 mb-0.5">스크랩 (ea)</label>
                          <input
                            type="number"
                            min={0}
                            value={val.scrap || ''}
                            onChange={e => {
                              const s = Number(e.target.value);
                              setCutInputs(prev => ({
                                ...prev,
                                [spec.id]: { ...prev[spec.id], scrap: s }
                              }));
                            }}
                            className="w-full border border-red-200 rounded px-2 py-1 font-bold text-red-600"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              재단 완료 ➔ 다음 (조립) 단계로 이동
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 탭 4: 조립 (ASM) 영역 — J-LOT 완제품 조립 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ASM' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Hammer className="w-5 h-5 text-emerald-600" />
              조립 공정 (J-LOT 채번 및 적재장소 지정)
            </h2>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold">
              J-LOT 자동 채번
            </span>
          </div>

          <form onSubmit={handleAsmSubmit} className="space-y-4 max-w-3xl">
            {/* 조립 구분 카테고리 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">조립 카테고리</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'FLASHING', label: '방화플래싱' },
                  { id: 'GAP_SHEET', label: '틈새복합시트' },
                  { id: 'SOCKET', label: '방화소켓' },
                  { id: 'BUS_DUCT', label: '버스덕트' },
                  { id: 'SLEEVE', label: '일체형슬리브' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAsmCategory(cat.id as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      asmCategory === cat.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  상속할 재단 LOT 선택
                </label>
                <select
                  value={selectedCutLot}
                  onChange={e => setSelectedCutLot(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                >
                  <option value="">-- 재단 LOT 선택 --</option>
                  {cutLogs.map(l => (
                    <option key={l.log_id} value={l.lot_number}>
                      {l.lot_number} ({l.produced_qty}ea)
                    </option>
                  ))}
                  {selectedExtLot && <option value={`${selectedExtLot}-CUT`}>최근재단: {selectedExtLot}-CUT</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">조립 수량 (EA)</label>
                <input
                  type="number"
                  min={1}
                  value={asmQty}
                  onChange={e => setAsmQty(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
                  required
                />
              </div>
            </div>

            {/* 입고 위치 (LocationPicker) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                📍 완성품 적재 위치 (렉 / 야상 / 천막 / 미지정)
              </label>
              <LocationPicker
                value={asmLocation}
                onChange={code => setAsmLocation(code)}
                allowNone={true}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">작업자 성명</label>
              <input
                type="text"
                value={asmWorker}
                onChange={e => setAsmWorker(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              조립 완료 & J-LOT 생성
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ProcessStagePage;
