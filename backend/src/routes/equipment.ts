import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function equipmentRoutes(app: FastifyInstance) {
  // ── 테이블 및 시드 데이터 초기화 ──────────────────────────────────────────
  try {
    // 1. 검사설비 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_equipment (
        equipment_id             SERIAL PRIMARY KEY,
        manage_no                VARCHAR(50) NOT NULL UNIQUE, -- EZC-T-01-1
        equipment_name           VARCHAR(100) NOT NULL,       -- 버니어캘리퍼스(디지털), 마이크로미터, 줄자, 저울, pH농도측정기 등
        serial_no                VARCHAR(100),
        capacity_spec            VARCHAR(100),                -- 10~150mm / 0.01mm, MAX 200kg 등
        manufacturer             VARCHAR(100),                -- Mitutoyo, CAS, Tajima, BlueTec 등
        install_location         VARCHAR(100) DEFAULT '본사 사무실/품질검사대',
        calibration_no           VARCHAR(100),                -- 교정증명서 번호
        calibration_cycle_months INTEGER DEFAULT 12,          -- 교정주기 (월)
        last_calibration_date    DATE,
        next_calibration_date    DATE,
        memo                     TEXT,
        is_active                BOOLEAN DEFAULT TRUE,
        created_at               TIMESTAMPTZ DEFAULT NOW(),
        updated_at               TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. 제조설비 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manufacturing_equipment (
        equipment_id     SERIAL PRIMARY KEY,
        manage_no        VARCHAR(50) NOT NULL UNIQUE, -- EZC-M-01
        equipment_name   VARCHAR(100) NOT NULL,       -- Paddle Mixer, Extruder, Cutting Machine 등
        serial_no        VARCHAR(100),
        capacity_spec    VARCHAR(100),                -- 380V / 90kw 등
        manufacturer     VARCHAR(100),                -- TANDY, FREIND MACHINERY, LIANSU 등
        purchase_date    DATE,
        install_location VARCHAR(100) DEFAULT '1공장 / 2공장 생산라인',
        memo             TEXT,
        is_active        BOOLEAN DEFAULT TRUE,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. 검사설비 시드 데이터 (EZC T-101-3 검사설비 목록 사규 32종)
    const inspectionSeedData = [
      { manage_no: 'EZC-T-01-1', equipment_name: '버니어캘리퍼스 (디지털)', serial_no: 'B19268952', capacity_spec: '10~150mm / 0.01mm', manufacturer: 'mitutoyo', calibration_no: '25-1438-001', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-01-2', equipment_name: '버니어캘리퍼스 (디지털)', serial_no: '230101290', capacity_spec: '10~150mm / 0.01mm', manufacturer: 'CAS', calibration_no: 'SC2604-10902-1', last_cal: '2026-04-08', next_cal: '2027-04-08' },
      { manage_no: 'EZC-T-01-3', equipment_name: '버니어캘리퍼스 (디지털)', serial_no: '231000022', capacity_spec: '10~150mm / 0.01mm', manufacturer: 'CAS', calibration_no: 'SC2604-10902-9', last_cal: '2026-04-08', next_cal: '2027-04-08' },
      { manage_no: 'EZC-T-02-1', equipment_name: '두께게이지 (디지털)', serial_no: '21030057', capacity_spec: '10~12.7mm / 0.01mm', manufacturer: 'BLUETEC', calibration_no: '25-1438-002', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-02-2', equipment_name: '두께게이지 (디지털)', serial_no: '21030058', capacity_spec: '10~120mm / 0.01mm', manufacturer: 'BLUETEC', calibration_no: '25-1438-003', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-02-4', equipment_name: '마이크로미터 (디지털)', serial_no: '77233606', capacity_spec: '10~25mm / 0.001mm', manufacturer: 'mitutoyo', calibration_no: '25-1408-001', last_cal: '2025-11-07', next_cal: '2026-11-07' },
      { manage_no: 'EZC-T-02-5', equipment_name: '마이크로미터 (디지털)', serial_no: '76148542', capacity_spec: '10~25mm / 0.001mm', manufacturer: 'mitutoyo', calibration_no: '25-1408-002', last_cal: '2025-11-07', next_cal: '2026-11-07' },
      { manage_no: 'EZC-T-03-1', equipment_name: '하이트게이지/캘리퍼스', serial_no: 'K18660', capacity_spec: '10~200mm / 0.1mm', manufacturer: 'mitutoyo', calibration_no: '25-1438-004', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-03-2', equipment_name: '하이트게이지/캘리퍼스', serial_no: 'K18664', capacity_spec: '10~200mm / 0.1mm', manufacturer: 'mitutoyo', calibration_no: '25-1438-005', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-04-1', equipment_name: '줄자 (스틸)', serial_no: 'TJ-35M-1', capacity_spec: '3.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-12', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-2', equipment_name: '줄자 (스틸)', serial_no: 'TJ-35M-2', capacity_spec: '3.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-22', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-3', equipment_name: '줄자 (스틸)', serial_no: 'TJ-35M-3', capacity_spec: '3.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-32', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-4', equipment_name: '줄자 (스틸)', serial_no: 'TJ-35M-4', capacity_spec: '3.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-42', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-5', equipment_name: '줄자 (스틸)', serial_no: 'TJ-35M-5', capacity_spec: '3.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-52', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-6', equipment_name: '줄자 (스틸)', serial_no: 'TJ-75M-1', capacity_spec: '7.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2511-36790-12', last_cal: '2025-11-28', next_cal: '2027-11-28' },
      { manage_no: 'EZC-T-04-7', equipment_name: '줄자 (스틸)', serial_no: 'TJ-75M-2', capacity_spec: '7.5m', manufacturer: 'TAJIMA', calibration_no: 'SC2511-36790-22', last_cal: '2025-11-28', next_cal: '2027-11-28' },
      { manage_no: 'EZC-T-04-8', equipment_name: '줄자 (스틸)', serial_no: 'TJ-50M-1', capacity_spec: '5.0m', manufacturer: 'TAJIMA', calibration_no: 'SC2604-10902-62', last_cal: '2026-04-09', next_cal: '2028-04-09' },
      { manage_no: 'EZC-T-04-9', equipment_name: '직각자/직자', serial_no: 'SHINWA-300', capacity_spec: '300mm', manufacturer: 'SHINWA', calibration_no: 'SC2511-35868-11', last_cal: '2025-11-20', next_cal: '2026-11-20' },
      { manage_no: 'EZC-T-05-1', equipment_name: '산업용 저울 (플랫폼)', serial_no: 'CLU368', capacity_spec: 'Max 200kg', manufacturer: 'CAS', calibration_no: 'HS26-2164-001', last_cal: '2026-04-01', next_cal: '2027-04-01' },
      { manage_no: 'EZC-T-05-2', equipment_name: '산업용 저울 (플랫폼)', serial_no: 'CWY547', capacity_spec: 'Max 200kg', manufacturer: 'CAS', calibration_no: 'HS25-5765-001', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-05-3', equipment_name: '산업용 저울 (테이블)', serial_no: 'CVC1365', capacity_spec: 'Max 60kg', manufacturer: 'CAS', calibration_no: 'HS25-5765-006', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-05-4', equipment_name: '크레인 저울 (호이스트)', serial_no: 'CVT17', capacity_spec: 'Max 1000kg', manufacturer: 'CAS', calibration_no: 'HS25-5765-007', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-06-1', equipment_name: '정밀 전자저울', serial_no: '209230311', capacity_spec: 'Max 610g / 0.01g', manufacturer: 'CAS', calibration_no: 'HS25-5765-005', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-06-2', equipment_name: '정밀 전자저울', serial_no: '21074070', capacity_spec: 'Max 2200g / 0.01g', manufacturer: 'Innotem', calibration_no: 'HS25-5765-004', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-06-3', equipment_name: '정밀 전자저울', serial_no: '2025081321', capacity_spec: 'Max 3200g / 0.01g', manufacturer: 'ELECTRONIC BALANCE', calibration_no: 'HS25-6482-001', last_cal: '2025-12-22', next_cal: '2026-12-22' },
      { manage_no: 'EZC-T-07-1', equipment_name: '건조기/수분측정기', serial_no: '2301101690', capacity_spec: 'Max 380℃', manufacturer: 'CAS', calibration_no: 'SC2604-10902-7', last_cal: '2026-04-03', next_cal: '2027-04-03' },
      { manage_no: 'EZC-T-07-2', equipment_name: '건조기/수분측정기', serial_no: '2301102351', capacity_spec: 'Max 380℃', manufacturer: 'CAS', calibration_no: 'SC2604-10902-8', last_cal: '2026-04-03', next_cal: '2027-04-03' },
      { manage_no: 'EZC-T-08-1', equipment_name: '고온 열처리 시험로', serial_no: '240144', capacity_spec: 'Max 1,000℃', manufacturer: 'Guangdong Liye', calibration_no: 'HS26-2164-002', last_cal: '2026-04-01', next_cal: '2027-04-01' },
      { manage_no: 'EZC-T-08-2', equipment_name: '점도계 (회전식)', serial_no: '20230215H', capacity_spec: '50Kw / 723 RPM', manufacturer: 'KITE', calibration_no: 'HS25-5765-003', last_cal: '2025-11-19', next_cal: '2026-11-19' },
      { manage_no: 'EZC-T-08-3', equipment_name: '밀도측정기 / 시편건조기', serial_no: '240064', capacity_spec: 'Max 400℃', manufacturer: 'Liyitech', calibration_no: 'HS26-2164-003', last_cal: '2026-04-01', next_cal: '2027-04-01' },
      { manage_no: 'EZC-T-09-1', equipment_name: '디지털 타이머/스톱워치', serial_no: 'K252464', capacity_spec: '1초 단위', manufacturer: 'DRETEC', calibration_no: 'K25-008060-001', last_cal: '2025-09-26', next_cal: '2026-09-26' },
      { manage_no: 'EZC-T-10-1', equipment_name: 'pH 농도측정기 (측정용)', serial_no: 'PH-2026-01', capacity_spec: '0.01 pH / 100mL', manufacturer: 'LDS', calibration_no: 'HS26-3519-001', last_cal: '2026-05-26', next_cal: '2029-05-26' },
    ];

    for (const item of inspectionSeedData) {
      await pool.query(`
        INSERT INTO inspection_equipment (manage_no, equipment_name, serial_no, capacity_spec, manufacturer, calibration_no, last_calibration_date, next_calibration_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (manage_no) DO UPDATE SET
          equipment_name = EXCLUDED.equipment_name,
          capacity_spec = EXCLUDED.capacity_spec,
          calibration_no = EXCLUDED.calibration_no,
          next_calibration_date = EXCLUDED.next_calibration_date;
      `, [item.manage_no, item.equipment_name, item.serial_no, item.capacity_spec, item.manufacturer, item.calibration_no, item.last_cal, item.next_cal]);
    }

    // 4. 제조설비 시드 데이터 (EZC M-101-2 제조설비 목록 사규 29종)
    const manufacturingSeedData = [
      { manage_no: 'EZC-M-01', equipment_name: '배합기 (Paddle Mixer)', serial_no: 'TD20030421', capacity_spec: 'Max 500L / 680kg', manufacturer: 'TANDY (China)', purchase_date: '2021-05-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-02', equipment_name: '고속 교반기 (Dissolver)', serial_no: '190511', capacity_spec: 'Max 3000 RPM', manufacturer: 'Korea', purchase_date: '2020-08-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-03-1', equipment_name: 'Single Compound Extruder (1호기)', serial_no: '227265', capacity_spec: '380V / 90kw', manufacturer: 'FREIND MACHINERY', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-03-2', equipment_name: 'Extruder Chiller (칠러)', serial_no: '136015689488', capacity_spec: '380V 1ton', manufacturer: 'SHINI (China)', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-04', equipment_name: 'Plastic Pulverizer (분쇄기)', serial_no: 'DM220821', capacity_spec: '45kw / Weight 2000kg', manufacturer: 'FREIND MACHINERY', purchase_date: '2022-09-01', location: '1공장 재활용실' },
      { manage_no: 'EZC-M-05', equipment_name: 'Air Classifier Mill (분쇄밀)', serial_no: 'DM220820', capacity_spec: '45kw / Weight 2000kg', manufacturer: 'Changzhou Doing Machine', purchase_date: '2022-09-01', location: '1공장 재활용실' },
      { manage_no: 'EZC-M-06', equipment_name: '보조 배합기 (Mixer)', serial_no: 'TD20030422', capacity_spec: '3KW', manufacturer: 'Korea', purchase_date: '2020-08-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-07', equipment_name: '수직 배합기 1호기', serial_no: '1400000761030001', capacity_spec: '24.75kw 380V/60Hz', manufacturer: 'Mcompany', purchase_date: '2023-05-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-08-1', equipment_name: 'HIGH SPEED MIXER (고속믹서)', serial_no: '1400000761020001', capacity_spec: '99kw 380V', manufacturer: 'LIANSU', purchase_date: '2023-11-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-08-2', equipment_name: 'COOLING MIXER (냉각믹서)', serial_no: '1400000761020002', capacity_spec: '37kw 380V', manufacturer: 'LIANSU', purchase_date: '2023-11-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-09', equipment_name: '대형 배합기 (Paddle Mixer)', serial_no: '3598812', capacity_spec: 'Max 1000L / 1200kg', manufacturer: 'TANDY (China)', purchase_date: '2024-04-01', location: '1공장 배합실' },
      { manage_no: 'EZC-M-10', equipment_name: 'Single Screw Extruder (Lab용)', serial_no: '273135', capacity_spec: '7.5kw', manufacturer: 'FREIND MACHINERY (SJ35)', purchase_date: '2022-09-01', location: '품질시험실' },
      { manage_no: 'EZC-M-11', equipment_name: 'Single Compound Extruder (Lab용)', serial_no: '22061403', capacity_spec: '7.5kw', manufacturer: 'FREIND MACHINERY', purchase_date: '2022-09-01', location: '품질시험실' },
      { manage_no: 'EZC-M-21-1', equipment_name: 'Twin Conical Extruder (2호기)', serial_no: 'SZL65', capacity_spec: '37kw / 300~1500 rpm', manufacturer: 'Shenzhen HYPET', purchase_date: '2021-07-01', location: '1공장 압출라인 2호기' },
      { manage_no: 'EZC-M-21-2', equipment_name: 'Chiller (2호기 칠러)', serial_no: '86-577-86123662', capacity_spec: '4.6KW', manufacturer: 'wzshuangfeng', purchase_date: '2021-07-01', location: '1공장 압출라인 2호기' },
      { manage_no: 'EZC-M-21-3', equipment_name: '온도조절기', serial_no: '20210527', capacity_spec: 'Temp Max 120℃ / 21kw', manufacturer: 'YIDE (China)', purchase_date: '2021-07-01', location: '1공장 압출라인 2호기' },
      { manage_no: 'EZC-M-23-1', equipment_name: 'Single Extruder (메인 압출기)', serial_no: '0802120', capacity_spec: '110KW 1500r/min', manufacturer: 'FREIND MACHINERY', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-23-2', equipment_name: '온도조절기 1호기', serial_no: '3TM00004944', capacity_spec: '6.94kw 400V', manufacturer: 'SHINI (China)', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-23-3', equipment_name: '온도조절기 2호기', serial_no: '3TM00004945', capacity_spec: '6.94kw 400V', manufacturer: 'SHINI (China)', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-23-4', equipment_name: '온도조절기 3호기', serial_no: '3TM00004946', capacity_spec: '6.94kw 400V', manufacturer: 'SHINI (China)', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-23-5', equipment_name: '대형 칠러 (Chiller)', serial_no: '2CA00002025', capacity_spec: '12.44kw 1ton', manufacturer: 'SHINI (China)', purchase_date: '2022-09-01', location: '1공장 압출라인 1호기' },
      { manage_no: 'EZC-M-24', equipment_name: 'Twin Conical Extruder (3호기)', serial_no: 'SZL6565', capacity_spec: '45kw / 300~1500 rpm', manufacturer: 'Shenzhen HYPET', purchase_date: '2024-04-01', location: '1공장 압출라인 3호기' },
      { manage_no: 'EZC-M-31', equipment_name: '시트 절단기 (Cutting Machine)', serial_no: '13913232125', capacity_spec: '380V / 2.2kw', manufacturer: 'UDCN (China)', purchase_date: '2022-07-01', location: '2공장 재단동' },
      { manage_no: 'EZC-M-41', equipment_name: '자동 재단기 (Automatic Cutter)', serial_no: 'WFSEN262303079', capacity_spec: '160kw 3PH', manufacturer: 'WFSEN', purchase_date: '2023-06-01', location: '2공장 재단동' },
      { manage_no: 'EZC-M-51', equipment_name: 'Air Compressor 1호기', serial_no: 'AC101', capacity_spec: '7.5kw / 10HP', manufacturer: '한신', purchase_date: '2021-07-01', location: '유틸리티실' },
      { manage_no: 'EZC-M-52', equipment_name: 'Air Compressor 2호기', serial_no: 'AC102', capacity_spec: '7.5kw / 10HP', manufacturer: '서원컴프레서', purchase_date: '2022-11-01', location: '유틸리티실' },
      { manage_no: 'EZC-M-53', equipment_name: 'Air Dryer (에어드라이어)', serial_no: '200CU', capacity_spec: '750W', manufacturer: 'Quiet Zone', purchase_date: '2022-11-01', location: '유틸리티실' },
      { manage_no: 'EZC-M-54', equipment_name: '집진기 1호기 (Dust Collector)', serial_no: 'HP3002', capacity_spec: '1400CMM / 30HP', manufacturer: '서원풍력', purchase_date: '2017-08-01', location: '1공장 집진실' },
      { manage_no: 'EZC-M-55', equipment_name: '집진기 2호기 (Dust Collector)', serial_no: 'HP3001', capacity_spec: '1330CMM / 30HP', manufacturer: '서원풍력', purchase_date: '2017-03-01', location: '2공장 집진실' },
    ];

    for (const item of manufacturingSeedData) {
      await pool.query(`
        INSERT INTO manufacturing_equipment (manage_no, equipment_name, serial_no, capacity_spec, manufacturer, purchase_date, install_location)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (manage_no) DO UPDATE SET
          equipment_name = EXCLUDED.equipment_name,
          capacity_spec = EXCLUDED.capacity_spec,
          install_location = EXCLUDED.install_location;
      `, [item.manage_no, item.equipment_name, item.serial_no, item.capacity_spec, item.manufacturer, item.purchase_date, item.location]);
    }

    console.log('✅ 검사설비(32종) 및 제조설비(29종) 테이블 및 시드 마이그레이션 완료');
  } catch (err) {
    console.error('❌ Equipment migration failed:', err);
  }

  // ── 검사설비 REST API ──────────────────────────────────────────────────
  // 1. 전체 조회 (교정 D-30 상태 자동 계산)
  app.get('/api/equipment/inspection', async () => {
    const res = await pool.query(`
      SELECT 
        equipment_id, manage_no, equipment_name, serial_no, capacity_spec,
        manufacturer, install_location, calibration_no, calibration_cycle_months,
        TO_CHAR(last_calibration_date, 'YYYY-MM-DD') AS last_calibration_date,
        TO_CHAR(next_calibration_date, 'YYYY-MM-DD') AS next_calibration_date,
        CASE
          WHEN next_calibration_date IS NULL THEN 'NORMAL'
          WHEN next_calibration_date < CURRENT_DATE THEN 'EXPIRED'
          WHEN next_calibration_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'EXPIRING'
          ELSE 'NORMAL'
        END AS calibration_status,
        (next_calibration_date - CURRENT_DATE) AS days_left,
        memo, is_active
      FROM inspection_equipment
      WHERE is_active = TRUE
      ORDER BY 
        CASE 
          WHEN next_calibration_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 1 
          ELSE 2 
        END,
        manage_no ASC;
    `);
    return { data: res.rows };
  });

  // 2. 교정 임박 (30일 이내) 경고 목록 조회
  app.get('/api/equipment/inspection/expiring', async () => {
    const res = await pool.query(`
      SELECT 
        equipment_id, manage_no, equipment_name, serial_no,
        TO_CHAR(next_calibration_date, 'YYYY-MM-DD') AS next_calibration_date,
        (next_calibration_date - CURRENT_DATE) AS days_left
      FROM inspection_equipment
      WHERE is_active = TRUE
        AND next_calibration_date IS NOT NULL
        AND next_calibration_date <= (CURRENT_DATE + INTERVAL '30 days')
      ORDER BY next_calibration_date ASC;
    `);
    return { data: res.rows };
  });

  // 3. 검사설비 등록
  app.post('/api/equipment/inspection', async (req) => {
    const body = req.body as any;
    const res = await pool.query(`
      INSERT INTO inspection_equipment (
        manage_no, equipment_name, serial_no, capacity_spec, manufacturer,
        install_location, calibration_no, calibration_cycle_months,
        last_calibration_date, next_calibration_date, memo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      body.manage_no, body.equipment_name, body.serial_no || null, body.capacity_spec || null,
      body.manufacturer || null, body.install_location || null, body.calibration_no || null,
      body.calibration_cycle_months || 12, body.last_calibration_date || null,
      body.next_calibration_date || null, body.memo || null
    ]);
    return { data: res.rows[0] };
  });

  // 4. 검사설비 수정
  app.put('/api/equipment/inspection/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const res = await pool.query(`
      UPDATE inspection_equipment SET
        manage_no = $1, equipment_name = $2, serial_no = $3, capacity_spec = $4,
        manufacturer = $5, install_location = $6, calibration_no = $7,
        calibration_cycle_months = $8, last_calibration_date = $9,
        next_calibration_date = $10, memo = $11, updated_at = NOW()
      WHERE equipment_id = $12
      RETURNING *;
    `, [
      body.manage_no, body.equipment_name, body.serial_no || null, body.capacity_spec || null,
      body.manufacturer || null, body.install_location || null, body.calibration_no || null,
      body.calibration_cycle_months || 12, body.last_calibration_date || null,
      body.next_calibration_date || null, body.memo || null, id
    ]);
    return { data: res.rows[0] };
  });

  // 5. 검사설비 삭제 (비활성화)
  app.delete('/api/equipment/inspection/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query(`UPDATE inspection_equipment SET is_active = FALSE WHERE equipment_id = $1`, [id]);
    return { success: true };
  });

  // ── 제조설비 REST API ──────────────────────────────────────────────────
  // 1. 전체 조회
  app.get('/api/equipment/manufacturing', async () => {
    const res = await pool.query(`
      SELECT 
        equipment_id, manage_no, equipment_name, serial_no, capacity_spec,
        manufacturer, install_location,
        TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
        memo, is_active
      FROM manufacturing_equipment
      WHERE is_active = TRUE
      ORDER BY manage_no ASC;
    `);
    return { data: res.rows };
  });

  // 2. 제조설비 등록
  app.post('/api/equipment/manufacturing', async (req) => {
    const body = req.body as any;
    const res = await pool.query(`
      INSERT INTO manufacturing_equipment (
        manage_no, equipment_name, serial_no, capacity_spec, manufacturer,
        purchase_date, install_location, memo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `, [
      body.manage_no, body.equipment_name, body.serial_no || null, body.capacity_spec || null,
      body.manufacturer || null, body.purchase_date || null, body.install_location || null,
      body.memo || null
    ]);
    return { data: res.rows[0] };
  });

  // 3. 제조설비 수정
  app.put('/api/equipment/manufacturing/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const res = await pool.query(`
      UPDATE manufacturing_equipment SET
        manage_no = $1, equipment_name = $2, serial_no = $3, capacity_spec = $4,
        manufacturer = $5, purchase_date = $6, install_location = $7, memo = $8, updated_at = NOW()
      WHERE equipment_id = $9
      RETURNING *;
    `, [
      body.manage_no, body.equipment_name, body.serial_no || null, body.capacity_spec || null,
      body.manufacturer || null, body.purchase_date || null, body.install_location || null,
      body.memo || null, id
    ]);
    return { data: res.rows[0] };
  });

  // 4. 제조설비 삭제 (비활성화)
  app.delete('/api/equipment/manufacturing/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query(`UPDATE manufacturing_equipment SET is_active = FALSE WHERE equipment_id = $1`, [id]);
    return { success: true };
  });
}
