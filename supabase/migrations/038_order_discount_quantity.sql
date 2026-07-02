-- @마이그레이션: 038_order_discount_quantity
-- @설명: 주문에 할인 금액·수량 컬럼 추가
--        - discount_amount: LS 웹훅 order_created의 discount_total(정수 cents, 할인코드 적용 금액)
--        - quantity: 같은 상품 N개 구매 수량 (LS first_order_item/first_subscription_item.quantity)
--        코드는 기본값(할인 0·수량 1)이면 컬럼을 생략해 INSERT하므로,
--        이 마이그레이션은 "코드 배포 전에" 적용해야 할인·수량 주문이 정상 기록된다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 1);

COMMENT ON COLUMN orders.discount_amount IS 'LS 할인코드 적용 금액 (정수 cents — amount와 동일 단위, ÷100 표시)';
COMMENT ON COLUMN orders.quantity IS '구매 수량 (같은 상품 N개 — 라이선스 N개 발급과 대응)';
