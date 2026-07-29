import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Plus, Search,
  Edit2, Trash2, Calendar, ShieldCheck, X, RefreshCw
} from 'lucide-react';

interface InspectionEquipment {
  equipment_id: number;
  manage_no: string;
  equipment_name: string;
  serial_no: string | null;
  capacity_spec: string | null;
  manufacturer: string | null;
  install_location: string | null;
  calibration_no: string | null;
  calibration_cycle_months: number;
  last_calibration_date: string | null;
  next_calibration_date: string | null;
  calibration_status: 'NORMAL' | 'EXPIRING' | 'EXPIRED';
  days_left: number | null;
  memo: string | null;
  is_active: boolean;
}

export function InspectionEquipmentPage() {
  const [equipments, setEquipments] = useState<InspectionEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'EXPIRING' | 'NORMAL'>('ALL');
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InspectionEquipment | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formManageNo, setFormManageNo] = useState('');
  const [formEquipmentName, setFormEquipmentName] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [formCapacitySpec, setFormCapacitySpec] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formInstallLocation, setFormInstallLocation] = useState('');
  const [formCalibrationNo, setFormCalibrationNo] = useState('');
  const [formCycleMonths, setFormCycleMonths] = useState(12);
  const [formLastCalDate, setFormLastCalDate] = useState('');
  const [formNextCalDate, setFormNextCalDate] = useState('');
  const [formMemo, setFormMemo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: InspectionEquipment[] }>('/equipment/inspection');
      setEquipments(res.data || []);
    } catch {
      alert('검사설비 목록을 불러오는데 실패하였습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormManageNo(`EZC-T-${String(equipments.length + 1).padStart(2, '0')}-1`);
    setFormEquipmentName('');
    setFormSerialNo('');
    setFormCapacitySpec('');
    setFormManufacturer('');
    setFormInstallLocation('본사 사무실/품질검사대');
    setFormCalibrationNo('');
    setFormCycleMonths(12);
    setFormLastCalDate('');
    setFormNextCalDate('');
    setFormMemo('');
    setShowModal(true);
  };

  const openEditModal = (item: InspectionEquipment) => {
    setEditingItem(item);
    setFormManageNo(item.manage_no);
    setFormEquipmentName(item.equipment_name);
    setFormSerialNo(item.serial_no || '');
    setFormCapacitySpec(item.capacity_spec || '');
    setFormManufacturer(item.manufacturer || '');
    setFormInstallLocation(item.install_location || '');
    setFormCalibrationNo(item.calibration_no || '');
    setFormCycleMonths(item.calibration_cycle_months || 12);
    setFormLastCalDate(item.last_calibration_date || '');
    setFormNextCalDate(item.next_calibration_date || '');
    setFormMemo(item.memo || '');
    setShowModal(true);
  };

  const handleDelete = async (item: InspectionEquipment) => {
    if (!confirm(`[${item.manage_no}] ${item.equipment_name} 설비를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/equipment/inspection/${item.equipment_id}`);
      loadData();
    } catch {
      alert('삭제 중 오류가 발생하였습니다.');
    }
  };

  // 최근 교정일 변경 시 차기 교정일 자동 계산
  const handleLastCalDateChange = (val: string) => {
    setFormLastCalDate(val);
    if (val) {
      const d = new Date(val);
      d.setMonth(d.getMonth() + formCycleMonths);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setFormNextCalDate(`${yyyy}-${mm}-${dd}`);
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
        install_location: formInstallLocation,
        calibration_no: formCalibrationNo,
        calibration_cycle_months: Number(formCycleMonths),
        last_calibration_date: formLastCalDate || null,
        next_calibration_date: formNextCalDate || null,
        memo: formMemo,
      };

      if (editingItem) {
        await api.put(`/equipment/inspection/${editingItem.equipment_id}`, payload);
      } else {
        await api.post('/equipment/inspection', payload);
      }

      setShowModal(false);
      loadData();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 필터링
  const filteredEquipments = equipments.filter((eq) => {
    const matchesSearch =
      eq.manage_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.equipment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eq.serial_no && eq.serial_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (eq.calibration_no && eq.calibration_no.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterTab === 'EXPIRING') return eq.calibration_status === 'EXPIRING' || eq.calibration_status === 'EXPIRED';
    if (filterTab === 'NORMAL') return eq.calibration_status === 'NORMAL';
    return true;
  });

  const expiringList = equipments.filter((eq) => eq.calibration_status === 'EXPIRING' || eq.calibration_status === 'EXPIRED');

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <PageHeader
        title="🔬 검사설비 관리 (EZC T-101)"
        description="인수/완제품검사 사용 계측장비 32종 및 차기 교정일자(D-30 1달전) 자동 알림 체계"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> 검사설비 등록
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold shadow-sm"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 새로고침
          </button>
        </div>
      </PageHeader>

      {/* ⚠️ 교정 1달 전 알림 경고 패널 (D-30 경고) */}
      {expiringList.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500 text-white rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">
                ⚠️ 교정 만료 임박 / 만료 검사설비 경고 ({expiringList.length}건)
              </h3>
              <p className="text-xs text-amber-700">
                1달 이내(30일) 교정 기한이 다가오는 검사장비입니다. 품질보증을 위해 신속히 교정 검사를 진행하세요.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {expiringList.map((eq) => (
              <span
                key={eq.equipment_id}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs',
                  eq.calibration_status === 'EXPIRED'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>[{eq.manage_no}] {eq.equipment_name}</span>
                <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                  {eq.days_left !== null && eq.days_left < 0 ? `${Math.abs(eq.days_left)}일 지남` : `D-${eq.days_left}`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 요약 카운터 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl"><Wrench className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">전체 검사설비</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{equipments.length}대</p>
            <p className="text-[10px] text-slate-400">사규 마스터 등록건</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-xl"><CheckCircle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">교정 정상 가동</p>
            <p className="text-lg font-black text-emerald-800 mt-0.5">
              {equipments.filter((e) => e.calibration_status === 'NORMAL').length}대
            </p>
            <p className="text-[10px] text-slate-400">유효한 교정필증 보유</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-xl"><Clock className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">교정 임박 (D-30)</p>
            <p className="text-lg font-black text-amber-800 mt-0.5">
              {equipments.filter((e) => e.calibration_status === 'EXPIRING').length}대
            </p>
            <p className="text-[10px] text-slate-400">30일 이내 재교정 필요</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-600 text-white rounded-xl"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-slate-500">교정 기한 만료</p>
            <p className="text-lg font-black text-rose-800 mt-0.5">
              {equipments.filter((e) => e.calibration_status === 'EXPIRED').length}대
            </p>
            <p className="text-[10px] text-slate-400">사용 중지 권고</p>
          </div>
        </div>
      </div>

      {/* 검색 및 탭 필터 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterTab('ALL')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
              filterTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            전체 ({equipments.length})
          </button>
          <button
            onClick={() => setFilterTab('EXPIRING')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
              filterTab === 'EXPIRING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            )}
          >
            ⚠️ 교정 임박/만료 ({expiringList.length})
          </button>
          <button
            onClick={() => setFilterTab('NORMAL')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
              filterTab === 'NORMAL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            )}
          >
            🟢 교정 정상 ({equipments.filter((e) => e.calibration_status === 'NORMAL').length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="관리번호, 설비명, 시리얼, 교정번호 검색"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 설비 데이터 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                <th className="p-3 w-28 text-center">관리번호</th>
                <th className="p-3">설비명 / 기기번호</th>
                <th className="p-3">공칭능력 (측정범위)</th>
                <th className="p-3">제조사 / 설치장소</th>
                <th className="p-3">교정증명서 번호</th>
                <th className="p-3 text-center">최근 교정일</th>
                <th className="p-3 text-center">차기 교정일</th>
                <th className="p-3 text-center">교정 상태</th>
                <th className="p-3 text-center w-20">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    등록된 검사설비가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((eq) => (
                  <tr
                    key={eq.equipment_id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      eq.calibration_status === 'EXPIRED' && 'bg-rose-50/60',
                      eq.calibration_status === 'EXPIRING' && 'bg-amber-50/60'
                    )}
                  >
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
                    <td className="p-3">
                      <p className="text-slate-800 font-medium">{eq.manufacturer || '-'}</p>
                      <p className="text-[10px] text-slate-400">{eq.install_location}</p>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {eq.calibration_no || '-'}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">
                      {eq.last_calibration_date || '-'}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {eq.next_calibration_date || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {eq.calibration_status === 'EXPIRED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-xs">
                          🔴 만료 ({eq.days_left !== null ? `${Math.abs(eq.days_left)}일 지남` : ''})
                        </span>
                      )}
                      {eq.calibration_status === 'EXPIRING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs">
                          🟡 D-{eq.days_left} (임박)
                        </span>
                      )}
                      {eq.calibration_status === 'NORMAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🟢 정상 {eq.days_left !== null && `(D-${eq.days_left})`}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(eq)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded"
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
                <Wrench className="h-5 w-5 text-indigo-600" />
                {editingItem ? `[${editingItem.manage_no}] 검사설비 수정` : '신규 검사설비 등록'}
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
                    placeholder="예: EZC-T-01-1"
                    className="w-full border rounded-lg px-3 py-2 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">설비명 (기기명) *</label>
                  <input
                    type="text"
                    value={formEquipmentName}
                    onChange={(e) => setFormEquipmentName(e.target.value)}
                    placeholder="예: 버니어캘리퍼스 (디지털)"
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
                    placeholder="예: B19268952"
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">공칭능력 / 측정범위</label>
                  <input
                    type="text"
                    value={formCapacitySpec}
                    onChange={(e) => setFormCapacitySpec(e.target.value)}
                    placeholder="예: 10~150mm / 0.01mm"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">제조사</label>
                  <input
                    type="text"
                    value={formManufacturer}
                    onChange={(e) => setFormManufacturer(e.target.value)}
                    placeholder="예: Mitutoyo, CAS, Tajima"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">설치 / 사용장소</label>
                  <input
                    type="text"
                    value={formInstallLocation}
                    onChange={(e) => setFormInstallLocation(e.target.value)}
                    placeholder="예: 본사 사무실/품질검사대"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">교정증명서 번호</label>
                  <input
                    type="text"
                    value={formCalibrationNo}
                    onChange={(e) => setFormCalibrationNo(e.target.value)}
                    placeholder="예: 25-1438-001"
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">교정주기 (개월)</label>
                  <select
                    value={formCycleMonths}
                    onChange={(e) => setFormCycleMonths(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={12}>12개월 (1년)</option>
                    <option value={24}>24개월 (2년)</option>
                    <option value={36}>36개월 (3년)</option>
                    <option value={6}>6개월</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">최근 교정일자</label>
                  <input
                    type="date"
                    value={formLastCalDate}
                    onChange={(e) => handleLastCalDateChange(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-indigo-700">차기 교정일자 (D-30 알림기준)</label>
                  <input
                    type="date"
                    value={formNextCalDate}
                    onChange={(e) => setFormNextCalDate(e.target.value)}
                    className="w-full border border-indigo-300 bg-indigo-50/50 rounded-lg px-3 py-2 font-mono font-bold text-indigo-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">비고</label>
                <textarea
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  placeholder="참고사항 기재"
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '저장 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
