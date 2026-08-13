/**
 * @파일: api/quote/route.ts
 * @설명: 기관 견적 요청 접수 API — quote_requests에 구조화 저장(문의와 별개 저장소).
 *        보안은 문의(/api/contact)와 같은 3중: BotID · IP 분당 제한(공유 카운터) · 미끼 칸.
 *        저장이 실패하면 실패라고 답한다(성공한 척 금지). 관리자 알림은 응답 뒤(after)에
 *        보내며, 실패해도 접수는 유지된다(admin-notify가 모든 오류를 삼킴 — 무수정 사용).
 *        ⚠️ 견적 요청은 주문이 아니다 — orders·licenses에 어떤 행도 만들지 않는다.
 *        ⚠️ 060_quote_requests.sql 적용 전에는 저장이 실패하며 손님에게 실패로 안내된다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { checkBotId } from 'botid/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited } from '@/lib/contact-rate-limit'
import { notifyAdmin } from '@/lib/admin-notify'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PC = 10

export async function POST(request: NextRequest) {
  try {
    // BotID — 봇 판정 시 즉시 차단(문의와 동일)
    const botCheck = await checkBotId()
    if (botCheck.isBot) {
      return NextResponse.json({ error: '접근이 거부되었습니다.' }, { status: 403 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const admin = createAdminClient()
    if (await isRateLimited(admin, ip)) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    const s = (k: string, max = 200) => String(body[k] ?? '').trim().slice(0, max)

    // 미끼 칸 — 봇이 채우면 조용히 성공으로 응답(저장·알림 없음, 문의와 동일)
    if (s('website')) return NextResponse.json({ ok: true })

    const orgName = s('org')
    const email = s('email')
    if (!orgName || !email) {
      return NextResponse.json({ error: '기관명과 이메일은 필수입니다.', code: 'REQUIRED' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.', code: 'EMAIL' }, { status: 400 })
    }

    // PC 수 — 최소 10대. 미만이면 개인 구매 안내(폼에서도 같은 안내를 하지만 서버가 최종 방어)
    const pcCount = Math.trunc(Number(s('seats')))
    if (!Number.isInteger(pcCount) || pcCount < MIN_PC) {
      return NextResponse.json({
        error: `기관 견적은 ${MIN_PC}대부터 가능합니다. ${MIN_PC}대 미만은 요금 페이지에서 개인 구매를 이용해 주세요.`,
        code: 'MIN_PC',
      }, { status: 400 })
    }
    if (pcCount > 100000) {
      return NextResponse.json({ error: 'PC 수를 확인해 주세요.', code: 'MAX_PC' }, { status: 400 })
    }

    // 사업자등록번호 — 선택 입력. 형식만 가볍게(숫자 10자리, 하이픈 허용). 엄격하게 막지 않는다.
    const bizRaw = s('bizno', 20)
    const bizDigits = bizRaw.replace(/-/g, '')
    if (bizRaw && !/^\d{10}$/.test(bizDigits)) {
      return NextResponse.json({ error: '사업자등록번호는 숫자 10자리로 입력해 주세요. (예: 000-00-00000)', code: 'BIZNO' }, { status: 400 })
    }

    // 저장 — 실패하면 실패라고 답한다(접수된 척 금지). 주문·라이선스는 절대 만들지 않는다.
    const { data: inserted, error: dbError } = await admin
      .from('quote_requests')
      .insert({
        org_name:     orgName,
        biz_reg_no:   bizRaw || null,
        department:   s('dept') || null,
        contact_name: s('person') || null,
        phone:        s('phone', 40) || null,
        email,
        pc_count:     pcCount,
        needed_by:    s('needed') || null,
        payment_pref: s('payment') || null,
        note:         s('note', 5000) || null,
        ip_address:   ip,
      })
      .select('id')
      .single()

    if (dbError || !inserted) {
      console.error('[Quote API] insert error:', dbError)
      return NextResponse.json(
        { error: '접수 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.', code: 'DB_ERROR' },
        { status: 500 },
      )
    }
    const requestId = (inserted as { id: string }).id
    const shortId = requestId.slice(0, 8).toUpperCase()

    // 관리자 알림 — 응답 뒤 실행(after). 개인정보는 최소한만: 기관명(제목)·요청 번호·PC 수.
    // admin-notify는 공용 부품이라 무수정 사용 — 전용 종류가 없어 스위치는 '새 티켓'을 함께 탄다(보고됨).
    after(() =>
      notifyAdmin({
        kind: 'new_ticket',
        subject: `[CoreZent] 새 기관 견적 요청 #${shortId} — ${orgName}`,
        html: `<!DOCTYPE html><html lang="ko"><body style="font-family:Arial,sans-serif;color:#23272E;">
  <h2 style="margin:0 0 16px;font-size:18px;">새 기관 견적 요청</h2>
  <p style="font-size:14px;">요청 번호 <strong>#${shortId}</strong> · 도입 PC ${pcCount}대</p>
  <p style="margin:16px 0 0;font-size:13px;color:#565C66;">관리자 → 견적 요청에서 전체 내용을 확인하고 견적서를 발급할 수 있습니다.</p>
</body></html>`,
        target: `quote:${requestId}`,
        dedupeMinutes: 30,
      }),
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Quote API]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' }, { status: 500 })
  }
}
