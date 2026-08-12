-- ============================================================
-- 058_tax_types_add_calculators.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 세금 종류 확장 — Stage 2(계산기 허브) 선행 작업.
--   새 계산기 세목 4종을 tax_type CHECK에 추가한다.
--     - stamp             인지세
--     - brokerage         중개수수료
--     - jeonse_conversion 전월세 전환
--     - registration      등기비용
--   계산기를 만들 때마다 마이그레이션을 내지 않도록, 예정된 4종을 한 번에 넣는다.
--
--   확장 대상은 두 테이블이다.
--     1) tax_rules            — 룰 저장소. 057이 만든 CHECK('common' 포함 7종)를
--                               11종으로 재정의한다. 'common'은 그대로 유지.
--     2) tax_calculation_logs — 계산 이력. 확장하지 않으면 새 계산기의 이력 INSERT가
--                               CHECK 위반으로 조용히 실패한다(이력은 try-catch라
--                               화면은 안 죽지만 기록이 남지 않는 상태가 됨).
--                               'common'은 계산 세목이 아니므로 넣지 않는다.
--   ⚠️ tax_regulated_areas.applies_to·tax_test_cases의 CHECK는 건드리지 않는다 —
--      규제지역은 세율 세목에만 적용되고(인지세·중개수수료는 지역 무관),
--      테스트 케이스는 실행기 도입 시 함께 정리한다.
--
--   시드 데이터 없음(의도된 설계): 인지세 금액표·구간·비과세 기준액은 어떤 형태로도
--   이 파일에 넣지 않는다. 전부 관리자가 법령 근거와 함께 룰로 직접 입력한다.
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행 (055~057 적용 이후).
-- ============================================================

-- ── 1. tax_rules — 057의 CHECK를 11종으로 재정의 ('common' 유지) ────────────
ALTER TABLE tax_rules
  DROP CONSTRAINT tax_rules_tax_type_check;

ALTER TABLE tax_rules
  ADD CONSTRAINT tax_rules_tax_type_check
  CHECK (tax_type IN (
    'common',
    'acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance',
    'stamp', 'brokerage', 'jeonse_conversion', 'registration'
  ));

-- ── 2. tax_calculation_logs — 055의 인라인 CHECK를 10종으로 재정의 ──────────
--    055의 컬럼 인라인 CHECK는 자동 이름(tax_calculation_logs_tax_type_check)으로 생성돼 있다.
ALTER TABLE tax_calculation_logs
  DROP CONSTRAINT tax_calculation_logs_tax_type_check;

ALTER TABLE tax_calculation_logs
  ADD CONSTRAINT tax_calculation_logs_tax_type_check
  CHECK (tax_type IN (
    'acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance',
    'stamp', 'brokerage', 'jeonse_conversion', 'registration'
  ));

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) tax_rules에 stamp 저장이 성공해야 정상 (더미 행이므로 반드시 ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url)
--        VALUES ('stamp', '검증용-인지세테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 2) 'common'이 여전히 허용되는지 (성공해야 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url)
--        VALUES ('common', '검증용-common유지테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 3) 잘못된 세목은 여전히 거부되는지 (check constraint 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url)
--        VALUES ('invalid', '검증용-거부테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 4) tax_calculation_logs에 stamp 이력이 들어가는지 (성공해야 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_calculation_logs (tax_type, base_date, rule_mode, input, output)
--        VALUES ('stamp', '2000-01-01', 'confirmed', '{}', '{}');
--      ROLLBACK;
-- 5) tax_calculation_logs에 'common'은 거부되는지 (check 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_calculation_logs (tax_type, base_date, rule_mode, input, output)
--        VALUES ('common', '2000-01-01', 'confirmed', '{}', '{}');
--      ROLLBACK;
-- 6) 규제지역 applies_to는 확장되지 않았는지 — stamp가 거부되면 정상 (check 오류, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_regulated_areas (sido, sigungu, region_code, area_type, applies_to, designated_from, source_url)
--        VALUES ('검증용', '검증용', '검증용|검증용', 'adjustment', ARRAY['stamp'], '2000-01-01', 'https://example.com');
--      ROLLBACK;
-- ============================================================
