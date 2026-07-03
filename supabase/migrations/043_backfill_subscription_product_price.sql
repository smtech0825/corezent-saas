-- @마이그레이션: 043_backfill_subscription_product_price
-- @설명: 대시보드 "알 수 없음" 근본 보정 — product_price_id가 비어 옵션 라벨을 못 살리는
--        구독을, 같은 주문(order_id)에 기록된 product_price_id로 채운다.
--        구독과 그 주문은 동일 LS 체크아웃(동일 variant)에서 나오므로 값이 일치한다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행 (git push로는 DB가 바뀌지 않음)
-- @주의: orders 백필은 제외한다 — orders는 CHECK(order_type_check)로 product_price_id/bundle_id
--        중 정확히 하나만 non-null이라, product_price_id가 NULL인 주문은 번들 주문(bundle_id 존재)뿐.
--        여기에 product_price_id를 채우면 제약을 위반한다. subscriptions는 그 제약이 없어 안전.
--        표시 계층은 이미 라이선스(order_id→product_id→products.name)로 제품명을 폴백하므로,
--        이 백필은 옵션 라벨(option_axis 라벨)까지 복원하기 위한 보강이다.

UPDATE public.subscriptions s
SET    product_price_id = o.product_price_id
FROM   public.orders o
WHERE  s.order_id = o.id
  AND  s.product_price_id IS NULL
  AND  o.product_price_id IS NOT NULL;
