-- ============================================================
-- 049_admin_activity_log.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 관리자 활동 로그 — 라이선스 회수·환불/구독취소·사용자 role 변경/탈퇴 처리·
--       상품 삭제/비활성화 등 민감한 관리자 작업의 감사 추적(audit trail).
--       기록은 서버(service_role, lib/adminActivityLog.ts)에서만 insert, 조회는 관리자만.
--       이번 마이그레이션은 기록 적재까지만 — 조회 UI는 범위 밖(별도 요청 시 진행).
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        NOT NULL REFERENCES auth.users(id),
  action        text        NOT NULL,   -- 예: 'license.revoke' · 'order.refund' · 'subscription.cancel' ·
                                         --     'user.role_change' · 'user.withdraw' · 'product.delete' ·
                                         --     'product.deactivate' · 'product.toggle_active'
  target_type   text        NOT NULL,   -- 예: 'license' · 'order' · 'subscription' · 'user' · 'product'
  target_id     text        NOT NULL,
  detail        jsonb,                  -- 변경 전/후 값 등 자유 형식
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin  ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_target ON admin_activity_log(target_type, target_id);

-- RLS: 관리자만 조회 가능. INSERT 정책은 두지 않음(=service_role만 가능, anon/authenticated는
-- 정책 없음으로 기본 거부 — RLS Wave A/B에서 정리한 "TO 없이 WITH CHECK(true)" 실수를 반복하지 않음).
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_activity_log" ON admin_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'admin_activity_log';
--   → "admin_read_activity_log"(SELECT) 1개만 있어야 함. INSERT는 service_role만(정책 없음=거부).
-- ============================================================
