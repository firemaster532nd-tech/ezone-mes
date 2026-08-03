import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  BookOpen, HelpCircle, MessageSquare, Plus, Trash2,
  ChevronDown, ChevronUp, Mail, MailOpen, Loader2,
  Search, CheckCircle2, Eye, X,
  LayoutDashboard, ShoppingCart, Inbox, Megaphone, Package,
  HardHat, ClipboardList, Boxes, ShieldCheck, Scissors,
  FlaskConical, Layers, Box, Hammer, Truck, Monitor,
  Database, TrendingUp, Settings, HeadphonesIcon,
  Smartphone, Sparkles,
} from 'lucide-react';


// ── Types ────────────────────────────────────────────────────────────────────
interface Faq {
  id: number;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
}

interface PublicInquiry {
  id: number;
  sender_name: string;
  sender_contact: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── 메뉴 매뉴얼 데이터 (정적) ─────────────────────────────────────────────
interface ManualSection {
  id: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  Icon: React.ElementType;
  title: string;
  subtitle: string;
  steps: { title: string; content: string }[];
  tips?: string[];
}

const MANUAL_DATA: ManualSection[] = [
  // ── PWA 모바일 앱 설치 가이드 ──
  {
    id: 'pwa-install', category: 'general', categoryLabel: '일반', categoryColor: '#64748b',
    Icon: Smartphone, title: '모바일 앱 설치 가이드 (PWA)',
    subtitle: '이지원 MES를 스마트폰 및 태블릿에 앱으로 설치하여 현장 작업 시 편리하게 사용하는 방법',
    steps: [
      { title: 'Android (안드로이드) 설치', content: 'Chrome 브라우저로 이지원.kr에 접속한 후, 주소창 우측의 더보기(점 3개) 버튼을 누르고 [앱 설치] 또는 [홈 화면에 추가]를 클릭합니다.' },
      { title: 'iOS (아이폰/아이패드) 설치', content: 'Safari 브라우저로 이지원.kr에 접속한 후, 하단 중앙의 공유(내보내기) 아이콘을 클릭하고 목록에서 [홈 화면에 추가]를 선택합니다.' },
      { title: 'PC 데스크톱 설치', content: 'Chrome 또는 Edge 브라우저 주소창 우측 끝에 표시되는 [설치] 아이콘(모니터 모양에 아래 화살표)을 클릭하여 데스크톱 앱으로 설치합니다.' },
      { title: '앱 실행 및 권한 허용', content: '설치 완료 후 바탕화면에 생성된 "이지원 MES" 아이콘을 실행하면 브라우저 주소창 없이 풀스크린 앱으로 구동됩니다. 카메라 및 알림 권한을 허용해 주세요.' },
    ],
    tips: [
      '안드로이드 기기에서는 QR/바코드 인식을 위한 카메라 권한 및 알림 권한을 반드시 허용해 주세요.',
      'PWA 앱은 인터넷 브라우저 캐시를 사용하여 빠른 구동 및 로딩 속도를 보장합니다.'
    ],
  },
  // ── 신규 업데이트 기능 가이드 ──
  {
    id: 'recent-updates', category: 'general', categoryLabel: '일반', categoryColor: '#64748b',
    Icon: Sparkles, title: '신규 업데이트 기능 가이드',
    subtitle: '영업관리 이카운트 연동, 복식부기 회계 ERP, WMS 3구역 시각화, 인수검사 라벨 선발행 등 신규 추가 기능 활용법',
    steps: [
      { title: '영업 관리 (이카운트 구조 재편)', content: '메뉴 > 영업관리에서 견적서 등록, 판매(출하) 등록 및 국세청 표준 세금계산서(적색/청색) 인쇄 모달을 지원합니다. 이카운트 연동을 통해 원클릭 동기화가 가능합니다.' },
      { title: '수입검사 / 인수검사 개선', content: '원/부자재 발주 정보와 수입검사가 완전 연동되어, 검사 즉시 창고 재고로 자동 등록됩니다. 바코드 라벨을 검사 전/후에 선발행하여 자재 식별이 용이해졌습니다.' },
      { title: '회계 ERP 및 표준 문서 출력', content: '대한민국 기업 표준 복식부기 서식(손익계산서/재무상태표) 출력을 지원하며, 모든 출력 문서에 회사 인장(도장)이 자동으로 합성되어 인쇄됩니다.' },
      { title: 'WMS 2단계 Staging 및 3구역 시각화', content: '포장·출하 시 2단계 Staging 프로세스가 신설되었습니다. 렉 로케이션 메뉴에서 공장 3구역(1공장, 2공장, 재단실 등 총 8대 공장구역)의 실시간 적재 현황 카드를 시각적으로 모니터링할 수 있습니다.' },
    ],
    tips: [
      '신규 영업 및 회계 서식 인쇄 시 크롬 인쇄 설정에서 "배경 그래픽"을 활성화해야 이지원 인장과 라인 색상이 올바르게 인쇄됩니다.'
    ],
  },
  // ── 대시보드 ──
  {

    id: 'dashboard', category: 'general', categoryLabel: '일반', categoryColor: '#64748b',
    Icon: LayoutDashboard, title: '오늘의 작업 (대시보드)',
    subtitle: '당일 작업지시, 결재 대기, 출하 현황을 한눈에 확인하는 메인 화면',
    steps: [
      { title: '접속 후 첫 화면', content: '로그인하면 자동으로 대시보드가 열립니다. 오늘 날짜 기준으로 진행 중인 작업지시 수, 대기 중인 결재 건수, 출하 예정 현황이 요약 카드로 표시됩니다.' },
      { title: '작업지시 현황 카드', content: '계획(PLANNED) · 진행중(IN_PROGRESS) · 완료(COMPLETED) 상태별 건수가 색상으로 구분됩니다. 카드를 클릭하면 해당 목록 페이지로 바로 이동합니다.' },
      { title: '결재 대기 알림', content: '사이드바 "결재함" 메뉴 옆의 숫자 배지는 1분마다 자동 갱신됩니다. 대시보드에서도 미결 결재 건수를 확인할 수 있습니다.' },
      { title: '공지 확인', content: '최근 공지사항이 상단에 표시됩니다. 클릭하면 공지/쪽지함으로 이동하여 전체 내용을 확인할 수 있습니다.' },
    ],
    tips: ['매일 출근 후 대시보드를 먼저 확인하여 당일 작업 계획을 파악하세요.', '결재 대기 건수가 있으면 즉시 처리하여 업무 흐름이 끊기지 않도록 합니다.'],
  },
  // ── 수주/발주 ──
  {
    id: 'orders', category: 'order', categoryLabel: '수주/발주', categoryColor: '#0891b2',
    Icon: ShoppingCart, title: '수주/발주 관리',
    subtitle: '현장별 프로젝트 등록부터 발주서, 견적서, 자재 발주까지 수주-발주 전 흐름 관리',
    steps: [
      { title: '현장별 프로젝트 등록', content: '메뉴 > 수주/발주 > 현장별 프로젝트에서 신규 프로젝트를 등록합니다. 현장명, 발주처, 납기일, 구조 유형을 입력하면 해당 프로젝트에 연결된 작업지시와 출하를 일괄 추적할 수 있습니다.' },
      { title: '견적서 작성', content: '견적서 등록/관리 메뉴에서 고객별 견적을 작성합니다. 제품 단가·수량·할인율을 입력하면 자동으로 합계가 계산됩니다. 저장 후 PDF 출력이 가능합니다.' },
      { title: '발주서 관리', content: '발주서 관리 메뉴에서 공급업체별 발주 현황을 확인합니다. 발주 확정 시 입고신청이 자동 생성되며, 입고 후 인수검사와 연결됩니다.' },
      { title: '수주 관리 / BOM', content: '수주 등록 시 구조 BOM을 연결하면 필요한 자재 소요량이 자동 계산됩니다. BOM은 기초등록 > BOM 관리에서 사전 등록이 필요합니다.' },
      { title: '자재 발주서', content: '생산에 필요한 원·부자재 발주서를 작성합니다. 재고 부족 품목이 자동으로 표시되어 발주 누락을 방지합니다.' },
    ],
    tips: ['프로젝트 등록 시 납기일을 정확히 입력해야 출하 일정 관리가 용이합니다.', 'BOM이 미등록된 구조의 수주는 자재 소요 계산이 되지 않으니 사전에 BOM을 등록하세요.'],
  },
  // ── 결재함 ──
  {
    id: 'approval', category: 'general', categoryLabel: '일반', categoryColor: '#64748b',
    Icon: Inbox, title: '결재함',
    subtitle: '전자결재 문서 처리 — 수신함, 기안함, 결재완료 조회',
    steps: [
      { title: '결재 대기 문서 확인', content: '결재함 메뉴를 열면 내게 배정된 미결 결재 건이 목록으로 표시됩니다. 문서 종류(이상치 보고, 자재 발주 승인 등)와 기안자, 기안일이 표시됩니다.' },
      { title: '결재 처리', content: '목록에서 문서를 클릭하면 상세 내용이 표시됩니다. 승인 / 반려 버튼을 클릭하고 의견을 입력한 후 확인을 누릅니다. 다음 결재자에게 자동으로 이관됩니다.' },
      { title: '내 기안 현황', content: '기안함 탭에서 내가 올린 결재 문서의 진행 상태를 확인할 수 있습니다. 반려된 문서는 재기안이 가능합니다.' },
      { title: '결재 라인 설정 (관리자)', content: '관리 모드 > 결재 관리 > 결재 라인 설정에서 부서별·문서 유형별 결재 순서를 설정합니다. 결재자 추가/삭제 및 순서 변경이 가능합니다.' },
    ],
    tips: ['사이드바 배지의 숫자가 0이 되도록 매일 결재를 처리해 주세요.', '반려 시 반드시 사유를 입력해야 기안자가 수정 방향을 알 수 있습니다.'],
  },
  // ── 공지/쪽지함 ──
  {
    id: 'announcements', category: 'general', categoryLabel: '일반', categoryColor: '#64748b',
    Icon: Megaphone, title: '공지 / 쪽지함',
    subtitle: '전사 공지사항 확인 및 임직원 간 쪽지 송수신',
    steps: [
      { title: '공지사항 확인', content: '공지 탭에서 최신 공지사항을 확인합니다. 중요 공지는 상단 고정 표시되며, 읽지 않은 공지는 강조 표시됩니다.' },
      { title: '쪽지 수신', content: '쪽지 탭에서 받은 쪽지를 확인합니다. 클릭하면 내용 전체가 펼쳐지며 읽음 처리됩니다.' },
      { title: '쪽지 발송', content: '쪽지 보내기 버튼을 클릭하고 수신자(이름 검색), 제목, 내용을 입력 후 발송합니다. 발송 즉시 상대방의 쪽지함에 도착합니다.' },
      { title: '공지 등록 (관리자)', content: '관리자 계정은 공지 작성 버튼이 활성화됩니다. 제목, 내용을 입력하고 중요 공지 여부를 선택한 후 등록합니다.' },
    ],
    tips: ['중요한 업무 지시는 쪽지보다 공지사항으로 등록하여 전체 공유를 권장합니다.'],
  },
  // ── TBM 안전회의 ──
  {
    id: 'tbm', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: HardHat, title: 'TBM 안전회의',
    subtitle: '작업 전 Tool Box Meeting 기록 — 참석자, 안전 지시사항, 이슈 관리',
    steps: [
      { title: 'TBM 회의 등록', content: '생산 시작 전 TBM 안전회의 메뉴에서 신규 등록 버튼을 클릭합니다. 날짜, 시간, 장소를 입력합니다.' },
      { title: '참석자 등록', content: '참석자 검색창에서 근무자 이름을 검색하여 추가합니다. 서명(전자 서명 또는 체크) 방식으로 참석을 확인합니다.' },
      { title: '안전 지시사항 입력', content: '당일 작업 내용, 위험 요소, 안전 주의사항을 입력합니다. 이전 TBM의 내용을 불러와 수정할 수도 있습니다.' },
      { title: '이슈 등록', content: '작업 중 발생한 안전 이슈나 아차사고를 이슈 탭에서 등록합니다. 조치 결과와 완료 여부를 기록합니다.' },
    ],
    tips: ['TBM은 매일 작업 시작 전 필수로 진행하고 기록하세요.', '이슈는 발생 즉시 등록하여 추후 재발 방지에 활용합니다.'],
  },
  // ── 작업지시 ──
  {
    id: 'work-orders', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: ClipboardList, title: '작업지시',
    subtitle: '일반·비인정제품·구조체·부자재·에프엔테크 작업지시 생성 및 관리',
    steps: [
      { title: '일반 작업지시 생성', content: '작업지시 > 일반 작업지시에서 신규 생성 버튼을 클릭합니다. 제품(BOM 연결), 작업 일자, 계획 수량, 담당 공정을 입력합니다. 저장하면 고유 WO 번호가 자동 채번됩니다.' },
      { title: '구조체 작업지시', content: '내화채움구조체(FI, FZ, FL, D 등) 생산을 위한 작업지시입니다. 인정구조 선택 시 BOM이 자동으로 연결되어 필요한 자재 목록이 표시됩니다.' },
      { title: '비인정제품 작업지시', content: '인증 외 제품 생산을 위한 별도 작업지시입니다. 품목·수량·고객사를 입력하며, 별도 검사 기준이 적용됩니다.' },
      { title: '조립생산일지 (J-LOT)', content: '조립 공정 완료 후 J-LOT 번호를 자동 채번합니다. 사용된 구성자재(소켓, 시트, 세라믹울, 글라스울) LOT가 연결됩니다.' },
      { title: '상태 변경', content: '작업지시 목록에서 해당 건을 클릭하면 PLANNED → IN_PROGRESS → COMPLETED 순으로 상태를 변경할 수 있습니다. 완료 시 생산 실적이 자동 집계됩니다.' },
    ],
    tips: ['작업지시 없이 공정 실행을 할 수 없으므로, 생산 전 반드시 작업지시를 먼저 등록하세요.', 'LOT 번호는 사규 C302에 따라 자동 채번되므로 수동 입력을 금지합니다.'],
  },
  // ── 공정 실행 ──
  {
    id: 'process-execution', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: Package, title: '새 공정 작업 시작 (공정 실행)',
    subtitle: '배합·압출·재단·조립 공정의 실시간 작업 시작·일시정지·완료 처리',
    steps: [
      { title: '새 공정 작업 시작', content: '공정 실행 메뉴에서 "새 공정 작업 시작" 버튼을 클릭합니다. 작업지시 선택 드롭다운에는 PLANNED 또는 IN_PROGRESS 상태의 작업지시만 표시됩니다.' },
      { title: '공정 코드 선택', content: '작업지시를 선택하면 해당 WO의 공정 코드(MIX/EXT/CUT/ASM)가 자동 설정됩니다. 담당 작업자와 교대(오전/오후/야간)를 선택합니다.' },
      { title: '배합(MIX) 투입 원료 확인', content: '배합 공정 선택 시 투입 원료 LOT 정보가 자동으로 표시됩니다. 부족 표시(빨간색)가 있는 원료는 입고 처리 후 진행합니다.' },
      { title: '작업 시작/일시정지/완료', content: '카드의 [시작] 버튼을 누르면 타이머가 시작됩니다. 휴식·자재부족·장비고장 시 [일시정지]를 누르고 사유를 선택합니다. 작업 완료 시 [완료] 버튼을 눌러 생산 수량을 입력합니다.' },
      { title: '불량 등록', content: '완료 처리 시 불량 수량이 있으면 불량 유형(외관/치수/기능 불량 등)을 선택하여 함께 등록합니다. 자동으로 불량/폐기 메뉴에 기록됩니다.' },
    ],
    tips: ['작업 시작 전 반드시 작업지시를 먼저 확인하고 투입 LOT 재고를 점검하세요.', '배합 완료 시 중량 계량값(weighed_input, weighed_output)을 반드시 입력하여 로스율을 관리합니다.'],
  },
  // ── 통합 재고 관리 ──
  {
    id: 'inventory', category: 'inventory', categoryLabel: '재고관리', categoryColor: '#9333ea',
    Icon: Boxes, title: '통합 재고 관리',
    subtitle: '원자재·반제품·완제품 재고 현황 조회, LOT 추적, 랙 로케이션 관리',
    steps: [
      { title: '원자재 통합 재고현황', content: '원자재 통합 재고관리 메뉴에서 현재 보유 중인 원자재 LOT별 재고 수량을 확인합니다. 입고일, 공급업체, LOT 번호, 현재 수량이 표시됩니다.' },
      { title: '랙 로케이션 관리', content: '창고 내 랙 위치별 보관 현황을 시각적으로 확인합니다. 각 팔레트 슬롯에 어떤 LOT가 보관 중인지 표시되며, 위치 이동 처리도 가능합니다.' },
      { title: '바코드 스캔 WMS', content: '바코드 스캐너로 LOT 라벨을 스캔하면 해당 재고 정보가 즉시 조회됩니다. 입고·출고·위치 이동 처리를 스캔 방식으로 신속하게 처리합니다.' },
      { title: '비인정 재고 관리', content: '인증 외 제품 또는 반품 재고를 별도 관리합니다. 입고 등록, 위치 지정, 출고 처리를 일반 재고와 동일하게 수행합니다.' },
      { title: '수불대장 엑셀 연동', content: '외부 엑셀 파일(이카운트 등)로 관리하던 수불 데이터를 시스템으로 가져옵니다. 양식에 맞춰 작성된 엑셀 파일을 업로드하면 자동으로 데이터가 임포트됩니다.' },
      { title: '월말 실사/마감', content: '월말에 실사 수량을 입력하여 시스템 재고와 실물 재고를 대사합니다. 차이 발생 시 조정 입력 후 마감 처리합니다.' },
    ],
    tips: ['LOT 라벨이 없는 자재는 반드시 라벨 출력 후 부착하세요.', '재고 이동 시 반드시 시스템에도 위치 이동을 등록해야 로케이션 현황이 정확해집니다.'],
  },
  // ── 인수검사 ──
  {
    id: 'inspection', category: 'quality', categoryLabel: '품질관리', categoryColor: '#16a34a',
    Icon: ShieldCheck, title: '인수검사 관리',
    subtitle: '원재료·부자재·소켓/브라켓 입고 시 품질 검사 기록 및 합격/불합격 판정',
    steps: [
      { title: '원재료 인수검사 (D101~D104)', content: '세라믹울(CW), 난연컴파운드(MB) 등 원재료 입고 시 검사 성적서를 기반으로 인수검사를 수행합니다. n1/n2/n3 실측값을 입력하면 자동으로 합격/불합격이 판정됩니다.' },
      { title: '측정값 입력 규칙', content: '버니어캘리퍼스 사용 항목은 소수점 2자리(0.01mm), 줄자 사용 항목은 정수(mm)로 입력합니다. 자릿수를 초과하면 저장이 차단됩니다.' },
      { title: '범위 이탈 경고', content: '검사 기준(min~max)을 벗어난 값 입력 시 경고 모달이 표시됩니다. 사유를 입력하면 이상치(is_outlier=true)로 저장되고 품질책임자 결재함에 자동 보고됩니다.' },
      { title: '소켓·브라켓 인수검사', content: '소켓 입고 시 외관·치수 검사를 수행합니다. 검사 합격 LOT만 이후 공정에서 투입 가능합니다.' },
      { title: 'LOT 채번', content: '인수검사 완료 시 LOT 번호가 자동 채번됩니다 (예: 251025MB001). 규격: YYMMDD + 약호 + 순번 3자리.' },
    ],
    tips: ['반복값(n1=n2=n3 동일)은 경고가 표시됩니다. 실제 측정 후 각각 다른 값을 입력하세요.', '검사 소급 입력은 금지되어 있습니다. 입고 즉시 검사를 진행하세요.'],
  },
  // ── 배합 공정 ──
  {
    id: 'mix', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: FlaskConical, title: '배합 공정 (MIX)',
    subtitle: '차열시트 원료 배합 작업 — LOT 채번, 투입량 기록, 중량 계량',
    steps: [
      { title: '배합 LOT 채번', content: '배합 작업 시작 시 LOT 번호가 자동 채번됩니다. 형식: YYMMDD-S작업지시순번 (예: 251010-S01).' },
      { title: '투입 원료 LOT 선택', content: '인수검사에서 합격 처리된 LOT만 투입 가능합니다. 각 원료별로 투입 LOT를 선택하고 실투입량(kg)을 입력합니다.' },
      { title: '중량 계량 입력', content: '배합 전 원료 총 투입 중량과 배합 후 시트 산출 중량을 계량하여 입력합니다. 로스량(투입-산출)이 자동 계산됩니다.' },
      { title: '배합 완료 처리', content: '작업 완료 후 [완료] 버튼을 눌러 생산 수량을 입력합니다. 배합 LOT는 이후 압출(EXT)·재단(CUT) 공정에 그대로 상속됩니다.' },
    ],
    tips: ['배합 LOT는 압출·재단 공정에서 동일하게 사용됩니다. 별도 채번하지 않습니다.', '배합 기록부(공정 일지)는 작업 당일 반드시 등록하세요.'],
  },
  // ── 압출 공정 ──
  {
    id: 'ext', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: Layers, title: '압출 공정 (EXT)',
    subtitle: '차열시트 압출 작업 — 배합 LOT 계승, 치수 실측 기록',
    steps: [
      { title: '배합 LOT 상속', content: '압출 공정 작업지시에는 배합 LOT가 자동으로 연결됩니다. 별도 LOT를 채번하지 않고 배합 LOT를 그대로 사용합니다.' },
      { title: '중간검사 시편 측정', content: 'C-701 기준에 따라 압출 시편의 두께·폭을 버니어캘리퍼스로 측정하고 입력합니다. 기준 범위를 벗어나면 경고가 표시됩니다.' },
      { title: '투입량 및 산출량 기록', content: '투입 배합물 중량(kg)과 산출된 시트 수량(m)을 입력합니다. KG→M 환산이 자동으로 계산됩니다.' },
    ],
    tips: ['압출 속도와 온도 이상 발생 시 즉시 작업을 중단하고 공정 이슈로 등록하세요.'],
  },
  // ── 재단 공정 ──
  {
    id: 'cut', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: Scissors, title: '재단 공정 (CUT)',
    subtitle: '차열시트 규격 절단 — 세라믹울 LOT 필수 입력, 치수 실측',
    steps: [
      { title: '투입 LOT 확인', content: '압출 공정에서 상속된 배합 LOT와 세라믹울 LOT(CW LOT)를 반드시 입력합니다. 세라믹울 LOT 미입력 시 저장이 차단됩니다.' },
      { title: '치수 실측 입력', content: '재단된 시트의 두께, 폭, 길이를 버니어캘리퍼스(소수점 2자리)로 측정하여 입력합니다. 규격 기준(예: 두께 4.75~5.25mm)을 벗어나면 경고가 표시됩니다.' },
      { title: '재단 완료 처리', content: '작업 완료 후 재단 수량을 입력합니다. 규격별 수량이 재고로 자동 반영됩니다.' },
    ],
    tips: ['세라믹울 LOT는 필수 입력 항목입니다. 입력 없이는 저장이 되지 않습니다.'],
  },
  // ── 부자재 입고 ──
  {
    id: 'sub-material', category: 'inventory', categoryLabel: '재고관리', categoryColor: '#9333ea',
    Icon: Box, title: '부자재 입고/검사',
    subtitle: '소켓·브라켓·글라스울 등 부자재 입고 및 인수검사 처리',
    steps: [
      { title: '부자재 입고 등록', content: 'FN테크 연동 메뉴에서 에프엔테크 납품 부자재의 입고를 등록합니다. 품목, 수량, 공급업체, 납품일자를 입력합니다.' },
      { title: '소켓·브라켓 인수검사', content: '소켓/브라켓류 인수검사 메뉴에서 외관 및 치수 검사를 수행합니다. 검사 합격 시에만 생산 투입이 가능합니다.' },
      { title: '부자재 입출고 등록', content: '창고에서 부자재를 꺼낼 때(출고), 반납할 때(입고) 수동으로 입출고를 등록합니다. LOT 단위로 관리됩니다.' },
    ],
    tips: ['글라스울 LOT는 조립 공정에서 필수 입력 항목입니다. 입고 즉시 LOT 등록을 완료하세요.'],
  },
  // ── 조립 공정 ──
  {
    id: 'asm', category: 'production', categoryLabel: '생산관리', categoryColor: '#2563eb',
    Icon: Hammer, title: '조립 공정 (ASM)',
    subtitle: '방화플래싱·금속소켓 조립 — 구성자재 LOT 연결, J-LOT 자동채번',
    steps: [
      { title: '구성자재 LOT 입력', content: '조립에 사용되는 소켓 LOT, 차열시트 LOT, 세라믹울 LOT, 글라스울 LOT를 모두 입력합니다. 하나라도 미입력 시 저장이 차단됩니다.' },
      { title: 'J-LOT 자동 채번', content: '조립 완료 시 J-LOT 번호가 자동 채번됩니다. 형식: J+YYMMDD+제품약호+순번 (예: J251010FI01).' },
      { title: '중간검사 (C-701)', content: '조립 완료 후 중간검사를 수행합니다. 치수·외관·기능 항목을 확인하고 결과를 입력합니다.' },
      { title: '구조명 입력', content: '조립 구조명(예: FI-100, FZ-100)은 필수 입력 항목입니다. 기초등록 > 인정구조 관리에서 등록된 구조만 선택 가능합니다.' },
      { title: '계보 자동 기록', content: '조립 완료 시 원자재(세라믹울·글라스울·소켓)부터 완제품까지의 LOT 계보가 lot_lineage 테이블에 자동 기록됩니다.' },
    ],
    tips: ['글라스울 LOT·소켓 LOT는 모두 인수검사 합격 LOT만 사용 가능합니다.', 'J-LOT는 출하 시 품질관리서에 인쇄되는 중요 번호입니다. 임의 수정 불가합니다.'],
  },
  // ── 출하 ──
  {
    id: 'shipment', category: 'shipment', categoryLabel: '출하관리', categoryColor: '#ea580c',
    Icon: Truck, title: '출하 관리',
    subtitle: '출하 지시서 작성, 최종검사, 품질관리서 발행, 거래명세서 관리',
    steps: [
      { title: '출하대기현황 확인', content: '출하대기현황 메뉴에서 검사 완료 후 출하 가능한 LOT 목록을 확인합니다. 미검사 LOT는 출하가 차단됩니다.' },
      { title: '출하 입력', content: '출하입력 메뉴에서 출하 일자, 고객사, 현장, 출하 LOT를 선택합니다. C-304 출하지시서가 자동 생성됩니다.' },
      { title: '포장·출하 스캔', content: '바코드 스캐너로 출하 LOT를 스캔하여 실물 확인 후 출하를 확정합니다. 스캔 누락된 LOT는 출하 처리가 되지 않습니다.' },
      { title: '품질관리서 발행', content: '출하 확정 후 품질관리서를 발행합니다. 관리번호 형식: EZ1+생산년(2자리)+월일(4자리)+출고순서(3자리) (예: EZ1241201001).' },
      { title: '거래명세서 관리', content: '발행된 거래명세서 목록을 조회하고 PDF로 출력합니다. 고객사·기간별 필터가 가능합니다.' },
      { title: '반품 입고', content: '고객사 반품 발생 시 반품입고 메뉴에서 반품 내용을 등록합니다. 원인 조사 후 재작업 또는 폐기 처리를 진행합니다.' },
    ],
    tips: ['미검사 LOT는 시스템에서 출하를 차단합니다. 반드시 완제품 검사(C-901)를 먼저 완료하세요.', '출하 후 LOT 추적 메뉴에서 출하 LOT의 원자재까지 역추적이 가능합니다.'],
  },
  // ── LOT 추적 ──
  {
    id: 'lot-trace', category: 'quality', categoryLabel: '품질관리', categoryColor: '#16a34a',
    Icon: Monitor, title: 'LOT 추적 / 현황판',
    subtitle: '완제품 LOT에서 원자재까지 7단계 역추적 및 생산 현황 실시간 모니터링',
    steps: [
      { title: 'LOT 역추적', content: 'LOT 추적 메뉴에서 완제품 J-LOT 또는 품질관리서 번호를 입력하면 7단계 추적이 수행됩니다: 품질관리서 → 완제품 LOT → 조립 LOT → 재단 LOT → 배합 LOT → 원자재 인수검사 LOT → 공급업체 성적서.' },
      { title: '통합 LOT Matrix', content: '현장별·제품별로 생산된 전체 LOT의 공정 진행 상황을 매트릭스 형태로 한눈에 확인합니다.' },
      { title: '생산 현황', content: '실시간으로 진행 중인 공정과 완료된 공정 수량을 모니터링합니다. 공정별 달성률과 불량율이 표시됩니다.' },
      { title: '불량/폐기 조회', content: '발생한 불량 이력과 폐기 처리된 LOT를 조회합니다. 불량 유형별 통계로 반복 불량을 파악할 수 있습니다.' },
    ],
    tips: ['공장 심사 시 LOT 추적 메뉴를 통해 바로 역추적 증빙을 제시할 수 있습니다.', '계보 데이터가 없는(끊긴) LOT는 정합성 오류입니다. 공정 이력을 소급 보완하세요.'],
  },
  // ── 기초등록 ──
  {
    id: 'master', category: 'system', categoryLabel: '시스템', categoryColor: '#0891b2',
    Icon: Database, title: '기초등록',
    subtitle: '품목·거래처·인정구조·BOM 마스터 데이터 등록 및 관리',
    steps: [
      { title: '품목 등록/관리', content: '제품·원자재·부자재의 품목 코드, 품목명, 규격, 단위, 카테고리를 등록합니다. BOM 및 발주서에서 참조되는 기본 데이터입니다.' },
      { title: '거래처 관리', content: '고객사·공급업체 정보(회사명, 담당자, 연락처, 주소)를 등록합니다. 수주·발주·출하 서류에서 자동으로 연결됩니다.' },
      { title: '인정구조 관리', content: 'KFI 등 인증기관의 인정을 받은 구조 정보를 등록합니다. 인정번호, 유효기간, 구조 유형(FI/FZ/FL/D 등)을 관리합니다. 만료 임박 구조는 경고가 표시됩니다.' },
      { title: 'BOM 관리', content: '제품별로 필요한 자재 목록과 소요량을 등록합니다. 작업지시 생성 시 BOM을 기반으로 자재 소요가 자동 계산됩니다.' },
    ],
    tips: ['기초등록 데이터는 시스템 전체에서 참조됩니다. 변경 시 영향 범위를 꼭 확인하세요.', '인정구조 유효기간이 만료된 구조로 생산하면 인증 효력이 없습니다. 주기적으로 확인하세요.'],
  },
  // ── 회계 관리 ──
  {
    id: 'accounting', category: 'system', categoryLabel: '시스템', categoryColor: '#0891b2',
    Icon: TrendingUp, title: '회계 관리',
    subtitle: '매출·원가·손익 현황 분석 (매니저 이상 접근)',
    steps: [
      { title: '기초데이터 설정', content: '원가 계산에 필요한 노무비 단가, 간접비율, 원자재 구매 단가를 등록합니다. 월별로 갱신 가능합니다.' },
      { title: '매출 현황', content: '기간별·고객사별 매출 현황을 조회합니다. 출하 데이터와 연동되어 자동 집계됩니다.' },
      { title: '원가 현황', content: '제품별 재료비·노무비·간접비 구성과 총 원가를 확인합니다. BOM 기반으로 자동 계산됩니다.' },
      { title: '손익 분석', content: '매출에서 원가를 차감한 손익 현황을 월별·제품별로 분석합니다. 차트로 추이를 시각화합니다.' },
    ],
    tips: ['원가 계산의 정확도는 BOM 소요량과 구매 단가 데이터의 정확성에 달려 있습니다.', '이 메뉴는 매니저 이상 권한에서만 접근 가능합니다.'],
  },
  // ── 설정 ──
  {
    id: 'settings', category: 'system', categoryLabel: '시스템', categoryColor: '#0891b2',
    Icon: Settings, title: '설정 (관리자 전용)',
    subtitle: '사용자·부서·권한 관리, 로그인 기록, ERP 연동, 백업',
    steps: [
      { title: '사용자 관리', content: '시스템 사용자(근무자) 계정을 등록·수정·비활성화합니다. 이름, 부서, 역할(worker/manager/admin), 초기 비밀번호를 설정합니다.' },
      { title: '권한 관리', content: '사용자 또는 부서별로 각 메뉴의 읽기/쓰기 권한을 세밀하게 설정합니다. allowed_modes로 실무/관리 모드 접근을 제어할 수 있습니다.' },
      { title: '로그인 기록', content: '누가, 언제, 어디서(IP) 로그인했는지 기록을 조회합니다. 비정상 접속 여부를 모니터링할 수 있습니다.' },
      { title: '이카운트 ERP 연동', content: '이카운트 ERP와 데이터를 동기화합니다. 재고·수발주 데이터의 이중 입력을 제거합니다 (중기 과제).' },
      { title: '백업 / 초기화', content: '시스템 데이터를 백업하거나 테스트 데이터를 초기화합니다. 초기화는 슈퍼관리자만 가능하며 복구가 불가능하므로 주의가 필요합니다.' },
    ],
    tips: ['계정 비밀번호는 최초 로그인 후 반드시 변경하도록 안내하세요.', '권한 변경 후에는 해당 사용자가 재로그인해야 변경 사항이 적용됩니다.'],
  },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'general', label: '일반' },
  { value: 'order', label: '수주/발주' },
  { value: 'production', label: '생산관리' },
  { value: 'quality', label: '품질관리' },
  { value: 'inventory', label: '재고관리' },
  { value: 'shipment', label: '출하관리' },
  { value: 'system', label: '시스템' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: '#64748b', order: '#0891b2', production: '#2563eb',
  quality: '#16a34a', inventory: '#9333ea', shipment: '#ea580c', system: '#0891b2',
};

// ── ManualTab ────────────────────────────────────────────────────────────────
function ManualTab() {
  const [searchQ, setSearchQ] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = MANUAL_DATA.filter((m) => {
    const matchCat = selectedCat === 'all' || m.category === selectedCat;
    const matchQ = !searchQ.trim() ||
      m.title.includes(searchQ) ||
      m.subtitle.includes(searchQ) ||
      m.steps.some(s => s.title.includes(searchQ) || s.content.includes(searchQ));
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-4">
      {/* 검색 + 카테고리 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="메뉴명 또는 내용 검색..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedCat(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selectedCat === opt.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 결과 수 */}
      <p className="text-xs text-gray-500">총 {filtered.length}개 메뉴 매뉴얼</p>

      {/* 아코디언 카드 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
            검색 결과가 없습니다.
          </div>
        )}
        {filtered.map((m) => {
          const isOpen = openId === m.id;
          const Icon = m.Icon;
          const catColor = CATEGORY_COLORS[m.category] || '#64748b';
          return (
            <div key={m.id} className={`rounded-xl border transition-all overflow-hidden ${isOpen ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
              <button
                onClick={() => setOpenId(isOpen ? null : m.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: catColor + '18', border: `1px solid ${catColor}40` }}>
                  <Icon className="h-5 w-5" style={{ color: catColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900">{m.title}</span>
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ background: catColor }}>
                      {m.categoryLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{m.subtitle}</p>
                </div>
                <div className="flex-shrink-0 text-gray-400">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-4 space-y-4">
                  {/* 개요 */}
                  <p className="text-sm text-gray-700 leading-relaxed">{m.subtitle}</p>

                  {/* 단계별 사용법 */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📋 사용 방법</h4>
                    <div className="space-y-2">
                      {m.steps.map((step, i) => (
                        <div key={i} className="flex gap-3 rounded-lg bg-white border border-gray-200 p-3">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: catColor }}>
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-800 mb-0.5">{step.title}</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{step.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 주의사항/팁 */}
                  {m.tips && m.tips.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <h4 className="text-xs font-bold text-amber-700 mb-1.5">⚠️ 주의사항 / 팁</h4>
                      <ul className="space-y-1">
                        {m.tips.map((tip, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-amber-800">
                            <span className="flex-shrink-0">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FAQTab ────────────────────────────────────────────────────────────────────
function FaqTab({ isAdmin }: { isAdmin: boolean }) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [newFaq, setNewFaq] = useState({ category: 'general', question: '', answer: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Faq[] }>('/support/faqs');
      setFaqs(res.data ?? []);
    } catch {
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  const handleAdd = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/support/faqs', newFaq);
      toast.success('FAQ가 등록되었습니다.');
      setNewFaq({ category: 'general', question: '', answer: '' });
      setShowAddForm(false);
      loadFaqs();
    } catch {
      toast.error('등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/support/faqs/${id}`);
      toast.success('삭제되었습니다.');
      loadFaqs();
    } catch {
      toast.error('삭제 실패');
    }
  };

  const filtered = faqs.filter(f =>
    !searchQ.trim() || f.question.includes(searchQ) || f.answer.includes(searchQ)
  );

  const FAQ_CATEGORY_LABELS: Record<string, string> = {
    general: '일반', production: '생산관리', quality: '품질관리',
    inventory: '재고관리', shipment: '출하관리', system: '시스템',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="질문 또는 답변 검색..."
            className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> FAQ 추가
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {isAdmin && showAddForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-800">새 FAQ 등록</h3>
          <select value={newFaq.category} onChange={e => setNewFaq({ ...newFaq, category: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {Object.entries(FAQ_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={newFaq.question} onChange={e => setNewFaq({ ...newFaq, question: e.target.value })}
            placeholder="질문을 입력하세요" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <textarea value={newFaq.answer} onChange={e => setNewFaq({ ...newFaq, answer: e.target.value })}
            rows={3} placeholder="답변을 입력하세요"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '등록'}
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          {faqs.length === 0 ? '등록된 FAQ가 없습니다. 관리자가 추가할 수 있습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((faq) => (
            <div key={faq.id} className={`rounded-xl border transition-all ${openId === faq.id ? 'border-blue-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
              <button onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="flex w-full items-center gap-3 p-4 text-left">
                <HelpCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <span className="flex-1 text-sm font-medium text-gray-800">{faq.question}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">
                    {FAQ_CATEGORY_LABELS[faq.category] || faq.category}
                  </span>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); handleDelete(faq.id); }}
                      className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {openId === faq.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
              {openId === faq.id && (
                <div className="border-t border-gray-100 bg-blue-50 px-4 py-3">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                  <p className="mt-2 text-[10px] text-gray-400">{fmtDate(faq.created_at)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── InquiryTab ────────────────────────────────────────────────────────────────
function InquiryTab({ isAdmin }: { isAdmin: boolean }) {
  const [inquiries, setInquiries] = useState<PublicInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PublicInquiry[] }>('/announcements/public-inquiries');
      setInquiries(res.data ?? []);
    } catch { setInquiries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAdmin) loadInquiries(); }, [isAdmin, loadInquiries]);

  const handleRead = async (id: number) => {
    try {
      await api.patch(`/announcements/public-inquiries/${id}/read`, {});
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
      toast.success('읽음 처리되었습니다.');
    } catch { toast.error('처리 실패'); }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">문의내역은 관리자만 조회할 수 있습니다.</p>
        <p className="text-xs text-gray-400 mt-1">문의는 로그인 페이지 하단 "관리자에게 문의" 버튼을 이용하세요.</p>
      </div>
    );
  }

  const filtered = inquiries.filter(i => filter === 'all' ? true : filter === 'unread' ? !i.is_read : i.is_read);
  const unreadCount = inquiries.filter(i => !i.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
              }`}>
              {f === 'all' ? `전체 (${inquiries.length})` : f === 'unread' ? `미확인 (${unreadCount})` : '확인완료'}
            </button>
          ))}
        </div>
        <button onClick={loadInquiries} className="ml-auto text-gray-400 hover:text-gray-600">
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">문의가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inq => (
            <div key={inq.id}
              className={`rounded-xl border p-4 transition-all ${inq.is_read ? 'border-gray-200 bg-white' : 'border-orange-200 bg-orange-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {inq.is_read ? <MailOpen className="h-4 w-4 text-gray-400" /> : <Mail className="h-4 w-4 text-orange-500" />}
                  <span className="text-sm font-semibold text-gray-800">{inq.sender_name}</span>
                  {inq.sender_contact && <span className="text-xs text-gray-500">{inq.sender_contact}</span>}
                  {!inq.is_read && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">NEW</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400">{fmtDate(inq.created_at)}</span>
                  {!inq.is_read && (
                    <button onClick={() => handleRead(inq.id)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                      <Eye className="h-3 w-3" /> 읽음
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed pl-6">{inq.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main SupportPage ──────────────────────────────────────────────────────────
const TABS = [
  { key: 'manual', label: '메뉴얼', Icon: BookOpen },
  { key: 'faq', label: 'QnA·FAQ', Icon: HelpCircle },
  { key: 'inquiry', label: '문의내역', Icon: MessageSquare },
] as const;

export default function SupportPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'manual' | 'faq' | 'inquiry'>('manual');

  return (
    <div className="min-h-full bg-gray-50">
      {/* 히어로 배너 */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-2">
            <HeadphonesIcon className="h-7 w-7 text-orange-400" />
            <h1 className="text-2xl font-bold text-white">고객센터</h1>
          </div>
          <p className="text-slate-300 text-sm">EZONE MES 메뉴얼, 자주 묻는 질문, 문의 내역을 확인하세요.</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="mx-auto max-w-5xl flex gap-0">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition-all ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="mx-auto max-w-5xl px-6 py-6">
        {activeTab === 'manual' && <ManualTab />}
        {activeTab === 'faq' && <FaqTab isAdmin={isAdmin} />}
        {activeTab === 'inquiry' && <InquiryTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
