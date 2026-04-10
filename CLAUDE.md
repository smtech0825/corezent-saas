# CLAUDE.md — CoreZent SaaS 프로젝트 가이드

> 이 파일은 AI 어시스턴트(Claude/Antigravity)가 이 프로젝트를 이해하고  
> 일관성 있게 작업할 수 있도록 작성된 핵심 컨텍스트 문서입니다.

---

## 📌 프로젝트 개요

**CoreZent**는 개발자(사이트 운영자)가 직접 만든 여러 소프트웨어 제품을 판매하는 브랜드 홈페이지 겸 판매 플랫폼입니다.

- **서비스 유형**: 소프트웨어 판매 웹사이트 (브랜드 홈페이지 + 구독/단일 구매 플랫폼)
- **판매 제품 유형**: 데스크톱 앱, 웹 도구, 모바일 앱, 크롬 익스텐션 등 다양한 소프트웨어
- **판매 방식**: 구독(월간/연간) 또는 단일 구매(one-time purchase) 선택 가능
- **주요 대상**: 소프트웨어를 구매하려는 신규 고객, 기존 구매자
- **핵심 목표**:
  1. 각 소프트웨어 제품의 소개 및 구매 유도
  2. 구독 및 단일 구매 결제 시스템 제공
  3. 회원 가입 후 My Page에서 구매 내역·라이선스·내 정보 관리
  4. 이메일 인증, 비밀번호 재설정 등 계정 관리 기능
  5. 제품별 매뉴얼·가이드 포털 운영

> ⚠️ CoreZent는 다른 사업자에게 SaaS 툴을 파는 서비스가 아닙니다.
> 운영자(개발자)가 만든 소프트웨어를 최종 사용자에게 직접 판매하는 구조입니다.

---

## 🏗️ 프로젝트 구조

```
CoreZent_SaaS/
├── CLAUDE.md                  # 이 파일 — AI 컨텍스트 가이드
├── .env                       # 환경 변수 (절대 커밋 금지)
├── .env.example               # 환경 변수 예시 템플릿
├── .gitignore
│
├── index.html                 # 메인 랜딩 페이지
│
├── pages/                     # 개별 HTML 페이지
│   ├── pricing.html           # 요금제/구독 플랜
│   ├── activate.html          # 시리얼 번호 활성화
│   ├── dashboard.html         # 사용자 대시보드
│   ├── manuals.html           # 매뉴얼 포털 (목록)
│   ├── manual-detail.html     # 개별 매뉴얼 상세
│   ├── login.html             # 로그인
│   └── register.html          # 회원가입
│
├── assets/
│   ├── css/
│   │   ├── variables.css      # 디자인 토큰 (색상, 폰트, 간격)
│   │   ├── base.css           # 리셋 & 기본 스타일
│   │   ├── components.css     # 공통 컴포넌트 (버튼, 카드, 모달)
│   │   └── pages/             # 페이지별 스타일
│   │       ├── landing.css
│   │       ├── pricing.css
│   │       ├── dashboard.css
│   │       └── manuals.css
│   │
│   ├── js/
│   │   ├── main.js            # 전역 초기화 & 공통 유틸
│   │   ├── api.js             # API 호출 레이어 (fetch wrapper)
│   │   ├── auth.js            # 인증/세션 관리
│   │   ├── license.js         # 시리얼 번호 활성화 로직
│   │   ├── dashboard.js       # 대시보드 데이터 바인딩
│   │   └── manuals.js         # 매뉴얼 포털 로직
│   │
│   └── images/                # 정적 이미지 에셋
│
└── error_log.txt              # 런타임 오류 로그 (자동 생성)
```

---

## 🎨 디자인 시스템

### 색상 팔레트 (CSS 변수)

Raycast 스타일 기반, 푸른빛이 감도는 딥 네이비 계열.

| 구분 | 색상명 | HEX | 용도 |
|------|--------|-----|------|
| Background | Deep Navy | `#0B1120` | 최하단 배경. 완전한 검정이 아니어서 눈이 편안함 |
| Surface | Midnight Blue | `#111A2E` | 카드·섹션 구분. 배경보다 한 단계 밝음 |
| Border | Dark Slate | `#1E293B` | 벤토 그리드 테두리, 구분선 |
| Primary Text | Soft White | `#F1F5F9` | 본문 텍스트. 쨍한 흰색 대신 부드러운 흰색 |
| Secondary Text | Slate Blue | `#94A3B8` | 설명 문구, 부가 정보 |
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

### 타이포그래피

- **헤딩/본문**: [Geist](https://vercel.com/font) (Vercel, 1순위) 또는 [Inter](https://fonts.google.com/specimen/Inter) (대체)
  - Headline: `font-weight: 700` (Bold)
  - Body: `font-weight: 400` (Regular)
- **코드/시리얼/버전**: `JetBrains Mono` — `font-size: 14px`, 기술 사양·버전 표기에 사용
- **텍스트 정렬**: 섹션 헤딩·CTA 등 주요 텍스트는 중앙 정렬 선호
- **가독성**: 적절한 `line-height`(1.6~1.8)와 `letter-spacing` 유지

### 레이아웃 원칙

- **Max width**: `1280px` (container)
- **Grid**: CSS Grid + Flexbox 혼용
- **Breakpoints**: `480px / 768px / 1024px / 1280px`
- **Spacing scale**: `4px` 단위 (4, 8, 12, 16, 24, 32, 48, 64, 96px)
- **Border radius**: `8px` (컴포넌트), `16px` (카드), `24px` (모달)

### 디자인 구현 전략 (Raycast 스타일)

Raycast의 고급스러움을 재현하기 위한 3가지 핵심 요소. 모든 페이지에 반드시 적용.

#### ① Hero 섹션 — 'The Glow' 효과
배경 중앙에 은은한 빛이 퍼지는 효과. 텍스트가 공중에 떠 있는 듯한 입체감을 만듦.
```css
/* Hero 배경에 적용 */
background: radial-gradient(ellipse 80% 50% at 50% 0%, #1E293B 0%, #0B1120 100%);
```

#### ② 벤토 그리드 (Bento Grid) 레이아웃
기능 소개, 매뉴얼 카드 등에 격자형 박스 배치.
- **Border**: `1px solid #1E293B` (아주 얇게)
- **Border-radius**: `12px`
- CSS Grid로 다양한 크기의 셀 구성

#### ③ 중앙 정렬 + Negative Space
- 주요 텍스트·CTA는 정중앙 정렬
- 좌우 여백 최소 20% 이상 확보
- "비어 보이는 것이 아니라, 정보에 집중하게 만드는 힘"

### 컴포넌트 스타일 가이드

- **버튼**: 그라디언트 or 아웃라인, hover 시 `transform: translateY(-2px)` + `box-shadow`
- **카드**: `backdrop-filter: blur(12px)`, glassmorphism 효과
- **입력 필드**: 다크 배경 + focus 시 primary 색상 테두리 glow
- **뱃지/태그**: pill 형태, 색상별 상태 표시

---

## 🛠️ 기술 스택

### 코어 프레임워크

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | [Next.js](https://nextjs.org/) | `15.5.14` (App Router, Turbopack) |
| 언어 | TypeScript | `^5` |
| 스타일 | [Tailwind CSS](https://tailwindcss.com/) | `^4` |
| 런타임 | React | `^19` |

### 프로젝트 구조

```
src/
├── app/                  # App Router 페이지
│   ├── layout.tsx        # 루트 레이아웃 (메타데이터, 폰트)
│   ├── page.tsx          # 랜딩 페이지 (/)
│   ├── globals.css       # 전역 스타일 + 폰트 정의 + @theme
│   ├── pricing/          # 요금제 페이지
│   ├── activate/         # 라이선스 활성화
│   ├── dashboard/        # 사용자 대시보드
│   ├── manuals/          # 매뉴얼 포털
│   └── auth/             # 로그인/회원가입
├── components/           # 재사용 컴포넌트
└── lib/                  # 유틸리티, API 헬퍼
public/
└── fonts/                # 자체 호스팅 woff2 폰트 파일
```

### 주요 명령어

```bash
npm run dev    # 개발 서버 (Turbopack)
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버
npm run lint   # ESLint 검사
```

### 다국어 지원

- **기본 언어**: 영어 (`lang="en"`)
- **지원 언어**: 한국어, 일본어 (글로벌 확장 고려한 i18n 구조 유지)
- HTML `lang` 속성 및 텍스트 리소스는 언어별로 분리 가능한 구조로 설계

### 백엔드 연동 (향후 계획)

- **API**: RESTful JSON API (엔드포인트는 `.env`의 `API_BASE_URL`로 관리)
- **인증**: JWT 토큰 기반 (localStorage 저장, HttpOnly Cookie 검토)
- **결제**: 아임포트(포트원) 또는 토스페이먼츠 연동 예정

---

## 📋 페이지별 기능 명세

### 1. `src/app/page.tsx` — 랜딩 페이지 (`/`)

- Hero 섹션 (The Glow 효과, CTA 버튼)
- 주요 기능 피처 카드 (벤토 그리드)
- 요금제 미리보기 (`/pricing` 링크)
- 고객 후기 슬라이더
- FAQ 아코디언
- CTA 배너 + Footer

### 2. `src/app/pricing/page.tsx` — 요금제 (`/pricing`)

- 월간/연간 토글 스위치
- 플랜 비교 카드 (Basic / Pro / Enterprise)
- 각 플랜 별 기능 비교 테이블
- 결제 CTA

### 3. `src/app/activate/page.tsx` — 라이선스 활성화 (`/activate`)

- 시리얼 번호 입력 폼
- 실시간 유효성 검사 (형식: `XXXX-XXXX-XXXX-XXXX`)
- 서버 검증 후 상태 표시 (성공/만료/이미사용)
- **중요**: 활성화 즉시 서버에서 `status: 'Used'` 업데이트 처리

### 4. `src/app/dashboard/page.tsx` — 사용자 대시보드 (`/dashboard`)

- 구독 현황 카드 (플랜명, 만료일, 갱신 버튼)
- 라이선스 목록 테이블 (시리얼, 활성화일, 상태)
- 사용량 통계 차트
- 다운로드 링크 섹션

### 5. `src/app/manuals/page.tsx` — 매뉴얼 포털 (`/manuals`)

- 카테고리별 매뉴얼 카드 그리드 (벤토 그리드)
- 검색 기능 (실시간 필터링)
- 태그/버전 필터

### 6. `src/app/manuals/[slug]/page.tsx` — 매뉴얼 상세 (`/manuals/:slug`)

- 사이드바 목차 (TOC, 스크롤 스파이)
- 마크다운 렌더링
- 코드 블록 하이라이팅
- 이전/다음 문서 네비게이션

---

## 🔐 보안 & 환경 변수

`.env.example` 파일 구조:

```env
# API 설정
API_BASE_URL=https://api.corezent.com/v1
API_TIMEOUT_MS=10000

# 결제 게이트웨이
PAYMENT_IMP_CODE=imp_xxxxxxxx

# 기타
APP_ENV=development
```

**규칙**:
- `.env`는 반드시 `.gitignore`에 포함
- 클라이언트 시크릿은 절대 프론트엔드 JS에 노출 금지
- API 키가 필요한 경우 프록시 서버 경유

---

## ✍️ 코딩 컨벤션

### TypeScript / React

- **컴포넌트**: 파일당 하나의 컴포넌트, 300줄 초과 시 분리
- **Server / Client 구분**: 기본은 Server Component. 상태·이벤트 필요 시 `'use client'` 선언
- **타입**: 모든 props·함수에 타입 명시, `any` 금지
- **비동기**: `async/await` 사용 (`.then()` 지양)
- **에러 핸들링**: try-catch + `error_log.txt` 기록

```typescript
/**
 * @함수명: fetchUserLicenses
 * @설명: 사용자 라이선스 목록을 API에서 가져옵니다.
 * @매개변수: userId - 사용자 고유 ID
 * @반환값: 라이선스 객체 배열
 */
async function fetchUserLicenses(userId: string): Promise<License[]> { ... }
```

### Tailwind CSS

- 색상·간격은 `globals.css`의 `@theme` 변수 사용, 임의 값(`[]`) 최소화
- 반응형은 모바일 퍼스트: `sm:` `md:` `lg:` 순서
- 반복되는 클래스 조합은 `@layer components`에 추출

### SEO (Next.js Metadata API)

- 모든 페이지에 `export const metadata: Metadata` 필수
- OG 이미지, description 반드시 포함

---

## 🚀 개발 워크플로우

### 시작 방법

```bash
npm run dev   # Turbopack 개발 서버 (localhost:3000)
```

### 브라우저 테스트 우선순위

1. Chrome (기준)
2. Edge
3. Firefox
4. Safari (모바일)

### 작업 순서 (권장)

1. `assets/css/variables.css` 디자인 토큰 확정
2. `assets/css/base.css` 리셋 & 레이아웃 기반
3. `assets/css/components.css` 공통 컴포넌트
4. `index.html` 랜딩 페이지
5. 나머지 페이지 순차 개발

---

## 📝 AI 작업 규칙 (Antigravity/Claude 전용)

1. **파일 크기 제한**: JS/CSS 파일은 300줄 이하 유지. 초과 시 반드시 분리
2. **변수 하드코딩 금지**: 색상·사이즈는 모두 CSS 변수 사용
3. **한국어 주석**: 모든 함수·클래스 상단에 한국어 설명 필수
4. **영향 분석 우선**: 기존 파일 수정 시 의존성 파일 목록 먼저 파악
5. **라이선스 보안**: 시리얼 활성화 시 즉시 `Used` 상태로 서버 업데이트
6. **에러 로깅**: 런타임 오류는 `error_log.txt`에 기록 후 다음 작업 진행
7. **버전 고정**: 외부 라이브러리는 명시된 버전만 사용
8. **디자인 퀄리티**: glassmorphism, 그라디언트, 마이크로 애니메이션 적극 활용
9. **SEO 필수**: 페이지 생성 시 title, meta description, h1 구조 반드시 포함
10. **즉시 실행, 질문 금지**: 작업 진행 여부를 묻지 말고 바로 실행한다. 완료 후 작동 확인 결과와 변경 사항만 보고한다. 단, DB 스키마나 핵심 구조 변경 시에만 승인 후 진행
11. **이미지 포맷**: 이미지는 WebP 형식 우선 사용 (로딩 속도 최적화), 고해상도 제공
12. **Footer 고정 요소**: 모든 페이지 Footer에 CoreZent 사업자 정보 및 구독 서비스 링크 반드시 유지
13. **디자인 완료 후 결과 공유**: UI/디자인 작업이 완료되면 반드시 아래 형식으로 결과를 사용자에게 보고한다.
    - 변경된 파일 목록 (링크 포함)
    - 주요 변경 사항 요약 (bullet)
    - 확인 URL: `netstat`으로 실제 리스닝 중인 포트를 확인한 후 정확한 URL을 안내한다 (예: `http://localhost:3000/pricing`)
14. **⚠️ 작업 완료 후 반드시 git push**: 코드 수정 및 커밋이 끝나면 항상 `git push origin main`을 실행해 Vercel 자동 배포를 트리거해야 한다. push 없이 커밋만 하면 배포가 이루어지지 않는다. push까지 완료해야 작업이 끝난 것으로 간주한다.

---

# Lemon Squeezy Integration Guide (Context for Claude Code)

이 문서는 웹 애플리케이션에 Lemon Squeezy 결제 및 구독 시스템을 연동하기 위한 핵심 가이드라인입니다. 코드를 작성할 때 이 문서의 규칙과 패턴을 우선적으로 참고하십시오.

## 1. 기본 API 설정 및 규칙 (API Fundamentals)
- **Base URL:** `https://api.lemonsqueezy.com/v1/` [1]
- **인증 (Authentication):** 모든 API 요청은 `Authorization: Bearer {API_KEY}` 헤더를 포함해야 합니다 [1].
- **콘텐츠 타입 (Headers):** 요청 시 반드시 `Accept: application/vnd.api+json` 및 `Content-Type: application/vnd.api+json` 헤더를 사용해야 합니다 [1].
- **데이터 규격 (JSON:API):** API 응답 및 요청은 JSON:API 스펙을 따릅니다. 데이터는 항상 `data` 객체 안에 `type`, `id`, `attributes`, `relationships` 구조로 감싸져 있으며, 연관 데이터는 `included` 배열에 반환됩니다 [1, 2].

## 2. 프론트엔드 연동: Lemon.js
프론트엔드에서 체크아웃 오버레이와 결제 이벤트를 처리하기 위해 `Lemon.js`를 사용합니다.
- **스크립트 추가:** HTML `<head>` 또는 `<body>` 끝에 `<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>`를 로드합니다 [3, 4].
- **체크아웃 오버레이 열기:**
  - HTML 방식: `<a>` 태그에 `lemonsqueezy-button` 클래스를 추가하여 구현합니다 [3, 4].
  - JS 방식: `LemonSqueezy.Url.Open("CHECKOUT_URL")` 메서드를 호출합니다 [3, 4].
- **이벤트 리스너 설정:** 결제 성공 등의 이벤트를 감지하려면 `LemonSqueezy.Setup()`을 초기화합니다 [3, 4].
  - 주요 이벤트: `Checkout.Success` (결제 완료 시 order 데이터 반환), `PaymentMethodUpdate.Closed` 등 [3, 4].

## 3. 백엔드 핵심 기능 (Backend Operations)
### 3.1 체크아웃 세션 생성
사용자의 이메일, 이름, 세금 식별 번호 등을 미리 채우거나, 웹훅에서 식별할 `custom_data`를 전달하여 API를 통해 동적으로 체크아웃 URL을 생성할 수 있습니다 [5]. 예상 결제 금액(할인, 세금 포함)을 미리 보려면 `preview: true` 파라미터를 사용합니다 [6].

### 3.2 구독 관리 (Subscriptions)
- **구독 정보 갱신:** API를 통해 구독 상태를 취소(cancel), 일시 정지(pause), 재개(unpause)할 수 있습니다 [7].
- **플랜 변경(업그레이드/다운그레이드):** 사용자 구독의 Product/Variant ID를 변경하는 PATCH 요청을 보냅니다. 기본적으로 차액(Proration)이 계산되며, 필요에 따라 즉시 청구 여부를 조절할 수 있습니다 [8].
- **종량제 청구 (Usage-based Billing):** 종량제 플랜의 경우, 앱에서 사용량을 측정한 뒤 `/v1/usage-records` 엔드포인트로 사용량을 보고(action: 'increment' 또는 'set')해야 합니다 [9, 10].

### 3.3 고객 포털 (Customer Portal)
고객이 직접 결제 수단 업데이트, 영수증 다운로드, 플랜 변경 등을 할 수 있는 페이지입니다 [11].
- API를 통해 고유한 **Signed URL**(`customer_portal.update_payment_method` 등)을 생성하여, 고객이 로그인 없이 포털에 안전하게 접근하도록 라우팅해야 합니다 [12].

## 4. 웹훅 처리 (Webhooks & Security)
결제 완료, 구독 갱신 등의 비동기 이벤트 처리를 위해 웹훅 연동이 필수적입니다.
- **서명 검증 (Signature Verification):** 웹훅 엔드포인트는 요청 헤더의 `X-Signature` 값을 검증해야 합니다. 이는 웹훅 페이로드(Raw Body)를 Lemon Squeezy 웹훅 시크릿 키를 이용해 `HMAC SHA256` 방식으로 해싱한 값과 일치해야 합니다 [13, 14].
- **주요 구독 이벤트:** `order_created`, `subscription_created`, `subscription_updated`, `subscription_payment_success`, `subscription_payment_failed` 등의 이벤트를 수신하여 데이터베이스(예: 사용자 권한 상태)를 업데이트해야 합니다 [13, 15].
- **Next.js 구현 참고:** Next.js App Router를 사용하는 경우 `app/api/webhooks/route.ts` 등에서 `crypto` 모듈을 사용하여 서명을 검증하고 데이터를 파싱하도록 구현합니다 [14].

## 5. 부가 기능 (Optional/Advanced Features)
- **소프트웨어 라이선스 발급:** 제품 설정에서 라이선스 키를 활성화하면 결제 시 키가 발급됩니다. 앱 내에서 API(`/v1/licenses/activate`, `validate`, `deactivate`)를 호출하여 키의 유효성과 기기 활성화를 제어합니다 [16].
- **무료 평가판 (Free Trials):** 결제 정보 입력 유무에 따라 평가판을 구성할 수 있으며, 결제 정보를 요구하는 경우 Lemon Squeezy 대시보드 내 제품 설정에서 "Trial period"를 설정하면 웹훅(status: `on_trial`)을 통해 제어할 수 있습니다 [15].
- **할인 쿠폰 제어:** 특정 개월 수만 적용되고 원래 가격으로 돌아가는 "Expiring Subscription Discounts

---

*최초 작성: 2026-04-04 | 프로젝트: CoreZent SaaS*
