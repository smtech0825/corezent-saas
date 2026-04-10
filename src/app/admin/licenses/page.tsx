/**
 * @파일: admin/licenses/page.tsx
 * @설명: 관리자 라이선스 관리 — 서버에서 전체 데이터 수집 후 클라이언트로 전달
 */

import { createAdminClient } from '@/lib/supabase/admin'
import LicenseTable, { type License } from './LicenseTable'

export const dynamic = 'force-dynamic'

function maskKey(key: string) {
  const parts = key.split('-')
  if (parts.length !== 4) return key
  return `${parts[0]}-****-****-${parts[3]}`
}

export default async function LicensesPage() {
  const adminClient = createAdminClient()

  // 라이선스 목록 (order_id 포함)
  const { data: licenses } = await adminClient
    .from('licenses')
    .select('id, user_id, serial_key, status, expires_at, created_at, order_id')
    .order('created_at', { ascending: false })

  // 구독 정보 조회 — Period(monthly/annual), Renewal Date
  const orderIds = (licenses ?? [])
    .map((l) => l.order_id as string | null)
    .filter((id): id is string => Boolean(id))

  type SubRow = { order_id: string | null; current_period_end: string | null; product_prices: { interval: string }[] | null }
  let subMap = new Map<string, { interval: string | null; renewalDate: string | null }>()

  if (orderIds.length > 0) {
    const { data: subs } = await adminClient
      .from('subscriptions')
      .select('order_id, current_period_end, product_prices(interval)')
      .in('order_id', orderIds)

    ;((subs as unknown) as SubRow[] ?? []).forEach((s) => {
      if (!s.order_id) return
      const pp = s.product_prices as { interval: string }[] | { interval: string } | null
      const interval = Array.isArray(pp)
        ? (pp[0]?.interval ?? null)
        : (pp?.interval ?? null)
      subMap.set(s.order_id, {
        interval,
        renewalDate: s.current_period_end ?? null,
      })
    })
  }

  // 이메일 맵 (auth.users)
  let emailMap = new Map<string, string>()
  try {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))
  } catch { /* 무시 */ }

  const list: License[] = (licenses ?? []).map((l) => {
    const sub = l.order_id ? subMap.get(l.order_id as string) : undefined
    return {
      id:          l.id as string,
      serialKey:   maskKey(l.serial_key as string),
      email:       emailMap.get(l.user_id as string) ?? '—',
      status:      l.status as string,
      period:      sub?.interval ?? null,
      renewalDate: sub?.renewalDate ?? null,
      expiresAt:   l.expires_at as string | null,
      createdAt:   l.created_at as string,
    }
  })

  return <LicenseTable licenses={list} />
}
