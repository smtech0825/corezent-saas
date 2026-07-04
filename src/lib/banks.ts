/**
 * @파일: lib/banks.ts
 * @설명: 제휴 정산 계좌 은행 목록 상수 — 대시보드 정산 계좌 드롭다운의 단일 출처.
 *        저장값은 라벨 문자열 그대로 사용한다(서버 검증도 이 목록 기준).
 */

/** 정산 계좌 은행 목록(국내 주요 은행·인터넷은행·상호금융) */
export const PAYOUT_BANKS = [
  'KB국민', '신한', '우리', '하나', 'NH농협', 'IBK기업', 'SC제일', '한국씨티',
  '케이뱅크', '카카오뱅크', '토스뱅크', 'Sh수협', 'iM뱅크(대구)', '부산', '경남',
  '광주', '전북', '제주', '새마을금고', '신협', '우체국', 'KDB산업', '저축은행',
] as const

export type PayoutBank = typeof PAYOUT_BANKS[number]

/**
 * @함수명: isValidBank
 * @설명: 입력 은행명이 허용 목록에 있는지 검증한다.
 * @매개변수: v - 검사할 은행명
 * @반환값: 목록에 있으면 true
 */
export function isValidBank(v: string): v is PayoutBank {
  return (PAYOUT_BANKS as readonly string[]).includes(v)
}

/**
 * @함수명: normalizeAccountNumber
 * @설명: 계좌번호를 정규화한다 — 숫자·하이픈만 남기고 그 외 문자는 제거, 앞뒤 공백 trim.
 * @매개변수: v - 입력 계좌번호
 * @반환값: 숫자·하이픈만 남은 문자열
 */
export function normalizeAccountNumber(v: string): string {
  return v.trim().replace(/[^0-9-]/g, '')
}

/**
 * @함수명: maskAccountNumber
 * @설명: 계좌번호를 뒤 4자리만 남기고 마스킹한다(그 외 자리는 *, 하이픈 위치는 유지).
 * @매개변수: v - 계좌번호(정규화된 값)
 * @반환값: 마스킹된 계좌번호(예: ***-**-**1234)
 */
export function maskAccountNumber(v: string): string {
  const digitCount = (v.match(/[0-9]/g) ?? []).length
  if (digitCount <= 4) return v
  const revealFrom = digitCount - 4 // 이 인덱스(0-base)부터 실제 숫자 노출
  let di = 0
  // 하이픈 위치는 그대로 두고([0-9]만 치환), 마지막 4자리 숫자만 노출
  return v.replace(/[0-9]/g, (d) => {
    const ch = di < revealFrom ? '*' : d
    di += 1
    return ch
  })
}
