# 부동산 계산기 인계서 — 2026-08-16 (최신본)

> **이 문서가 부동산 계산기의 최신 인계서입니다.** `HANDOVER-calc-2026-08-16-final.md`를 비롯한
> 이전 인계서를 모두 대체합니다. 내용이 충돌하면 이 문서를 따르세요.
>
> 기준 커밋: `d94593c` (origin/main, 배포됨) · 작성 시점: 2026-08-16

---

## 0. 5분 요약

여덟 개 부동산 계산기가 `/tax/*`에서 돌아갑니다. **세율·금액·날짜를 코드에 넣지 않고 전부
DB(`tax_rules`)에서 읽는 것**이 이 시스템의 유일한 설계 원칙입니다. 룰이 없으면 0원으로
계산하지 않고 "근거 미등록"으로 멈춥니다.

가장 최근 작업은 **취득 당시 조정대상지역 자동 판정**입니다. 사용자가 직접 고르던 값을
등록된 지정 이력 192행으로 자동 판정하고, 판정하지 못하면 이유를 밝히고 묻습니다.

---

## 1. 계산기 8종과 파일 매핑

각 계산기는 `page.tsx`(서버) → `*Form.tsx`(클라이언트) → `actions.ts`(서버 액션) →
`lib/tax/*.ts`(엔진) → `*ResultPanel.tsx`(결과) 구조가 같습니다.

| 계산기 | 경로 | 엔진 | 주요 룰 키 |
|---|---|---|---|
| 취득세 | `/tax/acquisition` | `lib/tax/acquisition.ts` (355줄) | `acquisition.onerous.rates` · `acquisition.gift.rates` · `acquisition.gift.tax_base` · `acquisition.gift.deemed_gift_threshold` · `acquisition.rounding` |
| 인지세 | `/tax/stamp` | `lib/tax/stamp.ts` (95줄) | `stamp.rates` |
| 중개수수료 | `/tax/brokerage` | `lib/tax/brokerage.ts` (150줄) | `brokerage.rates` · `brokerage.vat` |
| 등기비용 | `/tax/registration` | `lib/tax/registration.ts` (273줄) | `registration.bond` · `registration.fee` (+ 취득세·인지세 엔진 재사용) |
| 재산세 | `/tax/property` | `lib/tax/property.ts` (321줄) | `property.rates` · `property.assessment_ratio` · `property.assessment_ratio.one_house` · `property.base_cap` · `property.burden_cap` · `property.surtax` · `property.assessment_date` · `property.rounding` |
| 종합부동산세 | `/tax/comprehensive` | `lib/tax/comprehensive.ts` (458줄) | `comprehensive.rates` · `comprehensive.basic_deduction` · `comprehensive.assessment_ratio` · `comprehensive.burden_cap` · `comprehensive.tax_credit` · `comprehensive.rural_surtax` · `comprehensive.assessment_date` · `comprehensive.rounding` |
| 양도소득세 | `/tax/transfer` | `lib/tax/transfer.ts` (774줄) | `transfer.base_rates` · `transfer.short_term_rates` · `transfer.heavy` · `transfer.ltsd.general` · `transfer.ltsd.one_house` · `transfer.ltsd.cap` · `transfer.exemption` · `transfer.basic_deduction` · `transfer.period_rule` · `transfer.temporary_two_house` · `transfer.local_income_tax` · `transfer.rounding` |
| 매도 실수령액 | `/tax/net-proceeds` | `lib/tax/net-proceeds.ts` (129줄) | 자체 룰 없음 — 양도세·중개수수료 엔진을 그대로 호출해 합산 |

**공통 룰**(`tax_type='common'`, 모든 세목 조회에 실림): `region.metro_scope`(수도권 범위),
`region.regulated_history_from`(규제지역 이력 커버리지 시작일).

### 공용 컴포넌트 (`src/app/tax/_components/`)

| 파일 | 역할 |
|---|---|
| `TaxNav.tsx` | 계산기 8종 탭 |
| `CalcSection.tsx` · `CalcColumns.tsx` | 레이아웃 단일 출처. xl(1280px)부터 2단. **`space-y` 금지** — 결과 열 폭이 깨짐 |
| `RuleBasisBanner.tsx` | "적용된 법령 근거" 배너 |
| `RuleModeSelector.tsx` | 확정법/개정안 모드 전환. 경고의 시행 연도 문구(2027·2028·2029)는 대표님 승인 문구 |
| `CalcFailureNotice.tsx` | 엔진 실패 코드를 사용자 문구로 변환(`userFacingFailureMessage`) |
| `YearComparisonSection.tsx` | 연도별 세액 비교 섹션 |
| `AcquiredRegulatedField.tsx` | '취득 당시 조정대상지역' 입력칸 — 양도세·실수령액 공용 |
| `AcquiredRegulatedNotice.tsx` | 자동 판정 결과와 근거, 판정 못 한 사유 |
| `PartialAreaWarning.tsx` | 부분 지정 이력이 근거일 때 범위 한계 경고 |
| `coverage-rule.ts` | 자동 판정이 켜져 있는지 조회. **서버 전용**(`@/lib/supabase/server` import) — 클라이언트에서 import 금지 |
| `ApartmentOnlyNotice.tsx` | 아파트 전용 안내 |

---

## 2. 등록된 룰 전체 (56행 = confirmed 39 + proposed 17)

### 2-1. confirmed (현행법)

| 세목 | 룰 키 | 시행일 |
|---|---|---|
| acquisition | `acquisition.gift.rates` | 2011-01-01 |
| acquisition | `acquisition.rounding` | 2011-01-01 |
| acquisition | `acquisition.gift.tax_base` | 2023-01-01 |
| acquisition | `acquisition.onerous.rates` | 2026-06-01 |
| acquisition | `acquisition.gift.deemed_gift_threshold` | 2026-06-01 |
| brokerage | `brokerage.rates` · `brokerage.vat` | 2021-10-19 |
| common | `region.metro_scope` | 2008-03-21 |
| common | `region.regulated_history_from` | 2016-11-03 |
| comprehensive | `comprehensive.assessment_date` · `comprehensive.rounding` · `comprehensive.rural_surtax` | 2010-01-01 |
| comprehensive | `comprehensive.tax_credit` | 2021-01-01 |
| comprehensive | `comprehensive.assessment_ratio` · `comprehensive.basic_deduction` · `comprehensive.burden_cap` · `comprehensive.rates` | 2023-01-01 |
| property | `property.assessment_date` · `property.rounding` | 2010-01-01 |
| property | `property.assessment_ratio` · `property.rates` · `property.surtax` | 2023-01-01 |
| property | **`property.burden_cap`** | **2023-01-01 ~ 2028-12-31 ★종료일 있음** |
| property | `property.base_cap` | 2024-01-01 |
| property | **`property.assessment_ratio.one_house`** | **2026-01-01 ~ 2026-12-31 ★종료일 있음** |
| registration | `registration.bond` | 2015-07-01 |
| registration | `registration.fee` | 2025-08-01 |
| stamp | `stamp.rates` | 2002-01-01 |
| transfer | `transfer.base_rates` · `transfer.basic_deduction` · `transfer.exemption` · `transfer.local_income_tax` · `transfer.ltsd.general` · `transfer.ltsd.one_house` · `transfer.period_rule` · `transfer.rounding` · `transfer.short_term_rates` | 2023-01-01 |
| transfer | `transfer.temporary_two_house` | 2023-02-28 |
| transfer | `transfer.heavy` | 2026-05-10 |

### 2-2. proposed (2026 세제개편안) — 17행

| 룰 키 | 기간 |
|---|---|
| `comprehensive.assessment_ratio` | **2027-01-01 ~ 2027-12-31 ★** |
| `comprehensive.assessment_ratio` | 2028-01-01 ~ |
| `comprehensive.basic_deduction` | 2027-01-01 ~ |
| `comprehensive.burden_cap` | 2027-01-01 ~ |
| `comprehensive.rates` | **2027-01-01 ~ 2027-12-31 ★** |
| `comprehensive.rates` | 2028-01-01 ~ |
| `comprehensive.tax_credit` | **2027-01-01 ~ 2027-12-31 ★** |
| `comprehensive.tax_credit` | 2028-01-01 ~ |
| `transfer.basic_deduction` | 2027-01-01 ~ |
| `transfer.heavy` | **2027-01-01 ~ 2027-12-31 ★** |
| `transfer.heavy` | **2028-01-01 ~ 2028-12-31 ★** |
| `transfer.ltsd.cap` | **2028-01-01 ~ 2028-12-31 ★** |
| `transfer.ltsd.cap` | 2029-01-01 ~ |
| `transfer.ltsd.general` | **2028-01-01 ~ 2028-12-31 ★** |
| `transfer.ltsd.general` | 2029-01-01 ~ |
| `transfer.ltsd.one_house` | **2028-01-01 ~ 2028-12-31 ★** |
| `transfer.ltsd.one_house` | 2029-01-01 ~ |

**★ 종료일이 있는 행이 중요한 이유**: 개편안이 단계적으로 바뀌는 항목은 한 해만 유효한 행과
그 이후 행이 따로 있습니다. 종료일을 빼먹으면 같은 시점에 유효한 룰이 2건이 되어
`RULE_CONFLICT`로 **그 세목 전체 계산이 멈춥니다**. 특히 `region.*` 공통 룰이 겹치면
양도세뿐 아니라 취득세·인지세·중개수수료·종부세까지 전부 멈춥니다.

### 2-3. 룰 값에 날짜를 담는 필드

`transfer.exemption.residenceIfAcquiredRegulated.appliesToAcquiredFrom` = `2017-08-03`
(2026-08-16 대표님 승인 입력). 취득 당시 조정대상지역 주택의 거주 요건이 **그날 취득분부터**
적용된다는 부칙을 표현합니다(소득세법 시행령 부칙 대통령령 제28293호 제2조). 이 필드가 비면
취득일과 무관하게 거주 요건을 걸어 부칙 이전 취득분이 비과세에서 빠집니다. 선택 필드이므로
그런 부칙이 없는 조문이면 줄을 통째로 뺍니다.

---

## 3. 규제지역 이력 192행 (`tax_regulated_areas`)

| 항목 | 값 |
|---|---|
| 총 행 | 192 |
| 구분(`area_type`) | `adjustment`(조정대상지역) 단일 |
| 적용 세목(`applies_to`) | `["acquisition","transfer"]` 단일 |
| 전체 지정 | 150행 |
| **부분 지정(`is_partial=true`)** | **42행** |
| 해제일 있음 | 152행 |
| 현재 지정 중 | 40행 (전부 전체 지정) |

### 3-1. 구간 규약 — 반열림 `[지정일, 해제일)`

**해제일은 "그날부터 해제"입니다. 해제일 당일은 이미 비규제입니다.**

이것은 추측이 아니라 데이터로 검증한 사실입니다. 해제일 9종(2018-08-28 · 2018-12-31 ·
2019-11-08 · 2020-06-19 · 2020-12-18 · 2022-07-05 · 2022-09-26 · 2022-11-14 · 2023-01-05)
중 **6종이 같은 날 다른 구의 지정 시작일이기도 합니다**. 한 공고가 그날 발효되면서 일부는
지정, 일부는 해제된 것이므로 해제된 구는 당일부터 비규제입니다. 또 앞 이력의 해제일과 뒤
이력의 지정일이 같은 날인 전환 사례가 18건 있어, 닫힘 구간으로 보면 같은 날 두 상태가 되는
모순이 생깁니다.

조회 조건은 `designated_from <= 기준일 AND (designated_to IS NULL OR designated_to > 기준일)`
이며 `rule-store.ts`의 `findRegulatedAreaRecord`·`isRegulatedArea` 두 곳에만 있습니다.
관리자 저장은 `designated_to <= designated_from`을 거부합니다(같은 날이면 규제였던 날이
하루도 없는 죽은 행이 되기 때문. 현재 데이터에 0건).

### 3-2. 부분 지정 42건의 의미 — 축마다 다르게 다룹니다

시·군·구 일부(동·읍·면)만 지정된 이력입니다. 계산기는 구 단위로만 판정하므로 그대로 쓰면
지정 범위 밖 주택까지 규제로 봅니다. 대표님 결정(2026-08-15)에 따라 축을 나눴습니다.

- **양도세 비과세의 '취득 당시' 축** — 자동 판정에서 **제외**하고 사용자에게 직접 선택을
  요청합니다(사유 `partial_area`). 구 전체를 지정으로 보면 실제보다 불리해지기 때문입니다.
- **취득세 중과 · 양도 당시 중과 축** — 구 단위 판정을 **유지**하되 결과에
  `PartialAreaWarning`으로 "세금이 이보다 낮을 수 있다"는 범위 한계를 경고합니다.

전체 지정 이력이 같은 시점에 함께 있으면 그것을 우선하므로 경고가 뜨지 않습니다
(정렬: `is_partial asc`, 동률이면 `designated_from desc`).

어느 동·읍·면인지는 `note` 컬럼에 있습니다. `note`에는 해제 공고 주소도 함께 들어 있습니다
(`source_url`은 지정 공고 하나만, 152행에 해제 공고가 메모로 옮겨져 있음).

---

## 4. 취득 당시 조정대상지역 자동 판정

### 4-1. 동작

`transfer-regulated.ts`의 `resolveAcquiredRegulated`가 순서대로 검사합니다.

1. **사용자가 직접 골랐으면 그 값을 씁니다** — 이력 조회조차 하지 않습니다. 자동 판정보다
   사용자 지정이 항상 우선합니다.
2. 커버리지 룰(`region.regulated_history_from`)이 있는지
3. 취득일이 커버리지 시작일 이후인지
4. 그 시점 이력이 부분 지정이 아닌지

넷 다 통과하면 자동 판정하고, 결과와 근거(지정일·공고 링크)를 화면에 표시합니다. 자동 판정에
쓴 커버리지 룰은 "적용된 법령 근거"에도 남습니다.

### 4-2. 판정하지 못하는 세 사유

| 사유 코드 | 뜻 | 화면 문구 요지 |
|---|---|---|
| `no_coverage_rule` | 커버리지 룰 미등록 | 과거 지정 이력이 아직 등록되지 않아 직접 선택이 필요합니다 |
| `before_coverage` | 취득일이 이력 시작 이전 | 이력이 없는 것이 곧 비규제였다는 뜻은 아니므로 임의로 판단하지 않았습니다 |
| `partial_area` | 그 시점 이력이 부분 지정 | 일부 동·읍·면만 지정된 곳이라 구 전체로 판정할 수 없습니다 |

세 경우 모두 **임의로 비규제로 보지 않고** 사용자에게 묻습니다. 비규제로 단정하면 거주 요건이
빠져 세금이 실제보다 적게 계산되기 때문입니다.

### 4-3. 커버리지 룰 등록 시 주의

- 세목을 반드시 **"공통 (전 세목)"**으로 두세요. 특정 세목에 넣으면 자동 판정이 조용히 꺼집니다.
- `rule_value.from`은 등록된 이력 중 **가장 이른 지정일**로. 실제보다 이르면 이력 없는 구간이
  "그때 비규제"로 자동 판정됩니다.
- **룰의 시행일(`effective_from`)도 같은 날짜(또는 그보다 앞)로** 두세요. 화면은 오늘 기준으로
  자동 판정 활성 여부를 보는데 엔진은 양도일 기준으로 룰을 싣기 때문에, 시행일을 늦게 잡으면
  화면과 계산이 어긋납니다. 현재는 둘 다 2016-11-03이고 양도세 룰이 2023-01-01부터라 이
  경로에 닿지 않습니다.

---

## 5. 조건 필드 전체 (세율 행 `when`이 쓸 수 있는 키)

**여기 없는 키를 쓰면 저장 단계에서 거부됩니다.** 값이 미확정(`undefined`)이면 그 조건을 쓴
행은 매칭 후보에서 빠지고, 결과에 "판정하지 못한 조건"으로 표시됩니다 — 임의로 false 처리하지
않습니다.

| 계산기 | 조건 필드 |
|---|---|
| 취득세 | `price` · `house_count` · `is_regulated` · `area_over_85` · `first_home` · `temporary_two_home` · `area_sqm` · `official_price` · `is_metro` |
| 인지세 | `price` · `is_housing` |
| 중개수수료 | `deal_type` · `price` · `sido` |
| 등기비용(채권) | `official_price` · `price` · `sido` · `is_metro` |
| 재산세 | `official_price` · `is_one_house` |
| 종부세 | `house_count` · `is_one_house` · `total_official_price` · `age` · `holding_years` · `residence_years` · `is_residing` · `residing_official_price` · `has_regulated_house` |
| 양도세 | `house_count` · `is_regulated`(양도 당시) · `holding_years` · `holding_years_ltsd` · `residence_years` · `sido` · `sigungu` · `is_metro` · `transfer_price` |

`is_metro`는 `region.metro_scope` 룰과 시·도 입력이 둘 다 있어야 확정됩니다.

---

## 6. 엔진 실패 코드 (`TaxEngineErrorCode`)

| 코드 | 뜻 |
|---|---|
| `INVALID_INPUT` | 입력값 오류 |
| `RULE_NOT_REGISTERED` | 그 시점 룰 미등록 — **절대 0원으로 대체하지 않습니다** |
| `RULE_CONFLICT` | 같은 `rule_key`에 유효 룰이 2건 이상 — 계산 중단 |
| `RULE_VALUE_INVALID` | `rule_value` 구조가 스키마와 다름(관리자 입력 오류) |
| `NO_MATCHING_RATE_ROW` | 세율표에 입력 조건에 맞는 행이 없음 |
| `AMBIGUOUS_RATE_ROW` | 우선순위로도 행이 하나로 정해지지 않음 |
| `DB_ERROR` | DB 조회 실패 |

실패 결과에는 `acquiredRegulatedUnavailable`(위 4-2의 세 사유)이 선택적으로 함께 실립니다.
화면 문구 변환은 `CalcFailureNotice.tsx`의 `userFacingFailureMessage` 한 곳에 모여 있습니다.

---

## 7. 마이그레이션 적용 현황

| 번호 | 내용 | 적용 |
|---|---|---|
| 055 | `tax_rules` · `tax_regulated_areas` 등 계산기 스키마 전체 | ✅ |
| 056 | 같은 `rule_key`의 기간 중복 방지 제약 | ✅ |
| 057 | 공통 룰(`tax_type='common'`) 허용 + 법령 참조 컬럼(`law_id`·`law_article_no`) | ✅ |
| 058 | 계산기 세목 추가(`tax_type` 확장) | ✅ |
| 059 | `tax_regulated_areas.note` 컬럼 | ✅ |
| 065 | `tax_regulated_areas.is_partial` (부분 지정 표시) | ✅ 2026-08-15 적용 |

060~064는 계산기와 무관합니다(견적 요청·주문 기관정보·문의 첨부·활동 로그 인덱스·매뉴얼 스토리지).
**다음 마이그레이션 번호는 066입니다.** 번호를 새로 딸 때 반드시 `supabase/migrations`를
확인하세요 — 과거에 060이 이미 쓰여 065로 바꾼 적이 있습니다.

---

## 8. 이번 작업의 커밋 이력 (2026-08-15 ~ 16, 전부 배포됨)

`d94593c`가 현재 `origin/main`입니다.

| 커밋 | 내용 |
|---|---|
| `5714db4` | 마이그레이션 065 — 규제지역 이력에 부분 지정 컬럼 |
| `11664c6` | 관리자 규제지역 화면에 부분 지정 입력칸 |
| `ef7b34a` | 엔진에 취득 당시 자동 판정 — 근거·미판정 사유를 결과에 담음 |
| `77e3e9e` | 자동 판정 결과·근거 표시와 직접 지정 경로 |
| `7ef0def` | 커버리지 룰 저장 검증기·세목 강제·입력 안내 |
| `eff4501` | 부분 지정이 판정 근거일 때 결과에 경고 |
| `fc1a18a` | 폼 연동·계산 이력에 판정 근거·옛 문구 정리 |
| `35a9c86` | **규제지역 해제일 경계 수정**(반열림) |
| `ed4c1b2` | **비과세 거주 요건에 부칙 적용 시작 취득일 필드** |
| `a1abea9` | 커버리지 룰 시행일 안내 |
| `d94593c` | 재검사 지적 반영 — 비과세 사유 문구·죽은 이력 차단·규약 표기 통일 |

그 이전(배포 완료): 연도별 세액 비교(`YearComparisonSection`), 계산기 PC 폭 확대
(`CalcSection`·`CalcColumns`), 2026 세제개편안 룰 등록.

### DB 직접 변경 이력 (관리자 화면을 거치지 않아 감사 기록에 없음)

- 2026-08-15 `tax_regulated_areas` 기존 40행 삭제 → 192행 등록.
  백업: `db-backup/tax_regulated_areas_before_history_20260815.json`
- 2026-08-15 `region.regulated_history_from` 커버리지 룰 등록
- 2026-08-16 `transfer.exemption`에 `appliesToAcquiredFrom: 2017-08-03` 추가.
  백업: `db-backup/tax_rule_transfer_exemption_before_20260815.json`

---

## 9. 계산기를 새로 추가하는 절차

1. `lib/tax/<name>-types.ts`에 입력·결과·`rule_value` 스키마 타입
2. `lib/tax/<name>-rules.ts`에 `rule_value` 런타임 검증기 — **형식만 검사하고 값은 넣지 않습니다**
3. `lib/tax/<name>.ts`에 엔진 — `fetchValidRules` → `requireRule` → `parse*` → `selectRateRow` →
   `use(rule)`로 근거 수집 → 성공/실패 반환
4. `app/tax/<name>/page.tsx`(metadata 필수) · `*Form.tsx` · `actions.ts` · `*ResultPanel.tsx`
5. `lib/tax/calculators.ts`에 등록(`available` 플래그로 미완성 계산기 숨김)
6. `app/admin/tax/rules/rule-guides-<name>.ts`에 관리자 안내와 스켈레톤
7. 마이그레이션으로 `tax_type` 추가(058 참고)
8. 룰을 관리자 화면에서 등록 — 등록 전까지 계산기는 "근거 미등록"으로 멈춥니다(정상)

---

## 10. 다음 세션이 지켜야 할 원칙

1. **세율·금액·날짜·연도를 코드에 넣지 마세요.** 화면 문구에도 넣지 않습니다. 전부 룰에서
   옵니다. 예외는 대표님이 승인한 문구뿐입니다(`RuleModeSelector`의 2027·2028·2029).
2. **룰이 없으면 0원이 아니라 멈춥니다.** 미등록을 0으로 대체하는 코드를 절대 쓰지 마세요.
3. **판정하지 못한 조건은 임의로 false 처리하지 않습니다.** 그 조건을 쓴 행을 후보에서 빼고
   사용자에게 밝힙니다.
4. **사용자가 직접 넣은 값이 자동 판정보다 우선합니다.**
5. **회귀 위험이 있으면 손대지 말고 보고하세요.** 건너뛴 항목보다 깨진 화면이 더 나쁩니다.
6. 파일은 300줄 이하. 초과 시 분리하되 계산 경로를 건드리는 분리는 승인 후에.
7. 모든 함수에 한국어 JSDoc.
8. 로컬 확인은 `npx next start -p 4123`(빌드 후). `npm run dev`는 쓰지 않습니다.
9. 작업이 끝나면 `git push origin main`까지 해야 끝난 것입니다.
10. 검증은 `npx tsc --noEmit` + `npm run build`. ESLint 설정이 없어 `next lint`는 쓸 수 없습니다.

---

## 11. 잔여 보류 항목

### 11-1. 파일 크기 초과 4건

| 파일 | 현재 | 기준 | 분리 후보 |
|---|---|---|---|
| `lib/tax/transfer.ts` | 774줄 | 승인 예외 748 | 비과세 판정 블록(취득 당시 규제 판정·고가주택 안분)을 `transfer-exemption.ts`로 |
| `lib/tax/transfer-rules.ts` | 389줄 | 승인 예외 380 | 장기보유특별공제 검증기 3종을 `transfer-rules-ltsd.ts`로 |
| `lib/tax/transfer-types.ts` | 301줄 | 300 (예외 없음) | `rule_value` 스키마 타입과 입력·결과 타입을 두 파일로 |
| `lib/tax/rule-store.ts` | 305줄 | 300 (예외 없음) | 규제지역 조회 2함수를 `regulated-store.ts`로 |

그 밖에 예외 목록에 없는 기존 초과: `rule-value.ts` 595줄, `comprehensive.ts` 458줄(승인),
`engine-types.ts` 414줄, `acquisition.ts` 355줄, `property.ts` 321줄, `rule-guides.ts` 308줄.
**전부 계산 경로라 배포 뒤 별도 작업으로 하시는 편이 안전합니다.**

### 11-2. 이번 점검에서 나온 Medium 이하 (수정하지 않음)

- **실수령액 폼의 거주기간 처리가 양도세 폼과 다름** — 양도세는 주택 수와 무관하게 항상
  받는데 실수령액은 1주택 트랙일 때만 받습니다. 거주기간 조건을 쓰는 행이 생기면 두 화면의
  결과가 갈립니다. 실수령액 폼에는 "거주기간 > 보유기간" 사전 가드도 없습니다(엔진이 막음).
- **취득세·등기비용 계산 이력에 부분 지정 근거가 안 남음** — 양도세·실수령액은 남깁니다.
  나중에 "왜 중과가 걸렸는지"를 되짚을 수 없습니다.
- **규제지역 관리 화면에 192행을 위한 수단이 없음** — 검색·필터·페이지네이션이 없고 삭제
  액션도 없습니다(`actions.ts`에 `saveTaxArea`만). 잘못 들어간 행을 UI에서 지울 수 없습니다.
- **제도 시행 이전 취득도 사용자에게 물음** — 조정대상지역 제도가 2016-11-03에 시작됐으므로
  그 이전 취득은 "취득 당시 조정대상지역"일 수 없는데 `before_coverage`로 분류돼 장기 보유
  1주택자가 예외 없이 추가 선택을 요구받습니다. 커버리지 룰에 제도 시행일 필드를 두는 방법이
  있습니다(날짜는 룰에).
- **규제지역 이력 저장에 감사 기록이 없음** — 이 표 한 행이 비과세 거주 요건을 가르는데 누가
  언제 `is_partial`을 바꿨는지 남지 않습니다(세금 계열 관리자 액션 전체의 기존 관례).
- **고가주택 안분 경로에 거주 요건 면제 근거를 남길 곳이 없음** — 전액 비과세 경로에는
  사유 한 줄이 들어가지만 안분 경로는 필드가 없습니다(잘못된 정보가 나가는 것은 아님).
- **아이콘 `aria-hidden` 누락** — 결과 패널 4종의 기존 아이콘들. 신규 컴포넌트는 준수.
- **`SELECT_CLS` 문자열이 4곳에 복제** — `AcquiredRegulatedField`·`TransferForm`·
  `NetProceedsForm`·`AreasManager`.

### 11-3. 미해결 · 확인 필요

- **세종특별자치시 해제일** — CSV는 `2016-11-03 ~ 2022-11-14`인데, 2022-11-14 조치에서는
  유지되고 2023-01-05에 해제된 것으로 보인다는 지적이 있었습니다(확신도 중간). 사실이라면
  2022-11-14 ~ 2023-01-04 취득분이 비규제로 잘못 판정됩니다. **원 공고 대조가 필요합니다.**
- **부분 지정 경고는 아직 화면에 도달하지 않습니다** — 오늘 시점에 유효한 이력 40건이 전부
  전체 지정이고, 취득세·양도 당시 중과는 최근 시점만 계산 가능하기 때문입니다. 코드는
  준비돼 있고 위험도 없습니다.
- **과거 시점 계산 범위** — 세목별로 룰이 등록된 가장 늦은 시작일이 그 세목의 계산 가능
  시점입니다: 인지세 2002-01-01 · 중개수수료 2021-10-19 · 종부세 2023-01-01 ·
  등기비용 2025-08-01 · 재산세 2026-01-01 · 양도세 2026-05-10 · 취득세 2026-06-01.
  그보다 이른 기준일은 "근거 미등록"으로 멈춥니다. 과거 신고용으로 쓰려면 과거 세율 룰을
  등록해야 합니다.
- **`tax_test_cases` 실행기가 없습니다** — 회귀 테스트가 자동화돼 있지 않아 검증은 브라우저
  실측에 의존합니다.

---

## 12. 새 세션이 처음 읽어야 할 파일 순서

1. **이 문서** — 전체 지도
2. `CLAUDE.md` — 프로젝트 규칙(한국어 전용·push까지가 완료 등)
3. `src/lib/tax/engine-types.ts` — 입력·결과·실패 코드의 공통 타입. 여기부터 봐야 나머지가 읽힙니다
4. `src/lib/tax/rule-store.ts` — 룰 조회·규제지역 판정. 모든 엔진이 여기를 거칩니다
5. `src/lib/tax/rule-value.ts` — 세율 행 매칭(`selectRateRow`)과 조건 판정 규칙
6. `src/lib/tax/acquisition.ts` — 가장 단순한 전체 엔진. 구조를 익히기 좋습니다
7. `src/lib/tax/transfer.ts` — 가장 복잡한 엔진. 비과세·중과·장기보유특별공제가 다 들어 있습니다
8. `src/lib/tax/transfer-regulated.ts` — 취득 당시 자동 판정
9. `src/app/tax/transfer/` 한 벌 — 화면 구조(page → form → actions → panel)
10. `src/app/admin/tax/rules/rule-guides*.ts` — 각 룰의 값 형식과 운영자 안내

---

*작성: 2026-08-16 · 기준 커밋 `d94593c` · 이전 인계서 전부 대체*
