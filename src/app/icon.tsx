/**
 * @파일: app/icon.tsx
 * @설명: CoreZent 파비콘 — 파란 배경 + 흰색 "C" (32×32 PNG 자동 생성)
 */

import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          fontSize: 22,
          fontWeight: 900,
          color: 'white',
          letterSpacing: '-1px',
        }}
      >
        C
      </div>
    ),
    size,
  )
}
