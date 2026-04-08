-- @마이그레이션: 015_tags_pricing_features
-- @설명: products 테이블에 tags, pricing_features 컬럼 추가

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pricing_features text[] DEFAULT '{}';

COMMENT ON COLUMN products.tags IS '상품 태그 (최대 5개), /product + /pricing 페이지에 pill 뱃지로 표시';
COMMENT ON COLUMN products.pricing_features IS '/pricing 페이지 전용 기능 목록 (최대 4개), "Title: Description" 형식';
