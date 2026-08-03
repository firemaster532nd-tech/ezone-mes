import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { BarChart2 } from 'lucide-react';

const MONTHS = ['일','이','삼','사','오','육','칠','팔','구','십','십일','십이'];

export function SalesStatusPage({ type }: { type: 'quotation' | 'delivery' }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState<any[]>([]);
  const [byCust, setByCust] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const endpoint = type === 'delivery' ? `/sales-delivery/status?year=${year}` : `/quotations?year=${year}&limit=500`;
    if (type === 'delivery') {
      api.get<{data:{monthly:any[];by_customer:any[]}}>(`/sales-delivery/status?year=${year}`).then(r=>{
        setMonthly(r.data.monthly||[]); setByCust(r.data.by_customer||[]);
      }).catch(()=>{}).finally(()=>setLoading(false));
    } else {
      // 곬적 현황은 일단 전보부터 가져오는 방식
      api.get<{data:any[]}>(`/quotations?startDate=${year}-01-01&endDate=${year}-12-31`).then(r=>{
        const data = r.data||[];
        const monthMap: Record<number,{cnt:number;amount:number}> = {};
        for (let m=1;m<=12;m++) monthMap[m]={cnt:0,amount:0};
        data.forEach((q:any)=>{
          const m = new Date(q.quotation_date).getMonth()+1;
          if (monthMap[m]) { monthMap[m].cnt++; monthMap[m].amount+=Number(q.total_amount||0); }
        });
        setMonthly(Object.entries(monthMap).map(([month,v])=>({month:Number(month),...v})));
        const custMap: Record<string,{cnt:number;amount:number}> = {};
        data.forEach((q:any)=>{ const n=q.company_name||'미지정'; if(!custMap[n]) custMap[n]={cnt:0,amount:0}; custMap[n].cnt++; custMap[n].amount+=Number(q.total_amount||0); });
        setByCust(Object.entries(custMap).map(([company_name,v])=>({company_name,...v})).sort((a,b)=>b.amount-a.amount).slice(0,10));
      }).catch(()=>{}).finally(()=>setLoading(false));
    }
  }, [year, type]);

  const totalAmount = monthly.reduce((s,m)=>s+(Number(m.amount||m.supply||0)),0);
  const totalCnt    = monthly.reduce((s,m)=>s+(Number(m.cnt||0)),0);
  const maxAmount   = Math.max(...monthly.map(m=>Number(m.amount||m.supply||0)), 1);

  const title = type === 'delivery' ? '판매 현황' : '견적서 현황';

  return (
    <div className="space-y-4">
      <PageHeader title={title} description="월별 집계 현황 및 거래처별 통계" />
      {/* 연도 선택 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
        <label className="text-sm font-medium text-slate-600">년도</label>
        <select value={year} onChange={e=>setYear(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
          {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="ml-auto flex gap-6 text-sm">
          <div><span className="text-slate-500">총건수:</span> <span className="font-bold">{totalCnt}건</span></div>
          <div><span className="text-slate-500">총금액:</span> <span className="font-bold font-mono">{totalAmount.toLocaleString()}원</span></div>
        </div>
      </div>
      {/* 월별 막대 차트 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">월별 현황</h3>
        {loading ? <div className="h-32 flex items-center justify-center text-slate-400">로딩 중...</div> : (
          <div className="flex items-end gap-2 h-40">
            {monthly.map(m=>{
              const amt = Number(m.amount||m.supply||0);
              const pct = maxAmount > 0 ? (amt/maxAmount)*100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-slate-500 font-mono">{amt>0?Math.round(amt/10000)+'만':''}</div>
                  <div className="w-full bg-blue-500 rounded-t-sm transition-all" style={{height:`${Math.max(pct,2)}%`}} />
                  <div className="text-[10px] text-slate-600">{MONTHS[m.month-1]}월</div>
                  <div className="text-[10px] text-slate-400">{m.cnt}건</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* 거래처별 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold text-slate-700">거래처별 현황 (TOP 10)</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-right">건수</th>
              <th className="px-4 py-2 text-right">금액</th>
              <th className="px-4 py-2 text-right">비율</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {byCust.map((c,i)=>(
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{c.company_name}</td>
                <td className="px-4 py-2 text-right">{c.cnt}건</td>
                <td className="px-4 py-2 text-right font-mono">{Number(c.amount).toLocaleString()}월</td>
                <td className="px-4 py-2 text-right text-slate-500">{totalAmount>0?((Number(c.amount)/totalAmount)*100).toFixed(1)+'%':'-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
