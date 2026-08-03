import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Save, Plus, Minus, ArrowLeft, FileText } from 'lucide-react';

interface Company { company_id: number; company_name: string; company_code: string; }
interface SaleItem {
  item_code: string; item_name: string; spec: string;
  qty: number; unit_price: number;
  supply_amount: number; vat_amount: number; total_amount: number;
  remarks: string;
}

const newRow = (): SaleItem => ({ item_code:'', item_name:'', spec:'', qty:1, unit_price:0, supply_amount:0, vat_amount:0, total_amount:0, remarks:'' });

function calcRow(it: SaleItem, taxType: string): SaleItem {
  const supply = Math.round(it.qty * it.unit_price);
  const vat = taxType === 'TAX_EXCLUDED' ? Math.round(supply * 0.1) : 0;
  return { ...it, supply_amount: supply, vat_amount: vat, total_amount: supply + vat };
}

export function SalesDeliveryEntryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [slNumber, setSlNumber]       = useState('');
  const [slDate, setSlDate]           = useState(new Date().toISOString().slice(0,10));
  const [customerId, setCustomerId]   = useState<number|null>(null);
  const [companyName, setCompanyName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [taxType, setTaxType]         = useState('TAX_EXCLUDED');
  const [remarks, setRemarks]         = useState('');
  const [items, setItems]             = useState<SaleItem[]>([newRow()]);
  const [companies, setCompanies]     = useState<Company[]>([]);
  const [saving, setSaving]           = useState(false);
  const [compSearch, setCompSearch]   = useState('');
  const [showCompDrop, setShowCompDrop] = useState(false);

  useEffect(() => {
    api.get<{data:Company[]}>('/companies?type=CUSTOMER&limit=200').then(r=>setCompanies(r.data||[])).catch(()=>{});
    if (!isEdit) {
      api.get<{data:{sl_number:string}}>('/sales-delivery/next-number').then(r=>setSlNumber(r.data?.sl_number||'SL-AUTO')).catch(()=>{});
    } else {
      api.get<{data:any}>(`/sales-delivery/${id}`).then(r=>{
        const d = r.data;
        setSlNumber(d.sl_number); setSlDate(d.sl_date?.slice(0,10)||'');
        setCustomerId(d.customer_id); setCompanyName(d.company_name);
        setProjectCode(d.project_code||''); setDeliveryDate(d.delivery_date?.slice(0,10)||'');
        setTaxType(d.tax_type||'TAX_EXCLUDED'); setRemarks(d.remarks||'');
        setItems((d.items||[]).map((it:any):SaleItem=>({
          item_code:it.item_code||'', item_name:it.item_name, spec:it.spec||'',
          qty:Number(it.qty), unit_price:Number(it.unit_price),
          supply_amount:Number(it.supply_amount), vat_amount:Number(it.vat_amount),
          total_amount:Number(it.total_amount), remarks:it.remarks||''
        })));
      }).catch(()=>toast.error('로드 실패'));
    }
  }, [id, isEdit]);

  useEffect(() => { setItems(prev=>prev.map(it=>calcRow(it,taxType))); }, [taxType]);

  const updateItem = (idx: number, f: keyof SaleItem, v: any) => {
    setItems(prev => { const n=[...prev]; n[idx]=calcRow({...n[idx],[f]:v},taxType); return n; });
  };

  const totalSupply = items.reduce((s,it)=>s+it.supply_amount,0);
  const totalVat    = items.reduce((s,it)=>s+it.vat_amount,0);
  const totalQty    = items.reduce((s,it)=>s+it.qty,0);

  const filtComp = companies.filter(c=>c.company_name.includes(compSearch)||c.company_code.includes(compSearch)).slice(0,10);

  const handleSave = async () => {
    if (!customerId) { toast.error('거래처를 선택하세요.'); return; }
    const valid = items.filter(it=>it.item_name.trim());
    if (!valid.length) { toast.error('품목을 입력하세요.'); return; }
    setSaving(true);
    try {
      const payload = { customer_id:customerId, project_code:projectCode||null, sl_date:slDate, delivery_date:deliveryDate||null, tax_type:taxType, remarks:remarks||null, items:valid };
      if (isEdit) { await api.put(`/sales-delivery/${id}`, payload); toast.success('수정 완료'); }
      else { await api.post('/sales-delivery', payload); toast.success('판매 등록 완료'); navigate('/sales/delivery'); }
    } catch { toast.error('저장 실패'); }
    finally { setSaving(false); }
  };

  const INP = 'w-full border-0 border-b border-slate-200 px-1 py-1 text-sm focus:outline-none focus:border-blue-500 bg-transparent';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/sales/delivery')} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-base font-bold text-slate-800">판매 {isEdit?'수정':'입력'}</h1>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <button onClick={()=>{ api.post(`/sales-delivery/${id}/tax-invoice`,{}).then(r=>navigate(`/sales/tax-invoice/${r.data.ti_id}`)).catch(()=>toast.error('실패')); }}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50">
              <FileText className="h-4 w-4" /> 세금계산서
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving?'저장 중...':'저장'}
          </button>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div><label className="text-xs text-slate-500 block mb-1">판매번호</label>
              <input value={slNumber} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono bg-slate-50" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">판매일 *</label>
              <input type="date" value={slDate} onChange={e=>setSlDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">납품일</label>
              <input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div className="relative">
              <label className="text-xs text-slate-500 block mb-1">거래처 *</label>
              <input value={companyName||compSearch} onChange={e=>{setCompSearch(e.target.value);setCompanyName('');setCustomerId(null);setShowCompDrop(true);}}
                onFocus={()=>setShowCompDrop(true)} placeholder="거래처명 검색..." className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
              {showCompDrop && filtComp.length>0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filtComp.map(c=>(
                    <button key={c.company_id} onClick={()=>{setCustomerId(c.company_id);setCompanyName(c.company_name);setCompSearch('');setShowCompDrop(false);}}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100">{c.company_name}</button>
                  ))}
                </div>
              )}
            </div>
            <div><label className="text-xs text-slate-500 block mb-1">현장명</label>
              <input value={projectCode} onChange={e=>setProjectCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-slate-500 block mb-1">과세구분</label>
              <select value={taxType} onChange={e=>setTaxType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="TAX_EXCLUDED">과세(부가세 변도)</option>
                <option value="TAX_INCLUDED">과세(포함)</option>
                <option value="FREE">면세</option>
              </select></div>
          </div>
          <div className="mt-3"><label className="text-xs text-slate-500 block mb-1">비고</label>
            <input value={remarks} onChange={e=>setRemarks(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">판매 품목</span>
            <button onClick={()=>setItems(prev=>[...prev,newRow()])} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded">
              <Plus className="h-3 w-3" /> 행 추가
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="px-2 py-2 w-8">No</th>
                  <th className="px-2 py-2 min-w-[180px] text-left">품목명 *</th>
                  <th className="px-2 py-2 w-28 text-left">규격</th>
                  <th className="px-2 py-2 w-20 text-right">수량</th>
                  <th className="px-2 py-2 w-28 text-right">단가</th>
                  <th className="px-2 py-2 w-28 text-right">공급가</th>
                  {taxType==='TAX_EXCLUDED' && <th className="px-2 py-2 w-24 text-right">세액</th>}
                  <th className="px-2 py-2 w-28 text-right">합계</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it,idx)=>(
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-2 py-1 text-center text-xs text-slate-400">{idx+1}</td>
                    <td className="px-1 py-1"><input value={it.item_name} onChange={e=>updateItem(idx,'item_name',e.target.value)} placeholder="품목명" className={INP} /></td>
                    <td className="px-1 py-1"><input value={it.spec} onChange={e=>updateItem(idx,'spec',e.target.value)} placeholder="규격" className={INP} /></td>
                    <td className="px-1 py-1"><input type="number" value={it.qty} onChange={e=>updateItem(idx,'qty',parseFloat(e.target.value)||0)} className={`${INP} text-right`} /></td>
                    <td className="px-1 py-1"><input type="number" value={it.unit_price} onChange={e=>updateItem(idx,'unit_price',parseFloat(e.target.value)||0)} className={`${INP} text-right font-mono`} /></td>
                    <td className="px-1 py-1 text-right font-mono text-slate-700">{it.supply_amount.toLocaleString()}</td>
                    {taxType==='TAX_EXCLUDED' && <td className="px-1 py-1 text-right font-mono text-blue-600">{it.vat_amount.toLocaleString()}</td>}
                    <td className="px-1 py-1 text-right font-mono font-semibold">{it.total_amount.toLocaleString()}</td>
                    <td className="px-1 py-1 text-center"><button onClick={()=>setItems(prev=>prev.filter((_,i)=>i!==idx))} disabled={items.length===1} className="text-red-400 hover:text-red-600 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs text-slate-500">합계</td>
                  <td className="px-1 py-2 text-right font-mono text-sm font-bold">{totalQty}</td>
                  <td />
                  <td className="px-1 py-2 text-right font-mono text-sm font-semibold">{totalSupply.toLocaleString()}</td>
                  {taxType==='TAX_EXCLUDED' && <td className="px-1 py-2 text-right font-mono text-sm font-semibold text-blue-600">{totalVat.toLocaleString()}</td>}
                  <td className="px-1 py-2 text-right font-mono text-sm font-bold">{(totalSupply+totalVat).toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
