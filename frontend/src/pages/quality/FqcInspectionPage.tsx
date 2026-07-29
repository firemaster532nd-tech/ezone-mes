import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, FileText, Printer, Trash2, Calendar, User, ClipboardCheck } from 'lucide-react';

interface Inspection {
  insp_id: number;
  insp_type: string;
  form_code: string;
  wo_id: number;
  wo_number: string;
  lot_id: number | null;
  lot_number: string | null;
  cert_id: number | null;
  result: string;
  inspector: string | null;
  inspected_at: string;
  remarks: string | null; // stores component lots as JSON
  item_name: string | null;
  item_code: string | null;
  cert_number: string | null;
}

interface PendingWo {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  planned_qty: number;
  actual_qty: number;
  lot_number: string | null;
  cert_name: string | null;
  structure_code: string | null;
  item_id: number;
  item_name: string | null;
  item_code: string | null;
  lot_id: number | null;
}

interface TemplateItem {
  item_no: number;
  quality_item: string;
  check_item: string;
  check_method: string;
  standard_desc: string;
}

interface FqcTemplate {
  form_code: string;
  form_name: string;
  items: TemplateItem[];
}

export function FqcInspectionPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [printTarget, setPrintTarget] = useState<Inspection | null>(null);

  const fetchInspections = async () => {
    try {
      const res = await api.get<{ data: Inspection[] }>('/inspections?insp_type=FINAL');
      setInspections(res.data);
    } catch {
      alert('완제품검사 목록 로드 실패');
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleDelete = async (insp: Inspection) => {
    if (!confirm('완제품검사 기록을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/inspections/${insp.insp_id}`);
      fetchInspections();
    } catch {
      alert('삭제 실패');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="완제품검사 (C-901)"
        count={inspections.length}
        description="출하 전 완제품 내화채움구조 최종 제품검사 및 성적서 발행"
      >
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> 신규 완제품검사 등록
        </button>
      </PageHeader>

      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-500 font-medium">
              <th className="px-4 py-3 text-left">양식 코드</th>
              <th className="px-4 py-3 text-left">작업지시번호</th>
              <th className="px-4 py-3 text-left">완제품 품목</th>
              <th className="px-4 py-3 text-left">완제품 LOT</th>
              <th className="px-4 py-3 text-center">최종판정</th>
              <th className="px-4 py-3 text-left">검사자</th>
              <th className="px-4 py-3 text-left">검사일시</th>
              <th className="px-4 py-3 text-center">작업</th>
            </tr>
          </thead>
          <tbody>
            {inspections.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  등록된 완제품검사 기록이 없습니다.
                </td>
              </tr>
            ) : (
              inspections.map((insp) => (
                <tr key={insp.insp_id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                      {insp.form_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{insp.wo_number}</td>
                  <td className="px-4 py-3">{insp.item_name || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-semibold">
                    {insp.lot_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge
                      status={insp.result === 'PASS' ? 'PASS' : 'FAIL'}
                      label={insp.result === 'PASS' ? '합격' : '불합격'}
                    />
                  </td>
                  <td className="px-4 py-3">{insp.inspector || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(insp.inspected_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setPrintTarget(insp)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="성적서 인쇄"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(insp)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateFqcModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            fetchInspections();
          }}
        />
      )}

      {printTarget && (
        <FqcPrintModal
          inspection={printTarget}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  );
}

/* ========== FQC 등록 모달 ========== */
function CreateFqcModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [pendingWos, setPendingWos] = useState<PendingWo[]>([]);
  const [templates, setTemplates] = useState<FqcTemplate[]>([]);
  const [selectedWoId, setSelectedWoId] = useState<number | ''>('');
  const [selectedFormCode, setSelectedFormCode] = useState<string>('');
  const [inspector, setInspector] = useState('');
  const [inspectionEquipments, setInspectionEquipments] = useState<any[]>([]);
  const [selectedEquipmentNo, setSelectedEquipmentNo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // 부속 자재 LOT 매핑 데이터
  const [socketLot, setSocketLot] = useState('');
  const [glasswoolLot, setGlasswoolLot] = useState('');
  const [ceramicwoolLot, setCeramicwoolLot] = useState('');
  const [ceramicwoolShieldLot, setCeramicwoolShieldLot] = useState('');
  const [flashingLot, setFlashingLot] = useState('');
  const [remarks, setRemarks] = useState('');

  // 측정 상세값 저장
  const [measuredValues, setMeasuredValues] = useState<
    Record<number, { n1: string; n2: string; n3: string }>
  >({});

  const selectedWo = pendingWos.find((w) => w.wo_id === Number(selectedWoId));
  const activeTemplate = templates.find((t) => t.form_code === selectedFormCode);

  useEffect(() => {
    // 1. 완제품 대기 작업지시 패치
    api.get<{ data: PendingWo[] }>('/inspections/final-pending').then((res) => {
      setPendingWos(res.data);
    });
    // 2. C-901 템플릿 패치
    api.get<{ data: FqcTemplate[] }>('/inspections/final-templates').then((res) => {
      setTemplates(res.data);
    });
    // 3. 검사설비 목록 패치
    api.get<{ data: any[] }>('/equipment/inspection').then((res) => {
      setInspectionEquipments(res.data || []);
    });
  }, []);

  // 작업지시 선택 시 양식 코드 자동 선정 및 기본 LOT 매핑 세팅
  useEffect(() => {
    if (selectedWo) {
      setSocketLot(selectedWo.lot_number || '');

      // 최신 반제품 J-LOT 및 단열재 LOT 자동 패치
      api.get('/material-lots').then((res: any) => {
        const lotList = res.data || res || [];
        const jSockets = lotList.filter((l: any) => l.lot_number?.includes('D') && l.category === '반제품');
        const jFlashings = lotList.filter((l: any) => l.lot_number?.includes('F') && l.category === '반제품');
        const ceramicWools = lotList.filter((l: any) => l.category === '세라믹울' || l.item_name?.includes('세라믹'));
        const glassWools = lotList.filter((l: any) => l.category === '그라스울' || l.item_name?.includes('그라스'));

        if (jSockets.length > 0) setSocketLot(jSockets[0].lot_number);
        if (jFlashings.length > 0) setFlashingLot(jFlashings[0].lot_number);
        if (ceramicWools.length > 0) setCeramicwoolLot(ceramicWools[0].lot_number);
        if (ceramicWools.length > 1) setCeramicwoolShieldLot(ceramicWools[1].lot_number);
        if (glassWools.length > 0) setGlasswoolLot(glassWools[0].lot_number);
      }).catch(() => {});

      const struct = selectedWo.structure_code || '';
      if (struct.includes('BD')) {
        setSelectedFormCode('901-3');
      } else if (struct.includes('NP')) {
        setSelectedFormCode('901-4');
      } else if (struct.includes('VT')) {
        setSelectedFormCode('901-2');
      } else {
        setSelectedFormCode('901-1');
      }
    } else {
      setSelectedFormCode('');
      setSocketLot('');
      setFlashingLot('');
      setGlasswoolLot('');
      setCeramicwoolLot('');
      setCeramicwoolShieldLot('');
    }
  }, [selectedWoId]);

  // 템플릿 변경 시 측정값 리셋
  useEffect(() => {
    if (activeTemplate) {
      const initVals: Record<number, { n1: string; n2: string; n3: string }> = {};
      activeTemplate.items.forEach((item) => {
        initVals[item.item_no] = { n1: '', n2: '', n3: '' };
      });
      setMeasuredValues(initVals);
    }
  }, [selectedFormCode]);

  const handleValueChange = (itemNo: number, field: 'n1' | 'n2' | 'n3', val: string) => {
    setMeasuredValues((prev) => ({
      ...prev,
      [itemNo]: {
        ...prev[itemNo],
        [field]: val,
      },
    }));
  };

  const handleAutoFillPass = () => {
    if (!activeTemplate) return;
    const filled: Record<number, { n1: string; n2: string; n3: string }> = {};
    activeTemplate.items.forEach((item) => {
      if (item.check_method === '육안') {
        filled[item.item_no] = { n1: '1', n2: '1', n3: '1' };
      } else {
        // 치수의 경우 기준값 자동 입력
        if (item.check_item.includes('높이')) {
          filled[item.item_no] = { n1: '200', n2: '200', n3: '200' };
        } else {
          filled[item.item_no] = { n1: '100', n2: '100', n3: '100' };
        }
      }
    });
    setMeasuredValues(filled);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWoId || !selectedFormCode || !inspector) {
      return alert('필수 항목을 모두 채워주세요.');
    }
    if (!socketLot) {
      return alert('방화소켓 조립품 LOT는 필수 매핑 항목입니다.');
    }

    setSaving(true);
    try {
      const details = activeTemplate?.items.map((item) => {
        const val = measuredValues[item.item_no] || { n1: '', n2: '', n3: '' };
        const isVisual = item.check_method === '육안';
        return {
          item_no: item.item_no,
          quality_item: item.quality_item,
          check_item: item.check_item,
          check_method: item.check_method,
          cert_standard: isVisual ? 1 : item.check_item.includes('높이') ? 200 : 0, // 기본 standard 매핑
          measured_n1: val.n1 !== '' ? parseFloat(val.n1) : undefined,
          measured_n2: val.n2 !== '' ? parseFloat(val.n2) : undefined,
          measured_n3: val.n3 !== '' ? parseFloat(val.n3) : undefined,
          is_applicable: true,
          direction: isVisual ? 'MIN' : 'MIN',
        };
      }) || [];

      const componentLots = {
        socket_assembly_lot: socketLot,
        glasswool_lot: glasswoolLot,
        ceramicwool_insulation_lot: ceramicwoolLot,
        ceramicwool_shield_lot: ceramicwoolShieldLot,
        flashing_lot: flashingLot,
        user_remarks: remarks,
      };

      await api.post('/inspections/final', {
        wo_id: Number(selectedWoId),
        form_code: selectedFormCode,
        inspector,
        component_lots: componentLots,
        details,
      });

      onSaved();
    } catch {
      alert('완제품검사 저장 중 오류가 발생하였습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center rounded-t-card">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="text-process-mix" />
            <h2 className="text-shop-lg font-bold">완제품 제품검사성적서 등록 (C-901)</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-shop-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. 작업지시 선택 */}
            <label className="block">
              <span className="text-gray-700 font-semibold">검사 대상 조립 완료 건 *</span>
              <select
                value={selectedWoId}
                onChange={(e) => setSelectedWoId(Number(e.target.value) || '')}
                className="mt-1 block w-full border rounded px-3 py-2 bg-white"
                required
              >
                <option value="">-- 작업지시 선택 (ASM 완료) --</option>
                {pendingWos.map((w) => (
                  <option key={w.wo_id} value={w.wo_id}>
                    {w.wo_number} - {w.item_name} ({w.actual_qty} EA)
                  </option>
                ))}
              </select>
            </label>

            {/* 2. 성적서 양식 */}
            <label className="block">
              <span className="text-gray-700 font-semibold">제품검사 성적서 양식 *</span>
              <select
                value={selectedFormCode}
                onChange={(e) => setSelectedFormCode(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2 bg-white"
                required
              >
                <option value="">-- 양식 선택 --</option>
                {templates.map((t) => (
                  <option key={t.form_code} value={t.form_code}>
                    {t.form_name}
                  </option>
                ))}
              </select>
            </label>

            {/* 3. 사용 검사장비 (검사설비 마스터 드롭다운) */}
            <label className="block">
              <span className="text-gray-700 font-semibold">사용 검사장비 (검사설비)</span>
              <select
                value={selectedEquipmentNo}
                onChange={(e) => setSelectedEquipmentNo(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2 bg-white text-xs"
              >
                <option value="">-- 검사장비 선택 --</option>
                {inspectionEquipments.map((eq) => (
                  <option key={eq.equipment_id} value={eq.manage_no}>
                    [{eq.manage_no}] {eq.equipment_name} {eq.serial_no ? `(S/N: ${eq.serial_no})` : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* 4. 검사자 */}
            <label className="block">
              <span className="text-gray-700 font-semibold">검사자 이름 *</span>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                placeholder="검사자 실명"
                required
              />
            </label>
          </div>

          {selectedWo && (
            <div className="bg-blue-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-900 border border-blue-200">
              <div>
                <span className="text-blue-500 block">품목명</span>
                <span className="font-semibold">{selectedWo.item_name}</span>
              </div>
              <div>
                <span className="text-blue-500 block">완제품 LOT</span>
                <span className="font-mono font-semibold">{selectedWo.lot_number}</span>
              </div>
              <div>
                <span className="text-blue-500 block">인정구조명</span>
                <span className="font-semibold">{selectedWo.cert_name || '-'}</span>
              </div>
              <div>
                <span className="text-blue-500 block">구조체코드</span>
                <span className="font-mono font-semibold">{selectedWo.structure_code || '-'}</span>
              </div>
            </div>
          )}

          {/* 원자재 LOT 매핑 매트릭스 */}
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <h3 className="font-bold text-gray-800 border-b pb-1.5 flex items-center gap-1.5">
              <ClipboardCheck size={16} className="text-indigo-600" />
              부속 자재 투입 LOT 매핑 정보 (이력 추적 필성 수집)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-gray-700 text-xs font-semibold">방화소켓 조립품 LOT *</span>
                <input
                  type="text"
                  value={socketLot}
                  onChange={(e) => setSocketLot(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs font-mono"
                  placeholder="조립 LOT 승계 번호"
                  required
                />
              </label>
              <label className="block">
                <span className="text-gray-700 text-xs">그라스울 단열재 LOT</span>
                <input
                  type="text"
                  value={glasswoolLot}
                  onChange={(e) => setGlasswoolLot(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs font-mono"
                  placeholder="단열재 LOT 번호"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 text-xs">세라믹울 단열재 LOT</span>
                <input
                  type="text"
                  value={ceramicwoolLot}
                  onChange={(e) => setCeramicwoolLot(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs font-mono"
                  placeholder="단열재 LOT 번호"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 text-xs">세라믹울 차열재 LOT</span>
                <input
                  type="text"
                  value={ceramicwoolShieldLot}
                  onChange={(e) => setCeramicwoolShieldLot(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs font-mono"
                  placeholder="차열재 LOT 번호"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 text-xs">방화플래싱 LOT</span>
                <input
                  type="text"
                  value={flashingLot}
                  onChange={(e) => setFlashingLot(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs font-mono"
                  placeholder="플래싱 LOT 번호"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 text-xs">비고 / 조치사항</span>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-1.5 text-xs"
                  placeholder="기타 참고사항"
                />
              </label>
            </div>
          </div>

          {/* 측정 테이블 */}
          {activeTemplate && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">품질 항목 및 측정값 (n=3) 입력</h3>
                <button
                  type="button"
                  onClick={handleAutoFillPass}
                  className="text-xs px-2.5 py-1 bg-gray-200 hover:bg-gray-300 rounded font-medium transition-colors"
                >
                  임시 합격값 일괄 기입
                </button>
              </div>

              <div className="border rounded-lg overflow-hidden bg-white">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-600 font-medium">
                      <th className="px-3 py-2 text-left w-12">No</th>
                      <th className="px-3 py-2 text-left">검사항목</th>
                      <th className="px-3 py-2 text-left">기준 규격</th>
                      <th className="px-3 py-2 text-left w-24">검사방법</th>
                      <th className="px-3 py-2 text-center w-24">측정 1</th>
                      <th className="px-3 py-2 text-center w-24">측정 2</th>
                      <th className="px-3 py-2 text-center w-24">측정 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTemplate.items.map((item) => {
                      const isVisual = item.check_method === '육안';
                      const val = measuredValues[item.item_no] || { n1: '', n2: '', n3: '' };
                      return (
                        <tr key={item.item_no} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-xs">{item.item_no}</td>
                          <td className="px-3 py-2">
                            <span className="text-gray-400 text-xs block">{item.quality_item}</span>
                            <span className="font-medium text-gray-800">{item.check_item}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px]">
                            {item.standard_desc}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{item.check_method}</td>
                          <td className="px-2 py-1 text-center">
                            {isVisual ? (
                              <select
                                value={val.n1}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n1', e.target.value)
                                }
                                className="w-full border rounded p-1 text-xs"
                              >
                                <option value="">판정</option>
                                <option value="1">OK</option>
                                <option value="0">NG</option>
                              </select>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={val.n1}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n1', e.target.value)
                                }
                                className="w-full border rounded p-1 text-right text-xs"
                                placeholder="치수"
                              />
                            )}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {isVisual ? (
                              <select
                                value={val.n2}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n2', e.target.value)
                                }
                                className="w-full border rounded p-1 text-xs"
                              >
                                <option value="">판정</option>
                                <option value="1">OK</option>
                                <option value="0">NG</option>
                              </select>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={val.n2}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n2', e.target.value)
                                }
                                className="w-full border rounded p-1 text-right text-xs"
                                placeholder="치수"
                              />
                            )}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {isVisual ? (
                              <select
                                value={val.n3}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n3', e.target.value)
                                }
                                className="w-full border rounded p-1 text-xs"
                              >
                                <option value="">판정</option>
                                <option value="1">OK</option>
                                <option value="0">NG</option>
                              </select>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={val.n3}
                                onChange={(e) =>
                                  handleValueChange(item.item_no, 'n3', e.target.value)
                                }
                                className="w-full border rounded p-1 text-right text-xs"
                                placeholder="치수"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving || !selectedWoId || !selectedFormCode}
            className="px-4 py-2 bg-process-mix text-white rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? '저장 중...' : '검사성적서 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== C-901 성적서 출력 팝업 (Print Modal) ========== */
function FqcPrintModal({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Parse mapped lots from remarks JSON
  let compLots: Record<string, string> = {};
  try {
    if (inspection.remarks) {
      compLots = JSON.parse(inspection.remarks);
    }
  } catch {}

  useEffect(() => {
    setLoading(true);
    api.get<{ data: { details: any[] } }>(`/inspections/${inspection.insp_id}`).then((res) => {
      setDetails(res.data.details || []);
      setLoading(false);
    });
  }, [inspection.insp_id]);

  const handlePrint = () => {
    window.print();
  };

  const getFormTitle = (code: string) => {
    if (code === '901-2') return '입상 내화채움구조 제품검사 성적서';
    if (code === '901-3') return '버스덕트 내화채움구조 제품검사 성적서';
    if (code === '901-4') return '비금속배관 내화채움구조 제품검사 성적서';
    return '벽체 내화채움구조 제품검사 성적서';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col print:shadow-none print:w-auto print:max-h-none print:rounded-none">
        {/* Actions header (hidden on print) */}
        <div className="px-6 py-3 border-b bg-gray-100 flex justify-between items-center rounded-t-card print:hidden">
          <span className="font-bold text-gray-800">제품검사성적서(C-901) 출력 미리보기</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Printer size={14} /> 인쇄하기 (A4)
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 border bg-white rounded text-xs hover:bg-gray-100 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="p-8 overflow-y-auto flex-1 bg-gray-50 print:bg-white print:p-0">
          <div className="bg-white border p-8 w-[210mm] min-h-[297mm] mx-auto shadow-sm text-black print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0 relative">
            
            {/* Header Stamp */}
            <div className="absolute top-8 right-8 border border-red-500 text-red-500 rounded p-1 text-center w-20 text-[10px] font-bold border-double border-4 rotate-12 print:top-0 print:right-0">
              (주) 이지원
              <div className="border-t border-red-500 mt-0.5 text-xs">품질합격</div>
            </div>

            {/* Document Header Section */}
            <div className="flex justify-between items-start mb-6">
              <div className="text-[10px] font-mono text-gray-500">
                문서번호: EZC-C-901-{inspection.form_code} (Rev.0)
              </div>
              <div className="flex border border-black text-center text-xs">
                <div className="bg-gray-100 border-r border-black p-2 font-bold w-12 flex items-center justify-center">결<br/>재</div>
                <div>
                  <div className="border-b border-black px-4 py-1">작 성</div>
                  <div className="h-10 px-4 flex items-center justify-center font-semibold text-gray-700">
                    {inspection.inspector || '검사원'}
                  </div>
                </div>
                <div className="border-l border-black">
                  <div className="border-b border-black px-4 py-1">검 토</div>
                  <div className="h-10 px-4"></div>
                </div>
                <div className="border-l border-black">
                  <div className="border-b border-black px-4 py-1">승 인</div>
                  <div className="h-10 px-4"></div>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-center underline mb-8">
              {getFormTitle(inspection.form_code)}
            </h1>

            {/* Metadata Info Table */}
            <table className="w-full border border-black text-xs mb-6">
              <tbody>
                <tr className="border-b border-black">
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">상 품 명</td>
                  <td className="p-2 border-r border-black">EZ-덕트내화채움구조</td>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">검사일자</td>
                  <td className="p-2">{new Date(inspection.inspected_at).toLocaleDateString('ko-KR')}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">규 격</td>
                  <td className="p-2 border-r border-black">{inspection.item_name || '도면 표준 규격'}</td>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">검 사 자</td>
                  <td className="p-2 font-semibold">{inspection.inspector}</td>
                </tr>
                <tr>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">로트번호</td>
                  <td className="p-2 border-r border-black font-mono font-bold text-blue-700">
                    {inspection.lot_number}
                  </td>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">검사주기</td>
                  <td className="p-2">매 로트 (n=3)</td>
                </tr>
              </tbody>
            </table>

            {/* Details Table */}
            <table className="w-full border border-black text-[11px] mb-6 text-center">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-bold">
                  <th className="p-2 border-r border-black w-24">품질항목</th>
                  <th className="p-2 border-r border-black">검사항목</th>
                  <th className="p-2 border-r border-black w-44">기준 및 허용차</th>
                  <th className="p-2 border-r border-black w-14">방법</th>
                  <th className="p-1 border-r border-black w-8">n1</th>
                  <th className="p-1 border-r border-black w-8">n2</th>
                  <th className="p-1 border-r border-black w-8">n3</th>
                  <th className="p-2 w-14">판정</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-400 text-center">
                      로딩 중...
                    </td>
                  </tr>
                ) : (
                  details.map((d) => {
                    const isVisual = d.check_method === '육안';
                    const showN = (v: number | null | undefined) => {
                      if (v == null) return '-';
                      if (isVisual) return v >= 1 ? 'OK' : 'NG';
                      return v;
                    };
                    return (
                      <tr key={d.item_no} className="border-b border-black">
                        <td className="p-2 border-r border-black font-medium">{d.quality_item}</td>
                        <td className="p-2 border-r border-black text-left">{d.check_item}</td>
                        <td className="p-2 border-r border-black text-left text-[10px] text-gray-600">
                          {d.cert_standard != null
                            ? d.check_method === '육안'
                              ? '해로운 결함이 없을 것 (OK)'
                              : `${d.cert_standard} mm 이상`
                            : '-'}
                        </td>
                        <td className="p-2 border-r border-black">{d.check_method}</td>
                        <td className="p-1 border-r border-black font-mono">{showN(d.measured_n1)}</td>
                        <td className="p-1 border-r border-black font-mono">{showN(d.measured_n2)}</td>
                        <td className="p-1 border-r border-black font-mono">{showN(d.measured_n3)}</td>
                        <td className="p-2 font-bold text-center">
                          <span
                            className={d.item_result === 'PASS' ? 'text-green-600' : 'text-red-600'}
                          >
                            {d.item_result === 'PASS' ? '합격' : d.item_result === 'FAIL' ? '불합격' : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Traceability Table */}
            <h3 className="font-bold text-xs mb-2 text-gray-800">■ 투입 자재 로트추적 (Lot Traceability)</h3>
            <table className="w-full border border-black text-center text-xs mb-8">
              <thead>
                <tr className="bg-gray-50 border-b border-black font-bold">
                  <th className="p-2 border-r border-black">방화소켓 조립품 LOT</th>
                  <th className="p-2 border-r border-black">그라스울 단열재 LOT</th>
                  <th className="p-2 border-r border-black">세라믹울 단열재 LOT</th>
                  <th className="p-2 border-r border-black">세라믹울 차열재 LOT</th>
                  <th className="p-2">방화플래싱 LOT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2.5 border-r border-black font-mono">{compLots.socket_assembly_lot || '-'}</td>
                  <td className="p-2.5 border-r border-black font-mono">{compLots.glasswool_lot || '-'}</td>
                  <td className="p-2.5 border-r border-black font-mono">{compLots.ceramicwool_insulation_lot || '-'}</td>
                  <td className="p-2.5 border-r border-black font-mono">{compLots.ceramicwool_shield_lot || '-'}</td>
                  <td className="p-2.5 font-mono">{compLots.flashing_lot || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* Final Judgement Block */}
            <div className="border border-black p-4 flex justify-between items-center bg-gray-50">
              <div className="space-y-1">
                <div className="text-xs font-bold">종합 판정:</div>
                <div className="text-[11px] text-gray-500">
                  위 제품은 설계 및 품질인정 규정에 따라 엄격히 검사하였으며 최종 합격품임을 증명함.
                </div>
              </div>
              <div className="text-lg font-bold border-2 border-blue-600 text-blue-600 rounded px-4 py-1">
                {inspection.result === 'PASS' ? '합 격 (PASS)' : '불 합 격 (FAIL)'}
              </div>
            </div>

            {/* Footer company logo */}
            <div className="text-center font-bold text-sm tracking-widest mt-12 text-gray-900">
              주 식 회 사  이  지  원
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
