import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat
} from "docx";
import fs from "fs";

// ─── 상수 ───
const PAGE_W = 11906; // A4
const MARGIN = 1200;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9506

const BLUE = "1E40AF";
const DARK = "1F2937";
const GRAY = "6B7280";
const LIGHT_BG = "F8FAFC";
const HEADER_BG = "1E3A5F";
const HEADER_BG2 = "2563EB";
const ALT_ROW = "F1F5F9";
const WHITE = "FFFFFF";
const BORDER_C = "D1D5DB";

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_C };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

// ─── 헬퍼 ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, font: "Arial", color: BLUE })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial", color: DARK })],
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: "374151" })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 320 },
    ...opts,
    children: [new TextRun({ text, size: 20, font: "Arial", color: DARK, ...opts.run })],
  });
}
function pBold(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: DARK }),
      new TextRun({ text: value, size: 20, font: "Arial", color: "475569" }),
    ],
  });
}
function spacer(h = 200) {
  return new Paragraph({ spacing: { before: h } });
}
function divider() {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_C, space: 4 } },
  });
}
function noteBox(text) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    indent: { left: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: HEADER_BG2, space: 8 } },
    shading: { fill: "EFF6FF", type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Arial", color: "1D4ED8", italics: true })],
  });
}

// 테이블 생성 헬퍼
function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: colWidths[i], type: WidthType.DXA },
        borders,
        margins: cellMargins,
        shading: { fill: HEADER_BG, type: ShadingType.CLEAR },
        verticalAlign: "center",
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, bold: true, size: 18, font: "Arial", color: WHITE })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          borders,
          margins: cellMargins,
          shading: ri % 2 === 1 ? { fill: ALT_ROW, type: ShadingType.CLEAR } : undefined,
          verticalAlign: "center",
          children: [new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: String(cell), size: 18, font: "Arial", color: DARK })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ═════════════════════════════════════════════
// 문서 구성
// ═════════════════════════════════════════════

const children = [];

// ──── 표지 ────
children.push(spacer(2000));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text: "EZONE MES", bold: true, size: 60, font: "Arial", color: BLUE })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 100 },
  children: [new TextRun({ text: "Manufacturing Execution System", size: 28, font: "Arial", color: GRAY })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 400 },
  children: [new TextRun({ text: "제조실행시스템 설계서", bold: true, size: 40, font: "Arial", color: DARK })],
}));

// 표지 정보 테이블
children.push(makeTable(
  ["항목", "내용"],
  [
    ["문서번호", "EZONE-MES-DD-v1.0"],
    ["버전", "1.0 (최종)"],
    ["작성일", "2026-03-29"],
    ["작성", "June (품질관리) / Claude AI"],
    ["대상", "방화구획 관통부 차열 차단재"],
    ["회사", "(주)이지원 EZONE"],
  ],
  [3000, 6506]
));

children.push(spacer(600));

// 결재란
children.push(makeTable(
  ["작 성", "검 토", "승 인"],
  [["", "", ""], ["", "", ""]],
  [3168, 3168, 3170]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 목차 ────
children.push(h1("목 차"));
children.push(divider());
const tocItems = [
  "1. 시스템 개요", "2. 기술 아키텍처", "3. 데이터베이스 설계",
  "4. 품목 마스터 (Item Master)", "5. 인정구조 마스터 (Certification)",
  "6. BOM 체계 (Bill of Materials)", "7. 공정 흐름 및 라우팅",
  "8. 수주 관리 및 BOM 자동전개", "9. 재고 관리", "10. 품질 관리",
  "11. API 엔드포인트 목록", "12. 프론트엔드 화면 구성",
  "13. 작업자 및 권한 관리", "14. 사규 연동 체계",
];
for (const item of tocItems) {
  children.push(new Paragraph({
    spacing: { after: 160 },
    indent: { left: 300 },
    children: [new TextRun({ text: item, size: 24, font: "Arial", color: BLUE })],
  }));
}
children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 1. 시스템 개요 ────
children.push(h1("1. 시스템 개요"));
children.push(divider());
children.push(h2("1.1 목적"));
children.push(p("EZONE MES는 (주)이지원의 방화구획 관통부 차열 차단재 제조 공정을 관리하기 위한 제조실행시스템이다. 원재료 입고부터 배합, 압출, 재단, 조립, 출하까지 전 공정의 LOT 추적, 품질검사, 재고관리, BOM 자동산출을 하나의 시스템에서 통합 관리한다."));

children.push(h2("1.2 적용 범위"));
children.push(p("방화소켓(MP) 10개 구조, 부스덕트(BD) 2개 구조, 발포소켓(NP) 1개 구조 총 13개 인정구조에 대한 생산 관리. 원재료 4종, 부자재 11종, 반제품 7종, 완제품 16종 총 38개 활성 품목을 대상으로 한다."));

children.push(h2("1.3 핵심 기능"));
children.push(makeTable(
  ["기능", "상세 설명"],
  [
    ["수주 관리", "수주 등록(수동/엑셀), 품목별 인라인 수정, BOM 자동전개, 자재발주서/공정작업지시 생성"],
    ["BOM 자동산출", "관통부 치수(W x H) 기반 둘레 계산, 13개 구조별 자재 소요량 동적 계산"],
    ["공정 관리", "배합(MIX) - 압출(EXT) - 재단(CUT) - 조립(ASM) - 출하(SHP) 5공정 실행 관리"],
    ["LOT 추적", "C-302 Rev.8 기반 14종 약호, 정추적/역추적 완전 지원"],
    ["품질 관리", "인수검사, 공정검사(C-701 Rev.5), 자주검사, 출하품질관리서"],
    ["재고 관리", "실시간 재고, 초기재고 설정, 입출고 트랜잭션, 월말마감"],
    ["결재 관리", "작성-검토-승인 3단 결재 워크플로우"],
    ["TBM 안전회의", "일일 안전미팅 기록, 출석, 위험요소 관리"],
  ],
  [2400, 7106]
));

children.push(h2("1.4 시스템 규모"));
children.push(makeTable(
  ["항목", "수치"],
  [
    ["백엔드 라우트 모듈", "30개"],
    ["API 엔드포인트", "148개"],
    ["프론트엔드 페이지", "31개"],
    ["데이터베이스 테이블", "37개"],
    ["활성 품목", "38개 (RM:4, SM:11, SA:7, FP:16)"],
    ["인정구조", "13개 (MP:10, BD:2, NP:1)"],
    ["작업자", "16명 (admin:4, manager:3, worker:9)"],
  ],
  [3500, 6006]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 2. 기술 아키텍처 ────
children.push(h1("2. 기술 아키텍처"));
children.push(divider());
children.push(h2("2.1 기술 스택"));
children.push(makeTable(
  ["계층", "기술", "버전", "용도"],
  [
    ["Frontend", "React 18 + TypeScript", "18.x", "SPA 프론트엔드"],
    ["Frontend", "Vite", "5.x", "빌드 도구 / HMR 개발서버"],
    ["Frontend", "TailwindCSS", "3.x", "유틸리티 CSS 프레임워크"],
    ["Backend", "Fastify + TypeScript", "4.x", "REST API 서버"],
    ["Backend", "Node.js (fnm)", "20.x", "런타임 환경"],
    ["Database", "PostgreSQL", "15", "RDBMS"],
    ["Library", "xlsx (SheetJS)", "-", "엑셀 파일 파싱"],
    ["Library", "pg (node-postgres)", "-", "DB 커넥션 풀"],
  ],
  [1800, 3200, 1000, 3506]
));

children.push(h2("2.2 시스템 구성도"));
children.push(p("[사용자 브라우저] --- HTTP :5173 ---> [Vite Dev Server / React SPA]"));
children.push(p("                                            |  API 호출 (:3000)"));
children.push(p("                                [Fastify REST API Server] - 30개 라우트, 148개 엔드포인트"));
children.push(p("                                            |"));
children.push(p("                                [PostgreSQL 15 - ezone_mes] - 37개 테이블"));

children.push(h2("2.3 개발 환경"));
children.push(pBold("Node.js: ", 'fnm use 20 (Fast Node Manager)'));
children.push(pBold("DB: ", "postgresql://ezone:ezone1234@localhost:5432/ezone_mes"));
children.push(pBold("Backend: ", "cd backend && npx tsx src/index.ts (port 3000)"));
children.push(pBold("Frontend: ", "cd frontend && npm run dev (port 5173)"));

children.push(h2("2.4 API 설계 패턴"));
children.push(makeTable(
  ["Method", "프론트엔드 호출 패턴", "용도"],
  [
    ["GET", "api.get<T>(path)", "목록/상세 조회"],
    ["POST", "api.post<T>(path, body)", "생성 (body 필수)"],
    ["PATCH", "api.patch<T>(path, body)", "부분 수정"],
    ["DELETE", "api.delete(path)", "삭제"],
    ["UPLOAD", "api.upload<T>(path, FormData)", "파일 업로드 (multipart)"],
  ],
  [1500, 4000, 4006]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 3. 데이터베이스 설계 ────
children.push(h1("3. 데이터베이스 설계"));
children.push(divider());
children.push(h2("3.1 테이블 분류 (37개)"));
children.push(makeTable(
  ["분류", "테이블명", "수"],
  [
    ["마스터", "item_master, certification_master, certification_rule, bom_master, worker", "5"],
    ["공정BOM", "process_bom, process_bom_item, compounding_recipe, compounding_recipe_item", "4"],
    ["수주/구매", "sales_order, sales_order_item, order_bom_result, purchase_request, purchase_request_item", "5"],
    ["생산", "work_order, process_log, process_event, process_issue, loss_record", "5"],
    ["재고", "inventory_transaction, lot_transaction, lot_genealogy, lot_properties", "4"],
    ["품질", "inspection, inspection_detail, self_inspection, defect_record, disposal_report", "5"],
    ["재고마감", "inventory_closing, closing_item, closing_adjustment", "3"],
    ["결재", "approval, approval_line", "2"],
    ["TBM", "tbm_meeting, tbm_attendee, tbm_issue", "3"],
    ["기타", "attachment", "1"],
  ],
  [1500, 7006, 1000]
));

children.push(h2("3.2 핵심 테이블 스키마"));
children.push(h3("sales_order (수주)"));
children.push(makeTable(
  ["컬럼", "타입", "설명"],
  [
    ["order_id", "SERIAL PK", "수주 ID"],
    ["order_number", "VARCHAR(30) UNIQUE", "수주번호 (SO-YYMMDD-NNN)"],
    ["order_date", "DATE NOT NULL", "수주일"],
    ["customer_name", "VARCHAR(200) NOT NULL", "고객사"],
    ["project_name", "VARCHAR(300)", "프로젝트명"],
    ["delivery_date", "DATE", "납기일"],
    ["status", "VARCHAR(15)", "REGISTERED / BOM_EXPLODED / PO_CREATED / IN_PRODUCTION / SHIPPED / CANCELLED"],
    ["total_sets", "INTEGER", "총 세트수"],
  ],
  [2500, 3000, 4006]
));

children.push(h3("sales_order_item (수주 품목)"));
children.push(makeTable(
  ["컬럼", "타입", "설명"],
  [
    ["order_item_id", "SERIAL PK", "품목 ID"],
    ["order_id", "INTEGER FK", "수주 참조"],
    ["cert_id", "INTEGER FK", "인정구조 참조"],
    ["structure_code", "VARCHAR(30)", "구조코드 (VT-01 등)"],
    ["qty", "INTEGER DEFAULT 1", "수량"],
    ["penetration_w_mm", "INTEGER", "관통부 가로 (mm)"],
    ["penetration_h_mm", "INTEGER", "관통부 세로 (mm)"],
  ],
  [2800, 2800, 3906]
));

children.push(h3("work_order (작업지시)"));
children.push(makeTable(
  ["컬럼", "타입", "설명"],
  [
    ["wo_id", "SERIAL PK", "작업지시 ID"],
    ["wo_number", "VARCHAR(50) UNIQUE", "WO-[공정]-YYYYMMDD-NNN"],
    ["process_code", "VARCHAR(5)", "MIX / EXT / CUT / ASM / SHP"],
    ["status", "VARCHAR(15)", "PLANNED / IN_PROGRESS / COMPLETED / HOLD"],
    ["order_id", "INTEGER FK", "수주 연결"],
    ["planned_qty", "NUMERIC", "계획 수량"],
    ["actual_qty", "NUMERIC", "실적 수량"],
    ["lot_number", "VARCHAR(30)", "LOT 번호"],
  ],
  [2500, 3000, 4006]
));

children.push(noteBox("CHECK 제약조건: work_order.process_code IN ('MIX','EXT','CUT','ASM','SHP'), work_order.status IN ('PLANNED','IN_PROGRESS','COMPLETED','HOLD'). purchase_request.status IN ('DRAFT','SUBMITTED','APPROVED','ORDERED','RECEIVED','CANCELLED')."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 4. 품목 마스터 ────
children.push(h1("4. 품목 마스터 (Item Master)"));
children.push(divider());
children.push(p("총 38개 활성 품목 (is_active=true). 55개 중 비활성 17개 제외."));

children.push(h2("4.1 원재료 (RM) - 4종"));
children.push(makeTable(
  ["품목코드", "품목명", "단위", "비고"],
  [
    ["RM-MB", "난연컴파운드(PE3005MB)", "KG", "배합 주원료 50%"],
    ["RM-EG50", "팽창흑연 #50", "KG", "배합 부원료 20%"],
    ["RM-EA", "EVA-EA33045", "KG", "배합 부원료 15%"],
    ["RM-EP", "EVA-EP100", "KG", "배합 부원료 15%"],
  ],
  [1800, 3500, 1000, 3206]
));

children.push(h2("4.2 반제품 (SA) - 7종"));
children.push(makeTable(
  ["품목코드", "품목명", "단위", "비고"],
  [
    ["SA-MIX-MB", "인정배합", "KG", "배합 산출물 (300kg/배치)"],
    ["SA-EXT-5190", "압출 5T-W190", "M", "소켓용 (벽체 소형 0310)"],
    ["SA-EXT-5125I", "압출 5T-W125 I형", "M", "I형 플래싱용"],
    ["SA-EXT-4125Z", "압출 4T-W125 Z형", "M", "Z형 플래싱용"],
    ["SA-EXT-65415", "압출 6.5T-W415 FN용", "M", "발포소켓용"],
    ["SA-CUT-SK", "재단-소켓용", "EA", "소켓 내/외부 차열시트"],
    ["SA-CUT-FL", "재단-플래싱용", "EA", "방화플래싱 차열시트"],
  ],
  [2000, 3200, 1000, 3306]
));

children.push(h2("4.3 부자재 (SM) - 11종"));
children.push(makeTable(
  ["품목코드", "품목명", "단위", "비고"],
  [
    ["SM-CW-96", "세라믹차열재 96K", "M", "밀도 96kg/m3 이상"],
    ["SM-CW-100", "세라믹차열재 100K", "M", "밀도 100kg/m3 이상"],
    ["SM-CW-128", "세라믹차열재 128K", "M", "밀도 128kg/m3 이상"],
    ["SM-GW-24", "글라스울 24K", "M", "밀도 24kg/m3, 보온재"],
    ["SM-STL-I", "강재류(아연도금) I형", "M", "소켓본체/브라켓"],
    ["SM-STL-L", "강재류(아연도금) L형", "M", "L형 플래싱 강판"],
    ["SM-STL-Z", "강재류(아연도금) Z형", "M", "Z형 플래싱 강판"],
    ["SM-PE-INS", "PE보온재 폼", "M", ""],
    ["SM-SIL", "실리콘 실란트", "EA", "KS F 4910"],
    ["SM-FN-SK", "발포소켓", "EA", ""],
    ["SM-GP", "보호철판", "EA", "3인치 이상"],
  ],
  [1800, 3200, 1000, 3506]
));

children.push(h2("4.4 완제품 (FP) - 16종"));
children.push(makeTable(
  ["품목코드", "품목명", "단위", "비고"],
  [
    ["FP-VT01", "방화소켓 VT-01", "EA", "벽체 대형 0310, 2소켓"],
    ["FP-VT049", "방화소켓 VT-049", "EA", "벽체 소형 0310"],
    ["FP-VA064", "방화소켓 VA-064", "EA", "벽체 소형 0310"],
    ["FP-VT064", "방화소켓 VT-064", "EA", "벽체 소형 0310"],
    ["FP-VAG169", "방화소켓 VAG-1.69", "EA", "벽체 대형 0910, 2소켓"],
    ["FP-VTI064", "방화소켓 VTI-064", "EA", "벽체 소형 0910"],
    ["FP-HTG064", "방화소켓 HTG-064", "EA", "바닥 소형 0910"],
    ["FP-HTG169", "방화소켓 HTG-1.69", "EA", "바닥 대형 0910, 2소켓"],
    ["FP-HTGDC064", "방화소켓 HTG(DC)-064", "EA", "바닥 DC 선시공"],
    ["FP-FL-I", "방화플래싱 I형", "EA", "L1000 x W125"],
    ["FP-FL-L", "방화플래싱 L형", "EA", "L1000 x W125+W75"],
    ["FP-FL-Z", "방화플래싱 Z형", "EA", "L1000 x W125+W170"],
    ["FP-FN-75A", "발포소켓 75A", "EA", "비금속관용"],
    ["FP-FN-100A", "발포소켓 100A", "EA", "비금속관용"],
    ["FP-GAP-SH", "틈새복합시트", "EA", ""],
    ["FP-STRUCT", "구조체", "EA", ""],
  ],
  [2000, 3200, 1000, 3306]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 5. 인정구조 마스터 ────
children.push(h1("5. 인정구조 마스터 (Certification)"));
children.push(divider());
children.push(p("총 13개 인정구조. 한국건설기술연구원(KICT) 성능인정 기준. 차열 2시간 등급."));

children.push(h2("5.1 방화소켓 구조 (MP) - 10종"));
children.push(makeTable(
  ["구조코드", "설치위치", "인정Ver", "소켓명", "시트두께", "CW밀도", "비고"],
  [
    ["VT-01", "수직벽체", "0310", "VT200", "5.0T", "120K", "2소켓 대형"],
    ["VT-049", "수직벽체", "0310", "VM200", "5.0T", "120K", "1소켓 소형"],
    ["VA-064", "수직벽체", "0310", "VM200", "5.0T", "120K", "1소켓 소형"],
    ["VT-064", "수직벽체", "0310", "VM200", "5.0T", "120K", "1소켓 소형"],
    ["VAG-1.69", "수직벽체", "0910", "VTG200", "4.0T", "96K", "2소켓 대형"],
    ["VTI-064", "수직벽체", "0910", "VIG200", "4.0T", "96K", "1소켓 소형"],
    ["HAG-1.69", "수평바닥", "0910", "HTG300C", "4.0T", "96K", "2소켓"],
    ["HTG-1.69", "수평바닥", "0910", "HTG300C", "4.0T", "96K", "2소켓"],
    ["HTG-064", "수평바닥", "0910", "HMG300C", "4.0T", "96K", "1소켓"],
    ["HTG(DC)-064", "수평바닥", "0910", "HMG300", "4.0T", "96K", "DC선시공"],
  ],
  [1700, 1200, 1000, 1300, 1000, 1000, 2306]
));

children.push(h2("5.2 부스덕트 / 발포소켓 - 3종"));
children.push(makeTable(
  ["구조코드", "그룹", "설치위치", "인정Ver", "설명"],
  [
    ["EZ-BD-CV-1S", "BD", "수직벽체", "0910", "부스덕트 CV 1소켓"],
    ["EZ-BD-RV-3S", "BD", "수직벽체", "0910", "부스덕트 RV 3소켓"],
    ["EZ-FN-P100", "NP", "수평바닥", "NP24", "비금속관 발포소켓"],
  ],
  [2200, 1000, 1500, 1200, 3606]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 6. BOM 체계 ────
children.push(h1("6. BOM 체계 (Bill of Materials)"));
children.push(divider());

children.push(h2("6.1 공정BOM (Process BOM) - 9종"));
children.push(makeTable(
  ["BOM코드", "공정", "투입", "산출", "로스율"],
  [
    ["BOM-MIX-CERT-300", "MIX", "RM 4종 (300kg)", "SA-MIX-MB", "2%"],
    ["BOM-EXT-SK-5190", "EXT", "SA-MIX-MB", "SA-EXT-5190", "3%"],
    ["BOM-EXT-FL-5125", "EXT", "SA-MIX-MB", "SA-EXT-5125I", "3%"],
    ["BOM-EXT-FL-4125", "EXT", "SA-MIX-MB", "SA-EXT-4125Z", "3%"],
    ["BOM-CUT-SK", "CUT", "SA-EXT-5190", "SA-CUT-SK", "15%"],
    ["BOM-CUT-FL-Z", "CUT", "SA-EXT-4125Z", "SA-CUT-FL", "15%"],
    ["BOM-CUT-FL-I", "CUT", "SA-EXT-5125I", "SA-CUT-FL", "15%"],
    ["BOM-ASM-VT01", "ASM", "11종 구성품", "FP-VT01", "0%"],
    ["BOM-SHP-FL-HTG169", "SHP", "6종 구성품", "세트", "0%"],
  ],
  [2800, 900, 2200, 2200, 1406]
));

children.push(h2("6.2 인정배합 레시피 (300kg 1배치)"));
children.push(makeTable(
  ["품목코드", "품목명", "투입량(kg)", "비율"],
  [
    ["RM-MB", "난연컴파운드(PE3005MB)", "150", "50%"],
    ["RM-EG50", "팽창흑연 #50", "60", "20%"],
    ["RM-EA", "EVA-EA33045", "45", "15%"],
    ["RM-EP", "EVA-EP100", "45", "15%"],
    ["합계", "", "300", "100%"],
  ],
  [2000, 3806, 1800, 1906]
));

children.push(h2("6.3 치수 기반 동적 BOM 산출 엔진"));
children.push(p("수주 품목의 관통부 치수(W x H)를 기반으로 모든 자재 소요량을 자동 계산한다. 구조별(벽체/바닥, 0310/0910, 소켓 수) 분기 처리."));
children.push(makeTable(
  ["산출 항목", "공식", "적용"],
  [
    ["둘레", "P = 2 x (W + H)", "모든 구조 공통"],
    ["차열시트 내부 (벽체 N=1)", "상하 L=W-5 x 4EA, 좌우 L=H-30 x 4EA", "VA-064, VT-064 등"],
    ["차열시트 내부 (벽체 N=2, 0310)", "상하 L=W/2-15 x 8EA, 좌우 L=H/2-20 x 16EA", "VT-01"],
    ["차열시트 내부 (벽체 N=2, 0910)", "상하 L=W/2-35 x 12EA, 중앙 2EA", "VAG-1.69"],
    ["방화플래싱 (벽체)", "1면: (W+250)x2+Hx2, 양면x2, 로스10%", "REV-008 기준"],
    ["방화플래싱 (바닥 Z형)", "ROUNDUP(P/1000) x 양면2 x 로스", "HTG-064, 1.69"],
    ["방화플래싱 (바닥 L형/DC)", "ROUNDUP(P/1000) x 로스", "HTG(DC)-064"],
    ["세라믹블랭킷", "상하2+좌우2 x L / 1000 = M", "25T x 200~300W"],
    ["글라스울 보온재", "(W+H)x2x4면/1000/1.4(롤폭)", "24K, W1400"],
    ["실란트", "CEIL(P/3000) x N", "KS F 4910"],
    ["직결피스", "플래싱세트 x (CEIL(1000/237)+1)", "#8x64mm"],
    ["SA->RM 역전개", "배치수 = SA수량/산출량, RM = 배치 x 투입 x 로스", "자동 역추적"],
  ],
  [2800, 4200, 2506]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 7. 공정 흐름 ────
children.push(h1("7. 공정 흐름 및 라우팅"));
children.push(divider());

children.push(h2("7.1 5공정 흐름도"));
children.push(p("[원재료입고] -> [MIX 배합] -> [EXT 압출] -> [CUT 재단] -> [ASM 조립] -> [SHP 출하]"));
children.push(p("  RM 4종         300kg/배치     시트 압출       소켓/플래싱      구조별 조립      세트 출하", { run: { color: GRAY, size: 18 } }));

children.push(h2("7.2 공정별 상세"));
children.push(makeTable(
  ["공정", "공정명", "투입 -> 산출", "단위", "검사항목"],
  [
    ["MIX", "배합", "RM 4종 -> SA-MIX-MB", "300kg/배치", "밀도(g/cm3), 배합비율"],
    ["EXT", "압출", "SA-MIX-MB -> SA-EXT-*", "연속", "두께(mm), 폭(mm), 밀도"],
    ["CUT", "재단", "SA-EXT-* -> SA-CUT-*", "EA단위", "길이(mm), 폭(mm)"],
    ["ASM", "조립", "SA-CUT + SM -> FP-*", "EA단위", "외관, 치수, 기밀성"],
    ["SHP", "출하", "FP-* + SM -> 세트", "세트", "출하검사, 품질관리서"],
  ],
  [1000, 1200, 2800, 1500, 3006]
));

children.push(h2("7.3 작업지시 자동생성"));
children.push(p("수주 BOM 전개 결과를 기반으로 MIX/EXT/CUT/ASM 4개 공정의 작업지시를 자동 생성한다. WO번호: WO-[공정코드]-[YYYYMMDD]-[NNN]. 계획일은 납기일 - 7일."));
children.push(noteBox("중복 생성 방지: 백엔드 DB 체크 + 프론트엔드 상태 기반 버튼 비활성화 + confirm 대화상자 3중 방어."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 8. 수주 관리 ────
children.push(h1("8. 수주 관리 및 BOM 자동전개"));
children.push(divider());

children.push(h2("8.1 수주 상태 흐름"));
children.push(makeTable(
  ["상태코드", "라벨", "진입 조건"],
  [
    ["REGISTERED", "등록", "수주 생성 시 기본 상태"],
    ["BOM_EXPLODED", "BOM전개", "BOM 자동전개 완료"],
    ["PO_CREATED", "발주생성", "자재발주서 생성 완료"],
    ["IN_PRODUCTION", "생산중", "공정작업지시 생성 완료"],
    ["SHIPPED", "출하완료", "출하 완료"],
    ["CANCELLED", "취소", "수주 취소"],
  ],
  [2500, 1500, 5506]
));

children.push(h2("8.2 수주 API 기능 목록"));
children.push(makeTable(
  ["기능", "API 엔드포인트", "설명"],
  [
    ["수주 등록", "POST /api/orders", "수동 입력 또는 엑셀 업로드"],
    ["수주 조회", "GET /api/orders/:id", "품목 + BOM 결과 포함"],
    ["수주 수정", "PATCH /api/orders/:id", "고객사, 납기일 등"],
    ["수주 삭제", "DELETE /api/orders/:id", "CASCADE 삭제"],
    ["품목 추가", "POST /api/orders/:id/items", "인정구조 선택, 치수 입력"],
    ["품목 인라인 수정", "PATCH /api/orders/:id/items/:itemId", "구조, 수량, W, H 수정"],
    ["품목 삭제", "DELETE /api/orders/:id/items/:itemId", "개별 품목 삭제"],
    ["BOM 전개", "POST /api/orders/:id/explode-bom", "치수 기반 자동 산출"],
    ["발주서 생성", "POST /api/orders/:id/create-pr", "부족자재 자동 발주 (중복방지)"],
    ["작업지시 생성", "POST /...generate-work-orders", "MIX/EXT/CUT/ASM (중복방지)"],
    ["엑셀 업로드", "POST /api/orders/upload-excel", "미리보기 후 confirm=true 확정"],
  ],
  [2000, 3800, 3706]
));

children.push(h2("8.3 중복 생성 방지 체계"));
children.push(makeTable(
  ["방어 위치", "로직", "결과"],
  [
    ["백엔드 (발주서)", "취소되지 않은 기존 발주서 DB 조회", "에러 메시지 반환"],
    ["백엔드 (작업지시)", "해당 수주 작업지시 존재 여부 확인", "409 Conflict 반환"],
    ["프론트 (상태체크)", "PO_CREATED/IN_PRODUCTION 시 비활성", "회색 '생성완료' 표시"],
    ["프론트 (클릭방지)", "creatingPR/generatingWO 상태", "disabled + opacity"],
    ["프론트 (확인)", "confirm() 대화상자", "사용자 최종 확인"],
  ],
  [2200, 4000, 3306]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 9. 재고 관리 ────
children.push(h1("9. 재고 관리"));
children.push(divider());
children.push(p("모든 재고 변동은 inventory_transaction 테이블에 IN/OUT 트랜잭션으로 기록. 현재고 = SUM(IN) - SUM(OUT). LOT별 추적 가능."));
children.push(makeTable(
  ["기능", "API / 모듈", "설명"],
  [
    ["초기재고 설정", "POST /api/inventory/initialize", "시스템 도입 시 전 품목 기초재고 입력"],
    ["현재고 조회", "GET /api/inventory/current-stock", "전 품목 현재고 일괄 조회"],
    ["입출고 내역", "GET /api/inventory/transactions", "필터: 품목, 기간, 유형"],
    ["LOT별 재고", "GET /api/inventory/lot-inventory", "LOT 단위 재고 현황"],
    ["대시보드", "GET /api/inventory/dashboard", "카테고리별 요약, 부족 알림"],
    ["월말마감", "inventory-closing 모듈", "마감 확정/조정/이월 워크플로우"],
  ],
  [2000, 3800, 3706]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 10. 품질 관리 ────
children.push(h1("10. 품질 관리"));
children.push(divider());
children.push(h2("10.1 검사 체계"));
children.push(makeTable(
  ["검사유형", "모듈", "시점", "양식 / 기준", "조건"],
  [
    ["인수검사", "incoming", "원재료/부자재 입고 시", "D-121~126 양식", "n=3, c=0"],
    ["공정검사", "process-inspection", "C-701 Rev.5 기준", "G01~G04 통합양식", "공정별 상이"],
    ["자주검사", "self-inspection", "작업자 자체 검사", "공정별 preset", "매 작업"],
    ["출하검사", "quality-report", "출하 전 최종 검사", "품질관리서", "전수"],
  ],
  [1600, 2200, 2200, 2200, 1306]
));

children.push(h2("10.2 인정기준 검증"));
children.push(p("측정값(밀도, 두께 등)이 인정서 기준을 충족하는지 자동 판정. certification_rule 43개 기준 적용. POST /api/cert-check/verify 엔드포인트로 실시간 판정."));

children.push(h2("10.3 불량/폐기/로스 관리"));
children.push(p("defect_record: 불량 기록 및 원인 분석. disposal_report: 폐기 처리 보고서. loss_record: 공정별 로스 기록 및 추세 분석 (일별/월별/LOT상세)."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 11. API 엔드포인트 ────
children.push(h1("11. API 엔드포인트 목록"));
children.push(divider());
children.push(p("총 148개 엔드포인트, 30개 라우트 모듈. 모든 응답은 JSON 형식."));

children.push(makeTable(
  ["모듈", "기능", "EP수", "주요 기능"],
  [
    ["orders", "수주/BOM/발주", "13", "CRUD, BOM전개, 발주서, 작업지시, 엑셀업로드"],
    ["work-orders", "작업지시", "4", "CRUD + 자재소비"],
    ["inventory", "재고", "12", "대시보드, 입출고, LOT, 초기재고"],
    ["inspections", "인수검사", "6", "CRUD, preset, 자동판정"],
    ["self-inspections", "자주검사", "4", "CRUD, preset, 일괄등록"],
    ["process-inspections", "공정검사", "4", "CRUD, 템플릿"],
    ["process-execution", "공정실행", "9", "시작/일시정지/재개/완료, 밀도적용"],
    ["certifications", "인정구조", "2", "조회, 수정"],
    ["items", "품목마스터", "2", "조회, 수정"],
    ["process-bom", "공정BOM", "6", "CRUD, 산출계산, 로스기록"],
    ["compounding", "배합레시피", "3", "레시피 조회/생성, 계산"],
    ["lots", "LOT관리", "3", "생성, 정/역추적"],
    ["lot-validation", "LOT검증", "2", "유효성, 다음번호"],
    ["lot-properties", "LOT속성", "4", "밀도이력, 공정별 속성"],
    ["approvals", "결재", "7", "CRUD, 검토, 승인, 대기건수"],
    ["workers", "작업자", "6", "CRUD, 대량등록, 로그인"],
    ["shipments", "출하", "4", "CRUD"],
    ["quality-reports", "품질관리서", "2", "조회, 출하별"],
    ["dashboard", "대시보드", "3", "종합, 활동로그, 알림"],
    ["reports", "보고서", "3", "일간/주간/월간"],
    ["tbm", "TBM안전회의", "8", "CRUD, 출석, 위험사항"],
    ["defects", "불량/폐기", "4", "불량기록, 폐기보고서"],
    ["loss-analytics", "로스분석", "8", "일별/월별/추세, LOT상세"],
    ["inventory-closing", "재고마감", "15", "마감 워크플로우"],
    ["compliance", "미비사항", "1", "체크리스트"],
    ["cert-check", "인정기준검증", "2", "측정값 검증, 적용구조 검색"],
    ["attachments", "첨부파일", "3", "업로드, 다운로드"],
    ["backup", "백업", "2", "내보내기, 가져오기"],
    ["structure-lots", "구조LOT", "3", "생성, 요약"],
    ["production-stats", "생산통계", "2", "일간/주간 통계"],
  ],
  [2200, 1800, 800, 4706]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 12. 프론트엔드 ────
children.push(h1("12. 프론트엔드 화면 구성"));
children.push(divider());
children.push(p("총 31개 페이지. 실무(shop) / 관리(admin) 듀얼모드 사이드바. React 18 + TypeScript + TailwindCSS."));

children.push(makeTable(
  ["화면명", "라우트 경로", "기능 설명"],
  [
    ["대시보드", "/dashboard", "종합 현황 (주문, 생산, 재고, 품질)"],
    ["작업지시", "/production/work-orders", "작업지시 목록/상세/상태관리"],
    ["공정실행", "/production/process-execution", "공정별 시작/완료, 측정값 입력"],
    ["일일작업일지", "/production/daily-log", "일별 작업 기록"],
    ["생산현황판", "/production/production-dashboard", "실시간 생산 현황"],
    ["TBM 안전회의", "/production/tbm", "안전미팅, 출석, 위험요소"],
    ["인수검사", "/quality/incoming", "원재료/부자재 인수검사 기록"],
    ["공정검사", "/quality/process-inspection", "C-701 기반 공정검사"],
    ["자주검사", "/quality/self-inspection", "작업자 자체 검사"],
    ["LOT 추적", "/quality/lot-trace", "정추적/역추적"],
    ["인정기준 검증", "/quality/cert-check", "측정값 vs 인정기준"],
    ["불량/폐기", "/quality/defects", "불량 기록, 폐기 보고서"],
    ["미비사항 점검", "/quality/compliance", "품질인정 대비 체크리스트"],
    ["재고 대시보드", "/inventory/dashboard", "카테고리별 재고현황"],
    ["초기재고 설정", "/inventory/initialize", "시스템 도입 시 기초재고"],
    ["월말마감", "/inventory/closing", "재고 마감/조정/이월"],
    ["수주관리/BOM", "/orders", "수주 CRUD, BOM전개, 발주/작업지시"],
    ["자재발주서", "/orders/purchase-requests", "발주서 목록/상세/상태관리"],
    ["출하", "/shipment/list", "출하 등록/관리"],
    ["품질관리서", "/shipment/quality-report/:id", "출하 품질관리서 출력"],
    ["인정구조 관리", "/master/certifications", "13개 구조 관리"],
    ["품목 관리", "/master/items", "38개 품목 관리"],
    ["BOM 관리", "/master/bom", "공정BOM 관리"],
    ["결재함", "/approval/inbox", "결재 대기/처리"],
    ["결재선 관리", "/approval/lines", "결재선 설정"],
    ["보고서", "/reports", "일간/주간/월간 보고서"],
    ["로스 분석", "/reports/loss", "공정별 로스 추세"],
    ["백업", "/settings/backup", "데이터 내보내기/가져오기"],
    ["사용자 관리", "/settings/users", "작업자 등록/수정"],
  ],
  [2000, 3800, 3706]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 13. 작업자 ────
children.push(h1("13. 작업자 및 권한 관리"));
children.push(divider());

children.push(h2("13.1 작업자 목록 (16명)"));
children.push(makeTable(
  ["성명", "부서", "직급", "권한"],
  [
    ["관리자", "관리부", "관리자", "admin"],
    ["박민선", "경영", "대표이사", "admin"],
    ["이동민", "기술품질", "파트장", "admin"],
    ["임병용", "생산", "파트장", "admin"],
    ["김봉민", "생산관리", "책임", "manager"],
    ["김정용", "기술품질", "책임", "manager"],
    ["이종재", "시스템관리", "책임", "admin"],
    ["최진영", "생산품질", "책임", "manager"],
    ["김득수", "생산", "리더", "worker"],
    ["최윤정", "생산품질", "선임", "worker"],
    ["표문규", "생산", "리더", "worker"],
    ["권영진", "생산", "선임", "worker"],
    ["강보훈", "생산", "선임", "worker"],
    ["임승용", "생산", "선임", "worker"],
    ["이윤호", "생산품질", "주임", "worker"],
    ["최영철", "생산", "주임", "worker"],
  ],
  [2000, 2500, 2500, 2506]
));

children.push(h2("13.2 권한 체계"));
children.push(makeTable(
  ["권한", "설명", "인원"],
  [
    ["admin", "전체 관리. 마스터 데이터 수정, 설정, 결재 승인.", "4명"],
    ["manager", "중간 관리. 작업지시 생성, 검사 검토, 보고서 조회.", "3명"],
    ["worker", "현장 작업. 공정 실행, 자주검사, 일일 기록.", "9명"],
  ],
  [1500, 6506, 1500]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ──── 14. 사규 연동 ────
children.push(h1("14. 사규 연동 체계"));
children.push(divider());
children.push(p("EZONE MES는 (주)이지원 품질경영시스템 사규와 연동되어 운영된다."));

children.push(h2("14.1 관련 사규 목록"));
children.push(makeTable(
  ["사규번호", "명칭", "MES 반영 사항"],
  [
    ["EZC-C-701 Rev.5", "검사업무규정", "인수검사 n=3/c=0, 검사원 자격, G01~G04 통합양식"],
    ["EZC-C-302 Rev.8", "제품식별 및 추적성관리", "LOT번호 부여(14종 약호), 정추적/역추적"],
    ["EZC-C-601 Rev.4", "제조공정관리", "배합 로트번호 [YYMMDD]-S[NN], 교차검증"],
    ["EZC-D-121 Rev.3", "강재류 인수검사", "방화소켓/플래싱 아연도금, N/mm2 단위"],
    ["EZC-D-122 Rev.1", "그라스울 인수검사", "밀도 24kg/m3, 두께/너비, 열전도율"],
    ["EZC-D-124 Rev.4", "세라믹울 인수검사", "96K/120K, 8h/24h 양식 구분"],
    ["EZC-D-126 Rev.0", "강재류 SUS304 인수검사", "인장강도 520 N/mm2 이상"],
  ],
  [2200, 2800, 4506]
));

children.push(h2("14.2 C-302 Rev.8 신규 약호"));
children.push(makeTable(
  ["약호", "자재명", "적용 양식"],
  [
    ["SS", "SUS304 (스테인리스강판)", "EZC-D-126-1~2"],
    ["PM", "POSMAC (도금강판)", "EZC-D-121 계열"],
    ["GP", "보호철판", "EZC-D-121 계열"],
    ["SL", "실리콘실란트", "추후 확정"],
    ["BK", "브라켓", "EZC-D-121 계열"],
  ],
  [1500, 4000, 4006]
));

children.push(spacer(600));
children.push(divider());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 200 },
  children: [new TextRun({ text: "--- END ---", size: 20, font: "Arial", color: GRAY })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 100 },
  children: [new TextRun({ text: "EZONE MES v1.0  |  (주)이지원  |  2026-03-29", size: 18, font: "Arial", color: GRAY })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60 },
  children: [new TextRun({ text: "본 문서는 시스템의 현재 최종 상태를 반영한 설계서입니다.", size: 18, font: "Arial", color: GRAY })],
}));

// ═════════════════════════════════════════════
// 문서 생성
// ═════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: DARK },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_C, space: 4 } },
          children: [new TextRun({ text: "EZONE MES v1.0  |  시스템 설계서  |  CONFIDENTIAL", size: 14, font: "Arial", color: GRAY })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_C, space: 4 } },
          children: [
            new TextRun({ text: "(주)이지원  |  페이지 ", size: 14, font: "Arial", color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], size: 14, font: "Arial", color: GRAY }),
          ],
        })],
      }),
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
const outPath = "/Users/junepark/Documents/00_Inbox (수신함)/00_MES/ezone-mes/EZONE_MES_시스템설계서_v1.0.docx";
fs.writeFileSync(outPath, buffer);
console.log(`DOCX 생성 완료: ${outPath}`);
console.log(`파일 크기: ${(buffer.length / 1024).toFixed(1)} KB`);
