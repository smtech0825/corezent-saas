-- ============================================================
-- 009_section_content.sql
-- 설명: Hero/CTA 텍스트 및 How It Works 단계 관리 테이블
-- ============================================================

-- 섹션별 텍스트 콘텐츠 (key-value 방식)
-- 예: hero_badge, hero_headline1, cta_headline 등
CREATE TABLE front_content (
  key        text        PRIMARY KEY,
  value      text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- How It Works 단계 목록
CREATE TABLE front_steps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text,           -- Lucide 아이콘명 (PascalCase)
  title       text        NOT NULL,
  description text,
  order_index int         NOT NULL DEFAULT 0,
  is_published bool       NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE front_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_steps   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_front_content" ON front_content FOR SELECT USING (true);
CREATE POLICY "admin_write_front_content" ON front_content FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "public_read_front_steps" ON front_steps FOR SELECT USING (true);
CREATE POLICY "admin_write_front_steps" ON front_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
