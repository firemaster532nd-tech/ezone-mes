import React, { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const AccountingPLPage: React.FC = () => {
  const [yearMonth, setYearMonth] = useState('2026-07');
  const [profitMargin, setProfitMargin] = useState(15);

  const confirmPL = async () => {
    try {
      // await api.post('/api/accounting/pl/confirm', { yearMonth });
      toast.success('마감 확정되었습니다.');
    } catch {
      toast.error('마감 실패');
    }
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 20) return 'text-green-600';
    if (margin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">손익 분석 (P&L)</h1>
        <div>
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="border p-2 rounded mr-2" />
          <button onClick={confirmPL} className="bg-blue-600 text-white px-4 py-2 rounded">마감 확정</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="border p-4 rounded shadow bg-white">
          <h2 className="font-bold text-lg mb-4">원가 구성</h2>
          <div className="flex justify-center items-center">
             <svg viewBox="0 0 100 100" className="w-48 h-48">
               <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="20" strokeDasharray="100 150" />
               <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="20" strokeDasharray="50 200" strokeDashoffset="-100" />
             </svg>
          </div>
        </div>

        <div className="border p-4 rounded shadow bg-white">
          <h2 className="font-bold text-lg mb-4">손익 요약</h2>
          <div className="space-y-2">
            <div className="flex justify-between border-b pb-1"><span>매출액:</span> <span>100,000,000 원</span></div>
            <div className="flex justify-between border-b pb-1"><span>총원가:</span> <span>85,000,000 원</span></div>
            <div className="flex justify-between border-b pb-1"><span>매출총이익:</span> <span>15,000,000 원</span></div>
            <div className={`flex justify-between font-bold text-xl ${getMarginColor(profitMargin)}`}>
              <span>이익률:</span> <span>{profitMargin}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingPLPage;
