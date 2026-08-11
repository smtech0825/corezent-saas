-- ============================================================
-- 055_tax_engine_schema.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 부동산 세금 계산기 Stage 1 — 룰 저장소 스키마 5개 테이블 신설
--   1) tax_rules            룰 저장소 (세율표·구간·공제액을 jsonb로 보관)
--   2) tax_regulated_areas  규제지역 지정/해제 이력 (세목별 적용)
--   3) tax_test_cases       회귀 테스트 케이스 (이번 Stage는 테이블만)
--   4) tax_calculation_logs 계산 이력 (개인식별정보 저장 금지)
--   5) tax_law_change_queue 법령 개정 감지 큐 (다음 Stage용 — 빈 테이블)
--
--   ⚠️ 시드 데이터 없음(의도된 설계): 세율·공제액·과세표준 구간·중과 배율·
--      조정대상지역/투기과열지구 목록은 어떤 형태로도 이 파일에 넣지 않는다.
--      전부 관리자가 법령 근거(법령명·조문·원문 링크)와 함께 직접 입력한다.
--
-- RLS 방침(047·049 관례를 따름 — service_role용 정책은 만들지 않는다):
--   - tax_rules / tax_regulated_areas: 공개 SELECT 정책만 (계산기가 anon으로 읽음)
--   - tax_test_cases / tax_calculation_logs / tax_law_change_queue:
--     정책 0개 = anon/authenticated 기본 거부 = 사실상 service_role 전용
--
-- 적용 방법: 운영자가 Supabase SQL Editor에서 직접 실행.
-- ============================================================

-- ── 1. tax_rules — 룰 저장소 ────────────────────────────────────────────────
--    같은 rule_key가 시행 기간·status를 달리해 여러 행 존재할 수 있다(이력 구조).
--    기간 겹침 검사는 관리자 화면(저장 전 경고)에서 수행 — DB 제약으로 막지 않는다.
CREATE TABLE IF NOT EXISTS tax_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type       text        NOT NULL
                             CHECK (tax_type IN ('acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance')),
  rule_key       text        NOT NULL,   -- 사람이 읽을 수 있는 룰 식별자 (예: 'acquisition.base_rate_table')
  rule_value     jsonb       NOT NULL,   -- 세율표·구간·공제액 등 실제 값 (관리자 입력)
  effective_from date        NOT NULL,   -- 시행일
  effective_to   date,                   -- 종료일. NULL이면 현재 유효
  status         text        NOT NULL
                             CHECK (status IN ('confirmed', 'proposed', 'repealed')),
  law_name       text        NOT NULL,   -- 근거 법령명 (예: 지방세법)
  law_article    text        NOT NULL,   -- 근거 조문 (예: 제11조제1항제8호)
  law_url        text        NOT NULL,   -- 법제처 원문 링크
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- 종료일이 시행일보다 앞설 수 없다
  CONSTRAINT tax_rules_period_check CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TRIGGER tax_rules_updated_at
  BEFORE UPDATE ON tax_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 엔진의 기준일 조회(세목 + 시행일 범위 + status)가 가장 잦다
CREATE INDEX IF NOT EXISTS idx_tax_rules_lookup
  ON tax_rules (tax_type, effective_from, status);

-- ── 2. tax_regulated_areas — 규제지역 지정/해제 이력 ────────────────────────
--    같은 지역이라도 세목마다 적용 시작일이 다를 수 있어 applies_to로 세목을 한정한다.
CREATE TABLE IF NOT EXISTS tax_regulated_areas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sido            text        NOT NULL,   -- 시·도
  sigungu         text        NOT NULL,   -- 시·군·구
  region_code     text        NOT NULL,   -- 행정구역 코드
  area_type       text        NOT NULL
                              CHECK (area_type IN ('adjustment', 'speculation')),
  -- 이 이력이 적용되는 세목 목록. 'all'이면 전 세목 적용
  applies_to      text[]      NOT NULL
                              CHECK (
                                array_length(applies_to, 1) >= 1
                                AND applies_to <@ ARRAY['all', 'acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance']::text[]
                              ),
  designated_from date        NOT NULL,   -- 지정일
  designated_to   date,                   -- 해제일. NULL이면 현재 지정 상태
  source_url      text        NOT NULL,   -- 국토교통부 공고 링크
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 해제일이 지정일보다 앞설 수 없다
  CONSTRAINT tax_regulated_areas_period_check CHECK (designated_to IS NULL OR designated_to >= designated_from)
);

CREATE TRIGGER tax_regulated_areas_updated_at
  BEFORE UPDATE ON tax_regulated_areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 규제지역 판정(지역코드 + 구분 + 지정일 범위) 조회가 가장 잦다
CREATE INDEX IF NOT EXISTS idx_tax_regulated_areas_lookup
  ON tax_regulated_areas (region_code, area_type, designated_from);

-- ── 3. tax_test_cases — 회귀 테스트 케이스 ──────────────────────────────────
--    이번 Stage는 테이블만 만든다. 실행기는 다음 Stage.
CREATE TABLE IF NOT EXISTS tax_test_cases (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type           text        NOT NULL
                                 CHECK (tax_type IN ('acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance')),
  input              jsonb       NOT NULL,   -- 입력 조건
  expected_total     numeric     NOT NULL CHECK (expected_total >= 0),
  expected_breakdown jsonb,                  -- 세목별 기대값 (총액만 아는 출처면 NULL)
  source             text        NOT NULL,   -- 정답 출처 (홈택스·위택스 등)
  verified_at        timestamptz,            -- 검증 일시
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── 4. tax_calculation_logs — 계산 이력 ─────────────────────────────────────
--    ⚠️ 개인식별정보(IP·이메일·이름) 저장 금지. input에도 넣지 않는다.
CREATE TABLE IF NOT EXISTS tax_calculation_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type         text        NOT NULL
                               CHECK (tax_type IN ('acquisition', 'rental', 'transfer', 'property', 'comprehensive', 'inheritance')),
  base_date        date        NOT NULL,   -- 계산 기준일
  rule_mode        text        NOT NULL
                               CHECK (rule_mode IN ('confirmed', 'proposed')),
  input            jsonb       NOT NULL,
  output           jsonb       NOT NULL,
  applied_rule_ids jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- 적용된 tax_rules.id 목록
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 5. tax_law_change_queue — 법령 개정 감지 큐 (다음 Stage용) ──────────────
--    법제처 OPEN API 연동 시 사용. 이번 Stage에서는 어떤 코드도 이 테이블에 쓰지 않는다.
CREATE TABLE IF NOT EXISTS tax_law_change_queue (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name       text        NOT NULL,   -- 법령명
  law_id         text,                   -- 법제처 법령 ID
  article_no     text,                   -- 조문 번호
  detected_at    timestamptz NOT NULL DEFAULT now(),  -- 감지 일시
  effective_date date,                   -- 시행일
  change_type    text,                   -- 변경 유형
  raw_payload    jsonb,                  -- 원본 응답
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'reviewed', 'ignored')),
  reviewed_at    timestamptz             -- 검토 일시
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--    service_role은 RLS를 우회하므로 쓰기용 정책은 만들지 않는다(047에서 정리한 관례).
ALTER TABLE tax_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_regulated_areas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_test_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_calculation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_law_change_queue ENABLE ROW LEVEL SECURITY;

-- 계산기(anon 포함)가 룰·규제지역을 읽어야 하므로 이 2개만 공개 SELECT
CREATE POLICY "세금 룰 공개 조회"
  ON tax_rules FOR SELECT USING (true);

CREATE POLICY "규제지역 공개 조회"
  ON tax_regulated_areas FOR SELECT USING (true);

-- tax_test_cases · tax_calculation_logs · tax_law_change_queue:
-- 정책 없음 = anon/authenticated 전면 거부 (service_role 전용)

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- 1) RLS 활성화 확인 (5행 전부 t 이어야 함):
--      SELECT relname, relrowsecurity FROM pg_class
--       WHERE relname IN ('tax_rules', 'tax_regulated_areas', 'tax_test_cases',
--                         'tax_calculation_logs', 'tax_law_change_queue')
--       ORDER BY relname;
-- 2) 정책 확인 (공개 SELECT 2개만 있어야 함 — tax_rules·tax_regulated_areas):
--      SELECT tablename, policyname, cmd FROM pg_policies
--       WHERE tablename IN ('tax_rules', 'tax_regulated_areas', 'tax_test_cases',
--                           'tax_calculation_logs', 'tax_law_change_queue')
--       ORDER BY tablename;
-- 3) 시드 데이터 없음 확인 (전부 0이어야 함):
--      SELECT (SELECT count(*) FROM tax_rules)            AS rules,
--             (SELECT count(*) FROM tax_regulated_areas)  AS areas,
--             (SELECT count(*) FROM tax_test_cases)       AS test_cases,
--             (SELECT count(*) FROM tax_calculation_logs) AS logs,
--             (SELECT count(*) FROM tax_law_change_queue) AS queue;
-- 4) updated_at 트리거 확인 (2행이어야 함):
--      SELECT tgname FROM pg_trigger
--       WHERE tgname IN ('tax_rules_updated_at', 'tax_regulated_areas_updated_at');
-- ============================================================
