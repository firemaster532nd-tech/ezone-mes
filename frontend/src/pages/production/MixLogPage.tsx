import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Flame, PlusCircle, CheckCircle2, Calendar, User, Clock, Printer, FileText } from 'lucide-react';

interface MixBatchItem {
  id: string;
  lotNumber: string;
  startTime: string;
  endTime: string;
  usage: string;
  inputKg: number;
  remarks: string;
}

export function MixLogPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [worker, setWorker] = useState<string>('배합작업자');
  const [equipNo, setEquipNo] = useState<string>('EZC-M-09');
  const [stopReason, setStopReason] = useState<string>('');

  const [batches, setBatches] = useState<MixBatchItem[]>([
    {
      id: '1',
      lotNumber: `${new Date().toISOString().replace(/-/g, '').slice(2, 8)}-S01`,
      startTime: '08:30',
      endTime: '09:30',
      usage: '차열시트 컴파운드 배합',
      inputKg: 100,
      remarks: '정상 배합 완료',
    },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecentLogs();
  }, []);

  const fetchRecentLogs = async () => {
    try {
      const res = await api.get<any>('/process-logs');
      const data = res.data || res || [];
      if (Array.isArray(data)) {
        setRecentLogs(data.filter((l: any) => l.process_code === 'MIX').slice(0, 15));
      }
    } catch (e) {
      console.error('Failed to load mix logs', e);
    }
  };

  const addBatch = () => {
    const seq = String(batches.length + 1).padStart(2, '0');
    const d = date.replace(/-/g, '').slice(2);
    setBatches(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        lotNumber: `${d}-S${seq}`,
        startTime: '09:30',
        endTime: '10:30',
        usage: '차열시트 컴파운드 배합',
        inputKg: 100,
        remarks: '',
      },
    ]);
  };

  const updateBatch = (id: string, field: keyof MixBatchItem, val: any) => {
    setBatches(prev => prev.map(b => (b.id === id ? { ...b, [field]: val } : b)));
  };

  const removeBatch = (id: string) => {
    if (batches.length <= 1) return;
    setBatches(prev => prev.filter(b => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const totalKg = batches.reduce((acc, cur) => acc + (Number(cur.inputKg) || 0), 0);
      await api.post<any>('/process-logs', {
        process_code: 'MIX',
        shift: 'AM',
        worker_names: [worker],
        planned_qty: totalKg,
        raw_material_inputs: batches,
        form_number: 'EZC B-201-1',
        category_name: '배합생산일지',
        stop_reason: stopReason,
      });

      alert(`✅ [EZC B-201-1] 배합생산일지가 저장되었습니다! (총 ${batches.length}건, ${totalKg}kg)`);
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
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full w-fit mb-1">
            EZC B-201-1 (주)이지원
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Flame className="w-7 h-7 mr-2 text-blue-600" />
            배합생산일지 (EZC B-201-1)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            차열시트 컴파운드 배합 생산 LOT 번호(YYMMDD-S01) 생성 및 투입 중량(kg) 관리
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
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">설비번호</label>
            <input
              type="text"
              value={equipNo}
              onChange={e => setEquipNo(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold font-mono text-blue-900"
            />
          </div>
        </div>

        {/* Batches Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Flame className="w-4 h-4 text-blue-600" />
              ■ 배합생산현황 (단위: kg)
            </h3>
            <button
              type="button"
              onClick={addBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 배합 LOT 추가
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-100 uppercase text-[11px] text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">No</th>
                  <th className="px-3 py-2.5 w-44">생산 LOT No.</th>
                  <th className="px-3 py-2.5 w-32">시작시간</th>
                  <th className="px-3 py-2.5 w-32">종료시간</th>
                  <th className="px-3 py-2.5">용도</th>
                  <th className="px-3 py-2.5 w-28 text-right">투입량 (kg)</th>
                  <th className="px-3 py-2.5">비고</th>
                  <th className="px-3 py-2.5 w-12 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batches.map((batch, idx) => (
                  <tr key={batch.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={batch.lotNumber}
                        onChange={e => updateBatch(batch.id, 'lotNumber', e.target.value)}
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono font-bold text-blue-700"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={batch.startTime}
                        onChange={e => updateBatch(batch.id, 'startTime', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={batch.endTime}
                        onChange={e => updateBatch(batch.id, 'endTime', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={batch.usage}
                        onChange={e => updateBatch(batch.id, 'usage', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                        placeholder="예: 차열시트 배합"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={batch.inputKg}
                        onChange={e => updateBatch(batch.id, 'inputKg', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-blue-700"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={batch.remarks}
                        onChange={e => updateBatch(batch.id, 'remarks', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        placeholder="특이사항..."
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeBatch(batch.id)}
                        className="text-slate-400 hover:text-red-600 font-bold"
                        disabled={batches.length <= 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Remarks / Stopping Reason */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ■ 품질적 특이사항 및 조치사항 / 생산정지 사유
          </label>
          <textarea
            value={stopReason}
            onChange={e => setStopReason(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
            placeholder="특이사항 또는 설비 정지 사유 입력..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          {submitting ? '배합생산일지 저장 중...' : 'EZC B-201-1 배합생산일지 저장 및 배합 LOT 발행'}
        </button>
      </form>

      {/* Recent Mix Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          최근 작성된 배합생산일지 이력
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 text-[11px] text-slate-600 font-bold uppercase border-b">
              <tr>
                <th className="px-4 py-2.5">로그 ID</th>
                <th className="px-4 py-2.5">공정코드</th>
                <th className="px-4 py-2.5">작업자</th>
                <th className="px-4 py-2.5 text-right">총 배합 중량 (kg)</th>
                <th className="px-4 py-2.5">등록일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                    작성된 배합생산일지 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log: any) => (
                  <tr key={log.log_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">#MIX-{log.log_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded">
                        {log.process_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans font-semibold">
                      {Array.isArray(log.worker_names) ? log.worker_names.join(', ') : log.worker_id || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">
                      {log.planned_qty || 0} kg
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

export default MixLogPage;
