-- 상품 뱃지 텍스트 + 색상 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS badge_text  text,
  ADD COLUMN IF NOT EXISTS badge_color text NOT NULL DEFAULT 'blue'
    CHECK (badge_color IN ('blue', 'green', 'yellow'));
