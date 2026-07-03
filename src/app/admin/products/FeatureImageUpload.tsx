'use client'

/**
 * @컴포넌트: FeatureImageUpload
 * @설명: 파일 업로드 → Supabase Storage(logos 버킷) → public URL 반환. 미리보기 + 초기화 포함.
 *        제품 폼의 특징 아이콘·대표 이미지·스크린샷 입력에서 공용으로 사용.
 */

import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * @함수명: FeatureImageUpload
 * @설명: 이미지 파일을 업로드하고 결과 public URL을 onChange로 전달한다.
 * @매개변수: value - 현재 이미지 URL, onChange - URL 변경 콜백
 */
export default function FeatureImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const filename = `feat-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(filename, file, { upsert: true })
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(data.path)
    onChange(publicUrl)
    setUploading(false)
  }

  function clear() {
    onChange('')
    if (fileRef.current) fileRef.current.value = ''
    setError('')
  }

  return (
    <div className="space-y-1">
      {value ? (
        <div className="flex items-center gap-2 p-2 bg-paper-raised rounded-lg border border-rule">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="feature preview" className="w-8 h-8 object-contain rounded shrink-0" />
          <span className="text-xs text-ink-faint truncate flex-1">{value.split('/').pop()}</span>
          <button type="button" onClick={clear} className="shrink-0 text-ink-faint hover:text-danger transition-colors">
            <X size={12} />
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-colors w-full ${
            uploading
              ? 'opacity-40 cursor-not-allowed border-rule text-ink-faint'
              : 'cursor-pointer border-rule text-ink-soft hover:text-ink hover:border-mark/40'
          }`}
        >
          <Upload size={11} />
          {uploading ? '업로드 중...' : '이미지 업로드 (투명 PNG)'}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
