-- ============================================================
-- 025_seed_front_sections.sql
-- 설명: front_sections 시드 데이터를 현재 코드의 섹션 목록과 동기화
--       구 시드(hero, features, tools, interviews, partners, faq, pricing_preview) 제거 후
--       현행 코드 기준 8개 섹션 삽입
-- ============================================================

-- 기존 시드 데이터 전체 삭제 (코드와 이름이 달라 update가 0건 매칭되던 문제)
DELETE FROM front_sections;

-- 현행 코드(defaultSections) 기준 8개 섹션 삽입
INSERT INTO front_sections (name, label, is_visible, order_index) VALUES
  ('hero',         'Hero',         true,  0),
  ('product',      'Product',      true,  1),
  ('how_it_works', 'How It Works', true,  2),
  ('features',     'Features',     true,  3),
  ('pricing',      'Pricing',      true,  4),
  ('testimonials', 'Testimonials', true,  5),
  ('faq',          'FAQ',          true,  6),
  ('cta',          'CTA',          true,  7)
ON CONFLICT (name) DO NOTHING;
