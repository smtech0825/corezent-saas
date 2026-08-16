/**
 * @파일: lib/tax/law-api-error.ts
 * @설명: 법제처 API 호출 실패 오류. 호출 계층(law-api.ts)과 파싱 계층(law-api-parse.ts)이
 *        모두 던지므로 순환 참조를 피해 별도 파일에 둔다.
 */

/** 법제처 API 호출 실패 — 원문 응답(인증키는 가려진 상태)을 담아 보고에 쓴다 */
export class LawApiError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status: number | null,
    readonly body: string,
  ) {
    super(message)
    this.name = 'LawApiError'
  }
}
