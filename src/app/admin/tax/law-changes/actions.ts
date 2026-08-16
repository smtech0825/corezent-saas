'use server'

/**
 * @파일: admin/tax/law-changes/actions.ts
 * @설명: 감지된 법령 개정의 처리 상태 변경 서버 액션.
 *        상태는 세 가지뿐이다 — pending(미확인) / reviewed(확인함) / ignored(해당 없음).
 *        룰 수정 자체는 여기서 하지 않는다. 무엇을 고칠지는 사람이 조문을 대조해
 *        판단하고 룰 편집 화면에서 넣는다.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'

/** 관리자가 지정할 수 있는 처리 상태 */
const ALLOWED_STATUS = ['pending', 'reviewed', 'ignored'] as const
export type LawChangeStatus = (typeof ALLOWED_STATUS)[number]

/**
 * @함수명: setLawChangeStatus
 * @설명: 감지된 개정 한 건의 처리 상태를 바꿉니다.
 *        미확인으로 되돌리면 검토 일시를 지웁니다 — '언제 봤는지'가 남아 있으면
 *        아직 안 본 건과 구분이 되지 않기 때문입니다.
 * @매개변수: id - 큐 행 id / status - 바꿀 상태
 * @반환값: 성공 여부와 안내 문구
 */
export async function setLawChangeStatus(
  id: string,
  status: LawChangeStatus,
): Promise<AdminActionResult> {
  const gate = await guardAdmin()
  if (gate) return gate

  if (!id || typeof id !== 'string') {
    return { status: 'failed', reason: '대상을 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }
  }
  if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
    return { status: 'failed', reason: '알 수 없는 처리 상태입니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tax_law_change_queue')
    .update({
      status,
      reviewed_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return dbFailure('법령 개정 상태 저장', error)

  revalidatePath('/admin/tax/law-changes')
  return { status: 'ok' }
}

/**
 * @함수명: skipStuckWatchDate
 * @설명: 감시 배치가 특정 날짜에서 계속 실패해 그 뒤 날짜를 못 보고 있을 때,
 *        처리 완료일을 하루 앞으로 밀어 막힌 날짜를 건너뜁니다.
 *
 *        ⚠️ 건너뛴 날짜의 개정은 감지되지 않습니다. 배치는 실패한 날짜를 절대 스스로
 *        넘기지 않도록 만들어져 있는데(그날 개정을 놓치지 않기 위해서), 구조적으로
 *        늘 실패하는 날짜가 하나 생기면 그 뒤가 영영 막힙니다. 그 교착을 사람이
 *        의식적으로 푸는 수단이며, 자동으로는 절대 일어나지 않습니다.
 * @반환값: 성공 여부와 안내 문구
 */
export async function skipStuckWatchDate(): Promise<AdminActionResult> {
  const gate = await guardAdmin()
  if (gate) return gate

  const admin = createAdminClient()
  const { data, error: readError } = await admin
    .from('tax_law_watch_state')
    .select('last_checked_date, last_run_ok')
    .eq('id', 1)
    .single()

  if (readError || !data) return dbFailure('감시 상태 조회', readError ?? { message: '행 없음' })

  const state = data as { last_checked_date: string | null; last_run_ok: boolean | null }
  if (state.last_checked_date === null) {
    return { status: 'failed', reason: '아직 기준선이 세워지지 않아 건너뛸 날짜가 없습니다.' }
  }
  if (state.last_run_ok !== false) {
    return {
      status: 'failed',
      reason: '마지막 실행이 실패 상태가 아닙니다. 막히지 않았을 때는 건너뛸 필요가 없습니다.',
    }
  }

  const next = new Date(`${state.last_checked_date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const skipped = next.toISOString().slice(0, 10)

  const { error } = await admin
    .from('tax_law_watch_state')
    .update({
      last_checked_date: skipped,
      last_run_ok: null,
      last_error: `관리자가 ${skipped} 처리를 건너뛰었습니다. 이 날짜의 개정은 감지되지 않았습니다.`,
    })
    .eq('id', 1)

  if (error) return dbFailure('감시 날짜 건너뛰기', error)

  revalidatePath('/admin/tax/law-changes')
  return { status: 'ok' }
}
