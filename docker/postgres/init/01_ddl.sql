-- ================================================
-- EZONE MES Database Schema (11 Tables)
-- 설계서 2장 기반 - v4 Final
-- ================================================

-- 1. 인정구조 마스터 (13종)
CREATE TABLE certification_master (
    cert_id              SERIAL PRIMARY KEY,
    cert_number          VARCHAR(30) UNIQUE NOT NULL,
    product_group        VARCHAR(10) NOT NULL CHECK (product_group IN ('MP','BD','NP')),
    structure_name       VARCHAR(60) NOT NULL,
    structure_code       VARCHAR(20) NOT NULL,
    install_position     VARCHAR(20) NOT NULL CHECK (install_position IN ('수직벽체','수평바닥')),
    fire_rating          VARCHAR(20),
    socket_name          VARCHAR(20),
    cert_area_sqmm       INTEGER,
    opening_w_mm         INTEGER,
    opening_h_mm         INTEGER,
    penetration_w_mm     INTEGER,
    penetration_h_mm     INTEGER,
    gap_limit_mm         INTEGER,
    gap_direction        VARCHAR(5) DEFAULT 'MAX',
    install_qty          INTEGER DEFAULT 1,
    sheet_thickness_min  NUMERIC(3,1),
    sheet_thickness_prod NUMERIC(3,1),
    cw_density_min       INTEGER,
    cw_density_prod      INTEGER,
    cert_version         VARCHAR(10),
    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 품목 마스터 (RM/SM/SA/FP 총 37종)
CREATE TABLE item_master (
    item_id              SERIAL PRIMARY KEY,
    item_code            VARCHAR(20) UNIQUE NOT NULL,
    item_name            VARCHAR(80) NOT NULL,
    item_category        VARCHAR(5) NOT NULL CHECK (item_category IN ('RM','SM','SA','FP')),
    item_subcategory     VARCHAR(20),
    spec                 VARCHAR(100),
    unit                 VARCHAR(10) NOT NULL,
    cert_min_density     NUMERIC(6,2),
    cert_min_thickness   NUMERIC(4,1),
    cert_min_mass        NUMERIC(8,1),
    production_value     NUMERIC(8,2),
    tolerance_plus       NUMERIC(4,1),
    value_direction      VARCHAR(5) CHECK (value_direction IN ('MIN','MAX')),
    safety_stock         NUMERIC(10,2) DEFAULT 0,
    is_active            BOOLEAN DEFAULT TRUE,
    -- KS/비규격 분류 및 공인성적서 관리 (2026.03.30 추가)
    ks_type              VARCHAR(10) DEFAULT 'NON_KS' CHECK (ks_type IN ('KS','NON_KS','KS_PROC')),
    ks_number            VARCHAR(40),        -- KS 규격번호 (예: KS D 3030, KS L 9102)
    insp_form_code       VARCHAR(20),        -- 인수검사 양식코드 (예: D121-2)
    insp_spec_ref        VARCHAR(60),        -- 적용사규 (예: EZC-D-121 Rev3)
    cert_test_items      TEXT,               -- 공인시험 항목 (예: '항복강도,인장강도')
    cert_test_cycle      VARCHAR(20) DEFAULT '1회/년', -- 공인시험 주기
    -- 롤 자재 환산 정보
    roll_length_m        NUMERIC(8,2),       -- 롤당 길이(M)
    roll_spec            VARCHAR(100)        -- 롤 규격 설명
);

-- 2-1. 공인시험성적서 관리 (제조사+로트별 성적서 보유 현황 추적)
CREATE TABLE cert_document (
    cert_doc_id          SERIAL PRIMARY KEY,
    item_id              INTEGER REFERENCES item_master(item_id),
    supplier_name        VARCHAR(100),       -- 제조사명
    supplier_lot         VARCHAR(50),        -- 제조사 로트번호 (NULL이면 품목 전체 적용)
    test_institution     VARCHAR(100) NOT NULL, -- 공인시험기관 (예: KCL, KTR, FITI, Koptri)
    cert_number          VARCHAR(50),        -- 성적서 번호
    issued_date          DATE NOT NULL,      -- 발행일
    expiry_date          DATE NOT NULL,      -- 만료일 (발행일+1년)
    test_items           TEXT,               -- 시험항목 (예: '항복강도 276 N/mm², 인장강도 358 N/mm²')
    test_results         TEXT,               -- 시험결과 상세
    is_valid             BOOLEAN DEFAULT TRUE,
    remarks              TEXT,
    file_path            VARCHAR(500),       -- 성적서 파일 경로
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cert_doc_item ON cert_document(item_id);
CREATE INDEX idx_cert_doc_expiry ON cert_document(expiry_date);
CREATE INDEX idx_cert_doc_supplier ON cert_document(supplier_name, supplier_lot);

-- 3. BOM 마스터 (구조별 구성자재)
CREATE TABLE bom_master (
    bom_id               SERIAL PRIMARY KEY,
    cert_id              INTEGER NOT NULL REFERENCES certification_master(cert_id),
    component_name       VARCHAR(40) NOT NULL,
    item_id              INTEGER REFERENCES item_master(item_id),
    qty_per_unit         NUMERIC(6,2) NOT NULL,
    spec_detail          TEXT,
    is_applicable        BOOLEAN DEFAULT TRUE,
    sort_order           INTEGER
);

-- ===================================================
-- BOM 계층구조 테이블 (2026.03.30 BOM 재설계)
-- ===================================================

-- structure_bom: 구조 → 출하 구성품 그룹 (Level 0→1)
CREATE TABLE structure_bom (
    sbom_id          SERIAL PRIMARY KEY,
    cert_id          INTEGER NOT NULL REFERENCES certification_master(cert_id),
    group_code       VARCHAR(30) NOT NULL,
    group_name       VARCHAR(60) NOT NULL,
    group_type       VARCHAR(20) NOT NULL CHECK (group_type IN ('SOCKET','FLASHING','GAP_SHEET','SUPPORT','SEALANT','FIXING','OTHER')),
    source_type      VARCHAR(15) NOT NULL CHECK (source_type IN ('PURCHASE','MANUFACTURE')),
    output_item_id   INTEGER REFERENCES item_master(item_id),
    qty_formula      TEXT,
    qty_fixed        NUMERIC(8,2),
    is_dimension_based BOOLEAN DEFAULT true,
    sort_order       INTEGER DEFAULT 0,
    is_active        BOOLEAN DEFAULT true,
    remarks          TEXT
);
CREATE INDEX idx_structure_bom_cert ON structure_bom(cert_id);

-- product_bom: 완제품 → 구성 자재 (Level 1→2)
CREATE TABLE product_bom (
    pbom_id          SERIAL PRIMARY KEY,
    sbom_id          INTEGER NOT NULL REFERENCES structure_bom(sbom_id) ON DELETE CASCADE,
    item_id          INTEGER NOT NULL REFERENCES item_master(item_id),
    component_name   VARCHAR(100) NOT NULL,
    component_type   VARCHAR(30) NOT NULL CHECK (component_type IN (
        'SOCKET_BODY','SHEET_INTERIOR','SHEET_EXTERIOR','CERAMIC_EXT','BRACKET_GI',
        'SHEET','BRACKET','INSULATION','SEALANT','GAP_SHEET','FIXING','OTHER'
    )),
    source_type      VARCHAR(15) NOT NULL CHECK (source_type IN ('PURCHASE','MANUFACTURE')),
    qty_formula      TEXT,
    qty_fixed        NUMERIC(8,2),
    length_formula   TEXT,
    unit             VARCHAR(10) NOT NULL DEFAULT 'EA',
    sort_order       INTEGER DEFAULT 0,
    is_active        BOOLEAN DEFAULT true,
    spec_detail      TEXT
);
CREATE INDEX idx_product_bom_sbom ON product_bom(sbom_id);

-- 4. 인정기준 규칙 (면적/틈새/두께/밀도 등)
CREATE TABLE certification_rule (
    rule_id              SERIAL PRIMARY KEY,
    cert_id              INTEGER NOT NULL REFERENCES certification_master(cert_id),
    rule_type            VARCHAR(15) NOT NULL CHECK (rule_type IN ('AREA','GAP','PIPE','THICKNESS','DENSITY','MASS','LENGTH','WIDTH')),
    cert_value           NUMERIC(12,2) NOT NULL,
    direction            VARCHAR(5) NOT NULL CHECK (direction IN ('MAX','MIN')),
    production_value     NUMERIC(12,2),
    tolerance_plus       NUMERIC(6,2),
    unit                 VARCHAR(10),
    description          TEXT
);

-- 5. 작업지시 (MIX/EXT/CUT/ASM/SHP 5공정 통합)
CREATE TABLE work_order (
    wo_id                SERIAL PRIMARY KEY,
    wo_number            VARCHAR(25) UNIQUE,
    wo_date              DATE NOT NULL,
    process_code         VARCHAR(5) NOT NULL CHECK (process_code IN ('MIX','EXT','CUT','ASM','SHP')),
    product_type         VARCHAR(5),
    cut_subtype          VARCHAR(10),
    install_type         VARCHAR(5),
    cert_id              INTEGER REFERENCES certification_master(cert_id),
    order_id             INTEGER,
    item_id              INTEGER REFERENCES item_master(item_id),
    planned_qty          NUMERIC(10,2),
    actual_qty           NUMERIC(10,2),
    status               VARCHAR(12) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','HOLD')),
    equipment_id         VARCHAR(15),
    manager_id           INTEGER,
    am_worker            VARCHAR(50),
    pm_worker            VARCHAR(50),
    night_worker         VARCHAR(50),
    inspector            VARCHAR(30),
    start_time           TIME,
    end_time             TIME,
    downtime_minutes     INTEGER,
    downtime_reason      TEXT,
    production_length_m  NUMERIC(8,2),
    input_weight_kg      NUMERIC(8,2),
    scrap_kg             NUMERIC(8,2),
    serial_number        INTEGER,
    purpose              VARCHAR(50),
    spec_detail          VARCHAR(100),
    customer_name        VARCHAR(200),
    lot_number           VARCHAR(50),
    input_lot_numbers    TEXT,
    bom_version          VARCHAR(20),
    remarks              TEXT,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LOT 거래 (자재~출하 LOT 라이프사이클)
CREATE TABLE lot_transaction (
    lot_id               SERIAL PRIMARY KEY,
    lot_number           VARCHAR(100) UNIQUE NOT NULL,
    lot_type             VARCHAR(5) NOT NULL CHECK (lot_type IN ('IN','MIX','EXT','CUT','ASM','GI','CW','SS','GW','OUT')),
    item_id              INTEGER REFERENCES item_master(item_id),
    wo_id                INTEGER REFERENCES work_order(wo_id),
    qty                  NUMERIC(10,2) NOT NULL,
    unit                 VARCHAR(10),
    supplier_lot         VARCHAR(30),
    inspection_lot       VARCHAR(30),
    inspection_result    VARCHAR(10) CHECK (inspection_result IN ('PASS','FAIL','PENDING')),
    cert_compliant       BOOLEAN,
    status               VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CONSUMED','SHIPPED','SCRAPPED')),
    remaining_qty        NUMERIC(10,2),
    location             VARCHAR(20),
    serial_start         INTEGER DEFAULT NULL,
    serial_end           INTEGER DEFAULT NULL,
    base_lot             VARCHAR(100) DEFAULT NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LOT 계보 (부모-자식 추적, WITH RECURSIVE 핵심)
CREATE TABLE lot_genealogy (
    genealogy_id         SERIAL PRIMARY KEY,
    parent_lot_id        INTEGER NOT NULL REFERENCES lot_transaction(lot_id),
    child_lot_id         INTEGER NOT NULL REFERENCES lot_transaction(lot_id),
    consumed_qty         NUMERIC(10,2),
    component_position   VARCHAR(30),
    UNIQUE(parent_lot_id, child_lot_id)
);

-- 8. 재고 수불 (FRM-071~074 대체)
CREATE TABLE inventory_transaction (
    inv_id               SERIAL PRIMARY KEY,
    item_id              INTEGER NOT NULL REFERENCES item_master(item_id),
    lot_id               INTEGER REFERENCES lot_transaction(lot_id),
    txn_type             VARCHAR(5) NOT NULL CHECK (txn_type IN ('IN','OUT','ADJ')),
    txn_date             DATE NOT NULL,
    qty                  NUMERIC(10,2) NOT NULL,
    balance              NUMERIC(10,2),
    purpose              VARCHAR(50),
    ref_wo_id            INTEGER REFERENCES work_order(wo_id),
    ref_lot_number       VARCHAR(50),
    worker               VARCHAR(30),
    confirmed_by         VARCHAR(30),
    source_lot           VARCHAR(100),
    linked_lot           VARCHAR(100),
    issuer_name          VARCHAR(100),
    verifier_name        VARCHAR(100),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 검사 헤더 (인수/공정/최종)
CREATE TABLE inspection (
    insp_id              SERIAL PRIMARY KEY,
    insp_type            VARCHAR(10) NOT NULL CHECK (insp_type IN ('INCOMING','PROCESS','FINAL')),
    form_code            VARCHAR(20),
    wo_id                INTEGER REFERENCES work_order(wo_id),
    lot_id               INTEGER REFERENCES lot_transaction(lot_id),
    cert_id              INTEGER REFERENCES certification_master(cert_id),
    sampling_n           INTEGER DEFAULT 3,
    accept_c             INTEGER DEFAULT 0,
    result               VARCHAR(10) CHECK (result IN ('PASS','FAIL','PENDING')),
    inspector            VARCHAR(30),
    inspected_at         TIMESTAMPTZ,
    shipped_at           DATE,
    remarks              TEXT,
    -- 공인성적서 연결 (2026.03.30 추가)
    cert_doc_id          INTEGER REFERENCES cert_document(cert_doc_id),
    ks_verified          BOOLEAN DEFAULT FALSE,  -- KS 여부 확인 완료
    cert_doc_verified    BOOLEAN DEFAULT FALSE   -- 공인성적서 보유 확인 완료
);

-- 10. 검사 상세 (n1/n2/n3 측정값)
CREATE TABLE inspection_detail (
    detail_id            SERIAL PRIMARY KEY,
    insp_id              INTEGER NOT NULL REFERENCES inspection(insp_id),
    item_no              INTEGER,
    quality_item         VARCHAR(30),
    check_item           VARCHAR(40),
    check_method         VARCHAR(20),
    cert_standard        NUMERIC(10,2),
    prod_standard        NUMERIC(10,2),
    measured_n1          NUMERIC(10,2),
    measured_n2          NUMERIC(10,2),
    measured_n3          NUMERIC(10,2),
    unit                 VARCHAR(20),
    is_applicable        BOOLEAN DEFAULT TRUE,
    item_result          VARCHAR(10) CHECK (item_result IN ('PASS','FAIL','NA')),
    direction            VARCHAR(5) DEFAULT 'MIN' CHECK (direction IN ('MIN','MAX'))
);

-- 11. 자주검사 (공정 자체 검사)
CREATE TABLE self_inspection (
    self_insp_id         SERIAL PRIMARY KEY,
    wo_id                INTEGER NOT NULL REFERENCES work_order(wo_id),
    check_time           TIMESTAMPTZ NOT NULL,
    check_category       VARCHAR(15) NOT NULL CHECK (check_category IN ('TEMP','DIM','VISUAL','FILM')),
    check_point          VARCHAR(30),
    standard_value       NUMERIC(10,2),
    tolerance            NUMERIC(6,2),
    measured_value       NUMERIC(10,2),
    is_ok                BOOLEAN,
    worker               VARCHAR(30),
    remarks              TEXT
);

-- 12. 첨부파일 (검사/작업지시/LOT/출하 연결)
CREATE TABLE IF NOT EXISTS attachment (
    att_id               SERIAL PRIMARY KEY,
    ref_type             VARCHAR(20) NOT NULL,  -- 'INSPECTION', 'WORK_ORDER', 'LOT', 'SHIPMENT'
    ref_id               INTEGER NOT NULL,
    file_name            VARCHAR(200) NOT NULL,
    file_path            VARCHAR(500) NOT NULL,
    file_size            INTEGER,
    mime_type            VARCHAR(100),
    uploaded_by          VARCHAR(50),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TBM 회의 (일일 안전교육)
CREATE TABLE IF NOT EXISTS tbm_meeting (
    tbm_id               SERIAL PRIMARY KEY,
    meeting_date         DATE NOT NULL,
    session              VARCHAR(2) NOT NULL CHECK (session IN ('AM', 'PM')),
    conductor            VARCHAR(50) NOT NULL,
    safety_topics        TEXT,
    work_topics          TEXT,
    issue_topics         TEXT,
    weather              VARCHAR(20),
    temperature          VARCHAR(10),
    remarks              TEXT,
    status               VARCHAR(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    created_at           TIMESTAMPTZ DEFAULT now(),
    completed_at         TIMESTAMPTZ,
    UNIQUE(meeting_date, session)
);

-- 14. TBM 참석자
CREATE TABLE IF NOT EXISTS tbm_attendee (
    attendee_id          SERIAL PRIMARY KEY,
    tbm_id               INTEGER NOT NULL REFERENCES tbm_meeting(tbm_id) ON DELETE CASCADE,
    worker_name          VARCHAR(50) NOT NULL,
    department           VARCHAR(50),
    is_present           BOOLEAN DEFAULT false,
    sign_time            TIMESTAMPTZ,
    remarks              VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_tbm_meeting_date ON tbm_meeting(meeting_date);
CREATE INDEX IF NOT EXISTS idx_tbm_attendee_tbm ON tbm_attendee(tbm_id);

-- 15. TBM 이슈 추적
CREATE TABLE IF NOT EXISTS tbm_issue (
    issue_id             SERIAL PRIMARY KEY,
    tbm_id               INTEGER REFERENCES tbm_meeting(tbm_id),
    title                VARCHAR(200) NOT NULL,
    description          TEXT,
    priority             VARCHAR(10) DEFAULT '보통' CHECK (priority IN ('높음', '보통', '낮음')),
    status               VARCHAR(10) DEFAULT '미해결' CHECK (status IN ('미해결', '진행중', '지연', '해결')),
    assigned_to          VARCHAR(50),
    created_at           TIMESTAMPTZ DEFAULT now(),
    resolved_at          TIMESTAMPTZ,
    resolution           TEXT,
    due_date             DATE
);

CREATE INDEX IF NOT EXISTS idx_tbm_issue_status ON tbm_issue(status);
CREATE INDEX IF NOT EXISTS idx_tbm_issue_tbm ON tbm_issue(tbm_id);

-- 16. 작업자 관리
CREATE TABLE IF NOT EXISTS worker (
    worker_id            SERIAL PRIMARY KEY,
    worker_name          VARCHAR(50) NOT NULL,
    birth_date           VARCHAR(10),
    pin_code             VARCHAR(10),
    department           VARCHAR(50),
    position             VARCHAR(50),
    role                 VARCHAR(20) DEFAULT 'worker' CHECK (role IN ('admin', 'manager', 'worker')),
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- 17. 공정 실행 로그
CREATE TABLE IF NOT EXISTS process_log (
    log_id               SERIAL PRIMARY KEY,
    wo_id                INTEGER NOT NULL REFERENCES work_order(wo_id),
    process_code         VARCHAR(5) NOT NULL,
    shift                VARCHAR(5) NOT NULL CHECK (shift IN ('AM', 'PM', 'NIGHT')),
    worker_id            INTEGER REFERENCES worker(worker_id),
    status               VARCHAR(15) DEFAULT 'READY' CHECK (status IN ('READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    planned_qty          NUMERIC(12,2),
    produced_qty         NUMERIC(12,2) DEFAULT 0,
    defect_qty           NUMERIC(12,2) DEFAULT 0,
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    remarks              TEXT,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- 18. 공정 이벤트 로그
CREATE TABLE IF NOT EXISTS process_event (
    event_id             SERIAL PRIMARY KEY,
    log_id               INTEGER NOT NULL REFERENCES process_log(log_id),
    event_type           VARCHAR(20) NOT NULL CHECK (event_type IN ('START', 'PAUSE', 'RESUME', 'COMPLETE', 'WORKER_CHANGE', 'DEFECT', 'NOTE')),
    worker_id            INTEGER REFERENCES worker(worker_id),
    reason               TEXT,
    qty_at_event         NUMERIC(12,2),
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_log_wo ON process_log(wo_id);
CREATE INDEX IF NOT EXISTS idx_process_log_worker ON process_log(worker_id);
CREATE INDEX IF NOT EXISTS idx_process_event_log ON process_event(log_id);

-- 19. 결재 라인 (어떤 문서유형에 대해 검토/승인 담당자 지정)
CREATE TABLE IF NOT EXISTS approval_line (
    line_id              SERIAL PRIMARY KEY,
    doc_type             VARCHAR(30) NOT NULL CHECK (doc_type IN (
      'INCOMING_INSP', 'PROCESS_INSP', 'SELF_INSP', 'SHIPMENT', 'WORK_ORDER', 'DAILY_LOG', 'TBM', 'INVENTORY', 'PURCHASE_REQUEST'
    )),
    line_name            VARCHAR(100),
    reviewer_id          INTEGER REFERENCES worker(worker_id),
    approver_id          INTEGER REFERENCES worker(worker_id),
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- 20. 결재 요청 (개별 문서의 결재 상태 추적)
CREATE TABLE IF NOT EXISTS approval (
    approval_id          SERIAL PRIMARY KEY,
    doc_type             VARCHAR(30) NOT NULL,
    doc_id               INTEGER NOT NULL,
    doc_title            VARCHAR(200),
    doc_summary          TEXT,
    status               VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'PENDING_APPROVE', 'APPROVED', 'REJECTED', 'RETURNED')),
    writer_id            INTEGER REFERENCES worker(worker_id),
    reviewer_id          INTEGER REFERENCES worker(worker_id),
    approver_id          INTEGER REFERENCES worker(worker_id),
    reviewed_at          TIMESTAMPTZ,
    review_comment       TEXT,
    approved_at          TIMESTAMPTZ,
    approve_comment      TEXT,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_status ON approval(status);
CREATE INDEX IF NOT EXISTS idx_approval_reviewer ON approval(reviewer_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_approver ON approval(approver_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_writer ON approval(writer_id);
CREATE INDEX IF NOT EXISTS idx_approval_doc ON approval(doc_type, doc_id);

-- Seed workers
INSERT INTO worker (worker_name, pin_code, department, position) VALUES
    ('김철수', '1234', '생산팀', '반장'),
    ('이영희', '5678', '생산팀', '조장'),
    ('박민수', '9012', '품질팀', '검사원'),
    ('정수현', '3456', '생산팀', '작업자'),
    ('최동원', '7890', '생산팀', '작업자')
ON CONFLICT DO NOTHING;
