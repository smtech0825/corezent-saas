/**
 * @파일: products.ts
 * @설명: CoreZent 제품 데이터 및 번들 패키지 정의
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
  lemonSqueezy: {
    monthly: string  // Lemon Squeezy 월간 체크아웃 URL
    annual: string   // Lemon Squeezy 연간 체크아웃 URL
  }
}

export interface Bundle {
  id: string
  name: string
  tagline: string
  badge: string
  includes: string[]
  savingsNote: string
  monthlyPrice: number
  annualMonthlyPrice: number
  lemonSqueezy: {
    monthly: string
    annual: string
  }
}

/** 카테고리 탭 표시 레이블 */
export const FILTER_LABELS: Record<FilterCategory, string> = {
  all: '전체',
  'chrome-extension': '크롬 익스텐션',
  desktop: '데스크톱',
  'web-tool': '웹 도구',
}

/** 뱃지 색상 스타일 */
export const BADGE_STYLES: Record<string, string> = {
  Popular: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20',
  New: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Best Value': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

// ─── 제품 목록 ───────────────────────────────────────────────────────────────
// 새 제품 추가 시 이 배열에 객체를 추가하세요.

export const products: Product[] = [
  {
    id: 'activator-extension',
    name: 'CoreZent Activator',
    category: 'chrome-extension',
    tagline: 'Activate licenses directly from your browser',
    badge: 'Popular',
    features: [
      'One-click license activation',
      'Clipboard serial detection',
      'Activation history log',
      'Works on any website',
      'Auto-fill support',
    ],
    monthlyPrice: 5,
    annualMonthlyPrice: 4,
    lemonSqueezy: {
      monthly: '#',  // TODO: Lemon Squeezy 월간 체크아웃 URL로 교체
      annual: '#',   // TODO: Lemon Squeezy 연간 체크아웃 URL로 교체
    },
  },
  {
    id: 'manager-desktop',
    name: 'CoreZent Manager',
    category: 'desktop',
    tagline: 'Full license management from your desktop',
    badge: 'New',
    features: [
      'Manage unlimited licenses offline',
      'Bulk import / export (CSV)',
      'Native push notifications',
      'Dark & light mode',
      'macOS & Windows support',
    ],
    monthlyPrice: 12,
    annualMonthlyPrice: 9,
    lemonSqueezy: {
      monthly: '#',
      annual: '#',
    },
  },
  {
    id: 'portal-web',
    name: 'CoreZent Portal',
    category: 'web-tool',
    tagline: 'Publish product docs with markdown & full-text search',
    features: [
      'Markdown editor with live preview',
      'Full-text search',
      'Version tagging',
      'Custom domain support',
      'Analytics dashboard',
    ],
    monthlyPrice: 15,
    annualMonthlyPrice: 11,
    lemonSqueezy: {
      monthly: '#',
      annual: '#',
    },
  },
  {
    id: 'insights-web',
    name: 'CoreZent Insights',
    category: 'web-tool',
    tagline: 'License & subscription analytics at a glance',
    badge: 'Best Value',
    features: [
      'Real-time activation metrics',
      'Revenue & churn tracking',
      'Geographic usage map',
      'Export to CSV / PDF',
      'Team access (up to 5 seats)',
    ],
    monthlyPrice: 19,
    annualMonthlyPrice: 14,
    lemonSqueezy: {
      monthly: '#',
      annual: '#',
    },
  },
]

// ─── 번들 패키지 ──────────────────────────────────────────────────────────────

export const bundle: Bundle = {
  id: 'complete-bundle',
  name: 'CoreZent Complete',
  tagline: 'Every tool. One subscription.',
  badge: 'Bundle Deal',
  includes: ['CoreZent Activator', 'CoreZent Manager', 'CoreZent Portal', 'CoreZent Insights'],
  savingsNote: 'Save up to 40% vs. buying separately',
  monthlyPrice: 29,
  annualMonthlyPrice: 21,
  lemonSqueezy: {
    monthly: '#',  // TODO: 번들 월간 체크아웃 URL로 교체
    annual: '#',   // TODO: 번들 연간 체크아웃 URL로 교체
  },
}
