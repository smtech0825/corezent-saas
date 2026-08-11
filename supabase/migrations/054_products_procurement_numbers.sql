-- @마이그레이션: 054_products_procurement_numbers
-- @설명: products에 조달청 등록번호 2개 컬럼을 추가한다.
--   · procurement_class_number — 물품분류번호 (예: 43232698)
--   · procurement_item_number  — 물품식별번호 (예: 26391406)
--   상품 상세·요금 페이지·홈 요금 섹션·제품 목록의 "조달청 등록" 배지가 이 값을 읽는다.
--   값이 비어 있으면 배지를 아예 렌더하지 않는다(자리·여백도 남기지 않음).
--
-- 타입/제약 결정 근거:
--   · text — 지금은 8자리 숫자지만 하이픈·접두 등 다른 표기가 올 수 있어 형식을 DB에서 막지 않는다.
--            검사는 관리자 입력칸에서 가볍게만 한다.
--   · nullable — 조달 등록이 없는 상품(지니포스트·지니스톡)은 값이 없는 것이 정상 상태다.
--            products의 다른 선택 텍스트 컬럼(tagline·system_requirements·version_info_url)과
--            같은 방식이며, 기존 3개 상품 행은 NULL로 채워져 그대로 유지된다(깨지지 않음).
--
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(배지 코드 배포 전에 반드시 적용).
--        컬럼이 없는 상태로 코드가 배포되면 select 시 에러가 나 상품 목록·상세가 깨진다.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS procurement_class_number text;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS procurement_item_number text;

COMMENT ON COLUMN products.procurement_class_number IS
  '조달청 물품분류번호(나라장터 세부품명번호). 예: 43232698. 비어 있으면 조달청 배지 미표시';

COMMENT ON COLUMN products.procurement_item_number IS
  '조달청 물품식별번호. 예: 26391406. 비어 있으면 조달청 배지 미표시';

-- (선택) 적용 후 검증:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'products'
--      AND column_name IN ('procurement_class_number', 'procurement_item_number');
--   → 2행이 나오고 둘 다 text / YES 면 정상.

-- ------------------------------------------------------------------
-- 되돌리기(ROLLBACK) — 이 컬럼들을 없애고 싶을 때만 실행
-- ⚠️ 입력해 둔 조달 번호가 함께 삭제된다. 실행 전에 아래로 값을 백업할 것:
--     SELECT slug, procurement_class_number, procurement_item_number FROM products;
--
--   ALTER TABLE products DROP COLUMN IF EXISTS procurement_class_number;
--   ALTER TABLE products DROP COLUMN IF EXISTS procurement_item_number;
-- ------------------------------------------------------------------
