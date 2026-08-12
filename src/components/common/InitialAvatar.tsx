/**
 * @컴포넌트: InitialAvatar
 * @설명: 이름 첫 글자 아바타 공용 부품. 전원 같은 색이라 구분 기능이 없던 것을
 *        이름에 따라 기존 상태색 4벌(ok·caution·info·danger의 soft 배경+진한 글자,
 *        전부 대비 4.5:1 이상 실측)에서 자동 배정한다.
 *        - 같은 이름은 항상 같은 색: 문자 코드 기반 결정적 계산(무작위 없음)
 *        - 이름이 비면 죽지 않고 '?' + 회색(색 배정 없음)
 *        - 탈퇴 회원처럼 상태를 색으로 알려야 하는 곳은 inactive로 기존 표시 유지
 */

/** 배정 후보 색 — 기존 상태색 토큰만 사용(새 색상값 없음). 대비 실측치는 주석에 기록 */
const AVATAR_TONES = [
  { bg: 'bg-ok-soft',      text: 'text-ok',      border: 'border-ok/20' },      // 4.63:1
  { bg: 'bg-caution-soft', text: 'text-caution', border: 'border-caution/20' }, // 5.09:1
  { bg: 'bg-info-soft',    text: 'text-info',    border: 'border-info/20' },    // 4.58:1
  // danger는 뺀다 — 탈퇴 표시(INACTIVE_TONE)와 픽셀까지 같아져 상태 구분이 사라진다(검증에서 발견)
]

/** 이름 없음·상태 표시용 고정 색 */
const NEUTRAL_TONE  = { bg: 'bg-paper-shade',  text: 'text-ink-soft', border: 'border-rule' }
const INACTIVE_TONE = { bg: 'bg-danger-soft',  text: 'text-danger',   border: 'border-danger/20' }

/**
 * @함수명: avatarToneIndex
 * @설명: 이름을 색 번호로 바꿉니다. 문자 코드와 자리 가중치의 합이라 같은 이름은
 *        언제 어디서 열어도 같은 번호가 나온다(화면·새로고침 무관).
 * @매개변수: name - 공백을 정리한 이름
 * @반환값: 0 ~ (색 개수-1)
 */
export function avatarToneIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % 9973
  }
  return hash % AVATAR_TONES.length
}

interface Props {
  /** 표시할 이름(비어 있어도 안전) */
  name?: string | null
  /** 이름이 비었을 때 대신 쓸 값(예: 이메일) */
  fallbackText?: string | null
  /** 탈퇴 등 상태를 색으로 보여야 하면 true — 자동 배정 대신 위험색 고정 */
  inactive?: boolean
  /** 크기·여백 등 배치 클래스 (기본 w-8 h-8) */
  className?: string
}

export default function InitialAvatar({ name, fallbackText, inactive, className }: Props) {
  // 이름 → 없으면 대체 텍스트 → 그래도 없으면 '?' (빈 문자열이어도 절대 죽지 않는다)
  const source = (name ?? '').trim() || (fallbackText ?? '').trim()
  const initial = source ? source[0].toUpperCase() : '?'
  const tone = inactive ? INACTIVE_TONE : source ? AVATAR_TONES[avatarToneIndex(source)] : NEUTRAL_TONE

  return (
    <span
      className={`rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${tone.bg} ${tone.text} ${tone.border} ${className ?? 'w-8 h-8'}`}
    >
      {initial}
    </span>
  )
}
