-- Migration 026: product_prices 테이블에 checkout_url 컬럼 추가
-- LS 체크아웃 URL (구매 버튼용) — lemon_squeezy_variant_id와 별도 관리
-- variant_id: 웹훅 매칭용 숫자 ID
-- checkout_url: 실제 구매 페이지 URL (https://store.lemonsqueezy.com/checkout/buy/xxx)

ALTER TABLE public.product_prices
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;
