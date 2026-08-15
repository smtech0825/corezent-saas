/**
 * @파일: lib/front-defaults.ts
 * @설명: 공개 화면 문구(front_content)의 한국어 예비값 — 단일 출처.
 *        DB에 값이 없을 때 공개 화면(HeroSection·CTASection·Navbar 배너)이 대신 보여주는
 *        문구이며, 관리자 편집기(admin/content/{hero,cta,announcement})의 초기값도 반드시
 *        이 객체를 그대로 쓴다. 두 곳이 달라지면 "DB 키 삭제 → 편집기에 다른 문구 표시 →
 *        저장 한 번에 그 문구가 DB에 기록돼 랜딩을 덮는" 사고가 나기 때문이다.
 *        ⚠️ 실제 노출 문구는 대표님이 관리자(DB)에서 직접 관리한다 — 여기는 예비값만.
 *        ⚠️ 이 모듈은 클라이언트('use client' Navbar·편집기)에서도 import된다 —
 *        비밀값·process.env·서버 전용 import를 절대 추가하지 말 것.
 */

/** 히어로 섹션 예비값 (HeroSection + admin/content/hero 공용) */
export const HERO_DEFAULTS = {
  badge: '공무원·공공기관 실무자를 위한 업무 자동화',
  headline1: '보고서, 이제',
  headline2: '저절로 써집니다',
  subtext:
    '계획서·보고서·공문 초안 작성과 자료 검색까지 — 반복되는 문서 업무를 AI로 줄이는 설치형 프로그램, 지니워크(GenieWork)입니다.',
  cta1_text: '제품 둘러보기',
  cta1_href: '#product',
  cta2_text: '무료 계정 만들기',
  cta2_href: '/auth/register',
}

/** 하단 CTA 섹션 예비값 (CTASection + admin/content/cta 공용) */
export const CTA_DEFAULTS = {
  eyebrow: '지금 도입하세요',
  headline: '문서 업무의 시간을 되돌려 드립니다',
  subtext:
    '지니워크를 내려받아 담당자 PC에 설치하고, 라이선스를 인증하면 바로 사용할 수 있습니다.',
  btn1_text: '제품 둘러보기',
  btn1_href: '#product',
  btn2_text: '무료 계정 만들기',
  btn2_href: '/auth/register',
  footnote: '신용카드 불필요 · 즉시 활성화',
}

/** 상단 공지 배너 예비값 (Navbar 배너 + admin/content/announcement 공용) */
export const BANNER_DEFAULTS = {
  text: 'GenieWork 출시 — 공무원 공문 작성 데스크톱 앱, 지금 만나보세요.',
  text_mobile: 'GenieWork 출시 — 공무원 공문 작성 데스크톱 앱',
  link_text: '자세히 보기 →',
  link_url: '#product',
  visible: 'true',
}

/** 홈 대표 제품 기본 slug (lib/home-featured + admin/settings placeholder 공용) —
 *  설정(front_settings.home_featured_product)이 비었을 때 홈이 이 제품만 보여준다 */
export const HOME_FEATURED_PRODUCT_DEFAULT = 'geniework'
