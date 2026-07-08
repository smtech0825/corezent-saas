import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'

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

export default withBotId(nextConfig)
