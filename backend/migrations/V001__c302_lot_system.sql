-- ═══════════════════════════════════════════════════════════════════════════════
-- (주)이지원 MES — LOT 번호 체계 전면 개편 마이그레이션
-- 기준: EZC-C-302 제품식별 및 추적성관리 규정 Rev.8 (2026.05.06)
-- 적용: 기존 IN-[약호]-YYMMDD-NNN 형식 → YYMMDD[약호]NNN 형식으로 변환
-- 실행 전 반드시 DB 백업 필요!
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. 사전 작업: 기존 LOT 번호 백업 테이블 생성
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lot_number_migration_backup AS
SELECT
  lot_id,
  lot_number AS old_lot_number,
  lot_type,
  item_id,
  NOW() AS backed_up_at
FROM lot_transaction;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lot_number 컬럼 길이 제한 완화 (기존에 VARCHAR(50) 이하인 경우 대비)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- lot_transaction.lot_number가 VARCHAR 제약이 있으면 늘리기
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lot_transaction'
      AND column_name = 'lot_number'
      AND data_type = 'character varying'
      AND character_maximum_length < 60
  ) THEN
    ALTER TABLE lot_transaction ALTER COLUMN lot_number TYPE VARCHAR(60);
    RAISE NOTICE 'lot_transaction.lot_number 컬럼 길이를 60으로 확장했습니다.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inspection'
      AND column_name = 'lot_number'
      AND data_type = 'character varying'
      AND character_maximum_length < 60
  ) THEN
    ALTER TABLE inspection ALTER COLUMN lot_number TYPE VARCHAR(60);
    RAISE NOTICE 'inspection.lot_number 컬럼 길이를 60으로 확장했습니다.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 기존 LOT 번호 형식 변환
--    Old: IN-[약호]-YYMMDD-NNN (예: IN-GW-260120-001)
--    New: YYMMDD[약호]NNN      (예: 260120GW001)
--
--    Old: ASM-[구조코드]-YYMMDD-NNN (예: ASM-VT049-260110-001)
--    New: J[YYMMDD][약호][NN]       (예: J260110D01)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2-1. 인수검사(IN) LOT 번호 변환
UPDATE lot_transaction
SET lot_number = (
  -- IN-GW-260120-001 → 260120GW001
  regexp_replace(
    regexp_replace(lot_number, '^IN-([A-Z#]+)-(\d{6})-(\d+)$', '\2\1\3'),
    '^IN-([A-Z#]+)-(\d{6})-0*(\d+)$', '\2\1' || lpad('\3', 3, '0')
  )
)
WHERE lot_number ~ '^IN-[A-Z#]+-\d{6}-\d+$'
  AND lot_type = 'IN';

-- 2-2. LOT 번호에 날짜 순서가 다른 경우 (IN-약호-YYYYMMDD-NNN 형식)
UPDATE lot_transaction
SET lot_number = (
  -- IN-GW-20260120-001 → 260120GW001
  regexp_replace(lot_number,
    '^IN-([A-Z#]+)-20(\d{6})-0*(\d+)$',
    '\2\1' || lpad('\3', 3, '0'))
)
WHERE lot_number ~ '^IN-[A-Z#]+-20\d{6}-\d+$'
  AND lot_type = 'IN';

-- 2-3. 배합(MIX) LOT 번호: YYMMDD-SNN 형식은 이미 C302 형식이므로 그대로 유지
-- (변환 불필요)

-- 2-4. 조립(ASM) LOT 번호 변환
UPDATE lot_transaction
SET lot_number = (
  -- ASM-VT049-260110-001 → J260110D01 (VT계열은 D로 통일)
  CASE
    WHEN lot_number ~ '^ASM-[A-Z0-9]+-\d{6}-\d+$' THEN
      'J' || substring(lot_number FROM 'ASM-[A-Z0-9]+-(\d{6})-\d+') ||
      'D' ||
      lpad(substring(lot_number FROM 'ASM-[A-Z0-9]+-\d{6}-0*(\d+)$'), 2, '0')
    ELSE lot_number
  END
)
WHERE lot_number ~ '^ASM-[A-Z0-9]+-\d{6}-\d+$'
  AND lot_type IN ('ASM', 'ASSEMBLY');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. inspection 테이블의 lot_number 컬럼도 동기화 (있는 경우)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inspection' AND column_name = 'lot_number'
  ) THEN
    UPDATE inspection i
    SET lot_number = lt.lot_number
    FROM lot_transaction lt
    WHERE i.lot_id = lt.lot_id
      AND i.lot_number != lt.lot_number;

    RAISE NOTICE 'inspection.lot_number를 lot_transaction과 동기화했습니다.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. lot_type 표준화
--    기존: 'INCOMING', 'ASSEMBLY', 'PROCESS' → 'IN', 'ASM', 'PROC'
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE lot_transaction SET lot_type = 'IN'   WHERE lot_type IN ('INCOMING', 'INBOUND');
UPDATE lot_transaction SET lot_type = 'ASM'  WHERE lot_type IN ('ASSEMBLY', 'ASSEMBLE');
UPDATE lot_transaction SET lot_type = 'PROC' WHERE lot_type IN ('PROCESS', 'PROCESSING', 'MIX', 'EXT', 'CUT');
UPDATE lot_transaction SET lot_type = 'OUT'  WHERE lot_type IN ('OUTPUT', 'SHIPMENT', 'SHIP');

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 수불대장 실제 LOT 데이터 추가 (차열재 LOT)
--    참조: RPT_20260212_이지원재고수불표_SELF_완료.xlsx — 차열재재고LOT 시트
-- ─────────────────────────────────────────────────────────────────────────────

-- 차열재재고LOT 시트에서 확인된 실제 LOT 번호들 (item_master와 조인 필요)
-- 아래는 참조용 데이터 — item_id는 실제 DB값으로 대체 필요

-- 세라믹울 LOT 등록 예시
-- INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, status, remaining_qty)
-- SELECT '260203CW001', 'IN', item_id, 270, 'R', 'ACTIVE', 270
-- FROM item_master WHERE item_name LIKE '%세라믹울%' AND item_code LIKE '%CW%' LIMIT 1
-- ON CONFLICT (lot_number) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 검증 쿼리 (ROLLBACK 전 확인용)
-- ─────────────────────────────────────────────────────────────────────────────

-- 변환 결과 미리보기
SELECT
  b.old_lot_number,
  lt.lot_number AS new_lot_number,
  lt.lot_type,
  lt.item_id,
  CASE
    WHEN lt.lot_number ~ '^\d{6}[A-Z]{2,6}\d{3}$'        THEN '✅ C302 원/부자재형식'
    WHEN lt.lot_number ~ '^\d{6}-S\d{2}$'                  THEN '✅ C302 배합형식'
    WHEN lt.lot_number ~ '^J\d{6}[A-Z]{1,6}\d{2}$'        THEN '✅ C302 조립형식'
    WHEN lt.lot_number ~ '^\d{6}-[A-Z].*-\d{3,4}$'        THEN '✅ C302 구조체/배관형식'
    WHEN lt.lot_number ~ '^EZ1-\d{2}-\d{4}-\d{3}$'        THEN '✅ C302 품질관리서형식'
    ELSE '⚠️  비표준 형식 (수동확인 필요)'
  END AS format_check
FROM lot_number_migration_backup b
JOIN lot_transaction lt ON lt.lot_id = b.lot_id
WHERE b.old_lot_number != lt.lot_number  -- 변경된 것만 표시
ORDER BY lt.lot_type, lt.lot_id;

-- 비표준 형식 개수
SELECT
  CASE
    WHEN lot_number ~ '^\d{6}[A-Z]{2,6}\d{3}$'        THEN 'C302 원/부자재형식'
    WHEN lot_number ~ '^\d{6}-S\d{2}$'                  THEN 'C302 배합형식'
    WHEN lot_number ~ '^J\d{6}[A-Z]{1,6}\d{2}$'        THEN 'C302 조립형식'
    WHEN lot_number ~ '^\d{6}-[A-Z].*-\d{3,4}$'        THEN 'C302 구조체/배관형식'
    WHEN lot_number ~ '^EZ1-\d{2}-\d{4}-\d{3}$'        THEN 'C302 품질관리서형식'
    ELSE '비표준 (수동확인 필요)'
  END AS lot_format,
  COUNT(*) AS count
FROM lot_transaction
GROUP BY 1
ORDER BY 2 DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증 후 COMMIT (또는 문제 발견 시 ROLLBACK)
-- ─────────────────────────────────────────────────────────────────────────────
COMMIT;

-- ROLLBACK; -- 문제 발생 시 이 줄을 활성화하여 되돌리기
