-- ============================================================
-- 060_quote_requests.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 기관 견적 요청 전용 저장소 + 견적서 발급 이력.
--   지금까지 기관 견적 요청은 문의(inquiries)에 텍스트 한 덩어리로 저장돼
--   기관명·PC 수·상태를 구조적으로 다룰 수 없었다. 이 테이블이 그 자리를 만든다.
--   - quote_requests: 요청 1건 = 1행. 상태는 '접수됨(received)'/'견적 발급됨(quoted)' 두 가지뿐.
--   - quote_issues:   견적서 발급 1회 = 1행. 같은 요청에 여러 번 발급할 수 있고,
--                     견적 번호(quote_no)는 UNIQUE + 시퀀스 기본값이라 겹칠 수 없다(경합 안전).
--   - RLS는 켜되 정책을 만들지 않는다 = 브라우저(익명/로그인) 접근 전면 차단.
--     읽기·쓰기는 서버(서비스 롤: /api/quote, /admin/quotes)만 한다.
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행.
-- ⚠️ 비멱등 — 운영 재실행 금지 (기존 마이그레이션과 동일 관례).
-- ⚠️ 이 파일이 적용되기 전에는 기관 도입 페이지의 견적 요청 접수가
--    "저장 실패" 안내와 함께 거부된다(손님 데이터는 유실되지 않고 재시도 가능).
-- ============================================================

-- 견적 번호 시퀀스 — 번호 채번의 단일 출처(동시 발급에도 절대 겹치지 않음)
CREATE SEQUENCE quote_no_seq;

CREATE TABLE quote_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name     text        NOT NULL,                      -- 기관명
  biz_reg_no   text,                                      -- 사업자등록번호(선택·형식만 가볍게 확인)
  department   text,                                      -- 부서
  contact_name text,                                      -- 담당자 이름
  phone        text,                                      -- 연락처
  email        text        NOT NULL,                      -- 회신 이메일
  pc_count     integer     NOT NULL CHECK (pc_count >= 10), -- 도입 PC 수(최소 10대)
  needed_by    text,                                      -- 필요 시기(자유 입력)
  payment_pref text,                                      -- 희망 결제 방식(기존 폼 항목 유지)
  note         text,                                      -- 추가 요청사항
  status       text        NOT NULL DEFAULT 'received'
               CHECK (status IN ('received', 'quoted')),  -- 접수됨 / 견적 발급됨 (두 가지만)
  quoted_at    timestamptz,                               -- 마지막 견적 발급 시각
  quoted_by    uuid,                                      -- 마지막 발급 관리자(auth.users id)
  ip_address   text,                                      -- 접수 IP(문의와 동일 관례)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_requests_created_at ON quote_requests (created_at DESC);
CREATE INDEX idx_quote_requests_status     ON quote_requests (status);

-- 견적서 발급 이력 — 발급 1회 = 1행. 번호는 DB가 채번(UNIQUE + 시퀀스 기본값).
-- 어떤 상품·수량·금액으로 발급했는지 함께 남긴다(감사 추적·문의 대조용 — 검증 지적 반영).
CREATE TABLE quote_issues (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid        NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  quote_no         text        NOT NULL UNIQUE
                   -- 연도는 한국시간 기준(UTC 자정 경계에서 전년도로 찍히는 것 방지)
                   DEFAULT ('CZQ-' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY') || '-' || lpad(nextval('quote_no_seq')::text, 4, '0')),
  product_price_id uuid,                                  -- 발급 당시 선택한 옵션 행
  quantity         integer,                               -- 발급 당시 수량
  unit_price       numeric,                               -- 발급 당시 단가(원·VAT 포함)
  total_amount     bigint,                                -- 발급 당시 합계금액(원·VAT 포함)
  issued_by        uuid,                                  -- 발급 관리자(auth.users id)
  issued_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_issues_request ON quote_issues (request_id, issued_at DESC);

-- RLS: 켜고 정책 없음 = 서비스 롤(서버)만 접근 가능. 손님·로그인 사용자 직접 접근 차단.
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_issues   ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  quote_requests          IS '기관 견적 요청(기관 도입 페이지 폼 접수)';
COMMENT ON COLUMN quote_requests.status   IS 'received=접수됨, quoted=견적 발급됨 — 이 둘만 사용';
COMMENT ON TABLE  quote_issues            IS '견적서 발급 이력 — quote_no는 시퀀스 기본값+UNIQUE라 중복 불가. 발급 당시 상품·수량·금액 스냅샷 포함';

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) 접수 INSERT가 성공하는지 (성공해야 정상, ROLLBACK):
--      BEGIN;
--      INSERT INTO quote_requests (org_name, email, pc_count) VALUES ('검증용', 'test@example.com', 10);
--      ROLLBACK;
-- 2) PC 수 10 미만이 거부되는지 (실패해야 정상):
--      INSERT INTO quote_requests (org_name, email, pc_count) VALUES ('검증용', 'test@example.com', 9);
-- 3) 견적 번호가 자동 채번되고 형식이 맞는지 (CZQ-연도-0001 형태, ROLLBACK):
--      BEGIN;
--      WITH r AS (INSERT INTO quote_requests (org_name, email, pc_count) VALUES ('검증용','t@e.com',10) RETURNING id)
--      INSERT INTO quote_issues (request_id) SELECT id FROM r RETURNING quote_no;
--      ROLLBACK;
