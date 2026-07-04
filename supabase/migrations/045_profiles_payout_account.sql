-- @마이그레이션: 045_profiles_payout_account
-- @설명: 제휴 정산 계좌 — profiles에 payout_bank·payout_account_number·payout_account_holder 추가.
--        본인 읽기/쓰기는 기존 RLS('본인 프로필만 조회/수정 가능')로 이미 커버되고,
--        admin은 service role(createAdminClient)로 조회하므로 RLS 변경이 필요 없다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(코드 배포 전에 적용)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_bank            text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_account_number  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_account_holder  text;

COMMENT ON COLUMN profiles.payout_bank           IS '제휴 정산 계좌 은행(lib/banks.ts 값)';
COMMENT ON COLUMN profiles.payout_account_number IS '제휴 정산 계좌번호(숫자·하이픈만 — 서버 저장 시 trim·형식 검증)';
COMMENT ON COLUMN profiles.payout_account_holder IS '제휴 정산 계좌 예금주';
