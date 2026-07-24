import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Plug, Plus, CheckCircle, X, ShieldCheck, Warehouse, AlertTriangle } from 'lucide-react';

const SOCKET_BRACKET_ITEMS = [
  { code: 'SK-D100', name: '금속소켓 D100 (100mm)', category: 'SOCKET', min: 1.5, max: 1.8 },
  { code: 'SK-D125', name: '금속소켓 D125 (125mm)', category: 'SOCKET', min: 1.5, max: 1.8 },
  { code: 'SK-D150', name: '금속소켓 D150 (150mm)', category: 'SOCKET', min: 1.5, max: 1.8 },
  { code: 'SK-D200', name: '금속소켓 D200 (200mm)', category: 'SOCKET', min: 1.5, max: 1.8 },
  { code: 'BK-FSB',  name: 'FSB 플래싱 브라켓', category: 'BRACKET', min: 1.5, max: 1.8 },
  { code: 'BK-UD',   name: '상하평철 브라켓 (t1.6 x 60mm)', category: 'BRACKET', min: 1.5, max: 1.8 },
  { code: 'BK-LR',   name: '좌우평철 브라켓 (t1.6 x 60mm)', category: 'BRACKET', min: 1.5, max: 1.8 },
  { code: 'BK-UD204', name: '상하평철2 브라켓 (t1.6 x 204mm)', category: 'BRACKET', min: 1.5, max: 1.8 },
  { code: 'BK-UD274', name: '상하평철2 브라켓 (t1.6 x 274mm)', category: 'BRACKET', min: 1.5, max: 1.8 },
  { code: 'CUSTOM',  name: '기타 소켓/브라켓 (직접 입력)', category: 'BRACKET', min: 1.0, max: 3.0 },
];

const LOCATION_OPTIONS = [
  'P1', 'P2', 'P3',
  'Q1', 'Q2', 'Q3',
  'R1', 'R2', 'R3'
];

export function SocketBracketInspectionPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 폼 상태
  const [selectedItemCode, setSelectedItemCode] = useState('SK-D100');
  const [customItemName, setCustomItemName] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [qty, setQty] = useState<number>(100);
  const [inspector, setInspector] = useState('최진영');
  const [n1, setN1] = useState<number>(1.6);
  const [n2, setN2] = useState<number>(1.6);
  const [n3, setN3] = useState<number>(1.6);
  const [overallResult, setOverallResult] = useState<'PASS' | 'FAIL'>('PASS');
  const [targetLocation, setTargetLocation] = useState('P1');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/inspections?insp_type=SOCKET_IN');
      // 일반 INCOMING 부자재 중 소켓/브라켓 포함 건도 합산 조회
      const resGeneral = await api.get<{ data: any[] }>('/inspections?category=SK').catch(() => ({ data: [] }));
      const combined = [...(res.data || []), ...(resGeneral.data || [])];
      
      // 중복 제거 (insp_id 기준)
      const unique = Array.from(new Map(combined.map(item => [item.insp_id, item])).values());
      setInspections(unique);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedPreset = SOCKET_BRACKET_ITEMS.find(item => item.code === selectedItemCode);
    const finalItemName = selectedItemCode === 'CUSTOM' ? customItemName.trim() : (selectedPreset?.name || '금속소켓');

    if (!finalItemName) {
      alert('품목명을 입력해 주세요.');
      return;
    }

    try {
      // 1. 소켓/브라켓 인수검사 등록
      await api.post('/inspections', {
        insp_type: 'SOCKET_IN',
        category: 'SK',
        item_name: finalItemName,
        item_category: 'SK',
        inspector,
        supplier_lot: supplierLot || null,
        location: targetLocation,
        qty: Number(qty) || 0,
        n1: Number(n1),
        n2: Number(n2),
        n3: Number(n3),
        overall_result: overallResult,
        result: overallResult,
        remarks: notes || `로케이션: ${targetLocation}`
      });

      alert(`✅ 소켓/브라켓 인수검사가 성공적으로 등록되었습니다!\n(판정: ${overallResult === 'PASS' ? '합격/재고승인' : '불합격'}, 적재 위치: ${targetLocation})`);
      setShowModal(false);
      
      // 폼 초기화
      setSupplierLot('');
      setNotes('');
      fetchData();
    } catch (err: any) {
      alert(`인수검사 등록 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader 
        title="🔌 소켓 / 브라켓류 인수검사" 
        description="금속소켓(D100~D200 계열) 및 브라켓류 (BK, FSB, 상하/좌우 평철 브라켓) 통합 인수검사 및 재고 승인"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow"
        >
          <Plus className="h-4 w-4" />
          신규 소켓/브라켓 인수검사 등록
        </button>
      </PageHeader>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">소켓 및 브라켓 인수검사 성적서 내역</h3>
          <span className="text-xs text-slate-500">총 {inspections.length}건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일시</th>
              <th className="px-4 py-3">품목명 / 구조체</th>
              <th className="px-4 py-3">채번된 사규 LOT</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">검사 수량</th>
              <th className="px-4 py-3 text-center">판정</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 소켓/브라켓 인수검사 내역이 없습니다.</td></tr>
            ) : inspections.map((row, idx) => (
              <tr key={row.insp_id || idx} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.inspected_at?.slice(0, 10) || row.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{row.item_name || '금속소켓/브라켓'}</td>
                <td className="px-4 py-3 font-mono font-bold text-indigo-700">{row.lot_number || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.supplier_lot || '-'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{Number(row.qty || row.sampling_n || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    (row.overall_result || row.result) === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {(row.overall_result || row.result) === 'PASS' ? 'PASS (합격/재고승인)' : 'FAIL (불합격)'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.inspector || '최진영'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">신규 소켓 / 브라켓류 인수검사 등록</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              {/* 품목 선택 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">소켓 / 브라켓 품목 선택</label>
                  <select
                    value={selectedItemCode}
                    onChange={e => setSelectedItemCode(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold bg-white"
                  >
                    {SOCKET_BRACKET_ITEMS.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">공급사 LOT 번호</label>
                  <input
                    type="text"
                    placeholder="예: POS260724-01"
                    value={supplierLot}
                    onChange={e => setSupplierLot(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* 직접 입력 시 품목명 */}
              {selectedItemCode === 'CUSTOM' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">직접 입력 품목명 *</label>
                  <input
                    type="text"
                    placeholder="예: 특수규격 브라켓 t2.0"
                    value={customItemName}
                    onChange={e => setCustomItemName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    required
                  />
                </div>
              )}

              {/* 수량 및 로케이션 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">검사/입고 수량 (EA)</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                    min={1}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">적재 랙 셀 로케이션 (2-Zone)</label>
                  <select
                    value={targetLocation}
                    onChange={e => setTargetLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-white"
                  >
                    {LOCATION_OPTIONS.map(loc => (
                      <option key={loc} value={loc}>{loc} 랙 셀</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 실측 치수 / 두께 측정값 (n1, n2, n3) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">두께/치수 실측값 (버니어 0.01mm)</span>
                  <span className="text-[10px] text-slate-500 font-mono">기준: 1.6mm ±0.2</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">n1 실측</label>
                    <input
                      type="number"
                      step="0.01"
                      value={n1}
                      onChange={e => setN1(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">n2 실측</label>
                    <input
                      type="number"
                      step="0.01"
                      value={n2}
                      onChange={e => setN2(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">n3 실측</label>
                    <input
                      type="number"
                      step="0.01"
                      value={n3}
                      onChange={e => setN3(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 종합 판정 & 검사자 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">최종 인수검사 판정</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOverallResult('PASS')}
                      className={`flex-1 py-1.5 rounded font-bold border transition-all ${
                        overallResult === 'PASS' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      PASS (합격)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverallResult('FAIL')}
                      className={`flex-1 py-1.5 rounded font-bold border transition-all ${
                        overallResult === 'FAIL' ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      FAIL (부적합)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">검사 책임자</label>
                  <input
                    type="text"
                    value={inspector}
                    onChange={e => setInspector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                    required
                  />
                </div>
              </div>

              {/* 비고 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 / 기타 사항</label>
                <input
                  type="text"
                  placeholder="특이사항 또는 밀시트 정보"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow"
                >
                  인수검사 저장 및 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
