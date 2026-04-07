# EZONE MES (Manufacturing Execution System)

## Project Overview
소켓(방화구획관통 자재) 전문 제조기업 EZONE의 MES 시스템.
생산/품질/재고/출하 전 과정을 관리하는 웹 기반 시스템.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + React Router v6 + TanStack Query/Table
- **Backend**: Fastify (Node.js) + TypeScript + PostgreSQL (pg)
- **Shared**: packages/shared에 공통 타입 정의
- **Monorepo**: npm workspaces (packages/shared, backend, frontend)
- **Dev**: Docker Compose (db/backend/frontend) 또는 로컬 embedded-postgres

## Project Structure
```
ezone-mes/
├── backend/             # Fastify API 서버
│   └── src/
│       ├── index.ts     # 프로덕션 엔트리
│       ├── dev-server.ts # 개발 엔트리 (embedded-postgres)
│       ├── config/env.ts # 환경변수
│       ├── db/pool.ts   # PostgreSQL 커넥션 풀
│       └── routes/      # API 라우트 (32개 파일)
├── frontend/            # React SPA
│   └── src/
│       ├── main.tsx     # 앱 엔트리
│       ├── router.tsx   # 라우트 정의
│       ├── lib/api.ts   # API 클라이언트
│       ├── lib/auth.tsx # 인증 컨텍스트
│       ├── components/  # 공통 컴포넌트
│       └── pages/       # 페이지 컴포넌트
├── packages/shared/     # 공유 타입
├── docker/              # Docker 설정
│   └── postgres/init/   # DB 초기화 SQL (01_ddl, 02_indexes, 03_seed)
└── docker-compose.yml   # Docker Compose 설정
```

## Running the Project

### Docker 방식 (권장)
```bash
docker compose up
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- DB: PostgreSQL localhost:5432

### 로컬 개발 (embedded-postgres)
```bash
npm install
cd backend && npx tsx src/dev-server.ts   # 백엔드 (내장 PostgreSQL 자동 시작)
cd frontend && npx vite --host            # 프론트엔드
```

## Key Conventions
- API 엔드포인트는 모두 `/api/` 접두사 사용
- Frontend에서 `/api` 요청은 Vite proxy로 백엔드(포트 3000)로 전달
- 인증은 localStorage 기반 (worker 테이블), 역할: admin/manager/worker
- DB 스키마는 docker/postgres/init/01_ddl.sql에 정의
- 시드 데이터는 docker/postgres/init/03_seed.sql에 정의 (13개 인증구조, 37개 아이템)

## Database
- PostgreSQL 15, 한국어 로케일 (ko_KR.UTF-8)
- 주요 테이블: certification_master, item_master, bom_master, work_order, lot_transaction, inventory_transaction, inspection, self_inspection, process_inspection 등
- BOM 계층구조 지원 (구조별 BOM)

## Modules
1. **대시보드** - 생산 현황 요약
2. **생산관리** - 작업지시, 일일실적, 공정실행, TBM, 생산현황
3. **재고관리** - 재고현황, 초기재고, 재고마감
4. **품질관리** - 수입검사, 공정검사, 자주검사, LOT추적, 인증확인, 부적합, 준수체크리스트
5. **수주/발주** - 수주BOM, 구매요청
6. **출하관리** - 출하목록, 품질성적서
7. **마스터관리** - 인증구조, 품목, BOM
8. **결재** - 결재수신함, 결재라인
9. **보고서** - 종합보고서, 로스분석
10. **설정** - 백업, 사용자관리

## When Editing
- 새 API 라우트 추가 시 backend/src/index.ts에 등록 필요
- 새 페이지 추가 시 frontend/src/router.tsx에 라우트 추가 필요
- 공통 타입은 packages/shared/src/types/에 정의
- SQL 스키마 변경 시 01_ddl.sql 업데이트
