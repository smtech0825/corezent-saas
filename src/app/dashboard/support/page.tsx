/**
 * @파일: dashboard/support/page.tsx
 * @설명: 사용자 대시보드 지원 티켓 제출 및 조회 — 5개/페이지 페이지네이션, Accordion 목록.
 *        폼은 TicketForm(클라이언트)으로 분리 — 첨부·문의 유형 포함, 실패를 결과값으로 알림.
 *        첨부 실체는 비공개 버킷(support-attachments)에만 저장한다(062 적용 전에는 실패 안내).
 */

import type { Metadata } from 'next'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewTicket } from '@/lib/admin-notify'
// ★ 'use client'인 AttachmentField가 아니라 중립 모듈에서 가져온다 — 서버가 클라이언트
//   모듈의 값을 import하면 검증이 깨진다(검증 도구 지적)
import { MAX_ATTACHMENT_SIZE, normalizeAttachmentExt, isAllowedAttachment } from '@/lib/attachment'
import { isSupportCategory } from '@/lib/support-categories'
import { parsePageParam, isOneOf } from '@/lib/validate'
import Pagination from '@/components/common/Pagination'
import TicketList from './TicketList'
import TicketForm, { type TicketSubmitResult } from './TicketForm'
import PageContainer from '@/components/common/PageContainer'

export const dynamic = 'force-dynamic'

// 탭 제목 — 루트 title.template('%s | CoreZent')이 브랜드를 붙이므로 페이지명만 지정
export const metadata: Metadata = {
  title: '고객지원',
}

const PAGE_SIZE = 5

/** 첨부를 저장하는 비공개 버킷 이름(062 마이그레이션과 일치) */
const ATTACHMENT_BUCKET = 'support-attachments'

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  // 공용 파서 — ?page=abc 같은 값이 NaN 조회로 번져 목록이 통째로 비지 않게(관리자 화면과 동일)
  const page = parsePageParam(pageStr)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/dashboard/support')

  // user_last_read_at 포함 시도 → 실패 시 없이 재시도 (컬럼 미존재 대비)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tickets: any[] | null = null
  let total: number | null = null

  const firstTry = await supabase
    .from('support_tickets')
    .select('id, subject, status, priority, created_at, updated_at, user_last_read_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (firstTry.error) {
    const fallback = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    tickets = fallback.data
    total = fallback.count
  } else {
    tickets = firstTry.data
    total = firstTry.count
  }

  const list = tickets ?? []

  /**
   * @함수명: submitTicket
   * @설명: 새 문의를 접수합니다. 순서가 중요합니다 — 첨부 업로드를 티켓 저장 **앞에**
   *        둬서, 업로드가 실패하면 아무것도 남지 않아 재시도해도 중복이 생기지 않습니다.
   *        본문 저장이 실패하면 방금 만든 티켓을 지워서(보상 삭제) 역시 재시도를 안전하게
   *        만듭니다. 실패는 예외가 아니라 결과값(한국어 사유)으로 돌려줍니다.
   * @매개변수: formData - 제목·문의 유형·우선순위·내용·첨부(선택)
   * @반환값: { ok: true } 또는 { ok: false, reason: 화면에 그대로 보여줄 문장 }
   */
  async function submitTicket(formData: FormData): Promise<TicketSubmitResult> {
    'use server'
    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()
    if (!currentUser) {
      return { ok: false, reason: '로그인이 만료되었습니다. 새로고침 후 다시 시도해 주세요.' }
    }

    const rawSubject = formData.get('subject')
    const rawMessage = formData.get('message')
    const rawPriority = formData.get('priority')
    const rawCategory = formData.get('category')
    const subject = typeof rawSubject === 'string' ? rawSubject.trim() : ''
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
    // 우선순위는 허용값만 저장(CHECK 위반으로 접수가 통째로 실패하지 않게 보정)
    const priority = typeof rawPriority === 'string' && isOneOf(rawPriority, ['low', 'normal', 'high', 'urgent'] as const)
      ? rawPriority : 'normal'
    // 유형은 선택 입력 — 목록에 없는 값(변조 등)은 저장을 생략할 뿐 접수를 막지 않는다
    const category = typeof rawCategory === 'string' && isSupportCategory(rawCategory) ? rawCategory : null

    if (!subject || !message) {
      return { ok: false, reason: '제목과 내용을 입력해 주세요.' }
    }

    // ── 첨부 검증·업로드 (티켓 저장 전 — 실패 시 아무것도 남지 않게) ──────────
    const file = formData.get('attachment')
    let attachment: { path: string; name: string; size: number; ext: string } | null = null
    const adminC = createAdminClient()
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        return { ok: false, reason: '첨부 파일은 5MB 이하만 올릴 수 있습니다.' }
      }
      // 확장자 정규화(후행 점·공백 우회 차단) + 허용 목록 — 실행 파일은 목록에 없어 저장 불가
      const ext = normalizeAttachmentExt(file.name)
      if (!ext || !isAllowedAttachment(ext)) {
        return { ok: false, reason: '허용되지 않는 파일 형식입니다. 화면 캡처(PNG·JPG)·PDF·문서·압축(ZIP) 파일만 첨부할 수 있습니다.' }
      }

      // 저장 경로에는 원본 파일명을 넣지 않는다(특수문자·경로 조작 방지) — 원본명은 DB에만.
      // 경로 맨 앞이 본인 계정 id라 누가 올렸는지 경로만으로도 분명하다.
      const objectPath = `${currentUser.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await adminC.storage
        .from(ATTACHMENT_BUCKET)
        .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || 'application/octet-stream',
        })
      if (uploadErr) {
        // 버킷 미생성(062 미적용) 포함 — 원문은 서버 기록에만 남긴다
        console.error('[support] 첨부 업로드 실패:', uploadErr.message)
        return { ok: false, reason: '첨부 업로드에 실패했습니다. 첨부를 빼고 제출하시거나 잠시 후 다시 시도해 주세요.' }
      }
      attachment = { path: objectPath, name: file.name, size: file.size, ext }
    }

    /**
     * @함수명: removeUploaded
     * @설명: 접수가 실패로 끝날 때 방금 올린 첨부 객체를 지웁니다(고아 파일 방지).
     *        삭제 실패는 접수 실패 흐름을 바꾸지 않고 기록만 남깁니다.
     */
    async function removeUploaded(): Promise<void> {
      if (!attachment) return
      try {
        await adminC.storage.from(ATTACHMENT_BUCKET).remove([attachment.path])
      } catch (err) {
        console.error('[support] 첨부 정리 실패(고아 파일 잔존):', err instanceof Error ? err.message : String(err))
      }
    }

    // ── 티켓 저장 — category 칸이 아직 없을 때(062 미적용, 오류 42703)만 유형 없이 재시도 ──
    let ticketId: string | null = null
    {
      const first = await supabaseServer
        .from('support_tickets')
        .insert({ user_id: currentUser.id, subject, status: 'open', priority, is_read: false, ...(category ? { category } : {}) })
        .select('id')
        .single()
      if (first.error && category && first.error.code === '42703') {
        // 42703 = 칸 없음(undefined_column) — 이때만 폴백. 다른 오류에 재시도하면 중복 위험.
        console.error('[support] category 저장 생략(칸 없음 — 062 적용 필요):', first.error.message)
        const fallback = await supabaseServer
          .from('support_tickets')
          .insert({ user_id: currentUser.id, subject, status: 'open', priority, is_read: false })
          .select('id')
          .single()
        if (fallback.error) console.error('[support] 티켓 저장 실패(폴백):', fallback.error.message)
        ticketId = fallback.data?.id ?? null
      } else {
        if (first.error) console.error('[support] 티켓 저장 실패:', first.error.message)
        ticketId = first.data?.id ?? null
      }
    }
    if (!ticketId) {
      await removeUploaded()
      return { ok: false, reason: '문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
    }

    // ── 본문(첫 답글) 저장 — 실패하면 티켓·첨부를 지워 재시도를 안전하게 ──────
    // 첨부 칸 없이 저장하는 폴백은 두지 않는다: 업로드가 성공했다 = 버킷이 있다 = 062가
    // 적용됐다 = 첨부 칸도 있다(같은 파일에서 칸이 버킷보다 먼저 만들어짐). 부분 적용은 없다.
    const replyInsert: Record<string, unknown> = {
      ticket_id: ticketId, user_id: currentUser.id, is_admin: false, message,
    }
    if (attachment) {
      replyInsert.attachment_path = attachment.path
      replyInsert.attachment_name = attachment.name
      replyInsert.attachment_size = attachment.size
    }
    const { error: replyErr } = await supabaseServer.from('support_replies').insert(replyInsert)
    if (replyErr) {
      console.error('[support] 본문 저장 실패:', replyErr.message)
      // 보상 삭제 — RLS 우회(사용자 DELETE 정책 없음)이므로 소유자 조건을 이중으로 건다
      await adminC.from('support_tickets').delete().eq('id', ticketId).eq('user_id', currentUser.id)
      await removeUploaded()
      return { ok: false, reason: '문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
    }

    // 관리자 새 티켓 알림 — after(): 응답이 나간 뒤 실행돼 폼 제출·화면 갱신을 붙잡지
    // 않는다(SMTP가 느려도 접수는 즉시 끝남 — 검증 지적). 실패해도 접수는 유지된다.
    // 개인정보는 최소한만: 계정 이메일·제목·내용 앞 80자. 같은 계정 반복 제출은
    // 30분에 한 통만 발송(헬퍼의 계정 기준 억제 — 로그인 사용자발 폭주 방어).
    const notifyTicketId = ticketId
    after(() => notifyNewTicket({
      ticketId: notifyTicketId,
      userEmail: currentUser.email ?? '(이메일 없음)',
      subject,
      priority,
      preview: message,
    }))

    revalidatePath('/dashboard/support')
    return { ok: true }
  }

  return (
    <PageContainer variant="dashboard" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">고객지원</h1>
        <p className="text-sm text-ink-soft mt-1">
          문의를 남겨주시면 최대한 빠르게 답변드리겠습니다.
        </p>
      </div>

      {/* 티켓 제출 폼 — 폭은 아래 문의 내역 목록과 동일하게 컨테이너 폭을 그대로 사용.
          첨부·문의 유형 포함(TicketForm) — 실패는 결과값으로 화면에 표시된다 */}
      <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">새 문의 작성</h2>
        </div>
        <TicketForm action={submitTicket} />
      </div>

      {/* 기존 티켓 목록 (Accordion) */}
      {list.length > 0 && (
        <>
          <TicketList tickets={list} />
          <Pagination
            page={page}
            total={total ?? 0}
            pageSize={PAGE_SIZE}
            buildHref={(p) => `/dashboard/support?page=${p}`}
          />
        </>
      )}
    </PageContainer>
  )
}
