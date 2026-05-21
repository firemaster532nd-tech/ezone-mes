import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { 
  Search, X, Plus, Pencil, Trash2, FolderGit2, 
  Calendar, FileText, Building2, ClipboardList, CheckCircle,
  Phone, User, ShieldAlert, Award, Clock, ChevronDown, ChevronUp
} from 'lucide-react';

interface DeliverySchedule {
  schedule_id?: number;
  project_id?: number;
  delivery_date: string;
  delivery_qty: number;
  remarks: string;
  seq: number;
}

interface Project {
  project_id: number;
  project_code: string;
  project_name: string;
  customer_name: string | null;
  order_date: string;
  delivery_date: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';
  remarks: string | null;
  order_count: number;
  total_qty: number;
  
  // 신규 매핑 정보
  distributor_id: number | null;
  distributor_name: string | null;
  phone: string | null;
  ceo_name: string | null;
  corporate_no: string | null;
  deliveries?: DeliverySchedule[];
}

interface Distributor {
  company_id: number;
  company_name: string;
  ceo_name: string | null;
  phone: string | null;
  corporate_no: string | null;
}

export function ProjectPage() {
  const [data, setData] = useState<Project[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // 하단 디테일 스케줄 확장 상태
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
  const [expandedSchedules, setExpandedSchedules] = useState<DeliverySchedule[]>([]);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [formData, setFormData] = useState({
    project_code: '',
    project_name: '',
    customer_name: '',
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED' | 'SUSPENDED',
    remarks: '',
    
    // 신규 매핑 정보
    distributor_id: '' as number | '',
    phone: '',
    ceo_name: '',
    corporate_no: '',
    deliveries: [] as DeliverySchedule[],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await api.get<{ data: Project[] }>(`/projects?${params.toString()}`);
      setData(res.data.data);
    } catch (e: any) {
      toast.error('프로젝트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchData();
    fetchDistributors();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // 특정 프로젝트의 1:N 순차적 스케줄 상세 확장
  const handleToggleExpand = async (projId: number) => {
    if (expandedProjectId === projId) {
      setExpandedProjectId(null);
      setExpandedSchedules([]);
      return;
    }
    
    try {
      const res = await api.get<{ data: any }>(`/projects/${projId}`);
      setExpandedProjectId(projId);
      setExpandedSchedules(res.data.data.deliveries || []);
    } catch (err) {
      toast.error('납기 스케줄 정보를 불러오지 못했습니다.');
    }
  };

  // 모달 열기 (신규 / 수정)
  const handleOpenModal = async (project?: Project) => {
    if (project) {
      setEditingProject(project);
      try {
        const res = await api.get<{ data: any }>(`/projects/${project.project_id}`);
        const fullProj = res.data.data;
        setFormData({
          project_code: fullProj.project_code,
          project_name: fullProj.project_name,
          customer_name: fullProj.customer_name || '',
          order_date: fullProj.order_date,
          delivery_date: fullProj.delivery_date || '',
          status: fullProj.status,
          remarks: fullProj.remarks || '',
          distributor_id: fullProj.distributor_id || '',
          phone: fullProj.phone || '',
          ceo_name: fullProj.ceo_name || '',
          corporate_no: fullProj.corporate_no || '',
          deliveries: fullProj.deliveries || [],
        });
      } catch (err) {
        toast.error('프로젝트 상세 로딩 실패');
      }
    } else {
      setEditingProject(null);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2);
      const rand = Math.floor(100 + Math.random() * 900);
      setFormData({
        project_code: `PJ-${dateStr}-${rand}`,
        project_name: '',
        customer_name: '',
        order_date: new Date().toISOString().slice(0, 10),
        delivery_date: '',
        status: 'ACTIVE',
        remarks: '',
        distributor_id: '',
        phone: '',
        ceo_name: '',
        corporate_no: '',
        deliveries: [],
      });
    }
    setIsModalOpen(true);
  };

  // 유통업체 선택 시 자동 입력 매핑 (Auto-fill)
  const handleDistributorChange = (distIdStr: string) => {
    if (!distIdStr) {
      setFormData(prev => ({
        ...prev,
        distributor_id: '',
        phone: '',
        ceo_name: '',
        corporate_no: '',
      }));
      return;
    }
    
    const distId = parseInt(distIdStr, 10);
    const selected = distributors.find(d => d.company_id === distId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        distributor_id: distId,
        ceo_name: selected.ceo_name || '',
        phone: selected.phone || '',
        corporate_no: selected.corporate_no || '',
      }));
      toast.success(`${selected.company_name} 유통업체 정보가 연동되었습니다.`);
    }
  };

  // 순차적 납기 일정 추가/삭제/수정
  const handleAddDelivery = () => {
    setFormData(prev => {
      const nextSeq = prev.deliveries.length + 1;
      return {
        ...prev,
        deliveries: [
          ...prev.deliveries,
          { seq: nextSeq, delivery_date: new Date().toISOString().slice(0, 10), delivery_qty: 0, remarks: '' }
        ]
      };
    });
  };

  const handleRemoveDelivery = (idx: number) => {
    setFormData(prev => {
      const updated = prev.deliveries.filter((_, i) => i !== idx);
      const reordered = updated.map((d, i) => ({ ...d, seq: i + 1 }));
      return { ...prev, deliveries: reordered };
    });
  };

  const handleDeliveryFieldChange = (idx: number, field: keyof DeliverySchedule, val: any) => {
    setFormData(prev => {
      const updated = [...prev.deliveries];
      updated[idx] = {
        ...updated[idx],
        [field]: val
      };
      return { ...prev, deliveries: updated };
    });
  };

  // 프로젝트 저장 (C / U)
  const handleSave = async () => {
    if (!formData.project_code.trim()) {
      toast.error('프로젝트 코드는 필수입니다.');
      return;
    }
    if (!formData.project_name.trim()) {
      toast.error('현장명은 필수입니다.');
      return;
    }

    // 유통업체 값 안전 파싱
    const payload = {
      ...formData,
      distributor_id: formData.distributor_id === '' ? null : formData.distributor_id,
    };

    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject.project_id}`, payload);
        toast.success('프로젝트가 수정되었습니다.');
      } else {
        await api.post('/projects', payload);
        toast.success('프로젝트가 신규 등록되었습니다.');
      }
      setIsModalOpen(false);
      fetchData();
      if (expandedProjectId) {
        setExpandedProjectId(null);
        setExpandedSchedules([]);
      }
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '프로젝트 저장에 실패했습니다.');
    }
  };

  // 프로젝트 삭제 (D)
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`현장 프로젝트 [${name}]를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('프로젝트가 삭제되었습니다.');
      fetchData();
      if (expandedProjectId === id) {
        setExpandedProjectId(null);
        setExpandedSchedules([]);
      }
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-1">
      <PageHeader 
        title="현장 프로젝트 등록/관리" 
        count={data.length} 
        description="최초 납기일정부터 회차별 순차적 스케줄 정렬, 유통업체 마스터 실시간 Auto-fill 연동 제어" 
      />

      {/* 필터 검색 섹션 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">검색어</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="프로젝트코드, 현장명, 거래처(발주처)명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">진행 구분</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-slate-700 font-semibold"
            >
              <option value="">전체 프로젝트</option>
              <option value="ACTIVE">진행중 (ACTIVE)</option>
              <option value="COMPLETED">완료됨 (COMPLETED)</option>
              <option value="SUSPENDED">보류됨 (SUSPENDED)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 transition-all shadow-sm"
            >
              조회
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setTimeout(fetchData, 10);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              초기화
            </button>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-500 hover:shadow transition-all"
            >
              <Plus className="h-4 w-4" />
              신규 프로젝트 등록
            </button>
          </div>
        </form>
      </div>

      {/* 리스트 그리드 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                <th className="px-5 py-4 text-center w-12">No</th>
                <th className="px-5 py-4">프로젝트코드</th>
                <th className="px-5 py-4">현장명 (프로젝트)</th>
                <th className="px-5 py-4">거래처 (발주처)</th>
                <th className="px-5 py-4">유통업체</th>
                <th className="px-5 py-4">유통 대표자</th>
                <th className="px-5 py-4">유통 연락처</th>
                <th className="px-5 py-4">유통 법인등록번호</th>
                <th className="px-5 py-4 text-center">연동수주</th>
                <th className="px-5 py-4 text-center">진행상태</th>
                <th className="px-5 py-4 text-center w-36">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((p, idx) => (
                <>
                  <tr 
                    key={p.project_id} 
                    className={cn(
                      "hover:bg-slate-50/70 transition-colors group cursor-pointer",
                      expandedProjectId === p.project_id && "bg-blue-50/20"
                    )}
                    onClick={() => handleToggleExpand(p.project_id)}
                  >
                    <td className="px-5 py-4 text-center font-mono text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">
                      {p.project_code}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      <div className="flex items-center gap-1.5">
                        {p.project_name}
                        {expandedProjectId === p.project_id ? (
                          <ChevronUp className="h-4 w-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">{p.customer_name || '-'}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {p.distributor_name ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-200/50">
                          {p.distributor_name}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{p.ceo_name || '-'}</td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">{p.phone || '-'}</td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">{p.corporate_no || '-'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm",
                        p.order_count > 0 ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-700/10" : "bg-slate-100 text-slate-400"
                      )}>
                        {p.order_count}건
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm border",
                        p.status === 'ACTIVE' && "bg-blue-50 text-blue-700 border-blue-200/50",
                        p.status === 'COMPLETED' && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                        p.status === 'SUSPENDED' && "bg-amber-50 text-amber-700 border-amber-200/50"
                      )}>
                        {p.status === 'ACTIVE' ? '진행중' : p.status === 'COMPLETED' ? '완료됨' : '보류됨'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenModal(p)}
                          className="rounded-lg bg-gray-50 hover:bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-all border border-slate-200 hover:border-blue-200"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(p.project_id, p.project_name)}
                          className="rounded-lg bg-gray-50 hover:bg-red-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-red-600 transition-all border border-slate-200 hover:border-red-200"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* 확장된 순차적 납기 스케줄 타임라인 판 */}
                  {expandedProjectId === p.project_id && (
                    <tr onClick={(e) => e.stopPropagation()} className="bg-slate-50/50">
                      <td colSpan={11} className="px-8 py-5 border-l-4 border-blue-500">
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                              <Clock className="h-4.5 w-4.5 text-blue-600" />
                              순차적 납기 기한 스케줄 (최초 납기일로부터 순차 정렬)
                            </h4>
                            <span className="text-xs font-bold text-slate-400">
                              * 프로젝트 내 설정된 회차 순서대로 자동 배치됩니다.
                            </span>
                          </div>

                          {expandedSchedules.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 bg-white rounded-lg border border-slate-100 font-medium">
                              등록된 순차적 납기 일정이 존재하지 않습니다. 프로젝트 수정을 통해 등록하세요.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                              {expandedSchedules.map((sch, sIdx) => (
                                <div key={sIdx} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                  <div className="absolute right-0 top-0 bg-blue-600 text-white font-mono text-xs font-black px-2.5 py-0.5 rounded-bl">
                                    {sch.seq}회차
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                      납기지정일자
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-800 font-mono">
                                      {sch.delivery_date}
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 mt-2.5">
                                      납품 예정 수량
                                    </div>
                                    <div className="text-sm font-extrabold text-blue-600">
                                      {Number(sch.delivery_qty).toLocaleString()} 매
                                    </div>
                                    {sch.remarks && (
                                      <div className="text-xs text-slate-500 bg-slate-50 p-1.5 rounded mt-2 border border-slate-100 font-medium">
                                        비고: {sch.remarks}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-slate-400">
                    <FolderGit2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    등록된 현장 프로젝트가 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 및 수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[3px]" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-extrabold text-slate-850 flex items-center gap-2">
                <FolderGit2 className="h-5 w-5 text-blue-600" />
                {editingProject ? '프로젝트 정보 수정' : '신규 현장 프로젝트 등록'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">프로젝트 코드 *</label>
                  <input
                    type="text"
                    value={formData.project_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_code: e.target.value }))}
                    disabled={!!editingProject}
                    placeholder="예: PJ-260521-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none disabled:bg-slate-100 text-slate-800 font-bold shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">현장명 (프로젝트명) *</label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_name: e.target.value }))}
                    placeholder="예: 김포 물류센터 신축공사"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-extrabold focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">거래처 (발주처명)</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="예: 현대건설㈜"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">진행상태</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none bg-white font-semibold text-slate-700 shadow-sm"
                  >
                    <option value="ACTIVE">진행중 (ACTIVE)</option>
                    <option value="COMPLETED">완료됨 (COMPLETED)</option>
                    <option value="SUSPENDED">보류됨 (SUSPENDED)</option>
                  </select>
                </div>
              </div>

              {/* 유통업체 정보 마스터 연계 (Auto-fill 영역) */}
              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  유통업체 마스터 정보 연동 (Auto-fill)
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">유통업체 선택</label>
                    <select
                      value={formData.distributor_id}
                      onChange={(e) => handleDistributorChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none bg-white font-bold text-slate-700 shadow-sm"
                    >
                      <option value="">유통업체 없음</option>
                      {distributors.map(d => (
                        <option key={d.company_id} value={d.company_id}>{d.company_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">대표자명</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={formData.ceo_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, ceo_name: e.target.value }))}
                        placeholder="자동 연동입력 또는 직접 기재"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none text-slate-800 font-semibold bg-gray-50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">연락처</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="자동 연동입력 또는 직접 기재"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none text-slate-850 font-mono text-xs bg-gray-50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">법인등록번호</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={formData.corporate_no}
                        onChange={(e) => setFormData(prev => ({ ...prev, corporate_no: e.target.value }))}
                        placeholder="자동 연동입력 또는 직접 기재"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none text-slate-850 font-mono text-xs bg-gray-50 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">프로젝트 최초수주일자</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">최종 납기일자 (대조군)</label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:border-blue-500 outline-none shadow-sm"
                  />
                </div>
              </div>

              {/* 순차적 납기 일정 관리 동적 그리드 */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    회차별 순차적 납기 스케줄 테이블
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddDelivery}
                    className="flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 text-xs font-black transition-all border border-indigo-200/50 shadow-inner"
                  >
                    <Plus className="h-3 w-3" />
                    일정 추가
                  </button>
                </div>

                {formData.deliveries.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 border border-dashed border-slate-200 rounded-lg font-medium">
                    등록된 납기 회차가 없습니다. 상단 '일정 추가'로 최초/순차 납기를 지정해 주세요.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                    <table className="w-full text-xs text-left border-collapse bg-slate-50/50">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 font-bold text-slate-500">
                          <th className="px-3 py-2.5 text-center w-12">회차</th>
                          <th className="px-3 py-2.5">납기지정일자 *</th>
                          <th className="px-3 py-2.5">수량 (매) *</th>
                          <th className="px-3 py-2.5">비고 참고</th>
                          <th className="px-3 py-2.5 text-center w-12">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {formData.deliveries.map((del, dIdx) => (
                          <tr key={dIdx} className="hover:bg-slate-50/30">
                            <td className="px-3 py-2 text-center font-bold text-slate-400 font-mono">
                              {del.seq}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                required
                                value={del.delivery_date}
                                onChange={(e) => handleDeliveryFieldChange(dIdx, 'delivery_date', e.target.value)}
                                className="w-full border border-slate-200 rounded px-2 py-1 font-mono outline-none focus:border-blue-500 shadow-sm"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                required
                                min={0}
                                value={del.delivery_qty}
                                onChange={(e) => handleDeliveryFieldChange(dIdx, 'delivery_qty', parseInt(e.target.value, 10) || 0)}
                                className="w-full border border-slate-200 rounded px-2 py-1 font-bold font-mono outline-none focus:border-blue-500 shadow-sm"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={del.remarks}
                                onChange={(e) => handleDeliveryFieldChange(dIdx, 'remarks', e.target.value)}
                                placeholder="특이사항"
                                className="w-full border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 shadow-sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveDelivery(dIdx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">비고 / 참고사항</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  placeholder="현장 특이사항이나 통합 도면 관리 관련 참고 정보를 기록하세요."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none resize-none shadow-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4.5 border-t border-slate-200 bg-slate-50/50">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 font-semibold hover:bg-slate-50 text-slate-600 transition-colors bg-white shadow-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-bold shadow hover:shadow-md transition-all"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
