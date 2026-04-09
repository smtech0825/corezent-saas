'use client'

/**
 * @컴포넌트: TicketList
 * @설명: 지원 티켓 목록 — Accordion 확장/답변/닫기 클라이언트 컴포넌트
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Loader2, Send, X } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  user_last_read_at: string | null
}

interface Reply {
  id: string
  is_admin: boolean
  message: string
  created_at: string
}

const statusColors: Record<string, string> = {
  open:     'text-amber-400 bg-amber-400/10',
  answered: 'text-blue-400 bg-blue-400/10',
  closed:   'text-[#475569] bg-[#1E293B]',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 읽지 않은 관리자 답변이 있는지 확인 */
function hasUnread(ticket: Ticket): boolean {
  if (ticket.status !== 'answered') return false
  if (!ticket.user_last_read_at) return true
  return ticket.user_last_read_at < ticket.updated_at
}

export default function TicketList({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [repliesMap, setRepliesMap] = useState<Record<string, Reply[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState<string | null>(null)

  const fetchReplies = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('support_replies')
      .select('id, is_admin, message, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    return data ?? []
  }, [supabase])

  async function toggleTicket(ticket: Ticket) {
    if (expandedId === ticket.id) {
      setExpandedId(null)
      return
    }

    setExpandedId(ticket.id)

    // 이미 로드된 경우 재요청 안 함
    if (!repliesMap[ticket.id]) {
      setLoadingId(ticket.id)
      const replies = await fetchReplies(ticket.id)
      setRepliesMap((prev) => ({ ...prev, [ticket.id]: replies }))
      setLoadingId(null)
    }

    // 읽음 시각 업데이트 (백그라운드)
    supabase
      .from('support_tickets')
      .update({ user_last_read_at: new Date().toISOString() })
      .eq('id', ticket.id)
      .then(() => router.refresh())
  }

  async function submitReply(ticketId: string) {
    const message = (replyTexts[ticketId] ?? '').trim()
    if (!message) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error } = await supabase.from('support_replies').insert({
      ticket_id: ticketId,
      user_id: user.id,
      is_admin: false,
      message,
    })

    if (error) {
      showToast('error', 'Failed to send reply. Please try again.')
    } else {
      showToast('success', 'Reply sent successfully.')
      setReplyTexts((prev) => ({ ...prev, [ticketId]: '' }))
      // 답변 목록 갱신
      const replies = await fetchReplies(ticketId)
      setRepliesMap((prev) => ({ ...prev, [ticketId]: replies }))
    }
    setSubmitting(false)
  }

  async function closeTicket(ticketId: string) {
    setClosing(ticketId)
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticketId)

    if (error) {
      showToast('error', 'Failed to close ticket.')
    } else {
      showToast('success', 'Ticket closed.')
      router.refresh()
    }
    setClosing(null)
  }

  if (tickets.length === 0) return null

  return (
    <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1E293B]">
        <h2 className="text-sm font-semibold text-white">Your Tickets</h2>
      </div>

      <div className="divide-y divide-[#1E293B]/50">
        {tickets.map((ticket) => {
          const isExpanded = expandedId === ticket.id
          const unread = hasUnread(ticket)
          const replies = repliesMap[ticket.id] ?? []

          return (
            <div key={ticket.id}>
              {/* 티켓 헤더 (클릭으로 Accordion 토글) */}
              <button
                type="button"
                onClick={() => toggleTicket(ticket)}
                className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#0B1120]/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* 미읽음 뱃지 */}
                  {unread && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${unread ? 'text-white' : 'text-[#94A3B8]'}`}>
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {fmtDate(ticket.created_at)} · Updated {fmtDate(ticket.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[ticket.status] ?? 'text-[#94A3B8] bg-[#1E293B]'}`}>
                    {ticket.status}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-[#475569] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Accordion 본문 */}
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-[#1E293B]/50">
                  {loadingId === ticket.id ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 size={18} className="animate-spin text-[#475569]" />
                    </div>
                  ) : (
                    <>
                      {/* 메시지 스레드 */}
                      <div className="space-y-3 pt-4 mb-4">
                        {replies.length === 0 ? (
                          <p className="text-sm text-[#475569] text-center py-4">No messages yet.</p>
                        ) : (
                          replies.map((reply) => (
                            <div
                              key={reply.id}
                              className={`rounded-xl p-4 border ${
                                reply.is_admin
                                  ? 'border-amber-500/20 bg-amber-500/5 ml-6'
                                  : 'border-[#1E293B] bg-[#0B1120]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-semibold ${reply.is_admin ? 'text-amber-400' : 'text-[#38BDF8]'}`}>
                                  {reply.is_admin ? '🛡 Support Team' : 'You'}
                                </span>
                                <span className="text-xs text-[#475569]">{fmtDateTime(reply.created_at)}</span>
                              </div>
                              <p className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 액션 영역 */}
                      {ticket.status !== 'closed' && (
                        <div className="space-y-3">
                          {/* 답변 입력 */}
                          <div className="relative">
                            <textarea
                              rows={3}
                              value={replyTexts[ticket.id] ?? ''}
                              onChange={(e) => setReplyTexts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                              placeholder="Write a reply..."
                              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 resize-none transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => submitReply(ticket.id)}
                              disabled={submitting || !(replyTexts[ticket.id] ?? '').trim()}
                              className="absolute right-3 bottom-3 text-[#38BDF8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                          </div>

                          {/* 닫기 버튼 */}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => closeTicket(ticket.id)}
                              disabled={closing === ticket.id}
                              className="flex items-center gap-1.5 text-xs text-[#475569] hover:text-red-400 border border-[#1E293B] hover:border-red-400/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                            >
                              {closing === ticket.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <X size={11} />
                              }
                              Close ticket
                            </button>
                          </div>
                        </div>
                      )}

                      {ticket.status === 'closed' && (
                        <p className="text-xs text-[#475569] text-center py-2">
                          This ticket is closed. Contact support to reopen it.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
