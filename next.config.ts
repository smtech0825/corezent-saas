import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'
import { createMDX } from 'fumadocs-mdx/next'

// Fumadocs MDX 래퍼 — content/docs·content/blog의 MDX를 빌드 파이프라인에 연결(source.config.ts 기준)
const withMDX = createMDX()

const nextConfig: NextConfig = {
  // 견적서 PDF 자산(한글 폰트·도장) — 라우트가 fs로 읽으므로 서버리스 번들에 명시적으로 포함
  outputFileTracingIncludes: {
    '/api/admin/quotes/issue': ['./src/assets/quotation/**/*'],
  },
  // 서버 액션 본문 한도 — 기본 1MB라 5MB 첨부(고객 문의)가 폼 안내와 달리 413으로 끊긴다.
  // 5MB 파일 + 폼 오버헤드 여유로 6mb. (호스팅 자체 요청 한도는 비회원 폼과 동일한 기존 조건)
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
  // 대표 도메인은 www.corezent.com — apex(corezent.com)로 들어온 요청은 301로 정규화
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'corezent.com' }],
        destination: 'https://www.corezent.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default withBotId(withMDX(nextConfig))
