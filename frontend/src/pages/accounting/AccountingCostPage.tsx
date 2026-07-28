import React, { useState } from 'react';
import { api } from '@/lib/api';

const AccountingCostPage: React.FC = () => {
  const [yearMonth, setYearMonth] = useState('2026-07');

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">원가 현황</h1>
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="border p-2 rounded" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 border rounded shadow bg-white">
          <h3 className="font-bold text-gray-500">인건비</h3>
          <p className="text-2xl">4,500,000 원</p>
        </div>
        <div className="p-4 border rounded shadow bg-white">
          <h3 className="font-bold text-gray-500">간접비</h3>
          <p className="text-2xl">1,200,000 원</p>
        </div>
        <div className="p-4 border rounded shadow bg-white">
          <h3 className="font-bold text-gray-500">운반비</h3>
          <p className="text-2xl">800,000 원</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">원가 항목별 비율</h2>
        <div className="w-full bg-gray-200 rounded-full h-4 flex overflow-hidden">
          <div className="bg-emerald-500 h-4" style={{ width: '50%' }}></div>
          <div className="bg-blue-500 h-4" style={{ width: '30%' }}></div>
          <div className="bg-yellow-500 h-4" style={{ width: '20%' }}></div>
        </div>
        <div className="flex gap-4 mt-2 text-sm text-gray-600">
          <span><span className="inline-block w-3 h-3 bg-emerald-500 mr-1"></span>재료비</span>
          <span><span className="inline-block w-3 h-3 bg-blue-500 mr-1"></span>인건비</span>
          <span><span className="inline-block w-3 h-3 bg-yellow-500 mr-1"></span>기타</span>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">공정별 인건비 Breakdown</h2>
        <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">공정</th>
                <th className="border p-2">정규직</th>
                <th className="border p-2">용역</th>
                <th className="border p-2">합계</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="p-4 text-center">데이터가 없습니다.</td></tr>
            </tbody>
          </table>
      </div>
    </div>
  );
};

export default AccountingCostPage;
