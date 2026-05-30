-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: 라이선스 전용 Supabase 프로젝트 (LICENSE_SUPABASE_URL)
--           ★ CoreZent 본체 프로젝트 아님
-- 목적   : GenieWork 라이선스 지원 (product 컬럼 + tier에 PC 대수 허용)
-- 영향   : 기존 geniestock 데이터 무변경 (product DEFAULT 'geniestock')
-- ════════════════════════════════════════════════════════════════════════

-- 1) product 컬럼 추가 (기본값으로 기존 행 자동 'geniestock' 라벨링)
ALTER TABLE license_keys
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'geniestock';

-- 2) product 허용값 제약
ALTER TABLE license_keys DROP CONSTRAINT IF EXISTS license_keys_product_check;
ALTER TABLE license_keys ADD CONSTRAINT license_keys_product_check
  CHECK (product IN ('geniestock','geniework'));

-- 3) product 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_license_keys_product
  ON license_keys(product);

-- 4) tier CHECK 확장 — geniework 는 1pc/3pc/5pc/10pc
ALTER TABLE license_keys DROP CONSTRAINT IF EXISTS license_keys_tier_check;
ALTER TABLE license_keys ADD CONSTRAINT license_keys_tier_check
  CHECK (tier IN ('lite','pro','max','1pc','3pc','5pc','10pc'));

-- ─── 회귀 검증 ──────────────────────────────────────────────────────────
-- 기존 geniestock 행이 모두 product='geniestock' 으로 라벨됐는지 확인:
-- SELECT product, tier, COUNT(*) FROM license_keys
--   GROUP BY product, tier ORDER BY product, tier;
