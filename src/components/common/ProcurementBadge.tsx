/**
 * @컴포넌트: ProcurementBadge
 * @설명: 조달청 등록번호(물품분류번호·물품식별번호) 배지 — "등록증 한 줄" 형태.
 *        왼쪽 남색 세로선 + 회색 라벨 '조달청 등록' + 고정폭 숫자 두 개(가운뎃점 구분).
 *        상품 상세·요금 페이지·홈 요금 섹션·제품 목록 네 곳에서 같은 부품을 쓴다.
 *
 *        ⚠️ 두 번호가 모두 비면 아무것도 렌더하지 않는다(null). 빈 태그·자리·여백도 남기지 않으므로
 *           조달 등록이 없는 상품(지니포스트·지니스톡) 화면은 배지 도입 전과 완전히 동일하다.
 *           → 바깥 여백이 필요하면 래퍼 div가 아니라 이 부품의 className으로 준다.
 *             (래퍼로 감싸면 값이 없을 때 그 여백만 남아 화면이 달라진다)
 *
 *        색은 기존 페이퍼 토큰만 사용한다: 배경 paper-shade · 테두리 rule · 라벨 ink-soft
 *        · 번호 ink · 왼쪽 세로선 pen. 새 색상값을 만들지 않는다.
 *        ⚠️ 라벨은 ink-faint(#8B8F98)가 아니라 ink-soft(#565C66)를 쓴다 — paper-shade(#F1EFE7) 위에서
 *           ink-faint는 대비 약 2.8:1로 WCAG AA(4.5:1) 미달이고, ink-soft는 약 5.9:1로 통과한다.
 *           공공기관 담당자가 보는 화면이라 접근성 기준을 지킨다(둘 다 기존 토큰이라 새 색은 없다).
 */

interface Props {
  /** 물품분류번호 (products.procurement_class_number). 비면 이 항목만 생략 */
  classNumber?: string | null
  /** 물품식별번호 (products.procurement_item_number). 비면 이 항목만 생략 */
  itemNumber?: string | null
  /** 크기 — 'md'(기본, 넓은 상세 페이지) / 'sm'(좁은 카드). 색·구조는 같고 글자·여백만 줄인다 */
  size?: 'md' | 'sm'
  /** 배치용 추가 클래스(주로 바깥 여백). 값이 없으면 이 클래스도 함께 사라진다 */
  className?: string
}

/**
 * @함수명: Entry
 * @설명: 배지 안의 항목 하나(라벨 + 고정폭 번호)를 렌더합니다.
 *        라벨과 번호가 줄바꿈으로 떨어지지 않도록 한 덩어리로 묶습니다.
 * @매개변수: label - 항목 이름, value - 번호 값
 * @반환값: 항목 노드
 */
function Entry({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span>{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </span>
  )
}

/**
 * @함수명: ProcurementBadge
 * @설명: 조달청 등록번호 배지를 그립니다. 값이 하나만 있으면 있는 쪽만, 둘 다 없으면 아무것도 그리지 않습니다.
 * @매개변수: classNumber - 물품분류번호, itemNumber - 물품식별번호, size - 크기, className - 배치용 클래스
 * @반환값: 배지 노드 (표시할 번호가 없으면 null)
 */
export default function ProcurementBadge({
  classNumber,
  itemNumber,
  size = 'md',
  className = '',
}: Props) {
  const cls = (classNumber ?? '').trim()
  const item = (itemNumber ?? '').trim()

  // 핵심 규칙 — 표시할 번호가 하나도 없으면 여기서 끝낸다(빈 태그조차 만들지 않는다)
  if (!cls && !item) return null

  const sm = size === 'sm'
  // 좁은 카드에서는 글자·여백·세로선을 한 단계 줄인다. 색과 구조는 그대로.
  const sizeCls = sm
    ? 'gap-x-1.5 gap-y-0.5 px-2 py-1 text-[11px] border-l-2'
    : 'gap-x-2 gap-y-1 px-2.5 py-1.5 text-xs border-l-[3px]'

  return (
    // flex-wrap + max-w-full — 좁은 곳에서는 줄이 접히고, 가로 스크롤이 생기지 않는다.
    // flex w-fit(= 블록 레벨 + 내용 폭) — inline-flex는 줄상자를 만들어 아래에 몇 px가 더 붙는데,
    // 카드 안에서 버튼과의 간격이 자리마다 미세하게 달라지므로 블록으로 고정한다.
    <div
      className={`flex w-fit flex-wrap items-baseline max-w-full rounded border border-rule border-l-pen bg-paper-shade text-ink-soft ${sizeCls} ${className}`}
    >
      <span className="whitespace-nowrap">조달청 등록</span>
      {cls && <Entry label="물품분류번호" value={cls} />}
      {cls && item && <span aria-hidden className="whitespace-nowrap">·</span>}
      {item && <Entry label="물품식별번호" value={item} />}
    </div>
  )
}
