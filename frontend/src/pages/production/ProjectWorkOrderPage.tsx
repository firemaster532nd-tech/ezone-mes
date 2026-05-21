import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { 
  FolderGit2, Printer, CheckSquare, Scissors, 
  Layers, Hammer, Eye, FileSpreadsheet, X, Plus,
  Save, User, Phone, ShieldAlert, Award, Calendar
} from 'lucide-react';

interface Project {
  project_id: number;
  project_code: string;
  project_name: string;
}

interface Distributor {
  company_id: number;
  company_name: string;
  ceo_name: string | null;
  phone: string | null;
  corporate_no: string | null;
}

interface SocketInspection {
  no: string;
  structure: string;
  w: number;
  h: number;
  split_structure: string;
  stock_status: string;
  install_pos: string;
  remarks: string;
}

interface VMCutting {
  no: string;
  structure: string;
  w: number;
  h: number;
  socket_lot: string;
  qty: number;
  inner_w: number;
  inner_w_qty: number;
  inner_h: number;
  inner_h_qty: number;
  outer_tb: number;
  outer_tb_qty: number;
  outer_lr: number;
  outer_lr_qty: number;
  remarks: string;
}

interface VTCutting {
  no: string;
  structure: string;
  w: number;
  h: number;
  socket_lot: string;
  qty: number;
  inner_w: number;
  inner_w_qty: number;
  inner_h: number;
  inner_h_qty: number;
  outer_tb: number;
  outer_tb_qty: number;
  outer_lr: number;
  outer_lr_qty: number;
  remarks: string;
}

interface CeramicCutting {
  no: string;
  structure: string;
  w: number;
  h: number;
  socket_lot: string;
  qty: number;
  outer_tb: number;
  outer_tb_qty: number;
  outer_lr: number;
  outer_lr_qty: number;
  remarks: string;
}

interface WorkOrderSheets {
  socketInspection: SocketInspection[];
  vmCutting: VMCutting[];
  vtCutting: VTCutting[];
  ceramicCutting: CeramicCutting[];
}

export function ProjectWorkOrderPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'socket' | 'vm' | 'vt' | 'ceramic'>('socket');
  const [sheets, setSheets] = useState<WorkOrderSheets | null>(null);
  const [loading, setLoading] = useState(false);

  // 인쇄 모달 상태
  const [showPrintModal, setShowPrintModal] = useState(false);

  // ─── 신규 프로젝트 등록 (퀵 모달) 상태 ───
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [quickFormData, setQuickFormData] = useState({
    project_code: '',
    project_name: '',
    customer_name: '',
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED' | 'SUSPENDED',
    remarks: '',
    distributor_id: '' as number | '',
    phone: '',
    ceo_name: '',
    corporate_no: '',
    deliveries: [] as any[]
  });

  const fetchProjects = async (selectLatest = false) => {
    try {
      const res = await api.get<{ data: Project[] }>('/projects');
      setProjects(res.data.data);
      if (res.data.data.length > 0 && (!selectedProjectId || selectLatest)) {
        // 가장 최근 등록되었거나 첫 번째 항목 매핑
        const targetProj = selectLatest ? res.data.data[0] : res.data.data[0];
        setSelectedProjectId(targetProj.project_id);
        setSelectedProjectName(targetProj.project_name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDistributors = async () => {
    try {
      const res = await api.get<{ data: any[] }>('/companies?type=DISTRIBUTOR');
      setDistributors(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 1. 프로젝트 리스트 가져오기
  useEffect(() => {
    fetchProjects();
    fetchDistributors();
  }, []);

  // 2. 선택된 프로젝트가 바뀔 때 시트 공식 데이터 전개 API 로드
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    api.get<WorkOrderSheets>(`/projects/${selectedProjectId}/work-order-sheets`)
      .then(res => {
        setSheets(res);
      })
      .catch(e => {
        toast.error('작업지시 공식 전개에 실패했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedProjectId]);

  const handleProjectChange = (id: number) => {
    setSelectedProjectId(id);
    const proj = projects.find(p => p.project_id === id);
    if (proj) setSelectedProjectName(proj.project_name);
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── 퀵 프로젝트 등록 모달 열기 ───
  const handleOpenQuickModal = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2);
    const rand = Math.floor(100 + Math.random() * 900);
    setQuickFormData({
      project_code: `PJ-${dateStr}-${rand}`,
      project_name: '',
      customer_name: '',
      order_date: new Date().toISOString().slice(0, 10),
      delivery_date: '',
      status: 'ACTIVE',
      remarks: '작업지시서 화면 퀵 등록',
      distributor_id: '',
      phone: '',
      ceo_name: '',
      corporate_no: '',
      deliveries: []
    });
    setIsQuickModalOpen(true);
  };

  // 퀵 등록 시 유통업체 자동 완성
  const handleQuickDistributorChange = (distIdStr: string) => {
    if (!distIdStr) {
      setQuickFormData(prev => ({
        ...prev,
        distributor_id: '',
        phone: '',
        ceo_name: '',
        corporate_no: ''
      }));
      return;
    }
    const distId = parseInt(distIdStr, 10);
    const selected = distributors.find(d => d.company_id === distId);
    if (selected) {
      setQuickFormData(prev => ({
        ...prev,
        distributor_id: distId,
        ceo_name: selected.ceo_name || '',
        phone: selected.phone || '',
        corporate_no: selected.corporate_no || ''
      }));
      toast.success(`${selected.company_name} 유통사 정보가 즉시 연동 매핑되었습니다.`);
    }
  };

  // 퀵 등록 프로젝트 저장 완료 후 실시간 연동 리로드
  const handleQuickProjectSave = async () => {
    if (!quickFormData.project_code.trim()) {
      toast.error('프로젝트 코드는 필수입니다.');
      return;
    }
    if (!quickFormData.project_name.trim()) {
      toast.error('현장명은 필수입니다.');
      return;
    }

    try {
      const payload = {
        ...quickFormData,
        distributor_id: quickFormData.distributor_id === '' ? null : quickFormData.distributor_id
      };
      
      const res = await api.post<{ data: any }>('/projects', payload);
      const newProj = res.data.data;
      
      toast.success(`새 현장 [${newProj.project_name}] 프로젝트가 신규 등록되었습니다.`);
      setIsQuickModalOpen(false);

      // 프로젝트 리스트 리로드 및 새로 생성된 프로젝트로 선택값 전환
      const resProj = await api.get<{ data: Project[] }>('/projects');
      setProjects(resProj.data.data);
      setSelectedProjectId(newProj.project_id);
      setSelectedProjectName(newProj.project_name);
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '프로젝트 퀵 저장에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6 print:p-0 print:bg-white max-w-[1600px] mx-auto p-1">
      {/* 화면 제어 영역 (인쇄 시 숨김) */}
      <div className="print:hidden space-y-6">
        <PageHeader 
          title="현장별 작업지시서 생성" 
          count={projects.length} 
          description="현장별 수주 규격을 감지하여 소켓인수검사, VM/VT 재단공식 및 차열재재단 사양 자동 산출" 
        />

        {/* 프로젝트 선택 패널 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <FolderGit2 className="h-5 w-5 text-blue-600" />
            <label className="text-sm font-bold text-slate-700">작업 현장 선택:</label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-extrabold focus:border-blue-500 outline-none text-slate-700 bg-white shadow-sm"
            >
              {projects.map(p => (
                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
              ))}
            </select>
            
            {/* 신규 프로젝트 등록 단축 액션 버튼 */}
            <button
              onClick={handleOpenQuickModal}
              className="flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 text-xs font-black transition-all border border-blue-200/50 shadow-inner"
            >
              <Plus className="h-3.5 w-3.5" />
              신규 프로젝트 등록
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              disabled={!sheets}
            >
              <Printer className="h-4 w-4" />
              A4 인쇄 프리뷰
            </button>
          </div>
        </div>

        {/* 탭 인터페이스 */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveTab('socket')}
            className={cn(
              "flex-1 py-3.5 text-center font-bold text-sm border-b-2 flex items-center justify-center gap-2 transition-all",
              activeTab === 'socket' ? "border-blue-600 text-blue-600 bg-blue-50/10" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <CheckSquare className="h-4.5 w-4.5" />
            소켓 인수 검사 시트
          </button>
          <button
            onClick={() => setActiveTab('vm')}
            className={cn(
              "flex-1 py-3.5 text-center font-bold text-sm border-b-2 flex items-center justify-center gap-2 transition-all",
              activeTab === 'vm' ? "border-indigo-600 text-indigo-600 bg-indigo-50/10" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Scissors className="h-4.5 w-4.5" />
            재단(VM) 작업지시서
          </button>
          <button
            onClick={() => setActiveTab('vt')}
            className={cn(
              "flex-1 py-3.5 text-center font-bold text-sm border-b-2 flex items-center justify-center gap-2 transition-all",
              activeTab === 'vt' ? "border-purple-600 text-purple-600 bg-purple-50/10" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Layers className="h-4.5 w-4.5" />
            재단(VT) 작업지시서
          </button>
          <button
            onClick={() => setActiveTab('ceramic')}
            className={cn(
              "flex-1 py-3.5 text-center font-bold text-sm border-b-2 flex items-center justify-center gap-2 transition-all",
              activeTab === 'ceramic' ? "border-amber-600 text-amber-600 bg-amber-50/10" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Hammer className="h-4.5 w-4.5" />
            차열재 재단(VM,VT) 지시서
          </button>
        </div>
      </div>

      {/* 테이블 결과 그리드 (탭 전개) */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-500 text-sm font-semibold">수식을 적용하여 지시서를 연동하는 중입니다...</p>
          </div>
        ) : sheets ? (
          <div className="p-6 print:p-0">
            {/* 탭 1: 소켓 인수 검사 */}
            {activeTab === 'socket' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <h3 className="text-base font-bold text-slate-850">소켓 인수 검사 명세</h3>
                  <span className="text-xs text-slate-400 font-mono">Formula: W, H 규격 100% 매핑</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs text-center">
                        <th className="px-4 py-3 border border-slate-200 w-12">No</th>
                        <th className="px-4 py-3 border border-slate-200 w-28">구조코드</th>
                        <th className="px-4 py-3 border border-slate-200 w-28 text-right">수주 W (mm)</th>
                        <th className="px-4 py-3 border border-slate-200 w-28 text-right">수주 H (mm)</th>
                        <th className="px-4 py-3 border border-slate-200">분할구조 사양</th>
                        <th className="px-4 py-3 border border-slate-200 w-24">재고보유</th>
                        <th className="px-4 py-3 border border-slate-200 w-28">설치위치</th>
                        <th className="px-4 py-3 border border-slate-200">특이사항/비고</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-center font-mono divide-y divide-slate-100">
                      {sheets.socketInspection.map(row => (
                        <tr key={row.no} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-400">{row.no}</td>
                          <td className="px-4 py-2.5 border border-slate-200 font-bold text-blue-600">{row.structure}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-right font-bold text-slate-800">{row.w.toLocaleString()}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-right font-bold text-slate-800">{row.h.toLocaleString()}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-500 font-sans text-left">{row.split_structure || '통구조 (1분할)'}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-center"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-sans font-bold text-[10px] border border-emerald-200">{row.stock_status}</span></td>
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-600">{row.install_pos}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-500 font-sans text-left">{row.remarks}</td>
                        </tr>
                      ))}
                      {sheets.socketInspection.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-slate-400 text-center">등록된 수주 품목이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 탭 2: VM 재단 */}
            {activeTab === 'vm' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <h3 className="text-base font-bold text-slate-850">재단(VM) 작업 명세</h3>
                  <span className="text-xs text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded">Formula: 내부 W-5, H-30 / 외부 상하 W+60, 좌우 H</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs text-center">
                        <th className="px-2 py-3 border border-slate-200 w-12" rowSpan={2}>No</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>구조</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>수주 W</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>수주 H</th>
                        <th className="px-2 py-3 border border-slate-200 w-28" rowSpan={2}>소켓 LOT</th>
                        <th className="px-2 py-3 border border-slate-200 w-14" rowSpan={2}>수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/30 text-indigo-700" colSpan={4}>소켓내부용 재단치수 (mm)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/30 text-emerald-700" colSpan={4}>외부용 재단치수 (mm)</th>
                        <th className="px-2 py-3 border border-slate-200" rowSpan={2}>작업비고</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] text-center">
                        <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/10 text-indigo-600">가로(W-5)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/10 text-indigo-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/10 text-indigo-600">세로(H-30)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-indigo-50/10 text-indigo-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">상하(W+60)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">좌우(H)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">수량</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-center font-mono divide-y divide-slate-100">
                      {sheets.vmCutting.map(row => (
                        <tr key={row.no} className="hover:bg-slate-50/50">
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-400">{row.no}</td>
                          <td className="px-2 py-2.5 border border-slate-200 font-bold text-blue-600">{row.structure}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right">{row.w}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right">{row.h}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-left text-[10px] text-slate-500">{row.socket_lot}</td>
                          <td className="px-2 py-2.5 border border-slate-200 font-bold text-slate-800">{row.qty}</td>
                          {/* 내부재단 */}
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-indigo-50/5 font-bold text-indigo-600">{row.inner_w}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-indigo-50/5">{row.inner_w_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-indigo-50/5 font-bold text-indigo-600">{row.inner_h}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-indigo-50/5">{row.inner_h_qty}</td>
                          {/* 외부재단 */}
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-emerald-50/5 font-bold text-emerald-600">{row.outer_tb}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-emerald-50/5">{row.outer_tb_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-emerald-50/5 font-bold text-emerald-600">{row.outer_lr}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-emerald-50/5">{row.outer_lr_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-left font-sans text-[10px] text-slate-500">{row.remarks}</td>
                        </tr>
                      ))}
                      {sheets.vmCutting.length === 0 && (
                        <tr><td colSpan={15} className="py-8 text-slate-400 text-center">해당 현장의 단일소켓(VM) 재단 품목이 없거나 VT 규격만 존재합니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 탭 3: VT 재단 */}
            {activeTab === 'vt' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <h3 className="text-base font-bold text-slate-850">재단(VT) 작업 명세</h3>
                  <span className="text-xs text-purple-500 font-bold bg-purple-50 px-2 py-0.5 rounded">Formula (대형 이중소켓): 내부 W/2-15, H/2-20 / 외부 상하 W+60, 좌우 H</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs text-center">
                        <th className="px-2 py-3 border border-slate-200 w-12" rowSpan={2}>No</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>구조</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>수주 W</th>
                        <th className="px-2 py-3 border border-slate-200 w-20" rowSpan={2}>수주 H</th>
                        <th className="px-2 py-3 border border-slate-200 w-28" rowSpan={2}>소켓 LOT</th>
                        <th className="px-2 py-3 border border-slate-200 w-14" rowSpan={2}>수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/30 text-purple-700" colSpan={4}>소켓내부용 재단치수 (mm)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/30 text-emerald-700" colSpan={4}>외부용 재단치수 (mm)</th>
                        <th className="px-2 py-3 border border-slate-200" rowSpan={2}>작업비고</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] text-center">
                        <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/10 text-purple-600">가로(W/2-15)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/10 text-purple-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/10 text-purple-600">세로(H/2-20)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-purple-50/10 text-purple-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">상하(W+60)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">수량</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">좌우(H)</th>
                        <th className="px-2 py-1.5 border border-slate-200 bg-emerald-50/10 text-emerald-600">수량</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-center font-mono divide-y divide-slate-100">
                      {sheets.vtCutting.map(row => (
                        <tr key={row.no} className="hover:bg-slate-50/50">
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-400">{row.no}</td>
                          <td className="px-2 py-2.5 border border-slate-200 font-bold text-purple-600">{row.structure}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right">{row.w}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right">{row.h}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-left text-[10px] text-slate-500">{row.socket_lot}</td>
                          <td className="px-2 py-2.5 border border-slate-200 font-bold text-slate-800">{row.qty}</td>
                          {/* 내부재단 */}
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-purple-50/5 font-bold text-purple-600">{row.inner_w}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-purple-50/5">{row.inner_w_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-purple-50/5 font-bold text-purple-600">{row.inner_h}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-purple-50/5">{row.inner_h_qty}</td>
                          {/* 외부재단 */}
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-emerald-50/5 font-bold text-emerald-600">{row.outer_tb}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-emerald-50/5">{row.outer_tb_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-right bg-emerald-50/5 font-bold text-emerald-600">{row.outer_lr}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-slate-500 bg-emerald-50/5">{row.outer_lr_qty}</td>
                          <td className="px-2 py-2.5 border border-slate-200 text-left font-sans text-[10px] text-slate-500">{row.remarks}</td>
                        </tr>
                      ))}
                      {sheets.vtCutting.length === 0 && (
                        <tr><td colSpan={15} className="py-8 text-slate-400 text-center">해당 현장의 이중소켓(VT) 재단 품목이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 탭 4: 차열재 재단 */}
            {activeTab === 'ceramic' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <h3 className="text-base font-bold text-slate-850">차열재 재단(VM,VT) 명세</h3>
                  <span className="text-xs text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded">Formula: 세라믹울 차열재 정밀재단 공식 적용</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs text-center">
                        <th className="px-4 py-3 border border-slate-200 w-12" rowSpan={2}>No</th>
                        <th className="px-4 py-3 border border-slate-200 w-28" rowSpan={2}>구조코드</th>
                        <th className="px-4 py-3 border border-slate-200 w-24 text-right" rowSpan={2}>수주 W (mm)</th>
                        <th className="px-4 py-3 border border-slate-200 w-24 text-right" rowSpan={2}>수주 H (mm)</th>
                        <th className="px-4 py-3 border border-slate-200 w-32" rowSpan={2}>차열재 LOT</th>
                        <th className="px-4 py-3 border border-slate-200 w-20" rowSpan={2}>수주수량</th>
                        <th className="px-4 py-1.5 border border-slate-200 bg-amber-50/30 text-amber-700" colSpan={4}>차열재 세부 재단 사양</th>
                        <th className="px-4 py-3 border border-slate-200" rowSpan={2}>작업특기사항</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] text-center">
                        <th className="px-4 py-1.5 border border-slate-200 bg-amber-50/10 text-amber-600">상하 (W+60)</th>
                        <th className="px-4 py-1.5 border border-slate-200 bg-amber-50/10 text-amber-600">수량</th>
                        <th className="px-4 py-1.5 border border-slate-200 bg-amber-50/10 text-amber-600">좌우 (H)</th>
                        <th className="px-4 py-1.5 border border-slate-200 bg-amber-50/10 text-amber-600">수량</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-center font-mono divide-y divide-slate-100">
                      {sheets.ceramicCutting.map(row => (
                        <tr key={row.no} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-400">{row.no}</td>
                          <td className="px-4 py-2.5 border border-slate-200 font-bold text-amber-600">{row.structure}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-right">{row.w.toLocaleString()}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-right">{row.h.toLocaleString()}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-left text-[10px] text-slate-500 font-mono">{row.socket_lot}</td>
                          <td className="px-4 py-2.5 border border-slate-200 font-bold text-slate-800">{row.qty}</td>
                          {/* 차열재 재단 */}
                          <td className="px-4 py-2.5 border border-slate-200 text-right bg-amber-50/5 font-bold text-amber-600">{row.outer_tb}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-500 bg-amber-50/5">{row.outer_tb_qty}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-right bg-amber-50/5 font-bold text-amber-600">{row.outer_lr}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-slate-500 bg-amber-50/5">{row.outer_lr_qty}</td>
                          <td className="px-4 py-2.5 border border-slate-200 text-left font-sans text-[10px] text-slate-500">{row.remarks}</td>
                        </tr>
                      ))}
                      {sheets.ceramicCutting.length === 0 && (
                        <tr><td colSpan={11} className="py-8 text-slate-400 text-center">차열재 품목이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 font-semibold">작업 데이터를 전개할 현장을 선택해 주세요.</div>
        )}
      </div>

      {/* ─── 인쇄 모드 미리보기 모달 ─── */}
      {showPrintModal && sheets && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 overflow-y-auto p-4 sm:p-10 no-print">
          <div className="max-w-[1000px] mx-auto w-full mb-6 bg-slate-800 rounded-xl p-4 flex items-center justify-between border border-slate-700 shadow-xl">
            <div className="text-white flex flex-col">
              <span className="font-bold text-base">작업지시서 인쇄 미리보기</span>
              <span className="text-xs text-slate-400 font-medium">현장명: {selectedProjectName}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Printer className="h-4 w-4" />
                인쇄하기
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold text-xs rounded-lg transition-colors border border-slate-600"
              >
                <X className="h-4 w-4" />
                닫기
              </button>
            </div>
          </div>

          <div className="max-w-[1000px] mx-auto w-full space-y-12 bg-slate-950/20 p-2 print:p-0 print:space-y-0">
            {/* Sheet 1: 소켓인수검사 */}
            <div className="bg-white p-10 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 min-h-[1050px] flex flex-col justify-between text-slate-800 font-sans print:page-break-after">
              <div>
                <div className="text-center mb-8 border-b-2 border-slate-800 pb-3">
                  <h2 className="text-2xl font-extrabold tracking-widest text-slate-900">소켓 인수 검사 시트 (현장용)</h2>
                  <div className="text-xs text-slate-500 font-mono mt-1">Project Name: {selectedProjectName}</div>
                </div>
                <table className="w-full text-xs text-center border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 font-bold border border-slate-800">
                      <th className="px-2 py-2 border border-slate-800 w-12">No</th>
                      <th className="px-2 py-2 border border-slate-800">구조코드</th>
                      <th className="px-2 py-2 border border-slate-800 text-right w-24">수주 W</th>
                      <th className="px-2 py-2 border border-slate-800 text-right w-24">수주 H</th>
                      <th className="px-2 py-2 border border-slate-800">분할구조 사양</th>
                      <th className="px-2 py-2 border border-slate-800 w-24">재고보유</th>
                      <th className="px-2 py-2 border border-slate-800 w-28">설치위치</th>
                      <th className="px-2 py-2 border border-slate-800">검사서명</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {sheets.socketInspection.map(row => (
                      <tr key={row.no} className="h-9">
                        <td className="px-2 py-1.5 border border-slate-800 text-center">{row.no}</td>
                        <td className="px-2 py-1.5 border border-slate-800 font-bold text-left pl-3">{row.structure}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right font-bold">{row.w}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right font-bold">{row.h}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-left font-sans pl-2">{row.split_structure || '통구조'}</td>
                        <td className="px-2 py-1.5 border border-slate-800 font-sans font-bold">{row.stock_status}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-left font-sans pl-2">{row.install_pos}</td>
                        <td className="px-2 py-1.5 border border-slate-800 font-sans text-slate-300">합격 / (인)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-400 text-right">EZONE MES Smart Factory - 소켓 인수검사 성적서</div>
            </div>

            {/* Sheet 2: VM재단 */}
            <div className="bg-white p-10 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 min-h-[1050px] flex flex-col justify-between text-slate-800 font-sans print:page-break-after">
              <div>
                <div className="text-center mb-8 border-b-2 border-slate-800 pb-3">
                  <h2 className="text-2xl font-extrabold tracking-widest text-slate-900">소켓 절단(VM재단) 작업지시서</h2>
                  <div className="text-xs text-slate-500 font-mono mt-1">Project Name: {selectedProjectName}</div>
                </div>
                <table className="w-full text-xs text-center border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 font-bold border border-slate-800">
                      <th className="px-1.5 py-2 border border-slate-800 w-10" rowSpan={2}>No</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>구조</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>수주W</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>수주H</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-24" rowSpan={2}>소켓 LOT</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-10" rowSpan={2}>수량</th>
                      <th className="px-1.5 py-1 border border-slate-800" colSpan={4}>소켓내부용 재단치수 (mm)</th>
                      <th className="px-1.5 py-1 border border-slate-800" colSpan={4}>외부용 재단치수 (mm)</th>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-[10px] border border-slate-800">
                      <th className="px-1.5 py-1 border border-slate-800">가로(W-5)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">세로(H-30)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">상하(W+60)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">좌우(H)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {sheets.vmCutting.map(row => (
                      <tr key={row.no} className="h-9">
                        <td className="px-1.5 py-1 border border-slate-800">{row.no}</td>
                        <td className="px-1.5 py-1 border border-slate-800 font-bold">{row.structure}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right">{row.w}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right">{row.h}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-left text-[9px]">{row.socket_lot}</td>
                        <td className="px-1.5 py-1 border border-slate-800 font-bold">{row.qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-blue-700 bg-slate-50">{row.inner_w}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.inner_w_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-blue-700 bg-slate-50">{row.inner_h}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.inner_h_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-emerald-700 bg-slate-50">{row.outer_tb}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_tb_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-emerald-700 bg-slate-50">{row.outer_lr}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_lr_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-400 text-right">EZONE MES Smart Factory - VM 재단지시서</div>
            </div>

            {/* Sheet 3: VT재단 */}
            <div className="bg-white p-10 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 min-h-[1050px] flex flex-col justify-between text-slate-800 font-sans print:page-break-after">
              <div>
                <div className="text-center mb-8 border-b-2 border-slate-800 pb-3">
                  <h2 className="text-2xl font-extrabold tracking-widest text-slate-900">소켓 절단(VT재단) 작업지시서</h2>
                  <div className="text-xs text-slate-500 font-mono mt-1">Project Name: {selectedProjectName}</div>
                </div>
                <table className="w-full text-xs text-center border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 font-bold border border-slate-800">
                      <th className="px-1.5 py-2 border border-slate-800 w-10" rowSpan={2}>No</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>구조</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>수주W</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-16" rowSpan={2}>수주H</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-24" rowSpan={2}>소켓 LOT</th>
                      <th className="px-1.5 py-2 border border-slate-800 w-10" rowSpan={2}>수량</th>
                      <th className="px-1.5 py-1 border border-slate-800" colSpan={4}>소켓내부용 재단치수 (mm)</th>
                      <th className="px-1.5 py-1 border border-slate-800" colSpan={4}>외부용 재단치수 (mm)</th>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-[10px] border border-slate-800">
                      <th className="px-1.5 py-1 border border-slate-800">가로(W/2-15)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">세로(H/2-20)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">상하(W+60)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                      <th className="px-1.5 py-1 border border-slate-800">좌우(H)</th>
                      <th className="px-1.5 py-1 border border-slate-800">수량</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {sheets.vtCutting.map(row => (
                      <tr key={row.no} className="h-9">
                        <td className="px-1.5 py-1 border border-slate-800">{row.no}</td>
                        <td className="px-1.5 py-1 border border-slate-800 font-bold">{row.structure}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right">{row.w}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right">{row.h}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-left text-[9px]">{row.socket_lot}</td>
                        <td className="px-1.5 py-1 border border-slate-800 font-bold">{row.qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-purple-700 bg-slate-50">{row.inner_w}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.inner_w_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-purple-700 bg-slate-50">{row.inner_h}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.inner_h_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-emerald-700 bg-slate-50">{row.outer_tb}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_tb_qty}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-right font-bold text-emerald-700 bg-slate-50">{row.outer_lr}</td>
                        <td className="px-1.5 py-1 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_lr_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-400 text-right">EZONE MES Smart Factory - VT 재단지시서</div>
            </div>

            {/* Sheet 4: 차열재재단 */}
            <div className="bg-white p-10 border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 min-h-[1050px] flex flex-col justify-between text-slate-800 font-sans">
              <div>
                <div className="text-center mb-8 border-b-2 border-slate-800 pb-3">
                  <h2 className="text-2xl font-extrabold tracking-widest text-slate-900">세라믹 차열재 정밀재단 지시서</h2>
                  <div className="text-xs text-slate-500 font-mono mt-1">Project Name: {selectedProjectName}</div>
                </div>
                <table className="w-full text-xs text-center border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 font-bold border border-slate-800">
                      <th className="px-2 py-2 border border-slate-800 w-12" rowSpan={2}>No</th>
                      <th className="px-2 py-2 border border-slate-800 w-24" rowSpan={2}>구조코드</th>
                      <th className="px-2 py-2 border border-slate-800 w-20 text-right" rowSpan={2}>수주 W</th>
                      <th className="px-2 py-2 border border-slate-800 w-20 text-right" rowSpan={2}>수주 H</th>
                      <th className="px-2 py-2 border border-slate-800 w-28" rowSpan={2}>차열재 LOT</th>
                      <th className="px-2 py-2 border border-slate-800 w-16" rowSpan={2}>수량</th>
                      <th className="px-2 py-1.5 border border-slate-800" colSpan={4}>차열재 정밀재단 규격</th>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-[10px] border border-slate-800">
                      <th className="px-2 py-1.5 border border-slate-800">상하 (W+60)</th>
                      <th className="px-2 py-1.5 border border-slate-800">수량</th>
                      <th className="px-2 py-1.5 border border-slate-800">좌우 (H)</th>
                      <th className="px-2 py-1.5 border border-slate-800">수량</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {sheets.ceramicCutting.map(row => (
                      <tr key={row.no} className="h-9">
                        <td className="px-2 py-1.5 border border-slate-800">{row.no}</td>
                        <td className="px-2 py-1.5 border border-slate-800 font-bold text-left pl-3">{row.structure}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right">{row.w}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right">{row.h}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-left text-[10px]">{row.socket_lot}</td>
                        <td className="px-2 py-1.5 border border-slate-800 font-bold">{row.qty}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right font-bold text-amber-700 bg-slate-50">{row.outer_tb}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_tb_qty}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-right font-bold text-amber-700 bg-slate-50">{row.outer_lr}</td>
                        <td className="px-2 py-1.5 border border-slate-800 text-slate-400 bg-slate-50">{row.outer_lr_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-400 text-right">EZONE MES Smart Factory - 차열재 재단지시서</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 신규 프로젝트 등록 단축 모달 (Quick Project Dialog) ─── */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[3px]" onClick={() => setIsQuickModalOpen(false)}>
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-850">
                  단축 프로젝트 등록
                </h3>
              </div>
              <button onClick={() => setIsQuickModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">프로젝트 코드 *</label>
                  <input
                    type="text"
                    value={quickFormData.project_code}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, project_code: e.target.value }))}
                    placeholder="자동 생성 코드"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none text-slate-800 font-bold shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">현장명 (프로젝트명) *</label>
                  <input
                    type="text"
                    required
                    value={quickFormData.project_name}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, project_name: e.target.value }))}
                    placeholder="예: 경기 스마트밸리 공사"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-extrabold focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">거래처 (발주처명)</label>
                  <input
                    type="text"
                    value={quickFormData.customer_name}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="예: 현대건설㈜"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">유통업체 선택</label>
                  <select
                    value={quickFormData.distributor_id}
                    onChange={(e) => handleQuickDistributorChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:border-blue-500 outline-none bg-white font-bold text-slate-700 shadow-sm"
                  >
                    <option value="">유통업체 없음</option>
                    {distributors.map(d => (
                      <option key={d.company_id} value={d.company_id}>{d.company_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 유통사 정보 즉시 매핑 */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  유통업체 자동 매핑 항목 (Auto-fill)
                </span>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">대표자명</label>
                    <input
                      type="text"
                      value={quickFormData.ceo_name}
                      onChange={(e) => setQuickFormData(prev => ({ ...prev, ceo_name: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-semibold bg-gray-50 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">연락처</label>
                    <input
                      type="text"
                      value={quickFormData.phone}
                      onChange={(e) => setQuickFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono bg-gray-50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-0.5">법인등록번호</label>
                  <input
                    type="text"
                    value={quickFormData.corporate_no}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, corporate_no: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 border-t border-slate-100 pt-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">최초수주일자</label>
                  <input
                    type="date"
                    value={quickFormData.order_date}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, order_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">최종납기기한</label>
                  <input
                    type="date"
                    value={quickFormData.delivery_date}
                    onChange={(e) => setQuickFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <button 
                onClick={() => setIsQuickModalOpen(false)} 
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 font-semibold hover:bg-slate-50 text-slate-600 transition-colors bg-white shadow-sm"
              >
                취소
              </button>
              <button
                onClick={handleQuickProjectSave}
                className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-bold shadow hover:shadow-md transition-all"
              >
                <Save className="h-4 w-4" />
                즉시 등록 및 선택
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
