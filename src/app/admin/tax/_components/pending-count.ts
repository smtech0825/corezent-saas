/**
 * @파일: admin/tax/_components/pending-count.ts
 * @설명: 법령 개정 큐의 미확인(pending) 건수 조회 — 세금 관리 화면 탭 배지의 단일 출처.
 *        ⚠️ 서버 전용(관리자 클라이언트를 쓴다) — 클라이언트 컴포넌트에서 import 금지.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * @함수명: fetchPendingLawChangeCount
 * @설명: 아직 검토하지 않은 법령 개정 건수를 셉니다. 조회에 실패하면 배지를 달지 않습니다
 *        (0을 돌려줌) — 배지 하나 때문에 세금 화면 전체가 막히면 안 되기 때문입니다.
 * @반환값: 미확인 건수
 */
export async function fetchPendingLawChangeCount(): Promise<number> {
  try {
    const admin = createAdminClient()
    const { count, error } = await admin
      .from('tax_law_change_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (error) {
      console.error('[admin/tax] 법령 개정 미확인 건수 조회 실패:', error.message)
      return 0
    }
    return count ?? 0
  } catch (e) {
    console.error('[admin/tax] 법령 개정 미확인 건수 조회 중 오류:', e)
    return 0
  }
}
