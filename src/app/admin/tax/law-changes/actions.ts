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
