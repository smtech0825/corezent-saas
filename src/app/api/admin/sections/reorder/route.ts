/**
 * @파일: api/admin/sections/reorder/route.ts
 * @설명: 섹션 순서 변경 API — upsert로 행 없으면 자동 생성, 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { isNonEmptyString } from '@/lib/validate'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'

interface SectionItem {
  name: string
  label: string
  is_visible: boolean
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const { sections } = (await request.json()) as { sections: SectionItem[] }

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 각 항목의 name이 유효한 문자열인지 검증 (빈 name upsert로 잘못된 행 생성 방지)
    if (!sections.every((s) => isNonEmptyString(s?.name))) {
      return NextResponse.json({ error: 'Invalid payload: each section requires a name' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 감사 기록용 전 순서 — 조회 실패해도 저장은 진행
    let beforeOrder: string[] = []
    try {
      const { data: beforeRows } = await adminClient
        .from('front_sections')
        .select('name')
        .order('order_index', { ascending: true })
      beforeOrder = (beforeRows ?? []).map((r) => r.name as string)
    } catch { /* 전값 없이 기록 */ }

    // upsert: 행이 없으면 INSERT, 있으면 UPDATE (label·is_visible 포함으로 NOT NULL 제약 충족)
    // ★ 한 번의 호출로 전부 보낸다. 예전처럼 섹션 수만큼 따로 보내면 중간에 하나가 실패했을 때
    //   앞의 것만 저장된 채 남아, 화면은 옛 순서인데 실제 사이트는 뒤섞인 상태가 된다.
    //   배열 upsert는 단일 문장으로 처리되므로 전부 저장되거나 전부 저장되지 않는다.
    const { error } = await adminClient.from('front_sections').upsert(
      sections.map((s, idx) => ({
        name: s.name,
        label: s.label || s.name,
        is_visible: s.is_visible,
        order_index: idx,
      })),
      { onConflict: 'name' },
    )

    if (error) {
      console.error('[sections/reorder] error:', error.message)
      return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
    }

    // 감사 기록 — 순서의 전/후(짧은 이름 목록이라 그대로 남김)
    await logAdminActivity({
      adminUserId: gate.userId,
      action: 'section.reorder',
      targetType: 'section',
      targetId: 'front_sections',
      detail: { from: beforeOrder, to: sections.map((s) => s.name) },
    })

    // 랜딩 페이지 캐시 즉시 무효화
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/reorder]', err)
    return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
  }
}
