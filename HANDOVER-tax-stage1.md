# HANDOVER — 부동산 세금 계산기 Stage 1 (취득세)

> 작성: 2026-08-11 세션 종료 시점. 다음 세션이 이 문서만 읽고 이어서 작업할 수 있도록 작성함.
> 원 설계 문서: `prompts/feat-tax-s1-acquisition-engine.md` (Wave 규칙·완료 판정 5개 포함)

> ⚠️ **2026-08-12 W6 추가** (설계 문서: `prompts/feat-tax-s1-w6-rule-fields.md`)
> 조건 필드 확장 작업(S1-W6)으로 **마이그레이션 057**(`057_tax_rules_common_and_law_ref.sql` —
> tax_type CHECK에 'common' 추가 + law_id·law_article_no 컬럼)이 생겼다.
> **057을 적용하지 않은 채 W6 커밋을 배포하면 관리자 룰 저장·수정이 전부 실패한다**
> (저장 페이로드에 새 컬럼이 항상 포함되므로 PGRST204). 적용 순서: 055 → 056 → **057**.
> 055·056은 2026-08-12 운영 DB 적용 완료 확인, 057은 파일만 존재(미적용).
> 아래 본문 중 "커밋 6개·푸시 보류" 등 Stage 1 시점 서술은 2026-08-12 전량 배포로 해소되었다.

---

## 0. 현재 상태 요약

- **코드 완성**: Wave 0(조사) → 1(DB) → 2(엔진) → 3(계산기 화면) → 4(관리자) → 5(점검) 전부 완료. (2026-08-12 W6 확장 작업은 상단 블록과 `prompts/feat-tax-s1-w6-rule-fields.md` 참조)
- ~~푸시 보류~~ **(해소, 2026-08-12)**: Stage 1 취득세 커밋과 혼입 auth/ui 커밋은 전량 푸시·배포 완료됨.
- **DB 적용 현황 (2026-08-12 갱신)**: 055·056은 운영 DB **적용 완료 확인**(재실행 금지 — 비멱등, §7 참조). **057은 파일만 존재(미적용)** — W6 커밋을 배포하기 전에 SQL Editor에서 057을 1회 실행해야 함. 미적용 상태로 배포하면 관리자 룰 저장·수정이 전면 실패함(상단 W6 블록 참조).
- **룰 데이터 0건(의도된 설계)**: 관리자가 `/admin/tax/rules`에서 법령 근거와 함께 직접 입력해야 계산이 동작함. 시드 데이터는 원칙적으로 금지.
- **완료 판정 5개**(설계 문서 하단) — 룰 입력 후 실제 화면에서 확인해야 하는 미완 항목.

---

## 1. 만든 파일 전체 목록과 역할

### 마이그레이션 (supabase/migrations/)
- `055_tax_engine_schema.sql` — 테이블 5개 + RLS + 인덱스 + updated_at 트리거. 시드 0건. RLS 방침: 룰·규제지역만 공개 SELECT, 나머지 3개는 정책 0개(=service_role 전용, 047·049 관례).
- `056_tax_rules_no_overlap.sql` — `btree_gist` 확장 + EXCLUDE 제약. 같은 (tax_type, rule_key, status)에서 시행 기간 겹침을 DB가 거부. status가 다르면(확정 vs 개정안 병행) 허용 — 의도된 설계.
- `057_tax_rules_common_and_law_ref.sql` — (W6, 2026-08-12) tax_type CHECK에 'common'(전 세목 공통 룰 — region.metro_scope용) 추가 + law_id·law_article_no(법제처 6자리, 형식 CHECK) 컬럼. 시드 0건. **미적용 상태.**

### 계산 엔진 (src/lib/tax/)
- `types.ts` — DB 5개 테이블 행 타입 **수동** 정의. 이 프로젝트는 DB 타입 자동 생성을 쓰지 않음.
- `engine-types.ts` — 엔진 입력(`AcquisitionInput`)·결과(`AcquisitionSuccess`)·오류(`TaxEngineFailure`)·rule_value(jsonb) 스키마 타입. 구조만 있고 숫자는 없음.
- `rule-store.ts` — `fetchValidRules`(기준일 유효 룰 로드, proposed 우선, 충돌 검출), `isRegulatedArea`(규제지역 판정), `isValidDateString`/`isValidRegionCode`(PostgREST 필터 인젝션 방어).
- `rule-value.ts` — rule_value 런타임 검증(parse*), 세율 평가(`evaluateRateSpec`), 조건 매칭(`matchConditions` — 모르는 필드는 오류로 중단), 세율 행 선택(`selectRateRow` — 0건/동률이면 오류), 간주 판정(`isDeemedGift`), 단수 처리(`applyRounding` — 기본 1원 버림).
- `acquisition.ts` — 취득세 오케스트레이터. 유상/증여 분기, 배우자·직계존비속 간주, 증여 중과(공시가격 기준·증여자 1주택 제외), 세액 3분해 + 적용 룰 근거 반환. 룰 키 상수 `ACQUISITION_RULE_KEYS`.
- `regions.ts` — 전국 시·도/시·군·구 **이름** 목록 + `buildRegionCode()`. ⚠️ 규제지역 목록이 아님(중립 참조 데이터). 규제 여부는 오직 DB가 결정.
- `labels.ts` — 세목·상태·구분의 한국어 라벨과 런타임 목록(화면 select와 서버 검증이 공유하는 단일 출처).

### 계산기 화면 (src/app/tax/acquisition/)
- `page.tsx` — 퍼블릭 페이퍼 테마. SEO 메타데이터, 하단 고정 고지(참고용·법적 효력 없음 + 마지막 룰 갱신일).
- `actions.ts` — 서버 액션: BotID 검증(실패 시 fail-open) → 소재지 목록 검증 → 엔진 호출 → 성공 시 `tax_calculation_logs` 기록(**PII 절대 금지** — IP·이메일·이름·user id 없음).
- `CalculatorForm.tsx` — 기본 입력 + 고급 접힘(증여 선택 시 자동 전개), 룰 모드 토글(기본=확정된 법), 액션 호출 전체 try/catch(예외가 에러 바운더리로 못 가게).
- `ResultPanel.tsx` — 취득세·지방교육세·농어촌특별세 각각 + 합계, 근거 영역(법령명·조문·시행일·원문 링크·확정/개정안), 개정안 경고 배지(`result.ruleMode` 기준 — 현재 토글 아님), 계산 불가 시 0원 대신 사유 안내.

### 관리자 (src/app/admin/tax/)
- `page.tsx` — `/admin/tax` → `/admin/tax/rules` 리다이렉트(사이드바 착지점).
- `_components/TaxTabs.tsx` — 룰 편집 ↔ 규제지역 탭.
- `rules/page.tsx`·`RulesManager.tsx`·`RuleForm.tsx`·`actions.ts`·`rule-guides.ts` — 룰 목록(시행일 내림차순)·등록·수정. 시행일·status·법령명·조문·원문 링크 필수 강제. 기간 겹침은 저장 전 경고 → 재클릭 저장. rule_value는 엔진과 같은 검증기로 저장 시 스키마 검사. rule-guides는 룰 키별 입력 형식 안내(«...» 자리표시자 — 실제 값으로 바꾸지 않으면 JSON 파싱 실패로 저장 거부됨).
- `areas/page.tsx`·`AreasManager.tsx`·`actions.ts` — 규제지역 이력 입력·수정. 소재지는 계산기와 **같은 regions.ts + buildRegionCode** 재사용(코드 불일치 원천 차단). 공고 링크 필수.

### 수정한 기존 파일 (2곳)
- `src/app/admin/_components/AdminSidebar.tsx` — '세금 룰' 링크 1곳 추가(Scale 아이콘, `/admin/tax`).
- `src/instrumentation-client.ts` — BotID 보호 목록에 `/tax/acquisition` POST 추가.

---

## 2. 커밋 해시 (시간순 — 이 기능의 커밋은 6개)

1. `ca30d39` — [S1 Wave 1] 마이그레이션 055(테이블 5개) + `src/lib/tax/types.ts`
2. `170b458` — [S1] 마이그레이션 056(기간 겹침 EXCLUDE 제약)
3. `0a814d8` — [S1 Wave 2] 계산 엔진 4개 파일
4. `1f95108` — [S1 Wave 3] 계산기 화면 `/tax/acquisition` + regions.ts + 지역 코드 검증 완화
5. `d810d88` — [S1 Wave 4] 관리자 룰 편집·규제지역 화면 + 사이드바 링크 + labels.ts
6. `e3d5341` — [S1 Wave 5] 점검 High 4건 수정(경고 스냅샷·증여 입력 노출·BotID·예외 격리)

> "커밋 7개"로 전달된 적이 있으나 실제는 위 6개가 전부다. 이 인계서(HANDOVER-tax-stage1.md)는 미커밋 상태로 남겨두었다.
> ⚠️ 원격 미푸시 구간에는 위 6개 외에 다른 세션의 auth/ui 커밋 10개(`dfee0dd`·`45cb328`·`85ac0a4`·`215f326`·`d806509`·`834a2c2`·`e44ad4d`·`bf3fef3`·`ce94d90`·`fb402c7`)가 섞여 있다. 푸시하면 함께 배포된다.

---

## 3. DB 테이블 5개 구조 요약 (전부 `tax_` 접두어, 본체 Supabase)

- **tax_rules** — 룰 저장소. tax_type(6종 CHECK — 057 적용 시 'common' 포함 7종) · law_id/law_article_no(057, NULL 허용 — 법령 개정 자동 감시용) · rule_key · rule_value(jsonb) · effective_from(NOT NULL) · effective_to(NULL=무기한, **종료일 당일 포함**) · status(confirmed/proposed/repealed CHECK) · law_name/law_article/law_url(**전부 NOT NULL** — 근거 없는 룰 저장 불가) · note · created/updated_at(트리거). 인덱스 (tax_type, effective_from, status). 056의 EXCLUDE 제약으로 같은 키·같은 상태의 기간 겹침 불가. RLS: 공개 SELECT.
- **tax_regulated_areas** — 규제지역 이력. sido·sigungu·region_code(이름 기반) · area_type(adjustment/speculation CHECK) · applies_to(text[], 'all' 또는 세목들, CHECK로 값 제한) · designated_from(NOT NULL)·designated_to(NULL=현재 지정) · source_url(NOT NULL) · created/updated_at(트리거). 인덱스 (region_code, area_type, designated_from). RLS: 공개 SELECT. ⚠️ 겹침 방어 없음(미해결 항목 참조).
- **tax_test_cases** — 회귀 테스트 케이스(이번 Stage는 테이블만, 실행기 없음). tax_type · input(jsonb) · expected_total(≥0) · expected_breakdown(jsonb, NULL 허용) · source · verified_at · note. RLS: 정책 0개(service_role 전용).
- **tax_calculation_logs** — 계산 이력. tax_type · base_date · rule_mode(confirmed/proposed CHECK) · input(jsonb) · output(jsonb) · applied_rule_ids(jsonb 배열). **PII 저장 금지.** RLS: 정책 0개.
- **tax_law_change_queue** — 법령 개정 감지 큐(다음 Stage용, 현재 아무 코드도 쓰지 않음). law_name · law_id · article_no · detected_at · effective_date · change_type · raw_payload · status(pending/reviewed/ignored) · reviewed_at. RLS: 정책 0개.

---

## 4. 취득세 룰 키 6종과 rule_value 형식

값(숫자)은 전부 관리자가 입력한다. 형식 안내·스켈레톤의 단일 출처는 `src/app/admin/tax/rules/rule-guides.ts`, 검증기는 `src/lib/tax/rule-value.ts`.

1. **acquisition.onerous.rates** — 유상취득 세율표. `{ rows: [{ when, priority?, rates: { acquisition, local_education, rural_special }, credit? }] }`. when 조건 필드: `price`·`house_count`·`is_regulated`·`area_over_85`·`first_home`·`temporary_two_home`. 세율(RateSpec): `{type:'fixed', ratePercent}` 또는 `{type:'linear_by_base', per, slopePercent, interceptPercent, min/maxPercent?}`(세율% = slope×(과세표준÷per)+intercept — 6~9억 사잇값 공식용). credit: `{target, amount}`(감면액 원).
2. **acquisition.gift.tax_base** — 증여 과세표준 기준. `{ base: 'market_value' | 'official_price' }`. 기준이 바뀐 시점은 시행일을 달리해 룰을 나눠 등록.
3. **acquisition.gift.rates** — 증여 기본 세율표. rows 형식 동일. 조건 필드: `tax_base`·`house_count`·`is_regulated`·`area_over_85`·`donor_relation`('spouse'/'lineal'/'other').
4. **acquisition.gift.heavy** — 증여 중과. `{ officialPriceMin: 원, rows: [...] }`. 조정대상지역 + 공시가격 ≥ officialPriceMin이면 이 rows 적용, 단 증여자 1주택자는 제외.
5. **acquisition.gift.deemed_gift_threshold** — 무상취득 간주 기준. `{ mode:'any'|'all', minDiffAmount?: 원, minDiffRatioPercent?: % }`. 차액 = 시가인정액 − 지급대가. 기준 초과 → 증여로 간주, 미만 → 유상으로 계산. 대가 0원인 순수 증여는 이 룰 없이도 증여로 계산됨.
6. **acquisition.rounding** — 단수 처리(선택). `{ unit: 원 정수, method:'floor'|'round'|'ceil' }`. 미등록 시 1원 단위 버림.

공통 규칙: 여러 행이 맞으면 priority 최고 1건(동률=오류), 조건 연산자는 eq/min/max/in(경계 포함), 모르는 필드명은 오류로 계산 중단. proposed 모드에서는 같은 키에 확정·개정안이 있으면 개정안 우선.

---

## 5. 엔진 오류 코드 (engine-types.ts `TaxEngineErrorCode`)

- `INVALID_INPUT` — 입력값 오류(형식·필수 누락). BotID 차단·소재지 목록 밖 값도 현재 이 코드를 씀.
- `RULE_NOT_REGISTERED` — 해당 시점의 룰 미등록. **절대 0원으로 대체하지 않는 것이 이 서비스의 핵심 안전장치.**
- `RULE_CONFLICT` — 같은 rule_key에 유효 룰 2건 이상(모드 우선순위로도 정리 안 됨). 조용히 하나를 고르지 않고 중단.
- `RULE_VALUE_INVALID` — rule_value 구조가 스키마와 다름(관리자 입력 오류). 모르는 조건 필드·연산자 포함.
- `NO_MATCHING_RATE_ROW` — 세율표에 입력 조건에 맞는 행 없음(그 조건의 세율 미등록).
- `AMBIGUOUS_RATE_ROW` — 조건에 맞는 행이 priority로도 1건으로 안 좁혀짐.
- `DB_ERROR` — DB 조회/기록 실패.

모든 오류의 message는 화면에 그대로 보여줄 한국어 문장이다.

---

## 6. 다음 세션이 반드시 지켜야 할 원칙

1. **세율·공제·과세표준 구간·중과 배율 숫자를 코드·마이그레이션·시드에 절대 넣지 않는다.** 학습 데이터에서 기억하는 값도 금지. 안내 스켈레톤의 «...» 자리표시자 방식을 유지한다(우연한 0원 저장 방지 장치).
2. **조정대상지역·투기과열지구 목록도 넣지 않는다.** regions.ts는 중립적인 행정구역 '이름' 목록일 뿐이며, 규제 여부는 오직 관리자가 입력한 DB가 결정한다.
3. **룰이 없으면 0원 금지** — RULE_NOT_REGISTERED로 중단하는 구조를 약화시키지 않는다.
4. **region_code는 이름 기반**(`buildRegionCode` = '시·도|시·군·구', 세종은 시·도 이름 그대로). 계산기와 관리자 입력이 같은 함수를 쓰는 구조를 깨지 않는다. 숫자 법정코드를 도입하려면 양쪽+기존 DB 행을 동시에 마이그레이션해야 한다.
5. **Wave 방식**: Wave 끝마다 `npx tsc --noEmit` + `npm run build` 통과 → 변경 파일만 **개별 `git add`**(`git add .` 금지) → 커밋 → **멈추고 보고**. 승인 전 다음 Wave 진행 금지. 푸시는 명시 지시가 있을 때만.
6. **다른 세션의 미커밋 변경·커밋은 건드리지 않는다.** 푸시 전 `git log origin/main..HEAD`로 혼입 여부를 확인하고, 섞여 있으면 멈추고 보고한다.
7. 검증 도구: `next lint`는 ESLint 설정이 없어 비대화형 불가 — tsc+build로 검증. `.next`는 병행 세션과 공유되어 캐시 오류가 나면 삭제 후 재빌드.
8. CLAUDE.md 공통 규칙(한국어 JSDoc, 300줄 제한, any 금지, @theme 토큰, 보고·화면 문구 전부 한국어) 준수.

---

## 7. Medium 이하 미수정 항목 (Wave 5 점검 결과 — 보고만 하고 수정하지 않음)

우선순위 상위:
1. **규제지역 이력 겹침 방어 없음** — 같은 지역·구분에 겹치는 이력을 넣어도 DB·화면 모두 경고 없음. 해제일을 안 닫고 새 행만 넣으면 해제된 지역이 계속 규제로 판정될 수 있음. (권장: `(region_code, area_type)` daterange EXCLUDE 또는 saveTaxArea 겹침 검사)
2. **rate limit 없음** — 계산 액션은 BotID 단독(fail-open 포함). `/api/contact`처럼 rate limit 이중화 권장. tax_calculation_logs에 보존기간·정리 정책도 없음.
3. **조건값 타입 불일치 무시** — `"eq": "true"`(문자열) 같은 타입 오타는 조용히 불일치 처리되어 엉뚱한(낮은 세율) 행이 선택될 수 있음. matchConditions에 타입 검사 추가 권장.
4. **마이그레이션 비멱등** — 055의 트리거·정책, 056의 제약, 057의 DROP CONSTRAINT·ADD COLUMN은 재실행 시 오류(1회 실행이면 문제없음). DROP IF EXISTS 선행 권장.
5. **진입 링크·사이트맵 없음** — `/tax/acquisition`은 고아 페이지. 공개 시 Navbar/Footer 링크 + `src/app/sitemap.ts` 등록 필요.

그 외: 투기과열지구는 등록만 되고 계산 미사용인데 저장 안내는 "즉시 사용됩니다"(AreasManager) · 증여자 1주택 "모르면 선택 안 함" 힌트 vs 엔진의 명시 입력 요구 모순(CalculatorForm) · 중과 적용/미적용 여부가 결과에 표시 안 됨(근거 목록에 중과 룰은 나열됨) · when 조건 오타가 저장 시 안 걸리고 사용자 계산 때 RULE_VALUE_INVALID로 터짐(saveTaxRule 드라이런 검증 권장) · 요청 실패 시 이전 결과 패널 잔존(catch에서 setResult(null) 권장) · 실패 안내 고정 문구("근거가 준비되지 않아…")가 INVALID_INPUT에도 표시됨 · 폼 토글과 결과 배너 시점 불일치 UX · RuleForm 세목 변경 시 rule_key가 '직접 입력'으로 고정 · 조정대상지역이면 중과 룰 무조건 필수(중과 제도가 없던 시기를 표현할 수단 없음) · 규제지역+중과 판정의 donorIsSingleHomeOwner 정규화·donorRelation 화이트리스트 서버 검증 누락(로그 jsonb에 임의 값 유입 통로) · update 0행이어도 "저장되었습니다" · 음수 priority 동작 미정의 · todayString 클라이언트 타임존 · rule-value.ts 305줄(300줄 제한 소폭 초과) · 관리자 페이지 타이틀 접미사 관례 불일치 · CalculatorForm 일부 grid 모바일 2열 고정 · 핸들러 6개 한국어 주석 누락 · OG 이미지 부재(기존 공개 페이지들도 동일) · RuleForm의 겹침 경고 초기화 deps에 status 누락 · min/max 경계(초과/미만 표현) 안내 부족 · 클라이언트 번들에 엔진 코드 유입 여지(룰 키 상수 분리 권장) · regions.ts 시·군·구 목록 운영자 검수 필요.

---

## 8. 미해결 사항·다음 Stage 예정 작업

**즉시 필요한 운영 절차** (코드 아님):
- **057 SQL 적용**(055·056은 2026-08-12 적용 완료 — 재실행 금지. 각 파일 말미에 회귀 검증 SQL 있음) → 관리자에서 취득세 룰 6종(+수도권 조건을 쓰려면 공통 세목의 region.metro_scope) + 규제지역 이력 입력 → 완료 판정 확인(룰 반영·미래 시행일 제외·과거 기준일·개정안 분리+경고 배지·근거 표시).
- ~~푸시·배포 결정(혼입 커밋 10개 문제)~~ — 2026-08-12 전량 배포로 해소. **W6 커밋은 현재 로컬 보류 중이며, 푸시 전 057 적용이 선행 조건.**

**다음 Stage (설계 문서의 제외 범위)**:
- 법제처 OPEN API 연동 — `tax_law_change_queue` 사용 시작(현재 빈 테이블).
- 공시가격·실거래가 API 연동 — 이때 regions.ts에 법정 행정구역 코드 매핑 추가 검토.
- 회귀 테스트 실행기 — `tax_test_cases` 실행·비교.
- 연도별 비교 UI(엔진은 이미 기준일 파라미터 구조라 준비됨).
- 부담부증여·상속·원시취득·토지상가·법인, 나머지 세목(임대·양도·재산·종부·상속증여) 계산기.

---

## 9. 새 세션이 처음 읽어야 할 파일 순서

1. **이 파일** (HANDOVER-tax-stage1.md)
2. `prompts/feat-tax-s1-acquisition-engine.md` — 원 설계 문서. Strict Rules와 완료 판정 5개가 여기 있다.
3. `supabase/migrations/055_tax_engine_schema.sql` → `056_tax_rules_no_overlap.sql` — 데이터 구조와 RLS 방침.
4. `src/lib/tax/engine-types.ts` — 타입을 먼저 읽으면 전체 계약이 보인다. 이어서 `rule-store.ts` → `rule-value.ts` → `acquisition.ts` 순서로 엔진 흐름.
5. `src/app/tax/acquisition/actions.ts` → `CalculatorForm.tsx` → `ResultPanel.tsx` — 화면과 서버 경계.
6. `src/app/admin/tax/rules/rule-guides.ts` → `rules/actions.ts` — 관리자가 무엇을 어떻게 입력하는지(= rule_value 계약의 실무 문서).
7. `src/lib/tax/regions.ts` — 지역 코드 규칙(이름 기반)과 그 이유.
