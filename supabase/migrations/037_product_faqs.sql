-- ============================================================
-- 037_product_faqs.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트) — products 테이블
-- 설명: 상품 상세 페이지(/product/[slug])의 '상품 FAQ' 섹션용 컬럼.
--       기존 front_faqs(랜딩 전역 FAQ)와 별개로, 상품별 질문/답변을 담는다.
--       구조: [{ "question": "...", "answer": "..." }, ...] (jsonb 배열)
--       관리자 제품 편집에서 입력한다.
--
-- 기본값: 빈 배열([]) — 값이 없으면 상세 페이지에서 FAQ 섹션을 숨긴다.
-- 적용: Steve가 Supabase SQL Editor에서 직접 실행. (CC는 DB 직접 적용 안 함.)
-- 비파괴: ADD COLUMN IF NOT EXISTS — 기존 데이터 영향 없음, 재실행 안전.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb;
