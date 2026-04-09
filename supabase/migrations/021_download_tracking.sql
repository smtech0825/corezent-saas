-- ============================================================
-- 021_download_tracking.sql
-- 설명: licenses 테이블에 last_downloaded_version 컬럼 추가
--       사용자가 마지막으로 다운로드한 버전을 추적해 "New" 배지 표시에 활용
-- ============================================================

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS last_downloaded_version text;
