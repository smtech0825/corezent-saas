-- @마이그레이션: 052_profiles_drop_country
-- @설명: 회원가입 국가 선택 기능 제거에 따라 profiles.country 컬럼을 삭제한다.
--        회원가입 폼·dashboard 설정·admin 표시 및 auth/callback 저장 로직에서 country 참조를
--        모두 제거했으므로 이 컬럼을 읽거나 쓰는 코드는 남아있지 않다.
--        RLS 정책은 행 단위라 컬럼 삭제로 깨지지 않는다(001에서 추가, 023 이후 유지).
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(코드 배포 전에 적용)

ALTER TABLE profiles DROP COLUMN IF EXISTS country;
