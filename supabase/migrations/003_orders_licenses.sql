-- ============================================================
-- 003_orders_licenses.sql
-- 설명: 주문, 라이선스, 라이선스 활성화, 구독 테이블 및 RLS
-- ============================================================

-- 주문 테이블
CREATE TABLE orders (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  product_price_id        uuid        REFERENCES product_prices(id),  -- null이면 번들 주문
  bundle_id               uuid        REFERENCES bundles(id),          -- null이면 단품 주문
  lemon_squeezy_order_id  text        UNIQUE,
  status                  text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
  amount                  numeric     NOT NULL CHECK (amount >= 0),
  currency                text        NOT NULL DEFAULT 'USD',
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_type_check CHECK (
    (product_price_id IS NOT NULL AND bundle_id IS NULL) OR
    (product_price_id IS NULL AND bundle_id IS NOT NULL)
  )
);

-- 라이선스 테이블
CREATE TABLE licenses (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id                  uuid        NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id                uuid        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_key                text        NOT NULL UNIQUE,
  status                    text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'revoked')),
  max_devices               int,        -- null = 무제한
  expires_at                timestamptz, -- null = 영구
  download_url              text,
  lemon_squeezy_license_key text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- 라이선스 기기 활성화 기록
CREATE TABLE license_activations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id         uuid        NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_fingerprint text        NOT NULL,
  device_name        text,
  activated_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (license_id, device_fingerprint)
);

-- 구독 테이블 (Lemon Squeezy 구독 상태 동기화)
CREATE TABLE subscriptions (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id                      uuid        NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_price_id              uuid        REFERENCES product_prices(id),
  bundle_id                     uuid        REFERENCES bundles(id),
  lemon_squeezy_subscription_id text        UNIQUE,
  status                        text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  current_period_start          timestamptz,
  current_period_end            timestamptz,
  cancel_at_period_end          bool        NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 시리얼 키 자동 생성 함수 (XXXX-XXXX-XXXX-XXXX 형식)
CREATE OR REPLACE FUNCTION generate_serial_key()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 혼동되는 문자 제외
  key   text := '';
  i     int;
BEGIN
  FOR i IN 1..4 LOOP
    key := key || substring(chars, (floor(random() * length(chars)) + 1)::int, 1)
                || substring(chars, (floor(random() * length(chars)) + 1)::int, 1)
                || substring(chars, (floor(random() * length(chars)) + 1)::int, 1)
                || substring(chars, (floor(random() * length(chars)) + 1)::int, 1);
    IF i < 4 THEN key := key || '-'; END IF;
  END LOOP;
  RETURN key;
END;
$$;

-- RLS
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;

-- 주문: 본인 것만 조회
CREATE POLICY "본인 주문만 조회"
  ON orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "관리자 전체 주문 조회"
  ON orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 주문 수정"
  ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "서비스 역할 주문 삽입 (Webhook)"
  ON orders FOR INSERT WITH CHECK (true);

-- 라이선스: 본인 것만 조회
CREATE POLICY "본인 라이선스만 조회"
  ON licenses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "관리자 전체 라이선스 조회"
  ON licenses FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 라이선스 수정"
  ON licenses FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "서비스 역할 라이선스 삽입 (Webhook)"
  ON licenses FOR INSERT WITH CHECK (true);

-- 기기 활성화: 본인 라이선스에 연결된 것만 조회
CREATE POLICY "본인 라이선스 활성화 기록 조회"
  ON license_activations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM licenses WHERE id = license_id AND user_id = auth.uid())
  );

-- 구독: 본인 것만 조회
CREATE POLICY "본인 구독만 조회"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "관리자 전체 구독 조회"
  ON subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "서비스 역할 구독 삽입/수정 (Webhook)"
  ON subscriptions FOR ALL WITH CHECK (true);
