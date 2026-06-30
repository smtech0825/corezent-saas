-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행.
-- 선행    : 005(tester_* 테이블·config 컬럼) + 006(gate). 006의 tester_ai_record_spend는
--           이 Wave 3에서 reserve→settle 흐름으로 대체됨(삭제 안 함 — additive, 미사용으로 잔존).
--
-- 목적   : Wave 3 하드닝 — "호출당 최대비용 사전예약→정산"으로 동시성 오버슈트 원천 차단.
--   1) tester_reservation : 콜별 예약(hold) 원장. open→settled/released.
--   2) tester_ai_reserve  : AI 호출 전. 키 lock 안에서 worst-case 비용을 usd_spent에 선점(hold)
--                           + 예약행 생성. spent+maxcost > cap 이면 거부 → cap 절대 초과 불가.
--   3) tester_ai_settle   : AI 성공 후. hold 해제하고 실제 토큰 비용으로 교체(정산) + usage_log.
--   4) tester_ai_release  : AI 실패 시. hold 전액 환원(예약 해제) — 예산 누수 방지.
--   5) tester_ai_sweep_stale_reservations : 함수 크래시 등으로 남은 open 예약을 주기적 회수(cron).
--   ★ 비용은 항상 DB 단가(tester_model_price)로 계산 — AI 응답이 cost를 결정 못함.
-- 영향   : 005 테이블 읽고/씀 + 신규 tester_reservation. license_keys 읽기만. ADDITIVE ONLY.
-- ════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() 보장(대개 이미 활성 — 방어적)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. 예약(hold) 원장 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tester_reservation (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key          text          NOT NULL,
  model                text          NOT NULL,
  reserved_usd         numeric(12,6) NOT NULL CHECK (reserved_usd >= 0),
  status               text          NOT NULL DEFAULT 'open'
                                       CHECK (status IN ('open','settled','released')),
  est_input_tokens     integer       NOT NULL DEFAULT 0,
  max_output_tokens    integer       NOT NULL DEFAULT 0,
  actual_input_tokens  integer,
  actual_output_tokens integer,
  actual_usd           numeric(12,6),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  settled_at           timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tester_reservation_open
  ON tester_reservation (status, created_at);
CREATE INDEX IF NOT EXISTS idx_tester_reservation_key
  ON tester_reservation (license_key);

ALTER TABLE tester_reservation ENABLE ROW LEVEL SECURITY;

-- ─── 2. 사전예약 (AI 호출 전) ────────────────────────────────────────────
--   worst-case = est_input×입력단가 + max_output×출력단가 (둘 다 DB 단가).
--   spent + worst-case > cap 이면 거부 → 통과분만 hold(usd_spent 선점) + 예약행.
--   반환: { ok, reservation_id, reserved, spent, cap }
--         실패 reason: INVALID_INPUT|NOT_FOUND|NOT_TESTER|INACTIVE|PRICE_NOT_CONFIGURED
--                     |NO_CONFIG|TESTER_BUDGET_EXCEEDED|TESTER_BUDGET_INSUFFICIENT
CREATE OR REPLACE FUNCTION tester_ai_reserve(
  p_license_key       text,
  p_model             text,
  p_est_input_tokens  integer,
  p_max_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active  boolean;
  v_pin     numeric;
  v_pout    numeric;
  v_in      integer := GREATEST(COALESCE(p_est_input_tokens,  0), 0);
  v_out     integer := GREATEST(COALESCE(p_max_output_tokens, 0), 0);
  v_maxcost numeric;
  v_default numeric;
  v_cap     numeric;
  v_spent   numeric;
  v_resid   uuid;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = ''
     OR p_model IS NULL OR btrim(p_model) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 키 단위 직렬화 — gate/settle/release/sweep과 동일 lock 네임스페이스
  PERFORM pg_advisory_xact_lock(hashtext('gwtester:' || p_license_key)::bigint);

  -- 라이선스 유효성(lock 안에서 권위있게 재확인)
  SELECT is_active INTO v_active FROM license_keys WHERE license_key = p_license_key;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); END IF;
  IF left(p_license_key, 4) <> 'test' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_TESTER');
  END IF;
  IF NOT v_active THEN RETURN jsonb_build_object('ok', false, 'reason', 'INACTIVE'); END IF;

  -- 단가(서버 계산) — 없으면 fail-closed
  SELECT input_price_per_mtok, output_price_per_mtok INTO v_pin, v_pout
  FROM tester_model_price WHERE model = p_model AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'PRICE_NOT_CONFIGURED'); END IF;

  -- 호출당 최대비용(worst case)
  v_maxcost := (v_in::numeric * v_pin + v_out::numeric * v_pout) / 1000000;

  SELECT tester_default_usd_cap INTO v_default FROM license_program_config WHERE id = true;
  IF v_default IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG'); END IF;

  SELECT COALESCE(usd_cap, v_default), usd_spent INTO v_cap, v_spent
  FROM tester_budget WHERE license_key = p_license_key;
  IF NOT FOUND THEN v_cap := v_default; v_spent := 0; END IF;

  -- 이미 소진(hold 포함) → "본인 키 입력" 유도
  IF v_spent >= v_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TESTER_BUDGET_EXCEEDED',
      'spent', v_spent, 'cap', v_cap, 'remaining', 0);
  END IF;

  -- 잔여는 있으나 worst-case가 cap 초과 → 예약 거부(오버슈트 원천 차단).
  -- 앱은 max_tokens를 줄여 재시도하거나 본인 키 사용.
  IF v_spent + v_maxcost > v_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TESTER_BUDGET_INSUFFICIENT',
      'spent', v_spent, 'cap', v_cap, 'remaining', v_cap - v_spent, 'required', v_maxcost);
  END IF;

  -- 통과 → hold 선점(usd_spent += worst-case). 동시 콜은 이 hold를 보고 차단됨.
  INSERT INTO tester_budget (license_key, usd_spent)
  VALUES (p_license_key, v_maxcost)
  ON CONFLICT (license_key)
  DO UPDATE SET usd_spent = tester_budget.usd_spent + EXCLUDED.usd_spent;

  INSERT INTO tester_reservation (license_key, model, reserved_usd, est_input_tokens, max_output_tokens)
  VALUES (p_license_key, p_model, v_maxcost, v_in, v_out)
  RETURNING id INTO v_resid;

  SELECT usd_spent INTO v_spent FROM tester_budget WHERE license_key = p_license_key;

  RETURN jsonb_build_object('ok', true, 'reservation_id', v_resid,
    'reserved', v_maxcost, 'spent', v_spent, 'cap', v_cap);
END;
$$;

-- ─── 3. 정산 (AI 성공 후) ────────────────────────────────────────────────
--   hold(reserved_usd) 해제 후 실제 토큰 비용으로 교체: spent = spent - reserved + actual.
--   멱등: 이미 settled/released면 noop. 반환: { ok, cost, spent }
CREATE OR REPLACE FUNCTION tester_ai_settle(
  p_reservation_id       uuid,
  p_actual_input_tokens  integer,
  p_actual_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text;
  v_model    text;
  v_reserved numeric;
  v_status   text;
  v_pin      numeric;
  v_pout     numeric;
  v_in       integer := GREATEST(COALESCE(p_actual_input_tokens,  0), 0);
  v_out      integer := GREATEST(COALESCE(p_actual_output_tokens, 0), 0);
  v_cost     numeric;
  v_spent    numeric;
BEGIN
  IF p_reservation_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  SELECT license_key, model INTO v_key, v_model
  FROM tester_reservation WHERE id = p_reservation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gwtester:' || v_key)::bigint);

  -- 락 안에서 상태 재확인(멱등)
  SELECT status, reserved_usd INTO v_status, v_reserved
  FROM tester_reservation WHERE id = p_reservation_id FOR UPDATE;
  IF v_status <> 'open' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'ALREADY_' || upper(v_status));
  END IF;

  SELECT input_price_per_mtok, output_price_per_mtok INTO v_pin, v_pout
  FROM tester_model_price WHERE model = v_model;
  IF NOT FOUND THEN
    -- 단가 소실(비정상) → hold만 환원(과금 0)하고 보고
    UPDATE tester_budget SET usd_spent = GREATEST(0, usd_spent - v_reserved) WHERE license_key = v_key;
    UPDATE tester_reservation SET status = 'released', settled_at = now() WHERE id = p_reservation_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'PRICE_NOT_CONFIGURED');
  END IF;

  v_cost := (v_in::numeric * v_pin + v_out::numeric * v_pout) / 1000000;

  -- 정산: hold 해제 + 실제비용 반영
  UPDATE tester_budget
  SET usd_spent = GREATEST(0, usd_spent - v_reserved + v_cost)
  WHERE license_key = v_key;

  UPDATE tester_reservation
  SET status = 'settled', actual_input_tokens = v_in, actual_output_tokens = v_out,
      actual_usd = v_cost, settled_at = now()
  WHERE id = p_reservation_id;

  INSERT INTO tester_usage_log (license_key, model, input_tokens, output_tokens, usd_cost)
  VALUES (v_key, v_model, v_in, v_out, v_cost);

  SELECT usd_spent INTO v_spent FROM tester_budget WHERE license_key = v_key;
  RETURN jsonb_build_object('ok', true, 'cost', v_cost, 'spent', v_spent);
END;
$$;

-- ─── 4. 해제 (AI 실패 시) ────────────────────────────────────────────────
--   hold 전액 환원. 멱등. 반환: { ok, released, spent }
CREATE OR REPLACE FUNCTION tester_ai_release(
  p_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text;
  v_reserved numeric;
  v_status   text;
  v_spent    numeric;
BEGIN
  IF p_reservation_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  SELECT license_key INTO v_key FROM tester_reservation WHERE id = p_reservation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gwtester:' || v_key)::bigint);

  SELECT status, reserved_usd INTO v_status, v_reserved
  FROM tester_reservation WHERE id = p_reservation_id FOR UPDATE;
  IF v_status <> 'open' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'ALREADY_' || upper(v_status));
  END IF;

  UPDATE tester_budget SET usd_spent = GREATEST(0, usd_spent - v_reserved) WHERE license_key = v_key;
  UPDATE tester_reservation SET status = 'released', settled_at = now() WHERE id = p_reservation_id;

  SELECT usd_spent INTO v_spent FROM tester_budget WHERE license_key = v_key;
  RETURN jsonb_build_object('ok', true, 'released', v_reserved, 'spent', v_spent);
END;
$$;

-- ─── 5. 고아 예약 회수 (cron — 함수 크래시로 settle/release 못 한 hold 환원) ──
--   open이면서 p_max_age_minutes 초과한 예약을 해제(hold 환원). 한 회 최대 500건.
--   운영자: pg_cron 또는 외부 스케줄러로 주기 호출. 반환: { ok, released, refunded }
CREATE OR REPLACE FUNCTION tester_ai_sweep_stale_reservations(
  p_max_age_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_count    integer := 0;
  v_refunded numeric := 0;
BEGIN
  FOR r IN
    SELECT id, license_key, reserved_usd
    FROM tester_reservation
    WHERE status = 'open'
      AND created_at < now() - make_interval(mins => GREATEST(COALESCE(p_max_age_minutes, 15), 1))
    ORDER BY created_at ASC
    LIMIT 500
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('gwtester:' || r.license_key)::bigint);
    -- 락 후 재확인(그 사이 정산됐을 수 있음)
    IF EXISTS (SELECT 1 FROM tester_reservation WHERE id = r.id AND status = 'open') THEN
      UPDATE tester_budget SET usd_spent = GREATEST(0, usd_spent - r.reserved_usd)
        WHERE license_key = r.license_key;
      UPDATE tester_reservation SET status = 'released', settled_at = now() WHERE id = r.id;
      v_count    := v_count + 1;
      v_refunded := v_refunded + r.reserved_usd;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'released', v_count, 'refunded', v_refunded);
END;
$$;

-- ─── 6. 실행 권한 제한 (★보안 — service_role만) ──────────────────────────
REVOKE EXECUTE ON FUNCTION tester_ai_reserve(text, text, integer, integer)        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION tester_ai_settle(uuid, integer, integer)               FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION tester_ai_release(uuid)                                FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION tester_ai_sweep_stale_reservations(integer)            FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION tester_ai_reserve(text, text, integer, integer)        TO service_role;
GRANT  EXECUTE ON FUNCTION tester_ai_settle(uuid, integer, integer)               TO service_role;
GRANT  EXECUTE ON FUNCTION tester_ai_release(uuid)                                TO service_role;
GRANT  EXECUTE ON FUNCTION tester_ai_sweep_stale_reservations(integer)            TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 예약: SELECT tester_ai_reserve('test-demo','claude-haiku-4-5', 1000, 2048);
--    → {"ok":true,"reservation_id":"...","reserved":...,"spent":<hold>,...}
--    이때 SELECT usd_spent FROM tester_budget WHERE license_key='test-demo';  -- hold 반영됨
-- 2) 정산: SELECT tester_ai_settle('<reservation_id>', 1000, 800);
--    → {"ok":true,"cost":<실제>,"spent":<hold 해제+실제>}  (실제 < hold → 차액 환원)
-- 3) 동시성: cap 근처에서 reserve를 동시에 여러 번 → 합이 cap 넘는 순간부터
--    TESTER_BUDGET_INSUFFICIENT/EXCEEDED. usd_spent 는 절대 cap 초과 안 함.
-- 4) 스윕: SELECT tester_ai_sweep_stale_reservations(15);  -- 오래된 open hold 환원
