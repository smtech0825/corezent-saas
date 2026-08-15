/**
 * @파일: api/admin/settings/route.ts
 * @설명: 사이트 설정 저장 API — front_settings 테이블 upsert 후 경로 재검증
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/require-admin'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminActivity, diffKeyChanges, buildChangeDetail } from '@/lib/adminActivityLog'

/** 값을 기록에 남기면 안 되는 설정 키(비밀값·민감값) — 바뀌었다는 사실만 남긴다.
 *  account=계좌번호·예금주, username=SMTP 계정, api_key=향후 추가될 키 대비.
 *  (사업자번호·대표 전화 등 사이트 하단에 이미 공개되는 값은 전/후를 남긴다) */
const SECRET_SETTING_KEY = /password|secret|token|private|account|username|api_key/i

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.response

    const body = await request.json() as Record<string, string>
    const entries = Object.entries(body)

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    // 모든 키·값이 문자열인지 검증 (키/값 문자열이 아닌 페이로드로 upsert 오염 방지)
    const invalid = entries.some(
      ([key, value]) => typeof key !== 'string' || key.length === 0 || typeof value !== 'string',
    )
    if (invalid) {
      return NextResponse.json({ error: 'Invalid payload: keys and values must be strings' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 감사 기록용 전값 조회(저장 전) — 조회가 실패해도 저장은 진행한다(기록은 best-effort)
    const beforeMap = new Map<string, string>()
    try {
      const { data: beforeRows } = await adminClient
        .from('front_settings')
        .select('key, value')
        .in('key', entries.map(([k]) => k))
      ;(beforeRows ?? []).forEach((r) => beforeMap.set(r.key, r.value ?? ''))
    } catch { /* 전값 없이 기록 */ }

    const results = await Promise.all(
      entries.map(([key, value]) =>
        adminClient
          .from('front_settings')
          .upsert({ key, value }, { onConflict: 'key' })
      )
    )

    const failed = results.filter(({ error }) => error)
    if (failed.length > 0) {
      console.error('[settings] upsert errors:', failed.map((f) => f.error))
      return NextResponse.json({ error: 'Failed to save some settings' }, { status: 500 })
    }

    // 감사 기록 — 비교는 공용 diffKeyChanges(짧은 값 전/후 그대로, 긴 값 요약,
    // 비밀 키(password 등)는 값 없이 사실만 — 개인정보·비밀값 전문 방지).
    // 최소 기록 원칙(2026-08-15): 값이 하나도 안 바뀌었어도 저장 사실 자체는 남긴다.
    const changed = diffKeyChanges(
      beforeMap,
      entries.map(([key, value]) => ({ key, value })),
      (key) => SECRET_SETTING_KEY.test(key),
    )
    const targetKeys = changed.length > 0 ? changed.map((c) => c.key as string) : entries.map(([k]) => k)
    await logAdminActivity({
      adminUserId: gate.userId,
      action: 'settings.update',
      targetType: 'settings',
      targetId: targetKeys.join(',').slice(0, 200),
      detail: buildChangeDetail(changed.length > 0, { changed }),
    })

    // 메타데이터·푸터가 반영되도록 전체 레이아웃 재검증
    revalidatePath('/', 'layout')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[settings] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
