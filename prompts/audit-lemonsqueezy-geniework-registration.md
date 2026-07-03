# audit-lemonsqueezy-geniework-registration

You are a senior Next.js/TypeScript engineer auditing the **CoreZent_SaaS** project to verify whether purchasing **"GenieWork 1PC Monthly"** on LemonSqueezy will correctly auto-register a license key into the **new dedicated GenieWork Supabase**. This is a **READ-ONLY investigation**. Do not change any code, config, DB, or external service. Do not use git. **Report only**.

## 배경 (현재까지 상황)
- GenieWork 라이선스를 **새 전용 Supabase**로 독립시키는 작업이 진행됨. 서버 코드는 이미 수정·배포 완료(geniework → 새 GW DB로 분기, `licenseClientFor(product)` 단일 지점, `findLicenseInAnyDb` 폴백 등 Wave 1~4).
- **수동 등록 인증은 이미 성공**(새 DB에 키 직접 INSERT → 앱 인증 OK).
- 이제 **자동 결제 경로**를 검증한다: LemonSqueezy "GenieWork 1PC Monthly" 구매 → 웹훅 → 새 GW DB에 키 INSERT → 구매자에게 키 전달.
- 알려진 설정:
  - LemonSqueezy 스토어 1개·웹훅 1개: `https://www.corezent.com/api/webhooks/lemonsqueezy` (GenieStock/GeniePost/GenieWork 공용).
  - GenieWork 상품명: **"GenieWork 1PC Monthly"** (구독·monthly).
  - 새 GW Supabase는 GW_SUPABASE_* env로 연결(Vercel 설정 완료).

## ★보안 주의
- Supabase URL·service key·LemonSqueezy API/웹훅 시크릿 등 **민감값 출력 금지.** 위치만.

## 점검 항목

### 1. ★상품명 → tier 매칭 (가장 중요·대소문자)
- `webhooks/lemonsqueezy/route.ts`의 `tierFromGenieWork()`(점검 시 :60-68)가 상품명 **"GenieWork 1PC Monthly"**에서 `1pc`를 정확히 추출하는지 **코드로 판정**.
  - 핵심: 상품명의 **"1PC"(대문자)**를 코드가 **"1pc"(소문자)**로 인식하는가? 함수가 `.toLowerCase()`나 대소문자 무시 매칭을 하는지, 아니면 정확히 'pc' 소문자만 찾는지.
  - 추출 순서(10pc를 1pc보다 먼저 검사하는지 등)도 확인 — "1PC"가 의도대로 1pc로 가는지.
  - → "GenieWork 1PC Monthly" 입력 시 결과가 `'1pc'`면 ✅, `null`이면 ❌(키 미생성 원인). 명확히 판정.
- `isSupabaseProduct()`(점검 시 :45-50)가 "GenieWork 1PC Monthly"에서 `'geniework'`를 반환하는지(대소문자·부분일치 확인).

### 2. variant → product 연결 (product_prices 시드)
- 웹훅이 LS variant_id를 어떻게 내부 상품으로 연결하는지(점검 시 variant→`product_prices.lemon_squeezy_variant_id`→`products.name` :199-203, 586-592).
- 이 연결이 **DB(product_prices/products)에 GenieWork variant가 시드돼 있어야** 동작. 코드로 보이는 범위에서 시드 존재 여부·필요 컬럼 확인. (실제 행 존재는 외부 = Supabase 콘솔 확인 필요로 분리.)
- 연결 실패 시 경로: productId null → one_time이면 createLicense 미호출. **구독(subscription)일 때**는 어떤 경로를 타는지 확인(구독 상품이므로 subscription_created 등 이벤트 흐름).

### 3. 구독(subscription) 이벤트 흐름
- 상품이 **monthly 구독**이다. 웹훅이 처리하는 이벤트 종류(order_created·subscription_created·subscription_payment_success 등) 중 **어느 이벤트에서 createLicense(키 생성)가 일어나는지** 확인.
- 구독 첫 결제 시 키가 생성되는 경로가 있는지, 아니면 one_time 주문만 createLicense를 타고 구독은 다른 처리인지. (구독인데 키 생성 경로가 one_time only면 키 미생성 → 중요 결함.)

### 4. 등록 대상 DB 확인
- createLicense → `supaInsertLicense({product:'geniework'})` → `licenseClientFor('geniework')` → 새 GW DB로 가는지(Wave 2~4 반영 확인).

### 5. 웹훅 도메인(www vs api)
- 웹훅은 `www.corezent.com`, 앱 검증은 `api.corezent.com`. 이 둘이 **같은 배포(같은 Vercel 프로젝트·라우트)**를 가리키는지 코드/설정으로 확인 가능한지. (도메인 라우팅은 외부=Vercel 설정일 수 있음 → 그러면 "외부 확인 필요"로.)

### 6. 키 전달(구매자에게)
- 키 생성 후 구매자에게 키를 **이메일 등으로 전달**하는 경로(점검 시 :674 이메일)가 geniework에도 동작하는지. 어떤 이메일·어떤 키 값을 보내는지(값 비공개).

## 보고 형식
- 항목 1: tierFromGenieWork("GenieWork 1PC Monthly") = '1pc' 또는 null **명확 판정** + 근거 `파일:줄`. (대소문자 핵심.)
- 항목 2~6: 각 준비 상태(✅ 준비됨 / ❌ 결함 / ⚠️ 외부 확인 필요) + 근거.
- ★자동 등록을 막을 **결함 목록**(있으면)과, 각각이 코드 수정인지 외부 설정(LS·DB)인지.
- 외부 확인 필요 항목(product_prices 시드 실재·Vercel 도메인·LS 상품 설정)은 분리해서 "Steve가 확인/설정할 것"으로.

> ⚠️ 조사·보고만. 코드·config·DB·외부 서비스 미수정. 민감값 출력 금지. git 미사용. 수정·설정은 보고 후 별도.
