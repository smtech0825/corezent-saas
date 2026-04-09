'use client'

/**
 * @컴포넌트: ContactForm
 * @설명: 비회원 문의 폼 — 제목, 이메일, 내용, 첨부파일(드래그&드롭)
 *        Honeypot 스팸 방지, 5MB 첨부 제한, Toast 알림
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Send, Upload, X, FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ContactForm() {
  const { showToast } = useToast()

  const [subject, setSubject] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 파일 선택 핸들러 (공통)
  function handleFile(f: File | null) {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      showToast('error', 'File size must be under 5 MB.')
      return
    }
    setFile(f)
  }

  // 드래그 & 드롭
  function onDragOver(e: DragEvent) {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    handleFile(f ?? null)
  }

  // 파일 인풋 변경
  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null)
  }

  // 제출
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return

    if (!subject.trim() || !email.trim() || !message.trim()) {
      showToast('error', 'Please fill in all required fields.')
      return
    }

    setSending(true)
    try {
      const body = new FormData()
      body.append('subject', subject.trim())
      body.append('email', email.trim())
      body.append('message', message.trim())
      // Honeypot 필드 — 값이 비어있어야 정상
      body.append('website', (e.currentTarget.elements.namedItem('website') as HTMLInputElement)?.value ?? '')
      if (file) body.append('attachment', file)

      const res = await fetch('/api/contact', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        showToast('error', data.error ?? 'Failed to send. Please try again.')
        return
      }

      showToast('success', "Thank you! We'll get back to you soon.")
      setSubject('')
      setEmail('')
      setMessage('')
      setFile(null)
    } catch {
      showToast('error', 'Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — 봇만 채움, 사용자에게는 숨김 */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-[#94A3B8] mb-1.5">
          Subject <span className="text-red-400">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          placeholder="What's this about?"
          className="w-full px-4 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-white text-sm placeholder-[#475569] focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8]/30 transition-colors"
        />
      </div>

      {/* 이메일 */}
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-[#94A3B8] mb-1.5">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-white text-sm placeholder-[#475569] focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8]/30 transition-colors"
        />
      </div>

      {/* 내용 */}
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-[#94A3B8] mb-1.5">
          Message <span className="text-red-400">*</span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          required
          rows={6}
          placeholder="Tell us what you need help with..."
          className="w-full px-4 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B] text-white text-sm placeholder-[#475569] focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8]/30 transition-colors resize-y min-h-[120px]"
        />
        <p className="text-right text-xs text-[#475569] mt-1">{message.length}/5,000</p>
      </div>

      {/* 첨부파일 — 드래그 & 드롭 */}
      <div>
        <label className="block text-sm font-medium text-[#94A3B8] mb-1.5">
          Attachment <span className="text-[#475569] font-normal">(optional, max 5 MB)</span>
        </label>

        {!file ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging
                ? 'border-[#38BDF8] bg-[#38BDF8]/5'
                : 'border-[#1E293B] hover:border-[#38BDF8]/40 bg-[#0B1120]'
            }`}
          >
            <Upload size={24} className="mx-auto text-[#475569] mb-2" />
            <p className="text-sm text-[#94A3B8]">
              Drag & drop a file here, or <span className="text-[#38BDF8] underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-[#475569] mt-1">Max 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0B1120] border border-[#1E293B]">
            <div className="w-9 h-9 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-[#38BDF8]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{file.name}</p>
              <p className="text-xs text-[#475569]">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-[#475569] hover:text-red-400 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 전송 버튼 */}
      <button
        type="submit"
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={16} />
            Send Message
          </>
        )}
      </button>
    </form>
  )
}
