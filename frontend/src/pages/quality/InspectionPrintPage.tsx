import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ArrowLeft, Printer } from 'lucide-react';
import { AttachmentSection } from '@/components/shared/AttachmentSection';

// ─────────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────────
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
  tolerance?: string | null;
  process_name?: string | null;
  sub_part?: string | null;
  direction?: string | null;
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
  // 추가 필드
  supplier_lot?: string | null;
  supplier?: string | null;
  lot_qty?: number | null;
  structure_name?: string | null;
  spec?: string | null;
  structure_code?: string | null;
}

// ─────────────────────────────────────────────
// 공통 스타일 헬퍼
// ─────────────────────────────────────────────
const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: '1px solid black', padding: '3px 6px', fontSize: 11, ...extra,
});
const th = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: '1px solid black', padding: '3px 6px', fontSize: 11,
  background: '#f5f5f5', fontWeight: 700, textAlign: 'center', ...extra,
});

// ─────────────────────────────────────────────
// EZONE 로고
// ─────────────────────────────────────────────
function EzoneLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontWeight: 900,
        fontSize: fs,
        letterSpacing: -1,
        color: '#111',
      }}>
        EZ<span style={{
          display: 'inline-block',
          width: fs * 0.55,
          height: fs * 0.55,
          borderRadius: '50%',
          background: '#e53e3e',
          margin: `0 1px`,
          verticalAlign: 'middle',
          position: 'relative',
          top: -1,
        }}></span>NE
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 결재란
// ─────────────────────────────────────────────
function ApprovalBox({ author }: { author?: string }) {
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11, height: '100%' }}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{
            border: '1px solid black', padding: '2px 6px',
            background: '#f5f5f5', fontWeight: 700, fontSize: 12,
            textAlign: 'center', verticalAlign: 'middle',
            writingMode: 'vertical-lr', letterSpacing: 4,
          }}>결재</td>
          <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>작 성</td>
          <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>검 토</td>
          <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>승 인</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid black', padding: '4px 10px', minWidth: 55, height: 38, textAlign: 'center', verticalAlign: 'middle', fontSize: 11 }}>{author || ''}</td>
          <td style={{ border: '1px solid black', minWidth: 55, height: 38 }}></td>
          <td style={{ border: '1px solid black', minWidth: 55, height: 38 }}></td>
        </tr>
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────
// 양식 1: 원자재 인수검사 성적서 (EZC-D-101-1)
// ─────────────────────────────────────────────
function IncomingInspectionForm({ data, lotInfo }: { data: InspectionData; lotInfo: any }) {
  const date = data.inspected_at ? new Date(data.inspected_at) : new Date();
  const [y, m, d] = [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  // 육안/성분 항목 분류
  const visualItems = data.details.filter(d => d.quality_item === '겉모양' || d.check_method === '육안');
  const measuredItems = data.details.filter(d => d.check_method !== '육안' && d.check_method !== '제조사\n시험성적서' && d.check_method !== '공인기관\n의뢰');
  const certItems = data.details.filter(d => d.check_method === '제조사\n시험성적서' || d.check_method?.includes('시험성적서'));
  const authItems = data.details.filter(d => d.check_method === '공인기관\n의뢰' || d.check_method?.includes('공인기관'));

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '12px 16px', width: 130, verticalAlign: 'middle' }}>
              <EzoneLogo size="lg" />
            </td>
            <td style={{ border: '1px solid black', padding: '12px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 8 }}>원자재 인수검사 성적서</span>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'middle', width: 220 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={th({ writingMode: 'vertical-lr', letterSpacing: 4, padding: '4px 8px' })}>결<br/>재</td>
                    <td style={th({ letterSpacing: 2 })}>작 성</td>
                    <td style={th({ letterSpacing: 2 })}>검 토</td>
                    <td style={th({ letterSpacing: 2 })}>승 인</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid black', height: 40, minWidth: 50, textAlign: 'center', verticalAlign: 'middle', fontSize: 11 }}>{data.inspector || ''}</td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 기본정보 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={th({ width: 90, letterSpacing: 2 })}>품 명</td>
            <td style={td({ width: 160 })}>{data.item_name || lotInfo?.item_name || ''}</td>
            <td style={th({ letterSpacing: 2 })}>입고일자</td>
            <td style={td()}>202 &nbsp; 년 &nbsp; &nbsp; 월 &nbsp; &nbsp; 일</td>
            <td style={th({ letterSpacing: 2 })}>검사일자</td>
            <td style={td()}>202 &nbsp; 년 &nbsp; &nbsp; 월 &nbsp; &nbsp; 일</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>입고처<br/>로트번호</td>
            <td style={td({ fontFamily: 'Courier New, monospace', fontSize: 10 })}>{data.supplier_lot || lotInfo?.supplier_lot || ''}</td>
            <td style={th({ letterSpacing: 2 })}>입 고 처</td>
            <td style={td()}>{data.supplier || lotInfo?.supplier || ''}</td>
            <td style={th({ letterSpacing: 2 })}>검 사 자</td>
            <td style={td()}>{data.inspector || ''}</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 1 })}>인수검사<br/>로트번호</td>
            <td style={td({ fontFamily: 'Courier New, monospace', fontSize: 10 })}>{data.lot_number || ''}</td>
            <td colSpan={3} style={th({ textAlign: 'left', letterSpacing: 2, paddingLeft: 12 })}>로 트 수 량</td>
            <td style={td({ textAlign: 'right' })}>{data.lot_qty ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 검사 항목 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={th({ width: 80 })} rowSpan={2}>검사항목</th>
            <th style={th()} colSpan={2}>기준 및 허용차</th>
            <th style={th({ width: 60 })} rowSpan={2}>검사<br/>방법</th>
            <th style={th({ width: 55 })} rowSpan={2}>검사<br/>주기</th>
            <th style={th({ width: 55 })} rowSpan={2}>검사<br/>조건</th>
            <th style={th()} colSpan={3}>측정치</th>
            <th style={th()} colSpan={2}>결과</th>
          </tr>
          <tr>
            <th style={th({ width: 70 })}>기준</th>
            <th style={th({ width: 70 })}>허용차</th>
            <th style={th({ width: 45 })}>n1</th>
            <th style={th({ width: 45 })}>n2</th>
            <th style={th({ width: 45 })}>n3</th>
            <th style={th({ width: 45 })}>적합</th>
            <th style={th({ width: 45 })}>부적합</th>
          </tr>
        </thead>
        <tbody>
          {data.details.length === 0 ? (
            <tr>
              <td colSpan={11} style={td({ textAlign: 'center', color: '#999', height: 40 })}>검사 항목 없음</td>
            </tr>
          ) : (
            data.details.map((item) => {
              const isPass = item.item_result === 'PASS';
              const isFail = item.item_result === 'FAIL';
              return (
                <tr key={item.detail_id} style={{ height: 28 }}>
                  <td style={td()}>{item.quality_item}{item.check_item ? ` / ${item.check_item}` : ''}</td>
                  <td style={td({ textAlign: 'center' })}>{item.cert_standard != null ? String(item.cert_standard) : ''}</td>
                  <td style={td({ textAlign: 'center' })}>{item.tolerance || ''}</td>
                  <td style={td({ textAlign: 'center', fontSize: 10 })}>{item.check_method || ''}</td>
                  <td style={td({ textAlign: 'center' })}>매로트</td>
                  <td style={td({ textAlign: 'center', fontSize: 10 })}>n = {data.sampling_n}<br/>c = {data.accept_c}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n1 != null ? item.measured_n1 : ''}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n2 != null ? item.measured_n2 : ''}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n3 != null ? item.measured_n3 : ''}</td>
                  <td style={td({ textAlign: 'center' })}>{isPass ? '□' : '□'}</td>
                  <td style={td({ textAlign: 'center' })}>{isFail ? '■' : '□'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* 판정 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td rowSpan={3} style={th({ width: 60, letterSpacing: 2, verticalAlign: 'middle' })}>판 정</td>
            <td style={td({ width: 80 })}>
              {data.result === 'PASS' ? '■' : '□'} 합 격
            </td>
            <td style={td()} rowSpan={3}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>※성적서 정보</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 10, color: '#333' }}>{data.remarks || ''}</div>
            </td>
          </tr>
          <tr>
            <td style={td()}>
              {data.result === 'FAIL' ? '■' : '□'} 불합격
            </td>
          </tr>
          <tr>
            <td style={td({ height: 20 })}></td>
          </tr>
        </tbody>
      </table>

      {/* 비고 및 첨부 */}
      <AttachmentSection refType="INSPECTION" refId={data.insp_id} printMode />

      {/* 문서번호 */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC-D-101-1</span>
        <span>(주) 이지원</span>
        <span>A4(210x297)mm</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 양식 2: 재단공정 중간검사 성적서 (EZC-C-701-G01)
// ─────────────────────────────────────────────
function ProcessInspectionForm({ data, lotInfo }: { data: InspectionData; lotInfo: any }) {
  const date = data.inspected_at ? new Date(data.inspected_at) : new Date();

  // 공정명별로 항목 그룹핑
  const grouped: Record<string, Record<string, InspectionDetail[]>> = {};
  for (const item of data.details) {
    const proc = item.process_name || '재단 공정';
    const sub = item.sub_part || item.quality_item || '';
    if (!grouped[proc]) grouped[proc] = {};
    if (!grouped[proc][sub]) grouped[proc][sub] = [];
    grouped[proc][sub].push(item);
  }


  // 단순 목록으로 펼치기 (최대 12행)
  const emptyDetail: InspectionDetail = {
    detail_id: 0, item_no: 0, quality_item: '', check_item: '',
    check_method: '', cert_standard: null, prod_standard: null,
    measured_n1: null, measured_n2: null, measured_n3: null,
    is_applicable: true, item_result: null,
    tolerance: null, process_name: null, sub_part: null, direction: null,
  };
  const rows: InspectionDetail[] = data.details.length > 0
    ? data.details
    : Array.from({ length: 12 }, (_, i) => ({ ...emptyDetail, detail_id: i, item_no: i + 1 }));


  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '12px 16px', width: 130, verticalAlign: 'middle' }}>
              <EzoneLogo size="lg" />
            </td>
            <td style={{ border: '1px solid black', padding: '12px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 6 }}>재단공정 중간검사 성적서</span>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'middle', width: 210 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={th({ writingMode: 'vertical-lr', letterSpacing: 4, padding: '4px 8px' })}>결재</td>
                    <td style={th({ letterSpacing: 2 })}>작 성</td>
                    <td style={th({ letterSpacing: 2 })}>검 토</td>
                    <td style={th({ letterSpacing: 2 })}>승 인</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid black', height: 40, minWidth: 50, textAlign: 'center', verticalAlign: 'middle', fontSize: 11 }}>{data.inspector || ''}</td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 기본정보 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={th({ width: 80, letterSpacing: 2 })}>상 품 명</td>
            <td style={td()}>{data.item_name || 'EZ-덕트내화채움구조'}</td>
            <td style={th({ letterSpacing: 2 })}>검사일자</td>
            <td style={td()}>202 &nbsp; 년 &nbsp; 월 &nbsp; 일</td>
            <td style={th({ letterSpacing: 2 })}>검 사 자</td>
            <td style={td()}>{data.inspector || ''}</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>규 격</td>
            <td style={td()}>{data.spec || ''}</td>
            <td style={th({ letterSpacing: 2 })}>생산부위</td>
            <td style={td()}>EZ F.B Duct 방화소켓</td>
            <td style={th({ letterSpacing: 2 })}>부 위 명</td>
            <td style={td()}></td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>구 조 명</td>
            <td colSpan={3} style={td()}>{data.structure_name || ''}</td>
            <td style={th({ letterSpacing: 2 })}>검사주기</td>
            <td style={td()}>매로트</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>로트번호</td>
            <td colSpan={3} style={td({ fontFamily: 'Courier New, monospace', fontSize: 10 })}>{data.lot_number || ''}</td>
            <td style={th({ letterSpacing: 2 })}>로트수량</td>
            <td style={td({ textAlign: 'right' })}>{data.lot_qty ?? ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 검사 항목 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th({ width: 70 })}>공 정 명</th>
            <th style={th({ width: 60 })}>검사<br/>항목</th>
            <th style={th()} colSpan={3}>기준 및 허용차</th>
            <th style={th({ width: 50 })}>검사<br/>방법</th>
            <th style={th()} colSpan={3}>중간검사 결과</th>
            <th style={th({ width: 45 })}>적합</th>
            <th style={th({ width: 45 })}>부적합</th>
          </tr>
          <tr>
            <th style={th()}></th>
            <th style={th()}></th>
            <th style={th({ width: 60 })}>부위</th>
            <th style={th({ width: 80 })}>방향</th>
            <th style={th({ width: 80 })}>기준 및 허용차</th>
            <th style={th()}></th>
            <th style={th({ width: 45 })}>n1</th>
            <th style={th({ width: 45 })}>n2</th>
            <th style={th({ width: 45 })}>n3</th>
            <th style={th()}></th>
            <th style={th()}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => {
            const isPass = item.item_result === 'PASS';
            const isFail = item.item_result === 'FAIL';
            return (
              <tr key={item.detail_id || idx} style={{ height: 26 }}>
                <td style={td({ fontSize: 10 })}>{item.process_name || (idx === 0 ? '재단 공정' : '')}</td>
                <td style={td({ fontSize: 10 })}>{item.quality_item || ''}</td>
                <td style={td({ fontSize: 10 })}>{item.sub_part || ''}</td>
                <td style={td({ fontSize: 10 })}>{item.direction || ''}</td>
                <td style={td({ textAlign: 'center', fontSize: 10 })}>
                  {item.cert_standard != null ? `${item.cert_standard} ${item.tolerance || '이상'}` : ''}
                </td>
                <td style={td({ textAlign: 'center', fontSize: 10 })}>{item.check_method || ''}</td>
                <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n1 != null ? item.measured_n1 : ''}</td>
                <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n2 != null ? item.measured_n2 : ''}</td>
                <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n3 != null ? item.measured_n3 : ''}</td>
                <td style={td({ textAlign: 'center' })}>{isPass ? '■' : '□'}</td>
                <td style={td({ textAlign: 'center' })}>{isFail ? '■' : '□'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 판정 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={th({ width: 60, letterSpacing: 2, verticalAlign: 'middle' })} rowSpan={2}>판 정</td>
            <td style={td({ width: 80 })}>
              {data.result === 'PASS' ? '■' : '□'} 합 격<br />
              {data.result === 'FAIL' ? '■' : '□'} 불합격
            </td>
            <td style={th({ width: 60, letterSpacing: 2 })}>특이사항</td>
            <td style={td()}>{data.remarks || ''}</td>
          </tr>
        </tbody>
      </table>

      <AttachmentSection refType="INSPECTION" refId={data.insp_id} printMode />

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC-C-701-G01</span>
        <span>(주) 이지원</span>
        <span>A4(210x297)mm</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 양식 3: 벽체 내화채움구조 제품검사 성적서 (EZC-C-901-1)
// ─────────────────────────────────────────────
function ProductInspectionForm({ data, lotInfo }: { data: InspectionData; lotInfo: any }) {
  const date = data.inspected_at ? new Date(data.inspected_at) : new Date();

  // 품질항목별 그룹핑을 위한 준비
  const qItems = [
    { group: '내화채움구조', item: '겉모양' },
    { group: 'EZ F.B Duct 방화소켓', sub: 'VM200', item: '겉모양 / 브라켓 결합 상태', criteria: '파손 유무\n흠, 비틀림, 구부러짐 유무' },
    { group: 'EZ F.B Duct 방화소켓', item: '치수(mm)', criteria: '이상' },
    { group: '외부', item: '세라믹울 차열재 / 차열시트', criteria: '겉모양 / 결합 상태' },
    { group: 'EZ F.B 방화플래싱', item: '겉모양 / 결합 상태' },
    { group: '단열재 그라스울', item: '겉모양' },
    { group: '단열재 세라믹울', item: '겉모양' },
  ];

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '12px 16px', width: 130, verticalAlign: 'middle' }}>
              <EzoneLogo size="lg" />
            </td>
            <td style={{ border: '1px solid black', padding: '12px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>벽체 내화채움구조 제품검사 성적서</span>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'middle', width: 210 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={th({ writingMode: 'vertical-lr', letterSpacing: 4, padding: '4px 8px' })}>결재</td>
                    <td style={th({ letterSpacing: 2 })}>작 성</td>
                    <td style={th({ letterSpacing: 2 })}>검 토</td>
                    <td style={th({ letterSpacing: 2 })}>승 인</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid black', height: 40, minWidth: 50, textAlign: 'center', verticalAlign: 'middle', fontSize: 11 }}>{data.inspector || ''}</td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                    <td style={{ border: '1px solid black', height: 40 }}></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 기본정보 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={th({ width: 70, letterSpacing: 2 })}>상 품 명</td>
            <td style={td()}>{data.item_name || 'EZ-덕트내화채움구조'}</td>
            <td style={th({ letterSpacing: 2 })}>검사일자</td>
            <td style={td()}>202 &nbsp; 년 &nbsp; 월 &nbsp; 일</td>
            <td style={th({ letterSpacing: 2 })}>검 사 자</td>
            <td style={td()}>{data.inspector || ''}</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>규 격</td>
            <td style={td()}>{data.spec || ''}</td>
            <td style={th({ letterSpacing: 2 })}>로트수량</td>
            <td style={td({ textAlign: 'right' })}>{data.lot_qty ?? ''}</td>
            <td style={th({ letterSpacing: 2 })}>검사주기</td>
            <td style={td()}>매로트</td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>구 조 명</td>
            <td colSpan={5} style={td()}>
              {data.structure_name || 'EZ-F.B-POSMAC Duct-'}
            </td>
          </tr>
          <tr>
            <td style={th({ letterSpacing: 2 })}>로트번호</td>
            <td colSpan={5} style={td({ fontFamily: 'Courier New, monospace', fontSize: 10 })}>{data.lot_number || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 검사항목 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={th({ width: 80 })} rowSpan={2}>품질항목</th>
            <th style={th({ width: 100 })} rowSpan={2}>검사항목</th>
            <th style={th()} rowSpan={2}>기준 및 허용차</th>
            <th style={th({ width: 60 })} rowSpan={2}>검사방법</th>
            <th style={th()} colSpan={3}>측정치</th>
            <th style={th()} colSpan={2}>결과</th>
          </tr>
          <tr>
            <th style={th({ width: 45 })}>n1</th>
            <th style={th({ width: 45 })}>n2</th>
            <th style={th({ width: 45 })}>n3</th>
            <th style={th({ width: 45 })}>적합</th>
            <th style={th({ width: 45 })}>부적합</th>
          </tr>
        </thead>
        <tbody>
          {data.details.length === 0 ? (
            <tr>
              <td colSpan={9} style={td({ textAlign: 'center', color: '#999', height: 40 })}>검사 항목 없음</td>
            </tr>
          ) : (
            data.details.map((item, idx) => {
              const isPass = item.item_result === 'PASS';
              const isFail = item.item_result === 'FAIL';
              return (
                <tr key={item.detail_id || idx} style={{ height: 28 }}>
                  <td style={td({ fontSize: 10 })}>{item.quality_item || ''}</td>
                  <td style={td({ fontSize: 10 })}>{item.check_item || ''}</td>
                  <td style={td({ fontSize: 10 })}>
                    {item.cert_standard != null ? `${item.cert_standard}` : ''}
                    {item.tolerance ? ` ${item.tolerance}` : ''}
                  </td>
                  <td style={td({ textAlign: 'center', fontSize: 10 })}>{item.check_method || '육안'}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n1 != null ? item.measured_n1 : ''}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n2 != null ? item.measured_n2 : ''}</td>
                  <td style={td({ textAlign: 'center', fontFamily: 'Courier New, monospace' })}>{item.measured_n3 != null ? item.measured_n3 : ''}</td>
                  <td style={td({ textAlign: 'center' })}>{isPass ? '■' : '□'}</td>
                  <td style={td({ textAlign: 'center' })}>{isFail ? '■' : '□'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* 사용 LOT 정보 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={th()} colSpan={2}>항 목</th>
            <th style={th()}>로 트 번 호</th>
          </tr>
        </thead>
        <tbody>
          {[
            'EZ F.B Duct 방화소켓 조립품',
            '그라스울 단열재 ( K   T   L)',
            '세라믹울 단열재 ( K   T   L)',
            '세라믹울 차열재 ( K   T   L)',
            'EZ F.B 방화플래싱',
          ].map((item, i) => (
            <tr key={i} style={{ height: 22 }}>
              <td colSpan={2} style={td({ fontSize: 10 })}>{item}</td>
              <td style={td({ fontFamily: 'Courier New, monospace', fontSize: 10 })}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 판정 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={th({ width: 60, letterSpacing: 2, verticalAlign: 'middle' })} rowSpan={2}>판 정</td>
            <td style={td({ width: 90 })}>
              {data.result === 'PASS' ? '■' : '□'} 합 격<br />
              {data.result === 'FAIL' ? '■' : '□'} 불합격
            </td>
            <td style={th({ width: 60, letterSpacing: 2 })}>비 고</td>
            <td style={td()}>{data.remarks || ''}</td>
          </tr>
        </tbody>
      </table>

      <AttachmentSection refType="INSPECTION" refId={data.insp_id} printMode />

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC-C-901-1</span>
        <span>(주) 이지원</span>
        <span>A4(210x297)mm</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
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
  const isProcess = data.insp_type === 'PROCESS';
  const isFqc = data.insp_type === 'FQC' || data.insp_type === 'FINAL';

  const title = isIncoming ? '원자재 인수검사 성적서' :
    isProcess ? '재단공정 중간검사 성적서' : '벽체 내화채움구조 제품검사 성적서';

  const renderForm = () => {
    if (isIncoming) return <IncomingInspectionForm data={data} lotInfo={lotInfo} />;
    if (isProcess) return <ProcessInspectionForm data={data} lotInfo={lotInfo} />;
    return <ProductInspectionForm data={data} lotInfo={lotInfo} />;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 화면 전용 헤더 */}
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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <Printer size={16} /> A4 인쇄
        </button>
      </div>

      {/* 인쇄 영역 */}
      <div id="print-area" className="bg-white print:border-0 print:rounded-none" style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <div
          className="mx-auto print:w-full print:shadow-none print:p-0"
          style={{ width: 793, minHeight: 1100, padding: '28px 32px', boxSizing: 'border-box' }}
        >
          {renderForm()}
        </div>
      </div>

      {/* 전역 인쇄 스타일 */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area { visibility: visible !important; position: fixed !important; top: 0; left: 0; width: 100%; }
          #print-area * { visibility: visible !important; }
          .print\\:hidden { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
