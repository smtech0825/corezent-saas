-- ============================================================
-- 065_tax_regulated_areas_partial.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 규제지역 이력(tax_regulated_areas)에 '일부 지역만 지정' 표시 컬럼 추가.
--   ⚠️ 번호 주의: 세금 계열 마지막이 059라 060으로 예상되지만 060~064는 이미
--      다른 기능(견적 요청·주문 기관정보·문의 첨부·활동 로그 인덱스·매뉴얼 보관함)이
--      사용 중이라 다음 번호인 065로 만든다.
--
--   배경: 규제지역은 시·군·구 전체가 아니라 일부 동·읍·면만 지정된 사례가 있다.
--     이 표는 행정구역(시·도 → 시·군·구) 단위라 그 범위를 담을 수 없고,
--     059에서 넣은 메모(note)는 사람이 읽는 자유 텍스트라 엔진이 판정에 쓸 수 없다.
--     구 전체를 지정으로 보면 '취득 당시 조정대상지역' 자동 판정이 실제보다 넓게
--     나오고, 그 결과 1세대 1주택 비과세의 거주 요건을 근거 없이 요구해 세금이
--     크게 계산된다 — 근거 없이 사용자에게 불리한 방향이라 막아야 한다.
--
--   동작(엔진·화면 수정은 이 마이그레이션 적용 이후 별도 작업):
--     - is_partial = false(기본) : 시·군·구 전체 지정 — 자동 판정에 사용한다
--     - is_partial = true        : 일부 동·읍·면만 지정 — 자동 판정에서 제외하고
--                                  사용자에게 직접 묻는다(왜 묻는지 화면에 밝힌다)
--     어느 동·읍·면인지는 note에 적는다 — 엔진은 읽지 않고 사람이 확인용으로 본다.
--
--   NOT NULL + DEFAULT false — 기존 40행은 전부 전체 지정으로 채워지고, 컬럼을
--   모르는 기존 저장 경로(관리자 화면의 현재 INSERT)도 그대로 동작한다.
--
--   ⚠️ 지역명·날짜 등 실무 데이터는 이 파일에 넣지 않는다(시드 없음).
--      과거 이력 입력과 기존 행의 is_partial 수정은 적용 후 별도 작업으로 수행한다
--      (코드·마이그레이션에 데이터를 넣지 않는 원칙 — 055~059와 동일).
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행 (055~059 적용 이후).
-- ⚠️ 비멱등 — 운영 재실행 금지 (055~059와 동일 관례).
-- ============================================================

ALTER TABLE tax_regulated_areas
  ADD COLUMN is_partial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tax_regulated_areas.is_partial IS
  '시·군·구 일부(동·읍·면)만 지정된 이력인지. true면 자동 판정에서 제외하고 사용자에게 직접 묻는다. 대상 범위는 note에 기록한다.';

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 컬럼이 생겼는지 (boolean · NOT NULL · 기본값 false 1행이 나오면 정상):
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_name = 'tax_regulated_areas' AND column_name = 'is_partial';
-- 2) 기존 행이 전부 전체 지정(false)으로 채워졌는지
--    (partial_count = 0, total_count = 적용 시점의 전체 행 수여야 정상):
--      SELECT count(*) FILTER (WHERE is_partial) AS partial_count,
--             count(*)                          AS total_count
--        FROM tax_regulated_areas;
-- 3) 컬럼을 모르는 기존 INSERT가 여전히 성공하고 false로 들어가는지
--    (is_partial = false 1행이 나오면 정상, 반드시 ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_regulated_areas (sido, sigungu, region_code, area_type, applies_to, designated_from, source_url)
--        VALUES ('검증용', '검증용', '검증용|검증용', 'adjustment', ARRAY['transfer'], '2000-01-01', 'https://example.com')
--        RETURNING is_partial;
--      ROLLBACK;
-- 4) 부분 지정 행 저장이 성공하는지 (is_partial = true 1행이 나오면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_regulated_areas (sido, sigungu, region_code, area_type, applies_to, designated_from, source_url, is_partial, note)
--        VALUES ('검증용', '검증용', '검증용|검증용', 'adjustment', ARRAY['acquisition', 'transfer'], '2000-01-01', 'https://example.com', true, '검증용 - 일부 동만 지정')
--        RETURNING is_partial;
--      ROLLBACK;
-- 5) NULL이 거부되는지 (not-null violation 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_regulated_areas (sido, sigungu, region_code, area_type, applies_to, designated_from, source_url, is_partial)
--        VALUES ('검증용', '검증용', '검증용|검증용', 'adjustment', ARRAY['transfer'], '2000-01-01', 'https://example.com', NULL);
--      ROLLBACK;
-- ============================================================
