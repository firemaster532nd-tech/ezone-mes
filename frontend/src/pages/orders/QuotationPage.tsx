import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from 'sonner';
import { 
  Search, X, Plus, Pencil, Trash2, ShoppingCart, 
  Printer, ArrowRightLeft, Calendar, FileText, 
  Building2, ArrowRight, DollarSign, Calculator
} from 'lucide-react';

interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
  company_type: string;
}

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string | null;
  unit: string;
}

interface QuotationItem {
  quotation_item_id?: number;
  item_code: string;
  item_name: string;
  spec: string | null;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  remarks: string | null;
}

interface Quotation {
  quotation_id: number;
  quotation_number: string;
  quotation_date: string;
  customer_id: number;
  company_name: string;
  customer_business_no: string;
  project_code: string | null;
  manager_name: string | null;
  warehouse_id: string | null;
  tax_type: 'TAX_INCLUDED' | 'TAX_EXCLUDED' | 'FREE';
  currency: string;
  price_type: string;
  delivery_date: string | null;
  remarks: string | null;
  total_qty: number;
  total_amount: number;
  total_vat: number;
  status: '진행중' | '주문완료' | '취소';
  created_at: string;
}

export function QuotationPage() {
  const [data, setData] = useState<Quotation[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await api.get<{ data: Quotation[] }>(`/quotations?${params.toString()}`);
      setData(res.data);
    } catch (e: any) {
      toast.error('견적서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // 주문 전환 API 호출
  const handleConvertOrder = async (id: number, qNo: string) => {
    if (!confirm(`견적서 [${qNo}]를 수주 주문으로 자동 전환하시겠습니까?\n전환 시 수주 마스터 및 품목이 자동 생성되며 견적 상태가 '주문완료'로 변경됩니다.`)) return;
    try {
      const res = await api.post<{ message: string }>(`/quotations/${id}/convert-order`, {});
      toast.success(res.message || '수주로 성공적으로 전환되었습니다.');
      fetchData();
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '주문 전환에 실패했습니다.');
    }
  };

  // 견적서 취소 처리
  const handleCancelQuotation = async (id: number, qNo: string) => {
    if (!confirm(`견적서 [${qNo}]를 취소 상태로 변경하시겠습니까?`)) return;
    try {
      await api.delete(`/quotations/${id}`);
      toast.success('견적서가 취소 처리되었습니다.');
      fetchData();
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '취소 처리에 실패했습니다.');
    }
  };

  // 인쇄 화면 새창 열기
  const handlePrint = (id: number) => {
    const printUrl = `/orders/quotations/print/${id}`;
    window.open(printUrl, '_blank', 'width=1000,height=800,scrollbars=yes');
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="견적서 관리" 
        count={data.length} 
        description="E-Count 연동 견적서 현황 목록, 미주문현황 관리 및 수주 주문 즉각 전환" 
      />

      {/* 필터 검색 섹션 */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">검색어</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="견적번호, 거래처명, 현장명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">견적기간</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">진행상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="">전체 상태</option>
              <option value="진행중">진행중</option>
              <option value="주문완료">주문완료</option>
              <option value="취소">취소</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 bg-slate-800 text-white font-medium text-sm rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
            >
              조회
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setStatusFilter('');
                setTimeout(fetchData, 10);
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              초기화
            </button>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => {
                setEditingQuotation(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-blue-100"
            >
              <Plus className="h-4 w-4" />
              견적서 신규 등록
            </button>
          </div>
        </form>
      </div>

      {/* 리스트 그리드 */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="px-5 py-3.5 text-center w-12">No</th>
                <th className="px-5 py-3.5">견적일자</th>
                <th className="px-5 py-3.5">견적번호</th>
                <th className="px-5 py-3.5">거래처</th>
                <th className="px-5 py-3.5">현장명/프로젝트</th>
                <th className="px-5 py-3.5 text-right">수량합계</th>
                <th className="px-5 py-3.5 text-right">공급가액</th>
                <th className="px-5 py-3.5 text-right">세액</th>
                <th className="px-5 py-3.5 text-right">합계금액</th>
                <th className="px-5 py-3.5 text-center">진행상태</th>
                <th className="px-5 py-3.5 text-center w-36">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((q, idx) => (
                <tr key={q.quotation_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-5 py-4 text-center font-mono text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{q.quotation_date}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {q.quotation_number}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-700">{q.company_name}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{q.project_code || '-'}</td>
                  <td className="px-5 py-4 text-right font-mono text-slate-600 font-medium">
                    {Number(q.total_qty).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-semibold text-slate-800">
                    ₩{Number(q.total_amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs text-slate-500">
                    ₩{Number(q.total_vat).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-blue-600 bg-blue-50/10">
                    ₩{(Number(q.total_amount) + Number(q.total_vat)).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm",
                      q.status === '진행중' && "bg-amber-50 text-amber-700 border border-amber-200/50",
                      q.status === '주문완료' && "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
                      q.status === '취소' && "bg-slate-100 text-slate-500"
                    )}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handlePrint(q.quotation_id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                        title="A4 견적서 출력"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      
                      {q.status === '진행중' && (
                        <>
                          <button
                            onClick={() => handleConvertOrder(q.quotation_id, q.quotation_number)}
                            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 transition-colors"
                            title="수주 전환"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const details = await api.get<{ data: Quotation }>(`/quotations/${q.quotation_id}`);
                                setEditingQuotation(details.data);
                                setIsModalOpen(true);
                              } catch (e) {
                                toast.error('견적 상세를 가져오지 못했습니다.');
                              }
                            }}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelQuotation(q.quotation_id, q.quotation_number)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                            title="취소"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                    조회된 견적서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 및 수정 모달 */}
      {isModalOpen && (
        <QuotationFormModal
          quotation={editingQuotation}
          onClose={() => {
            setIsModalOpen(false);
            setEditingQuotation(null);
          }}
          onSave={() => {
            setIsModalOpen(false);
            setEditingQuotation(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ─── E-Count 스타일 견적서 등록/수정 모달 ─── */
/* ────────────────────────────────────────────────────────────────────────── */
function QuotationFormModal({
  quotation,
  onClose,
  onSave,
}: {
  quotation?: Quotation | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [itemsMaster, setItemsMaster] = useState<Item[]>([]);
  const [showItemSelectModal, setShowItemSelectModal] = useState<number | null>(null); // 품목 선택 대기 중인 row index
  const [itemSearch, setItemSearch] = useState('');

  // 폼 마스터 데이터
  const [master, setMaster] = useState({
    quotation_number: '',
    quotation_date: new Date().toISOString().slice(0, 10),
    customer_id: 0,
    project_code: '',
    manager_name: '',
    warehouse_id: 'WH-MAIN',
    tax_type: 'TAX_EXCLUDED' as 'TAX_INCLUDED' | 'TAX_EXCLUDED' | 'FREE',
    currency: 'KRW',
    price_type: 'DEFAULT',
    delivery_date: '',
    remarks: '',
  });

  // 품목 테이블 데이터
  const [items, setItems] = useState<QuotationItem[]>([
    { item_code: '', item_name: '', spec: '', qty: 1, unit_price: 0, amount: 0, vat: 0, remarks: '' }
  ]);

  // 마운트 시 기초 데이터 로딩
  useEffect(() => {
    api.get<{ data: Company[] }>('/companies').then((res) => {
      setCompanies(res.data.filter(c => c.company_type === 'CUSTOMER' || c.company_type === 'BOTH'));
    });
    api.get<{ data: Item[] }>('/items').then((res) => {
      setItemsMaster(res.data);
    });

    if (quotation) {
      setMaster({
        quotation_number: quotation.quotation_number,
        quotation_date: quotation.quotation_date,
        customer_id: quotation.customer_id,
        project_code: quotation.project_code || '',
        manager_name: quotation.manager_name || '',
        warehouse_id: quotation.warehouse_id || 'WH-MAIN',
        tax_type: quotation.tax_type,
        currency: quotation.currency,
        price_type: quotation.price_type,
        delivery_date: quotation.delivery_date || '',
        remarks: quotation.remarks || '',
      });
      if ((quotation as any).items) {
        setItems((quotation as any).items.map((it: any) => ({
          quotation_item_id: it.quotation_item_id,
          item_code: it.item_code,
          item_name: it.item_name,
          spec: it.spec,
          qty: Number(it.qty),
          unit_price: Number(it.unit_price),
          amount: Number(it.amount),
          vat: Number(it.vat),
          remarks: it.remarks || ''
        })));
      }
    } else {
      // 신규 등록 시 고유 견적번호 추천 세팅
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      setMaster(prev => ({ ...prev, quotation_number: `QT-${dateStr}-${rand}` }));
    }
  }, [quotation]);

  // 실시간 계산 로직 (수량/단가/부가세구분 변경 시)
  const calculateRow = (qty: number, price: number, taxType: 'TAX_INCLUDED' | 'TAX_EXCLUDED' | 'FREE') => {
    let amount = 0;
    let vat = 0;

    if (taxType === 'TAX_EXCLUDED') {
      amount = qty * price;
      vat = Math.floor(amount * 0.1);
    } else if (taxType === 'TAX_INCLUDED') {
      const total = qty * price;
      amount = Math.round(total / 1.1);
      vat = total - amount;
    } else {
      // FREE 면세
      amount = qty * price;
      vat = 0;
    }

    return { amount, vat };
  };

  // 마스터 세부 항목 업데이트
  const updateMaster = (key: string, value: any) => {
    setMaster(prev => {
      const updated = { ...prev, [key]: value };
      
      // 만약 과세 구분이 변경되면 전체 행의 금액/세액 재계산
      if (key === 'tax_type') {
        const nextItems = items.map(row => {
          const { amount, vat } = calculateRow(row.qty, row.unit_price, value);
          return { ...row, amount, vat };
        });
        setItems(nextItems);
      }
      return updated;
    });
  };

  // 품목 행 속성 변경
  const updateRow = (idx: number, key: keyof QuotationItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const row = { ...next[idx], [key]: val };

      // 수량이나 단가 변경 시 금액/부가세 재계산
      if (key === 'qty' || key === 'unit_price') {
        const qty = key === 'qty' ? Number(val) : row.qty;
        const price = key === 'unit_price' ? Number(val) : row.unit_price;
        const { amount, vat } = calculateRow(qty, price, master.tax_type);
        row.qty = qty;
        row.unit_price = price;
        row.amount = amount;
        row.vat = vat;
      }
      
      next[idx] = row;
      return next;
    });
  };

  // 품목 행 추가
  const addRow = () => {
    setItems(prev => [...prev, { item_code: '', item_name: '', spec: '', qty: 1, unit_price: 0, amount: 0, vat: 0, remarks: '' }]);
  };

  // 품목 행 삭제
  const removeRow = (idx: number) => {
    if (items.length <= 1) {
      toast.error('최소 1개 이상의 품목이 등록되어야 합니다.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // 품목 마스터에서 품목 선택 완료
  const handleSelectItem = (item: Item) => {
    if (showItemSelectModal !== null) {
      const idx = showItemSelectModal;
      setItems(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          item_code: item.item_code,
          item_name: item.item_name,
          spec: item.spec || '',
        };
        return next;
      });
      setShowItemSelectModal(null);
      setItemSearch('');
    }
  };

  // 전체 합계 계산
  const totalQty = items.reduce((sum, r) => sum + Number(r.qty), 0);
  const totalAmount = items.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalVat = items.reduce((sum, r) => sum + Number(r.vat), 0);
  const grandTotal = totalAmount + totalVat;

  // 견적서 저장하기
  const handleSave = async () => {
    if (Number(master.customer_id) === 0) {
      toast.error('거래처를 선택해 주세요.');
      return;
    }
    if (!master.quotation_number.trim()) {
      toast.error('견적번호는 필수입니다.');
      return;
    }
    
    // 품목 유효성 체크
    const validItems = items.filter(r => r.item_code.trim() !== '');
    if (validItems.length === 0) {
      toast.error('코드가 입력된 유효한 품목이 1개 이상 존재해야 합니다.');
      return;
    }

    const payload = {
      ...master,
      customer_id: Number(master.customer_id),
      items: validItems
    };

    try {
      if (quotation) {
        await api.put(`/quotations/${quotation.quotation_id}`, payload);
        toast.success('견적서가 성공적으로 수정되었습니다.');
      } else {
        await api.post('/quotations', payload);
        toast.success('견적서가 성공적으로 등록되었습니다.');
      }
      onSave();
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '견적서 저장에 실패했습니다.');
    }
  };

  // 품목 검색 필터링
  const filteredItems = itemsMaster.filter(
    it => it.item_code.toLowerCase().includes(itemSearch.toLowerCase()) || 
          it.item_name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            {quotation ? `견적서 수정 [${quotation.quotation_number}]` : '견적서 신규 등록'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
          {/* 마스터 정보 (E-Count 스타일 입력란) */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">견적번호 *</label>
              <input
                type="text"
                value={master.quotation_number}
                onChange={(e) => updateMaster('quotation_number', e.target.value)}
                disabled={!!quotation}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">견적일자 *</label>
              <input
                type="date"
                value={master.quotation_date}
                onChange={(e) => updateMaster('quotation_date', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">거래처 *</label>
              <select
                value={master.customer_id}
                onChange={(e) => updateMaster('customer_id', Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              >
                <option value={0}>-- 거래처 선택 --</option>
                {companies.map(c => (
                  <option key={c.company_id} value={c.company_id}>{c.company_name} ({c.company_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">현장명/프로젝트코드</label>
              <input
                type="text"
                value={master.project_code}
                onChange={(e) => updateMaster('project_code', e.target.value)}
                placeholder="예: 김포 물류창고 신축현장"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">담당자</label>
              <input
                type="text"
                value={master.manager_name}
                onChange={(e) => updateMaster('manager_name', e.target.value)}
                placeholder="예: 홍길동 과장"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">출하창고</label>
              <select
                value={master.warehouse_id}
                onChange={(e) => updateMaster('warehouse_id', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
              >
                <option value="WH-MAIN">본사 완제품창고</option>
                <option value="WH-SUB">자재 2창고</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">과세구분</label>
              <select
                value={master.tax_type}
                onChange={(e) => updateMaster('tax_type', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
              >
                <option value="TAX_EXCLUDED">부가세 별도 (10%)</option>
                <option value="TAX_INCLUDED">부가세 포함</option>
                <option value="FREE">면세 (0%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">납기예정일</label>
              <input
                type="date"
                value={master.delivery_date}
                onChange={(e) => updateMaster('delivery_date', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              />
            </div>

            <div className="col-span-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">비고 / 견적조건</label>
              <textarea
                value={master.remarks}
                onChange={(e) => updateMaster('remarks', e.target.value)}
                rows={1.5}
                placeholder="납품 조건, 결제 조건 등을 입력해 주세요."
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
              />
            </div>
          </div>

          {/* 품목 추가 및 실시간 계산 그리드 */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">견적 세부 품목 명세</h4>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white font-semibold text-xs rounded hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-3 w-3" />
                품목 추가
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-center w-12">No</th>
                    <th className="px-4 py-3 w-40">품목코드 *</th>
                    <th className="px-4 py-3 w-48">품목명</th>
                    <th className="px-4 py-3 w-36">규격</th>
                    <th className="px-4 py-3 text-right w-24">수량</th>
                    <th className="px-4 py-3 text-right w-32">단가(원)</th>
                    <th className="px-4 py-3 text-right w-36">공급가액(원)</th>
                    <th className="px-4 py-3 text-right w-32">세액(원)</th>
                    <th className="px-4 py-3 w-44">비고</th>
                    <th className="px-4 py-3 text-center w-16">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/20">
                      <td className="px-4 py-2 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={row.item_code}
                            onChange={(e) => updateRow(idx, 'item_code', e.target.value)}
                            placeholder="코드 입력 또는 검색"
                            className="w-full pr-7 pl-2 py-1.5 border border-slate-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                          />
                          <button
                            type="button"
                            onClick={() => setShowItemSelectModal(idx)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.item_name}
                          onChange={(e) => updateRow(idx, 'item_name', e.target.value)}
                          placeholder="품목명 입력"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded font-sans text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.spec || ''}
                          onChange={(e) => updateRow(idx, 'spec', e.target.value)}
                          placeholder="예: 850X550"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-600"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.unit_price}
                          onChange={(e) => updateRow(idx, 'unit_price', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-700 font-semibold align-middle px-3">
                        ₩{row.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500 align-middle px-3">
                        ₩{row.vat.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.remarks || ''}
                          onChange={(e) => updateRow(idx, 'remarks', e.target.value)}
                          placeholder="비고 입력"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded font-sans text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-600"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 하단 집계 판넬 */}
            <div className="bg-slate-50/50 p-5 border-t border-slate-100 flex justify-between items-center text-sm">
              <div className="text-slate-500 font-sans">
                과세 유형: <span className="font-semibold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded text-xs">
                  {master.tax_type === 'TAX_EXCLUDED' ? '부가세 별도 10%' : master.tax_type === 'TAX_INCLUDED' ? '부가세 포함' : '면세'}
                </span>
              </div>
              <div className="flex items-center gap-6 font-mono font-bold text-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-sans font-normal">총 수량:</span>
                  <span className="text-base text-slate-700">{totalQty.toLocaleString()}</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-sans font-normal">총 공급가액:</span>
                  <span className="text-base text-slate-700">₩{totalAmount.toLocaleString()}</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-sans font-normal">총 세액:</span>
                  <span className="text-base text-slate-500">₩{totalVat.toLocaleString()}</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm border border-blue-500">
                  <span className="text-xs font-sans font-normal opacity-90">합계금액 (G.Total):</span>
                  <span className="text-lg">₩{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4.5 border-t border-slate-100 bg-slate-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 font-semibold hover:bg-slate-50 text-slate-600 transition-colors">
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-sm hover:shadow-blue-100 transition-all"
          >
            {quotation ? '수정 내용 저장' : '견적서 등록'}
          </button>
        </div>
      </div>

      {/* ─── 품목 선택 헬퍼 모달 ─── */}
      {showItemSelectModal !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowItemSelectModal(null)}>
          <div 
            className="bg-white rounded-xl p-5 w-full max-w-md shadow-2xl flex flex-col max-h-[60vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Building2 className="h-4.5 w-4.5 text-blue-600" />
                견적 품목 선택 (마스터 검색)
              </h4>
              <button onClick={() => setShowItemSelectModal(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="품목코드 또는 품목명 검색..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border rounded-lg max-h-[300px]">
              {filteredItems.map(item => (
                <button
                  key={item.item_id}
                  onClick={() => handleSelectItem(item)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50/50 flex flex-col transition-colors text-xs"
                >
                  <span className="font-mono font-bold text-blue-600">{item.item_code}</span>
                  <span className="text-slate-800 font-medium">{item.item_name}</span>
                  {item.spec && <span className="text-slate-400 font-mono text-[10px] mt-0.5">{item.spec}</span>}
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  검색된 품목이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
