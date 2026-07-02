import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Printer } from 'lucide-react';

interface WorkOrder {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  process_code: string;
  status: string;
  item_name: string | null;
  structure_code: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  lot_number: string | null;
  am_worker: string | null;
  pm_worker: string | null;
  start_time: string | null;
  end_time: string | null;
  input_weight_kg: number | null;
  production_length_m: number | null;
  scrap_kg: number | null;
  equipment_id: string | null;
  downtime_minutes: number | null;
}

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합' },
  { key: 'EXT', label: '압출' },
  { key: 'CUT', label: '재단' },
  { key: 'ASM', label: '조립' },
];

export function DailyLogPage() {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('process_code', filter);
    if (date) params.set('date', date);
    const qs = params.toString();
    api.get<{ data: WorkOrder[] }>(`/work-orders${qs ? '?' + qs : ''}`).then((res) => setData(res.data));
  }, [filter, date]);

  return (
    <div>
      <PageHeader title="공정일지" count={data.length} description="일자별 생산실적 통합 조회">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-md text-shop-sm"
        />
      </PageHeader>

      {/* Process Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-shop-sm font-medium border-b-2 transition-colors',
              filter === tab.key
                ? 'border-process-ext text-process-ext'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daily Log Table */}
      <div className="overflow-x-auto rounded-card border bg-white">
        <table className="w-full text-shop-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-3 text-left font-medium text-gray-500">지시번호</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">공정</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">상태</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">품목</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">LOT</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">설비</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">시작/종료</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">투입(kg)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">생산길이(m)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">스크랩(kg)</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">계획</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">실적</th>
              <th className="px-3 py-3 text-left font-medium text-gray-500">작업자</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                  {date} 작업 기록이 없습니다.
                </td>
              </tr>
            ) : (
              data.map((wo) => (
                <tr key={wo.wo_id} className="border-b hover:bg-blue-50 transition-colors">
                  <td
                    className="px-3 py-3 font-mono text-xs text-blue-600 hover:underline cursor-pointer font-semibold"
                    onClick={() => setSelectedWo(wo)}
                  >
                    {wo.wo_number}
                  </td>
                  <td className="px-3 py-3">
                    <ProcessBadge process={wo.process_code as any} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={wo.status === 'COMPLETED' ? 'PASS' : wo.status === 'IN_PROGRESS' ? 'INFO' : 'PENDING'}
                      label={wo.status === 'COMPLETED' ? '완료' : wo.status === 'IN_PROGRESS' ? '진행' : '계획'}
                    />
                  </td>
                  <td className="px-3 py-3 truncate max-w-[120px]">{wo.item_name ?? '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs">{wo.lot_number ?? '-'}</td>
                  <td className="px-3 py-3">{wo.equipment_id ?? '-'}</td>
                  <td className="px-3 py-3 text-xs">
                    {wo.start_time && wo.end_time
                      ? `${wo.start_time.slice(0, 5)}~${wo.end_time.slice(0, 5)}`
                      : '-'}
                    {wo.downtime_minutes ? ` (중단${wo.downtime_minutes}분)` : ''}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{wo.input_weight_kg ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.production_length_m ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.scrap_kg ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.planned_qty ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-mono">{wo.actual_qty ?? '-'}</td>
                  <td className="px-3 py-3 text-xs">{wo.am_worker ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedWo && (
        <DetailDailyLogModal
          workOrder={selectedWo}
          onClose={() => setSelectedWo(null)}
        />
      )}
    </div>
  );
}

/* ========== Detail Daily Log Modal (A4 Print-Friendly) ========== */
function DetailDailyLogModal({ workOrder, onClose }: { workOrder: WorkOrder; onClose: () => void }) {
  const [log, setLog] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // 1. 공정로그 패치
    api.get<{ data: any[] }>(`/api/process-logs?wo_id=${workOrder.wo_id}`).then((res) => {
      if (res.data && res.data.length > 0) {
        setLog(res.data[0]);
      }
    });
    // 2. 자주검사 패치
    api.get<{ data: any[] }>(`/api/self-inspections?wo_id=${workOrder.wo_id}`).then((res) => {
      setInspections(res.data || []);
      setLoading(false);
    });
  }, [workOrder.wo_id]);

  const handlePrint = () => {
    window.print();
  };

  // Parse raw material inputs
  let rawInputs: any[] = [];
  try {
    if (log && log.raw_material_inputs) {
      rawInputs = typeof log.raw_material_inputs === 'string'
        ? JSON.parse(log.raw_material_inputs)
        : log.raw_material_inputs;
    }
  } catch {}

  const getLogTitle = () => {
    if (workOrder.process_code === 'MIX') return '배 합 생 산 일 지';
    if (workOrder.process_code === 'EXT') return '압 출 생 산 일 지';
    return '조 립 생 산 일 지';
  };

  const getDocCode = () => {
    if (workOrder.process_code === 'MIX') return 'EZC B-201-1';
    if (workOrder.process_code === 'EXT') return 'EZC-B-201-2';
    return 'EZC B-201-3';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col print:shadow-none print:w-auto print:max-h-none print:rounded-none">
        
        {/* Print controls (hidden in print mode) */}
        <div className="px-6 py-3 border-b bg-gray-100 flex justify-between items-center rounded-t-card print:hidden">
          <span className="font-bold text-gray-800">공정작업일지 사규 양식 출력 미리보기</span>
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

        {/* Outer scroll wrapper */}
        <div className="p-8 overflow-y-auto flex-1 bg-gray-50 print:bg-white print:p-0">
          <div className="bg-white border border-black p-8 w-[210mm] min-h-[297mm] mx-auto shadow-sm text-black print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0">
            
            {/* Header metadata and approvals stamp */}
            <div className="flex justify-between items-start mb-6">
              <div className="text-[10px] font-mono text-gray-500">
                문서번호: {getDocCode()} (Rev.1)<br />
                규격: A4(210⨯297)
              </div>
              <div className="flex border border-black text-center text-xs">
                <div className="bg-gray-100 border-r border-black p-2 font-bold w-12 flex items-center justify-center">결<br/>재</div>
                <div>
                  <div className="border-b border-black px-4 py-1">작 성</div>
                  <div className="h-10 px-4 flex items-center justify-center font-semibold text-gray-700">
                    {workOrder.am_worker || '작업자'}
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
            <h1 className="text-xl font-bold text-center underline tracking-wider mb-6">
              {getLogTitle()}
            </h1>

            {/* Info Table */}
            <table className="w-full border border-black text-xs mb-6">
              <tbody>
                <tr className="border-b border-black">
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">설비 번호</td>
                  <td className="p-2 border-r border-black font-semibold">
                    {workOrder.equipment_id || (workOrder.process_code === 'MIX' ? 'EZC-M-09' : 'EZC-E-65')}
                  </td>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">생산 일자</td>
                  <td className="p-2">{workOrder.wo_date}</td>
                </tr>
                <tr>
                  <td className="bg-gray-100 p-2 font-bold w-20 border-r border-black">생산 시간</td>
                  <td className="p-2 border-r border-black" colSpan={3}>
                    {log?.started_at ? new Date(log.started_at).toLocaleTimeString('ko-KR') : '계획'}
                    {log?.completed_at ? ` ~ ${new Date(log.completed_at).toLocaleTimeString('ko-KR')}` : ''}
                    {workOrder.downtime_minutes ? ` (비가동 정지시간: ${workOrder.downtime_minutes}분)` : ''}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* COMPOUNDING LOG SHEET */}
            {workOrder.process_code === 'MIX' && (
              <div className="space-y-4">
                <h3 className="font-bold text-xs">■ 배합 생산 현황 (1batch = 300kg)</h3>
                <table className="w-full border border-black text-center text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-semibold">
                      <th className="p-2 border-r border-black w-24">생산 LOT No.</th>
                      <th className="p-2 border-r border-black">원재료명</th>
                      <th className="p-2 border-r border-black w-24">표준 배합량</th>
                      <th className="p-2 border-r border-black w-24">실투입량</th>
                      <th className="p-2 border-r border-black w-24">단위</th>
                      <th className="p-2">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawInputs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-gray-400">투입 내역이 없습니다.</td>
                      </tr>
                    ) : (
                      rawInputs.map((item, idx) => (
                        <tr key={idx} className="border-b border-black">
                          {idx === 0 && (
                            <td className="p-2 border-r border-black font-mono font-bold" rowSpan={rawInputs.length}>
                              {workOrder.lot_number}
                            </td>
                          )}
                          <td className="p-2 border-r border-black text-left font-medium">{item.item_name}</td>
                          <td className="p-2 border-r border-black text-right font-mono">{item.standard_qty ?? '-'}</td>
                          <td className="p-2 border-r border-black text-right font-mono font-bold text-blue-700">{item.qty}</td>
                          <td className="p-2 border-r border-black">kg</td>
                          <td className="p-2 text-xs">{item.lot_number ? `LOT: ${item.lot_number}` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* EXTRUSION LOG SHEET */}
            {workOrder.process_code === 'EXT' && (
              <div className="space-y-4">
                <h3 className="font-bold text-xs">■ 압출 생산 현황 (로트부여: 배합 로트번호 승계)</h3>
                <table className="w-full border border-black text-center text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-semibold">
                      <th className="p-2 border-r border-black w-28">투입 배합 LOT</th>
                      <th className="p-2 border-r border-black w-20">배합중량</th>
                      <th className="p-2 border-r border-black">압출 규격</th>
                      <th className="p-2 border-r border-black w-20">생산길이</th>
                      <th className="p-2 border-r border-black w-20">생산량</th>
                      <th className="p-2 border-r border-black w-20">더미(Loss)</th>
                      <th className="p-2">생산 LOT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2 border-r border-black font-mono">{log?.parent_lot_number || '-'}</td>
                      <td className="p-2 border-r border-black font-mono">{workOrder.input_weight_kg ?? '-'} kg</td>
                      <td className="p-2 border-r border-black">{workOrder.item_name}</td>
                      <td className="p-2 border-r border-black font-mono font-semibold">{workOrder.production_length_m ?? '-'} m</td>
                      <td className="p-2 border-r border-black font-mono font-bold text-blue-700">{workOrder.actual_qty ?? '-'} EA</td>
                      <td className="p-2 border-r border-black font-mono text-red-600">{log?.dummy_weight_kg ?? log?.loss_qty ?? '-'} kg</td>
                      <td className="p-2 font-mono font-bold text-indigo-700">{workOrder.lot_number}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ASSEMBLY / CUTTING LOG SHEET */}
            {workOrder.process_code !== 'MIX' && workOrder.process_code !== 'EXT' && (
              <div className="space-y-4">
                <h3 className="font-bold text-xs">■ 조립/재단 생산 현황 (자재 매핑 추적)</h3>
                <table className="w-full border border-black text-center text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black font-semibold">
                      <th className="p-2 border-r border-black">구조명</th>
                      <th className="p-2 border-r border-black w-36">생산 규격</th>
                      <th className="p-2 border-r border-black w-20">투입수량</th>
                      <th className="p-2 border-r border-black w-20">생산수량</th>
                      <th className="p-2 border-r border-black w-20">스크랩</th>
                      <th className="p-2">생산 LOT 번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-2 border-r border-black font-medium">{workOrder.structure_code || '표준구조'}</td>
                      <td className="p-2 border-r border-black">{workOrder.item_name}</td>
                      <td className="p-2 border-r border-black font-mono">{workOrder.planned_qty ?? '-'} EA</td>
                      <td className="p-2 border-r border-black font-mono font-bold text-blue-700">{workOrder.actual_qty ?? '-'} EA</td>
                      <td className="p-2 border-r border-black font-mono text-red-600">{log?.scrap_kg ?? '-'} kg</td>
                      <td className="p-2 font-mono font-bold text-indigo-700">{workOrder.lot_number}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* In-process Quality Inspections results */}
            <div className="mt-8 space-y-4">
              <h3 className="font-bold text-xs">■ 자주/중간검사 품질 기록</h3>
              <table className="w-full border border-black text-center text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-black font-semibold">
                    <th className="p-2 border-r border-black w-12">No</th>
                    <th className="p-2 border-r border-black">품질항목 / 검사포인트</th>
                    <th className="p-2 border-r border-black w-24">기준값</th>
                    <th className="p-2 border-r border-black w-16">허용오차</th>
                    <th className="p-2 border-r border-black w-24">실측값</th>
                    <th className="p-2 border-r border-black w-20">검사자</th>
                    <th className="p-2">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400">품질 기록을 조회하는 중...</td>
                    </tr>
                  ) : inspections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400">등록된 자주검사 기록이 없습니다.</td>
                    </tr>
                  ) : (
                    inspections.map((insp, idx) => {
                      const isVisual = insp.check_category === 'VISUAL' || insp.check_point.includes('외관');
                      return (
                        <tr key={insp.self_insp_id} className="border-b border-black">
                          <td className="p-2 border-r border-black font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-black text-left">
                            <span className="text-gray-400 block text-[9px]">{insp.check_category}</span>
                            <span className="font-medium">{insp.check_point}</span>
                          </td>
                          <td className="p-2 border-r border-black font-mono">
                            {isVisual ? '결함이 없을 것' : `${insp.standard_value}`}
                          </td>
                          <td className="p-2 border-r border-black font-mono">
                            {isVisual ? 'OK' : `± ${insp.tolerance}`}
                          </td>
                          <td className="p-2 border-r border-black font-mono font-bold text-blue-800">
                            {insp.measured_value != null
                              ? isVisual
                                ? insp.measured_value >= 1 ? 'OK' : 'NG'
                                : `${insp.measured_value}`
                              : '-'}
                          </td>
                          <td className="p-2 border-r border-black">{insp.worker || '-'}</td>
                          <td className="p-2 font-bold">
                            {insp.is_ok === true && <span className="text-green-600">합격(Pass)</span>}
                            {insp.is_ok === false && <span className="text-red-600">불합격(NG)</span>}
                            {insp.is_ok == null && <span className="text-gray-400">미완료</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Quality remarks and downtimes */}
            <div className="mt-8 border border-black p-4 space-y-3">
              <div className="text-xs font-bold">□ 특이사항 및 생산일지 세부 코멘트</div>
              <div className="text-xs min-h-16 text-gray-700 whitespace-pre-wrap leading-relaxed">
                {log?.remarks || '품질 특이사항 없음. 정상 생산 완료되었습니다.'}
              </div>
            </div>

            <div className="text-center font-bold text-xs tracking-wider mt-12 text-gray-500">
              (주) 이지원 생산본부
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
