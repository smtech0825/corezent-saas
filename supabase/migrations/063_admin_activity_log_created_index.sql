-- ============================================================
-- 063_admin_activity_log_created_index.sql
-- 대상 DB: 본체 Supabase (CoreZent 메인 프로젝트)
-- 설명: 작업 기록 화면(/admin/activity)의 시각 정렬용 색인.
--       화면이 항상 created_at 내림차순 정렬 + 기간 필터로 조회하는데
--       049에는 admin_user_id·(target_type, target_id) 색인만 있고
--       created_at 색인이 없어 기록이 수천 건 쌓이면 매 조회가 전체를 훑는다.
--       자매 테이블 034(idx_notification_logs_created)와 같은 방식.
--       ★ 실행은 운영자(대표님)가 Supabase SQL Editor에서 직접 한다.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON admin_activity_log(created_at DESC);

-- ─── 회귀 검증(운영자 적용 후) ────────────────────────────────────────────
-- SELECT indexname FROM pg_indexes WHERE tablename = 'admin_activity_log';
--   → idx_admin_activity_log_created 가 목록에 보이면 성공.
-- 적용해도 기존 데이터·화면 동작은 변하지 않는다(조회 속도만 영향).
-- ============================================================
