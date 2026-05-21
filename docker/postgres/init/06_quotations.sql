-- ========================================================
-- EZONE MES Database Schema Extension (Quotations & Projects)
-- ========================================================

-- 1. 현장 프로젝트 마스터 (Project Master)
CREATE TABLE IF NOT EXISTS project_master (
    project_id          SERIAL PRIMARY KEY,
    project_code        VARCHAR(50) UNIQUE NOT NULL,      -- 프로젝트 고유코드 (PJ-YYYYMMDD-SEQ)
    project_name        VARCHAR(300) NOT NULL,            -- 현장명
    customer_name       VARCHAR(200),                     -- 납품업체 / 시공사
    order_date          DATE NOT NULL DEFAULT CURRENT_DATE, -- 발주일자
    delivery_date       DATE,                             -- 출하예정일 / 납기일
    status              VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'SUSPENDED')),
    remarks             TEXT,                             -- 비고
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 sales_order 테이블에 project_id 컬럼 추가 (외래키)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_order' AND column_name='project_id') THEN
        ALTER TABLE sales_order ADD COLUMN project_id INTEGER REFERENCES project_master(project_id);
    END IF;
END $$;

-- 2. 견적서 마스터 (Quotation Master)
CREATE TABLE IF NOT EXISTS quotation_master (
    quotation_id        SERIAL PRIMARY KEY,
    quotation_number    VARCHAR(50) UNIQUE NOT NULL,      -- 견적서 일련번호 (QT-YYYYMMDD-SEQ)
    quotation_date      DATE NOT NULL,                    -- 견적일자
    customer_id         INTEGER NOT NULL REFERENCES company_master(company_id), -- 거래처
    project_code        VARCHAR(100),                     -- 프로젝트코드
    manager_name        VARCHAR(100),                     -- 담당자
    warehouse_id        VARCHAR(50),                      -- 출하창고
    tax_type            VARCHAR(50) DEFAULT 'TAX_INCLUDED', -- 거래유형 (부가세 포함, 영세 등)
    currency            VARCHAR(20) DEFAULT 'KRW',        -- 통화
    price_type          VARCHAR(50) DEFAULT 'DEFAULT',    -- 단가유형
    delivery_date       DATE,                             -- 납기일
    attachment_path     VARCHAR(300),                     -- 첨부파일 경로
    remarks             TEXT,                             -- 비고
    status              VARCHAR(20) DEFAULT '진행중' CHECK (status IN ('진행중', '주문완료', '취소')),
    total_qty           NUMERIC(12,2) DEFAULT 0,
    total_amount        NUMERIC(12,2) DEFAULT 0,
    total_vat           NUMERIC(12,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 견적서 상세 내역 품목 (Quotation Items)
CREATE TABLE IF NOT EXISTS quotation_item (
    quotation_item_id   SERIAL PRIMARY KEY,
    quotation_id        INTEGER NOT NULL REFERENCES quotation_master(quotation_id) ON DELETE CASCADE,
    item_code           VARCHAR(50) NOT NULL,            -- 품목코드
    item_name           VARCHAR(200) NOT NULL,            -- 품목명
    spec                VARCHAR(100),                     -- 규격
    qty                 NUMERIC(12,2) NOT NULL,           -- 수량
    unit_price          NUMERIC(12,2) DEFAULT 0,          -- 단가
    amount              NUMERIC(12,2) DEFAULT 0,          -- 공급가액
    vat                 NUMERIC(12,2) DEFAULT 0,          -- 부가세
    remarks             VARCHAR(200),                     -- 비고 / 적요
    sort_order          INTEGER DEFAULT 0
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_project_date ON project_master(order_date);
CREATE INDEX IF NOT EXISTS idx_quotation_customer ON quotation_master(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_date ON quotation_master(quotation_date);

-- 4. 신규 메뉴 등록 (견적서 2종 + 프로젝트 마스터 + 작업지시 ➔ 총 5종)
INSERT INTO menu (menu_code, menu_name, path, parent_menu_id, sort_order) VALUES
('ORDERS_QUOTATIONS', '견적서 현황/조회', '/orders/quotations', (SELECT menu_id FROM menu WHERE menu_code = 'ORDERS'), 23),
('ORDERS_UNORDERED', '미주문현황 조회', '/orders/unordered', (SELECT menu_id FROM menu WHERE menu_code = 'ORDERS'), 24),
('MASTER_PROJECTS', '프로젝트 관리', '/master/projects', (SELECT menu_id FROM menu WHERE menu_code = 'MASTER'), 85),
('PRODUCTION_PROJECT_WO', '프로젝트별 작업지시', '/production/project-work-orders', (SELECT menu_id FROM menu WHERE menu_code = 'PRODUCTION'), 46),
('QUALITY_PROJECT_LOT', 'LOT 세부내역 통합', '/quality/project-lot-matrix', (SELECT menu_id FROM menu WHERE menu_code = 'QUALITY'), 57)
ON CONFLICT (menu_code) DO NOTHING;

-- 기본 권한 할당 (영업팀, 관리부 등 필요한 부서에 풀권한 할당)
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, TRUE
FROM department d, menu m
WHERE d.dept_code IN ('SALES', 'ADMIN')
  AND m.menu_code IN ('ORDERS_QUOTATIONS', 'ORDERS_UNORDERED', 'MASTER_PROJECTS', 'PRODUCTION_PROJECT_WO', 'QUALITY_PROJECT_LOT')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

-- 품질팀(QUALITY), 생산팀(PRODUCTION), 자재팀(WAREHOUSE)에게 조회(can_read) 권한 및 일부 특수 권한 부여
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, FALSE, FALSE, FALSE
FROM department d, menu m
WHERE d.dept_code IN ('QUALITY', 'PRODUCTION', 'WAREHOUSE')
  AND m.menu_code IN ('ORDERS_QUOTATIONS', 'ORDERS_UNORDERED', 'MASTER_PROJECTS', 'PRODUCTION_PROJECT_WO', 'QUALITY_PROJECT_LOT')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

-- 생산팀에게는 프로젝트별 작업지시의 쓰기/수정 권한 추가 부여 (현장별 작업지시서 생성 및 수정 필요)
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, FALSE
FROM department d, menu m
WHERE d.dept_code = 'PRODUCTION'
  AND m.menu_code = 'PRODUCTION_PROJECT_WO'
ON CONFLICT (dept_id, menu_id) DO UPDATE 
SET can_write = TRUE, can_update = TRUE;
