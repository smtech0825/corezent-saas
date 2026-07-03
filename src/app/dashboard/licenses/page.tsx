/**
 * @파일: dashboard/licenses/page.tsx
 * @설명: 라이선스 목록 — 서버사이드 페이지네이션 (10개/페이지)
 *        구독형 라이선스는 subscription.current_period_end(갱신일)를 만료일로 표시
 */

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Key } from 'lucide-react'
import LicenseCopyButton from '../_components/LicenseCopyButton'
import DownloadButton from '../billing/DownloadButton'
import Pagination from '@/components/common/Pagination'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '내 라이선스',
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
    .select('id, serial_key, status, expires_at, created_at, order_id, product_id, last_downloaded_version, products(name, slug)', { count: 'exact' })
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

  // 선택 옵션 조회 — order_id → orders.product_price_id → product_prices(옵션 라벨)
  //   구매 시 고른 옵션(예: "월간 · 1PC용")을 라이선스 행에 표시하기 위함.
  const optionMap = new Map<string, string>()  // order_id → "월간 · 1PC용"
  if (orderIds.length > 0) {
    const { data: orderRows } = await supabase
      .from('orders')
      .select('id, product_prices(option_axis1_label, option_axis2_label)')
      .in('id', orderIds)

    ;(orderRows ?? []).forEach((o: Record<string, unknown>) => {
      const ppRaw = o.product_prices
      const pp = (Array.isArray(ppRaw) ? ppRaw[0] : ppRaw) as
        { option_axis1_label?: string | null; option_axis2_label?: string | null } | null
      const parts = [pp?.option_axis1_label, pp?.option_axis2_label].filter(Boolean)
      if (parts.length) optionMap.set(o.id as string, parts.join(' · '))
    })
  }

  // 최신 릴리스(설치파일) 조회 — product_id별 latest changelog의 download_urls·version
  // URL은 하드코딩하지 않고 changelogs 테이블(빌링 페이지와 동일 출처)에서 읽는다.
  const productIds = [...new Set(
    (licenses ?? [])
      .map((l: Record<string, unknown>) => l.product_id as string | null)
      .filter((id): id is string => Boolean(id)),
  )]

  const changelogMap = new Map<string, { version: string; download_urls: Record<string, string> }>()
  if (productIds.length > 0) {
    const { data: changelogs } = await supabase
      .from('changelogs')
      .select('product_id, version, download_urls')
      .in('product_id', productIds)
      .eq('is_latest', true)

    ;(changelogs ?? []).forEach((c: Record<string, unknown>) => {
      changelogMap.set(c.product_id as string, {
        version:       c.version as string,
        download_urls: (c.download_urls ?? {}) as Record<string, string>,
      })
    })
  }

  const total = count ?? 0

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink font-serif">내 라이선스</h1>
        <p className="text-ink-soft text-sm mt-1">
          제품 라이선스 키를 관리하세요.
          {total > 0 && <span className="ml-2 text-ink-faint">(총 {total}개)</span>}
        </p>
      </div>

      {licenses && licenses.length > 0 ? (
        <>
          <div className="bg-paper-raised border border-rule rounded-xl overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="hidden md:grid grid-cols-[1fr_130px_90px_90px_130px_auto] gap-4 px-5 py-3 border-b border-rule text-xs text-ink-faint font-medium">
              <span>라이선스 키</span>
              <span>제품</span>
              <span>상태</span>
              <span>주기</span>
              <span>만료일</span>
              <span>다운로드</span>
            </div>

            {/* 라이선스 목록 */}
            {licenses.map((lic: any) => {
              // 구독 갱신일 우선, 없으면 license.expires_at
              const subInfo = lic.order_id ? renewalMap.get(lic.order_id) : null
              const effectiveExpiry = subInfo?.end ?? lic.expires_at
              const period = subInfo?.interval ?? null
              const optLabel = lic.order_id ? optionMap.get(lic.order_id) : undefined

              // 설치파일: product의 최신 릴리스에 download_urls가 있으면 노출
              const changelog = lic.product_id ? changelogMap.get(lic.product_id) : undefined
              const hasDownload = !!changelog && Object.values(changelog.download_urls).some(Boolean)
              const isNewVersion = !!changelog && (lic.last_downloaded_version == null || lic.last_downloaded_version !== changelog.version)

              return (
                <div
                  key={lic.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_130px_90px_90px_130px_auto] gap-2 md:gap-4 items-center px-5 py-4 border-b border-rule last:border-0 hover:bg-paper-shade transition-colors"
                >
                  {/* 시리얼 키 */}
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-mark shrink-0 hidden md:block" />
                    <span className="font-mono text-sm text-ink tracking-wider truncate">
                      {lic.serial_key}
                    </span>
                    <LicenseCopyButton serialKey={lic.serial_key} />
                  </div>

                  {/* 제품명 + 선택 옵션 — 모바일에선 라벨:값 (md 이상은 그리드 컬럼) */}
                  <div className="flex justify-between items-start md:block">
                    <span className="text-xs text-ink-faint md:hidden">제품</span>
                    <div className="text-right md:text-left">
                      <span className="text-sm text-ink">{lic.products?.name ?? '—'}</span>
                      {optLabel && (
                        <span className="block text-xs text-mark mt-0.5">{optLabel}</span>
                      )}
                    </div>
                  </div>

                  {/* 상태 */}
                  <div className="flex justify-between items-center md:block">
                    <span className="text-xs text-ink-faint md:hidden">상태</span>
                    <LicenseStatusBadge status={lic.status} />
                  </div>

                  {/* Period */}
                  <div className="flex justify-between items-center md:block">
                    <span className="text-xs text-ink-faint md:hidden">주기</span>
                    {period ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        period === 'annual'
                          ? 'text-info bg-info-soft border-info/20'
                          : 'text-ink-soft bg-paper-shade border-rule'
                      }`}>
                        {period === 'annual' ? '연간' : '월간'}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </div>

                  {/* 만료일 — 구독 갱신일 > license.expires_at > Lifetime */}
                  <div className="flex justify-between items-center md:block">
                    <span className="text-xs text-ink-faint md:hidden">만료일</span>
                    {lic.status === 'expired' ? (
                      <span className="text-sm text-ink-soft">만료</span>
                    ) : lic.status === 'revoked' || lic.status === 'cancelled' ? (
                      <span className="text-sm text-ink-soft">해지</span>
                    ) : effectiveExpiry ? (
                      <span className="text-sm text-ink-soft">
                        {new Date(effectiveExpiry).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-faint">평생</span>
                    )}
                  </div>

                  {/* 다운로드 — 최신 릴리스의 설치파일(있으면) + 릴리스 노트 딥링크 */}
                  <div>
                    {changelog ? (
                      <div className="flex flex-col items-start gap-1">
                        {hasDownload && lic.product_id && (
                          <DownloadButton
                            productId={lic.product_id}
                            version={changelog.version}
                            downloadUrls={changelog.download_urls}
                            isNew={isNewVersion}
                          />
                        )}
                        {lic.products?.slug && (
                          <Link
                            href={`/changelog?product=${lic.products.slug}`}
                            className="text-[11px] text-ink-faint hover:text-ink-soft transition-colors"
                          >
                            v{changelog.version} · 릴리스 노트
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
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
        <div className="bg-paper-raised border border-rule rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-paper-shade flex items-center justify-center mx-auto mb-4">
            <Key size={22} className="text-ink-faint" />
          </div>
          <p className="text-ink font-medium mb-1">아직 라이선스가 없습니다</p>
          <p className="text-sm text-ink-faint mb-4">제품을 구매하면 라이선스 키를 받을 수 있습니다.</p>
          <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-mark hover:underline">
            제품 둘러보기 →
          </a>
        </div>
      )}
    </div>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: '활성',   cls: 'text-ok bg-ok-soft border-ok/20' },
    inactive: { label: '비활성', cls: 'text-ink-soft bg-paper-shade border-rule' },
    expired:  { label: '만료',   cls: 'text-caution bg-caution-soft border-caution/20' },
    revoked:  { label: '해지',   cls: 'text-danger bg-danger-soft border-danger/20' },
  }
  const { label, cls } = map[status] ?? map.inactive
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  )
}
