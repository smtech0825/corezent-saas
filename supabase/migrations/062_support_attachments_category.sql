-- ============================================================
-- 062_support_attachments_category.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 고객지원 티켓에 ① 문의 유형 칸, ② 답글 첨부 칸, ③ 첨부 전용 비공개
--   저장소 버킷을 추가한다.
--   - 첨부 파일 실체는 비공개 버킷(support-attachments)에만 저장된다.
--     버킷이 비공개(public=false)이므로 주소만 알아도 열리지 않고,
--     서버가 만들어 주는 기한 있는 서명 주소로만 내려받을 수 있다.
--   - storage.objects에 정책을 추가하지 않는다(기본 거부 유지) —
--     업로드·서명 주소 발급 모두 서버 전용(service_role) 경로에서만 한다.
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행.
-- ⚠️ 비멱등 — 운영 재실행 금지 (기존 마이그레이션과 동일 관례).
-- ⚠️ 적용 전에도 문의 화면은 정상 동작한다(유형은 저장 생략, 첨부는 실패 안내).
-- ============================================================

-- ① 문의 유형 — 값 목록은 화면과 일치(설치 실패/키 인증/PC 변경/증빙 요청/AI 키 오류/기타)
ALTER TABLE support_tickets ADD COLUMN category text
  CHECK (category IN ('install_fail', 'key_auth', 'pc_change', 'receipt', 'ai_key', 'other'));

COMMENT ON COLUMN support_tickets.category IS '문의 유형(선택) — install_fail·key_auth·pc_change·receipt·ai_key·other';

-- ② 답글 첨부 메타 — 파일 실체는 저장소 버킷에, 여기엔 경로·이름·크기만
ALTER TABLE support_replies ADD COLUMN attachment_path text;   -- 버킷 안 객체 경로({ticket_id}/{uuid}-{파일명})
ALTER TABLE support_replies ADD COLUMN attachment_name text;   -- 원래 파일명(화면 표시용)
ALTER TABLE support_replies ADD COLUMN attachment_size integer; -- 바이트

COMMENT ON COLUMN support_replies.attachment_path IS '첨부 객체 경로(비공개 버킷 support-attachments 안)';
COMMENT ON COLUMN support_replies.attachment_name IS '첨부 원본 파일명(표시용)';
COMMENT ON COLUMN support_replies.attachment_size IS '첨부 크기(바이트)';

-- ③ 비공개 버킷 — 5MB 제한(문의 폼과 동일 값). public=false가 핵심.
--    (버킷 행은 이미 있으면 그대로 둔다 — 실수 재실행으로 설정이 덮이지 않게)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('support-attachments', 'support-attachments', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 칸이 생겼는지 (4행이 나오면 정상):
--      SELECT column_name FROM information_schema.columns
--       WHERE (table_name = 'support_tickets' AND column_name = 'category')
--          OR (table_name = 'support_replies' AND column_name IN ('attachment_path','attachment_name','attachment_size'));
-- 2) 버킷이 비공개인지 (public = false 1행):
--      SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'support-attachments';
-- 3) 기존 티켓 조회가 여전히 성공하는지:
--      SELECT id FROM support_tickets ORDER BY created_at DESC LIMIT 1;
