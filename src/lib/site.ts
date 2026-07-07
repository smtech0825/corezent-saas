/**
 * @파일: lib/site.ts
 * @설명: 사이트 표준(canonical) URL 단일 출처.
 *        robots.txt·sitemap.xml·색인 제출(IndexNow·Google Indexing) 등에서 공통으로 사용한다.
 *        운영 도메인은 www 서브도메인을 정식(canonical)으로 사용하므로, 배포 env가 apex
 *        (corezent.com)로 설정돼 있어도 www.corezent.com으로 정규화해 Host/URL 표기를 통일한다.
 */

/**
 * @함수명: getSiteUrl
 * @설명: 배포 환경 변수에서 사이트 기본 URL을 읽어 표준화(끝 슬래시 제거 + apex→www)해 반환한다.
 * @반환값: 표준 사이트 URL 문자열 (예: https://www.corezent.com)
 */
export function getSiteUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://www.corezent.com'
  ).replace(/\/+$/, '')

  // corezent.com apex 도메인은 www를 정식으로 사용 → 정규화(Host 표기 통일)
  return raw.replace(/^(https?:\/\/)corezent\.com(?=\/|$)/i, '$1www.corezent.com')
}

/** 표준 사이트 URL 상수 (모듈 로드 시 1회 계산) */
export const SITE_URL = getSiteUrl()
