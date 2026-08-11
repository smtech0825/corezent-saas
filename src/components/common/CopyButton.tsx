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
import { Copy, Check } from 'lucide-react'

interface Props {
  /** 복사할 값. 비어 있으면 아무 일도 하지 않는다 */
  value: string
  /** 버튼 설명(마우스를 올렸을 때와 보조기기에 읽히는 이름) */
  title: string
  /** 화면마다 다른 생김새 — 그대로 전달받는다 */
  className: string
  /** 아이콘 크기(기본 13) */
  iconSize?: number
  /** 아이콘 옆에 글자를 함께 보일 때만 지정 */
  labels?: { idle: string; copied: string }
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
  const [copied, setCopied] = useState(false)
  // "복사됨" 표시를 되돌리는 예약. 다시 누르면 이전 예약을 취소하고, 화면을 떠날 때도 정리한다.
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current) }, [])

  /**
   * @함수명: handleCopy
   * @설명: 값을 클립보드에 복사하고 잠시 완료 표시를 켭니다. 복사가 실패하면(권한 거부·
   *        비보안 접속 등) 완료 표시를 켜지 않고 사유를 브라우저 기록에만 남깁니다 —
   *        복사되지 않았는데 "복사됨"이 뜨는 것이 가장 나쁩니다.
   * @반환값: 없음
   */
  async function handleCopy(): Promise<void> {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch (err) {
      console.error('[copy] 클립보드 복사 실패:', err)
      return
    }
    setCopied(true)
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setCopied(false), resetMs)
  }

  return (
    <button type="button" onClick={handleCopy} title={title} aria-label={title} className={className}>
      {copied
        ? <Check size={iconSize} className={copiedIconClassName} />
        : <Copy size={iconSize} />}
      {labels && (copied ? labels.copied : labels.idle)}
    </button>
  )
}
