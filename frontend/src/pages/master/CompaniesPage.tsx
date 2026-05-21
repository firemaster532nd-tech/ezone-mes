import { useState, useEffect } from 'react';
import { 
  Building2, Search, Plus, X, Save, 
  ToggleLeft, ToggleRight, FileSpreadsheet, CheckCircle2,
  HelpCircle, MapPin, Globe, CreditCard, ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
  ceo_name: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  business_type: string | null;
  business_item: string | null;
  company_type: 'CUSTOMER' | 'VENDOR' | 'BOTH' | 'DISTRIBUTOR';
  is_active: boolean;
  remarks: string | null;
  created_at: string;
  
  // E-Count ERP 신규 거래처정보 연동 필드
  corporate_no: string | null;
  code_type: 'BUSINESS_NO' | 'NON_BUSINESS_DOMESTIC' | 'NON_BUSINESS_FOREIGN';
  tax_reporting_type: 'SAME_AS_CODE' | 'SEARCH' | 'DIRECT';
  tax_reporting_code: string | null;
  sub_biz_no: string | null;
  zipcode1: string | null;
  address1: string | null;
  zipcode2: string | null;
  address2: string | null;
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // CUSTOMER, VENDOR, BOTH, DISTRIBUTOR
  const [activeFilter, setActiveFilter] = useState('true'); // true, false, all
  const [loading, setLoading] = useState(false);

  // 모달 상태 및 탭 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'biz_info' | 'credit' | 'extra'>('basic');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    company_code: '',
    company_name: '',
    ceo_name: '',
    phone: '',
    mobile: '',
    fax: '',
    email: '',
    address: '',
    business_type: '',
    business_item: '',
    company_type: 'CUSTOMER' as 'CUSTOMER' | 'VENDOR' | 'BOTH' | 'DISTRIBUTOR',
    is_active: true,
    remarks: '',
    
    // 신규 필드
    corporate_no: '',
    code_type: 'BUSINESS_NO' as 'BUSINESS_NO' | 'NON_BUSINESS_DOMESTIC' | 'NON_BUSINESS_FOREIGN',
    tax_reporting_type: 'SAME_AS_CODE' as 'SAME_AS_CODE' | 'SEARCH' | 'DIRECT',
    tax_reporting_code: '',
    sub_biz_no: '',
    zipcode1: '',
    address1: '',
    zipcode2: '',
    address2: '',
  });

  // Daum 우편번호 스크립트 동적 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const openDaumPostcode = (type: 1 | 2) => {
    if (!(window as any).daum || !(window as any).daum.Postcode) {
      toast.error('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        if (type === 1) {
          setFormData(prev => ({
            ...prev,
            zipcode1: data.zonecode,
            address1: data.roadAddress || data.address
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            zipcode2: data.zonecode,
            address2: data.roadAddress || data.address
          }));
        }
      }
    }).open();
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const activeParam = activeFilter === 'all' ? '' : activeFilter;
      const res = await api.get<{ data: Company[] }>(
        `/companies?search=${encodeURIComponent(search)}&type=${typeFilter}&active=${activeParam}`
      );
      setCompanies(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('거래처 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [typeFilter, activeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies();
  };

  const handleOpenModal = (company?: Company) => {
    setActiveTab('basic');
    if (company) {
      setEditingId(company.company_id);
      setFormData({
        company_code: company.company_code,
        company_name: company.company_name,
        ceo_name: company.ceo_name || '',
        phone: company.phone || '',
        mobile: company.mobile || '',
        fax: company.fax || '',
        email: company.email || '',
        address: company.address || '',
        business_type: company.business_type || '',
        business_item: company.business_item || '',
        company_type: company.company_type,
        is_active: company.is_active,
        remarks: company.remarks || '',
        corporate_no: company.corporate_no || '',
        code_type: company.code_type || 'BUSINESS_NO',
        tax_reporting_type: company.tax_reporting_type || 'SAME_AS_CODE',
        tax_reporting_code: company.tax_reporting_code || '',
        sub_biz_no: company.sub_biz_no || '',
        zipcode1: company.zipcode1 || '',
        address1: company.address1 || '',
        zipcode2: company.zipcode2 || '',
        address2: company.address2 || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        company_code: '',
        company_name: '',
        ceo_name: '',
        phone: '',
        mobile: '',
        fax: '',
        email: '',
        address: '',
        business_type: '',
        business_item: '',
        company_type: 'CUSTOMER',
        is_active: true,
        remarks: '',
        corporate_no: '',
        code_type: 'BUSINESS_NO',
        tax_reporting_type: 'SAME_AS_CODE',
        tax_reporting_code: '',
        sub_biz_no: '',
        zipcode1: '',
        address1: '',
        zipcode2: '',
        address2: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_code.trim()) {
      return toast.warning('거래처코드(사업자등록번호)를 입력해 주세요.');
    }
    if (!formData.company_name.trim()) {
      return toast.warning('거래처명을 입력해 주세요.');
    }

    // 세무신고 거래처 동적 바인딩 로직 처리 (동일인 경우 company_code로 설정)
    const finalFormData = { ...formData };
    if (formData.tax_reporting_type === 'SAME_AS_CODE') {
      finalFormData.tax_reporting_code = formData.company_code;
    }

    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, finalFormData);
        toast.success('거래처 정보가 수정되었습니다.');
      } else {
        await api.post('/companies', finalFormData);
        toast.success('신규 거래처가 등록되었습니다.');
      }
      handleCloseModal();
      fetchCompanies();
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error('거래처 저장 중 오류가 발생했습니다.');
      }
    }
  };

  const handleToggleActive = async (company: Company) => {
    const nextActive = !company.is_active;
    try {
      await api.put(`/companies/${company.company_id}`, { is_active: nextActive });
      toast.success(`${company.company_name} 거래처가 ${nextActive ? '사용' : '사용중단'} 처리되었습니다.`);
      fetchCompanies();
    } catch (err) {
      console.error(err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // 엑셀 다운로드
  const handleExportExcel = () => {
    if (companies.length === 0) return toast.warning('다운로드할 거래처 데이터가 없습니다.');
    
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += '거래처코드,거래처명,대표자명,구분,전화,모바일,팩스,이메일,주소,업태,종목,사용여부,비고\n';
    
    companies.forEach(c => {
      const typeStr = 
        c.company_type === 'CUSTOMER' ? '매출처' : 
        c.company_type === 'VENDOR' ? '매입처' : 
        c.company_type === 'BOTH' ? '매출/매입처' : '유통업체';
      const activeStr = c.is_active ? '사용' : '중단';
      csvContent += `"${c.company_code}","${c.company_name}","${c.ceo_name || ''}","${typeStr}","${c.phone || ''}","${c.mobile || ''}","${c.fax || ''}","${c.address || ''}","${c.business_type || ''}","${c.business_item || ''}","${activeStr}","${c.remarks || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `EZONE_MES_거래처목록_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 bg-gray-50/50 min-h-screen">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-inner">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">거래처 등록/관리</h1>
            <p className="text-sm text-gray-500">영업, 유통 및 구매에 연동되는 거래처 마스터 정보를 관리합니다.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-all duration-150"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            엑셀 다운로드
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow-md transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            신규등록 (F2)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-1 min-w-[280px] items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 shadow-inner focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 focus-within:bg-white transition-all">
          <Search className="h-4.5 w-4.5 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="거래처코드, 거래처명, 대표자명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">거래 구분</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">전체 구분</option>
            <option value="CUSTOMER">매출처 (고객사)</option>
            <option value="VENDOR">매입처 (공급사)</option>
            <option value="BOTH">매출/매입 양쪽</option>
            <option value="DISTRIBUTOR">유통업체</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">사용 여부</span>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">전체 상태</option>
            <option value="true">사용 중</option>
            <option value="false">사용 중단</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 hover:shadow transition-all duration-150"
        >
          검색
        </button>
      </form>

      {/* Grid List Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-500 font-bold uppercase text-xs tracking-wider">
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">거래처코드 (사업자번호)</th>
                <th className="px-6 py-4">거래처명</th>
                <th className="px-6 py-4">대표자</th>
                <th className="px-6 py-4">구분</th>
                <th className="px-6 py-4">전화번호</th>
                <th className="px-6 py-4">모바일</th>
                <th className="px-6 py-4 text-center">사용구분</th>
                <th className="px-6 py-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>데이터를 불러오는 중입니다...</span>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 font-medium">
                    등록된 거래처가 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr key={company.company_id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{company.company_code}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {company.company_name}
                    </td>
                    <td className="px-6 py-4">{company.ceo_name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        company.company_type === 'CUSTOMER' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10' :
                        company.company_type === 'VENDOR' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10' :
                        company.company_type === 'BOTH' ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-700/10' :
                        'bg-orange-50 text-orange-700 ring-1 ring-orange-700/10'
                      }`}>
                        {company.company_type === 'CUSTOMER' ? '매출처' :
                         company.company_type === 'VENDOR' ? '매입처' :
                         company.company_type === 'BOTH' ? '매출/매입' : '유통업체'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{company.phone || '-'}</td>
                    <td className="px-6 py-4 text-gray-500">{company.mobile || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(company)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                          company.is_active 
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {company.is_active ? <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> : <X className="h-3.5 w-3.5 text-red-600" />}
                        {company.is_active ? 'YES' : 'NO'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleOpenModal(company)}
                        className="rounded-lg bg-gray-50 hover:bg-blue-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-blue-600 transition-all border border-gray-200 hover:border-blue-200"
                      >
                        상세/수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Register Dialog Modal (E-Count ERP Style) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[3px]">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200 transition-all animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/75 px-6 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-extrabold text-gray-900">
                  {editingId ? '거래처 정보 수정' : '거래처 신규 등록'}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* E-Count Style Tab Header */}
            <div className="flex border-b border-gray-200 bg-gray-50/50 px-4">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'basic' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                기본
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('biz_info')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'biz_info' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="h-4 w-4" />
                거래처정보
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('credit')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'credit' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                여신/단가
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('extra')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'extra' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                부가정보
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
                
                {/* 1. 기본 탭 */}
                {activeTab === 'basic' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                          거래처코드 / 사업자번호 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: 232-88-00624"
                          value={formData.company_code}
                          onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                          상호 (거래처명) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: (주)대선소방방재산업"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">거래 구분</label>
                        <select
                          value={formData.company_type}
                          onChange={(e) => setFormData({ ...formData, company_type: e.target.value as any })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="CUSTOMER">매출처 (고객사)</option>
                          <option value="VENDOR">매입처 (공급사)</option>
                          <option value="BOTH">매출/매입 공통</option>
                          <option value="DISTRIBUTOR">유통업체</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">법인등록번호</label>
                        <input
                          type="text"
                          placeholder="예: 110111-1234567"
                          value={formData.corporate_no}
                          onChange={(e) => setFormData({ ...formData, corporate_no: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">대표자명</label>
                        <input
                          type="text"
                          placeholder="예: 홍길동"
                          value={formData.ceo_name}
                          onChange={(e) => setFormData({ ...formData, ceo_name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">이메일 주소</label>
                        <input
                          type="email"
                          placeholder="example@domain.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">대표전화</label>
                        <input
                          type="text"
                          placeholder="02-1234-5678"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">휴대폰번호</label>
                        <input
                          type="text"
                          placeholder="010-1234-5678"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">팩스번호</label>
                        <input
                          type="text"
                          placeholder="02-1234-5679"
                          value={formData.fax}
                          onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 거래처정보 탭 (이카운트 핵심 복제 영역!) */}
                {activeTab === 'biz_info' && (
                  <div className="space-y-6">
                    {/* 상호 */}
                    <div className="grid grid-cols-4 items-center gap-4 border-b border-gray-100 pb-3">
                      <span className="text-sm font-bold text-gray-600">상호 (상세)</span>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="사업자 상호를 입력하세요."
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* 구분 라디오 */}
                    <div className="grid grid-cols-4 items-center gap-4 border-b border-gray-100 pb-3">
                      <span className="text-sm font-bold text-gray-600">코드구분</span>
                      <div className="col-span-3 flex items-center gap-6">
                        <label className="inline-flex items-center text-sm font-semibold text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name="code_type"
                            value="BUSINESS_NO"
                            checked={formData.code_type === 'BUSINESS_NO'}
                            onChange={() => setFormData({ ...formData, code_type: 'BUSINESS_NO' })}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-2">사업자번호</span>
                        </label>
                        <label className="inline-flex items-center text-sm font-semibold text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name="code_type"
                            value="NON_BUSINESS_DOMESTIC"
                            checked={formData.code_type === 'NON_BUSINESS_DOMESTIC'}
                            onChange={() => setFormData({ ...formData, code_type: 'NON_BUSINESS_DOMESTIC' })}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-2">비사업자(국내)</span>
                        </label>
                        <label className="inline-flex items-center text-sm font-semibold text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name="code_type"
                            value="NON_BUSINESS_FOREIGN"
                            checked={formData.code_type === 'NON_BUSINESS_FOREIGN'}
                            onChange={() => setFormData({ ...formData, code_type: 'NON_BUSINESS_FOREIGN' })}
                            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="ml-2">비사업자(국외)</span>
                        </label>
                      </div>
                    </div>

                    {/* 세무신고 거래처 동적 비활성화 연동 */}
                    <div className="grid grid-cols-4 items-start gap-4 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-600">세무신고거래처</span>
                        <HelpCircle className="h-4.5 w-4.5 text-gray-400" title="세무신고(전자세금계산서) 발행 주체가 별도로 존재하는 경우 선택합니다." />
                      </div>
                      <div className="col-span-3 space-y-2.5">
                        <div className="flex items-center gap-6">
                          <label className="inline-flex items-center text-xs font-bold text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="tax_reporting_type"
                              value="SAME_AS_CODE"
                              checked={formData.tax_reporting_type === 'SAME_AS_CODE'}
                              onChange={() => setFormData({ ...formData, tax_reporting_type: 'SAME_AS_CODE', tax_reporting_code: '' })}
                              className="h-3.5 w-3.5 text-blue-600 border-gray-300"
                            />
                            <span className="ml-2">동일</span>
                          </label>
                          <label className="inline-flex items-center text-xs font-bold text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="tax_reporting_type"
                              value="SEARCH"
                              checked={formData.tax_reporting_type === 'SEARCH'}
                              onChange={() => setFormData({ ...formData, tax_reporting_type: 'SEARCH' })}
                              className="h-3.5 w-3.5 text-blue-600 border-gray-300"
                            />
                            <span className="ml-2">검색입력</span>
                          </label>
                          <label className="inline-flex items-center text-xs font-bold text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="tax_reporting_type"
                              value="DIRECT"
                              checked={formData.tax_reporting_type === 'DIRECT'}
                              onChange={() => setFormData({ ...formData, tax_reporting_type: 'DIRECT' })}
                              className="h-3.5 w-3.5 text-blue-600 border-gray-300"
                            />
                            <span className="ml-2">직접입력</span>
                          </label>
                        </div>
                        
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={
                              formData.tax_reporting_type === 'SAME_AS_CODE' 
                                ? `기본 거래처코드 동일 (${formData.company_code || '입력 대기'})` 
                                : "세무신고 사업자번호 또는 코드 입력"
                            }
                            disabled={formData.tax_reporting_type === 'SAME_AS_CODE'}
                            value={formData.tax_reporting_type === 'SAME_AS_CODE' ? formData.company_code : formData.tax_reporting_code}
                            onChange={(e) => setFormData({ ...formData, tax_reporting_code: e.target.value })}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-blue-500 shadow-sm ${
                              formData.tax_reporting_type === 'SAME_AS_CODE' 
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                : 'bg-white text-gray-900 border-gray-300'
                            }`}
                          />
                          {formData.tax_reporting_type === 'SEARCH' && (
                            <button
                              type="button"
                              onClick={() => {
                                toast.info('거래처 찾기 팝업 (더미 작동)');
                                setFormData(prev => ({ ...prev, tax_reporting_code: '232-88-00999' }));
                              }}
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-gray-800"
                            >
                              F2 검색
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 종사업장번호 */}
                    <div className="grid grid-cols-4 items-center gap-4 border-b border-gray-100 pb-3">
                      <span className="text-sm font-bold text-gray-600">종사업장번호</span>
                      <div className="col-span-3">
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="0000"
                          value={formData.sub_biz_no}
                          onChange={(e) => setFormData({ ...formData, sub_biz_no: e.target.value })}
                          className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 text-center shadow-sm outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-400 ml-2 font-medium">※ 국세청 승인된 종사업장 4자리 번호</span>
                      </div>
                    </div>

                    {/* 대표자 및 도움말 */}
                    <div className="grid grid-cols-4 items-center gap-4 border-b border-gray-100 pb-3">
                      <span className="text-sm font-bold text-gray-600">대표자명</span>
                      <div className="col-span-3 flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="대표자 성명을 입력해 주세요."
                          value={formData.ceo_name}
                          onChange={(e) => setFormData({ ...formData, ceo_name: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                        <div className="relative group cursor-pointer">
                          <HelpCircle className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                          <div className="absolute right-0 bottom-6 hidden group-hover:block bg-gray-900 text-white text-xs font-medium rounded-lg p-2.5 shadow-xl w-60 z-50 line-clamp-3">
                            전자세금계산서의 국세청 신고전송 시 필수적으로 기재되는 대표자명 명세입니다. 오탈자에 유의해 주세요.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 업태 / 종목 */}
                    <div className="grid grid-cols-4 items-center gap-4 border-b border-gray-100 pb-3">
                      <span className="text-sm font-bold text-gray-600">업태 / 종목</span>
                      <div className="col-span-3 grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="업태 (예: 제조업)"
                          value={formData.business_type}
                          onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="종목 (예: 소방방재재료)"
                          value={formData.business_item}
                          onChange={(e) => setFormData({ ...formData, business_item: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* 주소 1 / 주소 2 (도로명, 지번 병렬 입력 대응 주소검색) */}
                    <div className="grid grid-cols-4 items-start gap-4 pb-2">
                      <span className="text-sm font-bold text-gray-600">사업장 주소</span>
                      <div className="col-span-3 space-y-3">
                        {/* 주소 1 */}
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="우편번호 1"
                              value={formData.zipcode1}
                              onChange={(e) => setFormData({ ...formData, zipcode1: e.target.value })}
                              className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 text-center shadow-sm outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => openDaumPostcode(1)}
                              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm"
                            >
                              <MapPin className="h-3.5 w-3.5 text-red-500" />
                              주소검색 🇰🇷
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="기본 도로명 주소 또는 지번 주소 1"
                            value={formData.address1}
                            onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* 주소 2 */}
                        <div className="space-y-1.5 border-t border-gray-100 pt-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="우편번호 2"
                              value={formData.zipcode2}
                              onChange={(e) => setFormData({ ...formData, zipcode2: e.target.value })}
                              className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 text-center shadow-sm outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => openDaumPostcode(2)}
                              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm"
                            >
                              <MapPin className="h-3.5 w-3.5 text-blue-500" />
                              주소검색 🇰🇷
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="추가 지번 주소 또는 상세 주소 2"
                            value={formData.address2}
                            onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 이카운트 고유의 Fn 하단 팁박스 */}
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3.5">
                      <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                        💡 [세무신고 가이드] 사업자번호구분이 비사업자인 경우 주세무 거래처 코드와의 자동 크로스링크 정정이 비활성화됩니다. 실제 세금계산서의 국세청 전송 승인 시 대표자명 및 우편번호1 항목은 법적 필수 기재이오니 누락 없이 기입하시기 바랍니다. (단축키: 각 인풋에서 F2 키를 통해 탐색가능)
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. 여신/단가 탭 (더미 연동) */}
                {activeTab === 'credit' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 mb-4 flex items-center gap-3">
                      <div className="p-2 bg-blue-500 rounded-lg text-white">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-blue-900">여신한도 및 단가 마스터 제어</h4>
                        <p className="text-xs text-blue-700">거래처별 여신한도 설정 및 맞춤형 자재 단가표를 매핑할 수 있습니다.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">여신한도액 (KRW)</label>
                        <input
                          type="text"
                          defaultValue="50,000,000"
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">단가 적용 등급</label>
                        <select className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 bg-white shadow-sm focus:border-blue-500 outline-none">
                          <option>A급 단가 (최우수 파트너)</option>
                          <option>B급 단가 (일반 파트너)</option>
                          <option>C급 단가 (소량/신규 거래)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">담당 영업 영업사원</label>
                        <input
                          type="text"
                          defaultValue="박선우 대리"
                          className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">거래 종결 여부</label>
                        <select className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 bg-white shadow-sm focus:border-blue-500 outline-none">
                          <option>거래 유지 (정상 거래)</option>
                          <option>거래 보류 (여신 초과 경보)</option>
                          <option>거래 종결 (채권 추심 단계)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. 부가정보 탭 */}
                {activeTab === 'extra' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">거래처 주소 (공통 레거시)</label>
                      <input
                        type="text"
                        placeholder="이전 버전용 통합 주소 란"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">적요 / 비고 메모</label>
                      <textarea
                        placeholder="거래처와 관련된 비즈니스 특이사항, 납품 유의사항을 편하게 기술해 주세요."
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        rows={5}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">거래 마스터 활성화</h4>
                        <p className="text-xs text-gray-500">사용 중단 처리 시 주문서 입력 및 프로젝트 매핑 목록에서 제외됩니다.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className="text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {formData.is_active ? (
                          <ToggleRight className="h-10 w-10 text-blue-600 animate-pulse" />
                        ) : (
                          <ToggleLeft className="h-10 w-10 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
                <span className="text-xs text-gray-400 font-medium">
                  {editingId ? '수정 중에는 기본 및 상세 정보를 꼼꼼히 확인하세요.' : '새 거래처 등록 시 거래구분을 반드시 지정하세요.'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow transition-all"
                  >
                    <Save className="h-4 w-4" />
                    저장하기
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
