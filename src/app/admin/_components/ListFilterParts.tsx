/**
 * @파일: admin/_components/ListFilterParts.tsx
 * @설명: 관리자 목록 화면(모니터링 로그·작업 기록) 공용 부품 — 필터 pill·주소 조립·
 *        시각 표기·중복 파라미터 방어. 같은 블록이 화면마다 복제되지 않도록 한 벌만 둔다.
 *        링크 방식이라 서버 컴포넌트에서 그대로 동작한다.
 */

import Link from 'next/link'

/**
 * @함수명: makeListHref
 * @설명: 현재 필터를 유지한 채 일부 파라미터만 바꾼 주소를 만듭니다(페이지 이동·필터 전환 공용).
 * @매개변수: basePath - 화면 경로(예: '/admin/logs') / params - 현재 파라미터 / patch - 바꿀 값
 * @반환값: 쿼리스트링이 붙은 주소(빈 값 파라미터는 제외)
 */
export function makeListHref(
  basePath: string,
  params: Record<string, string>,
  patch: Record<string, string>,
): string {
  const merged = { ...params, ...patch }
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * @함수명: firstParam
 * @설명: 같은 파라미터가 두 번 온 주소(?q=a&q=b)에서도 죽지 않게 첫 값만 취합니다.
 * @매개변수: v - searchParams 값(문자열·배열·undefined)
 * @반환값: 첫 문자열 값(없으면 빈 문자열)
 */
export function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

/**
 * @함수명: fmtLogDateTime
 * @설명: 기록 시각 표기 — 연도 포함(기록은 몇 달치가 쌓이므로 연도가 없으면 시점을 특정할 수 없다).
 * @매개변수: d - ISO 시각 문자열
 * @반환값: 한국어 로케일 시각 문자열
 */
export function fmtLogDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * @컴포넌트: FilterPills
 * @설명: 필터 pill 한 묶음(종류·상태·기간 등 공용) — 링크 방식이라 서버 컴포넌트에서 동작.
 *        필터를 바꾸면 1페이지부터 다시 본다(page 초기화).
 */
export function FilterPills({
  basePath, label, options, current, paramKey, params,
}: {
  basePath: string
  label: string
  options: { value: string; label: string }[]
  current: string
  paramKey: string
  params: Record<string, string>
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-soft shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {options.map((opt) => {
          const active = current === opt.value
          return (
            <Link
              key={opt.value || 'all'}
              href={makeListHref(basePath, params, { [paramKey]: opt.value, page: '' })}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? 'bg-mark/10 text-mark border-mark/40 font-semibold'
                  : 'text-ink-soft border-rule hover:text-ink hover:border-mark/40'
              }`}
            >
              {opt.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
