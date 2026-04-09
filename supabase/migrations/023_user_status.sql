-- ============================================================
-- 023_user_status.sql
-- 설명: profiles 테이블에 status 컬럼 추가
--       active: 정상 사용자 | inactive: 탈퇴(소프트 삭제) 처리된 사용자
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

-- 기존 유저 전체 active로 초기화 (이미 DEFAULT로 처리되지만 명시)
UPDATE profiles SET status = 'active' WHERE status IS NULL;
