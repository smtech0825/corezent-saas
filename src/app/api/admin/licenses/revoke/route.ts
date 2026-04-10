/**
 * @파일: api/admin/licenses/revoke/route.ts
 * @설명: 라이선스 강제 만료(Revoke) API
 *        - DB 상태를 'revoked'로 업데이트
 *        - Google Sheets E열을 '중지'로 업데이트
 *        - Lemon Squeezy 라이선스 키 비활성화 (선택적, 실패해도 차단하지 않음)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateLicenseStatus } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body?.id as string | undefined
    if (!id) return NextResponse.json({ error: 'Missing license id' }, { status: 400 })

    const adminClient = createAdminClient()

    // 라이선스 + 연결된 주문 조회
    const { data: license, error: fetchErr } = await adminClient
      .from('licenses')
      .select('id, serial_key, status, lemon_squeezy_license_key, order_id')
      .eq('id', id)
      .single()

    if (fetchErr || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }
    if (license.status !== 'active') {
      return NextResponse.json({ error: 'License is not active' }, { status: 400 })
    }

    // ① DB 상태 업데이트 → 'revoked'
    const { error: updateErr } = await adminClient
      .from('licenses')
      .update({ status: 'revoked' })
      .eq('id', id)

    if (updateErr) {
      console.error('[Revoke] DB update error:', updateErr)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    // ② Google Sheets E열 → '중지' (실패해도 계속 진행)
    try {
      await updateLicenseStatus({ serialKey: license.serial_key as string, status: '중지' })
    } catch (sheetsErr) {
      console.error('[Revoke] Sheets update failed:', sheetsErr)
    }

    // ③ Lemon Squeezy 라이선스 비활성화 (실패해도 계속 진행)
    const lsKey = license.lemon_squeezy_license_key as string | null
    if (lsKey) {
      try {
        await disableLSLicenseKey(lsKey)
      } catch (lsErr) {
        console.error('[Revoke] LS disable failed:', lsErr)
      }
    } else if (license.order_id) {
      // lemon_squeezy_license_key가 없는 경우 order_id로 LS 주문번호를 찾아 처리
      try {
        const { data: order } = await adminClient
          .from('orders')
          .select('lemon_squeezy_order_id')
          .eq('id', license.order_id)
          .single()

        if (order?.lemon_squeezy_order_id) {
          await disableLSLicenseByOrderId(order.lemon_squeezy_order_id as string)
        }
      } catch (lsErr) {
        console.error('[Revoke] LS order lookup failed:', lsErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Revoke API] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * @함수명: disableLSLicenseKey
 * @설명: LS 라이선스 키 문자열로 license-key ID를 찾아 disabled: true로 패치
 */
async function disableLSLicenseKey(licenseKey: string): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) return

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  }

  // 키 문자열로 LS license-key ID 검색
  const searchRes = await fetch(
    `https://api.lemonsqueezy.com/v1/license-keys?filter[key]=${encodeURIComponent(licenseKey)}`,
    { headers },
  )
  if (!searchRes.ok) return

  const searchData = await searchRes.json()
  const lsId = searchData?.data?.[0]?.id as string | undefined
  if (!lsId) return

  await patchLSLicenseDisabled(lsId, headers)
}

/**
 * @함수명: disableLSLicenseByOrderId
 * @설명: LS 주문 ID로 license-key를 찾아 disabled: true로 패치
 */
async function disableLSLicenseByOrderId(lsOrderId: string): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) return

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  }

  const searchRes = await fetch(
    `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${encodeURIComponent(lsOrderId)}`,
    { headers },
  )
  if (!searchRes.ok) return

  const searchData = await searchRes.json()
  const lsId = searchData?.data?.[0]?.id as string | undefined
  if (!lsId) return

  await patchLSLicenseDisabled(lsId, headers)
}

/**
 * @함수명: patchLSLicenseDisabled
 * @설명: LS license-key ID로 disabled: true PATCH 요청
 */
async function patchLSLicenseDisabled(
  lsId: string,
  headers: Record<string, string>,
): Promise<void> {
  await fetch(`https://api.lemonsqueezy.com/v1/license-keys/${lsId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      data: {
        type: 'license-keys',
        id: lsId,
        attributes: { disabled: true },
      },
    }),
  })
}
