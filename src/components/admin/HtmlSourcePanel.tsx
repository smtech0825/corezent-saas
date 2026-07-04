'use client'

/**
 * @컴포넌트: HtmlSourcePanel
 * @설명: 리치 편집기 HTML 소스 모드 패널 — 모노스페이스 textarea로 HTML을 직접 편집·붙여넣기하고,
 *        [파일 불러오기]로 .html 파일의 <body> 내부만 읽어 커서 위치에 삽입한다(업로드 아님, 클라이언트에서 읽기만).
 *        실제 정제는 소스 모드를 끌 때(toggle-off)와 서버 저장 시점에 수행된다.
 */

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { extractHtmlBody } from '@/lib/sanitize-client'

interface Props {
  value: string
  onChange: (v: string) => void
  onError: (msg: string) => void
}

/**
 * @함수명: HtmlSourcePanel
 * @설명: HTML 소스 편집 textarea + .html 파일 불러오기 버튼을 렌더한다.
 * @매개변수: value - 현재 소스 HTML, onChange - 소스 변경 콜백, onError - 파일 오류 알림 콜백
 * @반환값: 소스 패널 노드
 */
export default function HtmlSourcePanel({ value, onChange, onError }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /** .html 파일을 읽어 <body> 내부만 추출해 현재 커서 위치에 삽입한다 */
  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.html?$/i.test(file.name)) {
      onError('.html 파일만 불러올 수 있습니다.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      const text = await file.text()
      const body = extractHtmlBody(text)
      const ta = taRef.current
      if (ta) {
        const start = ta.selectionStart
        const end = ta.selectionEnd
        onChange(value.slice(0, start) + body + value.slice(end))
      } else {
        onChange(value + body)
      }
    } catch {
      onError('파일을 읽지 못했습니다.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-ink-faint">
          HTML 소스 — 직접 편집·붙여넣기하거나 .html 파일을 불러오세요. 끄면 정리 후 리치 편집으로 돌아갑니다.
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-rule text-ink-soft hover:text-ink hover:border-mark/40 transition-colors shrink-0"
        >
          <Upload size={13} /> 파일 불러오기
        </button>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="<h2>제목</h2>&#10;<p>내용…</p>"
        className="w-full min-h-[16rem] font-mono text-xs leading-relaxed text-ink bg-paper border border-rule rounded p-3 focus:outline-none focus:border-mark/40 resize-y"
      />
      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={loadFile}
      />
    </div>
  )
}
