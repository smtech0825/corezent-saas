-- ============================================================
-- 056_tax_rules_no_overlap.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: tax_rules 기간 겹침 원천 차단(DB 차원).
--   같은 (tax_type, rule_key, status) 조합 안에서 [effective_from ~ effective_to]
--   기간이 겹치는 행이 2개 이상 들어갈 수 없도록 EXCLUDE 제약을 추가한다.
--   - effective_to는 '유효한 마지막 날'(포함)로 해석 → daterange 경계 '[]' 사용
--   - effective_to가 NULL이면 무기한 유효 → daterange 상한 무한대로 처리됨
--   - status가 다른 행(예: 같은 기간의 confirmed vs proposed)은 허용 —
--     확정법과 개정안을 나란히 등록하는 것이 설계 의도이므로 막지 않는다
--   - 055 헤더의 "겹침 검사는 관리자 화면에서만 수행" 문구는 이 파일로 대체된다
--     (관리자 화면의 저장 전 경고는 그대로 두고, DB가 최종 방어선이 된다)
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행 (055 적용 이후).
--   EXCLUDE 제약에 date + text 혼합 컬럼을 쓰기 위해 btree_gist 확장이 필요하다.
-- ============================================================

-- gist 인덱스에서 =(등호) 비교를 쓰기 위한 확장
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 같은 세목·룰 키·상태에서 시행 기간이 겹치는 행 금지
ALTER TABLE tax_rules
  ADD CONSTRAINT tax_rules_no_period_overlap
  EXCLUDE USING gist (
    tax_type WITH =,
    rule_key WITH =,
    status   WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 확장 설치 확인 (1행이어야 함):
--      SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
-- 2) 제약 등록 확인 (1행이어야 함):
--      SELECT conname, contype FROM pg_constraint
--       WHERE conrelid = 'tax_rules'::regclass
--         AND conname = 'tax_rules_no_period_overlap';
-- 3) 동작 확인 — 겹치는 2행 삽입 시 두 번째가 exclusion violation으로 실패해야 정상.
--    ⚠️ 반드시 트랜잭션 안에서 실행하고 ROLLBACK 한다 (더미 행이라 세율 값 없음, rule_value 빈 객체):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to,
--                             status, law_name, law_article, law_url)
--        VALUES ('acquisition', '검증용-겹침테스트', '{}', '2000-01-01', '2000-12-31',
--                'confirmed', '검증용', '검증용', 'https://example.com');
--      -- 아래 INSERT가 "conflicting key value violates exclusion constraint" 오류면 정상
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to,
--                             status, law_name, law_article, law_url)
--        VALUES ('acquisition', '검증용-겹침테스트', '{}', '2000-06-01', NULL,
--                'confirmed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- 4) 같은 기간이라도 status가 다르면 허용되는지 확인(둘 다 성공해야 정상, 역시 ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to,
--                             status, law_name, law_article, law_url)
--        VALUES ('acquisition', '검증용-병행테스트', '{}', '2000-01-01', NULL,
--                'confirmed', '검증용', '검증용', 'https://example.com');
--      INSERT INTO tax_rules (tax_type, rule_key, rule_value, effective_from, effective_to,
--                             status, law_name, law_article, law_url)
--        VALUES ('acquisition', '검증용-병행테스트', '{}', '2000-01-01', NULL,
--                'proposed', '검증용', '검증용', 'https://example.com');
--      ROLLBACK;
-- ============================================================
