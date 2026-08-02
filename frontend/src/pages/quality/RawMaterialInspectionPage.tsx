import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

type TabType = '세라믹울' | '그라스울' | '그라스울보드';

interface FormState {
  density: string;
  thickness: string;
  width_mm: string;
  length_mm: string;
  supplier_name: string;
  supplier_lot: string;
  qty_current: string;
  lot_number: string;
  n1: string; n2: string; n3: string;
  check1: boolean; check2: boolean;
  inspector: string;
  result: '합격' | '불합격' | '';
}

const TAB_COLORS: Record<TabType, string> = {
  '세라믹울':   'bg-amber-600 text-white',
  '그라스울':   'bg-sky-600 text-white',
  '그라스울보드':'bg-emerald-600 text-white',
};

const SEL = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500';
const INP = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500';
const LBL = 'block text-xs font-semibold text-slate-400 mb-1';

export function RawMaterialInspectionPage() {
  const [activeTab, setActiveTab] = useState<TabType>('세라믹울');
  const [history, setHistory] = useState<any[]>([]);

  const defaultForm: FormState = {
    density: '', thickness: '', width_mm: '', length_mm: '7400',
    supplier_name: '', supplier_lot: '', qty_current: '', lot_number: '',
    n1: '', n2: '', n3: '', check1: false, check2: false,
    inspector: '김정용', result: ''
  };
  const [form, setForm] = useState<FormState>(defaultForm);
  const upd = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

  const abbrev = (tab: TabType) => tab === '세라믹울' ? 'CW' : tab === '그라스울' ? 'GW' : 'GWB';

  const fetchNextLot = async (tab: TabType) => {
    try {
      const res = await api.get<{ lot_number: string }>(`/material-lots/next-lot?abbrev=${abbrev(tab)}`);
      setForm(p => ({ ...p, lot_number: (res as any).lot_number || '' }));
    } catch { /* 무시 */ }
  };

  const fetchHistory = async (tab: TabType) => {
    try {
      const res = await api.get<{ data: any[] }>(`/material-lots?category=${encodeURIComponent(tab)}`);
      setHistory((res.data || []).slice(0, 20));
    } catch { setHistory([]); }
  };

  useEffect(() => {
    setForm({ ...defaultForm, length_mm: activeTab === '세라믹울' ? '7400' : '' });
    fetchNextLot(activeTab);
    fetchHistory(activeTab);
  }, [activeTab]);

  // 자동 판정
  useEffect(() => {
    if (form.n1 && form.n2 && form.n3 && form.thickness) {
      const avg = (parseFloat(form.n1) + parseFloat(form.n2) + parseFloat(form.n3)) / 3;
      upd('result', avg >= parseFloat(form.thickness) ? '합격' : '불합격');
    }
  }, [form.n1, form.n2, form.n3, form.thickness]);

  const handleSubmit = async () => {
    if (!form.lot_number || !form.density || !form.thickness || !form.width_mm || !form.qty_current || !form.result) {
      toast.error('필수 항목을 모두 입력해 주세요.'); return;
    }
    if (form.result !== '합격') { toast.error('불합격 자재는 격리 처리하세요.'); return; }
    try {
      await api.post('/material-lots', {
        lot_number: form.lot_number,
        category: activeTab,
        item_name: `${form.density}K ${form.thickness}T ${form.width_mm}W ${form.length_mm}L`,
        density: parseFloat(form.density),
        thickness: parseFloat(form.thickness),
        width_mm: parseFloat(form.width_mm),
        length_mm: parseFloat(form.length_mm || '0'),
        unit: '롤',
        qty_current: parseFloat(form.qty_current),
        supplier_name: form.supplier_name,
        supplier_lot: form.supplier_lot,
        received_date: new Date().toISOString().slice(0, 10)
      });
      toast.success(`✅ ${activeTab} LOT [${form.lot_number}] 등록 완료! 재고에 자동 반영되었습니다.`);
      await fetchNextLot(activeTab);
      await fetchHistory(activeTab);
      setForm(p => ({ ...defaultForm, lot_number: p.lot_number, length_mm: activeTab === '세라믹울' ? '7400' : '' }));
    } catch (e: any) {
      toast.error(e?.body?.message || e?.message || '등록 중 오류 발생');
    }
  };

  const densityOptions = activeTab === '세라믹울' ? ['96','100','120','128'] : ['24','32','48'];
  const thicknessOptions = activeTab === '세라믹울' ? ['25','38','50'] : ['25','50'];
  const widthOptions = activeTab === '세라믹울' ? ['150','200','300','400','600'] : ['500','1000','1200'];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="pt-2 pb-1">
          <h1 className="text-xl font-black text-white">📥 원자재 인수검사</h1>
          <p className="text-xs text-slate-400 mt-0.5">C302 규정 · 입고 → 검사 → LOT 자동채번 → 재고 등록</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
          {(['세라믹울','그라스울','그라스울보드'] as TabType[]).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn('px-4 py-1.5 rounded-full text-sm font-bold transition-all border-2',
                activeTab === t ? TAB_COLORS[t] + ' border-transparent shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* 입력 카드 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-4">
          <p className="text-sm font-bold text-slate-300">▼ 입고 정보</p>

          {/* 규격 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>밀도 (K) *</label>
              <select className={SEL} value={form.density} onChange={e => upd('density', e.target.value)}>
                <option value="">선택</option>
                {densityOptions.map(v => <option key={v} value={v}>{v}K</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>두께 (T) *</label>
              <select className={SEL} value={form.thickness} onChange={e => upd('thickness', e.target.value)}>
                <option value="">선택</option>
                {thicknessOptions.map(v => <option key={v} value={v}>{v}T</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>폭 (W) *</label>
              <select className={SEL} value={form.width_mm} onChange={e => upd('width_mm', e.target.value)}>
                <option value="">선택</option>
                {widthOptions.map(v => <option key={v} value={v}>{v}W</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>롤 길이 (L)</label>
              <input type="number" className={INP} value={form.length_mm} onChange={e => upd('length_mm', e.target.value)} placeholder="7400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>공급업체명</label>
              <input className={INP} value={form.supplier_name} onChange={e => upd('supplier_name', e.target.value)} placeholder="예: OO섬유" />
            </div>
            <div>
              <label className={LBL}>밀시트 LOT</label>
              <input className={INP} value={form.supplier_lot} onChange={e => upd('supplier_lot', e.target.value)} placeholder="공급업체 LOT" />
            </div>
            <div>
              <label className={LBL}>입고수량 (롤) *</label>
              <input type="number" className={INP} value={form.qty_current} onChange={e => upd('qty_current', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={LBL}>LOT 번호 (자동채번, 수정가능) *</label>
              <input className={cn(INP, 'font-mono font-bold text-amber-400')} value={form.lot_number} onChange={e => upd('lot_number', e.target.value)} placeholder="자동채번 중..." />
            </div>
          </div>

          {/* 검사 항목 */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-sm font-bold text-slate-300 mb-3">▼ 두께 실측값 (mm)</p>
            <div className="grid grid-cols-3 gap-3">
              {(['n1','n2','n3'] as const).map(n => (
                <div key={n}>
                  <label className={LBL}>{n.toUpperCase()}</label>
                  <input type="number" step="0.1" className={INP} value={form[n]} onChange={e => upd(n, e.target.value)} placeholder="0.0" />
                </div>
              ))}
            </div>
            {form.n1 && form.n2 && form.n3 && form.thickness && (
              <p className="text-xs mt-2 text-slate-400">
                평균: <span className="font-bold text-white">{((+form.n1+Number(form.n2)+Number(form.n3))/3).toFixed(1)}mm</span>
                &nbsp;/ 기준: <span className="font-bold">{form.thickness}T 이상</span>
                &nbsp;→ <span className={form.result === '합격' ? 'text-emerald-400 font-black' : 'text-red-400 font-black'}>{form.result}</span>
              </p>
            )}
          </div>

          {/* 체크박스 */}
          <div className="space-y-2">
            {activeTab === '세라믹울' ? (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.check1} onChange={e => upd('check1', e.target.checked)} className="accent-amber-500" />
                  숏(Shot) 함유량 25% 이하 확인
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.check2} onChange={e => upd('check2', e.target.checked)} className="accent-amber-500" />
                  외관 이상 없음 확인
                </label>
              </>
            ) : (
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.check1} onChange={e => upd('check1', e.target.checked)} className="accent-sky-500" />
                열간수축온도 300℃ 이상 확인
              </label>
            )}
          </div>

          {/* 검사자 + 판정 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>검사자</label>
              <input className={INP} value={form.inspector} onChange={e => upd('inspector', e.target.value)} />
            </div>
            <div>
              <label className={LBL}>판정</label>
              <div className="flex gap-4 mt-2">
                {(['합격','불합격'] as const).map(r => (
                  <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="result" value={r} checked={form.result === r} onChange={() => upd('result', r)} className="accent-emerald-500" />
                    <span className={cn('text-sm font-bold', r === '합격' ? 'text-emerald-400' : 'text-red-400')}>{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 등록 버튼 */}
          <button
            onClick={handleSubmit}
            className={cn('w-full py-3 rounded-xl font-black text-base transition-all',
              form.result === '합격' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' :
              form.result === '불합격' ? 'bg-red-700 text-white opacity-60 cursor-not-allowed' :
              'bg-slate-700 text-slate-400'
            )}
          >
            {form.result === '합격' ? '✅ 합격 등록 → 재고 자동 반영' : form.result === '불합격' ? '❌ 불합격 (격리 처리)' : '판정 후 등록 가능'}
          </button>
        </div>

        {/* 이력 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
          <p className="text-sm font-bold text-slate-300 mb-3">📋 최근 검사·입고 이력</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left pb-2">날짜</th>
                  <th className="text-left pb-2">LOT</th>
                  <th className="text-left pb-2">품목</th>
                  <th className="text-right pb-2">수량</th>
                  <th className="text-right pb-2">위치</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">이력 없음</td></tr>
                ) : history.map((r: any) => (
                  <tr key={r.lot_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 text-slate-400">{String(r.received_date || '').slice(0, 10)}</td>
                    <td className="py-2 font-mono font-bold text-amber-400">{r.lot_number}</td>
                    <td className="py-2 text-slate-300">{r.item_name}</td>
                    <td className="py-2 text-right text-white">{r.qty_current}롤</td>
                    <td className="py-2 text-right text-slate-400">{r.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
