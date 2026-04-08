-- @마이그레이션: 017_product_features_detail
-- @설명: products 테이블에 product_features jsonb[] 컬럼 추가
--        /product 페이지 확장 상세 박스에서 사용
--        각 항목: { icon, image_url, title, description }

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_features jsonb DEFAULT '[]';

COMMENT ON COLUMN products.product_features IS '/product 페이지 전용 기능 목록 (최대 12개), {icon, image_url, title, description} 형식';
