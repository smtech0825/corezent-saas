# fix-license-reset-abuse

You are a senior Next.js 15 (App Router) / TypeScript / Supabase engineer on the **CoreZent** server codebase (the backend GenieWork desktop app calls at `/api/license/*`). Close the **PC-change (reset) abuse hole** so a license can't cycle through unlimited PCs over its validity period. **Server-side only — do NOT touch the GenieWork app.** Work Wave by Wave; stop and report at each Wave end.

## 확정된 배경 (두 점검으로 확인됨)
- GenieWork는 멀티 슬롯(`license_keys.tier` "3pc"→3)으로 **동시 N대**는 정상 강제. 그러나:
- reset이 **키의 모든 HWID를 전체 삭제**(`_lib_supabase.ts` 추정 :264-279, 보낸 hwid 무시 `reset/route.ts:24-25`)하고, 삭제 후 카운트 0 → 다시 N대 등록 가능. **거쳐간 PC 누적 기록·상한 없음** → 무제한 순환.
- reset에 **소유권·횟수·BotID 통제 0**(`reset/route.ts`) → 키만 알면 무한 reset.
- 앱은 정상(서버 reset을 자기 HWID로 호출, 서버 OK 후에만 로컬 정리). **막는 층은 전부 서버.**
- ※ 위 줄번호는 출발점. 반드시 실제 코드를 열어 확인.

## 이번 범위 (확정)
- **Wave 1 = ⑤** reset/등록 경합·남용 차단 (TOCTOU + rate limit)
- **Wave 2 = ②** reset 주기 제한 (예: 30일 N회)
- **Wave 3 = ③** 누적 PC 상한 (한 키가 거쳐갈 수 있는 distinct PC 총수 상한)
- **범위 밖(나중에 앱과 같이)**: ④ 개별 슬롯 해제(전체삭제 대신 1대만), ① reset 소유권 검증. 본 지시문에서 하지 말 것.

## STRICT RULES
- **서버(CoreZent)만 수정.** GenieWork 앱 저장소·앱 코드 미접촉.
- **추측 금지**: 본 문서 경로·줄번호는 출발점. 실제 코드/스키마를 연 `파일:줄` 근거 위에서만.
- **보편 해결 / 하드코딩 금지**: 상한 숫자·주기·횟수·rate 한도는 **전부 설정 출처(아래 config)에서 읽는다.** 코드에 리터럴로 박지 말 것. 어떤 값으로 바꿔도 견디는 순수 로직.
- **금액/카운트 계산은 결정적 코드.** AI 없음.
- **in-place 수정만·지정 파일만·무관 리팩터 금지.**
- **다른 작업자/다른 CC 세션 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) Critical/High 0 → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음. (lint은 ESLint 설정 부재 시 build 정적검사로 갈음, 사유 명시)
- 각 작업 보고: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임.**
- **돈·접근권한이 걸린 경로**: 에러를 조용히 삼키지 말 것. reset/validate 경로의 DB 오류는 fail-closed 유지(차단) + 전파/로깅.

## 설정 출처 (무하드코딩) — 기본값, 운영자가 변경 가능
한도/주기/카운트 규칙을 담을 **단일 설정 출처**를 둔다(예: 라이선스 program config 테이블 또는 license_keys 보조 컬럼 — Wave 0에서 실제 스키마 확인 후 결정). 기본값:
- `reset_period_days` = 30, `reset_max_per_period` = 2  (②)
- `lifetime_pc_multiplier` = 2  → 누적 상한 = tier 동시한도 × 2 (예: 3pc → 누적 6대) (③)
- `license_api_rate_per_min` = (적정값, 예 10) (⑤)
> 이 값들은 코드 리터럴이 아니라 설정에서 읽어야 한다. 설정 테이블/컬럼이 없으면 Wave 0에서 보고하고, Wave 1 직전에 추가(마이그레이션)할지 결정.

---

## WAVE 0 — 조사 (READ-ONLY · 코드/DB/git 0 변경)
보고만. 수정안 코드 금지.
1. **reset 경로 전체**: `reset/route.ts`(핸들러·인증 유무·body 파싱) + `_lib_supabase.ts`의 reset/등록/카운트 함수(파일:줄). validate 등록 경로(`validate/route.ts` + `_lib_supabase.ts`)도.
2. **라이선스 DB 스키마 실체**: GenieWork 전용 외부 Supabase(`GW_SUPABASE_*`)의 `license_keys`·`hwid_mapping` 컬럼·UNIQUE·인덱스가 **repo 어디에 정의**돼 있는지(점검상 repo엔 ALTER만 있고 베이스는 외부 생성일 수 있음). → **누적 이력/리셋 카운트/설정을 어디에 저장할지** 판단 근거 확보.
3. **설정 출처 후보**: ②③⑤ 규칙값을 담을 곳(신규 config 테이블 vs license_keys 보조 컬럼 vs 기존 config). 어느 게 깔끔한지 보고.
4. **누적 이력 저장 방법**: 거쳐간 distinct HWID를 어떻게 셀지(예: 삭제 대신 보존하는 이력 테이블 `hwid_history`, 또는 hwid_mapping에 soft-delete 플래그). 현재 reset이 hard delete라 이력이 사라지는 점 확인.
5. **rate limit 현황**: `/api/license/*`에 rate limit/BotID가 없는지(`contact/route.ts`의 in-memory 맵 패턴 참고), Vercel 단일 리전 제약.
→ **STOP & 보고.** 이 결과로 "설정/이력을 어디에 둘지" 확정 후 Wave 1.

---

## WAVE 1 — ⑤ 경합·남용 차단 (TOCTOU + rate limit)
- **TOCTOU**: validate의 "카운트 → insert" 사이 경합으로 동시 신규 HWID 2건이 한도(N)를 넘겨 insert되는 것 차단. **DB측 원자성**(트랜잭션/원자적 카운트+insert, 또는 `hwid_mapping`에 distinct 보장 제약) 또는 직렬화로. 단일 HWID 중복 insert도 방지(UNIQUE 확인/추가는 Wave 0 스키마 결과 따라).
- **rate limit**: `/api/license/reset`(우선)과 등록 경로에 IP/키 기준 rate limit. 설정값(`license_api_rate_per_min`)에서 읽기. (BotID는 앱이 토큰 발급 불가하므로 적용하지 말 것 — rate limit으로.)
- fail-closed 유지. 정상 사용자 흐름(첫 N대 등록) 깨지지 않게.
검증 → 변경 파일만 커밋 → **STOP & 보고.**

---

## WAVE 2 — ② reset 주기 제한
- reset 호출 시 **그 키의 최근 reset 이력**(횟수·시각)을 기록하고, `reset_period_days` 내 `reset_max_per_period`를 초과하면 **거부**(명확한 errorCode, 예 `RESET_RATE_LIMITED` + 다음 가능 시각 안내 가능하면 포함).
- 기록 위치는 Wave 0에서 정한 출처. 카운트·시각 비교는 결정적.
- 정상 교체(주기 내 허용 횟수)는 그대로 동작. 설정값에서 읽기(하드코딩 금지).
검증 → 커밋 → **STOP & 보고.**

---

## WAVE 3 — ③ 누적 PC 상한
- 한 키가 **거쳐간 distinct PC(HWID) 총수**를 기록·집계한다. reset이 hard delete라 현재는 이력이 사라지므로, **이력 보존 방식**(Wave 0에서 정한 `hwid_history` 등)으로 거쳐간 HWID를 누적.
- 새 HWID 등록(validate registerHwid) 시: 누적 distinct 수가 **상한(= tier 동시한도 × `lifetime_pc_multiplier`, 기본 2배)** 이상이면 **신규 등록 거부**(errorCode 예 `LIFETIME_PC_LIMIT_REACHED`). 이미 거쳐간 HWID 재등록은 누적에 안 더함(같은 PC 재방문은 허용).
- 상한·배수는 설정에서 읽기. 동시 한도(tier)와 **별개 지표**임을 명확히(동시=현재 행 수, 누적=거쳐간 distinct).
- reset은 동시 슬롯은 비우되 **누적 이력은 보존**(상한 계산용). 즉 reset해도 누적은 안 줄어듦.
검증 → 커밋 → **STOP & 보고.**

---

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀(`tsc` + `build` + bug-detective/code-guardian Critical/High 0).
- DB 변경이 있었다면 **마이그레이션 파일은 만들되 적용은 운영자가 직접**(SQL Editor) — push로 DB가 바뀌지 않음을 명시. 외부 GW Supabase 대상이면 어느 프로젝트에 적용할지 안내.
- **그때 한 번만 `git push origin main`**(Vercel 배포, 규칙 14). Wave 중간 push 금지.
- `result-explainer-ko` 비개발자 요약(달라진 점·운영자가 조정할 설정값·확인 방법).

## 범위 밖 (이번에 하지 말 것 — 나중에 앱과 같이)
- **④ 개별 슬롯 해제**: 서버 reset이 특정 hwid만 지우게 + 앱에 "등록 PC 목록·선택 해제" UI. 앱 수정이 동반되므로 별도.
- **① reset 소유권 검증**: 로그인 소유자만 reset. 앱↔서버 인증 방식 변경 동반이라 별도.

## 진행 중 멈춤 규칙
- 라이선스 DB 스키마(외부 Supabase) 실체가 불명확하거나, 설정/이력 저장 위치가 코드로 확정 안 되면 **추측 말고 멈추고 보고**(가설과 다르면 수정 전 정지).
- 새 마이그레이션이 외부 GW Supabase 대상이면, 본체 CoreZent DB와 혼동하지 말 것(점검상 둘은 분리).
