-- ============================================================
-- 068_profiles_org_info.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 회원 프로필(profiles)에 기관 구매 정보 칸 4개 추가 — 전부 선택 입력(nullable).
--   기관 담당자가 대시보드 설정에 한 번 저장해 두면, 대표님이 세금계산서를 발행할 때
--   관리자 사용자 상세에서 바로 확인할 수 있다. 개인 구매자는 비워 두는 칸이다.
--
--   ⚠️ 주문의 기관 정보(orders.org_*, 061)와는 별개다.
--      · profiles.org_*  = 회원이 저장해 둔 "기본값"(다음에도 쓰는 내 기관 정보)
--      · orders.org_*    = 그 주문 한 건에 확정된 값(관리자가 보고 고침)
--      값이 자동으로 옮겨가지는 않는다. 옮기는 흐름은 별도 작업으로 다룬다.
--
--   저장 형식:
--     · org_biz_reg_no    — 숫자 10자리만(하이픈 없이). 앱의 src/lib/bizRegNo.ts가
--                           저장 전에 정규화하고 검증(체크디짓)까지 한다.
--     · tax_invoice_email — 세금계산서를 받을 주소. 로그인 이메일과 다를 수 있어
--                           별도 칸으로 둔다(회계 담당자 주소인 경우가 흔하다).
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행.
-- ⚠️ 적용 전에도 화면은 정상 동작한다 — 설정의 「기관 정보」 구역만 나타나지 않는다.
--
-- RLS/트리거 영향:
--   · UPDATE 정책 "본인 프로필만 수정 가능"(001, auth.uid() = id)으로 본인이 수정 가능.
--   · prevent_self_privilege_escalation 트리거(047)는 role·status만 잠그므로 무관.
--   · handle_new_user() 트리거는 건드리지 않는다(031에서 확인된 라이브 드리프트).
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_name         text;  -- 기관·회사명
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_biz_reg_no   text;  -- 사업자등록번호(숫자 10자리)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_contact_name text;  -- 기관 담당자 이름
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_invoice_email text; -- 세금계산서 수신 이메일

COMMENT ON COLUMN profiles.org_name          IS '기관 구매 시 기관·회사명(선택)';
COMMENT ON COLUMN profiles.org_biz_reg_no    IS '사업자등록번호 — 하이픈 없는 숫자 10자리(선택)';
COMMENT ON COLUMN profiles.org_contact_name  IS '기관 담당자 이름(선택)';
COMMENT ON COLUMN profiles.tax_invoice_email IS '세금계산서 수신 이메일 — 로그인 이메일과 다를 수 있음(선택)';

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 칸 4개가 생겼는지 (4행이 나오면 정상):
--      SELECT column_name, is_nullable FROM information_schema.columns
--       WHERE table_name = 'profiles'
--         AND column_name IN ('org_name','org_biz_reg_no','org_contact_name','tax_invoice_email');
-- 2) 기존 프로필 조회가 여전히 성공하는지:
--      SELECT id, name FROM profiles ORDER BY created_at DESC LIMIT 1;
