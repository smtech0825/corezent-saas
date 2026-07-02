/**
 * @파일: app/legal/_components/legal-ui.tsx
 * @설명: 법적 고지 페이지(개인정보 처리방침·이용약관·쿠키 정책) 공통 레이아웃 및 본문 컴포넌트
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

/** 페이지 외곽 — 헤더 바 + 타이틀 블록 + 섹션 영역 + 문의 박스 */
export function LegalChrome({
  title,
  intro,
  updated,
  contactTitle,
  contactDesc,
  supportHref,
  children,
}: {
  title: string
  intro: string
  updated: string
  contactTitle: string
  contactDesc: ReactNode
  supportHref: string
  children: ReactNode
}) {
  return (
    <div className="theme-paper min-h-screen bg-paper text-ink">
      {/* 헤더 */}
      <div className="border-b-2 border-ink">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-ink">
            <span className="w-7 h-7 rounded border-[1.5px] border-seal flex items-center justify-center text-seal text-sm font-black -rotate-3">C</span>
            CoreZent
          </Link>
          <Link href="/" className="text-sm text-ink-soft hover:text-ink transition-colors">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* 타이틀 */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-pen/10 border border-pen/20 text-pen text-xs font-semibold px-3 py-1.5 rounded mb-6">
            법적 고지
          </div>
          <h1 className="text-4xl font-serif font-black text-ink mb-4">{title}</h1>
          <p className="text-ink-soft text-base leading-relaxed max-w-2xl">{intro}</p>
          <p className="text-ink-faint text-sm mt-4">{updated}</p>
        </div>

        {/* 섹션 목록 */}
        <div className="space-y-6">{children}</div>

        {/* 문의 안내 */}
        <div className="mt-10 border border-rule bg-paper-raised rounded-lg px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(35,39,46,0.05)]">
          <div>
            <p className="text-sm font-semibold text-ink mb-1">{contactTitle}</p>
            <p className="text-sm text-ink-soft">{contactDesc}</p>
          </div>
          <Link
            href={supportHref}
            className="shrink-0 bg-pen hover:bg-pen-dark text-white font-semibold text-sm px-5 py-2.5 rounded-md transition-colors"
          >
            문의하기
          </Link>
        </div>
      </div>
    </div>
  )
}

/** 번호 뱃지 + 제목을 가진 섹션 카드 (badge 생략 시 제목만 표시) */
export function LegalSection({
  badge,
  title,
  children,
}: {
  badge?: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="border border-rule bg-paper-raised rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(35,39,46,0.05)]">
      <div className="px-7 py-5 border-b border-rule flex items-center gap-4">
        {badge != null && (
          <span className="w-8 h-8 rounded-md bg-pen/10 border border-pen/20 text-pen text-sm font-bold flex items-center justify-center shrink-0">
            {badge}
          </span>
        )}
        <h2 className="font-serif text-base font-bold text-ink">{title}</h2>
      </div>
      <div className="px-7 py-6 space-y-4">{children}</div>
    </div>
  )
}

/** 본문 단락 */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-soft leading-relaxed">{children}</p>
}

/** 굵은 소제목 */
export function SubLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold text-ink">{children}</p>
}

/** 소제목 + 본문을 하나로 묶는 그룹 */
export function Group({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>
}

/** 강조 박스 — 라벨 + 본문 */
export function LabelBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-paper-shade border border-rule rounded-md p-4">
      <p className="text-xs font-semibold text-ink mb-2">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

/** 글머리 목록 */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-ink-soft leading-relaxed">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pen/60 shrink-0" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/** 번호 목록 */
export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-ink-soft leading-relaxed">
          <span className="shrink-0 font-semibold text-pen">{i + 1}.</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  )
}

/** 표 */
export function LegalTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-paper-shade">
            {head.map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-ink px-4 py-2.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-rule">
              {row.map((cell, j) => (
                <td key={j} className="text-ink-soft leading-relaxed px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 강조 메모 박스 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-ink-soft leading-relaxed bg-paper-shade border border-rule rounded-md px-4 py-3">
      {children}
    </p>
  )
}

/** 강조(굵은 흰색) 인라인 텍스트 */
export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}
