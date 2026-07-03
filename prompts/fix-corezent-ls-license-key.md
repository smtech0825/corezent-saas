# fix-corezent-ls-license-key

You are a senior Next.js/TypeScript engineer fixing the **CoreZent_SaaS** project. Work in **Waves**. After each Wave: verify, commit changed files only, **STOP and report**.

## STRICT RULES (절대 준수)
- **줄번호는 출발점**: 모든 `:줄`은 점검 시점 기준. **실제 파일을 열어 확인한 뒤** 수정. 위치가 다르면 실제 위치에, 못 찾으면 멈추고 보고.
- **각 Wave 검증**: 타입체크(`tsc --noEmit` 또는 `npm run build`) 통과.
- **커밋**: 변경한 파일만 개별 `git add`. `git add .` 금지. **푸시는 Steve 확인 후**(지시 없으면 푸시 안 함).
- **다른 작업자/다른 세션의 미커밋 변경은 건드리지 않는다.**
- **비밀값 출력 금지**: API 키·실제 라이선스 키값 출력·로깅 금지. env로만 참조.

## 배경 — 확정된 버그
구매 시 **구매자 이메일의 LemonSqueezy 키와 DB 저장 키가 달라** 이메일 키로 인증이 안 된다. 점검으로 원인 확정:
- **루트 원인 = env 변수명 오타.** `fetchLsLicenseKey`가 `process.env.LEMON_SQUEEZY_API_KEY`(언더스코어 있는 틀린 이름, `lib/lemonsqueezy.ts:88,90`)를 읽는데, 정식 이름은 `LEMONSQUEEZY_API_KEY`(언더스코어 없음, `.env.example:28`·`PROJECT_STRUCTURE.md:414`·`revoke/route.ts:129,157`이 사용). → apiKey=undefined → 조기 null 반환 → 항상 `generateSerialKey()` 폴백(서버 자체 키)이 DB에 저장됨.
- 한편 LemonSqueezy는 "License keys" 기능 ON이라 **자체 키를 만들어 자기가 이메일 발송** → 이 키는 DB에 없어 인증 실패. 그래서 키가 갈림.
- 같은 오타가 `subscriptions/cancel/route.ts:55,57`에도 있어 구독 취소 LS API도 깨졌을 가능성(같은 뿌리).
- LS 키 가져오는 로직 자체(`fetchLsLicenseKey` → GET /v1/license-keys?filter[order_id]=… → attributes.key, `lemonsqueezy.ts:95-112`)는 **구조가 맞다.** env명만 문제.

## ★Steve 결정사항 (확정)
1. **범위**: 공유 함수 그대로 — env명 정렬은 geniestock·geniework·geniepost 전부에 적용(원래 의도된 동작으로 복구. 기존 저장 키는 무영향, 신규 발급 키만 LS키로).
2. **중복 이메일**: 서버 측 키 이메일 발송을 끈다 → **LemonSqueezy 이메일만** 가게.
3. **구독 취소 오타도 같이 고친다.**

## Wave 1 — env 변수명 통일 (핵심·1순위)
- 틀린 env명 `LEMON_SQUEEZY_API_KEY`(언더스코어 있음)를 **정식 `LEMONSQUEEZY_API_KEY`(언더스코어 없음)**로 정렬:
  - `lib/lemonsqueezy.ts:88,90`(`fetchLsLicenseKey`의 apiKey 읽기·로그).
  - `subscriptions/cancel/route.ts:55,57`(구독 취소 LS API).
  - 그 외 코드 전역에서 `LEMON_SQUEEZY_API_KEY`(언더스코어 있는 형태)를 grep으로 **전수 검색**해, 틀린 이름을 쓰는 곳이 더 있으면 모두 정식 이름으로 정렬(보고에 목록).
- ★실제 사용처 정식 이름이 `LEMONSQUEEZY_API_KEY`가 맞는지 `.env.example`·`revoke/route.ts`로 재확인 후 그 이름으로 통일.
### Wave 1 검증·커밋 후 STOP·보고.
- 변경한 파일·줄 목록, grep으로 찾은 틀린 이름 전체 위치. 빌드/타입체크 통과.

## Wave 2 — 서버 키 이메일 발송 끄기 (중복 이메일 제거)
- 웹훅 `webhooks/lemonsqueezy/route.ts`의 서버 키 이메일 발송(`:678-686` 부근 `sendEmail(to: 구매자, …, serialKey)`)을 **끈다** → LemonSqueezy 자체 이메일만 가게.
  - ★주의: 이 sendEmail이 geniestock/geniepost/geniework 공용인지 확인. 결정1대로 **공유 함수 정책과 일관**되게: LS 키 이메일을 LS가 보내는 제품(License keys ON) 전부에서 서버 발송을 끈다. 단, License keys 기능을 안 쓰는 제품/경로가 있어 서버 이메일이 유일한 키 전달 수단이면 그건 끄지 말 것 — 그런 경로가 있는지 먼저 확인하고, 있으면 보고 후 판단.
  - 키 생성·DB 저장 로직(serialKey·supaInsertLicense)은 **그대로 둔다**(이메일 발송만 제거). 키는 여전히 DB에 저장돼야 함.
  - CoreZent 내부 licenses 기록(`:668`)·기타 비-이메일 처리는 보존.
### Wave 2 검증·커밋 후 STOP·보고.
- 어느 발송을 껐는지, 키 전달이 유일 수단인 경로가 없는지 확인 결과.

## 검증 (전체)
- env명 정렬 후 `fetchLsLicenseKey`가 정식 변수를 읽어 LS 키를 가져오는 경로가 열리는지(코드상).
- 서버 키 이메일이 더는 안 가는지(중복 제거). DB 저장은 유지.
- geniestock·geniepost 경로가 깨지지 않는지(원래 의도로의 복구·회귀 아님 확인).
- 빌드·타입체크 통과.

## 외부 확인 (Steve — 코드 밖)
- Vercel `LEMONSQUEEZY_API_KEY`(언더스코어 없음)에 유효한 LS API 키 값이 있는지(revoke 등이 쓰던 것이라 있을 가능성 높음). 틀린 이름 변수 `LEMON_SQUEEZY_API_KEY`는 코드가 더는 안 쓰게 되므로 이후 삭제 가능(무해).
- 푸시·배포 후 테스트 구매 1건으로: 이메일 키 = DB 키 = 인증 성공 확인.

## 보고 (각 Wave)
- 변경 파일·줄, grep 전수 결과, 수정 내용, 검증 결과, 커밋 해시. geniestock/geniepost 영향(의도된 복구) 명시. 비밀값 미출력. 푸시 안 함(Steve 확인 후).
