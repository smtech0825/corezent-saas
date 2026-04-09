-- ============================================================
-- 020_support_user_read.sql
-- 설명: 지원 티켓 사용자 읽음 시각 + 알림 뱃지 지원
--   ★ 멱등(idempotent) — 여러 번 실행해도 안전 ★
-- ============================================================

-- 사용자가 마지막으로 해당 티켓을 열어본 시각 (뱃지 알림 기준)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_last_read_at timestamptz;
