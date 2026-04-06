/**
 * @파일: admin/support/[id]/page.tsx
 * @설명: 지원 티켓 상세 — 메시지 스레드 및 답변 기능
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import ReplyForm from './ReplyForm'
import { sendEmail, supportReplyEmailHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const statusColors: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  answered: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  closed: 'text-[#475569] bg-[#1E293B] border-[#1E293B]',
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

  async function handleReply(message: string, close: boolean) {
    'use server'
    const client = createAdminClient()
    const serverClient = await createClient()
    const { data: { user: currentUser } } = await serverClient.auth.getUser()

    await client.from('support_replies').insert({
      ticket_id: id,
      user_id: currentUser?.id,
      is_admin: true,
      message,
    })

    if (close) {
      await client.from('support_tickets').update({ status: 'closed' }).eq('id', id)
    } else {
      await client.from('support_tickets').update({ status: 'answered' }).eq('id', id)
    }

    // 사용자에게 답변 알림 이메일 발송
    if (ticket && userEmail !== '—') {
      sendEmail({
        to: userEmail,
        subject: `Re: ${ticket.subject}`,
        html: supportReplyEmailHtml(ticket.subject, message, 'CoreZent'),
      }).catch((err) => console.error('[email] 답변 알림 이메일 발송 실패:', err))
    }

    revalidatePath(`/admin/support/${id}`)
  }

  async function closeTicket() {
    'use server'
    const client = createAdminClient()
    await client.from('support_tickets').update({ status: 'closed' }).eq('id', id)
    revalidatePath(`/admin/support/${id}`)
  }

  async function reopenTicket() {
    'use server'
    const client = createAdminClient()
    await client.from('support_tickets').update({ status: 'open' }).eq('id', id)
    revalidatePath(`/admin/support/${id}`)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* 뒤로 + 헤더 */}
      <div>
        <Link href="/admin/support" className="text-sm text-[#475569] hover:text-[#94A3B8] transition-colors">
          ← Back to Support
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{ticket.subject}</h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              From <span className="text-white">{userEmail}</span> · {fmtDate(ticket.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColors[ticket.status] ?? 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]'}`}>
              {ticket.status}
            </span>
            <span className="text-xs text-[#475569] capitalize">{ticket.priority} priority</span>
          </div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="flex items-center gap-2">
        {ticket.status !== 'closed' ? (
          <form action={closeTicket}>
            <button type="submit" className="text-xs text-[#94A3B8] hover:text-white border border-[#1E293B] hover:border-[#38BDF8]/30 px-3 py-2 rounded-lg transition-colors">
              Close ticket
            </button>
          </form>
        ) : (
          <form action={reopenTicket}>
            <button type="submit" className="text-xs text-amber-400 hover:text-amber-300 border border-amber-400/20 px-3 py-2 rounded-lg transition-colors">
              Reopen ticket
            </button>
          </form>
        )}
      </div>

      {/* 메시지 스레드 */}
      <div className="space-y-3">
        {(!replies || replies.length === 0) ? (
          <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl py-12 text-center text-sm text-[#475569]">
            No messages yet.
          </div>
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              className={`border rounded-2xl p-5 ${
                reply.is_admin
                  ? 'border-amber-500/20 bg-amber-500/5 ml-8'
                  : 'border-[#1E293B] bg-[#111A2E]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold ${reply.is_admin ? 'text-amber-400' : 'text-[#38BDF8]'}`}>
                  {reply.is_admin ? '🛡 Admin' : userEmail}
                </span>
                <span className="text-xs text-[#475569]">{fmtDate(reply.created_at)}</span>
              </div>
              <p className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))
        )}
      </div>

      {/* 답변 폼 */}
      {ticket.status !== 'closed' && (
        <ReplyForm onSubmit={handleReply} />
      )}
    </div>
  )
}
