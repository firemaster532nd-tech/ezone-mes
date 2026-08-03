import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { FlaskConical, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

export function RawMaterialInspectionPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 폼 상태 (D101~D104 원재료 전용)
  const [selectedCriteria, setSelectedCriteria] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [qty, setQty] = useState<number>(300);
  const [inspector, setInspector] = useState('김정용');
  const [n1, setN1] = useState<number>(300);
  const [n2, setN2] = useState<number>(300);
  const [n3, setN3] = useState<number>(300);
  const [targetLocation, setTargetLocation] = useState('A1');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inspRes, critRes] = await Promise.all([
        api.get<{ data: any[] }>('/inspections?insp_type=INCOMING&category=RM'),
        api.get<{ data: any[] }>('/inspection-criteria?category=RAW')
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
    if (!crit) { alert('원재료 검사 항목을 선택해 주세요.'); return; }

    try {
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'RM',
        item_name: crit.item_name,
        item_category: 'RM',
        inspector,
        supplier_lot: supplierLot,
        location: targetLocation,
        qty,
        n1, n2, n3,
        min_value: crit.min_value,
        max_value: crit.max_value,
        notes
      });
      alert(`원재료 인수검사가 등록되었으며 합격 시 사규 LOT 채번 후 [${targetLocation} 랙 셀]로 즉시 자동 적재됩니다!`);
      setShowModal(false);
      fetchData();
    } catch {
      alert('원재료 인수검사 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader 
        title="🧪 원재료 인수검사 (D101~D104)" 
        description="차열시트 배합원료 파우더 (D101 난연컴파운드, D102 팽창흑연, D103 EVA, D104 EP100) 인수검사 및 재고 승인"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow"
        >
          <Plus className="h-4 w-4" />
          신규 원재료 인수검사 등록
        </button>
      </PageHeader>

      {/* D101~D104 원재료 대상 품목 가이드 카드리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { code: 'D101', name: '난연컴파운드 (PE3005MB)', unit: 'kg', color: 'border-l-amber-500' },
          { code: 'D102', name: '팽창흑연 (50메쉬)', unit: 'kg', color: 'border-l-blue-500' },
          { code: 'D103', name: 'EVA (EA33045)', unit: 'kg', color: 'border-l-indigo-500' },
          { code: 'D104', name: 'EP100', unit: 'kg', color: 'border-l-purple-500' },
        ].map(item => (
          <div key={item.code} className={`bg-white p-4 rounded-xl border-l-4 ${item.color} shadow-sm border`}>
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-slate-500">{item.code}</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">배합 투입 파우더</span>
            </div>
            <p className="font-bold text-slate-800 text-sm mt-1">{item.name}</p>
          </div>
        ))}
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">원재료 인수검사성적서 및 합격 이력</h3>
          <span className="text-xs text-slate-500">총 {inspections.length}건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일시</th>
              <th className="px-4 py-3">품목명</th>
              <th className="px-4 py-3">채번된 사규 LOT</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">입고 수량</th>
              <th className="px-4 py-3 text-center">판정</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 원재료 인수검사 내역이 없습니다.</td></tr>
            ) : inspections.map(row => (
              <tr key={row.insp_id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.inspected_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{row.item_name}</td>
                <td className="px-4 py-3 font-mono font-bold text-blue-700">{row.lot_number || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.supplier_lot || '-'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{Number(row.qty||0).toLocaleString()} kg</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    row.overall_result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {row.overall_result === 'PASS' ? 'PASS (합격/재고승인)' : 'FAIL (불합격)'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.inspector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegister} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">🧪 원재료 인수검사 성적서 등록</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">원재료 품목 선택 (D101~D104)</label>
                <select
                  value={selectedCriteria}
                  onChange={e => setSelectedCriteria(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    placeholder="예: SUP-260723-01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">입고 수량 (kg)</label>
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
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <optgroup label="1구역 (O1~A3 15칸 × 3층)">
                    {['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'].flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                  <optgroup label="2구역 (P1~R3 3칸 × 3층)">
                    {['P','Q','R'].flatMap(col => [1,2,3].map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">n1, n2, n3 실측 중량 (kg)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={n1} onChange={e => setN1(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n1" required />
                  <input type="number" value={n2} onChange={e => setN2(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n2" required />
                  <input type="number" value={n3} onChange={e => setN3(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n3" required />
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
                <label className="block font-medium text-slate-700 mb-1">특이사항 및 비고</label>
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

              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">검사 등록 및 재고 승인</button>

            </div>

          </form>

        </div>

      )}

    </div>

  );

}

