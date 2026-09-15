/**
 * @파일: lib/revalidate-public.ts
 * @설명: 관리자가 내용을 고쳤을 때 공개 화면의 보관본(캐시)을 즉시 비우는 helper.
 *
 *        왜 필요한가: 공개 화면은 속도를 위해 1분(계산기는 10분) 동안 보관된다.
 *        보관본을 비우지 않으면 관리자가 고친 내용이 그 시간만큼 늦게 보인다.
 *        이 함수를 저장 직후에 부르면 다음 방문자가 바로 새 내용을 본다.
 *
 *        ⚠️ 서버 액션이나 라우트 핸들러 안에서만 부를 수 있다(Next.js 제약).
 *        ⚠️ 이 함수는 실패해도 저장을 되돌리지 않는다 — 저장은 이미 끝났고,
 *           갱신에 실패해도 보관 시간이 지나면 어차피 새 내용이 나온다.
 */
import { revalidatePath } from 'next/cache'

/** 부동산 계산기 화면 — tax_rules·지역 정보를 읽는다 */
const TAX_PATHS = [
  '/tax',
  '/tax/acquisition',
  '/tax/brokerage',
  '/tax/comprehensive',
  '/tax/net-proceeds',
  '/tax/property',
  '/tax/registration',
  '/tax/stamp',
  '/tax/transfer',
] as const

/**
 * @함수명: revalidateTaxPages
 * @설명: 계산기 화면 전체의 보관본을 비웁니다. 어느 룰이 어느 계산기에 쓰이는지
 *        일일이 따지면 빠뜨리기 쉬워 전부 비웁니다(비우는 비용은 거의 없습니다).
 */
export function revalidateTaxPages(): void {
  for (const p of TAX_PATHS) safeRevalidate(p)
}

/**
 * @함수명: revalidateProductPages
 * @설명: 상품이 바뀌었을 때 영향받는 화면의 보관본을 비웁니다.
 *        상품 상세는 주소가 상품마다 달라 개별 경로가 아니라 틀(layout) 단위로 비웁니다.
 */
export function revalidateProductPages(): void {
  safeRevalidate('/')          // 홈 요금 섹션
  safeRevalidate('/pricing')
  safeRevalidate('/product')
  // '/product/[slug]'는 실제 주소가 아니라 틀 이름이다. page 단위로 주면 모든 상품 상세가 함께 비워진다
  safeRevalidate('/product/[slug]', 'page')
}

/**
 * @함수명: safeRevalidate
 * @설명: 갱신 중 오류가 나도 저장 흐름을 깨지 않게 감쌉니다.
 * @매개변수: path - 비울 경로
 * @매개변수: type - 'page'면 동적 주소 틀 전체
 */
function safeRevalidate(path: string, type?: 'page' | 'layout'): void {
  try {
    if (type) revalidatePath(path, type)
    else revalidatePath(path)
  } catch (err) {
    // 저장은 이미 끝났다. 갱신 실패는 보관 시간이 지나면 저절로 해소된다
    console.error('[revalidate] 보관본 비우기 실패:', path, err instanceof Error ? err.message : String(err))
  }
}
