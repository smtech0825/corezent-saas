import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'
import { createMDX } from 'fumadocs-mdx/next'

// Fumadocs MDX 래퍼 — content/docs·content/blog의 MDX를 빌드 파이프라인에 연결(source.config.ts 기준)
const withMDX = createMDX()

const nextConfig: NextConfig = {
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
