-- ============================================================
-- 030_affiliate_credit_rpc.sql
-- 설명: Wave 6 — 크레딧 적립전환·반전(클로백)·차감을 "원자적 RPC"로 제공.
--       모든 크레딧 변경은 단일 함수(=단일 트랜잭션) 안에서 사용자별 advisory lock
--       (+ 커미션 행 FOR UPDATE)로 직렬화 → 앱 측 read-then-write 금지, 음수잔액 금지.
--       추가로 affiliate_clicks에 '본인 추천코드 조회' RLS를 부여(대시보드 server 클라 전환용).
-- ============================================================

-- ── 1. 커미션 → 크레딧 전환 (관리자 승인) ─────────────────────────────
-- 게이트: pending + available_at 경과 + 합계 ≥ min_payout_credit.
-- 통과 시 payouts 기록 + 해당 커미션 paid + payout_id + ledger 적립을 한 트랜잭션으로.
CREATE OR REPLACE FUNCTION convert_referrer_commissions(p_referrer uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min     bigint;
  v_total   bigint;
  v_ids     uuid[];
  v_balance bigint;
  v_payout  uuid;
BEGIN
  SELECT min_payout_credit INTO v_min FROM affiliate_program_config WHERE id = true;
  IF v_min IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_config');
  END IF;

  -- 사용자 크레딧 작업 직렬화
  PERFORM pg_advisory_xact_lock(hashtext('sc:' || p_referrer::text)::bigint);

  -- 전환 대상 스냅샷(동일 집합을 합산·갱신에 사용)
  SELECT COALESCE(SUM(commission_amount_cents), 0), array_agg(id)
    INTO v_total, v_ids
  FROM affiliate_commissions
  WHERE referrer_user_id = p_referrer
    AND status = 'pending'
    AND available_at <= now();

  -- v_total<=0 도 차단(payout amount_cents>0 CHECK 위반·빈 전환 방지)
  IF v_total <= 0 OR v_total < v_min THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'below_min', 'total', v_total, 'min', v_min);
  END IF;

  -- payout 배치 기록
  INSERT INTO affiliate_payouts (referrer_user_id, amount_cents, status)
  VALUES (p_referrer, v_total, 'completed')
  RETURNING id INTO v_payout;

  -- 정확히 스냅샷 대상만 paid 처리
  UPDATE affiliate_commissions
  SET status = 'paid', payout_id = v_payout
  WHERE id = ANY(v_ids);

  -- 스토어 크레딧 적립(원장)
  SELECT COALESCE(SUM(delta_cents), 0) INTO v_balance
  FROM store_credit_ledger WHERE user_id = p_referrer;

  INSERT INTO store_credit_ledger (user_id, delta_cents, reason, ref_id, balance_after_cents)
  VALUES (p_referrer, v_total, 'affiliate_commission', v_payout::text, v_balance + v_total);

  RETURN jsonb_build_object('ok', true, 'payout', v_payout, 'amount', v_total, 'count', array_length(v_ids, 1));
END;
$$;

-- ── 2. 커미션 반전 + 클로백 (환불/실패) ───────────────────────────────
-- source(type,id) 매칭 커미션을 reversed 처리. 이미 paid면 클로백:
--   잔액 충분 → 음수 원장 기록, 부족(이미 사용) → 음수 안 만들고 needs_admin_review.
CREATE OR REPLACE FUNCTION reverse_affiliate_commissions(p_source_type text, p_source_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_balance  bigint;
  v_reversed int := 0;
  v_clawed   int := 0;
  v_flagged  int := 0;
BEGIN
  FOR r IN
    SELECT id, referrer_user_id, commission_amount_cents, status
    FROM affiliate_commissions
    WHERE source_type = p_source_type AND source_id = p_source_id
    FOR UPDATE
  LOOP
    IF r.status = 'reversed' THEN CONTINUE; END IF; -- 멱등

    PERFORM pg_advisory_xact_lock(hashtext('sc:' || r.referrer_user_id::text)::bigint);

    IF r.status = 'paid' THEN
      SELECT COALESCE(SUM(delta_cents), 0) INTO v_balance
      FROM store_credit_ledger WHERE user_id = r.referrer_user_id;

      IF v_balance >= r.commission_amount_cents THEN
        INSERT INTO store_credit_ledger (user_id, delta_cents, reason, ref_id, balance_after_cents)
        VALUES (r.referrer_user_id, -r.commission_amount_cents, 'clawback', r.id::text, v_balance - r.commission_amount_cents);
        UPDATE affiliate_commissions SET status = 'reversed' WHERE id = r.id;
        v_clawed := v_clawed + 1;
      ELSE
        UPDATE affiliate_commissions
        SET status = 'reversed',
            needs_admin_review = true,
            review_reason = '환불 클로백 불가: 잔액(' || v_balance || ') < 커미션(' || r.commission_amount_cents || ') cents'
        WHERE id = r.id;
        v_flagged := v_flagged + 1;
      END IF;
    ELSE
      UPDATE affiliate_commissions SET status = 'reversed' WHERE id = r.id;
      v_reversed := v_reversed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reversed', v_reversed, 'clawed_back', v_clawed, 'flagged', v_flagged);
END;
$$;

-- ── 3. 스토어 크레딧 차감 (체크아웃 할인 발급/사용) ────────────────────
-- 잔액 ≥ 차감액일 때만 음수 원장 기록(음수잔액 금지). 부족하면 차감 없이 실패 반환.
CREATE OR REPLACE FUNCTION redeem_store_credit(p_user uuid, p_amount bigint, p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sc:' || p_user::text)::bigint);

  SELECT COALESCE(SUM(delta_cents), 0) INTO v_balance
  FROM store_credit_ledger WHERE user_id = p_user;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance);
  END IF;

  INSERT INTO store_credit_ledger (user_id, delta_cents, reason, ref_id, balance_after_cents)
  VALUES (p_user, -p_amount, 'checkout_redeem', p_ref, v_balance - p_amount);

  RETURN jsonb_build_object('ok', true, 'balance', v_balance - p_amount);
END;
$$;

-- ── 3.5 함수 실행 권한 제한 (★보안) ──────────────────────────────────
-- SECURITY DEFINER 함수는 RLS를 우회한다. Supabase는 public 스키마 신규 함수의
-- EXECUTE를 anon/authenticated에 기본 부여하므로, 권한을 회수하지 않으면
-- anon 키만으로 redeem_store_credit('<타인>', ...) 등을 직접 호출해 타인 자산을
-- 변조할 수 있다. 앱은 항상 service_role(admin 클라)로만 호출하므로 service_role만 허용.
REVOKE EXECUTE ON FUNCTION convert_referrer_commissions(uuid)        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reverse_affiliate_commissions(text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION redeem_store_credit(uuid, bigint, text)   FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION convert_referrer_commissions(uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION reverse_affiliate_commissions(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION redeem_store_credit(uuid, bigint, text)   TO service_role;

-- ── 4. affiliate_clicks: 본인 추천코드 클릭 조회 RLS ───────────────────
-- 대시보드를 admin 클라 → 일반 server 클라(RLS)로 전환하기 위함.
-- 본인 profiles.affiliate_code 와 일치하는 클릭만 SELECT 허용.
CREATE POLICY "본인 코드 클릭 조회"
  ON affiliate_clicks FOR SELECT
  USING (
    referral_code IN (SELECT affiliate_code FROM profiles WHERE id = auth.uid())
  );
