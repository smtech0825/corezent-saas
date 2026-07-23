-- @마이그레이션: 053_profiles_add_phone
-- @설명: 회원가입 전화번호 필수화 기반 — profiles에 phone 컬럼을 추가한다.
--   · nullable: 기존 회원 소급 수집 때문(온보딩 게이트가 다음 로그인 시 수집).
--   · 저장 형식: 숫자만(예: 01012345678). 하이픈·공백·+82 접두는 앱의
--     src/lib/phone.ts(normalizeKoreanPhone)에서 저장 전에 제거·정규화한다.
-- @적용: Steve가 Supabase SQL Editor에서 직접 실행(코드 배포 전에 적용).
--
-- ⚠️ handle_new_user() 트리거는 건드리지 않는다.
--   031_affiliate_code_backfill_and_trigger.sql에서 확인된 대로 라이브 함수가
--   repo와 드리프트(full_name·avatar_url 등 라이브 전용 컬럼 세팅 포함)돼 있어
--   재정의 시 라이브 로직이 깨질 수 있다. 전화번호 수집은 DB 트리거가 아니라
--   앱 계층에서 처리한다:
--     1) 이메일 가입 폼이 정규화된 phone을 signUp options.data(=raw_user_meta_data)로 전달.
--     2) 보호영역(dashboard) 최초 진입 시 서버 레이아웃이 메타데이터의 phone을
--        profiles.phone에 1회 동기화(src/lib/onboarding.ts).
--     3) 그래도 비어 있으면 /onboarding/phone 게이트가 직접 입력받는다.
--
-- RLS/트리거 영향:
--   · UPDATE 정책 "본인 프로필만 수정 가능"(001, auth.uid()=id)으로 본인 phone 수정 가능.
--   · prevent_self_privilege_escalation 트리거(047)는 role·status만 잠그므로 phone과 무관.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

-- (선택) 적용 후 검증:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name = 'phone';
