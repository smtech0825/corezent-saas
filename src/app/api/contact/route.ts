/**
 * @파일: api/contact/route.ts
 * @설명: 비회원 문의 API — 이메일 발송 + DB 저장
 *        보안: Rate limiting (IP 기반), Honeypot, 이메일 형식 검증, 5MB 첨부 제한
 *        DB 저장 성공 시 이메일 실패해도 성공 반환 (이메일은 백그라운드 시도)
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, inquiryEmailHtml } from '@/lib/email'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const RATE_LIMIT_WINDOW_MS = 60_000    // 1분 고정 윈도우
const RATE_LIMIT_MAX = 3               // 1분에 최대 3회

/**
 * @함수명: isRateLimited
 * @설명: Supabase 테이블(contact_rate_limit) 기반 rate limit 확인. 인메모리 Map과 달리
 *        Vercel 서버리스 인스턴스가 여러 개 떠도 공유되는 카운터를 쓴다. 원자적 RPC
 *        (check_contact_rate_limit)로 확인+증가를 한 번에 처리해 동시 요청 경합에도 안전하다.
 *        RPC 자체가 실패하면(마이그레이션 미적용 등) 정상 사용자를 막지 않도록 통과시킨다(fail-open).
 * @매개변수: admin - service role Supabase 클라이언트 / ip - 요청자 IP
 * @반환값: 이번 요청이 분당 한도를 초과했으면 true
 */
async function isRateLimited(
  admin: ReturnType<typeof createAdminClient>,
  ip: string,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS).toISOString()

  const { data, error } = await admin.rpc('check_contact_rate_limit', {
    p_ip: ip,
    p_window_start: windowStart,
    p_max: RATE_LIMIT_MAX,
  })

  if (error) {
    console.error('[Contact API] rate limit RPC error:', error)
    return false // fail-open — 체크 자체가 깨져도 정상 문의는 막지 않음
  }

  return Boolean((data as { limited?: boolean } | null)?.limited)
}

// ─── 이메일 형식 검증 ──────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  // BotID 검증 — 봇으로 판별되면 즉시 차단
  const botCheck = await checkBotId()
  if (botCheck.isBot) {
    return NextResponse.json({ error: '접근이 거부되었습니다.' }, { status: 403 })
  }

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const admin = createAdminClient()
  if (await isRateLimited(admin, ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    )
  }

  // FormData 파싱
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  // Honeypot 체크 — 봇이 채운 경우 조용히 성공 반환
  const honeypot = formData.get('website') as string | null
  if (honeypot) {
    return NextResponse.json({ success: true })
  }

  // 필드 추출 & 검증
  const email   = (formData.get('email')   as string | null)?.trim() ?? ''
  const subject = (formData.get('subject') as string | null)?.trim() ?? ''
  const message = (formData.get('message') as string | null)?.trim() ?? ''
  const file    = formData.get('attachment') as File | null

  if (!email || !subject || !message) {
    return NextResponse.json(
      { error: '모든 필수 항목을 입력해 주세요.' },
      { status: 400 }
    )
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  if (subject.length > 200) {
    return NextResponse.json(
      { error: '제목은 200자 이내로 입력해 주세요.' },
      { status: 400 }
    )
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: '내용은 5,000자 이내로 입력해 주세요.' },
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
        { error: '첨부 파일은 5MB 이하만 업로드할 수 있습니다.' },
        { status: 400 }
      )
    }
    try {
      attachmentBuffer = Buffer.from(await file.arrayBuffer())
      attachmentName = file.name
      attachmentSize = file.size
    } catch {
      return NextResponse.json({ error: '첨부 파일 처리에 실패했습니다.' }, { status: 400 })
    }
  }

  // ─── DB 저장 ───────────────────────────────────────────────────
  // 저장이 실패하면 문의가 어디에도 남지 않는다. 그때는 성공이라고 답하지 않는다
  // — "접수되었습니다"를 보고 안심했는데 실제로는 사라지는 것이 가장 나쁜 결과다.
  try {
    const { error: dbError } = await admin.from('inquiries').insert({
      email,
      subject,
      message,
      attachment_name: attachmentName ?? null,
      attachment_size: attachmentSize ?? null,
      ip_address: ip,
    })

    if (dbError) {
      console.error('[Contact API] DB insert error:', dbError)
      return NextResponse.json(
        { error: '문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 500 },
      )
    }
  } catch (err) {
    console.error('[Contact API] DB exception:', err)
    return NextResponse.json(
      { error: '문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }

  // ─── 알림 메일 발송 ───────────────────────────────────────────
  // 이 지점에서는 문의가 이미 DB에 저장돼 있다. 메일이 실패해도 문의는 남고 관리자
  // 화면에서 볼 수 있으므로 성공으로 응답한다. 여기서 실패로 답하면 손님이 다시 보내
  // 같은 문의가 중복으로 쌓인다.
  try {
    // 수신 주소는 설정에서만 읽는다(웹훅 실패 알림과 같은 정책 — 코드에 주소를 박지 않는다).
    // 비어 있으면 메일만 건너뛴다. 문의 자체는 이미 저장됐으므로 접수가 끊기지는 않는다.
    let adminEmail = ''
    try {
      const { data: setting } = await createAdminClient()
        .from('front_settings')
        .select('value')
        .eq('key', 'support_email')
        .maybeSingle()
      adminEmail = (setting?.value ?? '').trim()
    } catch (settingErr) {
      console.warn('[Contact API] support_email 조회 실패 — 알림 메일 건너뜀:', settingErr)
    }

    if (!adminEmail) {
      console.warn('[Contact API] 알림 메일 건너뜀 — front_settings.support_email 미설정 (문의는 저장됨)')
      return NextResponse.json({ success: true })
    }

    await sendEmail({
      to: adminEmail,
      subject: `[CoreZent Inquiry] ${subject}`,
      html: inquiryEmailHtml({ email, subject, message, attachmentName }),
      replyTo: email,
      attachments: attachmentBuffer && attachmentName
        ? [{ filename: attachmentName, content: attachmentBuffer }]
        : undefined,
    })
  } catch (err) {
    console.error('[Contact API] Email send error:', err)
    // 이메일 실패는 로그만 남기고 사용자에게는 성공 반환
    // (DB에 저장됐으므로 나중에 관리자가 확인 가능)
  }

  return NextResponse.json({ success: true })
}
