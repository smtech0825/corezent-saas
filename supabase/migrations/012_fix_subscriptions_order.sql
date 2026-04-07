-- ============================================================
-- 012_fix_subscriptions_order.sql
-- 설명: subscriptions.order_id를 nullable로 변경
--       subscription_created 웹훅이 order_created보다 먼저 도착할 경우를 대비
-- ============================================================

ALTER TABLE subscriptions ALTER COLUMN order_id DROP NOT NULL;
