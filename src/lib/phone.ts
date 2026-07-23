/**
 * @파일: lib/phone.ts
 * @설명: 한국 휴대폰 전화번호 공용 정규화·검증·표시 모듈.
 *        모든 가입 경로(이메일·카카오·네이버)와 온보딩 게이트가 공유한다.
 *        provider가 늘어나도 이 모듈은 변경 없이 재사용된다(보편 해결).
 */

/**
 * @함수명: normalizeKoreanPhone
 * @설명: 다양한 형식의 한국 휴대폰 번호를 숫자만의 표준형(01012345678)으로 정규화한다.
 *        `+82 10-1234-5678`, `010-1234-5678`, `01012345678`, `82 10 1234 5678` 등
 *        어떤 입력이 와도 처리하며, 한국 휴대폰 패턴(01[016789] + 7~8자리)이 아니면 null.
 * @매개변수: input - 사용자 입력 또는 provider 제공 원문(형식 불문)
 * @반환값: 정규화된 번호 문자열 또는 유효하지 않으면 null
 */
export function normalizeKoreanPhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null

  // 1) 공백·하이픈·괄호·점 등 구분자 제거(숫자와 + 만 남김)
  let d = input.trim().replace(/[^\d+]/g, '')
  if (!d) return null

  // 2) 국가코드(+82 / 0082 / 82) 제거 — 국내 번호부만 남긴다.
  //    선행 0을 붙이는 처리는 4)에서 일괄 수행해 "+82 10-..."(0 생략)과
  //    "+82 010-..."(0 유지)을 모두 올바르게 흡수한다.
  if (d.startsWith('+82')) {
    d = d.slice(3)
  } else if (d.startsWith('0082')) {
    d = d.slice(4)
  } else if (d.startsWith('82') && d[2] !== '0') {
    // 82로 시작하고 다음이 0이 아닐 때만 국가코드로 간주(0으로 시작하는 국내번호 오인 방지)
    d = d.slice(2)
  }

  // 3) 남은 + 등 비숫자 제거
  d = d.replace(/\D/g, '')
  if (!d) return null

  // 4) 국가코드를 벗긴 결과에 선행 0이 없으면 보정(예: +82 10-1234-5678 → 1012345678 → 01012345678)
  if (!d.startsWith('0')) d = '0' + d

  // 5) 한국 휴대폰 패턴 검증: 010/011/016/017/018/019 + 7~8자리
  return /^01[016789]\d{7,8}$/.test(d) ? d : null
}

/**
 * @함수명: isValidKoreanPhone
 * @설명: 입력이 유효한 한국 휴대폰 번호인지 여부(정규화 성공 여부와 동일).
 * @매개변수: input - 검증할 입력
 * @반환값: 유효하면 true
 */
export function isValidKoreanPhone(input: string | null | undefined): boolean {
  return normalizeKoreanPhone(input) !== null
}

/**
 * @함수명: formatPhoneForDisplay
 * @설명: 표준형(01012345678)을 하이픈 표기(010-1234-5678)로 변환한다.
 *        11자리는 3-4-4, 10자리는 3-3-4로 끊는다. 정규화 불가한 값은 원문 반환.
 * @매개변수: phone - 표시할 번호(가급적 정규화된 값)
 * @반환값: 하이픈 표기 문자열
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const d = normalizeKoreanPhone(phone) ?? (phone ?? '').replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return phone ?? ''
}

/**
 * @함수명: pickMetadataPhone
 * @설명: 인증 사용자 메타데이터(user_metadata / raw_user_meta_data) 객체에서
 *        전화번호 후보를 찾아 정규화한다. 이메일 가입 시 폼이 넣은 phone,
 *        소셜 provider가 제공하는 phone/phone_number 키를 폭넓게 탐색한다.
 *        provider별 분기 없이 여기서 흡수하는 것이 "보편 provider 전화 추출"의 시작점이며,
 *        Wave 3/4에서 카카오/네이버 매퍼를 이 함수(또는 호출부)에 추가한다.
 * @매개변수: metadata - 임의 키를 가진 메타데이터 객체(형식 불문)
 * @반환값: 정규화된 번호 또는 null
 */
export function pickMetadataPhone(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const candidates = [m.phone, m.phone_number, m.mobile]
  for (const c of candidates) {
    if (typeof c === 'string') {
      const normalized = normalizeKoreanPhone(c)
      if (normalized) return normalized
    }
  }
  return null
}
