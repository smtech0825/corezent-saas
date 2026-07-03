# fix-license-slug-based

You are a senior Next.js 15 (App Router) / TypeScript / Supabase engineer on the **CoreZent** web codebase. The payment→license pipeline breaks when product **names** are renamed (e.g. Korean), because the webhook branches on `product.name` text. Fix it by switching all name-based branching to **`product.slug`** (a stable NOT NULL UNIQUE identifier that does not change when the display name changes). Work Wave by Wave; stop and report at each Wave end. **No more diagnosis — the root cause is confirmed; implement the fix.**

## 확정된 사실 (재점검 불필요 — 바로 적용)
- 웹훅은 이미 `variant_id`로 `product_prices`→`product` 행을 정확히 찾음(route.ts:217-222). 매칭은 정상.
- 깨지는 원인 = `createLicense` 안에서 `product.name` 텍스트로 분기하는 지점들. 이름이 한국어가 되면 영어 단어(`geniework` 등) 검사가 false → LS키 경로 SKIP → 자체키 폴백.
- **해결 = 그 분기들의 출처를 `product.name` → `product.slug`로 교체.** slug 규칙 = `{family}_{tier}_{interval}` (확인된 실제값: `geniework_1pc_monthly`). slug는 `002:9`에서 NOT NULL UNIQUE, 이름과 무관하게 안정.
- race 아님: LS 웹훅 로그상 `license_key_created`(03:51:54)가 `order_created`(03:51:55)보다 먼저 옴. 잠정행/덮어쓰기 설계 불필요.
- **추가 컬럼·입력칸·백필 없음.** 순수 코드 변경(name→slug)만.

## 교체 대상 5곳 (route.ts, 줄번호는 출발점 — 실제 코드로 확인)
| # | 함수/지점 | 현재 (name 의존) | 교체 (slug) |
|---|---|---|---|
| 1 | `isSupabaseProduct` (55-60) | `name.includes('geniework'/'geniestock')` | `slug.includes(...)` |
| 2 | `tierFromProductName` (62-68) | name에서 lite/pro/max | slug에서 파싱 |
| 3 | `tierFromGenieWork` (70-78) | name에서 1pc/3pc/5pc/10pc | slug에서 파싱 |
| 4 | `isPro` 폴백 (881-882) | `name.includes('geniepost')` | slug 기반 (family+tier 파생) |
| 5 | `resolveSupabaseProductByLsProductId` (494) | `isSupabaseProduct(product.name)` | slug 기반. **주의**: `license_key_created`가 먼저 와서 `orders`가 아직 없을 수 있으니 LS product_id→product_prices→product.slug 경로로 family 판정 |

## STRICT RULES
- **추측 금지**: 줄번호는 출발점. 실제 코드를 연 `파일:줄` 근거 위에서만. slug 파싱 헬퍼는 보편적으로(정규식/분할), 특정 제품 하드코딩 금지.
- **slug 규칙 의존**: `{family}_{tier}_{interval}`. family∈{geniework,geniestock,geniepost}, tier∈{1pc,3pc,5pc,10pc,lite,pro,max,없음}. 파싱은 이 토큰들을 slug에서 찾는 방식(name에서 찾던 것과 동일 로직, 출처만 slug). slug에 토큰 없으면 기존 name-파싱과 동일하게 처리(폴백 동작 보존).
- **결제 핵심 미접촉**: HMAC 검증(route.ts:84)·`order_id` UNIQUE 멱등성(003:12)·variant_id 매칭(217-222) 손대지 말 것.
- **회귀 방지(최우선)**: 영어 상품명도 **같은 slug 경로**로 지금처럼 정상 작동해야 함. 과거 영어 이름으로 발급된 라이선스·진행 중 결제 불변. 한/영 단일 경로.
- **GW_SUPABASE·GeniePost Sheets 경로**: GenieWork는 GW_SUPABASE `license_keys`에 tier 정확히 등록되어야(슬롯 한도 실체). 본체 `licenses`와 일관.
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) Critical/High 0 → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음.
- 각 보고: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임.**

---

## WAVE 1 — name → slug 교체 (핵심)
- 위 5곳을 `product.slug` 기반으로 교체. slug 파싱 헬퍼 1개로 family·tier를 뽑아(보편적, 토큰 매칭) 5곳이 공유하게.
- `product` 객체에 slug가 이미 로드되는지 확인 — variant_id로 product_prices→product를 가져오는 쿼리(route.ts:218 부근)에 slug가 포함되는지, 없으면 그 select에 slug 추가(추가 쿼리 없이 컬럼만).
- #5(사후 동기화)는 `license_key_created` 선행 도착을 고려해 LS product_id→product_prices→product.slug 경로로 family 판정(orders 비의존).
- name 파싱 함수들(`tierFromGenieWork`·`tierFromProductName`·`isSupabaseProduct`)을 slug 입력으로 바꾸되, 동작 로직(어떤 토큰을 찾는지)은 보존 — 출처만 name→slug.
- 자체키(`generateSerialKey`) vs LS키(`fetchLsLicenseKey`) 분기(#4)가 slug 기반 family/tier로 정확히 갈리게: LS 자동발급 상품은 LS키, 자체발급 상품만 자체키.
검증 → 변경 파일만 커밋 → **STOP & 보고.**

## WAVE 2 — 검증 보강 (조용한 실패 가시화, 가벼움)
- route.ts:138-141 최상위 catch + 하위 try/catch가 라이선스 생성 실패를 삼키고 200 반환하는 구조에, 최소한 **order_id 포함 명확한 console.error**로 실패가 로그에 남게(웹훅 200 정책·LS 재시도는 변경하지 말 것 — 멱등성 미완이라 위험).
- 과한 테이블 추가 금지. 로깅만. (원하면 Steve가 별도로 webhook_failures 테이블 후속.)
검증 → 커밋 → **STOP & 보고.**

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀(`tsc` + `build` + 에이전트 Critical/High 0).
- **그때 한 번만 `git push origin main`**. Wave 중 push 금지.
- **검증 테스트 시나리오 명시**(Steve가 실행): 상품명 한국어("지니워크 1PC용 월간") 그대로 테스트 구매 → ① 본체 `licenses`에 LS키 INSERT(자체키 아님) ② GW_SUPABASE `license_keys`에 tier=1pc 등록 ③ 대시보드에 LS키 표시 ④ 영어로 안 되돌려도 동작(= 근본 해결 확증). 추가로 slug에 다른 tier(예 3pc) 가정 시 tier 파싱이 맞는지.
- `result-explainer-ko` 비개발자 요약(이름 무관·slug 기반·추가한 것 없음).

## 진행 중 멈춤 규칙
- slug에 family/tier 토큰이 없는 엣지(예 비표준 slug)면 추측 말고 멈추고 보고 — 단 기존 name 파싱과 동일 폴백을 우선 적용.
- 회귀 위험(영어 경로가 달라짐)이 보이면 즉시 멈추고 보고.
