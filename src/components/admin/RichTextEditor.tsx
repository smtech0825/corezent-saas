'use client'

/**
 * @컴포넌트: RichTextEditor
 * @설명: 관리자 상품 "설명" 문서 편집기(WYSIWYG) — TipTap 기반.
 *        툴바: 텍스트 크기(제목1/제목2/본문)·굵게·기울임·밑줄·글자색(팔레트)·링크·이미지 업로드·목록·유튜브·실행취소.
 *        선택한 이미지는 크기 버튼(소/중/대/원본)으로 폭 조절(width 속성 저장). 값은 HTML로 상위에 전달되고,
 *        서버 저장 시점에 sanitize된다(이 컴포넌트는 sanitize를 하지 않는다). 레거시 텍스트는 로드 시 HTML로 변환.
 *        번들 최소화를 위해 admin에서 next/dynamic(ssr:false)로만 로드한다.
 */

import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Image as ImageIcon,
  List, ListOrdered, Undo2, Redo2, Video, Eraser,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { looksLikeHtml, legacyToHtml, youtubeId } from '@/lib/rich-html'
import { ResizableImage } from './tiptap-image'

interface Props {
  value: string
  onChange: (html: string) => void
}

// 글자색 팔레트 — @theme 토큰(먹·볼펜·인주·회색) 위주 + 가독성 좋은 보조색
const COLORS: { label: string; hex: string }[] = [
  { label: '먹', hex: '#23272E' },
  { label: '볼펜 파랑', hex: '#1D3FB0' },
  { label: '인주 빨강', hex: '#C93A2C' },
  { label: '회색', hex: '#565C66' },
  { label: '초록', hex: '#1E7F4F' },
  { label: '주황', hex: '#B45309' },
  { label: '청록', hex: '#0E7490' },
  { label: '보라', hex: '#6D28D9' },
]

// 이미지 폭 프리셋(px) — '원본'은 width 제거(자연 크기, .rich-content가 100%로 상한)
const IMG_SIZES: { label: string; width: string | null }[] = [
  { label: '소', width: '320' },
  { label: '중', width: '480' },
  { label: '대', width: '768' },
  { label: '원본', width: null },
]

/** 툴바 아이콘 버튼 */
function TB({
  onClick, active, disabled, title, children,
}: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-mark/10 text-mark' : 'text-ink-soft hover:text-ink hover:bg-paper-shade'
      }`}
    >
      {children}
    </button>
  )
}

/** 텍스트형 툴바 버튼(제목1/제목2/본문) */
function TBText({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
        active ? 'bg-mark/10 text-mark' : 'text-ink-soft hover:text-ink hover:bg-paper-shade'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const editor = useEditor({
    immediatelyRender: false, // Next SSR hydration 안전(어차피 ssr:false로 로드)
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false, codeBlock: false, code: false, strike: false, horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
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

  if (!editor) {
    return <div className="border border-rule rounded-lg bg-paper h-48 animate-pulse" aria-hidden />
  }

  const imageSelected = editor.isActive('image')

  return (
    <div className="border border-rule rounded-lg bg-paper overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 flex-wrap border-b border-rule bg-paper-raised px-2 py-1.5">
        <TBText onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목1">제목1</TBText>
        <TBText onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목2">제목2</TBText>
        <TBText onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="본문">본문</TBText>

        <span className="mx-1 h-4 w-px bg-rule" />

        <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><Bold size={15} /></TB>
        <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><Italic size={15} /></TB>
        <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={15} /></TB>

        <span className="mx-1 h-4 w-px bg-rule" />

        {/* 글자색 팔레트 */}
        {COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={`글자색: ${c.label}`}
            aria-label={`글자색: ${c.label}`}
            onClick={() => editor.chain().focus().setColor(c.hex).run()}
            className="w-5 h-5 rounded-full border border-rule hover:scale-110 transition-transform"
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <TB onClick={() => editor.chain().focus().unsetColor().run()} title="글자색 지우기"><Eraser size={15} /></TB>

        <span className="mx-1 h-4 w-px bg-rule" />

        <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="불릿 목록"><List size={15} /></TB>
        <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 목록"><ListOrdered size={15} /></TB>
        <TB onClick={setLink} active={editor.isActive('link')} title="링크"><LinkIcon size={15} /></TB>
        <TB onClick={() => fileRef.current?.click()} disabled={uploading} title={uploading ? '업로드 중…' : '이미지 삽입'}><ImageIcon size={15} /></TB>
        <TB onClick={insertYoutube} title="유튜브 삽입"><Video size={15} /></TB>

        <span className="mx-1 h-4 w-px bg-rule" />

        <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="실행취소"><Undo2 size={15} /></TB>
        <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="다시실행"><Redo2 size={15} /></TB>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* 이미지 선택 시 크기 조절 바 */}
      {imageSelected && (
        <div className="flex items-center gap-1.5 border-b border-rule bg-paper-shade px-3 py-1.5">
          <span className="text-xs text-ink-faint mr-1">이미지 크기</span>
          {IMG_SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => editor.chain().focus().updateAttributes('image', { width: s.width }).run()}
              className="text-xs px-2 py-1 rounded border border-rule text-ink-soft hover:text-ink hover:border-mark/40 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 편집 영역 — 공개 렌더러와 동일한 .rich-content 스타일로 WYSIWYG */}
      <EditorContent editor={editor} />

      {err && <p className="text-xs text-danger px-4 pb-2">{err}</p>}
    </div>
  )
}
