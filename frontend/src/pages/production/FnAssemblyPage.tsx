import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Layers, Package, Plus, CheckCircle, Search, History, Eye, QrCode } from 'lucide-react';

interface FinishedStock {
  finished_id: number;
  finished_lot: string;
  site_name: string;
  product_name: string;
  diameter_mm: number;
  spec: string;
  sleeve_lot: string;
  sheet_lot: string;
  plate_lot: string;
  sealant_lot: string;
  qty: number;
  qty_current: number;
  unit: string;
  location: string;
  status: string;
  assembled_by: string;
  assembled_at: string;
  lineage?: any[];
}

interface MaterialLotOption {
  lot_number: string;
  item_name: string;
  category: string;
  qty_current: number;
  spec?: string;
}

export function FnAssemblyPage() {
  const [finishedStock, setFinishedStock] = useState<FinishedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // 폼 입력 상태
  const [siteName, setSiteName] = useState('');
  const [diam, setDiam] = useState<number>(100);
  const [finishedLot, setFinishedLot] = useState('');
  const [qty, setQty] = useState('');
  const [assembledBy, setAssembledBy] = useState('공정작업자');
  const [notes, setNotes] = useState('');

  // 투입 부자재 LOT 선택 (슬리브U, 차열시트S, 보호철판GI, 고무패킹PK)
  const [selectedSleeveLot, setSelectedSleeveLot] = useState('');
  const [selectedSheetLot, setSelectedSheetLot] = useState('');
  const [selectedPlateLot, setSelectedPlateLot] = useState('');
  const [selectedPackingLot, setSelectedPackingLot] = useState('');

  // 자재 LOT 옵션 목록
  const [sleeveLots, setSleeveLots] = useState<MaterialLotOption[]>([]);
  const [sheetLots, setSheetLots] = useState<MaterialLotOption[]>([]);
  const [plateLots, setPlateLots] = useState<MaterialLotOption[]>([]);
  const [packingLots, setPackingLots] = useState<MaterialLotOption[]>([]);

  // 계보 상세보기 모달
  const [detailModalItem, setDetailModalItem] = useState<FinishedStock | null>(null);

  useEffect(() => {
    fetchFinishedStock();
    fetchMaterialLots();
    fetchNextFinishedLot(100);
  }, []);

  useEffect(() => {
    fetchNextFinishedLot(diam);
  }, [diam]);

  const fetchFinishedStock = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: FinishedStock[] }>(`/fn-assembly/finished-stock?search=${encodeURIComponent(search)}`);
      setFinishedStock(res.data || []);
    } catch {
      setFinishedStock([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterialLots = async () => {
    try {
      const res = await api.get<{ data: MaterialLotOption[] }>('/material-lots?limit=200');
      const all = res.data || [];

      // 슬리브(U), 차열시트(S/시트), 보호철판(GI), 고무패킹(PK)
      setSleeveLots(all.filter(l => l.lot_number.includes('U') || l.category?.includes('슬리브') || l.item_name?.includes('슬리브')));
      setSheetLots(all.filter(l => l.lot_number.includes('-S') || l.category?.includes('시트') || l.item_name?.includes('시트')));
      setPlateLots(all.filter(l => l.lot_number.includes('GI') || l.category?.includes('철판') || l.item_name?.includes('철판') || l.item_name?.includes('소켓')));
      setPackingLots(all.filter(l => l.lot_number.includes('PK') || l.category?.includes('패킹') || l.item_name?.includes('패킹')));
    } catch (e) {
      console.warn('Failed to fetch material lots', e);
    }
  };

  const fetchNextFinishedLot = async (diameter: number) => {
    try {
      const res = await api.get<{ finished_lot: string }>(`/fn-assembly/next-finished-lot?diam=${diameter}`);
      if (res.finished_lot) {
        setFinishedLot(res.finished_lot);
      }
    } catch {
      const yy = new Date().toISOString().slice(2, 4);
      const mm = new Date().toISOString().slice(5, 7);
      const dd = new Date().toISOString().slice(8, 10);
      setFinishedLot(`${yy}${mm}${dd}-FN-${diameter}-0001`);
    }
  };

  const handleAssemblySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishedLot) { toast.error('완제품 LOT를 입력해 주세요.'); return; }
    if (!selectedSleeveLot) { toast.error('슬리브 LOT는 필수 선택 항목입니다.'); return; }
    if (!qty || Number(qty) <= 0) { toast.error('조립 수량을 입력해 주세요.'); return; }

    try {
      await api.post('/fn-assembly', {
        finished_lot: finishedLot,
        site_name: siteName || '현장 미지정',
        product_name: `EZ-FN-P100 (${diam}A)`,
        diameter_mm: diam,
        sleeve_lot: selectedSleeveLot,
        sheet_lot: selectedSheetLot || null,
        plate_lot: selectedPlateLot || null,
        packing_lot: selectedPackingLot || null,
        qty: Number(qty),
        assembled_by: assembledBy,
        notes,
      });

      toast.success(`✨ 완제품 LOT [${finishedLot}] 조립 완수 및 부자재 재고 차감 완료!`);
      // 폼 리셋
      setQty('');
      setNotes('');
      fetchFinishedStock();
      fetchMaterialLots();
      fetchNextFinishedLot(diam);
    } catch (err: any) {
      toast.error('조립 등록 실패: ' + (err?.response?.data?.error || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* 헤더 */}
      <div className="mb-6 border-b border-slate-700 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <Layers className="h-8 w-8 text-amber-400" />
            에프엔테크 (EZ-FN-P100) 완제품 조립 & 계보 관리
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            사규 C302 추적성 규정에 따라 부자재(슬리브U, 시트S, 철판GI, 실란트SS) LOT를 100% 매칭하여 완제품 재고를 생성합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 완제품 조립 입력 카딩 */}
        <div className="lg:col-span-1 bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2 border-b border-slate-700 pb-3">
            <Plus className="h-5 w-5 text-amber-400" /> 완제품 구조체 조립 등록
          </h2>

          <form onSubmit={handleAssemblySubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">소켓 규격 (파이) *</label>
              <select
                value={diam}
                onChange={e => setDiam(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value={100}>100A (100파이 - 210H~몸통, 12EA/BOX)</option>
                <option value={75}>75A (75파이, 24EA/BOX, 960EA/PLT)</option>
                <option value={50}>50A (50파이, 30EA/BOX, 1440EA/PLT)</option>
              </select>
            </div>

            {/* 엑셀 수불대장 표준 포장 단위 & 볼트/너트 소요량 안내 뱃지 */}
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-indigo-800/60 text-xs font-mono space-y-1">
              <div className="flex justify-between text-indigo-300 font-bold">
                <span>📦 엑셀 수불 표준 포장단위:</span>
                <span className="text-amber-300">
                  {diam === 100 ? '12EA/BOX (240~1440EA/PLT)' : diam === 75 ? '24EA/BOX (960EA/PLT)' : '30EA/BOX (1440EA/PLT)'}
                </span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold pt-0.5">
                <span>🔩 부자재 소요량(BOM):</span>
                <span className="text-emerald-300">제품 1개당 볼트/너트 4EA 자동차감</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-0.5">
                완제품 생산 LOT 예시: <strong className="text-emerald-400">260720-FN-{diam}(0001~1680)</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">완제품 사규 LOT (자동채번) *</label>
              <input
                type="text"
                value={finishedLot}
                onChange={e => setFinishedLot(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold"
                placeholder="260807-FN-100-0001"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">납품 예정 현장명</label>
              <input
                type="text"
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                placeholder="예: 판교 현장 / 평택 고덕 현장"
              />
            </div>

            {/* 부자재 LOT 스캔/선택 */}
            <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-900/50 space-y-3">
              <p className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                🔗 [필수] 조립 투입 부자재 LOT 지정
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">1. 일체형 슬리브 LOT (U) *</label>
                <select
                  value={selectedSleeveLot}
                  onChange={e => setSelectedSleeveLot(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono"
                  required
                >
                  <option value="">-- 슬리브 LOT 선택 --</option>
                  {sleeveLots.map(l => (
                    <option key={l.lot_number} value={l.lot_number}>
                      [{l.lot_number}] {l.item_name} (재고: {l.qty_current}EA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">2. 틈새 차열시트 LOT (S)</label>
                <select
                  value={selectedSheetLot}
                  onChange={e => setSelectedSheetLot(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono"
                >
                  <option value="">-- 차열시트 LOT 선택 --</option>
                  {sheetLots.map(l => (
                    <option key={l.lot_number} value={l.lot_number}>
                      [{l.lot_number}] {l.item_name} (재고: {l.qty_current}EA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">3. 보호철판 / 소켓 LOT (GI)</label>
                <select
                  value={selectedPlateLot}
                  onChange={e => setSelectedPlateLot(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-mono"
                >
                  <option value="">-- 보호철판/소켓 LOT 선택 --</option>
                  {plateLots.map(l => (
                    <option key={l.lot_number} value={l.lot_number}>
                      [{l.lot_number}] {l.item_name} (재고: {l.qty_current}EA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">4. 상/하부 고무패킹 LOT (PK)</label>
                <select
                  value={selectedPackingLot}
                  onChange={e => setSelectedPackingLot(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                >
                  <option value="">-- 고무패킹 LOT 선택 (선택) --</option>
                  {packingLots.map(l => (
                    <option key={l.lot_number} value={l.lot_number}>
                      [{l.lot_number}] {l.item_name} (재고: {l.qty_current}EA)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">조립 수량 (EA) *</label>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-base"
                placeholder="100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">조립 작업자</label>
              <input
                type="text"
                value={assembledBy}
                onChange={e => setAssembledBy(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle className="h-5 w-5" /> 완제품 조립 확정 & 로트 부여
            </button>
          </form>
        </div>

        {/* 오른쪽: 완제품 재고 현황 및 역추적 계보 테이블 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-400" /> 완제품 보유 재고 현황
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="완제품/부자재 LOT 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchFinishedStock()}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">완제품 LOT</th>
                    <th className="px-3 py-3">구조체명 / 현장</th>
                    <th className="px-3 py-3">슬리브 LOT (U)</th>
                    <th className="px-3 py-3">시트 / 철판 LOT</th>
                    <th className="px-3 py-3 text-right">보유 수량</th>
                    <th className="px-3 py-3 text-center">역추적 계보</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">데이터 조회 중...</td></tr>
                  ) : finishedStock.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">등록된 에프엔테크 완제품 재고가 없습니다.</td></tr>
                  ) : (
                    finishedStock.map(row => (
                      <tr key={row.finished_id} className="hover:bg-slate-750 transition">
                        <td className="px-4 py-3 font-mono font-bold text-amber-300">{row.finished_lot}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-white">{row.product_name}</p>
                          <p className="text-[11px] text-slate-400">{row.site_name}</p>
                        </td>
                        <td className="px-3 py-3 font-mono text-emerald-400 font-semibold">{row.sleeve_lot}</td>
                        <td className="px-3 py-3 font-mono text-slate-400">
                          <p className="text-amber-400">{row.sheet_lot || '-'}</p>
                          <p className="text-sky-400">{row.plate_lot || '-'}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-white text-sm">
                          {row.qty_current} {row.unit}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => setDetailModalItem(row)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition shadow"
                          >
                            <Eye className="h-3.5 w-3.5 text-amber-400" /> 계보 보기
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 계보 상세보기 모달 */}
      {detailModalItem && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <History className="h-5 w-5 text-amber-400" />
                사규 C302 LOT 역추적 계보 (Traceability)
              </h3>
              <button onClick={() => setDetailModalItem(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">완제품 LOT:</span>
                <span className="font-bold text-amber-300 text-sm">{detailModalItem.finished_lot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">품목명:</span>
                <span className="text-white">{detailModalItem.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">납품 현장:</span>
                <span className="text-white">{detailModalItem.site_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">조립 일시:</span>
                <span className="text-slate-300">{String(detailModalItem.assembled_at).slice(0, 16)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-300 mb-2">▼ 구성 투입 원/부자재 LOT 매칭 이력</p>
              <div className="space-y-2">
                {detailModalItem.lineage && detailModalItem.lineage.length > 0 ? (
                  detailModalItem.lineage.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-700 text-xs">
                      <span className="font-bold text-indigo-300">{item.child_cat}</span>
                      <span className="font-mono font-extrabold text-emerald-400">{item.child_lot}</span>
                    </div>
                  ))
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between bg-slate-900/60 p-2 rounded text-xs">
                      <span className="text-slate-400">슬리브 (U):</span>
                      <span className="font-mono font-bold text-emerald-400">{detailModalItem.sleeve_lot}</span>
                    </div>
                    {detailModalItem.sheet_lot && (
                      <div className="flex justify-between bg-slate-900/60 p-2 rounded text-xs">
                        <span className="text-slate-400">차열시트 (S):</span>
                        <span className="font-mono font-bold text-amber-400">{detailModalItem.sheet_lot}</span>
                      </div>
                    )}
                    {detailModalItem.plate_lot && (
                      <div className="flex justify-between bg-slate-900/60 p-2 rounded text-xs">
                        <span className="text-slate-400">보호철판 (GI):</span>
                        <span className="font-mono font-bold text-sky-400">{detailModalItem.plate_lot}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
