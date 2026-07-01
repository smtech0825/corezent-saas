import type { Metadata } from 'next'

/**
 * @파일: dashboard/settings/layout.tsx
 * @설명: 설정 페이지 메타데이터 전용 서버 레이아웃.
 *        page.tsx가 'use client'라 metadata를 직접 export할 수 없어,
 *        탭 제목만 주입하는 얇은 서버 레이아웃으로 분리한다. (화면/동작 변경 없음)
 *        루트 title.template('%s | CoreZent') 우회 위해 absolute 사용 (legal 페이지와 동일 방식)
 */
export const metadata: Metadata = {
  title: { absolute: '설정 — CoreZent' },
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
