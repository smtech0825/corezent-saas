/**
 * @컴포넌트: UnreadDot
 * @설명: 미읽음 알림 점(깜빡이는 빨간 점) 공용 부품. 대시보드·관리자 사이드바의 메뉴
 *        항목과, 접힌 그룹 헤더가 전부 같은 모양을 쓴다 — 같은 블록을 세 곳에 붙여넣으면
 *        반드시 한 곳만 달라지므로 정본을 여기 한 곳에 둔다.
 */

export default function UnreadDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
    </span>
  )
}
