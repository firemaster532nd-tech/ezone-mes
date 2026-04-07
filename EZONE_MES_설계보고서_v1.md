# (주)이지원 MES 시스템 상세 설계 보고서

| 항목 | 내용 |
|------|------|
| **문서번호** | EZONE-MES-DESIGN-v1 |
| **작성일** | 2026-03-29 |
| **시스템명** | EZONE MES (Manufacturing Execution System) |
| **버전** | 1.0 |
| **대상** | 방화소켓/플래싱 제조 공정 관리 |

| 작 성 | 검 토 | 승 인 |
|-------|-------|-------|
| | | |

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [기술 아키텍처](#2-기술-아키텍처)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [백엔드 API 설계](#4-백엔드-api-설계)
5. [프론트엔드 화면 설계](#5-프론트엔드-화면-설계)
6. [핵심 업무 프로세스](#6-핵심-업무-프로세스)
7. [마스터데이터 현황](#7-마스터데이터-현황)
8. [보안 및 권한 체계](#8-보안-및-권한-체계)
9. [향후 확장 계획](#9-향후-확장-계획)

---

## 1. 시스템 개요

### 1.1 목적

(주)이지원의 방화소켓 및 방화플래싱 제조 공정을 체계적으로 관리하기 위한 MES(Manufacturing Execution System)이다. 품질인정 심사 대비를 위한 완전한 추적성(Traceability)을 확보하고, 원재료 입고부터 완제품 출하까지 전 공정의 데이터를 실시간 기록 및 관리한다.

### 1.2 적용 범위

| 구분 | 내용 |
|------|------|
| **제품군** | 덕트(MP) 13종, 버스덕트(BD) 2종, 비금속배관(NP) 1종 |
| **공정** | 배합(MIX) → 압출(EXT) → 재단(CUT) → 조립(ASM) → 출하(SHP) |
| **관리 항목** | 작업지시, LOT 추적, 인수/공정/자주검사, 재고수불, 불량/폐기, 로스 분석 |
| **관련 사규** | C-701 Rev.5, C-302 Rev.8, C-601 Rev.4, D-121~D-126 |

### 1.3 시스템 규모

| 항목 | 수량 |
|------|------|
| 데이터베이스 테이블 | 32개 |
| 백엔드 API 엔드포인트 | 178개 |
| 프론트엔드 페이지 | 29개 |
| 백엔드 라우트 파일 | 28개 |
| 공유 컴포넌트 | 7개 |

---

## 2. 기술 아키텍처

### 2.1 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| **Frontend** | React + TypeScript | 18.x |
| **빌드 도구** | Vite | 5.x |
| **UI 프레임워크** | TailwindCSS + shadcn/ui | 3.x |
| **Backend** | Fastify + TypeScript | 4.x |
| **Database** | PostgreSQL | 15 |
| **런타임** | Node.js | 20.x |
| **컨테이너** | Docker Compose | - |

### 2.2 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│         React 18 + Vite + TailwindCSS           │
│              localhost:5173                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 29 Pages │ │ 7 Shared │ │ Router + Layout  │ │
│  │          │ │Components│ │ (Shop/Admin Mode)│ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────┬───────────────────────────┘
                      │ /api/* (Vite Proxy)
┌─────────────────────▼───────────────────────────┐
│                    Backend                       │
│           Fastify + TypeScript (tsx)             │
│              localhost:3000                       │
│  ┌────────────────────────────────────────────┐  │
│  │           28 Route Files                    │  │
│  │           178 API Endpoints                 │  │
│  │  (CRUD + 업무로직 + 보고서 + 승인워크플로우)   │  │
│  └────────────────────┬───────────────────────┘  │
└───────────────────────┬─────────────────────────┘
                        │ pg (node-postgres)
┌───────────────────────▼─────────────────────────┐
│                  PostgreSQL 15                    │
│           localhost:5432/ezone_mes               │
│  ┌────────────────────────────────────────────┐  │
│  │  32 Tables (DDL 20 + Dynamic 12)           │  │
│  │  마스터: 인정구조 13 + 품목 55 + BOM 20     │  │
│  │  공정BOM 9 + 인정규칙 43 + 작업자 28       │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 2.3 프로젝트 디렉토리 구조

```
ezone-mes/
├── docker-compose.yml
├── .env.example
├── package.json                      # npm workspaces
├── tsconfig.base.json
├── EZONE_MES_설계보고서_v1.md         # 본 문서
│
├── docker/postgres/init/
│   ├── 01_ddl.sql                    # 20개 핵심 테이블 DDL
│   ├── 02_indexes.sql                # 인덱스
│   └── 03_seed.sql                   # 마스터데이터 시드
│
├── backend/src/
│   ├── index.ts                      # Fastify 엔트리 (28개 라우트 등록)
│   ├── config/env.ts                 # 환경변수
│   ├── db/pool.ts                    # PostgreSQL 커넥션 풀
│   └── routes/                       # 28개 라우트 파일
│       ├── certifications.ts         # 인정구조 CRUD
│       ├── items.ts                  # 품목 CRUD
│       ├── work-orders.ts            # 작업지시 관리
│       ├── lots.ts                   # LOT 관리/추적
│       ├── inventory.ts              # 재고수불
│       ├── inventory-closing.ts      # 월말 재고실사/마감
│       ├── inspections.ts            # 인수검사
│       ├── process-inspections.ts    # 중간검사 (C-701)
│       ├── self-inspections.ts       # 자주검사
│       ├── process-execution.ts      # 공정 실행 관리
│       ├── process-bom.ts            # 공정별 BOM
│       ├── compounding.ts            # 배합 레시피
│       ├── defects.ts                # 불량/폐기 관리
│       ├── loss-analytics.ts         # 로스 분석
│       ├── lot-properties.ts         # LOT 밀도/환산
│       ├── approvals.ts              # 결재 워크플로우
│       ├── shipments.ts              # 출하 관리
│       ├── quality-reports.ts        # 품질관리서
│       ├── reports.ts                # 일일/주간/월간 보고서
│       ├── dashboard.ts              # 대시보드
│       ├── workers.ts                # 작업자 관리
│       ├── tbm.ts                    # TBM 안전회의
│       ├── cert-check.ts             # 인정기준 검증
│       ├── lot-validation.ts         # LOT 유효성 검증
│       ├── structure-lots.ts         # 구조체 LOT
│       ├── production-stats.ts       # 생산 통계
│       ├── attachments.ts            # 첨부파일
│       └── backup.ts                 # 데이터 백업
│
└── frontend/src/
    ├── router.tsx                    # 29개 라우트 정의
    ├── lib/
    │   ├── api.ts                    # Axios API 클라이언트
    │   ├── auth.tsx                  # 인증 Context
    │   └── utils.ts                  # 유틸리티
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.tsx         # 메인 레이아웃 (사이드바+헤더+콘텐츠)
    │   │   ├── AuthGuard.tsx         # 인증 가드
    │   │   └── Sidebar.tsx           # 사이드바 (실무/관리 모드)
    │   └── shared/
    │       ├── PageHeader.tsx        # 페이지 헤더
    │       ├── StatusBadge.tsx       # 상태 뱃지
    │       ├── ProcessBadge.tsx      # 공정 뱃지
    │       └── AttachmentSection.tsx  # 첨부파일 섹션
    └── pages/
        ├── DashboardPage.tsx
        ├── LoginPage.tsx
        ├── master/                   # 마스터 관리 (3)
        ├── production/               # 생산 관리 (6)
        ├── inventory/                # 재고 관리 (2)
        ├── quality/                  # 품질 관리 (7)
        ├── shipment/                 # 출하 관리 (2)
        ├── approval/                 # 결재 관리 (2)
        ├── reports/                  # 보고서 (2)
        └── settings/                 # 설정 (2)
```

---

## 3. 데이터베이스 설계

### 3.1 전체 테이블 목록 (32개)

#### 핵심 마스터 테이블 (6개)

| No | 테이블명 | 설명 | 레코드 수 |
|----|----------|------|-----------|
| 1 | certification_master | 인정구조 마스터 (MP/BD/NP) | 13건 |
| 2 | item_master | 품목 마스터 (RM/SM/SA/FP) | 55건 |
| 3 | bom_master | 인정구조별 BOM | 20건 |
| 4 | certification_rule | 인정기준 규칙 (크로스체크) | 43건 |
| 5 | process_bom | 공정별 BOM 헤더 | 9건 |
| 6 | process_bom_item | 공정별 BOM 구성품목 | 27건 |

#### 생산 관리 테이블 (6개)

| No | 테이블명 | 설명 |
|----|----------|------|
| 7 | work_order | 작업지시 (MIX/EXT/CUT/ASM/SHP) |
| 8 | process_log | 공정 실행 로그 (시작/일시정지/완료) |
| 9 | process_event | 공정 이벤트 기록 |
| 10 | compounding_recipe | 배합 레시피 |
| 11 | compounding_recipe_item | 배합 레시피 구성 원료 |
| 12 | loss_record | 공정별 로스 기록 |

#### LOT/재고 관리 테이블 (7개)

| No | 테이블명 | 설명 |
|----|----------|------|
| 13 | lot_transaction | LOT 생성/소비/추적 |
| 14 | lot_genealogy | LOT 부모-자식 계보 |
| 15 | lot_properties | LOT 밀도/두께/M환산 속성 |
| 16 | inventory_transaction | 재고 수불 (IN/OUT/ADJ/LOSS/SCRAP) |
| 17 | inventory_closing | 월말 재고 마감 헤더 |
| 18 | closing_item | 마감 실사 품목 |
| 19 | closing_adjustment | 마감 재고 조정 |

#### 품질 관리 테이블 (6개)

| No | 테이블명 | 설명 |
|----|----------|------|
| 20 | inspection | 검사 헤더 (인수/공정/최종) |
| 21 | inspection_detail | 검사 상세 (n1/n2/n3 측정값) |
| 22 | self_inspection | 자주검사 기록 |
| 23 | defect_record | 불량 기록 |
| 24 | disposal_report | 폐기 보고서 |
| 25 | process_issue | 공정 이슈 (로스 원인 추적) |

#### 업무 지원 테이블 (7개)

| No | 테이블명 | 설명 |
|----|----------|------|
| 26 | worker | 작업자 관리 (admin/manager/worker) |
| 27 | approval_line | 결재 라인 설정 |
| 28 | approval | 결재 요청/승인 |
| 29 | tbm_meeting | TBM 안전회의 |
| 30 | tbm_attendee | TBM 참석자 |
| 31 | tbm_issue | TBM 이슈 추적 |
| 32 | attachment | 첨부파일 |

### 3.2 테이블 관계도 (ER Diagram)

```
certification_master ──┬── bom_master ──── item_master
         │             │                       │
         │             └── certification_rule   │
         │                                      │
         ├── process_bom ── process_bom_item ───┘
         │        │
         │        └── process_log ──┬── process_event
         │               │         ├── loss_record
         │               │         ├── lot_properties
         │               │         ├── defect_record
         │               │         └── process_issue
         │               │
         ├── work_order ──┤
         │        │       │
         │        │       └── self_inspection
         │        │
         ├── lot_transaction ──┬── lot_genealogy
         │        │            ├── inventory_transaction
         │        │            └── inspection ── inspection_detail
         │        │
         └────────┴── inventory_closing ── closing_item
                                          closing_adjustment

worker ──┬── approval_line ── approval
         ├── process_log
         └── tbm_meeting ──┬── tbm_attendee
                           └── tbm_issue

compounding_recipe ── compounding_recipe_item ── item_master
```

### 3.3 주요 CHECK 제약조건

| 컬럼 | 허용값 | 설명 |
|------|--------|------|
| product_group | MP, BD, NP | 덕트, 버스덕트, 비금속배관 |
| item_category | RM, SM, SA, FP | 원재료, 부자재, 반제품, 완제품 |
| process_code | MIX, EXT, CUT, ASM, SHP | 5대 공정 |
| lot_type | IN, MIX, EXT, CUT, ASM, GI, CW, SS, GW, OUT | LOT 유형 10종 |
| txn_type | IN, OUT, ADJ, LOSS, SCRAP | 재고 거래 유형 5종 |
| insp_type | INCOMING, PROCESS, FINAL | 검사 유형 3종 |
| wo_status | PLANNED, IN_PROGRESS, COMPLETED, HOLD | 작업지시 상태 4종 |

---

## 4. 백엔드 API 설계

### 4.1 API 통계

| 항목 | 수량 |
|------|------|
| 총 엔드포인트 | 178개 |
| GET (조회) | 81개 |
| POST (생성) | 55개 |
| PATCH (수정) | 29개 |
| DELETE (삭제) | 13개 |
| 라우트 파일 | 28개 |

### 4.2 라우트별 엔드포인트 목록

#### 마스터 관리 (18개)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/certifications | 인정구조 목록 (product_group 필터) |
| GET | /api/certifications/:id | 인정구조 상세 + BOM + 규칙 |
| PATCH | /api/certifications/:id | 인정구조 수정 |
| GET | /api/items | 품목 목록 (category 필터, 검색) |
| GET | /api/items/:id | 품목 상세 |
| PATCH | /api/items/:id | 품목 수정 |
| GET | /api/process-bom | 공정별 BOM 목록 |
| GET | /api/process-bom/:id | 공정별 BOM 상세 |
| POST | /api/process-bom | 공정별 BOM 생성 |
| PATCH | /api/process-bom/:id | 공정별 BOM 수정 |
| DELETE | /api/process-bom/:id | 공정별 BOM 삭제 |
| POST | /api/process-bom/:id/items | BOM 품목 추가 |
| PATCH | /api/process-bom/items/:itemId | BOM 품목 수정 |
| DELETE | /api/process-bom/items/:itemId | BOM 품목 삭제 |
| GET | /api/process-bom/calculate/:bomId | BOM 소요량 계산 (FIFO 배분) |
| GET | /api/compounding/recipes | 배합 레시피 목록 |
| POST | /api/compounding/recipes | 배합 레시피 생성 |
| GET | /api/compounding/calculate | 배합 소요량 계산 |

#### 생산 관리 (22개)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/work-orders | 작업지시 목록 (공정/일자/상태 필터) |
| GET | /api/work-orders/:id | 작업지시 상세 |
| POST | /api/work-orders | 작업지시 생성 (자동 WO번호/LOT 생성) |
| PATCH | /api/work-orders/:id | 작업지시 수정 (품질게이트 체크) |
| DELETE | /api/work-orders/:id | 작업지시 삭제 (PLANNED만) |
| POST | /api/work-orders/:id/consume | 자재 소비 기록 (LOT 계보 생성) |
| GET | /api/process-logs | 공정 실행 로그 목록 |
| GET | /api/process-logs/:id | 공정 로그 상세 |
| POST | /api/process-logs | 공정 로그 생성 |
| POST | /api/process-logs/:id/start | 공정 시작 |
| POST | /api/process-logs/:id/pause | 공정 일시정지 |
| POST | /api/process-logs/:id/resume | 공정 재개 |
| POST | /api/process-logs/:id/complete | 공정 완료 |
| POST | /api/process-logs/:id/change-worker | 작업자 교대 |
| POST | /api/process-logs/:id/log-defect | 불량 기록 |
| PATCH | /api/process-logs/:id | 공정 로그 수정 (무게/로스 포함) |
| POST | /api/process-logs/:id/apply-density | 밀도 기반 KG→M 환산 적용 |
| POST | /api/loss-records | 로스 기록 생성 |
| GET | /api/loss-records | 로스 기록 목록 |
| GET | /api/production/stats | 일별 생산 통계 |
| GET | /api/production/stats/weekly | 주간 생산 요약 |

#### 품질 관리 (33개)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/inspections | 검사 목록 |
| GET | /api/inspections/:id | 검사 상세 |
| POST | /api/inspections | 검사 생성 |
| DELETE | /api/inspections/:id | 검사 삭제 |
| POST | /api/inspections/:id/auto-judge | 자동 판정 |
| PATCH | /api/inspections/:id | 검사 수정 |
| GET | /api/inspections/incoming-presets | 인수검사 양식 템플릿 |
| GET | /api/inspections/incoming-presets/:formCode | 특정 양식 상세 |
| GET | /api/process-inspections/templates | 중간검사 C-701 양식 |
| POST | /api/process-inspections | 중간검사 생성 |
| GET | /api/process-inspections | 중간검사 목록 |
| GET | /api/self-inspections | 자주검사 목록 |
| POST | /api/self-inspections | 자주검사 생성 |
| POST | /api/self-inspections/batch | 자주검사 일괄 생성 |
| PATCH | /api/self-inspections/:id | 자주검사 수정 |
| POST | /api/cert-check/verify | 인정기준 적합성 검증 |
| POST | /api/cert-check/find-applicable | 적용 가능 구조 검색 |
| POST | /api/defects | 불량 등록 |
| GET | /api/defects | 불량 목록 |
| PATCH | /api/defects/:id | 불량 수정 |
| POST | /api/disposal-reports | 폐기 보고서 생성 |
| GET | /api/disposal-reports | 폐기 보고서 목록 |
| PATCH | /api/disposal-reports/:id | 폐기 보고서 수정 (승인 포함) |
| POST | /api/process-issues | 공정 이슈 등록 |
| GET | /api/process-issues | 공정 이슈 목록 |
| PATCH | /api/process-issues/:id | 공정 이슈 수정 |
| GET | /api/process-issues/summary | 공정 이슈 요약 |
| POST | /api/lot-properties | LOT 밀도/환산 정보 등록 |
| GET | /api/lot-properties | LOT 속성 조회 |
| PATCH | /api/lot-properties/:id | LOT 속성 수정 (재계산) |
| POST | /api/lots/validate | LOT 적합성 검증 |
| GET | /api/lots/next-number | 다음 LOT번호 생성 |

#### LOT/재고 관리 (27개)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/lots | LOT 목록 |
| POST | /api/lots | LOT 수동 생성 |
| GET | /api/lots/:id/trace | LOT 역추적 (WITH RECURSIVE) |
| GET | /api/lots/:id/forward-trace | LOT 정추적 |
| GET | /api/inventory/dashboard | 재고 대시보드 (카테고리별 요약) |
| GET | /api/inventory/summary | 품목별 재고 현황 |
| GET | /api/inventory/transactions | 수불 내역 |
| POST | /api/inventory/transactions | 수불 기록 생성 |
| PATCH | /api/inventory/transactions/:id | 수불 기록 수정 |
| DELETE | /api/inventory/transactions/:id | 수불 기록 삭제 |
| GET | /api/inventory/lot-inventory | LOT별 재고 현황 |
| GET | /api/inventory/lot-transactions/:lotId | 특정 LOT 수불 내역 |
| GET | /api/inventory/ledger/:itemId | 품목별 수불대장 (잔량 자동계산) |
| POST | /api/inventory/apply-process-result | 공정 결과 재고 반영 |
| GET | /api/inventory/available-lots | 가용 LOT 목록 (FIFO) |
| GET | /api/inventory/available-lots-by-item/:itemId | 품목별 가용 LOT |
| GET | /api/inventory-closing | 월마감 목록 |
| POST | /api/inventory-closing | 월마감 생성 + 시스템 재고 스냅샷 |
| DELETE | /api/inventory-closing/:id | 월마감 삭제 |
| GET | /api/inventory-closing/:id/items | 실사 품목 목록 |
| PATCH | /api/inventory-closing/:closingId/items/:ciId | 실사 수량 입력 |
| POST | /api/inventory-closing/:closingId/items/batch-count | 일괄 실사 입력 |
| PATCH | /api/inventory-closing/:id/status | 마감 상태 변경 |
| POST | /api/inventory-closing/:closingId/adjustments | 조정 요청 |
| PATCH | /api/inventory-closing/adjustments/:adjId | 조정 승인/반려 |
| POST | /api/inventory-closing/adjustments/:adjId/apply | 승인된 조정 재고 반영 |
| GET | /api/inventory-closing/:id/report | 월말 실사 보고서 |

#### 출하/보고서/결재/기타 (78개)

출하관리, 품질관리서, 일일/주간/월간 보고서, 로스 분석 보고서, 결재 워크플로우, TBM 안전회의, 작업자 관리, 대시보드, 첨부파일, 백업 등 나머지 78개 엔드포인트.

---

## 5. 프론트엔드 화면 설계

### 5.1 네비게이션 구조 (듀얼 모드)

시스템은 **실무 모드**와 **관리 모드** 두 가지 네비게이션을 제공한다.

#### 실무 모드 (생산 흐름 순서)

```
오늘의 작업 (/dashboard)
결재함 (/approval/inbox)
────────────────────────
TBM 안전회의 (/production/tbm)
작업지시 (/production/work-orders)
────────────────────────
① 원재료 입고/검사
   ├─ 인수검사 (/quality/incoming)
   └─ 재고 현황 (/inventory/dashboard)
② 배합
   ├─ 공정 실행 (/production/process-execution)
   └─ 자주검사 (/quality/self-inspection)
③ 압출
   ├─ 공정 실행
   └─ 자주검사
④ 재단
   ├─ 공정 실행
   └─ 자주검사
⑤ 부자재 입고/검사
   ├─ 인수검사
   └─ 재고 현황
⑥ 조립
   ├─ 공정 실행
   ├─ 중간검사 C-701 (/quality/process-inspection)
   └─ 자주검사
────────────────────────
⑦ 출하
   ├─ 출하 목록 (/shipment/list)
   └─ 품질관리서
────────────────────────
현황판
   ├─ 생산 현황 (/production/production-dashboard)
   ├─ LOT 추적 (/quality/lot-trace)
   ├─ 인정기준 검증 (/quality/cert-check)
   ├─ 불량/폐기 (/quality/defects)
   ├─ 로스 분석 (/reports/loss)
   └─ 월말 실사/마감 (/inventory/closing)
```

#### 관리 모드 (기능별 분류)

```
대시보드 (/dashboard)
결재 관리
   ├─ 결재함 (/approval/inbox)
   └─ 결재 라인 설정 (/approval/lines)
보고서
   ├─ 일일/주간/월간 (/reports)
   └─ 로스 분석 (/reports/loss)
생산관리
   ├─ 작업지시 목록
   ├─ 공정 실행
   ├─ 생산 현황
   ├─ 공정일지
   └─ TBM 안전회의
품질관리
   ├─ 인수검사
   ├─ 중간검사 (C-701)
   ├─ 자주검사
   ├─ LOT 추적
   ├─ 인정기준 검증
   └─ 불량/폐기
재고/출하
   ├─ 재고 현황
   ├─ 월말 실사/마감
   ├─ 출하 목록
   └─ 품질관리서
마스터 관리
   ├─ 인정구조
   ├─ 품목관리
   └─ BOM 관리
설정
   ├─ 사용자 관리
   └─ 데이터 관리
```

### 5.2 전체 페이지 목록 (29개)

| No | 경로 | 페이지명 | 주요 기능 |
|----|------|----------|-----------|
| 1 | /login | 로그인 | 이름+생년월일 또는 PIN 인증 |
| 2 | /dashboard | 대시보드 | 오늘 작업지시, 생산실적, 검사합격률, 알림 |
| 3 | /master/certifications | 인정구조 관리 | 13종 인정구조 목록, MP/BD/NP 탭 필터 |
| 4 | /master/certifications/:id | 인정구조 상세 | BOM 테이블, 인정기준 규칙, 인라인 수정 |
| 5 | /master/items | 품목 관리 | 55건 품목, RM/SM/SA/FP 탭, 수정 다이얼로그 |
| 6 | /master/bom | BOM 관리 | 9건 공정별 BOM, 확장 행, 생성/수정 모달 |
| 7 | /production/work-orders | 작업지시 관리 | 공정별 탭, 생성 모달 (BOM 연계, 배합 소요량 계산) |
| 8 | /production/process-execution | 공정 실행 관리 | 실시간 상태 카드, 완료 모달 (무게/로스/불량/밀도) |
| 9 | /production/daily-log | 공정일지 | 일일 생산 기록 |
| 10 | /production/production-dashboard | 생산 현황 | 공정별/작업자별 KPI |
| 11 | /production/tbm | TBM 안전회의 | 회의 생성, 참석자 서명, 이슈 추적 |
| 12 | /production/tbm-print/:id | TBM 인쇄 | 인쇄용 회의록 |
| 13 | /inventory/dashboard | 재고 현황 | 카테고리별 요약 카드, LOT별 수불대장 |
| 14 | /inventory/closing | 월말 실사/마감 | 마감 생성, LOT별 실사, 조정 승인, 보고서 |
| 15 | /quality/incoming | 인수검사 | D-121~D-126 양식 기반, n1/n2/n3 측정, 자동판정 |
| 16 | /quality/process-inspection | 중간검사 (C-701) | G01~G04 통합양식, 구조별 검사항목 |
| 17 | /quality/self-inspection | 자주검사 | 온도/치수/외관/필름 프리셋, 일괄 입력 |
| 18 | /quality/lot-trace | LOT 추적 | WITH RECURSIVE 역추적/정추적 시각화 |
| 19 | /quality/cert-check | 인정기준 검증 | 현장값 입력 → 7대 규칙 적합성 자동판정 |
| 20 | /quality/defects | 불량/폐기 관리 | 불량 현황 탭, 폐기 보고서 탭 (승인 워크플로우) |
| 21 | /quality/inspection-print/:id | 검사 인쇄 | 인쇄용 검사 성적서 |
| 22 | /shipment/list | 출하관리 | 출하 등록, LOT 연결, 상태 관리 |
| 23 | /shipment/quality-report/:id | 품질관리서 | 인쇄용 종합 품질 보고서 |
| 24 | /approval/inbox | 결재함 | 대기/완료/반려 문서 목록, 승인/반려 처리 |
| 25 | /approval/lines | 결재 라인 | 문서유형별 검토자/승인자 설정 |
| 26 | /reports | 보고서 | 일일/주간/월간 생산 보고서 |
| 27 | /reports/loss | 로스 분석 | 월간 로스율, 일별 추이, 최악일 분석, 밀도 환산 비교 |
| 28 | /settings/users | 사용자 관리 | 작업자 CRUD, 역할 관리 |
| 29 | /settings/backup | 데이터 관리 | DB 백업/복원 |

---

## 6. 핵심 업무 프로세스

### 6.1 제조 공정 흐름

```
원재료 입고     배합(MIX)      압출(EXT)       재단(CUT)      조립(ASM)     출하(SHP)
    │              │              │               │              │             │
 인수검사 ──→ 작업지시 ──→ 작업지시 ──→ 작업지시 ──→ 작업지시 ──→ 출하등록
    │         배합레시피      BOM적용       BOM적용       BOM적용       │
    │         소요량계산      KG투입        KG투입        부자재투입     │
 합격→입고       │              │               │              │         품질관리서
    │         LOT생성       LOT생성        LOT생성       LOT생성         │
 LOT생성         │              │               │              │         완제품출하
    │         자주검사       자주검사        자주검사     중간검사(C-701)
    │              │              │               │              │
 재고반영      재고반영       재고반영        재고반영       재고반영
               (OUT/IN)      (OUT/IN)        (OUT/IN)       (OUT/IN)
                  │              │               │              │
              로스기록        로스기록         로스기록       불량기록
              밀도기록      밀도→M환산       실측로스율
```

### 6.2 LOT 추적 체계 (C-302 Rev.8 연동)

```
원재료 LOT (IN-YYMMDD-NNN)
    │
    ├──→ 배합 LOT (MIX-YYMMDD-NNN)
    │        │
    │        ├──→ 압출 LOT (EXT-YYMMDD-NNN)  ← 밀도 기록, KG→M 환산
    │        │        │
    │        │        ├──→ 재단 LOT (CUT-YYMMDD-NNN)  ← 실측 로스
    │        │        │        │
    │        │        │        └──→ 조립 LOT (ASM-YYMMDD-NNN)
    │        │        │                  │
    │        │        │                  └──→ 출하 LOT (OUT-YYMMDD-NNN)
    │        │        │
    │        │        └──→ [역추적] 원자재까지 WITH RECURSIVE
    │        │
    │        └──→ [정추적] 완제품까지 WITH RECURSIVE
    │
    └──→ lot_genealogy (parent_lot_id ↔ child_lot_id)
```

### 6.3 공정별 BOM 구성 (9건)

| BOM코드 | 공정 | BOM명 | 산출물 | 로스율 |
|---------|------|-------|--------|--------|
| BOM-MIX-CERT-300 | MIX | 난연컴파운드 배합 | 난연컴파운드 300kg | 0% |
| BOM-EXT-SK-5190 | EXT | 압출 차열시트 5T×190(소켓용) | 차열시트 5T×190 | 3% |
| BOM-EXT-FL-5125 | EXT | 압출 플래싱 차열시트 5T×125(I형) | 차열시트 5T×125 | 3% |
| BOM-EXT-FL-4125 | EXT | 압출 플래싱 차열시트 4T×125(I형) | 차열시트 4T×125 | 3% |
| BOM-CUT-SK | CUT | 재단 소켓용 차열시트 | 재단 소켓용(규격별) | 15% |
| BOM-CUT-FL-I | CUT | 재단 플래싱용 차열시트 I형 | 재단 플래싱 I형(규격별) | 15% |
| BOM-CUT-FL-Z | CUT | 재단 플래싱용 차열시트 Z형 | 재단 플래싱 Z형(규격별) | 15% |
| BOM-ASM-VT01 | ASM | 방화소켓 VT200 조립 | 방화소켓 VT200(VT-01) | 0% |
| BOM-SHP-FL-HTG169 | SHP | 방화플래싱 HTG-1.69 출하 | 방화플래싱 HTG-1.69 | 0% |

### 6.4 KG→M 환산 공식 (밀도 기반)

```
길이(m) = (무게_kg × 1000) / (밀도_g/cm³ × 두께_cm × 너비_cm) / 100

예시:
  투입 290kg, 밀도 1.3 g/cm³, 두께 5mm, 너비 190mm
  = (290 × 1000) / (1.3 × 0.5 × 19.0) / 100
  = 290000 / 12.35 / 100
  = 234.82 m
```

### 6.5 월말 재고 실사/마감 프로세스

```
① 월마감 생성 (마지막 생산일 기준)
   └─ 시스템 재고 LOT별 스냅샷 자동 생성
       │
② 실물 재고 실사 (현장 카운트 입력)
   ├─ 이동민 파트장 영역: 원재료(RM) + 배합/압출 재고
   └─ 임병용 파트장 영역: 재단 + 부자재 + 소켓/완제품 재고
       │
③ 차이 분석 (시스템 vs 실물)
   └─ 차이 발생 시 조정 요청
       │
④ 파트장 승인
   ├─ 이동민 → 원재료/압출 조정 승인
   └─ 임병용 → 재단/부자재/완제품 조정 승인
       │
⑤ 재고 반영 (승인된 조정만 inventory_transaction ADJ 생성)
       │
⑥ 마감 확정 (finalized)
```

### 6.6 불량/폐기 워크플로우

```
공정 완료 시 불량 등록 (defect_record)
    │
    ├─ disposition: rework (재작업)
    ├─ disposition: downgrade (등급하향)
    └─ disposition: scrap (폐기)
         │
         └─ 폐기 보고서 생성 (disposal_report)
              │
              ├─ status: draft → pending_approval
              ├─ status: pending_approval → approved (파트장 승인)
              └─ status: approved → completed (재고 SCRAP 반영)
```

---

## 7. 마스터데이터 현황

### 7.1 인정구조 마스터 (13건)

| No | 인정번호 | 구조코드 | 소켓 | 제품군 | 버전 | 두께min | CW밀도min |
|----|----------|----------|------|--------|------|---------|-----------|
| 1 | FS-MP25-0310-1 | VT-01 | VT200 | MP | 0310 | 5.0 | 120 |
| 2 | FS-MP25-0310-3 | VT-049 | VM200 | MP | 0310 | 5.0 | 120 |
| 3 | FS-MP25-0310-4 | VA-064 | VM200 | MP | 0310 | 5.0 | 120 |
| 4 | FS-MP24-0310-7 | VT-064 | VM200 | MP | 0310 | 5.0 | 120 |
| 5 | FS-MP25-0910-01 | VAG-1.69 | VTG200 | MP | 0910 | 4.0 | 96 |
| 6 | FS-MP25-0910-06 | VTI-064 | VIG200 | MP | 0910 | 4.0 | 96 |
| 7 | FS-MP25-0910-02 | HAG-1.69 | HTG300C | MP | 0910 | 4.0 | 96 |
| 8 | FS-MP25-0910-04 | HTG-1.69 | HTG300C | MP | 0910 | 4.0 | 96 |
| 9 | FS-MP25-0910-05 | HTG-064 | HMG300C | MP | 0910 | 4.0 | 96 |
| 10 | FS-MP25-0910-03 | HTG(DC)-064 | HMG300 | MP | 0910 | 4.0 | 96 |
| 11 | FS-BD25-0910-07 | EZ-BD-CV-1S | 플래싱형 | BD | 0910 | - | - |
| 12 | FS-BD25-0910-08 | EZ-BD-RV-3S | 플래싱형 | BD | 0910 | - | - |
| 13 | FS-NP24-1112-2 | EZ-FN-P100 | 일체형슬리브 | NP | NP24 | - | - |

### 7.2 품목 마스터 (55건)

| 카테고리 | 건수 | 주요 품목 |
|----------|------|-----------|
| RM (원재료) | 4건 | 난연컴파운드(PE3005MB), 팽창흑연 #50, EVA-EA33045, EP100 |
| SM (부자재) | 22건 | 강재류 I형/Z형, 볼트/너트/와셔, 실리콘, 그라스울, 세라믹울 등 |
| SA (반제품) | 10건 | 압출 차열시트(5T×190, 5T×125 등), 재단 소켓/플래싱용 |
| FP (완제품) | 19건 | 방화소켓(VT200~HMG300), 방화플래싱(I형/Z형), 발포소켓 등 |

### 7.3 작업자 (28건)

admin(관리자), manager(파트장: 이동민, 임병용), worker(현장작업자) 3단계 역할 체계.

---

## 8. 보안 및 권한 체계

### 8.1 인증 방식

| 방식 | 대상 | 설명 |
|------|------|------|
| 이름 + 생년월일 | 일반 작업자 | 현장 터치 기반 간편 로그인 |
| PIN 코드 | 관리자 | 4자리 PIN 빠른 인증 |

### 8.2 역할 기반 권한

| 역할 | 권한 |
|------|------|
| admin | 전체 시스템 관리, 사용자 관리, 데이터 백업 |
| manager | 결재 승인, 월말 실사 승인, 재고 조정 승인 |
| worker | 작업지시 실행, 검사 기록, 자주검사, 공정 데이터 입력 |

### 8.3 재고 관리 권한

| 관리 영역 | 담당 파트장 | 대상 |
|-----------|------------|------|
| RM_EXT | 이동민 파트장 | 원재료(RM) + 배합/압출(MIX/EXT) 재고 |
| CUT_SM_FP | 임병용 파트장 | 재단(CUT) + 부자재(SM) + 소켓/완제품(SA/FP) 재고 |

---

## 9. 향후 확장 계획

### 9.1 현재 완성 범위

- [x] 마스터데이터 관리 (인정구조, 품목, BOM, 인정기준)
- [x] 공정별 BOM 관리 (MIX/EXT/CUT/ASM/SHP 9건)
- [x] 작업지시 → 공정 실행 → LOT 생성 → 재고 반영 전체 흐름
- [x] 인수검사 (D-121~D-126 양식), 중간검사 (C-701), 자주검사
- [x] LOT 역추적/정추적 (WITH RECURSIVE)
- [x] 인정기준 7대 규칙 자동 검증
- [x] 재고수불 대장 (FIFO, 수불대장 형식)
- [x] 월말 재고 실사/마감 (파트장 승인 워크플로우)
- [x] 불량 관리 → 폐기 보고서 → 승인 워크플로우
- [x] 로스 분석 (일별 추이, 최악일, 공정 이슈, 자동 개선 권고)
- [x] 밀도 기반 KG→M 환산 (중간검사 밀도 연계)
- [x] 실측 로스 vs 밀도 환산 로스 비교 분석
- [x] TBM 안전회의 (참석 관리, 이슈 추적)
- [x] 결재 워크플로우 (검토→승인 2단계)
- [x] 출하관리 + 품질관리서
- [x] 일일/주간/월간 보고서
- [x] 대시보드 + 생산 현황판

### 9.2 추후 개발 예정 사항

- [ ] 바코드/QR 코드 스캔 연동 (현장 LOT 스캔)
- [ ] 이카운트 ERP 연동 (C-302 Rev.8 6.9절 전산시스템 연계)
- [ ] 설비 데이터 자동 수집 (IoT 센서 연동)
- [ ] 모바일 앱 (현장 작업자용 PWA)
- [ ] 실시간 알림 (WebSocket)
- [ ] 고급 분석 대시보드 (SPC 관리도, Cp/Cpk)

---

*--- 끝 ---*

*본 문서는 2026년 3월 29일 기준 EZONE MES 시스템 현황을 반영한 최종 설계 보고서입니다.*
