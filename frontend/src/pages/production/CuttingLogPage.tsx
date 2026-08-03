import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Scissors, PlusCircle, CheckCircle2, Package, Layers, Calendar, User, Printer, FileText } from 'lucide-react';

interface CuttingCategoryConfig {
  id: string;
  formNumber: string;
  name: string;
  widthMm: number;
  lengthMm?: number;
  color: string;
  bgColor: string;
  defaultThickness: number;
  defaultDensity: number;
}

const CUTTING_CATEGORIES: CuttingCategoryConfig[] = [
  {
    id: 'RISER_300',
    formNumber: 'EZC B-201-12',
    name: '차열재 재단생산일지',
    widthMm: 300,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    defaultThickness: 25,
    defaultDensity: 120,
  },
  {
    id: 'GAP_SHEET_COMPOSITE',
    formNumber: 'EZC B-201-13',
    name: '틈새복합시트 차열재 재단생산일지',
    widthMm: 200,
    lengthMm: 1000,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    defaultThickness: 25,
    defaultDensity: 96,
  },
  {
    id: 'GENERAL_CUT',
    formNumber: 'EZC B-201-14',
    name: '일반 재단생산일지',
    widthMm: 170,
    lengthMm: 1000,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50 border-sky-200',
    defaultThickness: 1,
    defaultDensity: 100,
  },
];

interface CuttingItem {
  id: string;
  structName: string;
  widthMm: number;
  lengthMm: number;
  incomingLot: string;
  densityK: number;
  thicknessT: number;
  qty: number;
  remarks: string;
}

export function CuttingLogPage() {
  const [selectedCategory, setSelectedCategory] = useState<CuttingCategoryConfig>(CUTTING_CATEGORIES[0]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [worker, setWorker] = useState<string>('재단작업자');
  const [thickness, setThickness] = useState<number>(25);
  const [density, setDensity] = useState<number>(120);

  // 원자재 인수검사 LOT 목록 (세라믹울 / 그라스울)
  const [materialLots, setMaterialLots] = useState<any[]>([]);

  // 재단 품목 목록
  const [items, setItems] = useState<CuttingItem[]>([
    {
      id: '1',
      structName: 'VT-049',
      widthMm: 400,
      lengthMm: 300,
      incomingLot: '',
      densityK: 120,
      thicknessT: 25,
      qty: 10,
      remarks: '',
    },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 원자재 LOT & 최근 일지 로드
  useEffect(() => {
    fetchMaterialLots();
    fetchRecentLogs();
  }, []);

  const fetchMaterialLots = async () => {
    try {
      const res = await api.get<any>('/material-lots?category=세라믹울');
      const data = res.data || res || [];
      if (Array.isArray(data)) {
        setMaterialLots(data);
        if (data.length > 0) {
          setItems(prev => prev.map(item => ({ ...item, incomingLot: item.incomingLot || data[0].lot_number })));
        }
      }
    } catch (e) {
      console.error('Failed to load raw material lots', e);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const res = await api.get<any>('/process-logs');
      const data = res.data || res || [];
      if (Array.isArray(data)) {
        setRecentLogs(data.filter((l: any) => l.process_code === 'CUT').slice(0, 15));
      }
    } catch (e) {
      console.error('Failed to load process logs', e);
    }
  };

  // 카테고리 변경 시 초기값 맞춤
  const handleCategorySelect = (cat: CuttingCategoryConfig) => {
    setSelectedCategory(cat);
    setThickness(cat.defaultThickness);
    setDensity(cat.defaultDensity);
    if (cat.id === 'GAP_SHEET_COMPOSITE') {
      setItems([
        {
          id: '1',
          structName: '틈새복합시트',
          widthMm: 200,
          lengthMm: 1000,
          incomingLot: materialLots[0]?.lot_number || '',
          densityK: 96,
          thicknessT: 25,
          qty: 10,
          remarks: '',
        },
      ]);
    } else {
      setItems([
        {
          id: '1',
          structName: 'VT-049',
          widthMm: cat.widthMm,
          lengthMm: 300,
          incomingLot: materialLots[0]?.lot_number || '',
          densityK: cat.defaultDensity,
          thicknessT: cat.defaultThickness,
          qty: 10,
          remarks: '',
        },
      ]);
    }
  };

  const addItem = () => {
    const newItem: CuttingItem = {
      id: Date.now().toString(),
      structName: selectedCategory.id === 'GAP_SHEET_COMPOSITE' ? '틈새복합시트' : 'HTG-064',
      widthMm: selectedCategory.widthMm,
      lengthMm: selectedCategory.lengthMm || 300,
      incomingLot: materialLots[0]?.lot_number || '',
      densityK: density,
      thicknessT: thickness,
      qty: 10,
      remarks: '',
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, field: keyof CuttingItem, val: any) => {
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
      const totalQty = items.reduce((acc, cur) => acc + (Number(cur.qty) || 0), 0);
      const res = await api.post<any>('/process-logs', {
        process_code: 'CUT',
        shift: 'AM',
        worker_names: [worker],
        planned_qty: totalQty,
        raw_material_inputs: items.map(i => ({
          struct_name: i.structName,
          width_mm: i.widthMm,
          length_mm: i.lengthMm,
          incoming_lot: i.incomingLot,
          density: i.densityK,
          thickness: i.thicknessT,
          qty: i.qty,
          remarks: i.remarks,
        })),
        form_number: selectedCategory.formNumber,
        category_name: selectedCategory.name,
      });

      alert(`✅ ${selectedCategory.formNumber} ${selectedCategory.name} 작성이 저장되었습니다! (총 ${totalQty} EA)`);
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
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Scissors className="w-7 h-7 mr-2 text-amber-600" />
            전자 차열재 재단생산일지 관리
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            사규 EZC B-201-12 (차열재 재단생산일지) 및 EZC B-201-13 (틈새복합시트 차열재 재단생산일지) 기준
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

      {/* Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {CUTTING_CATEGORIES.map(cat => {
          const isSelected = selectedCategory.id === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? `${cat.bgColor} ring-2 ring-amber-400 shadow-md`
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-[10px] font-mono text-slate-500 font-bold">{cat.formNumber}</div>
              <div className={`font-bold text-sm ${isSelected ? cat.color : 'text-slate-800'}`}>
                {cat.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                폭: {cat.widthMm}mm {cat.lengthMm ? `× ${cat.lengthMm}mm` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 space-y-6">
        {/* Top Header Information */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4">
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
              <User className="w-3.5 h-3.5 text-slate-500" /> 작업자
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
            <label className="block text-xs font-bold text-slate-700 mb-1">두께 (T)</label>
            <select
              value={thickness}
              onChange={e => setThickness(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-amber-900"
            >
              <option value={25}>25 T (표준)</option>
              <option value={38}>38 T</option>
              <option value={50}>50 T</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">밀도 (K)</label>
            <select
              value={density}
              onChange={e => setDensity(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-indigo-900"
            >
              <option value={96}>96 K (틈새복합시트)</option>
              <option value={100}>100 K</option>
              <option value={120}>120 K (차열재)</option>
              <option value={128}>128 K</option>
            </select>
          </div>
        </div>

        {/* Table of Cutting Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              재단 세부 항목 목록 [{selectedCategory.formNumber}]
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 행 추가
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-100 uppercase text-[11px] text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">No</th>
                  <th className="px-3 py-2.5">구조명</th>
                  <th className="px-3 py-2.5 w-44">가로 x 세로 규격 (mm)</th>
                  <th className="px-3 py-2.5 w-48">세라믹울 인수검사 LOT</th>
                  <th className="px-3 py-2.5 w-24 text-center">밀도 (K)</th>
                  <th className="px-3 py-2.5 w-28 text-right">생산수량 (EA)</th>
                  <th className="px-3 py-2.5">비고 / 특이사항</th>
                  <th className="px-3 py-2.5 w-12 text-center">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.structName}
                        onChange={e => updateItem(item.id, 'structName', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                        placeholder="예: VT-049"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          value={item.widthMm}
                          onChange={e => updateItem(item.id, 'widthMm', Number(e.target.value))}
                          className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs text-center font-bold"
                          required
                        />
                        <span>×</span>
                        <input
                          type="number"
                          value={item.lengthMm}
                          onChange={e => updateItem(item.id, 'lengthMm', Number(e.target.value))}
                          className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs text-center font-bold"
                          required
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.incomingLot}
                        onChange={e => updateItem(item.id, 'incomingLot', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono bg-white"
                      >
                        <option value="">-- 원자재 LOT 선택 --</option>
                        {materialLots.map(m => (
                          <option key={m.lot_id || m.lot_number} value={m.lot_number}>
                            {m.lot_number} ({m.density || 120}K, {m.qty_current}롤)
                          </option>
                        ))}
                        <option value="251110CW001">251110CW001 (기본)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-indigo-700">
                      {item.densityK} K
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-right text-emerald-700"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={e => updateItem(item.id, 'remarks', e.target.value)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                        placeholder="특이사항..."
                      />
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          {submitting ? '재단생산일지 저장 중...' : `${selectedCategory.formNumber} 재단생산일지 작성 완료 및 저장`}
        </button>
      </form>

      {/* Recent Cutting Production Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" />
          최근 작성된 재단생산일지 이력 (최신 15건)
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 text-[11px] text-slate-600 font-bold uppercase border-b">
              <tr>
                <th className="px-4 py-2.5">일지 ID</th>
                <th className="px-4 py-2.5">공정코드</th>
                <th className="px-4 py-2.5">작업자</th>
                <th className="px-4 py-2.5 text-right">총 재단 수량</th>
                <th className="px-4 py-2.5">생산 일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 font-sans">
                    작성된 최근 재단생산일지가 없습니다.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log: any) => (
                  <tr key={log.log_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">#CUT-{log.log_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                        {log.process_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans font-semibold">
                      {Array.isArray(log.worker_names) ? log.worker_names.join(', ') : log.worker_id || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                      {log.planned_qty || 0} EA
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

export default CuttingLogPage;
