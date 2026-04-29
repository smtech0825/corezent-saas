# CoreZent SaaS — 프로젝트 구조 & 데이터 흐름

> 마지막 업데이트: 2026-04-29
> 이 문서는 작업 완료 시마다 함께 업데이트됩니다. 변경 시 해당 섹션만 수정하세요.

CoreZent는 Next.js 15 App Router 기반의 **소프트웨어 판매 웹사이트**입니다. 자체 개발한 데스크톱/웹 앱(GeniePost 등)을 최종 사용자에게 직접 판매합니다 — B2B SaaS 도구가 아닙니다. 결제는 **Lemon Squeezy**, 데이터는 **Supabase**, 라이선스 관리는 **Google Sheets** + DB 이중 동기화 구조입니다.

---

## 0. 주요 의존성

| 패키지 | 버전 | 용도 |
|---|---|---|
| **next** | 15.5.14 | App Router, Turbopack, dev port 3003 |
| react / react-dom | ^19.0.0 | Renderer |
| typescript | ^5 | 타입 시스템 |
| tailwindcss | ^4 | 스타일 |
| **@supabase/ssr** | ^0.10.0 | 서버 컴포넌트/미들웨어용 Supabase 클라이언트 |
| @supabase/supabase-js | ^2.101.1 | 브라우저/서버 Supabase SDK |
| **googleapis** | ^171.4.0 | Google Sheets API (서비스 계정 JWT) |
| **nodemailer** | ^8.0.4 | SMTP 메일 발송 (문의/주문확인 이메일) |
| **botid** | ^1.5.11 | Vercel BotID — public POST 엔드포인트 봇 차단 |
| @vercel/analytics | ^2.0.1 | 페이지 뷰/이벤트 분석 |
| @vercel/speed-insights | ^2.0.0 | Real Experience Score 측정 |
| lucide-react / @tabler/icons-react / @radix-ui/react-icons | — | 아이콘 — `DynamicIcon`이 동적 import로 로드 (번들 크기 절감) |

---

## 1. 전체 폴더 구조

```
CoreZent_SaaS/
├── CLAUDE.md                  # AI 컨텍스트 가이드 (디자인 토큰·작업 규칙)
├── PROJECT_STRUCTURE.md       # 이 파일
├── next.config.ts             # withBotId 래핑
├── middleware.ts (src/)       # Supabase 세션 갱신 + /dashboard, /admin 보호
├── .env.example               # 환경변수 템플릿
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # 랜딩 (Hero/Product/Pricing/HowItWorks/Features/Testimonials/FAQ/CTA)
│   │   ├── layout.tsx         # 루트 레이아웃 + Vercel Analytics + SpeedInsights
│   │   ├── globals.css        # 전역 스타일 + @theme
│   │   │
│   │   ├── auth/              # Supabase Auth 화면
│   │   │   ├── login/         # 이메일+OAuth 로그인
│   │   │   ├── register/      # 회원가입 (inactive 재가입 차단)
│   │   │   ├── reset-password/   # 비밀번호 재설정 메일 요청
│   │   │   ├── update-password/  # 새 비밀번호 입력
│   │   │   └── _components/   # AuthBrand, AuthSocialButton
│   │   │
│   │   ├── dashboard/         # 사용자 영역 (로그인 필수)
│   │   │   ├── page.tsx       # 대시보드 홈
│   │   │   ├── licenses/      # 보유 라이선스 목록 (페이지네이션)
│   │   │   ├── billing/       # 구독/결제 내역 + 다운로드 버튼
│   │   │   ├── settings/      # 프로필·알림·계정 관리
│   │   │   ├── support/       # 고객지원 티켓
│   │   │   └── _components/   # DashboardShell, DashboardSidebar, LicenseCopyButton
│   │   │
│   │   ├── admin/             # 관리자 영역 (role='admin' 필수)
│   │   │   ├── page.tsx       # 관리자 홈 + ChurnAnalysis
│   │   │   ├── users/         # 사용자 목록 + RoleSelect
│   │   │   ├── orders/        # 주문 테이블
│   │   │   ├── products/      # 상품 CRUD + Changelog 관리
│   │   │   │   ├── ProductForm.tsx
│   │   │   │   ├── ChangelogSection.tsx
│   │   │   │   ├── changelog-actions.ts (server actions)
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   ├── licenses/      # 전체 라이선스 + Revoke
│   │   │   ├── support/       # 문의 답변
│   │   │   ├── settings/      # 시스템 설정
│   │   │   ├── content/       # 프론트엔드 CMS (10+ 섹션)
│   │   │   │   ├── hero/, cta/, features/, testimonials/, faq/
│   │   │   │   ├── about/, how-it-works/, announcement/
│   │   │   │   ├── sections/  # 랜딩 섹션 표시/순서 토글
│   │   │   │   ├── partners/, pages/, tools/
│   │   │   └── _components/   # AdminShell, AdminSidebar
│   │   │
│   │   ├── api/               # Server routes
│   │   │   ├── auth/check-email/   # 회원가입 전 inactive 계정 차단
│   │   │   ├── contact/            # 비회원 문의 (rate limit + honeypot + BotID)
│   │   │   ├── subscriptions/cancel/  # LS 구독 취소
│   │   │   ├── webhooks/lemonsqueezy/ # LS 결제 이벤트 핸들러 (8종)
│   │   │   ├── license/            # ⭐ 데스크톱 앱이 호출 — Google Sheets 직조회
│   │   │   │   ├── _lib.ts         # findByKey, patchCell, isStopped/isExpired
│   │   │   │   ├── validate/       # POST { key, hwid } → 첫 활성화 OR 검증
│   │   │   │   ├── reset/          # POST { key } → HWID 초기화 (PC 교체)
│   │   │   │   └── upgrade/        # POST { key, hwid } → Pro 키 업그레이드
│   │   │   ├── admin/
│   │   │   │   ├── licenses/revoke/   # DB + Sheets + LS 동시 비활성화
│   │   │   │   ├── settings/
│   │   │   │   ├── products/reorder/
│   │   │   │   └── sections/{toggle,reorder}/
│   │   │   └── debug-dashboard/    # 개발용
│   │   │
│   │   ├── pricing/           # 요금제 (DB 동적 + 카테고리 필터)
│   │   │   └── PricingClient.tsx
│   │   ├── product/           # 상품 목록 (More Info 아코디언)
│   │   │   └── ProductList.tsx
│   │   ├── changelog/         # 버전 히스토리 + 다운로드 링크
│   │   ├── activate/          # 시리얼 활성화 (ActivateClient)
│   │   ├── about/             # 회사 소개 (AboutBlockSlider)
│   │   ├── contact/           # 문의 (ContactForm + Wrapper)
│   │   ├── faq/               # FAQ
│   │   └── legal/             # 이용약관·개인정보·쿠키 정책
│   │
│   ├── components/
│   │   ├── sections/          # 랜딩 섹션 (DB 데이터 렌더)
│   │   │   ├── HeroSection.tsx
│   │   │   ├── ProductSection.tsx     # Our Products 그리드
│   │   │   ├── PricingSection.tsx     # 가격 카드 (월/연 토글)
│   │   │   ├── HowItWorksSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   ├── FAQSection.tsx
│   │   │   ├── CTASection.tsx
│   │   │   └── MetricsSection.tsx
│   │   ├── common/            # CountrySelect, Toast, Pagination
│   │   ├── Navbar.tsx, Footer.tsx
│   │   ├── DynamicIcon.tsx    # lucide/tabler/radix 동적 import + 캐시
│   │   ├── Analytics.tsx      # GA/GTM 등 외부 스크립트 로더
│   │   └── CookieConsentBanner.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # 브라우저용 createClient
│   │   │   ├── server.ts      # 서버 컴포넌트용 (cookies)
│   │   │   └── admin.ts       # SERVICE_ROLE_KEY 어드민 클라이언트
│   │   ├── lemonsqueezy.ts    # verifyLSWebhook + buildCheckoutUrl + 타입
│   │   ├── sheets.ts          # ⭐ CoreZent 라이선스 시트 (LS 웹훅 동기화)
│   │   ├── email.ts           # nodemailer + HTML 템플릿
│   │   ├── cookies.ts         # UTM 데이터 read/write
│   │   ├── countries.ts       # 국가 목록
│   │   └── products.ts        # 카테고리·뱃지 색상 상수
│   │
│   ├── instrumentation-client.ts  # Vercel BotID 초기화
│   └── middleware.ts          # 세션 갱신 + 보호 라우트
│
├── supabase/
│   └── migrations/            # 001 ~ 027 (29개)
│
├── public/                    # 정적 자산 (favicon, og 이미지 등)
└── package.json
```

---

## 2. 기능별 핵심 파일

### 2.1 인증 (Supabase Auth)

| 역할 | 파일 |
|---|---|
| 미들웨어 (세션 갱신 + 보호) | [src/middleware.ts](src/middleware.ts) — `/dashboard`, `/admin` 비로그인 차단 + `return_to` 쿠키 |
| 로그인 화면 | [src/app/auth/login/LoginForm.tsx](src/app/auth/login/LoginForm.tsx) — 이메일 + 소셜 OAuth |
| 회원가입 | [src/app/auth/register/RegisterForm.tsx](src/app/auth/register/RegisterForm.tsx) |
| 비밀번호 재설정 요청 | [src/app/auth/reset-password/ResetPasswordForm.tsx](src/app/auth/reset-password/ResetPasswordForm.tsx) |
| 새 비밀번호 입력 | [src/app/auth/update-password/UpdatePasswordForm.tsx](src/app/auth/update-password/UpdatePasswordForm.tsx) |
| 회원가입 전 이메일 검증 | [src/app/api/auth/check-email/route.ts](src/app/api/auth/check-email/route.ts) — `profiles.status='inactive'` 차단 + BotID |

### 2.2 랜딩 페이지 (DB 동적 렌더)

| 역할 | 파일 |
|---|---|
| 메인 페이지 | [src/app/page.tsx](src/app/page.tsx) — Promise.all로 7개 테이블 병렬 조회, 섹션 visibility/order는 `front_sections` |
| Below-fold 섹션 lazy 로드 | `next/dynamic` 사용 — Hero만 정적 import, 나머지는 청크 분리 (1.35MB → 299KB) |
| Pricing 섹션 (다중 상품) | [src/components/sections/PricingSection.tsx](src/components/sections/PricingSection.tsx) — 1/2/3+ 그리드 자동 전환 |
| Product 섹션 | [src/components/sections/ProductSection.tsx](src/components/sections/ProductSection.tsx) — Coming Soon 플레이스홀더 자동 채움 |

### 2.3 관리자 (Admin Console)

| 역할 | 파일 |
|---|---|
| 레이아웃 + 권한 검증 | [src/app/admin/layout.tsx](src/app/admin/layout.tsx) — `profiles.role='admin'` 검증 (admin 클라이언트 사용) |
| 관리자 홈 | [src/app/admin/page.tsx](src/app/admin/page.tsx) + [ChurnAnalysis.tsx](src/app/admin/ChurnAnalysis.tsx) |
| 사용자 관리 | [src/app/admin/users/page.tsx](src/app/admin/users/page.tsx) + [UserTable.tsx](src/app/admin/users/UserTable.tsx) + [RoleSelect.tsx](src/app/admin/users/RoleSelect.tsx) |
| 주문 | [src/app/admin/orders/page.tsx](src/app/admin/orders/page.tsx) + [OrderTable.tsx](src/app/admin/orders/OrderTable.tsx) |
| 상품 CRUD | [src/app/admin/products/ProductForm.tsx](src/app/admin/products/ProductForm.tsx) — 가격 플랜 다중 입력 + 태그 + 기능 카드 + Changelog 통합 |
| Changelog | [src/app/admin/products/ChangelogSection.tsx](src/app/admin/products/ChangelogSection.tsx) + [changelog-actions.ts](src/app/admin/products/changelog-actions.ts) — 버전·다운로드 URL·릴리스 노트 4분류 |
| 라이선스 관리 | [src/app/admin/licenses/LicenseTable.tsx](src/app/admin/licenses/LicenseTable.tsx) — 검색/필터/Revoke (DB + Sheets + LS 동시 비활성화) |
| 문의 답변 | [src/app/admin/support/[id]/ReplyForm.tsx](src/app/admin/support/[id]/ReplyForm.tsx) |
| **콘텐츠 CMS** | [src/app/admin/content/](src/app/admin/content/) — 10+ 섹션 인라인 편집기 (Hero/CTA/Features/Testimonials/FAQ/About/HowItWorks/Announcement/Sections/Partners/Pages/Tools) |

### 2.4 사용자 대시보드

| 역할 | 파일 |
|---|---|
| 레이아웃 + 사이드바 | [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) + [DashboardShell.tsx](src/app/dashboard/_components/DashboardShell.tsx) |
| 대시보드 홈 | [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) |
| 라이선스 목록 | [src/app/dashboard/licenses/page.tsx](src/app/dashboard/licenses/page.tsx) — 서버 페이지네이션 (10개/page), 구독 만료일은 `subscriptions.current_period_end` 우선 |
| 라이선스 키 복사 | [src/app/dashboard/_components/LicenseCopyButton.tsx](src/app/dashboard/_components/LicenseCopyButton.tsx) |
| 결제/구독 | [src/app/dashboard/billing/page.tsx](src/app/dashboard/billing/page.tsx) + [BillingSubscriptionSection.tsx](src/app/dashboard/billing/BillingSubscriptionSection.tsx) + [DownloadButton.tsx](src/app/dashboard/billing/DownloadButton.tsx) |
| 설정 | [src/app/dashboard/settings/page.tsx](src/app/dashboard/settings/page.tsx) — 프로필·국가·탈퇴 |
| 고객지원 | [src/app/dashboard/support/page.tsx](src/app/dashboard/support/page.tsx) + [TicketList.tsx](src/app/dashboard/support/TicketList.tsx) |

### 2.5 라이선스 시스템 (⭐ 핵심)

CoreZent는 라이선스를 **2개 시트**로 관리합니다:

| 시트/위치 | 용도 | 환경변수 |
|---|---|---|
| **CoreZent 라이선스 관리 시트** | LS 웹훅이 결제 시 자동으로 행 추가/만료일 동기화 | `GOOGLE_SHEETS_SPREADSHEET_ID` + `GOOGLE_SHEETS_TAB_NAME` |
| **GenieStock 전용 시트** | 데스크톱 앱이 직접 호출하여 HWID 바인딩/검증 | `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_TAB` |

| 역할 | 파일 |
|---|---|
| **LS 웹훅 → CoreZent 시트 동기화** | [src/lib/sheets.ts](src/lib/sheets.ts) — `appendLicenseRow` / `updateLicenseExpiry` / `updateLicenseStatus` (A이메일/B시리얼/C HWID/D만료일/E상태/F=D-TODAY()/G Pro) |
| **앱이 호출하는 라이선스 API** | [src/app/api/license/_lib.ts](src/app/api/license/_lib.ts) — `findByKey` / `patchCell` / `isStopped` / `isExpired` / `calcRemainingDays` |
| validate (앱 첫 실행) | [src/app/api/license/validate/route.ts](src/app/api/license/validate/route.ts) — `{key, hwid}` → HWID 빈칸이면 첫 활성화 (C+F열 업데이트), 일치하면 tier/expiresAt/remainingDays |
| reset (PC 교체) | [src/app/api/license/reset/route.ts](src/app/api/license/reset/route.ts) — `{key}` → C열(HWID) 빈값 + F열 'ready' (현재 HWID 대조 X — 오프라인 PC 교체 지원) |
| upgrade (Lite→Pro) | [src/app/api/license/upgrade/route.ts](src/app/api/license/upgrade/route.ts) — 새 키 검증 + HWID 미바인딩 시 자동 바인딩 |
| 관리자 Revoke | [src/app/api/admin/licenses/revoke/route.ts](src/app/api/admin/licenses/revoke/route.ts) — DB `status='revoked'` + 시트 E열 '중지' + LS API deactivate (선택) |
| 사용자 직접 활성화 | [src/app/activate/ActivateClient.tsx](src/app/activate/ActivateClient.tsx) |

> **두 가지 라이선스 발급 방식** (메모리: `project_license_types.md`):
> - GeniePost 일반: 자체 시리얼키 생성 (`generateSerialKey`)
> - GeniePost Pro + 신규 상품: Lemon Squeezy 자동 발급 키 (`fetchLsLicenseKey`)

### 2.6 결제 (Lemon Squeezy)

| 역할 | 파일 |
|---|---|
| 헬퍼 | [src/lib/lemonsqueezy.ts](src/lib/lemonsqueezy.ts) — `verifyLSWebhook` (HMAC-SHA256), `buildCheckoutUrl` (custom_data 주입), `generateSerialKey`, `fetchLsLicenseKey`, 타입 정의 |
| 웹훅 핸들러 | [src/app/api/webhooks/lemonsqueezy/route.ts](src/app/api/webhooks/lemonsqueezy/route.ts) — 8개 이벤트 처리 |
| 구독 취소 | [src/app/api/subscriptions/cancel/route.ts](src/app/api/subscriptions/cancel/route.ts) — LS API PATCH + DB 동기화 |

**처리 이벤트**:
- `order_created` → orders + licenses 생성, 시트 행 추가, 주문확인 메일
- `subscription_created` → subscriptions 행 생성
- `subscription_updated` → 구독 상태/만료일 갱신 + `license.expires_at` 동기화
- `subscription_cancelled` / `subscription_expired` → 라이선스 expired + 시트 '중지'
- `subscription_payment_failed` → 라이선스 expired + 시트 '중지'
- `subscription_paused` / `subscription_unpaused` → 일시정지/해제
- `order_refunded` → 라이선스 revoked

### 2.7 비회원 문의 (Contact)

| 역할 | 파일 |
|---|---|
| API | [src/app/api/contact/route.ts](src/app/api/contact/route.ts) — BotID + Rate Limit (1분 3회 IP) + Honeypot + 5MB 첨부 + DB 저장 + 이메일 발송 |
| 폼 | [src/app/contact/ContactForm.tsx](src/app/contact/ContactForm.tsx) + [ContactFormWrapper.tsx](src/app/contact/ContactFormWrapper.tsx) |
| 이메일 발송 | [src/lib/email.ts](src/lib/email.ts) — nodemailer SMTP + `inquiryEmailHtml` / `orderConfirmationEmailHtml` |

### 2.8 봇 차단 (Vercel BotID)

| 역할 | 파일 |
|---|---|
| Next.js 설정 | [next.config.ts](next.config.ts) — `withBotId(nextConfig)` |
| 클라이언트 초기화 | [src/instrumentation-client.ts](src/instrumentation-client.ts) — `/api/contact`, `/api/auth/check-email` 보호 등록 |
| 서버 검증 | 각 API 라우트에서 `checkBotId()` 호출 → `isBot: true` 시 차단 |

---

## 3. 데이터 흐름

### 3.1 결제 → 라이선스 발급

```
[사용자: Pricing 페이지에서 "Get started"]
   ↓ buildCheckoutUrl(rawUrl, userId, utm)
   → checkout[custom][user_id], checkout[custom][utm_*] 주입
   ↓
Lemon Squeezy 체크아웃 (오버레이 또는 리다이렉트)
   ↓ 결제 완료
LS Webhook → /api/webhooks/lemonsqueezy
   ↓ verifyLSWebhook(rawBody, signature)  [HMAC-SHA256]
   ↓ event_name: 'order_created'
[1] orders 테이블 INSERT (lemon_squeezy_order_id, user_id, product_id, total)
[2] licenses 테이블 INSERT
     ├─ GeniePost 일반: generateSerialKey()로 자체 키 생성
     └─ GeniePost Pro / 신규: fetchLsLicenseKey(orderId)로 LS API 조회
[3] sheets.appendLicenseRow({email, serialKey, expiresAt, isPro, status: '활성'})
     → CoreZent 라이선스 시트에 새 행 추가 (A~G)
[4] sendEmail(orderConfirmationEmailHtml)
     → 사용자에게 시리얼 키 + 다운로드 링크 발송
```

### 3.2 데스크톱 앱 → 라이선스 검증

```
[GenieStock 데스크톱 앱 실행]
   ↓
POST /api/license/validate { key, hwid }
   ↓
findByKey(key)  →  Google Sheets B열 검색 (A:G 전체 read)
   ↓
isStopped(F열)  →  STOPPED  → { valid: false, errorCode: 'STOPPED' }
isExpired(F열, D열)  →  EXPIRED → { valid: false, errorCode: 'EXPIRED' }
   ↓
HWID(C열) 비어있음  →  patchCell(rowNum, 'C', hwid) + patchCell(rowNum, 'F', 'active')
                       (병렬 Promise.all)
HWID 일치  →  정상 통과
HWID 불일치  →  HWID_MISMATCH (다른 PC에서 이미 인증됨)
   ↓
{ valid: true, tier, expiresAt, remainingDays: calcRemainingDays(D열) }
```

### 3.3 구독 만료일 갱신 (LS 자동 결제)

```
LS: subscription_updated webhook
   ↓
[DB] subscriptions UPDATE: status, current_period_end
   ↓
[DB] licenses UPDATE: expires_at = current_period_end (license.subscription_id JOIN)
   ↓
sheets.updateLicenseExpiry({ serialKey, expiresAt })
   → 시트 D열 새 만료일로 업데이트 (F열 수식 자동 재계산)
```

### 3.4 회원가입 → 탈퇴 재가입 차단

```
[사용자: 회원가입 폼 제출]
   ↓ RegisterForm 제출 전
POST /api/auth/check-email { email }
   ↓ checkBotId() (BotID 검증)
   ↓ rpc('get_user_id_by_email')  →  auth.users 조회
   ↓
profiles.status === 'inactive' (탈퇴한 계정)
   →  status: 'inactive' 반환  →  UI 차단 ("재가입할 수 없습니다")
profiles.status === 'active'
   →  status: 'active'  →  중복 가입 차단 ("이미 가입된 이메일입니다")
profiles 없음
   →  status: 'not_found'  →  Supabase Auth signUp 진행
```

### 3.5 비회원 문의

```
[사용자: /contact 폼 제출]
   ↓ FormData (email, subject, message, attachment, website[honeypot])
POST /api/contact
   ↓ checkBotId()
   ↓ Rate Limit (IP별 1분 3회, in-memory Map + 60초 cleanup)
   ↓ Honeypot 체크 (website 필드 채워지면 200 success 가짜 반환)
   ↓ 이메일 형식·길이 검증, 5MB 첨부 검증
   ↓ DB INSERT inquiries (이메일 실패해도 OK)
   ↓ sendEmail(ADMIN_EMAIL, replyTo: 사용자, attachments?)
   ↓ 200 { success: true }
```

---

## 4. 데이터베이스 (Supabase PostgreSQL)

마이그레이션: [supabase/migrations/](supabase/migrations/) — 001~027 (29개)

### 4.1 사용자 데이터

| 테이블 | 주요 컬럼 | 출처 마이그레이션 |
|---|---|---|
| `profiles` | id (auth.users FK), email, full_name, avatar_url, role(user/admin), country, status(active/inactive), created_at | 001, 023 |
| `user_status` 흐름 | 탈퇴 시 status='inactive' → check-email API에서 재가입 차단 | 023 |

### 4.2 상품·가격

| 테이블 | 주요 컬럼 | 출처 |
|---|---|---|
| `products` | id, name, slug, tagline, description, category, logo_url, manual_url, is_active, order_index, tags, pricing_features, product_features (JSON), license_duration_days, **badge_text**, **badge_color** | 002, 013, 015, 017, 027 |
| `product_prices` | id, product_id, type(subscription/one_time), interval(monthly/annual), price, lemon_squeezy_variant_id, checkout_url, is_active | 002, 026 |
| `changelogs` | id, product_id, version, release_date, is_latest, download_urls(JSON), content(JSON: new_features/improvements/bug_fixes/breaking_changes) | 006 |

### 4.3 주문·라이선스·구독

| 테이블 | 주요 컬럼 | 출처 |
|---|---|---|
| `orders` | id, user_id, product_id, lemon_squeezy_order_id, total, status, created_at | 003 |
| `licenses` | id, user_id, order_id, product_id, serial_key UNIQUE, status(active/expired/revoked), max_devices, expires_at, download_url, lemon_squeezy_license_key | 003 |
| `license_activations` | id, license_id, device_fingerprint, device_name, activated_at, last_seen_at, UNIQUE(license_id, device_fingerprint) | 003 |
| `subscriptions` | id, user_id, license_id, lemon_squeezy_subscription_id, status, billing_interval, current_period_end, cancellation_reason | 003, 012, 024 |

### 4.4 프론트엔드 콘텐츠 (CMS)

| 테이블 | 용도 |
|---|---|
| `front_sections` | 랜딩 섹션 visibility/순서 (hero/product/how_it_works/features/pricing/testimonials/faq/cta) |
| `front_content` | key-value 일반 텍스트 (hero_headline1, cta_btn1_text 등) |
| `front_features` | 기능 카드 그리드 |
| `front_steps` | How It Works 단계 |
| `front_interviews` | Testimonials |
| `front_faqs` | FAQ 아코디언 |
| `announcement_banner` | 상단 공지 배너 |
| `about_page` | About 페이지 블록 |

마이그레이션: 007, 009, 013, 015, 016, 019, 025

### 4.5 지원·기타

| 테이블 | 용도 |
|---|---|
| `support_tickets` | 사용자 문의 티켓 + 답변 스레드 (004, 020) |
| `inquiries` | 비회원 문의 (`/api/contact`에서 INSERT, 022) |
| `downloads` | 라이선스 다운로드 추적 (021) |
| `affiliate_*` | 제휴 프로그램 (005) |

---

## 5. 외부 API 사용 현황

### 5.1 Supabase

| 영역 | 환경변수 | 클라이언트 |
|---|---|---|
| 브라우저 (RLS 적용) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [client.ts](src/lib/supabase/client.ts) |
| 서버 컴포넌트 (쿠키) | 동일 | [server.ts](src/lib/supabase/server.ts) |
| **어드민 (RLS 우회)** | `SUPABASE_SERVICE_ROLE_KEY` | [admin.ts](src/lib/supabase/admin.ts) — 웹훅·관리자 라우트 전용 |

### 5.2 Lemon Squeezy

| 환경변수 | 용도 |
|---|---|
| `LEMONSQUEEZY_API_KEY` | 라이선스 키 조회, 구독 취소, deactivate |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | 웹훅 HMAC-SHA256 서명 검증 |
| `LEMONSQUEEZY_STORE_ID` | 스토어 ID (라이선스 키 검증 필터링) |

API 베이스: `https://api.lemonsqueezy.com/v1/`
헤더: `Authorization: Bearer {API_KEY}`, `Accept: application/vnd.api+json`, `Content-Type: application/vnd.api+json`

### 5.3 Google Sheets (서비스 계정 JWT)

| 환경변수 | 용도 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 두 시트 공통 |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `\n` 이스케이프 → 실제 줄바꿈 변환 후 사용 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` + `GOOGLE_SHEETS_TAB_NAME` | **CoreZent 라이선스 시트** ([sheets.ts](src/lib/sheets.ts)) — LS 웹훅 동기화 |
| `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_TAB` | **GenieStock 전용 시트** ([_lib.ts](src/app/api/license/_lib.ts)) — 앱이 호출 |

> ⚠️ 두 시트가 **별도 환경변수**를 사용합니다. (`SHEETS_SPREADSHEET_ID` vs `SHEET_ID`). `.env.example`에는 후자가 누락 — 실제 `.env.local`에 추가 필요.

### 5.4 Vercel BotID

| 위치 | 보호 대상 |
|---|---|
| [next.config.ts](next.config.ts) | `withBotId` 래퍼 |
| [instrumentation-client.ts](src/instrumentation-client.ts) | 클라이언트 토큰 자동 첨부 — `/api/contact` POST, `/api/auth/check-email` POST |
| 각 라우트 | `checkBotId()` 서버 검증 |

> 보호하지 **않는** 엔드포인트:
> - `/api/webhooks/lemonsqueezy` (LS 서버는 정당한 봇, HMAC 검증으로 충분)
> - `/api/license/*` (데스크톱 앱이 호출, BotID 토큰 발급 불가)
> - `/api/admin/*` (admin 미들웨어 보호)
> - `/dashboard/*` (Supabase Auth 보호)

### 5.5 이메일 (Nodemailer SMTP)

[src/lib/email.ts](src/lib/email.ts) — `sendEmail({to, subject, html, replyTo, attachments})` + HTML 템플릿:
- `inquiryEmailHtml` — 비회원 문의 알림 (관리자에게)
- `orderConfirmationEmailHtml` — 주문 확인 (구매자에게)

### 5.6 분석

| 도구 | 위치 |
|---|---|
| Vercel Analytics | [layout.tsx](src/app/layout.tsx) `<VercelAnalytics />` |
| Vercel Speed Insights | [layout.tsx](src/app/layout.tsx) `<SpeedInsights />` |
| GA / Meta Pixel / PostHog (옵션) | [src/components/Analytics.tsx](src/components/Analytics.tsx) |

---

## 6. 미들웨어·자동화

| 시점 | 동작 | 위치 |
|---|---|---|
| 모든 요청마다 | Supabase 세션 자동 리프레시 | [middleware.ts](src/middleware.ts) `getUser()` |
| `/dashboard`, `/admin` 접근 | 비로그인 시 `/auth/login?redirect=...` + `return_to` 쿠키 | middleware |
| `/auth/login`, `/auth/register` 접근 | 이미 로그인된 사용자는 `/dashboard`로 | middleware |
| `/admin/*` 진입 | `profiles.role='admin'` 검증 (RLS 재귀 회피 위해 admin client 사용) | [admin/layout.tsx](src/app/admin/layout.tsx) |
| 쿠키 초기 동의 | `CookieConsentBanner` 표시 → 동의 시 GA/Pixel 활성화 | [CookieConsentBanner.tsx](src/components/CookieConsentBanner.tsx) |
| 1분 무브먼트 | `/api/contact` Rate Limit Map 정리 | contact route `setInterval` |

---

## 7. 빌드·실행

```bash
npm run dev    # Turbopack dev server (port 3003)
npm run build  # Next.js production build
npm run start  # production server
npm run lint   # ESLint
```

**배포**: Vercel 자동 배포 (`git push origin main` → 즉시 빌드/배포). [CLAUDE.md](CLAUDE.md) 작업 규칙 14번 참고: 커밋 후 반드시 push.

**유의사항**:
- `.next` 캐시 손상 시 `rm -rf .next && npm run build`
- TypeScript: 동일 파일 내 `import dynamic from 'next/dynamic'`과 `export const dynamic`은 충돌 — `import lazy from 'next/dynamic'`로 alias
- `src/app/page.tsx`는 `force-dynamic` (DB 데이터 SSR)

---

## 8. 알려진 제약·주의사항

| 항목 | 제약 | 대응 |
|---|---|---|
| 라이선스 시트 (CoreZent vs GenieStock) | 환경변수가 분리되어 있음 (이력 상의 이유) | 향후 통합 검토 |
| `license_activations.last_seen_at` | 컬럼은 있으나 업데이트하는 API 없음 | 앱이 validate 호출 시 last_seen 갱신 로직 추가 필요 (TODO) |
| Google Sheets API | 분당 60회 read, 100회 write 한도 | LS 웹훅 단발 호출이므로 현재 안전, 단 batch revoke 시 주의 |
| LS 웹훅 멱등성 | 같은 이벤트 재전송 가능 | `lemon_squeezy_order_id` UNIQUE로 중복 INSERT 방지 |
| Rate Limit (Contact) | in-memory Map → 다중 인스턴스에서 정확하지 않음 | Vercel은 단일 region serverless라 큰 문제 없음 |
| BotID 토큰 | 클라이언트만 발급 가능 (네이티브 앱 X) | 앱 호출 라우트(`/api/license/*`)는 BotID 미적용 |

---

*최초 작성: 2026-04-29 | 프로젝트: CoreZent SaaS*
