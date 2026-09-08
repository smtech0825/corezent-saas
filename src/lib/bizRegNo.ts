/**
 * @파일: lib/bizRegNo.ts
 * @설명: 사업자등록번호 정규화·검증 단일 출처.
 *        틀린 번호로는 세금계산서가 발행되지 않으므로, 저장하기 전에 형식뿐 아니라
 *        검증번호(체크디짓)까지 확인한다. 오타를 나중에 발견하면 발행이 한 번 어긋난다.
 *        저장 형식은 하이픈 없는 숫자 10자리 — 표시할 때만 하이픈을 넣는다.
 */

/**
 * @함수명: normalizeBizRegNo
 * @설명: 입력값에서 숫자만 남깁니다. (하이픈·공백·괄호 제거)
 * @매개변수: value - 사용자가 입력한 원본 문자열
 * @반환값: 숫자만 남은 문자열 (길이 검증은 하지 않음)
 */
export function normalizeBizRegNo(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** 국세청 사업자등록번호 검증 가중치 — 앞 9자리에 자리별로 곱한다 */
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5]

/**
 * @함수명: isValidBizRegNo
 * @설명: 사업자등록번호의 검증번호(마지막 자리)가 맞는지 확인합니다.
 *        국세청 규칙: 앞 9자리에 가중치를 곱해 더하고, 9번째 자리×5의 십의 자리를 더한 뒤
 *        10에서 뺀 나머지가 마지막 자리와 같아야 합니다.
 * @매개변수: value - 원본 또는 정규화된 문자열 (내부에서 숫자만 추출)
 * @반환값: 형식(숫자 10자리)과 검증번호가 모두 맞으면 true
 */
export function isValidBizRegNo(value: string | null | undefined): boolean {
  const digits = normalizeBizRegNo(value)
  if (digits.length !== 10) return false

  const d = digits.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += d[i] * WEIGHTS[i]
  // 9번째 자리(index 8)에 5를 곱한 값의 십의 자리를 한 번 더 더한다
  sum += Math.floor((d[8] * 5) / 10)

  return (10 - (sum % 10)) % 10 === d[9]
}

/**
 * @함수명: formatBizRegNo
 * @설명: 숫자 10자리를 000-00-00000 형태로 표시용 포맷합니다.
 * @매개변수: value - 원본 또는 정규화된 문자열
 * @반환값: 하이픈이 들어간 문자열 (10자리가 아니면 원본의 숫자만 그대로 반환)
 */
export function formatBizRegNo(value: string | null | undefined): string {
  const d = normalizeBizRegNo(value)
  if (d.length !== 10) return d
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}
