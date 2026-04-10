-- Migration 024: subscriptions 테이블에 cancellation_reason 컬럼 추가
-- 구독 취소 시 사용자가 선택한 취소 사유를 저장합니다.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
