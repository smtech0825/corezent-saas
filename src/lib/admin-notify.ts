/**
 * @파일: lib/admin-notify.ts
 * @설명: 관리자 알림 메일의 단일 창구 — 새 주문·새 티켓 등 운영 사건을 대표님께 알린다.
 *        웹훅 실패 알림(webhooks/lemonsqueezy notifyWebhookFailure)과 같은 정책을 따른다:
 *        ① 받는 주소는 front_settings.support_email에서만 읽는다(코드에 박지 않는다)
 *        ② 주소가 비어 있으면 건너뛰되 notification_logs에 그 사실을 남긴다(조용히 사라지지 않게)
 *        ③ 어떤 실패도 밖으로 던지지 않는다 — 알림 때문에 주문·문의 접수가 실패하면 안 된다
 *        ④ 발송 성공·실패 자체는 sendEmail이 notification_logs(kind=email, event=제목)에 기록한다
 *        본문 템플릿도 이 파일에 모은다(관리자 본인만 받는 운영용 메일 — 편집 대상 아님).
 *        ⚠️ 라이선스 키·비밀값·개인정보 전문을 본문에 넣지 않는다.
 *        서버 전용(createAdminClient 사용) — 클라이언트에서 import 금지.
 */

import { createAdminClient } from './supabase/admin'
import { sendEmail } from './email'
import { logNotification } from './notification-log'

/** 알림 종류 — 켬/끔 스위치(front_settings notify_*)와 기록의 분류 키 */
export type AdminNotifyKind = 'new_order' | 'new_ticket'

/** 스위치 설정 키 — 값이 'false'일 때만 끔(없거나 다른 값이면 켜짐 = 기본 켜짐) */
const NOTIFY_SETTING_KEY: Record<AdminNotifyKind, string> = {
  new_order:  'notify_new_order',
  new_ticket: 'notify_new_ticket',
}

/** HTML 이스케이프 — 손님 입력(이름·제목 등)을 본문에 넣기 전 반드시 통과.
 *  외부 페이로드는 타입 선언과 달리 문자열이 아닐 수 있어 String()으로 먼저 정규화한다
 *  (여기서 예외가 새면 "알림이 본 처리를 막지 않는다" 보장이 깨진다). */
function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 본문 표 한 줄 */
function row(label: string, value: string, strong = false): string {
  const v = strong ? `<strong>${value}</strong>` : value
  return `<tr><td style="color:#565C66;">${label}</td><td>${v}</td></tr>`
}

/**
 * @함수명: adminAlertHtml
 * @설명: 관리자 알림 공용 골격 — 웹훅 실패 알림과 같은 표 형태.
 * @매개변수: title - 머리글 / rows - [라벨, 값, 강조?] 목록(값은 호출부에서 escapeHtml 완료) / footer - 하단 안내
 */
function adminAlertHtml(title: string, rows: [string, string, boolean?][], footer: string): string {
  return `<!DOCTYPE html><html lang="ko"><body style="font-family:Arial,sans-serif;color:#23272E;">
  <h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(title)}</h2>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px;">
    ${rows.map(([l, v, s]) => row(escapeHtml(l), v, s)).join('\n    ')}
  </table>
  <p style="margin:16px 0 0;font-size:13px;color:#565C66;">${footer}</p>
</body></html>`
}

/**
 * @함수명: notifyAdmin
 * @설명: 관리자 알림 메일 한 통을 보낸다. 실패해도 절대 throw하지 않는다.
 *        여러 사건을 한 통으로 묶지 않는다 — 주문은 하나하나가 돈이라 건별 발송이 원칙이고,
 *        문의는 상류(rate limit·허니팟·BotID)가, 웹훅 실패는 자체 30분 창이 이미 막는다.
 *        dedupeMinutes는 "같은 제목"의 재발송만 억제한다(웹훅 실패 알림과 같은 방식) —
 *        제목에 주문·티켓 번호가 들어가므로 서로 다른 사건은 절대 억제되지 않고,
 *        같은 사건의 중복 전달(웹훅 동시 재전송 등)만 걸러진다.
 * @매개변수: kind - 알림 종류(스위치 키) / subject - 메일 제목 / html - 본문 / target - 기록용 식별자(예: order:xxxx)
 *           dedupeMinutes - 같은 제목 재발송 억제 창(분). 0·미지정이면 억제 없음
 * @반환값: 없음(항상 정상 종료)
 */
export async function notifyAdmin(input: {
  kind: AdminNotifyKind
  subject: string
  html: string
  target: string
  dedupeMinutes?: number
}): Promise<void> {
  try {
    const admin = createAdminClient()

    // 켬/끔 스위치 + 받는 주소를 한 번에 조회 (기본값: 켜짐)
    const settingKey = NOTIFY_SETTING_KEY[input.kind]
    const { data: rows } = await admin
      .from('front_settings')
      .select('key, value')
      .in('key', ['support_email', settingKey])
    const map = new Map((rows ?? []).map((r) => [r.key, r.value ?? '']))

    // 스위치: 명시적으로 'false'일 때만 끔. 행이 없으면(설정한 적 없음) 켜짐.
    if ((map.get(settingKey) ?? '').trim() === 'false') {
      return
    }

    // 받는 주소가 비어 있으면 건너뛰되 기록에 남긴다 — 조용히 사라지면 안 된다.
    const to = (map.get('support_email') ?? '').trim()
    if (!to) {
      console.warn(`[admin-notify] 알림 건너뜀 — front_settings.support_email 미설정 (${input.target})`)
      await logNotification({
        kind:   'email',
        status: 'failure',
        event:  '관리자 알림 미발송',
        target: input.target,
        error:  '수신 주소 없음 — 관리자 설정의 지원 이메일(support_email)이 비어 있습니다.',
      })
      return
    }

    // 같은 제목 재발송 억제(웹훅 실패 알림과 같은 방식) — sendEmail이 성공·실패 모두
    // notification_logs(kind=email, event=제목)에 남기므로 그 기록으로 판단한다.
    if (input.dedupeMinutes && input.dedupeMinutes > 0) {
      const since = new Date(Date.now() - input.dedupeMinutes * 60_000).toISOString()
      const { data: recent } = await admin
        .from('notification_logs')
        .select('id')
        .eq('kind', 'email')
        .eq('event', input.subject)
        .gte('created_at', since)
        .limit(1)
      if (recent && recent.length > 0) {
        console.log(`[admin-notify] 같은 제목 재발송 생략(${input.dedupeMinutes}분 창): ${input.target}`)
        return
      }
    }

    // 발송 — 성공·실패는 sendEmail이 notification_logs에 기록한다.
    await sendEmail({ to, subject: input.subject, html: input.html })
  } catch (err) {
    // 알림 실패는 삼킨다 — 주문·문의 접수 등 본 흐름에 영향을 주지 않는다.
    console.error(`[admin-notify] 알림 발송 중 오류(무시, ${input.target}):`, err instanceof Error ? err.message : String(err))
  }
}

/**
 * @함수명: notifyNewOrder
 * @설명: 새 주문 알림 — 카드·계좌이체 공통. 주문 하나당 한 통(묶지 않는다).
 *        계좌이체는 "대표님이 직접 라이선스를 발급해야 한다"가 제목·본문에서 드러난다.
 *        ⚠️ 라이선스 키·카드 정보는 넣지 않는다. 금액은 주문에 저장된 값 그대로(재계산 없음).
 * @매개변수: orderId - 내부 주문 id / productName - 상품명 / quantity - 수량
 *           amountLabel - 표시용 금액 문자열(호출부가 저장된 값으로 조립) / buyerEmail - 구매자 이메일
 *           method - 'card' | 'bank_transfer' / status - 주문 상태 / extra - 추가 줄(입금 기한 등)
 */
export async function notifyNewOrder(input: {
  orderId: string
  productName: string
  quantity: number
  amountLabel: string
  buyerEmail: string
  method: 'card' | 'bank_transfer'
  status: string
  extra?: [string, string][]
}): Promise<void> {
  // 함수 전체를 try로 감싼다 — 인자 조립 단계(외부 페이로드가 선언과 다른 타입일 때 등)의
  // 예외도 밖으로 새면 안 된다. 이 함수는 어떤 경우에도 reject하지 않는다.
  try {
    const shortId = String(input.orderId ?? '').slice(0, 8).toUpperCase()
    const isBank = input.method === 'bank_transfer'
    const subject = isBank
      ? `[CoreZent] 새 계좌이체 주문 #${shortId} — 입금 확인·라이선스 수동 발급 필요`
      : `[CoreZent] 새 주문 #${shortId} (카드)`

    const rows: [string, string, boolean?][] = [
      ['주문 번호', escapeHtml(input.orderId)],
      ['접수 시각', new Date().toISOString()],
      ['구매자', escapeHtml(input.buyerEmail)],
      ['상품', escapeHtml(input.productName), true],
      ['수량', escapeHtml(input.quantity)],
      ['금액', escapeHtml(input.amountLabel), true],
      ['결제 방법', isBank ? '계좌이체(무통장 입금)' : '신용카드'],
      ['지금 상태', escapeHtml(input.status)],
      ...(input.extra ?? []).map(([l, v]): [string, string, boolean?] => [l, escapeHtml(v)]),
    ]

    const footer = isBank
      ? '<strong>입금 확인 후 라이선스는 수동 발급이 필요합니다.</strong> 관리자 → 주문에서 [결제 확인]을 눌러 주세요.'
      : '관리자 → 주문에서 상세를 확인할 수 있습니다. 라이선스는 자동 발급됩니다.'

    await notifyAdmin({
      kind: 'new_order',
      subject,
      html: adminAlertHtml(isBank ? '새 계좌이체 주문 (입금 대기)' : '새 주문 접수', rows, footer),
      target: `order:${input.orderId}`,
      // 같은 주문의 중복 전달만 억제(제목에 주문 번호 포함) — 다른 주문은 각각 발송된다.
      dedupeMinutes: 30,
    })
  } catch (err) {
    console.error('[admin-notify] 새 주문 알림 조립 중 오류(무시):', err instanceof Error ? err.message : String(err))
  }
}

/**
 * @함수명: notifyNewTicket
 * @설명: 새 고객지원 티켓 알림. 개인정보는 최소한만 — 계정 이메일·제목·내용 앞부분(80자)만 넣는다.
 *        제목은 티켓 번호가 아니라 "계정" 기준이다 — 같은 계정이 30분 안에 반복 제출하면
 *        첫 통만 발송돼(같은 제목 억제) 로그인 사용자발 메일 폭주를 막는다. 티켓 제출에는
 *        상류 방어(rate limit)가 없어서 이 억제가 유일한 방어선이다. 티켓 번호는 본문에 있고,
 *        억제된 건도 관리자 → 고객지원 목록에는 전부 남는다. 다른 계정은 각각 발송된다.
 * @매개변수: ticketId - 티켓 id / userEmail - 계정 이메일 / subject - 제목 / priority - 우선순위 / preview - 내용 앞부분
 */
export async function notifyNewTicket(input: {
  ticketId: string
  userEmail: string
  subject: string
  priority: string
  preview: string
}): Promise<void> {
  // 함수 전체를 try로 감싼다 — 조립 단계 예외도 접수 흐름으로 새면 안 된다.
  try {
    const previewRaw = String(input.preview ?? '')
    const preview = previewRaw.length > 80 ? `${previewRaw.slice(0, 80)}…` : previewRaw

    await notifyAdmin({
      kind: 'new_ticket',
      subject: `[CoreZent] 새 고객지원 티켓 — ${String(input.userEmail ?? '')}`,
      html: adminAlertHtml(
        '새 고객지원 티켓',
        [
          ['티켓 번호', escapeHtml(input.ticketId)],
          ['접수 시각', new Date().toISOString()],
          ['계정', escapeHtml(input.userEmail)],
          ['제목', escapeHtml(input.subject), true],
          ['우선순위', escapeHtml(input.priority)],
          ['내용 앞부분', escapeHtml(preview)],
        ],
        '관리자 → 고객지원에서 전체 내용을 확인하고 답변할 수 있습니다.',
      ),
      target: `ticket:${input.ticketId}`,
      // 같은 계정의 반복 제출만 억제(제목=계정 기준) — 폭주 방어 겸 중복 전달 차단.
      dedupeMinutes: 30,
    })
  } catch (err) {
    console.error('[admin-notify] 새 티켓 알림 조립 중 오류(무시):', err instanceof Error ? err.message : String(err))
  }
}
