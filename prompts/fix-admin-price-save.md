# fix-admin-price-save

You are a senior Next.js 15 (App Router) / TypeScript / Supabase engineer on the **CoreZent** web codebase. Fix the bug where **editing a product price in admin does not persist to the DB** (`product_prices.price` stays at old value while the UI claims success). Work Wave by Wave; stop and report at each Wave end.

## 확정된 원인 (bug-detective 점검 결과 — 두 겹)
1. **에러 무시**: 편집 서버액션의 가격 UPDATE 루프(`app/admin/products/[id]/edit/page.tsx:137-149`)가 `const { error }`를 안 받아 폐기 → 0행 매칭·제약위반이어도 함수가 성공 반환·리다이렉트 → "성공 가장". (바로 아래 INSERT `:154-165`·products UPDATE `:99`는 에러를 잡음.)
2. **중복 행 + 엉뚱한 행 갱신**: `product_prices`에 `UNIQUE(product_id, type, interval)` 없음(`002_products.sql:28-37` PK는 id뿐, `008_indexes.sql:16-17`은 일반 INDEX) → 같은 플랜 중복 행 가능. 편집은 `is_active=true` + `order('id')`(UUID 사전순) dedup으로 한 행만 갱신(`edit/page.tsx:33-37,60-75`), 관리자 목록은 `is_active` 필터 없이 `.find()`로 다른(비활성 옛 6.99) 행을 읽음(`admin/products/page.tsx:27,32-34`). → DB·화면에 옛값 잔존.
- RLS는 원인 아님(`lib/supabase/admin.ts:9-19` service_role 사용, RLS 우회). 저장 테이블·컬럼은 올바름(`product_prices.price`).
- ※ 줄번호는 출발점. 실제 코드를 열어 확인.

## STRICT RULES
- **추측 금지**: 본 문서·점검의 경로·줄번호는 출발점. 실제 코드/스키마를 연 `파일:줄` 근거 위에서만.
- **보편 해결 / 하드코딩 금지.** in-place 수정·지정 파일만·무관 리팩터 금지.
- **결제 연결 불변**: `lemon_squeezy_variant_id`·`checkout_url`·웹훅 매칭 미접촉.
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) Critical/High 0 → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음.
- 각 보고: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임.**
- **돈·권한 경로**: 에러를 조용히 삼키지 말 것. 저장 실패는 사용자에게 표면화.

---

## WAVE 0 — 조사 (READ-ONLY · 변경 0)
보고만. 운영 DB 상태를 코드로 추정하지 말고, 실제 확인이 필요한 쿼리를 제시(실행은 Steve).
1. 중복 실태 파악용 쿼리 제안: `product_prices`에서 (product_id, type, interval)별 행 수·is_active 분포·price 값을 보는 SELECT. → 중복이 실제로 얼마나, 활성/비활성 어떻게 분포하는지 Steve가 확인.
2. 편집 로드 dedup(`edit/page.tsx:33-37,60-75`)·관리자 목록 읽기(`admin/products/page.tsx:27`)·공개 페이지 읽기(`pricing/page.tsx`, 랜딩 `page.tsx`)가 각각 어떤 필터·정렬로 어느 행을 고르는지 대조표.
3. `product_prices`에 `created_at` 등 정렬 가능한 시간 컬럼이 있는지(없으면 dedup 정렬 키 부재 확인).
4. Wave 3 UNIQUE 제약을 걸기 전, 기존 중복 때문에 제약 추가가 실패할지 여부와 **안전한 정리 방법**(비활성 중복 삭제 vs 보존) 제안.
→ **STOP & 보고.** 이 결과로 Wave 3 데이터 정리 방식 확정 후 진행.

## WAVE 1 — 가격 UPDATE 에러 캡처 (겉 문제, 최우선·안전)
- `edit/page.tsx:137-149` 가격 UPDATE 루프를 INSERT(:154-165) 패턴과 동일하게: `const { error } = await ...` 받고, 실패 시 `return { error }`(또는 기존 에러 반환 규약과 동일하게). 0행 매칭·제약위반이 **사용자에게 표면화**되도록.
- 신규 제품 생성 경로(`new/page.tsx:42-57`)에 동일 결함 있으면 같이.
- 폼 측(`ProductForm.tsx`)이 반환 에러를 표시하는 경로가 있는지 확인, 없으면 최소한으로 표시.
- 이 Wave만으로 "성공 가장"이 사라져 진짜 실패가 즉시 보여야 함.
검증 → 변경 파일만 커밋 → **STOP & 보고.**

## WAVE 2 — 읽기 정합화 (화면 문제)
- 관리자 목록(`admin/products/page.tsx:27`)의 `product_prices` 임베드에 **`is_active=true` 필터 + 정렬 고정**을 공개 페이지(`pricing/page.tsx:31-34`, 랜딩 `page.tsx:75`)와 **동일하게** 맞춤. `.find()`가 비활성 옛 행을 집지 않게.
- 편집 로드 dedup(`edit/page.tsx:33-37,60-75`)도 같은 기준으로 정합화(어느 행을 "그 플랜의 대표"로 볼지 한 가지로 통일).
- 정렬 키가 UUID뿐이라 모호하면, Wave 0에서 확인된 컬럼(예 created_at 유무)에 따라 결정 — 없으면 Wave 3에서 정렬 컬럼 추가를 고려하고 여기선 is_active 필터까지만.
검증 → 커밋 → **STOP & 보고.**

## WAVE 3 — 중복 방지 (구조, 스키마 변경)
- 기존 중복 정리(Wave 0 확정 방식: 안전하게) → `product_prices`에 **부분 UNIQUE 인덱스** `UNIQUE(product_id, type, interval) WHERE is_active` 추가하는 **마이그레이션 파일 작성**.
- (필요 시) 저장 로직을 그 키 기준 **upsert**로 전환해 향후 중복 INSERT 자체를 차단.
- ⚠️ **마이그레이션 적용은 Steve가 직접**(본체 Supabase SQL Editor). 파일 상단에 대상 DB(본체 CoreZent)·적용 순서·기존 중복 선정리 필요 여부 명시. CC는 연결키로 직접 적용 금지.
- 제약 추가 전 중복이 남아 있으면 적용이 실패하므로, "선정리 SQL → 제약 추가" 순서를 파일에 분리해 안내.
검증 → 커밋 → **STOP & 보고.**

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀(`tsc` + `build` + 에이전트 Critical/High 0).
- 마이그레이션은 **Steve가 직접 적용**(push로 DB 안 바뀜 명시).
- **그때 한 번만 `git push origin main`**. Wave 중 push 금지.
- `result-explainer-ko` 비개발자 요약: 무엇이 고쳐졌나 / Steve가 적용할 마이그레이션·순서 / 적용 후 가격 저장이 되는지 확인 방법.

## 진행 중 멈춤 규칙
- 운영 DB의 중복 실태가 코드로 확정 안 되면(Wave 0 쿼리 결과 필요) 추측 말고 멈추고 Steve 확인 대기.
- 스키마 변경(UNIQUE/정렬 컬럼)이 기존 데이터와 충돌 가능하면 적용 전 정지·보고.
