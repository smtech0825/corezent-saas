-- @마이그레이션: 039_product_option_group
-- @설명: 상품 "옵션 진열" 표시 계층 컬럼 추가 (비파괴 · 순수 표시용)
--        DB 상품은 지금처럼 조합별 개별 등록을 유지한다(slug·variant_id·checkout_url·라이선스
--        파이프라인 전부 불변). 이 컬럼들은 "같은 카드로 묶어 옵션 드롭다운으로 보여주기" 위한
--        진열 메타데이터일 뿐, 결제/라이선스 로직은 전혀 참조하지 않는다.
--
--        - option_group      : 묶음 키. 같은 값을 가진 상품들이 공개 카드 1개로 묶여 옵션 선택 UI가 된다.
--                              NULL/빈값이면 기존처럼 단독 카드로 렌더. (slug 파생이 아니라 관리자 명시 값)
--        - option_axis1_name : 축1 제목 (드롭다운 라벨, 예: "주기"). 자유 입력.
--        - option_axis1_label: 이 상품의 축1 값 (예: "월간"). 자유 입력.
--        - option_axis2_name : 축2 제목 (예: "PC 수"). 축이 1개면 비워둔다.
--        - option_axis2_label: 이 상품의 축2 값 (예: "3PC용"). 자유 입력.
--
--        라벨은 전부 자유 텍스트(하드코딩 enum 금지) — 새 제품이 다른 옵션 개념을 써도 동일 구조로 동작.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행 (git push로는 DB가 바뀌지 않음)

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_group       text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis1_name  text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis1_label text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis2_name  text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_axis2_label text;

COMMENT ON COLUMN public.products.option_group       IS '묶음 키 — 같은 값끼리 공개 카드 1개로 묶어 옵션 드롭다운 생성 (NULL=단독 카드)';
COMMENT ON COLUMN public.products.option_axis1_name  IS '옵션 축1 제목 (자유 입력, 예: 주기)';
COMMENT ON COLUMN public.products.option_axis1_label IS '이 상품의 축1 값 (자유 입력, 예: 월간)';
COMMENT ON COLUMN public.products.option_axis2_name  IS '옵션 축2 제목 (자유 입력, 예: PC 수 · 축 1개면 비움)';
COMMENT ON COLUMN public.products.option_axis2_label IS '이 상품의 축2 값 (자유 입력, 예: 3PC용)';

-- 조회 성능(묶음 렌더 시 option_group 그룹핑)용 — 부분 인덱스로 NULL 제외
CREATE INDEX IF NOT EXISTS idx_products_option_group
  ON public.products (option_group)
  WHERE option_group IS NOT NULL;

-- ─── 백필 예시 (값 확정은 Steve — 실제 상품 구성에 맞게 수정 후 실행) ───────────
-- 아래는 GenieWork 1PC 월간 상품에 옵션 메타를 채우는 예시. slug/name은 실제 값으로 교체.
-- 묶음 키는 관리자 명시값 — 예시로 'geniework'를 쓰지만 아무 문자열이나 가능(같은 카드끼리 동일하게).
--
-- UPDATE public.products SET
--   option_group       = 'geniework',
--   option_axis1_name  = '주기',
--   option_axis1_label = '월간',
--   option_axis2_name  = 'PC 수',
--   option_axis2_label = '1PC용'
-- WHERE slug = 'geniework_1pc_monthly';
--
-- UPDATE public.products SET
--   option_group='geniework', option_axis1_name='주기', option_axis1_label='연간',
--   option_axis2_name='PC 수', option_axis2_label='3PC용'
-- WHERE slug = 'geniework_3pc_annual';
-- (나머지 조합도 동일 패턴 — option_group을 같게 두면 한 카드로 묶인다)
