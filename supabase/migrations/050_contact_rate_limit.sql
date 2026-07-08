-- ============================================================
-- 050_contact_rate_limit.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: /api/contact 문의폼 Rate Limit을 인메모리 Map → Supabase 테이블로 전환.
--       기존 in-memory Map은 Vercel 서버리스에서 인스턴스마다 별도 메모리를 가져
--       인스턴스가 여러 개 뜨면 제한이 사실상 우회됨. 테이블 기반이면 인스턴스와 무관하게
--       공유된다. 1분 단위 고정 윈도우, IP당 분당 3회(기존 로직과 동일 기준) 유지.
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_rate_limit (
  ip            text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count int         NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, window_start)
);

CREATE INDEX IF NOT EXISTS idx_contact_rate_limit_ip ON contact_rate_limit(ip);

-- RLS: 정책을 두지 않음 = anon/authenticated 완전 거부, service_role만 접근(RLS 우회).
-- (RLS Wave A/B에서 정리한 "TO 없이 WITH CHECK(true)" 실수를 반복하지 않기 위해 정책 자체를 안 둠.)
ALTER TABLE contact_rate_limit ENABLE ROW LEVEL SECURITY;

-- ── 원자적 확인+증가 RPC ────────────────────────────────────────────────────
-- read-then-upsert 대신 INSERT ... ON CONFLICT DO UPDATE로 한 트랜잭션에서 증가시켜
-- 같은 IP의 동시 요청이 경합해도 카운트가 누락되지 않게 한다(002/030과 동일 패턴).
-- 매 호출마다 하루 지난 행도 함께 정리(인덱스 있어 대부분 0행 — 별도 cron 불필요).
CREATE OR REPLACE FUNCTION check_contact_rate_limit(
  p_ip text,
  p_window_start timestamptz,
  p_max int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM contact_rate_limit WHERE window_start < now() - interval '1 day';

  INSERT INTO contact_rate_limit (ip, window_start, request_count)
  VALUES (p_ip, p_window_start, 1)
  ON CONFLICT (ip, window_start)
  DO UPDATE SET request_count = contact_rate_limit.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN jsonb_build_object('count', v_count, 'limited', v_count > p_max);
END;
$$;

-- SECURITY DEFINER 함수는 RLS를 우회한다. 앱은 항상 service_role(admin 클라)로만 호출하므로
-- anon/authenticated의 EXECUTE 권한을 회수한다(028/030과 동일 패턴 — ★보안).
REVOKE EXECUTE ON FUNCTION check_contact_rate_limit(text, timestamptz, int) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION check_contact_rate_limit(text, timestamptz, int) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT check_contact_rate_limit('1.2.3.4', date_trunc('minute', now()), 3);  -- {"count":1,"limited":false}
-- 4번 연속 호출 시 4번째부터 limited=true 확인.
-- ============================================================
