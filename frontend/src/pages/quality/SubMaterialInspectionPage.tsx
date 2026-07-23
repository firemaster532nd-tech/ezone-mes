import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Box, Plus, CheckCircle, ArrowRight, Zap } from 'lucide-react';

export function SubMaterialInspectionPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 폼 상태 (부자재 전용 + FN테크 슬리브/보호철판)
  const [selectedCriteria, setSelectedCriteria] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [qty, setQty] = useState<number>(100);
  const [inspector, setInspector] = useState('최진영');
  const [n1, setN1] = useState<number>(1.6);
  const [n2, setN2] = useState<number>(1.6);
  const [n3, setN3] = useState<number>(1.6);
  const [targetLocation, setTargetLocation] = useState('P1');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inspRes, critRes] = await Promise.all([
        api.get<{ data: any[] }>('/inspections?insp_type=INCOMING&category=SM'),
        api.get<{ data: any[] }>('/inspection-criteria?category=SUB')
      ]);
      setInspections(inspRes.data || []);
      setCriteria(critRes.data || []);
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
    const crit = criteria.find(c => String(c.criteria_id) === selectedCriteria);
    if (!crit) { alert('부자재 검사 항목을 선택해 주세요.'); return; }

    try {
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'SM',
        item_name: crit.item_name,
        item_category: 'SM',
        inspector,
        supplier_lot: supplierLot,
        location: targetLocation,
        qty,
        n1, n2, n3,
        min_value: crit.min_value,
        max_value: crit.max_value,
        notes
      });
      alert(`부자재 인수검사가 등록되었으며 합격 시 사규 LOT 채번 후 [${targetLocation} 랙 셀]로 자동 적재됩니다!`);
      setShowModal(false);
      fetchData();
    } catch {
      alert('부자재 인수검사 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader 
        title="📦 부자재 인수검사 & FN테크 자동연동" 
        description="강재류, 그라스울, 세라믹울 및 FN테크 슬리브/보호철판 인수검사합격 ➔ FN테크 재고현황 자동 입고 연동"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow"
        >
          <Plus className="h-4 w-4" />
          신규 부자재 인수검사 등록
        </button>
      </PageHeader>

      {/* FN테크 자동 연동 안내 배너 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 text-white rounded-lg">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-900 text-sm">⚡ FN테크 작업지시 & 재고 실시간 연동 지원</h4>
            <p className="text-emerald-700 text-xs mt-0.5">
              FN테크 슬리브(FN-P100 등) 및 보호철판 합격 시 <span className="font-bold underline">FN테크 원자재 재고(fn_material_stock)</span>에 자동 반영되어 FN테크 작업지시에 바로 투입 가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">부자재 인수검사성적서 내역</h3>
          <span className="text-xs text-slate-500">총 {inspections.length}건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일시</th>
              <th className="px-4 py-3">부자재 품목명</th>
              <th className="px-4 py-3">채번된 사규 LOT</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3 text-center">판정 / 연동</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 부자재 인수검사 내역이 없습니다.</td></tr>
            ) : inspections.map(row => {
              const isFnTech = (row.item_name||'').includes('FN') || (row.item_name||'').includes('슬리브') || (row.item_name||'').includes('보호철판');
              return (
                <tr key={row.insp_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.inspected_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {row.item_name}
                    {isFnTech && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">FN테크</span>}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">{row.lot_number || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.supplier_lot || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{Number(row.qty||0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      row.overall_result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {row.overall_result === 'PASS' ? 'PASS (합격/재고승인)' : 'FAIL (불합격)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.inspector}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegister} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">📦 부자재 인수검사 성적서 등록</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">부자재 품목 선택 (FN테크 슬리브 포함)</label>
                <select
                  value={selectedCriteria}
                  onChange={e => setSelectedCriteria(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- 품목 선택 --</option>
                  {criteria.map(c => (
                    <option key={c.criteria_id} value={c.criteria_id}>
                      {c.item_name} ({c.spec || '기본'}) [기준: {c.min_value}~{c.max_value}{c.unit}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">공급사 LOT</label>
                  <input
                    type="text"
                    value={supplierLot}
                    onChange={e => setSupplierLot(e.target.value)}
                    placeholder="예: FN-260723-01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">입고 수량</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">합격 시 입고 적재 랙 위치 (A1~U3)</label>
                <select
                  value={targetLocation}
                  onChange={e => setTargetLocation(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <optgroup label="1구역 (O1~A3 15칸 × 3층)">
                    {['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'].flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                  <optgroup label="2구역 (U1~P3 6칸 × 3층)">
                    {['U','T','S','R','Q','P'].flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">n1, n2, n3 치수/실측치</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" step="0.01" value={n1} onChange={e => setN1(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n1" required />
                  <input type="number" step="0.01" value={n2} onChange={e => setN2(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n2" required />
                  <input type="number" step="0.01" value={n3} onChange={e => setN3(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n3" required />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">검사 담당자</label>
                <input
                  type="text"
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">비고</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">취소</button>

              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">검사 등록 및 FN테크 연동 승인</button>

            </div>

          </form>

        </div>

      )}

    </div>

  );

}

