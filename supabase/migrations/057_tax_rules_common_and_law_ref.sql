-- ============================================================
-- 057_tax_rules_common_and_law_ref.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: tax_rules 확장 2건 — Stage 1 W6(조건 필드 확장) 선행 작업.
--   1) tax_type CHECK에 'common' 추가
--      수도권 범위(region.metro_scope)처럼 여러 세목이 공유하는 룰을 담는 자리.
--      특정 세목(acquisition 등)에 묻어 저장하면 다른 세목 조회에서 빠지므로
--      별도 값으로 분리한다. 엔진(fetchValidRules)은 어떤 세목을 조회하든
--      'common'을 항상 함께 로드한다.
--      ⚠️ tax_regulated_areas·tax_test_cases·tax_calculation_logs의 tax_type CHECK는
--         그대로 둔다 — 그 테이블들은 실제 세목만 담는 것이 맞다.
--   2) 법령 참조 컬럼 2개 추가 (둘 다 NULL 허용 — 선택 입력)
--      - law_id:         법제처 법령 ID. 다음 Stage의 법령 개정 자동 감시가 이 값으로 조회
--      - law_article_no: 법제처 API 조문번호 — 6자리 숫자(조번호 4자리 + 가지번호 2자리).
--                        형식은 CHECK로 강제한다 (NULL이면 검사하지 않음)
--      룰이 0건인 지금 넣어야 나중에 등록된 룰 전체를 다시 열지 않는다.
--
--   시드 데이터 없음(의도된 설계): 세율·기준값은 물론 수도권 시·도 목록도
--   이 파일에 넣지 않는다. 수도권 범위는 관리자가 region.metro_scope 룰로
--   법령 근거와 함께 직접 등록한다.
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행 (055·056 적용 이후).
-- ============================================================

-- ── 1. tax_type CHECK에 'common' 추가 ───────────────────────────────────────
--    055의 컬럼 인라인 CHECK는 자동 이름(tax_rules_tax_type_check)으로 생성돼 있다.
ALTER TABLE tax_rules
  DROP CONSTRAINT tax_rules_tax_type_check;

ALTER TABLE tax_rules
  ADD CONSTRAINT tax_rules_tax_type_check
  CHECK (tax_type IN ('common', 'acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance'));

-- ── 2. 법령 참조 컬럼 ────────────────────────────────────────────────────────
ALTER TABLE tax_rules
  ADD COLUMN law_id text;   -- 법제처 법령 ID (NULL 허용 — 자동 감시 연동 전까지 선택 입력)

ALTER TABLE tax_rules
  ADD COLUMN law_article_no text
  CONSTRAINT tax_rules_law_article_no_format
  CHECK (law_article_no IS NULL OR law_article_no ~ '^[0-9]{6}$');   -- 조번호 4자리 + 가지번호 2자리

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) CHECK 확장 확인 — 'common' 저장이 성공해야 정상 (더미 행이므로 반드시 ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url)
--        VALUES ('common', '검증용-common테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 2) 잘못된 세목은 여전히 거부되는지 (check constraint 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url)
--        VALUES ('invalid', '검증용-거부테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 3) 컬럼 추가 확인 (2행 모두 is_nullable = 'YES'여야 함):
--      SELECT column_name, is_nullable FROM information_schema.columns
--       WHERE table_name = 'tax_rules' AND column_name IN ('law_id', 'law_article_no')
--       ORDER BY column_name;
-- 4) 조문번호 형식 제약 확인 — 6자리 숫자가 아니면 거부(check 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, status, law_name, law_article, law_url, law_article_no)
--        VALUES ('acquisition', '검증용-조문번호테스트', '{}', '2000-01-01', 'confirmed', '검증용', '검증용', 'https://example.com', '12ab56');
--      ROLLBACK;
-- 5) 기간 겹침 제약(056)이 'common'에도 적용되는지 — 두 번째 INSERT가
--    exclusion violation이면 정상 (ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to, status, law_name, law_article, law_url)
--        VALUES ('common', '검증용-겹침테스트', '{}', '2000-01-01', NULL, 'confirmed', '검증용', '검증용', 'https://example.com');
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to, status, law_name, law_article, law_url)
--        VALUES ('common', '검증용-겹침테스트', '{}', '2000-06-01', NULL, 'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- ============================================================
