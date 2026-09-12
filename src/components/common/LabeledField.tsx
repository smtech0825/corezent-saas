'use client'

/**
 * @컴포넌트: LabeledField
 * @설명: "이름표 + 입력칸" 한 줄을 만드는 공용 부품 — 이름표와 입력칸을 실제로 연결한다.
 *
 *        왜 필요한가: 화면낭독기(시각장애인용 읽어주는 프로그램)와 키보드 사용자는
 *        이름표가 입력칸에 연결돼 있어야 "이 칸이 무슨 칸인지"를 알 수 있다.
 *        글자만 위에 그려두면 눈으로는 보이지만 연결은 없는 상태라 칸 이름이 읽히지 않는다.
 *
 *        어떻게: 화면마다 고유한 id를 자동으로 만들어(useId) 이름표의 htmlFor와
 *        입력칸의 id를 같은 값으로 묶는다. 사용처에서 id를 직접 적을 필요가 없다.
 *        입력칸이 이미 자기 id를 갖고 있으면 그 값을 존중해 덮어쓰지 않는다.
 *
 *        모양은 바꾸지 않는다 — 기존 이름표/입력칸 배치를 그대로 두고 연결만 더한다.
 */

import { cloneElement, isValidElement, useId } from 'react'
import type { ReactElement, ReactNode } from 'react'

interface Props {
  /** 이름표 글자 */
  label: string
  /** 이름표에 붙일 클래스 — 화면마다 크기·색이 달라 사용처가 정한다 */
  labelClassName?: string
  /** 바깥 상자 클래스 */
  className?: string
  /** 입력칸(하나) */
  children: ReactNode
}

export default function LabeledField({ label, labelClassName, className, children }: Props) {
  const autoId = useId()

  // 입력칸에 id를 심어 이름표와 묶는다. 이미 id가 있으면 그대로 둔다.
  let controlId = autoId
  let control = children
  if (isValidElement(children)) {
    const el = children as ReactElement<{ id?: string }>
    if (el.props.id) {
      controlId = el.props.id
    } else {
      control = cloneElement(el, { id: autoId })
    }
  }

  return (
    <div className={className}>
      <label htmlFor={controlId} className={labelClassName}>
        {label}
      </label>
      {control}
    </div>
  )
}
