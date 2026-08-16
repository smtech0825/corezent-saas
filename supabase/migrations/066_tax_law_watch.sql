-- ============================================================
-- 066_tax_law_watch.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 법령 개정 자동 감시(법제처 OPEN API) 가동을 위한 스키마 보강.
--   055에서 빈 껍데기로 만들어 둔 tax_law_change_queue에 부족한 것 세 가지를 얹고,
--   배치의 실행 상태를 담을 tax_law_watch_state를 새로 만든다.
--
--   ⚠️ 번호 주의: 세금 계열이 059 다음 065였고 060~064는 다른 기능이 쓰고 있다.
--      현재 마지막 번호가 065이므로 다음 번호인 066으로 만든다.
--
--   ── 1) 큐에 '어느 룰에 걸리는지' 저장 자리 (matched_rule_keys) ──────────
--     법제처 조문번호는 6자리(조 4자리 + 가지 2자리)로 **조 단위**다. 항을 구분하지
--     못하므로 한 조번호에 여러 룰이 매달린다 — 예: 소득세법 제95조(009500)에는
--     장기보유특별공제 일반표·1주택표·한도·보유기간 규정까지 룰 9건이 걸린다.
--     감지 시점에 어느 룰들이 걸렸는지 배열로 남겨야 관리자가 매번 되짚지 않는다.
--
--     rule_key만 담고 tax_rules의 id는 담지 않는다 — 룰은 시행 기간별로 행이
--     늘고 줄어 id가 금방 낡는다. 확정법/개정안(status) 구분도 담지 않는다 —
--     화면이 조회 시점에 tax_rules를 다시 읽어 보여주는 편이 정확하다.
--
--   ── 2) 중복 방지 (같은 개정을 두 번 담지 않는다) ────────────────────────
--     배치가 같은 날짜를 다시 조회하거나 재실행되면 같은 개정이 또 들어온다.
--     (법령ID, 조문번호, 시행일)이 같으면 같은 개정으로 본다. change_type은 키에
--     넣지 않는다 — 같은 조가 같은 날 시행되는 변경은 유형이 달라도 한 건으로
--     검토하는 것이 맞다.
--
--     세 컬럼 모두 NULL을 허용하는 기존 정의를 바꾸지 않기 위해(빈 테이블이지만
--     남이 설계한 컬럼의 의미를 임의로 좁히지 않는다) UNIQUE 제약 대신
--     COALESCE 식 UNIQUE 인덱스를 쓴다 — PostgreSQL은 NULL끼리 서로 다르다고 보아
--     일반 UNIQUE로는 중복이 그대로 들어가기 때문이다.
--
--     배치는 INSERT ... ON CONFLICT DO NOTHING으로 넣는다.
--     시행일이 아직 안 알려진 상태(NULL)로 먼저 들어온 뒤 나중에 날짜가 확인되면
--     별개 행으로 한 번 더 들어온다 — 새 정보이므로 의도된 동작이다.
--
--   ── 3) 조회 인덱스 ──────────────────────────────────────────────────────
--     관리자 화면은 '미확인 먼저, 최근 순'으로 읽는다.
--
--   ── 4) tax_law_watch_state — 배치 실행 상태 (신규) ──────────────────────
--     lsHstInf는 날짜 단위 조회라, 어디까지 처리했는지를 저장하지 않으면 다음
--     실행이 어디서부터 볼지 알 수 없다. 큐의 최신 detected_at으로 대신할 수
--     없다 — 개정이 하나도 없던 날은 큐에 아무것도 남지 않기 때문이다.
--
--     실패도 함께 기록한다. 실패한 날 last_checked_date를 올려 버리면 그날 개정을
--     영영 놓친다. 배치는 성공한 날짜까지만 올리고, 실패하면 오류만 적는다.
--
--     단일 행 테이블이다(id = 1 고정). 행이 늘어날 일이 없고, 배치가 UPSERT 없이
--     UPDATE만 하면 되어 동시 실행 시 행이 두 개 생기는 사고를 막는다.
--
--   ⚠️ 시드 데이터 없음(055~065와 동일 원칙): 세율·금액·날짜 등 실무 데이터는
--      어떤 형태로도 이 파일에 넣지 않는다. 아래에서 넣는 tax_law_watch_state
--      1행은 값이 전부 NULL인 제어용 빈 행이며 실무 데이터가 아니다.
--      last_checked_date가 NULL이면 '아직 가동 전'이라는 뜻이고, 배치는 첫 실행에서
--      과거를 훑지 않고 그날 날짜로 기준선만 세운다(대표님 결정 2026-08-16).
--
--   RLS 방침(055 관례를 따름 — service_role용 정책은 만들지 않는다):
--     - tax_law_change_queue : 기존대로 정책 0개 (이 파일에서 바꾸지 않는다)
--     - tax_law_watch_state  : 정책 0개 = anon/authenticated 기본 거부
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행 (055~059·065 적용 이후).
-- ⚠️ 비멱등 — 운영 재실행 금지 (055~065와 동일 관례).
-- ============================================================

-- ── 1. tax_law_change_queue — 어느 룰에 걸리는지 ────────────────────────────
ALTER TABLE tax_law_change_queue
  ADD COLUMN matched_rule_keys text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tax_law_change_queue.matched_rule_keys IS
  '감지 시점에 이 (법령ID, 조문번호)에 걸려 있던 룰의 rule_key 목록. 조문번호가 조 단위라 한 건에 여러 룰이 걸린다. 빈 배열이면 걸린 룰이 없다는 뜻.';

-- ── 2. tax_law_change_queue — 중복 방지 ─────────────────────────────────────
--    NULL을 하나의 값으로 묶기 위해 COALESCE 식을 쓴다(일반 UNIQUE는 NULL 중복 허용).
CREATE UNIQUE INDEX IF NOT EXISTS tax_law_change_queue_dedup
  ON tax_law_change_queue (
    COALESCE(law_id, ''),
    COALESCE(article_no, ''),
    COALESCE(effective_date, DATE '0001-01-01')
  );

-- ── 3. tax_law_change_queue — 조회 인덱스 (미확인 먼저, 최근 순) ────────────
CREATE INDEX IF NOT EXISTS idx_tax_law_change_queue_status
  ON tax_law_change_queue (status, detected_at DESC);

-- ── 4. tax_law_watch_state — 배치 실행 상태 (단일 행) ───────────────────────
CREATE TABLE IF NOT EXISTS tax_law_watch_state (
  id                smallint    PRIMARY KEY DEFAULT 1,
  -- 여기 날짜까지 조회를 마쳤다. NULL이면 아직 가동 전 — 첫 실행이 기준선을 세운다.
  last_checked_date date,
  -- 마지막 실행 시각 (성공·실패 무관). NULL이면 한 번도 안 돌았다.
  last_run_at       timestamptz,
  -- 마지막 실행이 성공했는지. false면 last_checked_date는 올라가지 않았다.
  last_run_ok       boolean,
  -- 마지막 실행이 실패했을 때의 사유. 성공하면 NULL로 지운다.
  last_error        text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- 행이 하나만 존재하도록 강제 — 동시 실행이 두 번째 행을 만들지 못한다
  CONSTRAINT tax_law_watch_state_single_row CHECK (id = 1)
);

CREATE TRIGGER tax_law_watch_state_updated_at
  BEFORE UPDATE ON tax_law_watch_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tax_law_watch_state IS
  '법령 개정 감시 배치의 실행 상태. 단일 행(id=1)만 존재한다.';
COMMENT ON COLUMN tax_law_watch_state.last_checked_date IS
  '이 날짜까지 법제처 조회를 마쳤다. 실패한 실행은 이 값을 올리지 않는다 — 그날 개정을 놓치지 않기 위해서다. NULL이면 아직 가동 전.';
COMMENT ON COLUMN tax_law_watch_state.last_run_ok IS
  '마지막 실행 성공 여부. 관리자 화면이 배치가 조용히 죽었는지 확인하는 데 쓴다.';

-- 제어용 빈 행 1건 (값 전부 NULL = 아직 가동 전). 실무 데이터가 아니다.
INSERT INTO tax_law_watch_state (id) VALUES (1);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--    service_role은 RLS를 우회하므로 쓰기용 정책은 만들지 않는다(047·055 관례).
--    정책 0개 = anon/authenticated 전면 거부 = 사실상 service_role 전용.
ALTER TABLE tax_law_watch_state ENABLE ROW LEVEL SECURITY;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 큐에 컬럼이 생겼는지 (ARRAY · NOT NULL · 기본값 '{}' 1행이 나오면 정상):
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_name = 'tax_law_change_queue' AND column_name = 'matched_rule_keys';
-- 2) 인덱스 2개가 생겼는지 (dedup · status 2행이 나오면 정상):
--      SELECT indexname FROM pg_indexes
--       WHERE tablename = 'tax_law_change_queue'
--         AND indexname IN ('tax_law_change_queue_dedup', 'idx_tax_law_change_queue_status')
--       ORDER BY indexname;
-- 3) 중복이 실제로 막히는지 (두 번째 INSERT에서 unique violation이 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_law_change_queue (law_name, law_id, article_no, effective_date)
--        VALUES ('검증용법', '999999', '009500', '2099-01-01');
--      INSERT INTO tax_law_change_queue (law_name, law_id, article_no, effective_date)
--        VALUES ('검증용법(중복)', '999999', '009500', '2099-01-01');
--      ROLLBACK;
-- 4) 시행일이 NULL이어도 중복이 막히는지 (두 번째에서 오류가 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_law_change_queue (law_name, law_id, article_no) VALUES ('검증용법', '999998', '000100');
--      INSERT INTO tax_law_change_queue (law_name, law_id, article_no) VALUES ('검증용법', '999998', '000100');
--      ROLLBACK;
-- 5) 룰 목록이 배열로 들어가는지 (2건짜리 배열 1행이 나오면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_law_change_queue (law_name, law_id, article_no, effective_date, matched_rule_keys)
--        VALUES ('검증용법', '999997', '009500', '2099-01-01',
--                ARRAY['transfer.ltsd.general', 'transfer.period_rule'])
--        RETURNING matched_rule_keys, array_length(matched_rule_keys, 1);
--      ROLLBACK;
-- 6) 상태 테이블에 제어용 행이 1건 있고 값이 전부 NULL인지
--    (id=1 · 나머지 NULL 1행이 나오면 정상):
--      SELECT id, last_checked_date, last_run_at, last_run_ok, last_error
--        FROM tax_law_watch_state;
-- 7) 두 번째 행이 거부되는지 (check violation 또는 pkey violation이 나면 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO tax_law_watch_state (id) VALUES (2);
--      ROLLBACK;
-- 8) updated_at 트리거가 도는지 (updated_at이 갱신되면 정상, ROLLBACK):
--      BEGIN;
--      UPDATE tax_law_watch_state SET last_run_ok = true WHERE id = 1
--        RETURNING id, last_run_ok, updated_at;
--      ROLLBACK;
-- 9) RLS가 켜지고 정책이 0개인지 (relrowsecurity = t, 정책 조회 0행이면 정상):
--      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'tax_law_watch_state';
--      SELECT policyname FROM pg_policies WHERE tablename = 'tax_law_watch_state';
-- ============================================================
