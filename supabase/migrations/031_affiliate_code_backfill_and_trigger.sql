-- ============================================================
-- 031_affiliate_code_backfill_and_trigger.sql
-- 설명: profiles.affiliate_code 미발급 버그 수정 (제휴 대시보드 "추천 코드 없음").
--
--   배경(확정): 라이브 DB의 handle_new_user() 트리거가 repo 001과 드리프트되어
--     affiliate_code 발급 줄(gen_random_uuid 기반)이 누락됨.
--       → 신규 가입자(이메일/OAuth 공통)가 코드를 못 받고,
--         기존 affiliate_code IS NULL 행도 다수 누적.
--     (UNIQUE 제약은 NULL을 서로 다른 값으로 취급 → 위반 없이 NULL이 쌓임)
--
--   이 마이그레이션이 하는 일:
--     [Part 1] 기존 affiliate_code IS NULL 행 백필 — 행별 고유값, UNIQUE 충돌 회피.
--     [Part 2] profiles INSERT 시 코드가 비면 자동 발급하는 "보강 트리거" 추가.
--              handle_new_user()는 건드리지 않음 → 라이브 전용 컬럼 세팅 로직
--              (full_name·email split_part·avatar_url 등)을 그대로 보존하면서
--              드리프트(코드 미발급)만 무력화한다.
--     [Part 3] (선택/주석) handle_new_user() CREATE OR REPLACE union 템플릿.
--              "단일 트리거로 통합"을 원할 때만 사용. 라이브 prosrc 원문이 있어야
--              정확히 병합 가능(미보유 상태로 적용 금지).
--
--   제약 확인(적용 전 근거):
--     - affiliate_code: 001_profiles.sql:13  →  text UNIQUE (NULL 다중 허용).
--     - 008_indexes.sql:8                    →  idx_profiles_affiliate_code (btree).
--     - 백필/발급 값은 기존 비-NULL 값과 충돌 금지 → 후보 생성 시 NOT EXISTS 루프로 회피.
--     - profiles NOT NULL 컬럼(role/status/created_at)은 전부 DEFAULT 보유 →
--       본 보강 트리거는 affiliate_code 외 컬럼을 만지지 않는다.
--
--   주의: 이 파일은 "작성"만 — DB 적용/푸시는 운영자가 수동 수행.
-- ============================================================


-- ── Part 1. 기존 NULL 행 백필 ────────────────────────────────────────
--   023_user_status.sql:12 의 백필 패턴(UPDATE ... WHERE col IS NULL)을 준용하되,
--   affiliate_code 는 행별 고유값이 필요하므로 단일 UPDATE가 아닌
--   "행별 루프 + 충돌 회피"로 처리한다. DO 블록은 마이그레이션 실행 롤(소유자)로
--   동작하여 RLS의 영향을 받지 않으므로 전체 비-NULL 코드를 충돌 검사에 사용할 수 있다.
DO $$
DECLARE
  r        record;
  new_code text;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE affiliate_code IS NULL LOOP
    -- 고유 코드 후보를 뽑고, 기존 값과 충돌하지 않을 때까지 재시도(천문학적으로 드묾)
    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE affiliate_code = new_code);
    END LOOP;
    -- 즉시 반영 → 같은 배치 내 다음 후보가 이 값도 충돌 검사에 인지(배치 내 중복 방지)
    UPDATE profiles SET affiliate_code = new_code WHERE id = r.id;
  END LOOP;
END $$;


-- ── Part 2. 신규 가입 보강 트리거 (handle_new_user 미변경) ────────────────
--   profiles 에 행이 INSERT 될 때 affiliate_code 가 NULL 이면 고유 코드를 발급한다.
--   - handle_new_user()(라이브 전용 컬럼 세팅 포함)는 그대로 두므로 기존 동작 보존.
--   - BEFORE INSERT 라 NEW 를 직접 수정 → 추가 UPDATE 없이 1회 INSERT 로 완결.
--   - SECURITY DEFINER: 충돌 검사 SELECT 가 RLS(본인 프로필만 조회)에 가려져
--     타인의 기존 코드를 못 보는 일을 방지(소유자 권한으로 전체 조회).
--   - handle_new_user 가 affiliate_code 를 직접 채우는 버전으로 바뀌어도(=Part 3 적용)
--     NEW.affiliate_code 가 NOT NULL 이면 이 트리거는 아무것도 하지 않음 → 충돌 없음.
CREATE OR REPLACE FUNCTION set_affiliate_code_if_missing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_code text;
BEGIN
  IF NEW.affiliate_code IS NULL THEN
    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE affiliate_code = new_code);
    END LOOP;
    NEW.affiliate_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_affiliate_code_before_insert ON profiles;
CREATE TRIGGER set_affiliate_code_before_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_affiliate_code_if_missing();


-- ── Part 3. (선택) handle_new_user() union — 라이브 prosrc 필요, 기본 비활성 ──
--   ⚠️ 아래는 "보강 트리거(Part 2)" 대신 handle_new_user 자체에 코드 발급을
--      통합하고 싶을 때만 사용하는 템플릿이다. repo 001 본문은 알지만 라이브 전용
--      컬럼 세팅(full_name / split_part(email,'@',1) / avatar_url 등)의 정확한 문장을
--      모르므로, 이 템플릿을 그대로 적용하면 라이브 로직이 덮어써져 깨질 수 있다.
--      반드시 다음을 먼저 실행해 라이브 원문을 확보하고:
--          SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
--      ⟨LIVE-ONLY⟩ 자리에 라이브 문장을 병합한 뒤 주석을 해제할 것.
--      (Part 2 만으로도 신규 발급은 보장되므로 Part 3 는 선택 사항이다.)
--
-- CREATE OR REPLACE FUNCTION handle_new_user()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO profiles (
--     id,
--     name,
--     affiliate_code
--     /* , ⟨LIVE-ONLY 컬럼들: 예) avatar_url, country ...⟩ */
--   )
--   VALUES (
--     NEW.id,
--     -- ⟨LIVE-ONLY⟩ 라이브의 name 산출식을 그대로 옮길 것. 예시:
--     --   coalesce(
--     --     NEW.raw_user_meta_data->>'name',
--     --     NEW.raw_user_meta_data->>'full_name',
--     --     split_part(NEW.email, '@', 1)
--     --   )
--     NEW.raw_user_meta_data->>'name',
--     -- ▼ 라이브에 누락되어 추가해야 하는 affiliate_code 발급 줄:
--     upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
--     /* , ⟨LIVE-ONLY 값들⟩ */
--   );
--   RETURN NEW;
-- END;
-- $$;
--
--   ※ on_auth_user_created 트리거(001:32-34)는 함수만 교체되므로 재생성 불필요.


-- ── (선택) 적용 후 검증 쿼리 ─────────────────────────────────────────
--   1) 백필 완료 확인 — 0 이어야 함:
--        SELECT count(*) FROM profiles WHERE affiliate_code IS NULL;
--   2) 중복 없음 확인 — 0 행이어야 함:
--        SELECT affiliate_code, count(*) FROM profiles
--          WHERE affiliate_code IS NOT NULL GROUP BY affiliate_code HAVING count(*) > 1;
--   3) 보강 트리거 등록 확인:
--        SELECT tgname FROM pg_trigger WHERE tgrelid = 'profiles'::regclass
--          AND tgname = 'set_affiliate_code_before_insert';
-- ============================================================
