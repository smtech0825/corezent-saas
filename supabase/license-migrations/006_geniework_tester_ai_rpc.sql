-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행.
-- 선행    : 005_geniework_tester_ai_budget.sql (tester_* 테이블·config 컬럼 필요).
--
-- 목적   : 테스터 AI 프록시 (Wave 2: 함수) — DB가 단일 출처로 판정/회계.
--   1) tester_ai_gate         : AI 호출 전 게이트. 라이선스 유효성(존재·test*·active) +
--                               모델 단가 존재 + usd_spent < effective_cap 판정. READ-ONLY.
--   2) tester_ai_record_spend : AI 호출 성공 후 원자적 회계. 키 단위 advisory lock으로
--                               cost = 토큰×단가(/1e6) 서버계산 → usd_spent 누적 upsert +
--                               usage_log 기록. 동시 호출에도 누적 손실(lost update) 불가.
--   ★ cost는 항상 DB(tester_model_price)에서 계산 — AI 응답이 cost를 결정할 수 없음.
-- 영향   : 005 테이블만 읽고/씀. 기존 license_keys 읽기만(무변경). ADDITIVE ONLY.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. 사전 게이트 (READ-ONLY) ──────────────────────────────────────────
--   반환 jsonb: { ok, reason, spent?, cap?, remaining? }
--     reason: OK | INVALID_INPUT | NOT_FOUND | NOT_TESTER | INACTIVE
--             | PRICE_NOT_CONFIGURED | NO_CONFIG | TESTER_BUDGET_EXCEEDED
CREATE OR REPLACE FUNCTION tester_ai_gate(
  p_license_key text,
  p_model       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active  boolean;
  v_default numeric;
  v_cap     numeric;
  v_spent   numeric;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = ''
     OR p_model IS NULL OR btrim(p_model) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 라이선스 존재 확인 (GW DB의 license_keys — 읽기만)
  SELECT is_active INTO v_active
  FROM license_keys WHERE license_key = p_license_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  END IF;

  -- 테스터 키만 허용 (키가 'test'로 시작) — 유료 키는 이 함수 사용 불가
  IF left(p_license_key, 4) <> 'test' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NOT_TESTER');
  END IF;

  IF NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INACTIVE');
  END IF;

  -- 모델 단가 필수 — 없으면 cost 계산 불가 → AI 호출 전에 fail-closed
  IF NOT EXISTS (
    SELECT 1 FROM tester_model_price WHERE model = p_model AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'PRICE_NOT_CONFIGURED');
  END IF;

  -- 기본 한도(설정 단일 출처) — 없으면 fail-closed
  SELECT tester_default_usd_cap INTO v_default
  FROM license_program_config WHERE id = true;
  IF v_default IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_CONFIG');
  END IF;

  -- 키별 예산 (행 없으면 spent=0, cap=전역기본)
  SELECT COALESCE(usd_cap, v_default), usd_spent
    INTO v_cap, v_spent
  FROM tester_budget WHERE license_key = p_license_key;
  IF NOT FOUND THEN
    v_cap   := v_default;
    v_spent := 0;
  END IF;

  -- 예산 소진 → AI 호출 금지(앱에 "본인 키 입력" 유도용 distinct code)
  IF v_spent >= v_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'TESTER_BUDGET_EXCEEDED',
      'spent', v_spent, 'cap', v_cap);
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'OK',
    'spent', v_spent, 'cap', v_cap, 'remaining', v_cap - v_spent);
END;
$$;

-- ─── 2. 원자적 회계 (AI 성공 후) ─────────────────────────────────────────
--   키 단위 advisory lock으로 직렬화 → 동시 콜이 같은 키 usd_spent를 갱신해도
--   lost update 불가(모든 spend가 누적됨). cost는 DB 단가로만 계산.
--   반환 jsonb: { ok, reason?, cost?, spent? }
--     reason(실패 시): INVALID_INPUT | PRICE_NOT_CONFIGURED
CREATE OR REPLACE FUNCTION tester_ai_record_spend(
  p_license_key   text,
  p_model         text,
  p_input_tokens  integer,
  p_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in    integer := GREATEST(COALESCE(p_input_tokens,  0), 0);
  v_out   integer := GREATEST(COALESCE(p_output_tokens, 0), 0);
  v_pin   numeric;
  v_pout  numeric;
  v_cost  numeric;
  v_spent numeric;
BEGIN
  IF p_license_key IS NULL OR btrim(p_license_key) = ''
     OR p_model IS NULL OR btrim(p_model) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  END IF;

  -- 키 단위 직렬화 (HWID register/reset의 'gwlic:'와 다른 네임스페이스)
  PERFORM pg_advisory_xact_lock(hashtext('gwtester:' || p_license_key)::bigint);

  -- 단가 (서버 계산 — AI는 cost 결정 불가). 단가 없으면 회계 불가 → 실패 보고.
  SELECT input_price_per_mtok, output_price_per_mtok INTO v_pin, v_pout
  FROM tester_model_price WHERE model = p_model;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'PRICE_NOT_CONFIGURED');
  END IF;

  -- cost = (입력토큰×입력단가 + 출력토큰×출력단가) / 100만
  v_cost := (v_in::numeric * v_pin + v_out::numeric * v_pout) / 1000000;

  -- 누적 증가 (lazy upsert) — 행 없으면 생성, 있으면 더함
  INSERT INTO tester_budget (license_key, usd_spent)
  VALUES (p_license_key, v_cost)
  ON CONFLICT (license_key)
  DO UPDATE SET usd_spent = tester_budget.usd_spent + EXCLUDED.usd_spent;

  SELECT usd_spent INTO v_spent FROM tester_budget WHERE license_key = p_license_key;

  -- 콜 단위 사용 로그
  INSERT INTO tester_usage_log (license_key, model, input_tokens, output_tokens, usd_cost)
  VALUES (p_license_key, p_model, v_in, v_out, v_cost);

  RETURN jsonb_build_object('ok', true, 'cost', v_cost, 'spent', v_spent);
END;
$$;

-- ─── 3. 실행 권한 제한 (★보안 — 002 패턴) ────────────────────────────────
-- SECURITY DEFINER 함수는 RLS 우회 → anon/authenticated EXECUTE 회수, service_role만 부여.
-- Edge Function은 항상 service_role(SUPABASE_SERVICE_ROLE_KEY)로만 호출.
REVOKE EXECUTE ON FUNCTION tester_ai_gate(text, text)                          FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION tester_ai_record_spend(text, text, integer, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION tester_ai_gate(text, text)                          TO service_role;
GRANT  EXECUTE ON FUNCTION tester_ai_record_spend(text, text, integer, integer) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT tester_ai_gate('test-demo', 'claude-haiku-4-5');   -- {"ok":true,"reason":"OK",...}
-- SELECT tester_ai_gate('paid-key',  'claude-haiku-4-5');   -- {"ok":false,"reason":"NOT_TESTER"}
-- SELECT tester_ai_record_spend('test-demo','claude-haiku-4-5', 1000000, 1000000);
--   -- haiku(1.00/5.00) → cost = (1.00 + 5.00) = 6.00, spent 누적 → 다음 gate는 BUDGET_EXCEEDED
