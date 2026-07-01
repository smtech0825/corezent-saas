-- ============================================================
-- 036_product_detail_content.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트) — products 테이블
-- 설명: 상품 독립 상세 페이지(/product/[slug], Wave 4)에 렌더할 상세 콘텐츠 필드.
--       관리자 제품 편집에서 입력한다. (상세설명·태그·한줄소개는 기존 컬럼 재사용)
--   - hero_image_url        : 대표 이미지 URL
--   - screenshots           : 스크린샷 이미지 URL 배열(복수)
--   - system_requirements   : 시스템 요구사항(텍스트/마크다운)
--   - version_info_url      : 버전정보 링크(선택)
--
-- 기본값: 텍스트는 null(미입력), screenshots는 빈 배열.
-- 적용: Steve가 Supabase SQL Editor에서 직접 실행. (CC는 DB 직접 적용 안 함.)
-- 비파괴: ADD COLUMN IF NOT EXISTS — 기존 데이터 영향 없음, 재실행 안전.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hero_image_url      text,
  ADD COLUMN IF NOT EXISTS screenshots         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS system_requirements text,
  ADD COLUMN IF NOT EXISTS version_info_url    text;
