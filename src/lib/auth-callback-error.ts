/**
 * @파일: lib/auth-callback-error.ts
 * @설명: 인증 콜백이 실패했을 때 "무엇이 실패했는지"와 "손님에게 뭐라고 알릴지"를 담는 한 곳.
 *        서버(auth/callback/route.ts)와 화면(auth/login/LoginForm.tsx)이 같은 규칙을 써야
 *        하는데, 각자 들고 있으면 한쪽만 고쳐져 판정과 문구가 어긋난다. 그래서 한곳에 둔다.
 *        브라우저·서버 양쪽에서 쓰므로 순수 함수만 둔다(서버 전용 모듈을 부르지 않는다).
 */

/** 인증 콜백 실패 종류 — 서버가 정하고 화면이 문구를 고른다 */
export type AuthCallbackReason = 'oauth' | 'verify' | 'missing'

/**
 * @함수명: readProviderErrorCode
 * @설명: 인증 제공자가 주소에 실어 보낸 오류 코드를 꺼냅니다.
 *
 *        ★ 판정 함수를 한 곳에 모아도 "무엇을 넣는지"가 갈리면 서버와 화면의 결론이 달라집니다.
 *        실제로 서버는 error_code만, 화면은 error_code와 error를 함께 보고 있어서 같은 상황에
 *        다른 안내가 나갔습니다. 읽는 키와 순서도 여기 한 곳에 둡니다.
 * @매개변수: params - 주소의 쿼리 또는 # 뒤를 담은 URLSearchParams
 * @반환값: 오류 코드. 없으면 빈 문자열
 */
export function readProviderErrorCode(params: URLSearchParams): string {
  return params.get('error_code') ?? params.get('error') ?? ''
}

/**
 * @함수명: isExpiredLinkCode
 * @설명: 인증 제공자가 돌려준 오류 코드가 "메일 링크가 만료됐거나 이미 쓰였다"에 해당하는지
 *        판정합니다.
 *
 *        ★ 판정 범위를 일부러 넓게 둡니다. 실제 운영 로그에서 어떤 코드가 오는지 아직
 *        확인하지 못했기 때문입니다(콜백 호출 자체가 최근 기록에 없었습니다). 좁게 잡으면
 *        진짜 만료된 손님이 "메일을 다시 받으세요" 안내를 못 받습니다. 반대로 넓게 잡으면
 *        소셜 로그인 실패에 만료 안내가 나갈 수 있는데, 둘 다 "다시 시도"로 이어지므로
 *        손해가 더 작습니다. 로그가 쌓이면 실제 값을 보고 좁히는 것이 맞습니다.
 * @매개변수: errorCode - 주소에 실려 온 오류 코드(없을 수 있음)
 * @반환값: 만료·무효 링크로 볼 수 있으면 true
 */
export function isExpiredLinkCode(errorCode: string | null | undefined): boolean {
  if (!errorCode) return false
  return /otp|expired|access_denied/i.test(errorCode)
}

/**
 * @함수명: authCallbackMessage
 * @설명: 실패 종류를 손님이 읽을 한국어 안내로 바꿉니다. 오류 원문(영문)은 서버 기록에만
 *        남고 여기로 넘어오지 않습니다.
 * @매개변수: reason - 콜백이 넘긴 실패 종류
 * @반환값: 화면에 그대로 보여줄 한국어 안내 문장
 */
export function authCallbackMessage(reason: string): string {
  if (reason === 'oauth') {
    return '소셜 로그인을 마치지 못했습니다. 잠시 후 다시 시도하시거나 이메일로 로그인해 주세요.'
  }
  if (reason === 'verify') {
    return '이메일 인증을 마치지 못했습니다. 링크가 만료되었을 수 있으니 인증 메일을 다시 받아 주세요.'
  }
  return '로그인 처리를 마치지 못했습니다. 다시 시도해 주세요.'
}
