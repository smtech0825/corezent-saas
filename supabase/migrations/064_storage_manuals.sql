-- ============================================================
-- 064_storage_manuals.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 사용설명서 파일 보관함(manuals) — HTML 파일 한 개를 올려두는 공개 보관함.
--       손님에게는 저장소 직접 주소가 아니라 사이트 중계 통로(/manual)로 열린다
--       (저장소가 HTML을 화면으로 그려주지 않는 정책 때문 — 2026-08-16 실측).
--       읽기는 공개, 쓰기(올리기·바꾸기·지우기)는 관리자만 — 048 보안 규칙과 동일.
--       ⚠️ 이 파일은 사이트 주소에서 HTML로 열리므로 일반 회원 쓰기를 절대 허용하면 안 된다.
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

-- 쓰기(올리기/바꾸기/지우기)는 관리자만 — 048_rls_critical_fixes_wave_b와 동일 형태.
-- (일반 로그인 회원까지 허용하면 우리 주소에서 열리는 설명서를 아무나 바꿔치기할 수 있다)
DO $$ BEGIN
  CREATE POLICY "manuals_admin_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'manuals'
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "manuals_admin_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'manuals'
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "manuals_admin_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'manuals'
      AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'manuals';
--   → public=true, 5242880(5MB), {text/html} 이면 성공.
-- SELECT policyname FROM pg_policies WHERE tablename='objects' AND policyname LIKE 'manuals%';
--   → manuals_public_read + manuals_admin_insert/update/delete 4개. auth_* 이름이 보이면 실패.
-- ============================================================
