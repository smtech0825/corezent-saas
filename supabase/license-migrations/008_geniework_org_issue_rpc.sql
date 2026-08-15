-- ════════════════════════════════════════════════════════════════════════
-- 실행 대상: 지니워크 라이선스 전용 Supabase 프로젝트 (ecltbezstxufivhbhsjp)
--           ★ CoreZent 본체 프로젝트 아님 · 지니스톡(vpwm…) 아님
-- 목적   : 기관 라이선스 「바로 발급」용 DB 함수 — license_keys + gw_org_licenses
--          두 표를 한 트랜잭션으로 쓴다(함수 전체가 하나의 트랜잭션이라
--          한쪽 INSERT가 실패하면 전체가 취소된다 — 한쪽만 써지는 경우 없음).
-- 정본   : prompts/기관라이선스_발급_DB.html 의 등록 SQL — 아래 본문은 그 문장
--          그대로다(입력값 자리만 함수 인자로 받는다). ⚠️ 문장을 고치지 말 것.
--          원본의 BEGIN;/COMMIT;은 함수의 트랜잭션 성질이 대신한다.
--          issued_at·updated_at은 원본과 동일하게 넣지 않는다(DB가 채운다).
-- 안전   : 같은 키 재발급은 license_keys UNIQUE(license_key)가 거부한다(원본과
--          동일 동작 — "두 번째는 거부"). 호출은 service_role만 가능.
-- 관례   : 006_geniework_tester_ai_rpc.sql 과 동일(SECURITY DEFINER·search_path·REVOKE)
-- ★ 실행은 운영자(대표님)가 해당 프로젝트 SQL Editor에서 직접 한다.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION issue_org_license(
  p_license_key         text,
  p_org_name            text,
  p_biz_reg_no          text,
  p_contact_name        text,
  p_contact_phone       text,
  p_contact_email       text,
  p_contract_doc_no     text,
  p_pc_count            int,
  p_contract_start      date,
  p_contract_end        date,
  p_base_package_krw    bigint,
  p_extra_package_krw   bigint,
  p_extra_months_left   int,
  p_credit_start_month  text,
  p_ai_workspace_id     text,
  p_workspace_limit_usd numeric,   -- 비우면 NULL로 호출(원본의 '' → NULL과 동일)
  p_fx_krw_per_usd      numeric,
  p_issuer_note         text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ─── 여기부터 원본 등록 SQL 문장 그대로(입력값 값 자리만 인자) ───────────
  WITH 입력값 AS (
    SELECT
      p_license_key::text AS license_key,
      p_org_name::text AS org_name,
      p_biz_reg_no::text AS biz_reg_no,
      p_contact_name::text AS contact_name,
      p_contact_phone::text AS contact_phone,
      p_contact_email::text AS contact_email,
      p_contract_doc_no::text AS contract_doc_no,
      p_pc_count::int AS pc_count,
      p_contract_start::date AS contract_start,
      p_contract_end::date AS contract_end,
      p_base_package_krw::bigint AS base_package_krw,
      p_extra_package_krw::bigint AS extra_package_krw,
      p_extra_months_left::int AS extra_months_left,
      p_credit_start_month::text AS credit_start_month,
      p_ai_workspace_id::text AS ai_workspace_id,
      p_workspace_limit_usd::numeric AS workspace_limit_usd,
      p_fx_krw_per_usd::numeric AS fx_krw_per_usd,
      p_issuer_note::text AS issuer_note
  ),
  -- 아래부터는 고치지 않는다 ─────────────────────────────────────
  라이선스_등록 AS (
    INSERT INTO license_keys
      (license_key, tier, source, buyer_email, expires_at, is_active, product)
    SELECT
      license_key,
      pc_count || 'pc',
      'manual',
      NULLIF(contact_email, ''),
      (contract_end + 1) AT TIME ZONE 'Asia/Seoul' - INTERVAL '1 second',
      TRUE,
      'geniework'
    FROM 입력값
    RETURNING license_key
  )
  INSERT INTO gw_org_licenses (
    license_key, org_name, biz_reg_no,
    contact_name, contact_phone, contact_email, contract_doc_no,
    pc_count, contract_start, contract_end, status,
    base_package_krw, extra_package_krw, extra_months_left, extra_base_month,
    credit_start_month, ai_workspace_id, workspace_limit_usd, fx_krw_per_usd, issuer_note
  )
  SELECT
    license_key, org_name, NULLIF(biz_reg_no, ''),
    NULLIF(contact_name, ''), NULLIF(contact_phone, ''), NULLIF(contact_email, ''), NULLIF(contract_doc_no, ''),
    pc_count, contract_start, contract_end, 'active',
    base_package_krw, extra_package_krw, extra_months_left,
    to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM'),
    credit_start_month, NULLIF(ai_workspace_id, ''), workspace_limit_usd, fx_krw_per_usd, NULLIF(issuer_note, '')
  FROM 입력값;
  -- ─── 원본 문장 끝 ────────────────────────────────────────────────────────

  RETURN p_license_key;
END
$$;

-- SECURITY DEFINER 함수는 RLS 우회 → anon/authenticated EXECUTE 회수, service_role만 부여.
REVOKE EXECUTE ON FUNCTION issue_org_license(text,text,text,text,text,text,text,int,date,date,bigint,bigint,int,text,text,numeric,numeric,text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION issue_org_license(text,text,text,text,text,text,text,int,date,date,bigint,bigint,int,text,text,numeric,numeric,text) TO service_role;

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'issue_org_license';
--   → 한 행 나오면 성공. 실제 발급 시험은 하지 않는다(진짜 등록됩니다).
-- ════════════════════════════════════════════════════════════════════════
