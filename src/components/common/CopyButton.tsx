'use client'

/**
 * @컴포넌트: CopyButton
 * @설명: 값을 클립보드로 복사하고 잠시 "복사됨"을 보여주는 공용 버튼.
 *        같은 처리(복사 → 표시 → 이전 예약 취소 → 화면을 떠날 때 정리 → 실패 처리)가
 *        라이선스 키·추천 링크·결제 URL 세 곳에 각각 복사돼 있었다. 한 곳만 고쳐지는 일이
 *        실제로 생겨(실패 처리가 한 곳에만 있었다) 하나로 합친다.
 *
 *        생김새는 화면마다 달라 props로 받는다. 처리는 여기 한 곳에만 둔다.
 */

import { useState, useRef, useEffect } from 'react'
import { Copy, Check, X } from 'lucide-react'

/** 버튼 표시 상태 — 평소 / 복사됨 / 복사 실패 */
type CopyState = 'idle' | 'copied' | 'failed'

/** 실패 표시 최소 유지 시간(밀리초) — 성공보다 오래 보여야 실패를 알아챌 수 있다 */
const FAILED_MIN_MS = 4000

interface Props {
  /** 복사할 값. 비어 있으면 아무 일도 하지 않는다 */
  value: string
  /** 버튼 설명(마우스를 올렸을 때와 보조기기에 읽히는 이름) */
  title: string
  /** 화면마다 다른 생김새 — 그대로 전달받는다 */
  className: string
  /** 아이콘 크기(기본 13) */
  iconSize?: number
  /** 아이콘 옆에 글자를 함께 보일 때만 지정. failed 생략 시 "복사 실패" */
  labels?: { idle: string; copied: string; failed?: string }
  /** 복사됨 아이콘에만 다른 색을 줄 때 지정 */
  copiedIconClassName?: string
  /** "복사됨" 표시를 유지할 시간(밀리초, 기본 2000) */
  resetMs?: number
}

export default function CopyButton({
  value,
  title,
  className,
  iconSize = 13,
  labels,
  copiedIconClassName,
  resetMs = 2000,
}: Props) {
  const [state, setState] = useState<CopyState>('idle')
  // 표시를 되돌리는 예약. 다시 누르면 이전 예약을 취소하고, 화면을 떠날 때도 정리한다.
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current) }, [])

  /**
   * @함수명: showBriefly
   * @설명: 버튼을 잠시 지정한 상태로 바꿨다가 원래 모습으로 되돌리는 예약을 겁니다.
   * @매개변수: next - 보여줄 상태 / holdMs - 유지 시간(밀리초)
   * @반환값: 없음
   */
  function showBriefly(next: CopyState, holdMs: number): void {
    setState(next)
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setState('idle'), holdMs)
  }

  /**
   * @함수명: handleCopy
   * @설명: 값을 클립보드에 복사하고 잠시 완료 표시를 켭니다. 복사가 실패하면(권한 거부·
   *        비보안 접속·미지원 브라우저) 버튼 자체가 실패 표시로 바뀝니다 — 알림(Toast)
   *        자리는 관리자 화면에 없어, 부품이 스스로 보여줘야 모든 사용처가 같아집니다.
   *        조용히 넘어가면 손님은 예전 클립보드 값을 붙여넣고도 이유를 알 수 없습니다.
   *        실패 원문은 브라우저 기록에만 남깁니다.
   * @반환값: 없음
   */
  async function handleCopy(): Promise<void> {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch (err) {
      console.error('[copy] 클립보드 복사 실패:', err)
      showBriefly('failed', Math.max(resetMs, FAILED_MIN_MS))
      return
    }
    showBriefly('copied', resetMs)
  }

  // 실패 중에는 버튼 설명도 실패 안내로 바꾼다(마우스 올림·보조기기 모두 이 문구를 읽는다)
  const shownTitle =
    state === 'failed' ? '복사하지 못했습니다. 값을 직접 선택해 복사해 주세요.' : title

  return (
    <button type="button" onClick={handleCopy} title={shownTitle} aria-label={shownTitle} className={className}>
      {state === 'copied' && <Check size={iconSize} className={copiedIconClassName} />}
      {state === 'failed' && <X size={iconSize} className="text-danger" />}
      {state === 'idle' && <Copy size={iconSize} />}
      {labels && (
        state === 'copied' ? labels.copied
        : state === 'failed' ? (labels.failed ?? '복사 실패')
        : labels.idle
      )}
    </button>
  )
}
