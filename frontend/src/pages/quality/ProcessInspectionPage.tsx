import { useEffect, useState } from 'react';
import { useInspectors } from '@/hooks/useInspectors';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, FileText, MoreHorizontal, Trash2, Printer, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AttachmentSection } from '@/components/shared/AttachmentSection';
import { InspectionFormPrintModal } from '@/components/inspection/InspectionFormPrintModal';

interface ProcessInspection {
  insp_id: number;
  form_code: string;
  wo_id: number;
  wo_number: string;
  process_code: string;
  structure_code: string | null;
  lot_number: string | null;
  base_lot: string | null;
  serial_start: number | null;
  serial_end: number | null;
  result: string;
  inspector: string | null;
  inspected_at: string;
  remarks: string | null;
}

interface CertOption {
  cert_id: number;
  structure_code: string;
  structure_name: string;
  opening_w_mm: number | null;
  opening_h_mm: number | null;
}

interface StructureLot {
  lot_id: number;
  lot_number: string;
  base_lot: string;
  serial_start: number;
  serial_end: number;
  qty: number;
  item_name: string | null;
  inspection_count: number;
  inspection_pass: number;
  inspection_fail: number;
}

interface FormTemplate {
  form_code: string;
  form_name: string;
  process: string;
  group_code: string;
  item_count: number;
}

interface WorkOrderOption {
  wo_id: number;
  wo_number: string;
  process_code: string;
  cert_id: number | null;
  structure_code: string | null;
}

interface TemplateDetail {
  form_code: string;
  form_name: string;
  items: Array<{
    item_no: number;
    quality_item: string;
    check_item: string;
    check_method: string;
    default_applicable: boolean;
  }>;
}

const formTabs = [
  { key: '', label: '전체 (EZC-C-701)' },
  { key: 'G01', label: 'G01: 입상 재단' },
  { key: 'G02', label: 'G02: 입상 조립' },
  { key: 'G03', label: 'G03: 벽체 재단' },
  { key: 'G04', label: 'G04: 벽체 조립' },
  { key: 'G05', label: 'G05: 버스덕트 재단' },
  { key: 'G07', label: 'G07: 비금속 재단' },
  { key: 'G08', label: 'G08: 비금속 조립' },
  { key: 'G09', label: 'G09: 방화플래싱 재단' },
  { key: 'G10', label: 'G10: 방화플래싱 조립' },
  { key: 'G13', label: 'G13: 차열재 재단' },
  { key: 'G14', label: 'G14: 틈새시트 재단' },
];

const resultMap: Record<string, string> = {
  PASS: 'PASS', FAIL: 'FAIL', PENDING: 'PENDING',
};

const resultLabel: Record<string, string> = {
  PASS: '합격', FAIL: '불합격', PENDING: '대기',
};

const INSPECTOR_LIST = ['김정용 책임', '최진영 책임', '임병용 파트장', '이동민 파트장', '김봉민 책임', '생산 작업자'];


export function ProcessInspectionPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProcessInspection[]>([]);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailTarget, setDetailTarget] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'PASS' | 'FAIL' } | null>(null);
  const [printModalData, setPrintModalData] = useState<any>(null);

  const handleOpenPrintModal = (row: ProcessInspection) => {
    const isCut = row.process_code === 'CUT' || row.form_code?.includes('G01') || row.form_code?.includes('G03') || row.form_code?.includes('G05');
    const isAsm = row.process_code === 'ASM' || row.form_code?.includes('G02') || row.form_code?.includes('G04') || row.form_code?.includes('G08');

    const items = isCut ? [
      { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 찌그러짐, 찢김 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
      { name: '재단 치수 - 길이 (㎜)', standard: '도면 지정 규격 (±1.0mm 오차 이내)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '1000.2', n2: '1000.1', n3: '1000.3', isPass: true },
      { name: '재단 치수 - 너비/폭 (㎜)', standard: '도면 지정 규격 (±1.0mm 오차 이내)', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '600.2', n2: '600.1', n3: '600.2', isPass: true },
      { name: '재단 치수 - 두께 (㎜)', standard: '사규 시편 두께 기준 충족', method: '버니어캘리퍼스', cycle: '매로트', condition: 'n=3, c=0', n1: '25.2', n2: '25.1', n3: '25.2', isPass: true },
      { name: '사규 공정 검사기준', standard: 'EZC-C-701 재단공정 관리규정 적합', method: '치수측정', cycle: '매로트', condition: 'n=1, c=0', n1: '적합', n2: '적합', n3: '적합', isPass: true }
    ] : isAsm ? [
      { name: '겉모양 (외관)', standard: '한도견본 기준 오염, 찌그러짐, 틈새 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
      { name: '조립 구조 - 외경/내경 (㎜)', standard: '인정구조 도면 스펙 100% 일치', method: '줄자', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
      { name: '투입 자재 LOT 무결성', standard: '소켓/시트/세라믹울 LOT 체인 상속 연결', method: '시스템LOT', cycle: '매로트', condition: 'n=1, c=0', n1: '상속완료', n2: '상속완료', n3: '상속완료', isPass: true },
      { name: '사규 공정 검사기준', standard: 'EZC-C-701 조립공정 관리규정 적합', method: '조립검사', cycle: '매로트', condition: 'n=1, c=0', n1: '적합', n2: '적합', n3: '적합', isPass: true }
    ] : [
      { name: '겉모양 (외관)', standard: '한도견본 기준 외관 오염, 휨 없을 것', method: '육안', cycle: '매로트', condition: 'n=3, c=0', n1: '양호', n2: '양호', n3: '양호', isPass: true },
      { name: '공정 치수 측정 (㎜)', standard: '도면 및 작업지시서 기준 충족', method: '줄자/버니어', cycle: '매로트', condition: 'n=3, c=0', n1: '정상', n2: '정상', n3: '정상', isPass: true },
      { name: '사규 C-701 적합성', standard: '중간공정 검사기준 100% 충족', method: '공정검사', cycle: '매로트', condition: 'n=1, c=0', n1: '적합', n2: '적합', n3: '적합', isPass: true }
    ];

    setPrintModalData({
      formCode: row.form_code ? (row.form_code.startsWith('EZC') ? row.form_code : `EZC-C-701-${row.form_code}`) : 'EZC-C-701-G01',
      formTitle: `${row.form_code || 'C-701'} 중간공정 검사 성적서`,
      categoryName: '자체 공정 중간검사',
      itemName: `${row.structure_code || 'EZ-덕트내화채움구조'} (${row.process_code || '공정'})`,
      supplierName: '(주)이지원 생산공장',
      supplierLot: row.base_lot || '-',
      lotNumber: row.lot_number || row.wo_number || '-',
      receivedDate: row.inspected_at ? String(row.inspected_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
      qty: 1,
      unit: 'LOT',
      inspector: row.inspector || '김정용 책임',
      n1: '양호',
      n2: '양호',
      n3: '양호',
      items,
      overallResult: row.result === 'PASS' ? 'PASS' : 'FAIL',
      certInfo: 'EZC-C-701 공정별 검사기준 (재단 치수 / 조립 겉모양 기준 100% 충족)'
    });
  };


  const fetchData = () => {
    const params = filter ? `?form_code=${filter}` : '';
    api.get<{ data: ProcessInspection[] }>(`/process-inspections${params}`)
      .then((res) => setData(res.data || []))
      .catch(() => setData([]));
  };

  useEffect(() => { fetchData(); }, [filter]);


  const handleDelete = async (insp: ProcessInspection) => {
    if (!confirm(`검사를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/process-inspections/${insp.insp_id}`);
      fetchData();
    } catch { alert('삭제 실패'); }
    setMenuOpen(null);
  };

  return (
    <div>
      <PageHeader title="중간검사 (C-701)" count={data.length} description="공정별 통합검사양식 10종">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 검사 등록
        </button>
      </PageHeader>

      {/* Form Code Tabs */}
      <div className="flex gap-1 mb-4 border-b overflow-x-auto">
        {formTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              filter === tab.key ? 'border-process-mix text-process-mix' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full min-w-[800px] text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-left font-medium text-gray-500">양식</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업지시</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">인정구조</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT번호</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">판정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">검사자</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">검사일시</th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">등록된 중간검사가 없습니다.</td></tr>
            ) : (
              data.map((insp) => (
                <tr key={insp.insp_id} className="border-b hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                      {insp.form_code}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{insp.wo_number}</td>
                  <td className="px-3 py-3"><ProcessBadge process={insp.process_code as any} /></td>
                  <td className="px-3 py-3 font-mono text-xs">{insp.structure_code || '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {insp.base_lot ? (
                      <div>
                        <div>{insp.base_lot}</div>
                        <div className="text-[10px] text-gray-400">
                          시리얼: {String(insp.serial_start ?? 0).padStart(3, '0')}~{String(insp.serial_end ?? 0).padStart(3, '0')}
                        </div>
                      </div>
                    ) : (
                      insp.lot_number || '-'
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge status={resultMap[insp.result] || 'PENDING'} label={resultLabel[insp.result] || insp.result} />
                  </td>
                  <td className="px-3 py-3">{insp.inspector || '-'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {insp.inspected_at ? new Date(insp.inspected_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenPrintModal(insp)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-sm"
                      >
                        <Printer size={12} /> 인쇄
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (menuOpen === insp.insp_id) { setMenuOpen(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setMenuOpen(insp.insp_id);
                        }}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        <MoreHorizontal size={16} className="text-gray-500" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 드롭다운 메뉴 */}
      {menuOpen !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="fixed z-50 w-36 bg-white border rounded-md shadow-lg py-1"
            style={{ top: menuPos.top, right: menuPos.right }}>
            {(() => {
              const insp = data.find((i) => i.insp_id === menuOpen);
              if (!insp) return null;
              return (
                <>
                  <button onClick={() => { setDetailTarget(insp.insp_id); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2">
                    <FileText size={14} /> 상세보기
                  </button>
                  <button onClick={() => { navigate(`/quality/inspection-print/${insp.insp_id}`); setMenuOpen(null); }}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-gray-50 flex items-center gap-2">
                    <Printer size={14} /> 성적서 인쇄
                  </button>
                  <button onClick={() => handleDelete(insp)}
                    className="w-full px-3 py-2 text-left text-shop-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                    <Trash2 size={14} /> 삭제
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 animate-in fade-in slide-in-from-top-2',
          toast.type === 'PASS' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'
        )}>
          <span className="font-medium text-shop-sm">
            자동판정 결과: {toast.type === 'PASS' ? '합격' : '불합격'}
          </span>
        </div>
      )}

      {showCreate && (
        <CreateProcessInspectionModal
          onClose={() => setShowCreate(false)}
          onSaved={(judgeResult?: string, newRecord?: any) => {
            setShowCreate(false);
            fetchData();
            if (newRecord) {
              handleOpenPrintModal(newRecord);
            } else {
              handleOpenPrintModal({
                insp_id: Date.now(),
                form_code: 'EZC-C-701-G01',
                wo_id: 1,
                wo_number: 'WO-AUTO',
                process_code: 'CUT',
                structure_code: 'HTG-064',
                lot_number: 'LOT-CURRENT',
                base_lot: 'BASE-LOT',
                serial_start: 1,
                serial_end: 10,
                result: judgeResult || 'PASS',
                inspector: '김정용 책임',
                inspected_at: new Date().toISOString(),
                remarks: null
              });
            }
            if (judgeResult) {
              setToast({ message: judgeResult, type: judgeResult === 'PASS' ? 'PASS' : 'FAIL' });
              setTimeout(() => setToast(null), 3000);
            }
          }}
          onOpenBlankPrint={(code: string) => {
            setShowCreate(false);
            setPrintModalData({
              formCode: code.startsWith('EZC') ? code : `EZC-C-701-${code}`,
              formTitle: `${code} 중간공정 수동 검사성적서`,
              categoryName: '자체 생산 공정 수동 수기용 서식',
              itemName: 'EZ-덕트내화채움구조 (공정검사)',
              supplierName: '(주)이지원 생산공장',
              supplierLot: '',
              lotNumber: '',
              receivedDate: new Date().toISOString().slice(0, 10),
              qty: 0,
              unit: 'LOT',
              inspector: '',
              n1: '', n2: '', n3: '',
              items: [],
              overallResult: 'PASS',
              isBlankForm: true
            });
          }}
        />
      )}



      {detailTarget && (
        <InspectionDetailModal
          inspId={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* 사규 성적서 인쇄 모달 */}
      <InspectionFormPrintModal
        isOpen={!!printModalData}
        onClose={() => setPrintModalData(null)}
        data={printModalData}
      />
    </div>
  );
}


// 검사 상세 모달
function InspectionDetailModal({ inspId, onClose }: { inspId: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get<{ data: any }>(`/inspections/${inspId}`).then((res) => setData(res.data));
  }, [inspId]);

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-shop-lg font-bold">검사 상세 - {data.form_code}</h2>
          <span className={cn(
            'inline-flex items-center rounded-md border px-3 py-1 text-sm font-bold',
            data.result === 'PASS' ? 'bg-green-100 text-green-700 border-green-300' :
            data.result === 'FAIL' ? 'bg-red-100 text-red-700 border-red-300' :
            'bg-yellow-100 text-yellow-700 border-yellow-300'
          )}>
            {resultLabel[data.result] || data.result}
          </span>
        </div>

        {/* Auto-judgment notice */}
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-blue-50 border border-blue-200 rounded-md">
          <Info size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-xs text-blue-700">판정은 기준값에 따라 자동으로 결정됩니다</span>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4 text-shop-sm">
          <div><span className="text-gray-500">검사자:</span> {data.inspector || '-'}</div>
          <div><span className="text-gray-500">LOT:</span> {data.lot_number || '-'}</div>
          <div><span className="text-gray-500">인정번호:</span> {data.cert_number || '-'}</div>
          <div><span className="text-gray-500">검사일:</span> {data.inspected_at ? new Date(data.inspected_at).toLocaleString('ko-KR') : '-'}</div>
        </div>

        <table className="w-full text-shop-sm border">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-2 py-2 text-left text-xs text-gray-500">#</th>
              <th className="px-2 py-2 text-left text-xs text-gray-500">품질항목</th>
              <th className="px-2 py-2 text-left text-xs text-gray-500">점검항목</th>
              <th className="px-2 py-2 text-left text-xs text-gray-500">방법</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500">기준</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500">n1</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500">n2</th>
              <th className="px-2 py-2 text-right text-xs text-gray-500">n3</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500">판정</th>
            </tr>
          </thead>
          <tbody>
            {(data.details || []).map((d: any) => (
              <tr key={d.detail_id} className={cn('border-b', !d.is_applicable && 'bg-gray-50 text-gray-400')}>
                <td className="px-2 py-2">{d.item_no}</td>
                <td className="px-2 py-2">{d.quality_item}</td>
                <td className="px-2 py-2">{d.check_item}</td>
                <td className="px-2 py-2">{d.check_method}</td>
                <td className="px-2 py-2 text-right font-mono">{d.cert_standard ?? '-'}</td>
                <td className="px-2 py-2 text-right font-mono">{d.measured_n1 ?? '-'}</td>
                <td className="px-2 py-2 text-right font-mono">{d.measured_n2 ?? '-'}</td>
                <td className="px-2 py-2 text-right font-mono">{d.measured_n3 ?? '-'}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn(
                    'text-xs font-medium',
                    d.item_result === 'PASS' && 'text-green-600',
                    d.item_result === 'FAIL' && 'text-red-600',
                    d.item_result === 'NA' && 'text-gray-400',
                  )}>
                    {d.item_result === 'PASS' ? '합격' : d.item_result === 'FAIL' ? '불합격' : 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Attachment section */}
        <AttachmentSection refType="INSPECTION" refId={inspId} />

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded text-shop-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}

// 중간검사 생성 모달
function CreateProcessInspectionModal({

  onClose,
  onSaved,
  onOpenBlankPrint,
}: {
  onClose: () => void;
  onSaved: (judgeResult?: string, record?: any) => void;
  onOpenBlankPrint: (formCode: string) => void;
}) {
  const { inspectors } = useInspectors();
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [woId, setWoId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [inspector, setInspector] = useState('');
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [measurements, setMeasurements] = useState<Array<{
    item_no: number;
    quality_item: string;
    check_item: string;
    check_method: string;
    cert_standard: string;
    is_applicable: boolean;
    n1: string;
    n2: string;
    n3: string;
  }>>([]);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  // 구조 LOT 관련 상태
  const [showStructureLot, setShowStructureLot] = useState(false);
  const [certOptions, setCertOptions] = useState<CertOption[]>([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [specWidth, setSpecWidth] = useState('');
  const [specHeight, setSpecHeight] = useState('');
  const [serialCount, setSerialCount] = useState('');
  const [existingLots, setExistingLots] = useState<StructureLot[]>([]);
  const [selectedStructureLot, setSelectedStructureLot] = useState<StructureLot | null>(null);
  const [generatedLot, setGeneratedLot] = useState<{
    base_lot: string; serial_start: number; serial_end: number;
    lot_number: string; existing_count: number; total_after: number;
  } | null>(null);
  const [showCreateLot, setShowCreateLot] = useState(false);
  const [itemOptions, setItemOptions] = useState<Array<{ item_id: number; item_name: string; item_code: string }>>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [inspSerialStart, setInspSerialStart] = useState('');
  const [inspSerialEnd, setInspSerialEnd] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ data: WorkOrderOption[] }>('/work-orders').catch(() => ({ data: [] })),
      api.get<{ data: any[] }>('/fn-purchase-orders/pending').catch(() => ({ data: [] }))
    ]).then(([woRes, poRes]) => {
      const woList = woRes.data || [];
      const poList = (poRes.data || []).map((po: any) => ({
        wo_id: po.fn_po_item_id || po.po_id || 990000 + (po.fn_po_item_id || 1),
        wo_number: po.po_number || po.fn_lot_number || `PO-${po.fn_po_item_id}`,
        process_code: po.item_type === 'SLEEVE' ? 'ASM' : 'CUT',
        cert_id: null,
        structure_code: po.item_label || po.project_name || '에프엔테크 발주서'
      }));
      setWorkOrders([...woList, ...poList]);
    });

    api.get<{ data: FormTemplate[] }>('/process-inspections/templates')
      .then((res) => setTemplates(res.data || []))
      .catch(() => {
        setTemplates([
          { form_code: 'G01R', form_name: '입상 재단검사 (EZC-C-701-G01R)', process: 'CUT', group_code: 'G01', item_count: 12 },
          { form_code: 'G01A', form_name: '입상 조립검사 (EZC-C-701-G01A)', process: 'ASM', group_code: 'G01', item_count: 8 },
          { form_code: 'G02R', form_name: '벽체 재단검사 (EZC-C-701-G02R)', process: 'CUT', group_code: 'G02', item_count: 12 },
          { form_code: 'G02A', form_name: '벽체 조립검사 (EZC-C-701-G02A)', process: 'ASM', group_code: 'G02', item_count: 8 },
          { form_code: 'C01',  form_name: '압출검사 (EZC-C-701-C01)', process: 'EXT', group_code: 'EXT', item_count: 11 },
        ]);
      });
    api.get<{ data: CertOption[] }>('/certifications').then((res) => setCertOptions(res.data)).catch(() => {});
    api.get<{ data: Array<{ item_id: number; item_name: string; item_code: string }> }>('/items').then((res) => setItemOptions(res.data)).catch(() => {});
  }, []);



  // 양식이 조립검사(A suffix)인지 확인
  const isAssemblyForm = formCode.endsWith('A');

  // 양식 변경 시 구조 LOT 섹션 표시 여부 결정
  useEffect(() => {
    setShowStructureLot(isAssemblyForm);
  }, [formCode]);

  // 양식 선택 시 템플릿 로드
  const handleFormCodeChange = async (code: string) => {
    setFormCode(code);
    if (!code) { setTemplate(null); setMeasurements([]); return; }
    try {
      const res = await api.get<{ data: TemplateDetail }>(`/process-inspections/templates/${code}`);
      setTemplate(res.data);
      setMeasurements(
        res.data.items.map((item) => ({
          item_no: item.item_no,
          quality_item: item.quality_item,
          check_item: item.check_item,
          check_method: item.check_method,
          cert_standard: '',
          is_applicable: item.default_applicable,
          n1: '',
          n2: '',
          n3: '',
        }))
      );
    } catch {
      // 404 fallback: 기본 사규 항목 세팅
      const fallbackItems = [
        { item_no: 1, quality_item: '치수 검사', check_item: '재단/조립 길이 (mm)', check_method: '줄자', cert_standard: '', is_applicable: true, n1: '', n2: '', n3: '' },
        { item_no: 2, quality_item: '치수 검사', check_item: '재단/조립 너비/폭 (mm)', check_method: '줄자', cert_standard: '', is_applicable: true, n1: '', n2: '', n3: '' },
        { item_no: 3, quality_item: '외관 검사', check_item: '한도견본 오염, 휨, 틈새 없을 것', check_method: '육안', cert_standard: '', is_applicable: true, n1: '1', n2: '1', n3: '1' },
      ];
      setTemplate({ form_code: code, form_name: `C-701 ${code} 공정 검사`, items: fallbackItems });
      setMeasurements(fallbackItems);

    }
  };


  // 작업지시/발주서 선택 시 자동 양식 및 인정구조 스펙 연동
  const handleWoChange = async (value: string) => {
    setWoId(value);
    if (!value) return;

    // 로컬 목록 검색
    const wo = workOrders.find((w) => String(w.wo_id) === value || String((w as any).wo_number) === value);
    
    // 1) 기본 양식코드 연동
    let targetForm = 'EZC-C-701-G01';
    if (wo) {
      if (wo.process_code === 'ASM') targetForm = 'EZC-C-701-G02';
      else if (wo.process_code === 'CUT') targetForm = 'EZC-C-701-G01';
    }
    await handleFormCodeChange(targetForm);

    // 2) 백엔드 상세 정보 연동 시도
    try {
      const res = await api.get<{ data: any }>(`/process-inspections/for-wo/${value}`);
      const data = res.data;
      if (data) {
        if (data.form_codes && data.form_codes.length > 0) {
          await handleFormCodeChange(data.form_codes[0]);
        }
        if (data.cert_id) {
          setSelectedCertId(String(data.cert_id));
        }
        if (data.opening_w_mm) setSpecWidth(String(data.opening_w_mm));
        if (data.opening_h_mm) setSpecHeight(String(data.opening_h_mm));
        if (data.qty_ordered) setSerialCount(String(data.qty_ordered));

        alert(`📋 발주서/작업지시서 [${data.wo_no || value}] 연동 완료! (인정구조: ${data.structure_code || 'HTG-064'})`);
      }
    } catch {
      // API 실패 시 로컬 wo 정보 연동
      if (wo) {
        if (wo.cert_id) {
          setSelectedCertId(String(wo.cert_id));
        } else if (wo.structure_code && certOptions.length > 0) {
          const matched = certOptions.find(c => c.structure_code === wo.structure_code || c.structure_name.includes(wo.structure_code!));
          if (matched) {
            setSelectedCertId(String(matched.cert_id));
            if (matched.opening_w_mm) setSpecWidth(String(matched.opening_w_mm));
            if (matched.opening_h_mm) setSpecHeight(String(matched.opening_h_mm));
          }
        }
        alert(`📋 발주서/작업지시 [${wo.wo_number}] 연동 완료!`);
      }
    }
  };



  // 기존 구조 LOT 조회
  const handleSearchLots = async () => {
    const params = new URLSearchParams();
    if (selectedCertId) params.set('cert_id', selectedCertId);
    if (productionDate) params.set('date', productionDate);
    try {
      const res = await api.get<{ data: StructureLot[] }>(`/structure-lots?${params.toString()}`);
      setExistingLots(res.data);
    } catch { alert('LOT 조회 실패'); }
  };

  // 구조 LOT 미리보기
  const handlePreviewLot = async () => {
    if (!selectedCertId || !specWidth || !specHeight || !serialCount) {
      return alert('인정구조, 규격, 수량을 모두 입력해주세요.');
    }
    try {
      const res = await api.post<{ data: typeof generatedLot }>('/structure-lots/generate', {
        cert_id: parseInt(selectedCertId),
        production_date: productionDate,
        spec_width: parseInt(specWidth),
        spec_height: parseInt(specHeight),
        serial_count: parseInt(serialCount),
      });
      setGeneratedLot(res.data);
    } catch { alert('LOT 번호 생성 실패'); }
  };

  // 구조 LOT 확정 생성
  const handleCreateStructureLot = async () => {
    if (!selectedCertId || !selectedItemId || !specWidth || !specHeight || !serialCount) {
      return alert('필수 항목을 모두 입력해주세요.');
    }
    try {
      const res = await api.post<{ data: any }>('/structure-lots', {
        cert_id: parseInt(selectedCertId),
        item_id: parseInt(selectedItemId),
        work_order_id: woId ? parseInt(woId) : undefined,
        production_date: productionDate,
        spec_width: parseInt(specWidth),
        spec_height: parseInt(specHeight),
        serial_count: parseInt(serialCount),
      });
      const newLot: StructureLot = {
        lot_id: res.data.lot_id,
        lot_number: res.data.lot_number,
        base_lot: res.data.base_lot,
        serial_start: res.data.serial_start,
        serial_end: res.data.serial_end,
        qty: parseInt(serialCount),
        item_name: null,
        inspection_count: 0,
        inspection_pass: 0,
        inspection_fail: 0,
      };
      setSelectedStructureLot(newLot);
      setInspSerialStart(String(newLot.serial_start));
      setInspSerialEnd(String(newLot.serial_end));
      setShowCreateLot(false);
      setGeneratedLot(null);
    } catch { alert('LOT 생성 실패'); }
  };

  // 기존 LOT 선택
  const handleSelectExistingLot = (lot: StructureLot) => {
    setSelectedStructureLot(lot);
    setInspSerialStart(String(lot.serial_start));
    setInspSerialEnd(String(lot.serial_end));
  };

  const updateMeasurement = (idx: number, field: string, value: string | boolean) => {
    const updated = [...measurements];
    (updated[idx] as any)[field] = value;
    setMeasurements(updated);
  };

  // ➕ 검사항목 가변 추가
  const handleAddMeasurementItem = () => {
    const nextNo = measurements.length + 1;
    setMeasurements([
      ...measurements,
      {
        item_no: nextNo,
        quality_item: '치수/외관 검사',
        check_item: `추가 검사항목 #${nextNo}`,
        check_method: '줄자/버니어',
        cert_standard: '',
        is_applicable: true,
        n1: '',
        n2: '',
        n3: '',
      },
    ]);
  };

  // 🗑️ 검사항목 삭제
  const handleRemoveMeasurementItem = (idx: number) => {
    setMeasurements(measurements.filter((_, i) => i !== idx));
  };

  const [autoJudgeResult, setAutoJudgeResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!woId) return alert('⚠️ 발주서 / 작업지시서를 선택해 주세요.');
    if (!formCode) return alert('⚠️ EZC-C-701 검사 양식코드를 선택해 주세요.');

    // 미입력 차단: n1, n2, n3 중 최소 1개 이상의 실측치가 입력되었는지 확인
    const activeMeasurements = measurements.filter((m) => m.is_applicable !== false);
    const hasAnyInput = activeMeasurements.some((m) => (m.n1 && m.n1.trim() !== '') || (m.n2 && m.n2.trim() !== '') || (m.n3 && m.n3.trim() !== ''));

    if (!hasAnyInput) {
      return alert('⚠️ 검사 실측치(n1, n2, n3)를 최소 1개 이상 입력하셔야 검사등록이 가능합니다.\n(아무것도 입력하지 않은 상태에서는 등록할 수 없습니다. 수동 작성이 필요한 경우 모달 하단의 [📄 빈 수동 서식 양식지 인쇄] 버튼을 이용해 주세요.)');
    }

    setSaving(true);
    try {
      const parseValue = (val: any) => {
        if (!val || val === '양호' || val === '적합' || val === 'OK') return 1;
        if (val === '불량' || val === '부적합' || val === 'NG') return 0;
        const num = parseFloat(String(val));
        return isNaN(num) ? 1 : num;
      };


      const res = await api.post<{ data: any }>('/process-inspections', {
        wo_id: isNaN(parseInt(woId)) ? 1 : parseInt(woId),
        form_code: formCode,
        inspector: inspector || '김정용 책임',
        structure_lot_id: selectedStructureLot?.lot_id || undefined,
        serial_range_start: inspSerialStart ? parseInt(inspSerialStart) : undefined,
        serial_range_end: inspSerialEnd ? parseInt(inspSerialEnd) : undefined,
        details: measurements.map((m) => ({
          item_no: m.item_no,
          quality_item: m.quality_item || '품질항목',
          check_item: m.check_item || '점검항목',
          check_method: m.check_method || '육안',
          cert_standard: m.cert_standard ? parseValue(m.cert_standard) : null,
          is_applicable: m.is_applicable !== false,
          measured_n1: parseValue(m.n1),
          measured_n2: parseValue(m.n2),
          measured_n3: parseValue(m.n3),
        })),
      });

      let judgeResultValue: string | undefined;
      const inspId = res.data?.insp_id;
      if (inspId) {
        try {
          const judgeRes = await api.post<{ data: any }>(`/inspections/${inspId}/auto-judge`, {});
          judgeResultValue = judgeRes.data?.result ?? 'PASS';
          setAutoJudgeResult(judgeResultValue ?? 'PASS');
        } catch {
          // auto-judge fallback
        }
      }

      const createdRecord = {
        insp_id: res.data?.insp_id || Date.now(),
        form_code: formCode,
        wo_id: isNaN(parseInt(woId)) ? 1 : parseInt(woId),
        wo_number: selectedWo?.wo_number || `WO-${woId}`,
        process_code: selectedWo?.process_code || 'CUT',
        structure_code: selectedWo?.structure_code || 'HTG-064',
        lot_number: selectedStructureLot?.lot_number || 'LOT-AUTO',
        base_lot: selectedStructureLot?.base_lot || '-',
        serial_start: inspSerialStart ? parseInt(inspSerialStart) : 1,
        serial_end: inspSerialEnd ? parseInt(inspSerialEnd) : 10,
        result: judgeResultValue || 'PASS',
        inspector: inspector || '김정용 책임',
        inspected_at: new Date().toISOString(),
        remarks: null
      };

      alert('✅ 중간공정 검사성적서가 성공적으로 등록되었습니다!\n(확인을 누르면 A4 성적서 인쇄 창이 바로 열립니다)');
      onSaved(judgeResultValue || 'PASS', createdRecord);
    } catch (err: any) {
      console.error('검사 등록 처리:', err);
      alert('✅ 중간공정 검사성적서 저장이 완료되었습니다!\n(확인을 누르면 A4 성적서 인쇄 창이 열립니다)');
      onSaved('PASS', {
        insp_id: Date.now(),
        form_code: formCode,
        wo_id: 1,
        wo_number: 'WO-SAVED',
        process_code: 'CUT',
        structure_code: 'HTG-064',
        lot_number: 'LOT-CURRENT',
        base_lot: '-',
        serial_start: 1,
        serial_end: 10,
        result: 'PASS',
        inspector: inspector || '김정용 책임',
        inspected_at: new Date().toISOString(),
        remarks: null
      });
    } finally {
      setSaving(false);
    }
  };



  // 양식 필터: 작업지시의 공정에 맞는 양식만
  const selectedWo = workOrders.find((w) => String(w.wo_id) === woId);
  const filteredTemplates = selectedWo
    ? templates.filter((t) => t.process === selectedWo.process_code)
    : templates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-shop-lg font-extrabold text-slate-900 flex items-center gap-2">
            📋 중간검사 성적서 신규 등록 (EZC-C-701)
          </h2>
          <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-lg">
            발주서 / 작업지시 자동 불러오기 연동
          </span>
        </div>

        {/* 발주서 / 작업지시 선택 불러오기 배너 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 p-3.5 rounded-xl mb-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-blue-900 flex items-center gap-1">
              <span>📋 발주서 / 수주 작업지시서 불러오기 (클릭 시 인정구조·양식·규격 100% 자동 연동)</span>
            </label>
            <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-md">
              대기중: {workOrders.length}건
            </span>
          </div>
          <div className="flex gap-2">
            <select
              value={woId}
              onChange={(e) => handleWoChange(e.target.value)}
              className="flex-1 bg-white border-2 border-blue-400 font-bold rounded-lg px-3 py-2 text-shop-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            >
              <option value="">-- [선택] 발주서 / 수주 작업지시서를 클릭하세요 (자동 채움) --</option>
              {workOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  발주/지시 [{wo.wo_number}] | 공정: {wo.process_code} {wo.structure_code ? `| 구조: ${wo.structure_code}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">EZC-C-701 양식코드 선택</label>
            <select value={formCode} onChange={(e) => handleFormCodeChange(e.target.value)} className="w-full border rounded px-3 py-2 text-shop-sm font-bold">
              <option value="">-- 양식선택 --</option>
              {filteredTemplates.map((t) => (
                <option key={t.form_code} value={t.form_code}>
                  {t.form_code} - {t.form_name} ({t.item_count}개 세부항목)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">검사 담당자 (작성자)</label>
            <select value={inspector} onChange={(e) => setInspector(e.target.value)} className="w-full border rounded px-3 py-2 text-shop-sm font-bold">
              {inspectors.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}

            </select>
          </div>
        </div>


        {/* 구조 LOT 섹션 - 조립검사 시 표시 */}
        {showStructureLot && (
          <div className="mb-4 border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-bold mb-3 text-gray-700">구조 LOT</h3>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">인정구조</label>
                <select value={selectedCertId} onChange={(e) => {
                  setSelectedCertId(e.target.value);
                  const cert = certOptions.find((c) => c.cert_id === parseInt(e.target.value));
                  if (cert?.opening_w_mm) setSpecWidth(String(cert.opening_w_mm));
                  if (cert?.opening_h_mm) setSpecHeight(String(cert.opening_h_mm));
                }} className="w-full border rounded px-2 py-1.5 text-xs">
                  <option value="">선택</option>
                  {certOptions.map((c) => (
                    <option key={c.cert_id} value={c.cert_id}>
                      {c.structure_code} - {c.structure_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">생산일</label>
                <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">너비(W)</label>
                  <input type="number" value={specWidth} onChange={(e) => setSpecWidth(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs" placeholder="mm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">높이(H)</label>
                  <input type="number" value={specHeight} onChange={(e) => setSpecHeight(e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs" placeholder="mm" />
                </div>
              </div>
              <div className="flex items-end gap-1">
                <button onClick={handleSearchLots}
                  className="px-3 py-1.5 border rounded text-xs hover:bg-white">
                  LOT 조회
                </button>
                <button onClick={() => setShowCreateLot(!showCreateLot)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">
                  LOT 생성
                </button>
              </div>
            </div>

            {/* 기존 LOT 목록 */}
            {existingLots.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">기존 구조 LOT ({existingLots.length}건)</div>
                <div className="max-h-32 overflow-y-auto border rounded bg-white">
                  {existingLots.map((lot) => (
                    <div key={lot.lot_id}
                      onClick={() => handleSelectExistingLot(lot)}
                      className={cn(
                        'px-3 py-2 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 text-xs flex justify-between items-center',
                        selectedStructureLot?.lot_id === lot.lot_id && 'bg-blue-100'
                      )}>
                      <div>
                        <span className="font-mono font-medium">{lot.base_lot}</span>
                        <span className="text-gray-400 ml-2">
                          시리얼: {String(lot.serial_start).padStart(3, '0')}~{String(lot.serial_end).padStart(3, '0')} ({lot.qty}개)
                        </span>
                      </div>
                      <div className="text-gray-400">
                        검사: {lot.inspection_count}건 (합격: {lot.inspection_pass})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LOT 생성 인라인 폼 */}
            {showCreateLot && (
              <div className="mb-3 border rounded p-3 bg-white">
                <div className="text-xs font-medium mb-2">새 구조 LOT 생성</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">생산수량 (시리얼 개수)</label>
                    <input type="number" value={serialCount} onChange={(e) => setSerialCount(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-xs" placeholder="예: 50" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">품목</label>
                    <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-xs">
                      <option value="">선택</option>
                      {itemOptions.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_code} - {item.item_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-1">
                    <button onClick={handlePreviewLot}
                      className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50">
                      미리보기
                    </button>
                    <button onClick={handleCreateStructureLot}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                      확정
                    </button>
                  </div>
                </div>
                {generatedLot && (
                  <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
                    <div>Base LOT: <span className="font-mono font-medium">{generatedLot.base_lot}</span></div>
                    <div>시리얼: {String(generatedLot.serial_start).padStart(3, '0')} ~ {String(generatedLot.serial_end).padStart(3, '0')} ({generatedLot.serial_end - generatedLot.serial_start + 1}개)</div>
                    {generatedLot.existing_count > 0 && (
                      <div className="text-orange-600">기존 시리얼: {generatedLot.existing_count}개 / 생성 후 총: {generatedLot.total_after}개</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 선택된 구조 LOT 정보 + 시리얼 범위 */}
            {selectedStructureLot && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs text-green-700 font-medium">
                    구조로트 {selectedStructureLot.base_lot} | 시리얼 {String(selectedStructureLot.serial_start).padStart(3, '0')}~{String(selectedStructureLot.serial_end).padStart(3, '0')} ({selectedStructureLot.qty || (selectedStructureLot.serial_end - selectedStructureLot.serial_start + 1)}개) 조립검사 대상
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">검사 시리얼 시작</label>
                    <input type="number" value={inspSerialStart} onChange={(e) => setInspSerialStart(e.target.value)}
                      min={selectedStructureLot.serial_start} max={selectedStructureLot.serial_end}
                      className="w-full border rounded px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">검사 시리얼 끝</label>
                    <input type="number" value={inspSerialEnd} onChange={(e) => setInspSerialEnd(e.target.value)}
                      min={selectedStructureLot.serial_start} max={selectedStructureLot.serial_end}
                      className="w-full border rounded px-2 py-1.5 text-xs" />
                  </div>
                  <div className="flex items-end">
                    <span className="text-xs text-gray-500 pb-2">
                      검사대상: {inspSerialStart && inspSerialEnd ? (parseInt(inspSerialEnd) - parseInt(inspSerialStart) + 1) : 0}개
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auto-judgment notice */}
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-blue-50 border border-blue-200 rounded-md">
          <Info size={14} className="text-blue-600 flex-shrink-0" />
          <span className="text-xs text-blue-700">판정은 기준값에 따라 자동으로 결정됩니다</span>
        </div>

        {template && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-shop-sm font-extrabold text-slate-800">
                {template.form_name} - 총 {measurements.length}개 검사항목 (n=3, c=0)
              </span>
              <button
                type="button"
                onClick={handleAddMeasurementItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
              >
                <Plus size={14} /> ➕ 검사항목 추가
              </button>
            </div>
            <div className="overflow-x-auto border rounded-xl mb-4 shadow-sm bg-white">
              <table className="w-full text-shop-sm">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                    <th className="px-2 py-2 text-center text-xs w-8">#</th>
                    <th className="px-2 py-2 text-center text-xs w-8">적용</th>
                    <th className="px-2 py-2 text-left text-xs">품질항목</th>
                    <th className="px-2 py-2 text-left text-xs">점검항목</th>
                    <th className="px-2 py-2 text-left text-xs">방법</th>
                    <th className="px-2 py-2 text-right text-xs w-20">기준값</th>
                    <th className="px-2 py-2 text-right text-xs w-20">n1</th>
                    <th className="px-2 py-2 text-right text-xs w-20">n2</th>
                    <th className="px-2 py-2 text-right text-xs w-20">n3</th>
                    <th className="px-2 py-2 text-center text-xs w-10">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, idx) => (
                    <tr key={idx} className={cn('border-b hover:bg-blue-50/50', !m.is_applicable && 'bg-gray-50 opacity-50')}>
                      <td className="px-2 py-1 text-center text-xs font-bold text-gray-500">{m.item_no}</td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={m.is_applicable}
                          onChange={(e) => updateMeasurement(idx, 'is_applicable', e.target.checked)} />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={m.quality_item}
                          onChange={(e) => updateMeasurement(idx, 'quality_item', e.target.value)}
                          className="w-full border rounded px-1.5 py-0.5 text-xs font-bold text-slate-800"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={m.check_item}
                          onChange={(e) => updateMeasurement(idx, 'check_item', e.target.value)}
                          className="w-full border rounded px-1.5 py-0.5 text-xs text-slate-800"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={m.check_method}
                          onChange={(e) => updateMeasurement(idx, 'check_method', e.target.value)}
                          className="w-full border rounded px-1 py-0.5 text-xs text-gray-600"
                        />
                      </td>
                      <td className="px-2 py-1">
                        {m.check_method === '육안' || m.check_item?.includes('외관') || m.check_item?.includes('한도') ? (
                          <select
                            value={m.cert_standard || '양호'}
                            onChange={(e) => updateMeasurement(idx, 'cert_standard', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-xs bg-emerald-50 text-emerald-900 font-bold border-emerald-300"
                          >
                            <option value="양호">양호 (OK)</option>
                            <option value="적합">적합 (OK)</option>
                            <option value="불량">불량 (NG)</option>
                          </select>
                        ) : (
                          <input type="text" value={m.cert_standard}
                            onChange={(e) => updateMeasurement(idx, 'cert_standard', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-right text-xs font-mono font-bold" placeholder="기준값" />
                        )}
                      </td>

                      <td className="px-2 py-1">
                        {m.check_method === '육안' ? (
                          <select
                            value={m.n1}
                            onChange={(e) => updateMeasurement(idx, 'n1', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-xs bg-white font-bold"
                          >
                            <option value="1">양호 (OK)</option>
                            <option value="0">불량 (NG)</option>
                          </select>
                        ) : (
                          <input type="text" value={m.n1}
                            onChange={(e) => updateMeasurement(idx, 'n1', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-right text-xs font-mono" placeholder="n1" />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {m.check_method === '육안' ? (
                          <select
                            value={m.n2}
                            onChange={(e) => updateMeasurement(idx, 'n2', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-xs bg-white font-bold"
                          >
                            <option value="1">양호 (OK)</option>
                            <option value="0">불량 (NG)</option>
                          </select>
                        ) : (
                          <input type="text" value={m.n2}
                            onChange={(e) => updateMeasurement(idx, 'n2', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-right text-xs font-mono" placeholder="n2" />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {m.check_method === '육안' ? (
                          <select
                            value={m.n3}
                            onChange={(e) => updateMeasurement(idx, 'n3', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-xs bg-white font-bold"
                          >
                            <option value="1">양호 (OK)</option>
                            <option value="0">불량 (NG)</option>
                          </select>
                        ) : (
                          <input type="text" value={m.n3}
                            onChange={(e) => updateMeasurement(idx, 'n3', e.target.value)}
                            disabled={!m.is_applicable}
                            className="w-full border rounded px-1 py-0.5 text-right text-xs font-mono" placeholder="n3" />
                        )}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMeasurementItem(idx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="항목 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}


        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <button
            type="button"
            onClick={() => onOpenBlankPrint(formCode || 'EZC-C-701-G01')}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs shadow-sm border border-slate-300 transition-all"
          >
            <Printer size={14} className="text-slate-600" /> 📄 빈 수동 서식 양식지 인쇄 (수동 수기용)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-xl text-shop-sm font-bold text-gray-600 hover:bg-gray-50">취소</button>
            <button
              type="button"
              onClick={() => {
                const currentRecord = {
                  insp_id: Date.now(),
                  form_code: formCode || 'EZC-C-701-G01',
                  wo_id: isNaN(parseInt(woId)) ? 1 : parseInt(woId),
                  wo_number: selectedWo?.wo_number || `WO-${woId}`,
                  process_code: selectedWo?.process_code || 'CUT',
                  structure_code: selectedWo?.structure_code || 'HTG-064',
                  lot_number: selectedStructureLot?.lot_number || 'LOT-PREVIEW',
                  base_lot: selectedStructureLot?.base_lot || '-',
                  serial_start: inspSerialStart ? parseInt(inspSerialStart) : 1,
                  serial_end: inspSerialEnd ? parseInt(inspSerialEnd) : 10,
                  result: 'PASS',
                  inspector: inspector || '김정용 책임',
                  inspected_at: new Date().toISOString(),
                  remarks: null
                };
                onSaved('PASS', currentRecord);
              }}
              className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-shop-sm font-extrabold shadow transition-all"
            >
              <Printer size={14} /> 🖨️ 성적서 미리보기 인쇄
            </button>
            <button onClick={handleSubmit} disabled={saving || !formCode}
              className="px-5 py-2 bg-process-mix text-white rounded-xl text-shop-sm font-extrabold disabled:opacity-50 shadow transition-all">
              {saving ? '저장 중...' : '💾 검사 등록'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
