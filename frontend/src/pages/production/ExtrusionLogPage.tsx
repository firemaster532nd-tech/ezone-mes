import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Layers, PlusCircle, CheckCircle2, Calendar, User, Clock, Printer, FileText } from 'lucide-react';

interface ExtBatchItem {
  id: string;
  mixLotNumber: string;
  mixKg: number;
  spec: string;
  machine: 'EXT_1' | 'EXT_2';
  lengthMeters: number;
  outputKg: number;
  dummyKg: number;
  remarks: string;
}

export function ExtrusionLogPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [worker, setWorker] = useState<string>('압출작업자');
  const [qualityRemarks, setQualityRemarks] = useState<string>('');

  // 최근 배합 LOT 목록
  const [mixLogs, setMixLogs] = useState<any[]>([]);

  const [items, setItems] = useState<ExtBatchItem[]>([
    {
      id: '1',
      mixLotNumber: `${new Date().toISOString().replace(/-/g, '').slice(2, 8)}-S01`,
      mixKg: 100,
      spec: '차열시트 W170 (t0.5)',
      machine: 'EXT_1',
      lengthMeters: 50,
      outputKg: 95,
      dummyKg: 5,
      remarks: '1호기 노즐 온도 185℃ 가동',
    },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMixLogs();
    fetchRecentLogs();
  }, []);

  const fetchMixLogs = async () => {
    try {
      const res = await api.get<any>('/process-logs');
      const data = res.data || res || [];
      if (Array.isArray(data)) {
        setMixLogs(data.filter((l: any) => l.process_code === 'MIX'));
      }
    } catch (e) {
      console.error('Failed to load mix logs', e);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const res = await api.get<any>('/process-logs');
      const data = res.data || res || [];
      if (Array.isArray(data)) {
        setRecentLogs(data.filter((l: any) => l.process_code === 'EXT_1' || l.process_code === 'EXT_2' || l.process_code === 'EXT').slice(0, 15));
      }
    } catch (e) {
      console.error('Failed to load extrusion logs', e);
    }
  };

  const addItem = () => {
    const newItem: ExtBatchItem = {
      id: Date.now().toString(),
      mixLotNumber: mixLogs[0]?.lot_number || `${date.replace(/-/g, '').slice(2)}-S01`,
      mixKg: 100,
      spec: '차열시트 W170 (t0.5)',
      machine: 'EXT_1',
      lengthMeters: 50,
      outputKg: 95,
      dummyKg: 5,
      remarks: '',
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, field: keyof ExtBatchItem, val: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const totalMeters = items.reduce((acc, cur) => acc + (Number(cur.lengthMeters) || 0), 0);
      await api.post<any>('/process-logs', {
        process_code: 'EXT',
        shift: 'AM',
        worker_names: [worker],
        planned_qty: totalMeters,
        raw_material_inputs: items,
        form_number: 'EZC B-201-2',
        category_name: '압출생산일지',
        quality_remarks: qualityRemarks,
      });

      alert(`✅ [EZC B-201-2] 압출생산일지가 저장되었습니다! (총 ${items.length}건, ${totalMeters}m)`);
      fetchRecentLogs();
    } catch (e: any) {
      alert(`❌ 저장 실패: ${e.message || '오류가 발생했습니다.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full w-fit mb-1">
            EZC B-201-2 (주)이지원
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Layers className="w-7 h-7 mr-2 text-indigo-600" />
            압출생산일지 (EZC B-201-2)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            배합 LOT 승계 ➔ 1·2호기 압출 규격별 생산길이(m), 생산량(kg), 더미(kg) 및 수율 계산
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <Printer className="w-4 h-4 text-slate-600" />
          A4 서식 인쇄
        </button>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 space-y-6">
        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> 생산일자
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" /> 작성자 / 검토자
            </label>
            <input
              type="text"
              value={worker}
              onChange={e => setWorker(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
              required
            />
          </div>
        </div>

        {/* Table of Extrusion Batches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              ■ 압출 생산 세부 항목 (로트부여: 배합 로트번호 승계)
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 압출 행 추가
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-100 uppercase text-[11px] text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">순번</th>
                  <th className="px-3 py-2.5 w-44">투입 배합 LOT 번호</th>
                  <th className="px-3 py-2.5 w-24 text-right">배합(kg)</th>
                  <th className="px-3 py-2.5">규격</th>
                  <th className="px-3 py-2.5 w-28 text-center">압출 설비</th>
                  <th className="px-3 py-2.5 w-28 text-right">생산길이 (m)</th>
                  <th className="px-3 py-2.5 w-28 text-right">생산량 (kg)</th>
                  <th className="px-3 py-2.5 w-24 text-right">더미 (kg)</th>
                  <th className="px-3 py-2.5">비고</th>
                  <th className="px-3 py-2.5 w-12 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => {
                  const totalKg = (item.outputKg || 0) + (item.dummyKg || 0);
                  const yieldPct = totalKg > 0 ? ((item.outputKg / totalKg) * 100).toFixed(1) : '100.0';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <select
                          value={item.mixLotNumber}
                          onChange={e => updateItem(item.id, 'mixLotNumber', e.target.value)}
                          className="w-full border border-indigo-300 rounded px-2 py-1 text-xs font-mono font-bold text-indigo-700 bg-white"
                        >
                          <option value="">-- 배합 LOT 선택 --</option>
                          {mixLogs.map(m => (
                            <option key={m.log_id || m.lot_number} value={m.lot_number}>
                              {m.lot_number} ({m.planned_qty || 100}kg)
                            </option>
                          ))}
                          <option value={`${date.replace(/-/g, '').slice(2)}-S01`}>
                            {date.replace(/-/g, '').slice(2)}-S01 (기본)
                          </option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.mixKg}
                          onChange={e => updateItem(item.id, 'mixKg', Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.spec}
                          onChange={e => updateItem(item.id, 'spec', e.target.value)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                          placeholder="규격..."
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={item.machine}
                          onChange={e => updateItem(item.id, 'machine', e.target.value as any)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-indigo-800 bg-indigo-50"
                        >
                          <option value="EXT_1">1호기</option>
                          <option value="EXT_2">2호기</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.lengthMeters}
                          onChange={e => updateItem(item.id, 'lengthMeters', Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-indigo-700"
                          required
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.outputKg}
                          onChange={e => updateItem(item.id, 'outputKg', Number(e.target.value))}
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-emerald-700"
                          required
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.dummyKg}
                          onChange={e => updateItem(item.id, 'dummyKg', Number(e.target.value))}
                          className="w-16 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-red-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.remarks}
                            onChange={e => updateItem(item.id, 'remarks', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                            placeholder="특이사항..."
                          />
                          <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">
                            (수율: {yieldPct}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-red-600 font-bold"
                          disabled={items.length <= 1}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Remarks */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ■ 품질적 특이사항 및 조치사항
          </label>
          <textarea
            value={qualityRemarks}
            onChange={e => setQualityRemarks(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
            placeholder="압출 품질 특이사항 및 조치 기록..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          {submitting ? '압출생산일지 저장 중...' : 'EZC B-201-2 압출생산일지 작성 완료 및 저장'}
        </button>
      </form>

      {/* Recent Extrusion Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          최근 작성된 압출생산일지 이력
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 text-[11px] text-slate-600 font-bold uppercase border-b">
              <tr>
                <th className="px-4 py-2.5">로그 ID</th>
                <th className="px-4 py-2.5">공정코드</th>
                <th className="px-4 py-2.5">작업자</th>
                <th className="px-4 py-2.5 text-right">총 생산 길이 (m)</th>
                <th className="px-4 py-2.5">등록일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                    작성된 압출생산일지 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log: any) => (
                  <tr key={log.log_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">#EXT-{log.log_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded">
                        {log.process_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans font-semibold">
                      {Array.isArray(log.worker_names) ? log.worker_names.join(', ') : log.worker_id || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-indigo-600">
                      {log.planned_qty || 0} m
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {log.created_at?.slice(0, 16) || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ExtrusionLogPage;
