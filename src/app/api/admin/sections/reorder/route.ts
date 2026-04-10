/**
 * @파일: api/admin/sections/reorder/route.ts
 * @설명: 섹션 순서 변경 API — upsert로 행 없으면 자동 생성, 캐시 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

interface SectionItem {
  name: string
  label: string
  is_visible: boolean
}

export async function POST(request: Request) {
  try {
    const { sections } = (await request.json()) as { sections: SectionItem[] }

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // upsert: 행이 없으면 INSERT, 있으면 UPDATE (label·is_visible 포함으로 NOT NULL 제약 충족)
    const results = await Promise.all(
      sections.map((s, idx) =>
        adminClient
          .from('front_sections')
          .upsert(
            {
              name: s.name,
              label: s.label || s.name,
              is_visible: s.is_visible,
              order_index: idx,
            },
            { onConflict: 'name' },
          ),
      ),
    )

    const failed = results.filter(({ error }) => error)
    if (failed.length > 0) {
      console.error('[sections/reorder] errors:', failed.map((f) => f.error))
      throw new Error('Some order updates failed')
    }

    // 랜딩 페이지 캐시 즉시 무효화
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[sections/reorder]', err)
    return NextResponse.json({ error: 'Failed to reorder sections' }, { status: 500 })
  }
}
