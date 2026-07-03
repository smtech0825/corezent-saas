/**
 * @파일: app/buy/[slug]/page.tsx
 * @설명: 레거시 옵션 선택·구매 페이지 — 이제 상세 페이지(/product/[slug]) 하단 구매 바로 통합되었다.
 *        존재하는 slug는 /product/[slug]로 영구(308) 리다이렉트하고, 없는 slug는 기존처럼 404 처리한다.
 *        (구 /buy 링크·북마크의 하위 호환을 위해 라우트만 남겨 리다이렉트한다.)
 */

import { notFound, permanentRedirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * @함수명: BuyRedirectPage
 * @설명: slug 상품이 존재하면 상세 페이지로 영구 리다이렉트, 없으면 notFound.
 * @매개변수: params - { slug } (Promise)
 */
export default async function BuyRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const client = createAdminClient()
  const { data } = await client.from('products').select('id').eq('slug', slug).maybeSingle()
  if (!data) notFound()
  permanentRedirect(`/product/${slug}`)
}
