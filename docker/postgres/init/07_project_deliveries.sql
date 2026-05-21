-- ========================================================
-- EZONE MES Database Schema Extension (E-Count Client UI & Deliveries)
-- ========================================================

-- 1. company_master 테이블 확장 (이카운트 거래처 정보 대응)
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS corporate_no VARCHAR(50);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS code_type VARCHAR(30) DEFAULT 'BUSINESS_NO'; -- BUSINESS_NO, NON_BUSINESS_DOMESTIC, NON_BUSINESS_FOREIGN
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS tax_reporting_type VARCHAR(30) DEFAULT 'SAME_AS_CODE'; -- SAME_AS_CODE, SEARCH, DIRECT
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS tax_reporting_code VARCHAR(50);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sub_biz_no VARCHAR(20);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS zipcode1 VARCHAR(20);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS address1 VARCHAR(300);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS zipcode2 VARCHAR(20);
ALTER TABLE company_master ADD COLUMN IF NOT EXISTS address2 VARCHAR(300);

-- 거래 구분 체크 제약조건 리뉴얼 (DISTRIBUTOR 유통업체 추가)
ALTER TABLE company_master DROP CONSTRAINT IF EXISTS company_master_company_type_check;
ALTER TABLE company_master ADD CONSTRAINT company_master_company_type_check 
CHECK (company_type IN ('CUSTOMER', 'VENDOR', 'BOTH', 'DISTRIBUTOR'));

-- 2. project_master 테이블 확장 (유통업체 참조 관계)
ALTER TABLE project_master ADD COLUMN IF NOT EXISTS distributor_id INTEGER REFERENCES company_master(company_id) ON DELETE SET NULL;
ALTER TABLE project_master ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE project_master ADD COLUMN IF NOT EXISTS ceo_name VARCHAR(100);
ALTER TABLE project_master ADD COLUMN IF NOT EXISTS corporate_no VARCHAR(50);

-- 3. 순차적 납기 일정 테이블 신설 (1:N)
CREATE TABLE IF NOT EXISTS project_delivery_schedule (
    schedule_id         SERIAL PRIMARY KEY,
    project_id          INTEGER NOT NULL REFERENCES project_master(project_id) ON DELETE CASCADE,
    delivery_date       DATE NOT NULL,
    delivery_qty        INTEGER NOT NULL DEFAULT 0,
    remarks             VARCHAR(500),
    seq                 INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 보강
CREATE INDEX IF NOT EXISTS idx_delivery_schedule_project ON project_delivery_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_delivery_schedule_date ON project_delivery_schedule(delivery_date);
