# audit-corezent-license-server

You are a senior engineer auditing the **CoreZent_SaaS** project (the Next.js/Vercel server behind `api.corezent.com`). This is a **READ-ONLY investigation**. Do not change any code, config, DB, or external service. Do not use git. **Report only** — how the server actually handles licenses today, and what must change to give GenieWork its own dedicated Supabase database.

## 배경 (이 프로젝트가 왜 점검되는지)
- **GenieWork**는 한국 공무원용 데스크톱 앱(Corezent.com 판매). 라이선스 인증 시 앱이 `POST https://api.corezent.com/api/license/validate`에 `{key, hwid, product:"geniework"}`를 보낸다. **이 CoreZent_SaaS가 그 서버**다.
- 문제: GenieWork 라이선스가 **GenieStock(다른 앱)과 같은 Supabase·같은 license_keys 테이블을 공유**하도록 설계돼, LemonSqueezy에서 실제 구매한 GenieWork 라이선스가 등록되지 않거나 섞여서 **인증이 전혀 안 된다**.
- **목표**: GenieWork를 **전용 Supabase로 독립**(전략 1 — 서버 주소 api.corezent.com은 유지하되, 서버가 product==="geniework"일 때 새 전용 Supabase로 분기). 이 점검은 그 독립 설계의 **실제 근거**를 서버 코드에서 확인하는 것.
- 앞선 GenieWork측 점검에서 나온 **"명세(계획서)일 뿐 실제 배포 미확인" 4가지**를 이 프로젝트 실코드로 확정하는 것이 핵심.

## ★보안 주의
- Supabase URL·service role key·anon key·LemonSqueezy API 키·웹훅 시크릿 등 **민감값은 보고에 그대로 출력 금지.** "○○ 파일 ○줄에 있음(값 비공개)"처럼 **위치만**.
- 공개 가능: 테이블 이름·컬럼 구조·엔드포인트 경로·분기 로직 형태.

## STEP 0 — 프로젝트 구조·라이선스 엔드포인트 지도 (먼저)
- 이 프로젝트의 실제 소스 디렉터리(`src/`·`app/`·`pages/` 등)가 있는지 확인하고, 라이선스 관련 파일을 찾는다:
  - `app/api/license/validate`·`upgrade`·`reset` route 핸들러(`파일:줄`).
  - `app/api/webhooks/lemonsqueezy/route.ts`(웹훅 핸들러).
  - Supabase 클라이언트 초기화 파일(`_lib/supabase` 등).
- 각 라이선스 엔드포인트가 **실제로 무엇을 하는지** 요약(키 조회·HWID 등록·tier 판정·만료 확인).

## 점검 A — ★핵심 4가지 (명세 아닌 실코드로 확정)
앞선 점검이 "확인 불가"로 남긴 것들을 이 프로젝트 코드로 판정:
1. **geniework 분기 실재 여부**: validate/upgrade/reset·webhook route에 `product === "geniework"`(또는 상품명 매칭) 분기가 **실제 코드에 있는지**. 있으면 무엇을 하는지, 없으면 "미구현".
2. **tier 처리**: GenieWork tier(`1pc/3pc/5pc/10pc`)를 서버가 인식·처리하는지. license_keys의 tier CHECK 제약이 `lite/pro/max`로 제한돼 GenieWork 키 INSERT가 실패하는지.
3. **product 컬럼**: license_keys에 product 컬럼이 실제로 있는지, 쿼리가 product로 필터하는지(없으면 GenieStock과 키가 섞임).
4. **LemonSqueezy 상품 매칭**: 웹훅이 상품명/variant를 어떻게 GenieWork로 매핑하는지(`tierFromGenieWork` 류 함수). 매칭 실패 시 행 미생성 경로가 있는지.

## 점검 B — Supabase 연결·테이블 현황
- 이 서버가 보는 Supabase **연결 설정 위치**(env 변수명·값 비공개). GenieStock이 보는 것과 **같은 프로젝트인지** 단서(변수명·주석).
- `license_keys`·`hwid_mapping` 등 라이선스 테이블의 **실제 스키마**(마이그레이션 SQL·타입 정의가 프로젝트에 있으면). 컬럼·제약·기본값.
- DB 마이그레이션 파일이 있으면 product 컬럼·tier CHECK의 **실제 적용 상태**.

## 점검 C — GenieStock과의 공유 지점 (서버측)
- 같은 route·같은 Supabase 클라이언트·같은 테이블을 GenieStock과 공유하는지 서버 코드로 확인.
- product 분기로 갈리는 구조인지, 아니면 통째로 섞이는지.
- → GenieWork만 떼어낼 때 **GenieStock에 영향 가는 지점**이 어디인지(끊을 때 조심할 곳).

## 점검 D — 독립(전략 1)을 위한 변경 지점 목록
GenieWork를 새 전용 Supabase로 보내려면 이 서버에서 무엇을 바꿔야 하는지(코드 관점·변경 안 함·목록만):
- 새 Supabase 클라이언트 추가 위치(예: `GW_SUPABASE_URL`/`_SERVICE_ROLE_KEY` env 신설 → 별도 클라이언트).
- validate/upgrade/reset에서 `product==="geniework"`일 때 새 클라이언트로 분기할 지점(`파일:줄`).
- 웹훅에서 GenieWork 상품을 새 Supabase로 INSERT할 지점.
- 각 변경이 **GenieStock 경로를 안 건드리는지**(기존 env·기존 클라이언트 보존, 추가만).

## 보고 형식
- STEP 0: 프로젝트 구조·라이선스 엔드포인트 지도(`파일:줄`). (소스가 없으면 "소스 부재"로 명시.)
- 점검 A: 핵심 4가지 각각 실재/미구현 판정 + 근거 `파일:줄`.
- 점검 B: Supabase 연결·테이블 실제 스키마(민감값 위치만).
- 점검 C: GenieStock 공유 지점·끊을 때 주의점.
- 점검 D: 독립 변경 지점 목록(추가만·GenieStock 무영향 확인).
- 코드 밖(Vercel env·LS 대시보드·Supabase 콘솔 실제 데이터)은 "외부 확인 필요"로 분리.

> ⚠️ 조사·보고만. 코드·config·DB·외부 서비스는 한 줄도 수정하지 않는다. 민감값 출력 금지(위치만). git 미사용. 실제 독립 작업(새 Supabase·테이블·서버 분기·웹훅)은 이 보고 후 설계서로 별도 진행.
