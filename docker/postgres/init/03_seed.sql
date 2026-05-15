-- ================================================
-- EZONE MES Seed Data
-- 마스터데이터 정비 v2 엑셀 기반
-- ================================================

-- -----------------------------------------------
-- 1. certification_master (13건)
-- 시트: 인정구조_마스터(11종)
-- -----------------------------------------------
INSERT INTO certification_master (cert_number, product_group, structure_name, structure_code, install_position, fire_rating, socket_name, cert_area_sqmm, opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, gap_limit_mm, gap_direction, install_qty, sheet_thickness_min, sheet_thickness_prod, cw_density_min, cw_density_prod, cert_version) VALUES
-- 0310 시리즈 (5종) - 두께 5.0, CW 120
('FS-MP25-0310-1',  'MP', 'EZ-F.B-POSMAC Duct-VT-01',       'VT-01',        '수직벽체', '차열 2시간', 'VT200',   2025000, 2700, 750, 2600, 650, 50,  'MAX', 2, 5.0, 5.0, 120, 120, '0310'),
('FS-MP25-0310-2',  'MP', 'EZ-F.B-POSMAC Duct-VS-01',       'VS-01',        '수직벽체', '차열 2시간', 'VS200+VG200', 2025000, 2700, 750, 2600, 650, 50, 'MAX', 2, 5.0, 5.0, 120, 120, '0310'),
('FS-MP25-0310-3',  'MP', 'EZ-F.B-POSMAC Duct-VT-049',      'VT-049',       '수직벽체', '차열 2시간', 'VM200',    675000, 1500, 450, 1400, 350, 50,  'MAX', 1, 5.0, 5.0, 120, 120, '0310'),
('FS-MP25-0310-4',  'MP', 'EZ-F.B-POSMAC Duct-VA-064',      'VA-064',       '수직벽체', '차열 2시간', 'VM200',    850000, 1700, 500, 1600, 400, 50,  'MAX', 1, 5.0, 5.0, 120, 120, '0310'),
('FS-MP24-0310-7',  'MP', 'EZ-F.B-POSMAC Duct-VT-064',      'VT-064',       '수직벽체', '차열 2시간', 'VM200',    850000, 1700, 500, 1600, 400, 50,  'MAX', 1, 5.0, 5.0, 120, 120, '0310'),
-- 0910 시리즈 수직 (2종) - 두께 4.0, CW 96
('FS-MP25-0910-01', 'MP', 'EZ-F.B-POSMAC Duct-VAG-1.69',    'VAG-1.69',     '수직벽체', '차열 2시간', 'VTG200',  2025000, 2700, 750, 2600, 650, 50,  'MAX', 2, 4.0, 5.0,  96, 120, '0910'),
('FS-MP25-0910-06', 'MP', 'EZ-F.B-POSMAC Duct-VTI-064',     'VTI-064',      '수직벽체', '차열 2시간', 'VIG200',   850000, 1700, 500, 1600, 400, 50,  'MAX', 1, 4.0, 5.0,  96, 120, '0910'),
-- 0910 시리즈 수평 (4종) - 두께 4.0, CW 96
('FS-MP25-0910-02', 'MP', 'EZ-F.B-POSMAC Duct-HAG-1.69',    'HAG-1.69',     '수평바닥', '차열 2시간', 'HTG300C', 2025000, 2700, 750, 2600, 650, 80,  'MAX', 2, 4.0, 5.0,  96, 120, '0910'),
('FS-MP25-0910-04', 'MP', 'EZ-F.B-POSMAC Duct-HTG-1.69',    'HTG-1.69',     '수평바닥', '차열 2시간', 'HTG300C', 2235600, 2760, 810, 2600, 650, 80,  'MAX', 2, 4.0, 5.0,  96, 120, '0910'),
('FS-MP25-0910-05', 'MP', 'EZ-F.B-POSMAC Duct-HTG-064',     'HTG-064',      '수평바닥', '차열 2시간', 'HMG300C',  985600, 1760, 560, 1600, 400, 80,  'MAX', 1, 4.0, 5.0,  96, 120, '0910'),
('FS-MP25-0910-03', 'MP', 'EZ-F.B-POSMAC Duct-HTG(DC)-064', 'HTG(DC)-064',  '수평바닥', '차열 2시간', 'HMG300',   640000, 1600, 400, 1600, 400,  0,  'MAX', 1, 4.0, 5.0,  96, 120, '0910'),
-- 버스덕트 (2종)
('FS-BD25-0910-07', 'BD', 'EZ-BD-CV-1S(200A)',               'EZ-BD-CV-1S',  '수직벽체', '차열 2시간', NULL,       NULL,    NULL, NULL, NULL, NULL, 50,  'MAX', 1, NULL, NULL, NULL, NULL, '0910'),
('FS-BD25-0910-08', 'BD', 'EZ-BD-RV-3S(025M)',               'EZ-BD-RV-3S',  '수직벽체', '차열 2시간', NULL,       NULL,    NULL, NULL, NULL, NULL, 68,  'MAX', 1, NULL, NULL, NULL, NULL, '0910'),
-- 비금속배관 (1종)
('FS-NP24-1112-2',  'NP', 'EZ-FN-P100',                      'EZ-FN-P100',   '수평바닥', '차열 2시간', NULL,       NULL,    NULL, NULL, NULL, NULL, NULL,'MAX', 1, NULL, NULL, NULL, NULL, 'NP24');


-- -----------------------------------------------
-- 2. item_master (37건)
-- 시트: 원재료_마스터 + 반제품_완제품_마스터
-- -----------------------------------------------

-- 원재료 RM (4건)
INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit) VALUES
('RM-MB',   '난연컴파운드(PE3005MB)', 'RM', '배합원료', '배합원료',     'kg'),
('RM-EG50', '팽창흑연 #50',           'RM', '배합원료', '배합원료',     'kg'),
('RM-EA',   'EVA-EA33045',            'RM', '배합원료', '배합원료',     'kg'),
('RM-EP',   'EVA-EP100',              'RM', '배합원료', '배합원료',     'kg');

-- 부자재 SM (17건)
INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit, cert_min_thickness, cert_min_density, value_direction) VALUES
('SM-GI-I',  '강재류 아연도금강판(I형)', 'SM', '강재류',   'W125, L1000, t0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-GI-L',  '강재류 아연도금강판(L형)', 'SM', '강재류',   'W185, L1000, t0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-GI-Z',  '강재류 아연도금강판(Z형)', 'SM', '강재류',   'W215, L1000, t0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-STL-I', '강재류(I형)',              'SM', '강재류',   'W125×L1000, T:0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-STL-L', '강재류(L형)',              'SM', '강재류',   'W185×L1000, T:0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-STL-Z', '강재류(Z형)',              'SM', '강재류',   'W215×L1000, T:0.5',   'EA', 0.5,  NULL,  'MIN'),
('SM-CW128', '세라믹울 128K',            'SM', '세라믹울', '소켓조립 전용(재단)',  'EA', NULL, 120.00,'MIN'),
('SM-CW100', '세라믹울 100K',            'SM', '세라믹울', '관통부 단열재',        'EA', NULL,  96.00,'MIN'),
('SM-CW96',  '세라믹울 96K',             'SM', '세라믹울', '지지구조 단열재',      'EA', NULL,  96.00,'MIN'),
('SM-GW24',  '그라스울 24K',             'SM', '그라스울', '밀도24kg/m³, t25',    'EA', NULL,  24.00,'MIN'),
('SM-PE',    'PE보온재',                  'SM', '보온재',   '관통부 보온',          'EA', NULL, NULL,   NULL),
('SM-SIL',   '실란트',                     'SM', '밀봉재',   'KS F 4910 F-12.5E',  'EA', NULL, NULL,   NULL),
('SM-FN',    '발포소켓 몸체(FN테크)',     'SM', '발포소켓', '100A용',              'EA', NULL, NULL,   NULL),
('SM-FN-SK', '발포소켓(FN Tech)',         'SM', '발포소켓', '규격별',              'EA', NULL, NULL,   NULL),
('SM-SP',    '보호철판',                  'SM', '보호철판', '소켓 보호용',          'EA', NULL, NULL,   NULL),
('SM-GP',    '고정자재',                  'SM', '고정자재', '아연도금강판 SGCC, L1000×H200×t0.5', 'EA', NULL, NULL, NULL),
('SM-SCREW', '피스(#8×64mm)',             'SM', '소모자재', '#8×64mm 드릴링 스크류', 'EA', NULL, NULL,   NULL),
('SM-BRK-TB','소켓 브라켓(상/하)',        'SM', '브라켓',   'SGCC, H15×W190×L1265, t0.6이상', 'EA', 0.6, NULL, 'MIN'),
('SM-BRK-MD','소켓 브라켓(중앙)',         'SM', '브라켓',   'SGCC, H10×W190×L1265, t0.6이상', 'EA', 0.6, NULL, 'MIN');

-- 반제품 SA (7건)
INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit) VALUES
('SA-MIX-MB',   '인정배합 차열시트 배합물',        'SA', '배합',   '300kg/batch',       'kg'),
('SA-EXT-5190', '압출 차열시트 5T×190(소켓용)',     'SA', '압출',   '5T×190mm',          'm'),
('SA-EXT-65415','압출 차열시트 6.5T×415(FN용)',     'SA', '압출',   '6.5T×415mm',        'm'),
('SA-EXT-5125', '압출 플래싱차열시트 5T×125(I형)',  'SA', '압출',   '5T×125mm',          'm'),
('SA-EXT-4125', '압출 플래싱차열시트 4T×125(Z형)',  'SA', '압출',   '4T×125mm',          'm'),
('SA-CUT-SK',   '재단 소켓용 차열시트(규격별)',     'SA', '재단',   '규격별',            'EA'),
('SA-CUT-FL',   '재단 플래싱용 차열시트(규격별)',   'SA', '재단',   '규격별',            'EA');

-- 완제품 FP (15건)
INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit) VALUES
('FP-VT01',     '방화소켓 VT200(VT-01)',            'FP', '방화소켓', 'VT200',    'EA'),
('FP-VS01',     '방화소켓 VS200+VG200(VS-01)',      'FP', '방화소켓', 'VS200+VG200', 'EA'),
('FP-VT049',    '방화소켓 VM200(VT-049)',           'FP', '방화소켓', 'VM200',    'EA'),
('FP-VT064',    '방화소켓 VM200(VT-064)',           'FP', '방화소켓', 'VM200',    'EA'),
('FP-VA064',    '방화소켓 VM200(VA-064)',           'FP', '방화소켓', 'VM200',    'EA'),
('FP-VAG169',   '방화소켓 VTG200(VAG-1.69)',        'FP', '방화소켓', 'VTG200',   'EA'),
('FP-VTI064',   '방화소켓 VIG200(VTI-064)',         'FP', '방화소켓', 'VIG200',   'EA'),
('FP-HTG169',   '방화소켓 HTG300C(HTG-1.69)',       'FP', '방화소켓', 'HTG300C',  'EA'),
('FP-HTG064',   '방화소켓 HMG300C(HTG-064)',        'FP', '방화소켓', 'HMG300C',  'EA'),
('FP-HTGDC064', '방화소켓 HMG300(HTG(DC)-064)',     'FP', '방화소켓', 'HMG300',   'EA'),
('FP-FL-I',     '방화플래싱 I형(125×1000)',          'FP', '플래싱',   'I형 W125×L1000', 'EA'),
('FP-FL-Z',     '방화플래싱 Z형(170×1000)',          'FP', '플래싱',   'Z형 W170×L1000', 'EA'),
('FP-FL-L',     '방화플래싱 L형(75×1000)',           'FP', '플래싱',   'L형 W75×L1000',  'EA'),
('FP-BD-FL-SUS','BD플래싱 SUS304(190×380)',         'FP', 'BD플래싱', 'SUS304 t0.5, W190×L380', 'EA'),
('FP-BD-FL-GI-L','BD플래싱 아연도금대형(175×1100)', 'FP', 'BD플래싱', '아연도금 t1.6, W175×L1100', 'EA'),
('FP-BD-FL-GI-S','BD플래싱 아연도금소형(95×195)',   'FP', 'BD플래싱', '아연도금 t1.6, W95×L195', 'EA'),
('FP-TS',       '틈새복합시트(200×1000)',             'FP', '틈새시트', '200×1000',       'EA'),
('FP-FN100',    '내화충전발포소켓 100A',              'FP', '발포소켓', '100A',           'EA'),
('FP-STR',      '내화채움구조체(발주별 LOT)',         'FP', '구조체',   '발주별',         'SET');


-- -----------------------------------------------
-- 2-1. item_master KS분류 업데이트
-- KS: 해당 KS 규격 보유 → 제조사 성적서 대체 가능
-- NON_KS: 비규격 → 매로트 공인시험성적서 필수 (1년 유효)
-- -----------------------------------------------

-- 원재료 RM: 전부 NON_KS (배합원료는 KS 규격 없음)
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D101-1', insp_spec_ref = 'EZC-D101 Rev1', cert_test_items = 'UL94/밀도/MI', cert_test_cycle = '1회/년' WHERE item_code = 'RM-MB';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D102-1', insp_spec_ref = 'EZC-D102 Rev1', cert_test_items = '체잔분(300um)', cert_test_cycle = '1회/년' WHERE item_code = 'RM-EG50';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D103-1', insp_spec_ref = 'EZC-D103 Rev0', cert_test_items = 'MI/내약품성', cert_test_cycle = '1회/년' WHERE item_code = 'RM-EA';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D104-1', insp_spec_ref = 'EZC-D104 Rev0', cert_test_items = '겉보기밀도/pH', cert_test_cycle = '1회/년' WHERE item_code = 'RM-EP';

-- 부자재 SM: KS/NON_KS 혼재
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS D 3030', insp_form_code = 'D121-4', insp_spec_ref = 'EZC-D121 Rev3', cert_test_items = '항복강도/인장강도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-GI-I';
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS D 3030', insp_form_code = 'D121-4', insp_spec_ref = 'EZC-D121 Rev3', cert_test_items = '항복강도/인장강도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-GI-L';
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS D 3030', insp_form_code = 'D121-4', insp_spec_ref = 'EZC-D121 Rev3', cert_test_items = '항복강도/인장강도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-GI-Z';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D124-3', insp_spec_ref = 'EZC-D124 Rev4', cert_test_items = '밀도/숏함유량/가열선수축율', cert_test_cycle = '1회/년' WHERE item_code = 'SM-CW128';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D124-1', insp_spec_ref = 'EZC-D124 Rev4', cert_test_items = '밀도/숏함유량/가열선수축율', cert_test_cycle = '1회/년' WHERE item_code = 'SM-CW100';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D124-1', insp_spec_ref = 'EZC-D124 Rev4', cert_test_items = '밀도/숏함유량/가열선수축율', cert_test_cycle = '1회/년' WHERE item_code = 'SM-CW96';
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS L 9102', insp_form_code = 'D122-1', insp_spec_ref = 'EZC-D122 Rev1', cert_test_items = '열전도율/열간수축온도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-GW24';
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS M 3862', insp_form_code = 'D123-1', insp_spec_ref = 'EZC-D123 Rev0', cert_test_items = '밀도/열전도율', cert_test_cycle = '1회/년' WHERE item_code = 'SM-PE';
UPDATE item_master SET ks_type = 'KS', ks_number = 'KS F 4910', insp_form_code = 'D125-1', insp_spec_ref = 'EZC-D125 Rev0', cert_test_items = '탄성복원력/체적손실', cert_test_cycle = '1회/년' WHERE item_code = 'SM-SIL';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D128-1', insp_spec_ref = 'EZC-D128 Rev0', cert_test_items = '인장강도/굴곡강도/충격강도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-FN';
UPDATE item_master SET ks_type = 'NON_KS', insp_form_code = 'D129-1', insp_spec_ref = 'EZC-D129 Rev0', cert_test_items = '경도/인장강도', cert_test_cycle = '1회/년' WHERE item_code = 'SM-SP';

-- -----------------------------------------------
-- 2-2. cert_document 샘플 시드 (공인시험성적서 기존 보유분)
-- -----------------------------------------------
INSERT INTO cert_document (item_id, supplier_name, supplier_lot, test_institution, cert_number, issued_date, expiry_date, test_items, test_results, is_valid, remarks) VALUES
-- 아연도금강판 (KCL)
((SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '포스코', '2025-A001', 'KCL 한국건설생활환경시험연구원', 'KCL-2025-0513', '2025-05-13', '2026-05-12', '항복강도/인장강도', '항복 276 N/mm², 인장 358 N/mm²', TRUE, '2025년 공인시험'),
-- 세라믹울 128K (KTR)
((SELECT item_id FROM item_master WHERE item_code='SM-CW128'), 'CERA사', '2025-CW-001', 'KTR 한국화학융합시험연구원', 'KTR-2025-0801', '2025-08-01', '2026-07-31', '밀도/숏함유량/가열선수축율', '밀도 130 kg/m³, 숏 7%, 수축율 1.2%', TRUE, '120K 기준 성적서'),
-- 세라믹울 96K (KTR)
((SELECT item_id FROM item_master WHERE item_code='SM-CW96'), 'CERA사', '2025-CW-002', 'KTR 한국화학융합시험연구원', 'KTR-2025-0802', '2025-08-01', '2026-07-31', '밀도/숏함유량/가열선수축율', '밀도 103 kg/m³, 숏 8%, 수축율 1.5%', TRUE, '96K 기준 성적서'),
-- 난연컴파운드 (FITI/Koptri)
((SELECT item_id FROM item_master WHERE item_code='RM-MB'), '한화솔루션', '2025-MB-A01', 'FITI 시험연구원', 'FITI-2025-UL001', '2025-06-15', '2026-06-14', 'UL94', 'V-0 등급', TRUE, 'UL94 공인시험'),
((SELECT item_id FROM item_master WHERE item_code='RM-MB'), '한화솔루션', '2025-MB-A01', 'Koptri 한국산업기술시험원', 'KOP-2025-D001', '2025-06-20', '2026-06-19', '밀도/MI', '밀도 0.8 g/cm³, MI 0.923 g/10min', TRUE, '밀도/MI 공인시험'),
-- 팽창흑연 (KTR)
((SELECT item_id FROM item_master WHERE item_code='RM-EG50'), '삼화흑연', '2025-EG-001', 'KTR 한국화학융합시험연구원', 'KTR-2025-EG01', '2025-07-10', '2026-07-09', '체잔분(300um)', '체잔분 83%', TRUE, '팽창흑연 체잔분 공인시험'),
-- 발포소켓 (비규격 - 공인성적서 필요)
((SELECT item_id FROM item_master WHERE item_code='SM-FN'), 'FN테크', '2025-FN-001', 'KCL 한국건설생활환경시험연구원', 'KCL-2025-FN01', '2025-09-01', '2026-08-31', '인장강도/굴곡강도/충격강도', '인장 285 MPa, 굴곡 28 MPa, 충격 27 kJ/m²', TRUE, 'FN테크 슬리브 물성시험');


-- -----------------------------------------------
-- 3. bom_master (20건)
-- 시트: 방화소켓_BOM (VT200 + VM200)
-- -----------------------------------------------

-- VT200 (VT-01) BOM - cert_id=1
INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
(1, '금속소켓 본체',        (SELECT item_id FROM item_master WHERE item_code='FP-VT01'),    2, 't1.6, 2600×650, h200',                          1),
(1, '내부시트(받침대)',      (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  4, '밀도1.2g/cm³, t5.0, L1280, W190',               2),
(1, '내부시트(상/하)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  4, '밀도1.2g/cm³, t5.0, L1280, W190',               3),
(1, '내부시트(좌/우)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  8, '밀도1.2g/cm³, t5.0, L305, W190',                4),
(1, '외부시트(상/하)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L2660, W190 + CW t25, W200',5),
(1, '외부시트(좌/우)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L650, W190 + CW t25, W200', 6),
(1, '방화플래싱(I형)',       (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'),   16, 't5.0, W125, L1000 + 강판 t0.5, W125, L1000',    7),
(1, '방화댐퍼',             (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'),    1, 't1.6, 2600×650, h200',                           8),
(1, '실란트',               (SELECT item_id FROM item_master WHERE item_code='SM-SIL'),      1, 'KS F 4910 F-12.5E, t3이상, 오버랩3이상',        9),
(1, '지지구조 단열재(1단)',  (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),    2, 'CW 96kg/m³, t50, W600, 양면대칭',               10),
(1, '지지구조 단열재(2단)',  (SELECT item_id FROM item_master WHERE item_code='SM-GW24'),    2, 'GW 24kg/m³, t25, W1400, 양면대칭',              11),
(1, 'C/BAR',                (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'),    1, 't1.0, 간격50이하',                               12),
(1, '보온핀',               (SELECT item_id FROM item_master WHERE item_code='SM-SP'),      1, '3인치이상, 간격650이하',                          13);

-- VM200 (VT-049) BOM - cert_id=2
INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
(2, '금속소켓 본체',        (SELECT item_id FROM item_master WHERE item_code='FP-VT049'),   1, 't1.6, 1400×350, h200',                           1),
(2, '내부시트(상/하)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L1395, W190',               2),
(2, '내부시트(좌/우)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L320, W190',                3),
(2, '외부시트(상/하)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L1460 + CW t25, W200',     4),
(2, '외부시트(좌/우)',       (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'),  2, '밀도1.2g/cm³, t5.0, L350 + CW t25, W200',      5),
(2, '방화플래싱(I형)',       (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'),   10, 't5.0, W125, L1000 + 강판 t0.5, W125, L1000',    6),
(2, '지지구조 단열재',       (SELECT item_id FROM item_master WHERE item_code='SM-GW24'),    2, 'GW 24kg/m³, t25, W1400+W1000, 양면대칭',        7);


-- EZ-BD-CV-1S (200A) BOM - cert_id=11
-- 인정서 3.3: 틈새복합시트150H(상하/좌우) + SUS304플래싱x4 + 실란트 + 세라믹단열재
INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
(11, '틈새복합시트(상하) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L300, 상하2세트×2개', 1),
(11, '틈새복합시트(상하) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, H150, L300, 상하2세트',               2),
(11, '틈새복합시트(좌우) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L230, 좌우2세트×2개', 3),
(11, '틈새복합시트(좌우) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, H150, L230, 좌우2세트',               4),
(11, '방화플래싱(SUS304)',          (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-SUS'), 4, 'SUS304 t0.5, W190×L380 + 차열시트 t5.0, W190×L380', 5),
(11, '실란트',                      (SELECT item_id FROM item_master WHERE item_code='SM-SIL'),     1, 'KS F 4910 F-12.5E, t3이상, 오버랩3이상',        6),
(11, '지지구조 세라믹단열재',       (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, W600, 양면대칭, 철사고정',            7);

-- EZ-BD-RV-3S (025M) BOM - cert_id=12
-- 인정서 3.3: 틈새복합시트(상하/좌우/틈새) + 아연도금플래싱(상하/좌우) + 실란트 + 세라믹단열재
INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
(12, '틈새복합시트(상하) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L1000, 상하×4개',     1),
(12, '틈새복합시트(상하) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, H150, L1000, 상하×2개',               2),
(12, '틈새복합시트(좌우) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L180, 좌우×4개',      3),
(12, '틈새복합시트(좌우) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, H150, L180, 좌우×2개',                4),
(12, '틈새 차열시트',               (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L180, 틈새×4개',      5),
(12, '방화플래싱 상하(아연도금)',    (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-L'), 4, '아연도금 t1.6, W175×L1100 + 차열시트 t5.0', 6),
(12, '방화플래싱 좌우(아연도금)',    (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-S'), 4, '아연도금 t1.6, W95×L195 + 차열시트 t5.0',   7),
(12, '실란트',                      (SELECT item_id FROM item_master WHERE item_code='SM-SIL'),     1, 'KS F 4910 F-12.5E, t3이상, 오버랩3이상',        8),
(12, '지지구조 세라믹단열재',       (SELECT item_id FROM item_master WHERE item_code='SM-CW96'),   2, '96K, t25, W600, 양면대칭, 철사고정',            9);


-- -----------------------------------------------
-- 4. certification_rule (~55건)
-- 시트: 인정기준_크로스체크 + 7대 원칙
-- -----------------------------------------------

-- 덕트 MP 10종: AREA, GAP, THICKNESS, DENSITY 규칙
-- VT-01 (cert_id=1)
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(1, 'AREA',      2025000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 2700×750 = 2,025,000 mm²'),
(1, 'GAP',       50,      'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(1, 'THICKNESS', 5.0,     'MIN', 5.0,   NULL, 'mm',  '차열시트 두께 5.0mm 이상 (0310)'),
(1, 'DENSITY',   120,     'MIN', 120,   NULL, 'kg/m³','CW 밀도 120kg/m³ 이상 (0310)');

-- VT-049 (cert_id=2)
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(2, 'AREA',      675000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1500×450 = 675,000 mm²'),
(2, 'GAP',       50,     'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(2, 'THICKNESS', 5.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 두께 5.0mm 이상 (0310)'),
(2, 'DENSITY',   120,    'MIN', 120,   NULL, 'kg/m³','CW 밀도 120kg/m³ 이상 (0310)');

-- VA-064 (cert_id=3)
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(3, 'AREA',      850000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1700×500 = 850,000 mm²'),
(3, 'GAP',       50,     'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(3, 'THICKNESS', 5.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 두께 5.0mm 이상 (0310)'),
(3, 'DENSITY',   120,    'MIN', 120,   NULL, 'kg/m³','CW 밀도 120kg/m³ 이상 (0310)');

-- VT-064 (cert_id=4)
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(4, 'AREA',      850000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1700×500 = 850,000 mm²'),
(4, 'GAP',       50,     'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(4, 'THICKNESS', 5.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 두께 5.0mm 이상 (0310)'),
(4, 'DENSITY',   120,    'MIN', 120,   NULL, 'kg/m³','CW 밀도 120kg/m³ 이상 (0310)');

-- VAG-1.69 (cert_id=5) - 0910
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(5, 'AREA',      2025000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 2700×750 = 2,025,000 mm²'),
(5, 'GAP',       50,      'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(5, 'THICKNESS', 4.0,     'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(5, 'DENSITY',   96,      'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- VTI-064 (cert_id=6) - 0910
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(6, 'AREA',      850000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1700×500 = 850,000 mm²'),
(6, 'GAP',       50,     'MAX', NULL,  NULL, 'mm',  '틈새간격 50mm 이하'),
(6, 'THICKNESS', 4.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(6, 'DENSITY',   96,     'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- HAG-1.69 (cert_id=7) - 0910 수평
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(7, 'AREA',      2025000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 2700×750 = 2,025,000 mm²'),
(7, 'GAP',       80,      'MAX', NULL,  NULL, 'mm',  '틈새간격 80mm 이하 (수평)'),
(7, 'THICKNESS', 4.0,     'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(7, 'DENSITY',   96,      'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- HTG-1.69 (cert_id=8) - 0910 수평
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(8, 'AREA',      2235600, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 2760×810 = 2,235,600 mm²'),
(8, 'GAP',       80,      'MAX', NULL,  NULL, 'mm',  '틈새간격 80mm 이하 (수평)'),
(8, 'THICKNESS', 4.0,     'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(8, 'DENSITY',   96,      'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- HTG-064 (cert_id=9) - 0910 수평
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(9, 'AREA',      985600, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1760×560 = 985,600 mm²'),
(9, 'GAP',       80,     'MAX', NULL,  NULL, 'mm',  '틈새간격 80mm 이하 (수평)'),
(9, 'THICKNESS', 4.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(9, 'DENSITY',   96,     'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- HTG(DC)-064 (cert_id=10) - 0910 수평 DC(타설)
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(10, 'AREA',      640000, 'MAX', NULL,  NULL, 'mm²', '개구부 면적 1600×400 = 640,000 mm²'),
(10, 'GAP',       0,      'MAX', NULL,  NULL, 'mm',  '틈새간격 0mm (DC 타설형)'),
(10, 'THICKNESS', 4.0,    'MIN', 5.0,   NULL, 'mm',  '차열시트 인정기준 4.0mm, 생산기준 5.0mm (0910)'),
(10, 'DENSITY',   96,     'MIN', 120,   NULL, 'kg/m³','CW 인정기준 96kg/m³, 생산적용 120kg/m³ (0910)');

-- 버스덕트 BD (cert_id=11,12) - GAP만 해당
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(11, 'GAP', 50, 'MAX', NULL, NULL, 'mm', '틈새간격 50mm 이하'),
(12, 'GAP', 68, 'MAX', NULL, NULL, 'mm', '틈새간격 67.5~118mm');

-- 비금속배관 NP (cert_id=13) - PIPE 규칙
INSERT INTO certification_rule (cert_id, rule_type, cert_value, direction, production_value, tolerance_plus, unit, description) VALUES
(13, 'PIPE', 100, 'MAX', NULL, NULL, 'A', '배관 규격 100A 이하');


-- ===================================================
-- 5. BOM 계층구조 시드 (구조별 BOM 재설계)
-- ===================================================

-- 5-1. structure_bom: 인정구조 → 출하구성품 그룹 매핑
-- cert_id reference (실제 DB 기준):
--   1=VT-01, 2=VS-01, 3=VT-049, 4=VA-064, 5=VT-064,
--   6=VAG-1.69, 7=VTI-064, 8=HAG-1.69, 9=HTG-1.69, 10=HTG-064,
--   11=HTG(DC)-064, 12=EZ-BD-CV-1S, 13=EZ-BD-RV-3S, 14=EZ-FN-P100

-- VT-01 (cert_id=1) 벽체 대형 0310 N=2
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(1, 'SOCKET', '방화소켓 VT200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VT01'), '{N}', NULL, true, 1),
(1, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(1, 'SUPPORT_CW', '지지구조단열재(1단) 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(1, 'SUPPORT_GW', '지지구조단열재(2단) 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 4),
(1, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 5);

-- VS-01 (cert_id=2) 벽체 대형 0310 N=2
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(2, 'SOCKET', '방화소켓 VS200+VG200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VS01'), '{N}', NULL, true, 1),
(2, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(2, 'SUPPORT_CW', '지지구조단열재(1단) 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(2, 'SUPPORT_GW', '지지구조단열재(2단) 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 4),
(2, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 5);

-- VT-049 (cert_id=3) 벽체 소형 0310 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(3, 'SOCKET', '방화소켓 VM200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VT049'), '1', NULL, true, 1),
(3, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(3, 'SUPPORT_GW', '지지구조단열재 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 3);

-- VA-064 (cert_id=4) 벽체 중형 0310 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(4, 'SOCKET', '방화소켓 VM200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VA064'), '1', NULL, true, 1),
(4, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(4, 'SUPPORT_CW', '지지구조단열재(1단) 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(4, 'SUPPORT_GW', '지지구조단열재(2단) 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 4),
(4, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 5);

-- VT-064 (cert_id=5) 벽체 중형 0310 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(5, 'SOCKET', '방화소켓 VM200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VT064'), '1', NULL, true, 1),
(5, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(5, 'SUPPORT_CW', '지지구조단열재(1단) 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(5, 'SUPPORT_GW', '지지구조단열재(2단) 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 4),
(5, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 5);

-- VAG-1.69 (cert_id=6) 벽체 대형 0910 N=2
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(6, 'SOCKET', '방화소켓 VTG200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VAG169'), '{N}', NULL, true, 1),
(6, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(6, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(6, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 4);

-- VTI-064 (cert_id=7) 벽체 소형 0910 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(7, 'SOCKET', '방화소켓 VIG200', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-VTI064'), '1', NULL, true, 1),
(7, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(7, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, NULL, true, 3),
(7, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 4),
(7, 'SUPPORT_GW', '지지구조단열재 그라스울24K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), NULL, 2, false, 5);

-- HAG-1.69 (cert_id=8) 입상 대형 0910 N=2
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(8, 'SOCKET', '방화소켓 HTG300C', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-HTG169'), '{N}', NULL, true, 1),
(8, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, NULL, true, 2),
(8, 'FLASHING_I', '방화플래싱 I형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-I'), 'CEIL({perimeter}/1000)*2', NULL, true, 3),
(8, 'FIXING', '고정자재 GI', 'FIXING', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GP'), NULL, NULL, true, 4),
(8, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 5),
(8, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 6);

-- HTG-1.69 (cert_id=9) 입상 대형 0910 N=2
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(9, 'SOCKET', '방화소켓 HTG300C', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-HTG169'), '{N}', NULL, true, 1),
(9, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, NULL, true, 2),
(9, 'FLASHING_Z', '방화플래싱 Z형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-Z'), 'CEIL({perimeter}/1000)*2', NULL, true, 3),
(9, 'FIXING', '고정자재 GI', 'FIXING', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GP'), NULL, NULL, true, 4),
(9, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 5),
(9, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 6);

-- HTG-064 (cert_id=10) 입상 중형 0910 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(10, 'SOCKET', '방화소켓 HMG300C', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-HTG064'), '1', NULL, true, 1),
(10, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, NULL, true, 2),
(10, 'FLASHING_Z', '방화플래싱 Z형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-Z'), 'CEIL({perimeter}/1000)*2', NULL, true, 3),
(10, 'FIXING', '고정자재 GI', 'FIXING', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-GP'), NULL, NULL, true, 4),
(10, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 5),
(10, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 6);

-- HTG(DC)-064 (cert_id=11) 입상 소형 0910 N=1
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(11, 'SOCKET', '방화소켓 HMG300', 'SOCKET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-HTGDC064'), '1', NULL, true, 1),
(11, 'FLASHING_L', '방화플래싱 L형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-FL-L'), 'CEIL({perimeter}/1000)*2', NULL, true, 2),
(11, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3);

-- EZ-BD-CV-1S (cert_id=12) 버스덕트 벽체
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(12, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, 8, false, 1),
(12, 'FLASHING_SUS', '방화플래싱 SUS304', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-SUS'), NULL, 4, false, 2),
(12, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 3),
(12, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 4);

-- EZ-BD-RV-3S (cert_id=13) 버스덕트 바닥
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(13, 'GAP_COMPOSITE', '틈새복합시트', 'GAP_SHEET', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-TS'), NULL, 12, false, 1),
(13, 'FLASHING_GI_L', '방화플래싱 아연도금 대형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-L'), NULL, 4, false, 2),
(13, 'FLASHING_GI_S', '방화플래싱 아연도금 소형', 'FLASHING', 'MANUFACTURE', (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-S'), NULL, 4, false, 3),
(13, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 4),
(13, 'SEALANT', '실란트', 'SEALANT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), NULL, 1, false, 5);

-- EZ-FN-P100 (cert_id=14) 비금속배관
INSERT INTO structure_bom (cert_id, group_code, group_name, group_type, source_type, output_item_id, qty_formula, qty_fixed, is_dimension_based, sort_order) VALUES
(14, 'FN_SOCKET', '내화충전발포소켓 100A', 'SOCKET', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='FP-FN100'), NULL, 1, false, 1),
(14, 'SUPPORT_CW', '지지구조단열재 세라믹울96K', 'SUPPORT', 'PURCHASE', (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), NULL, 2, false, 2);


-- -----------------------------------------------
-- 5-2. product_bom: VT-01 SOCKET 구성자재 (Level 1→2 템플릿)
-- -----------------------------------------------

-- VT-01 (cert_id=1) SOCKET 그룹 product_bom
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(받침대)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2-15', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 8, '{W}/2-15', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 16, '{H}/2-20', 'EA', 4, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{W}+60', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{H}', 'EA', 6, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 7, 'CW 120kg/m3, t25, W200 양면'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 2, NULL, 'EA', 8, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SOCKET';

-- VT-01 (cert_id=1) FLASHING_I 그룹 product_bom
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'FLASHING_I';

-- VT-01 (cert_id=1) SUPPORT/SEALANT 그룹 product_bom
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 120kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SUPPORT_CW';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SUPPORT_GW';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 1 AND sb.group_code = 'SEALANT';

-- -----------------------------------------------
-- 5-3. product_bom: 나머지 전체 구조 (cert_id=2~14)
-- -----------------------------------------------

-- =============================================
-- cert_id=2: VS-01 (벽체, N=2, 0310)
-- =============================================

-- VS-01 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(받침대)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2-15', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 8, '{W}/2-15', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 16, '{H}/2-20', 'EA', 4, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{W}+60', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{H}', 'EA', 6, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 7, 'CW 120kg/m3, t25, W200 양면'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 2, NULL, 'EA', 8, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SOCKET';

-- VS-01 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'FLASHING_I';

-- VS-01 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 120kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SUPPORT_CW';

-- VS-01 SUPPORT_GW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SUPPORT_GW';

-- VS-01 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 2 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=3: VT-049 (벽체, N=1, 0310)
-- =============================================

-- VT-049 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 120kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SOCKET';

-- VT-049 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'FLASHING_I';

-- VT-049 SUPPORT_GW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 3 AND sb.group_code = 'SUPPORT_GW';

-- =============================================
-- cert_id=4: VA-064 (벽체, N=1, 0310)
-- =============================================

-- VA-064 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 120kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SOCKET';

-- VA-064 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'FLASHING_I';

-- VA-064 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 120kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SUPPORT_CW';

-- VA-064 SUPPORT_GW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SUPPORT_GW';

-- VA-064 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 4 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=5: VT-064 (벽체, N=1, 0310)
-- =============================================

-- VT-064 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 120kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SOCKET';

-- VT-064 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'FLASHING_I';

-- VT-064 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW128'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 120kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SUPPORT_CW';

-- VT-064 SUPPORT_GW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SUPPORT_GW';

-- VT-064 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 5 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=6: VAG-1.69 (벽체, N=2, 0910)
-- =============================================

-- VAG-1.69 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하/중앙)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 12, '{W}/2-35', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 8, '{H}/2-20', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2+30', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 96kg/m3, t25, W200 양면'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 2, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SOCKET';

-- VAG-1.69 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'FLASHING_I';

-- VAG-1.69 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SUPPORT_CW';

-- VAG-1.69 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 6 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=7: VTI-064 (벽체, N=1, 0910, with GAP_COMPOSITE)
-- =============================================

-- VTI-064 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 96kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SOCKET';

-- VTI-064 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'FLASHING_I';

-- VTI-064 GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', '{gap_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', '{gap_qty}', NULL, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'GAP_COMPOSITE';

-- VTI-064 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SUPPORT_CW';

-- VTI-064 SUPPORT_GW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GW24'), '그라스울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'GW 24kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 7 AND sb.group_code = 'SUPPORT_GW';

-- =============================================
-- cert_id=8: HAG-1.69 (바닥, N=2, 0910)
-- =============================================

-- HAG-1.69 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓 H300'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(받침대)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2-15', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 14, '{W}/2-15', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 16, '{H}/2-20', 'EA', 4, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2+30', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{H}', 'EA', 6, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 7, 'CW 96kg/m3, t25, W200 양면'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 2, NULL, 'EA', 8, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SOCKET';

-- HAG-1.69 GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', '{gap_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', '{gap_qty}', NULL, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'GAP_COMPOSITE';

-- HAG-1.69 FLASHING_I
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'FLASHING_I';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(I형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'FLASHING_I';

-- HAG-1.69 FIXING
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GP'), '고정자재', 'FIXING', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '보호철판/앵커 등'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'FIXING';

-- HAG-1.69 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SUPPORT_CW';

-- HAG-1.69 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 8 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=9: HTG-1.69 (바닥, N=2, 0910)
-- =============================================

-- HTG-1.69 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓 H300'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(받침대)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2-15', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 14, '{W}/2-15', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 16, '{H}/2-20', 'EA', 4, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{W}/2+30', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 4, '{H}', 'EA', 6, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 7, 'CW 96kg/m3, t25, W200 양면'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 2, NULL, 'EA', 8, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SOCKET';

-- HTG-1.69 GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', '{gap_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', '{gap_qty}', NULL, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'GAP_COMPOSITE';

-- HTG-1.69 FLASHING_Z
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t4.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'FLASHING_Z';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-Z'), '고정용 브라켓 GI(Z형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000 Z형'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'FLASHING_Z';

-- HTG-1.69 FIXING
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GP'), '고정자재', 'FIXING', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '보호철판/앵커 등'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'FIXING';

-- HTG-1.69 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SUPPORT_CW';

-- HTG-1.69 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 9 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=10: HTG-064 (바닥, N=1, 0910)
-- =============================================

-- HTG-064 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓 H300'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 6, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 6, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 96kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SOCKET';

-- HTG-064 GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', '{gap_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', '{gap_qty}', NULL, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'GAP_COMPOSITE';

-- HTG-064 FLASHING_Z
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t4.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'FLASHING_Z';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-Z'), '고정용 브라켓 GI(Z형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000 Z형'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'FLASHING_Z';

-- HTG-064 FIXING
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GP'), '고정자재', 'FIXING', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '보호철판/앵커 등'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'FIXING';

-- HTG-064 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SUPPORT_CW';

-- HTG-064 SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 10 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=11: HTG(DC)-064 (바닥, N=1, 0910, gap=0)
-- =============================================

-- HTG(DC)-064 SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '금속소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 't1.6 아연도금강판 가공 소켓 H300'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(상/하)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 6, '{W}-5', 'EA', 2, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 내부(좌/우)', 'SHEET_INTERIOR', 'MANUFACTURE', NULL, 6, '{H}-30', 'EA', 3, '밀도1.2g/cm3, t5.0, W190'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(상/하)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{W}+60', 'EA', 4, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트 외부(좌/우)', 'SHEET_EXTERIOR', 'MANUFACTURE', NULL, 2, '{H}', 'EA', 5, '밀도1.2g/cm3, t5.0, W190 + CW W200'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재 외부', 'CERAMIC_EXT', 'PURCHASE', '{dimension_based}', NULL, NULL, 'EA', 6, 'CW 96kg/m3, t25, W200'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI', 'BRACKET_GI', 'PURCHASE', NULL, 1, NULL, 'EA', 7, 'C/BAR t1.0 간격50이하'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SOCKET';

-- HTG(DC)-064 FLASHING_L
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(플래싱용)', 'SHEET', 'MANUFACTURE', '{flashing_qty}', NULL, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0, W125, L1000'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'FLASHING_L';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-L'), '고정용 브라켓 GI(L형)', 'BRACKET', 'PURCHASE', '{flashing_qty}', NULL, NULL, 'EA', 2, '아연도금강판 t0.5, W125, L1000 L형'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'FLASHING_L';

-- HTG(DC)-064 SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 11 AND sb.group_code = 'SUPPORT_CW';

-- =============================================
-- cert_id=12: EZ-BD-CV-1S (BD 수직벽체)
-- =============================================

-- BD-CV-1S GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', NULL, 2, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전 200x1000'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', NULL, 2, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'GAP_COMPOSITE';

-- BD-CV-1S FLASHING_SUS
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(BD플래싱용)', 'SHEET', 'MANUFACTURE', NULL, 2, NULL, 'EA', 1, 'BD플래싱 SUS304용 차열시트'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'FLASHING_SUS';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-STL-I'), '고정용 브라켓 SUS304', 'BRACKET', 'PURCHASE', NULL, 2, NULL, 'EA', 2, 'SUS304 브라켓'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'FLASHING_SUS';

-- BD-CV-1S SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'SUPPORT_CW';

-- BD-CV-1S SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 12 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=13: EZ-BD-RV-3S (BD 수직벽체)
-- =============================================

-- BD-RV-3S GAP_COMPOSITE
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), '차열시트(틈새용)', 'GAP_SHEET', 'MANUFACTURE', NULL, 4, NULL, 'EA', 1, '밀도1.2g/cm3, t5.0 틈새충전 200x1000'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'GAP_COMPOSITE';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹차열재(틈새용)', 'CERAMIC_EXT', 'PURCHASE', NULL, 4, NULL, 'EA', 2, 'CW 96kg/m3 틈새충전'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'GAP_COMPOSITE';

-- BD-RV-3S FLASHING_GI_L (대형)
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(BD플래싱 대형)', 'SHEET', 'MANUFACTURE', NULL, 2, NULL, 'EA', 1, 'BD플래싱 아연도금 대형용 차열시트'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'FLASHING_GI_L';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(대형)', 'BRACKET', 'PURCHASE', NULL, 2, NULL, 'EA', 2, '아연도금강판 브라켓 대형'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'FLASHING_GI_L';

-- BD-RV-3S FLASHING_GI_S (소형)
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SA-CUT-FL'), '차열시트(BD플래싱 소형)', 'SHEET', 'MANUFACTURE', NULL, 2, NULL, 'EA', 1, 'BD플래싱 아연도금 소형용 차열시트'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'FLASHING_GI_S';

INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-GI-I'), '고정용 브라켓 GI(소형)', 'BRACKET', 'PURCHASE', NULL, 2, NULL, 'EA', 2, '아연도금강판 브라켓 소형'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'FLASHING_GI_S';

-- BD-RV-3S SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'SUPPORT_CW';

-- BD-RV-3S SEALANT
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-SIL'), '실리콘 실란트', 'SEALANT', 'PURCHASE', NULL, 1, NULL, 'EA', 1, '내화용 실란트'
FROM structure_bom sb WHERE sb.cert_id = 13 AND sb.group_code = 'SEALANT';

-- =============================================
-- cert_id=14: EZ-FN-P100 (FN 발포소켓)
-- =============================================

-- FN_SOCKET
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-FN-SK'), '발포소켓 본체', 'SOCKET_BODY', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'FN Tech 발포소켓 100A'
FROM structure_bom sb WHERE sb.cert_id = 14 AND sb.group_code = 'FN_SOCKET';

-- FN SUPPORT_CW
INSERT INTO product_bom (sbom_id, item_id, component_name, component_type, source_type, qty_formula, qty_fixed, length_formula, unit, sort_order, spec_detail)
SELECT sb.sbom_id, (SELECT item_id FROM item_master WHERE item_code='SM-CW96'), '세라믹울 보온재', 'INSULATION', 'PURCHASE', NULL, 1, NULL, 'EA', 1, 'CW 96kg/m3 보온재'
FROM structure_bom sb WHERE sb.cert_id = 14 AND sb.group_code = 'SUPPORT_CW';
