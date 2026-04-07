import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Certification {
  cert_id: number;
  cert_number: string;
  structure_code: string;
  product_group: string;
  socket_name: string;
  opening_w_mm: number;
  opening_h_mm: number;
  gap_limit_mm: number;
}

interface CheckResult {
  rule_id: number;
  rule_type: string;
  cert_value: number;
  direction: string;
  input_value: number | null;
  tolerance: number | null;
  production_value: number | null;
  unit: string | null;
  description: string | null;
  result: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

interface VerifyResponse {
  cert_id: number;
  cert_number: string;
  structure_code: string;
  overall_result: string;
  checked_count: number;
  pass_count: number;
  fail_count: number;
  results: CheckResult[];
}

const ruleTypeLabel: Record<string, string> = {
  AREA: '개구부 면적',
  GAP: '틈새간격',
  PIPE: '배관 직경',
  THICKNESS: '시트 두께',
  DENSITY: '시트 밀도',
  MASS: 'CW 밀도',
  LENGTH: '길이',
  WIDTH: '너비',
};

export function CertCheckPage() {
  const [mode, setMode] = useState<'verify' | 'search'>('verify');
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [selectedCert, setSelectedCert] = useState('');

  // 입력값
  const [openingArea, setOpeningArea] = useState('');
  const [gapMm, setGapMm] = useState('');
  const [pipeDiameter, setPipeDiameter] = useState('');
  const [sheetThickness, setSheetThickness] = useState('');
  const [sheetDensity, setSheetDensity] = useState('');
  const [cwDensity, setCwDensity] = useState('');

  // 결과
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: Certification[] }>('/certifications').then((res) => setCertifications(res.data));
  }, []);

  const buildInputs = () => ({
    opening_area_sqmm: openingArea ? parseFloat(openingArea) : undefined,
    gap_mm: gapMm ? parseFloat(gapMm) : undefined,
    pipe_diameter_mm: pipeDiameter ? parseFloat(pipeDiameter) : undefined,
    sheet_thickness_mm: sheetThickness ? parseFloat(sheetThickness) : undefined,
    sheet_density_kgm3: sheetDensity ? parseFloat(sheetDensity) : undefined,
    cw_density_kgm3: cwDensity ? parseFloat(cwDensity) : undefined,
  });

  const handleVerify = async () => {
    if (!selectedCert) return alert('인정구조를 선택해주세요.');
    setLoading(true);
    try {
      const res = await api.post<{ data: VerifyResponse }>('/cert-check/verify', {
        cert_id: parseInt(selectedCert),
        inputs: buildInputs(),
      });
      setVerifyResult(res.data);
    } catch {
      alert('검증 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ data: any[]; total: number }>('/cert-check/find-applicable', buildInputs());
      setSearchResults(res.data);
    } catch {
      alert('검색 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="인정기준 검증" description="7대 핵심 규칙 적합성 자동판정" />

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode('verify'); setSearchResults([]); }}
          className={cn(
            'px-4 py-2 rounded-md text-shop-sm font-medium border',
            mode === 'verify' ? 'bg-process-mix text-white border-process-mix' : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          특정 구조 검증
        </button>
        <button
          onClick={() => { setMode('search'); setVerifyResult(null); }}
          className={cn(
            'px-4 py-2 rounded-md text-shop-sm font-medium border',
            mode === 'search' ? 'bg-process-mix text-white border-process-mix' : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          적용 가능 구조 검색
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 입력 패널 */}
        <div className="col-span-1 bg-white rounded-card border p-4">
          <h3 className="text-shop-base font-bold mb-4">현장 입력값</h3>

          {mode === 'verify' && (
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">인정구조 선택</label>
              <select value={selectedCert} onChange={(e) => setSelectedCert(e.target.value)}
                className="w-full border rounded px-3 py-2 text-shop-sm">
                <option value="">선택</option>
                {certifications.map((c) => (
                  <option key={c.cert_id} value={c.cert_id}>
                    {c.structure_code} ({c.cert_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            <InputField label="개구부 면적 (mm²)" value={openingArea} onChange={setOpeningArea} placeholder="예: 2025000" />
            <InputField label="틈새간격 (mm)" value={gapMm} onChange={setGapMm} placeholder="예: 45" />
            <InputField label="배관 직경 (mm)" value={pipeDiameter} onChange={setPipeDiameter} placeholder="예: 200" />
            <InputField label="시트 두께 (mm)" value={sheetThickness} onChange={setSheetThickness} placeholder="예: 5.2" />
            <InputField label="시트 밀도 (kg/m³)" value={sheetDensity} onChange={setSheetDensity} placeholder="예: 1800" />
            <InputField label="CW 밀도 (kg/m³)" value={cwDensity} onChange={setCwDensity} placeholder="예: 128" />
          </div>

          <button
            onClick={mode === 'verify' ? handleVerify : handleSearch}
            disabled={loading}
            className="w-full mt-4 px-4 py-2.5 bg-process-mix text-white rounded-md text-shop-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search size={16} />
            {loading ? '검증 중...' : mode === 'verify' ? '적합성 검증' : '적용 구조 검색'}
          </button>
        </div>

        {/* 결과 패널 */}
        <div className="col-span-2">
          {mode === 'verify' && verifyResult && (
            <div className="bg-white rounded-card border p-4">
              {/* 종합 판정 */}
              <div className={cn(
                'flex items-center gap-3 p-4 rounded-lg mb-4',
                verifyResult.overall_result === 'PASS' && 'bg-green-50',
                verifyResult.overall_result === 'FAIL' && 'bg-red-50',
                verifyResult.overall_result === 'SKIP' && 'bg-gray-50',
              )}>
                {verifyResult.overall_result === 'PASS' && <CheckCircle size={32} className="text-green-600" />}
                {verifyResult.overall_result === 'FAIL' && <XCircle size={32} className="text-red-600" />}
                {verifyResult.overall_result === 'SKIP' && <AlertTriangle size={32} className="text-gray-400" />}
                <div>
                  <div className="text-shop-lg font-bold">
                    {verifyResult.structure_code} ({verifyResult.cert_number})
                  </div>
                  <div className="text-shop-sm text-gray-600">
                    {verifyResult.overall_result === 'PASS' ? '적합' : verifyResult.overall_result === 'FAIL' ? '부적합' : '검증 항목 없음'}
                    {' '} - 검증 {verifyResult.checked_count}건 중 합격 {verifyResult.pass_count}건, 불합격 {verifyResult.fail_count}건
                  </div>
                </div>
              </div>

              {/* 상세 결과 */}
              <table className="w-full text-shop-sm border">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs text-gray-500">규칙 유형</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">인정기준</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">방향</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">입력값</th>
                    <th className="px-3 py-2 text-center text-xs text-gray-500">판정</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">설명</th>
                  </tr>
                </thead>
                <tbody>
                  {verifyResult.results.map((r) => (
                    <tr key={r.rule_id} className={cn(
                      'border-b',
                      r.result === 'FAIL' && 'bg-red-50',
                      r.result === 'SKIP' && 'text-gray-400',
                    )}>
                      <td className="px-3 py-2 font-medium">{ruleTypeLabel[r.rule_type] || r.rule_type}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.cert_value} {r.unit || ''}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded',
                          r.direction === 'MAX' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {r.direction === 'MAX' ? '이하' : '이상'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.input_value ?? '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {r.result === 'PASS' && <CheckCircle size={16} className="inline text-green-600" />}
                        {r.result === 'FAIL' && <XCircle size={16} className="inline text-red-600" />}
                        {r.result === 'SKIP' && <span className="text-gray-400 text-xs">생략</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'search' && searchResults.length > 0 && (
            <div className="bg-white rounded-card border p-4">
              <h3 className="text-shop-base font-bold mb-3">
                적용 가능한 인정구조 ({searchResults.length}건)
              </h3>
              <table className="w-full text-shop-sm border">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs text-gray-500">구조코드</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">인정번호</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">제품군</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500">소켓</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">개구부(W×H)</th>
                    <th className="px-3 py-2 text-right text-xs text-gray-500">틈새</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((r: any) => (
                    <tr key={r.cert_id} className="border-b hover:bg-blue-50">
                      <td className="px-3 py-2 font-mono font-medium">{r.structure_code}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.cert_number}</td>
                      <td className="px-3 py-2">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded',
                          r.product_group === 'MP' && 'bg-blue-100 text-blue-700',
                          r.product_group === 'BD' && 'bg-purple-100 text-purple-700',
                          r.product_group === 'NP' && 'bg-green-100 text-green-700',
                        )}>
                          {r.product_group}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.socket_name || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.opening_w_mm}×{r.opening_h_mm}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.gap_limit_mm}mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'search' && searchResults.length === 0 && !loading && (
            <div className="bg-white rounded-card border p-8 text-center text-gray-400">
              입력값을 입력한 후 '적용 구조 검색' 버튼을 클릭하세요
            </div>
          )}

          {mode === 'verify' && !verifyResult && (
            <div className="bg-white rounded-card border p-8 text-center text-gray-400">
              인정구조를 선택하고 현장값을 입력한 후 '적합성 검증' 버튼을 클릭하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 text-shop-sm" />
    </div>
  );
}
