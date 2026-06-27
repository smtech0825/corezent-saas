-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 프로젝트 아님
--           ❌ GenieStock 공유 라이선스 프로젝트(LICENSE_SUPABASE_URL) 아님
--           → 이 파일의 모든 객체(테이블·RPC)는 GW_SUPABASE 한 곳에만 만든다.
--             신규 로직은 앱에서 product='geniework'로 게이트되므로 geniestock은
--             이 객체들에 절대 닿지 않는다(geniestock DB에 만들 필요 없음).
--
-- 적용 방법: 운영자가 GW_SUPABASE 프로젝트의 SQL Editor에서 직접 실행.
--           (코드 push로는 외부 DB가 바뀌지 않음. 배포 전/동시에 반드시 적용.
--            미적용 시 register/reset RPC가 없어 geniework가 fail-closed로 차단됨.)
--
-- 목적   : PC변경(reset) 남용 구멍 Wave 1 — 경합(TOCTOU) + rate limit 차단.
--   1) license_program_config : 규칙값 단일 출처(무하드코딩). Wave 1~3 공용.
--   2) license_event_log       : register/reset 이벤트 append-only 로그.
--                                Wave 1 rate limit + (예정) Wave 2 주기제한·Wave 3 누적상한 공용.
--   3) register_geniework_hwid : 키 단위 advisory lock으로 "카운트→insert" 원자화
--                                (동시 신규 HWID가 한도를 넘겨 insert되는 TOCTOU 차단)
--                                + 분당 신규등록 rate limit.
--   4) reset_geniework_hwids   : reset도 같은 lock으로 직렬화 + 분당 reset rate limit
--                                + 전체삭제 + 이력 기록(누적은 보존, Wave 3용).
-- 영향   : 기존 license_keys / hwid_mapping 행·스키마 무변경(읽기·삭제만). geniestock 무영향.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 0. updated_at 자동 갱신 함수 (GW DB에 없을 수 있어 방어적으로 정의) ───
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 1. 규칙값 단일 출처(singleton) ───────────────────────────────────────
--      id=true CHECK 로 단 한 행만 존재하도록 강제 (affiliate_program_config 패턴).
--      값은 운영자가 SQL Editor에서 UPDATE로 조정. 코드에 리터럴 금지.
CREATE TABLE IF NOT EXISTS license_program_config (
  id                       boolean     PRIMARY KEY DEFAULT true CHECK (id = true),
  -- Wave 1(⑤): /api/license/* 분당 호출 상한 (키 기준, event_type별 각각 적용)
  license_api_rate_per_min integer     NOT NULL DEFAULT 10  CHECK (license_api_rate_per_min >= 1),
  -- Wave 2(②): reset 주기 제한 — 아래 두 값은 Wave 2에서 사용(미리 시드만)
  reset_period_days        integer     NOT NULL DEFAULT 30  CHECK (reset_period_days >= 0),
  reset_max_per_period     integer     NOT NULL DEFAULT 2   CHECK (reset_max_per_period >= 0),
  -- Wave 3(③): 누적 PC 상한 배수 — 누적상한 = tier 동시한도 × 이 값 (Wave 3에서 사용)
  lifetime_pc_multiplier   numeric     NOT NULL DEFAULT 2   CHECK (lifetime_pc_multiplier >= 1),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 기본 단일 행 시드(있으면 유지 — 운영자가 바꾼 값 보존)
INSERT INTO license_program_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS license_program_config_updated_at ON license_program_config;
CREATE TRIGGER license_program_config_updated_at
  BEFORE UPDATE ON license_program_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. 이벤트 로그(append-only) ──────────────────────────────────────────
--      register: hwid 채움 / reset: hwid NULL. reset가 hwid_mapping을 hard delete해도
--      이 로그는 보존 → Wave 3 누적 distinct PC 집계의 출처.
CREATE TABLE IF NOT EXISTS license_event_log (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_key text        NOT NULL,
  event_type  text        NOT NULL CHECK (event_type IN ('register', 'reset')),
  hwid        text,                                   -- register만 채움(reset는 NULL)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_event_log_key_type_time
  ON license_event_log (license_key, event_type, created_at);

-- 신규 테이블은 RLS deny-by-default (service_role만 우회 접근. anon/authenticated 차단).
ALTER TABLE license_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_event_log      ENABLE ROW LEVEL SECURITY;

-- ─── 3. 원자적 HWID 등록 RPC (TOCTOU + 분당 rate limit) ────────────────────
--   p_max = tier 동시한도(앱이 HWID_LIMITS[tier]로 계산해 전달 — 동시한도는 코드 유지).
--   동작: 키 단위 advisory lock → (이미 등록=멱등 통과) → rate → 동시한도 → insert + 로그.
--   반환 jsonb: { ok, reason }
--     reason: already_registered | registered | RATE_LIMITED | HWID_LIMIT_REACHED
--             | NO_CONFIG | INVALID_INPUT
CREATE OR REPLACE FUNCTION register_geniework_hwid(
  p_license_key text,
  p_hwid        text,
  p_max         integer,
  p_device_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate   integer;
  v_recent integer;
  v_count  integer;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = ''
     OR p_hwid IS NULL OR btrim(p_hwid) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 키 단위 직렬화: reset/register 경합까지 제거(같은 lock 키 'gwlic:') → TOCTOU 차단
  PERFORM pg_advisory_xact_lock(hashtext('gwlic:' || p_license_key)::bigint);

  -- 이미 등록된 HWID는 항상 통과(재검증 멱등) — rate/한도 검사·로그 없이.
  IF EXISTS (
    SELECT 1 FROM hwid_mapping WHERE license_key = p_license_key AND hwid = p_hwid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_registered');
  END IF;

  -- 규칙값 단일 출처(없으면 fail-closed — 운영자가 마이그레이션 미적용)
  SELECT license_api_rate_per_min INTO v_rate
  FROM license_program_config WHERE id = true;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  END IF;

  -- 분당 신규 등록 rate limit (키 기준)
  SELECT count(*) INTO v_recent
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'register'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= v_rate THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  END IF;

  -- 동시 슬롯 한도(현재 등록 수 vs tier 한도)
  SELECT count(*) INTO v_count FROM hwid_mapping WHERE license_key = p_license_key;
  IF v_count >= p_max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'HWID_LIMIT_REACHED');
  END IF;

  INSERT INTO hwid_mapping (license_key, hwid, device_name)
  VALUES (p_license_key, p_hwid, p_device_name);

  INSERT INTO license_event_log (license_key, event_type, hwid)
  VALUES (p_license_key, 'register', p_hwid);

  RETURN jsonb_build_object('ok', true, 'reason', 'registered');
END;
$$;

-- ─── 4. 원자적 reset RPC (직렬화 + 분당 reset rate limit + 이력 보존) ──────
--   동작: 키 단위 advisory lock → rate → 전체삭제 → reset 이력 기록.
--   ★ license_event_log(register 행)은 삭제하지 않음 → 누적 이력 보존(Wave 3 상한 계산용).
--   반환 jsonb: { ok, reason, deleted }
--     reason: reset | RATE_LIMITED | NO_CONFIG | INVALID_INPUT
CREATE OR REPLACE FUNCTION reset_geniework_hwids(
  p_license_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate    integer;
  v_recent  integer;
  v_deleted integer;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gwlic:' || p_license_key)::bigint);

  SELECT license_api_rate_per_min INTO v_rate
  FROM license_program_config WHERE id = true;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  END IF;

  -- 분당 reset rate limit (키 기준)
  SELECT count(*) INTO v_recent
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'reset'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= v_rate THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  END IF;

  DELETE FROM hwid_mapping WHERE license_key = p_license_key;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO license_event_log (license_key, event_type)
  VALUES (p_license_key, 'reset');

  RETURN jsonb_build_object('ok', true, 'reason', 'reset', 'deleted', v_deleted);
END;
$$;

-- ─── 5. 실행 권한 제한 (★보안 — 030 패턴) ────────────────────────────────
-- SECURITY DEFINER 함수는 RLS를 우회한다. Supabase는 public 스키마 신규 함수의
-- EXECUTE를 anon/authenticated에 기본 부여하므로 회수 후 service_role에만 부여.
-- 앱은 항상 service_role(서버 admin 클라)로만 호출.
REVOKE EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reset_geniework_hwids(text)                        FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) TO service_role;
GRANT  EXECUTE ON FUNCTION reset_geniework_hwids(text)                        TO service_role;

-- ─── 회귀 검증(운영자 적용 후 확인) ───────────────────────────────────────
-- SELECT * FROM license_program_config;                 -- 단일 행·기본값 확인
-- SELECT register_geniework_hwid('<키>', 'hwid-A', 3);  -- {"ok":true,"reason":"registered"}
-- SELECT register_geniework_hwid('<키>', 'hwid-A', 3);  -- {"ok":true,"reason":"already_registered"}
-- SELECT reset_geniework_hwids('<키>');                 -- {"ok":true,"reason":"reset","deleted":1}
