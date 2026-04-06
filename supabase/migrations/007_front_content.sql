-- ============================================================
-- 007_front_content.sql
-- 설명: 관리자가 수정 가능한 프론트 콘텐츠 테이블
--       홈 페이지 섹션, FAQ, 기능 소개, 후기, 파트너, 자유 페이지 등
-- ============================================================

-- 사이트 전역 설정 (key-value 방식)
-- category: 'general' | 'smtp' | 'invoice' | 'gdpr' | 'affiliate' | 'payment'
CREATE TABLE front_settings (
  key      text PRIMARY KEY,
  value    jsonb NOT NULL DEFAULT 'null',
  category text NOT NULL DEFAULT 'general'
);

-- 기본값 삽입
INSERT INTO front_settings (key, value, category) VALUES
  -- General
  ('site_name',       '"CoreZent"',                            'general'),
  ('site_url',        '"https://corezent.com"',                'general'),
  ('site_description','"Your software, subscribed."',          'general'),
  ('logo_url',        'null',                                  'general'),
  ('favicon_url',     'null',                                  'general'),
  ('support_email',   '"support@corezent.com"',               'general'),
  ('twitter_url',     'null',                                  'general'),
  ('github_url',      'null',                                  'general'),
  ('instagram_url',   'null',                                  'general'),
  -- SMTP
  ('smtp_host',       'null',                                  'smtp'),
  ('smtp_port',       '587',                                   'smtp'),
  ('smtp_user',       'null',                                  'smtp'),
  ('smtp_pass',       'null',                                  'smtp'),
  ('smtp_from_name',  '"CoreZent"',                            'smtp'),
  ('smtp_from_email', 'null',                                  'smtp'),
  -- Invoice
  ('invoice_company_name',   'null',                           'invoice'),
  ('invoice_company_address','null',                           'invoice'),
  ('invoice_tax_id',         'null',                           'invoice'),
  -- GDPR
  ('gdpr_enabled',           'true',                           'gdpr'),
  ('gdpr_banner_text',       'null',                           'gdpr'),
  -- Affiliate
  ('affiliate_enabled',          'false',                      'affiliate'),
  ('affiliate_commission_rate',  '10',                         'affiliate'),  -- %
  ('affiliate_min_withdrawal',   '50',                         'affiliate'),  -- USD
  -- Payment
  ('bank_transfer_discount_rate','20',                         'payment'),  -- % (한국 계좌이체 할인)
  ('bank_transfer_countries',    '["KR"]',                     'payment');  -- 무통장 허용 국가

-- 홈 섹션 순서/노출 여부
CREATE TABLE front_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,  -- 'hero' | 'features' | 'tools' | 'interviews' | 'partners' | 'faq' | 'pricing_preview'
  label       text NOT NULL,
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

INSERT INTO front_sections (section_key, label, order_index) VALUES
  ('hero',            'Hero 배너',        1),
  ('features',        'Features 섹션',    2),
  ('tools',           'Tools 섹션',       3),
  ('interviews',      '고객 후기',         4),
  ('partners',        '파트너',            5),
  ('faq',             'FAQ',              6),
  ('pricing_preview', 'Pricing 미리보기',  7);

-- FAQ
CREATE TABLE front_faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question    text NOT NULL,
  answer      text NOT NULL,
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

-- Features 섹션 항목
CREATE TABLE front_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  icon        text,  -- lucide icon name 또는 이미지 URL
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

-- Tools 섹션 항목
CREATE TABLE front_tools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  icon_url    text,
  description text,
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

-- 고객 인터뷰/후기
CREATE TABLE front_interviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_role text,
  avatar_url  text,
  content     text NOT NULL,
  rating      int  DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

-- 파트너
CREATE TABLE front_partners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  logo_url    text,
  url         text,
  order_index int  NOT NULL DEFAULT 0,
  is_visible  bool NOT NULL DEFAULT true
);

-- 자유 편집 페이지 (about, privacy, terms 등)
CREATE TABLE pages (
  slug       text        PRIMARY KEY,  -- 'about' | 'privacy' | 'terms'
  title      text        NOT NULL,
  content    text,       -- Markdown
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pages (slug, title, content) VALUES
  ('about',   'About CoreZent', '## About\n\nContent coming soon.'),
  ('privacy', 'Privacy Policy',  '## Privacy Policy\n\nContent coming soon.'),
  ('terms',   'Terms of Service','## Terms of Service\n\nContent coming soon.');

-- RLS — 프론트 콘텐츠는 전체 공개 읽기, 관리자만 쓰기
ALTER TABLE front_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_faqs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_features  ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_tools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE front_partners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages            ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'front_settings','front_sections','front_faqs','front_features',
    'front_tools','front_interviews','front_partners','pages'
  ] LOOP
    EXECUTE format('CREATE POLICY "전체 공개 조회" ON %I FOR SELECT USING (true)', t);
    EXECUTE format(
      'CREATE POLICY "관리자만 수정" ON %I FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin''))',
      t
    );
  END LOOP;
END;
$$;
