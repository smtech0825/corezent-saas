# CoreZent SaaS — 프로젝트 구조 & 데이터 흐름

> 마지막 업데이트: 2026-07-07
> 이 문서는 작업 완료 시마다 함께 업데이트됩니다. 변경 시 해당 섹션만 수정하세요.

CoreZent는 Next.js 15 App Router 기반의 **소프트웨어 판매 웹사이트**입니다. 자체 개발한 데스크톱/웹 앱(GeniePost 등)을 최종 사용자에게 직접 판매합니다 — B2B SaaS 도구가 아닙니다. 결제는 **Lemon Squeezy**, 데이터는 **Supabase**, 라이선스는 **제품별로 분리**(GeniePost=Google Sheets, GenieStock·GenieWork=각각 별도 Supabase 프로젝트)되어 본체 DB와 동기화됩니다.

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
| **googleapis** | ^171.4.0 | Google Sheets API + Google Indexing API (서비스 계정 JWT, `google.indexing()`) |
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
│   │   ├── page.tsx           # 랜딩 (Hero/Product/Pricing/HowItWorks/Features/Testimonials/FAQ/CTA) — theme-paper 적용
│   │   ├── layout.tsx         # 루트 레이아웃 + Noto_Serif_KR(--font-serif-kr) + Vercel Analytics + SpeedInsights
│   │   ├── globals.css        # 전역 스타일 + @theme (다크 토큰 유지) + 페이퍼 테마 토큰(paper/ink/rule/seal/pen) + fade-up/stamp 애니메이션
│   │   ├── robots.ts          # /robots.txt — `@/lib/site`의 SITE_URL 사용(Host 항상 www.corezent.com으로 정규화)
│   │   ├── sitemap.ts         # /sitemap.xml — 정적 공개 페이지 + 활성 상품 상세, SITE_URL 사용
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
│   │   │   ├── settings/      # 시스템 설정 + ReindexPanel.tsx(⭐신규 — 검색엔진 색인 재요청 버튼)
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
│   │   │   ├── license/            # ⭐ 데스크톱 앱이 호출 — product로 분기
│   │   │   │   ├── _lib.ts         # GeniePost(Google Sheets): findByKey, patchCell, isStopped/isExpired
│   │   │   │   ├── _lib_supabase.ts # GenieStock·GenieWork(별도 Supabase): findLicenseByKey, getHwidsForKey, registerHwid
│   │   │   │   ├── validate/       # POST { key, hwid } → 첫 활성화 OR 검증
│   │   │   │   ├── reset/          # POST { key } → HWID 초기화 (PC 교체)
│   │   │   │   └── upgrade/        # POST { key, hwid } → Pro 키 업그레이드
│   │   │   └── admin/
│   │   │       ├── licenses/revoke/   # DB + Sheets + LS 동시 비활성화
│   │   │       ├── settings/
│   │   │       ├── products/reorder/
│   │   │       ├── sections/{toggle,reorder}/
│   │   │       └── seo/reindex/   # ⭐신규 POST — sitemap 전체(또는 지정 URL)를 IndexNow+Google Indexing에 제출 (requireAdmin)
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
│   │   ├── ui/                 # ⭐ 공통 UI 프리미티브 (페이퍼 테마 표준) — GenieWork 재브랜딩 신규
│   │   │   ├── Button.tsx      # variant: primary/outline/ghost/danger, size: sm/md/lg, href 있으면 Link로 렌더
│   │   │   ├── Container.tsx   # width: text(max-w-3xl)/content(max-w-5xl)/wide(max-w-7xl) — 사이트 max-width 3종 통일
│   │   │   ├── Section.tsx     # Section + SectionHeader + FieldLabel export (공문서식 네모 칸 라벨)
│   │   │   ├── Card.tsx        # variant: solid/dashed(점선 — 출시예정 등)
│   │   │   ├── Input.tsx       # Input + Textarea + Field export (라벨+에러 래퍼)
│   │   │   └── Badge.tsx       # variant: pen/seal/ink/shade
│   │   ├── sections/          # 랜딩 섹션 (DB 데이터 렌더)
│   │   │   ├── HeroSection.tsx
│   │   │   ├── HeroDraftDemo.tsx      # ⭐신규 히어로 하단 초안 타이핑 데모 ('use client', prefers-reduced-motion 대응)
│   │   │   ├── StampSeal.tsx          # ⭐신규 직인(印) 스탬프 애니메이션 ('use client', IntersectionObserver 트리거)
│   │   │   ├── ProductSection.tsx     # Our Products 그리드
│   │   │   ├── PricingSection.tsx     # 가격 카드 (월/연 토글)
│   │   │   ├── HowItWorksSection.tsx
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   ├── FAQSection.tsx
│   │   │   ├── CTASection.tsx
│   │   │   └── MetricsSection.tsx
│   │   ├── common/            # Toast, Pagination 등 공통 컴포넌트
│   │   ├── Navbar.tsx, Footer.tsx     # Navbar: fixed→sticky 전환, 페이퍼 테마 적용
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
│   │   ├── products.ts        # 카테고리·뱃지 색상 상수 (다크용 + ⭐PRODUCT_BADGE_COLORS_PAPER/CATEGORY_BADGE_PAPER 페이퍼 전용 추가)
│   │   ├── site.ts            # ⭐신규 사이트 표준(canonical) URL 단일 출처 — `getSiteUrl()`/`SITE_URL`, apex→www 정규화. robots·sitemap·색인 제출이 공통 사용
│   │   └── seo/
│   │       └── indexing.ts    # ⭐신규 서버 전용 — `submitToIndexNow`/`submitToGoogleIndexing`/`submitUrlsToSearchEngines`
│   │
│   ├── instrumentation-client.ts  # Vercel BotID 초기화
│   └── middleware.ts          # 세션 갱신 + 보호 라우트
│
├── supabase/
│   └── migrations/            # 001 ~ 027 (29개)
│
├── public/                    # 정적 자산 (favicon, og 이미지 등)
│   └── 5ae2e03853bc47f8a8569d00d31788d4.txt  # ⭐신규 IndexNow 키 소유 증명 파일 (내용=키값 그대로)
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
| **공통 UI 프리미티브** ⭐신규 | [src/components/ui/](src/components/ui/) — `Button`(variant/size/href)·`Container`(width 3종)·`Section`+`SectionHeader`+`FieldLabel`·`Card`(solid/dashed)·`Input`+`Textarea`+`Field`·`Badge`(4 variant). 랜딩뿐 아니라 pricing·product·changelog·activate·contact·faq·about·legal·auth 등 전체 퍼블릭 페이지가 공용 |
| 히어로 보조 컴포넌트 ⭐신규 | [HeroDraftDemo.tsx](src/components/sections/HeroDraftDemo.tsx) — 초안 자동 타이핑 데모 · [StampSeal.tsx](src/components/sections/StampSeal.tsx) — 직인 스탬프 애니메이션(IntersectionObserver) |
| SEO 표준 URL / robots·sitemap ⭐신규 | [src/lib/site.ts](src/lib/site.ts) — `getSiteUrl()`/`SITE_URL` 단일 출처(env `NEXT_PUBLIC_SITE_URL`→`NEXT_PUBLIC_APP_URL`→폴백, apex→www 정규화). [src/app/robots.ts](src/app/robots.ts)·[src/app/sitemap.ts](src/app/sitemap.ts)가 공통 사용(Host·URL 표기 통일) |

> **테마 이원화 (GenieWork 재브랜딩)**: 퍼블릭 페이지(`/`·`/pricing`·`/product`·`/changelog`·`/activate`·`/contact`·`/faq`·`/about`·`/legal`·`/auth/*`)는 각 페이지 루트에 `theme-paper bg-paper text-ink` 클래스를 적용한 **페이퍼(라이트, 공문서) 테마**. `/dashboard`·`/admin`은 기존 **다크 테마**를 그대로 유지(변경 없음). `globals.css`에 두 테마 토큰이 공존(`--color-bg` 등 다크 + `--color-paper`/`--color-ink`/`--color-rule`/`--color-seal`/`--color-pen` 등 페이퍼), `@theme inline`으로 `layout.tsx`의 `Noto_Serif_KR`(`--font-serif-kr`)을 `font-serif` 유틸리티에 연결. 다크·페이퍼 양쪽에서 쓰이는 공통 컴포넌트는 `.theme-paper` 조상 셀렉터로 색상만 override. `Navbar`는 `fixed`→`sticky`로 전환.

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
| 검색엔진 색인 재요청 ⭐신규 | [src/app/admin/settings/ReindexPanel.tsx](src/app/admin/settings/ReindexPanel.tsx) — `admin/settings` 페이지에서 SettingsClient 아래 렌더, 버튼 클릭 시 sitemap 전체(또는 지정) URL을 IndexNow+Google Indexing에 제출. API: [src/app/api/admin/seo/reindex/route.ts](src/app/api/admin/seo/reindex/route.ts) (`requireAdmin` + [src/lib/seo/indexing.ts](src/lib/seo/indexing.ts)) |

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

라이선스 검증 저장소는 **제품별로 분리**되어 있습니다 (`validate/route.ts`가 `product`로 분기):

| 제품 | 저장소 | 환경변수 | 검증 헬퍼 |
|---|---|---|---|
| **GeniePost** (기본/`product` 미지정) | Google Sheets | `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_TAB` | [_lib.ts](src/app/api/license/_lib.ts) — HWID C·F열 |
| **GenieStock** | 별도 Supabase 프로젝트 | `LICENSE_SUPABASE_URL` + `LICENSE_SUPABASE_SERVICE_ROLE_KEY` | [_lib_supabase.ts](src/app/api/license/_lib_supabase.ts) — `license_keys`/`hwid_mapping`, 티어별 다중 PC |
| **GenieWork** | 별도 Supabase 프로젝트 (GenieStock과 분리) | `GW_SUPABASE_URL` + `GW_SUPABASE_SERVICE_ROLE_KEY` | [_lib_supabase.ts](src/app/api/license/_lib_supabase.ts) |
| **CoreZent 동기화 시트** | Google Sheets (LS 웹훅 전용) | `GOOGLE_SHEETS_SPREADSHEET_ID` + `GOOGLE_SHEETS_TAB_NAME` | [sheets.ts](src/lib/sheets.ts) — 결제 시 행 추가/만료 동기화 |

> ⚠️ 세 검증 경로 모두 응답 shape가 동일해 앱 코드 변경 불필요. GeniePost(Sheets) 경로는 코드상 **수정 금지** 표시.
> ⚠️ GenieStock·GenieWork 라이선스 DB 스키마는 `supabase/license-migrations/`에 별도로 있음 (본체 `supabase/migrations/`와 별개).

**GenieWork 테스터 AI 프록시** (GW_SUPABASE 전용 — 마이그레이션 005~007 + Edge Function):

테스터 키(`test*`)의 AI 호출을 서버가 대리하며 **라이선스별 USD 한도**를 강제합니다. 진짜 AI 제공사 키는 Edge Function secret(`ANTHROPIC_API_KEY`)에만 존재하고 클라/응답/로그에 절대 노출되지 않습니다.

| 구성 | 내용 |
|---|---|
| Edge Function | [supabase/functions/tester-ai-proxy/index.ts](supabase/functions/tester-ai-proxy/index.ts) — `gate → count_tokens → reserve → generate → settle/release` |
| 테이블 (005) | `tester_budget`(키별 `usd_cap`/`usd_spent`) · `tester_usage_log`(콜 로그) · `tester_model_price`(model→단가) · `license_program_config.tester_default_usd_cap`(기본 5.00) |
| 테이블 (007) | `tester_reservation`(콜별 hold 원장 — open/settled/released) |
| RPC | `tester_ai_gate`(006) · `tester_ai_reserve`/`tester_ai_settle`/`tester_ai_release`/`tester_ai_sweep_stale_reservations`(007) — 전부 `service_role` 전용, 키 단위 advisory lock으로 **cost는 DB 단가로만 계산**·**cap 하드 보장**(사전예약→정산으로 동시성 오버슈트 차단) |
| 한도 변경(무재배포) | 전역 `UPDATE license_program_config SET tester_default_usd_cap=N` / 키별 `tester_budget.usd_cap` |
| 에러코드 | `NOT_TESTER`·`INACTIVE`·`TESTER_BUDGET_EXCEEDED`·`TESTER_BUDGET_INSUFFICIENT`·`PRICE_NOT_CONFIGURED`·`PROVIDER_ERROR` 등 |

| 역할 | 파일 |
|---|---|
| **LS 웹훅 → CoreZent 시트 동기화** | [src/lib/sheets.ts](src/lib/sheets.ts) — `appendLicenseRow` / `updateLicenseExpiry` / `updateLicenseStatus` (A이메일/B시리얼/C HWID/D만료일/E상태/F=D-TODAY()/G Pro) |
| **앱이 호출하는 라이선스 API** | GeniePost: [_lib.ts](src/app/api/license/_lib.ts) (`findByKey`/`patchCell`/`isStopped`/`isExpired`/`calcRemainingDays`) · GenieStock·GenieWork: [_lib_supabase.ts](src/app/api/license/_lib_supabase.ts) (`findLicenseByKey`/`getHwidsForKey`/`registerHwid`) |
| validate (앱 첫 실행) | [src/app/api/license/validate/route.ts](src/app/api/license/validate/route.ts) — `{key, hwid, product?}` → `product`로 분기. GeniePost: HWID 빈칸이면 첫 활성화(C+F열); GenieStock·GenieWork: Supabase `hwid_mapping`에 등록(티어별 다중 PC). 응답 shape 동일 |
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

### 3.2 데스크톱 앱 → 라이선스 검증 (GeniePost / Google Sheets 경로)

> GenieStock·GenieWork는 동일한 요청/응답 shape를 쓰되 `_lib_supabase.ts`로 별도 Supabase(`license_keys`/`hwid_mapping`)에서 검증한다 (티어별 다중 PC 허용).

```
[GeniePost 데스크톱 앱 실행]
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
| `profiles` | id (auth.users FK), email, full_name, avatar_url, role(user/admin), status(active/inactive), created_at | 001, 023, 052(country 제거) |
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

### 5.3 라이선스 저장소 env (Google Sheets + 라이선스 전용 Supabase)

**Google Sheets (서비스 계정 JWT)**

| 환경변수 | 용도 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 두 시트 공통 |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `\n` 이스케이프 → 실제 줄바꿈 변환 후 사용 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` + `GOOGLE_SHEETS_TAB_NAME` | **CoreZent 동기화 시트** ([sheets.ts](src/lib/sheets.ts)) — LS 웹훅 동기화 |
| `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_TAB` | **GeniePost 라이선스 검증 시트** ([_lib.ts](src/app/api/license/_lib.ts)) — 앱이 호출 |

**라이선스 전용 Supabase (server 전용·RLS 우회, 본체 DB와 별개 프로젝트)**

| 환경변수 | 용도 |
|---|---|
| `LICENSE_SUPABASE_URL` + `LICENSE_SUPABASE_SERVICE_ROLE_KEY` | **GenieStock 라이선스** ([_lib_supabase.ts](src/app/api/license/_lib_supabase.ts)) — `license_keys`/`hwid_mapping` |
| `GW_SUPABASE_URL` + `GW_SUPABASE_SERVICE_ROLE_KEY` | **GenieWork 라이선스** — GenieStock과도 물리적으로 분리된 별도 프로젝트 |

**GenieWork 테스터 AI 프록시 — Edge Function secret** (Next.js `.env` 아님, `supabase secrets set`으로 GW 프로젝트에만 주입)

| 환경변수 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | 진짜 AI 제공사 키 — 서버(Edge Function) 전용. 클라/응답/로그 미노출 |
| `ANTHROPIC_BASE_URL`·`ANTHROPIC_VERSION` (선택) | 제공사 엔드포인트·API 버전 |
| `TESTER_MAX_TOKENS`·`TESTER_MAX_TOKENS_CAP` (선택) | 콜당 출력 토큰 기본/상한(과지출 방지) |
| `TESTER_USE_COUNT_TOKENS`·`TESTER_CHARS_PER_TOKEN` (선택) | 입력 토큰 정확 측정(count_tokens) on/off·폴백 추정 계수 |

> ⚠️ 본체 / GenieStock / GenieWork 3개 Supabase + 2개 Google Sheets가 모두 다른 env를 쓴다 — 혼동이 가장 흔한 버그. `GOOGLE_SHEET_ID`·`GOOGLE_SHEET_TAB`는 `.env.example`에 누락되어 있으니 `.env.local`에 직접 추가.

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

### 5.7 검색엔진 색인 제출 (IndexNow · Google Indexing API) ⭐신규

[src/lib/seo/indexing.ts](src/lib/seo/indexing.ts) — 서버 전용. `submitToIndexNow`(Bing·Naver·Yandex 등, 구글 미지원) + `submitToGoogleIndexing`(Google Indexing API v3 `urlNotifications:publish`, 서비스 계정 JWT) + `submitUrlsToSearchEngines`(둘 동시 제출). 표준 URL은 [src/lib/site.ts](src/lib/site.ts)의 `SITE_URL`을 공통 사용. 관리자 콘솔의 [ReindexPanel](src/app/admin/settings/ReindexPanel.tsx) → [/api/admin/seo/reindex](src/app/api/admin/seo/reindex/route.ts)에서 호출.

| 환경변수 | 용도 |
|---|---|
| `INDEXNOW_KEY` (선택) | IndexNow 키. 미설정 시 코드 기본 공개 키(`5ae2e03853bc47f8a8569d00d31788d4`) 사용 — `public/{키}.txt` 파일명과 반드시 일치해야 소유 증명됨 |
| `GOOGLE_INDEXING_CREDENTIALS` (선택) | Google Indexing API 서비스 계정 키 JSON 전체(1순위) |
| `GOOGLE_INDEXING_CLIENT_EMAIL` / `GOOGLE_INDEXING_PRIVATE_KEY` (선택) | 색인 전용 서비스 계정 개별 지정(2순위) |
| (미설정 시 자동 재사용) | 위 셋 다 없으면 `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`(시트용)를 재사용(3순위) |
| `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` (폴백) | `getSiteUrl()`이 읽는 표준 URL 소스. apex(`corezent.com`)로 설정돼도 `www.corezent.com`으로 정규화 |

> 위 4개 env는 모두 `.env.example`에 이미 반영됨(누락 없음). 어느 서비스 계정을 쓰든 **Search Console 자산에 '소유자'로 등록**돼 있어야 Google Indexing API 호출이 승인됨.

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
| 라이선스 저장소 분산 (Sheets×2 + Supabase×3) | 제품별로 저장소·env가 분리됨 (이력 상의 이유) | 향후 통합 검토 |
| `license_activations.last_seen_at` | 컬럼은 있으나 업데이트하는 API 없음 | 앱이 validate 호출 시 last_seen 갱신 로직 추가 필요 (TODO) |
| Google Sheets API | 분당 60회 read, 100회 write 한도 | LS 웹훅 단발 호출이므로 현재 안전, 단 batch revoke 시 주의 |
| LS 웹훅 멱등성 | 같은 이벤트 재전송 가능 | `lemon_squeezy_order_id` UNIQUE로 중복 INSERT 방지 |
| Rate Limit (Contact) | in-memory Map → 다중 인스턴스에서 정확하지 않음 | Vercel은 단일 region serverless라 큰 문제 없음 |
| BotID 토큰 | 클라이언트만 발급 가능 (네이티브 앱 X) | 앱 호출 라우트(`/api/license/*`)는 BotID 미적용 |
| 디자인 시스템 이원화 (GenieWork 재브랜딩) | 퍼블릭(페이퍼: `--color-paper`/`--color-ink` 등)과 `dashboard`·`admin`(다크: `--color-bg`/`--color-surface` 등)이 서로 다른 토큰·컴포넌트를 사용 | 새 컴포넌트 작성 시 대상 영역(퍼블릭 vs 대시보드/관리자) 확인 후 `src/components/ui/`(페이퍼 전용) 또는 기존 다크 스타일 중 맞는 쪽 사용. 양쪽에서 쓰이는 컴포넌트는 `.theme-paper` 조상 셀렉터로 분기 |
| Google Indexing API 일일 할당량 | 기본 200건/일, 공식 지원 범위는 채용·라이브 구조화 데이터가 우선(그 외 URL은 승인이 보수적일 수 있음) | 대량 URL은 IndexNow(Bing·Naver 등, 별도 제한 없음)가 더 안정적 — 두 채널 모두 시도하되 부분 실패 허용 |
| Google 서비스 계정 JSON 커밋 방지 | 리포지토리 루트에 다운로드한 `.json` 키 파일을 실수로 두는 사례 발생 | `.gitignore`에 `corezent-saas-*.json`·`*-service-account*.json`·`gcp-*.json` 패턴 추가 — 신규 서비스 계정 키 파일명도 이 패턴을 따를 것 |

---

## 9. 변경 이력

| 날짜 | 작업 | 변경 규모 |
|---|---|---|
| 2026-07-02 | 퍼블릭 페이지 GenieWork 재브랜딩(페이퍼 테마) — 공통 UI 프리미티브(`ui/`) 6종, 히어로 보조 컴포넌트 2종 신규, `globals.css` 페이퍼 토큰·애니메이션 추가, `layout.tsx` Noto Serif KR 도입, 퍼블릭 전 페이지 `theme-paper` 적용(dashboard·admin은 다크 유지), `products.ts` 페이퍼 뱃지 상수, `CountrySelect` 이중 테마 지원, Navbar fixed→sticky | 신규 8 · 수정 다수(프레젠테이션 레이어, 로직/DB/API 변경 없음) |
| 2026-07-07 | SEO 색인 자동화 — 표준 URL 단일 출처(`lib/site.ts`) 신규 도입해 `robots.ts`·`sitemap.ts`가 공통 사용(Host를 항상 www.corezent.com으로 정규화), IndexNow+Google Indexing API 제출 헬퍼(`lib/seo/indexing.ts`) 및 관리자 전용 재색인 API(`/api/admin/seo/reindex`)·설정 페이지 버튼(`ReindexPanel`) 추가, IndexNow 키 소유 증명 파일 배포, Google 서비스 계정 JSON `.gitignore` 패턴 추가 | 신규 5 · 수정 3(+.gitignore) |
| 2026-07-23 | 국가(country) 필드 전면 제거 — 회원가입 국가 선택·저장 흐름, dashboard 설정·admin(사용자 목록/상세·주문 상세) 국가 표시 삭제, `profiles.country` 컬럼 DROP(052), 죽은 코드 `CountrySelect`·`lib/countries.ts` 삭제 | 삭제 2 · 수정 7 · 마이그레이션 1(052) |

---

*최초 작성: 2026-04-29 | 프로젝트: CoreZent SaaS*
