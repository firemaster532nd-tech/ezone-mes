import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { HelpCircle, Plus, Settings } from 'lucide-react';

export function NonCertifiedInspectionPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  // 신규 검사기준 등록 폼 상태
  const [newItemName, setNewItemName] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [newMinValue, setNewMinValue] = useState<number>(0);
  const [newMaxValue, setNewMaxValue] = useState<number>(100);
  const [newUnit, setNewUnit] = useState('mm');
  const [newToolName, setNewToolName] = useState('버니어캘리퍼스');

  // 인수검사 성적서 폼 상태
  const [selectedCriteria, setSelectedCriteria] = useState('');
  const [supplierLot, setSupplierLot] = useState('');
  const [qty, setQty] = useState<number>(50);
  const [inspector, setInspector] = useState('임병용');
  const [n1, setN1] = useState<number>(50);
  const [n2, setN2] = useState<number>(50);
  const [n3, setN3] = useState<number>(50);
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inspRes, critRes] = await Promise.all([
        api.get<{ data: any[] }>('/inspections?insp_type=INCOMING&category=NON'),
        api.get<{ data: any[] }>('/inspection-criteria?category=NON_CERT')
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

  // 신규 검사기준 등록 제출
  const handleAddCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) { alert('품목명을 입력해 주세요.'); return; }
    try {
      await api.post('/inspection-criteria', {
        category: 'NON_CERT',
        item_name: newItemName.trim(),
        spec: newSpec,
        min_value: newMinValue,
        max_value: newMaxValue,
        unit: newUnit,
        tool_name: newToolName,
      });
      alert('신규 비인정제품 검사기준이 등록되었습니다!');
      setShowCriteriaModal(false);
      setNewItemName('');
      fetchData();
    } catch {
      alert('검사기준 등록 중 오류가 발생했습니다.');
    }
  };

  // 인수검사성적서 등록 제출
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const crit = criteria.find(c => String(c.criteria_id) === selectedCriteria);
    if (!crit) { alert('비인정 제품 검사 항목을 선택해 주세요.'); return; }

    try {
      await api.post('/inspections', {
        insp_type: 'INCOMING',
        category: 'NON',
        item_name: crit.item_name,
        item_category: 'NON',
        inspector,
        supplier_lot: supplierLot,
        qty,
        n1, n2, n3,
        min_value: crit.min_value,
        max_value: crit.max_value,
        notes
      });
      alert('비인정제품 인수검사가 등록되었으며 합격 처리 시 사규 NON-LOT가 채번되어 재고 승인됩니다!');
      setShowModal(false);
      fetchData();
    } catch {
      alert('인수검사 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader 
        title="❓ 비인정제품 인수검사" 
        description="사규 비인정 신규/시험/실험 재료 전용 동적 검사기준 신규등록 및 인수검사 승인"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setShowCriteriaModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            <Settings className="h-4 w-4" />
            + 신규 검사기준 등록
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow"
          >
            <Plus className="h-4 w-4" />
            신규 비인정 인수검사 등록
          </button>
        </div>
      </PageHeader>

      {/* 등록된 비인정 검사기준 카드 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            ⚙️ 현재 사용자가 등록한 비인정제품 검사기준 목록
          </h4>
          <span className="text-xs text-slate-500">총 {criteria.length}개 기준</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {criteria.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">등록된 검사기준이 없습니다. 상단 [+ 신규 검사기준 등록] 버튼을 눌러 등록해 주세요.</p>
          ) : criteria.map(c => (
            <div key={c.criteria_id} className="bg-slate-100/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium flex items-center gap-2">
              <span className="font-bold text-purple-700">{c.item_name}</span>
              <span className="text-slate-400">({c.spec || '규격미정'})</span>
              <span className="bg-white px-1.5 py-0.5 rounded border text-[11px] font-mono">{c.min_value}~{c.max_value}{c.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">비인정제품 인수검사성적서 내역</h3>
          <span className="text-xs text-slate-500">총 {inspections.length}건</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-3">검사일시</th>
              <th className="px-4 py-3">비인정 품목명</th>
              <th className="px-4 py-3">채번된 NON-LOT</th>
              <th className="px-4 py-3">공급사 LOT</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3 text-center">판정</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">등록된 비인정제품 인수검사 내역이 없습니다.</td></tr>
            ) : inspections.map(row => (
              <tr key={row.insp_id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.inspected_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{row.item_name}</td>
                <td className="px-4 py-3 font-mono font-bold text-purple-700">{row.lot_number || '-'}</td>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* 1. 신규 검사기준 등록 모달 */}
      {showCriteriaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddCriteria} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">⚙️ 신규 비인정 검사기준 등록</h3>
              <button type="button" onClick={() => setShowCriteriaModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">비인정 품목명</label>
                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="예: 신규 고팽창 시트 파우더" className="w-full border rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">규격 / 재질</label>
                <input type="text" value={newSpec} onChange={e => setNewSpec(e.target.value)} placeholder="예: EXP-200" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">하한값 (Min)</label>
                  <input type="number" step="0.01" value={newMinValue} onChange={e => setNewMinValue(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" required />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">상한값 (Max)</label>
                  <input type="number" step="0.01" value={newMaxValue} onChange={e => setNewMaxValue(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">단위</label>
                  <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">측정기구</label>
                  <input type="text" value={newToolName} onChange={e => setNewToolName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setShowCriteriaModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">취소</button>
              <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">검사기준 저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 2. 인수검사 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleRegister} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">❓ 비인정제품 인수검사 성적서 등록</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">검사 항목 선택</label>
                <select
                  value={selectedCriteria}
                  onChange={e => setSelectedCriteria(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                  <input type="text" value={supplierLot} onChange={e => setSupplierLot(e.target.value)} placeholder="예: NON-260723-01" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">입고 수량</label>
                  <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold" required />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">n1, n2, n3 실측치</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" step="0.01" value={n1} onChange={e => setN1(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n1" required />
                  <input type="number" step="0.01" value={n2} onChange={e => setN2(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n2" required />
                  <input type="number" step="0.01" value={n3} onChange={e => setN3(Number(e.target.value))} className="border rounded px-2 py-1.5 text-center font-mono text-sm" placeholder="n3" required />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">검사 담당자</label>
                <input type="text" value={inspector} onChange={e => setInspector(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">비고</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">취소</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">검사 등록 및 NON-LOT 승인</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
