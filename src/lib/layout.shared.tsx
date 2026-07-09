/**
 * @파일: lib/layout.shared.tsx
 * @설명: 매뉴얼/블로그 Fumadocs 레이아웃의 공통 옵션.
 *        상단 로고 클릭 시 CoreZent 홈('/')으로 이동해 마케팅 사이트와의 이동 동선을 유지한다.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

/**
 * @함수명: baseOptions
 * @설명: Fumadocs 레이아웃(DocsLayout 등)에 주입할 기본 네비게이션 옵션을 반환한다.
 * @반환값: BaseLayoutProps — 상단 타이틀·홈 링크
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'CoreZent 매뉴얼',
      url: '/',
    },
  }
}
