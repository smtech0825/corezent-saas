-- ============================================================
-- 051_license_reset_log.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: fix-corezent-security-wave.md Wave 4(옵션 3) — /api/license/reset 호출 모니터링.
--       로그인/소유권 검증은 데스크톱 앱 개편이 필요해 이번엔 넣지 않고(별도 정책 결정
--       대기), 대신 호출될 때마다 "어떤 키·언제·어떤 product"인지 기록만 남긴다.
--
--       기존 남용방지 로직(license-migrations/002~004, GW_SUPABASE)의
--       license_event_log는 GenieWork 전용 프로젝트에만 있고, 그마저도 rate-limit에
--       걸려 거부된 시도는 기록하지 않는다(성공한 reset만 INSERT). 이 테이블은 GeniePost
--       (Sheets)·GenieStock·GenieWork 세 경로가 공유하는 reset/route.ts 진입점에서
--       제품·성공여부 무관하게 매 호출을 기록해, 관리자가 한 곳에서 세 제품을 함께 본다.
-- ============================================================

CREATE TABLE IF NOT EXISTS license_reset_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key  text        NOT NULL,
  product      text        NOT NULL CHECK (product IN ('geniepost', 'geniestock', 'geniework')),
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_reset_log_key     ON license_reset_log(license_key);
CREATE INDEX IF NOT EXISTS idx_license_reset_log_created ON license_reset_log(created_at);

-- RLS: 관리자만 조회 가능. INSERT 정책은 두지 않음(=service_role만 가능 — 047~050과 동일 패턴).
ALTER TABLE license_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_license_reset_log" ON license_reset_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'license_reset_log';
--   → "admin_read_license_reset_log"(SELECT) 1개만 있어야 함. INSERT는 service_role만(정책 없음=거부).
-- ============================================================
