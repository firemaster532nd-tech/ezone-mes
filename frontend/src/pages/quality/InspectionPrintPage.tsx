import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Printer } from 'lucide-react';
import { AttachmentSection } from '@/components/shared/AttachmentSection';

interface InspectionDetail {
  detail_id: number;
  item_no: number;
  quality_item: string;
  check_item: string;
  check_method: string;
  cert_standard: number | null;
  prod_standard: number | null;
  measured_n1: number | null;
  measured_n2: number | null;
  measured_n3: number | null;
  is_applicable: boolean;
  item_result: string | null;
}

interface InspectionData {
  insp_id: number;
  insp_type: string;
  form_code: string;
  result: string;
  inspector: string;
  inspected_at: string;
  shipped_at: string | null;
  remarks: string;
  sampling_n: number;
  accept_c: number;
  lot_number: string;
  item_name: string;
  item_code: string;
  cert_number: string | null;
  base_lot: string | null;
  serial_start: number | null;
  serial_end: number | null;
  details: InspectionDetail[];
}

export function InspectionPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InspectionData | null>(null);
  const [lotInfo, setLotInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: InspectionData }>(`/inspections/${id}`)
      .then((r) => {
        setData(r.data);
        // LOT 정보 추가 조회
        if (r.data.lot_number) {
          return api.get<{ data: any[] }>(`/inventory/lots?status=ACTIVE`).then((lr) => {
            const lot = lr.data.find((l: any) => l.lot_number === r.data.lot_number);
            if (lot) setLotInfo(lot);
          });
        }
      })
      .catch(() => alert('검사 데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-gray-400">검사 데이터가 없습니다.</div>;

  const isIncoming = data.insp_type === 'INCOMING';
  const inspDate = data.inspected_at ? new Date(data.inspected_at) : new Date();
  const title = isIncoming ? '인수검사 성적서' : data.insp_type === 'PROCESS' ? '중간검사 성적서' : '최종검사 성적서';

  // 측정 항목 vs 성적서 대체 항목 분리
  const measuredItems = data.details.filter(d => d.check_method !== '성적서' && d.check_method !== '공인기관');
  const certItems = data.details.filter(d => d.check_method === '성적서' || d.check_method === '공인기관');

  return (
    <div className="max-w-4xl mx-auto">
      {/* 화면용 헤더 (인쇄 시 숨김) */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-gray-500">{data.form_code} | 검사ID: {data.insp_id}</p>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 border rounded-md text-shop-sm hover:bg-gray-50">
          <Printer size={16} /> 인쇄
        </button>
      </div>

      {/* ===== 인쇄 영역 시작 ===== */}
      <div className="bg-white border rounded-lg print:border-0 print:rounded-none" id="print-area">
        {/* 문서 헤더 */}
        <div className="border-b-2 border-black p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">양식번호: EZC-{data.form_code}</div>
              <h1 className="text-xl font-bold">{title}</h1>
              <div className="text-sm text-gray-600 mt-1">(주) 이지원 품질관리부</div>
            </div>
            <div className="border rounded">
              <table className="text-xs">
                <tbody>
                  <tr className="border-b">
                    <td className="px-3 py-1.5 bg-gray-50 font-medium border-r">작 성</td>
                    <td className="px-3 py-1.5 bg-gray-50 font-medium border-r">검 토</td>
                    <td className="px-3 py-1.5 bg-gray-50 font-medium">승 인</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-4 border-r min-w-[60px] text-center text-gray-400">{data.inspector || ''}</td>
                    <td className="px-3 py-4 border-r min-w-[60px]"></td>
                    <td className="px-3 py-4 min-w-[60px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 기본정보 */}
        <div className="p-6 print:p-4">
          <table className="w-full text-sm border">
            <tbody>
              <tr>
                <td className="px-3 py-2 bg-gray-50 font-medium border w-28">품 명</td>
                <td className="px-3 py-2 border">{data.item_name || lotInfo?.item_name || '-'}</td>
                <td className="px-3 py-2 bg-gray-50 font-medium border w-28">입고일자</td>
                <td className="px-3 py-2 border">{inspDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 bg-gray-50 font-medium border">검사일자</td>
                <td className="px-3 py-2 border">{inspDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                <td className="px-3 py-2 bg-gray-50 font-medium border">검사자</td>
                <td className="px-3 py-2 border">{data.inspector || '-'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 bg-gray-50 font-medium border">LOT 번호</td>
                <td className="px-3 py-2 border font-mono text-xs">{data.lot_number || '-'}</td>
                <td className="px-3 py-2 bg-gray-50 font-medium border">공급처LOT</td>
                <td className="px-3 py-2 border font-mono text-xs">{lotInfo?.supplier_lot || '-'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 bg-gray-50 font-medium border">검사주기</td>
                <td className="px-3 py-2 border">매로트</td>
                <td className="px-3 py-2 bg-gray-50 font-medium border">검사조건</td>
                <td className="px-3 py-2 border">n={data.sampling_n}, c={data.accept_c}</td>
              </tr>
              {data.cert_number && (
                <tr>
                  <td className="px-3 py-2 bg-gray-50 font-medium border">인정번호</td>
                  <td className="px-3 py-2 border font-mono text-xs" colSpan={3}>{data.cert_number}</td>
                </tr>
              )}
              {data.insp_type === 'PROCESS' && (lotInfo?.base_lot || data.base_lot) && (
                <>
                  <tr>
                    <td className="px-3 py-2 bg-gray-50 font-medium border">구조 LOT</td>
                    <td className="px-3 py-2 border font-mono text-xs" colSpan={3}>
                      {lotInfo?.base_lot || data.base_lot}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 bg-gray-50 font-medium border">시리얼 범위</td>
                    <td className="px-3 py-2 border font-mono text-xs" colSpan={3}>
                      {String(lotInfo?.serial_start ?? data.serial_start ?? 0).padStart(3, '0')} ~ {String(lotInfo?.serial_end ?? data.serial_end ?? 0).padStart(3, '0')}
                      {' '}(수량: {((lotInfo?.serial_end ?? data.serial_end ?? 0) - (lotInfo?.serial_start ?? data.serial_start ?? 0) + 1)}개)
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {/* 측정 검사항목 */}
          <h3 className="text-sm font-bold mt-6 mb-2">검사 항목 (실측)</h3>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-2 border font-medium text-center w-8">No</th>
                <th className="px-2 py-2 border font-medium text-left">품질특성</th>
                <th className="px-2 py-2 border font-medium text-left">검사항목</th>
                <th className="px-2 py-2 border font-medium text-center w-20">검사방법</th>
                <th className="px-2 py-2 border font-medium text-center w-16">기준치</th>
                <th className="px-2 py-2 border font-medium text-center w-16">n1</th>
                <th className="px-2 py-2 border font-medium text-center w-16">n2</th>
                <th className="px-2 py-2 border font-medium text-center w-16">n3</th>
                <th className="px-2 py-2 border font-medium text-center w-14">판정</th>
              </tr>
            </thead>
            <tbody>
              {measuredItems.length === 0 ? (
                <tr><td colSpan={9} className="px-2 py-3 border text-center text-gray-400">실측 항목 없음</td></tr>
              ) : (
                measuredItems.map((d) => (
                  <tr key={d.detail_id}>
                    <td className="px-2 py-1.5 border text-center">{d.item_no}</td>
                    <td className="px-2 py-1.5 border">{d.quality_item}</td>
                    <td className="px-2 py-1.5 border">{d.check_item}</td>
                    <td className="px-2 py-1.5 border text-center">{d.check_method}</td>
                    <td className="px-2 py-1.5 border text-center font-mono">
                      {d.cert_standard != null ? d.cert_standard : '-'}
                    </td>
                    <td className="px-2 py-1.5 border text-center font-mono">
                      {d.measured_n1 != null ? d.measured_n1 : d.check_method === '육안' ? '✓' : '-'}
                    </td>
                    <td className="px-2 py-1.5 border text-center font-mono">
                      {d.measured_n2 != null ? d.measured_n2 : d.check_method === '육안' ? '✓' : '-'}
                    </td>
                    <td className="px-2 py-1.5 border text-center font-mono">
                      {d.measured_n3 != null ? d.measured_n3 : d.check_method === '육안' ? '✓' : '-'}
                    </td>
                    <td className={cn('px-2 py-1.5 border text-center font-medium',
                      d.item_result === 'PASS' ? 'text-green-700' :
                      d.item_result === 'FAIL' ? 'text-red-600' : '')}>
                      {d.item_result === 'PASS' ? '합격' : d.item_result === 'FAIL' ? '불합격' : d.item_result === 'NA' ? 'N/A' : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 성적서 대체 항목 */}
          {certItems.length > 0 && (
            <>
              <h3 className="text-sm font-bold mt-6 mb-2">성적서 대체 항목</h3>
              <table className="w-full text-xs border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 border font-medium text-center w-8">No</th>
                    <th className="px-2 py-2 border font-medium text-left">품질특성</th>
                    <th className="px-2 py-2 border font-medium text-left">검사항목</th>
                    <th className="px-2 py-2 border font-medium text-center w-20">확인방법</th>
                    <th className="px-2 py-2 border font-medium text-center w-16">기준치</th>
                    <th className="px-2 py-2 border font-medium text-center">비고 (성적서 정보)</th>
                    <th className="px-2 py-2 border font-medium text-center w-14">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {certItems.map((d) => (
                    <tr key={d.detail_id}>
                      <td className="px-2 py-1.5 border text-center">{d.item_no}</td>
                      <td className="px-2 py-1.5 border">{d.quality_item}</td>
                      <td className="px-2 py-1.5 border">{d.check_item}</td>
                      <td className="px-2 py-1.5 border text-center">{d.check_method}</td>
                      <td className="px-2 py-1.5 border text-center font-mono">
                        {d.cert_standard != null ? d.cert_standard : '-'}
                      </td>
                      <td className="px-2 py-1.5 border text-center font-mono text-gray-500">
                        {d.measured_n1 != null ? `n1: ${d.measured_n1}` : 'N/A'}
                      </td>
                      <td className={cn('px-2 py-1.5 border text-center font-medium',
                        d.item_result === 'PASS' ? 'text-green-700' :
                        d.item_result === 'FAIL' ? 'text-red-600' : '')}>
                        {d.item_result === 'PASS' ? '합격' : d.item_result === 'FAIL' ? '불합격' : d.item_result === 'NA' ? 'N/A' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 종합 판정 */}
          <div className="mt-6 border-2 rounded p-4 flex items-center justify-between">
            <div className="text-sm font-bold">종합 판정</div>
            <div className="flex gap-8">
              <label className="flex items-center gap-2 text-sm">
                <span className={cn('w-5 h-5 border-2 rounded flex items-center justify-center text-xs',
                  data.result === 'PASS' ? 'border-green-600 bg-green-100 text-green-700' : 'border-gray-300')}>
                  {data.result === 'PASS' ? '✓' : ''}
                </span>
                합 격
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className={cn('w-5 h-5 border-2 rounded flex items-center justify-center text-xs',
                  data.result === 'FAIL' ? 'border-red-600 bg-red-100 text-red-700' : 'border-gray-300')}>
                  {data.result === 'FAIL' ? '✓' : ''}
                </span>
                불합격
              </label>
            </div>
          </div>

          {/* 비고 */}
          {data.remarks && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-1">비고</div>
              <div className="border rounded p-3 text-sm text-gray-700 min-h-[40px]">{data.remarks}</div>
            </div>
          )}

          {/* Attachments (images only for print) */}
          <AttachmentSection refType="INSPECTION" refId={data.insp_id} printMode />

          {/* Footer */}
          <div className="mt-8 text-xs text-gray-400 text-center print:mt-4">
            발행일시: {new Date().toLocaleString('ko-KR')} | EZONE MES 자동 생성 | 양식: EZC-{data.form_code}
          </div>
        </div>
      </div>
    </div>
  );
}
