-- ============================================================
-- 002_products.sql
-- 설명: 상품, 가격, 번들 테이블 및 RLS 정책
-- ============================================================

-- 상품 테이블
CREATE TABLE products (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text        NOT NULL UNIQUE,
  name                  text        NOT NULL,
  category              text        NOT NULL CHECK (category IN ('desktop', 'web', 'chrome-extension')),
  tagline               text,
  description           text,       -- Markdown
  logo_url              text,
  images                jsonb       DEFAULT '[]',   -- string[]
  manual_url            text,       -- 구글 사이트 링크 (로그인한 구매자만 활성화)
  is_active             bool        NOT NULL DEFAULT true,
  -- 라이선스 검증 방식 (상품별 선택)
  license_validation    jsonb       NOT NULL DEFAULT '{"self": false, "server": false, "lemon_squeezy": false}',
  max_devices           int,        -- null = 무제한
  license_duration_days int,        -- null = 영구
  order_index           int         DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 상품 가격 테이블 (상품 하나에 여러 가격 플랜 가능)
CREATE TABLE product_prices (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  uuid    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type                        text    NOT NULL CHECK (type IN ('subscription', 'one_time')),
  interval                    text    CHECK (interval IN ('monthly', 'annual')), -- subscription 시 필수
  price                       numeric NOT NULL CHECK (price >= 0),
  lemon_squeezy_product_id    text,
  lemon_squeezy_variant_id    text,
  is_active                   bool    NOT NULL DEFAULT true
);

-- 번들 테이블
CREATE TABLE bundles (
  id                                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                              text        NOT NULL,
  tagline                           text,
  badge                             text,
  savings_note                      text,
  monthly_price                     numeric     NOT NULL CHECK (monthly_price >= 0),
  annual_price                      numeric     NOT NULL CHECK (annual_price >= 0),
  lemon_squeezy_monthly_variant_id  text,
  lemon_squeezy_annual_variant_id   text,
  is_active                         bool        NOT NULL DEFAULT true,
  created_at                        timestamptz NOT NULL DEFAULT now()
);

-- 번들-상품 연결 테이블
CREATE TABLE bundle_products (
  bundle_id  uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, product_id)
);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_products ENABLE ROW LEVEL SECURITY;

-- 상품은 누구나 조회 가능 (비로그인 포함)
CREATE POLICY "상품 전체 공개 조회"
  ON products FOR SELECT USING (true);

CREATE POLICY "가격 전체 공개 조회"
  ON product_prices FOR SELECT USING (true);

CREATE POLICY "번들 전체 공개 조회"
  ON bundles FOR SELECT USING (true);

CREATE POLICY "번들-상품 전체 공개 조회"
  ON bundle_products FOR SELECT USING (true);

-- 관리자만 추가/수정/삭제
CREATE POLICY "관리자만 상품 추가/수정/삭제"
  ON products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자만 가격 추가/수정/삭제"
  ON product_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자만 번들 추가/수정/삭제"
  ON bundles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자만 번들-상품 추가/삭제"
  ON bundle_products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
