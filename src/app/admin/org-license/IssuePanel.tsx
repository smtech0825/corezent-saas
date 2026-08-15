'use client'

/**
 * @컴포넌트: IssuePanel
 * @설명: 기관 라이선스 「바로 발급」(Wave 2) — [미리보기]로 만들어질 값을 표로 확인한
 *        뒤에만 [발급]이 열리고, 발급은 확인 창(기관명·PC 대수 표시)을 거친다.
 *        값은 전부 부모(OrgIssueClient)가 정본 모듈로 계산한 것을 그대로 받는다 —
 *        여기서 다시 계산하지 않는다(사본 금지).
 *        ⚠️ [발급]은 진짜로 앱 DB에 등록된다 — 시험 삼아 누르면 안 된다.
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { OrgLicenseInput, OrgLicensePreview } from './_lib/orgLicenseSql'
import { won } from './_lib/orgLicenseSql'
import { formatDateTimeKR } from '@/lib/datetime'
import { issueOrgLicense, type IssueResult } from './actions'

interface Props {
  input: OrgLicenseInput
  preview: OrgLicensePreview
  /** 입력 오류 수 — 0이 아니면 미리보기·발급을 열지 않는다 */
  errCount: number
}

export default function IssuePanel({ input, preview, errCount }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<IssueResult | null>(null)
  // 발급 시점의 미리보기 값 고정 — 발급 후 폼을 고쳐도 표가 바뀌지 않게(다음 기관과 섞임 방지)
  const [doneRows, setDoneRows] = useState<[string, string][] | null>(null)
  const [failReason, setFailReason] = useState('')

  const liveRows: [string, string][] = [
    ['기관명', input.org_name.trim() || '-'],
    ['라이선스 키', input.license_key.trim() || '-'],
    ['PC 대수', preview.tier || '-'],
    ['계약 기간', `${input.contract_start.trim() || '-'} ~ ${input.contract_end.trim() || '-'}`],
    ['만료 시각', preview.exp || '-'],
    ['이번 달 한도', won(preview.limit)],
    ['1인당 몫', won(preview.per)],
  ]
  // 발급이 끝났으면 그 시점 값을, 아니면 실시간 값을 보여준다
  const rows = doneRows ?? liveRows

  /** 다음 발급 준비 — 결과·미리보기를 닫고 폼 입력만 남긴다 */
  function resetForNext() {
    setDone(null)
    setDoneRows(null)
    setFailReason('')
    setPreviewOpen(false)
  }

  /** 발급 실행 — 확인 창을 거치고, 처리 중에는 버튼을 잠가 두 번 눌림을 막는다 */
  async function handleIssue() {
    if (pending || done) return
    const ok = confirm(
      `기관 라이선스를 지금 발급할까요?\n\n기관명: ${input.org_name.trim()}\nPC 대수: ${preview.tier}\n\n앱 DB에 진짜로 등록되며 되돌릴 수 없습니다.`,
    )
    if (!ok) return
    setPending(true)
    setFailReason('')
    try {
      const res = await issueOrgLicense(input)
      if (res.status === 'ok') {
        setDone(res.created ?? { tier: null, expiresAt: null, orgName: null, pcCount: null, serverMonthlyLimit: null })
        setDoneRows(liveRows)
      } else setFailReason(res.reason)
    } catch {
      setFailReason('발급 요청이 전달되지 않았습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="border border-rule bg-paper-raised rounded-card p-5">
      <h2 className="text-base font-bold text-ink border-b-2 border-ink pb-2 mb-2">4-1. 바로 발급</h2>
      <p className="text-xs text-ink-faint mb-3">
        위와 같은 값으로 서버가 직접 등록합니다(두 표 한 묶음 — 한쪽만 써지는 경우 없음).
        SQL 복사 방식과 같은 계산을 씁니다. <b className="text-caution">[발급]은 진짜로 등록됩니다 — 시험 삼아 누르지 마십시오.</b>
      </p>

      {!previewOpen ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={errCount > 0}
          className="text-sm font-semibold border border-pen text-pen hover:bg-pen/5 px-4 py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          미리보기
        </button>
      ) : (
        <div className="space-y-3">
          <table className="w-full max-w-xl text-sm">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-rule last:border-0">
                  <td className="py-1.5 pr-3 text-xs text-ink-faint w-32">{label}</td>
                  <td className="py-1.5 font-semibold text-ink">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {done ? (
            <div className="border border-ok/30 bg-ok-soft rounded-card p-4 text-sm space-y-2">
              <p className="font-bold text-ok">발급되었습니다 — 아래는 두 표에서 실제로 다시 읽은 값입니다</p>
              <p className="text-ink">
                기관명 <b>{done.orgName ?? '(조회 실패)'}</b> · 등록된 대수 <b>{done.tier ?? '(조회 실패)'}</b> ·
                계약 PC 수 <b>{done.pcCount ?? '(조회 실패)'}</b> · 만료{' '}
                <b>{done.expiresAt ? formatDateTimeKR(done.expiresAt) : '(조회 실패)'}</b>
              </p>
              {done.serverMonthlyLimit != null ? (
                <p className="text-ink">
                  서버 계산 함수 기준 이번 달 한도 <b>{won(done.serverMonthlyLimit)}</b> — 위 검산과 같아야 정상입니다.
                </p>
              ) : (
                <p className="text-xs text-ink-soft">
                  이번 달 한도·1인당 몫은 위 검산과 같은 규칙으로 계산된 값입니다(서버 함수 값 아님).
                  서버 함수 기준의 최종 확인은 5번의 「확인 SQL」을 SQL Editor에서 실행해 주세요.
                </p>
              )}
              <button
                type="button"
                onClick={resetForNext}
                className="text-sm font-semibold border border-rule text-ink-soft hover:text-ink hover:border-ink-faint px-4 py-2 rounded-md transition-colors"
              >
                다음 발급 준비
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleIssue}
                disabled={pending || errCount > 0}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-pen text-white hover:bg-pen-dark px-5 py-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? '발급 중…' : '발급'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                disabled={pending}
                className="text-sm text-ink-soft hover:text-ink px-3 py-2 transition-colors"
              >
                닫기
              </button>
            </div>
          )}

          {failReason && (
            <div className="border border-caution/30 bg-caution-soft rounded-card p-3 text-sm text-caution">{failReason}</div>
          )}
        </div>
      )}
    </div>
  )
}
