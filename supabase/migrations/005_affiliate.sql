-- ============================================================
-- 005_affiliate.sql
-- 설명: Affiliate(추천인) 시스템 테이블 및 RLS
--       추천인 링크 방식, 수수료%, 최소 출금 금액은 front_settings에서 설정
-- ============================================================

-- Affiliate 계정 (회원당 1개)
CREATE TABLE affiliates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  total_earnings    numeric     NOT NULL DEFAULT 0 CHECK (total_earnings >= 0),
  available_balance numeric     NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 추천 기록 (추천인 코드로 가입 후 구매 시 생성)
CREATE TABLE affiliate_referrals (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id         uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_rate  numeric     NOT NULL, -- 기록 시점의 수수료율 (%)
  commission_amount numeric    NOT NULL CHECK (commission_amount >= 0),
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 출금 요청
CREATE TABLE affiliate_withdrawals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL CHECK (amount > 0),
  method       text        NOT NULL CHECK (method IN ('bank_transfer', 'paypal')),
  -- 계좌이체: { bank, account_number, holder }
  -- PayPal:   { paypal_email }
  account_info jsonb       NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  admin_note   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- RLS
ALTER TABLE affiliates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawals  ENABLE ROW LEVEL SECURITY;

-- 본인 affiliate 계정만 조회
CREATE POLICY "본인 affiliate 조회"
  ON affiliates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 추천 기록 조회"
  ON affiliate_referrals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_id AND user_id = auth.uid())
  );

CREATE POLICY "본인 출금 요청 조회"
  ON affiliate_withdrawals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_id AND user_id = auth.uid())
  );

CREATE POLICY "본인 출금 요청 생성"
  ON affiliate_withdrawals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_id AND user_id = auth.uid())
  );

-- 관리자: 전체 조회/수정
CREATE POLICY "관리자 affiliate 전체 조회"
  ON affiliates FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 affiliate 수정"
  ON affiliates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 추천 기록 전체 조회/수정"
  ON affiliate_referrals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 출금 요청 전체 조회/수정"
  ON affiliate_withdrawals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
