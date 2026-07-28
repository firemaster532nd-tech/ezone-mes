import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const AccountingRevenuePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">매출 현황</h1>
        <div className="mt-4">
          <select value={year} onChange={(e) => setYear(e.target.value)} className="border p-2 rounded">
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 ${activeTab === 'monthly' ? 'border-b-2 border-emerald-500 font-bold text-emerald-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('monthly')}
        >
          월별현황
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'site' ? 'border-b-2 border-emerald-500 font-bold text-emerald-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('site')}
        >
          현장별현황
        </button>
      </div>

      {activeTab === 'monthly' && (
        <div>
          <div className="mb-6 bg-white p-4 rounded shadow border">
            <h2 className="font-bold mb-4">월별 매출 (만원)</h2>
            <svg viewBox="0 0 500 200" className="w-full h-64 border-l border-b">
              {/* Example bars */}
              <rect x="50" y="50" width="30" height="150" fill="#10b981" />
              <text x="50" y="195" fontSize="10">1월</text>
            </svg>
          </div>
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">월</th>
                <th className="border p-2">주문건수</th>
                <th className="border p-2">매출액</th>
                <th className="border p-2">수량</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="p-4 text-center">데이터가 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'site' && (
        <div>
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">현장명</th>
                <th className="border p-2">주문건수</th>
                <th className="border p-2">매출액</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={3} className="p-4 text-center">데이터가 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountingRevenuePage;
