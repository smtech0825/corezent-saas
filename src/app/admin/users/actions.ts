'use server'

/**
 * @파일: admin/users/actions.ts
 * @설명: 관리자 사용자 관리 서버 액션
 *        - changeRole: 역할 변경 (user / admin)
 *        - withdrawUser: 탈퇴 처리 (status=inactive + Supabase ban)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrThrow } from '@/lib/require-admin'
import { revalidatePath } from 'next/cache'
import { logAdminActivity } from '@/lib/adminActivityLog'
import { fetchUserList } from './query'

/** 역할 변경 */
export async function changeRole(userId: string, newRole: string) {
  const actorId = await requireAdminOrThrow()
  // 실패는 조용히 넘기지 않는다 — 화면이 "바뀐 것처럼" 보이면 관리자가 잘못 알게 된다.
  if (!userId || !newRole) throw new Error('역할 변경 실패: 대상 또는 역할 값이 비어 있습니다.')
  const adminClient = createAdminClient()

  const { data: before } = await adminClient.from('profiles').select('role').eq('id', userId).single()
  const { error: updateError } = await adminClient.from('profiles').update({ role: newRole }).eq('id', userId)
  if (updateError) throw new Error(`역할 변경 실패: ${updateError.message}`)

  await logAdminActivity({
    adminUserId: actorId,
    action: 'user.role_change',
    targetType: 'user',
    targetId: userId,
    detail: { from: before?.role ?? null, to: newRole },
  })

  revalidatePath('/admin/users')
}

/** 탈퇴 처리 — 소프트 삭제 (데이터 보존 + 로그인 차단) */
export async function withdrawUser(userId: string): Promise<{ error?: string }> {
  const actorId = await requireAdminOrThrow()
  if (!userId) return { error: '대상 회원을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.' }
  const adminClient = createAdminClient()

  // 1. profiles.status = 'inactive' 업데이트
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', userId)

  if (profileError) {
    // 원문은 영문이라 화면에 내보내지 않는다. 사유는 서버 기록에만 남긴다.
    console.error('[users] 탈퇴 처리 실패(회원 상태):', profileError.message)
    return { error: '회원 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 2. Supabase Auth 차원 로그인 차단 (100년 ban)
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })

  if (authError) {
    console.error('[users] 탈퇴 처리 실패(로그인 차단):', authError.message)
    return { error: '회원 상태는 바뀌었지만 로그인 차단에 실패했습니다. 목록을 확인한 뒤 다시 시도해 주세요.' }
  }

  await logAdminActivity({
    adminUserId: actorId,
    action: 'user.withdraw',
    targetType: 'user',
    targetId: userId,
  })

  revalidatePath('/admin/users')
  return {}
}

/** CSV 내보내기 결과 — 실패 사유는 화면에 그대로 보여줄 한국어 문장 */
export type ExportCsvResult =
  | { ok: true; csv: string; count: number }
  | { ok: false; reason: string }

/**
 * @함수명: csvCell
 * @설명: CSV 한 칸을 안전하게 만듭니다 — 따옴표 감싸기 + 내부 따옴표 이중화,
 *        엑셀 수식 인젝션 방어(=,+,-,@ 로 시작하면 ' 접두).
 * @매개변수: v - 칸에 넣을 값
 * @반환값: CSV에 그대로 넣을 문자열
 */
function csvCell(v: string): string {
  let s = v.replace(/[\r\n\t]+/g, ' ')
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * @함수명: exportUsersCsv
 * @설명: 지금 화면과 같은 검색·정렬 조건의 회원 목록을 CSV 문자열로 만듭니다.
 *        ★ 개인정보 파일 — 반출 기록(admin_activity_log)이 먼저 성공해야만 내보냅니다.
 *        기록이 실패하면 반출도 하지 않습니다(누가 언제 무엇을 내보냈는지 없이는 안 나감).
 *        칸은 이름·이메일·역할·상태·가입일 5개뿐 — 비밀번호·토큰·정산 계좌는 넣지 않습니다.
 *        한글 깨짐 방지: 맨 앞에 UTF-8 BOM을 붙여 엑셀이 인코딩을 바로 인식하게 합니다.
 * @매개변수: input - q(검색어)·sort(정렬) — 화면의 조건 그대로
 * @반환값: { ok, csv, count } 또는 { ok: false, reason }
 */
export async function exportUsersCsv(input: { q?: string; sort?: string }): Promise<ExportCsvResult> {
  let actorId: string
  try {
    actorId = await requireAdminOrThrow()
  } catch {
    return { ok: false, reason: '관리자 권한을 확인하지 못했습니다. 다시 로그인해 주세요.' }
  }

  const q = (input.q ?? '').trim().slice(0, 80)
  const sort = input.sort === 'name' ? 'name' as const : 'joined' as const

  // 화면과 같은 조건 전체(페이지 무관) — 조회 로직은 query.ts 단일 출처
  let users
  let total = 0
  try {
    ;({ users, total } = await fetchUserList({ q, sort }))
  } catch (err) {
    console.error('[users] CSV 조회 실패:', err instanceof Error ? err.message : String(err))
    return { ok: false, reason: '회원 목록을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 조회 상한(기본 1,000행)에 걸려 잘린 채 나가면 "전체를 내보냈다"는 착각을 만든다 —
  // 자르지 않고 거부한다(검증 도구 지적). 그 규모가 되면 나눠 내보내는 기능이 따로 필요.
  if (users.length < total) {
    return { ok: false, reason: `회원이 ${total.toLocaleString('ko-KR')}명이라 한 번에 내보낼 수 없습니다(한 번에 ${users.length.toLocaleString('ko-KR')}명까지). 검색 조건으로 범위를 좁혀 주세요.` }
  }

  // ★ 반출 기록 먼저 — 실패하면 내보내지 않는다(best-effort 헬퍼가 아니라 직접 기록)
  try {
    const adminClient = createAdminClient()
    const { error: logErr } = await adminClient.from('admin_activity_log').insert({
      admin_user_id: actorId,
      action: 'user.csv_export',
      target_type: 'user_list',
      target_id: 'csv',
      detail: { q: q || null, sort, count: users.length },
    })
    if (logErr) {
      console.error('[users] CSV 반출 기록 실패:', logErr.message)
      return { ok: false, reason: '반출 기록을 남기지 못해 내보내기를 중단했습니다. 잠시 후 다시 시도해 주세요.' }
    }
  } catch (err) {
    console.error('[users] CSV 반출 기록 예외:', err instanceof Error ? err.message : String(err))
    return { ok: false, reason: '반출 기록을 남기지 못해 내보내기를 중단했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const statusLabel: Record<string, string> = { active: '활성', inactive: '탈퇴' }
  const roleLabel: Record<string, string> = { admin: '관리자', user: '회원' }
  const header = ['이름', '이메일', '역할', '상태', '가입일'].map(csvCell).join(',')
  const lines = users.map((u) => [
    u.name,
    u.email,
    roleLabel[u.role] ?? u.role,
    statusLabel[u.status] ?? u.status,
    new Date(u.created_at).toLocaleDateString('ko-KR'),
  ].map(csvCell).join(','))

  // ﻿ = UTF-8 BOM — 엑셀 한글 깨짐 방지
  return { ok: true, csv: '\uFEFF' + `${header}\n${lines.join('\n')}`, count: users.length }
}
