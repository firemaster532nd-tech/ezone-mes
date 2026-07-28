import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';

interface WorkforceRow {
  input_id?: number;
  input_date: string;
  factory: string;
  process_code: string;
  worker_count: number;
  plan_hours: number;
  actual_hours: number | null;
  downtime_min: number;
  downtime_code: string;
  downtime_memo: string;
  site_name: string;
  notes: string;
}

const PROCESSES = [
  { code: 'MIX',    label: '배합',        factory: '1F' },
  { code: 'EXT_1',  label: '압출 1호기',   factory: '1F' },
  { code: 'EXT_2',  label: '압출 2호기',   factory: '1F' },
  { code: 'CUT',    label: '재단',        factory: '2F' },
  { code: 'ASM',    label: '조립',        factory: '2F' },
  { code: 'FN_ASM', label: 'FN조립',     factory: '2F' },
  { code: 'INSP',   label: '검사',        factory: '2F' },
  { code: 'SHIP',   label: '출하',        factory: '2F' },
];

const FIELD_PROCESS = { code: 'FIELD', label: '현장용역', factory: 'FIELD' };

const DOWNTIME_CODES = [
  { code: 'NONE',      label: '없음' },
  { code: 'BREAKDOWN', label: '설비고장' },
  { code: 'SHORTAGE',  label: '재료부족' },
  { code: 'QUALITY',   label: '품질문제' },
  { code: 'MEETING',   label: '교육·회의' },
  { code: 'OTHER',     label: '기타' },
];

export const DailyWorkforcePage: React.FC = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<Record<string, WorkforceRow>>({});
  const [fieldRows, setFieldRows] = useState<WorkforceRow[]>([]);
  const [saving, setSaving] = useState(false);

  const createEmptyRow = (procCode: string, factory: string): WorkforceRow => ({
    input_date: date,
    factory,
    process_code: procCode,
    worker_count: 0,
    plan_hours: 8.0,
    actual_hours: null,
    downtime_min: 0,
    downtime_code: 'NONE',
    downtime_memo: '',
    site_name: '',
    notes: '',
  });

  const fetchData = async (targetDate: string) => {
    try {
      const res = await api.get(`/api/production/workforce?date=${targetDate}`);
      const data: WorkforceRow[] = res.data.data;
      
      const newRows: Record<string, WorkforceRow> = {};
      PROCESSES.forEach(p => {
        newRows[p.code] = createEmptyRow(p.code, p.factory);
      });
      
      const newFieldRows: WorkforceRow[] = [];
      
      data.forEach(item => {
        if (item.factory === 'FIELD') {
          newFieldRows.push(item);
        } else if (newRows[item.process_code]) {
          newRows[item.process_code] = { ...item };
        }
      });
      
      setRows(newRows);
      setFieldRows(newFieldRows);
    } catch (err) {
      toast.error('데이터 조회 실패');
    }
  };

  useEffect(() => {
    fetchData(date);
  }, [date]);

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const copyFromYesterday = async () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];
    
    try {
      const res = await api.get(`/api/production/workforce?date=${yesterday}`);
      const data: WorkforceRow[] = res.data.data;
      
      const newRows: Record<string, WorkforceRow> = { ...rows };
      const newFieldRows: WorkforceRow[] = [];
      
      data.forEach(item => {
        if (item.factory === 'FIELD') {
          newFieldRows.push({ ...item, input_id: undefined, input_date: date, actual_hours: null });
        } else if (newRows[item.process_code]) {
          newRows[item.process_code] = { 
            ...item, 
            input_id: undefined, 
            input_date: date,
            actual_hours: null // 실가동은 복사 안함
          };
        }
      });
      
      setRows(newRows);
      setFieldRows(newFieldRows);
      toast.success('어제 데이터를 불러왔습니다.');
    } catch (err) {
      toast.error('어제 데이터 조회 실패');
    }
  };

  const handleRowChange = (code: string, field: keyof WorkforceRow, value: any) => {
    setRows(prev => ({
      ...prev,
      [code]: { ...prev[code], [field]: value }
    }));
  };

  const handleFieldRowChange = (idx: number, field: keyof WorkforceRow, value: any) => {
    const newFields = [...fieldRows];
    newFields[idx] = { ...newFields[idx], [field]: value };
    setFieldRows(newFields);
  };

  const addFieldRow = () => {
    setFieldRows([...fieldRows, createEmptyRow(FIELD_PROCESS.code, FIELD_PROCESS.factory)]);
  };

  const removeFieldRow = (idx: number) => {
    const newFields = [...fieldRows];
    newFields.splice(idx, 1);
    setFieldRows(newFields);
  };

  const handleSave = async () => {
    // Validation
    const allRows = [...Object.values(rows), ...fieldRows];
    for (const row of allRows) {
      if (row.factory !== 'FIELD') {
        const downtimeMin = row.downtime_min || 0;
        if (downtimeMin > 0 && row.downtime_code === 'NONE') {
          toast.error(`${PROCESSES.find(p => p.code === row.process_code)?.label}: 비가동 시간이 있으면 사유를 선택해야 합니다.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await api.post('/api/production/workforce/bulk', {
        date,
        rows: allRows
      });
      toast.success('저장되었습니다.');
      fetchData(date);
    } catch (err) {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const factoryTotal = Object.values(rows).reduce((acc, r) => acc + (Number(r.worker_count) || 0), 0);
  const fieldTotal = fieldRows.reduce((acc, r) => acc + (Number(r.worker_count) || 0), 0);
  const grandTotal = factoryTotal + fieldTotal;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <PageHeader title="일일 인력 투입 입력" />

      <div className="flex items-center gap-3 mb-6">
        <button className="px-3 py-1 bg-white border rounded shadow-sm hover:bg-gray-50" onClick={prevDay}>&lt;</button>
        <input 
          type="date" 
          className="border rounded px-3 py-1 shadow-sm"
          value={date} 
          onChange={e => setDate(e.target.value)} 
        />
        <button className="px-3 py-1 bg-white border rounded shadow-sm hover:bg-gray-50" onClick={nextDay}>&gt;</button>
        <button 
          className="px-4 py-1 bg-white border border-blue-200 text-blue-600 rounded shadow-sm hover:bg-blue-50 ml-4"
          onClick={copyFromYesterday}
        >
          [어제 데이터 복사]
        </button>
      </div>

      <div className="space-y-6">
        {/* 1공장 섹션 */}
        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-blue-50 px-4 py-2 font-bold border-b text-blue-900">1공장 (배합·압출)</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2">공정</th>
                <th className="px-2 py-2">투입인원</th>
                <th className="px-2 py-2">계획가동h</th>
                <th className="px-2 py-2">실가동h</th>
                <th className="px-2 py-2">비가동사유</th>
                <th className="px-2 py-2">상세</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSES.filter(p => p.factory === '1F').map(p => {
                const row = rows[p.code];
                if (!row) return null;
                return (
                  <tr key={p.code} className="border-t">
                    <td className="px-4 py-2 font-medium">{p.label}</td>
                    <td className="px-2 py-2"><input type="number" min={0} value={row.worker_count} onChange={e => handleRowChange(p.code, 'worker_count', e.target.value)} className="w-20 border rounded px-2 py-1" /></td>
                    <td className="px-2 py-2"><input type="number" step={0.5} value={row.plan_hours} onChange={e => handleRowChange(p.code, 'plan_hours', e.target.value)} className="w-20 border rounded px-2 py-1 bg-gray-50 text-gray-600" /></td>
                    <td className="px-2 py-2"><input type="number" step={0.5} value={row.actual_hours ?? ''} onChange={e => handleRowChange(p.code, 'actual_hours', e.target.value)} placeholder="0.0" className="w-20 border rounded px-2 py-1" /></td>
                    <td className="px-2 py-2">
                      <select value={row.downtime_code} onChange={e => handleRowChange(p.code, 'downtime_code', e.target.value)} className="border rounded px-2 py-1">
                        {DOWNTIME_CODES.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {row.downtime_code !== 'NONE' && (
                        <input 
                          placeholder="상세 내용" 
                          value={row.downtime_memo} 
                          onChange={e => handleRowChange(p.code, 'downtime_memo', e.target.value)} 
                          className="border rounded px-2 py-1 w-48 bg-yellow-50 focus:bg-yellow-100 outline-none" 
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 2공장 섹션 */}
        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-emerald-50 px-4 py-2 font-bold border-b text-emerald-900">2공장 (재단·조립·검사·출하)</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2">공정</th>
                <th className="px-2 py-2">투입인원</th>
                <th className="px-2 py-2">계획가동h</th>
                <th className="px-2 py-2">실가동h</th>
                <th className="px-2 py-2">비가동사유</th>
                <th className="px-2 py-2">상세</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSES.filter(p => p.factory === '2F').map(p => {
                const row = rows[p.code];
                if (!row) return null;
                return (
                  <tr key={p.code} className="border-t">
                    <td className="px-4 py-2 font-medium">{p.label}</td>
                    <td className="px-2 py-2"><input type="number" min={0} value={row.worker_count} onChange={e => handleRowChange(p.code, 'worker_count', e.target.value)} className="w-20 border rounded px-2 py-1" /></td>
                    <td className="px-2 py-2"><input type="number" step={0.5} value={row.plan_hours} onChange={e => handleRowChange(p.code, 'plan_hours', e.target.value)} className="w-20 border rounded px-2 py-1 bg-gray-50 text-gray-600" /></td>
                    <td className="px-2 py-2"><input type="number" step={0.5} value={row.actual_hours ?? ''} onChange={e => handleRowChange(p.code, 'actual_hours', e.target.value)} placeholder="0.0" className="w-20 border rounded px-2 py-1" /></td>
                    <td className="px-2 py-2">
                      <select value={row.downtime_code} onChange={e => handleRowChange(p.code, 'downtime_code', e.target.value)} className="border rounded px-2 py-1">
                        {DOWNTIME_CODES.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {row.downtime_code !== 'NONE' && (
                        <input 
                          placeholder="상세 내용" 
                          value={row.downtime_memo} 
                          onChange={e => handleRowChange(p.code, 'downtime_memo', e.target.value)} 
                          className="border rounded px-2 py-1 w-48 bg-yellow-50 focus:bg-yellow-100 outline-none" 
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* 현장용역 섹션 */}
        <section className="border rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-amber-100 px-4 py-2 font-bold border-b text-amber-900 flex justify-between items-center">
            <span>현장용역 (일일용역)</span>
            <button 
              onClick={addFieldRow}
              className="px-2 py-1 bg-white rounded text-sm shadow-sm hover:bg-gray-50 border border-amber-200"
            >
              + 현장 추가
            </button>
          </div>
          <div className="p-4 space-y-3">
            {fieldRows.length === 0 && <p className="text-gray-500 text-sm italic">추가된 현장용역이 없습니다.</p>}
            {fieldRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center text-sm bg-amber-50/50 p-2 rounded border border-amber-100">
                <input placeholder="현장명" value={row.site_name} onChange={e => handleFieldRowChange(idx, 'site_name', e.target.value)} className="border rounded px-2 py-1 flex-1" />
                <input type="number" placeholder="인원" value={row.worker_count} onChange={e => handleFieldRowChange(idx, 'worker_count', e.target.value)} className="w-20 border rounded px-2 py-1" />
                <input placeholder="비고" value={row.notes} onChange={e => handleFieldRowChange(idx, 'notes', e.target.value)} className="border rounded px-2 py-1 flex-1" />
                <button onClick={() => removeFieldRow(idx)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full font-bold">X</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg flex items-center justify-between z-10 px-8">
        <div className="text-lg font-bold text-gray-700 max-w-5xl mx-auto flex items-center justify-between w-full">
          <p>공장 <span className="text-blue-600">{factoryTotal}</span>명 + 현장용역 <span className="text-amber-600">{fieldTotal}</span>명 = 총 <span className="text-gray-900 text-xl">{grandTotal}</span>명</p>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold shadow-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};
