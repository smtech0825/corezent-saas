/**
 * @파일: api/contact/route.ts
 * @설명: 비회원 문의 API — 이메일 발송 + DB 저장
 *        보안: Rate limiting (IP 기반), Honeypot, 이메일 형식 검증, 5MB 첨부 제한
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, inquiryEmailHtml } from '@/lib/email'

const ADMIN_EMAIL = 'smtech.semi@gmail.com'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const RATE_LIMIT_WINDOW = 60_000       // 1분
const RATE_LIMIT_MAX = 3               // 1분에 최대 3회

// ─── 인메모리 Rate Limiter ─────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

// 오래된 엔트리 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 60_000)

// ─── 이메일 형식 검증 ──────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const formData = await request.formData()

    // Honeypot 체크 — 봇이 채운 경우 조용히 성공 반환
    const honeypot = formData.get('website') as string | null
    if (honeypot) {
      return NextResponse.json({ success: true })
    }

    // 필드 추출 & 검증
    const email   = (formData.get('email')   as string)?.trim()
    const subject = (formData.get('subject') as string)?.trim()
    const message = (formData.get('message') as string)?.trim()
    const file    = formData.get('attachment') as File | null

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields (email, subject, message) are required.' },
        { status: 400 }
      )
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      )
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be 200 characters or less.' },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5,000 characters or less.' },
        { status: 400 }
      )
    }

    // 첨부파일 검증
    let attachmentBuffer: Buffer | undefined
    let attachmentName: string | undefined
    let attachmentSize: number | undefined

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Attachment must be under 5 MB.' },
          { status: 400 }
        )
      }
      attachmentBuffer = Buffer.from(await file.arrayBuffer())
      attachmentName = file.name
      attachmentSize = file.size
    }

    // DB 저장 (admin client — RLS 우회)
    const admin = createAdminClient()
    await admin.from('inquiries').insert({
      email,
      subject,
      message,
      attachment_name: attachmentName ?? null,
      attachment_size: attachmentSize ?? null,
      ip_address: ip,
    })

    // 이메일 발송
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[CoreZent Inquiry] ${subject}`,
      html: inquiryEmailHtml({ email, subject, message, attachmentName }),
      replyTo: email,
      attachments: attachmentBuffer && attachmentName
        ? [{ filename: attachmentName, content: attachmentBuffer }]
        : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Contact API Error]', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
