-- ============================================================
-- 061_orders_org_info.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 주문(orders)에 기관 구매 정보 칸 4개 추가 — 전부 선택 입력(nullable).
--   개인 주문에는 쓰지 않는 칸이라 기본값·제약 없음. 기존 행·기존 저장 경로에
--   영향이 없는 무해 추가이며, 관리자 주문 상세에서 보고 고칠 수 있다.
--   세금계산서 발급번호는 대표님이 홈택스에서 발급한 뒤 손으로 적는 칸이다
--   (자동 발급 기능 아님).
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행.
-- ⚠️ 비멱등 — 운영 재실행 금지 (기존 마이그레이션과 동일 관례).
-- ⚠️ 적용 전에도 주문 화면은 정상 동작한다(기관 정보 구역만 안내문 표시).
-- ============================================================

ALTER TABLE orders ADD COLUMN org_name         text;  -- 기관명
ALTER TABLE orders ADD COLUMN org_biz_reg_no   text;  -- 기관 사업자등록번호
ALTER TABLE orders ADD COLUMN org_contact_name text;  -- 기관 담당자
ALTER TABLE orders ADD COLUMN tax_invoice_no   text;  -- 세금계산서 발급번호(홈택스 수기 기록)

COMMENT ON COLUMN orders.org_name         IS '기관 구매 시 기관명(선택)';
COMMENT ON COLUMN orders.org_biz_reg_no   IS '기관 사업자등록번호(선택)';
COMMENT ON COLUMN orders.org_contact_name IS '기관 담당자 이름(선택)';
COMMENT ON COLUMN orders.tax_invoice_no   IS '세금계산서 발급번호 — 홈택스 발급 후 수기 기록(선택)';

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 칸 4개가 생겼는지 (4행이 나오면 정상):
--      SELECT column_name, is_nullable FROM information_schema.columns
--       WHERE table_name = 'orders'
--         AND column_name IN ('org_name','org_biz_reg_no','org_contact_name','tax_invoice_no');
-- 2) 기존 주문 조회가 여전히 성공하는지:
--      SELECT id FROM orders ORDER BY created_at DESC LIMIT 1;
