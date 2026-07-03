# audit-license-pc-limit

You are a senior Next.js 15 (App Router) / TypeScript / Supabase / Google Sheets engineer auditing the **CoreZent** server codebase — the backend that the GenieWork desktop app calls for license validation (`/api/license/*`). This is a **READ-ONLY 점검**. 원인·사실만 찾아 보고하고, 코드는 한 줄도 고치지 않는다.

## 점검 목적 (Steve의 질문)
GenieWork 라이선스가 화면에 "3PC"로 표시되는데 **실제로 3대까지 인증이 되는가?**
그리고 Steve가 원하는 최종 상태는 **"정해진 출처(예: Supabase)에 PC 수가 N이면 실제로 N대까지 인증"**.
지금 그게 성립하는지, 안 되면 **무엇이 빠졌는지**를 확정한다.

배경(이미 확인된 사실): GenieWork **앱(클라이언트)에는 PC 한도 강제 로직이 전혀 없다.** 앱은 `key + hwid`를 서버로 POST하고, 서버 응답(valid/만료/tier)을 받아 게이트만 한다. tier 문자열 "3pc"는 앱에선 **표시용 라벨**일 뿐이다. → 따라서 **한도의 실체는 이 CoreZent 서버**에 있고, 그게 이번 점검 대상이다.

## STRICT RULES
- **READ-ONLY**: 코드/파일/마이그레이션/DB/git **변경·생성·삭제 0.** 오직 읽고 보고. **수정안을 코드로 쓰지 말 것**(방향만 글로).
- **추측 금지**: 모든 결론은 실제 코드/스키마를 연 **`파일:줄` 근거**. 본 문서의 경로·줄번호는 "출발점"일 뿐, 반드시 실제 파일을 열어 확인.
- **라벨 vs 강제 구분**: 어떤 값이 "화면 표시용"인지, "실제 인증 차단(슬롯 카운트)에 쓰이는지"를 명확히 분별해서 보고. (예: tier "3pc"가 표시만 되는지, 숫자 3으로 파싱돼 한도 비교에 쓰이는지)
- **다른 작업자/다른 CC 세션의 미커밋 변경 미접촉.**
- 각 발견마다: **①관찰 ②근거(파일:줄) ③공용 영향 범위 ④이 값이 '강제'인지 '표시'인지.**
- 불명확하면 "확인 필요"로 표시. 없는 걸 있다고 하지 말 것.

## STEP 0 — 라이선스 검증 파이프라인 지도
먼저 전체 경로를 그린다(입력 → 라우트 → 데이터 출처 → 응답 → 게이트):
- 앱의 `validate(key, hwid)` 요청이 도착하는 라우트: `src/app/api/license/validate/route.ts`(+ `src/app/api/license/_lib.ts`).
- 같이 볼 것: `reset/route.ts`, `upgrade/route.ts`(슬롯 해제·업그레이드), `src/lib/sheets.ts`.
- 각 단계에서 **읽는 데이터 출처**가 Google Sheets인지 Supabase인지 표시.
- ★ **'한도값 실배선' 점검(껍데기 0)**: "3pc"/`max_devices` 같은 한도 표현이 **실제 인증 차단 분기까지 연결되는지**, 아니면 어디선가 표시용으로만 쓰이고 검증엔 안 닿는지.

## 점검 항목 (각 항목 파일:줄 근거)

### A. 요청 착지점
- validate 핸들러가 **실제로 무엇을 검사**하는지 단계별(키 조회 → 정지/만료 → HWID 처리 → 응답).
- 응답에 한도 관련 필드(activation_limit/usage/instance 등)가 있는지.

### B. 한도가 저장된 곳 — 셋 중 어디인가
- **(a) Google Sheets**: `_lib.ts`/`sheets.ts`가 읽는 시트가 어느 것인지 env로 확인 — `GOOGLE_SHEET_ID`/`GOOGLE_SHEET_TAB`(GenieStock 전용 시트) vs `GOOGLE_SHEETS_SPREADSHEET_ID`/`GOOGLE_SHEETS_TAB_NAME`(CoreZent 시트). 그 시트의 **열 구조**(A이메일/B시리얼/C HWID/D만료/E상태/F/G…)에서 **PC 한도 숫자 또는 HWID 여러 개를 담는 열이 있는가**(C가 단일 HWID 한 칸인가).
- **(b) Supabase**: `licenses.max_devices` 컬럼과 `license_activations` 테이블(디바이스별 행, `UNIQUE(license_id, device_fingerprint)`)이 **validate 경로에서 실제로 읽히거나 쓰이는가**. 아니면 정의만 돼 있고 데스크톱 검증이 안 쓰는 **죽은 자산**인가.
- **(c) tier 문자열**: "3pc" 같은 문자열을 서버가 **숫자 한도(3)로 파싱**하는 코드가 있는가.
- **grep 전수**(서버에서 한도 숫자를 쓰는 곳): `max_devices`, `license_activations`, `max_activations`, `activation_limit`, `seats`, `pc_limit`, 그리고 `\d+pc` 형태 파싱.

### C. ★ 단일 HWID vs 멀티 슬롯 (핵심 결론)
- 현재 validate가 HWID를 **1개만**(시트 C열 단일 칸) 저장·대조하는가, **여러 HWID 슬롯**을 세는가?
- 다른 HWID가 왔을 때: **무조건 HWID_MISMATCH로 차단(=사실상 1대)** 인가, **한도 내면 추가 등록(=N대)** 인가?
- → **결론: 지금 "3pc"가 실제 3대 인증을 허용하는가? (예/아니오 + 파일:줄 근거).**

### D. 출처·동기화 관계 (Steve 목표 직결)
- LS 웹훅이 라이선스 생성 시 **Supabase(`licenses`)·CoreZent 시트·GenieStock 시트** 중 어디에 무엇을 쓰는가. "3pc"(또는 `max_devices`) 값이 **어디서 정해져 어디로 흘러가는가**.
- Steve 목표("정해진 출처의 PC 수 = 강제 한도")가 되려면 validate가 그 출처를 읽어야 한다 — **현재 validate가 그 출처(특히 Supabase `max_devices`)를 읽는가, 안 읽는가.**

### E. 부가 위험 (서버 측)
- **HWID 안정성**: 같은 PC가 유선↔무선·VPN·도킹·호스트명 변경으로 **다른 HWID**가 되면 슬롯을 추가 소모하는 구조인지(고객이 "3대인데 못 쓴다" 체감 가능).
- **fail 방향**: 시트/DB 장애 시 한도 검사가 **fail-open(무조건 통과)** 인지 **fail-closed(차단)** 인지(매출·보안 영향).

## 반드시 답할 결론 3가지
1. **"3PC = 실제 3대"가 지금 성립하는가?** (예/아니오 + 근거 파일:줄)
2. 한도의 **실제 단일 출처**는 무엇인가 — Supabase `max_devices` / 시트 열 / tier 문자열 / **아예 없음(단일 HWID라 항상 1대)** 중 무엇인지.
3. Steve 목표("출처의 PC 수 N → 실제 N대 인증")로 가려면 **무엇이 빠졌는가**(방향만, 코드 금지). 예: validate가 단일 HWID만 저장 → 멀티 슬롯 미구현 / validate가 Supabase 미연동 → `max_devices` 안 읽음 / 출처가 시트라면 시트에 슬롯 열이 없음 등.

## 출력 형식
```
🔍 라이선스 PC 한도 점검 결과

[핵심 답] "3PC = 3대" 성립: 예 / 아니오
  근거: 파일:줄 …

[STEP 0 파이프라인 지도] 입력 → 라우트 → 출처(시트/Supabase) → 응답 → 게이트
[A 요청 착지점] …
[B 한도 저장 위치] (a)시트 / (b)Supabase / (c)tier 중 실제 강제에 쓰이는 것 …
[C 단일 vs 멀티슬롯] … (← 핵심)
[D 출처·동기화] Supabase max_devices를 validate가 읽는가: 예/아니오 …
[E 위험] HWID 안정성 / fail 방향 …

[갭 분석 — Steve 목표까지 필요한 변경 (제안만)]
- …

확인 필요(불명확) 항목: …
```

코드/DB/파일/git 변경 없음. 수정은 별도 승인 후 fix 프롬프트로.
