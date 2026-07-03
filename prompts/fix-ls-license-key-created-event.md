# fix-ls-license-key-created-event

You are a senior Next.js/TypeScript engineer fixing the **CoreZent_SaaS** project. Work in **Waves**. After each Wave: verify, commit changed files only, **STOP and report**.

## STRICT RULES (절대 준수)
- **줄번호는 출발점**: 모든 `:줄`은 점검 시점 기준. **실제 파일을 열어 확인한 뒤** 수정. 다르면 실제 위치에, 못 찾으면 멈추고 보고.
- **각 Wave 검증**: `tsc --noEmit` 또는 `npm run build` 통과.
- **커밋**: 변경한 파일만 개별 `git add`. `git add .` 금지. **푸시는 Steve 확인 후.**
- **다른 작업자/세션의 미커밋 변경 미관여.**
- **비밀값 출력 금지**: API 키·시크릿·실제 라이선스 키값 출력·로깅 금지. (로그에 key 값 자체를 찍지 말 것. 길이/존재 여부 정도만.)

## 배경 — 로그로 확정된 근본 원인
GenieWork 구매 시 **DB/웹사이트 키(서버 자체 생성)와 이메일 키(LemonSqueezy 발급)가 달라** 이메일 키로 인증 실패. Vercel 로그로 원인 확정:
- LemonSqueezy "License keys" ON → 구매 시 **`license_key_created` 웹훅 이벤트가 실제로 도착**한다(로그에 찍힘). 그러나 webhook switch에 해당 case가 없어 **`[LS Webhook] 처리하지 않는 이벤트: license_key_created`로 버려진다.**
- 그래서 서버는 `subscription_created` 처리 중 `fetchLsLicenseKey`로 키를 조회하지만 그 시점엔 키가 없어(타이밍) **빈 결과 → 자체 생성 폴백**이 DB에 저장됨.
- ★관측된 이벤트 순서(한 구매): `license_key_created`(20:13:46.76) → `주문 생성 완료`(20:13:46.92) → `LS 키 조회 실패 폴백`(20:13:47.53) → `만료일 동기화`(20:14:17) → `subscription_payment_success`(20:14:18). **즉 license_key_created가 subscription_created(키 행 생성)보다 먼저 올 수 있다** → 단순 UPDATE는 대상 행이 없어 실패할 수 있음.

## 목표
`license_key_created` 이벤트를 처리해 **LemonSqueezy가 발급한 키를 license_keys의 정식 키로 반영**한다. 결과적으로 **DB 키 = 이메일 키 = 인증 성공**. 서버 자체 생성 키 폴백은 LS 키가 오면 대체되어야 한다.

## STEP 0 — 실제 코드·페이로드 확인 (먼저, 수정 전)
- `webhooks/lemonsqueezy/route.ts`의 이벤트 switch(:90-117 부근)와 default 로그(:117), createLicense·serialKey 흐름(:615-652), supaInsertLicense·supaFindLicenseByKey·관련 헬퍼(_lib_supabase.ts) 시그니처를 실제로 확인.
- LemonSqueezy `license_key_created` 웹훅 payload 구조를 코드/타입(lemonsqueezy.ts)에서 확인:
  - 라이선스 키 값(`data.attributes.key`), 연결 식별자(`order_id`·`order_item_id`·`product_id`·`variant_id`·`customer/store` 등)가 payload 어디에 있는지.
  - ★**이 키를 기존 license_keys 행과 어떻게 매칭할지**의 키(join key)를 정한다: order_id가 양쪽(subscription_created가 만든 행 + license_key_created payload)에 공통으로 있는지 확인. 없으면 buyer_email·variant 등 대체 매칭 후보.
- subscription_created가 license_keys 행을 만들 때 **무슨 식별자를 저장하는지**(order_id 컬럼이 있는지 등) 확인 — 나중에 license_key_created가 그 행을 찾으려면 필요.
- → STEP 0 결과(payload 구조·매칭 키·행 식별 방법)를 보고한 뒤 Wave 1. **매칭 키가 불명확하면 멈추고 보고**(아무 키나 추측 금지).

## Wave 1 — license_key_created 이벤트 처리 (핵심)
- switch에 `case 'license_key_created'` 추가. 처리:
  1. payload에서 **LS 라이선스 키**와 **매칭 식별자**(STEP 0에서 정한 join key, 예: order_id)를 추출.
  2. 그 식별자로 **기존 license_keys 행을 찾는다**:
     - **행이 있으면**(subscription_created가 먼저 처리됨): 그 행의 `license_key`를 **LS 키로 UPDATE**. (자체 생성 키 → LS 키 교체.) 관련 hwid_mapping이 그 키를 참조하면 함께 정합 유지(아래 ★주의).
     - **행이 없으면**(license_key_created가 먼저 도착): 나중에 subscription_created가 LS 키를 쓰도록 처리. 두 안전 방식 중 택1(STEP 0 근거로 판단·보고):
       - (a) license_key_created에서 **LS 키로 행을 미리 생성(upsert)**하고, subscription_created는 같은 행에 tier·expires·product·buyer_email을 채움(존재 시 INSERT 대신 UPDATE).
       - (b) subscription_created의 `fetchLsLicenseKey` 폴백 자리에서, 이미 도착한 LS 키를 참조(별도 저장된 값)하도록.
     - ★**보편·안전**: 추측으로 새 스키마/큰 구조 변경 금지. 기존 컬럼·기존 흐름으로 해결되면 그걸로. 큰 변경이 필요하면 멈추고 보고.
  3. **product 분기**: 이 처리는 geniework(및 공유 정책상 Supabase 제품 = geniestock 포함 시 동일 적용)에 한정. geniepost(Sheets)·다른 경로 영향 없게. `licenseClientFor(product)`로 올바른 DB(geniework=새 GW DB).
- ★**HWID 정합성 주의**: 키 교체(UPDATE) 시 hwid_mapping이 `license_key`를 FK로 참조한다면, 키를 바꾸면 매핑이 깨질 수 있음. 단 **첫 인증 전(키 발급 직후)**이라 보통 hwid_mapping 행이 아직 없음 → 안전. 그래도 코드로 FK·CASCADE 관계 확인하고, 매핑이 있으면 함께 갱신하거나 "행 없음"을 전제로 처리. 확실치 않으면 보고.
- **중복 처리 방지(멱등)**: 같은 license_key_created가 2번 와도 안전하게(이미 LS 키면 재UPDATE 무해). order_id 가드 등 기존 멱등 장치와 충돌 없게.
### Wave 1 검증·커밋 후 STOP·보고.
- 추가한 case 로직, 매칭 방식, 행 있음/없음 양쪽 처리, geniestock/geniepost 영향, HWID 정합성 확인 결과. 빌드 통과.

## Wave 2 — subscription_created 측 조율 (필요 시)
- Wave 1에서 "행 없으면 upsert" 방식을 택했다면, subscription_created의 createLicense가 **이미 존재하는 행을 덮어쓰지 않고** tier·expires·product를 채우도록(LS 키 보존) 조율.
- `fetchLsLicenseKey` 직접 조회는 타이밍상 여전히 실패할 수 있으므로 **주 경로를 license_key_created로** 두되, 기존 fetch 경로는 보조로 남기거나(이미 키 있으면 그걸 우선) 정리. (★기능 제거가 아니라 우선순위 정리 — 보고 후 판단.)
- 서버 자체 생성 키 폴백은 **LS 키가 결국 반영되면 일시적**이어야 함(영구 자체 키 저장 방지).
### Wave 2 검증·커밋 후 STOP·보고.

## 검증 (전체)
- 구매 흐름에서 **최종적으로 license_keys.license_key = LS 키**가 되는지(이벤트 순서 양쪽 케이스).
- DB 키 = 이메일 키 → 인증 성공 경로.
- geniestock·geniepost 무영향. 새 GW DB로 정확히.
- 빌드·타입체크 통과. 멱등·HWID 정합성.

## 외부 확인 (Steve — 코드 밖)
- LemonSqueezy 웹훅에 `license_key_created` 이벤트 체크됨(완료). 그 외 필요한 이벤트(subscription_created 등) 유지 확인.
- 푸시·배포 후 **테스트 구매 1건**: 이메일 키 = 웹사이트/DB 키 일치, 그 키로 인증 성공, 이메일 1통(LS만) 확인. Vercel 로그에서 `license_key_created` 가 이제 처리됨(폴백→LS키 반영) 확인.

## 보고 (각 Wave)
- STEP 0: payload 구조·매칭 키·행 식별 방법.
- Wave별: 변경 파일·줄, 로직, 순서 양쪽 처리, 영향 범위, 검증, 커밋 해시. 키값·시크릿 미출력. 푸시 안 함(Steve 확인 후).

> ⚠️ 매칭 키·순서 처리·HWID 정합성을 추측하지 말고 코드로 확인. 불확실하면 멈추고 보고. geniestock/geniepost 보존. 비밀값·키값 미출력. 각 Wave STOP·보고. 푸시는 Steve 확인 후.
