/**
 * @파일: lib/email.ts
 * @설명: SMTP 이메일 발송 유틸 — front_settings에서 SMTP 설정 로드 후 발송
 */

import nodemailer from 'nodemailer'
import { createAdminClient } from './supabase/admin'

// SMTP 설정을 DB에서 로드
async function getSmtpConfig(): Promise<Map<string, string>> {
  const client = createAdminClient()
  const { data } = await client
    .from('front_settings')
    .select('key, value')
    .in('key', [
      'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
      'smtp_encryption', 'smtp_from_email', 'smtp_from_name', 'site_name',
    ])
  return new Map((data ?? []).map((r) => [r.key, r.value ?? '']))
}

// 이메일 발송 (첨부파일·답장 주소 옵션 지원)
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  attachments,
}: {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer }[]
}): Promise<void> {
  const config = await getSmtpConfig()

  const host = config.get('smtp_host')
  if (!host) throw new Error('SMTP host가 설정되지 않았습니다.')

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(config.get('smtp_port') ?? '587'),
    secure: config.get('smtp_encryption') === 'ssl',
    auth: {
      user: config.get('smtp_username'),
      pass: config.get('smtp_password'),
    },
  })

  const fromName = config.get('smtp_from_name') ?? 'CoreZent'
  const fromEmail = config.get('smtp_from_email') ?? 'no-reply@corezent.com'

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments?.length ? { attachments } : {}),
  })
}

// 웰컴 이메일 HTML 템플릿
export function welcomeEmailHtml(siteName = 'CoreZent'): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${siteName}</title>
</head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111A2E;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${siteName}</p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;">Welcome aboard!</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#94A3B8;">
                Your account has been verified successfully. You now have full access to ${siteName} — powerful software, crafted with care.
              </p>
              <a href="https://corezent.com/dashboard"
                 style="display:inline-block;background:#F59E0B;color:#0B1120;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
                Go to Dashboard →
              </a>
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1E293B;">
              <p style="margin:0;font-size:12px;color:#475569;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.<br/>
                <a href="https://corezent.com" style="color:#475569;">corezent.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// 주문 확인 / 라이선스 키 발송 이메일 HTML 템플릿
export function orderConfirmationEmailHtml({
  userName,
  productName,
  serialKey,
  siteName = 'CoreZent',
}: {
  userName: string
  productName: string
  serialKey: string
  siteName?: string
}): string {
  const safeUser = userName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeProduct = productName.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your ${siteName} License Key</title>
</head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111A2E;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${siteName}</p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Your license is ready!</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#94A3B8;">
                Hi ${safeUser}, thank you for purchasing <strong style="color:#F1F5F9;">${safeProduct}</strong>.
                Here is your license key:
              </p>
              <!-- 시리얼 키 박스 -->
              <div style="background:#0B1120;border:1px solid #1E293B;border-radius:10px;padding:20px 24px;margin-bottom:28px;text-align:center;">
                <p style="margin:0 0 6px;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">License Key</p>
                <p style="margin:0;font-size:22px;font-weight:700;color:#F59E0B;letter-spacing:0.15em;font-family:'Courier New',monospace;">${serialKey}</p>
              </div>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#475569;">
                Keep this key safe. You can also find it anytime in your dashboard under <strong>Licenses</strong>.
              </p>
              <a href="https://corezent.com/dashboard/licenses"
                 style="display:inline-block;background:#F59E0B;color:#0B1120;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
                View in Dashboard →
              </a>
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1E293B;">
              <p style="margin:0;font-size:12px;color:#475569;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.<br/>
                <a href="https://corezent.com" style="color:#475569;">corezent.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// 지원 답변 알림 이메일 HTML 템플릿
export function supportReplyEmailHtml(
  ticketSubject: string,
  replyMessage: string,
  siteName = 'CoreZent'
): string {
  // XSS 방지: 줄바꿈 → <br>
  const safeMessage = replyMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New reply from ${siteName} Support</title>
</head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111A2E;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${siteName} Support</p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">New reply to your ticket</h1>
              <p style="margin:0 0 24px;font-size:13px;color:#475569;">Re: ${ticketSubject}</p>
              <div style="background:#0B1120;border:1px solid #1E293B;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0;font-size:14px;line-height:1.7;color:#94A3B8;">${safeMessage}</p>
              </div>
              <a href="https://corezent.com/dashboard"
                 style="display:inline-block;background:#F59E0B;color:#0B1120;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
                View in Dashboard →
              </a>
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1E293B;">
              <p style="margin:0;font-size:12px;color:#475569;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.<br/>
                <a href="https://corezent.com" style="color:#475569;">corezent.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// 비회원 문의 알림 이메일 HTML 템플릿
export function inquiryEmailHtml({
  email,
  subject,
  message,
  attachmentName,
  siteName = 'CoreZent',
}: {
  email: string
  subject: string
  message: string
  attachmentName?: string
  siteName?: string
}): string {
  const safeEmail   = email.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeSubject = subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>[CoreZent Inquiry] ${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111A2E;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${siteName} Inquiry</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">${safeSubject}</h1>
              <p style="margin:0 0 24px;font-size:13px;color:#38BDF8;">From: ${safeEmail}</p>
              <div style="background:#0B1120;border:1px solid #1E293B;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0;font-size:14px;line-height:1.7;color:#94A3B8;">${safeMessage}</p>
              </div>
              ${attachmentName ? `<p style="margin:0;font-size:12px;color:#475569;">📎 Attachment: ${attachmentName}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1E293B;">
              <p style="margin:0;font-size:12px;color:#475569;">
                © ${new Date().getFullYear()} ${siteName}. All rights reserved.<br/>
                <a href="https://corezent.com" style="color:#475569;">corezent.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
