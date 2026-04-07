/**
 * @파일: dashboard/support/page.tsx
 * @설명: 사용자 대시보드 지원 티켓 제출 및 조회 페이지
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const statusColors: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10',
  answered: 'text-blue-400 bg-blue-400/10',
  closed: 'text-[#475569] bg-[#1E293B]',
}

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/dashboard/support')

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status, priority, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const list = tickets ?? []

  async function submitTicket(formData: FormData) {
    'use server'
    const supabaseServer = await createClient()
    const { data: { user: currentUser } } = await supabaseServer.auth.getUser()
    if (!currentUser) return

    const subject = (formData.get('subject') as string)?.trim()
    const message = (formData.get('message') as string)?.trim()
    const priority = (formData.get('priority') as string) || 'normal'

    if (!subject || !message) return

    const { data: ticket } = await supabaseServer
      .from('support_tickets')
      .insert({ user_id: currentUser.id, subject, status: 'open', priority, is_read: false })
      .select('id')
      .single()

    if (ticket) {
      await supabaseServer
        .from('support_replies')
        .insert({ ticket_id: ticket.id, user_id: currentUser.id, is_admin: false, message })
    }

    revalidatePath('/dashboard/support')
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Submit a support request and we&apos;ll get back to you as soon as possible.
        </p>
      </div>

      {/* 티켓 제출 폼 */}
      <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold text-white">New Support Ticket</h2>
        </div>
        <form action={submitTicket} className="px-6 py-6 space-y-4">
          {/* 제목 */}
          <div className="space-y-1.5">
            <label htmlFor="subject" className="text-xs font-medium text-[#94A3B8]">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              placeholder="Briefly describe your issue"
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 transition-colors"
            />
          </div>

          {/* 우선순위 */}
          <div className="space-y-1.5">
            <label htmlFor="priority" className="text-xs font-medium text-[#94A3B8]">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="normal"
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 transition-colors"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 메시지 */}
          <div className="space-y-1.5">
            <label htmlFor="message" className="text-xs font-medium text-[#94A3B8]">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              placeholder="Describe your issue in detail..."
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      </div>

      {/* 기존 티켓 목록 */}
      {list.length > 0 && (
        <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1E293B]">
            <h2 className="text-sm font-semibold text-white">Your Tickets</h2>
          </div>
          <div className="divide-y divide-[#1E293B]/50">
            {list.map((t) => (
              <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  <p className="text-xs text-[#475569] mt-0.5">
                    {fmtDate(t.created_at)} · Updated {fmtDate(t.updated_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                    statusColors[t.status] ?? 'text-[#94A3B8] bg-[#1E293B]'
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
