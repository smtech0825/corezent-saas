'use client'

/**
 * @컴포넌트: AboutBlockSlider
 * @설명: About 페이지 콘텐츠 블록 이미지 슬라이더 — 도트 네비게이션
 */

import { useState } from 'react'

interface Props {
  images: string[]
}

export default function AboutBlockSlider({ images }: Props) {
  const [current, setCurrent] = useState(0)

  if (images.length === 0) return null

  return (
    <div className="relative">
      {/* 이미지 */}
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-rule">
        <img
          src={images[current]}
          alt={`Slide ${current + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
      </div>

      {/* 도트 네비게이션 */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                idx === current
                  ? 'bg-pen scale-110'
                  : 'bg-rule hover:bg-ink-faint'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
