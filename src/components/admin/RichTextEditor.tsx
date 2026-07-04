'use client'

/**
 * @컴포넌트: RichTextEditor
 * @설명: 관리자 리치 텍스트 편집기(WYSIWYG) — TipTap 기반. 상품 설명·FAQ 답변·소개 블록 등 공용으로 쓰인다.
 *        툴바: 텍스트 크기·굵게·기울임·밑줄·정렬·글자색·링크·이미지 업로드·목록·유튜브·실행취소 (EditorToolbar).
 *        [HTML 소스] 토글: 현재 내용을 HTML 소스로 직접 편집·붙여넣기·.html 파일 불러오기(HtmlSourcePanel). 끄면 클라이언트에서
 *        정제(sanitizeClientHtml — 편의용, 보안 경계는 서버 저장 시)한 뒤 리치 편집으로 복귀하고, 제거된 태그를 1회 안내한다.
 *        표·유튜브 임베드 등 리치 편집기가 표현할 수 없는 태그가 있으면 내용 보존을 위해 소스 모드를 유지한다.
 *        값은 HTML로 상위에 전달되며 서버 저장 시점에 반드시 sanitize된다(이 컴포넌트는 보안 정제를 책임지지 않는다).
 *        번들 최소화를 위해 admin에서 next/dynamic(ssr:false)로만 로드한다.
 */

import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { createClient } from '@/lib/supabase/client'
import { looksLikeHtml, youtubeId } from '@/lib/rich-html'
import { legacyToHtml } from '@/lib/legacy-markdown'
import { sanitizeClientHtml } from '@/lib/sanitize-client'
import { hasSourceOnlyTags } from '@/lib/rich-allowlist'
import { ResizableImage } from './tiptap-image'
import EditorToolbar from './EditorToolbar'
import HtmlSourcePanel from './HtmlSourcePanel'

interface Props {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  // 표·임베드가 든 값은 리치 편집기가 표현할 수 없으므로 소스 모드로 시작한다
  const [mode, setMode] = useState<'rich' | 'source'>(() => (hasSourceOnlyTags(value) ? 'source' : 'rich'))
  const [sourceText, setSourceText] = useState<string>(() => value ?? '')

  const editor = useEditor({
    immediatelyRender: false, // Next SSR hydration 안전(어차피 ssr:false로 로드)
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // 인용(blockquote)·구분선(horizontalRule)은 허용목록에 포함되므로 리치 편집에서 그대로 다룬다.
        codeBlock: false, code: false, strike: false,
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      // 정렬(왼쪽/가운데/오른쪽) — 제목·본문 문단에 적용. style="text-align:…"로 출력되며 sanitize allowlist가 이 값만 허용한다.
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
    ],
    content: looksLikeHtml(value) ? value : legacyToHtml(value),
    editorProps: { attributes: { class: 'rich-content min-h-[12rem] px-4 py-3 focus:outline-none' } },
    // 빈 편집기는 <p></p>를 반환 → 빈 설명이 null이 아니게 저장되는 것을 막기 위해 빈 문자열로 정규화
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // 이미지 업로드 — 로고/스크린샷과 동일한 Supabase Storage(logos 버킷) 규칙 재사용
  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      setUploading(true)
      setErr('')
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const filename = `desc-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabase.storage.from('logos').upload(filename, file, { upsert: true })
      if (error) {
        setErr(`이미지 업로드 실패: ${error.message}`)
        setUploading(false)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(data.path)
      editor.chain().focus().setImage({ src: publicUrl }).run()
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    [editor],
  )

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 URL을 입력하세요', prev ?? 'https://')
    if (url === null) return
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  const insertYoutube = useCallback(() => {
    if (!editor) return
    const url = window.prompt('유튜브 URL (youtu.be/… 또는 watch?v=…)')?.trim()
    if (!url) return
    if (!youtubeId(url)) { setErr('유효한 유튜브 URL이 아닙니다.'); return }
    setErr('')
    editor.chain().focus().insertContent({ type: 'paragraph', content: [{ type: 'text', text: url }] }).run()
  }, [editor])

  // 소스 모드 변경 시 값 전파(서버에서 sanitize되므로 원본 그대로 전달)
  const onSourceChange = useCallback((v: string) => {
    setSourceText(v)
    onChange(v)
  }, [onChange])

  // [HTML 소스] 토글 — 리치↔소스 전환. 소스→리치 전환 시 정제하고 제거된 태그를 안내한다.
  const toggleSource = useCallback(() => {
    if (!editor) return
    setErr('')
    if (mode === 'rich') {
      setSourceText(editor.getHTML())
      setNotice('')
      setMode('source')
      return
    }
    const { html, removed } = sanitizeClientHtml(sourceText)
    onChange(html)
    const msgs: string[] = []
    if (removed.length) msgs.push(`일부 지원되지 않는 태그가 정리되었습니다: ${removed.join(', ')}`)
    if (hasSourceOnlyTags(html)) {
      // 표·임베드는 리치 편집기에서 표현할 수 없으므로 소스 모드를 유지(내용은 정제·보존, 저장은 정상 동작)
      setSourceText(html)
      msgs.push('표·유튜브 임베드 등은 리치 편집기에서 다룰 수 없어 소스 모드를 유지합니다(저장은 정상 동작합니다).')
      setNotice(msgs.join('\n'))
      return
    }
    editor.commands.setContent(html, false)
    setNotice(msgs.join('\n'))
    setMode('rich')
  }, [editor, mode, sourceText, onChange])

  if (!editor) {
    return <div className="border border-rule rounded-lg bg-paper h-48 animate-pulse" aria-hidden />
  }

  return (
    <div className="border border-rule rounded-lg bg-paper overflow-hidden">
      <EditorToolbar
        editor={editor}
        mode={mode}
        uploading={uploading}
        onToggleSource={toggleSource}
        onLink={setLink}
        onYoutube={insertYoutube}
        onUploadClick={() => fileRef.current?.click()}
      />

      {/* 편집 영역 — 리치는 .rich-content로 WYSIWYG, 소스는 HTML textarea. 리치 편집기 인스턴스는 유지하고 CSS로만 숨긴다 */}
      <div className={mode === 'source' ? 'hidden' : ''}>
        <EditorContent editor={editor} />
      </div>
      {mode === 'source' && (
        <HtmlSourcePanel value={sourceText} onChange={onSourceChange} onError={setErr} />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleUpload}
      />

      {notice && (
        <p className="text-xs text-ink-soft bg-paper-shade border-t border-rule px-4 py-2 whitespace-pre-line">{notice}</p>
      )}
      {err && <p className="text-xs text-danger px-4 pb-2 pt-2">{err}</p>}
    </div>
  )
}
