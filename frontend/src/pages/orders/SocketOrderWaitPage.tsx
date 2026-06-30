import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Package, CheckCircle2, Clock, Download, Truck,
  RefreshCw, ChevronDown, ChevronRight, FileText,
  ArrowRight, ClipboardCheck, AlertCircle, Mail,
  X, Save, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

// ─── 타입 ──────────────────────────────────────────────────────────────────
interface SocketItem {
  seq: number;
  product_type: string;
  structure: string;
  pipe_width_mm: number;
  pipe_height_mm: number;
  qty: number;
  construction_type?: 'SINGLE' | 'DOUBLE';
  remark?: string;
  sheet_name?: string;
}

interface SocketOrder {
  so_id: number;
  po_id: number | null;
  project_name: string;
  status: 'APPROVED' | 'ORDERED' | 'INSPECTING' | 'RECEIVED';
  items_json: SocketItem[];
  writer_name: string | null;
  biz_name: string | null;
  order_date: string | null;
  vendor_email: string | null;
  ordered_at: string | null;
  order_note: string | null;
  received_at: string | null;
  approved_at: string | null;
  approver_name: string | null;
  approval_id: number | null;
  approval_status: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

// ─── 상태 설정 ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  APPROVED: {
    label: '발주대기',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-400',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  ORDERED: {
    label: '발주완료',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    icon: <Package className="h-3.5 w-3.5" />,
  },
  INSPECTING: {
    label: '인수검사중',
    color: 'text-violet-700 bg-violet-50 border-violet-200',
    dot: 'bg-violet-500',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  RECEIVED: {
    label: '입고완료',
    color: 'text-green-700 bg-green-50 border-green-200',
    dot: 'bg-green-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

// ─── 발주서 행 ─────────────────────────────────────────────────────────────
function OrderCard({ order, onRefresh, vendors = [] }: { order: SocketOrder; onRefresh: () => void; vendors: any[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [emailEdit, setEmailEdit] = useState(false);
  const [emailVal, setEmailVal] = useState(order.vendor_email || '');
  const [noteVal, setNoteVal] = useState(order.order_note || '');
  const [vendorId, setVendorId] = useState<number | string>(order.vendor_company_id || '');
  const [loading, setLoading] = useState(false);

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.APPROVED;
  const items: SocketItem[] = order.items_json ?? [];

  // ── Excel 다운로드
  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('ezone_mes_token') || '';
      const apiBase = (import.meta as any).env?.VITE_API_BASE ?? '/api';
      const resp = await fetch(
        `${apiBase}/socket-orders/${order.so_id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j.error || '다운로드 실패');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = resp.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      a.href = url;
      a.download = nameMatch
        ? decodeURIComponent(nameMatch[1].trim())
        : `${order.biz_name || '소켓발주서'}_${order.order_date ? new Date(order.order_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다');
    }
  };

  // ── 인쇄 및 PDF 저장
  const handlePrint = async () => {
    try {
      // 1. 우리 회사 이지원 정보 조회
      const res = await api.get<{ data: any[] }>('/companies?search=이지원');
      const ourCompany = res.data?.data?.[0] || {
        company_name: '㈜ 이지원',
        corporate_no: '232-88-00624',
        ceo_name: '박민선',
        address: '경기도 화성시 장안면 장안로227번길 166-18',
        phone: '070-8870-0300',
        fax: '02-6455-0300',
        email: 'cyj48612@gmail.com',
        business_type: '제조업, 도소매',
        business_item: '방화재관련건설자재'
      };

      // 2. 평철 브라켓 계산 공식 (백엔드와 완전 동일)
      const bracketMap = new Map<string, { t: number; bw: number; l: number; qty: number }>();
      const calcBrackets = (code: string, w: number, h: number, q: number) => {
        const sw = Math.round(w / 2 - 30);
        const rows: any[] = [];
        const add = (t: number, bw: number, l: number, qty: number) => {
          if (qty > 0 && l > 0) rows.push({ t, bw, l: Math.round(l), qty });
        };
        const c = code.trim();
        switch (c) {
          case 'VT-049': case 'VT-064': case 'VA-064':
            add(1.6, 60,  w - 1,  q * 4);
            add(1.6, 60,  h - 30, q * 4);
            break;
          case 'VT-01':
            add(1.6, 60,  Math.round(w / 2 - 16), q * 16);
            add(1.6, 60,  Math.round(h / 2 - 20), q * 32);
            add(1.6, 225, Math.round(w / 2 - 16), q * 8);
            add(1.6, 237, h - 1,                  q * 4);
            break;
          case 'VAG-1.69':
            add(1.6, 60,  sw - 1,  q * 4);
            add(1.6, 60,  h - 30,  q * 4);
            break;
          case 'HTG-064': case 'HTG-064DC':
            add(1.6, 60,  w - 5,  q * 2);
            add(1.6, 274, w - 5,  q * 2);
            add(1.6, 60,  h - 35, q * 4);
            add(1.6, 50,  h,      q * 3);
            break;
          case 'HTG-1.69':
            add(1.6, 60,  sw - 5,  q * 4);
            add(1.6, 274, sw - 5,  q * 4);
            add(1.6, 60,  h - 35,  q * 4);
            add(1.6, 50,  h,       q * 6);
            break;
        }
        return rows;
      };

      const STRUCT_DEPTH: Record<string, number> = {
        'VT-01': 200, 'VT-049': 200, 'VT-064': 200, 'VA-064': 200,
        'VAG-1.69': 200, 'HTG-064': 300, 'HTG-064DC': 300, 'HTG-1.69': 300,
      };
      const STRUCT_MULT: Record<string, number> = {
        'VT-01': 2, 'VAG-1.69': 2, 'HTG-1.69': 2,
      };
      const STRUCT_WIDTH_CALC: Record<string, (w: number) => number> = {
        'VAG-1.69': w => Math.round(w / 2 - 30),
        'HTG-1.69': w => Math.round(w / 2 - 30),
      };

      // 3. 소계 및 총합계 집계
      let vt01Sum = 0, vt049Sum = 0, vt064Sum = 0, va064Sum = 0, grandTotal = 0;
      items.forEach(item => {
        const code = (item.product_type || '').trim();
        const w = item.pipe_width_mm || 0;
        const h = item.pipe_height_mm || 0;
        const q = item.qty || 1;
        const mult = STRUCT_MULT[code] || 1;
        const finalQty = q * mult;
        grandTotal += finalQty;

        if (code === 'VT-01') vt01Sum += finalQty;
        else if (code === 'VT-049') vt049Sum += finalQty;
        else if (code === 'VT-064') vt064Sum += finalQty;
        else if (code === 'VA-064') va064Sum += finalQty;

        if (w && h && code) {
          const bRows = calcBrackets(code, w, h, q);
          bRows.forEach(b => {
            const key = `${b.t}_${b.bw}_${b.l}`;
            const existing = bracketMap.get(key);
            if (existing) existing.qty += b.qty;
            else bracketMap.set(key, { t: b.t, bw: b.bw, l: b.l, qty: b.qty });
          });
        }
      });

      const bracketRows = [...bracketMap.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
      const leftBracketTotal = bracketRows.slice(0, 30).reduce((s, r) => s + r.qty, 0);
      const rightBracketTotal = bracketRows.slice(30).reduce((s, r) => s + r.qty, 0);

      // 오늘 날짜 기입
      const dToday = new Date();
      const dateVal = `${dToday.getFullYear()}. ${dToday.getMonth() + 1}. ${dToday.getDate()}`;

      // 4. 인쇄 팝업 창 생성
      const wnd = window.open('', '_blank');
      if (!wnd) {
        toast.error('팝업 차단이 활성화되어 있어 출력 페이지를 열 수 없습니다.');
        return;
      }

      let html = `
      <html>
      <head>
        <title>소켓발주서_${order.project_name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm; /* 최적화된 마진 */
          }
          body {
            font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
            margin: 0;
            padding: 0;
            font-size: 9.5px;
            color: #111;
            line-height: 1.15;
          }
          .title {
            text-align: center;
            font-size: 21px;
            font-weight: 800;
            text-decoration: none;
            border-bottom: 2px double #000; /* 품격 있는 이중 밑줄 */
            width: 250px;
            margin: 0 auto 10px auto;
            padding-bottom: 3px;
            letter-spacing: 12px;
            text-indent: 12px;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
          }
          .info-table td {
            vertical-align: middle;
            padding: 0;
          }
          .buyer-table {
            width: 95%;
            border-collapse: collapse;
          }
          .buyer-table td {
            height: 16px;
            padding: 1px 0;
            font-size: 10px;
            border-bottom: 1.2px solid #e2e8f0;
          }
          .buyer-table .lbl {
            font-weight: bold;
            color: #475569;
            width: 55px;
          }
          .supplier-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #0f172a;
          }
          .supplier-table th, .supplier-table td {
            border: 1px solid #475569;
            text-align: center;
            height: 16px;
            font-size: 9px;
            padding: 1px 2px;
          }
          .supplier-table .hdr {
            background-color: #f8fafc;
            font-weight: bold;
            color: #334155;
            width: 65px;
          }
          .supplier-table .hdr-side {
            background-color: #f8fafc;
            font-weight: bold;
            color: #1e293b;
            width: 22px;
            font-size: 9.5px;
            letter-spacing: 2px;
          }
          
          /* 소켓 리스트 */
          .list-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3px;
            border: 1.5px solid #0f172a;
          }
          .list-table th, .list-table td {
            border: 1px solid #475569;
            text-align: center;
            font-size: 9px;
            padding: 1.5px 1px;
            height: 13.5px;
          }
          .list-table th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #1e293b;
          }
          
          /* 평철 브라켓 */
          .section-title {
            font-weight: bold;
            font-size: 9.5px;
            margin-top: 5px;
            margin-bottom: 2px;
            color: #0f172a;
            border-left: 3px solid #2563eb;
            padding-left: 5px;
          }
          .bracket-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #0f172a;
          }
          .bracket-table th, .bracket-table td {
            border: 1px solid #475569;
            text-align: center;
            font-size: 8.5px;
            padding: 1.2px 1px;
            height: 12.5px;
          }
          .bracket-table th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #1e293b;
          }
          
          /* 푸터 */
          .footer-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            border: 1.5px solid #0f172a;
          }
          .footer-table td {
            border: 1px solid #475569;
            padding: 3px 6px;
            font-size: 9.5px;
          }
          .footer-table .lbl {
            background-color: #f1f5f9;
            font-weight: bold;
            text-align: center;
            width: 80px;
            color: #1e293b;
          }

          .no-print-bar {
            background-color: #f1f5f9;
            padding: 6px 12px;
            text-align: right;
            border-bottom: 1px solid #cbd5e1;
          }
          .btn-blue {
            background-color: #2563eb;
            color: #fff;
            padding: 4px 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 11px;
            margin-left: 5px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }
          .btn-gray {
            background-color: #475569;
            color: #fff;
            padding: 4px 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 11px;
            margin-left: 5px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          @media print {
            .no-print-bar {
              display: none;
            }
            body {
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <span style="font-size:10.5px; color:#475569; margin-right:15px;">PDF 저장은 인쇄창의 대상을 <b>[PDF로 저장]</b>으로 선택하세요.</span>
          <button class="btn-blue" onclick="window.print()">인쇄 / PDF 저장</button>
          <button class="btn-gray" onclick="window.close()">창 닫기</button>
        </div>
        <div style="padding: 5px;">
          <div class="title">발  주  서</div>
          
          <table class="info-table">
            <tr>
              <td style="width: 48%;">
                <table class="buyer-table">
                  <tr>
                    <td class="lbl">수 신 :</td>
                    <td style="font-weight: bold; color: #1e293b;">${order.vendor_name || order.biz_name || '선우산업'}</td>
                  </tr>
                  <tr>
                    <td class="lbl">수 신 자 :</td>
                    <td>구매담당자 귀하</td>
                  </tr>
                  <tr>
                    <td class="lbl">발주일자 :</td>
                    <td>${dateVal}</td>
                  </tr>
                  <tr>
                    <td class="lbl">현 장 명 :</td>
                    <td style="font-weight: bold; color: #0f172a;">${order.project_name}</td>
                  </tr>
                </table>
              </td>
              <td style="width: 52%;">
                <table class="supplier-table">
                  <tr>
                    <td rowspan="6" class="hdr-side">공<br/>급<br/>자</td>
                    <td class="hdr">등록번호</td>
                    <td colspan="3" style="font-weight:bold; font-size:9.5px; letter-spacing: 0.5px;">${ourCompany.corporate_no || '232-88-00624'}</td>
                  </tr>
                  <tr>
                    <td class="hdr">상 호</td>
                    <td style="font-weight:bold; color: #0f172a;">${ourCompany.company_name || '㈜ 이지원'}</td>
                    <td class="hdr">대 표 자</td>
                    <td style="font-weight:bold;">${ourCompany.ceo_name || '박민선'}</td>
                  </tr>
                  <tr>
                    <td class="hdr">주 소</td>
                    <td colspan="3" style="text-align:left; font-size:8px; color: #334155;">${ourCompany.address || '경기도 화성시 장안면 장안로227번길 166-18'}</td>
                  </tr>
                  <tr>
                    <td class="hdr">업 태</td>
                    <td>${ourCompany.business_type || '제조업, 도소매'}</td>
                    <td class="hdr">종 목</td>
                    <td style="font-size:8px;">${ourCompany.business_item || '방화재관련건설자재'}</td>
                  </tr>
                  <tr>
                    <td class="hdr">전화번호</td>
                    <td>${ourCompany.phone || '070-8870-0300'}</td>
                    <td class="hdr">팩스번호</td>
                    <td>${ourCompany.fax || '02-6455-0300'}</td>
                  </tr>
                  <tr>
                    <td class="hdr">이 메 일</td>
                    <td colspan="3" style="font-size:8.5px; font-family: monospace;">${ourCompany.email || 'cyj48612@gmail.com'}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table class="list-table">
            <thead>
              <tr>
                <th style="width:25px;">순번</th>
                <th style="width:35px;">재질</th>
                <th style="width:45px;">품명</th>
                <th style="width:85px;">위치</th>
                <th style="width:65px;">구조명</th>
                <th style="width:45px;">가로(mm)</th>
                <th style="width:45px;">세로(mm)</th>
                <th style="width:35px;">폭(mm)</th>
                <th style="width:45px;">발주(EA)</th>
                <th>비고(현장명)</th>
              </tr>
            </thead>
            <tbody>
      `;

      // 27행 컴팩트 렌더링
      for (let i = 0; i < 27; i++) {
        const item = items[i];
        if (item) {
          const code = (item.product_type || '').trim();
          const w = item.pipe_width_mm || 0;
          const h = item.pipe_height_mm || 0;
          const mult = STRUCT_MULT[code] || 1;
          const depth = STRUCT_DEPTH[code] || 200;
          const swCalc = STRUCT_WIDTH_CALC[code];
          const sw = swCalc ? swCalc(w) : w;

          html += `
            <tr>
              <td style="color:#64748b; font-family:monospace;">${i + 1}</td>
              <td>${item.material || 'GI'}</td>
              <td>일반형</td>
              <td style="text-align:left; padding-left:3px;">${item.structure || ''}</td>
              <td style="font-weight:bold; color:#1e3a8a;">${code}</td>
              <td style="font-family:monospace; text-align:right; padding-right:3px;">${sw}</td>
              <td style="font-family:monospace; text-align:right; padding-right:3px;">${h}</td>
              <td style="font-family:monospace; text-align:right; padding-right:3px;">${depth}</td>
              <td style="font-weight:bold; color:#1e293b; font-family:monospace;">${item.qty * mult}</td>
              <td style="text-align:left; font-size:8px; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#475569;">${order.project_name}</td>
            </tr>
          `;
        } else {
          html += `
            <tr>
              <td style="color:#cbd5e1; font-family:monospace;">${i + 1}</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          `;
        }
      }

      // 소계 및 합계
      html += `
              <tr style="font-weight:bold; background-color:#f8fafc;">
                <td colspan="5" style="text-align:left; padding-left:5px; color:#334155;">소계 (VT-01 / VT-049 / VT-064 / VA-064)</td>
                <td colspan="4" style="text-align:left; font-size:8.5px; padding-left:3px; color:#475569;">
                  VT-01: ${vt01Sum} / VT-049: ${vt049Sum} / VT-064: ${vt064Sum} / VA-064: ${va064Sum}
                </td>
                <td style="background-color:#f1f5f9; text-align:right; padding-right:5px; color:#1e3a8a; font-size:10px;">총합계: ${grandTotal} EA</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">◎ 평철 사이즈 (일반형) 명세</div>
          <table class="bracket-table">
            <thead>
              <tr>
                <th style="width:35px;">재질</th>
                <th style="width:35px;">두께(T)</th>
                <th style="width:45px;">폭(mm)</th>
                <th style="width:55px;">길이(mm)</th>
                <th style="width:45px;">수량(개)</th>
                <th style="width:35px;">재질</th>
                <th style="width:35px;">두께(T)</th>
                <th style="width:45px;">폭(mm)</th>
                <th style="width:55px;">길이(mm)</th>
                <th style="width:45px;">수량(개)</th>
              </tr>
            </thead>
            <tbody>
      `;

      // 30행
      for (let i = 0; i < 30; i++) {
        const L = bracketRows[i];
        const R = bracketRows[i + 30];
        html += `
          <tr>
            <td>${L ? 'GI' : '&nbsp;'}</td>
            <td style="font-family:monospace;">${L ? L.t : '&nbsp;'}</td>
            <td style="font-family:monospace;">${L ? L.bw : '&nbsp;'}</td>
            <td style="font-family:monospace; text-align:right; padding-right:3px;">${L ? L.l : '&nbsp;'}</td>
            <td style="font-weight:bold; font-family:monospace;">${L ? L.qty : '&nbsp;'}</td>
            
            <td>${R ? 'GI' : '&nbsp;'}</td>
            <td style="font-family:monospace;">${R ? R.t : '&nbsp;'}</td>
            <td style="font-family:monospace;">${R ? R.bw : '&nbsp;'}</td>
            <td style="font-family:monospace; text-align:right; padding-right:3px;">${R ? R.l : '&nbsp;'}</td>
            <td style="font-weight:bold; font-family:monospace;">${R ? R.qty : '&nbsp;'}</td>
          </tr>
        `;
      }

      // 평철 소계
      html += `
              <tr style="font-weight:bold; background-color:#f8fafc;">
                <td colspan="4" style="color:#475569;">좌측 평철 합계</td>
                <td style="font-family:monospace; color:#1e293b;">${leftBracketTotal} 개</td>
                <td colspan="4" style="color:#475569;">우측 평철 합계</td>
                <td style="font-family:monospace; color:#1e293b;">${rightBracketTotal} 개</td>
              </tr>
            </tbody>
          </table>

          <table class="footer-table">
            <tr>
              <td class="lbl">납품 장소</td>
              <td style="font-weight:semibold;">${order.project_name} 현장</td>
              <td class="lbl">납품 기한</td>
              <td style="font-weight:semibold;">${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('ko-KR') : '협의'}</td>
            </tr>
          </table>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
      `;

      wnd.document.write(html);
      wnd.document.close();
    } catch {
      toast.error('인쇄 준비 중 오류가 발생했습니다');
    }
  };

  // ── 이메일/메모 저장
  const handleSaveEmail = async () => {
    setLoading(true);
    try {
      await api.patch(`/socket-orders/${order.so_id}/vendor-email`, {
        vendor_email: emailVal || null,
        order_note: noteVal || null,
        vendor_company_id: vendorId ? Number(vendorId) : null,
      });
      toast.success('저장했습니다');
      setEmailEdit(false);
      onRefresh();
    } catch {
      toast.error('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  // ── 발주완료 처리
  const handleMarkOrdered = async () => {
    if (!confirm(`"${order.project_name}" 발주서를 발주완료 처리합니까?`)) return;
    setLoading(true);
    try {
      await api.patch(`/socket-orders/${order.so_id}/mark-ordered`, {
        worker_id: user?.worker_id,
        order_note: noteVal || null,
      });
      toast.success('발주완료 처리했습니다');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    } finally {
      setLoading(false);
    }
  };

  // ── 입고확인 처리 (상태를 RECEIVED로 전환)
  const handleConfirmReceive = async () => {
    if (!confirm(`"${order.project_name}" 입고확인 처리를 합니까?\n발주서가 '입고완료(RECEIVED)' 상태로 전환됩니다.`)) return;
    setLoading(true);
    try {
      await api.patch(`/socket-orders/${order.so_id}/status`, {
        status: 'RECEIVED',
      });
      toast.success('입고완료 처리되었습니다.');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || '처리 실패');
    } finally {
      setLoading(false);
    }
  };

  // ── 인수검사 시작 (C302 5.1 기준)
  const handleStartInspection = async () => {
    if (!confirm(`"${order.project_name}" 인수검사를 시작합니까?\n소켓을 1개씩 분리하여 인수검사 목록을 생성합니다.`)) return;
    setLoading(true);
    try {
      await api.post(`/socket-orders/${order.so_id}/start-inspection`, {
        worker_id: user?.worker_id,
      });
      toast.success('인수검사 목록을 생성했습니다. 인수검사 페이지로 이동합니다.');
      navigate(`/quality/socket-incoming/${order.so_id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '처리 실패';
      // 이미 생성된 경우 → 바로 이동
      if (msg.includes('이미')) {
        navigate(`/quality/socket-incoming/${order.so_id}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 인수검사 중 → 검사 페이지로 이동
  const handleGoToInspection = () => {
    navigate(`/quality/socket-incoming/${order.so_id}`);
  };

  // 소켓 규격 집계 (중복 합산)
  const socketSummary = items.reduce((acc, item) => {
    const key = `${item.product_type}||${item.pipe_width_mm}×${item.pipe_height_mm}`;
    if (acc[key]) {
      acc[key].qty += item.qty;
    } else {
      acc[key] = {
        product_type: item.product_type,
        w: item.pipe_width_mm,
        h: item.pipe_height_mm,
        qty: item.qty,
        sheet: item.sheet_name || '',
      };
    }
    return acc;
  }, {} as Record<string, { product_type: string; w: number; h: number; qty: number; sheet: string }>);

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
      order.status === 'RECEIVED' ? 'border-green-200' :
      order.status === 'ORDERED'  ? 'border-blue-200' :
      'border-amber-200'
    )}>
      {/* ── 헤더 ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 상태 배지 */}
          <div className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
            cfg.color
          )}>
            {cfg.icon}
            {cfg.label}
          </div>

          {/* 주요 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm truncate">{order.project_name}</h3>
              {order.biz_name && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {order.biz_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500 flex-wrap">
              {order.writer_name && <span>작성: {order.writer_name}</span>}
              {order.approver_name && <span>승인: {order.approver_name}</span>}
              {order.approved_at && (
                <span>승인일: {new Date(order.approved_at).toLocaleDateString('ko-KR')}</span>
              )}
              {order.ordered_at && (
                <span className="text-blue-600 font-semibold">
                  발주일: {new Date(order.ordered_at).toLocaleDateString('ko-KR')}
                </span>
              )}
              {order.received_at && (
                <span className="text-green-600 font-semibold">
                  입고일: {new Date(order.received_at).toLocaleDateString('ko-KR')}
                </span>
              )}
              <span className="text-gray-400">
                소켓 {order.item_count || items.length}종
              </span>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Excel 다운로드 */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
              title="Excel 다운로드"
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </button>

            {/* 인쇄 및 PDF 저장 */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
              title="인쇄 및 PDF 저장"
            >
              <FileText className="h-3.5 w-3.5" />
              인쇄/PDF
            </button>

            {/* 발주완료 버튼 (APPROVED 상태) */}
            {order.status === 'APPROVED' && (
              <button
                onClick={handleMarkOrdered}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="발주완료 처리"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                발주완료
              </button>
            )}

            {/* 입고확인 버튼 (ORDERED 상태) → 입고완료 처리 */}
            {order.status === 'ORDERED' && (
              <button
                onClick={handleConfirmReceive}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="자재 입고확인"
              >
                <Truck className="h-3.5 w-3.5" />
                입고확인
              </button>
            )}

            {/* 인수검사 시작 버튼 (RECEIVED 상태) → 인수검사 목록 생성 및 페이지 이동 */}
            {order.status === 'RECEIVED' && (
              <button
                onClick={handleStartInspection}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="인수검사 시작"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                인수검사 시작
              </button>
            )}

            {/* 인수검사 계속 (INSPECTING 상태) */}
            {order.status === 'INSPECTING' && (
              <button
                onClick={handleGoToInspection}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                인수검사 계속
              </button>
            )}

            {/* 검사 완료 후 결과 보기 (INSPECTED 상태) */}
            {order.status === 'INSPECTED' && (
              <button
                onClick={handleGoToInspection}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 text-xs font-semibold rounded-lg transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                검사결과 보기
              </button>
            )}


            {/* 상세 토글 */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 수신처 및 이메일 / 메모 */}
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {/* 1. 수신처 (생산업체) */}
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-16 flex-shrink-0">수신처</span>
            {emailEdit ? (
              <select
                value={vendorId}
                onChange={(e) => {
                  const val = e.target.value;
                  setVendorId(val);
                  if (val) {
                    const sel = vendors.find(v => v.company_id === Number(val));
                    if (sel && sel.email) {
                      setEmailVal(sel.email);
                    }
                  }
                }}
                className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="">--- 선택 ---</option>
                {vendors.map(v => (
                  <option key={v.company_id} value={v.company_id}>
                    {v.company_name}
                  </option>
                ))}
              </select>
            ) : (
              <span className={cn('text-xs font-semibold', order.vendor_name ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200' : 'text-gray-400 italic')}>
                {order.vendor_name || '미선택 (Excel 출력 시 선우산업으로 표기)'}
              </span>
            )}
          </div>

          {/* 2. 업체 이메일 */}
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-16 flex-shrink-0">업체 이메일</span>
            {emailEdit ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="email"
                  value={emailVal}
                  onChange={e => setEmailVal(e.target.value)}
                  placeholder="업체 이메일 입력"
                  className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={handleSaveEmail}
                  disabled={loading}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                  title="저장"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { 
                    setEmailEdit(false); 
                    setEmailVal(order.vendor_email || ''); 
                    setVendorId(order.vendor_company_id || '');
                  }}
                  className="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100"
                  title="취소"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <span className={cn('text-xs flex-1', order.vendor_email ? 'text-gray-800 font-medium' : 'text-gray-400 italic')}>
                  {order.vendor_email || '미입력'}
                </span>
                <button
                  onClick={() => setEmailEdit(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  편집
                </button>
              </div>
            )}
          </div>

          {/* 3. 메모 */}
          {order.order_note && !emailEdit && (
            <div className="flex items-start gap-2 mt-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">발주 메모</span>
              <span className="text-xs text-gray-700">{order.order_note}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 소켓 상세 목록 ── */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">소켓 발주 명세</span>
            <button
              onClick={() => setShowDetail(d => !d)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              {showDetail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showDetail ? '집계' : '전체'}
            </button>
          </div>
          <div className="overflow-x-auto">
            {showDetail ? (
              /* 전체 상세 */
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['No', '구조체', '현장/시트', '가로(mm)', '세로(mm)', '시공', '수량'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{item.product_type}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">{item.sheet_name || item.structure || '-'}</td>
                      <td className="px-3 py-2 font-mono text-right">{item.pipe_width_mm}</td>
                      <td className="px-3 py-2 font-mono text-right">{item.pipe_height_mm}</td>
                      <td className="px-3 py-2">
                        {item.construction_type === 'SINGLE' ? (
                          <span className="text-orange-600 font-bold">단면</span>
                        ) : (
                          <span className="text-blue-600">양면</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700">{item.qty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* 집계 뷰 */
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['구조체', '규격 (가로×세로)', '합계수량'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.values(socketSummary).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-800">{row.product_type}</td>
                      <td className="px-3 py-2 font-mono">{row.w} × {row.h}</td>
                      <td className="px-3 py-2 font-bold text-blue-700 text-center">{row.qty}ea</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────
export function SocketOrderWaitPage() {
  const [list, setList] = useState<SocketOrder[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'ALL' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'INSPECTING' | 'INSPECTED'>('ALL');

  const fetchVendors = useCallback(async () => {
    try {
      const res = await api.get<{ data: any[] }>('/companies?type=VENDOR&active=true');
      setVendors(res.data?.data || []);
    } catch (e) {
      console.error('생산업체 목록 조회 실패', e);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'ALL') params.append('status', tab);
      const res = await api.get<{ data: SocketOrder[] }>(
        `/socket-orders/wait${params.toString() ? `?${params}` : ''}`
      );
      setList(res.data ?? []);
    } catch {
      toast.error('목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { 
    fetchList(); 
    fetchVendors();
  }, [fetchList, fetchVendors]);

  const approvedCount = list.filter(o => o.status === 'APPROVED').length;
  const orderedCount  = list.filter(o => o.status === 'ORDERED').length;
  const receivedCount = list.filter(o => o.status === 'RECEIVED').length;
  const inspectingCount = list.filter(o => o.status === 'INSPECTING').length;
  const inspectedCount  = list.filter(o => o.status === 'INSPECTED').length;

  const TABS: Array<{ key: typeof tab; label: string; count?: number; color: string }> = [
    { key: 'ALL',        label: '전체',     count: list.length, color: 'text-gray-700 bg-gray-100' },
    { key: 'APPROVED',   label: '발주대기', count: approvedCount, color: 'text-amber-700 bg-amber-100' },
    { key: 'ORDERED',    label: '발주완료', count: orderedCount,  color: 'text-blue-700 bg-blue-100' },
    { key: 'RECEIVED',   label: '입고완료', count: receivedCount, color: 'text-green-700 bg-green-100' },
    { key: 'INSPECTING', label: '검사중',   count: inspectingCount, color: 'text-violet-700 bg-violet-100' },
    { key: 'INSPECTED',  label: '검사완료', count: inspectedCount,  color: 'text-emerald-700 bg-emerald-100' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── 헤더 ── */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 자재발주대기</h1>
            <p className="text-sm text-slate-300 mt-0.5">
              결재 승인완료된 소켓발주서를 관리하고 업체에 발주합니다
            </p>
          </div>
          <button
            onClick={fetchList}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            새로고침
          </button>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: '발주대기', count: approvedCount, icon: <AlertCircle className="h-4 w-4" />, color: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
            { label: '발주완료', count: orderedCount,  icon: <Package className="h-4 w-4" />,     color: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
            { label: '입고완료', count: receivedCount, icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500/20 text-green-200 border-green-400/30' },
          ].map(({ label, count, icon, color }) => (
            <div key={label} className={cn('rounded-xl border p-3 flex items-center gap-3', color)}>
              {icon}
              <div>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs opacity-80">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-2 px-6 py-3 bg-white border-b flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              tab === t.key ? t.color : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                tab === t.key ? 'bg-white/60' : 'bg-gray-200 text-gray-600'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 목록 ── */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-6 w-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-3" />
            로드 중...
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <ClipboardCheck className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-base font-semibold">
              {tab === 'APPROVED' ? '발주대기 목록이 없습니다' :
               tab === 'ORDERED'  ? '발주완료 목록이 없습니다' :
               tab === 'RECEIVED' ? '입고완료 목록이 없습니다' :
               '소켓발주서가 없습니다'}
            </p>
            <p className="text-sm mt-1.5">
              {tab === 'ALL' || tab === 'APPROVED'
                ? '결재함에서 소켓발주서가 승인완료되면 여기에 나타납니다'
                : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {list.map(order => (
              <OrderCard key={order.so_id} order={order} onRefresh={fetchList} vendors={vendors} />
            ))}
          </div>
        )}
      </div>

      {/* ── 안내 배너 ── */}
      <div className="flex-shrink-0 bg-blue-50 border-t border-blue-100 px-6 py-3">
        <div className="flex items-center gap-2 text-xs text-blue-700 max-w-4xl mx-auto">
          <span className="font-bold">워크플로우:</span>
          <span>결재 승인완료</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-amber-700">발주대기</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span>Excel 다운로드 / 이메일 발송</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-blue-700">발주완료</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span>물품 입고 확인</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="font-semibold text-green-700">인수검사</span>
        </div>
      </div>
    </div>
  );
}
