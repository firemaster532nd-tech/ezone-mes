-- ========================================================
-- EZONE MES Database Schema Extension (Company & Statements)
-- ========================================================

-- 1. 거래처 마스터 관리 (Company Master)
CREATE TABLE IF NOT EXISTS company_master (
    company_id          SERIAL PRIMARY KEY,
    company_code        VARCHAR(50) UNIQUE NOT NULL,      -- 사업자등록번호 또는 고유코드
    company_name        VARCHAR(200) NOT NULL,            -- 거래처명
    ceo_name            VARCHAR(100),                     -- 대표자명
    phone               VARCHAR(50),                      -- 전화번호
    mobile              VARCHAR(50),                      -- 휴대전화
    fax                 VARCHAR(50),                      -- 팩스번호
    email               VARCHAR(100),                     -- 이메일
    address             VARCHAR(300),                     -- 주소
    business_type       VARCHAR(100),                     -- 업태
    business_item       VARCHAR(100),                     -- 종목
    company_type        VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (company_type IN ('CUSTOMER', 'VENDOR', 'BOTH')), -- 매출처/매입처/기타
    is_active           BOOLEAN DEFAULT TRUE,             -- 사용여부 (YES/NO)
    remarks             TEXT,                             -- 적요/메모
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 거래명세서 마스터 (Transaction Statement Master)
CREATE TABLE IF NOT EXISTS transaction_statement (
    statement_id        SERIAL PRIMARY KEY,
    statement_number    VARCHAR(50) UNIQUE NOT NULL,      -- 거래명세서 일련번호 (TX-YYYYMMDD-SEQ)
    statement_date      DATE NOT NULL,                    -- 거래일자
    order_id            INTEGER,                          -- 수주 연동 (sales_order 외래키 대신 레거시 대응 위해 일반 INTEGER로 유지)
    customer_id         INTEGER NOT NULL REFERENCES company_master(company_id),       -- 공급받는자 거래처

    -- 공급자 정보 (이지원 주식회사 기본값 설정)
    supplier_name       VARCHAR(100) DEFAULT '(주)이지원',
    supplier_ceo        VARCHAR(50) DEFAULT '박민선',
    supplier_no         VARCHAR(50) DEFAULT '232-88-00624',
    supplier_addr       VARCHAR(300) DEFAULT '경기도 화성시 장안면 장안로227번길 166-18',
    supplier_phone      VARCHAR(50) DEFAULT '070-8870-0300',

    total_qty           NUMERIC(12,2) DEFAULT 0,
    total_amount        NUMERIC(12,2) DEFAULT 0,
    total_vat           NUMERIC(12,2) DEFAULT 0,
    remarks             TEXT,                             -- 비고
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 거래명세서 상세 내역 품목 (Transaction Statement Items)
CREATE TABLE IF NOT EXISTS transaction_statement_item (
    statement_item_id   SERIAL PRIMARY KEY,
    statement_id        INTEGER NOT NULL REFERENCES transaction_statement(statement_id) ON DELETE CASCADE,
    item_name           VARCHAR(200) NOT NULL,            -- 품목명
    spec                VARCHAR(100),                     -- 규격
    unit                VARCHAR(10) DEFAULT 'EA',         -- 단위
    qty                 NUMERIC(12,2) NOT NULL,           -- 수량
    unit_price          NUMERIC(12,2) DEFAULT 0,          -- 단가
    amount              NUMERIC(12,2) DEFAULT 0,          -- 공급가액
    vat                 NUMERIC(12,2) DEFAULT 0,          -- 부가세
    remarks             VARCHAR(200),                     -- 비고
    sort_order          INTEGER DEFAULT 0
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_statement_customer ON transaction_statement(customer_id);
CREATE INDEX IF NOT EXISTS idx_statement_date ON transaction_statement(statement_date);

-- 4. 초기 거래처 시드 데이터 삽입
INSERT INTO company_master (company_code, company_name, ceo_name, phone, company_type, address, business_type, business_item)
VALUES 
('232-88-00624', '웰스홈 주식회사', '박민선', '02-6959-2460', 'CUSTOMER', '서울특별시 은평구 통일로 856', '제조 및 도소매', '소방자재'),
('409-81-13318', '(주)대선소방방재산업', '박선영', '062-381-7119', 'CUSTOMER', '광주광역시 서구 상무평화로 89', '도소매', '소방설비'),
('317-82-04050', '(재)FITI시험연구원 오창분원', '김화영', '043-218-8924', 'CUSTOMER', '충청북도 청주시 청원구 오창읍 양청3길 8', '서비스', '시험분석'),
('827-82-00060', '(재)한국건설생활환경시험연구원 실화재시험장', '송재석', '043-210-8900', 'CUSTOMER', '충청북도 청주시 청원구 오창읍 양청3길 12', '서비스', '시험분석'),
('409-86-23183', '(주)대명소방산업', '차정금', '062-523-5119', 'CUSTOMER', '광주광역시 북구 설죽로 315', '제조 및 도소매', '소방자재')
ON CONFLICT (company_code) DO NOTHING;

-- 5. 신규 메뉴 등록 (거래명세서 및 거래처 관리, 수불대장 연동)
INSERT INTO menu (menu_code, menu_name, path, parent_menu_id, sort_order) VALUES
('MASTER_COMPANIES', '거래처 관리', '/master/companies', (SELECT menu_id FROM menu WHERE menu_code = 'MASTER'), 84),
('INVENTORY_STATEMENTS', '거래명세서 관리', '/shipment/statements', (SELECT menu_id FROM menu WHERE menu_code = 'INVENTORY'), 65),
('INVENTORY_IMPORT', '수불대장 엑셀 연동', '/inventory/import', (SELECT menu_id FROM menu WHERE menu_code = 'INVENTORY'), 66)
ON CONFLICT (menu_code) DO NOTHING;

-- 기본 권한 할당 (영업팀, 관리부 등 필요한 부서에 풀권한 할당)
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, TRUE
FROM department d, menu m
WHERE d.dept_code IN ('SALES', 'ADMIN')
  AND m.menu_code IN ('MASTER_COMPANIES', 'INVENTORY_STATEMENTS', 'INVENTORY_IMPORT')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

-- 품질팀(QUALITY), 생산팀(PRODUCTION), 자재팀(WAREHOUSE)에게도 조회(can_read) 권한 부여
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, FALSE, FALSE, FALSE
FROM department d, menu m
WHERE d.dept_code IN ('QUALITY', 'PRODUCTION', 'WAREHOUSE')
  AND m.menu_code IN ('MASTER_COMPANIES', 'INVENTORY_STATEMENTS', 'INVENTORY_IMPORT')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

