-- ============================================================
-- 006_changelog.sql
-- 설명: 제품별 변경 이력(ChangeLog) 테이블 및 RLS
--       Master-Detail 구조: 왼쪽 상품 목록, 오른쪽 버전별 카드
--       content는 JSONB로 카테고리별 항목 저장
-- ============================================================

CREATE TABLE changelogs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version      text        NOT NULL,  -- 예: 'v2.4.1'
  release_date date        NOT NULL,
  is_latest    bool        NOT NULL DEFAULT false,

  -- 플랫폼별 다운로드 URL
  -- 예: { "mac": "https://...", "windows": "https://...", "chrome_store": "https://..." }
  download_urls jsonb      DEFAULT '{}',

  -- 파일 크기
  -- 예: { "mac": "45.2 MB", "windows": "38.1 MB" }
  file_sizes    jsonb      DEFAULT '{}',

  -- 체크섬 (SHA-256)
  -- 예: { "mac": "abc123...", "windows": "def456..." }
  checksums     jsonb      DEFAULT '{}',

  -- 변경 내용 (카테고리별 항목 배열)
  -- 예: {
  --   "new_features":     ["기능1 설명", "기능2 설명"],
  --   "improvements":     ["개선사항1"],
  --   "bug_fixes":        ["버그 수정1"],
  --   "breaking_changes": []
  -- }
  content       jsonb      NOT NULL DEFAULT '{}',

  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, version)
);

-- is_latest 는 상품당 하나만 true여야 함 — 트리거로 자동 관리
CREATE OR REPLACE FUNCTION enforce_single_latest_changelog()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE changelogs
    SET is_latest = false
    WHERE product_id = NEW.product_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER changelog_single_latest
  AFTER INSERT OR UPDATE ON changelogs
  FOR EACH ROW EXECUTE FUNCTION enforce_single_latest_changelog();

-- RLS
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;

-- 전체 공개 (비로그인 포함)
CREATE POLICY "ChangeLog 전체 공개 조회"
  ON changelogs FOR SELECT USING (true);

-- 관리자만 추가/수정/삭제
CREATE POLICY "관리자만 ChangeLog 작성"
  ON changelogs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
