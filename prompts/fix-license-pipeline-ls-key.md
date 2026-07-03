# fix-license-pipeline-ls-key

You are a senior Next.js 15 (App Router) / TypeScript / Supabase engineer on the **CoreZent** web codebase. Fix the broken payment→license pipeline so that **every purchase results in the real Lemon Squeezy (LS) license key being stored in the DB and shown on the dashboard** — never the self-generated fallback key — **regardless of what the product is named (Korean, English, anything)**. Work Wave by Wave; stop and report at each Wave end.

## 목표 (Steve의 요구 — 명확)
구매하면 **LS가 발급한 진짜 라이선스 키**가 ① 본체 `licenses.serial_key`에 저장되고 ② GenieWork면 GW_SUPABASE `license_keys`에도 등록되고 ③ 대시보드에 표시되어야 한다. 자체생성 키(`generateSerialKey`)가 아니라 **LS 키를 사용**해야 한다. 상품명을 한국어로 바꿔도 이게 깨지면 안 된다.

## 확정된 원인 (bug-detective 진단 — variant_id 매칭은 정상, 이름 의존 분기가 범인)
주문→상품 매칭은 `variant_id`로 정상(route.ts:217-222). 깨지는 건 그 다음 `createLicense` 안의 **상품명 텍스트 의존 분기들**이다. 한국어 이름이 되니 전부 false가 되어 LS키 경로가 통째로 SKIP되고 자체키로 폴백됨:
- `isSupabaseProduct` (route.ts:55-60) — `name.includes('geniework'/'geniestock')` → 한국어면 null → Supabase 분기(777-876) SKIP → `licenses`·GW DB INSERT 안 됨.
- `tierFromGenieWork` (route.ts:70-78) / `tierFromProductName` (62-68) — `name.includes('1pc'…)` → 한국어면 null → route.ts:781-784 조기 return.
- GeniePost 폴백 (route.ts:881-882) `!productName.includes('geniepost')` → 한국어면 true → isPro=true → `fetchLsLicenseKey` 시도하나 **race로 null**(아래) → route.ts:899 `generateSerialKey()` 폴백 → 자체키가 박힘.
- 사후 동기화 `license_key_created` 핸들러: `resolveSupabaseProductByLsProductId` (route.ts:477-495)가 route.ts:494 `isSupabaseProduct(product.name)`로 최종 판정 → 한국어면 null → skip → `applyLsKeyForOrder`·`syncCoreLicenseKey`(498-517) 죽음 → LS 진짜 키가 서버 어디에도 반영 안 됨(이메일로만 감).
- **race condition**: LS "License keys ON" 상품은 키 발급(`license_key_created`)이 주문 웹훅(`order_created`)과 경쟁. 주문 처리 시점엔 키가 아직 없어 `fetchLsLicenseKey`가 null(lemonsqueezy.ts:117-119). 이름 문제를 고쳐도 이 race가 남으면 여전히 자체키로 폴백됨 → **반드시 같이 해결.**
- **조용한 실패**: 최상위 catch가 throw를 삼키고 200 반환(route.ts:138-141), 하위 단계도 각자 try/catch로 삼킴 → 라이선스 생성이 실패해도 LS엔 성공으로 보고되는 무증상 구조.
- ※ 줄번호는 출발점. 실제 코드를 열어 확인.

## STRICT RULES
- **추측 금지**: 본 문서·진단의 경로·줄번호는 출발점. 실제 코드/스키마를 연 `파일:줄` 근거 위에서만.
- **보편 해결 / 하드코딩 금지.** 상품명 문자열 의존을 **안정 식별자(variant_id 또는 명시 컬럼)** 로 교체하는 게 핵심 — 또 다른 이름/한글 하드코딩으로 바꾸지 말 것.
- **결제 식별자 불변**: `lemon_squeezy_variant_id`·`lemon_squeezy_product_id`·`checkout_url`·웹훅 HMAC 검증 미접촉.
- **GW_SUPABASE(외부 라이선스 DB)·GeniePost Sheets 경로 신중**: GenieWork는 GW_SUPABASE `license_keys`가 슬롯 한도 강제의 실체. 본체 `licenses`와 GW DB 양쪽에 LS키가 일관되게 들어가야 함.
- **멱등성 유지**: `lemon_squeezy_order_id` UNIQUE 등 기존 중복 방지 보존. 웹훅 재전송·재시도에 안전해야 함.
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) Critical/High 0 → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음.
- 각 보고: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임.**
- **돈·라이선스 경로**: 에러를 조용히 삼키지 말 것. 실패는 로그·표면화. 단 웹훅 200/재시도 정책은 신중히(LS 재시도 유발 여부 고려).

---

## WAVE 0 — 설계 확정 (READ-ONLY · 변경 0)
근본 수정의 **두 축**을 코드/스키마 근거로 확정해 설계안만 보고. 코드 변경 없음.

**축 A — 이름 의존 분기를 무엇으로 대체할까 (제품 패밀리·티어 식별)**
- 옵션 A1: `products`/`product_prices`에 명시 컬럼 추가(`license_family`: geniework/geniestock/geniepost, `license_tier`: 1pc/3pc/10pc/lite/pro/max). variant_id로 이미 찾는 productPrice 행(route.ts:218)에서 그대로 읽음. → 상품명 완전 독립. (스키마 변경 = Steve 승인·직접 적용)
- 옵션 A2: 컬럼 없이 `lemon_squeezy_variant_id`/`lemon_squeezy_product_id`만으로 매핑(코드 내 변환 없이 DB 조회로). 스키마 변경 최소.
- 각 옵션의 영향 범위(수정할 분기 5곳: 55-60, 62-68, 70-78, 881-882, 494)·장단점·마이그레이션 필요 여부를 표로. **권장안 1개 명시.**
- ⚠️ 어느 옵션이든 결과는 동일: route.ts의 모든 `name.includes(...)`가 안정 식별자 기반으로 교체되어야 함.

**축 B — race condition 해결 (LS키가 주문 시점에 아직 없을 때)**
- 현재: `order_created`에서 `fetchLsLicenseKey`가 race로 null → 자체키 폴백. 사후 `license_key_created`가 와도 동기화 분기가 이름 의존으로 죽음.
- 해결 방향 후보(코드 근거로 판정):
  - B1: `order_created`에서 LS키가 아직 없으면 **자체키로 박지 말고**, 키 자리를 pending으로 두고 `license_key_created`(또는 사후 동기화)가 **반드시** LS키로 채우게. 사후 핸들러의 이름 의존(494)을 축 A로 고치면 이 경로가 살아남.
  - B2: `order_created` 시점에 LS API를 재시도/지연조회해 키 확보(레이트리밋·지연 주의).
  - B3: `fetchLsLicenseKey`가 order_id로 못 찾으면 LS license-keys API를 다른 키(예: order_item/product)로 재조회.
- **핵심 요구**: 최종적으로 대시보드 `licenses.serial_key`에 **LS 키**가 들어가야 함. 자체키는 LS키가 정말 없는 상품(자체발급 상품)에만. → 어떤 상품이 "LS 자동발급"이고 어떤 게 "자체발급"인지 구분 기준도 안정 식별자로(이름 아님).
- race를 닫는 **권장 설계 1개 명시**(가장 단순·안전·멱등).

**축 C — 조용한 실패 가시화**
- route.ts:138-141 최상위 catch와 하위 try/catch가 라이선스 실패를 삼키는 구조 점검. LS 재시도를 유발하지 않으면서도 **실패를 로그/관리자에 남기는** 최소 방법 제안(예: 실패 시 별도 기록 테이블·로그, 단 웹훅은 정책상 200 유지할지 판정).

→ **STOP & 설계 보고.** 축 A 권장안(스키마 변경 여부 포함)·축 B 권장안·축 C 방법을 Steve가 승인하면 Wave 1로.

## WAVE 1 — 이름 의존 분기 제거 (축 A 적용)
- Wave 0 승인안대로, route.ts의 이름 기반 분기 5곳(55-60, 62-68, 70-78, 881-882, 494)을 **안정 식별자 기반**으로 교체.
- 스키마 컬럼 추가안(A1)이면: 마이그레이션 파일 작성(컬럼 추가 + 기존 행 백필값 매핑). **적용은 Steve가 SQL Editor에서 직접**, CC는 외부 DB·연결키 미접촉. 백필은 현재 variant_id→family/tier 매핑을 명시.
- 제품 패밀리·티어를 productPrice 행에서 읽어 Supabase 분기/티어/폴백 판정이 **한국어 이름에서도 정상 동작**하게.
- `tierFromGenieWork`/`tierFromProductName` null 시 조기 return(781-784) 문제도 해소(컬럼에서 읽으면 null 안 됨).
검증 → 변경 파일만 커밋 → **STOP & 보고.**

## WAVE 2 — LS키 보장 + race 해결 (축 B 적용)
- Wave 0 승인안대로 race를 닫아 **LS 자동발급 상품은 항상 LS키가 serial_key로 들어가게.**
- `license_key_created` 사후 동기화(applyLsKeyForOrder·syncCoreLicenseKey)가 축 A 수정으로 살아났는지 확인하고, order_created 시점 폴백이 자체키를 **조기에 박지 않도록** 조정.
- 멱등성: 사후에 LS키로 덮어쓸 때 중복 INSERT/충돌 없게(order_id UNIQUE 등 활용).
- GenieWork: 본체 `licenses` + GW_SUPABASE `license_keys` 양쪽에 LS키·tier 일관 등록 확인.
검증 → 커밋 → **STOP & 보고.**

## WAVE 3 — 조용한 실패 가시화 (축 C 적용)
- Wave 0 승인안대로 라이선스 생성 실패가 무증상으로 묻히지 않게 최소 보강(로그/기록). 웹훅 200/재시도 정책은 승인안 따름.
검증 → 커밋 → **STOP & 보고.**

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀(`tsc` + `build` + 에이전트 Critical/High 0).
- 스키마 마이그레이션은 **Steve가 직접 적용**(push로 DB 안 바뀜 명시), 적용 순서·백필 명시.
- **그때 한 번만 `git push origin main`**. Wave 중 push 금지.
- **검증 테스트 시나리오 명시**(Steve가 실행): 한국어 상품명 그대로 테스트 구매 → ① 본체 licenses에 LS키 INSERT ② GenieWork면 GW_SUPABASE license_keys 등록 ③ 대시보드에 LS키 표시(자체키 아님) ④ tier 정상. 영어로 안 되돌려도 동작해야 함(= 근본 해결 확증).
- `result-explainer-ko` 비개발자 요약.

## 진행 중 멈춤 규칙
- 스키마 변경(컬럼 추가)·race 해결 설계는 Wave 0에서 Steve 승인 없이 코드 변경 금지.
- LS API 동작(키 발급 타이밍·재조회 가능 키)이 코드로 불확실하면 추측 말고 멈추고 보고(필요 시 Steve가 LS 대시보드 웹훅 로그·키 발급 순서 확인).
- 기존 정상 주문(영어 이름으로 발급된 과거 라이선스) 데이터를 깨지 않게. 백필은 비파괴적으로.
