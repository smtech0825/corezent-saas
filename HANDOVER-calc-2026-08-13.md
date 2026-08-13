# HANDOVER — 부동산 계산기 (취득세 S1·S1-W6 + 허브·인지세 S2)

> 작성: 2026-08-12 세션 종료 시점. 다음 세션이 이 문서만 읽고 이어서 작업할 수 있도록 작성함.
> 설계 문서: `prompts/feat-tax-s1-acquisition-engine.md`(S1) · `prompts/feat-tax-s1-w6-rule-fields.md`(조건 확장) · `prompts/feat-tax-s2-hub-and-stamp.md`(허브·인지세)
> 이전 인계서: `HANDOVER-tax-stage1.md`(S1 시점 — 본 문서가 최신 상태를 대체하되, S1 상세 배경은 그쪽 참조)

---

## 0. 현재 상태 요약

- **배포 완료(운영 동작 중)**: S1 취득세 계산기 전체 + S1-W6 조건 확장(면적 숫자·공시가격 재사용·수도권·과세표준 선택). 운영 DB에 취득세 룰 5종 + 공통(수도권) 룰 1종 등록·검증 완료(2026-08-12 운영 최종 확인 — 6개 항목 전부 통과).
- **로컬 커밋 대기(미푸시)**: S2 커밋 4개(§2) — /tax 허브·공유 레이아웃·인지세 계산기. **푸시 전에 058 SQL 적용이 선행 조건**(§3). 다른 세션 커밋과 인터리브될 수 있으니 푸시 전 `git log origin/main..HEAD`로 혼입 확인.
- **DB 적용 현황**: 055·056·057 운영 적용 완료(2026-08-12 확인, 재실행 금지 — 비멱등). **058은 파일만 존재(미적용)** — 미적용 상태로 S2를 배포하면 인지세 룰 저장이 원인 불명 문구("세금 룰 저장에 실패했습니다…")로 실패한다(CHECK 23514, 화면에 마이그레이션 단서 없음).
- **인지세 룰 0건(의도된 설계)**: stamp.rates를 관리자가 입력해야 인지세 계산이 동작. 등록 전에는 "룰 미등록" 안내(0원 아님)가 정상.
- **취득세 gift.heavy 룰 의도적 미등록**: 규제지역 증여(중과 판정 필요) 계산은 현재 "룰 미등록" 안내가 나온다. 증여 중과 경로를 열려면 acquisition.gift.heavy 등록 필요.

---

## 1. 파일 전체 목록과 역할

### 마이그레이션 (supabase/migrations/) — §3에 상세
- `055_tax_engine_schema.sql` · `056_tax_rules_no_overlap.sql` · `057_tax_rules_common_and_law_ref.sql` · `058_tax_types_add_calculators.sql`

### 계산 엔진·공용 (src/lib/tax/)
- `types.ts` — DB 5개 테이블 행 타입 수동 정의(자동 생성 안 씀). `TaxType`(10종)·`TaxRuleTaxType`(+common) 유니언.
- `labels.ts` — 세목 라벨·목록의 단일 출처. `TAX_TYPES`(6종 고정, 규제지역용)·`CALCULATOR_TAX_TYPES`(4종)·`RULE_TAX_TYPES`(11종, 룰 편집용)·상태/구분 라벨. §4 참조.
- `engine-types.ts` — 엔진 입력·결과·오류(§6)·rule_value 스키마 타입(취득세 + 인지세). 구조만 있고 숫자는 없다.
- `rule-store.ts` — `fetchValidRules`(세목+common 동시 로드, proposed 우선, RULE_CONFLICT 검출), `isRegulatedArea`, `requireRule`(없으면 RULE_NOT_REGISTERED — 0원 금지의 핵심), `COMMON_RULE_KEYS`, 날짜/지역코드 검증.
- `rule-value.ts` — rule_value 런타임 검증(parse* 8종)·세율 평가(`evaluateRateSpec` — linear_by_base 룰 지정 반올림 포함)·조건 매칭(`matchConditions` — 미확정 undefined 처리·모르는 필드 오류)·행 선택(`selectRateRow` — when·priority만 요구하는 제네릭, 0건/동률 오류)·간주 판정·단수 처리. ⚠️ 422줄(300줄 초과 — 분할 후보).
- `acquisition.ts` — 취득세 오케스트레이터. 유상/증여 분기, 간주, 중과, 과세표준 선택(choice), 미확정 수집(unresolvedFields), `ACQUISITION_RULE_KEYS`. ⚠️ `> 85` 비교 1곳은 승인된 예외(area_over_85 필드 이름 자체의 정의 — 주석 있음).
- `stamp.ts` — 인지세 엔진. 계약서 1통 기준 정액, 비과세(amount 0 + 사유), `STAMP_RULE_KEYS`.
- `regions.ts` — 전국 행정구역 이름 목록(규제 목록 아님) + `buildRegionCode`(이름 기반 '시·도|시·군·구'). 2026-08-12에 부천 3구·화성 4구(동탄구 포함) 반영(974d077).
- `calculators.ts` — 계산기 목록 단일 출처(§7). import 0개인 순수 데이터라 클라이언트·서버 공용 안전.

### 공개 화면 (src/app/tax/)
- `layout.tsx` — /tax 공유 레이아웃(테마·Navbar·Footer·허브 제목·전환 탭). 계산기 전환 시 유지되어 전체 리로드 없음(실측 검증 완료).
- `page.tsx` — /tax 허브: 분류별 계산기 목록, 준비 중은 링크 없이 표시.
- `_components/TaxNav.tsx` — 전환 탭(<Link> 클라이언트 네비게이션, aria-current 강조, 준비 중은 span).
- `acquisition/` — `page.tsx`(Hero·갱신일·고지) · `CalculatorForm.tsx`(입력·과세표준 선택 패널) · `ResultPanel.tsx`(세액 3분해·미확정 경고·근거) · `actions.ts`(BotID→검증→엔진→이력).
- `stamp/` — `page.tsx`(Hero·판단 한계 안내 3종·갱신일) · `StampForm.tsx`(계약일·계약금액·주택 여부) · `StampResultPanel.tsx`(세액·비과세 사유·근거) · `actions.ts`(BotID→엔진→이력, 확정법 고정).

### 관리자 (src/app/admin/tax/)
- `page.tsx`(/admin/tax → rules 리다이렉트) · `_components/TaxTabs.tsx`(룰↔규제지역 탭)
- `rules/` — `page.tsx`·`RulesManager.tsx`(세목 탭 11종·목록·RuleForm key 리마운트)·`RuleForm.tsx`(세목별 키 선택·안내·겹침 경고·법령 ID/조문번호)·`actions.ts`(필수값·스키마 검증·**KEY_REQUIRED_TAX_TYPE**(알려진 키의 세목 강제)·EXCLUDE 한국어 안내)·`rule-guides.ts`(룰 키별 입력 안내·스켈레톤 — «...» 자리표시자, 실무 계약 문서).
- `areas/` — 규제지역 이력 입력(계산기와 같은 regions.ts·buildRegionCode 재사용).

### 수정된 기존 파일
- `src/app/admin/_components/AdminSidebar.tsx` — '세금 룰' 링크.
- `src/instrumentation-client.ts` — BotID 보호: `/tax/acquisition`·`/tax/stamp` POST.
- `src/app/sitemap.ts` — /tax + 사용 가능한 계산기만(calculators.ts 필터).
- `src/components/Navbar.tsx` — '부동산 계산기' 메뉴.

---

## 2. 커밋 해시 전부 (시간순)

**S1 (2026-08-11, 배포 완료)**
`ca30d39`(055+타입) → `170b458`(056) → `0a814d8`(엔진) → `1f95108`(계산기 화면) → `d810d88`(관리자) → `e3d5341`(점검 High 4) → `8bb3c21`(인계서)

**행정구역 (2026-08-12, 배포 완료)**
`974d077` — 경기 목록 최신화(부천 원미·소사·오정 3구, 화성 만세·효행·병점·동탄 4구)

**S1-W6 조건 확장 (2026-08-12, 배포 완료)**
`3969513`(Wave 1: area_sqm·official_price·is_metro·미확정 처리 + 057) → `d7be8a2`(Wave 2: 과세표준 선택) → `23c1455`(Wave 3: 화면) → `0413fa0`(Wave 4: 관리자 안내) → `f19668c`(Wave 5: High 3 — 공통 탭·RuleForm key·문서 정리)

**S2 허브·인지세 (2026-08-12, ⚠️ 로컬 미푸시)**
`84dfb56`(Wave 1: 세목 4종 + 058) → `c9b4d76`(Wave 2: /tax 허브·레이아웃) → `f21da77`(Wave 3: 인지세) → `0c90442`(Wave 4: High 1 — 룰 키·세목 강제)
(+ 본 인계서 커밋)

---

## 3. DB — 테이블 5개, 마이그레이션 055~058

테이블(전부 본체 Supabase, `tax_` 접두어): **tax_rules**(룰 저장소 — rule_value jsonb·시행기간·status·법령 근거 NOT NULL·law_id/law_article_no(057)·RLS 공개 SELECT) / **tax_regulated_areas**(규제지역 이력 — applies_to는 세목 6종+all만, 공개 SELECT) / **tax_test_cases**(실행기 없음, service_role 전용) / **tax_calculation_logs**(계산 이력, PII 금지, service_role 전용) / **tax_law_change_queue**(다음 단계용, 빈 테이블).

- **055** (적용 완료): 테이블 5개 + RLS + 인덱스 + updated_at 트리거. 시드 0건.
- **056** (적용 완료): btree_gist + EXCLUDE — 같은 (tax_type, rule_key, status)의 시행 기간 겹침 DB 차원 차단. status 다르면(확정 vs 개정안) 허용이 의도.
- **057** (적용 완료): tax_rules CHECK에 'common' 추가(7종) + law_id·law_article_no(법제처 6자리, 형식 CHECK) 컬럼.
- **058** (**미적용**): tax_rules CHECK 11종(common 유지 + stamp·brokerage·jeonse_conversion·registration), tax_calculation_logs CHECK 10종(common 없음). tax_regulated_areas·tax_test_cases는 의도적으로 불변. **S2 푸시 전에 SQL Editor에서 1회 실행**(각 파일 말미 회귀 검증 SQL 있음). 전부 비멱등 — 재실행 금지.

---

## 4. 세목 타입 체계 — 왜 두 갈래인가

- `TaxType`(types.ts): 10종 유니언 = 세목 6종(acquisition·rental·transfer·property·comprehensive·inheritance) + 계산기 4종(stamp·brokerage·jeonse_conversion·registration). tax_rules·tax_calculation_logs의 058 CHECK와 일치.
- `TaxRuleTaxType` = TaxType | 'common'. 'common'은 여러 세목이 공유하는 룰(region.metro_scope)의 자리 — 특정 세목에 묻으면 다른 세목 조회에서 빠지기 때문. `fetchValidRules`는 어떤 세목을 조회하든 'common'을 항상 함께 로드한다.
- **`TAX_TYPES` 배열은 6종 고정**(labels.ts) — 규제지역 화면 체크박스와 applies_to 서버 검증이 이 배열을 쓰는데, tax_regulated_areas.applies_to CHECK에는 계산기 세목이 없다. 여기에 stamp 등을 추가하면 "선택지는 보이는데 저장은 거부되는" 상태가 된다. **절대 합치지 마라**(labels.ts에 사유 주석 있음).
- `RULE_TAX_TYPES` = TAX_TYPES + CALCULATOR_TAX_TYPES + 'common' (11종) — 룰 편집 화면·검증 전용.
- 저장 안전장치: `KEY_REQUIRED_TAX_TYPE`(admin rules/actions.ts) — 알려진 룰 키는 정해진 세목으로만 저장 허용. **새 룰 키를 만들면 반드시 이 매핑에도 추가하라**(빠뜨리면 "저장은 되는데 계산기는 룰 미등록" 함정 재발).

---

## 5. 룰 키 전체와 rule_value 형식

형식 안내·스켈레톤의 단일 출처는 `admin/tax/rules/rule-guides.ts`(화면에 표시), 검증기는 `lib/tax/rule-value.ts`(엔진과 저장이 같은 검증기 공유). 값(숫자)은 전부 관리자 입력 — «...» 자리표시자를 안 바꾸면 JSON 파싱 실패로 저장 거부.

**취득세 (tax_type='acquisition') — 운영 등록 완료 5종 + 미등록 1종**
1. `acquisition.onerous.rates` — 유상 세율표 `{rows:[{when, priority?, rates:{acquisition,local_education,rural_special}, credit?}]}`. RateSpec: `fixed`(ratePercent) 또는 `linear_by_base`(per·slope·intercept·min/maxPercent·**rounding{decimals,method}** — 산식 결과 세율%의 소수점 처리, 룰 지정). 조건 필드: price·house_count·is_regulated·area_sqm·official_price·is_metro·first_home·temporary_two_home·area_over_85(호환용).
2. `acquisition.gift.tax_base` — `{base, choice?:{basis:'price'|'market_value'|'official_price', maxAmount, options}}`. choice 구간이면 납세자 선택(화면은 엔진 응답 giftTaxBaseChoice로만 판단).
3. `acquisition.gift.rates` — 증여 세율표(조건: tax_base·house_count·is_regulated·donor_relation·area_sqm·official_price·is_metro·area_over_85).
4. `acquisition.gift.heavy` — **미등록(의도)**. `{officialPriceMin, rows}`. 조정대상지역+공시가격≥기준이면 적용, 증여자 1주택 제외.
5. `acquisition.gift.deemed_gift_threshold` — `{mode:'any'|'all', minDiffAmount?, minDiffRatioPercent?}`.
6. `acquisition.rounding` — `{unit, method}` 세액 단수 처리(미등록 시 1원 버림). 운영 등록: unit 10·floor.

**공통 (tax_type='common') — 운영 등록 완료**
7. `region.metro_scope` — `{sidoNames:[...]}`. is_metro 판정의 유일한 출처. 없으면 is_metro 미확정 → 해당 조건 행 매칭 안 됨(임의 false 금지). 운영 값: 서울특별시·인천광역시·경기도(수도권정비계획법 §2①+시행령 §2 — law.go.kr 원문 확인 완료).

**인지세 (tax_type='stamp') — 미등록, 058 적용 후 입력**
8. `stamp.rates` — `{rows:[{when, priority?, amount(원·정액), exemptReason?}]}`. 조건 필드: price(계약금액)·is_housing. 비과세 행은 amount 0 + exemptReason 필수(사유 없는 0원 저장 거부), 세액 있는 행에 exemptReason 금지. 계약서 1통 기준.

공통 규칙: when 연산자 eq/min/max/in(경계 포함), 동시 매칭은 priority 최고 1건(동률 오류), 모르는 필드명은 계산 중단, 미확정(undefined) 값 조건 행은 매칭 안 되고 unresolvedFields로 결과에 표시.

---

## 6. 엔진 오류 코드 (engine-types.ts `TaxEngineErrorCode`)

`INVALID_INPUT`(입력 오류·BotID 차단·목록 밖 소재지) / `RULE_NOT_REGISTERED`(**그 시점 룰 없음 — 절대 0원 대체 금지, 이 서비스의 핵심 안전장치**) / `RULE_CONFLICT`(같은 키 유효 룰 2건+ — 조용히 안 고르고 중단) / `RULE_VALUE_INVALID`(룰 값 구조 오류·모르는 조건 필드/연산자) / `NO_MATCHING_RATE_ROW`(조건에 맞는 행 없음 — 미확정 필드 힌트 포함 가능) / `AMBIGUOUS_RATE_ROW`(priority로도 1건 확정 불가) / `DB_ERROR`. 모든 message는 화면에 그대로 보여줄 한국어 문장.

---

## 7. 계산기 목록 관리와 새 계산기 추가 절차

단일 출처 `lib/tax/calculators.ts` — {slug, path, name, description, category(buy/hold/sell/inherit/rent), available}. 허브 카드·전환 탭(TaxNav)·사이트맵이 전부 이 목록을 읽는다. available:false는 "준비 중" 표시만 되고 링크·사이트맵에서 제외.

새 계산기(예: 중개수수료) 추가 절차:
1. rule_value 타입(engine-types.ts) + 검증기 parse*(rule-value.ts — selectRateRow·matchConditions 재사용, 새 조건 방식 금지)
2. 엔진 lib/tax/<이름>.ts (fetchValidRules(세목)·requireRule — 룰 없으면 0원 금지) + 룰 키 상수
3. 화면 app/tax/<경로>/ — page(메타데이터·Hero·고지·갱신일)·폼·결과패널(근거 표시 취득세 형식)·actions(BotID→엔진→이력)
4. instrumentation-client.ts에 POST 경로 등록
5. 관리자: rule-guides.ts 안내(«...» 자리표시자) + knownKeysForTaxType 분기 + rules/actions.ts VALUE_VALIDATORS·**KEY_REQUIRED_TAX_TYPE** 등록
6. calculators.ts available:true — 허브·탭·사이트맵 자동 반영 (⚠️ path와 실제 폴더명 일치 확인 — jeonse_conversion은 slug 언더스코어 vs path 하이픈 '/tax/jeonse-conversion')
7. 세목이 이미 058 CHECK에 있으므로 추가 마이그레이션 불필요(4종 한정). 새 세목이 더 필요하면 tax_rules·tax_calculation_logs 두 CHECK 확장.

---

## 8. 다음 세션이 반드시 지켜야 할 원칙

1. **세율·세액·공제·구간·기준액·수도권 목록·규제지역 목록을 코드·마이그레이션·시드·안내 문구에 절대 넣지 않는다.** 학습 데이터로 기억하는 값도 금지. «...» 자리표시자 방식 유지. 승인된 예외는 acquisition.ts의 `> 85` 1곳(필드 이름 정의)과 입력 placeholder 예시 금액뿐.
2. **룰이 없으면 0원 금지** — RULE_NOT_REGISTERED 구조를 약화시키지 않는다. 비과세도 사유 없이 0원 불가(stamp).
3. **Wave 방식**: Wave 끝마다 `npx tsc --noEmit` + `npm run build` 통과 → 변경 파일만 **개별 git add**(`git add .` 금지) → 커밋 → 멈추고 보고. 승인 전 다음 Wave 금지. **푸시는 명시 지시가 있을 때만.**
4. **다른 세션의 미커밋 변경·커밋 불가침.** 푸시 전 `git log origin/main..HEAD`로 혼입 확인, 섞여 있으면 멈추고 보고. (병행 세션이 자기 작업을 푸시하며 이쪽 커밋이 함께 나간 전례 2회 — 배포 타이밍이 중요하면 대표님께 미리 알릴 것.)
5. **region_code는 이름 기반**('시·도|시·군·구', 세종은 시·도 그대로). 계산기·관리자 입력이 같은 함수(buildRegionCode)를 쓰는 구조 유지. regions.ts에 지역 추가 시 기존 DB 행 코드와의 정합 확인.
6. **TAX_TYPES(6종)와 RULE_TAX_TYPES(11종)를 합치지 마라**(§4). 새 룰 키는 KEY_REQUIRED_TAX_TYPE에 등록.
7. 검증: `next lint` 불가(ESLint 설정 없음) — tsc+build. `.next`는 병행 세션과 공유(캐시 오류 시 삭제 후 재빌드). 마이그레이션 비멱등 — 운영 재실행 금지.
8. CLAUDE.md 공통 규칙(한국어 JSDoc·300줄·any 금지·@theme 토큰·보고 전부 한국어) 준수.

---

## 9. 미해결·미수정 항목 전체

**즉시 운영 절차 (코드 아님)**
- 058 SQL 적용 → S2 푸시(혼입 확인 후 승인) → 관리자에서 stamp.rates 등록 → /tax/stamp 실계산 확인(S2 완료 판정 6 후반·7 잔여분).
- 증여 중과를 열려면 acquisition.gift.heavy 등록.
- 배포 후 tax_rules에 세목 오등록 행이 없는지 1회 확인(가드는 저장 시점만 검사 — 기존 행 소급 안 됨).

**Medium (보고만 된 것 — 우선순위 상위)**
1. 058 미적용 시 룰 저장 실패가 원인 불명 문구 — error.code 23514를 "마이그레이션 미적용" 안내로 분기 권장.
2. parseStampRates가 amount 비정수 허용(35000.5원 표시 가능, 0.4는 비과세 판정도 빠짐) — Number.isInteger 추가 권장.
3. 룰 저장 성공 후 목록 탭이 저장 세목으로 전환 안 됨 — "저장됐는데 안 보임" 혼란.
4. 같은 rule_key가 common과 계산 세목에 동시 존재하면 RULE_CONFLICT 오탐(안내문은 기간 정리로 오도) + 세목 전용 키를 common으로 저장하는 역방향 무방비 — byKey를 tax_type|rule_key로, saveTaxRule 역방향 가드 권장.
5. 취득세: 유상 분기에서 giftTaxBaseChoice 조용히 무시 / 입력 변경 후 이전 결과·선택 패널 잔존(stale) — S1-W6부터 이월.
6. 계산 액션 rate limit 부재(BotID fail-open 단독, service_role 이력 무제한 INSERT — 공개 계산기 2개로 표면 확대). tax_calculation_logs 보존 정책도 없음.
7. 규제지역 이력 겹침 방어 없음(S1부터 이월 — 해제일 안 닫으면 계속 규제 판정).
8. OG 이미지 부재(/tax·/tax/stamp 포함 전 공개 페이지) — buildPageMetadata 전역 폴백 권장.
9. 300줄 초과: rule-value.ts 422 / Navbar.tsx 379 / acquisition.ts 352 / CalculatorForm.tsx 325.

**Low (요지)**
058 비멱등(IF EXISTS 없음) · /tax 허브 force-dynamic 없음(Footer front_settings가 빌드 시점 고정 — /contact와 동일 기존 패턴) · TaxNav 활성 판정 정확 일치(하위 경로 생기면 startsWith 보완) · jeonse slug/path 표기 불일치 · 갱신일이 repealed 룰 포함 · StampResultPanel 불필요 'use client' · rule-guides가 엔진 모듈에서 값 import(룰 키 상수 분리 권장) · 조건값 타입 오타(`"eq":"true"`) 조용히 불일치 · matchConditions 타입 검사 부재 · unresolvedFields에 basis 값 혼입 가능·면적 라벨 중복 · when 오타가 저장 시 안 걸리고 계산 때 터짐(드라이런 권장) · 음수 priority 미정의 · todayString 클라이언트 타임존 · 아이콘 직접 import·text-[11px](전역 관례) · 룰 0건 상태로 사이트맵 제출 · TaxTestCase 타입이 DB CHECK(6종)보다 넓음(실행기 도입 때 정리).

**다음 Stage 후보(설계 문서 제외 범위)**: 중개수수료·전월세 전환·등기비용 계산기(자리 확보됨) · 법제처 OPEN API 개정 감시(law_id·law_article_no·tax_law_change_queue 준비됨) · 회귀 테스트 실행기(tax_test_cases) · 연도별 비교 UI.

---

## 9-2. S3(중개수수료)·S4(양도소득세) 미해결 항목 — 2026-08-13 점검분, 기록만(수정 보류)

> S3·S4 진행 경과는 메모리·커밋 로그 참조. 중개수수료는 운영 개시됨, 양도소득세는 코드 완성·available:false(룰 값 대기).
> Wave 6 점검의 High는 전부 수정·재검사 해결(aa5a6fa). 비교과세 배지 오표시·미래 날짜 미검증 2건도 수정 완료. 아래는 대표님 지시로 보류된 잔여분.

**Medium (보고만 — S4 양도소득세)**
1. 장기보유특별공제율 합계 100% 초과 미방어 — 관리자 오입력 시 taxableGain 음수→세액 0원 가능(transfer.ts 공제 합산부). 클램프 또는 RULE_VALUE_INVALID 권장.
2. 중과 대상자가 경과조치 미입력이면 unresolved 'grace_contract' 상시 경고 — 입력란은 고급 접힘 속이라 대다수 다주택자에게 경고 노출. 경고/안내 분리 또는 중과 시 자동 펼침 권장.
3. 기준일 배너(RuleBasisBanner)가 confirmed+proposed를 함께 집계 — 계산은 확정법 고정이라 기준 불일치 가능(개정안 시행일이 대표값으로 뽑힘). rule_key 중복 미제거로 "적용 룰 N건"이 실제와 다를 수 있음. 같은 키·시행일 쌍이면 React key 중복 경고.
4. 양도차손(차익≤0) 0원의 사유가 결과 카드 상단에 없음 — 판정 내역(ltsdReason)에만 존재. 전용 사유 필드 권장.
5. 중과 적용 전제(2주택 이상+양도 당시 조정지역)가 코드 게이트(transfer.ts) — is_regulated·house_count가 조건 필드로 제공되는데 코드가 먼저 차단. rule-guides의 heavy 안내(is_regulated 조건 사용 가능)와 불일치 — 게이트 제거 또는 안내 정리 필요(code-guardian 동일 지적).
6. TransferForm.tsx 300줄 초과(수정 후 330줄대) — 고급 항목 블록 분리 후보. transfer.ts 552줄은 대표님 승인 예외(계산 흐름 한 파일 유지 우선).

**Low (요지 — S4)**
거주>보유 차단이 상속주택에서 과차단 가능(상속 전 동거 기간 입력 시 — 메시지에 상속 기산 안내 권장) · checkRatePositive가 linear_by_base 미커버(양도세 미사용 형태) · progressive 누진공제가 구간 세액 초과 시 0원 경로(Math.max 0) · 단기표 안내의 연수 예시(eq 0/1)가 가이드에 고정 · NaN 컨텍스트의 min/max 매칭 방어 부재(현재 isValidDateString으로 도달 불가) · 경과조치 미매칭/계약금 false 때 사유 문구 없음 · 국세·지방이 transfer.rounding 하나 공유 · 취득세 페이지 머리 주석 낡음(갱신일 줄 제거 미반영) · 인지세·중개수수료 배너 taxTypes에 common 없음(현재 미사용이라 무해) · '손에 쥐는 돈' 라벨이 세후 차익 의미 · 기본공제 연 1회 합산 한계 안내 부재 · 룰 조회가 rule-store 우회하는 표시용 쿼리 2곳(배너·경과조치 마감일 — RULE_CONFLICT 시 화면과 엔진 불일치 가능) · AreasManager 소형 함수 JSDoc 누락 · 아이콘 직접 import(tax 영역 전체 관례 — 일괄 전환 별도 작업).

**S3 잔여(중개수수료 — 운영 중)**
구간 경계 안내는 min+priority로 해소됨. 전세(월세 0) 환산 표시 오해·단수 처리 코드 고정(Math.floor)·거래금액 0원 허용·매매 결과에 입력 금액 미표기 등은 이전 보고분 그대로 보류.

**참고(설계 인지 사항)**
- heavy 룰 미등록과 법정 유예를 시스템이 구분하지 못함(둘 다 "중과 미적용 + 사유") — 의도된 설계.
- 규제지역 이력 0건 지역은 "비규제"로 단정 표시 — 이력 미등록과 구분 표시 검토 여지.
- 양도세 열기 전 체크: 룰 11종 등록 → 검산 → calculators.ts available:true(noindex 자동 해제).

---

## 10. 새 세션이 처음 읽어야 할 파일 순서

1. **이 파일** (HANDOVER-calc-2026-08-13.md)
2. `prompts/feat-tax-s2-hub-and-stamp.md` — 최근 설계 문서(Strict Rules·완료 판정). 취득세 배경이 필요하면 `HANDOVER-tax-stage1.md`와 S1·W6 설계 문서.
3. `src/lib/tax/types.ts` → `labels.ts` — 세목 타입 체계(§4의 실물).
4. `src/lib/tax/engine-types.ts` — 전체 계약(입력·결과·rule_value 스키마). 이어서 `rule-store.ts` → `rule-value.ts` → `acquisition.ts` → `stamp.ts` 순서로 엔진 흐름.
5. `src/lib/tax/calculators.ts` → `src/app/tax/layout.tsx` → `_components/TaxNav.tsx` — 허브·전환 구조.
6. `src/app/tax/stamp/actions.ts` → `StampForm.tsx` → `StampResultPanel.tsx` — 최신 계산기의 화면-서버 경계(새 계산기의 본보기).
7. `src/app/admin/tax/rules/rule-guides.ts` → `rules/actions.ts` — 관리자 입력 계약과 저장 안전장치(KEY_REQUIRED_TAX_TYPE).
8. `supabase/migrations/055~058` — 데이터 구조·RLS·CHECK의 역사.
