import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProcessBadge } from '@/components/shared/ProcessBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Printer, Link2 } from 'lucide-react';

interface WorkOrder {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  process_code: string;
  status: string;
  item_name: string | null;
  structure_code: string | null;
  structure_name: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  lot_number: string | null;
  am_worker: string | null;
  pm_worker: string | null;
  night_worker: string | null;
  start_time: string | null;
  end_time: string | null;
  input_weight_kg: number | null;
  production_length_m: number | null;
  scrap_kg: number | null;
  equipment_id: string | null;
  downtime_minutes: number | null;
  thickness_mm: number | null;
  width_mm: number | null;
  product_type: string | null;
  inspector: string | null;
}

interface MixLot {
  wo_id: number;
  wo_number: string;
  wo_date: string;
  lot_number: string;
  actual_qty: number | null;
  input_weight_kg: number | null;
  item_name: string | null;
}

const processTabs = [
  { key: '', label: '전체' },
  { key: 'MIX', label: '배합' },
  { key: 'EXT', label: '압출' },
  { key: 'CUT', label: '재단' },
  { key: 'ASM', label: '조립' },
];

// ─────────────────────────────────────────────
// EZC 로고 컴포넌트 (텍스트 기반 표현)
// ─────────────────────────────────────────────
function EzoneLogoPrint() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid black', padding: '4px 10px', width: 80 }}>
      <span style={{ fontFamily: 'Arial Black, sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: -1, color: '#000' }}>
        EZ<span style={{ color: '#e53e3e' }}>●</span>NE
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 결재란 컴포넌트 (우상단 고정)
// ─────────────────────────────────────────────
function ApprovalBox({ author }: { author?: string }) {
  const cellStyle: React.CSSProperties = {
    border: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 11, minWidth: 50,
  };
  const labelStyle: React.CSSProperties = {
    ...cellStyle, background: '#f5f5f5', fontWeight: 700, letterSpacing: 2,
  };
  const signStyle: React.CSSProperties = {
    ...cellStyle, height: 36, verticalAlign: 'middle',
  };
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ border: '1px solid black', padding: '2px 6px', background: '#f5f5f5', fontWeight: 700, fontSize: 12, letterSpacing: 2, verticalAlign: 'middle', writingMode: 'vertical-lr', textOrientation: 'upright' }}>결재</td>
          <td style={labelStyle}>작 성</td>
          <td style={labelStyle}>검 토</td>
          <td style={labelStyle}>승 인</td>
        </tr>
        <tr>
          <td style={signStyle}>{author || ''}</td>
          <td style={signStyle}></td>
          <td style={signStyle}></td>
        </tr>
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────
// MIX 배합생산일지 (EZC B-201-1)
// ─────────────────────────────────────────────
function MixPrintForm({ workOrder, log }: { workOrder: WorkOrder; log: any }) {
  const lots: string[] = [];
  if (workOrder.lot_number) {
    const base = workOrder.lot_number.replace(/~.*/, '');
    for (let i = 1; i <= 16; i++) {
      const seq = String(i).padStart(2, '0');
      lots.push(`${base.replace(/-S\d+$/, '')}-S${seq}`);
    }
  } else {
    for (let i = 1; i <= 16; i++) lots.push(`______-S${String(i).padStart(2,'0')}`);
  }

  const tdBorder: React.CSSProperties = { border: '1px solid black', padding: '3px 5px', fontSize: 11 };
  const thBorder: React.CSSProperties = { ...tdBorder, background: '#f5f5f5', fontWeight: 700, textAlign: 'center' };

  const woDate = workOrder.wo_date || '';
  const [y, m, d] = woDate.split('-');

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더: EZONE로고+설비번호 | 제목 | 결재란 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '6px 10px', width: 120, verticalAlign: 'middle' }}>
              <EzoneLogoPrint />
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, color: '#555', fontWeight: 600 }}>설비번호</div>
                <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'Courier New, monospace' }}>{workOrder.equipment_id || 'EZC-M-09'}</div>
              </div>
            </td>
            <td style={{ border: '1px solid black', padding: '10px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
              <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: 8 }}>배 합 생 산 일 지</span>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'top', width: 230 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={{ border: '1px solid black', padding: '4px 6px', background: '#f5f5f5', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', fontSize: 12, letterSpacing: 4, writingMode: 'vertical-lr' as const }}>결재</td>
                    <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>작 성</td>
                    <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>검 토</td>
                    <td style={{ border: '1px solid black', padding: '2px 10px', textAlign: 'center', background: '#f5f5f5', fontWeight: 700, letterSpacing: 2, fontSize: 11 }}>승 인</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid black', height: 38, minWidth: 50, textAlign: 'center', verticalAlign: 'middle', fontSize: 11 }}>{workOrder.am_worker || ''}</td>
                    <td style={{ border: '1px solid black', height: 38 }}></td>
                    <td style={{ border: '1px solid black', height: 38 }}></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 생산일자/시간 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ ...thBorder, width: 200, textAlign: 'center', letterSpacing: 4, fontSize: 12 }}>생 산 일 자</td>
            <td style={{ ...tdBorder, textAlign: 'center', fontSize: 14, letterSpacing: 2 }}>
              {y || '202'} . {m || ' '} . {d || ' '}
            </td>
            <td style={{ border: '1px solid black', padding: 0, width: 160 }}>
              <div style={{ display: 'flex' }}>
                <div style={{ ...thBorder, letterSpacing: 2, width: 48, borderRight: '1px solid black' }}>시 간</div>
                <div style={{ flex: 1 }}>
                  <div style={{ borderBottom: '1px solid black', padding: '2px 8px', fontSize: 10 }}>생산시작 :</div>
                  <div style={{ padding: '2px 8px', fontSize: 10 }}>생산종료 :</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 배합생산현황 */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>■배합생산현황</div>
      <div style={{ textAlign: 'right', fontSize: 10, marginBottom: 4 }}>단위 : 중량(kg)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...thBorder, width: 30 }}></th>
            <th style={{ ...thBorder, width: 130 }}>생산LOT No.</th>
            <th style={{ ...thBorder }}>시작시간</th>
            <th style={{ ...thBorder }}>종료시간</th>
            <th style={{ ...thBorder }}>용도</th>
            <th style={{ ...thBorder }}>투입량</th>
            <th style={{ ...thBorder, width: 120 }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 16 }, (_, i) => (
            <tr key={i} style={{ height: 22 }}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, fontFamily: 'Courier New, monospace', fontSize: 10, color: '#444' }}>
                {lots[i] || `______-S${String(i+1).padStart(2,'0')}`}
              </td>
              <td style={tdBorder}></td>
              <td style={tdBorder}></td>
              <td style={tdBorder}></td>
              <td style={tdBorder}></td>
              <td style={tdBorder}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 비고 */}
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>■비 고</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...thBorder, width: 50 }}>넘버</th>
            <th style={{ ...thBorder }}>품질적 특이사항 및 조치사항</th>
          </tr>
        </thead>
        <tbody>
          {[1,2,3].map(i => (
            <tr key={i} style={{ height: 28 }}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i}</td>
              <td style={tdBorder}>{i === 1 ? (log?.remarks || '') : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 생산정지시간 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ ...thBorder, width: 80 }}>생산정지시간<br/>및 사유</td>
                    <td style={{ border: '1px solid black', padding: 4 }}>
                      <div style={{ height: 20, borderBottom: '1px solid #ccc' }}></div>
                      <div style={{ height: 20 }}></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={{ width: '50%', padding: 0, paddingLeft: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ ...thBorder, width: 80 }}>생산정지시간<br/>및 사유</td>
                    <td style={{ border: '1px solid black', padding: 4 }}>
                      <div style={{ height: 20, borderBottom: '1px solid #ccc' }}></div>
                      <div style={{ height: 20 }}></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 하단 */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC B-201-1</span>
        <span>(주)이지원</span>
        <span>A4(210×297)</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EXT 압출생산일지 (EZC-B-201-2)
// ─────────────────────────────────────────────
function ExtPrintForm({ workOrder, log }: { workOrder: WorkOrder; log: any }) {
  const tdBorder: React.CSSProperties = { border: '1px solid black', padding: '3px 5px', fontSize: 11 };
  const thBorder: React.CSSProperties = { ...tdBorder, background: '#f5f5f5', fontWeight: 700, textAlign: 'center' };

  const woDate = workOrder.wo_date || '';
  const [y, m, d] = woDate.split('-');

  const rows = 20;
  const parentLot = log?.parent_lot_number || workOrder.lot_number || '';

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '8px 20px' }}>
              <EzoneLogoPrint />
            </td>
            <td style={{ border: '1px solid black', padding: '10px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 6 }}>압출생산일지</span>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'top', width: 220 }}>
              <ApprovalBox author={workOrder.am_worker || undefined} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 생산일자 */}
      <div style={{ textAlign: 'right', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
        생산일자 : &nbsp; {y || '202'} 년 &nbsp; {m || ''} 월 &nbsp; {d || ''} 일
      </div>

      {/* 생산현황 테이블 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thBorder, width: 30 }}>순번</th>
            <th style={{ ...thBorder, width: 140 }}>투입 생산 LOT 번호</th>
            <th style={{ ...thBorder, width: 60 }}>배합(kg)</th>
            <th style={{ ...thBorder }}>규격</th>
            <th style={{ ...thBorder, width: 70 }}>생산길이<br/>(m)</th>
            <th style={{ ...thBorder, width: 60 }}>생산량</th>
            <th style={{ ...thBorder, width: 60 }}>더미<br/>(kg)</th>
            <th style={{ ...thBorder, width: 80 }}>비고</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} style={{ height: 22 }}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdBorder, fontFamily: 'Courier New, monospace', fontSize: 10 }}>
                {i === 0 ? parentLot : `______-S${String(i+1).padStart(2,'0')}`}
              </td>
              <td style={tdBorder}>{i === 0 ? (workOrder.input_weight_kg ?? '') : ''}</td>
              <td style={tdBorder}>{i === 0 ? (workOrder.item_name || '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 0 ? (workOrder.production_length_m ?? '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 0 ? (workOrder.actual_qty ?? '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 0 ? (log?.dummy_weight_kg ?? '') : ''}</td>
              <td style={tdBorder}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 하단 */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>□ 품질적 특이사항 및 조치사항</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[1,2,3,4].map(i => (
                      <tr key={i} style={{ height: 24 }}>
                        <td style={{ ...tdBorder, width: 30, textAlign: 'center' }}>{i}</td>
                        <td style={tdBorder}>{i === 1 ? (log?.remarks || '') : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>※ 로트부여 : 배합 로트번호 승계</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thBorder}>배합LOT</th>
                      <th style={thBorder}>압출LOT</th>
                      <th style={thBorder}>생산량</th>
                      <th style={thBorder}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2].map(i => (
                      <tr key={i} style={{ height: 24 }}>
                        <td style={tdBorder}>{i === 1 ? parentLot : ''}</td>
                        <td style={tdBorder}>{i === 1 ? (workOrder.lot_number || '') : ''}</td>
                        <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 1 ? (workOrder.actual_qty ?? '') : ''}</td>
                        <td style={tdBorder}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC-B-201-2</span>
        <span>(주) 이지원</span>
        <span>A4(210x297)mm</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CUT 차열재 재단생산일지 (EZC-B-201-12)
// ─────────────────────────────────────────────
function CutPrintForm({ workOrder, log }: { workOrder: WorkOrder; log: any }) {
  const tdBorder: React.CSSProperties = { border: '1px solid black', padding: '3px 5px', fontSize: 11 };
  const thBorder: React.CSSProperties = { ...tdBorder, background: '#f5f5f5', fontWeight: 700, textAlign: 'center' };

  const woDate = workOrder.wo_date || '';
  const [y, m, d] = woDate.split('-');

  // 제품 유형 판별
  const productType = workOrder.product_type || '';
  const isIpsang = productType.includes('입상') || (workOrder.width_mm ?? 300) >= 300;
  const isBekche = productType.includes('벽체') || (workOrder.width_mm ?? 0) === 200;
  const isTeumsae200 = productType.includes('틈새200');
  const isTeumsae150 = productType.includes('틈새150');

  const rows = 25;

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: 8, width: 110 }}>
              <EzoneLogoPrint />
            </td>
            <td style={{ border: '1px solid black', padding: '10px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>차열재 재단생산일지</span>
            </td>
            <td style={{ border: '1px solid black', padding: 6, verticalAlign: 'top', width: 240 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                <div>□ 입상 (폭:300)</div>
                <div>□ 벽체 (폭:200)</div>
                <div>□ 틈새 (폭:200)</div>
                <div>□ 틈새 (폭:150)</div>
              </div>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'top', width: 180 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ ...thBorder, writingMode: 'vertical-lr', padding: '4px 6px' }}>결<br/>재</td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>작 성</div>
                      <div style={{ padding: '2px 8px', height: 36 }}>{workOrder.am_worker || ''}</div>
                    </td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>검 토</div>
                      <div style={{ padding: '2px 8px', height: 36 }}></div>
                    </td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>승 인</div>
                      <div style={{ padding: '2px 8px', height: 36 }}></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 규격/작업자/생산일자 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ ...thBorder, width: 120 }}>■ 규격 : 두께 - {workOrder.thickness_mm ?? 25}T</td>
            <td style={{ ...tdBorder }}>작업자 : {workOrder.am_worker || ''}</td>
            <td style={{ ...tdBorder, textAlign: 'right' }}>
              생산일자 : &nbsp; {y || ''} 년 &nbsp; {m || ''} 월 &nbsp; {d || ''} 일
            </td>
          </tr>
        </tbody>
      </table>

      {/* 생산현황 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thBorder, width: 30 }}>순번</th>
            <th style={{ ...thBorder, width: 80 }}>구조</th>
            <th style={{ ...thBorder, width: 60 }}>규격(mm)<br/>가로</th>
            <th style={{ ...thBorder, width: 60 }}>규격(mm)<br/>세로</th>
            <th style={{ ...thBorder }}>인수검사 로트번호</th>
            <th style={{ ...thBorder, width: 60 }}>밀 도<br/>( K )</th>
            <th style={{ ...thBorder, width: 60 }}>생산수량</th>
            <th style={{ ...thBorder, width: 80 }}>비 고</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} style={{ height: 22 }}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={tdBorder}>{i === 0 ? (workOrder.structure_code || '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i === 0 ? (workOrder.width_mm ?? '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i === 0 ? (workOrder.thickness_mm ?? '') : ''}</td>
              <td style={{ ...tdBorder, fontFamily: 'Courier New, monospace', fontSize: 10 }}>{i === 0 ? (log?.parent_lot_number || '') : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i === 0 ? '' : ''}</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 0 ? (workOrder.actual_qty ?? '') : ''}</td>
              <td style={tdBorder}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC-B-201-12</span>
        <span>(주) 이지원</span>
        <span>A4(210x297)mm</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ASM 조립생산일지 (EZC B-201-3 방화소켓류)
// ─────────────────────────────────────────────
function AsmPrintForm({ workOrder, log }: { workOrder: WorkOrder; log: any }) {
  const tdBorder: React.CSSProperties = { border: '1px solid black', padding: '3px 5px', fontSize: 11 };
  const thBorder: React.CSSProperties = { ...tdBorder, background: '#f5f5f5', fontWeight: 700, textAlign: 'center' };

  const woDate = workOrder.wo_date || '';
  const [y, m, d] = woDate.split('-');

  const rows = 15;

  // 제품 유형
  const isBekche = (workOrder.product_type || '').includes('벽체');
  const isIpsang = (workOrder.product_type || '').includes('입상');

  return (
    <div style={{ width: '100%', fontFamily: 'Malgun Gothic, NanumGothic, sans-serif', fontSize: 11, color: '#000' }}>
      {/* 헤더 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: 8, width: 110 }}>
              <EzoneLogoPrint />
            </td>
            <td style={{ border: '1px solid black', padding: '10px 20px', textAlign: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>조립생산일지(방화소켓류)</span>
            </td>
            <td style={{ border: '1px solid black', padding: 6, verticalAlign: 'top', width: 120 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ border: '1px solid black', width: 12, height: 12, display: 'inline-block', background: isBekche ? '#000' : '#fff' }}></span>
                  <span> 벽체</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ border: '1px solid black', width: 12, height: 12, display: 'inline-block', background: isIpsang ? '#000' : '#fff' }}></span>
                  <span> 입상</span>
                </div>
              </div>
            </td>
            <td style={{ border: '1px solid black', padding: 0, verticalAlign: 'top', width: 180 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ ...thBorder, writingMode: 'vertical-lr', padding: '4px 6px' }}>결<br/>재</td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>작 성</div>
                      <div style={{ padding: '2px 8px', height: 36 }}>{workOrder.am_worker || ''}</div>
                    </td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>검 토</div>
                      <div style={{ padding: '2px 8px', height: 36 }}></div>
                    </td>
                    <td style={{ border: '1px solid black', padding: 0 }}>
                      <div style={{ borderBottom: '1px solid black', padding: '2px 8px', textAlign: 'center', fontSize: 10 }}>승 인</div>
                      <div style={{ padding: '2px 8px', height: 36 }}></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 생산일자 */}
      <div style={{ textAlign: 'right', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
        생산일자 : &nbsp; {y || ''} 년 &nbsp; {m || ''} 월 &nbsp; {d || ''} 일
      </div>

      {/* 생산현황 */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...thBorder, width: 30 }}>no.</th>
            <th rowSpan={2} style={{ ...thBorder, width: 80 }}>구조명</th>
            <th rowSpan={2} style={{ ...thBorder, width: 60 }}>규격</th>
            <th colSpan={6} style={{ ...thBorder }}>투입량</th>
            <th rowSpan={2} style={{ ...thBorder, width: 50 }}>생산<br/>수량</th>
            <th rowSpan={2} style={{ ...thBorder, width: 80 }}>방화소켓<br/>로트번호</th>
            <th rowSpan={2} style={{ ...thBorder, width: 40 }}>S/N</th>
            <th rowSpan={2} style={{ ...thBorder, width: 40 }}>Check</th>
          </tr>
          <tr>
            <th style={{ ...thBorder }}>소켓<br/>인수검사 로트번호</th>
            <th style={{ ...thBorder, width: 40 }}>Check</th>
            <th style={{ ...thBorder }}>차열시트<br/>로트번호</th>
            <th style={{ ...thBorder, width: 40 }}>Check</th>
            <th style={{ ...thBorder }}>차열재<br/>인수검사 로트번호</th>
            <th style={{ ...thBorder, width: 40 }}>Check</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} style={{ height: 24 }}>
              <td style={{ ...tdBorder, textAlign: 'center' }}>{i + 1}</td>
              <td style={tdBorder}>{i === 0 ? (workOrder.structure_name || workOrder.structure_code || '') : ''}</td>
              <td style={tdBorder}>{i === 0 ? (workOrder.item_name || '') : ''}</td>
              <td style={tdBorder}></td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>□</td>
              <td style={tdBorder}></td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>□</td>
              <td style={tdBorder}></td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>□</td>
              <td style={{ ...tdBorder, textAlign: 'right' }}>{i === 0 ? (workOrder.actual_qty ?? '') : ''}</td>
              <td style={{ ...tdBorder, fontFamily: 'Courier New, monospace', fontSize: 10 }}>{i === 0 ? (workOrder.lot_number || '') : ''}</td>
              <td style={tdBorder}></td>
              <td style={{ ...tdBorder, textAlign: 'center' }}>□</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 하단 */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>□ 품질적 특이사항 및 조치사항</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '48%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[1,2,3].map(i => (
                      <tr key={i} style={{ height: 24 }}>
                        <td style={{ ...tdBorder, width: 30 }}>{i}</td>
                        <td style={tdBorder}>{i === 1 ? (log?.remarks || '') : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
              <td style={{ width: '52%', verticalAlign: 'top', paddingLeft: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>※ 구조별 로트 부여 약호</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <tbody>
                    <tr>
                      <td style={tdBorder}>소켓류 약호 – D</td>
                      <td style={tdBorder}>카플링구조 약호 – C</td>
                      <td style={tdBorder}>버스덕트류 약호 – BD</td>
                      <td style={tdBorder}>틈새시트약호 – TS</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={tdBorder}>플래싱(I형, Z형, L형) – F</td>
                      <td style={tdBorder}>일체형슬리브 – FN</td>
                      <td style={tdBorder}>섹스티어류 – SE</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={tdBorder}>
                        예) J 24 0601 D 01 조립약호+생산년월일+구조약호+작업지시번호를 이용한 조립로트
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
        <span>EZC B-201-3</span>
        <span>(주)이지원</span>
        <span>A4(210×297)</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 인쇄 모달
// ─────────────────────────────────────────────
interface PrintModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
}

function PrintModal({ workOrder, onClose }: PrintModalProps) {
  const [log, setLog] = useState<any>(null);
  const [mixLots, setMixLots] = useState<MixLot[]>([]);
  const [selectedMixLot, setSelectedMixLot] = useState('');
  const [savingLot, setSavingLot] = useState(false);
  const [loading, setLoading] = useState(true);

  const needsMixLot = workOrder.process_code === 'EXT' || workOrder.process_code === 'CUT';

  useEffect(() => {
    setLoading(true);
    api.get<{ data: any[] }>(`/process-logs?wo_id=${workOrder.wo_id}`).then((res) => {
      const sorted = (res.data || []).sort((a: any, b: any) => b.log_id - a.log_id);
      setLog(sorted[0] || null);
      if (sorted[0]?.parent_lot_number) setSelectedMixLot(sorted[0].parent_lot_number);
      setLoading(false);
    });
    if (needsMixLot) {
      api.get<{ data: MixLot[] }>('/lots/mix-completed').then((res) => setMixLots(res.data || []));
    }
  }, [workOrder.wo_id, needsMixLot]);

  const handlePrint = () => { window.print(); };

  const handleSaveMixLot = async () => {
    if (!selectedMixLot || !log) return;
    setSavingLot(true);
    try {
      await api.patch(`/process-logs/${log.log_id}`, { parent_lot_number: selectedMixLot });
      setLog((prev: any) => ({ ...prev, parent_lot_number: selectedMixLot }));
      alert('배합 LOT가 연결되었습니다.');
    } catch { alert('저장 실패'); } finally { setSavingLot(false); }
  };

  const renderForm = () => {
    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>일지 데이터 로딩 중...</div>;
    if (workOrder.process_code === 'MIX') return <MixPrintForm workOrder={workOrder} log={log} />;
    if (workOrder.process_code === 'EXT') return <ExtPrintForm workOrder={workOrder} log={log} />;
    if (workOrder.process_code === 'CUT') return <CutPrintForm workOrder={workOrder} log={log} />;
    if (workOrder.process_code === 'ASM') return <AsmPrintForm workOrder={workOrder} log={log} />;
    return <div style={{ padding: 20, color: '#888' }}>해당 공정 양식이 없습니다.</div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col print:shadow-none print:w-full print:max-w-none print:rounded-none">

        {/* 화면 전용 컨트롤바 */}
        <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center rounded-t-xl print:hidden">
          <span className="font-bold text-gray-800 text-sm">
            공정일지 인쇄 미리보기 — {workOrder.process_code} ({workOrder.wo_number})
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Printer size={14} /> 인쇄 (A4)
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border bg-white rounded text-xs hover:bg-gray-100">닫기</button>
          </div>
        </div>

        {/* 배합 LOT 연동 패널 (EXT/CUT) */}
        {needsMixLot && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3 print:hidden">
            <Link2 size={16} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-800 shrink-0">투입 배합 LOT 연결</span>
            <select
              value={selectedMixLot}
              onChange={(e) => setSelectedMixLot(e.target.value)}
              className="flex-1 border border-amber-300 rounded px-2 py-1 text-xs bg-white max-w-xs"
            >
              <option value="">배합 LOT를 선택하세요</option>
              {mixLots.map((m) => (
                <option key={m.wo_id} value={m.lot_number}>
                  {m.lot_number} | {m.wo_date} | {m.item_name || '-'}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveMixLot}
              disabled={!selectedMixLot || savingLot}
              className="px-3 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 shrink-0"
            >
              {savingLot ? '저장중...' : '연결 저장'}
            </button>
          </div>
        )}

        {/* 인쇄 영역 */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 print:bg-white print:p-0 print:overflow-visible">
          {/* A4 용지 시뮬레이션 */}
          <div
            className="bg-white shadow-sm mx-auto print:shadow-none print:w-full print:p-0"
            style={{ width: 793, minHeight: 1122, padding: '28px 32px', boxSizing: 'border-box' }}
          >
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export function DailyLogPage() {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('process_code', filter);
    if (date) params.set('date', date);
    const qs = params.toString();
    api.get<{ data: WorkOrder[] }>(`/work-orders${qs ? '?' + qs : ''}`).then((res) => setData(res.data));
  }, [filter, date]);

  return (
    <div>
      <PageHeader title="공정일지" count={data.length} description="일자별 생산실적 통합 조회">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        />
      </PageHeader>

      {/* 공정 탭 */}
      <div className="flex gap-1 mb-4 border-b">
        {processTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 작업지시 목록 */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-semibold text-gray-600">작업지시번호</th>
              <th className="text-left p-3 font-semibold text-gray-600">공정</th>
              <th className="text-left p-3 font-semibold text-gray-600">품목</th>
              <th className="text-left p-3 font-semibold text-gray-600">LOT번호</th>
              <th className="text-right p-3 font-semibold text-gray-600">계획</th>
              <th className="text-right p-3 font-semibold text-gray-600">실적</th>
              <th className="text-left p-3 font-semibold text-gray-600">상태</th>
              <th className="text-center p-3 font-semibold text-gray-600">인쇄</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-10">해당 날짜의 작업지시가 없습니다.</td>
              </tr>
            )}
            {data.map((wo) => (
              <tr key={wo.wo_id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3 font-mono text-xs">{wo.wo_number}</td>
                <td className="p-3"><ProcessBadge process={wo.process_code} /></td>
                <td className="p-3 text-xs text-gray-700">{wo.item_name || '-'}</td>
                <td className="p-3 font-mono text-xs text-gray-500">{wo.lot_number || '-'}</td>
                <td className="p-3 text-right text-xs">{wo.planned_qty ?? '-'}</td>
                <td className="p-3 text-right text-xs font-semibold">{wo.actual_qty ?? '-'}</td>
                <td className="p-3"><StatusBadge status={wo.status} /></td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => setSelectedWo(wo)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs font-semibold hover:bg-blue-100 transition-colors"
                  >
                    <Printer size={13} /> 일지출력
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 인쇄 모달 */}
      {selectedWo && (
        <PrintModal workOrder={selectedWo} onClose={() => setSelectedWo(null)} />
      )}

      {/* 전역 인쇄 스타일 */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .fixed.inset-0 { visibility: visible !important; position: static !important; background: white !important; }
          .fixed.inset-0 * { visibility: visible !important; }
          .print\\:hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
}
