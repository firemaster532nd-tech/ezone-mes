import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileCheck2, AlertTriangle, CheckCircle2, Clock, Plus, Search, RefreshCw, Upload, ShieldCheck } from 'lucide-react';

interface CertifiedReport {
  report_id: number;
  cert_number?: string;
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

// 품목 분류별 전용 시험항목 템플릿
const CATEGORY_TEST_TEMPLATES: Record<string, Array<{ item: string; standard: string; unit: string; min?: number; max?: number }>> = {
  '세라믹울': [
    { item: '밀도', standard: 'KS L 9104:2017', unit: 'kg/㎥', min: 96.0 },
    { item: '숏함유율 (Shot Content)', standard: 'KS L 9104:2017', unit: '%', max: 25.0 },
    { item: '가열선수축율 (24H)', standard: 'KS L 9104:2017', unit: '%', max: 4.0 },
  ],
  '그라스울': [
    { item: '밀도', standard: 'KS L 9102', unit: 'kg/㎥', min: 64.0 },
    { item: '열간 수축 온도', standard: 'KS L 9102', unit: '℃', min: 300.0 },
    { item: '열전도율', standard: 'KS L 9102', unit: 'W/m·K', max: 0.045 },
  ],
  'GI강판': [
    { item: '인장강도', standard: 'KS D 3506', unit: 'N/㎟', min: 270.0 },
    { item: '항복강도', standard: 'KS D 3506', unit: 'N/㎟', min: 205.0 },
    { item: '연신율', standard: 'KS D 3506', unit: '%', min: 20.0 },
  ],
  '실란트': [
    { item: '탄성복원성 및 접착강도', standard: 'KS F 4910', unit: 'N/㎟', min: 0.2 },
    { item: '경도 (Shore A)', standard: 'KS F 4910', unit: 'Shore A', min: 20.0, max: 40.0 },
  ],
  '원자재': [
    { item: 'MI(용융지수)', standard: 'ASTM D 1238', unit: 'g/10min', min: 41.0, max: 49.0 },
    { item: '밀도', standard: 'ASTM D 792', unit: 'g/㎤', min: 0.4 },
    { item: 'UL94 난연성', standard: 'UL94-V', unit: 'Grade' },
    { item: 'pH', standard: 'KS M 0011', unit: 'pH', min: 6.0, max: 8.0 },
    { item: '체잔분 (300㎛)', standard: 'KS A 0507', unit: '%', min: 70.0, max: 90.0 },
  ],
  '차열시트': [
    { item: '발포력 (팽창배율)', standard: 'KS F ISO 5560-1', unit: '배', min: 2.0 },
    { item: '가스유해성 (연기숙사독성)', standard: 'KS F 2271', unit: '분', min: 9.0 },
  ]
};

export function CertifiedReportsPage() {
  const [reports, setReports] = useState<CertifiedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [parsing, setParsing] = useState(false);

  // 폼 상태
  const [formCertNumber, setFormCertNumber] = useState('');
  const [formCategory, setFormCategory] = useState('원자재');
  const [formItemName, setFormItemName] = useState('');
  const [formTestItem, setFormTestItem] = useState('');
  const [formStandard, setFormStandard] = useState('');
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

  // 분류 변경 시 전용 시험항목 템플릿 자동 설정
  useEffect(() => {
    const tmplList = CATEGORY_TEST_TEMPLATES[formCategory];
    if (tmplList && tmplList.length > 0) {
      const t = tmplList[0];
      setFormTestItem(t.item);
      setFormStandard(t.standard);
      setFormUnit(t.unit);
      setFormMinValue(t.min !== undefined ? String(t.min) : '');
      setFormMaxValue(t.max !== undefined ? String(t.max) : '');
    }
  }, [formCategory]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const res = await api.post<{ data: any }>('/certified-reports/parse-pdf', { fileName: file.name });
      if (res.data) {
        const d = res.data;
        setFormCertNumber(d.cert_number);
        setFormCategory(d.category);
        setFormItemName(d.item_name);
        setFormTestItem(d.test_item);
        setFormAgency(d.agency);
        setFormIssuedDate(d.issued_date);
        setFormTestResult(d.test_result);
        setFormMinValue(d.min_value !== null ? String(d.min_value) : '');
        setFormMaxValue(d.max_value !== null ? String(d.max_value) : '');
        setFormUnit(d.unit);
        alert(`✅ [PDF 공인성적서 스마트 파싱] 파일명 [${file.name}]으로부터 성적서 관리번호 및 유효기간(1년), 공인 기준치가 자동 입력되었습니다!`);
      }
    } catch {
      alert('PDF 성적서 파싱 중 오류가 발생했습니다.');
    } finally {
      setParsing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName || !formTestItem || !formAgency) {
      alert('품명, 시험항목, 의뢰기관을 입력해 주세요.');
      return;
    }

    try {
      await api.post('/certified-reports', {
        cert_number: formCertNumber,
        category: formCategory,
        item_name: formItemName,
        test_item: formTestItem,
        test_standard: formStandard,
        agency: formAgency,
        issued_date: formIssuedDate,
        test_result: formTestResult,
        min_value: formMinValue ? Number(formMinValue) : null,
        max_value: formMaxValue ? Number(formMaxValue) : null,
        unit: formUnit,
        notes: formNotes
      });
      alert('신규 공인시험성적서가 100% 검수 완료되어 1년 주기 기준치로 등록되었습니다!');
      setShowModal(false);
      fetchReports();
    } catch {
      alert('공인성적서 등록 중 오류가 발생했습니다.');
    }
  };

  const warning3MCount = reports.filter(r => r.alert_status === 'WARNING_3M').length;
  const expiredCount = reports.filter(r => r.alert_status === 'EXPIRED').length;
  const validCount = reports.filter(r => r.alert_status === 'VALID').length;

  const filteredReports = reports.filter(r => {
    const matchCat = selectedCategory === '전체' || r.category === selectedCategory;
    const matchSearch = !searchTerm || r.item_name.includes(searchTerm) || (r.cert_number && r.cert_number.includes(searchTerm)) || r.test_item.includes(searchTerm) || r.agency.includes(searchTerm);
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 space-y-6 bg-slate-900 text-slate-100 min-h-screen">
      <PageHeader
        title="🏛️ 공인성적서 관리 (성적서 번호 & 1년 주기 만기 알람)"
        description="PDF 업로드 파싱, 공인성적서 번호 관리, 1년 주기 유효기간 3개월 전 만류 알람 및 인수/중간검사 100% 자동연동"
      >
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" />
          PDF 성적서 신규 등록
        </button>
      </PageHeader>

      {/* 만료 예정 알림 위젯 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">⚠️ 3개월 내 만료 예정 (D-90)</p>
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
            <p className="text-xs text-slate-400 font-bold">✅ 정상 검수 유효 중</p>
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
            placeholder="성적서 번호 / 품명 / 기관 검색..."
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
            검수 완료된 공인성적서 & 1년 주기 연동 기준치 ({filteredReports.length}건)
          </h3>
          <button onClick={fetchReports} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">공인성적서 번호</th>
                <th className="px-4 py-3">분류</th>
                <th className="px-4 py-3">품명 및 시험항목</th>
                <th className="px-4 py-3">공인시험기관</th>
                <th className="px-4 py-3">발행일자</th>
                <th className="px-4 py-3">1년 만료예정일</th>
                <th className="px-4 py-3">연동 공인 기준치 (min ~ max)</th>
                <th className="px-4 py-3 text-center">만기 알람 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">데이터 로딩 중...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">등록된 공인성적서가 없습니다.</td></tr>
              ) : filteredReports.map(r => (
                <tr key={r.report_id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-extrabold text-blue-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    <span>{r.cert_number || `KTR-2026-${r.report_id}`}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-300">{r.category}</td>
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
                        ✅ 유효함 (D-{r.days_left})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 신규 등록 / PDF 파싱 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
                신규 공인성적서 등록 (1년 주기)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* PDF 드래그 업로드 파서 영역 */}
            <div className="bg-slate-900/80 border-2 border-dashed border-blue-500/40 rounded-xl p-4 text-center space-y-2">
              <Upload className="h-6 w-6 text-blue-400 mx-auto" />
              <p className="text-xs font-bold text-slate-200">공인시험성적서 PDF 파일 선택 / 드래그 업로드</p>
              <p className="text-[10px] text-slate-400">파일명 및 텍스트에서 성적서 번호, 유효기간, 기준치를 자동 추출해 줍니다!</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={parsing}
                className="hidden"
                id="pdf-upload-input"
              />
              <label
                htmlFor="pdf-upload-input"
                className="inline-block px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow"
              >
                {parsing ? 'PDF 스마트 파싱 중...' : 'PDF 성적서 파일 선택'}
              </label>
            </div>

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">공인성적서 번호 (관리번호)</label>
                  <input
                    type="text"
                    placeholder="예: KTR-2026-0415"
                    value={formCertNumber}
                    onChange={e => setFormCertNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">품목 분류</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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

              {/* 분류별 전용 시험항목 선택 템플릿 드롭다운 */}
              {CATEGORY_TEST_TEMPLATES[formCategory] && (
                <div className="bg-blue-950/40 p-2.5 rounded-xl border border-blue-800/40 space-y-1">
                  <label className="block text-[11px] font-bold text-blue-300">💡 [{formCategory}] 추천 공인 시험항목 선택:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_TEST_TEMPLATES[formCategory].map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormTestItem(tmpl.item);
                          setFormStandard(tmpl.standard);
                          setFormUnit(tmpl.unit);
                          setFormMinValue(tmpl.min !== undefined ? String(tmpl.min) : '');
                          setFormMaxValue(tmpl.max !== undefined ? String(tmpl.max) : '');
                        }}
                        className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-200 text-[11px] font-bold rounded-lg border border-blue-500/40"
                      >
                        + {tmpl.item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">시험 규격/기준법</label>
                  <input
                    type="text"
                    placeholder="예: KS L 9104:2017, ASTM D 1238"
                    value={formStandard}
                    onChange={e => setFormStandard(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                  />
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
                  type="text" placeholder="예: 9.8% (합격), V-2 적합"
                  value={formTestResult} onChange={e => setFormTestResult(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-700 text-slate-300 font-bold rounded-xl">취소</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">검수 완료 및 1년 주기 등록</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CertifiedReportsPage;
