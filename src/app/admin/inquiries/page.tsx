/**
 * @파일: admin/inquiries/page.tsx
 * @설명: 비회원 문의·기관 견적 요청 열람 (읽기 전용).
 *        공개 문의 폼(/contact)과 기관 견적 폼(/public-sector)이 저장하는 inquiries
 *        테이블을 보여준다. 지금까지는 메일이 유일한 통로라 메일이 한 번 실패하면
 *        그 문의를 영원히 볼 수 없었다.
 *        회원 문의는 별개 데이터(support_tickets)로 /admin/support 에서 본다.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import Pagination from '@/components/common/Pagination'
import PageContainer from '@/components/common/PageContainer'
import { parsePageParam } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

interface InquiryRow {
  id: string
  email: string
  subject: string
  message: string
  attachment_name: string | null
  created_at: string
}

/**
 * @함수명: fmtDateTime
 * @설명: 접수 일시를 한국어 짧은 형식으로 표시합니다.
 * @매개변수: d - ISO 날짜 문자열
 * @반환값: 표시용 문자열
 */
function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * @함수명: InquiriesPage
 * @설명: 문의 목록을 최신순으로 보여줍니다. 제목을 누르면 전체 내용이 펼쳐집니다.
 * @매개변수: searchParams - page(페이지 번호)
 * @반환값: 문의 목록 화면
 */
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  // 페이지 본문도 스스로 관리자 여부를 확인한다(레이아웃 통과에만 기대지 않는다).
  await requireAdminOrThrow()

  const { page: pageStr } = await searchParams
  const page = parsePageParam(pageStr)
  const offset = (page - 1) * PAGE_SIZE

  const adminClient = createAdminClient()
  const { data, count, error } = await adminClient
    .from('inquiries')
    .select('id, email, subject, message, attachment_name, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const rows = (data ?? []) as InquiryRow[]
  const total = count ?? 0

  return (
    <PageContainer variant="admin" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">문의</h1>
        <p className="text-sm text-ink-soft mt-1">
          홈페이지 문의 폼과 기관 견적 요청으로 들어온 내용입니다. 읽기 전용입니다.
        </p>
      </div>

      {error ? (
        <div className="border border-caution/20 bg-caution-soft rounded-2xl p-5 text-sm text-caution">
          문의 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-rule bg-paper-raised rounded-2xl py-16 text-center text-sm text-ink-faint">
          접수된 문의가 없습니다.
        </div>
      ) : (
        <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
          {rows.map((r) => (
            <details key={r.id} className="border-b border-rule last:border-0 group">
              <summary className="px-5 py-4 cursor-pointer hover:bg-paper-shade transition-colors list-none">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{r.subject}</p>
                    <p className="text-xs text-ink-faint mt-1 truncate">
                      {r.email}
                      {r.attachment_name && <span className="ml-2">· 첨부 {r.attachment_name}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap shrink-0">
                    {fmtDateTime(r.created_at)}
                  </span>
                </div>
              </summary>
              <div className="px-5 pb-5 pt-1">
                <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap break-words">
                  {r.message}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => `/admin/inquiries?page=${p}`}
      />
    </PageContainer>
  )
}
