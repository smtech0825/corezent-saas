# HANDOVER — 부동산 세금계산기 (S1 취득세 ~ S6 등기비용·실수령액, 8종 전체 운영)

> 작성: 2026-08-14 세션 종료 시점(S5·S6 완결 + 보류 6건 해소 반영). 다음 세션이 이 문서만
> 읽고 이어서 작업할 수 있도록 작성함. 이전 인계서 `HANDOVER-calc-2026-08-14.md`를 대체한다.
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
- 마이그레이션 055~059 운영 적용 완료(§4). S5·S6은 마이그레이션 없이 완결(세목 CHECK 기존 포함).
- 보류 항목 6건 해소 배포됨(85a686c — §10-1). 마지막 확인: 결과 초기화·인지세 안내 실화면 검증 완료.
- **⚠️ 병행 세션 다수 활동 중** — 이쪽 커밋이 병행 세션 푸시에 딸려 나간 전례가 이번 세션에만
  3회 추가(누적 8회). "미푸시"라는 기억을 믿지 말고 반드시 fetch로 재확인(§9-4).

---

## 1. 계산기 8종 — 파일·엔진·룰 키

공통 구조(전 계산기 동일): 엔진 `src/lib/tax/<이름>.ts` + 타입 `<이름>-types.ts` +
검증기 `<이름>-rules.ts`(엔진·관리자 공유) / 화면 `src/app/tax/<slug>/`에 page·폼·결과패널·
actions(BotID→검증→엔진→이력) 4종 / 관리자 안내 `admin/tax/rules/rule-guides*.ts`.

1. **취득세** `/tax/acquisition` — 엔진 acquisition.ts(352줄 승인 예외, 키 상수 포함).
   룰 6종: onerous.rates·gift.tax_base·gift.rates·gift.heavy(미등록)·deemed_gift_threshold·rounding.
   화면 CalculatorForm·ResultPanel. 유일하게 룰 모드(확정/개정안) 전환 UI 보유.
2. **인지세** `/tax/stamp` — 엔진 stamp.ts(키 상수 포함). 룰 1종: stamp.rates(정액표+비과세 행).
3. **중개수수료** `/tax/brokerage` — 엔진 brokerage.ts. 룰 2종: rates(+leaseConversion)·vat.
   세금이 아니라 '법정 상한'. sido는 중개사무소 소재지 의미.
4. **등기비용** `/tax/registration` (S6) — 엔진 registration.ts. 취득세·인지세를 **기존 엔진
   호출**로 합산(재구현 없음·실패 시 전체 중단). 룰 2종: registration.fee(방법별 정액,
   default 행 정확히 1개)·registration.bond(매입률 표+rounding, **exempt: true 행 = 매입 면제**
   — 0%가 아니라 '면제'로 표시). 채권 손실률·법무사 보수는 룰이 아니라 사용자 입력이며
   비우면 not_included('입력하면 포함됩니다')·총액 제외·someExcluded 경고.
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
   룰 11종. 4대 구분(보유 2종·공제 표 2개·거주 요건 2종·조정 판정 시점 2개)은 §5 참조.
8. **매도 실수령액** `/tax/net-proceeds` (S6) — 엔진 net-proceeds.ts. **새 룰 없음** —
   양도세·중개수수료를 기존 엔진 호출로 차감. 실제 수수료 미입력이면 상한액+부가세
   (isCap 표시·actualExceedsCap 경고). 비과세는 정상 결과(사유 원문 전달). 중개사무소
   소재지는 물건 소재지로 갈음(안내로 명시 — 승인된 설계). 이력은 tax_type='transfer' +
   input.calculator='net_proceeds' 표시(별개 세목 아님 — 관리자 룰 화면에 실수령액 세목이
   없는 것이 정상. rule-guides.ts 병합 주석 참조).

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
**assessment_ratio.one_house(2026-01-01~2026-12-31 ⚠️한시 특례 — 종료일 필수)** ·
rates(2023-01-01~ — general+oneHouse 9억 기준) · surtax(2023-01-01~) · base_cap(2024-01-01~) ·
**burden_cap(2023-01-01~2028-12-31 ⚠️경과조치 종료일)** · assessment_date(2010-01-01~ —
6/1은 룰 값) · rounding(2010-01-01~ — 10원 버림).
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

**S1~S4**: 구 인계서(HANDOVER-calc-2026-08-14.md, git 이력에 있음) §2 참조 — S1
`ca30d39→…→f19668c` / S2 `84dfb56→…→0e90a1a` / S3 `b9dac85→…→48ee8f1` / S4
`b5e5f00→…→8bcd9de`. S4 배포 확인 기록 `8b0809c`.
**S5 재산세·종부세**: `6274b5a`(W1 재산세 엔진) → `c4a3cd2`(W2 화면) → `0e9f059`(W3 종부세
엔진 — mainTaxOnly 호출) → `e88fe9e`(W4 화면) → `a6c2d6b`(W5 관리자 16키) → `9a753a8`(W6
High: 직전 연도 0 입력 함정) → `fd98703`(Medium 2: 본세만 모드·상한 문구) → `d137aa0`(인계
기록) → `641a697`(개시).
**S6 등기·실수령액**: `ca4a78a`(W1 등기 엔진) → `a0dbb42`(W2 화면) → `448db13`(W3 실수령액
엔진) → `d04b103`(W4 화면) → `5a3a72f`(W5 관리자 2키) → `48ea624`(W6 High: 손실률
placeholder 제거) → `ff1eacc`(인계 기록) → `3c537ac`(**채권 exempt 행 지원**) → `5858889`(개시).
**보류 해소**: `85a686c`(6건 일괄 — §10-1).

## 4. DB — 테이블 5개, 마이그레이션 055~059 (전부 운영 적용 완료·비멱등·재실행 금지)

테이블(본체 Supabase): **tax_rules**(룰 저장소 — rule_value jsonb·시행기간·status·법령 근거
NOT NULL·law_id/law_article_no·공개 SELECT) / **tax_regulated_areas**(규제지역 이력 —
applies_to 세목 6종+all·note·공개 SELECT) / **tax_test_cases**(실행기 없음) /
**tax_calculation_logs**(계산 이력·PII 금지·service_role 전용) / **tax_law_change_queue**(비어
있음 — 법제처 감시용).

- 055: 테이블 5개+RLS+인덱스(applies_to CHECK 6종에 property·comprehensive 포함).
- 056: EXCLUDE — 같은 (tax_type,rule_key,status) 시행기간 겹침 차단. ⚠️ 이 제약 때문에 한
  키 안에서 특례만 따로 만료시킬 수 없다 — 한시 특례는 별도 키로(property one_house 전례).
- 057: CHECK에 'common'+law_id·law_article_no.
- 058: CHECK 확장 — tax_rules 11종·logs 10종(stamp·brokerage·jeonse_conversion·registration).
  S5·S6에 필요한 세목이 전부 이미 포함돼 있어 추가 마이그레이션 불필요했음.
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
⚠️ 보유 2종(상속 기산일 상이)·거주 요건 2종(비과세=취득 당시 조정일 때만·큰 표=항상)·조정
판정 시점 2개(비과세=취득 당시 사용자 선택·중과=양도 당시 자동) — 혼용 금지, transfer.ts를
한 파일로 유지하는 이유.
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

화면 표시는 공용 `CalcFailureNotice`(8종 패널 공용)가 코드별로 제목·대처를 구분한다:
INVALID_INPUT="입력을 확인해 주세요" / RULE_NOT_REGISTERED="이 시점의 계산 근거가 아직
등록되지 않았습니다"(기준일 변경 힌트) / NO_MATCHING_RATE_ROW="입력 조건에 맞는 계산 근거가
없습니다" / AMBIGUOUS·CONFLICT·VALUE_INVALID=운영자 정리 안내 / DB_ERROR=재시도 안내.
"0원이 아니다" 문구의 명사는 계산기별(세액·상한·비용·실수령액). 문구 수정은 이 한 파일만.

## 7. 계산기 목록 관리 · 새 계산기 추가 절차

목록: `lib/tax/calculators.ts` 단일 출처 — 허브·전환 탭·사이트맵·noindex(각 page가 available
파생)가 전부 이걸 읽음. 분류 5종(buy/hold/sell/inherit/rent — inherit·rent는 현재 빈 분류라
허브에 안 그려짐). available:false = '준비 중'+링크·사이트맵 제외+noindex.

추가 절차: ① rule_value 타입+검증기(별도 파일 — *-types.ts/*-rules.ts) ② 엔진(fetchValidRules·
requireRule — 0원 금지. 기존 세목 재사용 계산이면 **기존 엔진 호출**, 재구현 금지 — 종부세·
등기·실수령 전례) ③ 화면 4종(실패는 CalcFailureNotice·입력 변경 시 결과 초기화 패턴 포함)
④ instrumentation-client.ts POST 등록 ⑤ 관리자: rule-guides 별도 파일+병합·knownKeysForTaxType·
**VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE**(빠뜨리면 "저장되는데 계산기는 룰 미등록" 함정)
⑥ RuleBasisBanner taxTypes 지정 ⑦ available:true는 룰 등록·검산 후. 새 세목이 필요하면
tax_rules·logs 두 CHECK 확장 마이그레이션(파생 계산기는 기존 세목으로 이력 기록 —
실수령액=transfer+input.calculator 전례).

검산 요령: 로컬 서버 금지 — **tsx로 엔진+운영 클라이언트 직접 호출**(.env.local,
`NODE_PATH=<프로젝트>/node_modules npx tsx <스크립트>`, 스크립트는 스크래치패드·검산 후 삭제).
룰 등록도 같은 방식(service_role)으로 하며 사전 중복 확인+등록 후 jsonb 원본 대조 필수.

## 8. 기준일 배너 (RuleBasisBanner) 동작

서버 컴포넌트+네이티브 details(기본 접힘). props.taxTypes(세목 배열)로 오늘(KST) 기준 유효한
confirmed+proposed 룰을 집계 — 최근 시행일·마지막 갱신일·룰 N건 자동 산출(사람이 적는 값
없음). proposed 섞이면 경고색. 룰 0건이면 그 사실 표시. 세목 지정: acquisition·transfer는
['세목','common'], stamp·brokerage는 자기 세목만, property·comprehensive는 자기 세목만
(종부세가 재산세 룰을 부품으로 쓰지만 과대 집계 방지 — 승인된 판단. 실제 쓰인 재산세 룰은
결과 근거 목록에 나옴), **registration은 ['registration','acquisition','stamp','common'],
net-proceeds는 ['transfer','brokerage','common']**(타 세목 계산이 본체라 포함 — 승인된 판단).
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
   수정 후 재검사, Medium 이하 보고만(+인계서 기록 지시 따름).
4. **병행 세션**: 미커밋 변경·커밋 불가침. 같은 파일에 남의 변경이 섞이면 내 hunk만 선별
   스테이징. 푸시 전 `git fetch` 후 `git log origin/main..HEAD`로 혼입 확인 — **이쪽 커밋이
   병행 푸시에 딸려 나간 전례 8회**. 빌드 실패가 내 변경과 무관한 파일이면 병행 세션 미완성
   상태일 수 있음(기다렸다 재시도). `.next` 공유 — 캐시 오류·경합 시 재빌드하되, **병행
   세션이 빌드 중일 때 rm -rf .next는 서로를 깨뜨리는 악순환**(대기 후 rm 없이 재시도 권장).
5. 검산·배포 확인: 운영 반복 curl 금지(429 전례) — Vercel MCP 배포 조회+브라우저 확인.
   첫 클릭이 하이드레이션 전에 씹히는 증상 상존 — 재클릭. **브라우저 자동화의 form_input은
   체크박스의 React 상태를 못 바꾼다 — 체크박스는 반드시 실제 클릭**(S5 스팟체크 전례).
   레이아웃이 밀리면(미리보기 등장 등) 좌표를 스크린샷으로 재확인.
6. transfer.ts(552줄)·comprehensive.ts(353줄)·acquisition.ts(352줄)·NetProceedsForm(356줄+α)은
   승인 예외 — 나누지 말 것. TAX_TYPES(6종)와 RULE_TAX_TYPES(11종) 합치지 마라. 새 룰 키는
   VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE 양쪽에.
7. `next lint` 불가(설정 없음) — tsc+build로 검증. 마이그레이션 비멱등 — 운영 재실행 금지.
   CLAUDE.md 공통 규칙(한국어 JSDoc·any 금지·@theme 토큰·보고는 한국어·표 없이 문단) 준수.

## 10. 보류 목록

### 10-1. 이번에 해소됨 (85a686c 배포 완료 — 목록에서 제거)
실수령액 필요경비 힌트 불일치(S6 M③) · 등기 인지세 취득일 기준 안내(S6 M② — 안내로 해소,
계약일 입력은 추가 안 함) · 실패 문구 일률(→ CalcFailureNotice 원인별 구분) · 입력 변경 후
이전 결과 잔존(8종 폼 초기화 — 이월 항목 '취득세 stale 결과' 포함 해소) · 등기 unresolved
영문 노출(S6 M⑤) · 실수령액 기타 비용 행 소멸(S6 M⑥). 채권 면제 표현 불가(→ exempt 행,
3c537ac).

### 10-2. 잔여 보류 (수정 금지 지시 유지 — 지시 있을 때만 손댈 것)

**S5 Medium 2**: ① 과세기준일 룰을 연중 시행일로 등록하면 연초 조회 실패 — 오류 메시지가
사정을 설명 못함(가이드 경고로 완화). ② 종부세 배너가 재산세 룰 미집계(승인된 설계 — 한계 인지).
**S5 Low 8(요지)**: 종부세 과세표준 0 절사 시 맥락 없는 재산세 오류 문구 · 계산 과정 표시
뺄셈 불일치 가능(rawTax 절사 시점) · 극소 양수 상한(의도 동작) · 나이·연수 placeholder 경계
(전례상 허용) · 주택 수 1/2/3 고정 · 재산세 도시지역 체크 접힘 후 유지 · 종부세 상한 비교
비대칭(승인 산식) · property.ts 305줄(승인).
**S6 Medium 잔여 2+1**: ① 채권 손실률 미입력이어도 bond 룰 선조회 — 룰 미등록이면 전체
중단(필수 룰 대원칙 부합 측면 — 의도 여부 판단 필요). ④ 채권 행이 is_metro 조건일 때
metro_scope 룰이 근거 누락(양도세도 동일 전례). 불확실: 인지세 전액 매수인 부담 합산 전제
미안내(세법 해석 필요).
**S6 Low(요지)**: 경과조치 날짜 함수 복제(transfer/net-proceeds page) · netProceeds 필드명이
양도세 breakdown과 정의 다른데 동명 · transfer 결과 통째 전달로 appliedRules payload 중복 ·
등기 폼 주택 수 정수 미검증 · 실수령액 큰 숫자 산식 캡션 없음 · 중개수수료 기준일=양도일 ·
text-[11px]·아이콘 직접 import·aria-hidden·OG 이미지(전역 관례·과제).
**S3 잔여**: 전세(월세 0) 환산 표시 오해 · 단수 처리 코드 고정(floor) · 거래금액 0원 허용 ·
매매 결과에 입력 금액 미표기.
**이월(과거분)**: 유상 분기 giftTaxBaseChoice 무시 · fetchValidRules가 rule_key로만 묶음
(common/세목 동일 키 충돌 소지 — 현재 키 전부 고유) · 계산 액션 rate limit 부재·이력 보존
정책 없음 · 규제지역 이력 겹침 방어 없음 · 300줄 초과(rule-value·engine-types·CalculatorForm·
Navbar — 승인 예외 외).

## 11. 미해결·다음 후보

acquisition.gift.heavy 등록(증여 중과 개방 — 값 지시서 필요) · heavy 룰 미등록 vs 법정 유예
구분 불가(의도된 설계 — 인지) · 규제지역 이력 0건 지역의 "비규제" 단정 표시 · 종부세가 조정
판정을 쓰게 될 경우 규제지역 applies_to 확장 · 법제처 개정 감시(law_id·tax_law_change_queue
준비됨 — property·comprehensive·registration 일부 룰은 law_id 미확인으로 비움) · 회귀 테스트
실행기(tax_test_cases — 검산 케이스 30건이 지시서들에 있음) · 개정안 모드 확산(취득세만 UI
보유. 2026 세제개편안 통과 시 종부세 basic_deduction·assessment_ratio·burden_cap 갱신 필요 —
룰 note에 예고 기록됨) · 이력 조회 관리자 화면(input.calculator 구분 표시 필요).

## 12. 새 세션이 처음 읽어야 할 파일 순서

1. **이 파일** (HANDOVER-calc-2026-08-16.md)
2. 작업 대상 Stage의 설계 문서(prompts/feat-tax-*)와 값 지시서(prompts/*-룰-등록.md)
3. `src/lib/tax/types.ts` → `labels.ts` — 세목 체계
4. `engine-types.ts` → 대상 세목의 `*-types.ts` — 계약. 이어서 `rule-store.ts` →
   `rule-value.ts` → 대상 `*-rules.ts` → (양도 관련이면) `period.ts`
5. 엔진: 단순한 것부터 `stamp.ts` → `brokerage.ts` → `acquisition.ts` → `property.ts` →
   `comprehensive.ts`(재산세 호출 전례) → `transfer.ts`(4대 구분 필독) →
   `registration.ts`·`net-proceeds.ts`(조립형 전례)
6. `calculators.ts` → `tax/layout.tsx` → `_components/`(TaxNav·ApartmentOnlyNotice·
   RuleBasisBanner·**CalcFailureNotice**)
7. 최신 화면 본보기: 조립형은 `tax/net-proceeds/` 4종, 단독형은 `tax/property/` 4종
8. 관리자: `rules/rule-guides.ts`(+세목별 분리 파일 4개) → `rules/actions.ts`
   (VALUE_VALIDATORS·KEY_REQUIRED_TAX_TYPE) → `areas/`
9. `supabase/migrations/055~059`
