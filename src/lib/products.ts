/**
 * @파일: products.ts
 * @설명: CoreZent 제품 데이터 정의
 *        제품 추가/수정 시 이 파일만 편집하면 됩니다.
 */

export type Category = 'chrome-extension' | 'desktop' | 'web-tool'
export type FilterCategory = 'all' | Category

export interface Product {
  id: string
  name: string
  category: Category
  tagline: string
  badge?: string
  features: string[]
  monthlyPrice: number
  /** 연간 결제 시 월 환산 가격 */
  annualMonthlyPrice: number
  /** 연간 결제 시 실제 청구 금액 (연 단위) */
  annualPrice: number
  lemonSqueezy: {
    monthly: string
    annual: string
  }
}

/** 카테고리 탭 표시 레이블 */
export const FILTER_LABELS: Record<FilterCategory, string> = {
  all: 'All',
  'chrome-extension': 'Chrome Extension',
  desktop: 'Desktop',
  'web-tool': 'Web Tool',
}

/** 뱃지 색상 스타일 */
export const BADGE_STYLES: Record<string, string> = {
  Popular:    'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20',
  New:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Best Value': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

// ─── 제품 목록 ───────────────────────────────────────────────────────────────

export const products: Product[] = [
  {
    id: 'geniepost-desktop',
    name: 'GeniePost',
    category: 'desktop',
    tagline: 'AI-powered social media posting tool',
    badge: 'Popular',
    features: [
      'Quad-Engine AI Generation: High-quality content powered by 4 premium AI engines.',
      'Rich Visual Integration: Support for up to 20 custom images per single post.',
      'Strategic Personalization: Tailored content with customizable tone and target audience.',
      'Seamless Automation: Fully automated process from publishing to search indexing.',
    ],
    monthlyPrice: 6.99,
    annualMonthlyPrice: 5.75,   // $69/year ÷ 12
    annualPrice: 69,             // 연간 실제 청구 금액
    lemonSqueezy: {
      monthly: 'https://corezent.lemonsqueezy.com/checkout/buy/e2b21fc4-db33-4538-bc33-30c36686de28',
      annual:  'https://corezent.lemonsqueezy.com/checkout/buy/1bbe1f41-30eb-4caa-9474-ed8711b907ea',
    },
  },
]
