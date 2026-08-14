/**
 * @파일: api/admin/sections/toggle/route.ts
 * @설명: 섹션 가시성 토글 API — upsert로 행 없으면 자동 생성, 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { isNonEmptyString } from '@/lib/validate'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const { name, is_visible, label, order_index } = (await request.json()) as {
      name: string
      is_visible: boolean
      label: string
      order_index: number
    }

    if (!isNonEmptyString(name) || typeof is_visible !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 감사 기록용 전값(없으면 신규 행) — 조회 실패해도 저장은 진행
    let beforeVisible: boolean | null = null
    try {
      const { data: before } = await adminClient
        .from('front_sections')
        .select('is_visible')
        .eq('name', name)
        .maybeSingle()
      beforeVisible = (before?.is_visible as boolean | undefined) ?? null
    } catch { /* 전값 없이 기록 */ }

    // upsert: 행이 없으면 INSERT, 있으면 UPDATE (label·order_index 포함으로 NOT NULL 제약 충족)
    const { error } = await adminClient
      .from('front_sections')
      .upsert(
        { name, is_visible, label: label || name, order_index: order_index ?? 0 },
        { onConflict: 'name' },
      )

    if (error) throw error

    // 감사 기록 — 섹션 보임/숨김의 전/후(실패해도 본 처리는 이미 성공)
    await logAdminActivity({
      adminUserId: gate.userId,
      action: 'section.toggle',
      targetType: 'section',
      targetId: name,
      detail: { from: beforeVisible, to: is_visible },
    })

    // 랜딩 페이지 캐시 즉시 무효화
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/toggle]', err)
    return NextResponse.json({ error: 'Failed to toggle section' }, { status: 500 })
  }
}
