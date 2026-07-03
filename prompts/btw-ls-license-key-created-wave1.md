# btw-ls-license-key-created-wave1

(이건 `fix-ls-license-key-created-event.md`의 후속 — STEP 0 보고와 Steve 결정이 끝나서 **Wave 1 구현을 확정 사양으로** 지시한다. 기존 STRICT RULES 그대로 적용.)

## 확정된 사양 (STEP 0 + Steve 결정)
- **매칭 키 = `order_id`.** payload `data.attributes.order_id`(숫자) ↔ subscription_created `String(attrs.order_id)`(route.ts:290). 양쪽 공통.
- **DB 준비 완료(Steve 실행함):**
  - 새 GW Supabase `license_keys`에 **`ls_order_id TEXT` 컬럼 + 부분 유니크 인덱스**(ls_order_id IS NOT NULL) 추가됨.
  - CoreZent 본체 `product_prices`의 GenieWork 행에 **`lemon_squeezy_product_id = '1172789'` 시드**됨(variant_id 1834386 행). → license_key_created가 product_id로 geniework 판별 가능.
- **payload 확정 필드**: attributes.key(LS 키)·order_id·order_item_id·product_id(1172789)·store_id·customer_id·user_email·status. meta.custom_data.user_id. meta.event_name='license_key_created'.

## Wave 1 — 구현 (양 핸들러가 order_id로 한 행을 공동 작성)

### 1. subscription_created 측 (createLicense, geniework 분기)
- license_keys에 기록할 때 **`ls_order_id`도 함께 저장**한다(= String(order_id)).
- **upsert(존재 시 UPDATE) 방식**으로:
  - `ls_order_id`로 기존 행 조회.
  - **행 없음** → INSERT `{ ls_order_id, license_key:(이미 페치/스태시된 LS키 우선, 없으면 기존 self-gen 폴백), tier, expires_at, buyer_email, product:'geniework', is_active }`.
  - **행 있음**(license_key_created가 먼저 LS키로 stub 생성) → `tier·expires_at·buyer_email·product`만 채우고 **`license_key`는 덮지 않는다**(LS 키 보존).
- 기존 `supaInsertLicense`를 upsert로 바꾸거나, find→insert/update 분기로. ★`licenseClientFor('geniework')`로 새 GW DB.

### 2. license_key_created 측 (switch에 새 case 추가)
- `case 'license_key_created'`:
  1. payload에서 **LS 키**(attributes.key)·**order_id**·**product_id**·**user_email** 추출.
  2. **product 판별**: product_id(1172789)로 본체 `product_prices.lemon_squeezy_product_id` → `products.name` → `isSupabaseProduct()`로 geniework 확정. (선도착이라 본체 licenses가 없어도 product_prices 시드로 판별 가능 — 이게 SQL 2를 한 이유.)
     - geniework가 아니면(geniestock 등) 기존 정책대로 처리하거나 skip(★geniestock 오라우팅 금지·정확히). geniepost 무관.
  3. geniework면 **`licenseClientFor('geniework')` → GW DB**에서 `ls_order_id`로 upsert:
     - **행 있음**(subscription_created가 self-gen으로 먼저 만든 행) → `license_key = LS키`로 **UPDATE**(self-gen→LS 교체). buyer_email 비어있으면 user_email로 채워도 됨.
     - **행 없음**(관측된 선도착 케이스) → **stub INSERT** `{ ls_order_id, license_key:LS키, product:'geniework', is_active:true, buyer_email:user_email }`. tier·expires_at은 나중에 subscription_created가 채움.
- ★stub INSERT 시 tier가 NOT NULL CHECK이면 INSERT가 막힐 수 있음 — 스키마 확인. tier가 필수면 임시 기본값 문제 → **선도착 stub에 tier를 어떻게 둘지 코드/스키마로 확인 후 처리**(예: subscription_created가 곧 채우지만 INSERT 시점 제약 위반 회피책). 불확실하면 멈추고 보고.

### 3. 공통·안전
- **멱등**: `ls_order_id` 유니크 인덱스 + "이미 LS키면 재UPDATE 무해". 같은 이벤트 2회도 안전.
- **HWID 정합성**: 키 교체는 첫 인증 전(payload status:'inactive')이라 hwid_mapping 행 보통 없음 → 안전. 그래도 hwid_mapping이 옛 키를 참조하면 함께 갱신하도록 방어(없으면 no-op).
- **본체 licenses 동기화**: 키가 LS키로 확정되면 본체 `licenses.serial_key`·`lemon_squeezy_license_key`도 LS키로 맞춰 대시보드 표시 일관(기존 동기화 경로가 있으면 그걸로, 없으면 보고).
- **fetchLsLicenseKey**: 주 경로를 license_key_created로 두되, 기존 fetch 폴백은 보조로 남김(이미 LS키 있으면 우선). self-gen 폴백 키는 LS키 도착 시 교체되므로 일시적.
- **범위**: geniework(+공유정책상 geniestock 포함 Supabase 제품) 한정. geniepost(Sheets)·다른 경로 무영향.

## 검증
- 시뮬레이션/논리로 **두 순서 케이스** 모두 최종 `license_keys.license_key = LS키`·`ls_order_id` 일치 확인:
  - (A) subscription_created 먼저 → self-gen INSERT → license_key_created가 LS키로 UPDATE.
  - (B) license_key_created 먼저(관측 순서) → stub INSERT(LS키) → subscription_created가 tier 등 채움(license_key 보존).
- geniestock·geniepost 무영향. `tsc --noEmit`·`npm run build` 통과. 멱등.

## 보고
- 변경 파일·줄, 두 핸들러 로직, 순서 양쪽 처리, product 판별 경로, tier NOT NULL 등 스키마 제약 처리, 본체 동기화, 검증, 커밋 해시. 키값·시크릿 미출력. 푸시 안 함(Steve 확인 후).

> ⚠️ tier NOT NULL 등 스키마 제약으로 stub INSERT가 막히면 추측 말고 보고. geniestock 오라우팅 금지. 비밀값·키값 미출력. 변경 파일만 개별 commit·push 금지. 끝나면 STOP·보고.
