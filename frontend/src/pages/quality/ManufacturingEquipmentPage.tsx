import { useInspectors } from '@/hooks/useInspectors';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Cog, Plus, Search, Edit2, Trash2, Printer, X, RefreshCw, CheckSquare, Factory, Building
} from 'lucide-react';

interface ManufacturingEquipment {
  equipment_id: number;
  manage_no: string;
  equipment_name: string;
  serial_no: string | null;
  capacity_spec: string | null;
  manufacturer: string | null;
  install_location: string | null;
  purchase_date: string | null;
  memo: string | null;
  is_active: boolean;
}

export function ManufacturingEquipmentPage() {
  const [equipments, setEquipments] = useState<ManufacturingEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ManufacturingEquipment | null>(null);
  const [saving, setSaving] = useState(false);

  // 점검체크시트 인쇄 모달 상태
  const [printTarget, setPrintTarget] = useState<ManufacturingEquipment | null>(null);

  // 폼 상태
  const [formManageNo, setFormManageNo] = useState('');
  const [formEquipmentName, setFormEquipmentName] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [formCapacitySpec, setFormCapacitySpec] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formInstallLocation, setFormInstallLocation] = useState('');
  const [formMemo, setFormMemo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ManufacturingEquipment[] }>('/equipment/manufacturing');
      setEquipments(res.data || []);
    } catch {
      alert('제조설비 목록을 불러오는데 실패하였습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormManageNo(`EZC-M-${String(equipments.length + 1).padStart(2, '0')}`);
    setFormEquipmentName('');
    setFormSerialNo('');
    setFormCapacitySpec('');
    setFormManufacturer('');
    setFormPurchaseDate('');
    setFormInstallLocation('1공장 생산라인');
    setFormMemo('');
    setShowModal(true);
  };

  const openEditModal = (item: ManufacturingEquipment) => {
    setEditingItem(item);
    setFormManageNo(item.manage_no);
    setFormEquipmentName(item.equipment_name);
    setFormSerialNo(item.serial_no || '');
    setFormCapacitySpec(item.capacity_spec || '');
    setFormManufacturer(item.manufacturer || '');
    setFormPurchaseDate(item.purchase_date || '');
    setFormInstallLocation(item.install_location || '');
    setFormMemo(item.memo || '');
    setShowModal(true);
  };

  const handleDelete = async (item: ManufacturingEquipment) => {
    if (!confirm(`[${item.manage_no}] ${item.equipment_name} 설비를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/equipment/manufacturing/${item.equipment_id}`);
      loadData();
    } catch {
      alert('삭제 중 오류가 발생하였습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formManageNo || !formEquipmentName) {
      alert('관리번호와 설비명은 필수 입력 항목입니다.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        manage_no: formManageNo,
        equipment_name: formEquipmentName,
        serial_no: formSerialNo,
        capacity_spec: formCapacitySpec,
        manufacturer: formManufacturer,
        purchase_date: formPurchaseDate || null,
        install_location: formInstallLocation,
        memo: formMemo,
      };

      if (editingItem) {
        await api.put(`/equipment/manufacturing/${editingItem.equipment_id}`, payload);
      } else {
        await api.post('/equipment/manufacturing', payload);
      }

      setShowModal(false);
      loadData();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const filteredEquipments = equipments.filter((eq) =>
    eq.manage_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eq.equipment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (eq.serial_no && eq.serial_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (eq.install_location && eq.install_location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="⚙️ 제조설비 관리 (EZC M-101)"
        description="배합기, 압출기(1·2호기), 시트 절단기, 분쇄기 등 제조설비 29종 마스터 및 점검체크시트(EZC M-101-6) 출력"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> 제조설비 등록
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold shadow-sm"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 새로고침
          </button>
        </div>
      </PageHeader>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl"><Cog className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">총 제조설비</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{equipments.length}대</p>
            <p className="text-[10px] text-slate-400">EZC M-101 등록건</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl"><Factory className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">1공장 (배합·압출)</p>
            <p className="text-lg font-black text-blue-900 mt-0.5">
              {equipments.filter((e) => e.install_location?.includes('1공장')).length}대
            </p>
            <p className="text-[10px] text-slate-400">믹서, 압출 1·2호기</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-xl"><Building className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">2공장 (재단동)</p>
            <p className="text-lg font-black text-amber-900 mt-0.5">
              {equipments.filter((e) => e.install_location?.includes('2공장')).length}대
            </p>
            <p className="text-[10px] text-slate-400">시트/소켓 재단기</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl"><CheckSquare className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">유틸리티 & 시험실</p>
            <p className="text-lg font-black text-indigo-900 mt-0.5">
              {equipments.filter((e) => e.install_location?.includes('유틸리티') || e.install_location?.includes('시험실')).length}대
            </p>
            <p className="text-[10px] text-slate-400">컴프레서, 에어드라이어</p>
          </div>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="관리번호, 설비명, 시리얼, 설치장소 검색"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                <th className="p-3 w-28 text-center">관리번호</th>
                <th className="p-3">설비명 / 기기번호</th>
                <th className="p-3">용량 및 규격</th>
                <th className="p-3">제조회사</th>
                <th className="p-3">설치 장소</th>
                <th className="p-3 text-center">구입일자</th>
                <th className="p-3 text-center w-40">점검시트 인쇄</th>
                <th className="p-3 text-center w-20">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    등록된 제조설비가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((eq) => (
                  <tr key={eq.equipment_id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {eq.manage_no}
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{eq.equipment_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {eq.serial_no ? `S/N: ${eq.serial_no}` : '시리얼 미기재'}
                      </p>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">
                      {eq.capacity_spec || '-'}
                    </td>
                    <td className="p-3 text-slate-800">
                      {eq.manufacturer || '-'}
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        📍 {eq.install_location}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {eq.purchase_date || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setPrintTarget(eq)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[11px] shadow-2xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        점검시트 (M-101-6)
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(eq)}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="수정"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(eq)}
                          className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 / 수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Cog className="h-5 w-5 text-slate-700" />
                {editingItem ? `[${editingItem.manage_no}] 제조설비 수정` : '신규 제조설비 등록'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">관리번호 *</label>
                  <input
                    type="text"
                    value={formManageNo}
                    onChange={(e) => setFormManageNo(e.target.value)}
                    placeholder="예: EZC-M-01"
                    className="w-full border rounded-lg px-3 py-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">설비명 *</label>
                  <input
                    type="text"
                    value={formEquipmentName}
                    onChange={(e) => setFormEquipmentName(e.target.value)}
                    placeholder="예: Paddle Mixer (배합기)"
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">기기번호 (시리얼)</label>
                  <input
                    type="text"
                    value={formSerialNo}
                    onChange={(e) => setFormSerialNo(e.target.value)}
                    placeholder="예: TD20030421"
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">용량 및 동력 규격</label>
                  <input
                    type="text"
                    value={formCapacitySpec}
                    onChange={(e) => setFormCapacitySpec(e.target.value)}
                    placeholder="예: 380V / 90kw, Max 500L"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">제조회사</label>
                  <input
                    type="text"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    placeholder="예: FREIND MACHINERY, TANDY"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">구입일자</label>
                  <input
                    type="date"
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">설치 장소</label>
                <input
                  type="text"
                  value={formInstallLocation}
                  onChange={(e) => setFormInstallLocation(e.target.value)}
                  placeholder="예: 1공장 배합실, 1공장 압출 1호기, 2공장 재단동"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">비고</label>
                <textarea
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="특이사항 및 점검 주기 기재"
                  className="w-full border rounded-lg px-3 py-2 h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '저장 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖨️ EZC M-101-6 제조 점검체크시트 인쇄 모달 */}
      {printTarget && (
        <EquipmentChecklistPrintModal
          equipment={printTarget}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 🖨️ EZC M-101-6 제조 점검체크시트 전용 인쇄 모달 (Print Checklist Sheet)
 * ───────────────────────────────────────────────────────────────────────────── */
function EquipmentChecklistPrintModal({
  equipment,
  onClose,
}: {
  equipment: ManufacturingEquipment;
  onClose: () => void;
}) {
  const { inspectors } = useInspectors();
  const [checkMonth, setCheckMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [inspector, setInspector] = useState('김정용 책임');




  const handlePrint = () => {
    window.print();
  };

  const CHECK_ITEMS = [
    { no: 1, item: '전원 및 주동력 모터 상태', standard: '배선 손상 없음, 이상 발열 및 진동 없을 것', cycle: '일일' },
    { no: 2, item: '비상정지 버튼 및 안전 장치', standard: '눌림 시 즉시 가동 중지 및 복구 정상 작동', cycle: '일일' },
    { no: 3, item: '배합/압출 스크류 및 블레이드', standard: '이물질 끼임 없음, 블레이드 마모 상태 유호', cycle: '일일' },
    { no: 4, item: '유압/오일 및 감속기 오일량', standard: '게이지 정상 범위, 누유 및 누설 없을 것', cycle: '주간' },
    { no: 5, item: '히터 및 온도조절계 (실측)', standard: '설정 온도와 실측 온도 오차 5℃ 이내', cycle: '일일' },
    { no: 6, item: '칠러 / 냉각수 수압 및 유량', standard: '수압 2~4kg/㎠, 유량 정상 순환', cycle: '일일' },
    { no: 7, item: '집진기 및 분쇄 배관 청결', standard: '분쇄 먼지 누출 없음, 배관 막힘 없을 것', cycle: '주간' },
    { no: 8, item: '에어 컴프레서 수분 드레인', standard: '에어 탱크 내 응축수 수동 드레인 실시', cycle: '일일' },
    { no: 9, item: '시트 절단기 칼날 마모 상태', standard: '재단 단면 깔끔함, 칼날 이빨 빠짐 없을 것', cycle: '주간' },
    { no: 10, item: '설비 주변 5S 청정 상태', standard: '원료 찌꺼기 제거, 바닥 기름때 청소 완료', cycle: '일일' },
  ];

  // 설비 관리번호 및 설비명 기반 사규 EZC M-101-6 점검항목 1:1 정밀 자동 매칭
  const getEquipmentSpecItems = () => {
    const manageNo = (equipment.manage_no || '').toUpperCase().trim();
    const name = (equipment.equipment_name || '').toUpperCase().trim();

    // 1. Chiller (냉각기) - EZC M-21-2, EZC M-23-5, Chiller 등
    if (name.includes('CHILLER') || name.includes('냉각기') || manageNo.includes('M-21-2') || manageNo.includes('M-23-5')) {
      return {
        groupName: 'Chiller (냉각기)',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호할 것', cycle: '주 1회' },
          { part: '모    터', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
          { part: '냉 각 수', item: '오수 발생 유무: 냉각수의 오염으로 인한 오수 발생이 없을 것', cycle: '주 1회' },
          { part: '냉매가스', item: '가스게이지: 가스게이지 설정 값을 확인 할 것', cycle: '주 1회' },
        ]
      };
    }

    // 2. 온조기 - EZC M-21-3, EZC M-23-2, EZC M-23-3, EZC M-23-4 등
    if (name.includes('온조기') || manageNo.includes('M-21-3') || manageNo.includes('M-23-2') || manageNo.includes('M-23-3') || manageNo.includes('M-23-4')) {
      return {
        groupName: '온조기',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '조작판넬', item: '작동상태: 조작판넬 작동이 원활할 것', cycle: '주 1회' },
          { part: '회 전 부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '월 1회' },
          { part: '열매체유', item: '유량: 유량표시기 적정량 이하로 내려가지 않을 것', cycle: '주 1회' },
        ]
      };
    }

    // 3. Paddle Mixer - EZC M-09
    if (name.includes('PADDLE') || manageNo.includes('M-09')) {
      return {
        groupName: 'Paddle Mixer',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호할 것', cycle: '주 1회' },
          { part: '패    들', item: '스케일 제거: 매주 스케일 제거하여 배합에 이상이 없을 것', cycle: '주 1회' },
          { part: '회 전 부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '주 1회' },
        ]
      };
    }

    // 4. 35Φ Single Extruder - EZC M-10
    if (name.includes('35') || manageNo.includes('M-10')) {
      return {
        groupName: '35Φ Single Extruder',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호할 것', cycle: '주 1회' },
          { part: '모    터', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
          { part: '냉 각 수', item: '냉강수량: 적정수량 이하로 내려가지 않을 것', cycle: '주 1회' },
          { part: '윤 활 유', item: '유량: 유량표시기 적정량 이하로 내려가지 않을 것', cycle: '주 1회' },
        ]
      };
    }

    // 5. 120Φ 싱글 압출기 / 65Φ 코니칼 압출기 - EZC M-21-1, EZC M-23-1, EZC M-24
    if (name.includes('EXTRUDER') || name.includes('압출') || manageNo.includes('M-21-1') || manageNo.includes('M-23-1') || manageNo.includes('M-24')) {
      return {
        groupName: name.includes('120') ? '120Φ Single Extruder' : 'Twin Conical Extruder (65Φ)',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호할 것', cycle: '주 1회' },
          { part: '모    터', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
          { part: '윤 활 유', item: '유량: 유량표시기 적정량 이하로 내려가지 않을 것', cycle: '주 1회' },
          { part: '회 전 부', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
        ]
      };
    }

    // 6. 시트 재단기(커팅머신) - EZC M-31
    if (name.includes('재단') || name.includes('커팅') || manageNo.includes('M-31')) {
      return {
        groupName: '시트 재단기(커팅머신)',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호할 것', cycle: '주 1회' },
          { part: '회 전 부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '월 1회' },
          { part: '회 전 부', item: '윤활유 도포: 회전축에 윤활유(WD-40)를 발라 마모가 없도록 할 것', cycle: '주 1회' },
        ]
      };
    }

    // 7. 핫프레스 - EZC M-41
    if (name.includes('프레스') || name.includes('PRESS') || manageNo.includes('M-41')) {
      return {
        groupName: '핫프레스',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '조작판넬', item: '작동상태: 작동이 원활할 것', cycle: '주 1회' },
          { part: '모    터', item: '작동상태: 상하 작동이 원활할 것', cycle: '월 1회' },
          { part: '모    터', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
          { part: '열매체유', item: '주입상태: 적정 수준 이상으로 유지할 것', cycle: '주 1회' },
        ]
      };
    }

    // 8. Air 컴프레샤 - EZC M-51, M-52, M-53
    if (name.includes('컴프') || name.includes('COMP') || manageNo.includes('M-51') || manageNo.includes('M-52') || manageNo.includes('M-53')) {
      return {
        groupName: 'Air 컴프레샤',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '스 위 치', item: '작동상태: S/W의 작동상태는 양호 할 것', cycle: '주 1회' },
          { part: '배    관', item: '누출상태: 에어의 누출이 없을 것', cycle: '월 1회' },
          { part: '기어회전부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '월 1회' },
        ]
      };
    }

    // 9. 집진기 - EZC M-54, M-55
    if (name.includes('집진') || manageNo.includes('M-54') || manageNo.includes('M-55')) {
      return {
        groupName: '집진기',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '조작판넬', item: '작동상태: 작동이 원활할 것', cycle: '주 1회' },
          { part: '회 전 부', item: '벨트상태: 회전벨트 결합 위치 및 갈라짐이 없을 것', cycle: '월 1회' },
          { part: '회 전 부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '월 1회' },
        ]
      };
    }

    // 10. High Speed Mixer & Cooling Mixer (기타 믹서류 - EZC M-01 ~ M-08)
    if (name.includes('MIXER') || name.includes('믹서') || manageNo.includes('M-0') || name.includes('배합')) {
      return {
        groupName: 'High Speed Mixer & Cooling Mixer',
        items: [
          { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
          { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
          { part: '조작판넬', item: '작동상태: 작동이 원활할 것', cycle: '주 1회' },
          { part: '모    터', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
          { part: '이송배관', item: '배관막힘: 배관부 막힘이 없을 것', cycle: '주 1회' },
          { part: '회 전 부', item: '이상소음: 과도한 소음이 없을 것', cycle: '주 1회' },
        ]
      };
    }

    // 디폴트 
    return {
      groupName: '일반 제조설비 점검표',
      items: [
        { part: '몸    체', item: '청결상태: 먼지 및 이물질의 부착이 없을 것', cycle: '주 1회' },
        { part: '전 원 부', item: '절연상태: 케이블의 마모 및 피복의 파손이 없을 것', cycle: '주 1회' },
        { part: '스 위 치', item: '작동상태: S/W 및 조작판넬의 작동이 원활할 것', cycle: '주 1회' },
        { part: '회 전 부', item: '주유상태: 회전축에 충분히 주유될 것', cycle: '월 1회' },
        { part: '안 전 장 치', item: '비상정지 및 안전덮개 상태 양호할 것', cycle: '주 1회' },
      ]
    };
  };

  const specData = getEquipmentSpecItems();
  const yearText = checkMonth ? checkMonth.slice(0, 4) : new Date().getFullYear().toString();
  const monthText = checkMonth ? checkMonth.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-slate-200" onClick={e => e.stopPropagation()}>
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <div className="px-6 py-4 border-b bg-slate-900 text-white flex justify-between items-center print:hidden rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Printer className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-amber-300">📋 사규 EZC M-101-6 제조 점검체크시트</h3>
              <p className="text-[11px] text-slate-300">설비별 맞춤 점검항목 A4 인쇄 표준양식 ({specData.groupName})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] font-bold text-slate-300">점검자:</span>
              <select
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold rounded px-2 py-0.5 outline-none border border-slate-700"
              >
                {inspectors.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <input
              type="month"
              value={checkMonth}
              onChange={(e) => setCheckMonth(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-white font-mono font-bold"
            />

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition"
            >
              <Printer className="h-4 w-4" /> 점검시트 인쇄
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold transition">
              ×
            </button>
          </div>
        </div>

        {/* 🖨️ 실제 인쇄되는 A4 표준 제조설비 점검표 서식 (사규 EZC M-101-6 100% 동일) */}
        <div className="p-6 overflow-y-auto flex-1 bg-white print:p-0 print:overflow-visible text-slate-900">
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body * { visibility: hidden; }
              #printable-equipment-sheet, #printable-equipment-sheet * { visibility: visible; }
              #printable-equipment-sheet {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 0;
                margin: 0;
                box-sizing: border-box;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
              }
              .print\\:hidden { display: none !important; }
            }
          `}</style>

          <div id="printable-equipment-sheet" className="border-2 border-slate-900 p-5 bg-white text-slate-900 text-xs font-sans space-y-3">
            {/* 상단 타이틀 & 3단 결재란 */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2">
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  제조설비 점검체크 시트
                  <span className="text-xs font-bold text-slate-600 font-mono">({specData.groupName})</span>
                </h1>
                <p className="text-xs font-bold text-slate-700 font-mono">
                  점검년도 : <span className="underline decoration-2 font-black">{yearText}</span> 년
                </p>
              </div>

              {/* 3단 결재란 (작성자: 선택한 성명, 검토/승인: 서명란) */}
              <table className="border-collapse border-2 border-slate-900 text-center text-[10px] ml-auto">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="bg-slate-100 font-bold border border-slate-900 px-1.5 py-1 w-6 text-center">결<br/>재</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">작 성</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">검 토</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">승 인</td>
                  </tr>
                  <tr className="h-10">
                    <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1 text-center">{inspector}</td>
                    <td className="border border-slate-900 w-16 bg-white"></td>
                    <td className="border border-slate-900 w-16 bg-white"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 설비 정보 라인 */}
            <table className="w-full text-xs border-collapse border-2 border-slate-900">
              <tbody>
                <tr className="h-8">
                  <td className="bg-slate-100 font-bold p-1.5 w-20 border border-slate-900 text-center">설 비 명</td>
                  <td className="p-1.5 border border-slate-900 font-black text-slate-900 w-52">{equipment.equipment_name}</td>
                  <td className="bg-slate-100 font-bold p-1.5 w-20 border border-slate-900 text-center">관리번호</td>
                  <td className="p-1.5 border border-slate-900 font-mono font-extrabold text-blue-900 w-36">{equipment.manage_no}</td>
                  <td className="bg-slate-100 font-bold p-1.5 w-20 border border-slate-900 text-center">기기번호</td>
                  <td className="p-1.5 border border-slate-900 font-mono font-bold text-slate-900">{equipment.serial_no || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 메인 점검 항목 테이블 (사규 EZC M-101-6 100% 동일) */}
            <table className="w-full text-[11px] border-collapse border-2 border-slate-900 text-left">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900 text-center font-bold">
                  <th className="p-2 border border-slate-900 w-24">점검개소</th>
                  <th className="p-2 border border-slate-900">점검항목 및 합격기준</th>
                  <th className="p-2 border border-slate-900 w-20">점검주기</th>
                  <th className="p-1 border border-slate-900 w-36 text-center">
                    <div>{yearText} 년 {monthText} 월</div>
                    <div className="grid grid-cols-5 border-t border-slate-900 mt-1 pt-0.5 text-[10px]">
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {specData.items.map((it, idx) => (
                  <tr key={idx} className="h-9">
                    <td className="p-2 border border-slate-900 text-center font-bold bg-slate-50/50">{it.part}</td>
                    <td className="p-2 border border-slate-900 font-medium text-slate-900">{it.item}</td>
                    <td className="p-2 border border-slate-900 text-center font-bold text-slate-700">{it.cycle}</td>
                    <td className="p-0 border border-slate-900 text-center">
                      <div className="grid grid-cols-5 h-full items-center divide-x divide-slate-900 text-[10px] font-mono">
                        <span className="h-full flex items-center justify-center"></span>
                        <span className="h-full flex items-center justify-center"></span>
                        <span className="h-full flex items-center justify-center"></span>
                        <span className="h-full flex items-center justify-center"></span>
                        <span className="h-full flex items-center justify-center"></span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 하단 점검자 및 안내사항 (사규 EZC M-101-6 복원) */}
            <div className="border-2 border-slate-900 p-2.5 text-[10.5px] leading-relaxed space-y-1 bg-slate-50/30">
              <div className="flex justify-between items-center font-bold text-slate-900 border-b border-slate-300 pb-1">
                <span>점  검  자 : <strong className="text-blue-900 font-black">{inspector}</strong> (설비관리담당자)</span>
                <span className="text-[10px] text-slate-600 font-mono">점검방법 (양호: ✔, 불량: × 로 표기함)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-700 pt-1">
                <div>
                  <p className="font-bold text-slate-900">※ 특기사항</p>
                  <p>∙ 이상발생 시 품질관리부서장에게 보고 후 조치를 받는다.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900">※ 점검일자</p>
                  <p>∙ 주간점검 : 매주 수요일 / 월간점검 : 매월 마지막 수요일</p>
                </div>
              </div>
            </div>

            {/* 풋터 양식번호 */}
            <div className="flex justify-between items-center text-[9.5px] font-mono text-slate-600 pt-1">
              <span>EZC-M-101-6</span>
              <span className="font-bold text-slate-900">(주) 이지원</span>
              <span>A4 (210 × 297)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

