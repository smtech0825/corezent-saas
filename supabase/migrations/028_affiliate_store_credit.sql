-- ============================================================
-- 028_affiliate_store_credit.sql
-- 설명: 추천(Affiliate) → "스토어 크레딧 전용" 적립/지급 시스템.
--       현금 지급 없음. 결제 확정 시 커미션을 pending 적립하고,
--       hold_days 동안 환불이 없으면 스토어 크레딧으로 전환(paid)한다.
--
-- 설계 결정(Wave 0 승인):
--   1) 기존 005_affiliate.sql(현금 출금 모델: affiliates / affiliate_referrals /
--      affiliate_withdrawals)은 "동결" — 본 마이그레이션에서 건드리지 않음.
--   2) 추천 코드는 기존 profiles.affiliate_code 재사용(신규 컬럼 없음).
--      가입 시점 귀속을 위해 profiles.referred_by(추천인 affiliate_code) 만 추가.
--   3) 모든 규칙값의 단일 출처는 신규 affiliate_program_config(singleton).
--   4) 005의 affiliate_referrals 이름 충돌 회피 → 귀속 테이블은
--      affiliate_attributions 로 신설.
--   5) 커미션 기준 금액은 gross total(cents) 기준 + 환불 클로백.
--   6) 금액은 전부 통화 최소단위(정수 cents, bigint)로 저장.
-- ============================================================

-- ── 0. profiles: 가입 시점 추천인(추천코드) 기록 컬럼 ──────────────
--    referred_by = 추천인의 profiles.affiliate_code (nullable, 자기추천 차단 시 미기록)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referred_by text
  REFERENCES profiles(affiliate_code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- ── 1. affiliate_program_config: 모든 규칙의 단일 출처(singleton) ──
--    id=true CHECK 로 단 한 행만 존재하도록 강제.
CREATE TABLE IF NOT EXISTS affiliate_program_config (
  id                    boolean     PRIMARY KEY DEFAULT true CHECK (id = true),
  program_enabled       boolean     NOT NULL DEFAULT false,                 -- 프로그램 on/off
  commission_type       text        NOT NULL DEFAULT 'percent'
                        CHECK (commission_type IN ('percent', 'flat')),
  commission_value      integer     NOT NULL DEFAULT 20 CHECK (commission_value >= 0), -- percent면 %, flat이면 cents
  is_recurring          boolean     NOT NULL DEFAULT false,                 -- 구독 갱신마다 반복 적립
  recurring_months_cap  integer     NOT NULL DEFAULT 12 CHECK (recurring_months_cap >= 0),
  cookie_days           integer     NOT NULL DEFAULT 30 CHECK (cookie_days >= 0),   -- last-click 귀속 쿠키 수명
  hold_days             integer     NOT NULL DEFAULT 30 CHECK (hold_days >= 0),     -- 환불 보류 기간
  min_payout_credit     bigint      NOT NULL DEFAULT 5000 CHECK (min_payout_credit >= 0), -- 최소 전환 크레딧(cents)
  currency              text        NOT NULL DEFAULT 'USD',
  self_referral_blocked boolean     NOT NULL DEFAULT true,                  -- 자기추천 차단
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 기본 단일 행 시드(있으면 유지)
INSERT INTO affiliate_program_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- updated_at 자동 갱신(002의 set_updated_at() 재사용 — 003/004와 동일 패턴)
CREATE TRIGGER affiliate_program_config_updated_at
  BEFORE UPDATE ON affiliate_program_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. affiliate_clicks: 추천 링크 클릭 기록(분석·어뷰징) ──────────
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text        NOT NULL,            -- 클릭된 추천 코드(미존재 코드도 기록 가능)
  landing_path  text,
  ip_hash       text,                            -- 원본 IP 미저장, 해시만
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code    ON affiliate_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created ON affiliate_clicks(created_at);

-- ── 3. affiliate_attributions: 추천 귀속(클릭/가입 → 전환) ─────────
--    피추천인 1명당 귀속 1건(부분 UNIQUE). 005.affiliate_referrals 와 이름 다름.
CREATE TABLE IF NOT EXISTS affiliate_attributions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,  -- 비회원 클릭 단계는 NULL
  referral_code    text        NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  converted_at     timestamptz,                                            -- 첫 결제 확정 시각
  order_id         uuid        REFERENCES orders(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 피추천인당 귀속 1건만 허용(회원으로 식별된 경우)
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_attributions_referred
  ON affiliate_attributions(referred_user_id)
  WHERE referred_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_referrer ON affiliate_attributions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_code     ON affiliate_attributions(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_order    ON affiliate_attributions(order_id);

-- ── 4. affiliate_payouts: 승인 커미션 → 크레딧 전환 배치 ──────────
--    (commissions 가 payout_id 로 참조하므로 먼저 생성)
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents     bigint      NOT NULL CHECK (amount_cents > 0),
  status           text        NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending', 'completed', 'reversed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_referrer ON affiliate_payouts(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status   ON affiliate_payouts(status);

-- ── 5. affiliate_commissions: 적립 단위(결정적 금액, cents) ────────
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attribution_id         uuid        REFERENCES affiliate_attributions(id) ON DELETE SET NULL,
  source_type            text        NOT NULL CHECK (source_type IN ('order', 'subscription_renewal')),
  source_id              text        NOT NULL,                              -- LS order/invoice id (멱등성 키)
  gross_amount_cents     bigint      NOT NULL CHECK (gross_amount_cents >= 0),
  commission_amount_cents bigint     NOT NULL CHECK (commission_amount_cents >= 0),
  currency               text        NOT NULL DEFAULT 'USD',
  status                 text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'reversed', 'paid')),
  earned_at              timestamptz NOT NULL DEFAULT now(),
  available_at           timestamptz NOT NULL,                              -- = earned_at + hold_days (앱에서 계산)
  payout_id              uuid        REFERENCES affiliate_payouts(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),

  -- 멱등성: 같은 소스(주문/갱신 인보이스)당 1건만 적립
  CONSTRAINT uq_affiliate_commissions_source UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referrer  ON affiliate_commissions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status    ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_available ON affiliate_commissions(available_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_attrib    ON affiliate_commissions(attribution_id);

-- ── 6. store_credit_ledger: 스토어 크레딧 원장(잔액=합계) ──────────
--    delta_cents: +적립 / −사용 / ±조정. balance_after_cents 는 항상 >= 0(음수 잔액 금지).
CREATE TABLE IF NOT EXISTS store_credit_ledger (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta_cents         bigint      NOT NULL,
  reason              text        NOT NULL
                      CHECK (reason IN ('affiliate_commission', 'checkout_redeem', 'admin_adjust', 'clawback')),
  ref_id              text,                                                 -- commission/payout/discount 등 참조
  balance_after_cents bigint      NOT NULL CHECK (balance_after_cents >= 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_ledger_user    ON store_credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_ledger_created ON store_credit_ledger(created_at);

-- ============================================================
-- RLS — 본인 행만 조회, 관리자 전체, 쓰기는 service_role(admin 클라이언트, RLS 우회)
-- ============================================================
ALTER TABLE affiliate_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_attributions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credit_ledger      ENABLE ROW LEVEL SECURITY;

-- config: 로그인 사용자 읽기 가능(약관·최소금액 표시용), 쓰기는 관리자만
CREATE POLICY "config 읽기(로그인)"
  ON affiliate_program_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "config 관리자 전체"
  ON affiliate_program_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- clicks: 관리자만(분석 데이터). 일반 쓰기는 admin 클라이언트가 RLS 우회로 처리.
CREATE POLICY "clicks 관리자 전체"
  ON affiliate_clicks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- attributions: 추천인/피추천인 본인 조회, 관리자 전체
CREATE POLICY "attributions 본인 조회"
  ON affiliate_attributions FOR SELECT
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE POLICY "attributions 관리자 전체"
  ON affiliate_attributions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- payouts: 추천인 본인 조회, 관리자 전체
CREATE POLICY "payouts 본인 조회"
  ON affiliate_payouts FOR SELECT
  USING (referrer_user_id = auth.uid());

CREATE POLICY "payouts 관리자 전체"
  ON affiliate_payouts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- commissions: 추천인 본인 조회, 관리자 전체
CREATE POLICY "commissions 본인 조회"
  ON affiliate_commissions FOR SELECT
  USING (referrer_user_id = auth.uid());

CREATE POLICY "commissions 관리자 전체"
  ON affiliate_commissions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ledger: 본인 조회, 관리자 전체
CREATE POLICY "ledger 본인 조회"
  ON store_credit_ledger FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ledger 관리자 전체"
  ON store_credit_ledger FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
