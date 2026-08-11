'use client'

/**
 * @컴포넌트: TicketStatusButton
 * @설명: 티켓 상태를 바꾸는 버튼(닫기·다시 열기) 전용. 이 화면에서만 쓴다.
 *        서버 기능을 <form action>으로 직접 걸면 실패가 화면 전체를 오류 화면으로 바꾸면서
 *        영문 문구가 그대로 노출되므로, 결과값을 받아 한국어로 알리기 위해 버튼만 감싼다.
 *        알림은 관리자 화면이 이미 쓰는 방식(runAdminAction)을 그대로 쓴다.
 */

import { useTransition } from 'react'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'

interface Props {
  /** 버튼에 보이는 문구이자 실패 알림에 들어갈 동작 이름 */
  label: string
  /** 기존 버튼과 같은 모양을 유지하기 위해 화면에서 그대로 넘겨받는다 */
  className: string
  action: () => Promise<AdminActionResult>
}

export default function TicketStatusButton({ label, className, action }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    // 처리 중에는 받지 않는다 — 같은 화면의 답변 보내기와 같은 보호다.
    if (isPending) return
    startTransition(async () => {
      await runAdminAction(label, action)
    })
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {label}
    </button>
  )
}
