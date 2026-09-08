/**
 * @파일: lib/jsonld.tsx
 * @설명: 검색엔진용 구조화 데이터(JSON-LD) 단일 출처.
 *        화면에는 아무것도 그리지 않고 <script type="application/ld+json"> 한 줄만 심는다.
 *        "무엇을 넣을지(콘텐츠)"는 각 페이지가 전달하고, "어떤 형식으로 조립할지(로직)"만 여기 둔다.
 *        ⚠️ 값이 비면 키 자체를 넣지 않는다 — 빈 문자열/null이 들어간 스키마는 검색엔진이 오류로 본다.
 */

import { SITE_URL } from '@/lib/site'

/** JSON-LD 한 덩어리의 타입 — 스키마마다 키가 달라 느슨하게 둔다 */
type Schema = Record<string, unknown>

/**
 * @함수명: JsonLd
 * @설명: 구조화 데이터 객체를 <script type="application/ld+json">으로 렌더합니다.
 *        '<'를 유니코드로 이스케이프해 본문에 </script>가 섞여도 태그가 끊기지 않게 합니다(XSS 차단).
 * @매개변수: data - 스키마 객체 하나 또는 여러 개(배열)
 * @반환값: script 엘리먼트 (화면 출력 없음)
 */
export function JsonLd({ data }: { data: Schema | Schema[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

/**
 * @함수명: compact
 * @설명: 값이 비어 있는(undefined·null·빈 문자열·빈 배열) 키를 제거합니다.
 * @매개변수: obj - 정리할 객체
 * @반환값: 빈 값이 제거된 새 객체
 */
function compact(obj: Schema): Schema {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v == null) return false
      if (typeof v === 'string') return v.trim() !== ''
      if (Array.isArray(v)) return v.length > 0
      return true
    }),
  )
}

/**
 * @함수명: absoluteUrl
 * @설명: 사이트 루트 기준 경로나 상대 이미지 주소를 절대 URL로 바꿉니다(이미 절대면 그대로).
 * @매개변수: path - '/product/geniework' 또는 'https://...' 형태
 * @반환값: 절대 URL 문자열 (입력이 비면 undefined)
 */
export function absoluteUrl(path: string | null | undefined): string | undefined {
  const p = (path ?? '').trim()
  if (!p) return undefined
  if (/^https?:\/\//i.test(p)) return p
  return `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`
}

/** 사이트 전체가 공유하는 발행자(조직) 참조 — 개별 스키마에서 중복 기술하지 않기 위한 짧은 형태 */
const PUBLISHER_REF = { '@type': 'Organization', name: 'CoreZent', url: SITE_URL }

interface OrganizationInput {
  /** 상호(관리자 설정 site_name 또는 company_name). 비면 'CoreZent' */
  name?: string | null
  logo?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

/**
 * @함수명: organizationJsonLd
 * @설명: 사이트 운영 주체(Organization) 스키마를 만듭니다. 홈에서 한 번만 사용합니다.
 * @매개변수: input - 관리자 설정(front_settings)에서 읽은 상호·연락처 정보
 * @반환값: Organization 스키마 객체
 */
export function organizationJsonLd(input: OrganizationInput): Schema {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: (input.name ?? '').trim() || 'CoreZent',
    url: SITE_URL,
    logo: absoluteUrl(input.logo),
    email: input.email?.trim(),
    telephone: input.phone?.trim(),
    address: input.address?.trim()
      ? { '@type': 'PostalAddress', streetAddress: input.address.trim(), addressCountry: 'KR' }
      : undefined,
  })
}

/**
 * @함수명: websiteJsonLd
 * @설명: 사이트(WebSite) 스키마를 만듭니다. 검색 결과의 사이트명 표기에 쓰입니다.
 *        ⚠️ 사이트 내 검색 결과 페이지가 없으므로 SearchAction은 넣지 않습니다(없는 기능 광고 금지).
 * @매개변수: name - 사이트 이름
 * @반환값: WebSite 스키마 객체
 */
export function websiteJsonLd(name?: string | null): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    name: (name ?? '').trim() || 'CoreZent',
    url: SITE_URL,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${SITE_URL}#organization` },
  }
}

interface ProductJsonLdInput {
  name: string
  /** 평문 설명(HTML 태그가 제거된 상태로 전달할 것) */
  description?: string | null
  image?: string | null
  /** 사이트 루트 기준 경로 (예: '/product/geniework') */
  path: string
  /** 판매 중인 가격 목록(원화 정수). 비면 offers를 생략한다 */
  prices?: number[]
  /** 구매 가능 여부 — 비활성 상품이면 false */
  available?: boolean
  /** 시스템 요구사항 평문 — SoftwareApplication.operatingSystem 힌트 */
  operatingSystem?: string | null
}

/**
 * @함수명: productJsonLd
 * @설명: 상품 상세용 스키마(Product + SoftwareApplication)를 만듭니다.
 *        가격이 1개면 Offer, 2개 이상이면 최저~최고 범위를 담은 AggregateOffer로 조립합니다.
 *        ⚠️ 가격은 KRW 정수(VAT 포함가)이며 별도 환산을 하지 않습니다(lib/price와 같은 규칙).
 * @매개변수: input - 상품 이름·설명·이미지·경로·가격 목록
 * @반환값: Product 스키마 객체
 */
export function productJsonLd(input: ProductJsonLdInput): Schema {
  const url = `${SITE_URL}${input.path}`
  const availability = `https://schema.org/${input.available === false ? 'OutOfStock' : 'InStock'}`
  const prices = (input.prices ?? []).filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b)

  let offers: Schema | undefined
  if (prices.length === 1) {
    offers = { '@type': 'Offer', price: prices[0], priceCurrency: 'KRW', availability, url }
  } else if (prices.length > 1) {
    offers = {
      '@type': 'AggregateOffer',
      lowPrice: prices[0],
      highPrice: prices[prices.length - 1],
      offerCount: prices.length,
      priceCurrency: 'KRW',
      availability,
      url,
    }
  }

  return compact({
    '@context': 'https://schema.org',
    '@type': ['Product', 'SoftwareApplication'],
    name: input.name,
    description: input.description?.trim().slice(0, 500),
    image: absoluteUrl(input.image),
    url,
    brand: PUBLISHER_REF,
    applicationCategory: 'BusinessApplication',
    operatingSystem: input.operatingSystem?.trim().slice(0, 100),
    offers,
  })
}

/**
 * @함수명: faqJsonLd
 * @설명: 질문·답변 목록을 FAQPage 스키마로 만듭니다. 답변은 평문으로 넣습니다.
 * @매개변수: items - { question, answer(평문) } 배열. 빈 항목은 자동 제외
 * @반환값: FAQPage 스키마 객체 (유효 항목이 없으면 null)
 */
export function faqJsonLd(items: { question: string; answer: string }[]): Schema | null {
  const entities = items
    .filter((it) => it.question?.trim() && it.answer?.trim())
    .map((it) => ({
      '@type': 'Question',
      name: it.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: it.answer.trim() },
    }))

  if (entities.length === 0) return null
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities }
}

/**
 * @함수명: breadcrumbJsonLd
 * @설명: 검색 결과에 표시되는 경로(빵부스러기)를 만듭니다.
 * @매개변수: items - { name, path } 배열. 앞에서부터 상위 → 현재 페이지 순서
 * @반환값: BreadcrumbList 스키마 객체
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  }
}

interface ArticleJsonLdInput {
  title: string
  description?: string | null
  /** 'YYYY-MM-DD' 형식 발행일 */
  date?: string | null
  path: string
}

/**
 * @함수명: articleJsonLd
 * @설명: 블로그 글용 BlogPosting 스키마를 만듭니다.
 * @매개변수: input - 제목·설명·발행일·경로
 * @반환값: BlogPosting 스키마 객체
 */
export function articleJsonLd(input: ArticleJsonLdInput): Schema {
  const url = `${SITE_URL}${input.path}`
  return compact({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title.slice(0, 110),
    description: input.description?.trim(),
    datePublished: input.date?.trim(),
    mainEntityOfPage: url,
    url,
    inLanguage: 'ko-KR',
    author: PUBLISHER_REF,
    publisher: PUBLISHER_REF,
  })
}
