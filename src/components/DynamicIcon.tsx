'use client'

/**
 * @컴포넌트: DynamicIcon
 * @설명: 멀티 라이브러리 + 원시 SVG 아이콘 렌더러
 *        - 접두사 없음 또는 lu: → Lucide (예: Cpu, lu:Cpu)
 *        - tb: → Tabler Icons (예: tb:Cpu → IconCpu)
 *        - ri: → Radix Icons (예: ri:Accessibility → AccessibilityIcon)
 *        - <svg ...>: 원시 SVG 문자열 직접 렌더링
 */

import * as LucideIcons from 'lucide-react'
import * as TablerIcons from '@tabler/icons-react'
import * as RadixIcons from '@radix-ui/react-icons'

interface Props {
  name: string
  size?: number
  className?: string
}

type IconComp = React.ComponentType<{
  size?: number
  width?: number
  height?: number
  className?: string
}>

export default function DynamicIcon({ name, size = 20, className }: Props) {
  const n = (name ?? '').trim()

  // 원시 SVG 문자열
  if (n.startsWith('<svg')) {
    return (
      <span
        className={className}
        style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: n }}
      />
    )
  }

  // Tabler Icons — tb:이름 → Icon이름
  if (n.startsWith('tb:')) {
    const iconName = 'Icon' + n.slice(3)
    const Icon = (TablerIcons as unknown as Record<string, IconComp>)[iconName]
    if (!Icon) return null
    return <Icon size={size} className={className} />
  }

  // Radix Icons — ri:이름 → 이름Icon
  if (n.startsWith('ri:')) {
    const iconName = n.slice(3) + 'Icon'
    const Icon = (RadixIcons as unknown as Record<string, IconComp>)[iconName]
    if (!Icon) return null
    return <Icon width={size} height={size} className={className} />
  }

  // Lucide Icons — 기본 또는 lu: 접두사
  const lucideName = n.startsWith('lu:') ? n.slice(3) : n
  const Icon = (LucideIcons as unknown as Record<string, IconComp>)[lucideName]
  if (!Icon) return null
  return <Icon size={size} className={className} />
}
