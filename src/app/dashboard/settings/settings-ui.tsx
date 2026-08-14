'use client'

/**
 * @파일: dashboard/settings/settings-ui.tsx
 * @설명: 설정 화면 공용 서브 컴포넌트 — 입력 줄(FormField)·제출 버튼(SubmitButton)·입력칸 클래스.
 *        page.tsx 하단에 있던 정의를 그대로 옮긴 것(이메일 변경 섹션과 공유하기 위해 분리).
 *        설정 화면 계열에서만 쓴다 — 전역 공용 부품이 아니다.
 */

import { Loader2 } from 'lucide-react'

/** 설정 화면 입력칸 공통 클래스 */
export const inputCls = 'w-full bg-paper border border-rule rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors'

/**
 * @컴포넌트: FormField
 * @설명: 라벨 + 입력 요소 한 줄 묶음.
 */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-ink-soft mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/**
 * @컴포넌트: SubmitButton
 * @설명: 설정 화면 공통 제출 버튼 — 진행 중엔 스피너와 함께 비활성화.
 */
export function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full sm:w-auto bg-mark text-white font-semibold py-3 sm:py-2.5 px-5 rounded-lg text-sm hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  )
}
