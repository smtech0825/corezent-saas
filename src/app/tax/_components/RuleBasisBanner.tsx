/**
 * @컴포넌트: RuleBasisBanner
 * @설명: 부동산 계산기 공용 기준일 안내 배너 — "이 계산기가 언제 기준인지"를 계산하기
 *        전에 먼저 보여준다(잘못된 정보 대부분이 '언제부터인지'를 몰라서 생긴다).
 *        - 가장 최근 시행일·마지막 룰 갱신일: 사람이 적지 않고 등록된 룰에서 자동으로 뽑는다
 *        - 펼치면(기본 접힘, 네이티브 <details>) 그 계산기가 쓰는 룰 전체 목록 —
 *          룰마다 근거 법령·조문·시행기간·상태
 *        - 개정안(proposed)이 섞여 있으면 배너 전체를 경고색으로 바꾸고 그 사실을 명시
 *        - 룰이 하나도 없으면 그 사실을 표시한다(빈 배너를 그리지 않는다)
 *        서버 컴포넌트 — 오늘(KST) 기준 유효한 룰만 조회하며, 계산 로직에는 관여하지 않는다.
 */

import { CalendarClock, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/** 배너가 보여줄 룰 한 건 */
interface BannerRule {
  rule_key: string
  law_name: string
  law_article: string
  effective_from: string
  effective_to: string | null
  status: string
  updated_at: string
}

/** 오늘 날짜(한국 시간) YYYY-MM-DD — 룰 유효기간 판정용 */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

/** 타임스탬프/날짜를 한국어 날짜로 */
function formatKstDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(new Date(iso))
}

export default async function RuleBasisBanner({ taxTypes }: {
  /** 이 계산기가 쓰는 룰의 세목 목록 — 예: ['acquisition', 'common'] */
  taxTypes: string[]
}) {
  const supabase = await createClient()
  const today = todayKst()
  const { data, error } = await supabase
    .from('tax_rules')
    .select('rule_key, law_name, law_article, effective_from, effective_to, status, updated_at')
    .in('tax_type', taxTypes)
    .in('status', ['confirmed', 'proposed'])
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('[tax] 기준일 배너 룰 조회 실패:', error.message)
    return (
      <div className="mb-4 bg-paper-raised border border-rule rounded-lg p-4 text-sm text-ink-soft">
        기준일 정보를 불러오지 못했습니다. 계산 결과의 근거 표시는 정상 동작합니다.
      </div>
    )
  }

  const rules = (data ?? []) as BannerRule[]

  // 룰이 하나도 없으면 그 사실을 표시 — 빈 배너 금지
  if (rules.length === 0) {
    return (
      <div className="mb-4 bg-paper-raised border border-rule rounded-lg p-4 text-sm text-ink-soft">
        아직 등록된 룰이 없습니다. 룰이 등록될 때까지 이 계산기는 결과를 제공하지 않습니다.
      </div>
    )
  }

  // 사람이 적는 값 없이 등록된 룰에서 자동 산출
  const latestEffective = rules.reduce((max, r) => (r.effective_from > max ? r.effective_from : max), rules[0].effective_from)
  const lastUpdated = rules.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), rules[0].updated_at)
  const hasProposed = rules.some((r) => r.status === 'proposed')

  return (
    <details
      className={`mb-4 rounded-lg border p-4 ${
        hasProposed ? 'bg-caution-soft border-caution/40' : 'bg-paper-raised border-rule'
      }`}
    >
      <summary className="cursor-pointer select-none list-none">
        <span className="flex items-start gap-2.5">
          {hasProposed
            ? <TriangleAlert size={18} className="text-caution shrink-0 mt-0.5" aria-hidden />
            : <CalendarClock size={18} className="text-pen shrink-0 mt-0.5" aria-hidden />}
          <span className="text-sm text-ink leading-relaxed">
            <strong className="font-semibold">
              이 계산기의 기준: 시행 {formatKstDate(latestEffective)} 법령까지 반영
            </strong>
            <span className="block text-xs text-ink-soft mt-0.5">
              마지막 룰 갱신 {formatKstDate(lastUpdated)} · 적용 룰 {rules.length}건
              {hasProposed && (
                <strong className="text-caution"> · 국회 통과 전 개정안이 포함돼 있습니다 — 확정된 내용이 아닙니다</strong>
              )}
              <span className="text-ink-faint"> · 눌러서 전체 근거 보기</span>
            </span>
          </span>
        </span>
      </summary>
      <ul className="mt-3 pt-3 border-t border-rule space-y-2">
        {rules.map((r) => (
          <li key={`${r.rule_key}-${r.effective_from}`} className="text-xs leading-relaxed">
            <span className="font-mono text-ink-soft">{r.rule_key}</span>
            <span className="mx-1.5 text-rule">|</span>
            <span className="text-ink">{r.law_name} {r.law_article}</span>
            <span className="mx-1.5 text-rule">|</span>
            <span className="text-ink-soft">
              시행 {r.effective_from}{r.effective_to ? ` ~ ${r.effective_to}` : ' ~ 현재'}
            </span>
            {r.status === 'proposed' && (
              <span className="ml-1.5 px-1 py-0.5 rounded text-[11px] font-semibold bg-caution-soft text-caution">
                개정안 (미확정)
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
