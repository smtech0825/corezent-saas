# audit-ls-key-fetch-failure

You are a senior Next.js/TypeScript engineer diagnosing the **CoreZent_SaaS** project. After fixing an env-name typo (`LEMON_SQUEEZY_API_KEY` → `LEMONSQUEEZY_API_KEY`, committed & deployed), GenieWork purchases **still** log `[LS Webhook] geniework LS 키 조회 실패 — 자체 생성 폴백` — meaning `fetchLsLicenseKey` is still failing and the server falls back to a self-generated key. The env typo was NOT the only cause. This is a **READ-ONLY investigation**. Do not change code/config/DB. Do not use git. **Report only** — the real reason the LS key fetch fails, and how to fix it.

## ★보안 주의
- LemonSqueezy API 키·웹훅 시크릿·Supabase 키·실제 라이선스 키값 등 민감값 출력 금지(위치만).

## 배경 (확인된 사실)
- 새 GW Supabase 독립 완료. 자동 결제로 키 생성·인증은 됨(단 **웹사이트/DB 키 = 서버 자체 생성 키**로 인증, **이메일의 LS 키는 DB에 없어 인증 실패**).
- env 오타 수정(`LEMONSQUEEZY_API_KEY`로 통일) 푸시·배포 완료(Vercel "Ready"). `LEMONSQUEEZY_API_KEY`는 Vercel에 값 존재(Sensitive 처리, revoke 등이 사용).
- 그런데 구매 시 로그가 여전히 **"LS 키 조회 실패 → 자체 생성 폴백"**. 즉 `fetchLsLicenseKey`(lib/lemonsqueezy.ts)가 호출은 되나 키를 못 가져옴.
- 점검 시점 코드: `fetchLsLicenseKey` → `GET /v1/license-keys?filter[order_id]=…` → `json.data[0].attributes.key`(lemonsqueezy.ts:95-112). 호출 경로 구조는 맞다고 판정됐음. null 반환 시 `generateSerialKey()` 폴백(webhook :620-622).
- 구매 상품: "GenieWork 1PC" **monthly 구독**. 키 생성은 `subscription_created` 이벤트에서 일어남(점검).

## 진단 항목 (실패 지점을 정확히)

### 1. fetchLsLicenseKey가 null을 반환하는 실제 분기
- `fetchLsLicenseKey`(lemonsqueezy.ts) 전체를 열어, null을 반환할 수 있는 **모든 분기**를 나열하고 **현재 어디서 빠지는지** 추정:
  - apiKey 없음(이제 고쳐졌을 것 — 재확인).
  - HTTP 비200(401 권한/403/404/429 등) → 어떤 상태일 때 무슨 처리.
  - `json.data`가 빈 배열(`data[0]` 없음) → **키가 아직 생성 안 됨/조회 시점에 없음**.
  - 예외(try/catch) → 네트워크/파싱.
- 각 분기에서 **로그를 충분히 남기는지**. 안 남기면(현재 "조회 실패"만 찍힘) **원인 구분이 안 됨** → 어디에 무슨 로그를 추가하면 원인이 드러나는지 제안(상태코드·응답 본문 일부·order_id 등, 단 시크릿/키값 제외).

### 2. ★타이밍 문제 가능성 (가장 유력 후보)
- 구독 결제 시 **LemonSqueezy가 license key를 생성하는 시점**과, 서버가 `fetchLsLicenseKey`를 **호출하는 시점**(subscription_created 처리 중)의 순서를 분석.
- LemonSqueezy의 "License keys" 기능에서 키는 보통 **order/order-item 기준**으로 생성된다. 그런데 서버가 `filter[order_id]=<lsOrderId>`로 조회하는데, **구독(subscription) 이벤트에서 얻는 lsOrderId가 실제 license key의 order_id와 일치하는지**, 또는 그 시점에 키가 아직 없어 빈 결과인지 확인.
- LemonSqueezy가 키를 별도 이벤트(`license_key_created`)로 알리는지, 그 이벤트를 서버가 처리하는지(점검 결과: 미처리). → 키가 늦게 생성되면 subscription_created 시점 조회는 항상 빈 결과일 수 있음.

### 3. LS API 호출 방식·필터 정확성
- `GET /v1/license-keys?filter[order_id]=…`의 **filter 파라미터·헤더(Authorization Bearer·Accept)**가 LemonSqueezy API 스펙과 정확히 맞는지.
- order_id로 거는 필터가 맞는지, 아니면 **subscription_id/product_id/variant_id**로 걸어야 하는지(구독 상품 특성).
- 응답 파싱(`data[0].attributes.key`)이 실제 응답 구조와 맞는지.

### 4. lsOrderId 값 자체
- webhook에서 `fetchLsLicenseKey(lsOrderId)`에 넘기는 `lsOrderId`가 **어디서 오는지**, subscription_created payload에서 그 값이 **실제로 채워지는지**(undefined면 :624 분기로 폴백).

## 보고 + 수정 방향 (제안만)
- 항목 1~4 각각 판정 + 근거 `파일:줄`.
- ★**가장 가능성 높은 실패 원인** 1~2개로 좁히고, 각각의 **수정 방향**(코드 vs LS 설정):
  - 타이밍이면: `license_key_created`(또는 적절한 이벤트) 처리해서 그 키로 license_keys의 행을 **UPDATE(업서트)**하는 방식 등.
  - 필터 문제면: 올바른 filter/엔드포인트로.
  - 권한/응답이면: 해당 수정.
- ★**진단 로그 추가 제안**: 다음 구매에서 원인을 100% 확정할 수 있도록, 어느 위치에 무슨 로그(상태코드·data 길이·order_id 유무 — 시크릿/키값 제외)를 넣으면 되는지. (이번엔 제안만, 실제 추가는 별도 승인.)
- 외부 확인 필요(LS 대시보드 키 생성 타이밍·실제 API 응답)는 분리.

> ⚠️ 조사·진단·제안만. 코드·config·DB·LS 설정 미수정. 민감값 미출력. git 미사용. 수정은 보고 후 Steve 승인·별도.
