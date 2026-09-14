'use client'

/**
 * @파일: dashboard/settings/settings-ui.tsx
 * @설명: 설정 화면 공용 서브 컴포넌트 — 입력 줄(FormField)·제출 버튼(SubmitButton)·입력칸 클래스.
 *        page.tsx 하단에 있던 정의를 그대로 옮긴 것(이메일 변경 섹션과 공유하기 위해 분리).
 *        설정 화면 계열에서만 쓴다 — 전역 공용 부품이 아니다.
 */

import { Loader2 } from 'lucide-react'
import { Field } from '@/components/ui/Input'

/** 설정 화면 입력칸 공통 클래스 */
export const inputCls = 'w-full bg-paper border border-rule rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark transition-colors'

/**
 * @컴포넌트: FormField
 * @설명: 라벨 + 입력 요소 한 줄 묶음.
 *        연결(이름표↔입력칸)은 공용 Field가 처리한다 — 화면낭독기가 칸 이름을 읽는다.
 *        htmlFor는 필수다. 자동으로 심어 주는 방식은 자식이 여럿인 줄(입력칸 + 안내 문구)에서
 *        조용히 실패했다 — 그래서 호출부가 id를 직접 적고 입력칸에 같은 id를 단다.
 *        모양(글자 크기·색·간격)은 이전과 같다 — labelClassName·className으로 그대로 넘긴다.
 */
export function FormField({
  label, htmlFor, children,
}: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <Field label={label} htmlFor={htmlFor} className="" labelClassName="block text-sm text-ink-soft mb-1.5">
      {children}
    </Field>
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
