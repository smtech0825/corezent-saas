'use client'

/**
 * @컴포넌트: AttachmentField
 * @설명: 첨부파일 선택 칸(드래그&드롭) — 비회원 문의 폼(ContactForm)에 있던 것을
 *        공용 부품으로 추출한 것. 로그인 고객 문의 폼과 나눠 쓴다(사본 금지).
 *        모양·문구·5MB 제한 모두 기존 비회원 폼과 동일 — 동작 변화 없음.
 *        파일 저장·형식 차단은 이 부품의 일이 아니다(각 제출 경로의 서버가 담당).
 */

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

/** 첨부 최대 크기 — 비회원 문의 폼과 동일한 5MB (새 값을 정하지 않는다) */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024

/**
 * @함수명: formatFileSize
 * @설명: 바이트 수를 사람이 읽는 단위(B·KB·MB)로 바꿉니다.
 * @매개변수: bytes - 파일 크기(바이트)
 * @반환값: "1.2 MB" 형태의 문자열
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentField({ file, onChange, idPrefix = 'attach' }: {
  /** 현재 선택된 파일(없으면 null) — 부모가 상태를 소유한다 */
  file: File | null
  /** 파일 선택·제거 시 호출(제거는 null) */
  onChange: (file: File | null) => void
  /** 같은 화면에 두 개 이상 있을 때 대비한 id 접두어 */
  idPrefix?: string
}) {
  const { showToast } = useToast()
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * @함수명: handleFile
   * @설명: 선택된 파일을 크기 검사 후 부모에 전달합니다(비회원 폼과 동일한 검사).
   * @매개변수: f - 선택된 파일(없으면 무시)
   */
  function handleFile(f: File | null): void {
    if (!f) return
    if (f.size > MAX_ATTACHMENT_SIZE) {
      showToast('error', '파일 크기는 5MB 이하여야 합니다.')
      return
    }
    onChange(f)
  }

  function onDragOver(e: DragEvent): void {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave(e: DragEvent): void {
    e.preventDefault()
    setDragging(false)
  }
  function onDrop(e: DragEvent): void {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }
  function onFileChange(e: ChangeEvent<HTMLInputElement>): void {
    handleFile(e.target.files?.[0] ?? null)
  }

  return !file ? (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative cursor-pointer rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors ${
        dragging
          ? 'border-pen bg-pen/5'
          : 'border-rule hover:border-pen/40 bg-paper-shade/50'
      }`}
    >
      <Upload size={24} className="mx-auto text-ink-faint mb-2" />
      <p className="text-sm text-ink-soft">
        파일을 여기에 끌어다 놓거나 <span className="text-pen underline underline-offset-2">찾아보기</span>
      </p>
      <p className="text-xs text-ink-faint mt-1">최대 5MB</p>
      <input
        ref={fileInputRef}
        id={`${idPrefix}-file-input`}
        type="file"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-paper border border-rule">
      <div className="w-9 h-9 rounded-md bg-pen/10 border border-pen/20 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-pen" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate">{file.name}</p>
        <p className="text-xs text-ink-faint">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label="첨부 파일 제거"
        className="text-ink-faint hover:text-seal transition-colors p-1"
      >
        <X size={16} />
      </button>
    </div>
  )
}
