-- ============================================================
-- 마이그레이션: 인수검사 기준 시스템 (incoming_inspection_preset)
-- 적용 대상: Supabase SQL Editor에 붙여넣고 실행
-- 작성일: 2026-06-25
-- ============================================================

-- 1. 양식 마스터 테이블
CREATE TABLE IF NOT EXISTS incoming_inspection_preset (
  preset_id      SERIAL PRIMARY KEY,
  form_code      VARCHAR(20) UNIQUE NOT NULL,
  form_name      VARCHAR(200) NOT NULL,
  item_category  VARCHAR(10),
  sub_type       VARCHAR(50),
  file_path      VARCHAR(500),
  sampling_n     INT DEFAULT 3,
  accept_c       INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 검사항목 마스터 테이블
CREATE TABLE IF NOT EXISTS inspection_preset_item (
  item_id        SERIAL PRIMARY KEY,
  preset_id      INT NOT NULL REFERENCES incoming_inspection_preset(preset_id) ON DELETE CASCADE,
  seq_no         INT NOT NULL,
  quality_item   VARCHAR(100),
  check_item     VARCHAR(200) NOT NULL,
  check_method   VARCHAR(10) DEFAULT 'VISUAL',
  cert_standard  VARCHAR(300),
  prod_standard  VARCHAR(300),
  unit           VARCHAR(30),
  direction      VARCHAR(10) DEFAULT 'OK_NG',
  lower_limit    NUMERIC,
  upper_limit    NUMERIC,
  is_applicable  BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. certification_master에 file_path 컬럼 추가
ALTER TABLE certification_master ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);

-- 4. product_group 제약에 AD 추가
ALTER TABLE certification_master
  DROP CONSTRAINT IF EXISTS certification_master_product_group_check;
ALTER TABLE certification_master
  ADD CONSTRAINT certification_master_product_group_check
  CHECK (product_group = ANY(ARRAY['MP','BD','NP','AD']));

-- 5. 양식 데이터 INSERT
INSERT INTO incoming_inspection_preset
  (form_code, form_name, item_category, sub_type, file_path, sampling_n, accept_c, sort_order)
VALUES
  ('D121-2',  '방화소켓 인수검사 성적서 (벽체/GI)',           'SK', 'WALL',      '인수검사성적서/D121-2_방화소켓 인수검사 성적서(아연도금강판)-벽체.pdf', 3, 0, 10),
  ('D121-7',  '방화소켓 인수검사 성적서 (입상/GI)',           'SK', 'RISER',     '인수검사성적서/D121-7_방화소켓 인수검사 성적서(아연도금강판)-입상.pdf', 3, 0, 11),
  ('D121-10', '브라켓(평철) 인수검사 성적서 (벽체)',           'BR', 'WALL',      '인수검사성적서/D121-10_브라켓 인수검사 성적서(품질인정 1,2차).pdf',     3, 0, 20),
  ('D121-9',  '브라켓(평철) 인수검사 성적서 (입상)',           'BR', 'RISER',     '인수검사성적서/D121-9_브라켓 인수검사 성적서(입상).pdf',               3, 0, 21),
  ('D121-4',  '방화플래싱 인수검사 성적서 (아연도금강판)',       'FL', NULL,        '인수검사성적서/D121-4_방화플래싱 인수검사 성적서(아연도금강판).pdf',     3, 0, 30),
  ('D124-1',  '세라믹울 인수검사 성적서 (96K)',               'CW', '96K',       '인수검사성적서/D124-1_세라믹울 인수검사 성적서(96K)-수정.pdf',           3, 0, 40),
  ('D124-2',  '세라믹울 인수검사 성적서 (96K 가열선수축율)',    'CW', '96K-SHRINK','인수검사성적서/D124-2_세라믹울 인수검사 성적서(96K)-(가열선수축율24H).pdf', 3, 0, 41),
  ('D124-3',  '세라믹울 인수검사 성적서 (120K)',              'CW', '120K',      '인수검사성적서/D124-3_세라믹울 인수검사 성적서(120K).pdf',               3, 0, 42),
  ('D124-4',  '세라믹울 인수검사 성적서 (120K 가열선수축율)',   'CW', '120K-SHRINK','인수검사성적서/D124-4_세라믹울 인수검사 성적서(120K)-(가열선수축율24H).pdf', 3, 0, 43),
  ('D127-1',  '글라스울 인수검사 성적서',                     'GW', NULL,        '인수검사성적서/D127/D127-1_글라스울 인수검사 성적서.pdf',               3, 0, 50)
ON CONFLICT (form_code) DO NOTHING;

-- 6. 검사항목 INSERT (기존 있으면 건너뜀 — 양식 재실행 안전)
DO $$
DECLARE
  p_id INT;
BEGIN

  -- D121-2 방화소켓 벽체
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D121-2';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (변형·녹·오염·도장불량)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','소켓 폭 (W)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,3,'치수','소켓 높이 (H)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,4,'치수','소켓 깊이 (D)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,5,'재질','강판 두께','CERT','0.6mm 이상','0.6mm 이상','mm','MIN',0.6,NULL),
    (p_id,6,'도금','아연도금 부착량','CERT','275 g/m² 이상','275 g/m² 이상','g/m²','MIN',275,NULL),
    (p_id,7,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL),
    (p_id,8,'서류','LOT 번호 기재 여부','VISUAL','기재됨','기재됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D121-7 방화소켓 입상
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D121-7';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (변형·녹·오염·도장불량)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','소켓 폭 (W)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,3,'치수','소켓 높이 (H)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,4,'치수','소켓 깊이 (D)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,5,'재질','강판 두께','CERT','0.6mm 이상','0.6mm 이상','mm','MIN',0.6,NULL),
    (p_id,6,'도금','아연도금 부착량','CERT','275 g/m² 이상','275 g/m² 이상','g/m²','MIN',275,NULL),
    (p_id,7,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL),
    (p_id,8,'서류','LOT 번호 기재 여부','VISUAL','기재됨','기재됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D121-10 브라켓 벽체
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D121-10';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (변형·녹·오염)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','평철 폭 (W)','MEASURE','발주치수 ±2mm','발주치수','mm','RANGE',-2,2),
    (p_id,3,'치수','평철 두께 (T)','MEASURE','발주치수 -0/+0.5mm','발주치수','mm','RANGE',0,0.5),
    (p_id,4,'치수','평철 길이 (L)','MEASURE','발주치수 ±5mm','발주치수','mm','RANGE',-5,5),
    (p_id,5,'도금','아연도금 부착량','CERT','275 g/m² 이상','275 g/m² 이상','g/m²','MIN',275,NULL),
    (p_id,6,'강도','인장강도','CERT','400 N/mm² 이상','400 N/mm² 이상','N/mm²','MIN',400,NULL),
    (p_id,7,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL),
    (p_id,8,'서류','LOT 번호 기재 여부','VISUAL','기재됨','기재됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D121-9 브라켓 입상
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D121-9';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (변형·녹·오염)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','평철 폭 (W)','MEASURE','발주치수 ±2mm','발주치수','mm','RANGE',-2,2),
    (p_id,3,'치수','평철 두께 (T)','MEASURE','발주치수 -0/+0.5mm','발주치수','mm','RANGE',0,0.5),
    (p_id,4,'치수','평철 길이 (L)','MEASURE','발주치수 ±5mm','발주치수','mm','RANGE',-5,5),
    (p_id,5,'도금','아연도금 부착량','CERT','275 g/m² 이상','275 g/m² 이상','g/m²','MIN',275,NULL),
    (p_id,6,'강도','인장강도','CERT','400 N/mm² 이상','400 N/mm² 이상','N/mm²','MIN',400,NULL),
    (p_id,7,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL),
    (p_id,8,'서류','LOT 번호 기재 여부','VISUAL','기재됨','기재됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D121-4 방화플래싱
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D121-4';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (변형·녹·오염·절곡불량)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','두께 (T)','MEASURE','발주사양 이상','발주사양','mm','MIN',NULL,NULL),
    (p_id,3,'치수','폭 (W)','MEASURE','발주치수 ±3mm','발주치수','mm','RANGE',-3,3),
    (p_id,4,'치수','길이 (L)','MEASURE','발주치수 ±5mm','발주치수','mm','RANGE',-5,5),
    (p_id,5,'도금','아연도금 부착량','CERT','180 g/m² 이상','180 g/m² 이상','g/m²','MIN',180,NULL),
    (p_id,6,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D124-1 세라믹울 96K
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D124-1';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (파손·오염·이물질)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','두께 (T)','MEASURE','발주사양 ±5mm','발주사양','mm','RANGE',-5,5),
    (p_id,3,'치수','폭 (W)','MEASURE','발주사양 ±10mm','발주사양','mm','RANGE',-10,10),
    (p_id,4,'밀도','밀도 (실측)','CERT','96 kg/m³ 이상','96 kg/m³ 이상','kg/m³','MIN',96,NULL),
    (p_id,5,'열특성','열전도율','CERT','0.044 W/mK 이하','0.044 W/mK 이하','W/mK','MAX',NULL,0.044),
    (p_id,6,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D124-2 세라믹울 96K 수축율
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D124-2';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'열특성','가열선수축율 (1050°C × 24H)','CERT','4% 이하','4% 이하','%','MAX',NULL,4);
  END IF;

  -- D124-3 세라믹울 120K
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D124-3';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (파손·오염·이물질)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','두께 (T)','MEASURE','발주사양 ±5mm','발주사양','mm','RANGE',-5,5),
    (p_id,3,'치수','폭 (W)','MEASURE','발주사양 ±10mm','발주사양','mm','RANGE',-10,10),
    (p_id,4,'밀도','밀도 (실측)','CERT','120 kg/m³ 이상','120 kg/m³ 이상','kg/m³','MIN',120,NULL),
    (p_id,5,'열특성','열전도율','CERT','0.044 W/mK 이하','0.044 W/mK 이하','W/mK','MAX',NULL,0.044),
    (p_id,6,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL);
  END IF;

  -- D124-4 세라믹울 120K 수축율
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D124-4';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'열특성','가열선수축율 (1050°C × 24H)','CERT','4% 이하','4% 이하','%','MAX',NULL,4);
  END IF;

  -- D127-1 글라스울
  SELECT preset_id INTO p_id FROM incoming_inspection_preset WHERE form_code='D127-1';
  IF NOT EXISTS (SELECT 1 FROM inspection_preset_item WHERE preset_id=p_id) THEN
    INSERT INTO inspection_preset_item (preset_id,seq_no,quality_item,check_item,check_method,cert_standard,prod_standard,unit,direction,lower_limit,upper_limit) VALUES
    (p_id,1,'외관','외관검사 (파손·오염·이물질)','VISUAL','이상없음','이상없음',NULL,'OK_NG',NULL,NULL),
    (p_id,2,'치수','두께 (T)','MEASURE','발주사양 ±5mm','발주사양','mm','RANGE',-5,5),
    (p_id,3,'치수','폭 (W)','MEASURE','발주사양 ±10mm','발주사양','mm','RANGE',-10,10),
    (p_id,4,'밀도','밀도 (실측)','CERT','발주밀도 이상','발주밀도','kg/m³','MIN',NULL,NULL),
    (p_id,5,'열특성','열전도율','CERT','0.040 W/mK 이하','0.040 W/mK 이하','W/mK','MAX',NULL,0.040),
    (p_id,6,'서류','시험성적서 첨부 여부','VISUAL','첨부됨','첨부됨',NULL,'OK_NG',NULL,NULL);
  END IF;

END $$;

-- 7. 인정서 파일 연결 (기존 cert에 file_path 업데이트)
-- ※ 이 부분은 실제 Supabase Storage 경로에 맞게 파일을 올려야 작동합니다.
-- 인정서 PDF가 로컬 upload/ 폴더에만 있으므로 Vercel에서는 직접 서빙 불가.
-- 인정서 뷰어 기능은 로컬 전용으로 사용하거나, Supabase Storage로 이전 필요합니다.

-- 확인 쿼리
SELECT 'incoming_inspection_preset' AS tbl, COUNT(*) AS cnt FROM incoming_inspection_preset
UNION ALL
SELECT 'inspection_preset_item', COUNT(*) FROM inspection_preset_item;
