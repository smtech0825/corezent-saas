-- ============================================================
-- 034_notification_logs.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 이메일 발송(성공/실패)·LS 웹훅 처리 실패를 기록하는 모니터링 로그 테이블.
--       관리자(/admin/logs)에서 조회한다. 기록은 best-effort(서버가 삽입 실패해도 주 흐름 무영향).
--
-- 적용: Steve가 Supabase SQL Editor에서 직접 실행. (CC는 DB에 직접 적용하지 않음.)
-- 비파괴: CREATE TABLE IF NOT EXISTS — 재실행 안전.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text        NOT NULL CHECK (kind IN ('email', 'webhook')),
  status     text        NOT NULL CHECK (status IN ('success', 'failure')),
  event      text,        -- 이메일 제목 또는 웹훅 event_name
  target     text,        -- 수신자 이메일 또는 order_id/subscription_id 등
  error      text,        -- 실패 사유(성공이면 null)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 (관리자 화면은 service role로 조회하지만, 일반 경로 차단용 정책도 명시)
DROP POLICY IF EXISTS "관리자 로그 조회" ON notification_logs;
CREATE POLICY "관리자 로그 조회"
  ON notification_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 서버(서비스 역할) 삽입
DROP POLICY IF EXISTS "서비스 역할 로그 삽입" ON notification_logs;
CREATE POLICY "서비스 역할 로그 삽입"
  ON notification_logs FOR INSERT WITH CHECK (true);
