/**
 * @파일: app/docs/layout.tsx
 * @설명: /docs(매뉴얼) 세그먼트 레이아웃. 사이트 공통 상단(Navbar)·하단(Footer)을 매뉴얼에도 적용하고,
 *        그 사이에 Fumadocs DocsLayout(사이드바 트리·TOC)을 배치한다.
 *        - Fumadocs RootProvider/CSS는 이 세그먼트에만 적용(마케팅/대시보드/관리자 무영향).
 *        - 사이트가 라이트 전용이므로 next-themes(다크모드 토글)는 비활성화한다.
 *        - NavHeightSync가 Navbar 높이를 `--fd-banner-height`로 동기화해 사이드바/TOC가 헤더 아래에 고정된다.
 */
import '../fumadocs.css'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { baseOptions } from '@/lib/layout.shared'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import NavHeightSync from './_components/NavHeightSync'

/**
 * @함수명: DocsRootLayout
 * @설명: 매뉴얼 하위 페이지를 사이트 헤더/푸터 + Fumadocs 사이드바로 감싸는 레이아웃.
 * @매개변수: children - 매뉴얼 문서 페이지
 */
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <div className="theme-paper bg-paper text-ink">
        <Navbar />
        <NavHeightSync />
        <DocsLayout tree={source.pageTree} {...baseOptions()}>
          {children}
        </DocsLayout>
        <Footer />
      </div>
    </RootProvider>
  )
}
