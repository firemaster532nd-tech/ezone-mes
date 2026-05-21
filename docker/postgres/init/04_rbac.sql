-- ================================================
-- EZONE MES RBAC Schema (이카운트 ERP 스타일)
-- 2-Track 권한: 부서별 기본 + 개인별 오버라이드
-- 2026.05 추가
-- ================================================

-- ──────────────────────────────────────────────
-- 1. 부서 (조직도)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS department (
    dept_id        SERIAL PRIMARY KEY,
    dept_code      VARCHAR(20) UNIQUE NOT NULL,
    dept_name      VARCHAR(60) NOT NULL,
    parent_dept_id INTEGER REFERENCES department(dept_id) ON DELETE SET NULL,
    sort_order     INTEGER DEFAULT 0,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_department_parent ON department(parent_dept_id);
CREATE INDEX IF NOT EXISTS idx_department_active ON department(is_active);

-- ──────────────────────────────────────────────
-- 2. 사용자 (worker 테이블 확장 / 사번 기반)
--    기존 worker 테이블을 보완: 사번, 비번 해시, 부서 FK
-- ──────────────────────────────────────────────
ALTER TABLE worker
    ADD COLUMN IF NOT EXISTS employee_no    VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS password_hash  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS dept_id        INTEGER REFERENCES department(dept_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS email          VARCHAR(120),
    ADD COLUMN IF NOT EXISTS phone          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS must_change_pw BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_worker_employee_no ON worker(employee_no);
CREATE INDEX IF NOT EXISTS idx_worker_dept_id ON worker(dept_id);

-- ──────────────────────────────────────────────
-- 3. 메뉴 (계층 트리, 사이드바와 1:1 매핑)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu (
    menu_id        SERIAL PRIMARY KEY,
    menu_code      VARCHAR(40) UNIQUE NOT NULL,    -- 예: 'PRODUCTION_WORK_ORDERS'
    menu_name      VARCHAR(60) NOT NULL,           -- 예: '작업지시'
    parent_menu_id INTEGER REFERENCES menu(menu_id) ON DELETE CASCADE,
    path           VARCHAR(120),                   -- 라우터 경로 (예: '/production/work-orders'), 그룹 노드는 NULL
    icon           VARCHAR(40),                    -- lucide-react 아이콘명
    sort_order     INTEGER DEFAULT 0,
    is_active      BOOLEAN DEFAULT TRUE,
    is_admin_only  BOOLEAN DEFAULT FALSE,          -- TRUE면 admin role만 항상 보임
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_parent ON menu(parent_menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_path ON menu(path);

-- ──────────────────────────────────────────────
-- 4. 부서별 메뉴 권한 (Track 1)
--    각 부서가 어떤 메뉴에 대해 CRUD 권한을 갖는지
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS department_permission (
    dept_perm_id   SERIAL PRIMARY KEY,
    dept_id        INTEGER NOT NULL REFERENCES department(dept_id) ON DELETE CASCADE,
    menu_id        INTEGER NOT NULL REFERENCES menu(menu_id) ON DELETE CASCADE,
    can_read       BOOLEAN DEFAULT FALSE,
    can_write      BOOLEAN DEFAULT FALSE,    -- 신규 입력 (Create)
    can_update     BOOLEAN DEFAULT FALSE,    -- 수정 (Update)
    can_delete     BOOLEAN DEFAULT FALSE,    -- 삭제 (Delete)
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_by     INTEGER REFERENCES worker(worker_id),
    UNIQUE(dept_id, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_perm_dept ON department_permission(dept_id);
CREATE INDEX IF NOT EXISTS idx_dept_perm_menu ON department_permission(menu_id);

-- ──────────────────────────────────────────────
-- 5. 개인별 권한 오버라이드 (Track 2)
--    부서 기본 권한에서 특정 개인만 추가/제거
--    override_mode='ADD': 부서 권한에 더함 (예: 팀장에게만 단가 수정 허용)
--    override_mode='REVOKE': 부서 권한에서 뺌 (예: 신입사원은 삭제 권한 박탈)
--    override_mode='REPLACE': 부서 권한 무시하고 이 권한만 적용
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permission_override (
    override_id    SERIAL PRIMARY KEY,
    worker_id      INTEGER NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
    menu_id        INTEGER NOT NULL REFERENCES menu(menu_id) ON DELETE CASCADE,
    override_mode  VARCHAR(10) NOT NULL CHECK (override_mode IN ('ADD','REVOKE','REPLACE')),
    can_read       BOOLEAN DEFAULT FALSE,
    can_write      BOOLEAN DEFAULT FALSE,
    can_update     BOOLEAN DEFAULT FALSE,
    can_delete     BOOLEAN DEFAULT FALSE,
    reason         TEXT,
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_by     INTEGER REFERENCES worker(worker_id),
    UNIQUE(worker_id, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_user_override_worker ON user_permission_override(worker_id);
CREATE INDEX IF NOT EXISTS idx_user_override_menu ON user_permission_override(menu_id);

-- ──────────────────────────────────────────────
-- 6. Effective Permission View
--    부서 권한 + 개인 오버라이드 → 최종 권한 계산
--    프론트엔드는 이 뷰만 조회하면 됨
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW effective_permission AS
SELECT
    w.worker_id,
    m.menu_id,
    m.menu_code,
    m.path,
    -- admin role은 모든 권한 ON
    CASE WHEN w.role = 'admin' THEN TRUE
         WHEN o.override_mode = 'REPLACE' THEN COALESCE(o.can_read, FALSE)
         WHEN o.override_mode = 'REVOKE'  THEN COALESCE(dp.can_read, FALSE) AND NOT COALESCE(o.can_read, FALSE)
         WHEN o.override_mode = 'ADD'     THEN COALESCE(dp.can_read, FALSE) OR COALESCE(o.can_read, FALSE)
         ELSE COALESCE(dp.can_read, FALSE)
    END AS can_read,
    CASE WHEN w.role = 'admin' THEN TRUE
         WHEN o.override_mode = 'REPLACE' THEN COALESCE(o.can_write, FALSE)
         WHEN o.override_mode = 'REVOKE'  THEN COALESCE(dp.can_write, FALSE) AND NOT COALESCE(o.can_write, FALSE)
         WHEN o.override_mode = 'ADD'     THEN COALESCE(dp.can_write, FALSE) OR COALESCE(o.can_write, FALSE)
         ELSE COALESCE(dp.can_write, FALSE)
    END AS can_write,
    CASE WHEN w.role = 'admin' THEN TRUE
         WHEN o.override_mode = 'REPLACE' THEN COALESCE(o.can_update, FALSE)
         WHEN o.override_mode = 'REVOKE'  THEN COALESCE(dp.can_update, FALSE) AND NOT COALESCE(o.can_update, FALSE)
         WHEN o.override_mode = 'ADD'     THEN COALESCE(dp.can_update, FALSE) OR COALESCE(o.can_update, FALSE)
         ELSE COALESCE(dp.can_update, FALSE)
    END AS can_update,
    CASE WHEN w.role = 'admin' THEN TRUE
         WHEN o.override_mode = 'REPLACE' THEN COALESCE(o.can_delete, FALSE)
         WHEN o.override_mode = 'REVOKE'  THEN COALESCE(dp.can_delete, FALSE) AND NOT COALESCE(o.can_delete, FALSE)
         WHEN o.override_mode = 'ADD'     THEN COALESCE(dp.can_delete, FALSE) OR COALESCE(o.can_delete, FALSE)
         ELSE COALESCE(dp.can_delete, FALSE)
    END AS can_delete
FROM worker w
CROSS JOIN menu m
LEFT JOIN department_permission dp ON dp.dept_id = w.dept_id AND dp.menu_id = m.menu_id
LEFT JOIN user_permission_override o ON o.worker_id = w.worker_id AND o.menu_id = m.menu_id
WHERE w.is_active = TRUE AND m.is_active = TRUE;

-- ──────────────────────────────────────────────
-- 7. 로그인 시도 로그 (보안 감사)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempt (
    attempt_id     SERIAL PRIMARY KEY,
    employee_no    VARCHAR(20),
    success        BOOLEAN NOT NULL,
    ip_address     VARCHAR(45),
    user_agent     TEXT,
    failure_reason VARCHAR(50),
    attempted_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_emp ON login_attempt(employee_no, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempt_at ON login_attempt(attempted_at);

-- ──────────────────────────────────────────────
-- 8. 시드: 기본 부서 + 메뉴 + 관리자 계정
-- ──────────────────────────────────────────────
INSERT INTO department (dept_code, dept_name, sort_order) VALUES
    ('ADMIN',      '관리부',   1),
    ('PRODUCTION', '생산팀',   2),
    ('QUALITY',    '품질팀',   3),
    ('WAREHOUSE',  '자재팀',   4),
    ('SALES',      '영업팀',   5),
    ('PURCHASING', '구매팀',   6)
ON CONFLICT (dept_code) DO NOTHING;

-- 기본 메뉴 트리 (사이드바와 1:1)
INSERT INTO menu (menu_code, menu_name, path, icon, sort_order) VALUES
    ('DASHBOARD',                 '대시보드',         '/dashboard',                       'LayoutDashboard', 10),
    -- 수주/발주
    ('ORDERS',                    '수주/발주',        NULL,                               'ShoppingCart',    20),
    ('ORDERS_BOM',                '수주 관리/BOM',    '/orders',                          NULL,              21),
    ('ORDERS_PURCHASE',           '자재 발주서',      '/orders/purchase-requests',        NULL,              22),
    -- 결재
    ('APPROVAL',                  '결재 관리',        NULL,                               'Inbox',           30),
    ('APPROVAL_INBOX',            '결재함',           '/approval/inbox',                  NULL,              31),
    ('APPROVAL_LINES',            '결재 라인 설정',   '/approval/lines',                  NULL,              32),
    -- 생산
    ('PRODUCTION',                '생산관리',         NULL,                               'ClipboardList',   40),
    ('PRODUCTION_WORK_ORDERS',    '작업지시 목록',    '/production/work-orders',          NULL,              41),
    ('PRODUCTION_EXECUTION',      '공정 실행',        '/production/process-execution',    NULL,              42),
    ('PRODUCTION_DASHBOARD',      '생산 현황',        '/production/production-dashboard', NULL,              43),
    ('PRODUCTION_DAILY_LOG',      '공정일지',         '/production/daily-log',            NULL,              44),
    ('PRODUCTION_TBM',            'TBM 안전회의',     '/production/tbm',                  NULL,              45),
    -- 품질
    ('QUALITY',                   '품질관리',         NULL,                               'ShieldCheck',     50),
    ('QUALITY_INCOMING',          '인수검사',         '/quality/incoming',                NULL,              51),
    ('QUALITY_PROCESS',           '중간검사',         '/quality/process-inspection',      NULL,              52),
    ('QUALITY_SELF',              '자주검사',         '/quality/self-inspection',         NULL,              53),
    ('QUALITY_LOT_TRACE',         'LOT 추적',         '/quality/lot-trace',               NULL,              54),
    ('QUALITY_CERT_CHECK',        '인정기준 검증',    '/quality/cert-check',              NULL,              55),
    ('QUALITY_DEFECTS',           '불량/폐기',        '/quality/defects',                 NULL,              56),
    ('QUALITY_COMPLIANCE',        '미비사항 점검',    '/quality/compliance',              NULL,              57),
    -- 재고/출하
    ('INVENTORY',                 '재고/출하',        NULL,                               'ArrowRightLeft',  60),
    ('INVENTORY_DASHBOARD',       '재고 현황',        '/inventory/dashboard',             NULL,              61),
    ('INVENTORY_INITIALIZE',      '초기 재고 설정',   '/inventory/initialize',            NULL,              62),
    ('INVENTORY_CLOSING',         '월말 실사/마감',   '/inventory/closing',               NULL,              63),
    ('SHIPMENT_LIST',             '출하 목록',        '/shipment/list',                   NULL,              64),
    -- 보고서
    ('REPORTS',                   '보고서',           NULL,                               'FileText',        70),
    ('REPORTS_MAIN',              '일일/주간/월간',   '/reports',                         NULL,              71),
    ('REPORTS_LOSS',              '로스 분석',        '/reports/loss',                    NULL,              72),
    -- 마스터
    ('MASTER',                    '기초등록',         NULL,                               'Database',        80),
    ('MASTER_ITEMS',              '품목 등록/관리',   '/master/items',                    NULL,              81),
    ('MASTER_CERTS',              '인정구조 관리',    '/master/certifications',           NULL,              82),
    ('MASTER_BOM',                'BOM 관리',         '/master/bom',                      NULL,              83),
    -- 설정 (관리자 전용)
    ('SETTINGS',                  '설정',             NULL,                               'Settings',        90),
    ('SETTINGS_USERS',            '사용자 관리',      '/settings/users',                  NULL,              91),
    ('SETTINGS_DEPARTMENTS',      '부서 관리',        '/settings/departments',            NULL,              92),
    ('SETTINGS_PERMISSIONS',      '권한 관리',        '/settings/permissions',            NULL,              93),
    ('SETTINGS_BACKUP',           '백업 / 초기화',    '/settings/backup',                 NULL,              94)
ON CONFLICT (menu_code) DO NOTHING;

-- 메뉴 계층 연결 (parent_menu_id 업데이트)
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'ORDERS')
    WHERE menu_code IN ('ORDERS_BOM','ORDERS_PURCHASE');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'APPROVAL')
    WHERE menu_code IN ('APPROVAL_INBOX','APPROVAL_LINES');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'PRODUCTION')
    WHERE menu_code IN ('PRODUCTION_WORK_ORDERS','PRODUCTION_EXECUTION','PRODUCTION_DASHBOARD','PRODUCTION_DAILY_LOG','PRODUCTION_TBM');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'QUALITY')
    WHERE menu_code IN ('QUALITY_INCOMING','QUALITY_PROCESS','QUALITY_SELF','QUALITY_LOT_TRACE','QUALITY_CERT_CHECK','QUALITY_DEFECTS','QUALITY_COMPLIANCE');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'INVENTORY')
    WHERE menu_code IN ('INVENTORY_DASHBOARD','INVENTORY_INITIALIZE','INVENTORY_CLOSING','SHIPMENT_LIST');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'REPORTS')
    WHERE menu_code IN ('REPORTS_MAIN','REPORTS_LOSS');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'MASTER')
    WHERE menu_code IN ('MASTER_ITEMS','MASTER_CERTS','MASTER_BOM');
UPDATE menu SET parent_menu_id = (SELECT menu_id FROM menu WHERE menu_code = 'SETTINGS')
    WHERE menu_code IN ('SETTINGS_USERS','SETTINGS_DEPARTMENTS','SETTINGS_PERMISSIONS','SETTINGS_BACKUP');

-- 설정 메뉴는 관리자 전용
UPDATE menu SET is_admin_only = TRUE
    WHERE menu_code IN ('SETTINGS','SETTINGS_USERS','SETTINGS_DEPARTMENTS','SETTINGS_PERMISSIONS','SETTINGS_BACKUP','APPROVAL_LINES');

-- 기본 부서 권한: 생산팀 = 생산/품질 읽기+쓰기, 품질팀 = 품질 풀권한, 영업팀 = 수주/발주 풀권한
INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, FALSE, FALSE, FALSE
FROM department d, menu m
WHERE d.dept_code = 'PRODUCTION'
  AND m.menu_code IN ('DASHBOARD','PRODUCTION','PRODUCTION_WORK_ORDERS','PRODUCTION_EXECUTION','PRODUCTION_DASHBOARD','PRODUCTION_DAILY_LOG','PRODUCTION_TBM','QUALITY_SELF','INVENTORY_DASHBOARD','APPROVAL_INBOX')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, FALSE
FROM department d, menu m
WHERE d.dept_code = 'QUALITY'
  AND m.menu_code IN ('DASHBOARD','QUALITY','QUALITY_INCOMING','QUALITY_PROCESS','QUALITY_SELF','QUALITY_LOT_TRACE','QUALITY_CERT_CHECK','QUALITY_DEFECTS','QUALITY_COMPLIANCE','INVENTORY_DASHBOARD','APPROVAL_INBOX')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, TRUE
FROM department d, menu m
WHERE d.dept_code = 'SALES'
  AND m.menu_code IN ('DASHBOARD','ORDERS','ORDERS_BOM','ORDERS_PURCHASE','SHIPMENT_LIST','APPROVAL_INBOX','REPORTS','REPORTS_MAIN')
ON CONFLICT (dept_id, menu_id) DO NOTHING;

-- 기본 관리자 계정 (admin / admin1234 - bcrypt 해시 ($2b$10$ ...)는 백엔드 마이그레이션 스크립트에서 생성)
-- 여기서는 placeholder; 실제 해시는 백엔드 startup 시 생성하거나 별도 스크립트로 INSERT
INSERT INTO worker (worker_name, employee_no, password_hash, dept_id, role, position, is_active, must_change_pw)
SELECT '시스템 관리자', 'admin', NULL, dept_id, 'admin', '시스템 관리자', TRUE, TRUE
FROM department WHERE dept_code = 'ADMIN'
ON CONFLICT DO NOTHING;
