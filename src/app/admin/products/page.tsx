/**
 * @파일: admin/products/page.tsx
 * @설명: 관리자 제품 관리 — 제품 목록 + 순서 변경(위/아래 화살표) + 추가/수정/삭제
 */

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import { revalidatePath } from 'next/cache'
import { Plus } from 'lucide-react'
import ProductList, { type ProductRow } from './ProductList'
import { formatPrice } from '@/lib/price'
import { logAdminActivity } from '@/lib/adminActivityLog'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'

export const dynamic = 'force-dynamic'

type DeleteResult =
  | { ok: true; mode: 'deleted' | 'deactivated' }
  | { ok: false; message: string }

/**
 * @함수명: deleteProduct
 * @설명: 제품 삭제. 주문·구독·라이선스 이력이 있어 FK 제약(23503)으로 완전 삭제가 불가하면,
 *        데이터 무결성 보존을 위해 완전 삭제 대신 비활성화(is_active=false)로 대체한다.
 *        실패를 예외로 던지지 않고 결과값으로 돌려준다 — 예외로 던지면 화면이 그것을 받지 못해
 *        아무 안내 없이 삭제 버튼만 비활성으로 굳는다.
 * @매개변수: id - 제품 ID
 * @반환값: 처리 결과 — deleted(완전삭제) / deactivated(비활성화) / 실패 사유(한국어)
 */
async function deleteProduct(id: string): Promise<DeleteResult> {
  'use server'
  // 권한 확인도 결과값으로 받는다(활동 기록에 관리자 id가 필요해 requireAdminOrThrow를 그대로 쓰되
  // 예외만 결과값으로 바꾼다). 사유 문구는 다른 관리자 화면(guardAdmin)과 같은 문장으로 맞춘다.
  let actorId: string
  try {
    actorId = await requireAdminOrThrow()
  } catch (err) {
    console.error('[products] 권한 확인에 걸림:', err instanceof Error ? err.message : String(err))
    return { ok: false, message: '관리자 권한이 확인되지 않았습니다. 로그인이 풀렸을 수 있으니 다시 로그인한 뒤 시도해 주세요.' }
  }
  const client = createAdminClient()

  // 1) 완전 삭제 시도 — product_prices·changelogs 등은 ON DELETE CASCADE로 함께 삭제됨
  const { error } = await client.from('products').delete().eq('id', id)

  if (!error) {
    await logAdminActivity({
      adminUserId: actorId,
      action: 'product.delete',
      targetType: 'product',
      targetId: id,
    })
    revalidatePath('/admin/products')
    revalidatePath('/')
    revalidatePath('/pricing')
    revalidatePath('/product')
    return { ok: true, mode: 'deleted' }
  }

  // 2) FK 제약(주문·구독·라이선스가 참조) → 완전 삭제 불가 → 비활성화로 대체
  if (error.code === '23503' || /foreign key/i.test(error.message)) {
    const { error: deactErr } = await client
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
    if (deactErr) {
      console.error('[products] 비활성화 실패:', deactErr.message)
      return { ok: false, message: '제품을 비활성화하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
    }
    await logAdminActivity({
      adminUserId: actorId,
      action: 'product.deactivate',
      targetType: 'product',
      targetId: id,
      detail: { reason: 'delete_blocked_by_fk' },
    })
    revalidatePath('/admin/products')
    revalidatePath('/')
    revalidatePath('/pricing')
    revalidatePath('/product')
    return { ok: true, mode: 'deactivated' }
  }

  // 3) 그 외 오류 — 원문은 영문이라 화면에 내보내지 않고 서버 기록에만 남긴다.
  console.error('[products] 삭제 실패:', error.message)
  return { ok: false, message: '제품을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
}

export default async function ProductsPage() {
  const adminClient = createAdminClient()

  const { data: products } = await adminClient
    .from('products')
    .select('id, name, slug, category, tagline, is_active, order_index, product_prices(type, interval, price, is_active)')
    .order('order_index', { ascending: true })

  const list: ProductRow[] = (products ?? []).map((p) => {
    // 활성 가격만 사용 — 비활성(과거) 행을 집어 옛 가격이 표시되는 문제 방지
    // (공개 페이지·편집 페이지와 동일하게 is_active 필터)
    const prices = ((p.product_prices ?? []) as { type: string; interval: string; price: number; is_active: boolean }[])
      .filter((pr) => pr.is_active)
    const monthly = prices.find((pr) => pr.interval === 'monthly')
    const annual = prices.find((pr) => pr.interval === 'annual')
    const oneTime = prices.find((pr) => pr.type === 'one_time')
    return {
      id:            p.id,
      name:          p.name,
      slug:          p.slug,
      category:      p.category,
      tagline:       p.tagline ?? '',
      is_active:     p.is_active !== false,
      monthlyLabel:  monthly ? formatPrice(monthly.price) + '/mo' : oneTime ? formatPrice(oneTime.price) + ' once' : '—',
      annualLabel:   annual ? formatPrice(annual.price) + '/yr' : '—',
    }
  })

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-ink">제품</h1>
          <p className="text-sm text-ink-soft mt-1">{list.length}개 제품 · 화살표로 순서 변경</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-mark hover:brightness-95 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> 제품 추가
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          boxed
          message="아직 제품이 없습니다."
          cta={{ label: '첫 제품 추가하기', href: '/admin/products/new' }}
        />
      ) : (
        <ProductList products={list} onDelete={deleteProduct} />
      )}
    </PageContainer>
  )
}
