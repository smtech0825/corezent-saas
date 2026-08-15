# HANDOVER — 부동산 세금계산기 최종본 (S1~S6 완결, 8종 전체 운영)

> **이 문서가 최신본이다. 기존 인계서(`HANDOVER-calc-2026-08-16.md`·`HANDOVER-calc-2026-08-14.md` 등 이전 전부)를 대체한다.**
> 작성: 2026-08-14 세션 종료 시점(S5·S6 완결 + 보류 6건 해소 + 85a686c 사후 점검 반영).
> 설계 문서: `prompts/feat-tax-s1-*` ~ `feat-tax-s6-registration-and-net-proceeds.md`
> 값 지시서(원본): `prompts/중개수수료-룰-등록.md` · `양도소득세-룰-등록.md` ·
> `재산세-종부세-룰-등록.md` · `등기비용-룰-등록.md` (취득세·인지세 값은 채팅 수령)

---

## 0. 현재 상태 요약

- **계산기 8종 전부 운영 중**(2026-08-14 개시 완료): 취득세·인지세·중개수수료·등기비용(살 때) /
  재산세·종합부동산세(가지고 있을 때) / 양도소득세·매도 실수령액(팔 때).
  전부 아파트 전용(공용 배너 고지). '준비 중' 항목 없음. 전월세 전환은 영구 취소.
- **룰 38종 운영 등록**(§2): S1~S4 20종 + S5 16종 + S6 2종. 전부 confirmed. 검산 전부 통과
  (인지세 5·중개 5·양도 5·재산/종부 7·등기/실수령 8건). 미등록: acquisition.gift.heavy.
- 마이그레이션 055~059 운영 적용 완료(§4). S5·S6은 마이그레이션 없이 완결.
- 보류 6건 해소 배포됨(85a686c). 해당 커밋의 사후 점검(bug-detective·code-guardian 각 1회)
  결과 Critical·High 0 — Medium 2·Low 11은 §10에 보류로 기록.
- **2026년 세제개편안 반영(§13) 완료(2026-08-15)** — 시스템(형식 이중 지원·모드 UI)·proposed
  룰 17행 등록·검산·점검까지 §14 참조. 남은 것: 국회 통과 시 confirmed 재등록 절차(§13-3)와
  §14-4 보류 목록.
- **⚠️ 병행 세션 다수 활동 중** — 이쪽 커밋이 병행 세션 푸시에 딸려 나간 전례가 이번 세션에만
  3회 추가(누적 8회). "미푸시"라는 기억을 믿지 말고 반드시 fetch로 재확인(§9-4).

---

## 1. 계산기 8종 — 파일·엔진·룰 키

공통 구조(전 계산기 동일): 엔진 `src/lib/tax/<이름>.ts` + 타입 `<이름>-types.ts` +
검증기 `<이름>-rules.ts`(엔진·관리자 공유) / 화면 `src/app/tax/<slug>/`에 page·폼·결과패널·
actions(BotID→검증→엔진→이력) 4종 / 관리자 안내 `admin/tax/rules/rule-guides*.ts`.
전 폼 공통: **입력 변경 시 이전 결과 초기화**(form onChange + SegmentControl별 clearStaleResult).
전 패널 공통: 실패는 **CalcFailureNotice**(§6) 사용.

1. **취득세** `/tax/acquisition` — 엔진 acquisition.ts(352줄 승인 예외, 키 상수 포함).
   룰 6종: onerous.rates·gift.tax_base·gift.rates·gift.heavy(미등록)·deemed_gift_threshold·rounding.
   화면 CalculatorForm·ResultPanel. 유일하게 룰 모드(확정/개정안) 전환 UI 보유. 증여 과세표준
   기준 선택 버튼은 form 밖 결과 영역(type="button") — 결과 초기화와 무관하게 재계산.
2. **인지세** `/tax/stamp` — 엔진 stamp.ts(키 상수 포함). 룰 1종: stamp.rates(정액표+비과세 행).
3. **중개수수료** `/tax/brokerage` — 엔진 brokerage.ts. 룰 2종: rates(+leaseConversion)·vat.
   세금이 아니라 '법정 상한'. sido는 중개사무소 소재지 의미.
4. **등기비용** `/tax/registration` (S6) — 엔진 registration.ts. 취득세·인지세를 **기존 엔진
   호출**로 합산(재구현 없음·실패 시 전체 중단). 룰 2종: registration.fee(방법별 정액,
   default 행 정확히 1개)·registration.bond(매입률 표+rounding, **exempt: true 행 = 매입 면제**
   — 0%가 아니라 '면제'로 표시). 채권 손실률·법무사 보수는 룰이 아니라 사용자 입력이며
   비우면 not_included('입력하면 포함됩니다')·총액 제외·someExcluded 경고. 인지세는 취득일
   기준 계산(계약일 아님 — 판단 한계에 안내, 승인된 갈음).
5. **재산세** `/tax/property` (S5) — 엔진 property.ts. 룰 8종(§2). 과세기준일도 룰
   (assessment_date 월·일)이며 연초(달력 상수) 임시 조회→과세기준일 재조회 2단계 구조.
   1주택 비율 특례는 **별도 키의 시행기간(종료일)** 으로 표현 — 만료 시 자동 일반 전환.
   상한 2종(과세표준·세부담)은 직전 연도 값 입력 시에만 적용(applied/not_exceeded/skipped
   3상태). 직전 연도 값 0 입력도 미적용 처리(0원 함정 방어). **mainTaxOnly 옵션**
   (property.ts 4번째 인자) = 본세만 계산 — 종부세 공제용, surtax 룰 불요구.
6. **종합부동산세** `/tax/comprehensive` (S5) — 엔진 comprehensive.ts(353줄 승인 예외).
   룰 8종(§2). **재산세 엔진을 mainTaxOnly로 호출**해 재산세 상당액 자동 공제(실패 시 전체
   중단). 입력은 주택 목록이 아니라 **주택 수+공시가격 합계**(대원칙). 기본공제 이하면
   taxable:false+사유. 세율표는 한 표에 heavy:true 행으로 일반/중과 구분. 1주택 세액공제는
   연령·보유 각각 %와 합산 한도(capReached) 표시.
7. **양도소득세** `/tax/transfer` — 엔진 transfer.ts(552줄 승인 예외 — 나누지 말 것).
   룰 11종. 4대 구분은 §5 참조.
8. **매도 실수령액** `/tax/net-proceeds` (S6) — 엔진 net-proceeds.ts. **새 룰 없음** —
   양도세·중개수수료를 기존 엔진 호출로 차감. 실제 수수료 미입력이면 상한액+부가세
   (isCap 표시·actualExceedsCap 경고). 비과세는 정상 결과(사유 원문 전달). 중개사무소
   소재지는 물건 소재지로 갈음(안내 명시 — 승인). 이력은 tax_type='transfer' +
   input.calculator='net_proceeds' 표시(별개 세목 아님 — 관리자 룰 화면에 실수령액 세목이
   없는 것이 정상. rule-guides.ts 병합 주석 참조). 필요경비 힌트는 양도세 폼과 문자 동일 유지.

공용 컴포넌트(`src/app/tax/_components/`): TaxNav(전환 탭)·ApartmentOnlyNotice(아파트 배너)·
RuleBasisBanner(기준일 배너 §8)·**CalcFailureNotice(실패 원인별 안내 §6 — 8종 공용)**.
`src/instrumentation-client.ts`에 8계산기 POST 전부 BotID 등록.
`src/app/sitemap.ts`는 available 계산기만 자동 포함.

## 2. 등록된 룰 38종 (전부 confirmed, 2026-08-14 등록·검산 기준)

**acquisition (5)**: onerous.rates(2026-06-01~) · gift.tax_base(2023-01-01~) ·
gift.rates(2011-01-01~) · gift.deemed_gift_threshold(2026-06-01~) · rounding(2011-01-01~).
gift.heavy는 의도적 미등록(등록해야 규제지역 증여 계산이 열림).
**common (1)**: region.metro_scope(2008-03-21~) — is_metro 판정 유일 출처.
**stamp (1)**: stamp.rates(2002-01-01~).
**brokerage (2)**: brokerage.rates(2021-10-19~) · brokerage.vat(2021-10-19~).
**transfer (11)**: base_rates·short_term_rates·ltsd.general·ltsd.one_house·basic_deduction·
exemption·local_income_tax·period_rule·rounding(전부 2023-01-01~) ·
temporary_two_house(2023-02-28~) · heavy(2026-05-10~ — 중과 재개일, 유예는 룰 부재로 표현.
grace: 계약 마감 2026-05-09·강남/서초/송파/용산 4개월·그 외 6개월·최종 2026-11-09).
**property (8)**: assessment_ratio(2023-01-01~) ·
**⚠️ assessment_ratio.one_house(2026-01-01 ~ 2026-12-31 — 한시 특례, 종료일 필수. 만료 시
엔진이 자동으로 일반 비율 적용. 연장되면 새 시행기간으로 추가 등록)** ·
rates(2023-01-01~ — general+oneHouse 9억 기준) · surtax(2023-01-01~) · base_cap(2024-01-01~) ·
**⚠️ burden_cap(2023-01-01 ~ 2028-12-31 — 폐지 경과조치 종료일. 만료 시 상한 자동 미적용)** ·
assessment_date(2010-01-01~ — 6/1은 룰 값) · rounding(2010-01-01~ — 10원 버림).
**comprehensive (8)**: basic_deduction(2023-01-01~) · assessment_ratio(2023-01-01~) ·
rates(2023-01-01~ — heavy 행 포함 한 표) · tax_credit(2021-01-01~ — 합산 한도 80) ·
burden_cap(2023-01-01~ — 일률 150) · rural_surtax(2010-01-01~) · assessment_date(2010-01-01~) ·
rounding(2010-01-01~).
**registration (2)**: fee(2025-08-01~ — 서면 default·e-Form·전자 3행) ·
bond(2015-07-01~ — 전국 7행+특별·광역시 7행, exempt 행 2개, 만원 반올림 rounding).

rule_value 형식의 단일 출처는 rule-guides*.ts(화면 안내)와 각 *-rules.ts(검증기)다. 공통 요지:
행 조건 when은 eq/min/max/in(경계 포함)·priority 최고 1건(동률 오류)·모르는 필드 중단·
미확정 값 조건은 미매칭+unresolved. **구간은 max 금지 — min("이상")+priority 오름차순**.
누진(progressive)은 brackets minBase 오름차순. 0이 함정이 되는 값(요율·세율·공제율·수수료·
매입률·기본공제 등)은 검증기가 저장 거부(재산세 base_cap increasePercent 0과 취득세 fixed
0%는 정당해 허용). 구조가 같은 룰은 검증기 공유: comprehensive의 비율·기준일·세부담 상한 →
property 검증기, rounding 전 세목 → parseRounding.

## 3. 커밋 이력 (시간순 요지)

**S1~S4**: HANDOVER-calc-2026-08-14.md(git 이력) §2 참조 — S1 `ca30d39→…→f19668c` /
S2 `84dfb56→…→0e90a1a` / S3 `b9dac85→…→48ee8f1` / S4 `b5e5f00→…→8bcd9de`.
S4 배포 확인 기록 `8b0809c`.
**S5 재산세·종부세**: `6274b5a`(W1 재산세 엔진) → `c4a3cd2`(W2 화면) → `0e9f059`(W3 종부세
엔진 — mainTaxOnly 호출) → `e88fe9e`(W4 화면) → `a6c2d6b`(W5 관리자 16키) → `9a753a8`(W6
High: 직전 연도 0 입력 함정) → `fd98703`(Medium 2: 본세만 모드·상한 문구) → `d137aa0`(인계
기록) → `641a697`(개시).
**S6 등기·실수령액**: `ca4a78a`(W1 등기 엔진) → `a0dbb42`(W2 화면) → `448db13`(W3 실수령액
엔진) → `d04b103`(W4 화면) → `5a3a72f`(W5 관리자 2키) → `48ea624`(W6 High: 손실률
placeholder 제거) → `ff1eacc`(인계 기록) → `3c537ac`(**채권 exempt 행 지원**) → `5858889`(개시).
**보류 해소**: `85a686c`(6건 일괄, 18파일 — 사후 점검 완료: Critical·High 0).
**인계서**: `eba7258`(2026-08-16판 — 본 최종본이 대체).

## 4. DB — 테이블 5개, 마이그레이션 055~059 (전부 운영 적용 완료·비멱등·재실행 금지)

테이블(본체 Supabase): **tax_rules**(룰 저장소 — rule_value jsonb·시행기간·status·법령 근거
NOT NULL·law_id/law_article_no·공개 SELECT) / **tax_regulated_areas**(규제지역 이력 —
applies_to 세목 6종+all·note·공개 SELECT) / **tax_test_cases**(실행기 없음) /
**tax_calculation_logs**(계산 이력·PII 금지·service_role 전용) / **tax_law_change_queue**(비어
있음 — 법제처 감시용).

- 055: 테이블 5개+RLS+인덱스(applies_to CHECK 6종에 property·comprehensive 포함).
- 056: EXCLUDE — 같은 (tax_type,rule_key,status) 시행기간 겹침 차단. ⚠️ 한 키 안에서 특례만
  따로 만료 불가 — 한시 특례는 별도 키로(property one_house 전례). **status가 다르면 기간이
  겹쳐도 등록 가능 — confirmed 위에 proposed를 겹쳐 등록하는 개편안 구조의 근거(§13)**.
- 057: CHECK에 'common'+law_id·law_article_no.
- 058: CHECK 확장 — tax_rules 11종·logs 10종. S5·S6 세목이 전부 이미 포함.
- 059: tax_regulated_areas.note. 규제지역 40행(서울 25+경기 15)은
  applies_to=['acquisition','transfer'] — 종부세가 조정 판정을 쓰게 되면 확장 필요.

## 5. 조건 필드 전체와 의미 (세목별 판정 컨텍스트)

**취득세**: price·house_count·is_regulated·area_sqm·official_price·is_metro·first_home·
temporary_two_home·donor_relation·tax_base(증여)·area_over_85(호환).
**인지세**: price(계약금액)·is_housing.
**중개수수료**: deal_type(sale_exchange/lease)·price(임대차는 환산액)·sido(⚠️중개사무소
소재지 — 물건 아님. 실수령액은 물건 소재지로 갈음+안내).
**양도세**: house_count(3=이상)·is_regulated(**양도 당시** — 이력 자동)·holding_years(세율용
§104②)·holding_years_ltsd(공제용 §95④)·residence_years·sido·sigungu·is_metro.
⚠️ **양도세 4대 구분(혼용 금지 — transfer.ts를 한 파일로 유지하는 이유)**:
① 보유기간 2종 — 세율용(§104②, 상속은 피상속인 취득일 기산)과 공제용(§95④, 상속은
상속개시일 기산)을 별도 함수·별도 조건 필드로 분리. ② 장기보유특별공제 표 2개 — 큰 표
(1세대 1주택+거주 요건, 비과세 요건 충족 전제)·작은 표. 중과면 공제 없음. ③ 거주 요건
2종 — 비과세용(취득 당시 조정대상지역인 경우만·사용자 선택)과 큰 표용(지역 무관 항상).
④ 조정대상지역 판정 시점 2개 — 비과세=취득 당시(사용자 직접 선택), 중과=양도 당시
(tax_regulated_areas 이력 자동 판정).
**재산세**: official_price·is_one_house.
**종부세**: house_count·tax_base·is_one_house·total_official_price·age·holding_years.
**등기비용(bond)**: official_price·price·sido·is_metro.
초일 산입은 transfer.period_rule이 정함(include_start). 거주기간 산정은 미확인 — 보유 동일
전제·residenceYearsUsed 조건부 안내.

## 6. 엔진 실패 코드 7종과 화면 표시

코드(engine-types.ts): INVALID_INPUT / RULE_NOT_REGISTERED(0원 금지의 핵심) / RULE_CONFLICT /
RULE_VALUE_INVALID / NO_MATCHING_RATE_ROW / AMBIGUOUS_RATE_ROW / DB_ERROR. message는 화면에
그대로 나가는 한국어. **하위 엔진 호출 실패(종부세→재산세, 등기→취득·인지, 실수령→양도·중개)는
코드·ruleKey를 보존한 채 "…계산을 중단했습니다(0원으로 대체하지 않습니다)"로 래핑.**

화면 표시는 공용 `CalcFailureNotice`(8종 패널 공용)가 코드별로 제목·대처를 구분:
INVALID_INPUT="입력을 확인해 주세요" / RULE_NOT_REGISTERED="이 시점의 계산 근거가 아직
등록되지 않았습니다"(기준일 변경 힌트) / NO_MATCHING_RATE_ROW="입력 조건에 맞는 계산 근거가
없습니다" / AMBIGUOUS·CONFLICT·VALUE_INVALID=운영자 정리 안내 / DB_ERROR=재시도 안내.
"0원이 아니다" 문구의 명사는 계산기별(세액·상한·비용·실수령액). 7종 매핑은
`Record<TaxEngineFailure['code'],…>` 타입으로 강제(누락 시 빌드 실패). 문구 수정은 이 한 파일만.

## 7. 계산기 목록 관리 · 새 계산기 추가 절차

목록: `lib/tax/calculators.ts` 단일 출처 — 허브·전환 탭·사이트맵·noindex(각 page가 available
파생)가 전부 이걸 읽음. 분류 5종(buy/hold/sell/inherit/rent — inherit·rent는 빈 분류라 허브에
안 그려짐). available:false = '준비 중'+링크·사이트맵 제외+noindex.

추가 절차: ① rule_value 타입+검증기(*-types.ts/*-rules.ts) ② 엔진(fetchValidRules·requireRule —
0원 금지. 기존 세목 재사용 계산이면 **기존 엔진 호출**, 재구현 금지 — 종부세·등기·실수령
전례) ③ 화면 4종(실패는 CalcFailureNotice·입력 변경 시 결과 초기화 패턴 포함) ④
instrumentation-client.ts POST 등록 ⑤ 관리자: rule-guides 별도 파일+병합·knownKeysForTaxType·
**VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE**(빠뜨리면 "저장되는데 계산기는 룰 미등록" 함정)
⑥ RuleBasisBanner taxTypes 지정 ⑦ available:true는 룰 등록·검산 후. 새 세목이 필요하면
tax_rules·logs 두 CHECK 확장 마이그레이션(파생 계산기는 기존 세목으로 이력 기록 —
실수령액=transfer+input.calculator 전례).

검산 요령: 로컬 서버 금지 — **tsx로 엔진+운영 클라이언트 직접 호출**(.env.local,
`NODE_PATH=<프로젝트>/node_modules npx tsx <스크립트>`, 스크립트는 스크래치패드·검산 후 삭제).
룰 등록도 같은 방식(service_role)이며 사전 중복 확인+등록 후 jsonb 원본 대조 필수.

## 8. 기준일 배너 (RuleBasisBanner) 동작

서버 컴포넌트+네이티브 details(기본 접힘). props.taxTypes(세목 배열)로 오늘(KST) 기준 유효한
confirmed+proposed 룰을 집계 — 최근 시행일·마지막 갱신일·룰 N건 자동 산출(사람이 적는 값
없음). **proposed 섞이면 배너 전체 경고색+"국회 통과 전 개정안 포함" 명시(§13 개편안 등록
시 자동 발동)**. 룰 0건이면 그 사실 표시. 세목 지정: acquisition·transfer는 ['세목','common'],
stamp·brokerage·property·comprehensive는 자기 세목만(종부세의 재산세 부품 미집계는 과대 표시
방지 — 승인된 판단), registration은 ['registration','acquisition','stamp','common'],
net-proceeds는 ['transfer','brokerage','common'](타 세목 계산이 본체 — 승인된 판단).
한계: 세목 단위 집계라 실제 계산에 안 쓰는 룰도 세는 과대 표시 소지(§10 보류).

## 9. 다음 세션이 반드시 지켜야 할 원칙

1. **세율·공제율·비율·구간·금액·연수·날짜(과세기준일·연도 포함)를 코드·마이그레이션·안내
   문구에 절대 넣지 않는다.** 학습 데이터로 기억하는 값도 금지. 값은 대표님 지시서로 받고
   그대로 등록(수정 금지)+jsonb 원본 대조. 승인 예외: placeholder 예시 **금액**(요율·비율
   예시는 불가 — S6 W6 High 전례), «...» 자리표시자, /100 환산, 달력 상수(월 1~12·일 1~31·
   연도 4자리 형식·`${연도}-01-01` 임시 조회일), acquisition.ts `> 85`.
2. **룰이 없으면 0원 금지**(RULE_NOT_REGISTERED 유지). 하위 엔진 실패도 조용한 0 금지 —
   전체 중단+원인 보존. 미입력을 0·false로 간주 금지(unresolved 또는 not_included/skipped).
   직전 연도 값 0 입력 = 미적용 처리(상한 0원 함정). 기존 세목 계산 재구현 금지 — 기존 엔진 호출.
3. **Wave 방식**: Wave 끝마다 `npx tsc --noEmit`+`npm run build` → 변경 파일만 **개별 git
   add**(`git add .` 금지) → 커밋 → 멈추고 보고. **푸시는 명시 승인 시만.** Critical·High는
   수정 후 재검사, Medium 이하 보고만. **배포 전 점검(bug-detective·code-guardian)을 빠뜨리지
   말 것 — 85a686c는 점검 없이 배포됐다가 사후 점검함(지시 누락이었으나 재발 방지).**
4. **병행 세션**: 미커밋 변경·커밋 불가침. 같은 파일에 남의 변경이 섞이면 내 hunk만 선별
   스테이징. 푸시 전 `git fetch` 후 `git log origin/main..HEAD`로 혼입 확인 — **이쪽 커밋이
   병행 푸시에 딸려 나간 전례 8회**. 빌드 실패가 내 변경과 무관한 파일이면 병행 세션 미완성
   상태일 수 있음(기다렸다 재시도). `.next` 공유 — 캐시 오류·경합 시 재빌드하되, **병행
   세션이 빌드 중일 때 rm -rf .next는 서로를 깨뜨리는 악순환**(대기 후 rm 없이 재시도 권장).
5. 검산·배포 확인: 운영 반복 curl 금지(429 전례) — Vercel MCP 배포 조회+브라우저 확인.
   첫 클릭이 하이드레이션 전에 씹히는 증상 상존 — 재클릭. **브라우저 자동화의 form_input은
   체크박스의 React 상태를 못 바꾼다 — 체크박스는 반드시 실제 클릭**(S5 스팟체크 전례).
   레이아웃이 밀리면(미리보기 등장 등) 좌표를 스크린샷으로 재확인.
6. transfer.ts(552줄)·comprehensive.ts(353줄)·acquisition.ts(352줄)·폼 3종(취득 332·양도 343·
   실수령 362줄)은 승인 예외 — 나누지 말 것. TAX_TYPES(6종)와 RULE_TAX_TYPES(11종) 합치지
   마라. 새 룰 키는 VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE 양쪽에.
7. `next lint` 불가(설정 없음) — tsc+build로 검증. 마이그레이션 비멱등 — 운영 재실행 금지.
   CLAUDE.md 공통 규칙(한국어 JSDoc·any 금지·@theme 토큰·보고는 한국어·표 없이 문단) 준수.

## 10. 잔여 보류 목록 (수정 금지 지시 유지 — 지시 있을 때만 손댈 것)

### 10-1. 85a686c 사후 점검분 (2026-08-14 — 최신)
**Medium 2**: ① 계산 중(서버 응답 대기 0.5~2초) 입력을 바꾸면 응답 도착 시 제출 시점 입력
기준 결과가 바뀐 입력 옆에 표시(회귀 아님 — 수정 전에도 동일. 개선안: 요청 토큰 대조 또는
pending 중 fieldset 잠금). ② 300줄 초과 3파일(취득 332·양도 343·실수령 362)은 전부 기존
초과분 — 이번 커밋이 새로 넘긴 파일 없음(인지만).
**Low 11(요지)**: 이미 선택된 세그먼트 재클릭에도 결과 소멸(값 비교 가드 없음) · 결과 소멸
시 "다시 계산" 자리표시 안내 없음 · 실수령액 '그 밖의 비용' 0 직접 입력도 "입력하면
포함됩니다" 표시(미입력과 구분하려면 엔진 결과 플래그 필요 — 계산 로직 수반이라 보류) ·
BotID 차단이 INVALID_INPUT 재사용(제목·사유 어긋남, 빈도 낮음) · CalcFailureNotice 미지
code 렌더 방어 없음(현 타입상 불가) · 재산세·종부세 패널 unresolved 영문(현재 노출 경로
없음) · 미사용 AlertTriangle import 2곳(stamp·brokerage 패널) · 조사(이/가) 하드코딩 —
현 명사 4종은 문법 정상 · CalcFailureNotice 아이콘 aria-hidden·제목 h2 관례 ·
clearStaleResult 반환 타입 미표기 · TransferForm:63 주석에 날짜 예시(선행 커밋 유입 —
주석이라도 실제 날짜 지양) · 실패 화면에 ruleKey 미표시(운영자 대응 속도).

### 10-2. S5 잔여
**Medium 2**: ① 과세기준일 룰을 연중 시행일로 등록하면 연초 조회 실패 — 오류 메시지가
사정을 설명 못함(가이드 경고로 완화). ② 종부세 배너가 재산세 룰 미집계(승인된 설계 — 한계 인지).
**Low(요지)**: 종부세 과세표준 0 절사 시 맥락 없는 재산세 오류 문구 · 계산 과정 표시 뺄셈
불일치 가능(rawTax 절사 시점) · 극소 양수 상한(의도 동작) · 나이·연수 placeholder 경계
(전례상 허용) · 주택 수 1/2/3 고정 · 재산세 도시지역 체크 접힘 후 유지 · 종부세 상한 비교
비대칭(승인 산식) · property.ts 305줄(승인).

### 10-3. S6 잔여
**Medium 2+불확실 1**: ① 채권 손실률 미입력이어도 bond 룰 선조회 — 룰 미등록이면 전체
중단(필수 룰 대원칙 부합 측면 — 의도 여부 판단 필요). ④ 채권 행이 is_metro 조건일 때
metro_scope 룰이 근거 누락(양도세도 동일 전례). 불확실: 인지세 전액 매수인 부담 합산 전제
미안내(세법 해석 필요).
**Low(요지)**: 경과조치 날짜 함수 복제(transfer/net-proceeds page) · netProceeds 필드명이
양도세 breakdown과 정의 다른데 동명 · transfer 결과 통째 전달로 appliedRules payload 중복 ·
등기 폼 주택 수 정수 미검증 · 실수령액 큰 숫자 산식 캡션 없음 · 중개수수료 기준일=양도일 ·
text-[11px]·아이콘 직접 import·aria-hidden·OG 이미지(전역 관례·과제).

### 10-4. S3·이월
**S3**: 전세(월세 0) 환산 표시 오해 · 단수 처리 코드 고정(floor) · 거래금액 0원 허용 ·
매매 결과에 입력 금액 미표기.
**이월**: 유상 분기 giftTaxBaseChoice 무시 · fetchValidRules가 rule_key로만 묶음(common/세목
동일 키 충돌 소지 — 현재 키 전부 고유) · 계산 액션 rate limit 부재·이력 보존 정책 없음 ·
규제지역 이력 겹침 방어 없음 · 300줄 초과(rule-value·engine-types·CalculatorForm·Navbar —
승인 예외 외).

## 11. 미해결·다음 후보

acquisition.gift.heavy 등록(증여 중과 개방 — 값 지시서 필요) · heavy 룰 미등록 vs 법정 유예
구분 불가(의도된 설계 — 인지) · 규제지역 이력 0건 지역의 "비규제" 단정 표시 · 종부세가 조정
판정을 쓰게 될 경우 규제지역 applies_to 확장 · 법제처 개정 감시(law_id·tax_law_change_queue
준비됨 — property·comprehensive·registration 일부 룰은 law_id 미확인으로 비움) · 회귀 테스트
실행기(tax_test_cases — 검산 케이스 30건이 지시서들에 있음) · 이력 조회 관리자 화면
(input.calculator 구분 표시 필요).

## 12. 새 세션이 처음 읽어야 할 파일 순서

1. **이 파일** (HANDOVER-calc-2026-08-16-final.md)
2. 작업 대상 Stage의 설계 문서(prompts/feat-tax-*)와 값 지시서(prompts/*-룰-등록.md)
3. `src/lib/tax/types.ts` → `labels.ts` — 세목 체계
4. `engine-types.ts` → 대상 세목의 `*-types.ts` — 계약. 이어서 `rule-store.ts` →
   `rule-value.ts` → 대상 `*-rules.ts` → (양도 관련이면) `period.ts`
5. 엔진: 단순한 것부터 `stamp.ts` → `brokerage.ts` → `acquisition.ts` → `property.ts` →
   `comprehensive.ts`(재산세 호출 전례) → `transfer.ts`(4대 구분 필독) →
   `registration.ts`·`net-proceeds.ts`(조립형 전례)
6. `calculators.ts` → `tax/layout.tsx` → `_components/`(TaxNav·ApartmentOnlyNotice·
   RuleBasisBanner·CalcFailureNotice)
7. 최신 화면 본보기: 조립형은 `tax/net-proceeds/` 4종, 단독형은 `tax/property/` 4종
8. 관리자: `rules/rule-guides.ts`(+세목별 분리 파일 4개) → `rules/actions.ts`
   (VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE) → `areas/`
9. `supabase/migrations/055~059`

## 13. 다음 단계 — 2026년 세제개편안 반영 (다음 큰 작업)

**전제(대표님 확정)**: 개편안은 **아직 국회에 제출되지 않았다** — 반영하는 모든 룰은
**status='proposed'로 등록**해야 하며, 확정법(confirmed) 계산은 어떤 경우에도 흔들리면 안
된다. **시행 시점이 2027·2028·2029년으로 나뉜다** — 항목마다 effective_from이 다르므로 한
덩어리가 아니라 항목별 별도 룰 행으로 등록한다(값·항목 목록은 대표님 값 지시서로 받는다 —
§9-1 원칙 그대로, 코드·인계서에 개편안 수치를 미리 적지 않는다).

**시스템 준비 상태(이미 갖춰진 것)**:
- status='proposed'는 DB·타입·저장 화면 모두 지원. 056 EXCLUDE는 (tax_type,rule_key,**status**)
  단위라 같은 키의 confirmed 위에 proposed를 기간 겹치게 등록할 수 있다(§4).
- fetchValidRules의 proposed 모드: confirmed+proposed 조회 후 같은 키는 proposed 우선.
  엔진 전부가 mode 인자를 받는다 — 엔진 수정 없이 모드만 넘기면 개정안 계산이 된다.
- RuleBasisBanner는 proposed가 섞이면 자동으로 경고색+"국회 통과 전 개정안 포함" 표시(§8).
  결과 근거 목록도 룰별 '개정안 (미확정)' 배지를 이미 렌더한다.
- 관리자 룰 화면에서 status 선택·기간 겹침 안내 완비. 일부 룰 note에 개편 예고 메모가
  이미 있다(종부세 basic_deduction·assessment_ratio·burden_cap — 값은 note 참조).

**→ 이 절의 작업은 2026-08-15에 완료됐다 — 현행 상태는 §14가 정본이다.**

**해야 할 일(순서 제안)**:
1. **개정안 모드 UI 확산** — 현재 취득세만 확정/개정안 전환 UI가 있고 나머지 7종 액션은
   confirmed 고정(§11의 기존 후보). 개편안 등록 전에 어느 계산기에 전환 UI를 줄지, 기본값
   (confirmed 고정)과 경고 표시를 어떻게 할지 대표님 결정 필요.
2. 값 지시서 수령 → proposed 룰 등록(항목별 effective_from 2027/2028/2029 구분, jsonb 원본
   대조) → proposed 모드 검산(엔진 직접 호출 시 mode='proposed').
3. 국회 통과·공포 시: 해당 proposed 룰을 확정 값으로 재등록(confirmed, 관보 기준 시행일)
   하고 proposed 행은 폐지(repealed) 또는 삭제 — 절차를 그 시점 지시서로 확정.
4. 유의: 한시 특례 2건(§2 ⚠️)의 만료·연장이 개편안 시행 시점과 얽힐 수 있다 — 재산세
   one_house 특례(2026-12-31 만료)는 2027년분 계산부터 자동으로 일반 비율이 되며, 연장
   입법 시 새 시행기간 등록이 필요하다.

---

## 14. 2026 세제개편안 반영 — 완료 상태 (2026-08-15, 이 절이 §13 이후의 정본)

### 14-1. 시스템 구조 (핵심 원칙)
**계산 방식은 모드가 아니라 '집힌 룰의 값 형식'이 결정한다.** 같은 키에 확정법(구 형식)과
개정안(신 형식)이 공존하고, 파서(엔진·관리자 저장 공유)가 형식을 판별하며 혼합 저장은
거부된다. 확정법 룰은 재등록 없이 구 형식 경로 그대로다. **보유공제 폐지 = holdingRows
'필드 생략'**(빈 배열·0% 행은 거부 — 실수와 폐지를 구분). 신 형식 판별자:
comprehensive.tax_credit=residenceRows·maxAmount 존재(연령 합산 좌동 + 보유/거주 택일 +
%한도 좌동 + 금액한도 신설 — p.64), ltsd.general=residenceRows 존재(보유/거주 택일),
basic_deduction(양쪽)=rows 존재. 금액 산식은 amount-spec.ts(AmountSpec —
기준액+가산액×(분자필드÷분모필드), 비중 0~1 절단). 모드 전환 UI는 양도·종부 2곳만
(RuleModeSelector 공용, 기본 확정법), 재산세는 개정 대상 아님(지방세법 미포함) 판단 한계 명시.
2026년 양도분 신고 시점 완화 특례는 안내만(자동 미반영) — 최초 proposed heavy 룰 도입
시점에 한정, 완화 방향(가산 감소)일 때만 발동.

### 14-2. 커밋·데이터 (main, 2026-08-15)
코드 커밋 11개: 98d89ff(W1 종부세 룰 3종 이중 형식) → 308edd1(W2 종부세 화면) →
0d0149a(W3 양도세 ltsd·cap·기본공제) → 74957d3(W4 모드 UI) → 832a457(W4.5 holdingRows
생략) → 960c19d(W4.6 tax_credit 재설계 — 연령/거주 택일 오설계 정정) → 4312450(특례 안내)
→ caf857c(특례 오발동 차단) → 296fa2c(점검 후속 ①~⑤) → f266966(폼 가드 하루 오차 해소).
DB: proposed 룰 17행 등록(지시서 prompts/개편안-룰-등록.md — json 직접 추출·원본 대조) +
comprehensive.basic_deduction 산식 행 조건 {}(기본 행)로 재등록 1건(원문 ❷ '❶ 외' 전부가
산식 대상 — 주택 수 1이어도 1세대 1주택이 아니면 산식). 검산: 5묶음 13케이스 + 재검산
9케이스 전부 일치(확정법 회귀 0). heavy 개정안 행은 grace 생략(선택 필드)·holding_years
조건 사용. **지방소득세 개정안 룰은 의도적으로 없다** — 개정 대상 법률 11개에 지방세법이
없어 등록하지 않고 화면 안내로 대체(중과에 proposed heavy 적용 시 경고 박스 + 개정안 모드
공통 하단 문구).

### 14-3. 파일 크기 — 승인 예외 갱신 (⚠️ 실측 = 빈 줄 포함 줄 수 기준)
이전 측정(Measure-Object -Line)은 **빈 줄을 세지 않아 전부 과소**였다 — 이후 측정은
`(Get-Content 파일).Count`(실제 줄 수)로 할 것. 승인 예외(2026-08-15 갱신, 실측):
transfer.ts **727** · comprehensive.ts **458** · transfer-rules.ts **380** — 셋 다 나누지
말 것(계산 흐름·검증기 응집 유지 지시). acquisition.ts·기존 폼 예외는 종전대로. 폼은
분리로 복귀: 양도 폼 326(AdvancedFields.tsx 분리)·종부세 폼 284(ProposedFields.tsx 분리).
ComprehensiveResultPanel 295줄(한도 근접 — 다음 추가 시 분리 후보).

### 14-4. 보류 목록 — 점검(bug-detective·code-guardian 4회) Medium·Low, 기록만·수정 금지
**룰 값·설계 결정 필요(대표님)**: ① 기본공제 기본 행({})의 진단성 — API 직접 호출로
1주택+is_residing 미확정+거주가격을 주면 산식이 적용될 수 있음(UI 경유는 방어됨). 점검
권고는 조건을 is_one_house eq false로 좁히기(원문 ❷와 동치·진단성 복원 — 룰 재등록 필요).
② 그 행의 label '다주택 산식 기준'이 1주택·비1세대에도 표시됨(라벨 문구 재등록 검토).
③ **특례 근거를 룰에 명시하는 방안(filingRelief 필드/전용 키) — 나중에 다루기로 확정**:
현재는 '최초 proposed heavy 룰' 추론이라, 2027 행을 삭제·정리하면 오발동이 재발하고 더
이른 proposed 행을 추가하면 정당한 안내가 사라진다(룰 정리 시 주의). ④ 지시서
개편안-룰-등록.md의 10번 JSON이 옛 조건(house_count min 2) 그대로이고 1주택·비1세대 검산
케이스가 없음(대표님 문서 — 재사용 시 주의).
**시한성**: ⑤ RuleBasisBanner가 confirmed+proposed 합산 집계라 **2027-01-01부터** 확정법
기본 화면(양도·종부)이 경고색 + "기준: 2027-01-01 반영"으로 표시된다(기본 모드 계산엔
미사용인데도) — 그 전에 배너 산출 방식 결정 필요. ⑥ 국회 통과 시: 개정안 입력 4종
노출·필수 조건이 'UI 모드'에 결합돼 있어, 같은 형식이 confirmed로 재등록되는 순간 확정법
화면이 필요한 입력을 안 받아 계산이 멈춘다 — §13-3 절차에 "노출 조건을 룰 형식 기준으로
전환" 항목 포함할 것.
**one_house 오타 위험**: ⑦ transfer.ltsd.one_house는 형식 구분자가 없어 확정법 룰 수정 중
holdingRows를 빠뜨려도 저장 통과(보유공제가 조용히 0% — 결과 문구로만 드러남). 저장 확인
경고 또는 명시 플래그 검토.
**Low(요지)**: 실수령액 비대칭(거주기간 노출·거주≤보유 인라인 가드 없음(엔진이 잡음)·
filingRelief 미표시·relief 쿼리 낭비) · 고급 항목 접힘+상속 체크 시 날짜 required가
언마운트돼 서버 왕복 후 안내(분리 전과 동일 구조) · WonPreview·CheckRow 폼/AdvancedFields
복제(주석 명시) ·
특례 강등(일반 안내) 경로에 완화 방향 미검증(현 데이터 도달 불가) · 확정법 모드 특례
안내의 근거 목록 미표시 · 지방세 하단 문구가 개정안 룰 미적용 계산에도 표시
(containsProposedRule 조건 검토) · 개정안 모드+2026 과세연도에도 신 입력 필수(그 해엔
확정법 룰이 집혀 미사용) · TRANSFER_RULE_KEYS 클라이언트 import(룰 키 경량 모듈 분리
검토) · RuleModeSelector 주석 "공용화" vs 취득세 폼 미교체(문구·폭 이격) · 시행 연도
문구(2027·2028·2029) 3곳 중복 · RuleModeSelector 경고 role="alert" 부재 · 기본공제 실패
문구 "세율표" 표기 · 한도 정확 도달 시 배지 미표시(> 비교 관례) · 종부세→재산세 proposed
모드 전달(재산세 proposed 없어 무해) · 주석·가이드 잔여 숫자(선행 유입 포함) · RuleForm
handleSubmit 주석 누락 · transfer/page.tsx 룰 키 문자열 하드코딩.
