import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, ArrowLeft, Plus, Trash2, Save, 
  Building2, Calendar, ClipboardList, Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
}

interface StatementItem {
  item_name: string;
  spec: string;
  unit: string;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  remarks: string;
  sort_order: number;
}

export function StatementEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  // 명세서 폼 상태
  const [customerId, setCustomerId] = useState('');
  const [statementDate, setStatementDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // 공급자 정보 (이지원 주식회사)
  const [supplierInfo, setSupplierInfo] = useState({
    supplier_name: '(주)이지원',
    supplier_ceo: '박민선',
    supplier_no: '232-88-00624',
    supplier_addr: '경기도 화성시 장안면 장안로227번길 166-18',
    supplier_phone: '070-8870-0300',
  });

  const [remarks, setRemarks] = useState('기사님 사인받은 거래명세표 사진전송 부탁드립니다 010-4115-0187');
  const [items, setItems] = useState<StatementItem[]>([]);

  // 1. 거래처 조회
  const fetchCompanies = async () => {
    try {
      const res = await api.get<{ data: Company[] }>('/companies?active=true');
      setCompanies(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // 2. 수주 연동 자재 소요량 연계 계산 조회
  const calculateBOMFromOrder = async (oid: string) => {
    setLoading(true);
    try {
      const res = await api.get<{
        data: {
          matched_company: Company | null;
          proposed_items: {
            item_name: string;
            spec: string;
            unit: string;
            qty: number;
            unit_price: number;
            amount: number;
            vat: number;
            remarks: string;
            sort_order: number;
          }[];
        }
      }>(`/statements/calculate-bom?orderId=${oid}`);
      
      const { matched_company, proposed_items } = res.data.data;
      if (matched_company) {
        setCustomerId(String(matched_company.company_id));
        toast.info(`수주처 [${matched_company.company_name}]가 공급받는 자로 연동되었습니다.`);
      }
      
      setItems(proposed_items);
      toast.success('수주 기반의 완제품 및 부자재 소요량이 자동 산출되었습니다!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'BOM 소요량 계산에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    if (orderId) {
      calculateBOMFromOrder(orderId);
    } else {
      // 일반 수동 발급일 때 빈 아이템 하나 세팅
      handleAddRow();
    }
  }, [orderId]);

  // 그리드 관리 기능들
  const handleAddRow = () => {
    const nextSort = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1;
    setItems([
      ...items,
      {
        item_name: '',
        spec: '',
        unit: 'EA',
        qty: 1,
        unit_price: 0,
        amount: 0,
        vat: 0,
        remarks: '',
        sort_order: nextSort,
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      return toast.warning('최소 하나의 품목 라인이 필요합니다.');
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof StatementItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'qty') {
      const q = parseFloat(value) || 0;
      item.qty = q;
      item.amount = Math.round(q * item.unit_price);
      item.vat = Math.round(item.amount * 0.1);
    } else if (field === 'unit_price') {
      const p = parseInt(value, 10) || 0;
      item.unit_price = p;
      item.amount = Math.round(item.qty * p);
      item.vat = Math.round(item.amount * 0.1);
    } else {
      (item as any)[field] = value;
    }

    updated[index] = item;
    setItems(updated);
  };

  // 총 합계 계산
  const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalVat = items.reduce((sum, item) => sum + (item.vat || 0), 0);

  // 저장 등록 실행
  const handleSave = async () => {
    if (!customerId) {
      return toast.warning('공급받는 자 (거래처)를 선택해 주세요.');
    }

    const invalidItems = items.filter(i => !i.item_name.trim() || i.qty <= 0);
    if (invalidItems.length > 0) {
      return toast.warning('품목명은 필수이며, 수량은 0보다 커야 합니다.');
    }

    const payload = {
      statement_date: statementDate,
      order_id: orderId ? parseInt(orderId, 10) : null,
      customer_id: parseInt(customerId, 10),
      ...supplierInfo,
      total_qty: totalQty,
      total_amount: totalAmount,
      total_vat: totalVat,
      remarks,
      items,
    };

    try {
      await api.post('/statements', payload);
      toast.success('거래명세서가 성공적으로 발급되었습니다!');
      navigate('/shipment/statements');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || '거래명세서 발급 과정에서 오류가 발생했습니다.');
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/shipment/statements')}
            className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">거래명세서 신규 발급</h1>
            <p className="text-sm text-gray-500">
              {orderId ? `수주번호 [SO-${orderId}] 자재 소요량 연계 모드` : '신규 품목 수동 발급 모드'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          <Save className="h-4 w-4" />
          발급 전표 저장
        </button>
      </div>

      {/* Main Container Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 공급받는자 (거래처) 설정 카드 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
            <Building2 className="h-4.5 w-4.5 text-blue-600" />
            공급받는 자 (거래처 정보)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                거래처 선택 <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">거래처를 선택하세요</option>
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.company_name} ({c.company_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                거래일자 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 공급자 정보 카드 (이지원 주식회사 고정 또는 관리) */}
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
            <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
            공급자 정보 (이지원)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
            <div>
              <span className="font-semibold text-gray-400 block mb-0.5">상호명</span>
              <span className="font-bold text-gray-900">{supplierInfo.supplier_name}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-400 block mb-0.5">사업자번호</span>
              <span className="font-bold text-gray-900">{supplierInfo.supplier_no}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-400 block mb-0.5">대표자</span>
              <span className="font-bold text-gray-900">{supplierInfo.supplier_ceo}</span>
            </div>
            <div className="col-span-2">
              <span className="font-semibold text-gray-400 block mb-0.5">소재지 주소</span>
              <span className="font-bold text-gray-900">{supplierInfo.supplier_addr}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-400 block mb-0.5">연락처</span>
              <span className="font-bold text-gray-900">{supplierInfo.supplier_phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Item Detail Grid Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Info className="h-4.5 w-4.5 text-blue-500" />
            거래명세 항목 내역 ({items.length}건)
          </h2>
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 text-blue-600" />
            항목 추가
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">부자재 소요량을 산출 중입니다...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b bg-gray-50/50 text-gray-600 font-bold text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center">No</th>
                  <th className="px-4 py-3 min-w-[200px]">품목명 (자재명)</th>
                  <th className="px-4 py-3 min-w-[120px]">규격</th>
                  <th className="px-4 py-3 w-20">단위</th>
                  <th className="px-4 py-3 w-24 text-right">수량</th>
                  <th className="px-4 py-3 w-28 text-right">단가 (원)</th>
                  <th className="px-4 py-3 w-32 text-right">공급가액</th>
                  <th className="px-4 py-3 w-28 text-right">세액 (VAT)</th>
                  <th className="px-4 py-3 min-w-[150px]">비고</th>
                  <th className="px-4 py-3 w-12 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 text-center text-gray-400 font-semibold">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="품목 및 자재명"
                        value={item.item_name}
                        onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2.5 py-1 text-sm outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="규격"
                        value={item.spec}
                        onChange={(e) => handleItemChange(idx, 'spec', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2.5 py-1 text-sm outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-center outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="any"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right outline-none focus:border-blue-500 font-bold"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right outline-none focus:border-blue-500 font-semibold"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-800 bg-gray-50/30">
                      {formatNumber(item.amount)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-500">
                      {formatNumber(item.vat)}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="메모"
                        value={item.remarks}
                        onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Total Summary Panel */}
        <div className="border-t bg-gray-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6 text-sm text-gray-600">
            <div>
              총 품목 수: <span className="font-bold text-gray-900">{items.length}</span>종
            </div>
            <div>
              총수량 합계: <span className="font-bold text-gray-900">{formatNumber(totalQty)}</span> EA
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500 font-semibold">공급가액 계:</span>{' '}
              <span className="font-bold text-gray-900 text-base">{formatNumber(totalAmount)}</span> 원
            </div>
            <div>
              <span className="text-gray-500 font-semibold">세액 계:</span>{' '}
              <span className="font-bold text-gray-900 text-base">{formatNumber(totalVat)}</span> 원
            </div>
            <div className="border-l pl-6 font-bold text-blue-700 text-lg">
              합계금액: <span>{formatNumber(totalAmount + totalVat)}</span> 원
            </div>
          </div>
        </div>
      </div>

      {/* Remarks card */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-900">거래명세표 하단 비고 (메모란)</h3>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          placeholder="거래명세표 인쇄 시 하단에 노출되는 전달사항이나 요구조건을 적어주세요."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}
