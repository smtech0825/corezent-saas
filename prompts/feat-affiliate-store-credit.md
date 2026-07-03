# feat-affiliate-store-credit

You are a senior Next.js 15 (App Router) / TypeScript / Supabase / Lemon Squeezy engineer working on the **CoreZent SaaS** codebase. Implement a referral/affiliate system whose payout is **store credit only** (no cash payout). Work Wave by Wave. Stop and report at the end of each Wave.

## STRICT RULES (예외 없음)
- **추측 금지**: 본 문서의 모든 경로·줄번호·함수명은 "출발점"이다. 반드시 실제 코드를 열어 확인한 뒤 적용한다. 결론은 항상 `파일:줄` 근거 위에서.
- **보편 해결 / 하드코딩 금지**: 커미션율·반복 개월 캡·쿠키 일수·보류(hold) 일수·최소 지급 크레딧·통화·자기추천 차단 여부는 **전부 `affiliate_program_config`(DB) 또는 env에서 읽는다.** 숫자·문구를 코드에 리터럴로 박지 말 것. 어떤 값으로 설정해도 견디는 순수 로직으로 작성.
- **금액 계산은 전부 결정적 코드(TypeScript)**. AI 생성·추정 금지. 통화 최소단위(정수 cents) 기준으로 계산하고, 반올림 규칙을 한 곳에 모아 일관 적용.
- **in-place 수정만 · 지정 파일만 · 무관 리팩터 금지.**
- **다른 작업자/다른 CC 세션의 미커밋 변경 미접촉.** `git add .` 금지(변경 파일만 개별 add). **Wave 진행 중에는 push 금지** (최종 승인 후에만 push — 아래 '최종' 참조).
- **각 Wave 끝 검증(0 결함)**: `npx tsc --noEmit` + `npm run lint` + `npm run build` 통과 + `bug-detective`(+`code-guardian`) **Critical/High 0** → **변경 파일만 개별 git add** → 커밋 → **멈추고 보고 → 승인 후 다음 Wave.**
- 각 작업마다 보고 시: **①관찰/대상 ②근거(파일:줄) ③공용 영향 범위(공용 함수·다른 라우트) ④결정적 코드임을 명시.**
- CLAUDE.md / PROJECT_STRUCTURE.md 규칙 준수: 시크릿 클라이언트 노출 금지, 웹훅 rawBody+HMAC 검증 유지, admin(service_role)은 서버 전용, 한국어 함수 주석, `@theme` 토큰 사용, SEO metadata.

## 설정 기본값 (config 테이블에 저장 — 나중에 관리자에서 변경 가능)
- `commission_type` = `percent`
- `commission_value` = `20` (퍼센트면 %, flat이면 cents)
- `is_recurring` = `false` (구독 갱신마다 반복 적립을 원하면 true)
- `recurring_months_cap` = `12`
- `cookie_days` = `30` (last-click 귀속)
- `hold_days` = `30` (환불 보류 기간)
- `min_payout_credit` = `5000` (예: $50 = 5000 cents, 변경 가능)
- `currency` = `USD`
- `self_referral_blocked` = `true`

## 기능 개요
회원이 자신의 추천 링크/추천인 코드로 **신규 구매**를 유도하면, 결제 확정 시 커미션을 **적립(pending)** 하고, **보류기간(hold_days)** 동안 환불이 없으면 **스토어 크레딧**으로 전환(지급)한다. 사용자는 다음 결제 때 크레딧을 할인으로 사용한다. **현금 지급 없음**(세금·정산 회피).

---

## WAVE 0 — 조사 (READ-ONLY · 코드/파일/ git 0 변경)
목적: 기존 자산을 정확히 파악해 **중복·충돌 없이** 확장하기 위함. 수정안 쓰지 말 것. 보고만.

점검 대상(파일:줄 근거로 보고):
1. `supabase/migrations/005*` (및 affiliate 관련 모든 마이그레이션) → **기존 `affiliate_*` 테이블·컬럼·인덱스·RLS를 정확히** 보고. (이미 있는 컬럼은 재생성/중복 금지)
2. `src/lib/lemonsqueezy.ts` → `buildCheckoutUrl`의 `custom_data` 주입 지점, `verifyLSWebhook`, 라이선스 키 발급 함수.
3. `src/app/api/webhooks/lemonsqueezy/route.ts` → 이벤트 분기 위치. 특히 `order_created`, `subscription_payment_success`(또는 갱신 성공 이벤트), `order_refunded`, `subscription_payment_failed`의 처리 지점.
4. 회원가입 경로: `src/app/auth/register/*`, `src/app/api/auth/check-email/route.ts` → **signUp 성공 직후** 훅을 걸 수 있는 위치.
5. `src/middleware.ts` → 요청/쿠키 처리 위치(추천 코드 캡처 가능 지점).
6. `src/lib/supabase/{client,server,admin}.ts` → 어떤 클라이언트를 어디서 쓰는지(웹훅=admin, 사용자=server).
7. `src/app/dashboard/*`, `src/app/admin/*` 셸(레이아웃·사이드바) → 새 페이지/메뉴 추가 패턴.
8. 체크아웃 진입 흐름 + **Lemon Squeezy 할인(discount) 생성 API 사용 가능 여부**(스토어 크레딧을 LS 결제에 반영할 현실적 방법 조사).

**보고 항목**: ① 기존 affiliate_* 스키마 전문, ② 위 2~8의 정확한 파일:줄, ③ 스토어 크레딧을 LS 체크아웃에 적용하는 현실적 방법과 제약(할인코드 생성 API 가능/불가), ④ 충돌 가능 지점.
→ **STOP & 보고. 승인 후 Wave 1.**

---

## WAVE 1 — DB 스키마 (기존 005 확장 · 신규 마이그레이션)
Wave 0 보고를 근거로, **이미 존재하는 것은 재사용/확장**하고 없는 것만 추가. 새 마이그레이션 파일 1개(다음 번호)로 작성. 전 테이블 **RLS 필수**(본인 행만 조회, admin 전체, 웹훅은 service_role write).

필요 구조(기존과 매핑 후 부족분만 생성):
- `affiliate_program_config` — 위 '설정 기본값' 단일 행(singleton). 모든 규칙의 출처.
- `profiles`에 `referral_code`(UNIQUE, 가입 시 생성), `referred_by`(추천인 referral_code, nullable) — 컬럼 없으면 추가.
- `affiliate_clicks` — `referral_code, landing_path, ip_hash, user_agent, created_at` (분석·어뷰징).
- `affiliate_referrals` — `referrer_user_id, referred_user_id(nullable), referral_code, first_seen_at, converted_at, order_id`. (귀속 1건/피추천인 UNIQUE 고려)
- `affiliate_commissions` — `referrer_user_id, referral_id, source_type(order/subscription_renewal), source_id, gross_amount_cents, commission_amount_cents, currency, status(pending/approved/reversed/paid), earned_at, available_at(=earned_at+hold_days), payout_id(nullable)`.
- `store_credit_ledger` — `user_id, delta_cents(+적립/−사용/−조정), reason(affiliate_commission/checkout_redeem/admin_adjust/clawback), ref_id, balance_after_cents, created_at`. **잔액은 원장 합계로 산출**(또는 캐시 컬럼 + 원장 정합).
- `affiliate_payouts` — 승인된 커미션을 크레딧으로 전환한 배치: `referrer_user_id, amount_cents, status, created_at`.

검증(tsc/lint/build + 마이그레이션 유효) → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## WAVE 2 — 추천 링크 · 쿠키 귀속 · 가입 귀속
- 추천 코드 생성: 회원에게 `referral_code` 부여(없으면 가입/최초 접근 시 생성). 충돌 없는 짧은 코드(예: 영숫자 8자) — 생성 규칙은 유틸 1곳.
- 추천 링크 라우트: `src/app/r/[code]/route.ts`(또는 page) → `cz_ref` **1st-party 쿠키**(maxAge=config.cookie_days) 저장 + `affiliate_clicks` 1행 기록 + `/`로 리다이렉트. (last-click: 새 ref 오면 덮어씀)
- 가입 귀속: signUp 성공 직후 `cz_ref` 쿠키를 읽어 `profiles.referred_by` 기록. **자기추천 차단**(config.self_referral_blocked): 피추천인=추천인 동일인이면 귀속 안 함.
- 공용 영향: middleware/쿠키, 가입 핸들러. 기존 인증 흐름 깨지지 않게 확인.

검증 → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## WAVE 3 — 체크아웃에 추천인 전달
- `src/lib/lemonsqueezy.ts`의 `buildCheckoutUrl`에 **`custom_data.affiliate_ref` 한 줄 추가**: 값은 (로그인 시 `profiles.referred_by`) 우선, 없으면 `cz_ref` 쿠키. 비회원 결제도 추적되게.
- 공용 영향: **모든 체크아웃이 이 함수를 거침** — 기존 `custom_data.user_id` 주입 깨지지 않게. 값 없으면 키 자체를 생략(빈 문자열 주입 금지).

검증 → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## WAVE 4 — 웹훅 적립 + 반복 + 환불 클로백 (핵심·금액 결정적)
`src/app/api/webhooks/lemonsqueezy/route.ts` (서명검증·멱등성 유지):
- `order_created`: `custom_data.affiliate_ref`(없으면 구매자 `referred_by`) 해석 → 유효(존재·active·자기추천 아님) → `affiliate_referrals`(신규면) + `affiliate_commissions`(status=pending, `available_at=now+hold_days`) 생성. 금액 = config 기준 결정적 계산(percent면 gross×value/100, flat이면 value), **환불·세금 제외 net 기준**으로 산정(Wave 0에서 net 필드 확인).
- `subscription_payment_success`(갱신): `config.is_recurring`이고 해당 구독의 적립 횟수 < `recurring_months_cap`이면 반복 커미션 1행 추가.
- `order_refunded` / `subscription_payment_failed`: 매칭 커미션 → `reversed`. **이미 크레딧으로 전환(paid)된 경우**: 잔액 충분하면 `clawback` 음수 원장 기록, 잔액 부족(이미 사용)하면 전환하지 말고 **관리자 검토 플래그**(음수 잔액 만들지 말 것).
- 멱등성: 같은 source_id 중복 적립 금지(UNIQUE).
- 전부 결정적 코드. AI 없음.

검증 → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## WAVE 5 — 제휴 대시보드 (사용자)
`src/app/dashboard/affiliate/page.tsx`(+ 사이드바 메뉴, 셸 패턴 따름):
- 내 추천 코드·링크(복사 버튼), 클릭 수, 가입·전환 수.
- 적립 현황: 대기(pending)·지급가능(approved)·지급완료(paid)·반려(reversed).
- 스토어 크레딧 잔액(원장 기준).
- 디자인: `@theme` 토큰, 다크 네이비, 벤토 그리드, SEO metadata, 한국어 주석.

검증 → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## WAVE 6 — 관리자 + 스토어 크레딧 사용 (최고난도 · Wave 0 결과 반영)
- 관리자 `src/app/admin/affiliates/`: 제휴자 목록, 커미션 내역, **승인→크레딧 전환**(pending+available_at 경과+미환불 → `store_credit_ledger` +적립, commission.status=paid, `affiliate_payouts` 기록), 어뷰징 검토, **`affiliate_program_config` 편집기**(모든 규칙 값 변경).
- 크레딧 사용(차감): 체크아웃 시 사용자 가용 크레딧을 결제에 반영.
  - **1순위 방법**: Wave 0에서 확인한 LS 할인 API로 사용자 가용 크레딧(또는 결제액 한도) 만큼 **1회용 할인 생성** → 결제 적용 → 사용 확인(웹훅) 시 `store_credit_ledger` −사용 기록.
  - **LS 할인 API 경로가 막혀 있으면(폴백)**: 관리자 수동 할인 발급 + 원장 −기록 방식으로 MVP 구현하고, 자동화는 후속으로 분리 보고.
- min_payout_credit 미만은 전환 불가. 음수 잔액 절대 금지.

검증 → 변경 파일만 add → 커밋 → **STOP & 보고.**

---

## 최종 (모든 Wave 승인 후에만)
- 전체 회귀 확인(`tsc + lint + build` + bug-detective/code-guardian Critical/High 0).
- **그때 한 번만 `git push origin main`** 실행(CLAUDE.md 규칙 14, Vercel 배포). Wave 중간 push 금지.
- `result-explainer-ko`로 비개발자용 완료 보고(달라진 점·확인 방법·진행율).

## 진행 중 멈춤 규칙
- 기존 005 스키마가 본 설계와 충돌하거나, LS 할인 API로 크레딧 적용이 불가하면 **추측해서 진행하지 말고 멈추고 보고**(가설과 다르면 수정 전 정지).
