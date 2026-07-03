# audit-ls-license-key-usage

You are a senior Next.js/TypeScript engineer auditing the **CoreZent_SaaS** project. A bug was found: after purchasing GenieWork, **the license key emailed to the buyer (from LemonSqueezy) is DIFFERENT from the key stored in the database**, and the emailed key fails authentication. Steve wants to **use LemonSqueezy's own generated license keys** as the official keys. This is a **READ-ONLY investigation**. Do not change any code, config, DB, or external service. Do not use git. **Report only** — why the two keys differ, and how to make the DB store the LemonSqueezy key.

## ★보안 주의
- LemonSqueezy API 키·웹훅 시크릿·Supabase 키·실제 라이선스 키 값 등 민감값 출력 금지(위치만·값 비공개).

## 배경 (확인된 사실)
- GenieWork 자동 결제가 작동: 구매 시 새 GW Supabase의 license_keys에 키가 INSERT되고, **Corezent 웹사이트에 표시되는 키로는 인증 성공**.
- **문제**: LemonSqueezy가 구매자에게 보내는 **이메일 속 라이선스 키**는 **DB/웹사이트 키와 완전히 다른 값**이고, 그 이메일 키로는 **인증 실패**.
- LemonSqueezy 상품의 **"License keys" 기능이 ON** → LemonSqueezy가 자체 라이선스 키를 생성·발급하고 이메일에 넣는다.
- ★Steve 방침: **LemonSqueezy가 발급한 키를 정식 키로 사용**하고 싶다. 즉 DB에 저장되는 키 = 이메일로 가는 LemonSqueezy 키가 되어야 한다.
- 점검 단서: 키 값 = "LS키(웹훅 :616 성공 시 그 값) / 실패 시 generateSerialKey() 폴백". 현재 폴백(서버 자체 생성 키)이 DB에 들어가는 것으로 의심 → LS 키 추출이 실패하고 있을 가능성.

## 점검 항목

### 1. ★두 키의 출처 규명
- **DB에 저장되는 키**: `webhooks/lemonsqueezy/route.ts`의 createLicense에서 `supaInsertLicense`에 들어가는 `license_key` 값이 **어디서 오는지** `파일:줄`로. 점검 단서의 :616 부근 — LS 키를 읽으려는 로직과 `generateSerialKey()` 폴백의 분기 조건.
- **이메일에 들어가는 키**: 구매자에게 가는 키가 LemonSqueezy 자체 발급 키인지(LS가 직접 이메일 발송), 아니면 서버가 보내는 이메일(:674 부근)의 키인지. **이메일 발송 주체가 LemonSqueezy인지 CoreZent 서버인지** 구분.
  - ★핵심: LemonSqueezy "License keys" 기능이 ON이면 **LemonSqueezy가 자체 키를 만들어 자기가 이메일을 보낸다**. 이 경우 서버가 만든 키(DB)와 LS 키(이메일)가 별개가 됨 — 이 구조인지 확인.

### 2. ★LS 키를 웹훅에서 가져올 수 있는지
- LemonSqueezy 웹훅 payload(order_created/subscription_created 등)에 **LS가 생성한 license key가 포함되는지** 확인. LS license key는 보통 별도 객체/이벤트(`license_key_created`)나 order의 관계 데이터로 옴.
- 현재 서버 코드가 그 LS 키 필드를 **읽으려 시도하는지**(:616), 읽는다면 **payload의 어느 경로**에서 읽는지. 그 경로가 실제 LS payload 구조와 **일치하는지**(불일치면 항상 실패→폴백).
- LemonSqueezy가 **`license_key_created` 같은 별도 웹훅 이벤트**로 키를 보내는지(이 이벤트를 서버가 처리하는지/안 하는지) 확인 — 안 하면 LS 키를 받을 기회가 없음.

### 3. 폴백이 발동하는 이유
- `generateSerialKey()` 폴백이 언제 발동하는지 조건 확인. 현재 LS 키 추출이 실패해서 폴백 키가 DB에 들어가는 게 맞는지 코드로 판정.

### 4. ★LS 키를 DB에 저장하려면 (수정 방향)
- LemonSqueezy 키를 DB license_key로 쓰려면 무엇을 바꿔야 하는지 목록(코드 vs LS 설정):
  - LS payload에서 license key를 올바른 경로로 읽기, 또는
  - `license_key_created` 웹훅 이벤트를 처리해 그 키로 INSERT/UPDATE, 또는
  - 타이밍 문제(주문 이벤트엔 키가 아직 없고 별도 이벤트로 옴)면 이벤트 순서 처리.
- ★중복 이메일 주의: LS가 자체 키 이메일을 보내는데 서버도 키 이메일(:674)을 보내면 **이메일 2통**이 갈 수 있음. LS 키를 쓰기로 하면 **서버 측 키 생성·이메일을 끄거나 LS 키로 대체**해야 하는지 검토(보고만).
- geniework만 바꾸는 범위인지(geniestock/geniepost 영향 여부).

### 5. HWID·tier 등 부가정보 처리
- LS 키를 쓰면, tier(1pc)·expires·product 같은 부가정보는 여전히 서버가 채워야 한다. LS 키 + 서버 부가정보를 **한 행에 합치는** 방식이 가능한지(LS 키를 license_key로, 나머지는 서버가).

## 보고 형식
- 항목 1: DB 키 출처·이메일 키 출처 각각 `파일:줄` + 이메일 발송 주체(LS vs 서버).
- 항목 2: LS 키가 웹훅 payload/별도 이벤트로 오는지, 서버가 읽는 경로가 맞는지(불일치 지점).
- 항목 3: 폴백 발동 원인.
- 항목 4: LS 키를 DB에 저장하는 수정 방향(코드 vs LS 설정 구분) + 중복 이메일 처리 + 범위.
- 항목 5: 부가정보 합치기 방식.
- 외부 확인 필요(LS 대시보드 설정·실제 payload)는 분리.

> ⚠️ 조사·보고만. 코드·config·DB·LS 설정 미수정. 민감값·실제 키값 출력 금지. git 미사용. 수정은 보고 후 Steve 승인·별도.
