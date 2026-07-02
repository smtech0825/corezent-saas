-- @마이그레이션: 040_product_prices_options (표준 쇼핑몰 옵션 구조 — 이전 039 대체)
-- @설명: "상품 1개 + product_prices 옵션 행 N개" 구조로 전환.
--        각 옵션 행(product_prices)에 옵션 라벨(축1/축2)·라이선스 tier를 두고,
--        상품(products)에는 축 "제목"(예: 주기 / PC 수)만 둔다.
--        checkout_url은 이미 026에서 product_prices에 있으므로 재사용(행 단위).
--        ⚠️ 결제·라이선스 파이프라인 불변: 웹훅은 variant_id로 행을 찾고, tier는
--           price 행의 license_tier를 우선 읽되 없으면 기존 slug 파싱으로 fallback한다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행 (git push로는 DB가 바뀌지 않음)
--
-- ⚠️ 이전 039_product_option_group.sql은 폐기(파일 삭제)되었고 미적용이었다.
--    039가 만들려던 products 컬럼(option_group·축 라벨)은 아래에 그대로 포함해
--    기존 관리자 폼(ProductForm)이 저장에 실패하지 않도록 비파괴로 유지한다.
--    (v2에서 products.option_group·option_axis*_label은 사용하지 않지만 남겨둔다.)

-- ── products: 축 "제목"(카드 드롭다운 라벨) + 039 호환 컬럼 ────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_group       text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis1_name  text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis1_label text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis2_name  text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis2_label text;

COMMENT ON COLUMN public.products.option_axis1_name IS 'v2 옵션 축1 제목 (카드 드롭다운 라벨, 예: 주기)';
COMMENT ON COLUMN public.products.option_axis2_name IS 'v2 옵션 축2 제목 (예: PC 수 · 축 1개면 비움)';

-- ── product_prices: 옵션 라벨(축1/축2 값) + 라이선스 tier ──────────────────────
ALTER TABLE public.product_prices ADD COLUMN IF NOT EXISTS option_axis1_label text;
ALTER TABLE public.product_prices ADD COLUMN IF NOT EXISTS option_axis2_label text;
ALTER TABLE public.product_prices ADD COLUMN IF NOT EXISTS license_tier       text;

COMMENT ON COLUMN public.product_prices.option_axis1_label IS '이 옵션 행의 축1 값 (자유 텍스트, 예: 월간)';
COMMENT ON COLUMN public.product_prices.option_axis2_label IS '이 옵션 행의 축2 값 (자유 텍스트, 예: 3PC용)';
COMMENT ON COLUMN public.product_prices.license_tier       IS '라이선스 발급 tier (1pc·3pc·5pc·10pc·lite·pro·max). 비면 웹훅이 slug 파싱으로 fallback';

-- ── 032 UNIQUE 인덱스 재정의 — 옵션 행(같은 type/interval에 옵션별 다중 행) 허용 ──
-- 기존 032: (product_id, type, COALESCE(interval,'')) 활성 1행만 → 월간에 1PC·3PC 공존 불가.
-- v2: 옵션 라벨(축1/축2)을 유일성에 포함해 "같은 상품·주기·옵션조합"만 1행으로 제한.
--     (license_tier가 아니라 옵션 라벨로 구분 — tier가 없거나 같은 옵션도 라벨이 다르면 공존 가능.
--      "옵션=tier" 전제에 얽매이지 않는 범용 구조. tier는 라이선스 발급용일 뿐 유일성 축이 아님.)
-- 032의 원래 목적(같은 플랜 중복 행 방지)은 옵션 라벨 축을 더해 그대로 유지된다.
-- (데이터 불변 — 인덱스 정의만 교체. 재적용 안전하도록 DROP IF EXISTS + CREATE IF NOT EXISTS)
DROP INDEX IF EXISTS uq_product_prices_active_plan;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_prices_active_plan_v2
  ON public.product_prices (product_id, type, COALESCE(interval, ''), COALESCE(option_axis1_label, ''), COALESCE(option_axis2_label, ''))
  WHERE is_active;

-- ─── 기존 상품 이행 예시 (값 확정·실행은 Steve — orders/subscriptions FK 때문에 행 삭제 금지) ───
-- 현재 GenieWork가 조합별로 여러 products(geniework_1pc_monthly 등)로 흩어져 있다면,
-- "대표 상품 1개(예: slug=geniework)"만 남기고 나머지 조합을 그 상품의 옵션 행으로 흡수한다.
-- FK 참조(orders.product_price_id·subscriptions.product_price_id) 때문에 기존 price 행은
-- DELETE 하지 말고, product_id를 대표 상품으로 재지정 + 옵션 라벨/tier를 채우는 방식으로 이행한다.
--
-- 0) 대표 상품 확보 (없으면 하나를 대표로 승격하거나 신규 생성). 대표 slug엔 family 토큰(geniework)만.
--    UPDATE public.products SET slug='geniework', name='GenieWork',
--           option_axis1_name='주기', option_axis2_name='PC 수'
--    WHERE id = '<대표 상품 id>';
--
-- 1) 흩어진 조합 상품들의 price 행을 대표 상품으로 재지정 + 옵션 라벨/tier 채우기 (행 삭제 없음):
--    UPDATE public.product_prices pp
--       SET product_id        = '<대표 상품 id>',
--           option_axis1_label = CASE WHEN pp.interval='annual' THEN '연간' ELSE '월간' END,
--           option_axis2_label = '3PC용',
--           license_tier       = '3pc'
--     FROM public.products src
--    WHERE pp.product_id = src.id
--      AND src.slug LIKE 'geniework_3pc_%';   -- 조합별로 반복(1pc/5pc/10pc)
--
-- 2) 대표가 아닌 옛 상품 행은 비활성화(공개 목록에서 숨김 — 삭제 금지, 이력·FK 보존):
--    UPDATE public.products SET is_active=false
--    WHERE slug LIKE 'geniework_%' AND slug <> 'geniework';
--
-- 3) 재지정 후 활성 중복이 없어야 uq_product_prices_active_plan_v2가 성립한다. 선확인:
--    SELECT product_id, type, COALESCE(interval,''), COALESCE(option_axis1_label,''), COALESCE(option_axis2_label,''), count(*)
--    FROM   public.product_prices WHERE is_active
--    GROUP  BY 1,2,3,4,5 HAVING count(*) > 1;
--    → 0행이어야 함. 아니면 대표 1행만 is_active=true로 남기고 정리 후 인덱스 생성.
--
-- 4) ⚠️ 라이선스 미배송 방지 — GenieStock/GenieWork 옵션 행은 license_tier가 반드시 채워져야 한다.
--    (대표 slug엔 tier 토큰이 없어 slug fallback이 무력 → tier 공란이면 결제돼도 라이선스 미발급.)
--    배포 후 아래로 확인(0행이어야 함):
--    SELECT pp.id, p.slug, pp.option_axis1_label, pp.option_axis2_label, pp.license_tier
--    FROM   public.product_prices pp JOIN public.products p ON p.id = pp.product_id
--    WHERE  pp.is_active AND (p.slug LIKE '%geniework%' OR p.slug LIKE '%geniestock%')
--      AND  (pp.license_tier IS NULL OR pp.license_tier = '');
