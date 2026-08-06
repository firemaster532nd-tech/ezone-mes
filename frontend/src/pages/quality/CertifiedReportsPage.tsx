import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileCheck2, AlertTriangle, CheckCircle2, Clock, Plus, Search, RefreshCw, FileText } from 'lucide-react';

interface CertifiedReport {
  report_id: number;
  category: string;
  item_name: string;
  test_item: string;
  test_standard?: string;
  agency: string;
  issued_date: string;
  expire_date: string;
  test_result?: string;
  min_value?: number;
  max_value?: number;
  unit?: string;
  is_valid: boolean;
  notes?: string;
  days_left: number;
  alert_status: 'EXPIRED' | 'WARNING_3M' | 'VALID';
}

const CATEGORIES = ['전체', '원자재', '세라믹울', '그라스울', 'GI강판', '실란트', '차열시트', '발포소켓', 'PE보온재'];

export function CertifiedReportsPage() {
  const [reports, setReports] = useState<CertifiedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // 신규/수정 폼 상태
  const [formCategory, setFormCategory] = useState('원자재');
  const [formItemName, setFormItemName] = useState('');
  const [formTestItem, setFormTestItem] = useState('');
  const [formAgency, setFormAgency] = useState('KTR 한국화학융합시험연구원');
  const [formIssuedDate, setFormIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTestResult, setFormTestResult] = useState('');
  const [formMinValue, setFormMinValue] = useState<string>('');
  const [formMaxValue, setFormMaxValue] = useState<string>('');
  const [formUnit, setFormUnit] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CertifiedReport[] }>('/certified-reports');
      setReports(res.data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName || !formTestItem || !formAgency) {
      alert('품명, 시험항목, 의뢰기관을 입력해 주세요.');
      return;
    }

    try {
      await api.post('/certified-reports', {
        category: formCategory,
        item_name: formItemName,
        test_item: formTestItem,
        agency: formAgency,
        issued_date: formIssuedDate,
        test_result: formTestResult,
        min_value: formMinValue ? Number(formMinValue) : null,
        max_value: formMaxValue ? Number(formMaxValue) : null,
        unit: formUnit,
        notes: formNotes
      });
      alert('신규 공인시험성적서 및 1년 주기 유효기간이 정상 등록되었습니다!');
      setShowModal(false);
      fetchReports();
    } catch {
      alert('공인성적서 등록 중 오류가 발생했습니다.');
    }
  };

  // 통계 계산
  const warning3MCount = reports.filter(r => r.alert_status === 'WARNING_3M').length;
  const expiredCount = reports.filter(r => r.alert_status === 'EXPIRED').length;
  const validCount = reports.filter(r => r.alert_status === 'VALID').length;

  const filteredReports = reports.filter(r => {
    const matchCat = selectedCategory === '전체' || r.category === selectedCategory;
    const matchSearch = !searchTerm || r.item_name.includes(searchTerm) || r.test_item.includes(searchTerm) || r.agency.includes(searchTerm);
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-900 text-slate-100 min-h-screen">
      <PageHeader
        title="🏛️ 공인성적서 관리 (1년 주기 & 만기 알람)"
        description="FITI, KTR, KCL, KOPTRI 공인기관 성적서 1년 주기 유효기간 관리 및 3개월 전 만료 예정 알람"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" />
          신규 공인성적서 등록
        </button>
      </PageHeader>

      {/* 만료 예정 알림 위젯 카드 (검사설비 체계와 동일) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">⚠️ 3개월 내 만료 예정</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-0.5">{warning3MCount} 건</p>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">🚨 유효기간 만료 (갱신 필요)</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-0.5">{expiredCount} 건</p>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">✅ 정상 유효 중</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{validCount} 건</p>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="품명 / 시험항목 / 기관 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 text-white text-xs rounded-xl pl-9 pr-4 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 공인성적서 목록 테이블 */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-400" />
            등록된 1년 주기 공인성적서 & 검사 연동 기준치 목록 ({filteredReports.length}건)
          </h3>
          <button onClick={fetchReports} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">분류</th>
                <th className="px-4 py-3">품명 및 시험항목</th>
                <th className="px-4 py-3">공인시험기관</th>
                <th className="px-4 py-3">발행일자</th>
                <th className="px-4 py-3">1년 만료예정일</th>
                <th className="px-4 py-3">연동 공인 기준치 (min ~ max)</th>
                <th className="px-4 py-3 text-center">만기 상태 알람</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">데이터 로딩 중...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">등록된 공인성적서가 없습니다.</td></tr>
              ) : filteredReports.map(r => (
                <tr key={r.report_id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-blue-400">{r.category}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-100">{r.item_name}</p>
                    <p className="text-[11px] text-slate-400">{r.test_item} {r.test_standard ? `(${r.test_standard})` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">{r.agency}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{r.issued_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-200">{r.expire_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                    {r.min_value !== null && r.min_value !== undefined ? `≥ ${r.min_value}` : ''}
                    {r.max_value !== null && r.max_value !== undefined ? ` ≤ ${r.max_value}` : ''}
                    {` ${r.unit || ''}`}
                    {r.test_result && <span className="block text-[10px] text-slate-400">결과: {r.test_result}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.alert_status === 'EXPIRED' && (
                      <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 font-extrabold rounded-lg border border-rose-500/40">
                        🚨 만료됨 ({Math.abs(r.days_left)}일 경과)
                      </span>
                    )}
                    {r.alert_status === 'WARNING_3M' && (
                      <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 font-extrabold rounded-lg border border-amber-500/40 animate-pulse">
                        ⚠️ 3개월 내 만료 (D-{r.days_left})
                      </span>
                    )}
                    {r.alert_status === 'VALID' && (
                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/40">
                        ✅ 유효중 (D-{r.days_left})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-400" />
              신규 공인시험성적서 등록 (1년 주기)
            </h3>
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">분류</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">발행일자 (유효기간 1년 자동)</label>
                  <input
                    type="date"
                    value={formIssuedDate}
                    onChange={e => setFormIssuedDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">품명</label>
                <input
                  type="text"
                  placeholder="예: 세라믹울 Superwool 96K, EVA EA33045 등"
                  value={formItemName}
                  onChange={e => setFormItemName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">시험항목</label>
                  <input
                    type="text"
                    placeholder="예: 숏함유율, MI, 열간수축온도 등"
                    value={formTestItem}
                    onChange={e => setFormTestItem(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">공인시험기관</label>
                  <input
                    type="text"
                    placeholder="KTR / FITI / KCL / KOPTRI"
                    value={formAgency}
                    onChange={e => setFormAgency(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">최소 기준치 (Min)</label>
                  <input
                    type="number" step="0.001" placeholder="예: 96.0"
                    value={formMinValue} onChange={e => setFormMinValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">최대 기준치 (Max)</label>
                  <input
                    type="number" step="0.001" placeholder="예: 25.0"
                    value={formMaxValue} onChange={e => setFormMaxValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">단위</label>
                  <input
                    type="text" placeholder="kg/㎥, %, N/㎟"
                    value={formUnit} onChange={e => setFormUnit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">시험 결과 요약</label>
                <input
                  type="text" placeholder="예: 18.2% (적합), V-2 적합"
                  value={formTestResult} onChange={e => setFormTestResult(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-700 text-slate-300 font-bold rounded-xl">취소</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">등록 승인</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CertifiedReportsPage;
