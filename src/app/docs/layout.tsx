/**
 * @파일: app/docs/layout.tsx
 * @설명: /docs(매뉴얼) 세그먼트 레이아웃. Fumadocs RootProvider + DocsLayout을 이 세그먼트에만
 *        적용해 마케팅/대시보드/관리자에는 영향을 주지 않는다(CSS도 여기서만 import).
 *        사이트가 라이트 전용이므로 next-themes(다크모드 토글)는 비활성화한다.
 */
import '../fumadocs.css'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'

/**
 * @함수명: DocsRootLayout
 * @설명: 매뉴얼 하위 페이지를 사이드바 트리와 함께 감싸는 레이아웃.
 * @매개변수: children - 매뉴얼 문서 페이지
 */
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout tree={source.pageTree} {...baseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
