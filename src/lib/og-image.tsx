/**
 * @파일: lib/og-image.tsx
 * @설명: 소셜 공유 미리보기(og:image) 생성 단일 출처.
 *        카카오톡·페이스북·슬랙 등이 링크를 펼칠 때 쓰는 1200×630 이미지를 만든다.
 *        생김새(공문서 페이퍼 톤)는 여기 한 곳에만 두고, 각 페이지의 opengraph-image.tsx는
 *        제목만 넘긴다.
 *
 *        ⚠️ 한글 폰트는 저장소에 동봉한 나눔고딕(SIL OFL 1.1, 견적서 PDF와 같은 파일)을
 *           fs로 읽는다. 서버리스 번들에 폰트가 포함되도록 next.config.ts의
 *           outputFileTracingIncludes에 **경로별로** 등록해야 한다(등록을 빠뜨리면 운영에서만 없다).
 *           읽기에 실패해도 이미지는 나가야 하므로 영문 브랜드만 남은 형태로 물러선다.
 */

import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** 소셜 미리보기 표준 크기 — 각 opengraph-image.tsx가 그대로 다시 내보낸다 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** 페이퍼 테마 토큰과 같은 값 (globals.css) — ImageResponse는 CSS 변수를 못 읽어 값을 적는다 */
const PAPER = '#FBFAF6'
const INK = '#23272E'
const INK_SOFT = '#565C66'
const RULE = '#D8D4C8'
const PEN = '#1D3FB0'

const FONT_DIR = path.join(process.cwd(), 'src', 'assets', 'quotation', 'fonts')

/**
 * @함수명: loadKoreanFonts
 * @설명: 나눔고딕 Regular·Bold를 읽어 ImageResponse용 폰트 배열을 만듭니다.
 * @반환값: 폰트 배열. 파일을 읽지 못하면 빈 배열(호출 측이 영문 전용 화면으로 물러선다)
 */
async function loadKoreanFonts() {
  try {
    const [regular, bold] = await Promise.all([
      readFile(path.join(FONT_DIR, 'NanumGothic-Regular.ttf')),
      readFile(path.join(FONT_DIR, 'NanumGothic-Bold.ttf')),
    ])
    return [
      { name: 'NanumGothic', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'NanumGothic', data: bold, weight: 700 as const, style: 'normal' as const },
    ]
  } catch (err) {
    // 폰트가 번들에 없으면 여기로 온다. 이미지 자체를 실패시키지 않는다 —
    // 미리보기가 깨진 링크보다 글자 적은 이미지가 낫다.
    console.error('[og-image] 한글 폰트를 읽지 못했습니다(브랜드만 표시):', err)
    return []
  }
}

interface OgInput {
  /** 큰 제목 — 한 줄에서 두 줄 분량. 폰트를 못 읽으면 표시하지 않는다 */
  title: string
  /** 제목 아래 보조 설명(선택) */
  subtitle?: string
}

/**
 * @함수명: renderOgImage
 * @설명: 공문서 톤의 소셜 미리보기 이미지를 그립니다.
 *        위쪽에 네모 칸 라벨(사이트 이름), 가운데 제목, 아래 구분선과 도메인을 둡니다.
 * @매개변수: input - 제목·보조 설명
 * @반환값: ImageResponse (PNG)
 */
export async function renderOgImage({ title, subtitle }: OgInput) {
  const fonts = await loadKoreanFonts()
  const hasKorean = fonts.length > 0

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '72px 80px',
          fontFamily: hasKorean ? 'NanumGothic' : 'sans-serif',
        }}
      >
        {/* 머리 — 공문서 네모 칸 라벨 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              border: `3px solid ${INK}`,
              padding: '10px 22px',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 8,
              color: INK,
            }}
          >
            CoreZent
          </div>
        </div>

        {/* 본문 — 제목·보조 설명. 폰트를 못 읽었으면 한글이 두부로 보이므로 브랜드만 남긴다.
            ⚠️ 조각(Fragment)으로 묶지 말 것 — 이미지 생성기가 세로 배치를 잃고 한 줄로 붙여 그린다. */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* 제목 — 줄바꿈은 직접 나눠 그린다(white-space 처리를 지원하지 않는다) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.3,
              color: INK,
              maxWidth: 1000,
            }}
          >
            {(hasKorean ? title : 'CoreZent').split('\n').map((line, i) => (
              <div key={i} style={{ display: 'flex' }}>{line}</div>
            ))}
          </div>
          {hasKorean && subtitle && (
            <div
              style={{
                display: 'flex',
                marginTop: 26,
                fontSize: 30,
                color: INK_SOFT,
                maxWidth: 1000,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* 꼬리 — 구분선 + 도장 색 점 + 도메인 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', height: 3, background: RULE, marginBottom: 22 }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: PEN, marginRight: 14 }} />
            <div style={{ display: 'flex', fontSize: 26, color: INK_SOFT, letterSpacing: 1 }}>
              www.corezent.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
