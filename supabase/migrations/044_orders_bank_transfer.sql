-- @마이그레이션: 044_orders_bank_transfer
-- @설명: 계좌이체(무통장 입금) 결제 지원 — orders에 결제수단·입금 컬럼 추가 + status에 'pending_deposit' 허용.
--        계좌 안내(은행·계좌번호·예금주·활성화)는 front_settings 키로 저장 → 별도 스키마 변경 없음.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(코드 배포 전에 적용)

-- 1) 결제수단 (card | bank_transfer). 기존 주문은 DEFAULT 'card'로 자동 간주
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('card', 'bank_transfer'));

-- 2) 입금자 이메일(본인 확인용), 입금 확인 시각, 입금 기한
ALTER TABLE orders ADD COLUMN IF NOT EXISTS depositor_email      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_confirmed_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_expires_at   timestamptz;

-- 3) status에 '입금 대기(pending_deposit)' 추가 — 기존 CHECK 교체
--    (기존 제약명은 003에서 인라인 정의된 orders_status_check. 이름이 다르면 실제 제약명으로 교체)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled', 'pending_deposit'));

COMMENT ON COLUMN orders.payment_method       IS '결제수단: card(LS) | bank_transfer(무통장 입금)';
COMMENT ON COLUMN orders.depositor_email      IS '계좌이체 입금자 확인용 이메일(가입 이메일과 일치 검증)';
COMMENT ON COLUMN orders.deposit_confirmed_at IS '관리자가 입금 확인한 시각(확인 시 status=paid)';
COMMENT ON COLUMN orders.deposit_expires_at   IS '입금 기한(생성 +3일). 경과 시 admin에 기한 초과 표시';
