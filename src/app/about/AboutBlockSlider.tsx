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

      {/* 도트 네비게이션
          점은 보이는 크기(10px)를 유지하되, 누를 수 있는 영역을 44px로 넓힌다(패딩).
          점 자체는 안쪽 span이 그리므로 화면 모양은 그대로다. */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-0 mt-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              aria-label={`${idx + 1}번째 사진 보기`}
              aria-current={idx === current ? 'true' : undefined}
              className="inline-flex items-center justify-center w-11 h-11"
            >
              <span
                className={`block w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  idx === current
                    ? 'bg-pen scale-110'
                    : 'bg-rule hover:bg-ink-faint'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
