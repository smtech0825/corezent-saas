'use client'

/**
 * @컴포넌트: EditorToolbar
 * @설명: RichTextEditor의 상단 툴바 + 이미지 크기 조절 바(리치 모드 전용) + [HTML 소스] 토글 버튼.
 *        서식 버튼은 리치 모드에서만 렌더하고, 소스 토글 버튼은 항상 우측에 노출한다(파일 300줄 제한 위해 분리).
 */

import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Image as ImageIcon,
  List, ListOrdered, Undo2, Redo2, Video, Eraser, Code, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'
import { setYoutubeControls } from '@/lib/rich-html'

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

// 유튜브 폭 프리셋(%) — 래퍼 max-width로 적용·가운데 정렬. '전체'는 width 제거(콘텐츠 폭 100%)
const VIDEO_SIZES: { label: string; width: string | null }[] = [
  { label: '소', width: '40%' },
  { label: '중', width: '60%' },
  { label: '대', width: '80%' },
  { label: '전체', width: null },
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

/** 텍스트형 툴바 버튼(제목1/제목2/본문/HTML) */
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

/** 소형 텍스트 버튼(이미지 크기·표 편집 컨텍스트 바 공용) */
function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border border-rule text-ink-soft hover:text-ink hover:border-mark/40 transition-colors"
    >
      {children}
    </button>
  )
}

interface Props {
  editor: Editor
  mode: 'rich' | 'source'
  uploading: boolean
  onToggleSource: () => void
  onLink: () => void
  onYoutube: () => void
  onUploadClick: () => void
}

/**
 * @함수명: EditorToolbar
 * @설명: 서식 툴바(리치 모드) + 소스 토글 버튼(항상) + 이미지 크기 바(이미지 선택 시)를 렌더한다.
 * @매개변수: editor - TipTap 인스턴스, mode - 현재 모드, uploading - 업로드 진행 여부, on* - 상위 핸들러
 * @반환값: 툴바 노드
 */
export default function EditorToolbar({
  editor, mode, uploading, onToggleSource, onLink, onYoutube, onUploadClick,
}: Props) {
  const richMode = mode === 'rich'
  const imageSelected = richMode && editor.isActive('image')
  const videoSelected = richMode && editor.isActive('youtube')
  const tableActive = richMode && editor.isActive('table')

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap border-b border-rule bg-paper-raised px-2 py-1.5">
        {richMode && (
          <>
            <TBText onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목1">제목1</TBText>
            <TBText onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목2">제목2</TBText>
            <TBText onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="본문">본문</TBText>

            <span className="mx-1 h-4 w-px bg-rule" />

            <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><Bold size={15} /></TB>
            <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><Italic size={15} /></TB>
            <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={15} /></TB>

            <span className="mx-1 h-4 w-px bg-rule" />

            <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬"><AlignLeft size={15} /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="가운데 정렬"><AlignCenter size={15} /></TB>
            <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬"><AlignRight size={15} /></TB>

            <span className="mx-1 h-4 w-px bg-rule" />

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
            <TB onClick={onLink} active={editor.isActive('link')} title="링크"><LinkIcon size={15} /></TB>
            <TB onClick={onUploadClick} disabled={uploading} title={uploading ? '업로드 중…' : '이미지 삽입'}><ImageIcon size={15} /></TB>
            <TB onClick={onYoutube} title="유튜브 삽입"><Video size={15} /></TB>
            <TB onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="표 삽입 (3×3)"><TableIcon size={15} /></TB>

            <span className="mx-1 h-4 w-px bg-rule" />

            <TB onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="실행취소"><Undo2 size={15} /></TB>
            <TB onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="다시실행"><Redo2 size={15} /></TB>
          </>
        )}

        {/* HTML 소스 토글 — 항상 우측에 노출 */}
        <div className="ml-auto flex items-center gap-1">
          <TBText onClick={onToggleSource} active={!richMode} title="HTML 소스 보기/편집">
            <span className="inline-flex items-center gap-1"><Code size={14} /> HTML</span>
          </TBText>
        </div>
      </div>

      {/* 이미지 선택 시 크기 조절 바 */}
      {imageSelected && (
        <div className="flex items-center gap-1.5 border-b border-rule bg-paper-shade px-3 py-1.5">
          <span className="text-xs text-ink-faint mr-1">이미지 크기</span>
          {IMG_SIZES.map((s) => (
            <SmallBtn key={s.label} onClick={() => editor.chain().focus().updateAttributes('image', { width: s.width }).run()}>
              {s.label}
            </SmallBtn>
          ))}
        </div>
      )}

      {/* 유튜브 선택 시 크기·컨트롤 조절 바 */}
      {videoSelected && (
        <div className="flex items-center gap-1.5 flex-wrap border-b border-rule bg-paper-shade px-3 py-1.5">
          <span className="text-xs text-ink-faint mr-1">동영상 크기</span>
          {VIDEO_SIZES.map((s) => (
            <SmallBtn key={s.label} onClick={() => editor.chain().focus().updateAttributes('youtube', { width: s.width }).run()}>
              {s.label}
            </SmallBtn>
          ))}
          <span className="mx-0.5 h-4 w-px bg-rule" />
          <span className="text-xs text-ink-faint mr-1">컨트롤</span>
          <SmallBtn onClick={() => editor.chain().focus().updateAttributes('youtube', { src: setYoutubeControls(editor.getAttributes('youtube').src, true) }).run()}>
            표시
          </SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().updateAttributes('youtube', { src: setYoutubeControls(editor.getAttributes('youtube').src, false) }).run()}>
            숨김
          </SmallBtn>
        </div>
      )}

      {/* 표 셀 안에 있을 때 표 편집 컨텍스트 바 — TipTap 표준 명령 */}
      {tableActive && (
        <div className="flex items-center gap-1.5 flex-wrap border-b border-rule bg-paper-shade px-3 py-1.5">
          <span className="text-xs text-ink-faint mr-1">표 편집</span>
          <SmallBtn onClick={() => editor.chain().focus().addRowBefore().run()}>행↑</SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().addRowAfter().run()}>행↓</SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().deleteRow().run()}>행 삭제</SmallBtn>
          <span className="mx-0.5 h-4 w-px bg-rule" />
          <SmallBtn onClick={() => editor.chain().focus().addColumnBefore().run()}>열←</SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>열→</SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().deleteColumn().run()}>열 삭제</SmallBtn>
          <span className="mx-0.5 h-4 w-px bg-rule" />
          <SmallBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()}>헤더행</SmallBtn>
          <SmallBtn onClick={() => editor.chain().focus().deleteTable().run()}>표 삭제</SmallBtn>
        </div>
      )}
    </>
  )
}
