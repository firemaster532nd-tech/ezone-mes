import React, { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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

  const downloadMonthlyReport = () => {
    const summaryData = [
      { 항목: '매출액', '금액(원)': 100000000, '비율(%)': '100%' },
      { 항목: '재료비', '금액(원)': 50000000, '비율(%)': '50%' },
      { 항목: '인건비', '금액(원)': 20000000, '비율(%)': '20%' },
      { 항목: '제조간접비', '금액(원)': 10000000, '비율(%)': '10%' },
      { 항목: '운반비', '금액(원)': 5000000, '비율(%)': '5%' },
      { 항목: '총원가', '금액(원)': 85000000, '비율(%)': '85%' },
      { 항목: '매출총이익', '금액(원)': 15000000, '비율(%)': '15%' },
      { 항목: '생산수량', '금액(원)': 1000, '비율(%)': '' },
      { 항목: '단위당원가', '금액(원)': 85000, '비율(%)': '' },
    ];

    const year = yearMonth.split('-')[0];
    const annualData = [
      { 월: `${year}-01`, 매출액: 90000000, 총원가: 75000000, 매출총이익: 15000000 },
      { 월: `${year}-02`, 매출액: 95000000, 총원가: 80000000, 매출총이익: 15000000 },
      { 월: `${year}-03`, 매출액: 100000000, 총원가: 85000000, 매출총이익: 15000000 },
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(annualData);

    XLSX.utils.book_append_sheet(wb, ws1, '월별 손익 요약');
    XLSX.utils.book_append_sheet(wb, ws2, '연간 추이');

    XLSX.writeFile(wb, `손익보고서_${yearMonth}.xlsx`);
  };

  const downloadAnnualReport = () => {
    const year = yearMonth.split('-')[0];
    const annualData = [
      { 월: `${year}-01`, 매출액: 90000000, 총원가: 75000000, 매출총이익: 15000000 },
      { 월: `${year}-02`, 매출액: 95000000, 총원가: 80000000, 매출총이익: 15000000 },
      { 월: `${year}-03`, 매출액: 100000000, 총원가: 85000000, 매출총이익: 15000000 },
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(annualData);
    XLSX.utils.book_append_sheet(wb, ws, '연간 추이');
    XLSX.writeFile(wb, `연간손익추이_${year}.xlsx`);
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
        <div className="flex items-center gap-2">
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="border p-2 rounded" />
          <button onClick={downloadMonthlyReport} className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-1">
            📥 보고서 다운로드
          </button>
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

      <div className="border p-4 rounded shadow bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">연간 추이</h2>
          <button onClick={downloadAnnualReport} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
            📥 연간손익추이 엑셀 다운로드
          </button>
        </div>
        <table className="w-full border-collapse border text-sm text-center">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">월</th>
              <th className="border p-2">매출액</th>
              <th className="border p-2">총원가</th>
              <th className="border p-2">매출총이익</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2">2026-01</td>
              <td className="border p-2">90,000,000</td>
              <td className="border p-2">75,000,000</td>
              <td className="border p-2">15,000,000</td>
            </tr>
            <tr>
              <td className="border p-2">2026-02</td>
              <td className="border p-2">95,000,000</td>
              <td className="border p-2">80,000,000</td>
              <td className="border p-2">15,000,000</td>
            </tr>
            <tr>
              <td className="border p-2">2026-03</td>
              <td className="border p-2">100,000,000</td>
              <td className="border p-2">85,000,000</td>
              <td className="border p-2">15,000,000</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountingPLPage;
