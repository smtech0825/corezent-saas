# fix-affiliate-prelaunch

You are a senior Next.js 15 (App Router) / TypeScript / Supabase / Lemon Squeezy engineer on the **CoreZent SaaS** codebase. Complete the pre-launch **correctness & security** cleanup for the affiliate → store-credit feature. Work Wave by Wave; stop and report at each Wave end. This is correctness-only cleanup before exposing the program to customers — **no tangential refactors.**

## STRICT RULES
- **추측 금지**: 본 문서의 경로·함수명·줄번호는 "출발점". 실제 코드를 열어 확인한 뒤 적용하고, 결론은 `파일:줄` 근거.
- **보편 해결 / 하드코딩 금지**: 규칙값(쿠키 일수·자기추천 차단 등)은 `affiliate_program_config` 또는 **이메일 가입 귀속에 이미 쓰는 기존 헬퍼를 재사용**한다. 같은 로직을 새로 복제하지 말 것.
- **in-place 수정만 · 지정 파일만 · 무관 리팩터 금지.** (파일 분리·hex 토큰화 등은 본 작업 범위 아님 — '범위 밖' 참조)
- **다른 작업자/다른 CC 세션의 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 진행 중 push 금지**(최종에서만).
- **각 Wave 끝 검증**: `npx tsc --noEmit` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) **Critical/High 0** → 변경 파일만 개별 커밋 → 멈추고 보고 → 승인 후 다음. (lint은 레포에 ESLint 설정 부재 시 실행 불가 — 그 경우 build 정적검사로 갈음하고 사유 명시)
- **기존 관리자 패널의 확립된 hex 컨벤션은 신규 위반으로 보지 않는다.** 본 작업에서 admin UI 색을 바꾸지 않는다.
- **새 DB 마이그레이션이 필요해 보이면 추측해서 만들지 말고 멈추고 보고.** (Wave 1은 콜백 코드 처리로 마이그레이션 없이 가능해야 함)
- 각 작업 보고: **①관찰/대상 ②근거(파일:줄) ③공용 영향 범위 ④결정적 코드임을 명시.**

## 배경
추천 → 스토어 크레딧(Wave 1~6) 배포 완료. 고객에게 프로그램을 켜기 전, **공정성·정확성·보안 결함 3건**만 정리한다.

---

## WAVE 0 — 조사 (READ-ONLY · 코드/파일/git 0 변경)
보고만 한다(수정안 작성 금지):
1. **OAuth 콜백**: `exchangeCodeForSession` 호출 위치(파일:줄, 예: `src/app/auth/callback/route.ts` 추정) + **이메일 가입 귀속을 처리하는 기존 헬퍼**(예: `affiliate.ts`의 attribution 함수) 위치·시그니처.
2. 콜백에서 **"신규 가입 vs 기존 로그인"을 신뢰성 있게 구분할 신호**가 무엇이 실제 가용한지: `profiles.created_at`, `user.created_at` vs `last_sign_in_at`, identities 등.
3. `cz_ref` 쿠키(httpOnly·서버 읽기)를 **콜백(서버)에서 읽을 수 있는 지점**.
4. `src/app/dashboard/affiliate/page.tsx`가 **현재 admin 클라이언트를 쓰는지, 이미 server 클라이언트로 전환됐는지.** (Wave 6에서 `affiliate_clicks` '본인 코드 조회' RLS가 030에 추가됐는지도 확인)
5. 대시보드 **'전환' 지표 계산식** 위치 — `source_type='order'` 행 수인지, 고유 피추천인 수인지.
→ **STOP & 보고. 승인 후 Wave 1.**

---

## WAVE 1 — OAuth 가입 추천 귀속 (🔴 핵심 · 공정성)
대상: Wave 0에서 확인한 OAuth 콜백 파일.
- `exchangeCodeForSession` **직후**, **확실한 신규 가입일 때만** `cz_ref`(없으면 skip) 기준으로 `profiles.referred_by`를 스탬프한다. **이메일 가입에 쓰는 기존 헬퍼를 재사용**(로직 중복 금지).
- **신규 판별**: Wave 0에서 고른 신뢰 신호 사용(예: `profiles.created_at`가 콜백 시점 직전 N초 이내) **AND** `profiles.referred_by IS NULL`.
- **가드**: 자기추천 차단(추천인 == 신규 유저면 skip), **1회만**(이미 `referred_by` 있으면 덮어쓰지 않음), 기존 attribution UNIQUE 유지.
- **확신 못 하면 귀속하지 말 것.** 기존 사용자 오귀속 < 일부 신규 누락 — **false negative가 안전**.
- 결정적 코드, AI 없음. 공용 영향: 로그인/콜백 흐름이 깨지지 않게.
검증 → 변경 파일만 커밋 → **STOP & 보고.**

---

## WAVE 2 — 대시보드 admin→server 클라이언트 전환 (🟡 보안)
대상: `src/app/dashboard/affiliate/page.tsx`.
- Wave 0 결과 아직 **admin 클라이언트(RLS 우회)** 를 쓰면 → **일반 server 클라이언트(RLS 적용)** 로 전환. (`affiliate_clicks` '본인 코드 조회' RLS가 030에 있으므로 본인 클릭 지표 조회 가능)
- **이미 server로 전환돼 있으면 → 변경 없음**, 그 사실만 보고.
- 전환 후에도 타인 데이터 노출 0(본인 `referrer_user_id`/`affiliate_code` 스코프만) 확인.
검증 → 변경 파일만 커밋 → **STOP & 보고.**

---

## WAVE 3 — '전환' 지표 정확화 (🟡 정확성)
대상: `src/app/dashboard/affiliate/page.tsx`의 '전환' 카운트.
- 현재 `source_type='order'` 행 수라면 → **고유 피추천인 수**(distinct `referred_user_id` where `converted_at IS NOT NULL`)로 변경. 한 피추천인이 일회성 제품을 여러 개 사도 1로 집계.
- 읽기·표시 전용 유지(쓰기 0).
검증 → 변경 파일만 커밋 → **STOP & 보고.**

---

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀: `tsc --noEmit` + `build` + `bug-detective`/`code-guardian` Critical/High 0.
- **그때 한 번만 `git push origin main`**(Vercel 배포, CLAUDE.md 규칙 14). Wave 중간 push 금지.
- `result-explainer-ko`로 비개발자용 완료 요약(달라진 점·확인 방법).

## 범위 밖 (이번엔 하지 말 것 — 런칭 후 별도 품질 작업)
- `PricingClient.tsx`(320줄)·webhook `route.ts`(980줄) 파일 분리.
- 관리자 패널 hex → `@theme` 토큰화(amber/`#475569` 토큰 부재 + 컨벤션 일치라 보류).
- 위는 정확성·보안과 무관한 리팩터/취향이므로 제외. 필요 시 별도 지시문.

## 진행 중 멈춤 규칙
- 새 마이그레이션이 필요하거나, '신규 판별' 신뢰 신호가 없으면 **추측 말고 멈추고 보고**(가설과 다르면 수정 전 정지).
