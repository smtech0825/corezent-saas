-- ============================================================
-- 033_marketing_opt_in.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트) — profiles 테이블
-- 설명: 회원의 "알림/마케팅 이메일 수신 동의" 저장용 boolean 컬럼 추가.
--       설정(대시보드 > 설정) 화면의 수신 동의 토글이 이 값을 읽고/저장한다.
--
-- 기본값: true  (기존 회원은 '수신 동의' 상태로 시작 → 설정에서 언제든 해제 가능)
--   ⚠️ 마케팅 법규상 명시적 opt-in(기본 미동의)을 원하면 아래 DEFAULT를 false로
--      바꿔서 적용하세요. (컬럼 추가 후 기존 행에도 이 기본값이 채워집니다.)
--
-- 적용 방법: Steve가 Supabase SQL Editor에서 직접 실행.
--   (Claude Code는 외부/DB에 직접 적용하지 않음. git push로도 DB는 바뀌지 않음.)
-- 비파괴: ADD COLUMN IF NOT EXISTS — 기존 데이터/컬럼에 영향 없음, 재실행 안전.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT true;
