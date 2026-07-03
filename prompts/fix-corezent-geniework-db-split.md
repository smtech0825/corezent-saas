# fix-corezent-geniework-db-split

You are a senior Next.js/TypeScript engineer modifying the **CoreZent_SaaS** project so that **GenieWork licenses go to a NEW dedicated Supabase**, while GenieStock keeps using the existing shared Supabase. Work in **Waves**. After each Wave: verify, commit changed files only, **STOP and report**.

## STRICT RULES (절대 준수)
- **추가만·GenieStock 무영향**: 모든 변경은 "geniework 분기에 새 DB를 쓰게 추가". 기존 `createLicenseAdminClient()`·기존 env·geniestock 분기·geniepost(Sheets) 경로는 **그대로 보존**. geniestock 동작이 1mm도 바뀌면 안 됨.
- **줄번호는 출발점**: 모든 `:줄`은 점검 시점 기준. **실제 파일을 열어 확인한 뒤** 수정. 위치가 다르면 실제 위치에, 못 찾으면 멈추고 보고.
- **각 Wave 검증**: 타입체크(`tsc --noEmit` 또는 `npm run build`)·빌드 통과. 가능하면 lint.
- **커밋**: 변경한 파일만 개별 `git add`. `git add .` 금지. **푸시는 Steve 확인 후**(지시 없으면 푸시 안 함).
- **비밀값 출력 금지**: Supabase URL·service key 등은 코드에서 env로만 참조. 값 출력·로깅 금지.

## 배경·목표
- GenieWork 라이선스가 GenieStock과 **같은 Supabase·같은 license_keys 테이블**을 공유(product 컬럼으로만 구분)해서 인증이 안 됨.
- **새 GenieWork 전용 Supabase**를 이미 만들었고, `license_keys`·`hwid_mapping` 테이블 생성 완료(tier는 1pc/3pc/5pc/10pc 허용, product 컬럼 있음·기본 'geniework').
- **목표**: 서버에서 `product === 'geniework'`인 모든 라이선스 작업이 **새 전용 Supabase**를 쓰게 한다. geniestock은 기존 Supabase 유지.
- **새 env(코드에서 참조, 값은 Steve가 Vercel에 설정 예정)**: `GW_SUPABASE_URL`, `GW_SUPABASE_SERVICE_ROLE_KEY`.

## ★핵심 설계 — product가 DB를 결정한다
- geniestock → 기존 `createLicenseAdminClient()` (env: LICENSE_SUPABASE_*).
- geniework → 새 `createGenieWorkAdminClient()` (env: GW_SUPABASE_*).
- 따라서 **라이선스 헬퍼 함수가 "어느 클라이언트를 쓸지"를 product로 결정**해야 한다. 지금 일부 함수는 key만 받고 product를 안 받아서 DB를 못 고른다 — 이게 핵심 수정 지점.

## STEP 0 — 실제 코드 확인 (먼저)
점검에서 나온 위치를 실제로 열어 확인하고, 다르면 보고:
- 클라이언트: `_lib_supabase.ts:23-29` `createLicenseAdminClient()`.
- product 받는 함수: `supaFindLicenseByKey(key, product)`(:78, `.eq('product',...)` :80), `supaInsertLicense`(product 포함 :241).
- ★**key만 받는 함수**(product 없음): `getHwidsForKey`·`registerHwid`·`resetHwidsForKey`·`updateLicenseExpiry`·`setLicenseActive`. 이들의 정확한 시그니처·호출부를 모두 찾는다.
- 라우트: `validate/route.ts:39`(분기), `:135 supaGetHwidsForKey`, `:139 supaRegisterHwid`; `upgrade/route.ts:41`; `reset/route.ts:35`.
- 웹훅: `webhooks/lemonsqueezy/route.ts` — `createLicense` 분기(:598-599), `supaInsertLicense`(:641), 동기화 경로(:387,441,483,542, product 없이 key 조회).
- → 시그니처·호출부 목록을 보고한 뒤 Wave 1 진행.

## Wave 1 — 새 클라이언트 + product→클라이언트 선택기
1. `_lib_supabase.ts`에 **새 클라이언트** 추가: `createGenieWorkAdminClient()` (env `GW_SUPABASE_URL`/`GW_SUPABASE_SERVICE_ROLE_KEY`). 기존 `createLicenseAdminClient()`는 **그대로 둠**.
2. **선택기 헬퍼** 추가: `licenseClientFor(product)` — product==='geniework'면 새 클라이언트, 그 외(geniestock 등)는 기존 클라이언트 반환. (한 곳에서 결정 → 일관성.)
3. env 미설정 시 안전 처리: `GW_SUPABASE_*`가 없으면 명확한 에러(조용한 실패 금지) — 단 geniestock 경로는 영향 없게.
### Wave 1 검증·커밋 후 STOP·보고. (새 클라이언트·선택기만 추가, 아직 미사용이라 기존 동작 불변.)

## Wave 2 — 헬퍼 함수를 product-aware로
1. **key만 받던 함수들**(`getHwidsForKey`·`registerHwid`·`resetHwidsForKey`·`updateLicenseExpiry`·`setLicenseActive`)에 **product 파라미터 추가** → 내부에서 `licenseClientFor(product)`로 올바른 DB 선택.
   - ★보편: 특정 product 하드코딩 말고 `licenseClientFor(product)`로 일관 처리.
2. 이미 product 받는 함수(`supaFindLicenseByKey`·`supaInsertLicense`)도 클라이언트를 `licenseClientFor(product)`로 선택하게 통일.
3. **모든 호출부에 product 전달**: 위 함수를 부르는 곳(`validate/route.ts:135,139`, upgrade/reset, 웹훅 등)에 product를 넘기도록 수정. product를 아는 맥락(라우트 분기·웹훅 supaSlug)에서 전달.
### Wave 2 검증·커밋 후 STOP·보고. (geniestock은 여전히 기존 DB로 가는지 — product='geniestock'이면 기존 클라이언트 선택되는지 확인.)

## Wave 3 — 웹훅 동기화 경로 (★가장 까다로운 곳)
- 웹훅 동기화 경로(`:387,441,483,542` — subscription_updated/cancelled/payment_failed/refunded)는 **key만으로 조회**해서, DB가 둘이면 "이 키가 어느 Supabase에 있나"를 모른다.
- 처리: 이 경로에서도 **product 컨텍스트를 확보**한다. LS 이벤트의 상품 정보(variant→product_prices→products.name→isSupabaseProduct)로 product를 판정해 `licenseClientFor(product)`를 쓰게 한다.
  - product 판정이 불가한 이벤트면: **양쪽 DB 조회 폴백**(기존+새 DB에서 key로 찾아 있는 쪽 사용) 또는 안전한 로그 후 skip — 어느 쪽이 맞는지 STEP에서 판단해 보고 후 진행. 데이터 잘못 건드리지 않는 보수적 방향.
- ★geniestock 이벤트는 기존 DB로 가야 하므로, geniework로 오판하지 않게 정확히.
### Wave 3 검증·커밋 후 STOP·보고.

## Wave 4 — env 문서화 + createLicense 확인
1. `.env.example`에 `GW_SUPABASE_URL`·`GW_SUPABASE_SERVICE_ROLE_KEY` 추가(값 없이 이름만·주석). (기존 LICENSE_SUPABASE_*도 미문서면 같이 문서화.)
2. 웹훅 `createLicense`(:598-)에서 geniework일 때 `supaInsertLicense`가 새 DB로 가는지(Wave 2 반영) 최종 확인. geniestock INSERT는 기존 DB 유지.
3. CoreZent 내부 `licenses` 행·이메일 발송(:666,674)은 그대로(이건 별개 테이블·기능).
### Wave 4 검증·커밋 후 STOP·보고.

## 검증 (전체)
- geniework: validate/upgrade/reset/웹훅 INSERT가 모두 **새 DB**를 쓰는지.
- geniestock: 모든 경로가 **기존 DB** 그대로인지(회귀 0).
- geniepost(Sheets) 경로 무영향.
- 빌드·타입체크 통과.
- 새 env 없을 때 명확한 에러(조용한 실패 0).

## 보고 (각 Wave)
- STEP 0 시그니처·호출부 목록. 변경 파일·줄, 수정 내용, 검증 결과, 커밋 해시.
- geniestock 무영향 확인. 비밀값 미출력 명시. 푸시 안 함(Steve 확인 후).

> ⚠️ 추가만·GenieStock 보존. product가 DB를 결정. 비밀값 출력 금지. 각 Wave STOP·보고. 푸시는 Steve 확인 후.
