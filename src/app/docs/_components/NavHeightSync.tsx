'use client'

/**
 * @컴포넌트: NavHeightSync
 * @설명: 매뉴얼(/docs)에서 사이트 상단 Navbar가 화면에 남아 있는 높이를 Fumadocs의 `--fd-banner-height`에 반영한다.
 *        이 값이 있어야 Fumadocs 사이드바·TOC·모바일 서브내비가 사이트 헤더 바로 아래에 붙는다.
 *        매뉴얼의 머리말은 고정이 아니라 본문과 함께 올라가므로(docs/layout.tsx의 sticky={false}),
 *        스크롤에 따라 "남아 있는 높이"가 줄어든다 → 머리말이 다 올라가면 0이 되어 띠들이 화면 맨 위에 붙는다.
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
    let last = -1
    const apply = () => {
      // 화면 위쪽에 남아 있는 머리말 높이 = 머리말 아랫변의 화면 좌표(다 올라갔으면 음수 → 0)
      const visible = Math.max(0, Math.round(header.getBoundingClientRect().bottom))
      // 같은 값을 다시 쓰면 불필요한 스타일 갱신이 생긴다(스크롤 중 프레임 낭비 방지)
      if (visible === last) return
      last = visible
      root.style.setProperty('--fd-banner-height', `${visible}px`)
    }

    // 스크롤은 프레임당 한 번만 반영한다 — 이벤트마다 스타일을 건드리면 스크롤이 덜컹거린다
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        apply()
      })
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(header)
    window.addEventListener('resize', apply)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
      window.removeEventListener('scroll', onScroll)
      root.style.removeProperty('--fd-banner-height')
    }
  }, [])

  return null
}
