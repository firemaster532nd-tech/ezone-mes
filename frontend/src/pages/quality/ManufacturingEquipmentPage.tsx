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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <div className="px-6 py-4 border-b bg-slate-800 text-white flex justify-between items-center print:hidden rounded-t-xl">
          <div className="flex items-center gap-3">
            <Printer className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">제조 설비 점검체크시트 인쇄 (EZC M-101-6)</h3>
              <p className="text-[11px] text-slate-300">A4 수평 양식 표준 제조설비 점검표</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-700 px-2 py-1 rounded border border-slate-600">
              <span className="text-[11px] font-bold text-slate-300">✍️ 작성자:</span>
              <select
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="bg-slate-800 text-white text-xs font-bold rounded px-1.5 py-0.5 outline-none border border-slate-600"
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
              className="px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 text-white font-mono font-bold"
            />

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs shadow"
            >
              <Printer className="h-4 w-4" /> 인쇄 실행
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 🖨️ 실제 인쇄되는 A4 표준 제조설비 점검표 서식 */}
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
            {/* 서식 헤더 & 3단 결재란 */}
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-slate-800">EZC M-101-6</span>
                  <span className="text-[10px] text-slate-500 font-mono">A4 (210×297)㎜</span>
                </div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 mt-0.5 underline decoration-2 underline-offset-4">
                  제 조 설 비 점 검 체 크 시 트
                </h1>
                <p className="text-[11px] font-bold text-slate-600 mt-0.5">
                  (주)이지원 제조설비 관리대장 및 점검표
                </p>
              </div>

              {/* 3단 결재란 (작성자: 선택한 성명, 검토/승인: 수동 직인용 완벽 빈칸) */}
              <table className="border-collapse border-2 border-slate-900 text-center text-[10px]">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="bg-slate-100 font-bold border border-slate-900 px-1.5 py-1 w-6 text-center">결<br/>재</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">작 성</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">검 토</td>
                    <td className="w-16 border border-slate-900 bg-slate-100 font-bold py-0.5">승 인</td>
                  </tr>
                  <tr className="h-10">
                    <td className="border border-slate-900 font-extrabold align-middle text-slate-900 px-1">{inspector}</td>
                    <td className="border border-slate-900 w-16 bg-white"></td>
                    <td className="border border-slate-900 w-16 bg-white"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 설비 및 점검 기본정보 표 (A4 한 면 피팅) */}
            <table className="w-full text-[11px] border-collapse border-2 border-slate-900">
              <tbody>
                <tr>
                  <td className="bg-slate-100 font-bold p-1.5 w-24 border border-slate-900">설비 관리번호</td>
                  <td className="p-1.5 border border-slate-900 font-mono font-extrabold text-blue-900">{equipment.manage_no}</td>
                  <td className="bg-slate-100 font-bold p-1.5 w-24 border border-slate-900">설 비 명</td>
                  <td className="p-1.5 border border-slate-900 font-extrabold text-slate-900">{equipment.equipment_name}</td>
                </tr>
                <tr>
                  <td className="bg-slate-100 font-bold p-1.5 border border-slate-900">설치 장소</td>
                  <td className="p-1.5 border border-slate-900 font-medium">{equipment.install_location}</td>
                  <td className="bg-slate-100 font-bold p-1.5 border border-slate-900">점검 년월</td>
                  <td className="p-1.5 border border-slate-900 font-mono font-bold text-slate-900">{checkMonth}</td>
                </tr>
                <tr>
                  <td className="bg-slate-100 font-bold p-1.5 border border-slate-900">규격 / 동력</td>
                  <td className="p-1.5 border border-slate-900 font-semibold">{equipment.capacity_spec || '-'}</td>
                  <td className="bg-slate-100 font-bold p-1.5 border border-slate-900">시리얼 번호</td>
                  <td className="p-1.5 border border-slate-900 font-mono">{equipment.serial_no || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 점검 항목 테이블 (A4 1페이지 컴팩트 맞춤) */}
            <div>
              <h4 className="font-bold text-[11px] mb-1 flex items-center justify-between">
                <span>■ 일일 / 주간 정기 점검 항목 (범례: O-양호, X-불량/조치, N/A-해당없음)</span>
                <span className="text-[10px] text-slate-600 font-bold">점검 담당자: {inspector}</span>
              </h4>

              <table className="w-full text-[10px] border-collapse border-2 border-slate-900 text-left">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-900 text-center font-bold">
                    <th className="p-1 border border-slate-900 w-7">No</th>
                    <th className="p-1 border border-slate-900 w-40">점검 항목</th>
                    <th className="p-1 border border-slate-900">점검 기준 및 방법</th>
                    <th className="p-1 border border-slate-900 w-10">주기</th>
                    <th className="p-1 border border-slate-900 w-20">점검 결과</th>
                    <th className="p-1 border border-slate-900 w-28">조치 및 특기사항</th>
                  </tr>
                </thead>
                <tbody>
                  {CHECK_ITEMS.map((item) => (
                    <tr key={item.no} className="h-6">
                      <td className="p-1 border border-slate-900 text-center font-mono font-bold">{item.no}</td>
                      <td className="p-1 border border-slate-900 font-bold text-slate-900">{item.item}</td>
                      <td className="p-1 border border-slate-900 text-slate-800">{item.standard}</td>
                      <td className="p-1 border border-slate-900 text-center font-semibold">{item.cycle}</td>
                      <td className="p-1 border border-slate-900 text-center font-bold text-slate-700">
                        [ O / X ]
                      </td>
                      <td className="p-1 border border-slate-900"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 종합의견 및 직인 도장 하단 배치 (1Page 완료) */}
            <div className="grid grid-cols-12 gap-2 border-2 border-slate-900 p-2 text-xs">
              <div className="col-span-8 flex flex-col justify-between">
                <p className="font-bold text-slate-900 text-[11px]">■ 종합 의견 및 특이사항 조치 내역 (점검 상태 100% 양호)</p>
                <div className="h-10 border border-dashed border-slate-400 rounded p-1 text-[10px] text-slate-500 font-mono">
                  ※ 무결점 설비 점검 완료 (이상 발생 시 CAR 부적합 조치 연계 기록)
                </div>
              </div>
              <div className="col-span-4 flex flex-col items-center justify-center border-l-2 border-slate-400 pl-2">
                <span className="font-extrabold text-[11px] text-slate-900 mb-0.5">(주) 이 지 원 제조관리</span>
                <img src="/이지원도장.png" alt="이지원 도장" className="h-10 w-10 object-contain" />
              </div>
            </div>

            <div className="text-[9px] text-slate-500 text-right font-mono">
              (주)이지원 MES 제조설비 관리 규정 C401 (A4 1 Page 표준서식)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

