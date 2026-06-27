-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--           → 모든 객체는 GW_SUPABASE 한 곳에만. geniestock은 product 게이트로 안 닿음.
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행. (코드 push로 외부 DB 안 바뀜.)
-- 선행    : 002_geniework_reset_abuse.sql (license_program_config·license_event_log 필요).
--
-- 목적   : PC변경(reset) 남용 차단 Wave 3 — 누적 PC 상한.
--   register_geniework_hwid 를 CREATE OR REPLACE 하여:
--     · 기존 Wave 1 동작(advisory lock + 분당 rate limit + 동시한도 + insert + 이력) 유지
--     · ★추가: 그 키가 "거쳐간 distinct HWID 총수"(누적)가 상한 이상이면 신규 등록 거부.
--         - 누적 = license_event_log(event_type='register') 의 count(DISTINCT hwid).
--           reset는 hwid_mapping만 비우고 이 로그는 보존 → 누적은 줄지 않음.
--         - 상한 = p_max(tier 동시한도, 앱이 HWID_LIMITS[tier]로 전달) × lifetime_pc_multiplier.
--           예: 3pc(동시 3) × 2 = 누적 6대.
--         - ★'처음 보는 새 HWID'만 누적 검사·증가. 이미 거쳐간 HWID 재등록은 통과(재방문 허용).
--           → 정상 사용자가 같은 PC들을 reset→재등록 반복하는 건 막지 않음.
--   동시 한도(현재 hwid_mapping 행 수)와 누적(거쳐간 distinct)은 별개 지표로 둘 다 검사.
--   배수·상한은 license_program_config 단일 출처(무하드코딩).
-- 영향   : lifetime_pc_multiplier 컬럼은 002에서 이미 생성·시드됨(기본 2). 스키마 무변경.
--           CREATE OR REPLACE 는 기존 EXECUTE 권한(002)을 보존.
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
  v_rate       integer;
  v_multiplier numeric;
  v_recent     integer;
  v_count      integer;
  v_lifetime   integer;
  v_cap        integer;
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

  -- ── Wave 1: 분당 신규 등록 rate limit (키 기준) ──
  SELECT count(*) INTO v_recent
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'register'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= v_rate THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  END IF;

  -- ── Wave 3: 누적 PC 상한 — '처음 보는 새 HWID'만 검사 ──
  --   이 HWID가 register 이력에 한 번도 없으면(=브랜드 뉴) 누적에 새로 더해질 PC.
  --   이미 거쳐간 HWID(재방문)는 NOT EXISTS=false → 이 블록 건너뜀(통과).
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

  -- ── Wave 1: 동시 슬롯 한도(현재 등록 수 vs tier 한도) ──
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

-- 권한 재확인(CREATE OR REPLACE 는 기존 ACL 보존하나, 멱등하게 재적용 — 002와 동일).
REVOKE EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION register_geniework_hwid(text, text, integer, text) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- UPDATE license_program_config SET lifetime_pc_multiplier = 2;  -- 3pc → 누적 6
-- 새 HWID를 hwid-1..6 까지 등록(중간중간 reset로 동시 슬롯 비우며): 6대까지 registered,
--   7번째 새 HWID → {"ok":false,"reason":"LIFETIME_PC_LIMIT_REACHED","lifetime":6,"cap":6}
-- 이미 거쳐간 hwid-1 재등록(동시 슬롯 여유 시) → {"ok":true,"reason":"registered"} (누적 안 늘어남)
