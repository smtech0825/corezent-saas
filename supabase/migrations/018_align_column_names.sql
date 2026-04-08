-- ============================================================
-- 018_align_column_names.sql
-- 설명: 코드에서 사용하는 컬럼명과 DB 스키마 정렬
--       + front_features에 tag 컬럼 추가
--       + front_interviews에 created_at 컬럼 추가
--
--   이 마이그레이션은 멱등(idempotent)하므로 여러 번 실행해도 안전합니다.
--
--   ★★★ Supabase 대시보드 → SQL Editor에서 실행해 주세요 ★★★
-- ============================================================

-- ── front_sections: section_key → name ──────────────────────
DO $$ BEGIN
  ALTER TABLE front_sections RENAME COLUMN section_key TO name;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ── front_faqs: is_visible → is_published ───────────────────
DO $$ BEGIN
  ALTER TABLE front_faqs RENAME COLUMN is_visible TO is_published;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ── front_features: is_visible → is_published ───────────────
DO $$ BEGIN
  ALTER TABLE front_features RENAME COLUMN is_visible TO is_published;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- front_features: tag 컬럼 추가 (Why CoreZent 카드의 태그 텍스트)
ALTER TABLE front_features ADD COLUMN IF NOT EXISTS tag text DEFAULT '';

-- ── front_interviews: 컬럼명 변경 ──────────────────────────
DO $$ BEGIN
  ALTER TABLE front_interviews RENAME COLUMN content TO quote;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE front_interviews RENAME COLUMN author_role TO author_title;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE front_interviews RENAME COLUMN avatar_url TO author_avatar;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE front_interviews RENAME COLUMN is_visible TO is_published;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- front_interviews: created_at 컬럼 추가 (admin 정렬용)
ALTER TABLE front_interviews
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
