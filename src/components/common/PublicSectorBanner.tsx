/**
 * @컴포넌트: PublicSectorBanner
 * @설명: 기관 도입 안내(/public-sector)로 보내는 한 줄 배너 겸 버튼.
 *        제품 목록·제품 상세 두 곳이 같은 부품을 쓴다 — 문구가 자리마다 갈라지지 않게 한 곳에 둔다.
 *
 *        색은 기존 페이퍼 토큰만 쓴다(배경 paper-shade · 테두리 rule · 강조 pen). 새 색을 만들지 않는다.
 *        ⚠️ 제품 상세에는 하단 고정 구매 바가 있으므로 이 배너는 항상 본문 위쪽에만 놓는다.
 *           (아래쪽에 두면 구매 바 여백 계산 --buy-bar-h와 겹친다)
 *        모바일: 제목과 부제를 같은 줄에 두되, 폭이 모자라면 부제만 다음 줄로 접힌다(가로 스크롤 없음).
 */

import Link from 'next/link'

interface Props {
  /** 배치용 추가 클래스(주로 바깥 여백) */
  className?: string
}

/**
 * @함수명: PublicSectorBanner
 * @설명: 공공기관 구매 안내 배너를 그립니다.
 * @매개변수: className - 배치용 추가 클래스
 * @반환값: 배너 링크 노드
 */
export default function PublicSectorBanner({ className = '' }: Props) {
  return (
    <Link
      href="/public-sector"
      className={`flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-rule border-l-[3px] border-l-pen bg-paper-shade px-4 py-3 transition-colors hover:bg-paper-raised ${className}`}
    >
      <span className="text-sm font-bold text-pen">공공기관 구매 안내 →</span>
      <span className="text-xs text-ink-soft">수의계약 · 견적서 · 세금계산서</span>
    </Link>
  )
}
