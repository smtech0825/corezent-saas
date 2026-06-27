-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--           → 모든 객체는 GW_SUPABASE 한 곳에만. geniestock은 product 게이트로 안 닿음.
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행. (코드 push로 외부 DB 안 바뀜.)
-- 선행    : 002_geniework_reset_abuse.sql (license_program_config·license_event_log 필요).
--
-- 목적   : PC변경(reset) 남용 차단 Wave 2 — reset 주기 제한.
--   reset_geniework_hwids 를 CREATE OR REPLACE 하여:
--     · 기존 Wave 1 동작(키 단위 advisory lock + 분당 rate limit + 이력 기록) 유지
--     · ★추가: reset_period_days 기간 내 reset 횟수가 reset_max_per_period 이상이면 거부.
--       → reason='RESET_PERIOD_LIMITED' + next_allowed_at(다음 가능 시각) 반환.
--   reset 이력은 Wave 1에서 만든 license_event_log(event_type='reset') 재사용(별도 테이블 없음).
--   규칙값(reset_period_days·reset_max_per_period)은 license_program_config 단일 출처(무하드코딩).
-- 영향   : license_program_config 컬럼은 002에서 이미 생성·시드됨(기본 30일·2회). 스키마 무변경.
--           CREATE OR REPLACE 는 기존 EXECUTE 권한(002의 REVOKE/GRANT)을 보존.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reset_geniework_hwids(
  p_license_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate         integer;
  v_period_days  integer;
  v_max          integer;
  v_recent       integer;
  v_period_count integer;
  v_oldest       timestamptz;
  v_deleted      integer;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 키 단위 직렬화(register와 동일 lock 키)
  PERFORM pg_advisory_xact_lock(hashtext('gwlic:' || p_license_key)::bigint);

  -- 규칙값 단일 출처(없으면 fail-closed)
  SELECT license_api_rate_per_min, reset_period_days, reset_max_per_period
    INTO v_rate, v_period_days, v_max
  FROM license_program_config WHERE id = true;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  END IF;

  -- ── Wave 1: 분당 reset rate limit (키 기준) ──
  SELECT count(*) INTO v_recent
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'reset'
    AND created_at > now() - interval '1 minute';
  IF v_recent >= v_rate THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  END IF;

  -- ── Wave 2: 주기 내 reset 횟수 제한 ──
  --   기간(reset_period_days) 내 reset 이벤트 수가 reset_max_per_period 이상이면 거부.
  SELECT count(*) INTO v_period_count
  FROM license_event_log
  WHERE license_key = p_license_key
    AND event_type = 'reset'
    AND created_at > now() - make_interval(days => v_period_days);

  IF v_period_count >= v_max THEN
    -- 다음 가능 시각: 카운트가 한도 미만으로 떨어지려면, 윈도우 내 reset 중
    --   (v_period_count - v_max) 번째로 오래된 것이 윈도우 밖으로 빠져야 함.
    --   그 시각 = 해당 reset.created_at + period. (v_period_count = v_max 면 가장 오래된 것 + period)
    SELECT created_at INTO v_oldest
    FROM license_event_log
    WHERE license_key = p_license_key
      AND event_type = 'reset'
      AND created_at > now() - make_interval(days => v_period_days)
    ORDER BY created_at ASC
    OFFSET (v_period_count - v_max)
    LIMIT 1;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'RESET_PERIOD_LIMITED',
      'next_allowed_at', (v_oldest + make_interval(days => v_period_days))
    );
  END IF;

  -- ── 통과: 전체 삭제 + 이력 기록(register 이력은 보존 — Wave 3용) ──
  DELETE FROM hwid_mapping WHERE license_key = p_license_key;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO license_event_log (license_key, event_type)
  VALUES (p_license_key, 'reset');

  RETURN jsonb_build_object('ok', true, 'reason', 'reset', 'deleted', v_deleted);
END;
$$;

-- 권한 재확인(CREATE OR REPLACE 는 기존 ACL 보존하나, 멱등하게 재적용 — 002와 동일).
REVOKE EXECUTE ON FUNCTION reset_geniework_hwids(text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION reset_geniework_hwids(text) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- UPDATE license_program_config SET reset_max_per_period = 2, reset_period_days = 30;
-- 같은 키로 reset 3회 연속(분당 한도는 넉넉하다고 가정):
--   1,2회 → {"ok":true,...}, 3회 → {"ok":false,"reason":"RESET_PERIOD_LIMITED","next_allowed_at":"..."}
