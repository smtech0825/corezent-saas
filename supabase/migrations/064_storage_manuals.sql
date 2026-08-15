-- ============================================================
-- 064_storage_manuals.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 사용설명서 파일 보관함(manuals) — HTML 파일 한 개를 올려두는 공개 보관함.
--       손님에게는 저장소 직접 주소가 아니라 사이트 중계 통로(/manual)로 열린다
--       (저장소가 HTML을 화면으로 그려주지 않는 정책 때문 — 2026-08-16 실측).
--       로고 보관함(014_storage_logos.sql)과 같은 방식: 공개 읽기 + 로그인 사용자 쓰기.
--       ★ 실행은 운영자(대표님)가 Supabase SQL Editor에서 직접 한다.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('manuals', 'manuals', true, 5242880, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기(주소만 알면 누구나 — 단 HTML은 글자로만 나오므로 실제 열람은 /manual 경유)
DO $$ BEGIN
  CREATE POLICY "manuals_public_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'manuals');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 로그인 사용자 올리기/바꾸기/지우기 (로고 보관함과 동일 관례 — 관리자 화면에서 사용)
DO $$ BEGIN
  CREATE POLICY "manuals_auth_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'manuals' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "manuals_auth_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'manuals' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "manuals_auth_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'manuals' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'manuals';
--   → public=true, 5242880(5MB), {text/html} 이면 성공.
-- ============================================================
