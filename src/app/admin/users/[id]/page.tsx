/**
 * @파일: admin/users/[id]/page.tsx
 * @설명: 관리자 사용자 상세 — 계정·구매이력·라이선스·구독·문의·제휴를 한 화면에 통합.
 *        주문 금액은 lib/money.formatKRW(cents ÷100 + ₩), 라이선스 키는 마스킹, 없는 값은 "—".
 *        라이선스 tier는 본체 DB에 없어(제품별 외부 라이선스 DB 관리) 표시하지 않는다.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKRW } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = { title: '사용자 상세' }

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** 라이선스 키 마스킹 — 앞 8자만 */
function maskKey(key: string | null): string {
  if (!key) return '—'
  return key.length > 8 ? `${key.slice(0, 8)}…` : key
}

/** 제휴 크레딧 표기 — dashboard/affiliate의 formatCents와 동일 규칙(표시 전용) */
function fmtCredit(cents: number, currency: string): string {
  const v = (cents / 100).toFixed(2)
  return currency === 'USD' ? `$${v}` : `${v} ${currency}`
}

const ORDER_STATUS: Record<string, string> = { paid: '결제됨', pending: '대기 중', refunded: '환불됨', cancelled: '취소됨' }
const SUB_STATUS: Record<string, string> = { active: '활성', paused: '일시정지', cancelled: '취소됨', expired: '만료됨' }
const LICENSE_STATUS: Record<string, string> = { active: '활성', expired: '만료', revoked: '해지' }
const TICKET_STATUS: Record<string, string> = { open: '접수', answered: '답변됨', closed: '종료' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 py-2.5 border-b border-rule last:border-0">
      <span className="text-xs text-ink-faint pt-0.5">{label}</span>
      <span className="text-sm text-ink break-all">{children}</span>
    </div>
  )
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('name, country, role, status, affiliate_code, created_at')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const [authRes, ordersRes, licRes, subRes, ticketRes, creditRes, cfgRes] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('orders').select('id, amount, currency, status, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('licenses').select('id, serial_key, status, expires_at, products(name)').eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('subscriptions').select('id, status, billing_interval, current_period_end').eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('support_tickets').select('id, subject, status, priority, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('store_credit_ledger').select('balance_after_cents').eq('user_id', id).order('created_at', { ascending: false }).limit(1),
    admin.from('affiliate_program_config').select('currency').limit(1).maybeSingle(),
  ])

  const email = authRes.data?.user?.email ?? '—'
  const orders = (ordersRes.data ?? []) as Array<{ id: string; amount: number; currency: string | null; status: string; created_at: string }>
  const licenses = (licRes.data ?? []) as unknown as Array<{ id: string; serial_key: string; status: string; expires_at: string | null; products: { name: string } | null }>
  const subs = (subRes.data ?? []) as Array<{ id: string; status: string; billing_interval: string | null; current_period_end: string | null }>
  const tickets = (ticketRes.data ?? []) as Array<{ id: string; subject: string; status: string; priority: string; created_at: string }>
  const creditCents = (creditRes.data?.[0]?.balance_after_cents as number | undefined) ?? 0
  const creditCurrency = (cfgRes.data?.currency as string | undefined) ?? 'USD'

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors">
          <ArrowLeft size={14} /> 사용자 목록
        </Link>
        <h1 className="text-2xl font-bold font-serif text-ink mt-3">{profile.name || email}</h1>
      </div>

      {/* 계정 */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">계정</h2>
        <Row label="이메일">{email}</Row>
        <Row label="이름">{profile.name || '—'}</Row>
        <Row label="국가">{profile.country || '—'}</Row>
        <Row label="역할">{profile.role === 'admin' ? '관리자' : '사용자'}</Row>
        <Row label="상태">{profile.status === 'inactive' ? '비활성(탈퇴)' : '활성'}</Row>
        <Row label="가입일">{fmtDate(profile.created_at as string)}</Row>
      </section>

      {/* 구매 이력 */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">구매 이력 ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-faint py-2">구매 내역이 없습니다.</p>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2.5 border-b border-rule last:border-0 hover:bg-paper-shade -mx-2 px-2 rounded transition-colors"
            >
              <span className="text-xs font-mono text-ink-soft">#{o.id.slice(0, 8).toUpperCase()}</span>
              <span className="text-sm text-ink tabular-nums">{formatKRW(o.amount)}</span>
              <span className="text-xs text-ink-faint whitespace-nowrap">{ORDER_STATUS[o.status] ?? o.status} · {fmtDate(o.created_at)}</span>
            </Link>
          ))
        )}
      </section>

      {/* 보유 라이선스 */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">보유 라이선스 ({licenses.length})</h2>
        {licenses.length === 0 ? (
          <p className="text-sm text-ink-faint py-2">라이선스가 없습니다.</p>
        ) : (
          licenses.map((lic) => (
            <div key={lic.id} className="grid grid-cols-[130px_1fr] gap-3 py-2.5 border-b border-rule last:border-0">
              <span className="text-xs text-ink-faint font-mono pt-0.5">{maskKey(lic.serial_key)}</span>
              <span className="text-sm text-ink">
                {lic.products?.name ?? '—'}
                <span className="text-ink-faint ml-2 text-xs">{LICENSE_STATUS[lic.status] ?? lic.status}</span>
                {lic.expires_at && <span className="text-ink-faint ml-2 text-xs">· 만료 {fmtDate(lic.expires_at)}</span>}
              </span>
            </div>
          ))
        )}
      </section>

      {/* 구독 */}
      {subs.length > 0 && (
        <section className="border border-rule bg-paper-raised rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-2">구독 ({subs.length})</h2>
          {subs.map((s) => (
            <Row key={s.id} label={SUB_STATUS[s.status] ?? s.status}>
              {s.billing_interval === 'annual' ? '연간' : s.billing_interval === 'monthly' ? '월간' : '—'}
              {s.current_period_end && <span className="text-ink-faint ml-2 text-xs">· 갱신일 {fmtDate(s.current_period_end)}</span>}
            </Row>
          ))}
        </section>
      )}

      {/* 문의 */}
      {tickets.length > 0 && (
        <section className="border border-rule bg-paper-raised rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-2">문의 ({tickets.length})</h2>
          {tickets.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_auto] gap-3 items-center py-2.5 border-b border-rule last:border-0">
              <span className="text-sm text-ink truncate">{t.subject}</span>
              <span className="text-xs text-ink-faint whitespace-nowrap">{TICKET_STATUS[t.status] ?? t.status} · {fmtDate(t.created_at)}</span>
            </div>
          ))}
        </section>
      )}

      {/* 제휴 (참여자만) */}
      {profile.affiliate_code && (
        <section className="border border-rule bg-paper-raised rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-ink mb-2">제휴</h2>
          <Row label="추천 코드"><span className="font-mono">{profile.affiliate_code as string}</span></Row>
          <Row label="크레딧 잔액">{fmtCredit(creditCents, creditCurrency)}</Row>
        </section>
      )}
    </div>
  )
}
