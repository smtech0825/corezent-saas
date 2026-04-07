-- ============================================================
-- 011_seed_geniepost.sql
-- 설명: GeniePost 제품 및 가격 데이터 삽입
--       Lemon Squeezy Variant ID 포함
-- ============================================================

-- 1. 기존 플레이스홀더 데이터 정리 (있을 경우)
DELETE FROM product_prices WHERE lemon_squeezy_variant_id IN (
  '1498128', '1498282', '1498299', '1498325'
);

-- 2. GeniePost 제품 삽입 (이미 있으면 업데이트)
INSERT INTO products (slug, name, category, tagline, is_active, order_index)
VALUES (
  'geniepost',
  'GeniePost',
  'desktop',
  'AI-powered social media posting tool',
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  category   = EXCLUDED.category,
  tagline    = EXCLUDED.tagline,
  is_active  = EXCLUDED.is_active,
  updated_at = now();

-- 3. GeniePost 가격 플랜 삽입
-- Monthly: $6.99/mo (Variant ID: 1498299)
INSERT INTO product_prices (product_id, type, interval, price, lemon_squeezy_variant_id, is_active)
SELECT
  id,
  'subscription',
  'monthly',
  6.99,
  '1498299',
  true
FROM products WHERE slug = 'geniepost'
ON CONFLICT DO NOTHING;

-- Annual: $69/year → $5.75/mo equivalent (Variant ID: 1498325)
INSERT INTO product_prices (product_id, type, interval, price, lemon_squeezy_variant_id, is_active)
SELECT
  id,
  'subscription',
  'annual',
  69.00,
  '1498325',
  true
FROM products WHERE slug = 'geniepost'
ON CONFLICT DO NOTHING;
