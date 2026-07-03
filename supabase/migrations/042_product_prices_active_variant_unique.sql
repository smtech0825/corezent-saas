-- @마이그레이션: 042_product_prices_active_variant_unique
-- @설명: 활성 옵션 행의 lemon_squeezy_variant_id 유일성 보장(부분 유니크 인덱스).
--        같은 variant_id를 여러 활성 옵션 행이 공유하면 웹훅이 어떤 옵션(tier/라벨)인지
--        확정하지 못해 첫 행으로 폴백한다(어긋난 저장의 근본 원인). 이 인덱스로 원천 차단.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행 (git push로는 DB가 바뀌지 않음)
-- @주의: 중복이 있으면(의도된 테스트 데이터 등) 인덱스 생성 전 가드가 명확한 메시지로 중단시킨다.
--        중단되면 해당 variant_id의 옵션 행 중 하나만 남기고 나머지를 비활성화/수정한 뒤 재실행.
--        코드는 이 인덱스 없이도 다중행 안전(첫 행 폴백)이라 미적용 상태에서도 동작한다.

-- ① 사전 가드 — 활성 옵션 행에 중복 variant_id가 있으면 명확한 메시지로 중단(부분 적용 없음)
DO $$
DECLARE
  dup_kinds int;
  dup_list  text;
BEGIN
  SELECT count(*), string_agg(variant_id, ', ')
    INTO dup_kinds, dup_list
  FROM (
    SELECT lemon_squeezy_variant_id AS variant_id
    FROM public.product_prices
    WHERE is_active AND lemon_squeezy_variant_id IS NOT NULL
    GROUP BY lemon_squeezy_variant_id
    HAVING count(*) > 1
  ) d;

  IF COALESCE(dup_kinds, 0) > 0 THEN
    RAISE EXCEPTION
      '활성 옵션 행에 중복 variant_id가 %종류 있습니다: %. 각 variant_id를 쓰는 활성 옵션 행을 1개만 남기고 정리한 뒤 재실행하세요.',
      dup_kinds, dup_list;
  END IF;
END $$;

-- ② 활성 옵션 행의 variant_id 유일 보장
CREATE UNIQUE INDEX IF NOT EXISTS product_prices_active_variant_unique
  ON public.product_prices (lemon_squeezy_variant_id)
  WHERE is_active AND lemon_squeezy_variant_id IS NOT NULL;

COMMENT ON INDEX public.product_prices_active_variant_unique
  IS '활성 옵션 행의 lemon_squeezy_variant_id 유일성(웹훅 옵션 매칭 안전).';
