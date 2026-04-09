-- 022: 비회원 문의(inquiries) 테이블
-- /contact 폼에서 접수된 문의 내역 저장

CREATE TABLE IF NOT EXISTS inquiries (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text        NOT NULL,
  subject         text        NOT NULL,
  message         text        NOT NULL,
  attachment_name text,
  attachment_size integer,
  ip_address      text,
  created_at      timestamptz DEFAULT now()
);

-- RLS 활성화 — 일반 유저 직접 접근 차단, API route에서 admin client로 삽입
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Admin만 조회/삽입 가능 (service_role)
CREATE POLICY "admin_full_access" ON inquiries
  FOR ALL
  USING (auth.role() = 'service_role');
