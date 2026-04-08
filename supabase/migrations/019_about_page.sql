-- ============================================================
-- 019_about_page.sql
-- 설명: About 페이지용 테이블 — 통계 카드 + 콘텐츠 블록(텍스트+이미지 슬라이더)
--       Hero 타이틀/설명은 front_content (key-value) 활용
-- ============================================================

-- About 페이지 Hero 기본값
INSERT INTO front_content (key, value) VALUES
  ('about_title',       'About CoreZent'),
  ('about_description', 'We build software that works for you.')
ON CONFLICT (key) DO NOTHING;

-- 통계 카드 (아이콘 + 숫자 + 라벨)
CREATE TABLE IF NOT EXISTS front_about_stats (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text        DEFAULT '',
  value       text        NOT NULL,
  label       text        NOT NULL,
  order_index int         NOT NULL DEFAULT 0,
  is_published bool       NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 콘텐츠 블록 (설명 텍스트 + 이미지 슬라이더)
CREATE TABLE IF NOT EXISTS front_about_blocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  images      jsonb       NOT NULL DEFAULT '[]',
  order_index int         NOT NULL DEFAULT 0,
  is_published bool       NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE front_about_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_about_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_about_stats"  ON front_about_stats  FOR SELECT USING (true);
CREATE POLICY "admin_write_about_stats"  ON front_about_stats  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "public_read_about_blocks" ON front_about_blocks FOR SELECT USING (true);
CREATE POLICY "admin_write_about_blocks" ON front_about_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supabase Storage 버킷 (이미 존재하면 무시)
-- ★ Supabase Dashboard → Storage에서 'about-images' public 버킷 생성 필요 ★
