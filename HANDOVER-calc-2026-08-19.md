# 부동산 계산기 · 법령 개정 감시 인계서 — 2026-08-19 (최신본)

> **이 문서가 최신 인계서입니다.** `HANDOVER-calc-2026-08-16.md`를 비롯한 이전 인계서를
> 모두 대체합니다. 내용이 충돌하면 이 문서를 따르세요.
>
> 기준 커밋: `e2fea01` (origin/main, 배포됨) · 작성 시점: 2026-08-19

---

## 0. 5분 요약

여덟 개 부동산 계산기가 `/tax/*`에서 돌아갑니다. **세율·금액·날짜를 코드에 넣지 않고 전부
DB(`tax_rules`)에서 읽는 것**이 이 시스템의 유일한 설계 원칙입니다. 룰이 없으면 0원으로
계산하지 않고 "근거 미등록"으로 멈춥니다.

이번 라운드에서 **법령 개정 자동 감시**가 가동됐습니다. 매일 한국시간 05:00에 법제처
OPEN API로 그날 바뀐 법령을 받아, 등록된 룰의 근거 조문이 실제로 바뀌었는지 확인해
관리자 큐에 쌓습니다. **룰을 자동으로 고치지는 않습니다** — 사람이 원문을 대조해 판단합니다.

같은 라운드에서 **저장돼 있던 법령ID 12개 중 5개가 틀린 것**을 발견해 정정했습니다.
룰 35건이 오류 없이 감시에서 빠져 있던 상태였습니다(§5).

---

## 1. 계산기 8종과 파일 매핑

각 계산기는 `page.tsx`(서버) → `*Form.tsx`(클라이언트) → `actions.ts`(서버 액션) →
`lib/tax/*.ts`(엔진) → `*ResultPanel.tsx`(결과) 구조가 같습니다.

| 계산기 | 경로 | 엔진 | 주요 룰 키 |
|---|---|---|---|
| 취득세 | `/tax/acquisition` | `lib/tax/acquisition.ts` | `acquisition.onerous.rates` · `acquisition.gift.rates` · `acquisition.gift.tax_base` · `acquisition.gift.heavy` · `acquisition.gift.deemed_gift_threshold` · `acquisition.rounding` |
| 인지세 | `/tax/stamp` | `lib/tax/stamp.ts` | `stamp.rates` |
| 중개수수료 | `/tax/brokerage` | `lib/tax/brokerage.ts` | `brokerage.rates` · `brokerage.vat` |
| 등기비용 | `/tax/registration` | `lib/tax/registration.ts` | `registration.bond` · `registration.fee` (+ 취득세·인지세 엔진 재사용) |
| 재산세 | `/tax/property` | `lib/tax/property.ts` | `property.rates` · `property.assessment_ratio` · `property.assessment_ratio.one_house` · `property.base_cap` · `property.burden_cap` · `property.surtax` · `property.assessment_date` · `property.rounding` |
| 종합부동산세 | `/tax/comprehensive` | `lib/tax/comprehensive.ts` | `comprehensive.rates` · `comprehensive.basic_deduction` · `comprehensive.assessment_ratio` · `comprehensive.burden_cap` · `comprehensive.tax_credit` · `comprehensive.rural_surtax` · `comprehensive.assessment_date` · `comprehensive.rounding` |
| 양도소득세 | `/tax/transfer` | `lib/tax/transfer.ts` | `transfer.base_rates` · `transfer.short_term_rates` · `transfer.heavy` · `transfer.ltsd.general` · `transfer.ltsd.one_house` · `transfer.ltsd.cap` · `transfer.exemption` · `transfer.basic_deduction` · `transfer.period_rule` · `transfer.temporary_two_house` · `transfer.local_income_tax` · `transfer.rounding` |
| 매도 실수령액 | `/tax/net-proceeds` | `lib/tax/net-proceeds.ts` | 자체 룰 없음 — 양도세·중개수수료 엔진을 호출해 합산 |

**공통 룰**(`tax_type='common'`): `region.metro_scope`(수도권 범위),
`region.regulated_history_from`(규제지역 이력 커버리지 시작일).

### 공용 컴포넌트 (`src/app/tax/_components/`)

| 파일 | 역할 |
|---|---|
| `TaxNav.tsx` | 계산기 8종 탭 |
| `CalcSection.tsx` · `CalcColumns.tsx` | 레이아웃 단일 출처. xl(1280px)부터 2단. **`space-y` 금지** — 결과 열 폭이 깨짐 |
| `RuleBasisBanner.tsx` | "적용된 법령 근거" 배너 |
| `RuleModeSelector.tsx` | 확정법/개정안 모드 전환. 경고의 시행 연도 문구(2027·2028·2029)는 대표님 승인 문구 |
| `CalcFailureNotice.tsx` | 엔진 실패 코드를 사용자 문구로 변환(`userFacingFailureMessage`) |
| `YearComparisonSection.tsx` | 연도별 세액 비교 |
| `AcquiredRegulatedField.tsx` · `AcquiredRegulatedNotice.tsx` | '취득 당시 조정대상지역' 입력·판정 표시 |
| `PartialAreaWarning.tsx` | 부분 지정 이력이 근거일 때 범위 한계 경고 |
| `coverage-rule.ts` | 자동 판정 활성 여부 조회. **서버 전용** — 클라이언트 import 금지 |
| `ApartmentOnlyNotice.tsx` | 아파트 전용 안내 |

---

## 2. 등록된 룰 전체 (57행 = confirmed 40 + proposed 17)

### 2-1. confirmed (현행법)

| 세목 | 룰 키 | 시행일 |
|---|---|---|
| acquisition | `acquisition.gift.rates` · `acquisition.rounding` | 2011-01-01 |
| acquisition | `acquisition.gift.tax_base` | 2023-01-01 |
| acquisition | **`acquisition.gift.heavy`** | **2026-01-01 ⭐이번 라운드 등록** |
| acquisition | `acquisition.onerous.rates` · `acquisition.gift.deemed_gift_threshold` | 2026-06-01 |
| brokerage | `brokerage.rates` · `brokerage.vat` | 2021-10-19 |
| common | `region.metro_scope` | 2008-03-21 |
| common | `region.regulated_history_from` | 2016-11-03 |
| comprehensive | `assessment_date` · `rounding` · `rural_surtax` | 2010-01-01 |
| comprehensive | `tax_credit` | 2021-01-01 |
| comprehensive | `assessment_ratio` · `basic_deduction` · `burden_cap` · `rates` | 2023-01-01 |
| property | `assessment_date` · `rounding` | 2010-01-01 |
| property | `assessment_ratio` · `rates` · `surtax` | 2023-01-01 |
| property | **`property.burden_cap`** | **2023-01-01 ~ 2028-12-31 ★종료일 있음** |
| property | `base_cap` | 2024-01-01 |
| property | **`property.assessment_ratio.one_house`** | **2026-01-01 ~ 2026-12-31 ★종료일 있음** |
| registration | `registration.bond` | 2015-07-01 |
| registration | `registration.fee` | 2025-08-01 |
| stamp | `stamp.rates` | 2002-01-01 |
| transfer | `base_rates` · `basic_deduction` · `exemption` · `local_income_tax` · `ltsd.general` · `ltsd.one_house` · `period_rule` · `rounding` · `short_term_rates` | 2023-01-01 |
| transfer | `temporary_two_house` | 2023-02-28 |
| transfer | `heavy` | 2026-05-10 |

### 2-2. proposed (2026 세제개편안) — 17행

`comprehensive.assessment_ratio`(2027 한정 / 2028~) · `comprehensive.basic_deduction`(2027~) ·
`comprehensive.burden_cap`(2027~) · `comprehensive.rates`(2027 한정 / 2028~) ·
`comprehensive.tax_credit`(2027 한정 / 2028~) · `transfer.basic_deduction`(2027~) ·
`transfer.heavy`(2027 한정 / 2028 한정) · `transfer.ltsd.cap`(2028 한정 / 2029~) ·
`transfer.ltsd.general`(2028 한정 / 2029~) · `transfer.ltsd.one_house`(2028 한정 / 2029~)

**★ 종료일이 있는 행이 중요한 이유**: 단계적으로 바뀌는 항목은 한 해만 유효한 행과 그 이후
행이 따로 있습니다. 종료일을 빼먹으면 같은 시점에 유효한 룰이 2건이 되어 `RULE_CONFLICT`로
**그 세목 전체 계산이 멈춥니다**. 특히 `region.*` 공통 룰이 겹치면 여러 세목이 동시에 멈춥니다.

### 2-3. 룰 값에 날짜를 담는 필드

`transfer.exemption.residenceIfAcquiredRegulated.appliesToAcquiredFrom` = `2017-08-03`.
취득 당시 조정대상지역 주택의 거주 요건이 **그날 취득분부터** 적용된다는 부칙을 표현합니다
(소득세법 시행령 부칙 대통령령 제28293호 제2조). 비면 취득일과 무관하게 거주 요건을 걸어
부칙 이전 취득분이 비과세에서 빠집니다. **날짜는 코드가 아니라 룰 값에 둡니다.**

### 2-4. 계산 가능 시점 (실측)

세목별로 필수 룰이 등록된 가장 늦은 시점부터 계산됩니다. 그보다 이르면 "근거 미등록"으로 멈춥니다.

| 세목 | 계산 가능 시작 | 확인 방법 |
|---|---|---|
| 인지세 | 2002-01-01 | 룰 시행일 |
| 중개수수료 | 2021-10-19 | 룰 시행일 |
| 재산세 | **2023년** | 실측 — 2022년은 `property.assessment_ratio` 미등록으로 멈춤 |
| 종부세 | 2023년 | 필수 룰 시행일 |
| 양도세 | **2023-01-01** | 실측 — 2022-12-31은 `transfer.period_rule` 미등록으로 멈춤 |
| 취득세(유상) | **2026-06-01** | 실측 — 2026-05-31은 `acquisition.onerous.rates` 미등록으로 멈춤 |
| 취득세(순수 증여) | 2023-01-01 | `gift.tax_base` 시행일 |
| 취득세(대가 있는 증여) | 2026-06-01 | `deemed_gift_threshold` 시행일 |
| 등기비용 | 2026-06-01 | 취득세 엔진 재사용 |

> ⚠️ **"가장 늦은 시행일"이 곧 경계가 아닙니다.** `transfer.heavy`(2026-05-10)처럼 없으면
> 조용히 미적용되는 룰이 있습니다. 과거 세율 등록은 **하지 않기로 결정**했습니다(§11).

---

## 3. 규제지역 이력 192행 (`tax_regulated_areas`)

| 항목 | 값 |
|---|---|
| 총 행 | 192 |
| 구분 | `adjustment`(조정대상지역) 단일 |
| 적용 세목 | `["acquisition","transfer"]` 단일 |
| 부분 지정(`is_partial=true`) | 42행 |
| 해제일 있음 | 152행 |
| 현재 지정 중 | 40행 (전부 전체 지정) |

### 3-1. 구간 규약 — 반열림 `[지정일, 해제일)`

**해제일은 "그날부터 해제"입니다. 해제일 당일은 이미 비규제입니다.**

데이터로 검증한 사실입니다. 해제일 9종 중 **6종이 같은 날 다른 구의 지정 시작일이기도**
합니다. 한 공고가 그날 발효되면서 일부는 지정, 일부는 해제된 것이므로 해제된 구는 당일부터
비규제입니다.

조회 조건은 `designated_from <= 기준일 AND (designated_to IS NULL OR designated_to > 기준일)`
이며 `rule-store.ts`의 두 함수에만 있습니다. 관리자 저장은 `designated_to <= designated_from`을
거부합니다(규제였던 날이 하루도 없는 죽은 행 방지).

### 3-2. 부분 지정 42건 — 축마다 다르게

- **양도세 비과세의 '취득 당시' 축** — 자동 판정에서 **제외**하고 사용자에게 직접 선택을
  요청합니다(사유 `partial_area`). 구 전체를 지정으로 보면 실제보다 불리해지기 때문입니다.
- **취득세 중과 · 양도 당시 중과 축** — 구 단위 판정을 **유지**하되 `PartialAreaWarning`으로
  "세금이 이보다 낮을 수 있다"는 범위 한계를 경고합니다.

전체 지정 이력이 같은 시점에 함께 있으면 그것을 우선합니다(정렬: `is_partial asc`,
동률이면 `designated_from desc`). 어느 동·읍·면인지는 `note`에 있습니다.

---

## 4. 법령 개정 자동 감시 ⭐이번 라운드 신규

### 4-1. 동작

매일 **한국시간 05:00**(Vercel Cron, `vercel.json`의 `"0 20 * * *"` — **UTC 기준**)에 돕니다.

1. `tax_law_watch_state`(단일 행 `id=1`)에서 어디까지 처리했는지 읽습니다.
2. 비어 있으면(첫 가동) **과거를 훑지 않고 그날로 기준선만 세우고 끝냅니다**.
3. 그다음 날부터 **'어제'까지** 순회합니다. 오늘은 일부러 제외합니다 — 오늘 늦게 공포되는
   개정이 있는데 오늘을 처리 완료로 올리면 다시 볼 기회가 없기 때문입니다.
4. `lsHstInf`로 그날 바뀐 법령을 받아 **감시 대상이 아니면 버립니다**.
5. 걸리면 `lsJoHstInf`로 그 조문이 그 개정에서 실제로 바뀌었는지 확인합니다
   (공포일자+공포번호가 개정 한 건을 특정). 바뀌었으면 큐에 넣습니다.
6. **성공한 날짜까지만** `last_checked_date`를 올립니다.
7. 남은 시간이 있으면 감시 대상 (법령ID, 조번호)가 법제처에서 실제로 조회되는지 확인합니다.

### 4-2. 파일

| 파일 | 역할 |
|---|---|
| `lib/tax/law-api.ts` | API 호출 |
| `lib/tax/law-api-parse.ts` | 파싱·정규화·안전장치 |
| `lib/tax/law-api-error.ts` | `LawApiError`(순환 참조 회피) |
| `lib/tax/law-watch.ts` | 실행 흐름·상태 저장 |
| `lib/tax/law-watch-scan.ts` | 하루치 처리 |
| `lib/tax/law-watch-targets.ts` | 대상 조회·실재 검증 |
| `app/api/cron/tax-law-watch/route.ts` | Cron 진입점 |
| `app/admin/tax/law-changes/` | 관리자 화면 4파일 |

### 4-3. 환경변수

| 변수 | 설명 |
|---|---|
| `LAW_API_OC` | 법제처 OPEN API 인증값(OC). 서버 전용 — `NEXT_PUBLIC_` 금지 |
| `CRON_SECRET` | Vercel Cron의 `Authorization: Bearer` 검증. **미설정이면 라우트가 모든 요청을 거부**. ⚠️ **영문·숫자·기호만** — 한글이 들어가면 **배포 자체가 거부됩니다**(2026-08-16 실제 발생) |

### 4-4. ★ 절대 무너뜨리면 안 되는 안전장치

**(1) `totalCnt` 검사.** 법제처는 인증 실패·점검 중에도 **HTTP 200 + JSON**으로 안내 문구를
돌려줍니다. 그때 레코드가 0건이라고 "그날 개정 없음"으로 처리하면 그 날짜가 처리 완료로
올라가 **개정을 영영 놓칩니다**. 정상 응답에는 결과가 0건이어도 `totalCnt`가 반드시 실려
오므로(두 API 모두 실측 확인) 그 유무로 가릅니다.

**(2) 대조 값 정규화.** 두 API가 준 공포일자·공포번호를 `digitsOnly`로 맞춰 비교합니다.
표기가 다르면(20260512 vs 2026-05-12) 모든 대조가 실패하는데, 그 실패는 오류가 아니라
"이 조문은 안 바뀜"으로 보여 **개정이 통째로 사라지면서 화면은 초록불 0건**을 유지합니다.

**(3) 실패한 날짜는 올리지 않는다.** 실패하면 그 앞 날짜까지만 올리고 오류를 기록합니다.

**(4) 시간 상한.** 개별 호출 10초 · 날짜 처리 30초 · 전체 42초 · `maxDuration` 60초.
함수가 강제 종료되면 **실패 기록조차 남지 않아** 화면이 직전 초록불을 유지합니다.

**(5) 조용한 필터링 금지.** 법령ID·조번호가 비어 감시 못 하는 룰과, 법제처에서 조회되지
않는 대상을 화면에 표시합니다.

### 4-5. 관리자 화면 `/admin/tax/law-changes`

세금 탭 세 번째. 미확인 건수가 배지로 붙습니다(룰 편집·규제지역 탭에서도 보임).

상단 상태 카드는 네 상태를 구분합니다 — 미실행 / 정상 / **주의**(돌긴 했지만 확인할 것이
있음) / 실패. 마지막 실행이 **36시간**을 넘으면 성공이어도 "멈춘 것"으로 봅니다.

**막힌 날짜 하루 건너뛰기** 버튼이 실패 상태일 때만 나타납니다. "실패한 날짜를 절대 넘기지
않는다"는 원칙 때문에 구조적으로 늘 실패하는 날짜가 생기면 그 뒤가 영영 막히는데, 그 교착을
사람이 의식적으로 푸는 수단입니다. **자동으로는 절대 일어나지 않습니다.**

> ⚠️ **조문번호는 조 단위(6자리)라 항을 구분하지 못합니다.** "제95조가 바뀌었다"까지만 알 수
> 있고 어느 항인지는 사람이 대조해야 합니다. 소득세법 제95조 하나에 룰 9건이 매달립니다.
> 이 한계는 화면의 "읽는 방법" 블록에 명시돼 있습니다 — **지우지 마세요.**

### 4-6. 첫 가동 결과 (2026-08-16 검증)

```
last_checked_date : 2026-08-16   (오늘 = 기준선만 세움)
last_run_at       : 2026-08-16 14:53:33 (한국시간)
last_run_ok       : true
last_error        : null
개정 큐            : 0건
```

과거를 훑지 않았습니다. 다섯 항목 전부 기대대로입니다.

---

## 5. 법령ID 최종 확정본 ⭐정정됨

2026-08-16에 저장된 법령ID 12개 중 **5개가 틀린 것**을 발견해 정정했습니다. 틀린 ID는
감시 목록에서 조용히 걸러져 **룰 35건이 오류 없이 감시 밖**에 있었습니다.

| 법령ID | 법령명 | 룰 | 비고 |
|---|---|---|---|
| 001565 | 소득세법 | 17 | ★정정 (001518은 존재하지 않는 ID) |
| 009873 | 종합부동산세법 | 11 | ★정정 (001687은 존재하지 않는 ID) |
| 001649 | 지방세법 | 10 | 그대로 |
| 005077 | 지방세법 시행령 | 3 | 그대로 |
| 009409 | 국고금 관리법 | 3 | ★정정 (000368은 존재하지 않는 ID). 법령명에 띄어쓰기 있음 |
| 009968 | 종합부동산세법 시행령 | 3 | ★정정 (002845는 국민체육진흥법 시행령이었음) |
| 003956 | 소득세법 시행령 | 1 | ★정정 (002028은 민주화운동 관련자 명예회복 법률이었음) |
| 000266 | 수도권정비계획법 | 1 | 그대로 |
| 001568 | 인지세법 | 1 | 그대로 |
| 007292 | 공인중개사법 시행규칙 | 1 | 그대로 |
| 001571 | 부가가치세법 | 1 | 그대로 |
| 001569 | 농어촌특별세법 | 1 | 그대로 |

**감시 대상: (법령ID, 조번호) 조합 27개 · 고유 법령ID 12개 · 룰 53건.**

정정 후 12개 전부를 법제처에 다시 조회해 법령명이 일치하는 것을 확인했습니다.
검증 방법: `lawService.do?target=law&ID=<id>&type=JSON`으로 `법령명_한글`을 대조.
존재하지 않는 ID는 `{"Law": "일치하는 법령이 없습니다..."}` 문자열이 옵니다.

### 5-1. 감시 제외 4건 (법령ID 없음 — 의도된 상태)

| 룰 키 | 근거 법령 | 왜 비었나 |
|---|---|---|
| `acquisition.rounding` | 지방세기본법 제59조 | 법령ID 미확인 |
| `region.regulated_history_from` | 주택법 제63조의2 | 법령ID 미확인 |
| `registration.bond` | 주택도시기금법 시행령 별표 | 법령ID 미확인 |
| `registration.fee` | 등기사항증명서 등 수수료규칙 | 법령ID 미확인 |

대표님 결정(2026-08-16)으로 **그대로 둡니다.** 나중에 법령ID가 확인되면 채웁니다.
**앞의 둘은 영향이 작지만(단수 처리·이력 커버리지), 뒤의 둘은 등기 수수료·채권 매입률이라
실제로 자주 바뀌는 값입니다.** 이 4건은 관리자 화면 상태 카드에 "감시 제외 룰"로 표시됩니다.

---

## 6. 조건 필드 전체 (세율 행 `when`이 쓸 수 있는 키)

**여기 없는 키를 쓰면 저장 단계에서 거부됩니다.** 값이 미확정(`undefined`)이면 그 조건을 쓴
행은 매칭 후보에서 빠지고 결과에 "판정하지 못한 조건"으로 표시됩니다 — 임의로 false 처리하지
않습니다.

| 계산기 | 조건 필드 |
|---|---|
| 취득세(유상) | `price` · `house_count` · `is_regulated` · `area_over_85` · `first_home` · `temporary_two_home` · `area_sqm` · `official_price` · `is_metro` |
| 취득세(증여) | `tax_base` · `house_count` · `is_regulated` · `area_over_85` · `donor_relation` · `area_sqm` · `official_price` · `is_metro` |
| 인지세 | `price` · `is_housing` |
| 중개수수료 | `deal_type` · `price` · `sido` |
| 등기비용(채권) | `official_price` · `price` · `sido` · `is_metro` |
| 재산세 | `official_price` · `is_one_house` |
| 종부세 | `house_count` · `is_one_house` · `total_official_price` · `age` · `holding_years` · `residence_years` · `is_residing` · `residing_official_price` · `has_regulated_house` |
| 양도세 | `house_count` · `is_regulated`(양도 당시) · `holding_years` · `holding_years_ltsd` · `residence_years` · `sido` · `sigungu` · `is_metro` · `transfer_price` |

`is_metro`는 `region.metro_scope` 룰과 시·도 입력이 둘 다 있어야 확정됩니다.

---

## 7. 엔진 실패 코드 (`TaxEngineErrorCode`)

| 코드 | 뜻 |
|---|---|
| `INVALID_INPUT` | 입력값 오류 |
| `RULE_NOT_REGISTERED` | 그 시점 룰 미등록 — **절대 0원으로 대체하지 않습니다** |
| `RULE_CONFLICT` | 같은 `rule_key`에 유효 룰이 2건 이상 — 계산 중단 |
| `RULE_VALUE_INVALID` | `rule_value` 구조가 스키마와 다름(관리자 입력 오류) |
| `NO_MATCHING_RATE_ROW` | 세율표에 입력 조건에 맞는 행이 없음 |
| `AMBIGUOUS_RATE_ROW` | 우선순위로도 행이 하나로 정해지지 않음 |
| `DB_ERROR` | DB 조회 실패 |

실패 결과에는 `acquiredRegulatedUnavailable`(자동 판정 불가 세 사유:
`no_coverage_rule` · `before_coverage` · `partial_area`)이 선택적으로 함께 실립니다.
화면 문구 변환은 `CalcFailureNotice.tsx`의 `userFacingFailureMessage` 한 곳에 모여 있습니다.

---

## 8. 마이그레이션 적용 현황

| 번호 | 내용 | 적용 |
|---|---|---|
| 055 | `tax_rules` · `tax_regulated_areas` · `tax_law_change_queue` 등 계산기 스키마 전체 | ✅ |
| 056 | 같은 `rule_key`의 기간 중복 방지 EXCLUDE 제약 | ✅ |
| 057 | 공통 룰(`tax_type='common'`) 허용 + 법령 참조 컬럼(`law_id`·`law_article_no`) | ✅ |
| 058 | 계산기 세목 추가(`tax_type` 확장) | ✅ |
| 059 | `tax_regulated_areas.note` 컬럼 | ✅ |
| 065 | `tax_regulated_areas.is_partial` (부분 지정 표시) | ✅ 2026-08-15 |
| 066 | 큐에 `matched_rule_keys` + 중복 방지·조회 인덱스, `tax_law_watch_state` 신규 | ✅ 2026-08-16 |

060~064는 계산기와 무관합니다(견적 요청·주문 기관정보·문의 첨부·활동 로그 인덱스·매뉴얼 스토리지).
**다음 마이그레이션 번호는 067입니다.** 번호를 딸 때 반드시 `supabase/migrations`를 확인하세요 —
과거에 060이 이미 쓰여 065로 바꾼 적이 있습니다.

---

## 9. 이번 라운드 커밋 이력 (2026-08-16, 전부 배포됨)

| 커밋 | 내용 |
|---|---|
| `db7a64f` | 증여 중과 개시 — 농어촌특별세 미포함 사실을 결과·안내에 명시 |
| `875e649` | 실수령액 폼도 거주기간을 전 주택 수에서 받는다 |
| `e29bab3` | [감시 W1] 마이그레이션 066 |
| `d4fadd8` | [감시 W2] 감지 배치 — Vercel Cron 하루 1회 |
| `e666e30` | [감시 W3] 법령ID 존재 확인 + 관리자 화면 |
| `142f540` | [감시 W4] 점검 지적 일괄 — 조용한 실패 차단 |
| `f52194d` | 실행 시간 상한 60초·날짜 상한 3일 |
| `e2fea01` | cron 시간대와 CRON_SECRET 제약 기록 |

### DB 직접 변경 이력 (관리자 화면을 거치지 않아 감사 기록에 없음)

- 2026-08-15 `tax_regulated_areas` 40행 삭제 → 192행 등록
  (백업 `db-backup/tax_regulated_areas_before_history_20260815.json`)
- 2026-08-15 `region.regulated_history_from` 커버리지 룰 등록
- 2026-08-16 `transfer.exemption`에 `appliesToAcquiredFrom: 2017-08-03` 추가
- 2026-08-16 **`acquisition.gift.heavy` 등록** (시행 2026-01-01)
- 2026-08-16 **법령ID 5건 정정** — 35행 UPDATE (§5)

---

## 10. 계산기를 새로 추가하는 절차

1. `lib/tax/<name>-types.ts`에 입력·결과·`rule_value` 스키마 타입
2. `lib/tax/<name>-rules.ts`에 `rule_value` 런타임 검증기 — **형식만 검사하고 값은 넣지 않습니다**
3. `lib/tax/<name>.ts`에 엔진 — `fetchValidRules` → `requireRule` → `parse*` → `selectRateRow` →
   `use(rule)`로 근거 수집 → 성공/실패 반환
4. `app/tax/<name>/page.tsx`(metadata 필수) · `*Form.tsx` · `actions.ts` · `*ResultPanel.tsx`
5. `lib/tax/calculators.ts`에 등록(`available` 플래그로 미완성 계산기 숨김)
6. `app/admin/tax/rules/rule-guides-<name>.ts`에 관리자 안내와 스켈레톤
7. 마이그레이션으로 `tax_type` 추가(058 참고)
8. 룰을 관리자 화면에서 등록 — 등록 전까지 "근거 미등록"으로 멈춥니다(정상)
9. **법령ID와 6자리 조문번호를 반드시 채웁니다** — 비면 감시에서 빠집니다

---

## 11. 다음 세션이 지켜야 할 원칙

1. **세율·금액·날짜·연도를 코드에 넣지 마세요.** 화면 문구에도 넣지 않습니다. 전부 룰에서
   옵니다. 예외는 대표님이 승인한 문구뿐입니다(`RuleModeSelector`의 2027·2028·2029).
2. **룰이 없으면 0원이 아니라 멈춥니다.** 미등록을 0으로 대체하는 코드를 절대 쓰지 마세요.
3. **판정하지 못한 조건은 임의로 false 처리하지 않습니다.**
4. **사용자가 직접 넣은 값이 자동 판정보다 우선합니다.**
5. **조용한 실패를 만들지 마세요.** 이번 라운드의 Critical 두 건이 전부 "오류 없이 개정을
   놓치는" 경로였습니다. 0건이 나오면 "진짜 없음"인지 "조회 실패"인지 가릴 수 있어야 합니다.
6. **회귀 위험이 있으면 손대지 말고 보고하세요.** 건너뛴 항목보다 깨진 화면이 더 나쁩니다.
7. 파일은 300줄 이하. 초과 시 분리하되 계산 경로를 건드리는 분리는 승인 후에.
8. 모든 함수에 한국어 JSDoc.
9. 검증은 `npx tsc --noEmit` + `npm run build`. ESLint 설정이 없어 `next lint`는 쓸 수 없습니다.
10. 작업이 끝나면 `git push origin main`까지 해야 끝난 것입니다.

### 과거 세율은 등록하지 않기로 했습니다 (2026-08-16 결정)

취득세 신고 기한이 60일이라 지금 신고할 사람은 이미 계산되고, 등기비용도 집 살 때 쓰는
계산기라 현재 시점입니다. **가장 큰 이유는 위험입니다** — 세율표에 조건 없는 기본 행
(`when: {}`)이 있어서, 과거 구간을 채우며 다주택 중과 행을 빠뜨리면 계산기가 멈추지 않고
**조용히 일반세율을 물립니다**. 대신 막힐 때 안내를 친절히 하는 쪽으로 갑니다(미착수).

---

## 12. 국회 통과 시 해야 할 일 (2026 세제개편안)

**개편안은 9월 초 국회 제출 예정입니다.** 통과되면 아래를 순서대로 처리하세요.

### 12-1. proposed 17행을 confirmed로 전환

관리자 화면에서 각 행의 status를 `proposed` → `confirmed`로 바꾸거나, 같은 값의 confirmed 행을
새로 등록하고 proposed를 정리합니다. **종료일을 반드시 그대로 유지하세요** — 빠뜨리면 같은
시점에 유효한 룰이 2건이 되어 `RULE_CONFLICT`로 그 세목이 통째로 멈춥니다(§2-2).

전환 직후 확인할 것: 양도세·종부세를 2027·2028·2029년 기준일로 각각 계산해 세액이 개정안
모드와 같은지, 그리고 확정법 모드에서도 같은 값이 나오는지.

### 12-2. ★ 실수령액 계산기가 개정안 룰을 타기 시작합니다

**이것이 가장 조용히 어긋나는 지점입니다.** 실수령액 계산기는 `rule_mode: 'confirmed'`로
고정돼 있어 지금은 개정안 룰을 타지 않습니다. proposed가 confirmed가 되는 순간 **곧바로**
새 룰을 탑니다.

`transfer.basic_deduction` 개정안은 `residence_years >= 10`이면 기본공제가 250만원 → 2,500만원인데
**주택 수 조건이 없습니다.** 다주택도 해당됩니다. 실수령액 폼이 거주기간을 안 보내면 세금을
실제보다 많게 계산합니다. 이미 대비해 뒀습니다(커밋 `875e649`) — **되돌리지 마세요.**

### 12-3. 고령자 감면 반영

현재 반영돼 있지 않습니다("계산 전에 확인하세요"에 미반영 특례로 명시). 개편안에 고령자
감면 변경이 포함돼 있으면 룰 키를 새로 만들어야 합니다. 값과 조건 필드는 대표님 지시서 필요.

### 12-4. 상단 배너 경고색 문제

`RuleModeSelector`의 개정안 경고가 확정 후에도 그대로 뜨면 안 됩니다. proposed 행이 0건이
되면 개정안 모드 자체를 숨기거나, 남은 proposed가 있는 세목에서만 뜨도록 조건을 손봐야 합니다.
**지금은 모드를 켜면 무조건 뜹니다.**

### 12-5. 개정안 입력칸 문제

종부세의 `ProposedFields`(개정안 전용 입력 패널)와 양도세의 개정안 관련 입력이 확정 후에는
본 계산 입력과 중복됩니다. 확정 시점에 이 패널을 본 계산 입력으로 흡수할지, 그대로 둘지
결정이 필요합니다. **본 계산 결과를 바꾸지 않는 것이 현재 설계**이므로 흡수할 때 회귀 주의.

---

## 13. 잔여 보류 항목

### 13-1. 파일 크기 초과 (계산 경로 — 배포 뒤 별도 작업 권장)

`lib/tax/transfer.ts` 774줄(승인 예외 748) · `transfer-rules.ts` 389줄 ·
`transfer-types.ts` 301줄 · `rule-store.ts` 305줄 · `rule-value.ts` 595줄 ·
`comprehensive.ts` 458줄(승인) · `engine-types.ts` 414줄 · `acquisition.ts` 355줄 ·
`property.ts` 321줄 · `rule-guides.ts` 308줄.

### 13-2. 감시 기능 Medium 이하 (점검에서 나옴, 수정 안 함)

- **조문 이력 페이징 없음** — `fetchArticleHistory`가 한 번에 최대 100건만 받습니다.
  **언제 문제가 되는가**: 한 조문의 누적 이력이 100건을 넘는 순간 최신 개정이 잘려
  무음 탈락합니다. 실측(2026-08-16) 감시 대상 중 최다인 소득세법 제95조가 **49건**이라
  여유가 있지만, 개정이 잦은 조문이 들어오거나 세월이 쌓이면 도달합니다.
  넘길 때 할 일은 `law-api.ts`의 해당 JSDoc에 적어 뒀습니다.
- 관리자 목록 pending·done 각 100건 고정, 공용 `Pagination` 미사용
- 마이그레이션 066 주석은 "ON CONFLICT DO NOTHING"인데 구현은 23505 처리(결과 동일)
- `CRON_SECRET` 비교가 프로젝트 관례인 `timingSafeEqual`이 아닌 단순 `===`
- 감시 상태 변경이 `/admin/activity`에 안 남음(세금 모듈 전체가 동일)
- 신구법 대조 링크가 실제 대조 화면으로 가는지 브라우저 확인 미완
- Cron 라우트 인증 차단(401) 실측 미완 — 429(요청 과다)로 막혀 확인 못 함.
  Vercel 대시보드 Run이 성공한 것으로 인증 자체는 간접 확인됨

### 13-3. 계산기 Medium 이하 (이전 라운드부터 이월)

- 취득세·등기비용 계산 이력에 부분 지정 근거가 안 남음(양도세·실수령액은 남김)
- 규제지역 관리 화면에 192행을 위한 검색·필터·페이지네이션·삭제 액션 없음
- 제도 시행 이전(2016-11-03 이전) 취득도 `before_coverage`로 분류돼 사용자에게 물음
- 규제지역 이력 저장에 감사 기록 없음
- 고가주택 안분 경로에 거주 요건 면제 근거를 남길 곳 없음
- 결과 패널 4종의 기존 아이콘 `aria-hidden` 누락
- `SELECT_CLS` 문자열이 4곳에 복제

### 13-4. 확인 필요

- **세종특별자치시 해제일** — CSV는 `2016-11-03 ~ 2022-11-14`인데 2023-01-05 해제가
  맞다는 지적이 있었습니다(확신도 중간). 사실이면 2022-11-14 ~ 2023-01-04 취득분이
  비규제로 잘못 판정됩니다. **원 공고 대조 필요.**
- **부분 지정 경고가 아직 화면에 도달하지 않음** — 오늘 시점 유효 이력 40건이 전부 전체
  지정이기 때문입니다. 코드는 준비돼 있고 위험 없음.
- **`tax_test_cases` 실행기가 없습니다** — 회귀 테스트가 자동화돼 있지 않아 검증은 브라우저
  실측에 의존합니다.

---

## 14. 새 세션이 처음 읽어야 할 파일 순서

1. **이 문서** — 전체 지도
2. `CLAUDE.md` — 프로젝트 규칙(한국어 전용·push까지가 완료 등)
3. `PROJECT_STRUCTURE.md` §4(DB)·§5.8~5.9(법제처 API·Cron)
4. `src/lib/tax/engine-types.ts` — 입력·결과·실패 코드의 공통 타입
5. `src/lib/tax/rule-store.ts` — 룰 조회·규제지역 판정. 모든 엔진이 여기를 거칩니다
6. `src/lib/tax/rule-value.ts` — 세율 행 매칭(`selectRateRow`)과 조건 판정 규칙
7. `src/lib/tax/acquisition.ts` — 가장 단순한 전체 엔진
8. `src/lib/tax/transfer.ts` — 가장 복잡한 엔진
9. `src/lib/tax/law-watch.ts` → `law-watch-scan.ts` → `law-api.ts` — 감시 흐름
10. `src/app/tax/transfer/` 한 벌 — 화면 구조
11. `src/app/admin/tax/rules/rule-guides*.ts` — 각 룰의 값 형식과 운영자 안내

---

*작성: 2026-08-19 · 기준 커밋 `e2fea01` · 이전 인계서 전부 대체*
