'use client'

/**
 * @컴포넌트: SaveAndViewButton
 * @설명: 콘텐츠 편집 화면 공용 "저장 후 새 탭에서 보기" 버튼 — 편집 화면마다 따로 만들지 않는
 *        단일 부품(주소만 받는다). ★ 실시간 미리보기 패널이 아니다(대표님 결정).
 *        - onSave가 있는 폼형 화면: 먼저 저장하고, 성공(status === 'ok')일 때만 새 탭을 연다.
 *          실패하면 열지 않는다(실패 알림은 runAdminAction이 담당 — 지난 라운드 반환값 방식 그대로).
 *        - onSave가 없는 화면(항목별 저장이 즉시 반영되는 목록 관리형): 저장할 폼이 없으므로
 *          링크로 바로 새 탭을 연다(팝업 차단 영향도 없음).
 *        기존 저장 버튼의 동작은 바꾸지 않는다 — 버튼을 하나 더하는 것이다.
 */

import { useTransition } from 'react'
import { ExternalLink } from 'lucide-react'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'

interface Props {
  /** 이 편집 화면에 대응하는 공개 주소(진단 0-5 대응표 근거) */
  url: string
  /** 폼형 에디터의 저장 함수 — 있으면 저장 성공 후에만 새 탭을 연다 */
  onSave?: () => Promise<AdminActionResult>
  /** 저장 동작 이름(실패 알림용, 예: '히어로 저장'). onSave가 있을 때만 쓰인다 */
  label?: string
  /** 기존 저장 버튼이 저장 중일 때 함께 잠그기 위한 외부 비활성(이중 저장 방지) */
  disabled?: boolean
  /** 이 버튼의 저장 진행 상태를 에디터에 알림 — 에디터가 기존 저장 버튼을 함께 잠글 수 있게 */
  onPendingChange?: (pending: boolean) => void
}

// 기존 저장 버튼과 같은 규격(w-full sm:w-auto·px-5 py-3 sm:py-2.5·rounded-xl)의 아웃라인 변형
const BTN_CLS =
  'w-full sm:w-auto flex items-center justify-center gap-2 border border-rule hover:border-mark/40 text-ink-soft hover:text-ink font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition-colors disabled:opacity-50'

export default function SaveAndViewButton({ url, onSave, label = '저장', disabled, onPendingChange }: Props) {
  const [isPending, startTransition] = useTransition()

  // 목록 관리형 — 저장할 폼이 없어 바로 연다
  if (!onSave) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={BTN_CLS}>
        <ExternalLink size={14} />
        새 탭에서 보기
      </a>
    )
  }

  function handleClick() {
    startTransition(async () => {
      onPendingChange?.(true)
      try {
        const res = await runAdminAction(label, onSave!)
        if (res.status !== 'ok') return // ★ 저장 실패 — 새 탭을 열지 않는다
        // ⚠️ windowFeatures에 'noopener'를 넣으면 사양상 항상 null이 반환돼 차단 감지가 불가능하다.
        //    창 참조를 받아 opener만 끊는다 — 차단 감지와 opener 차단을 둘 다 지킨다.
        const opened = window.open(url, '_blank')
        if (opened) {
          opened.opener = null
        } else {
          // 저장에 시간이 걸려 브라우저가 새 탭을 막은 경우 — 저장 자체는 끝났음을 알린다
          alert('저장은 완료됐지만 브라우저가 새 탭을 막았습니다. 팝업을 허용하거나 버튼을 다시 눌러 주세요.')
        }
      } finally {
        onPendingChange?.(false)
      }
    })
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending || disabled} className={BTN_CLS}>
      <ExternalLink size={14} />
      {isPending ? '저장 중…' : '저장 후 새 탭에서 보기'}
    </button>
  )
}
