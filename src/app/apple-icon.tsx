/**
 * @파일: app/apple-icon.tsx
 * @설명: Apple Touch Icon (iOS 홈 화면 아이콘) — 180×180 PNG 자동 생성
 */

import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          borderRadius: 40,
          fontSize: 128,
          fontWeight: 900,
          color: 'white',
          letterSpacing: '-4px',
        }}
      >
        C
      </div>
    ),
    size,
  )
}
