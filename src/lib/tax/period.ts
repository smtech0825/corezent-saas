/**
 * @파일: lib/tax/period.ts
 * @설명: 달력 날짜(YYYY-MM-DD) 두 개 사이의 경과 '만 연수' 계산 — 양도소득세의
 *        보유기간·거주기간 판정용 유틸.
 *        ⚠️ 초일 산입 여부를 코드에 고정하지 않는다 — 산입 방식은 인자(mode)로 받으며
 *        기본값이 없다. 실제 기본값은 룰(transfer.period_rule)이 정하고 엔진이 읽어 넘긴다.
 *        ⚠️ 보유기간은 두 종류다 — 세율용(소득세법 제104조제2항)과 장기보유특별공제용
 *        (같은 법 제95조제4항)은 근거 조문이 다르고 상속 자산에서 기산일이 갈린다.
 *        어느 날짜를 기산일로 쓸지는 엔진이 조문에 따라 결정하고, 이 모듈은 용도별로
 *        이름이 분리된 함수를 제공해 두 보유기간이 코드에서 섞이지 않게 강제한다.
 *        시간대 개념 없이 달력 날짜로만 계산한다(Date 객체의 로컬 시간 사용 안 함).
 */

/** 초일 산입 방식 — include_start(초일 산입) / exclude_start(초일 불산입) */
export type DayInclusionMode = 'include_start' | 'exclude_start'

/** 달력 날짜 — 내부 계산용 */
interface Ymd {
  y: number
  m: number
  d: number
}

/** YYYY-MM-DD 문자열 → 달력 날짜. 형식·실존 날짜가 아니면 null */
function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/** 윤년 판정 */
function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** 해당 연·월의 말일 */
function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/** 날짜 비교 — a<b 음수 / a==b 0 / a>b 양수 */
function compareYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

/** 하루 뒤 날짜 */
function addOneDay(date: Ymd): Ymd {
  if (date.d < daysInMonth(date.y, date.m)) return { y: date.y, m: date.m, d: date.d + 1 }
  if (date.m < 12) return { y: date.y, m: date.m + 1, d: 1 }
  return { y: date.y + 1, m: 1, d: 1 }
}

/**
 * n년 뒤 응당일 — 응당일이 없는 경우(2/29 기산 후 평년)는 그 달의 말일(2/28)로 당긴다.
 * (말일로 당기는 쪽이 기간을 하루 길게 인정하는 방향이 아니라, 응당일 부재 시 말일 만료라는
 * 기간 계산의 일반 원칙을 따른 것 — 어느 쪽으로도 기간을 임의로 늘리지 않는다)
 */
function addYearsAnniversary(date: Ymd, n: number): Ymd {
  const y = date.y + n
  if (date.m === 2 && date.d === 29 && !isLeapYear(y)) return { y, m: 2, d: 28 }
  return { y, m: date.m, d: date.d }
}

/**
 * @함수명: fullYearsBetween
 * @설명: 시작일부터 종료일까지 경과한 만 연수(내림)를 구합니다.
 *        - exclude_start(초일 불산입): 종료일이 시작일의 N주년 응당일 이상이면 N년 경과
 *        - include_start(초일 산입): 기간이 하루 일찍 차므로 응당일 하루 전에 N년 경과
 *        종료일이 시작일보다 앞서면 0을, 날짜 형식이 잘못되면 NaN을 반환합니다
 *        (호출 전 형식 검증은 엔진의 isValidDateString이 담당 — 이중 방어).
 * @매개변수: startDate - 기산 기준 날짜 / endDate - 종료 날짜 / mode - 초일 산입 방식(필수)
 * @반환값: 경과 만 연수 (0 이상 정수) 또는 NaN
 */
export function fullYearsBetween(startDate: string, endDate: string, mode: DayInclusionMode): number {
  const start = parseYmd(startDate)
  const end = parseYmd(endDate)
  if (!start || !end) return Number.NaN
  if (compareYmd(end, start) < 0) return 0

  // 초일 산입이면 같은 종료일에 하루가 더 경과한 것으로 본다(만료일이 하루 당겨짐)
  const effectiveEnd = mode === 'include_start' ? addOneDay(end) : end

  // effectiveEnd 이상이 되지 않는 가장 큰 N주년 — 근사치에서 한 칸씩 보정
  let years = effectiveEnd.y - start.y
  while (years > 0 && compareYmd(addYearsAnniversary(start, years), effectiveEnd) > 0) years--
  return Math.max(years, 0)
}

/**
 * @함수명: holdingYearsForRate
 * @설명: 세율 적용용 보유기간(만 연수) — 소득세법 제104조제2항의 보유기간.
 *        상속받은 자산은 피상속인이 취득한 날부터 기산하는 등 기산일 선택은
 *        엔진이 조문에 따라 결정해 startDate로 넘긴다(이 함수는 계산만 한다).
 *        ⚠️ 장기보유특별공제용 보유기간(holdingYearsForLtsd)과 절대 바꿔 쓰지 마라 —
 *        근거 조문이 다르고 상속 자산에서 결과가 갈린다.
 */
export function holdingYearsForRate(startDate: string, transferDate: string, mode: DayInclusionMode): number {
  return fullYearsBetween(startDate, transferDate, mode)
}

/**
 * @함수명: holdingYearsForLtsd
 * @설명: 장기보유특별공제용 보유기간(만 연수) — 소득세법 제95조제4항의 보유기간.
 *        상속받은 자산은 상속개시일부터 기산하는 등 기산일 선택은 엔진이 조문에 따라
 *        결정해 startDate로 넘긴다(이 함수는 계산만 한다).
 *        ⚠️ 세율용 보유기간(holdingYearsForRate)과 절대 바꿔 쓰지 마라.
 */
export function holdingYearsForLtsd(startDate: string, transferDate: string, mode: DayInclusionMode): number {
  return fullYearsBetween(startDate, transferDate, mode)
}
