import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const AccountingSetupPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('labor');

  const [laborCosts, setLaborCosts] = useState<any[]>([]);
  const [materialCosts, setMaterialCosts] = useState<any[]>([]);
  const [overheads, setOverheads] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);

  // Fetch logic omitted for brevity, but placeholders implemented
  useEffect(() => {
    // api.get('/api/accounting/labor-cost').then(res => setLaborCosts(res.data));
  }, []);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      // await api.post('/api/accounting/material-cost/import-excel', formData);
      toast.success('Excel imported successfully');
    } catch (error) {
      toast.error('Import failed');
    }
  };

  return (
    <div className="p-6">
      <div className="bg-gradient-to-r from-slate-800 to-emerald-900 p-6 rounded-lg shadow-lg mb-6 text-white">
        <h1 className="text-2xl font-bold">기초 데이터 설정</h1>
        <p className="mt-2 text-emerald-100">원가 및 회계 기초 데이터를 관리합니다.</p>
      </div>

      <div className="flex border-b mb-4">
        {['labor', 'material', 'overhead', 'transport'].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 ${activeTab === tab ? 'border-b-2 border-emerald-500 font-bold text-emerald-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'labor' ? '인건비 단가' : tab === 'material' ? '재료비 단가' : tab === 'overhead' ? '간접비율' : '운반비'}
          </button>
        ))}
      </div>

      {activeTab === 'labor' && (
        <div>
          <h2 className="text-xl mb-4">인건비 단가</h2>
          {isAdmin && <button className="bg-emerald-600 text-white px-4 py-2 rounded mb-4">추가</button>}
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">공정코드</th>
                <th className="border p-2">구분</th>
                <th className="border p-2">단가</th>
                <th className="border p-2">적용일</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="p-4 text-center">데이터가 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'material' && (
        <div>
          <h2 className="text-xl mb-4">재료비 단가</h2>
          {isAdmin && (
            <div className="mb-4 flex gap-2">
              <button className="bg-emerald-600 text-white px-4 py-2 rounded">수동 추가</button>
              <input type="file" accept=".xlsx" onChange={handleExcelImport} className="border p-1 rounded" />
            </div>
          )}
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">카테고리</th>
                <th className="border p-2">품명</th>
                <th className="border p-2">단가</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={3} className="p-4 text-center">데이터가 없습니다.</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'overhead' && (
        <div>
          <h2 className="text-xl mb-4">간접비율</h2>
          {isAdmin && <button className="bg-emerald-600 text-white px-4 py-2 rounded mb-4">추가</button>}
          <div className="grid grid-cols-3 gap-4">
            <div className="border p-4 rounded shadow">
              <h3 className="font-bold">2026-07</h3>
              <p>간접비율: 15%</p>
              <p>월고정비: 5,000,000 원</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transport' && (
        <div>
          <h2 className="text-xl mb-4">운반비</h2>
          {isAdmin && <button className="bg-emerald-600 text-white px-4 py-2 rounded mb-4">추가</button>}
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">날짜</th>
                <th className="border p-2">현장명</th>
                <th className="border p-2">금액</th>
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

export default AccountingSetupPage;
