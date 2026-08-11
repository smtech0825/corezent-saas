/**
 * @파일: admin/support/[id]/page.tsx
 * @설명: 지원 티켓 상세 — 메시지 스레드 및 답변 기능
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import ReplyForm, { type ReplyResult } from './ReplyForm'
import { sendEmail, supportReplyEmailHtml } from '@/lib/email'
import PageContainer from '@/components/common/PageContainer'
import { requireAdminOrThrow } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const statusColors: Record<string, string> = {
  open: 'text-caution bg-caution-soft border-caution/20',
  answered: 'text-info bg-info-soft border-info/20',
  closed: 'text-ink-soft bg-paper-shade border-rule',
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const adminClient = createAdminClient()

  const { data: ticket } = await adminClient
    .from('support_tickets')
    .select('id, user_id, subject, status, priority, created_at')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  // 읽음 처리
  await adminClient.from('support_tickets').update({ is_read: true }).eq('id', id)

  const { data: replies } = await adminClient
    .from('support_replies')
    .select('id, user_id, is_admin, message, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  // 사용자 이메일 조회
  let userEmail = '—'
  try {
    const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(ticket.user_id)
    userEmail = authUser?.email ?? '—'
  } catch { /* 무시 */ }

  /**
   * @함수명: handleReply
   * @설명: 관리자 답변을 저장하고 티켓 상태를 바꾼 뒤 고객에게 알림 메일을 보냅니다.
   *        실패를 예외로 던지지 않고 결과값으로 돌려줍니다 — 운영 환경에서는 서버 예외 문구가
   *        일반 문구로 바뀌어, 화면이 "저장은 됐다"는 사실을 알 수 없게 되기 때문입니다.
   * @매개변수: message - 답변 내용 / close - 답변 후 티켓을 닫을지 여부
   * @반환값: 전부 성공 / 답변은 전송됐고 상태만 실패 / 답변 저장 실패 세 가지 중 하나
   */
  async function handleReply(message: string, close: boolean): Promise<ReplyResult> {
    'use server'
    await requireAdminOrThrow()
    const client = createAdminClient()
    const serverClient = await createClient()
    const { data: { user: currentUser } } = await serverClient.auth.getUser()

    // 답변 저장이 실패하면 여기서 멈춘다 — 저장도 안 됐는데 티켓이 "답변됨"이 되고
    // 고객에게 알림 메일까지 나가면, 고객은 없는 답변을 보러 오게 된다.
    const { error: replyErr } = await client.from('support_replies').insert({
      ticket_id: id,
      user_id: currentUser?.id,
      is_admin: true,
      message,
    })
    if (replyErr) {
      console.error('[support] 답변 저장 실패:', replyErr.message)
      // 아직 아무것도 나가지 않았으므로 관리자가 그대로 다시 시도해도 안전하다.
      return { status: 'save_failed', reason: replyErr.message }
    }

    // ★ 여기서부터 답변은 이미 저장됐다. 무엇이 실패하든 재전송을 유도하면 안 된다 —
    //   다시 보내면 답변이 두 번 저장되고 고객에게 메일도 두 번 간다.
    const { error: statusErr } = await client
      .from('support_tickets')
      .update({ status: close ? 'closed' : 'answered' })
      .eq('id', id)
    if (statusErr) {
      console.error('[support] 티켓 상태 변경 실패:', statusErr.message)
      // 여기서 중단하지 않는다. 상태 표시가 틀린 것보다, 답변이 고객에게 안 가는 것이 더 나쁘다.
    }

    // 사용자에게 답변 알림 이메일 발송.
    // 메일만 실패한 경우는 답변을 되돌리지 않는다 — 답변은 고객이 대시보드에서 볼 수 있고,
    // 되돌리면 관리자가 작성한 내용이 사라져 더 나쁘다. 실패는 sendEmail이 모니터링 로그에
    // 남기므로 관리자 → 모니터링 로그에서 확인하고 다른 경로로 연락할 수 있다.
    if (ticket && userEmail !== '—') {
      try {
        await sendEmail({
          to: userEmail,
          subject: `Re: ${ticket.subject}`,
          html: supportReplyEmailHtml(ticket.subject, message, 'CoreZent'),
        })
      } catch (mailErr) {
        console.error('[support] 답변 알림 메일 발송 실패(답변은 저장됨):', mailErr instanceof Error ? mailErr.message : String(mailErr))
      }
    }

    revalidatePath(`/admin/support/${id}`)

    return statusErr
      ? { status: 'sent_but_status_failed', reason: statusErr.message }
      : { status: 'ok' }
  }

  async function closeTicket() {
    'use server'
    await requireAdminOrThrow()
    const client = createAdminClient()
    const { error } = await client.from('support_tickets').update({ status: 'closed' }).eq('id', id)
    if (error) throw new Error(`티켓 닫기에 실패했습니다: ${error.message}`)
    revalidatePath(`/admin/support/${id}`)
  }

  async function reopenTicket() {
    'use server'
    await requireAdminOrThrow()
    const client = createAdminClient()
    const { error } = await client.from('support_tickets').update({ status: 'open' }).eq('id', id)
    if (error) throw new Error(`티켓 다시 열기에 실패했습니다: ${error.message}`)
    revalidatePath(`/admin/support/${id}`)
  }

  return (
    <PageContainer variant="admin">
      <div className="max-w-4xl space-y-6">
        {/* 뒤로 + 헤더 */}
        <div>
          <Link href="/admin/support" className="text-sm text-ink-faint hover:text-ink-soft transition-colors">
            ← 고객지원으로 돌아가기
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink font-serif">{ticket.subject}</h1>
              <p className="text-sm text-ink-soft mt-1">
                보낸 사람 <span className="text-ink">{userEmail}</span> · {fmtDate(ticket.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColors[ticket.status] ?? 'text-ink-soft bg-paper-shade border-rule'}`}>
                {ticket.status}
              </span>
              <span className="text-xs text-ink-faint capitalize">{ticket.priority} 우선순위</span>
            </div>
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="flex items-center gap-2">
          {ticket.status !== 'closed' ? (
            <form action={closeTicket}>
              <button type="submit" className="text-xs text-ink-soft hover:text-ink border border-rule hover:border-mark/40 px-3 py-2 rounded-lg transition-colors">
                티켓 닫기
              </button>
            </form>
          ) : (
            <form action={reopenTicket}>
              <button type="submit" className="text-xs text-caution hover:brightness-110 border border-caution/20 px-3 py-2 rounded-lg transition-colors">
                티켓 다시 열기
              </button>
            </form>
          )}
        </div>

        {/* 메시지 스레드 */}
        <div className="space-y-3">
          {(!replies || replies.length === 0) ? (
            <div className="border border-rule bg-paper-raised rounded-2xl py-12 text-center text-sm text-ink-faint">
              아직 메시지가 없습니다.
            </div>
          ) : (
            replies.map((reply) => (
              <div
                key={reply.id}
                className={`border rounded-2xl p-5 ${
                  reply.is_admin
                    ? 'border-mark/20 bg-mark/5 ml-8'
                    : 'border-rule bg-paper-raised'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold ${reply.is_admin ? 'text-mark' : 'text-ink'}`}>
                    {reply.is_admin ? '🛡 관리자' : userEmail}
                  </span>
                  <span className="text-xs text-ink-faint">{fmtDate(reply.created_at)}</span>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))
          )}
        </div>

        {/* 답변 폼 */}
        {ticket.status !== 'closed' && (
          <ReplyForm onSubmit={handleReply} />
        )}
      </div>
    </PageContainer>
  )
}
