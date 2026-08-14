# HANDOVER — 부동산 세금계산기 (S1 취득세 ~ S4 양도소득세)

> 작성: 2026-08-13 세션 종료 시점. 다음 세션이 이 문서만 읽고 이어서 작업할 수 있도록 작성함.
> 이전 인계서 `HANDOVER-calc-2026-08-13.md`를 대체한다(그쪽 §9-2의 보류 목록은 본 문서 §10에 통합).
> 설계 문서: `prompts/feat-tax-s1-acquisition-engine.md` · `feat-tax-s1-w6-rule-fields.md` · `feat-tax-s2-hub-and-stamp.md` · `feat-tax-s3-brokerage-and-conversion.md` · `feat-tax-s4-transfer.md`
> 룰 값 등록 지시서(값의 원본): `prompts/중개수수료-룰-등록.md` · `prompts/양도소득세-룰-등록.md` (인지세 값은 2026-08-13 채팅으로 수령)

---

## 0. 현재 상태 요약

- **운영 중 계산기 4종**: 취득세(/tax/acquisition) · 인지세(/tax/stamp) · 중개수수료(/tax/brokerage) · 양도소득세(/tax/transfer). 전부 아파트 전용(공용 배너로 고지). 등기비용은 '준비 중'(페이지 없음), 전월세 전환은 영구 취소(목록에서도 제거).
- **룰 20종 운영 등록**(§5): 취득세 5 + 공통 1 + 인지세 1 + 중개수수료 2 + 양도세 11. 전부 confirmed. 검산 전부 통과(인지세 5건·중개수수료 5건·양도세 5건).
- **마이그레이션 055~059 전부 운영 적용 완료**(§3). 규제지역 40행은 applies_to=['acquisition','transfer'] + note 메모 완료.
- 2026-08-13 마지막 푸시(8bcd9de)로 양도세 개방 포함 전부 배포됨. 배포 직후 확인 절차(§0-1)가 남았으면 먼저 수행.
- 미등록으로 남긴 것: acquisition.gift.heavy(증여 중과 — 등록해야 규제지역 증여 계산이 열림).

### 0-1. 세션 인계 시점의 미완 확인(있다면)
- ~~양도세 개방 배포 후 실화면 확인~~ → **2026-08-14 완료**. 운영(www.corezent.com) 브라우저 확인: 허브 '팔 때' 분류·전환 탭·사이트맵(/tax/transfer) 노출 정상. 검산 5번 케이스(1주택·취득 2016-01-01·양도 2026-08-14·거주 2년·5억→15억·부산 해운대구 비조정) 실화면 계산 — 합계 22,093,500원(양도세 20,085,000+지방세 2,008,500)·공제 48%(보유 40+거주 8)·큰 표 판정 표시·고가주택 초과분 안분·비규제 자동 판정·법령 근거 7건 전부 기대값 일치. 기준일 배너도 정상(시행 2026-05-10까지·갱신 2026-08-13·룰 12건). 첫 클릭 씹힘 증상 재현됨(§9-5 좌표 재클릭으로 해결).

---

## 1. 파일 전체 목록과 역할

### 마이그레이션 (supabase/migrations/) — §3 상세
`055_tax_engine_schema.sql` · `056_tax_rules_no_overlap.sql` · `057_tax_rules_common_and_law_ref.sql` · `058_tax_types_add_calculators.sql` · `059_tax_regulated_areas_note.sql`

### 계산 엔진·공용 (src/lib/tax/)
- `types.ts` — DB 5개 테이블 행 타입 수동 미러. `TaxType`(10종)·`TaxRuleTaxType`(+common). 059의 note 포함.
- `labels.ts` — 세목 라벨·목록 단일 출처. **TAX_TYPES(6종 고정 — 규제지역용)와 RULE_TAX_TYPES(11종 — 룰 편집용)를 절대 합치지 마라**(파일에 사유 주석).
- `engine-types.ts` — 공통 엔진 타입: RateSpec(fixed·linear_by_base·**progressive**)·Conditions·AppliedRuleInfo·오류 코드 + 취득세·인지세·중개수수료 입출력·rule_value 스키마. (⚠️ 389줄 — 양도세 타입은 별도 파일)
- `transfer-types.ts` — 양도세 전용: 입출력·rule_value 스키마 11종. 4대 구분 주석 포함.
- `rule-value.ts` — 공용 검증·평가: checkRateSpec(export — progressive 포함)·evaluateRateSpec·matchConditions·selectRateRow·**selectRateRowOptional**(0건=미적용 의미의 표용)·parse* (취득세 6종+stamp+brokerage 2종+metroScope). (⚠️ 600줄대 — 분할 후보)
- `transfer-rules.ts` — 양도세 룰 키 상수(TRANSFER_RULE_KEYS 11종)·parse* 10종·checkRatePositive(세율 0% 거부 — 양도세 전용 강화).
- `rule-store.ts` — fetchValidRules(세목+common 동시 로드·proposed 우선·RULE_CONFLICT)·requireRule(0원 금지의 핵심)·isRegulatedArea(세목·기준일별 규제지역 판정)·COMMON_RULE_KEYS·검증 헬퍼.
- `period.ts` — 연수·기한 계산: fullYearsBetween(초일 산입은 **인자, 기본값 없음** — 룰이 정함)·holdingYearsForRate(§104②)·holdingYearsForLtsd(§95④ — 이름으로 분리 강제)·isOnOrBeforeAnniversary(연 기한)·isOnOrBeforeMonthsAfter(개월 기한 — 경과조치용, 말일 보정).
- `acquisition.ts` — 취득세 엔진(352줄 — 승인 예외). `> 85` 1곳은 필드명 정의(승인 예외).
- `stamp.ts` — 인지세 엔진. `brokerage.ts` — 중개수수료 엔진(상한액 — 세금 아님).
- `transfer.ts` — 양도세 엔진(**552줄 — 대표님 승인 예외**: 거주 요건 2종·판정 시점 2종의 혼용을 막기 위해 계산 흐름을 한 파일에 유지. 나누지 말 것).
- `regions.ts` — 행정구역 이름 목록(규제 목록 아님)·buildRegionCode('시·도|시·군·구')·isKnownRegion·isKnownSido.
- `calculators.ts` — 계산기 목록 단일 출처(§7).

### 공개 화면 (src/app/tax/)
- `layout.tsx` — 공유 레이아웃(테마·Navbar·Footer·전환 탭). `page.tsx` — 허브(빈 분류는 렌더 안 함).
- `_components/TaxNav.tsx` — 전환 탭. `_components/ApartmentOnlyNotice.tsx` — 아파트 기준 공용 배너(4계산기 공통). `_components/RuleBasisBanner.tsx` — 기준일 배너(§8).
- `acquisition/` `stamp/` `brokerage/` `transfer/` — 각각 page(메타·Hero·판단 한계·고지)·폼·결과패널·actions(BotID→검증→엔진→이력). transfer 폼은 oneHouseTrack(1주택 또는 일시적 2주택)으로 거주기간·취득 당시 조정 여부를 노출·필수 검증. transfer page는 heavy 룰의 grace.contractDeadline을 읽어 경과조치 안내 날짜를 자동 표시.

### 관리자 (src/app/admin/tax/)
- `rules/` — RulesManager(세목 탭 11종)·RuleForm(키 선택·안내·법령 ID/조문번호)·actions.ts(**VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE — 새 룰 키는 반드시 양쪽 등록**)·rule-guides.ts(+`rule-guides-transfer.ts` — 양도세 안내 분리 파일, RULE_GUIDES에 병합).
- `areas/` — 규제지역 이력(계산기와 같은 regions.ts 재사용, 059 메모 입력칸 포함).

### 기타
- `src/instrumentation-client.ts` — BotID 보호: /api/contact·/api/auth/check-email(+병행 세션의 /api/quote)·**/tax/acquisition·stamp·brokerage·transfer POST**.
- `src/app/sitemap.ts` — /tax + available 계산기만.

---

## 2. 커밋 해시 전부 (시간순)

**S1·S2 (기존 인계서와 동일)**: S1 `ca30d39→170b458→0a814d8→1f95108→d810d88→e3d5341→8bb3c21` / 행정구역 `974d077` / S1-W6 `3969513→d7be8a2→23c1455→0413f a0→f19668c`(0413fa0) / S2 `84dfb56→c9b4d76→f21da77→0c90442→0e90a1a`

**S3 중개수수료 (2026-08-13, 배포·운영 개시 완료)**
`b9dac85`(Wave 1: 엔진·화면·검증기) → `b4ee930`(Wave 1.5: 아파트 공용 배너·중개사무소 소재지 문구) → `c18bccf`(Wave 4: 전월세 제거+안내 2종) → `128d8f8`(Wave 5 High: 요율·한도·부가세 0 차단) → `8885a7c`(구간 min+priority 요령·noindex·중복 안내 정리) → `48ee8f1`(개시 available:true)

**S4 양도소득세 (2026-08-13, 배포·운영 개시 완료)**
`b5e5f00`(Wave 1: progressive·period.ts) → `f7ded76`(059+관리자 메모칸) → `8b549a3`(Wave 2: 엔진·룰 11종) → `bf6e086`(Wave 3: 화면) → `7b6b870`(Wave 4: 기준일 배너+경과조치 날짜 룰 연동) → `2ca6a74`(하단 갱신일 줄 제거 — 배너로 단일화) → `a0172f4`(Wave 5: 관리자 안내 11종) → `aa5a6fa`(Wave 6 High 3건: 일시적 2주택 입력·큰 표 §154① 전제·세율 0% 차단) → `a0c9aed`(비교과세 경로 정확 표시·미래 날짜 차단) → `60ab3b5`(구 인계서 §9-2 기록) → `8bcd9de`(개시 available:true)

---

## 3. DB — 테이블 5개, 마이그레이션 055~059 (전부 운영 적용 완료·비멱등·재실행 금지)

테이블(본체 Supabase, tax_ 접두어): **tax_rules**(룰 저장소 — rule_value jsonb·시행기간·status·법령 근거 NOT NULL·law_id/law_article_no·공개 SELECT) / **tax_regulated_areas**(규제지역 이력 — applies_to 세목 6종+all, **note**(059)·공개 SELECT) / **tax_test_cases**(실행기 없음) / **tax_calculation_logs**(계산 이력·PII 금지·service_role 전용) / **tax_law_change_queue**(비어 있음 — 다음 단계용).

- 055: 테이블 5개+RLS+인덱스. 056: EXCLUDE — 같은 (tax_type,rule_key,status) 시행기간 겹침 차단. 057: CHECK에 'common'+law_id·law_article_no. 058: CHECK 확장 — tax_rules 11종·logs 10종. 059: tax_regulated_areas.note(nullable) — 적용 한계·일부 동·읍·면 한정 지정 기록용.
- 규제지역 40행(서울 25구+경기 15곳, adjustment): applies_to=['acquisition','transfer'], note에 "양도 당시 판정 전용 — 취득 당시 판정에는 과거 이력이 없어 사용 불가" 취지 기록(2026-08-13).

---

## 4. 세목 타입 체계

`TaxType` 10종 = 세목 6종(acquisition·rental·transfer·property·comprehensive·inheritance) + 계산기 4종(stamp·brokerage·jeonse_conversion·registration). `TaxRuleTaxType` = +'common'. **TAX_TYPES 배열은 6종 고정**(규제지역 applies_to CHECK와 일치 — 계산기 세목을 넣으면 "보이는데 저장 거부"). RULE_TAX_TYPES 11종은 룰 편집 전용. jeonse_conversion은 계산기 취소 후에도 타입·CHECK·관리자 세목 탭에 잔존(무해 — 정리는 선택).

---

## 5. 등록된 룰 전체 (20종 — 전부 confirmed·종료일 없음, 2026-08-13 DB 조회 기준)

**acquisition (5)**: onerous.rates(2026-06-01) · gift.tax_base(2023-01-01) · gift.rates(2011-01-01) · gift.deemed_gift_threshold(2026-06-01) · rounding(2011-01-01). **gift.heavy는 의도적 미등록**.
**common (1)**: region.metro_scope(2008-03-21) — 수도권 시·도 목록. is_metro 판정 유일 출처.
**stamp (1)**: stamp.rates(2002-01-01) — 정액 세액표+비과세 행(amount 0+exemptReason 필수).
**brokerage (2)**: brokerage.rates(2021-10-19 — 요율표+leaseConversion 환산) · brokerage.vat(2021-10-19).
**transfer (11)**: base_rates·short_term_rates·ltsd.general·ltsd.one_house·basic_deduction·exemption·local_income_tax·period_rule·rounding(전부 2023-01-01) · temporary_two_house(2023-02-28) · **heavy(2026-05-10 — 중과 재개일. 유예 기간은 룰 부재로 표현. grace: 마감 2026-05-09·강남/서초/송파/용산 4개월·그 외 6개월·최종 2026-11-09)**.

**rule_value 형식의 단일 출처는 `rule-guides.ts`+`rule-guides-transfer.ts`(화면 표시)이고 검증기는 rule-value.ts·transfer-rules.ts**(엔진·저장 공유). 요지:
- 세율표 행 공통: `{when, priority?, ...}` — when은 eq/min/max/in(경계 포함), 동시 매칭은 priority 최고 1건(동률 오류), 모르는 필드는 중단, 미확정(undefined) 값 조건 행은 매칭 안 되고 unresolvedFields로 표시.
- **구간 표현 요령**: 금액 구간은 max 금지 — **min("이상")+priority 오름차순**(경계 충돌 없음). 연수는 만 연수 정수라 eq 또는 min. 누진(progressive)은 brackets의 minBase 오름차순.
- RateSpec 3형: fixed{ratePercent} / linear_by_base{per·slope·intercept·min/maxPercent·rounding} / **progressive{brackets:[{minBase?,ratePercent,progressiveDeduction}]}** — 세액=과세표준×세율%−누진공제(음수→0).
- 0 저장 거부 목록: brokerage 요율·한도·부가세, transfer 세율(기본·단기·지방)·가산 %p·공제율·기본공제, stamp의 사유 없는 0원. (취득세 fixed 0%는 허용 — 농특세 0% 행이 정당)
- transfer.heavy.grace: contractDeadline(YYYY-MM-DD)+rows(지역 조건별 monthsFromContract 정수)+finalDeadline?. 화면 안내 날짜는 이 값을 자동으로 읽음.
- transfer.local_income_tax: rate+shortTerm.rows+heavyRows — **국세가 단기·중과 경로인데 지방 대응 표 없으면 계산 중단(10% 추정 금지)**.

---

## 6. 조건 필드 전체와 의미

**취득세 컨텍스트**: price·house_count·is_regulated·area_sqm·official_price·is_metro·first_home·temporary_two_home·donor_relation·tax_base(증여)·area_over_85(호환).
**인지세**: price(계약금액)·is_housing. **중개수수료**: deal_type(sale_exchange/lease)·price(임대차는 환산액)·sido(중개사무소 소재지 — 물건 아님!).
**양도세**: house_count(3=3주택 이상)·is_regulated(**양도 당시** — 이력 자동 판정)·holding_years(**세율용** 보유)·holding_years_ltsd(**공제용** 보유)·residence_years·sido·sigungu(경과조치 구 단위)·is_metro.

**⚠️ 보유기간 2종을 나눈 이유**: 세율용(소득세법 §104② — 집행기준 104-0-11)은 상속 시 **피상속인 취득일** 기산, 공제용(§95④ — 집행기준 95-0-1)은 **상속개시일** 기산. 조문이 다르고 상속에서 결과가 갈리므로 함수(holdingYearsForRate/ForLtsd)·조건 필드(holding_years/holding_years_ltsd)를 이름부터 분리 — 절대 바꿔 쓰지 마라.
**⚠️ 거주 요건 2종을 나눈 이유**: 비과세의 거주 요건(exemption.residenceIfAcquiredRegulated)은 **취득 당시 조정대상지역인 경우에만** 적용(취득 당시 여부는 과거 이력이 없어 **사용자 직접 선택** — acquiredInRegulatedArea). 장특공제 큰 표의 거주 요건(ltsd.one_house.minResidenceYears)은 **지역 무관 항상** 적용. 다른 조문·다른 판정 시점 — 혼용이 이 계산기의 최대 위험이라 transfer.ts를 한 파일로 유지한다.
**조정대상지역 판정 시점 2개**: 비과세=취득 당시(사용자 선택), 중과=양도 당시(tax_regulated_areas를 'transfer' 세목으로 자동 조회).
초일 산입은 transfer.period_rule 룰이 정함(include_start 등록 — 집행기준 89-154-20). 거주기간의 산입 방식은 미확인 — 보유와 동일 전제, residenceYearsUsed로 화면 조건부 안내.

---

## 7. 엔진 오류 코드 · 계산기 목록 관리 · 새 계산기 추가 절차

오류 코드(engine-types.ts): INVALID_INPUT / **RULE_NOT_REGISTERED(룰 없으면 0원 금지 — 핵심 안전장치)** / RULE_CONFLICT(유효 룰 2건+ 중단) / RULE_VALUE_INVALID / NO_MATCHING_RATE_ROW / AMBIGUOUS_RATE_ROW / DB_ERROR. message는 화면에 그대로 나가는 한국어.

계산기 목록: `lib/tax/calculators.ts` 단일 출처 — 허브·전환 탭·사이트맵·noindex(각 page.tsx가 available에서 파생)가 전부 이 목록을 읽음. available:false = '준비 중' 표시+링크·사이트맵 제외+noindex.

새 계산기 추가 절차: ① rule_value 타입+검증기(파일 큰 경우 별도 파일 — transfer 방식) ② 엔진(fetchValidRules·requireRule — 0원 금지) ③ 화면 4종(page·폼·결과패널·actions — BotID→검증→엔진→이력) ④ instrumentation-client.ts POST 등록 ⑤ 관리자: rule-guides 안내+knownKeysForTaxType+**VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE**(빠뜨리면 "저장되는데 계산기는 룰 미등록" 함정) ⑥ RuleBasisBanner taxTypes 지정해 페이지 상단 부착 ⑦ calculators.ts available:true는 룰 등록·검산 후. 새 세목이 필요하면 tax_rules·logs 두 CHECK 확장 마이그레이션.

미배포 계산기의 검산 요령: 로컬 서버 금지이므로 **tsx로 엔진+운영 anon 클라이언트 직접 호출**(.env.local의 NEXT_PUBLIC_*, `NODE_PATH=<프로젝트>/node_modules npx tsx <스크립트>`; 스크립트는 스크래치패드에 두고 검산 후 삭제).

---

## 8. 기준일 배너 (RuleBasisBanner) 동작

서버 컴포넌트+네이티브 details(기본 접힘). props.taxTypes(예: ['transfer','common'])로 오늘(KST) 기준 유효한 confirmed+proposed 룰을 조회해 **가장 최근 시행일·마지막 갱신일·적용 룰 N건을 자동 산출**(사람이 적는 값 없음). 펼치면 룰 목록(키·법령·조문·시행기간·상태). **proposed가 섞이면 배너 전체 경고색+"국회 통과 전 개정안 포함" 명시**. 룰 0건이면 그 사실 표시, 조회 실패도 안내(빈 배너 금지). 하단의 옛 "마지막 룰 갱신일" 줄은 제거됨 — 날짜 출처는 배너 하나. 알려진 한계는 §10 Medium 3.

---

## 9. 다음 세션이 반드시 지켜야 할 원칙

1. **세율·공제율·구간·금액·연수 요건·날짜(연도 포함)를 코드·마이그레이션·시드·안내 문구에 절대 넣지 않는다.** 학습 데이터로 기억하는 값도 금지. 값은 대표님이 지시서로 주고, 등록은 그대로(수정 금지)+jsonb 원본 대조. 승인된 예외: acquisition.ts `> 85`(필드명 정의)·입력 placeholder 예시 금액·«...» 자리표시자·/100 환산·달력 상수.
2. **룰이 없으면 0원 금지**(RULE_NOT_REGISTERED 구조 유지). 지방소득세를 국세의 10%로 추정 금지. 경과조치 입력 없으면 면제 추정 금지(중과 유지+미확정 표시). 0이 함정이 되는 값은 검증기가 저장 거부.
3. **Wave 방식**: Wave 끝마다 `npx tsc --noEmit`+`npm run build` 통과 → 변경 파일만 **개별 git add**(`git add .` 금지) → 커밋 → 멈추고 보고. **푸시는 명시 승인 시만.** Critical·High는 수정 후 재검사, Medium 이하 보고만.
4. **병행 세션 취급법**: 미커밋 변경·커밋 불가침. 같은 파일에 남의 미커밋 변경이 섞이면 **내 hunk만 선별 스테이징**(`git apply --cached` 패치 방식 — instrumentation-client.ts 전례). 푸시 전 `git log origin/main..HEAD` 혼입 확인. **병행 세션 푸시에 이쪽 커밋이 딸려 나간 전례 5회** — "미푸시"라는 기억을 믿지 말고 fetch로 재확인, DB 선행 조건(마이그레이션)이 있는 커밋은 만들자마자 적용을 요청할 것. `.next`는 공유라 캐시 오류·동시 빌드 경합 시 삭제 후 재빌드(코드 문제 아님).
5. 검산·배포 확인: 운영 사이트 반복 curl 폴링 금지(429 rate limit 전례) — Vercel 배포 상태 조회+브라우저 1회 확인. 화면 첫 클릭이 하이드레이션 전에 씹히는 증상 있음 — 좌표 재클릭.
6. transfer.ts는 552줄이어도 **나누지 마라**(대표님 지시 — 혼용 방지가 300줄 규칙보다 우선). TAX_TYPES(6종)와 RULE_TAX_TYPES(11종) 합치지 마라. 새 룰 키는 KEY_REQUIRED_TAX_TYPE에.
7. `next lint` 불가(ESLint 설정 없음) — tsc+build로 검증. 마이그레이션 비멱등 — 운영 재실행 금지. CLAUDE.md 공통 규칙(한국어 JSDoc·any 금지·@theme 토큰·보고 한국어·표 없이 문단) 준수.

---

## 10. 잔여 Medium·Low 전체 (2026-08-13 Wave 6 점검분 — 수정 보류 지시)

**Medium (양도세)**
1. 장특공제율 합계 100% 초과 미방어 — 관리자 오입력 시 taxableGain 음수→세액 0원 가능. 클램프/RULE_VALUE_INVALID 권장.
2. 중과 대상자가 경과조치 미입력이면 '미확정' 경고 상시 표시 — 입력란은 고급 접힘 속. 경고/안내 분리 또는 중과 시 자동 펼침 권장.
3. 기준일 배너: proposed 포함 집계라 확정법 고정 계산과 기준 불일치 가능·rule_key 중복 미제거·같은 키/시행일 쌍 React key 중복.
4. 양도차손 0원의 사유가 결과 카드 상단에 없음(판정 내역에만).
5. 중과 적용 전제(2주택+양도 당시 조정)가 코드 게이트 — heavy 안내의 is_regulated 조건과 불일치(게이트 제거 또는 안내 정리).
6. TransferForm 330줄대(고급 블록 분리 후보).

**Low (요지)**
거주>보유 차단이 상속에서 과차단 가능(상속 전 동거 입력 — 메시지 보강) · checkRatePositive linear_by_base 미커버 · progressive 누진공제>구간세액이면 0원(Math.max) · 단기표 안내의 연수 예시 고정 · NaN 컨텍스트 min/max 방어 부재(현재 도달 불가) · 경과조치 미매칭/계약금 false 사유 문구 없음 · 국세·지방 rounding 공유 · 취득세 페이지 머리 주석 낡음 · 인지세/중개수수료 배너 taxTypes에 common 없음(미사용이라 무해) · '손에 쥐는 돈' 라벨 의미 · 기본공제 연 1회 합산 한계 안내 부재 · 표시용 룰 조회 2곳이 rule-store 우회(배너·경과조치 날짜 — RULE_CONFLICT 시 화면·엔진 불일치 가능) · AreasManager 소형 JSDoc 누락 · 아이콘 직접 import(tax 전역 관례).

**S3 잔여(중개수수료)**: 전세(월세 0) 환산 표시 오해 · 단수 처리 코드 고정(floor) · 거래금액 0원 허용 · 매매 결과에 입력 금액 미표기.

**이월(과거 인계서분)**: 취득세 stale 결과·유상 분기 giftTaxBaseChoice 무시 · fetchValidRules가 rule_key로만 묶음(common/세목 동일 키 RULE_CONFLICT 오탐 소지 — 현재 키 전부 고유) · 계산 액션 rate limit 부재·이력 보존 정책 없음 · 규제지역 이력 겹침 방어 없음 · OG 이미지 부재 · 300줄 초과(rule-value·engine-types·CalculatorForm·Navbar).

**미해결·다음 후보**: acquisition.gift.heavy 등록(증여 중과 개방) · heavy 룰 미등록 vs 법정 유예를 시스템이 구분 못함(의도된 설계 — 인지) · 규제지역 이력 0건 지역의 "비규제" 단정 표시 · 등기비용 계산기 · 법제처 개정 감시(law_id·tax_law_change_queue 준비됨) · 회귀 테스트 실행기(tax_test_cases) · 개정안 모드(양도세 개편안 반영 시 취득세 방식 토글).

---

## 11. 새 세션이 처음 읽어야 할 파일 순서

1. **이 파일** (HANDOVER-calc-2026-08-14.md)
2. 작업 대상 Stage의 설계 문서(prompts/feat-tax-*)와 값 지시서(prompts/*-룰-등록.md)
3. `src/lib/tax/types.ts` → `labels.ts` — 세목 체계(§4의 실물)
4. `engine-types.ts` → `transfer-types.ts` — 계약 전부. 이어서 `rule-store.ts` → `rule-value.ts` → `transfer-rules.ts` → `period.ts`
5. 엔진: `acquisition.ts` → `stamp.ts` → `brokerage.ts` → `transfer.ts`(4대 구분 주석 필독)
6. `calculators.ts` → `tax/layout.tsx` → `_components/`(TaxNav·ApartmentOnlyNotice·RuleBasisBanner)
7. 최신 화면 본보기: `tax/transfer/` 4종(actions→폼→결과패널→page)
8. 관리자: `rules/rule-guides.ts`+`rule-guides-transfer.ts` → `rules/actions.ts`(KEY_REQUIRED_TAX_TYPE) → `areas/`
9. `supabase/migrations/055~059`
