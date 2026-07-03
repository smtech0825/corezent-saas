# audit-corezent-product-id-link

You are a senior Next.js/TypeScript engineer auditing the **CoreZent_SaaS** project to determine why GenieWork auto-registration may be blocked: in the `product_prices` table, **`product_id` is NULL for all products (GenieWork, GenieStock, GeniePost)**. This is a **READ-ONLY investigation**. Do not change any code, config, DB, or external service. Do not use git. **Report only** — whether NULL product_id blocks license creation, what value should fill it, and how to fix it (for GenieWork specifically).

## ★보안 주의
- Supabase URL·service key·LemonSqueezy 시크릿 등 민감값 출력 금지. 위치만.

## 배경 (현재까지)
- GenieWork 라이선스를 새 전용 Supabase로 독립하는 작업. 서버 코드 수정·배포 완료. **수동 인증은 성공.**
- 자동 결제(LemonSqueezy "GenieWork 1PC" 구독) 검증 중. 웹훅은 스토어 공용 1개(`www.corezent.com/api/webhooks/lemonsqueezy`).
- **발견된 의심점**: `product_prices` 테이블에서 `product_id`가 **GenieWork·GenieStock·GeniePost 전부 NULL**. `lemon_squeezy_variant_id`는 채워져 있고, `type='subscription'`. CoreZent `products` 테이블의 GenieWork 행 name은 `"GenieWork 1PC"`(tier 토큰 OK).
- 점검에서 구독 키 생성 조건이 `if (productPrice?.product_id && orderId)`(subscription_created, route.ts:347-349 부근)로 나옴 → **product_id가 NULL이면 이 조건이 false → createLicense 미호출 → 키 미생성** 가능성.
- ★혼란점: GenieStock은 현재 인증이 된다고 알려짐. 그런데 GenieStock도 product_id가 NULL이다. 그렇다면 GenieStock 키는 **자동이 아니라 수동으로** 들어간 것이거나, 다른 경로로 생기는 것일 수 있음 — 이걸 코드로 규명해야 "GenieWork도 똑같이 하면 되는지"가 명확해진다.
- **방침**: 지금은 **GenieWork만** 제대로 되게 한다(GenieStock/GeniePost는 이후 별도). 그리고 `product_prices`에 **상품 이름 컬럼과 product_id를 둘 다 채워서** 운영하고 싶다.

## 점검 항목

### 1. ★product_id NULL이 키 생성을 막는지 (코드 흐름 확정)
- `webhooks/lemonsqueezy/route.ts`의 구독 키 생성 경로(:347-349 부근 `if (productPrice?.product_id && orderId)`)를 실제로 열어, **product_id가 NULL이면 createLicense가 호출 안 되는 게 맞는지** 판정.
- order_created(one_time) 경로(:244 부근)도 product_id를 보는지 확인.
- → "NULL이면 자동 등록 차단"이 사실인지 ✅/❌ 명확히.

### 2. ★product_id에 들어갈 올바른 값 규명
- `product_prices.product_id`가 **무엇을 가리키는 FK인지**: CoreZent `products` 테이블의 어느 컬럼(id 등)과 연결되는지. 스키마/마이그레이션/쿼리로 확인.
- 즉 GenieWork product_prices 행의 product_id에 **CoreZent products의 GenieWork 행 id**를 넣으면 되는지. 정확한 연결 규칙을 코드 근거로.
- product_id가 채워진 뒤 `products.name`("GenieWork 1PC")을 읽어 tierFromGenieWork로 가는 경로(:586-596)가 정상 작동하는지 확인.

### 3. GenieStock은 지금 어떻게 키가 생기나 (혼란점 해소)
- GenieStock도 product_id NULL인데 인증이 된다면, 그 키가 **어떻게 생겼는지** 코드/흐름으로 추정: 수동 INSERT인지, 과거 다른 경로인지, 아니면 GenieStock도 사실 자동 등록은 안 되고 있었는지.
- → 이게 "GenieWork도 product_id만 채우면 자동이 될지"의 결정적 단서.

### 4. product_prices에 상품 이름 컬럼
- `product_prices`에 상품 이름 컬럼이 **이미 있는지**(name 등). 없으면, 운영 편의를 위해 추가할 때 **서버 코드가 그 컬럼을 읽는지/무관한지**(추가해도 코드 영향 없는 순수 표시용인지) 확인.
- ★주의: 서버는 상품 이름을 `products.name`에서 읽는다(tier 추출). product_prices에 이름 컬럼을 더하는 건 **사람이 보기 편한 표시용**이지, tier 추출 경로를 바꾸는 게 아님을 확인(혼동 방지).

### 5. GenieWork만 고치는 안전 범위
- product_id를 GenieWork 행에만 채우는 것이 GenieStock/GeniePost에 영향 없는지(행 단위 독립).

## 보고 + 수정안 제안 (실행은 Steve)
- 항목 1: NULL→키 차단 ✅/❌ + 근거 `파일:줄`.
- 항목 2: product_id에 넣을 정확한 값(예: "GenieWork product_prices 행의 product_id = products의 GenieWork 행 id") + 근거.
- 항목 3: GenieStock 키 생성 경로 추정(자동/수동).
- 항목 4: 이름 컬럼 현황·추가 시 코드 영향 유무.
- ★**Steve용 수정안**: GenieWork product_prices 행에 product_id를 채우는 **SQL 초안**(어느 테이블·어느 행·무슨 값 — 실제 id 값은 Steve가 콘솔에서 확인해 넣도록 자리표시). 이름 컬럼 추가를 원하면 그 SQL도(표시용·코드 무관 명시). **실행은 안 함·제안만.**
- 민감값 위치만. 외부 확인 필요 항목 분리.

> ⚠️ 조사·보고·제안만. 코드·DB·설정 미수정. git 미사용. 민감값 미출력. 실제 수정은 보고 후 Steve가 결정·실행.
