-- ============================================================
-- 067_orders_provider_raw_and_system_log.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 주문 금액 통화 안전장치용 스키마 2가지.
--   1) orders 에 결제사가 보낸 "원본 금액·통화" 보존 컬럼 2개 추가
--   2) admin_activity_log.admin_user_id 를 널 허용으로 바꿔 시스템(웹훅) 경고를 남길 수 있게 함
--
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행. (CC는 DB에 직접 적용하지 않음.)
-- 비파괴: 기존 행을 바꾸지 않는다. 새 컬럼은 전부 NULL로 시작하고, 새 주문부터만 채워진다.
-- 미적용 상태에서도 코드는 깨지지 않는다:
--   · 웹훅이 컬럼 존재를 한 번 확인해(hasProviderRawColumns) 없으면 그 컬럼을 빼고 저장한다.
--   · 시스템 경고 기록은 실패하지만 서버 로그(Vercel)에는 같은 내용이 남고 주문 처리는 계속된다.
-- ============================================================

-- ── 1. 결제사 원본 금액·통화 보존 ─────────────────────────────
--   왜 필요한가: orders.amount 는 "그 통화의 최소단위 정수"라는 우리 규약을 따르는 값이다.
--   결제사가 어떤 단위로 보냈는지는 나중에 규약을 바꾸면 되돌아볼 수 없게 되므로,
--   받은 값 자체를 손대지 않고 따로 남긴다. (첫 실결제에서 단위 규약을 눈으로 확인하는 용도)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_raw_amount numeric;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS provider_raw_currency text;

COMMENT ON COLUMN orders.provider_raw_amount IS
  '결제사(LemonSqueezy)가 웹훅으로 보낸 금액 원본값. 가공하지 않는다. 과거 주문은 NULL';

COMMENT ON COLUMN orders.provider_raw_currency IS
  '결제사가 웹훅으로 보낸 통화 코드 원본값. 과거 주문은 NULL';

-- ── 2. 시스템이 남기는 활동 기록 허용 ─────────────────────────
--   admin_activity_log.admin_user_id 는 지금까지 NOT NULL 이라 "사람이 한 일"만 남길 수 있었다.
--   결제 웹훅이 남기는 금액 단위 경고는 주인이 되는 관리자가 없으므로 NULL을 허용한다.
--   조회 화면(/admin/activity)은 admin_user_id 가 NULL 이면 '시스템'으로 표시한다.
--   ⚠️ 권한은 그대로다 — INSERT 정책은 여전히 없고(=service_role 전용), SELECT는 관리자만.
ALTER TABLE admin_activity_log
  ALTER COLUMN admin_user_id DROP NOT NULL;

-- ─── 적용 후 검증 ─────────────────────────────────────────────
-- SELECT column_name, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'orders'
--    AND column_name IN ('provider_raw_amount', 'provider_raw_currency');
--   → 2행, 둘 다 YES 면 정상.
--
-- SELECT is_nullable FROM information_schema.columns
--  WHERE table_name = 'admin_activity_log' AND column_name = 'admin_user_id';
--   → YES 면 정상.

-- ------------------------------------------------------------------
-- 되돌리기(ROLLBACK)
-- ⚠️ 1)은 기록해 둔 결제사 원본값이 함께 사라진다. 실행 전 백업할 것:
--     SELECT id, lemon_squeezy_order_id, provider_raw_amount, provider_raw_currency FROM orders;
--
--   ALTER TABLE orders DROP COLUMN IF EXISTS provider_raw_amount;
--   ALTER TABLE orders DROP COLUMN IF EXISTS provider_raw_currency;
--
-- ⚠️ 2)는 admin_user_id 가 NULL 인 행이 하나라도 있으면 실패한다.
--    되돌리려면 시스템 기록을 먼저 지우거나 옮긴 뒤 실행할 것:
--     SELECT count(*) FROM admin_activity_log WHERE admin_user_id IS NULL;
--
--   ALTER TABLE admin_activity_log ALTER COLUMN admin_user_id SET NOT NULL;
-- ------------------------------------------------------------------
