-- ============================================================
-- 001_profiles.sql
-- 설명: 사용자 프로필 테이블 및 RLS 정책
--       auth.users는 Supabase 기본 제공, 이 테이블은 확장 정보
-- ============================================================

CREATE TABLE profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text,
  avatar_url     text,
  country        text,
  role           text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  affiliate_code text        UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 가입 시 자동으로 profiles 행 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, affiliate_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    -- 8자리 랜덤 affiliate 코드 자동 생성
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 프로필만 조회 가능"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "본인 프로필만 수정 가능"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "관리자는 전체 프로필 조회 가능"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "관리자는 전체 프로필 수정 가능"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
