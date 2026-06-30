-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: ★ GenieWork 전용 라이선스 Supabase 프로젝트 (GW_SUPABASE_URL)
--           ❌ CoreZent 본체 / ❌ GenieStock 공유(LICENSE_SUPABASE) 아님
--           → 모든 객체는 GW_SUPABASE 한 곳에만. geniestock은 product 게이트로 안 닿음.
--
-- 적용 방법: 운영자가 GW_SUPABASE SQL Editor에서 직접 실행. (코드 push로 외부 DB 안 바뀜.)
-- 선행    : 002_geniework_reset_abuse.sql (license_program_config 싱글톤 필요).
--
-- 목적   : 테스터 AI 프록시 — 라이선스별 USD 한도 회계 (Wave 1: 스키마만).
--   1) license_program_config.tester_default_usd_cap : 기본 한도(5.00) 단일 출처(무하드코딩).
--   2) tester_budget      : 테스터 키별 usd_cap(개별 override)·usd_spent(누적). sibling.
--   3) tester_usage_log   : 콜 단위 사용 로그(토큰·서버계산 usd_cost·model). append-only.
--   4) tester_model_price : model → 100만 토큰당 단가(서버가 cost 계산, AI는 cost 결정 불가).
-- 영향   : 기존 license_keys / hwid_mapping / license_event_log 무변경(ADDITIVE ONLY).
--           DROP / RENAME 없음. geniestock·유료 geniework 라이선스 0 영향.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 0. updated_at 트리거 함수 (002에서 정의됨 — 없을 때 대비 방어적 재정의) ───
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ─── 1. 기본 USD 한도 = 설정 단일 출처 (재배포 없이 UPDATE로 변경) ──────────
--      license_program_config 는 002의 singleton(id=true). 컬럼만 additive 추가.
ALTER TABLE license_program_config
  ADD COLUMN IF NOT EXISTS tester_default_usd_cap numeric(12,6) NOT NULL DEFAULT 5.00
    CHECK (tester_default_usd_cap >= 0);

-- ─── 2. 테스터 라이선스별 예산 (sibling) ─────────────────────────────────
--      license_keys 무변경 · 테스터 회계만 격리. 첫 콜에 lazy upsert.
--      usd_cap NULL = 전역 기본값(config) 사용 / 값 있으면 그 키만 개별 한도.
--      effective_cap = COALESCE(tester_budget.usd_cap, config.tester_default_usd_cap)
CREATE TABLE IF NOT EXISTS tester_budget (
  license_key text          PRIMARY KEY,
  usd_cap     numeric(12,6)          CHECK (usd_cap IS NULL OR usd_cap >= 0),
  usd_spent   numeric(12,6) NOT NULL DEFAULT 0 CHECK (usd_spent >= 0),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tester_budget_updated_at ON tester_budget;
CREATE TRIGGER tester_budget_updated_at
  BEFORE UPDATE ON tester_budget
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 3. 콜 단위 사용 로그 (append-only) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tester_usage_log (
  id            bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_key   text          NOT NULL,
  model         text          NOT NULL,
  input_tokens  integer       NOT NULL DEFAULT 0 CHECK (input_tokens  >= 0),
  output_tokens integer       NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  usd_cost      numeric(12,6) NOT NULL DEFAULT 0 CHECK (usd_cost >= 0),
  created_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tester_usage_log_key_time
  ON tester_usage_log (license_key, created_at);

-- ─── 4. model → 단가(100만 토큰당 USD) ───────────────────────────────────
--      cost = (input_tokens*input + output_tokens*output) / 1e6  — 전부 서버 계산.
--      행 없으면 Wave 2 함수가 fail-closed(가격 미설정 거부) → AI는 cost 결정 불가.
CREATE TABLE IF NOT EXISTS tester_model_price (
  model                 text          PRIMARY KEY,
  input_price_per_mtok  numeric(14,6) NOT NULL CHECK (input_price_per_mtok  >= 0),
  output_price_per_mtok numeric(14,6) NOT NULL CHECK (output_price_per_mtok >= 0),
  is_active             boolean       NOT NULL DEFAULT true,
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tester_model_price_updated_at ON tester_model_price;
CREATE TRIGGER tester_model_price_updated_at
  BEFORE UPDATE ON tester_model_price
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 예시 시드 — ⚠️ 운영자가 실제 제공사 단가로 반드시 확인/교체 (under-price = 초과지출 위험)
INSERT INTO tester_model_price (model, input_price_per_mtok, output_price_per_mtok) VALUES
  ('claude-haiku-4-5',  1.00,  5.00),
  ('claude-sonnet-4-6', 3.00, 15.00)
ON CONFLICT (model) DO NOTHING;

-- ─── 5. RLS deny-by-default (service_role만 우회 — 002 패턴) ──────────────
ALTER TABLE tester_budget      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tester_usage_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tester_model_price ENABLE ROW LEVEL SECURITY;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT tester_default_usd_cap FROM license_program_config;        -- 5.000000
-- SELECT * FROM tester_model_price;                                 -- 시드 2행
-- INSERT INTO tester_budget(license_key,usd_spent) VALUES('test-demo',0);  -- 행 생성 OK
-- 전역 기본 변경 : UPDATE license_program_config SET tester_default_usd_cap = 10.00;
-- 키별 개별 한도 : INSERT INTO tester_budget(license_key,usd_cap) VALUES('test1234',20.00)
--                  ON CONFLICT (license_key) DO UPDATE SET usd_cap = EXCLUDED.usd_cap;
