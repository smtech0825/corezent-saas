-- @마이그레이션: 046_products_list_description
-- @설명: products에 목록 전용 짧은 소개(list_description) 컬럼 추가.
--        /product 목록·홈 제품 섹션·SEO 메타에서 description(상세 HTML) 대신 사용한다.
--        상세 페이지 본문은 기존대로 description(리치 HTML)을 사용한다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(Wave 2~3 코드 배포 전에 반드시 적용).
--        컬럼이 없는 상태로 코드가 배포되면 select 시 에러로 목록/상세 페이지가 깨진다.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS list_description text NOT NULL DEFAULT '';

COMMENT ON COLUMN products.list_description IS
  '목록 카드 전용 짧은 소개 (plain text, 권장 80~150자). 비어 있으면 목록에서 설명 영역 미표시. 상세 페이지 본문은 description 사용';
