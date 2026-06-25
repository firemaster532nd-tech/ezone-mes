import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';

interface CertDetail {
  cert_id: number;
  cert_number: string;
  product_group: string;
  structure_name: string;
  structure_code: string;
  install_position: string;
  fire_rating: string | null;
  socket_name: string | null;
  cert_area_sqmm: number | null;
  opening_w_mm: number | null;
  opening_h_mm: number | null;
  penetration_w_mm: number | null;
  penetration_h_mm: number | null;
  gap_limit_mm: number | null;
  install_qty: number;
  sheet_thickness_min: number | null;
  sheet_thickness_prod: number | null;
  cw_density_min: number | null;
  cw_density_prod: number | null;
  cert_version: string | null;
  file_path: string | null;
  bom: BomRow[];
  rules: RuleRow[];
}

interface BomRow {
  bom_id: number;
  component_name: string;
  item_name: string | null;
  item_code: string | null;
  qty_per_unit: number;
  spec_detail: string | null;
  is_applicable: boolean;
  sort_order: number;
}

interface RuleRow {
  rule_id: number;
  rule_type: string;
  cert_value: number;
  direction: string;
  production_value: number | null;
  tolerance_plus: number | null;
  unit: string | null;
  description: string | null;
}

const ruleTypeLabels: Record<string, string> = {
  AREA: '면적', GAP: '틈새간격', PIPE: '배관규격',
  THICKNESS: '두께', DENSITY: '밀도', MASS: '질량',
  LENGTH: '길이', WIDTH: '너비',
};

export function CertificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cert, setCert] = useState<CertDetail | null>(null);
  const [showPdf, setShowPdf] = useState(false);

  const pdfUrl = id ? `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/certifications/${id}/document` : null;

  useEffect(() => {
    if (id) {
      api.get<{ data: CertDetail }>(`/certifications/${id}`).then((res) => setCert(res.data));
    }
  }, [id]);

  if (!cert) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/master/certifications')} className="flex items-center gap-1 text-shop-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </button>
        <div className="flex items-start justify-between">
          <PageHeader title={cert.structure_name} description={cert.cert_number} />
          {cert.file_path && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowPdf(!showPdf)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-shop-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <FileText className="h-4 w-4" />
                {showPdf ? '인정서 닫기' : '인정서 보기'}
              </button>
              <a
                href={pdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-shop-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                새 탭으로 열기
              </a>
            </div>
          )}
        </div>
      </div>

      {/* PDF 인라인 뷰어 */}
      {showPdf && pdfUrl && (
        <div className="mb-8 rounded-card border overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
            <span className="text-shop-sm font-medium text-gray-700">
              {cert.cert_number} — {cert.structure_name} 품질인정서
            </span>
            <button onClick={() => setShowPdf(false)} className="text-gray-400 hover:text-gray-600 text-xs">닫기 ✕</button>
          </div>
          <iframe
            src={pdfUrl}
            className="w-full"
            style={{ height: '75vh', border: 'none' }}
            title={`${cert.cert_number} 품질인정서`}
          />
        </div>
      )}

      {/* Info Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <InfoCard label="제품군" value={cert.product_group} />
        <InfoCard label="구조코드" value={cert.structure_code} />
        <InfoCard label="사용부위" value={cert.install_position} />
        <InfoCard label="내화성능" value={cert.fire_rating ?? '-'} />
        <InfoCard label="방화소켓" value={cert.socket_name ?? '-'} />
        <InfoCard label="시공수량" value={`${cert.install_qty}개`} />
        <InfoCard label="개구부" value={cert.opening_w_mm ? `${cert.opening_w_mm.toLocaleString()}×${cert.opening_h_mm}mm` : '-'} />
        <InfoCard label="관통재" value={cert.penetration_w_mm ? `${cert.penetration_w_mm.toLocaleString()}×${cert.penetration_h_mm}mm` : '-'} />
        <InfoCard label="틈새간격" value={cert.gap_limit_mm !== null ? `${cert.gap_limit_mm}mm 이하` : '-'} />
        <InfoCard label="인정면적" value={cert.cert_area_sqmm ? `${cert.cert_area_sqmm.toLocaleString()} mm²` : '-'} />
        <InfoCard label="차열시트 두께" value={cert.sheet_thickness_min ? `인정 ${cert.sheet_thickness_min}mm / 생산 ${cert.sheet_thickness_prod}mm` : '-'} />
        <InfoCard label="CW 밀도" value={cert.cw_density_min ? `인정 ${cert.cw_density_min} / 생산 ${cert.cw_density_prod} kg/m³` : '-'} />
      </div>

      {/* BOM Section */}
      <section className="mb-8">
        <h2 className="text-shop-lg font-bold mb-3">BOM 구성 ({cert.bom.length}건)</h2>
        <div className="overflow-x-auto rounded-card border bg-white">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">구성요소</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">자재코드</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">규격/사양</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">수량</th>
              </tr>
            </thead>
            <tbody>
              {cert.bom.map((row, idx) => (
                <tr key={row.bom_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.component_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.item_code ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.spec_detail ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{row.qty_per_unit}</td>
                </tr>
              ))}
              {cert.bom.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">BOM 데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rules Section */}
      <section>
        <h2 className="text-shop-lg font-bold mb-3">인정기준 규칙 ({cert.rules.length}건)</h2>
        <div className="overflow-x-auto rounded-card border bg-white">
          <table className="w-full text-shop-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">규칙유형</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">인정기준값</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">방향</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">생산기준값</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">단위</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">설명</th>
              </tr>
            </thead>
            <tbody>
              {cert.rules.map((rule) => (
                <tr key={rule.rule_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {ruleTypeLabels[rule.rule_type] ?? rule.rule_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{Number(rule.cert_value).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
                      rule.direction === 'MIN' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                    )}>
                      {rule.direction === 'MIN' ? '이상' : '이하'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{rule.production_value ? Number(rule.production_value).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{rule.unit ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{rule.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border bg-white p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-shop-sm font-medium">{value}</div>
    </div>
  );
}
