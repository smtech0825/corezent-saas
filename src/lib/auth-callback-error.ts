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
 *        ★ 판정 범위는 여전히 넓게 둡니다(otp·expired가 들어가면 만료로 봅니다). 운영 로그에서
 *        실제로 어떤 코드가 오는지 아직 확인하지 못했고, 좁게 잡으면 진짜 만료된 손님이
 *        "메일을 다시 받으세요" 안내를 못 받기 때문입니다.
 *
 *        다만 access_denied는 뺐습니다. 이건 "링크 만료"가 아니라 손님이 소셜 로그인
 *        동의창에서 취소를 눌렀을 때 나오는 표준 코드입니다. 넓게 두는 것과, 뜻이 다른
 *        코드를 잘못 넣어 둔 것은 다른 문제입니다 — 그대로 두면 로그인을 취소했을 뿐인
 *        손님에게 "인증 메일을 다시 받아 주세요"라고 안내하게 됩니다.
 * @매개변수: errorCode - 주소에 실려 온 오류 코드(없을 수 있음)
 * @반환값: 만료·무효 링크로 볼 수 있으면 true
 */
export function isExpiredLinkCode(errorCode: string | null | undefined): boolean {
  if (!errorCode) return false
  return /otp|expired/i.test(errorCode)
}

/**
 * @함수명: isUserCancelledOAuth
 * @설명: 손님이 소셜 로그인 동의창에서 취소를 눌렀는지 판정합니다. OAuth 표준에서 이 경우
 *        access_denied를 돌려줍니다. 실패가 아니라 손님의 선택이므로, 만료 안내가 아니라
 *        소셜 로그인 안내로 보냅니다.
 * @매개변수: errorCode - 주소에 실려 온 오류 코드(없을 수 있음)
 * @반환값: 손님이 취소한 것으로 볼 수 있으면 true
 */
export function isUserCancelledOAuth(errorCode: string | null | undefined): boolean {
  if (!errorCode) return false
  return /access_denied/i.test(errorCode)
}

/**
 * @함수명: classifyProviderError
 * @설명: 제공자가 준 오류 코드를 실패 종류로 바꿉니다. 판정 순서까지 여기 한 곳에 둡니다
 *        — 서버와 화면이 각자 if 순서를 들고 있으면 같은 코드에 다른 결론을 냅니다.
 * @매개변수: errorCode - 주소에 실려 온 오류 코드(없을 수 있음)
 * @반환값: 만료 링크면 'verify', 손님이 소셜 로그인을 취소했으면 'oauth',
 *          판단할 수 없으면 null(부르는 쪽이 기본값을 정한다)
 */
export function classifyProviderError(
  errorCode: string | null | undefined,
): AuthCallbackReason | null {
  if (isExpiredLinkCode(errorCode)) return 'verify'
  if (isUserCancelledOAuth(errorCode)) return 'oauth'
  return null
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
