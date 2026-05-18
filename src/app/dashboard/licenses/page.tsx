/**
 * @파일: dashboard/licenses/page.tsx
 * @설명: 라이선스 목록 — 서버사이드 페이지네이션 (10개/페이지)
 *        구독형 라이선스는 subscription.current_period_end(갱신일)를 만료일로 표시
 */

import { createClient } from '@/lib/supabase/server'
import { Key } from 'lucide-react'
import LicenseCopyButton from '../_components/LicenseCopyButton'
import Pagination from '@/components/common/Pagination'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '내 라이선스 — CoreZent',
}

const PAGE_SIZE = 10

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: licenses, count } = await supabase
    .from('licenses')
    .select('id, serial_key, status, expires_at, created_at, order_id, products(name, slug)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // 구독 갱신일 조회 — order_id로 subscription.current_period_end 매핑
  const orderIds = (licenses ?? [])
    .map((l: Record<string, unknown>) => l.order_id as string | null)
    .filter((id): id is string => Boolean(id))

  const renewalMap = new Map<string, { end: string | null; interval: string | null }>()
  if (orderIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('order_id, current_period_end, status, billing_interval')
      .in('order_id', orderIds)

    ;(subs ?? []).forEach((s: Record<string, unknown>) => {
      const oid = s.order_id as string | null
      if (oid) {
        renewalMap.set(oid, {
          end: (s.current_period_end as string) ?? null,
          interval: (s.billing_interval as string) ?? null,
        })
      }
    })
  }

  const total = count ?? 0

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">내 라이선스</h1>
        <p className="text-[#94A3B8] text-sm mt-1">
          제품 라이선스 키를 관리하세요.
          {total > 0 && <span className="ml-2 text-[#475569]">(총 {total}개)</span>}
        </p>
      </div>

      {licenses && licenses.length > 0 ? (
        <>
          <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="hidden md:grid grid-cols-[1fr_130px_90px_90px_130px] gap-4 px-5 py-3 border-b border-[#1E293B] text-xs text-[#475569] font-medium">
              <span>라이선스 키</span>
              <span>제품</span>
              <span>상태</span>
              <span>주기</span>
              <span>만료일</span>
            </div>

            {/* 라이선스 목록 */}
            {licenses.map((lic: any) => {
              // 구독 갱신일 우선, 없으면 license.expires_at
              const subInfo = lic.order_id ? renewalMap.get(lic.order_id) : null
              const effectiveExpiry = subInfo?.end ?? lic.expires_at
              const period = subInfo?.interval ?? null

              return (
                <div
                  key={lic.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_130px_90px_90px_130px] gap-2 md:gap-4 items-center px-5 py-4 border-b border-[#1E293B] last:border-0 hover:bg-[#1E293B]/20 transition-colors"
                >
                  {/* 시리얼 키 */}
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-[#38BDF8] shrink-0 hidden md:block" />
                    <span className="font-mono text-sm text-white tracking-wider truncate">
                      {lic.serial_key}
                    </span>
                    <LicenseCopyButton serialKey={lic.serial_key} />
                  </div>

                  {/* 제품명 */}
                  <div>
                    <span className="text-sm text-[#94A3B8]">{lic.products?.name ?? '—'}</span>
                  </div>

                  {/* 상태 */}
                  <div>
                    <LicenseStatusBadge status={lic.status} />
                  </div>

                  {/* Period */}
                  <div>
                    {period ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        period === 'annual'
                          ? 'text-violet-400 bg-violet-400/10 border-violet-400/20'
                          : 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
                      }`}>
                        {period === 'annual' ? '연간' : '월간'}
                      </span>
                    ) : (
                      <span className="text-xs text-[#475569]">—</span>
                    )}
                  </div>

                  {/* 만료일 — 구독 갱신일 > license.expires_at > Lifetime */}
                  <div>
                    {lic.status === 'revoked' || lic.status === 'expired' || lic.status === 'cancelled' ? (
                      <span className="text-sm text-[#94A3B8]">해지됨</span>
                    ) : effectiveExpiry ? (
                      <span className="text-sm text-[#94A3B8]">
                        {new Date(effectiveExpiry).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-sm text-[#475569]">평생</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            buildHref={(p) => `/dashboard/licenses?page=${p}`}
          />
        </>
      ) : (
        <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
            <Key size={22} className="text-[#475569]" />
          </div>
          <p className="text-white font-medium mb-1">아직 라이선스가 없습니다</p>
          <p className="text-sm text-[#475569] mb-4">제품을 구매하면 라이선스 키를 받을 수 있습니다.</p>
          <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-[#38BDF8] hover:underline">
            제품 둘러보기 →
          </a>
        </div>
      )}
    </div>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: '활성',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    inactive: { label: '비활성', cls: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]' },
    expired:  { label: '만료',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    revoked:  { label: '해지',   cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }
  const { label, cls } = map[status] ?? map.inactive
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  )
}
