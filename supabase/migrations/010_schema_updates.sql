-- ============================================================
-- 010_schema_updates.sql
-- 설명: Lemon Squeezy 연동을 위한 스키마 업데이트
--   1. subscriptions 테이블에 billing_interval, customer_portal_url 추가
--   2. orders 테이블 order_type_check 제약 완화 (미매칭 주문 허용)
--   3. get_user_id_by_email 헬퍼 함수 추가
-- ============================================================

-- 1. subscriptions: billing_interval 추가 (monthly | annual)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text
    CHECK (billing_interval IN ('monthly', 'annual'));

-- 2. subscriptions: customer_portal_url 추가 (Lemon Squeezy 고객 포털 URL)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS customer_portal_url text;

-- 3. orders: 미매칭 주문을 허용하도록 제약 완화
--    product_price_id AND bundle_id가 모두 null이어도 lemon_squeezy_order_id가 있으면 허용
ALTER TABLE orders DROP CONSTRAINT IF EXISTS order_type_check;
ALTER TABLE orders ADD CONSTRAINT order_type_check CHECK (
  (product_price_id IS NOT NULL AND bundle_id IS NULL) OR
  (product_price_id IS NULL AND bundle_id IS NOT NULL) OR
  (product_price_id IS NULL AND bundle_id IS NULL AND lemon_squeezy_order_id IS NOT NULL)
);

-- 4. get_user_id_by_email: 이메일로 auth.users.id를 조회하는 헬퍼 함수
--    웹훅에서 구매자 이메일로 사용자를 찾을 때 사용
CREATE OR REPLACE FUNCTION get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
