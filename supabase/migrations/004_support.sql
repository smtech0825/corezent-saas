-- ============================================================
-- 004_support.sql
-- 설명: 문의(Support) 티켓 및 답변 테이블, RLS
-- ============================================================

-- 문의 티켓
CREATE TABLE support_tickets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject    text        NOT NULL,
  status     text        NOT NULL DEFAULT 'open'
             CHECK (status IN ('open', 'answered', 'closed')),
  priority   text        NOT NULL DEFAULT 'normal'
             CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read    bool        NOT NULL DEFAULT false, -- 관리자 읽음 여부
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 문의 답변 (관리자 & 사용자 모두 작성 가능)
CREATE TABLE support_replies (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin   bool        NOT NULL DEFAULT false,
  message    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

-- 티켓: 본인 것만 조회/생성
CREATE POLICY "본인 티켓 조회"
  ON support_tickets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 티켓 생성"
  ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 티켓 수정 (닫기 등)"
  ON support_tickets FOR UPDATE USING (auth.uid() = user_id);

-- 관리자: 전체 티켓 조회/수정
CREATE POLICY "관리자 전체 티켓 조회"
  ON support_tickets FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 전체 티켓 수정"
  ON support_tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 답변: 본인 티켓에 연결된 것만 조회
CREATE POLICY "본인 티켓 답변 조회"
  ON support_replies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );

CREATE POLICY "본인 티켓에 답변 작성"
  ON support_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );

-- 관리자: 전체 답변 조회/작성
CREATE POLICY "관리자 전체 답변 조회"
  ON support_replies FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "관리자 답변 작성"
  ON support_replies FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
