import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { ArrowLeft, Printer, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface QualityReport {
  shipment: any;
  bom: any[];
  lotTrace: any[];
  incomingInspections: any[];
  processInspections: any[];
  certRules: any[];
  generatedAt: string;
}

const resultIcon = (result: string) => {
  if (result === 'PASS') return <CheckCircle size={14} className="text-green-600" />;
  if (result === 'FAIL') return <XCircle size={14} className="text-red-600" />;
  return <AlertTriangle size={14} className="text-yellow-500" />;
};

const lotTypeLabels: Record<string, string> = {
  IN: '입고', MIX: '배합', EXT: '압출', CUT: '재단', ASM: '조립', OUT: '출하',
  GI: '그라스울', CW: '세라믹울', SS: 'SUS304', GW: '아연도금',
};

export function QualityReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: QualityReport }>(`/quality-reports/${id}`)
      .then((r) => setReport(r.data))
      .catch(() => alert('품질관리서 데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        품질관리서를 생성하고 있습니다...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-400">품질관리서 데이터가 없습니다.</p>
        <button onClick={() => navigate('/shipment/list')} className="text-blue-500 underline text-sm">
          출하목록으로 돌아가기
        </button>
      </div>
    );
  }

  const { shipment: s, bom, lotTrace, incomingInspections, processInspections, certRules } = report;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/shipment/list')}
            className="p-2 rounded-md hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">품질관리서</h1>
            <p className="text-sm text-gray-500">{s.wo_number} | {s.wo_date?.slice(0, 10)}</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50 print:hidden"
        >
          <Printer size={16} /> 인쇄
        </button>
      </div>

      {/* 1. 출하 정보 */}
      <Section title="1. 출하 정보">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoField label="출하번호" value={s.wo_number} />
          <InfoField label="출하일" value={s.wo_date?.slice(0, 10)} />
          <InfoField label="고객" value={s.purpose || '-'} />
          <InfoField label="납품처" value={s.spec_detail || '-'} />
          <InfoField label="품목" value={`${s.item_code} ${s.item_name}`} />
          <InfoField label="수량" value={`${s.actual_qty || s.planned_qty} ${s.unit || 'EA'}`} />
          <InfoField label="출하LOT" value={s.ship_lot || '-'} mono />
          <InfoField label="담당자" value={s.inspector || '-'} />
        </div>
      </Section>

      {/* 2. 인정구조 정보 */}
      {s.cert_number && (
        <Section title="2. 인정구조 정보">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoField label="인정번호" value={s.cert_number} mono />
            <InfoField label="구조명" value={s.structure_code} />
            <InfoField label="제품군" value={s.product_group} />
            <InfoField label="인정버전" value={s.cert_version} />
            <InfoField label="소켓명" value={s.socket_name || '-'} />
            <InfoField label="개구부" value={s.opening_w_mm && s.opening_h_mm ? `${s.opening_w_mm}×${s.opening_h_mm}mm` : '-'} />
            <InfoField label="틈새간격" value={s.gap_limit_mm ? `${s.gap_limit_mm}mm` : '-'} />
            <InfoField label="시트두께/CW밀도" value={`${s.sheet_thickness_min || '-'}mm / ${s.cw_density_min || '-'}kg/m³`} />
          </div>
        </Section>
      )}

      {/* 3. BOM 구성 */}
      {bom.length > 0 && (
        <Section title="3. BOM 구성 (구성자재)">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">구성요소</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">자재코드</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">자재명</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">수량</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">규격</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((b: any) => (
                <tr key={b.bom_id} className="border-b">
                  <td className="px-3 py-2">{b.component_name}</td>
                  <td className="px-3 py-2 font-mono">{b.item_code || '-'}</td>
                  <td className="px-3 py-2">{b.item_name || '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{parseFloat(b.qty_per_unit)}</td>
                  <td className="px-3 py-2 text-gray-500">{b.spec_detail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* 4. 인정기준 규칙 */}
      {certRules.length > 0 && (
        <Section title="4. 인정기준 규칙">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">유형</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">기준값</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">방향</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">생산값</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">공차</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">단위</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">설명</th>
              </tr>
            </thead>
            <tbody>
              {certRules.map((r: any) => (
                <tr key={r.rule_id} className="border-b">
                  <td className="px-3 py-2 font-medium">{r.rule_type}</td>
                  <td className="px-3 py-2 text-right font-mono">{parseFloat(r.cert_value)}</td>
                  <td className="px-3 py-2">{r.direction === 'MAX' ? '이하' : '이상'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.production_value ? parseFloat(r.production_value) : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.tolerance_plus ? `+${parseFloat(r.tolerance_plus)}` : '-'}</td>
                  <td className="px-3 py-2">{r.unit || '-'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{r.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* 5. LOT 추적 (역추적) */}
      {lotTrace.length > 0 && (
        <Section title="5. LOT 추적 (원자재 → 완제품)">
          <div className="space-y-2">
            {lotTrace.map((l: any, idx: number) => (
              <div key={l.lot_id} className="flex items-center gap-3">
                <div className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  l.lot_type === 'IN' ? 'bg-amber-100 text-amber-700' :
                  l.lot_type === 'OUT' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {lotTypeLabels[l.lot_type] || l.lot_type}
                </div>
                <span className="font-mono text-xs">{l.lot_number}</span>
                <span className="text-xs text-gray-500">{l.item_name || ''}</span>
                <span className="text-xs text-gray-400">({parseFloat(l.qty)})</span>
                {l.supplier_lot && (
                  <span className="text-xs text-gray-400">공급처: {l.supplier_lot}</span>
                )}
                {l.inspection_result && (
                  <span className="flex items-center gap-1 text-xs">
                    {resultIcon(l.inspection_result)}
                    {l.inspection_result === 'PASS' ? '합격' : l.inspection_result === 'FAIL' ? '불합격' : '검사중'}
                  </span>
                )}
                {idx < lotTrace.length - 1 && (
                  <span className="text-gray-300">→</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 6. 인수검사 결과 */}
      {incomingInspections.length > 0 && (
        <Section title="6. 인수검사 결과">
          {incomingInspections.map((insp: any) => (
            <div key={insp.insp_id} className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                {resultIcon(insp.result)}
                <span className="font-medium text-sm">{insp.item_name}</span>
                <span className="font-mono text-xs text-gray-500">LOT: {insp.lot_number}</span>
                {insp.supplier_lot && <span className="text-xs text-gray-400">({insp.supplier_lot})</span>}
                <span className="text-xs text-gray-400">{insp.form_code}</span>
              </div>
              {insp.details && insp.details.filter((d: any) => d.quality_item).length > 0 && (
                <table className="w-full text-xs ml-6">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left text-gray-500">검사항목</th>
                      <th className="px-2 py-1 text-right text-gray-500">기준</th>
                      <th className="px-2 py-1 text-right text-gray-500">n1</th>
                      <th className="px-2 py-1 text-right text-gray-500">n2</th>
                      <th className="px-2 py-1 text-right text-gray-500">n3</th>
                      <th className="px-2 py-1 text-left text-gray-500">판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insp.details.filter((d: any) => d.quality_item).map((d: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1">{d.check_item || d.quality_item}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.cert_standard ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n1 ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n2 ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n3 ?? '-'}</td>
                        <td className="px-2 py-1">
                          {d.item_result && (
                            <span className={cn('text-xs', d.item_result === 'PASS' ? 'text-green-600' : 'text-red-600')}>
                              {d.item_result === 'PASS' ? '합격' : '불합격'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* 7. 중간/최종검사 결과 */}
      {processInspections.length > 0 && (
        <Section title="7. 공정/최종검사 결과">
          {processInspections.map((insp: any) => (
            <div key={insp.insp_id} className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                {resultIcon(insp.result)}
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{insp.insp_type === 'FINAL' ? '최종검사' : '중간검사'}</span>
                <span className="font-mono text-xs text-gray-500">LOT: {insp.lot_number || '-'}</span>
                <span className="text-xs text-gray-400">{insp.form_code}</span>
              </div>
              {insp.details && insp.details.filter((d: any) => d.quality_item).length > 0 && (
                <table className="w-full text-xs ml-6">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left text-gray-500">검사항목</th>
                      <th className="px-2 py-1 text-right text-gray-500">기준</th>
                      <th className="px-2 py-1 text-right text-gray-500">n1</th>
                      <th className="px-2 py-1 text-right text-gray-500">n2</th>
                      <th className="px-2 py-1 text-right text-gray-500">n3</th>
                      <th className="px-2 py-1 text-left text-gray-500">판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insp.details.filter((d: any) => d.quality_item).map((d: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1">{d.check_item || d.quality_item}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.cert_standard ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n1 ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n2 ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{d.measured_n3 ?? '-'}</td>
                        <td className="px-2 py-1">
                          {d.item_result && (
                            <span className={cn('text-xs', d.item_result === 'PASS' ? 'text-green-600' : 'text-red-600')}>
                              {d.item_result === 'PASS' ? '합격' : '불합격'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* No inspections message */}
      {incomingInspections.length === 0 && processInspections.length === 0 && (
        <Section title="6. 검사 결과">
          <p className="text-sm text-gray-400 py-4 text-center">
            연결된 검사 기록이 없습니다. LOT 계보가 연결되면 자동으로 표시됩니다.
          </p>
        </Section>
      )}

      {/* Footer */}
      <div className="mt-8 border-t pt-6 print:mt-4">
        <div className="grid grid-cols-3 gap-8 text-center text-sm">
          <div>
            <div className="text-gray-500 mb-8">작 성</div>
            <div className="border-t border-gray-300 pt-1">날짜: {new Date().toLocaleDateString('ko-KR')}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-8">검 토</div>
            <div className="border-t border-gray-300 pt-1">날짜:</div>
          </div>
          <div>
            <div className="text-gray-500 mb-8">승 인</div>
            <div className="border-t border-gray-300 pt-1">날짜:</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          생성일시: {new Date(report.generatedAt).toLocaleString('ko-KR')} | EZONE MES 자동 생성
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-card border bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={cn('text-sm font-medium', mono && 'font-mono text-xs')}>{value || '-'}</div>
    </div>
  );
}
