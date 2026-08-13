/**
 * @파일: admin/quotes/page.tsx
 * @설명: 기관 견적 요청 목록 — quote_requests 열람. 문의(admin/inquiries)와 같은
 *        아코디언 목록 모양을 따른다. 행을 누르면 전체 내용이 펼쳐진다.
 *        상태는 두 가지뿐: 접수됨(received) / 견적 발급됨(quoted).
 *        ⚠️ 060_quote_requests.sql 적용 전에는 목록 대신 마이그레이션 안내가 보인다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import Pagination from '@/components/common/Pagination'
import PageContainer from '@/components/common/PageContainer'
import EmptyState from '@/components/common/EmptyState'
import { parsePageParam } from '@/lib/validate'
import IssueQuoteForm, { type PriceOption } from './IssueQuoteForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: '견적 요청' }

const PAGE_SIZE = 20

interface QuoteRow {
  id: string
  org_name: string
  biz_reg_no: string | null
  department: string | null
  contact_name: string | null
  phone: string | null
  email: string
  pc_count: number
  needed_by: string | null
  payment_pref: string | null
  note: string | null
  status: string
  quoted_at: string | null
  created_at: string
}

/**
 * @함수명: fmtDateTime
 * @설명: 접수 일시를 한국어 짧은 형식으로 표시합니다(문의 화면과 동일 형식).
 * @매개변수: d - ISO 날짜 문자열
 * @반환값: 표시용 문자열
 */
function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** 상태 배지 — received=접수됨(주의색), quoted=견적 발급됨(완료색). 두 상태만 존재한다. */
function statusBadge(status: string): { label: string; cls: string } {
  return status === 'quoted'
    ? { label: '견적 발급됨', cls: 'text-ok bg-ok-soft' }
    : { label: '접수됨', cls: 'text-caution bg-caution-soft' }
}

/** 상세 필드 한 줄 — 값이 없으면 그리지 않는다 */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-ink-faint shrink-0 w-24">{label}</span>
      <span className="text-ink-soft break-words min-w-0">{value}</span>
    </div>
  )
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // 페이지 본문도 스스로 관리자 여부를 확인한다(자매 화면 관례 — 레이아웃에만 기대지 않는다).
  await requireAdminOrThrow()

  const { page: pageStr } = await searchParams
  const page = parsePageParam(pageStr)
  const offset = (page - 1) * PAGE_SIZE

  const adminClient = createAdminClient()
  const { data, count, error } = await adminClient
    .from('quote_requests')
    .select('id, org_name, biz_reg_no, department, contact_name, phone, email, pc_count, needed_by, payment_pref, note, status, quoted_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const rows = (data ?? []) as QuoteRow[]
  const total = count ?? 0
  // 테이블 미적용(42P01)은 원인이 분명하므로 일반 실패와 구분해 안내한다(로그 화면 관례)
  const tableMissing = error?.code === '42P01'

  // 견적서 발급용 상품 옵션 — 단가는 product_prices.price(원)를 그대로 보여주고 그대로 쓴다
  const { data: priceRows } = await adminClient
    .from('product_prices')
    .select('id, price, option_axis1_label, option_axis2_label, products(name)')
    .eq('is_active', true)
  const options: PriceOption[] = (priceRows ?? []).map((p) => {
    const prodRaw = (p as Record<string, unknown>).products
    const prod = (Array.isArray(prodRaw) ? prodRaw[0] : prodRaw) as { name?: string } | null
    const opts = [p.option_axis1_label, p.option_axis2_label].filter(Boolean).join(' · ')
    return {
      id: p.id as string,
      label: `${prod?.name ?? '-'}${opts ? ` — ${opts}` : ''} (₩${Number(p.price).toLocaleString('ko-KR')})`,
    }
  })

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">견적 요청</h1>
        <p className="text-sm text-ink-soft mt-1">
          기관 도입 페이지에서 접수된 견적 요청입니다. 행을 누르면 전체 내용이 보입니다.
        </p>
      </div>

      {error ? (
        <div className="border border-caution/20 bg-caution-soft rounded-card p-5 text-sm text-caution">
          {tableMissing
            ? '견적 요청 저장소가 아직 준비되지 않았습니다. supabase/migrations/060_quote_requests.sql 을 Supabase SQL Editor에서 적용해 주세요.'
            : '견적 요청 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState boxed message="접수된 견적 요청이 없습니다." />
      ) : (
        <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
          {rows.map((r) => {
            const badge = statusBadge(r.status)
            return (
              <details key={r.id} className="border-b border-rule last:border-0 group">
                <summary className="px-5 py-4 cursor-pointer hover:bg-paper-shade transition-colors list-none">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {r.org_name}
                        {r.contact_name && <span className="text-ink-faint font-normal"> · {r.contact_name}</span>}
                      </p>
                      <p className="text-xs text-ink-faint mt-1 truncate">
                        PC {r.pc_count}대 · {r.email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-ink-faint whitespace-nowrap">{fmtDateTime(r.created_at)}</span>
                    </div>
                  </div>
                </summary>
                <div className="px-5 pb-5 pt-1 space-y-1.5">
                  <DetailRow label="요청 번호" value={r.id.slice(0, 8).toUpperCase()} />
                  <DetailRow label="사업자등록번호" value={r.biz_reg_no} />
                  <DetailRow label="부서" value={r.department} />
                  <DetailRow label="연락처" value={r.phone} />
                  <DetailRow label="필요 시기" value={r.needed_by} />
                  <DetailRow label="희망 결제" value={r.payment_pref} />
                  {r.quoted_at && <DetailRow label="견적 발급" value={fmtDateTime(r.quoted_at)} />}
                  {r.note && (
                    <div className="pt-2">
                      <p className="text-xs text-ink-faint mb-1">요청사항</p>
                      <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">{r.note}</p>
                    </div>
                  )}
                  {/* 견적서 발급 — 같은 요청에 여러 번 발급 가능(번호는 DB가 채번, 중복 불가) */}
                  <IssueQuoteForm requestId={r.id} defaultQty={r.pc_count} options={options} />
                </div>
              </details>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => `/admin/quotes?page=${p}`}
      />
    </PageContainer>
  )
}
