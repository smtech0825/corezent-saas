'use client'

/**
 * @컴포넌트: RichMarkdown
 * @설명: 제품 상세 설명·목록 아코디언 등에서 공용으로 쓰는 마크다운 렌더러.
 *        react-markdown + remark-gfm 기반. rehype-raw(임의 HTML) 미사용 — 아래 커스텀 문법만 허용해 XSS 면을 만들지 않는다.
 *        지원: 헤딩(## 소제목, #소제목 공백없음 포함) · 이미지(![](url "=600"/"=50%")) · 유튜브(단독 줄 URL 자동 embed) · 굵게/리스트/인용 등 GFM.
 */

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import React from 'react'
import type { Components } from 'react-markdown'
import { normalizeHeadings, youtubeId, parseImageSize } from '@/lib/markdown'

/** @함수명: YouTubeEmbed @설명: videoId를 16:9 반응형 iframe(지연 로딩)으로 렌더 */
function YouTubeEmbed({ id }: { id: string }) {
  return (
    <span className="block my-6 w-full overflow-hidden rounded-lg border border-rule" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube video player"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </span>
  )
}

/** children이 단일 URL(문자열 또는 단일 링크)일 때 그 URL을 반환 — 유튜브 단독 줄 판정용 */
function singleUrl(children: React.ReactNode): string | null {
  const arr = React.Children.toArray(children)
  if (arr.length !== 1) return null
  const only = arr[0]
  if (typeof only === 'string') return only.trim()
  if (React.isValidElement(only)) {
    const props = only.props as { href?: string; children?: React.ReactNode }
    if (typeof props.href === 'string') return props.href.trim()
    if (typeof props.children === 'string') return props.children.trim()
  }
  return null
}

const components: Components = {
  h1: ({ children }) => <h2 className="text-xl font-serif font-black text-ink mt-8 mb-3 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="text-lg font-serif font-black text-ink mt-8 mb-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-ink mt-6 mb-2 first:mt-0">{children}</h3>,
  // 단독 줄 유튜브 URL → 자동 embed. 그 외는 일반 문단.
  p: ({ children }) => {
    const url = singleUrl(children)
    const vid = url ? youtubeId(url) : null
    if (vid) return <YouTubeEmbed id={vid} />
    return <p className="text-ink-soft text-sm leading-relaxed my-3">{children}</p>
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-pen underline hover:text-pen-dark break-words">
      {children}
    </a>
  ),
  // 이미지 — next/image 반응형. title의 "=값"으로 max-width 지정(기본 본문 폭 100%). 그 외 도메인 iframe은 만들지 않는다.
  img: ({ src, alt, title }) => {
    if (typeof src !== 'string' || !src) return null
    const maxWidth = parseImageSize(title)
    return (
      <Image
        src={src}
        alt={alt ?? ''}
        width={0}
        height={0}
        sizes="100vw"
        loading="lazy"
        className="rounded-lg border border-rule my-4 h-auto"
        style={{ width: '100%', maxWidth: maxWidth ?? '100%' }}
      />
    )
  },
  ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1 text-ink-soft text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1 text-ink-soft text-sm">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-mark/40 pl-4 my-4 text-ink-soft italic">{children}</blockquote>
  ),
  code: ({ children }) => <code className="font-mono text-xs bg-paper-shade text-ink px-1.5 py-0.5 rounded">{children}</code>,
  pre: ({ children }) => <pre className="bg-paper-shade border border-rule rounded-lg p-4 my-4 overflow-x-auto text-xs">{children}</pre>,
  hr: () => <hr className="my-6 border-rule" />,
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-rule rounded-lg">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="text-left px-3 py-2 border-b border-rule bg-paper-shade text-xs text-ink font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 border-b border-rule/60 text-ink-soft">{children}</td>,
}

/**
 * @함수명: RichMarkdown
 * @설명: 마크다운 문자열을 커스텀 컴포넌트로 렌더한다. 빈 문자열이면 아무것도 렌더하지 않는다.
 * @매개변수: content - 마크다운 원문, className - 외곽 래퍼 클래스(선택)
 * @반환값: 렌더된 마크다운 노드 또는 null
 */
export default function RichMarkdown({ content, className }: { content: string; className?: string }) {
  if (!content?.trim()) return null
  return (
    <div className={className}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeHeadings(content)}
      </Markdown>
    </div>
  )
}
