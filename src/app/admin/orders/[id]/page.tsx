/**
 * @파일: admin/orders/[id]/page.tsx
 * @설명: 관리자 주문 상세 — 주문↔사용자↔상품↔라이선스↔구독을 한 화면에 조인해 표시.
 *        금액은 lib/money.formatKRW(cents ÷100 + ₩), 라이선스 키는 마스킹, 없는 필드는 "—".
 *        스키마에 없는 항목(수량·결제수단)은 "—"로 둔다.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKRW } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = { title: '주문 상세' }

/** 날짜+시각 표기 (없으면 "—") */
function fmtDateTime(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** 라이선스 키 마스킹 — 앞 8자만 노출 (기존 마스킹 관습과 동일) */
function maskKey(key: string | null): string {
  if (!key) return '—'
  return key.length > 8 ? `${key.slice(0, 8)}…` : key
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  paid:      { label: '결제됨',   cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  pending:   { label: '대기 중',  cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  refunded:  { label: '환불됨',   cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  cancelled: { label: '취소됨',   cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

const SUB_STATUS: Record<string, string> = {
  active: '활성', paused: '일시정지', cancelled: '취소됨', expired: '만료됨',
}

const LICENSE_STATUS: Record<string, string> = {
  active: '활성', expired: '만료', revoked: '해지',
}

/** 라벨:값 한 줄 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2.5 border-b border-[#1E293B]/60 last:border-0">
      <span className="text-xs text-[#475569] pt-0.5">{label}</span>
      <span className="text-sm text-white break-all">{children}</span>
    </div>
  )
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, product_price_id, bundle_id, lemon_squeezy_order_id, status, amount, currency, created_at')
    .eq('id', id)
    .single()

  if (!order) notFound()

  // 연관 데이터 병렬 조회
  const [profileRes, authRes, priceRes, licRes, subRes] = await Promise.all([
    admin.from('profiles').select('name, country').eq('id', order.user_id).single(),
    admin.auth.admin.getUserById(order.user_id as string),
    order.product_price_id
      ? admin.from('product_prices').select('interval, type, products(name, slug)').eq('id', order.product_price_id).single()
      : Promise.resolve({ data: null }),
    admin.from('licenses').select('id, serial_key, status, expires_at, products(name, slug)').eq('order_id', id),
    admin.from('subscriptions')
      .select('status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, lemon_squeezy_subscription_id')
      .eq('order_id', id),
  ])

  const name = profileRes.data?.name ?? '—'
  const email = authRes.data?.user?.email ?? '—'
  const priceInfo = priceRes.data as unknown as { interval: string | null; type: string | null; products: { name: string; slug: string } | null } | null
  const product = priceInfo?.products ?? null
  const productName = product?.name ?? (order.bundle_id ? '번들 주문' : '—')
  const licenses = (licRes.data ?? []) as unknown as Array<{ id: string; serial_key: string; status: string; expires_at: string | null; products: { name: string; slug: string } | null }>
  const subscription = (subRes.data ?? [])[0] as
    | { status: string; billing_interval: string | null; current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: boolean; lemon_squeezy_subscription_id: string | null }
    | undefined

  const shortId = (order.id as string).slice(0, 8).toUpperCase()
  const badge = ORDER_STATUS[order.status as string] ?? { label: order.status as string, cls: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]' }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-white transition-colors">
          <ArrowLeft size={14} /> 주문 목록
        </Link>
        <div className="flex items-center gap-3 mt-3">
          <h1 className="text-2xl font-bold text-white">주문 #{shortId}</h1>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      {/* 주문자 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">주문자</h2>
        <Row label="이름">{name}</Row>
        <Row label="이메일">{email}</Row>
      </section>

      {/* 주문 정보 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">주문 정보</h2>
        <Row label="상품">
          {productName}
          {product?.slug && <span className="text-[#475569] ml-2 font-mono text-xs">{product.slug}</span>}
        </Row>
        <Row label="수량">—</Row>
        <Row label="금액">{formatKRW(order.amount as number)}</Row>
        <Row label="통화">{(order.currency as string) ?? '—'}</Row>
        <Row label="결제수단">—</Row>
        <Row label="LS order_id"><span className="font-mono text-xs">{(order.lemon_squeezy_order_id as string) ?? '—'}</span></Row>
        <Row label="주문일시">{fmtDateTime(order.created_at as string)}</Row>
        <Row label="상태">{badge.label}</Row>
      </section>

      {/* 발급 라이선스 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">발급 라이선스</h2>
        {licenses.length === 0 ? (
          <p className="text-sm text-[#475569] py-2">발급된 라이선스가 없습니다.</p>
        ) : (
          licenses.map((lic) => (
            <div key={lic.id} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 border-b border-[#1E293B]/60 last:border-0">
              <span className="text-xs text-[#475569] pt-0.5 font-mono">{maskKey(lic.serial_key)}</span>
              <span className="text-sm text-white">
                {lic.products?.name ?? '—'}
                <span className="text-[#475569] ml-2 text-xs">{LICENSE_STATUS[lic.status] ?? lic.status}</span>
                {lic.expires_at && (
                  <span className="text-[#475569] ml-2 text-xs">· 만료 {fmtDateTime(lic.expires_at)}</span>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      {/* 구독 (있을 때만) */}
      {subscription && (
        <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-2">구독</h2>
          <Row label="구독 상태">
            {SUB_STATUS[subscription.status] ?? subscription.status}
            {subscription.cancel_at_period_end && <span className="text-amber-400 ml-2 text-xs">기간 말 취소 예약</span>}
          </Row>
          <Row label="주기">{subscription.billing_interval === 'annual' ? '연간' : subscription.billing_interval === 'monthly' ? '월간' : '—'}</Row>
          <Row label="시작일">{fmtDateTime(subscription.current_period_start)}</Row>
          <Row label="갱신일">{fmtDateTime(subscription.current_period_end)}</Row>
          <Row label="LS sub_id"><span className="font-mono text-xs">{subscription.lemon_squeezy_subscription_id ?? '—'}</span></Row>
        </section>
      )}
    </div>
  )
}
