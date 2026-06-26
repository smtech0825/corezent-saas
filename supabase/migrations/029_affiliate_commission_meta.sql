-- ============================================================
-- 029_affiliate_commission_meta.sql
-- 설명: Wave 4(웹훅 적립)에 필요한 affiliate_commissions 보조 컬럼.
--       028 적용 후 이어서 적용한다.
--
--   - subscription_id  : LS 구독 ID. 갱신(subscription_renewal) 적립을
--                        recurring_months_cap에 맞춰 "구독 단위"로 카운트하기 위함.
--   - needs_admin_review: 환불 클로백 불가(이미 사용해 잔액 부족) 등 관리자 검토 필요 플래그.
--   - review_reason    : 검토 사유 메모.
-- ============================================================

ALTER TABLE affiliate_commissions
  ADD COLUMN IF NOT EXISTS subscription_id    text,
  ADD COLUMN IF NOT EXISTS needs_admin_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason      text;

-- 갱신 적립 캡 카운트용 (구독별 source_type='subscription_renewal' 개수 조회)
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_subscription
  ON affiliate_commissions(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- 관리자 검토 대기 목록 조회용
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_review
  ON affiliate_commissions(needs_admin_review)
  WHERE needs_admin_review = true;
