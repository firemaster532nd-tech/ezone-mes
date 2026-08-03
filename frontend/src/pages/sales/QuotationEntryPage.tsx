import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Save, Trash2, Plus, Minus, Printer, ArrowRight,
  Search, ChevronDown, RefreshCw, Copy, X
} from 'lucide-react';

interface Company {
  company_id: number;
  company_name: string;
  company_code: string;
  ceo_name?: string;
  phone?: string;
  address?: string;
}

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string | null;
  unit: string;
  unit_price?: number;
}

interface QuotationItem {
  quotation_item_id?: number;
  item_code: string;
  item_name: string;
  spec: string;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
  total: number;
  remarks: string;
}

const newItem = (): QuotationItem => ({
  item_code: '', item_name: '', spec: '', qty: 1,
  unit_price: 0, amount: 0, vat: 0, total: 0, remarks: ''
});

function calcItem(it: QuotationItem, taxType: string): QuotationItem {
  const supply = Math.round(it.qty * it.unit_price);
  const vat    = taxType === 'TAX_EXCLUDED' ? Math.round(supply * 0.1) : 0;
  return { ...it, amount: supply, vat, total: supply + vat };
}

export function QuotationEntryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  // 헤더 상태
  const [qNumber, setQNumber]           = useState('');
  const [qDate, setQDate]               = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId]     = useState<number | null>(null);
  const [companyName, setCompanyName]   = useState('');
  const [projectCode, setProjectCode]   = useState('');
  const [managerName, setManagerName]   = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [taxType, setTaxType]           = useState<'TAX_EXCLUDED' | 'TAX_INCLUDED' | 'FREE'>('TAX_EXCLUDED');
  const [remarks, setRemarks]           = useState('');
  const [status, setStatus]             = useState('진행중');

  // 품목 그리드
  const [items, setItems] = useState<QuotationItem[]>([newItem()]);

  // 보조 데이터
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allItems, setAllItems]   = useState<Item[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);

  // 화사 검색 드롭다운
  const [compSearch, setCompSearch] = useState('');
  const [showCompDrop, setShowCompDrop] = useState(false);
  const compRef = useRef<HTMLDivElement>(null);

  // 품목 검색 팔업
  const [showItemPop, setShowItemPop] = useState<number | null>(null);
  const [itemSearch, setItemSearch]   = useState('');

  // 다음 연번 로드
  const fetchNextNumber = useCallback(async () => {
    if (isEdit) return;
    try {
      const yr = new Date().getFullYear().toString().slice(2);
      const r = await api.get<{ data: string[] }>('/quotations?limit=1');
      // 백엔드 연번 API를 사용하도록
      // 임시: 클라이언트에서 상위 연번 생성
      const date = new Date();
      const stamp = `${yr}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
      setQNumber(`QT-${yr}-${stamp}-001`);
    } catch { setQNumber('QT-AUTO'); }
  }, [isEdit]);

  const fetchMasterData = useCallback(async () => {
    try {
      const [compRes, itemRes] = await Promise.all([
        api.get<{ data: Company[] }>('/companies?type=CUSTOMER&limit=200'),
        api.get<{ data: Item[] }>('/items?limit=500'),
      ]);
      setCompanies(compRes.data || []);
      setAllItems(itemRes.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchQuotation = useCallback(async (qid: string) => {
    setLoading(true);
    try {
      const r = await api.get<{ data: any }>(`/quotations/${qid}`);
      const d = r.data;
      setQNumber(d.quotation_number);
      setQDate(d.quotation_date?.slice(0, 10) || '');
      setCustomerId(d.customer_id);
      setCompanyName(d.company_name);
      setProjectCode(d.project_code || '');
      setManagerName(d.manager_name || '');
      setDeliveryDate(d.delivery_date?.slice(0, 10) || '');
      setTaxType(d.tax_type || 'TAX_EXCLUDED');
      setRemarks(d.remarks || '');
      setStatus(d.status);
      setItems((d.items || []).map((it: any): QuotationItem => ({
        quotation_item_id: it.quotation_item_id,
        item_code: it.item_code || '',
        item_name: it.item_name,
        spec: it.spec || '',
        qty: Number(it.qty),
        unit_price: Number(it.unit_price),
        amount: Number(it.amount),
        vat: Number(it.vat),
        total: Number(it.amount) + Number(it.vat),
        remarks: it.remarks || '',
      })));
    } catch { toast.error('견적서를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchNextNumber();
    if (id) fetchQuotation(id);
  }, [fetchMasterData, fetchNextNumber, fetchQuotation, id]);

  // 타입 변경 시 전체 재계산
  useEffect(() => {
    setItems(prev => prev.map(it => calcItem(it, taxType)));
  }, [taxType]);

  const updateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    setItems(prev => {
      const next = [...prev];
      const updated = { ...next[idx], [field]: value };
      next[idx] = calcItem(updated, taxType);
      return next;
    });
  };

  const addRow = () => setItems(prev => [...prev, newItem()]);
  const removeRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const selectCompany = (c: Company) => {
    setCustomerId(c.company_id);
    setCompanyName(c.company_name);
    setCompSearch('');
    setShowCompDrop(false);
  };

  const selectItem = (rowIdx: number, it: Item) => {
    setItems(prev => {
      const next = [...prev];
      const updated = {
        ...next[rowIdx],
        item_code: it.item_code,
        item_name: it.item_name,
        spec: it.spec || '',
        unit_price: Number(it.unit_price || 0),
      };
      next[rowIdx] = calcItem(updated, taxType);
      return next;
    });
    setShowItemPop(null);
    setItemSearch('');
  };

  const totalSupply = items.reduce((s, it) => s + it.amount, 0);
  const totalVat    = items.reduce((s, it) => s + it.vat, 0);
  const totalQty    = items.reduce((s, it) => s + it.qty, 0);
  const totalAmount = totalSupply + totalVat;

  const handleSave = async () => {
    if (!customerId) { toast.error('거래처를 선택하세요.'); return; }
    const validItems = items.filter(it => it.item_name.trim());
    if (!validItems.length) { toast.error('품목을 1개 이상 입력하세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        quotation_number: qNumber,
        quotation_date: qDate,
        customer_id: customerId,
        project_code: projectCode || null,
        manager_name: managerName || null,
        delivery_date: deliveryDate || null,
        tax_type: taxType,
        currency: 'KRW',
        price_type: 'DEFAULT',
        remarks: remarks || null,
        items: validItems.map(it => ({
          item_code: it.item_code,
          item_name: it.item_name,
          spec: it.spec || null,
          qty: it.qty,
          unit_price: it.unit_price,
          amount: it.amount,
          vat: it.vat,
          remarks: it.remarks || null,
        })),
      };
      if (isEdit) {
        await api.put(`/quotations/${id}`, payload);
        toast.success('견적서가 수정되었습니다.');
      } else {
        await api.post('/quotations', payload);
        toast.success('견적서가 등록되었습니다.');
        navigate('/sales/quotations');
      }
    } catch (e: any) {
      toast.error(e?.body?.message || '저장 실패');
    } finally { setSaving(false); }
  };

  const handleConvertOrder = async () => {
    if (!id || !confirm('수주(발주서)로 전환하시겠습니까?')) return;
    try {
      await api.post(`/quotations/${id}/convert-order`, {});
      toast.success('수주 전환 완료!');
      navigate('/orders/purchase-orders');
    } catch (e: any) { toast.error(e?.body?.message || '전환 실패'); }
  };

  const filteredComp = companies.filter(c =>
    c.company_name.includes(compSearch) || c.company_code.includes(compSearch)
  ).slice(0, 10);

  const filteredItems = allItems.filter(it =>
    it.item_name.includes(itemSearch) || it.item_code.includes(itemSearch)
  ).slice(0, 20);

  const INP = 'w-full border-0 border-b border-slate-200 px-1 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent';
  const HDR = 'px-2 py-2 text-xs font-semibold text-slate-500 text-center bg-slate-50';
  const CELL = 'px-1 py-1';

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 타이틀바 */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales/quotations')} className="text-slate-400 hover:text-slate-600">←</button>
          <h1 className="text-base font-bold text-slate-800">견적서 {isEdit ? '수정' : '입력'}</h1>
          {status !== '진행중' && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              status === '주문완료' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>{status}</span>
          )}
        </div>
        {/* 하단 버튼바 (PC에서는 상단에) */}
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`/orders/quotations/print/${id}`, '_blank')}
            disabled={!isEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40">
            <Printer className="h-4 w-4" /> 인쇄
          </button>
          {isEdit && status === '진행중' && (
            <button onClick={handleConvertOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
              수주전환 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* 헤더 필드 (3열 x 2행) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {/* Row 1 */}
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">전표번호</label>
              <input value={qNumber} onChange={e => setQNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">곬적일자 *</label>
              <input type="date" value={qDate} onChange={e => setQDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">납기희망일</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            {/* Row 2 */}
            <div className="relative" ref={compRef}>
              <label className="text-xs text-slate-500 font-medium block mb-1">거래처 *</label>
              <div className="flex gap-1">
                <input
                  value={companyName || compSearch}
                  onChange={e => { setCompSearch(e.target.value); setCompanyName(''); setCustomerId(null); setShowCompDrop(true); }}
                  onFocus={() => setShowCompDrop(true)}
                  placeholder="거래처명 검색..."
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <button onClick={() => setShowCompDrop(!showCompDrop)} className="px-2 border rounded-lg border-slate-200 hover:bg-slate-50">
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              {showCompDrop && filteredComp.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredComp.map(c => (
                    <button key={c.company_id} onClick={() => selectCompany(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0">
                      <span className="font-medium">{c.company_name}</span>
                      <span className="text-slate-400 text-xs ml-2">{c.company_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">현장명/프로젝트</label>
              <input value={projectCode} onChange={e => setProjectCode(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="현장명 또는 프로젝트코드" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">과세구분</label>
              <select value={taxType} onChange={e => setTaxType(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                <option value="TAX_EXCLUDED">과세 (부가세 별도)</option>
                <option value="TAX_INCLUDED">과세 (부가세 포함)</option>
                <option value="FREE">면세</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-500 font-medium block mb-1">비고</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        {/* 품목 그리드 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">품목 명세</span>
            <button onClick={addRow}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100">
              <Plus className="h-3 w-3" /> 행 추가
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr>
                  <th className={`${HDR} w-8`}>No</th>
                  <th className={`${HDR} w-32`}>품목코드</th>
                  <th className={`${HDR} min-w-[180px]`}>품목명 *</th>
                  <th className={`${HDR} w-32`}>규격</th>
                  <th className={`${HDR} w-20`}>수량</th>
                  <th className={`${HDR} w-28`}>단가(원)</th>
                  <th className={`${HDR} w-28`}>공급가액(원)</th>
                  {taxType === 'TAX_EXCLUDED' && <th className={`${HDR} w-24`}>세액(원)</th>}
                  <th className={`${HDR} w-28`}>합계(원)</th>
                  <th className={`${HDR} w-28`}>비고</th>
                  <th className={`${HDR} w-8`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-2 py-1 text-center text-xs text-slate-400">{idx + 1}</td>
                    <td className={CELL}>
                      <div className="relative">
                        <input
                          value={it.item_code}
                          onFocus={() => setShowItemPop(idx)}
                          onChange={e => updateItem(idx, 'item_code', e.target.value)}
                          placeholder="코드 검색"
                          className={INP}
                        />
                        {showItemPop === idx && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowItemPop(null)}>
                            <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-2 p-3 border-b">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input autoFocus value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                                  placeholder="품목명, 코드 검색..." className="flex-1 text-sm outline-none" />
                                <button onClick={() => setShowItemPop(null)}><X className="h-4 w-4 text-slate-400" /></button>
                              </div>
                              <div className="overflow-y-auto">
                                {filteredItems.map(fi => (
                                  <button key={fi.item_id} onClick={() => selectItem(idx, fi)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-100 text-sm">
                                    <span className="font-medium text-slate-700">{fi.item_name}</span>
                                    <span className="text-slate-400 text-xs ml-2">[{fi.item_code}]</span>
                                    {fi.spec && <span className="text-slate-500 text-xs ml-2">{fi.spec}</span>}
                                  </button>
                                ))}
                                {filteredItems.length === 0 && (
                                  <p className="text-center text-slate-400 py-4 text-sm">품목이 없습니다.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={CELL}>
                      <input value={it.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                        placeholder="품목명 입력..." className={INP} />
                    </td>
                    <td className={CELL}>
                      <input value={it.spec} onChange={e => updateItem(idx, 'spec', e.target.value)}
                        placeholder="규격" className={INP} />
                    </td>
                    <td className={CELL}>
                      <input type="number" value={it.qty} onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value)||0)}
                        className={`${INP} text-right`} min={0} />
                    </td>
                    <td className={CELL}>
                      <input type="number" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value)||0)}
                        className={`${INP} text-right font-mono`} min={0} />
                    </td>
                    <td className="px-1 py-1 text-right font-mono text-sm text-slate-700">
                      {it.amount.toLocaleString()}
                    </td>
                    {taxType === 'TAX_EXCLUDED' && (
                      <td className="px-1 py-1 text-right font-mono text-sm text-blue-600">
                        {it.vat.toLocaleString()}
                      </td>
                    )}
                    <td className="px-1 py-1 text-right font-mono text-sm font-semibold">
                      {it.total.toLocaleString()}
                    </td>
                    <td className={CELL}>
                      <input value={it.remarks} onChange={e => updateItem(idx, 'remarks', e.target.value)}
                        placeholder="비고" className={INP} />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button onClick={() => removeRow(idx)} disabled={items.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs text-slate-500">합계</td>
                  <td className="px-1 py-2 text-right font-mono text-sm font-bold">{totalQty.toLocaleString()}</td>
                  <td />
                  <td className="px-1 py-2 text-right font-mono text-sm font-semibold text-slate-700">{totalSupply.toLocaleString()}</td>
                  {taxType === 'TAX_EXCLUDED' && (
                    <td className="px-1 py-2 text-right font-mono text-sm font-semibold text-blue-600">{totalVat.toLocaleString()}</td>
                  )}
                  <td className="px-1 py-2 text-right font-mono text-sm font-bold text-slate-900">{totalAmount.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 하단 요약 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex gap-8 text-sm">
              <div>
                <span className="text-slate-500">공급가 합계:</span>
                <span className="ml-2 font-bold font-mono">{totalSupply.toLocaleString()}원</span>
              </div>
              {taxType === 'TAX_EXCLUDED' && (
                <div>
                  <span className="text-slate-500">세액:</span>
                  <span className="ml-2 font-bold font-mono text-blue-600">{totalVat.toLocaleString()}원</span>
                </div>
              )}
              <div>
                <span className="text-slate-500">합계 금액:</span>
                <span className="ml-2 font-bold font-mono text-lg">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>
            <div className="text-xs text-slate-400">총 {items.filter(it=>it.item_name).length}종 {totalQty.toLocaleString()}개</div>
          </div>
        </div>
      </div>
    </div>
  );
}
