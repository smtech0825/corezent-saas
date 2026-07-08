-- ============================================================
-- 047_rls_critical_fixes_wave_a.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: RLS 감사(rls-audit-report) Critical 발견 Wave A — 기계적 수정
--   A-1) profiles: 본인 role/status 자가 변경 차단 트리거
--   A-2) orders/licenses/subscriptions/notification_logs: TO 제한 없는
--        "서비스 역할용" 정책 삭제 (service_role은 RLS를 우회하므로 정책 자체가
--        불필요 — 있으면 anon/authenticated에도 열림)
--
-- 적용 방법: Steve가 Supabase SQL Editor에서 직접 실행.
-- 사전 확인 근거(코드 grep, 이 세션에서 확인):
--   - profiles.role/status 변경: admin/users/actions.ts(changeRole·withdrawUser),
--     dashboard/settings/withdraw-actions.ts(withdrawSelf) — 전부 createAdminClient() 사용.
--     dashboard/settings/page.tsx의 본인 수정(name/country/marketing_opt_in)은
--     role·status를 건드리지 않으므로 트리거 영향 없음.
--   - orders/licenses/subscriptions INSERT/UPDATE: api/webhooks/lemonsqueezy/route.ts
--     전체 함수가 각자 createAdminClient()로 admin 인스턴스를 만들어 사용.
--   - notification_logs INSERT: lib/notification-log.ts의 logNotification()이
--     유일한 삽입 지점이며 createAdminClient() 사용.
-- ============================================================

-- ── A-1. profiles: role/status 자가 변경 차단 (컬럼 잠금 트리거) ────────────
--    profiles 전체 컬럼(001·023·028·033·045) 검토 결과, 권한/신원에 직결되는
--    컬럼은 role(관리자 권한)·status(탈퇴/재활성화) 2개뿐. 나머지(name·avatar_url·
--    country·affiliate_code·referred_by·marketing_opt_in·payout_*)는 본인이
--    자유롭게 바꿔도 되는 자기서비스 필드라 트리거 대상에서 제외.
CREATE OR REPLACE FUNCTION prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role(서버 admin 클라이언트)은 우회 — RLS 자체를 안 타므로 이 트리거도
  -- 원래 안 걸리지만, 정책이 바뀌어도 안전하도록 명시적으로 한 번 더 방어한다.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role 컬럼은 관리자만 변경할 수 있습니다';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status 컬럼은 관리자만 변경할 수 있습니다';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_privilege_escalation();

-- ── A-2. orders/licenses/subscriptions/notification_logs: 열린 정책 삭제 ───
--    TO 절이 없는 "서비스 역할용" 정책은 PUBLIC(anon+authenticated 포함)에 적용되어
--    누구나 INSERT(및 subscriptions는 SELECT/UPDATE/DELETE까지) 가능했다.
--    service_role은 RLS를 완전히 우회하므로 이 정책들은 원래 불필요 — 삭제로 처리.
DROP POLICY IF EXISTS "서비스 역할 주문 삽입 (Webhook)"    ON orders;
DROP POLICY IF EXISTS "서비스 역할 라이선스 삽입 (Webhook)"  ON licenses;
DROP POLICY IF EXISTS "서비스 역할 구독 삽입/수정 (Webhook)" ON subscriptions;
DROP POLICY IF EXISTS "서비스 역할 로그 삽입"               ON notification_logs;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 트리거 등록 확인:
--      SELECT tgname FROM pg_trigger WHERE tgrelid = 'profiles'::regclass
--        AND tgname = 'trg_prevent_self_privilege_escalation';
-- 2) 정책 삭제 확인(0행이어야 함):
--      SELECT policyname FROM pg_policies WHERE tablename IN
--        ('orders','licenses','subscriptions','notification_logs')
--        AND policyname LIKE '서비스 역할%';
-- 3) 남은 정책 확인(각 테이블의 최종 정책 목록 — 아래 "최종 정책 목록" 참고):
--      SELECT tablename, policyname, cmd FROM pg_policies
--        WHERE tablename IN ('orders','licenses','subscriptions','notification_logs')
--        ORDER BY tablename, cmd;
-- ============================================================
