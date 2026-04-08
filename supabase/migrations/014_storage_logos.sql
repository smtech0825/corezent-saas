-- @마이그레이션: 014_storage_logos
-- @설명: 제품 로고 이미지 업로드용 Supabase Storage 버킷 생성

-- logos 버킷 생성 (공개 읽기)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2MB 제한
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책
CREATE POLICY "logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- 인증 사용자 업로드 정책
CREATE POLICY "logos_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 인증 사용자 업데이트 정책
CREATE POLICY "logos_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 인증 사용자 삭제 정책
CREATE POLICY "logos_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
