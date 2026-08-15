'use client'

/**
 * @컴포넌트: OrgIssueClient
 * @설명: 기관 라이선스 발급 — SQL 만들기 화면(Wave 1). 칸을 채우면 등록·확인·충전
 *        SQL 세 벌을 만들어 복사만 제공한다. ⚠️ 이 화면은 어떤 DB에도 쓰지 않는다 —
 *        실행은 대표님이 지니워크 라이선스 프로젝트 SQL Editor에서 직접 한다.
 *        계산·검증·SQL은 전부 _lib/orgLicenseSql.ts(정본 이식, 글자 단위 대조 완료)만
 *        쓴다 — 여기서 다시 계산하지 말 것(사본 금지).
 */

import { useEffect, useMemo, useState } from 'react'
import CopyButton from '@/components/common/CopyButton'
import {
  type OrgLicenseInput, validateInput, calcPreview,
  buildRegisterSql, buildCheckSql, buildTopupSql,
  won, ymd, genKey, nextMonthFirst, oneYearEnd,
} from './_lib/orgLicenseSql'
import { FIELD_SECTIONS, DEFAULT_INPUT, MISTAKES, type FieldChip } from './_lib/orgLicenseFields'
import IssuePanel from './IssuePanel'

/** 입력값 브라우저 저장 키(원본 파일과 별개 키 — 서로 간섭하지 않게) */
const STORAGE_KEY = 'corezent_admin_org_issue_v1'

const COPY_BTN_CLS =
  'inline-flex items-center gap-1.5 text-sm font-semibold border border-pen text-pen hover:bg-pen/5 px-4 py-2 rounded-md transition-colors'

export default function OrgIssueClient() {
  const [input, setInput] = useState<OrgLicenseInput>(DEFAULT_INPUT)

  // 이전에 입력하던 값 복원(원본과 같은 동작 — 브라우저에 자동 저장)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<OrgLicenseInput>
      setInput((prev) => ({ ...prev, ...saved }))
    } catch { /* 저장값 없으면 기본값 */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input)) } catch { /* 저장 실패 무시 */ }
  }, [input])

  function set(key: keyof OrgLicenseInput, value: string) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  /** 빠른 채우기 버튼 실행 — 날짜 규칙은 정본 이식 함수만 사용 */
  function runChip(key: keyof OrgLicenseInput, chip: FieldChip) {
    const a = chip.action
    if (a.type === 'set') set(key, a.value)
    else if (a.type === 'genKey') set('license_key', genKey())
    else if (a.type === 'today') set('contract_start', ymd(new Date()))
    else if (a.type === 'nextMonth') set('contract_start', nextMonthFirst())
    else if (a.type === 'oneYear') { const e = oneYearEnd(input.contract_start.trim()); if (e) set('contract_end', e) }
    else if (a.type === 'syncMonth') { const s = input.contract_start.trim(); if (s) set('credit_start_month', s.slice(0, 7)) }
  }

  // 검증·검산·SQL — 전부 정본 이식 모듈에서(입력이 바뀔 때만 다시 계산)
  const marks = useMemo(() => validateInput(input), [input])
  const errCount = marks.filter((m) => m.kind === 'err').length
  const warnCount = marks.filter((m) => m.kind === 'warn').length
  const pv = useMemo(() => calcPreview(input), [input])
  const sqlRegister = errCount > 0
    ? '-- 아직 채우지 않은 칸이나 잘못된 값이 있습니다.\n-- 위쪽 붉은 표시를 먼저 고쳐 주십시오.'
    : buildRegisterSql(input, pv.limit, pv.per)
  const sqlCheck = errCount > 0 ? '' : buildCheckSql(input)
  const sqlTopup = errCount > 0 ? '' : buildTopupSql(input)

  const markFor = (key: string) => marks.find((m) => m.field === key)

  return (
    <div className="space-y-6">
      {/* 어느 프로젝트에서 실행하는가 — 원본 안내 그대로 */}
      <div className="border border-rule bg-paper-raised rounded-card p-5 text-sm">
        <p className="font-bold text-ink mb-2">어느 프로젝트에서 실행하는가</p>
        <p className="font-bold text-ok">✔ 지니워크 <code className="font-mono text-xs border border-rule rounded px-1.5 py-0.5 bg-paper">ecltbezstxufivhbhsjp</code> — 여기서 실행합니다</p>
        <p className="font-bold text-caution mt-1">✘ 지니스톡 <code className="font-mono text-xs border border-rule rounded px-1.5 py-0.5 bg-paper">vpwmaqrqwpwfdsvseqvb</code> — 여기가 아닙니다</p>
        <p className="text-ink-soft mt-2">
          두 프로젝트가 <code className="font-mono text-xs">license_keys</code>·<code className="font-mono text-xs">hwid_mapping</code>을 같은 이름으로
          갖고 있어 헷갈리기 쉽습니다. 붙여넣기 전에 Supabase 화면 왼쪽 위의 프로젝트 이름을 먼저 확인하십시오.
        </p>
      </div>

      {/* 검산 — 원본 검산 6개 그대로 */}
      <div className="border border-rule bg-paper-raised rounded-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div><p className="text-xs text-ink-faint">이번 달 한도</p><p className="text-lg font-bold text-ink">{input.base_package_krw.trim() ? won(pv.limit) : '-'}</p></div>
          <div><p className="text-xs text-ink-faint">1인당 이번 달 몫</p><p className="text-lg font-bold text-ink">{input.base_package_krw.trim() && input.pc_count.trim() ? won(pv.per) : '-'}</p></div>
          <div><p className="text-xs text-ink-faint">1인당 월 문서</p><p className="text-lg font-bold text-ink">{pv.per ? pv.docs.toLocaleString('ko-KR') + '장' : '-'}</p>
            <p className="text-[11px] text-ink-faint">문서 1장 97.2원 기준 · 35개 기능 평균</p></div>
          <div><p className="text-xs text-ink-faint">등록될 대수(tier)</p><p className="text-lg font-bold text-ink">{pv.tier || '-'}</p></div>
          <div><p className="text-xs text-ink-faint">만료 시각</p><p className="text-lg font-bold text-ink">{pv.exp || '-'}</p></div>
          <div><p className="text-xs text-ink-faint">연 견적(참고)</p><p className="text-lg font-bold text-ink">{pv.quote ? won(pv.quote) : '-'}</p>
            <p className="text-[11px] text-ink-faint">앱 PC 1대 연 79,000원 + 크레딧</p></div>
        </div>
      </div>

      {/* 상태 상자 — 원본 3상태 문구 그대로 */}
      {errCount > 0 ? (
        <div className="border border-caution/30 bg-caution-soft rounded-card p-4 text-sm text-caution">
          <b>아직 등록할 수 없습니다</b> · 붉게 표시된 칸을 고쳐 주십시오 ({errCount}곳)
        </div>
      ) : warnCount > 0 ? (
        <div className="border border-rule bg-paper-raised rounded-card p-4 text-sm text-ink-soft">
          <b className="text-ink">확인해 주십시오</b> · 노란 글씨로 표시된 곳이 {warnCount}곳 있습니다. 그래도 등록은 됩니다
        </div>
      ) : (
        <div className="border border-ok/30 bg-ok-soft rounded-card p-4 text-sm text-ok">
          <b>등록할 수 있습니다</b> · 위 검산 숫자가 계약서와 맞는지 한 번 더 보십시오
        </div>
      )}

      {/* 입력 섹션 3개 — 항목·순서·문구는 정본 그대로 */}
      {FIELD_SECTIONS.map((sec) => (
        <div key={sec.title} className="border border-rule bg-paper-raised rounded-card p-5">
          <h2 className="text-base font-bold text-ink border-b-2 border-ink pb-2 mb-4">{sec.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {sec.fields.map((f) => {
              const mk = markFor(f.key)
              return (
                <div key={f.key} className={`border rounded-lg p-3 ${mk?.kind === 'err' ? 'border-caution/50' : 'border-rule'}`}>
                  <label className="block text-xs font-bold text-ink mb-1.5" htmlFor={`org-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-caution ml-0.5">*</span> : <span className="text-ink-faint font-normal ml-1">선택</span>}
                  </label>
                  <input
                    id={`org-${f.key}`}
                    type={f.type ?? 'text'}
                    value={input[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-paper border border-rule text-ink text-sm rounded-md px-3 py-2 focus:outline-none focus:border-mark"
                  />
                  {f.hint && <p className="text-[11px] text-ink-faint mt-1">{f.hint}</p>}
                  {mk && (
                    <p className={`text-[11px] mt-1 font-semibold ${mk.kind === 'err' ? 'text-caution' : 'text-ink-soft'}`}>{mk.msg}</p>
                  )}
                  {f.chips && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {f.chips.map((c) => (
                        <button key={c.label} type="button" onClick={() => runChip(f.key, c)}
                          className="text-[11px] border border-rule rounded-full px-2.5 py-0.5 text-ink-soft hover:text-ink hover:border-ink-faint transition-colors">
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* SQL 세 벌 — 복사만 제공(자동 실행 없음) */}
      <SqlBox title="4. 등록 SQL" desc="지니워크 라이선스 프로젝트(ecltbezstxufivhbhsjp)의 SQL Editor에 붙여넣어 실행하십시오" copyLabel="등록 SQL 복사" value={sqlRegister} rows={18} />

      {/* 바로 발급(Wave 2) — 같은 계산·같은 입력으로 서버가 직접 등록(미리보기→확인→발급) */}
      <IssuePanel input={input} preview={pv} errCount={errCount} />
      <SqlBox title="5. 등록 직후 확인 SQL" desc="숫자가 계약서와 맞는지 눈으로 봅니다 · 한도·1인당 몫은 위 검산과 같은 값이 나와야 합니다" copyLabel="확인 SQL 복사" value={sqlCheck} rows={9} />
      <SqlBox title="6. 나중에 추가 패키지를 팔 때 (충전)" desc="위 3번의 추가 패키지 총액과 남은 개월을 고쳐 넣고 아래를 복사하십시오. 기준 달은 자동으로 갱신됩니다" copyLabel="충전 SQL 복사" value={sqlTopup} rows={7} />

      {/* 잘못 넣기 쉬운 자리 — 원본 표 그대로 */}
      <div className="border border-rule bg-paper-raised rounded-card p-5">
        <h2 className="text-base font-bold text-ink border-b-2 border-ink pb-2 mb-3">7. 잘못 넣기 쉬운 자리</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-faint">
            <th className="py-2 pr-3 w-[30%] font-bold">실수</th><th className="py-2 font-bold">무슨 일이 생기나</th>
          </tr></thead>
          <tbody>
            {MISTAKES.map((r) => (
              <tr key={r.mistake} className="border-t border-rule align-top">
                <td className="py-2 pr-3 font-semibold text-ink">{r.mistake}</td>
                <td className="py-2 text-ink-soft">{r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** SQL 표시 상자 — 제목·설명·복사 버튼·읽기 전용 본문(세 벌이 같은 모양을 공유) */
function SqlBox({ title, desc, copyLabel, value, rows }: {
  title: string; desc: string; copyLabel: string; value: string; rows: number
}) {
  return (
    <div className="border border-rule bg-paper-raised rounded-card p-5">
      <h2 className="text-base font-bold text-ink border-b-2 border-ink pb-2 mb-2">{title}</h2>
      <p className="text-xs text-ink-faint mb-3">{desc}</p>
      <CopyButton value={value} title={copyLabel} className={COPY_BTN_CLS}
        labels={{ idle: copyLabel, copied: '복사했습니다' }} iconSize={14} />
      <textarea readOnly value={value} rows={rows} spellCheck={false}
        className="w-full mt-3 font-mono text-xs bg-paper border border-rule rounded-md p-3 whitespace-pre overflow-x-auto text-ink" />
    </div>
  )
}
