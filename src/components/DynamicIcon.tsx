'use client'

/**
 * @컴포넌트: DynamicIcon
 * @설명: 멀티 라이브러리 + 원시 SVG 아이콘 렌더러
 *        - 접두사 없음 또는 lu: → Lucide (예: Cpu, lu:Cpu)
 *        - tb: → Tabler Icons (예: tb:Cpu → IconCpu)
 *        - ri: → Radix Icons (예: ri:Accessibility → AccessibilityIcon)
 *        - <svg ...>: 원시 SVG 문자열 직접 렌더링
 *
 *        각 라이브러리를 동적 import로 분리 — 초기 번들에 미포함
 */

import { type ComponentType, useEffect, useRef, useState } from 'react'

type IconComp = ComponentType<{
  size?: number
  width?: number
  height?: number
  className?: string
}>

interface Props {
  name: string
  size?: number
  className?: string
}

// 라이브러리별 아이콘 캐시 — 동일 이름 중복 로드 방지
const iconCache = new Map<string, IconComp | null>()

async function resolveIcon(n: string): Promise<IconComp | null> {
  if (iconCache.has(n)) return iconCache.get(n)!

  let icon: IconComp | null = null

  if (n.startsWith('tb:')) {
    const mod = await import('@tabler/icons-react')
    icon = (mod as unknown as Record<string, IconComp>)['Icon' + n.slice(3)] ?? null
  } else if (n.startsWith('ri:')) {
    const mod = await import('@radix-ui/react-icons')
    icon = (mod as unknown as Record<string, IconComp>)[n.slice(3) + 'Icon'] ?? null
  } else {
    const mod = await import('lucide-react')
    const lucideName = n.startsWith('lu:') ? n.slice(3) : n
    icon = (mod as unknown as Record<string, IconComp>)[lucideName] ?? null
  }

  iconCache.set(n, icon)
  return icon
}

export default function DynamicIcon({ name, size = 20, className }: Props) {
  const n = (name ?? '').trim()
  const [Icon, setIcon] = useState<IconComp | null>(() => iconCache.get(n) ?? null)
  const prevName = useRef(n)

  useEffect(() => {
    if (n.startsWith('<svg')) return
    if (iconCache.has(n)) {
      setIcon(iconCache.get(n) ?? null)
      return
    }
    let cancelled = false
    resolveIcon(n).then((ic) => {
      if (!cancelled) setIcon(ic)
    })
    return () => { cancelled = true }
  }, [n])

  // 이름이 바뀌면 이전 아이콘 숨김
  if (prevName.current !== n) {
    prevName.current = n
    setIcon(iconCache.get(n) ?? null)
  }

  // 원시 SVG 문자열 — 항상 동기 렌더
  if (n.startsWith('<svg')) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        dangerouslySetInnerHTML={{ __html: n }}
      />
    )
  }

  // 로드 전 — 같은 크기의 빈 공간 확보 (레이아웃 시프트 방지)
  if (!Icon) {
    return <span style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }} />
  }

  if (n.startsWith('ri:')) {
    return <Icon width={size} height={size} className={className} />
  }
  return <Icon size={size} className={className} />
}
