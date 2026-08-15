/**
 * @파일: tax/_components/coverage-rule.ts
 * @설명: '취득 당시 조정대상지역' 자동 판정이 켜져 있는지(커버리지 룰 등록 여부)를
 *        페이지가 서버에서 조회해 폼에 넘긴다 — 폼이 그에 맞춰 입력칸 기본값과 안내를
 *        고른다. 룰이 없으면 자동 판정이 꺼진 상태이므로 예전처럼 사용자 선택을 요구해야
 *        하고, 그때 '자동 판정'을 기본값으로 두면 첫 제출이 반드시 실패한다.
 *        ⚠️ 존재 여부만 본다 — 날짜 값은 엔진이 룰에서 읽는다(화면에 날짜를 두지 않는다).
 *        양도소득세·매도 실수령액 페이지가 공유한다.
 */

import { createClient } from '@/lib/supabase/server'
import { COMMON_RULE_KEYS } from '@/lib/tax/rule-store'

/** 오늘 날짜(한국 시간) YYYY-MM-DD — 룰 유효기간 판정용 */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/**
 * @함수명: fetchAutoRegulatedEnabled
 * @설명: 오늘 기준 유효한 커버리지 룰이 있는지 조회합니다. 조회에 실패하면 false —
 *        자동 판정이 켜졌다고 잘못 안내하는 것보다 사용자에게 묻는 쪽이 안전합니다.
 * @반환값: 자동 판정 가능 여부
 */
export async function fetchAutoRegulatedEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const today = todayKst()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('id')
    .eq('tax_type', 'common')
    .eq('rule_key', COMMON_RULE_KEYS.regulatedHistoryFrom)
    .eq('status', 'confirmed')
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .limit(1)
  if (error) {
    console.error('[tax] 커버리지 룰 조회 실패:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
