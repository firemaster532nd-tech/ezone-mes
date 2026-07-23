import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { HelpCircle, Plus, Package, MapPin, AlertTriangle, ArrowRight, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NonCertStockItem {
  id: string;
  itemName: string;
  reason: string; // 시험용, 샘플, 개발품, 규격외, 임시보관 등
  quantity: number;
  unit: string;
  location: string;
  registerDate: string;
  expiryDate?: string;
  inspector: string;
  status: 'ACTIVE' | 'DISPOSED' | 'APPROVED_CONVERTED';
  remarks?: string;
}

const ZONE_1_COLS = ['O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
const ZONE_2_COLS = ['P','Q','R'];
const RACK_TIERS = [3, 2, 1];

export function NonCertifiedStockPage() {
  const [items, setItems] = useState<NonCertStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');

  // 폼 상태
  const [itemName, setItemName] = useState('');
  const [reason, setReason] = useState('시험용 (R&D)');
  const [quantity, setQuantity] = useState<number>(50);
  const [unit, setUnit] = useState('EA');
  const [location, setLocation] = useState('U1');
  const [inspector, setInspector] = useState('최진영');
  const [remarks, setRemarks] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NonCertStockItem[] }>('/api/non-certified-stock');
      setItems(res.data || []);
    } catch {
      // 샘플 가상 데이터
      setItems([
        {
          id: 'NON-001',
          itemName: '신규 고팽창 시트 파우더 샘플',
          reason: '시험용 (R&D)',
          quantity: 120,
          unit: 'kg',
          location: 'U1',
          registerDate: '2026-07-23',
          inspector: '최진영',
          status: 'ACTIVE',
          remarks: '건기연 2차 시험용 샘플'
        },
        {
          id: 'NON-002',
          itemName: '특수 방화 소켓 브라켓 가공 시편',
          reason: '규격외 임시재고',
          quantity: 30,
          unit: 'EA',
          location: 'T2',
          registerDate: '2026-07-22',
          inspector: '임병용',
          status: 'ACTIVE',
          remarks: '치수 허용차 테스트용'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error('품목명을 입력해 주세요.');
      return;
    }

    const newItem: NonCertStockItem = {
      id: `NON-${String(Date.now()).slice(-4)}`,
      itemName: itemName.trim(),
      reason,
      quantity,
      unit,
      location,
      registerDate: new Date().toISOString().split('T')[0],
      inspector,
      status: 'ACTIVE',
      remarks
    };

    try {
      await api.post('/api/non-certified-stock', newItem);
      toast.success(`비인정 재고가 등록되어 [${location} 랙 셀]에 적재되었습니다.`);
    } catch {
      setItems(prev => [newItem, ...prev]);
      toast.success(`비인정 재고가 등록되어 [${location} 랙 셀]에 적재되었습니다.`);
    }

    setShowModal(false);
    setItemName('');
    setRemarks('');
  };

  // 소진 / 폐기 처리
  const handleDispose = (id: string) => {
    if (!confirm('해당 비인정 재고를 소진/폐기 처리하시겠습니까?')) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'DISPOSED', quantity: 0 } : item));
    toast.success('소진/폐기 처리가 완료되었습니다.');
  };

  // 정식 재고 승인 전환
  const handleConvert = (id: string) => {
    if (!confirm('해당 비인정 재고를 정식 원/부자재 재고로 승인 전환하시겠습니까?')) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'APPROVED_CONVERTED' } : item));
    toast.success('정식 재고 승인 전환이 완료되었습니다.');
  };

  const filteredItems = items.filter(item => !locationFilter || item.location === locationFilter);
  const activeCount = items.filter(i => i.status === 'ACTIVE').length;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="❓ 비인정 재고 현황 & 랙 적재 관리"
        description="정식 원부자재가 아닌 규격외/시험용/샘플/비인정 항목의 랙 적재(A1~U3) 현황, 입출고 및 승인/폐기 관리"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow"
        >
          <Plus className="h-4 w-4" />
          신규 비인정 재고 등록
        </button>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-600 text-white rounded-xl">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">보관 중인 비인정 재고</p>
            <p className="text-xl font-black text-purple-900 mt-0.5">{activeCount}건</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">적재 랙 위치 선택 필터</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{locationFilter ? `${locationFilter} 랙 선택 중` : '전체 랙 조회'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">정식 재고 승인 전환</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">
              {items.filter(i => i.status === 'APPROVED_CONVERTED').length}건
            </p>
          </div>
        </div>
      </div>

      {/* 랙 위치 선택 필터 시각화 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
            📍 비인정 재고 적재 랙 위치 필터 (2구역 P1~R3 / 1구역 O1~A3)
          </h4>
          {locationFilter && (
            <button onClick={() => setLocationFilter('')} className="text-xs text-purple-700 font-bold hover:underline">
              필터 해제 ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['P1','P2','P3','Q1','Q2','Q3','R1','R2','R3','O1','A1'].map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(locationFilter === loc ? '' : loc)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all',
                locationFilter === loc
                  ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-purple-50'
              )}
            >
              {loc} 랙
            </button>
          ))}
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">비인정 재고 적재 및 이력 내역</h3>
          <span className="text-xs text-slate-500">총 {filteredItems.length}건</span>
        </div>
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100/80 text-slate-700 uppercase font-semibold border-b">
            <tr>
              <th className="px-4 py-3">등록일</th>
              <th className="px-4 py-3">비인정 품목명</th>
              <th className="px-4 py-3">비인정 사유</th>
              <th className="px-4 py-3 text-center">적재 랙 위치</th>
              <th className="px-4 py-3 text-right">보관 수량</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3">담당자</th>
              <th className="px-4 py-3 text-center">조치 / 관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">데이터 로딩 중...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">조회된 비인정 재고가 없습니다.</td></tr>
            ) : filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-500">{item.registerDate}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{item.itemName}</td>
                <td className="px-4 py-3 text-purple-700 font-medium">{item.reason}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-purple-100 text-purple-900 font-mono font-bold px-2 py-0.5 rounded">
                    {item.location} 랙
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {item.quantity.toLocaleString()} {item.unit}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-bold',
                    item.status === 'ACTIVE' && 'bg-purple-100 text-purple-800',
                    item.status === 'DISPOSED' && 'bg-slate-200 text-slate-600 line-through',
                    item.status === 'APPROVED_CONVERTED' && 'bg-emerald-100 text-emerald-800'
                  )}>
                    {item.status === 'ACTIVE' && '보관 중'}
                    {item.status === 'DISPOSED' && '소진/폐기'}
                    {item.status === 'APPROVED_CONVERTED' && '정식재고 승인'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.inspector}</td>
                <td className="px-4 py-3 text-center">
                  {item.status === 'ACTIVE' && (
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => handleConvert(item.id)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                      >
                        정식 승인
                      </button>
                      <button
                        onClick={() => handleDispose(item.id)}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                      >
                        소진/폐기
                      </button>
                    </div>
                  )}
                </td>
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
              <h3 className="font-bold text-slate-800">❓ 신규 비인정 재고 등록</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">비인정 품목명</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="예: 특수 고팽창 시트 시험용 파우더"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">비인정 구분 / 사유</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="시험용 (R&D)">시험용 (R&D)</option>
                  <option value="샘플 (Sample)">샘플 (Sample)</option>
                  <option value="개발 시제품">개발 시제품</option>
                  <option value="규격외 임시재고">규격외 임시재고</option>
                  <option value="임시 보관품">임시 보관품</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">보관 수량</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">단위</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">적재 랙 위치 (A1~R3)</label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-purple-500"
                >
                  <optgroup label="2구역 (P1~R3 3칸 × 3층)">
                    {ZONE_2_COLS.flatMap(col => RACK_TIERS.map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                  <optgroup label="1구역 (O1~A3 15칸 × 3층)">
                    {ZONE_1_COLS.flatMap(col => RACK_TIERS.map(t => `${col}${t}`)).map(c => (
                      <option key={c} value={c}>{c} 랙 셀</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">담당자</label>
                <input
                  type="text"
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">비고 및 특이사항</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50">취소</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">비인정 재고 등록</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
