-- @마이그레이션: 041_product_prices_sort_order
-- @설명: 옵션(가격) 행에 표시 순서를 부여하는 sort_order 컬럼 추가.
--        관리자 폼에서 번호로 순서를 입력하고, 공개 옵션 카드(/pricing)·편집 폼이
--        이 값의 오름차순으로 옵션을 표시한다. 같은 값이면 id 순으로 안정 정렬.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행 (git push로는 DB가 바뀌지 않음)
--        미적용 상태에서도 코드는 폴백(컬럼 없이 조회) + JS 정렬로 깨지지 않는다.

ALTER TABLE public.product_prices
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.product_prices.sort_order
  IS '옵션 표시 순서(오름차순, 관리자 입력 번호). 같은 값이면 id 순.';

-- (선택) 기존 옵션 행에 순서를 부여하고 싶으면 상품별로 번호를 채운다. 예:
--   WITH ranked AS (
--     SELECT id, row_number() OVER (PARTITION BY product_id ORDER BY id) AS rn
--     FROM public.product_prices WHERE is_active
--   )
--   UPDATE public.product_prices pp SET sort_order = ranked.rn
--   FROM ranked WHERE ranked.id = pp.id;
