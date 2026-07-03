# CoreZent 디자인·UI·레이아웃 종합 점검 보고서

> 작성일: 2026-07-02
> 범위: 퍼블릭 전 페이지 · /dashboard · /admin (코드 전수 점검 + www.corezent.com 라이브 화면 확인)
> 결론 요약: **문제는 "다크 테마가 못생겨서"가 아니라, ① 디자인 시스템이 정의만 되고 사용되지 않으며 ② 공통 컴포넌트가 없어 모든 화면이 복붙으로 표류하고 ③ 사이트에 "이 브랜드만의 것"이 하나도 없다는 것.** 페이지를 하나씩 고치면 안 되고, 프리미티브(공통 부품)를 먼저 세운 뒤 페이지를 그 위에 다시 얹어야 한다.

---

## 1. 총평 — 왜 "별로"라고 느껴지는가

라이브 사이트와 코드를 함께 보면 원인은 4가지로 수렴한다.

1. **죽은 디자인 토큰**: `globals.css @theme`에 색·폰트 토큰이 완비돼 있지만 실제 사용률이 사실상 0%다. 전 코드가 `bg-[#111A2E]` 같은 리터럴 hex(퍼블릭 1,179회/103파일, admin 617회/49파일)로 작성돼, 토큰을 바꿔도 화면이 안 바뀐다. 게다가 토큰에 **존재하지 않는 유령 색**이 사실상 표준처럼 쓰인다(`#E2E8F0` 140회, `#475569` 수십 회, `#0F1929`, `#0E1525`).
2. **공통 프리미티브 부재**: Button·Input·Card·Badge·Container가 없어 같은 역할의 UI가 파일마다 다르게 재구현됐다. 주 버튼 radius가 `rounded-lg`↔`rounded-xl`로 갈리고, 상태 뱃지는 최소 12곳에서 독립 구현됐으며(동일 상태 `refunded`가 개요=회색, 결제=amber로 **다른 색**), 페이지네이션은 4가지 구현이 공존한다.
3. **레이아웃 그리드 부재**: 컨테이너 max-width가 7종(sm~7xl), 고정 네비 오프셋이 pt-20~pt-36으로 페이지마다 다르다. 시각적 "리듬"이 없어서 페이지를 오갈 때마다 다른 사이트처럼 느껴진다.
4. **아이덴티티 부재 (가장 근본적)**: 현재 디자인은 "다크 네이비 + 하늘색 액센트 + 중앙 정렬 히어로 + 3열 카드"라는, AI가 만든 SaaS 템플릿의 전형 그 자체다. 모션도 없고(`@keyframes` 0건, 진입 애니메이션 0건), 기억에 남는 요소가 하나도 없다. 여기에 콘텐츠 문제(주력 GenieWork 카드만 설명이 비고, 가짜 외국인 후기, 빈 푸터 컬럼)가 겹쳐 "미완성 템플릿" 인상을 만든다.

---

## 2. 라이브 화면에서 확인된 문제 (www.corezent.com, 1440px)

| # | 위치 | 관찰 내용 |
|---|------|-----------|
| L1 | 홈 히어로 | 구성 자체는 깔끔하나 완전한 템플릿 문법(배지 pill → 그라디언트 H1 → 부제 → CTA 2개 → 체크 pill 4개). 부제 카피가 제품과 무관하게 범용적 |
| L2 | 홈 가격 카드 | **주력 "지니워크 1PC용" 카드만 기능 설명이 완전히 비어** 카드 절반이 공백. 옆의 GenieStock/GeniePost Max는 불릿 하나가 4~5줄 문단이라 극단적 밀도 대비 발생 |
| L3 | 홈 가격 정합성 | 상단 배너 "월 6,900원부터" vs 지니워크 카드 "₩9,900/월" — 같은 화면에서 최저가 표기가 어긋남(확인 필요) |
| L4 | 고객 후기 | Sarah Jenkins·Marcus Thorne 등 외국인 스톡 인물 + GeniePost 시절 문맥. 공공기관 타깃 신뢰도에 역효과 |
| L5 | 세로 공백 | 스크롤 중 뷰포트 전체가 빈 화면인 구간이 홈·요금제 모두 존재(py-32 누적 + 콘텐츠 공백). 일부 카드가 내용 없이 빈 박스로 노출 |
| L6 | 푸터 | 5컬럼 구조에 링크가 1~3개씩만 있어 앙상함. 소개문은 여전히 옛 문맥("디지털 워크플로우…") |

*(dashboard/admin은 로그인 영역이라 라이브 확인 대신 코드 전수 점검으로 대체)*

---

## 3. 코드 점검 상세

### 3-A. 퍼블릭 페이지 (src/app/*, src/components/*)

**색상**
- arbitrary hex 1,179회/103파일, Tailwind 기본 팔레트 336회/65파일, 시맨틱 토큰 클래스 29회/2파일(그마저 dashboard/affiliate).
- 상태 토큰(`--color-success/warning/error`)은 정의만 있고, 실제로는 emerald/amber/red Tailwind가 쓰여 **값 자체가 서로 다름**.
- `activate` 페이지만 주 액션이 amber-500 (`ActivateClient.tsx:103,132`) — 액센트 이탈.

**레이아웃**
- 컨테이너 max-width 7종 혼재: 7xl(홈 섹션)·6xl(changelog)·5xl(pricing)·4xl(CTA/legal)·3xl(FAQ)·xl(contact)·sm(auth).
- 고정 Navbar 오프셋 불일치: pt-36(홈/product) · pt-32(pricing/[slug]) · pt-28(about/contact/changelog) · **pt-20(faq — 배너+네비 높이보다 작아 가림 위험)**.
- 좌우 패딩도 `px-6` 고정 vs `px-4 sm:px-6` 혼재.

**컴포넌트 표류**
- 주 버튼: 위치별로 radius(lg/xl)·padding(py-2~4)·hover 리프트 유/무·색(accent/amber)이 전부 다름 — 11곳 비교표 확보.
- 입력 필드 3종: 로그인(`bg-[#111A2E] rounded-lg`, 링 없음) / 문의(`bg-[#0B1120] rounded-xl` + ring) / activate(amber focus).
- 월간/연간 토글이 2가지 다른 UI로 중복 구현(PricingSection 스위치 vs PricingClient 세그먼트).
- 로고 마크가 4곳+ 복붙. eyebrow 헤더 스타일도 매번 인라인 복붙.

**모션·접근성**
- 커스텀 애니메이션 0건(`@keyframes` 없음), 진입/스크롤 리빌 없음 — CLAUDE.md의 "마이크로 애니메이션 적극 활용" 방침과 정면 배치.
- **`focus-visible` 0건, `focus:outline-none` 54회/32파일** — 키보드 포커스가 사실상 제거된 상태(접근성 결함).

**대형 파일(300줄 규칙 위반)**: PricingClient 365 · Navbar 351 · product/[slug] 307. `MetricsSection.tsx`는 `return null`인 죽은 파일.

### 3-B. 사용자 대시보드 (/dashboard)

- 뼈대(사이드바+헤더)는 견고하나 **데스크톱 헤더가 빈 껍데기**(제목 없이 64px 소비, `DashboardShell.tsx:54-71`), 모바일 헤더는 어느 페이지든 "대시보드" 고정.
- 콘텐츠 폭: 5xl(개요·라이선스·결제·제휴) vs 2xl(설정) vs **3xl+정렬 없음(지원 — 혼자 좌측으로 튐)**.
- **상태 뱃지 6곳 독립 구현** + `refunded` 색 충돌(개요 회색 vs 결제 amber) + 지원만 border 없는 뱃지.
- 토큰 사용 파일은 affiliate 단 1페이지 — 같은 대시보드 안에서 표기법 이원화.
- 섹션 헤딩(h2) 4가지 스타일 혼재(대문자 eyebrow형 vs 일반 흰색, sm vs base).
- Empty state 3가지 품질 편차(라이선스 페이지 버전이 기준 삼을 만함). **`loading.tsx` 전무**.
- `error.tsx`가 원본 에러 메시지·digest를 사용자에게 노출(`error.tsx:32-35`) — 정보 유출성 결함.
- 결제 구독 카드의 액션 4개+뱃지가 모바일에서 5줄 줄바꿈.

### 3-C. 관리자 콘솔 (/admin)

- **테이블 셸이 공통 컴포넌트 없이 5곳 복붙**(Users/Orders/Licenses/Products/대시보드).
- **페이지네이션 4가지 구현** 공존: 공용 Pagination(→support만 사용) / UserTable w-9 / OrderTable w-7 / LicenseTable 화살표만.
- **액센트 이원화**: 사이드바·주요 버튼·폼 포커스는 amber, 링크·검색 포커스·차트는 sky(#38BDF8) — 규칙 없음.
- 폼: `Field` 래퍼가 파일마다 재정의(대문자 라벨 vs 일반), 입력 클래스 상수도 파일별(`rounded-lg` vs `rounded-xl`), 에러 표시 4방식(하단 박스/버튼 disable/브라우저 confirm/모달 내부).
- 상태 뱃지 매핑 6+곳 중복, **Support만 상태·우선순위가 영어 라벨**(open/closed), monthly 뱃지색 cyan vs sky 불일치, **제휴 관리만 통화가 $**(나머지 ₩).
- `ProductForm.tsx` **968줄**(단일 폼에 8개 섹션+업로더 내장), 300줄 초과 총 8파일.
- LicenseTable `min-w-[800px]` 강제 — 좁은 화면은 무조건 가로 스크롤.
- 이미지 업로드 컴포넌트 2중 구현(FeatureImageUpload ≒ AvatarUpload).

---

## 4. 개선 로드맵 (권장 순서)

> 원칙: **페이지를 고치기 전에 부품을 만든다.** 부품 없이 페이지만 다듬으면 3개월 뒤 같은 상태로 돌아온다.

### Wave 0 — 디자인 방향 결정 (코드 작업 전, 결정 1개)

현 다크 템플릿을 "정비"할지, GenieWork(공무원 타깃) 중심으로 "재브랜딩"할지 먼저 결정해야 한다.

- **A안 — 다크 유지 + 시그니처 부여**: 현 팔레트를 유지하되 ① 히어로를 제품 실화면/실데모로 교체 ② 서체 위계에 개성 부여(예: 헤드라인 전용 웨이트·자간 규칙, 숫자·키·버전은 JetBrains Mono 일관) ③ 페이지 로드 1회의 오케스트레이션 모션(스태거 리빌) ④ 벤토 그리드를 Features 외 전 섹션 문법으로 확장. 공수 적고 리스크 낮음.
- **B안 — GenieWork 정체성으로 재브랜딩**: 타깃(공무원·공공기관)에 맞춰 라이트 "문서" 아이덴티티로 전환. 이미 시안 있음: `design-concepts/geniework-landing.html`(종이/먹/인주빨강/볼펜파랑, 기안문 문법). 퍼블릭만 라이트로 가고 dashboard/admin은 다크 유지하는 하이브리드도 가능. 차별성 최대, 공수 큼.
- 권장: **퍼블릭은 B안 방향 검토, dashboard/admin은 A안 정비** (관리 화면은 재브랜딩 효과가 작고 정비 효과가 큼).

### Wave 1 — 토큰 활성화 + 프리미티브 8종 (모든 후속 작업의 토대)

1. `@theme` 토큰 보강: 실사용 색 편입(`#E2E8F0`→`--color-text-strong` 또는 text로 통일 결정, `#475569`→`--color-text-faint`, hover surface `#0F1929`), 상태 색을 emerald/amber/red 실사용 값으로 갱신, admin 전용 `--color-admin-accent`(amber) 공식화.
2. `src/components/ui/` 신설 — **Button**(variant: primary/ghost/danger, radius·hover 단일화) · **Input/Textarea/Select**(focus ring 표준) · **Card** · **StatusBadge**(상태→색 매핑 단일 소스, 12곳 치환) · **Container/Section**(max-width 2단계: 콘텐츠 5xl/와이드 7xl, 네비 오프셋 상수) · **SectionHeader**(eyebrow+h2) · **EmptyState**(라이선스 버전 기준) · **Pagination**(기존 공용 것으로 4구현 통합).
3. 전역 `focus-visible:ring` 도입, `focus:outline-none` 54곳 정리.

### Wave 2 — 퍼블릭 적용

- 전 페이지를 Container/Section으로 재조립(pt-20~36 → 표준 오프셋), 버튼·입력·카드 치환.
- 홈 재구성: GenieWork 중심 히어로(실화면/데모), 가격 카드 불릿을 "한 줄 요약형"으로(문단 금지), 후기를 실사용자·한국어로 교체(없으면 섹션 숨김), 푸터 컬럼 정리.
- 로드 모션 1회(스태거) + prefers-reduced-motion 대응. activate amber → accent 통일. MetricsSection 삭제.

### Wave 3 — dashboard 정비

- StatusBadge 치환(refunded 충돌 해소), 섹션 헤딩 1규격, support 페이지 폭·정렬 표준화, 헤더에 현재 페이지 타이틀 표시, `loading.tsx` 추가, error.tsx 원문 노출 제거, 구독 카드 모바일 스택.

### Wave 4 — admin 정비

- AdminTable 셸 + 공용 Pagination + FilterBar로 5개 목록 통합, Field/inputCls 단일화, 에러 표시 1방식, Support 한글 라벨, 통화 ₩ 통일, ProductForm 968줄 섹션 분리, 좁은 화면 컬럼 우선순위 숨김(hidden md:table-cell) 확대.

### 퀵윈 (Wave와 무관하게 반나절 내 가능한 것)

1. faq `pt-20` → 표준 오프셋 (콘텐츠 가림 해소)
2. dashboard `error.tsx` 에러 원문 노출 제거
3. `refunded` 뱃지 색 통일 (사용자 오해 소지)
4. admin Support 영어 라벨 한글화
5. 홈 배너 최저가(6,900원) vs 카드(9,900원) 표기 정합 확인
6. GenieWork 카드 설명 채우기 (admin/products에서 입력만 하면 됨)
7. MetricsSection.tsx 삭제

---

## 5. 참고

- 콘텐츠·제품 정합성 관점의 선행 점검은 `corezent_점검보고서.md`, `corezent_대시보드_관리자_점검보고서.md` 참조 (본 보고서는 디자인·UI·레이아웃 관점).
- GenieWork 랜딩 재브랜딩 시안: `design-concepts/geniework-landing.html`.
