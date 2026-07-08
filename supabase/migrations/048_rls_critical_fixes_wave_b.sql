-- ============================================================
-- 048_rls_critical_fixes_wave_b.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: RLS 감사(rls-audit-report) Critical 발견 Wave B — 조사 후 수정
--   B-1) front_settings: 공개 SELECT 정책 삭제 → 관리자 전용으로 축소
--        (SMTP 비밀번호 등 민감 설정이 이 테이블에 있음)
--   B-2) storage 버킷 3개(logos/about-images/testimonial-avatars):
--        쓰기 정책을 "로그인만 하면 전체 허용" → "관리자만 허용"으로 축소
--
-- 적용 방법: Steve가 Supabase SQL Editor에서 직접 실행.
--
-- 사전 조사 근거(이 세션에서 grep으로 전수 확인):
--   B-1) front_settings를 읽는 코드 8곳(lib/email.ts, components/Footer.tsx,
--        product/[slug]/page.tsx, admin/settings/page.tsx, api/admin/settings/route.ts,
--        dashboard/billing/page.tsx, app/layout.tsx ×2) 전부 createAdminClient() 사용.
--        anon/server(로그인 세션) 클라이언트로 이 테이블을 읽는 코드는 0건 —
--        공개 프론트엔드가 이 테이블에서 "정당하게" 읽어야 하는 값이 전혀 없음
--        (Footer의 지원 이메일·SNS 링크도 서버가 admin 클라로 미리 읽어 내려줌).
--        → 별도 테이블 분리 없이 SELECT 정책만 관리자 전용으로 좁히면 충분.
--   B-2) storage.objects에 쓰는 코드 5곳(RichTextEditor.tsx, AboutManager.tsx,
--        TestimonialsManager.tsx, FeatureImageUpload.tsx, ProductForm.tsx) 전부
--        `src/app/admin/**` 또는 `src/components/admin/**` 하위에서만 렌더링되고,
--        전부 admin/layout.tsx의 role==='admin' 서버 체크를 통과해야 도달 가능.
--        일반 회원이 정당하게 직접 업로드하는 기능(본인 아바타 등)은 코드베이스
--        전체에서 0건 확인. → 3개 버킷 전부 관리자 전용으로 잠가도 기존 기능
--        영향 없음(업로드 컴포넌트는 브라우저 anon 클라를 쓰지만, 실제 호출자는
--        이미 role='admin'인 로그인 사용자이므로 auth.uid() 기준 관리자 체크를 통과).
-- ============================================================

-- ── B-1. front_settings: 공개 SELECT 제거 → 관리자 전용 ────────────────────
DROP POLICY IF EXISTS "전체 공개 조회" ON front_settings;

CREATE POLICY "관리자만 조회"
  ON front_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
-- "관리자만 수정"(007_front_content.sql, FOR ALL) 정책은 그대로 유지 — 쓰기는 이미 관리자 전용.

-- ── B-2. storage 버킷 3종: authenticated 전체 → 관리자 전용 ─────────────────
-- logos
DROP POLICY IF EXISTS "logos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete" ON storage.objects;

CREATE POLICY "logos_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "logos_admin_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "logos_admin_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- about-images
DROP POLICY IF EXISTS "about_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "about_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "about_images_auth_delete" ON storage.objects;

CREATE POLICY "about_images_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'about-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "about_images_admin_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'about-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "about_images_admin_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'about-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- testimonial-avatars
DROP POLICY IF EXISTS "testimonial_avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "testimonial_avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "testimonial_avatars_auth_delete" ON storage.objects;

CREATE POLICY "testimonial_avatars_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'testimonial-avatars' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "testimonial_avatars_admin_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'testimonial-avatars' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "testimonial_avatars_admin_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'testimonial-avatars' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 공개 read 정책(logos_public_read/about_images_public_read/testimonial_avatars_public_read)은
-- 그대로 유지 — 상품 로고·about 이미지·후기 아바타는 사이트 방문자에게 보여야 하므로 공개가 맞음.

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) front_settings 정책 확인:
--      SELECT policyname, cmd FROM pg_policies WHERE tablename = 'front_settings';
--      → "관리자만 조회"(SELECT) + "관리자만 수정"(ALL) 2개만 남아야 함.
-- 2) storage 정책 확인:
--      SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects'
--        AND policyname LIKE 'logos_%' OR policyname LIKE 'about_images_%'
--        OR policyname LIKE 'testimonial_avatars_%' ORDER BY policyname;
--      → 각 버킷 public_read(SELECT) + admin_insert/update/delete 3개, 총 4개씩.
-- 3) 관리자 계정으로 로그인 후 실제 업로드(About 이미지·상품 로고·후기 아바타) 정상 동작 확인.
-- ============================================================
