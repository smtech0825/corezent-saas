'use client'

/**
 * @컴포넌트: AcquiredRegulatedField
 * @설명: '취득 당시 조정대상지역 여부' 입력칸 — 양도소득세와 매도 실수령액 폼이 공유한다
 *        (같은 엔진을 쓰므로 문구가 갈리면 안 된다).
 *        자동 판정이 켜져 있으면(커버리지 룰 등록) 비워 두는 것이 기본이고, 서버가 등록된
 *        이력으로 판정해 결과에 근거를 표시한다. 꺼져 있으면 예전처럼 선택을 요구한다 —
 *        그대로 두면 서버가 반드시 실패해 첫 제출이 헛걸음이 되기 때문이다.
 *        어느 경우든 직접 선택한 값이 자동 판정보다 우선한다.
 */

import { Field } from '@/components/ui/Input'

/** Input과 톤을 맞춘 select 클래스 (계산기 폼과 동일 관례) */
const SELECT_CLS =
  'w-full rounded-md border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink transition-colors focus:border-pen focus:ring-2 focus:ring-pen/15 focus:outline-none disabled:opacity-50'

const HINT_AUTO =
  '비워 두면 등록된 지정 이력으로 취득일 기준 자동 판정합니다(판정 결과와 근거를 결과에 표시합니다). 자동으로 판정할 수 없는 경우에는 이유와 함께 직접 선택을 요청합니다. 직접 선택하면 그 값이 자동 판정보다 우선합니다. 비과세 거주 요건 판정에만 쓰입니다.'
const HINT_MANUAL =
  '지정 이력이 아직 등록되지 않아 자동 판정을 할 수 없습니다. 취득 당시 국토교통부 공고 또는 관할 시·군·구에서 확인 후 직접 선택하세요. 비과세 거주 요건 판정에만 쓰입니다.'

export default function AcquiredRegulatedField({ id, value, onChange, autoEnabled }: {
  /** 입력칸 id — 계산기마다 다르다(tr-acq-regulated·np-acq-regulated) */
  id: string
  value: '' | 'yes' | 'no'
  onChange: (v: '' | 'yes' | 'no') => void
  /** 자동 판정이 켜져 있는지 — 기본값 라벨과 필수 여부가 갈린다 */
  autoEnabled: boolean
}) {
  return (
    <Field label="취득 당시 조정대상지역 여부" htmlFor={id} required={!autoEnabled}
      hint={autoEnabled ? HINT_AUTO : HINT_MANUAL}>
      <select id={id} className={SELECT_CLS} value={value}
        onChange={(e) => onChange(e.target.value as '' | 'yes' | 'no')}>
        <option value="">{autoEnabled ? '자동 판정 (권장)' : '선택'}</option>
        <option value="yes">예 — 취득 당시 조정대상지역</option>
        <option value="no">아니요 — 취득 당시 비규제</option>
      </select>
    </Field>
  )
}
