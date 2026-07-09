'use client'

/**
 * @컴포넌트: NavHeightSync
 * @설명: 매뉴얼(/docs)에서 사이트 상단 Navbar의 실제 높이를 측정해 Fumadocs의 `--fd-banner-height`에 반영한다.
 *        이 값이 있어야 Fumadocs 사이드바·TOC·모바일 서브내비가 사이트 헤더 바로 아래에 고정된다.
 *        (Navbar는 공지 배너 유무·반응형으로 높이가 달라지므로 런타임 측정이 필요하다)
 *        렌더 결과가 없는 순수 사이드이펙트 컴포넌트이며, /docs를 벗어나면 값을 원복한다.
 */
import { useEffect } from 'react'

export default function NavHeightSync() {
  useEffect(() => {
    // 페이지 첫 번째 <header> = 마케팅 Navbar(Fumadocs 모바일 서브내비 #nd-subnav보다 먼저 렌더됨)
    const header = document.querySelector('header')
    if (!header) return

    const root = document.documentElement
    const apply = () => {
      root.style.setProperty('--fd-banner-height', `${Math.round(header.getBoundingClientRect().height)}px`)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(header)
    window.addEventListener('resize', apply)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
      root.style.removeProperty('--fd-banner-height')
    }
  }, [])

  return null
}
