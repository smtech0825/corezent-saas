/**
 * @파일: lib/tax/calculators.ts
 * @설명: 부동산 계산기 목록의 단일 출처 — 허브(/tax)·공유 레이아웃 탭(TaxNav)·사이트맵이
 *        함께 쓴다. 준비 중(available: false)인 계산기는 화면에 표시만 되고
 *        링크·사이트맵에서는 제외된다(잘못된 링크가 검색엔진에 노출되지 않도록).
 *        ⚠️ 세율·금액·구간 값은 여기 넣지 않는다 — 이름·경로·분류만 담는 중립 목록이다.
 */

/** 계산기 분류 — 부동산 생애 주기 순서 */
export type CalculatorCategory = 'buy' | 'hold' | 'sell' | 'inherit' | 'rent'

/** 분류 한국어 라벨 */
export const CALCULATOR_CATEGORY_LABELS: Record<CalculatorCategory, string> = {
  buy: '살 때',
  hold: '가지고 있을 때',
  sell: '팔 때',
  inherit: '물려줄 때',
  rent: '임대',
}

/** 분류 표시 순서 */
export const CALCULATOR_CATEGORIES: CalculatorCategory[] = ['buy', 'hold', 'sell', 'inherit', 'rent']

/** 계산기 한 항목 */
export interface TaxCalculatorInfo {
  slug: string                   // 식별자
  path: string                   // 주소 경로 — 계산기마다 고유(검색엔진이 별개 페이지로 인식)
  name: string                   // 화면에 보일 이름
  description: string            // 한 줄 설명
  category: CalculatorCategory   // 분류
  available: boolean             // false면 '준비 중' — 링크·사이트맵 제외
}

/** 계산기 목록 — 앞으로 만들 것도 '준비 중'으로 미리 담는다 */
export const TAX_CALCULATORS: TaxCalculatorInfo[] = [
  {
    slug: 'acquisition',
    path: '/tax/acquisition',
    name: '취득세',
    description: '주택 매매·증여 취득세를 적용 법령 근거와 함께 계산합니다.',
    category: 'buy',
    available: true,
  },
  {
    slug: 'stamp',
    path: '/tax/stamp',
    name: '인지세',
    description: '부동산 매매계약서에 붙는 인지세를 계약금액 기준으로 계산합니다.',
    category: 'buy',
    available: true,
  },
  {
    slug: 'brokerage',
    path: '/tax/brokerage',
    name: '중개수수료',
    description: '부동산 중개보수 상한을 계산합니다.',
    category: 'buy',
    available: true,
  },
  {
    slug: 'registration',
    path: '/tax/registration',
    name: '등기비용',
    description: '소유권 이전 등기에 드는 비용을 계산합니다.',
    category: 'buy',
    available: true,
  },
  {
    slug: 'property',
    path: '/tax/property',
    name: '재산세',
    description: '아파트 보유 시 매년 내는 재산세를 지방교육세·도시지역분과 함께 계산합니다.',
    category: 'hold',
    available: true,
  },
  {
    slug: 'comprehensive',
    path: '/tax/comprehensive',
    name: '종합부동산세',
    description: '공시가격 합계 기준으로 종합부동산세 과세 대상 여부와 세액을 계산합니다.',
    category: 'hold',
    available: true,
  },
  {
    slug: 'transfer',
    path: '/tax/transfer',
    name: '양도소득세',
    description: '아파트를 팔 때의 양도소득세를 비과세·중과 판정과 함께 계산합니다.',
    category: 'sell',
    available: true,
  },
  {
    slug: 'net-proceeds',
    path: '/tax/net-proceeds',
    name: '매도 실수령액',
    description: '아파트를 팔면 실제로 손에 쥐는 돈을 세금·수수료를 빼고 계산합니다.',
    category: 'sell',
    available: true,
  },
  // 전월세 전환 계산기는 만들지 않는다(2026-08-13 범위 조정) — 세금이 아니고
  // 아파트 매매와 무관해 서비스 목적에서 벗어남. '준비 중'으로도 표시하지 않는다.
]
