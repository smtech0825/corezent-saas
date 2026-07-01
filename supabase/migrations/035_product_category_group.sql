-- ============================================================
-- 035_product_category_group.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트) — products 테이블
-- 설명: 공개 제품 목록(/product 등)에서 제품을 분류·필터링하기 위한
--       '카테고리' 컬럼(자유 입력 텍스트). 관리자 제품 편집에서 값을 입력한다.
--       ⚠️ 기존 products.category(desktop/web/chrome = '플랫폼 유형')와는 별개다.
--          이 컬럼은 업무 분류(예: 행정/투자/마케팅) 용도.
--
-- 기본값: null(미분류) — 현 상품이 소수이므로 Steve가 상품별로 값을 채운다(백필).
--         예) UPDATE products SET category_group = '마케팅' WHERE slug = '...';
-- 적용: Steve가 Supabase SQL Editor에서 직접 실행. (CC는 DB 직접 적용 안 함.)
-- 비파괴: ADD COLUMN IF NOT EXISTS — 기존 데이터 영향 없음, 재실행 안전.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_group text;
