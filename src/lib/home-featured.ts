import type { SupabaseClient } from '@supabase/supabase-js'
import { HOME_FEATURED_PRODUCT_DEFAULT } from '@/lib/front-defaults'

/**
 * @파일: lib/home-featured.ts
 * @설명: 홈 대표 제품(관리자 설정) 공용 헬퍼 — 홈의 요금 섹션·제품 소개 섹션이 함께 쓴다.
 *        ⚠️ 이 설정은 "홈에만" 영향을 준다 — /pricing·/product·/public-sector·sitemap은
 *        이 모듈을 import하지 않는다(2026-08-15 대표님 지시).
 *        폴백 규칙: 설정이 비면 기본 slug(geniework)를 쓰고, 그 slug의 활성 상품이
 *        없으면(오타·판매 중지) 거르지 않고 전체를 보여준다 — 홈이 통째로 비는 것 방지.
 */

/** front_settings 키 — 관리자 설정 화면(일반 설정)에서 편집한다 */
export const HOME_FEATURED_PRODUCT_KEY = 'home_featured_product'

/**
 * @함수명: fetchHomeFeaturedSlug
 * @설명: 관리자 설정에서 홈 대표 제품 slug를 읽습니다. 행이 없거나 값이 비면 기본값,
 *        조회가 실패해도 기본값 — 설정 조회 실패가 홈 렌더를 막으면 안 됩니다.
 * @매개변수: client - 서버용 Supabase 클라이언트(호출처가 이미 만든 것을 재사용)
 * @반환값: 홈 대표 제품 slug (앞뒤 공백 제거, 항상 비어 있지 않음)
 */
export async function fetchHomeFeaturedSlug(client: SupabaseClient): Promise<string> {
  try {
    const { data } = await client
      .from('front_settings')
      .select('value')
      .eq('key', HOME_FEATURED_PRODUCT_KEY)
      .maybeSingle()
    return (data?.value ?? '').trim() || HOME_FEATURED_PRODUCT_DEFAULT
  } catch {
    return HOME_FEATURED_PRODUCT_DEFAULT
  }
}

/**
 * @함수명: filterHomeFeatured
 * @설명: 상품 목록에서 대표 제품만 남깁니다. slug가 일치하는 행이 하나도 없으면
 *        거르지 않고 전체를 그대로 돌려줍니다(폴백 — 홈 섹션이 비지 않게).
 * @매개변수: rows - 활성 상품 목록(slug 필드 필요) / slug - 대표 제품 slug
 * @반환값: rows - 거른(또는 폴백된) 목록 / matched - 대표 제품으로 걸러졌는지 여부
 */
export function filterHomeFeatured<T extends { slug?: string | null }>(
  rows: T[],
  slug: string,
): { rows: T[]; matched: boolean } {
  const matched = rows.filter((r) => (r.slug ?? '') === slug)
  return matched.length > 0 ? { rows: matched, matched: true } : { rows, matched: false }
}
