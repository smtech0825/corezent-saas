/**
 * @파일: lib/tax/year-comparison.ts
 * @설명: 연도별 비교 계산 공용 러너 — 양도소득세·종합부동산세 서버 액션이 사용한다.
 *        ⚠️ 비교할 연도 목록을 코드에 박지 않는다. 등록된 개정안(proposed) 룰의
 *        시행일에서 연도를 뽑고(fetchProposedEffectiveYears), 앞에 기준 연도
 *        (오늘의 KST 연도)를 붙인다 — 개편안 시행 시점이 바뀌거나 단계가 늘면
 *        룰만 고치면 화면이 따라온다. 국회 통과로 proposed 룰이 confirmed로 전환되면
 *        목록이 줄어들고 비교도 자연히 접힌다(미래 해가 없으면 null).
 *        기준 연도는 확정법(confirmed), 그 이후 해는 개정안(proposed) 모드로 계산한다 —
 *        올해는 확정된 법이 있고 앞으로는 개정안뿐이라는 실제 상황과 일치시킨다.
 *        한 해가 실패해도 나머지 해는 결과를 낸다(실패는 값으로 담긴다). 전부 실패하면
 *        비교 자체를 내지 않는다(null) — 호출한 액션은 본 계산 결과만 반환한다.
 *        ⚠️ 계산 이력(tax_calculation_logs)은 남기지 않는다 — 이력 기록은 사용자가
 *        실제로 누른 본 계산(액션)의 몫이며, 부속 호출이 통계를 부풀리면 안 된다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaxRuleMode, TaxType } from './types'
import type { TaxEngineFailure } from './engine-types'
import { engineFail, fetchProposedEffectiveYears } from './rule-store'

/** 비교 카드 수 상한(기준 연도 포함) — 개정안 단계가 늘어 연도가 많아지면 가까운 해부터 이 수까지만 비교한다 */
export const MAX_COMPARISON_YEARS = 4

/** 한 해의 비교 결과 — 실패도 값으로 담아 부분 실패를 그대로 표현한다 */
export interface YearComparisonEntry<S extends { ok: true }> {
  year: number
  /** 이 해를 어느 기준으로 계산했는지 — 기준 연도=confirmed, 그 외=proposed */
  ruleMode: TaxRuleMode
  /** 기준 연도(올해) 여부 — 화면이 '올해 대비' 증감의 기준으로 삼는다 */
  isBaseYear: boolean
  result: S | TaxEngineFailure
}

/** 연도별 비교 묶음 — 서버 액션이 본 계산 결과에 곁들여 반환한다 */
export interface YearComparison<S extends { ok: true }> {
  baseYear: number
  entries: YearComparisonEntry<S>[]
}

/**
 * @함수명: currentYearKst
 * @설명: 오늘의 연도(한국 시간)를 반환합니다 — 비교의 기준 연도. 서버에서만 호출합니다.
 * @반환값: 4자리 연도 숫자
 */
export function currentYearKst(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()),
  )
}

/**
 * @함수명: replaceDateYear
 * @설명: YYYY-MM-DD 날짜의 연도만 치환합니다 — 월·일은 사용자 입력을 유지합니다.
 *        무효 날짜(예: 평년의 2월 29일) 검증은 엔진이 하며, 그 해만 실패로 격리됩니다.
 * @매개변수: date - YYYY-MM-DD 문자열 / year - 치환할 4자리 연도
 * @반환값: 연도가 치환된 YYYY-MM-DD 문자열
 */
export function replaceDateYear(date: string, year: number): string {
  return `${year}${date.slice(4)}`
}

/**
 * @함수명: buildComparisonYears
 * @설명: 비교 연도 목록을 구성합니다 — 기준 연도 + 개정안 시행 연도 중 기준 연도 이후만
 *        (중복 제거·오름차순), 상한(MAX_COMPARISON_YEARS)까지. 기준 연도와 같거나 이전인
 *        시행 연도는 제외합니다 — 그 해는 이미 기준 연도 카드(확정법)가 대표합니다.
 * @매개변수: baseYear - 기준 연도(올해) / proposedYears - 개정안 룰 시행 연도들
 * @반환값: 비교할 연도 오름차순 배열(첫 항목은 항상 기준 연도)
 */
export function buildComparisonYears(baseYear: number, proposedYears: number[]): number[] {
  const future = [...new Set(proposedYears.filter((y) => y > baseYear))].sort((a, b) => a - b)
  return [baseYear, ...future].slice(0, MAX_COMPARISON_YEARS)
}

/**
 * @함수명: runYearComparison
 * @설명: 연도별 비교를 실행합니다 — 세목의 개정안 시행 연도를 데이터에서 조회해 연도
 *        목록을 만들고, 해마다 calc 콜백(기준일만 치환한 엔진 호출)을 병렬로 부릅니다.
 *        비교가 성립하지 않으면(시행 연도 조회 실패·미래 해 없음·전 연도 실패) null —
 *        호출한 액션은 본 계산 결과만 반환하면 됩니다.
 * @매개변수: supabase - Supabase 클라이언트 / taxType - 세목 /
 *            calc - 연도·모드를 받아 엔진을 부르는 콜백(입력 치환은 호출부 몫)
 * @반환값: 연도별 비교 묶음 또는 null(비교 불성립)
 */
export async function runYearComparison<S extends { ok: true }>(
  supabase: SupabaseClient,
  taxType: TaxType,
  calc: (year: number, mode: TaxRuleMode) => Promise<S | TaxEngineFailure>,
): Promise<YearComparison<S> | null> {
  const fetched = await fetchProposedEffectiveYears(supabase, taxType)
  if (!fetched.ok) return null

  const baseYear = currentYearKst()
  const years = buildComparisonYears(baseYear, fetched.years)
  if (years.length < 2) return null

  const entries = await Promise.all(
    years.map(async (year): Promise<YearComparisonEntry<S>> => {
      const ruleMode: TaxRuleMode = year === baseYear ? 'confirmed' : 'proposed'
      let result: S | TaxEngineFailure
      try {
        result = await calc(year, ruleMode)
      } catch (err) {
        console.error(
          `[tax] 연도별 비교 계산 실패(${taxType} ${year}):`,
          err instanceof Error ? err.message : String(err),
        )
        result = engineFail('DB_ERROR', '이 해의 계산에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }
      return { year, ruleMode, isBaseYear: year === baseYear, result }
    }),
  )

  if (!entries.some((e) => e.result.ok)) return null
  return { baseYear, entries }
}
