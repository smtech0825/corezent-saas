-- ============================================================
-- 019_about_page.sql
-- 설명: About 페이지용 테이블 + Storage 버킷
--   ★ 멱등(idempotent) — 여러 번 실행해도 안전 ★
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

-- RLS (멱등)
ALTER TABLE front_about_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_about_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_read_about_stats" ON front_about_stats FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin_write_about_stats" ON front_about_stats FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_read_about_blocks" ON front_about_blocks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin_write_about_blocks" ON front_about_blocks FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Storage: about-images 버킷 ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'about-images', 'about-images', true, 5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "about_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'about-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "about_images_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'about-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "about_images_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'about-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "about_images_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'about-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Storage: testimonial-avatars 버킷 (누락 보완) ───────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'testimonial-avatars', 'testimonial-avatars', true, 2097152,
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "testimonial_avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'testimonial-avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "testimonial_avatars_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'testimonial-avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "testimonial_avatars_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'testimonial-avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "testimonial_avatars_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'testimonial-avatars' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
