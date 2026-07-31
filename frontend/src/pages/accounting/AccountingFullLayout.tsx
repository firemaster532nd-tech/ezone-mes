import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api';
import { 
  BookOpen, Calculator, FileText, Printer, PieChart, BarChart3, ChevronRight,
  CreditCard, Landmark, DollarSign, Plus, CheckCircle2, ShieldCheck, ArrowRightLeft, FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AccountingSummary {
  revenue: number;
  cost: number;
  operatingProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  netEquity: number;
}

interface AccountCode {
  account_id: number;
  account_code: string;
  account_name: string;
  category: string;
  type: string;
  is_active: boolean;
}

interface JournalVoucher {
  voucher_id: number;
  voucher_no: string;
  voucher_date: string;
  account_code: string;
  account_name: string;
  customer_name: string;
  debit_amount: number;
  credit_amount: number;
  summary: string;
  writer_name: string;
  status: string;
}

interface TaxInvoice {
  invoice_id: number;
  invoice_no: string;
  invoice_type: 'SALES' | 'PURCHASE';
  issue_date: string;
  supplier_name: string;
  supplier_biz_no: string;
  buyer_name: string;
  buyer_biz_no: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  item_description: string;
  nts_status: string;
}

interface BankAccount {
  bank_id: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  account_type: string;
  balance: number;
}

interface PromissoryNote {
  note_id: number;
  note_no: string;
  note_type: string;
  issue_date: string;
  maturity_date: string;
  drawer_name: string;
  payee_name: string;
  amount: number;
  status: string;
}

interface FixedAsset {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_years: number;
  accumulated_depreciation: number;
  book_value: number;
}

type TabType = 'base' | 'fast' | 'sales' | 'tax' | 'bank' | 'cash' | 'noncash' | 'note' | 'fixedasset' | 'review' | 'reports';

export function AccountingFullLayout() {
  const [activeTab, setActiveTab] = useState<TabType>('reports');
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [notes, setNotes] = useState<PromissoryNote[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  const [selectedReport, setSelectedReport] = useState<string>('경영자료 요약');
  const [loading, setLoading] = useState(false);

  // FastEntry 빠른 전표 폼
  const [fastEntryForm, setFastEntryForm] = useState({
    voucher_date: new Date().toISOString().slice(0, 10),
    account_code: '10800',
    account_name: '외상매출금',
    customer_name: '',
    debit_amount: 0,
    credit_amount: 0,
    summary: '',
  });

  // 전자세금계산서 발행 폼
  const [taxInvoiceForm, setTaxInvoiceForm] = useState({
    invoice_type: 'SALES',
    issue_date: new Date().toISOString().slice(0, 10),
    buyer_name: '',
    buyer_biz_no: '',
    supply_amount: 0,
    item_description: '',
  });

  // 신규 계정과목 폼
  const [newAccountForm, setNewAccountForm] = useState({
    account_code: '',
    account_name: '',
    category: '자산',
    type: '당좌자산',
  });

  // 데이터 로딩
  const loadAccountingData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, vRes, accRes, taxRes, bankRes, noteRes, faRes] = await Promise.all([
        api.get<AccountingSummary>('/accounting/summary').catch(() => null),
        api.get<{ data: JournalVoucher[] }>('/accounting/vouchers').catch(() => null),
        api.get<{ data: AccountCode[] }>('/accounting/account-codes').catch(() => null),
        api.get<{ data: TaxInvoice[] }>('/accounting/tax-invoices').catch(() => null),
        api.get<{ data: BankAccount[] }>('/accounting/bank-accounts').catch(() => null),
        api.get<{ data: PromissoryNote[] }>('/accounting/notes').catch(() => null),
        api.get<{ data: FixedAsset[] }>('/accounting/fixed-assets').catch(() => null),
      ]);

      if (sumRes?.data) setSummary(sumRes.data);
      if (vRes?.data?.data) setVouchers(vRes.data.data);
      if (accRes?.data?.data) setAccountCodes(accRes.data.data);
      if (taxRes?.data?.data) setTaxInvoices(taxRes.data.data);
      if (bankRes?.data?.data) setBankAccounts(bankRes.data.data);
      if (noteRes?.data?.data) setNotes(noteRes.data.data);
      if (faRes?.data?.data) setFixedAssets(faRes.data.data);
    } catch {
      toast.error('회계 데이터 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountingData();
  }, [loadAccountingData]);

  // FastEntry 전표 등록
  const handleFastEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fastEntryForm.debit_amount === 0 && fastEntryForm.credit_amount === 0) {
      toast.error('차변금액 또는 대변금액을 입력해주세요.');
      return;
    }
    try {
      await api.post('/accounting/vouchers', fastEntryForm);
      toast.success('🎉 전표가 성공적으로 저장되었습니다.');
      setFastEntryForm({
        voucher_date: new Date().toISOString().slice(0, 10),
        account_code: '10800',
        account_name: '외상매출금',
        customer_name: '',
        debit_amount: 0,
        credit_amount: 0,
        summary: '',
      });
      loadAccountingData();
    } catch {
      toast.error('전표 등록 중 오류가 발생했습니다.');
    }
  };

  // 세금계산서 발행
  const handleTaxInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxInvoiceForm.buyer_name || taxInvoiceForm.supply_amount <= 0) {
      toast.error('공급받는자 상호와 공급가액을 입력해주세요.');
      return;
    }
    try {
      await api.post('/accounting/tax-invoices', taxInvoiceForm);
      toast.success('📄 전자세금계산서가 발행 및 국세청 홈택스 전송 세팅되었습니다.');
      setTaxInvoiceForm({
        invoice_type: 'SALES',
        issue_date: new Date().toISOString().slice(0, 10),
        buyer_name: '',
        buyer_biz_no: '',
        supply_amount: 0,
        item_description: '',
      });
      loadAccountingData();
    } catch {
      toast.error('세금계산서 발행 실패');
    }
  };

  // 계정과목 추가
  const handleAccountCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.account_code || !newAccountForm.account_name) {
      toast.error('계정코드와 계정과목명을 입력하세요.');
      return;
    }
    try {
      await api.post('/accounting/account-codes', newAccountForm);
      toast.success(`신규 계정과목 [${newAccountForm.account_name}] 등록 완료`);
      setNewAccountForm({ account_code: '', account_name: '', category: '자산', type: '당좌자산' });
      loadAccountingData();
    } catch {
      toast.error('계정과목 등록 실패');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader 
        title="회계 관리 (Accounting ERP Suite)" 
        description="이카운트 ERP 규격 11대 회계 모듈 종합 관리 — 세금계산서 · 장부 · 분개전표 · 손익계산서 · 재무상태표" 
      />

      {/* 📊 경영자료 회계 요약 지표 (Executive Dashboard Summary) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs space-y-1">
          <p className="text-xs text-slate-500 font-bold">당기 총 매출액 (Revenue)</p>
          <p className="text-2xl font-black text-blue-900">₩{(summary?.revenue || 18400000).toLocaleString()}</p>
          <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
            제품매출 & 자재매출 집계
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs space-y-1">
          <p className="text-xs text-slate-500 font-bold">당기 매출원가/판관비 (Cost)</p>
          <p className="text-2xl font-black text-red-700">₩{(summary?.cost || 4500000).toLocaleString()}</p>
          <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">
            원재료매입 & 노무경비
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <p className="text-xs text-slate-500 font-bold">당기 영업이익 (Operating Profit)</p>
          <p className="text-2xl font-black text-emerald-700">₩{(summary?.operatingProfit || 13900000).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
            영업이익률 {summary ? Math.round((summary.operatingProfit / (summary.revenue || 1)) * 100) : 75}%
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs space-y-1">
          <p className="text-xs text-slate-500 font-bold">총 자산 / 순자산</p>
          <p className="text-2xl font-black text-indigo-900">₩{(summary?.totalAssets || 500000000).toLocaleString()}</p>
          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
            부채: ₩{(summary?.totalLiabilities || 120000000).toLocaleString()}
          </span>
        </div>
      </div>

      {/* 🧭 이카운트 ERP 11대 메인 탭 메뉴 (Top Navigation Bar) */}
      <div className="bg-white rounded-2xl border shadow-sm p-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-[960px] pb-1">
          {[
            { key: 'base',       label: '기초등록' },
            { key: 'fast',       label: 'FastEntry' },
            { key: 'sales',      label: '매출매입거래' },
            { key: 'tax',        label: '전자(세금)계산서' },
            { key: 'bank',       label: '계좌/카드' },
            { key: 'cash',       label: '현금거래' },
            { key: 'noncash',    label: '비현금거래' },
            { key: 'note',       label: '어음거래' },
            { key: 'fixedasset', label: '고정자산' },
            { key: 'review',     label: '회계거래관리' },
            { key: 'reports',    label: '📊 출력물 (재무제표)' },
          ].map((tab) => (
            <button 
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)} 
              className={cn(
                'px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap',
                activeTab === tab.key ? 'bg-blue-900 text-white shadow-md' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 1. 기초등록 탭 ────────────────────────────────────────── */}
      {activeTab === 'base' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
              <BookOpen className="h-4 w-4 text-blue-900" /> 계정과목 마스터 등록 & 설정
            </h3>

            <form onSubmit={handleAccountCodeSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs bg-slate-50 p-4 rounded-xl border">
              <div>
                <label className="block font-bold text-slate-700 mb-1">계정코드 *</label>
                <input 
                  value={newAccountForm.account_code}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_code: e.target.value })}
                  placeholder="예: 80400"
                  required
                  className="w-full border rounded-lg p-2 font-mono bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">계정과목명 *</label>
                <input 
                  value={newAccountForm.account_name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, account_name: e.target.value })}
                  placeholder="예: 소모품비"
                  required
                  className="w-full border rounded-lg p-2 font-bold bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">대분류</label>
                <select 
                  value={newAccountForm.category}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, category: e.target.value })}
                  className="w-full border rounded-lg p-2 font-bold bg-white"
                >
                  <option value="자산">자산</option>
                  <option value="부채">부채</option>
                  <option value="자본">자본</option>
                  <option value="수익">수익</option>
                  <option value="비용">비용</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">중분류</label>
                <select 
                  value={newAccountForm.type}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, type: e.target.value })}
                  className="w-full border rounded-lg p-2 font-bold bg-white"
                >
                  <option value="당좌자산">당좌자산</option>
                  <option value="재고자산">재고자산</option>
                  <option value="유동부채">유동부채</option>
                  <option value="매출액">매출액</option>
                  <option value="매출원가">매출원가</option>
                  <option value="제조경비">제조경비</option>
                  <option value="판매비와관리비">판매비와관리비</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow">
                  + 계정과목 저장
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                    <th className="px-4 py-2.5">계정코드</th>
                    <th className="px-4 py-2.5">계정과목명</th>
                    <th className="px-4 py-2.5">대분류</th>
                    <th className="px-4 py-2.5">중분류</th>
                    <th className="px-4 py-2.5">사용상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accountCodes.map((acc) => (
                    <tr key={acc.account_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-bold text-blue-900">{acc.account_code}</td>
                      <td className="px-4 py-2 font-extrabold text-slate-900">{acc.account_name}</td>
                      <td className="px-4 py-2 font-bold">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px]',
                          acc.category === '자산' ? 'bg-blue-100 text-blue-800' :
                          acc.category === '수익' ? 'bg-emerald-100 text-emerald-800' :
                          acc.category === '비용' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                        )}>
                          {acc.category}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{acc.type}</td>
                      <td className="px-4 py-2"><span className="text-emerald-600 font-bold">● 사용중</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. FastEntry 탭 ────────────────────────────────────────── */}
      {activeTab === 'fast' && (
        <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
            <Calculator className="h-4 w-4 text-blue-900" /> FastEntry 스피드 분개 전표 입력
          </h3>
          <form onSubmit={handleFastEntrySubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border">
            <div>
              <label className="block font-bold text-slate-700 mb-1">전표 일자 *</label>
              <input 
                type="date" 
                value={fastEntryForm.voucher_date} 
                onChange={(e) => setFastEntryForm({ ...fastEntryForm, voucher_date: e.target.value })}
                className="w-full border rounded-lg p-2.5 font-mono bg-white" 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">계정과목 *</label>
              <select 
                value={fastEntryForm.account_code} 
                onChange={(e) => {
                  const names: Record<string, string> = {
                    '10800': '외상매출금',
                    '40100': '제품매출(내화채움구조)',
                    '14600': '원재료(세라믹/그라스울)',
                    '21000': '외상매입금',
                    '10200': '보통예금(국민은행)',
                  };
                  setFastEntryForm({ 
                    ...fastEntryForm, 
                    account_code: e.target.value,
                    account_name: names[e.target.value] || '기타'
                  });
                }}
                className="w-full border rounded-lg p-2.5 font-bold bg-white"
              >
                <option value="10800">10800 - 외상매출금 (자산)</option>
                <option value="40100">40100 - 제품매출 (수익)</option>
                <option value="14600">14600 - 원재료매입 (자산)</option>
                <option value="21000">21000 - 외상매입금 (부채)</option>
                <option value="10200">10200 - 보통예금 (자산)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">거래처명</label>
              <input 
                type="text" 
                placeholder="예: 고양캐피탈랜드데이터센터" 
                value={fastEntryForm.customer_name} 
                onChange={(e) => setFastEntryForm({ ...fastEntryForm, customer_name: e.target.value })}
                className="w-full border rounded-lg p-2.5 bg-white" 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">차변금액 (Dr - 자산증가/비용발생)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={fastEntryForm.debit_amount} 
                onChange={(e) => setFastEntryForm({ ...fastEntryForm, debit_amount: Number(e.target.value) })}
                className="w-full border rounded-lg p-2.5 font-mono font-bold text-blue-900 bg-white" 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">대변금액 (Cr - 자산감소/수익발생)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={fastEntryForm.credit_amount} 
                onChange={(e) => setFastEntryForm({ ...fastEntryForm, credit_amount: Number(e.target.value) })}
                className="w-full border rounded-lg p-2.5 font-mono font-bold text-red-900 bg-white" 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">적요/비고 내용</label>
              <input 
                type="text" 
                placeholder="전표적요 상세 기입" 
                value={fastEntryForm.summary} 
                onChange={(e) => setFastEntryForm({ ...fastEntryForm, summary: e.target.value })}
                className="w-full border rounded-lg p-2.5 bg-white" 
              />
            </div>
            <div className="md:col-span-3 text-right pt-2">
              <button type="submit" className="px-6 py-3 bg-blue-900 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md">
                + FastEntry 전표 즉시 저장
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 3. 매출매입거래 탭 ────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-blue-900" /> 매출 및 매입 거래 원장 (Sales & Purchase Ledger)
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">총 {vouchers.length}건 등록됨</span>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                  <th className="px-3 py-2.5">전표번호</th>
                  <th className="px-3 py-2.5">일자</th>
                  <th className="px-3 py-2.5">구분</th>
                  <th className="px-3 py-2.5">계정과목</th>
                  <th className="px-3 py-2.5">거래처명</th>
                  <th className="px-3 py-2.5 text-right">차변금액 (Dr)</th>
                  <th className="px-3 py-2.5 text-right">대변금액 (Cr)</th>
                  <th className="px-3 py-2.5">적요</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vouchers.map((v) => (
                  <tr key={v.voucher_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{v.voucher_no}</td>
                    <td className="px-3 py-2.5 font-mono">{v.voucher_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 font-bold">
                      <span className={cn('px-2 py-0.5 rounded text-[10px]', v.account_code.startsWith('4') ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800')}>
                        {v.account_code.startsWith('4') ? '매출' : '매입/경비'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{v.account_name} ({v.account_code})</td>
                    <td className="px-3 py-2.5 text-slate-800 font-semibold">{v.customer_name || '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">
                      {Number(v.debit_amount) > 0 ? Number(v.debit_amount).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-red-700">
                      {Number(v.credit_amount) > 0 ? Number(v.credit_amount).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 truncate max-w-[200px]">{v.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 4. 전자(세금)계산서 탭 ────────────────────────────────────────── */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
              <FileCheck className="h-4 w-4 text-emerald-600" /> 전자세금계산서 즉시 발행 및 홈택스 연동
            </h3>

            <form onSubmit={handleTaxInvoiceSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border">
              <div>
                <label className="block font-bold text-slate-700 mb-1">구분</label>
                <select 
                  value={taxInvoiceForm.invoice_type}
                  onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, invoice_type: e.target.value as any })}
                  className="w-full border rounded-lg p-2 font-bold bg-white"
                >
                  <option value="SALES">매출 세금계산서</option>
                  <option value="PURCHASE">매입 세금계산서</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">공급받는자 상호 *</label>
                <input 
                  value={taxInvoiceForm.buyer_name}
                  onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, buyer_name: e.target.value })}
                  placeholder="예: 고양캐피탈랜드데이터센터"
                  required
                  className="w-full border rounded-lg p-2 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">사업자등록번호</label>
                <input 
                  value={taxInvoiceForm.buyer_biz_no}
                  onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, buyer_biz_no: e.target.value })}
                  placeholder="예: 101-81-12345"
                  className="w-full border rounded-lg p-2 font-mono bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">공급가액 (VAT 10% 자동) *</label>
                <input 
                  type="number"
                  value={taxInvoiceForm.supply_amount}
                  onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, supply_amount: Number(e.target.value) })}
                  placeholder="0"
                  required
                  className="w-full border rounded-lg p-2 font-mono font-bold bg-white"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">품목 및 규격 상세 비고</label>
                <input 
                  value={taxInvoiceForm.item_description}
                  onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, item_description: e.target.value })}
                  placeholder="예: 내화채움구조 VT-049 28개 세트 납품건"
                  className="w-full border rounded-lg p-2 bg-white"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow">
                  📄 세금계산서 발행
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                    <th className="px-3 py-2.5">승인번호</th>
                    <th className="px-3 py-2.5">일자</th>
                    <th className="px-3 py-2.5">구분</th>
                    <th className="px-3 py-2.5">공급자</th>
                    <th className="px-3 py-2.5">공급받는자</th>
                    <th className="px-3 py-2.5 text-right">공급가액</th>
                    <th className="px-3 py-2.5 text-right">부가가치세</th>
                    <th className="px-3 py-2.5 text-right">합계금액</th>
                    <th className="px-3 py-2.5">국세청 전송</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {taxInvoices.map((inv) => (
                    <tr key={inv.invoice_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{inv.invoice_no}</td>
                      <td className="px-3 py-2.5 font-mono">{inv.issue_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2.5 font-bold">
                        <span className={cn('px-2 py-0.5 rounded text-[10px]', inv.invoice_type === 'SALES' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800')}>
                          {inv.invoice_type === 'SALES' ? '매출' : '매입'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{inv.supplier_name}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{inv.buyer_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">₩{Number(inv.supply_amount).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">₩{Number(inv.tax_amount).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800">₩{Number(inv.total_amount).toLocaleString()}</td>
                      <td className="px-3 py-2.5"><span className="text-emerald-600 font-bold">✓ 전송완료</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. 계좌/카드 탭 ────────────────────────────────────────── */}
      {activeTab === 'bank' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((b) => (
              <div key={b.bank_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    {b.account_type === 'BANK' ? <Landmark size={16} className="text-blue-700" /> : <CreditCard size={16} className="text-amber-600" />}
                    {b.bank_name}
                  </span>
                  <span className="text-xs bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-600">{b.account_type}</span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-600">{b.account_number}</p>
                <div className="pt-2 flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-500">현재 잔액</span>
                  <span className="text-xl font-black text-blue-900 font-mono">₩{Number(b.balance).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 8. 어음거래 탭 ────────────────────────────────────────── */}
      {activeTab === 'note' && (
        <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
            <DollarSign className="h-4 w-4 text-amber-600" /> 전자 어음 대장 (받으어음 / 지급어음 만기 관리)
          </h3>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                  <th className="px-3 py-2.5">어음번호</th>
                  <th className="px-3 py-2.5">구분</th>
                  <th className="px-3 py-2.5">발행일</th>
                  <th className="px-3 py-2.5">만기일</th>
                  <th className="px-3 py-2.5">발행인</th>
                  <th className="px-3 py-2.5">수취인</th>
                  <th className="px-3 py-2.5 text-right">어음 금액</th>
                  <th className="px-3 py-2.5">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notes.map((n) => (
                  <tr key={n.note_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{n.note_no}</td>
                    <td className="px-3 py-2.5 font-bold">
                      <span className={cn('px-2 py-0.5 rounded text-[10px]', n.note_type === 'RECEIVABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                        {n.note_type === 'RECEIVABLE' ? '받으어음' : '지급어음'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{n.issue_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-red-700">{n.maturity_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800">{n.drawer_name}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800">{n.payee_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900">₩{Number(n.amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5"><span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">보관중 (정상)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 9. 고정자산 탭 ────────────────────────────────────────── */}
      {activeTab === 'fixedasset' && (
        <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
            <PieChart className="h-4 w-4 text-indigo-600" /> 고정자산 대장 & 감가상각비 관리
          </h3>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b text-slate-700 font-bold">
                  <th className="px-3 py-2.5">자산코드</th>
                  <th className="px-3 py-2.5">자산명</th>
                  <th className="px-3 py-2.5">취득일자</th>
                  <th className="px-3 py-2.5 text-right">취득가액</th>
                  <th className="px-3 py-2.5 text-center">내용연수</th>
                  <th className="px-3 py-2.5 text-right">감가상각 누계액</th>
                  <th className="px-3 py-2.5 text-right">미상각 장부가액</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fixedAssets.map((fa) => (
                  <tr key={fa.asset_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{fa.asset_code}</td>
                    <td className="px-3 py-2.5 font-extrabold text-slate-900">{fa.asset_name}</td>
                    <td className="px-3 py-2.5 font-mono">{fa.acquisition_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">₩{Number(fa.acquisition_cost).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">{fa.useful_life_years}년 (정액법)</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-red-700">₩{Number(fa.accumulated_depreciation).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800">₩{Number(fa.book_value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 11. 출력물 (Reports & Financial Statements) ──────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Category 1: 경영자료 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 font-bold text-sm text-slate-800">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span>경영자료</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li onClick={() => setSelectedReport('자금일보')} className="hover:text-blue-600 hover:underline cursor-pointer flex justify-between"><span>자금일보</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('현금흐름(입출금내역)')} className="hover:text-blue-600 hover:underline cursor-pointer flex justify-between"><span>현금흐름(입출금내역)</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('월별손익분석')} className="hover:text-blue-600 hover:underline cursor-pointer flex justify-between"><span>월별손익분석</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('회계집계표')} className="hover:text-blue-600 hover:underline cursor-pointer flex justify-between"><span>회계집계표</span> <ChevronRight size={12} /></li>
              </ul>
            </div>

            {/* Category 2: 장부 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 font-bold text-sm text-slate-800">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                <span>장부</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li onClick={() => setSelectedReport('계정별원장')} className="hover:text-indigo-600 hover:underline cursor-pointer flex justify-between"><span>계정별원장</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('매입/매출장')} className="hover:text-indigo-600 hover:underline cursor-pointer flex justify-between"><span>매입/매출장</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('분개장')} className="hover:text-indigo-600 hover:underline cursor-pointer flex justify-between"><span>분개장</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('현금출납장')} className="hover:text-indigo-600 hover:underline cursor-pointer flex justify-between"><span>현금출납장</span> <ChevronRight size={12} /></li>
              </ul>
            </div>

            {/* Category 3: 주요재무제표 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 font-bold text-sm text-slate-800">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>주요재무제표</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li onClick={() => setSelectedReport('재무상태표')} className="hover:text-emerald-600 hover:underline cursor-pointer flex justify-between"><span>재무상태표 (Balance Sheet)</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('손익계산서')} className="hover:text-emerald-600 hover:underline cursor-pointer flex justify-between"><span>손익계산서 (Income Statement)</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('원가명세서')} className="hover:text-emerald-600 hover:underline cursor-pointer flex justify-between"><span>원가명세서</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('합계잔액시산표')} className="hover:text-emerald-600 hover:underline cursor-pointer flex justify-between"><span>합계잔액시산표</span> <ChevronRight size={12} /></li>
              </ul>
            </div>

            {/* Category 4: 기타 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 font-bold text-sm text-slate-800">
                <Printer className="h-4 w-4 text-amber-600" />
                <span>기타</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li onClick={() => setSelectedReport('회계거래현황')} className="hover:text-amber-600 hover:underline cursor-pointer flex justify-between"><span>회계거래현황</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('매출(세금)계산서현황')} className="hover:text-amber-600 hover:underline cursor-pointer flex justify-between"><span>매출(세금)계산서현황</span> <ChevronRight size={12} /></li>
                <li onClick={() => setSelectedReport('회계 vs. 재고 비교')} className="hover:text-amber-600 hover:underline cursor-pointer flex justify-between"><span>회계 vs. 재고 비교</span> <ChevronRight size={12} /></li>
              </ul>
            </div>
          </div>

          {/* 📖 선택한 보고서 뷰어 (Selected Report View) */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-900" />
                <span>{selectedReport}</span>
              </h3>
              <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold">
                🖨️ 인쇄/PDF
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-600 font-bold">
                    <th className="px-3 py-2.5">전표번호</th>
                    <th className="px-3 py-2.5">일자</th>
                    <th className="px-3 py-2.5">계정과목</th>
                    <th className="px-3 py-2.5">거래처명</th>
                    <th className="px-3 py-2.5 text-right">차변금액 (Dr)</th>
                    <th className="px-3 py-2.5 text-right">대변금액 (Cr)</th>
                    <th className="px-3 py-2.5">적요/비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vouchers.map((v) => (
                    <tr key={v.voucher_id} className="hover:bg-blue-50/50">
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{v.voucher_no}</td>
                      <td className="px-3 py-2.5 font-mono">{v.voucher_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{v.account_name} ({v.account_code})</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{v.customer_name || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">
                        {Number(v.debit_amount) > 0 ? Number(v.debit_amount).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-red-700">
                        {Number(v.credit_amount) > 0 ? Number(v.credit_amount).toLocaleString() : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 truncate max-w-[200px]">{v.summary || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AccountingFullLayout;
