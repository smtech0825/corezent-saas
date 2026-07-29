-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--           → 모든 객체는 GW_SUPABASE 한 곳에만. geniestock은 product 게이트로 안 닿음.
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행. (코드 push로 외부 DB 안 바뀜.)
-- 선행    : 002_geniework_reset_abuse.sql · 004_geniework_lifetime_pc_cap.sql
--           (license_program_config · license_event_log · lifetime_pc_multiplier 필요).
--
-- 목적   : 신규 PC 등록 rate limit을 "계약 대수"에 맞춰 완화 (기관 설치 첫날 429 폭주 해소).
--   기존: 계약이 1대든 30대든 분당 한도가 license_api_rate_per_min(기본 10)으로 동일.
--         → 30대 기관을 한꺼번에 설치하면 11대째부터 RATE_LIMITED로 막힘.
--   변경: register_geniework_hwid 를 CREATE OR REPLACE 하여 분당 한도를
--         v_effective = GREATEST(license_api_rate_per_min, p_max) 로 계산.
--           · p_max = tier 동시한도(앱이 hwidLimitForTier(tier)로 전달). 30pc → 30.
--           · 1~10pc 는 기본 하한 10 그대로(회귀 없음), 30pc 는 분당 30까지 허용.
--           · 계약 대수만큼만 넓히므로 남용 여지는 늘지 않음(정의상 등록해야 할 대수).
--       ★추가: RATE_LIMITED 시 다음 슬롯이 열리는 시각까지의 초(retry_after)를 함께 반환
--              → 앱이 정확히 그만큼만 대기(HTTP Retry-After 헤더로 전달).
--   Wave 3(누적 PC 상한)·동시 슬롯 한도·advisory lock·재검증 멱등은 004와 동일하게 보존.
-- 영향   : 스키마 무변경(함수 본문만 교체). CREATE OR REPLACE 는 기존 EXECUTE 권한 보존.
-- ════════════════════════════════════════════════════════════════════════

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
  v_rate       integer;   -- config 기본 한도(하한)
  v_effective  integer;   -- 이 키에 실제 적용할 분당 한도 = GREATEST(v_rate, p_max)
  v_multiplier numeric;
  v_recent     integer;
  v_count      integer;
  v_lifetime   integer;
  v_cap        integer;
  v_slot_at    timestamptz;
  v_retry      integer;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = ''
     OR p_hwid IS NULL OR btrim(p_hwid) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 키 단위 직렬화: reset/register 경합 제거(같은 lock 키 'gwlic:') → TOCTOU 차단
  PERFORM pg_advisory_xact_lock(hashtext('gwlic:' || p_license_key)::bigint);

  -- 이미 등록(현재 동시 슬롯 점유)된 HWID는 항상 통과(재검증 멱등) — rate/한도/누적 검사·로그 없이.
  IF EXISTS (
    SELECT 1 FROM hwid_mapping WHERE license_key = p_license_key AND hwid = p_hwid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_registered');
  END IF;

  -- 규칙값 단일 출처(없으면 fail-closed)
  SELECT license_api_rate_per_min, lifetime_pc_multiplier
    INTO v_rate, v_multiplier
  FROM license_program_config WHERE id = true;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  END IF;

  -- ── 분당 신규 등록 rate limit (키 기준) — 계약 대수까지 완화 ──
  --   효과적 한도 = 기본 하한(config)과 계약 대수(p_max) 중 큰 값.
  --   p_max가 비정상(NULL·0 이하)이면 하한만 적용(방어).
  v_effective := GREATEST(v_rate, GREATEST(COALESCE(p_max, 0), 0));

  SELECT count(*) INTO v_recent
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'register'
    AND created_at > now() - interval '1 minute';

  IF v_recent >= v_effective THEN
    -- 다음 슬롯이 열리는 시각 = (v_recent - v_effective + 1)번째로 오래된 이벤트가
    -- 60초 윈도우를 벗어나는 순간. ORDER BY ASC OFFSET (v_recent - v_effective) 로 그 행을 집는다.
    SELECT created_at INTO v_slot_at
    FROM license_event_log
    WHERE license_key = p_license_key
      AND event_type = 'register'
      AND created_at > now() - interval '1 minute'
    ORDER BY created_at ASC
    OFFSET GREATEST(v_recent - v_effective, 0)
    LIMIT 1;

    -- 남은 초(올림). 계산 불가 시 윈도우 크기(60초)로 폴백. 최소 1초.
    v_retry := CASE
      WHEN v_slot_at IS NULL THEN 60
      ELSE GREATEST(ceil(EXTRACT(EPOCH FROM (v_slot_at + interval '1 minute' - now())))::integer, 1)
    END;

    RETURN jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED', 'retry_after', v_retry);
  END IF;

  -- ── Wave 3: 누적 PC 상한 — '처음 보는 새 HWID'만 검사 ──
  IF NOT EXISTS (
    SELECT 1 FROM license_event_log
    WHERE license_key = p_license_key
      AND event_type = 'register'
      AND hwid = p_hwid
  ) THEN
    SELECT count(DISTINCT hwid) INTO v_lifetime
    FROM license_event_log
    WHERE license_key = p_license_key
      AND event_type = 'register';

    -- 상한 = 동시한도 × 배수 (소수 배수는 내림). 예: 3 × 2 = 6
    v_cap := floor(p_max * v_multiplier);
    IF v_lifetime >= v_cap THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'LIFETIME_PC_LIMIT_REACHED',
        'lifetime', v_lifetime,
        'cap', v_cap
      );
    END IF;
  END IF;

  -- ── 동시 슬롯 한도(현재 등록 수 vs tier 한도) ──
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

-- 권한 재확인(CREATE OR REPLACE 는 기존 ACL 보존하나, 멱등하게 재적용 — 002·004와 동일).
REVOKE EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 소규모 회귀: 3pc 키에 새 HWID를 0.2초 간격으로 몰아치면 11번째부터 RATE_LIMITED
--    (하한 10 유지 — 기존과 동일). retry_after 초가 응답에 포함되는지 확인.
-- 2) 기관 완화: 30pc 키에 새 HWID 30개를 빠르게 → 30대까지 registered,
--    31번째만 {"ok":false,"reason":"RATE_LIMITED","retry_after":<초>}.
-- 3) 재확인 무제한: 이미 등록된 HWID 재검증은 몇 번을 몰아쳐도 always already_registered.
-- [롤백] 004_geniework_lifetime_pc_cap.sql 의 register_geniework_hwid 정의를 다시 실행하면
--        분당 한도가 config 고정값(기본 10)으로 되돌아간다.
