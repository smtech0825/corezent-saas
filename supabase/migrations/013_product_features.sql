-- ============================================================
-- 013_product_features.sql
-- 설명: products 테이블에 features JSONB 컬럼 추가
--       /product 페이지에 표시될 상품 특징 목록 저장
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]';
