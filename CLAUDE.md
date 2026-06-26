# CLAUDE.md — CoreZent SaaS 프로젝트 가이드

> 이 파일은 AI 어시스턴트(Claude / Claude Code)가 이 프로젝트를 이해하고
> 일관성 있게 작업할 수 있도록 작성된 핵심 컨텍스트 문서입니다.
>
> ⚠️ **상세 구조·데이터 흐름·DB 스키마의 단일 출처(Source of Truth)는 `PROJECT_STRUCTURE.md`** 입니다.
> 이 문서와 PROJECT_STRUCTURE.md가 충돌하면 PROJECT_STRUCTURE.md(최신 구현)를 따릅니다.

---

## 📌 프로젝트 개요

**CoreZent**는 운영자(개발자)가 직접 만든 여러 소프트웨어 제품(GeniePost·GenieStock 등)을 최종 사용자에게 직접 판매하는 브랜드 홈페이지 겸 판매 플랫폼입니다.

- **서비스 유형**: 소프트웨어 판매 웹사이트 (브랜드 홈페이지 + 구독/단일 구매 플랫폼)
- **판매 제품 유형**: 데스크톱 앱, 웹 도구, 모바일 앱, 크롬 익스텐션 등
- **판매 방식**: 구독(월간/연간) 또는 단일 구매(one-time) 선택
- **주요 대상**: 소프트웨어를 구매하려는 신규/기존 고객
- **핵심 목표**:
  1. 각 제품 소개 및 구매 유도
  2. 구독·단일 구매 결제 시스템 제공 (Lemon Squeezy)
  3. 회원 가입 후 대시보드에서 구매 내역·라이선스·내 정보 관리
  4. 이메일 인증·비밀번호 재설정 등 계정 관리 (Supabase Auth)
  5. 제품별 버전 히스토리·다운로드(Changelog) 운영

> ⚠️ CoreZent는 다른 사업자에게 SaaS 툴을 파는 B2B 서비스가 아닙니다.
> 운영자가 만든 소프트웨어를 최종 사용자에게 직접 판매하는 B2C 구조입니다.

---

## 🛠️ 기술 스택

| 영역 | 기술 | 버전/비고 |
|------|------|-----------|
| 프레임워크 | [Next.js](https://nextjs.org/) | `15.5.14` (App Router, Turbopack, dev port **3003**) |
| 언어 | TypeScript | `^5` |
| 스타일 | [Tailwind CSS](https://tailwindcss.com/) | `^4` (`globals.css`의 `@theme`) |
| 런타임 | React | `^19` |
| 인증·DB | [Supabase](https://supabase.com/) | `@supabase/ssr ^0.10`, `@supabase/supabase-js ^2.101` |
| 결제 | [Lemon Squeezy](https://www.lemonsqueezy.com/) | 체크아웃 + 웹훅(HMAC) |
| 라이선스 | Google Sheets API | `googleapis ^171` (서비스 계정 JWT) |
| 메일 | Nodemailer | `^8` (SMTP) |
| 봇 차단 | Vercel BotID | `botid ^1.5` |
| 분석 | @vercel/analytics, @vercel/speed-insights | — |
| 아이콘 | lucide-react / @tabler/icons-react / @radix-ui/react-icons | `DynamicIcon`이 동적 import |

### 주요 명령어

```bash
npm run dev    # Turbopack 개발 서버 (port 3003)
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버
npm run lint   # ESLint 검사
```

### 다국어

- 현재 기본 언어는 영어. 한국어·일본어 확장을 고려한 구조를 유지(아직 전면 i18n 구현은 아님).

---

## 🏗️ 프로젝트 구조 (요약)

> 전체 트리·파일별 설명은 **`PROJECT_STRUCTURE.md` §1, §2** 참조.

```
CoreZent_SaaS/
├── CLAUDE.md                  # 이 파일 — AI 컨텍스트 가이드
├── PROJECT_STRUCTURE.md       # 상세 구조·데이터 흐름·DB (단일 출처)
├── next.config.ts             # withBotId 래핑
├── .env / .env.example        # 환경 변수 (.env는 커밋 금지)
│
├── src/
│   ├── middleware.ts          # Supabase 세션 갱신 + /dashboard·/admin 보호
│   ├── instrumentation-client.ts  # Vercel BotID 초기화
│   ├── app/
│   │   ├── page.tsx           # 랜딩(force-dynamic, DB SSR)
│   │   ├── layout.tsx · globals.css  # 루트 레이아웃 + @theme + 폰트
│   │   ├── auth/              # login·register·reset-password·update-password
│   │   ├── dashboard/         # licenses·billing·settings·support (로그인 필수)
│   │   ├── admin/             # users·orders·products·licenses·support·settings·content (role=admin)
│   │   ├── api/
│   │   │   ├── auth/check-email/      # 탈퇴(inactive) 재가입 차단 + BotID
│   │   │   ├── contact/               # 비회원 문의(BotID·rate limit·honeypot)
│   │   │   ├── subscriptions/cancel/  # LS 구독 취소
│   │   │   ├── webhooks/lemonsqueezy/ # LS 결제 이벤트 8종
│   │   │   ├── license/{validate,reset,upgrade}/  # ⭐ 앱 호출. product 분기: geniepost=Sheets(_lib.ts), geniestock·geniework=별도 Supabase(_lib_supabase.ts)
│   │   │   └── admin/...
│   │   ├── pricing/ · product/ · changelog/ · activate/
│   │   └── about/ · contact/ · faq/ · legal/
│   ├── components/            # sections/·common/·Navbar·Footer·DynamicIcon·Analytics·CookieConsentBanner
│   └── lib/
│       ├── supabase/{client,server,admin}.ts   # admin=SERVICE_ROLE_KEY(웹훅·관리자 전용)
│       ├── lemonsqueezy.ts   # verifyLSWebhook·buildCheckoutUrl·generateSerialKey·fetchLsLicenseKey
│       ├── sheets.ts         # CoreZent 라이선스 시트(LS 웹훅 동기화)
│       ├── email.ts          # nodemailer + HTML 템플릿
│       └── cookies.ts · countries.ts · products.ts
│
└── supabase/migrations/       # 001 ~ 027 (본체 DB)  ·  supabase/license-migrations/  # GenieStock·GenieWork 라이선스 DB
```

---

## 🧩 아키텍처 핵심 (구현 기준)

> 상세 흐름은 **`PROJECT_STRUCTURE.md` §3(데이터 흐름)·§4(DB)·§5(외부 API)** 참조.

| 영역 | 구현 방식 |
|------|----------|
| **인증** | Supabase Auth (SSR·쿠키 기반). `middleware.ts`가 세션 갱신 + `/dashboard`·`/admin` 보호. 탈퇴 계정은 `profiles.status='inactive'`로 재가입 차단 |
| **권한(RLS)** | 일반 경로는 쿠키 기반 클라이언트(RLS 적용). 웹훅·`/api/admin/*`만 admin 클라이언트(SERVICE_ROLE_KEY, RLS 우회) 사용 |
| **결제** | Lemon Squeezy. `buildCheckoutUrl`로 `custom_data.user_id` 주입 → 웹훅(`/api/webhooks/lemonsqueezy`)이 8개 이벤트 처리. 서명은 rawBody + HMAC-SHA256 검증 |
| **라이선스** | **제품별 분기** — GeniePost는 Google Sheets(`GOOGLE_SHEET_ID`, HWID C·F열, `_lib.ts`), GenieStock·GenieWork는 **각각 별도 Supabase 프로젝트**(`LICENSE_SUPABASE_*`·`GW_SUPABASE_*`, `license_keys`/`hwid_mapping`, 티어별 다중 PC HWID, `_lib_supabase.ts`). 앱이 `/api/license/{validate,reset,upgrade}`에 `product`로 분기 호출. PC 교체는 reset |
| **봇 차단** | Vercel BotID — public POST(`/api/contact`, `/api/auth/check-email`)만 보호. `/api/license/*`·웹훅은 **미적용**(앱·서버는 토큰 발급 불가) |
| **메일** | Nodemailer SMTP (`lib/email.ts`) — 문의 알림·주문 확인. 메일 실패해도 주 흐름(DB 저장)은 진행 |
| **DB** | Supabase PostgreSQL, 마이그레이션 001~027 (profiles·products·orders·licenses·subscriptions·front_*·support_tickets·inquiries 등) |
| **CMS** | 관리자 `admin/content`에서 랜딩 섹션·텍스트·FAQ 등 편집(`front_*` 테이블) |
| **배포** | Vercel 자동 배포 (`git push origin main` → 즉시 빌드) |

---

## 📋 페이지·기능 명세 (구현 기준)

| 경로 | 설명 |
|------|------|
| `/` (`app/page.tsx`) | 랜딩 — Hero(The Glow)·Product·Pricing·HowItWorks·Features·Testimonials·FAQ·CTA (DB 동적, 섹션 visibility/순서는 `front_sections`) |
| `/pricing` | 요금제 — 월/연 토글, 카테고리 필터, DB 동적 가격 카드 |
| `/product` | 상품 목록 (More Info 아코디언, Coming Soon 플레이스홀더 자동 채움) |
| `/changelog` | 버전 히스토리 + 다운로드 링크 |
| `/activate` | 시리얼 활성화 화면 |
| `/dashboard` | 사용자 영역 — 라이선스 목록(페이지네이션)·결제/구독·설정·고객지원 |
| `/admin` | 관리자 콘솔 — users·orders·products(+Changelog)·licenses(Revoke)·support·settings·content |
| `/auth/*` | 로그인·회원가입·비밀번호 재설정 |
| `/contact` · `/faq` · `/about` · `/legal` | 문의(BotID 보호)·FAQ·소개·약관/개인정보 |

> 제품 매뉴얼/가이드는 별도 매뉴얼 포털이 아니라 **상품의 `manual_url`** 및 `/changelog`로 제공합니다.

---

## 🎨 디자인 시스템

### 색상 팔레트 (CSS 변수 — `globals.css @theme`)

Raycast 스타일 기반, 푸른빛이 감도는 딥 네이비 계열.

| 구분 | 색상명 | HEX | 용도 |
|------|--------|-----|------|
| Background | Deep Navy | `#0B1120` | 최하단 배경. 완전한 검정이 아니어서 눈이 편안함 |
| Surface | Midnight Blue | `#111A2E` | 카드·섹션 구분. 배경보다 한 단계 밝음 |
| Border | Dark Slate | `#1E293B` | 벤토 그리드 테두리, 구분선 |
| Primary Text | Soft White | `#F1F5F9` | 본문 텍스트 |
| Secondary Text | Slate Blue | `#94A3B8` | 설명 문구, 부가 정보 |
| Heading | White | `#ffffff` | 제목 |
| Accent | Electric Blue | `#38BDF8` | CTA 버튼, 강조 포인트 |

```css
:root {
  /* Background */
  --color-bg:             #0B1120;
  --color-surface:        #111A2E;
  --color-border:         #1E293B;

  /* 텍스트 */
  --color-text:           #F1F5F9;
  --color-text-muted:     #94A3B8;
  --color-text-heading:   #ffffff;

  /* Accent */
  --color-accent:         #38BDF8;
  --color-accent-dark:    #0ea5e9;

  /* 상태 */
  --color-success:        #00e676;
  --color-warning:        #ffc107;
  --color-error:          #ff5252;

  /* 그라디언트 */
  --gradient-hero:        radial-gradient(ellipse at center, #1E293B 0%, #0B1120 70%);
  --gradient-card:        linear-gradient(145deg, #111A2E, #0B1120);
}
```

> 색상 의미는 서구 표준: 빨강=오류, 초록=성공, 파랑=강조/CTA.

### 타이포그래피

- **헤딩/본문**: [Geist](https://vercel.com/font) (1순위) 또는 [Inter](https://fonts.google.com/specimen/Inter) (대체)
  - Headline: `font-weight: 700` / Body: `font-weight: 400`
- **코드/시리얼/버전**: `JetBrains Mono` — `font-size: 14px`
- **정렬**: 섹션 헤딩·CTA 등 주요 텍스트는 중앙 정렬 선호
- **가독성**: `line-height` 1.6~1.8, 적절한 `letter-spacing`

### 레이아웃 원칙

- **Max width**: `1280px` (container)
- **Grid**: CSS Grid + Flexbox 혼용
- **Breakpoints**: `480px / 768px / 1024px / 1280px`
- **Spacing scale**: `4px` 단위 (4, 8, 12, 16, 24, 32, 48, 64, 96px)
- **Border radius**: `8px`(컴포넌트) / `12px`(벤토) / `16px`(카드) / `24px`(모달)

### 디자인 구현 전략 (Raycast 스타일) — 모든 페이지 적용

**① Hero — 'The Glow'**: 배경 중앙에 은은한 빛이 퍼지는 입체감.
```css
background: radial-gradient(ellipse 80% 50% at 50% 0%, #1E293B 0%, #0B1120 100%);
```
**② 벤토 그리드(Bento Grid)**: 기능·카드 격자 배치. `border: 1px solid #1E293B`, `border-radius: 12px`, CSS Grid 다양한 셀.
**③ 중앙 정렬 + Negative Space**: 주요 텍스트·CTA 정중앙, 좌우 여백 20%+ 확보.

### 컴포넌트 스타일

- **버튼**: 그라디언트 or 아웃라인, hover 시 `translateY(-2px)` + `box-shadow`
- **카드**: `backdrop-filter: blur(12px)` glassmorphism
- **입력 필드**: 다크 배경 + focus 시 primary 테두리 glow
- **뱃지/태그**: pill 형태, 상태별 색상

---

## 🔐 보안 & 환경 변수

> 실제 사용 변수 전체는 **`PROJECT_STRUCTURE.md` §5** 참조. `.env`는 반드시 `.gitignore`에 포함.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...           # 서버 전용 (웹훅·관리자 라우트). 클라이언트 노출 절대 금지

# Lemon Squeezy
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_STORE_ID=...

# Google Sheets (서비스 계정 JWT)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...  # \n 이스케이프 → 실제 줄바꿈 변환 후 사용
GOOGLE_SHEETS_SPREADSHEET_ID=...        # CoreZent 동기화 시트(LS 웹훅이 행 추가/만료 동기화)
GOOGLE_SHEETS_TAB_NAME=...
GOOGLE_SHEET_ID=...                     # GeniePost 라이선스 검증 시트(앱이 호출, _lib.ts) — .env.example에 누락되기 쉬움
GOOGLE_SHEET_TAB=...

# 라이선스 전용 Supabase (본체 DB와 별개, server 전용·RLS 우회)
LICENSE_SUPABASE_URL=...                # GenieStock 라이선스(license_keys·hwid_mapping)
LICENSE_SUPABASE_SERVICE_ROLE_KEY=...
GW_SUPABASE_URL=...                     # GenieWork 라이선스 전용 (GenieStock과 물리적 분리)
GW_SUPABASE_SERVICE_ROLE_KEY=...

# 메일 (nodemailer SMTP) — 정확한 키 이름은 lib/email.ts 참조
# SMTP 호스트/포트/계정/비밀번호, ADMIN_EMAIL
```

**보안 규칙**:
- 시크릿(서비스 키, 웹훅 시크릿, Google private key)은 **절대 클라이언트 JS에 노출 금지**. `NEXT_PUBLIC_` 접두사가 없는 변수는 서버에서만 사용.
- `lib/supabase/admin.ts`(SERVICE_ROLE_KEY)는 웹훅·`/api/admin/*` 등 **서버 전용 경로**에서만 import.
- 웹훅은 rawBody + `X-Signature` HMAC-SHA256 검증을 **처리 전에** 수행.
- ⚠️ 라이선스 저장소가 **제품별로 분리**돼 있다 — 본체 Supabase / GenieStock(`LICENSE_SUPABASE_*`) / GenieWork(`GW_SUPABASE_*`) 3개 프로젝트 + 2개 Google Sheets(`GOOGLE_SHEETS_SPREADSHEET_ID` 동기화용 vs `GOOGLE_SHEET_ID` GeniePost 검증용). 이 env들을 혼동하는 것이 가장 흔한 버그.

---

## ✍️ 코딩 컨벤션

### TypeScript / React

- **컴포넌트**: 파일당 하나, 300줄 초과 시 분리
- **Server / Client**: 기본은 Server Component. 상태·이벤트 필요 시에만 `'use client'`. 서버 전용 모듈을 client 컴포넌트에 import 금지
- **타입**: 모든 props·함수에 타입 명시, `any` 금지
- **비동기**: `async/await` (`.then()` 지양)
- **에러 핸들링**: try-catch로 처리하고 의미 있는 에러 반환. 서버리스(Vercel) 환경이라 로컬 파일 로깅은 사용하지 않고 **콘솔/Vercel 로그·모니터링**으로 확인
- **주석(JSDoc 한국어)**: 모든 함수·클래스 상단에 한국어 설명 필수

```typescript
/**
 * @함수명: fetchUserLicenses
 * @설명: 사용자 라이선스 목록을 조회합니다.
 * @매개변수: userId - 사용자 고유 ID
 * @반환값: 라이선스 객체 배열
 */
async function fetchUserLicenses(userId: string): Promise<License[]> { ... }
```

### Tailwind CSS

- 색상·간격은 `globals.css`의 `@theme` 변수 사용, 임의 값(`[]`) 최소화
- 반응형은 **모바일 퍼스트**: `sm:` `md:` `lg:` 순서
- 반복 클래스 조합은 `@layer components`에 추출
- 아이콘은 `DynamicIcon` 경유(lucide/tabler/radix 직접 import 지양)

### Next.js

- DB를 SSR로 그리는 페이지는 `export const dynamic = 'force-dynamic'` (예: `app/page.tsx`)
- 동일 파일에서 `next/dynamic`을 쓸 때는 `export const dynamic`과 충돌하지 않도록 `import lazy from 'next/dynamic'` alias

### SEO (Next.js Metadata API)

- 모든 페이지에 `export const metadata: Metadata`(또는 `generateMetadata`) 필수
- `title`·`description`·OG 이미지 반드시 포함, `<h1>` 구조 유지

---

## 🚀 개발 워크플로우

### 시작

```bash
npm run dev   # Turbopack 개발 서버 (기본 port 3003 — 실제 포트는 netstat로 확인)
```

### 브라우저 테스트 우선순위

1. Chrome (기준) → 2. Edge → 3. Firefox → 4. Safari(모바일)

### 작업 순서 (권장)

1. `globals.css @theme` 디자인 토큰 확인
2. 공통 컴포넌트(Navbar/Footer/카드/버튼) 정합성
3. 페이지 단위 구현 → 4. API 라우트/데이터 연동 → 5. `npm run build`로 검증

---

## 📝 AI 작업 규칙 (Claude Code 전용)

1. **파일 크기 제한**: 컴포넌트/모듈 파일은 300줄 이하 유지. 초과 시 분리
2. **변수 하드코딩 금지**: 색상·사이즈는 모두 `@theme` 변수/디자인 토큰 사용
3. **한국어 주석**: 모든 함수·클래스 상단에 한국어 설명 필수
4. **영향 분석 우선**: 기존 파일 수정 시 의존성 파일 목록 먼저 파악
5. **라이선스 보안**: 검증은 `product`별로 분기 — GeniePost=Google Sheets HWID 바인딩(C·F열), GenieStock·GenieWork=별도 Supabase(`license_keys`/`hwid_mapping`, 티어별 다중 PC). PC 교체는 `reset`. 결제 없이 키 발급 금지
6. **에러 처리**: 런타임 오류는 try-catch로 처리하고 서버 로그/모니터링으로 확인 (로컬 파일 기록 사용 안 함 — 서버리스 환경)
7. **버전 고정**: 외부 라이브러리는 명시된 버전만 사용 (임의 major 변경 금지)
8. **디자인 퀄리티**: glassmorphism, 그라디언트, 마이크로 애니메이션 적극 활용
9. **SEO 필수**: 페이지 생성 시 `metadata`(title·description·OG)와 `<h1>` 구조 포함
10. **즉시 실행, 질문 최소화**: 작업 진행 여부를 일일이 묻지 말고 바로 실행 후 변경 사항 보고. 단, **DB 스키마(마이그레이션)·핵심 구조 변경 시에만 승인 후 진행**
11. **이미지 포맷**: WebP 우선(로딩 최적화), 고해상도 제공
12. **Footer 고정 요소**: 모든 페이지 Footer에 CoreZent 사업자 정보 및 구독 서비스 링크 유지
13. **작업 완료 후 결과 공유**: 변경 파일 목록 + 주요 변경 요약(bullet) + 확인 URL(`netstat`으로 실제 리스닝 포트 확인 후 안내, 예: `http://localhost:3003/pricing`)
14. **⚠️ 작업 완료 후 반드시 git push**: 커밋이 끝나면 항상 `git push origin main`을 실행해 Vercel 자동 배포를 트리거. push 없이 커밋만 하면 배포가 되지 않으며, **push까지 완료해야 작업이 끝난 것으로 간주**

---

# Lemon Squeezy 연동 가이드 (Claude Code 참고용)

이 섹션은 Lemon Squeezy 결제·구독 연동의 핵심 가이드입니다. 결제 관련 코드를 작성할 때 우선 참고하십시오.
(구현체: `lib/lemonsqueezy.ts`, `app/api/webhooks/lemonsqueezy/route.ts`)

## 1. API 기본
- **Base URL:** `https://api.lemonsqueezy.com/v1/`
- **인증:** 모든 요청에 `Authorization: Bearer {API_KEY}` 헤더
- **헤더:** `Accept: application/vnd.api+json`, `Content-Type: application/vnd.api+json`
- **데이터 규격(JSON:API):** 응답/요청은 `data` 객체 안에 `type`·`id`·`attributes`·`relationships`, 연관 데이터는 `included` 배열

## 2. 프론트엔드: Lemon.js
- **스크립트:** `<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>`
- **체크아웃 오버레이:** `<a class="lemonsqueezy-button">` 또는 `LemonSqueezy.Url.Open("CHECKOUT_URL")`
- **이벤트:** `LemonSqueezy.Setup()` 초기화 후 `Checkout.Success`(결제 완료 order 반환) 등 수신

## 3. 백엔드 핵심
### 3.1 체크아웃 세션
이메일·이름 등을 미리 채우거나, 웹훅에서 식별할 `custom_data`(예: `user_id`)를 전달해 동적 체크아웃 URL 생성. 예상 금액 미리보기는 `preview: true`.
### 3.2 구독 관리
- 취소(cancel)·일시정지(pause)·재개(unpause) PATCH
- 플랜 변경: Product/Variant ID 변경 PATCH(차액 Proration 계산, 즉시 청구 조절 가능)
### 3.3 고객 포털
Signed URL을 생성해 고객이 로그인 없이 결제 수단 업데이트·영수증 다운로드·플랜 변경 가능.

## 4. 웹훅 (Webhooks & Security)
- **서명 검증:** 요청 헤더 `X-Signature`를 **rawBody**에 웹훅 시크릿으로 `HMAC-SHA256` 해싱한 값과 비교. 검증 통과 후 파싱.
- **멱등성:** `lemon_squeezy_order_id` UNIQUE로 재전송 중복 INSERT 방지.
- **처리 이벤트 (구현된 8종):**
  `order_created` · `subscription_created` · `subscription_updated` · `subscription_cancelled` · `subscription_expired` · `subscription_payment_failed` · `subscription_paused`/`subscription_unpaused` · `order_refunded`
  - `subscription_updated` 시 `licenses.expires_at = current_period_end` 동기화, 시트 만료일 갱신
- **Next.js 구현:** App Router에서 `app/api/webhooks/lemonsqueezy/route.ts`가 `req.text()`로 rawBody 확보 → 서명 검증 → 파싱 → 분기 처리.

## 5. 부가 기능
- **라이선스 키:** 제품 설정에서 라이선스 키 활성화 시 결제와 함께 발급. API(`/v1/licenses/activate`·`validate`·`deactivate`)로 유효성·기기 활성화 제어. (CoreZent는 일반 GeniePost는 자체 `generateSerialKey`, Pro·신규 상품은 `fetchLsLicenseKey`로 LS 발급 키 사용)
- **무료 평가판:** 제품 설정의 "Trial period" → 웹훅 `status: on_trial`로 제어.
- **할인 쿠폰:** 특정 개월 수만 적용 후 원가로 복귀하는 "Expiring Subscription Discounts" 구성 가능.

---

*최초 작성: 2026-04-04 | 구현 기준 갱신: 2026-06-26 | 프로젝트: CoreZent SaaS*
