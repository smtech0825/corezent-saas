/**
 * @파일: admin/logs/error-explanations.ts
 * @설명: 로그 오류의 한글 설명 대응표 — 개발자용 오류 대응표라 관리자 편집 대상이 아니다(지시서 §0-1 예외).
 *        ★ 여기 한 곳에만 모은다. 화면마다 흩지 말 것.
 *        ★ 실제 로그에서 확인된 오류만 넣는다(2026-08-12 실측: 오류 전문 2종).
 *          안 나온 오류를 예상해서 추가하지 말 것. 대응표에 없는 오류는 원문 그대로 보여준다.
 *        ★ 한글 설명은 영어 원문에 '덧붙이는' 것이다 — 원문을 지우거나 줄이는 데 쓰지 말 것.
 */

/** 대응 항목 — match: 오류 원문이 이 문자열로 시작하면 해당(전문 일부가 뒤에 더 붙어도 매칭) */
export const ERROR_EXPLANATIONS: { match: string; explain: string }[] = [
  {
    match: 'Error: 환불 처리 실패: Cannot coerce the result to a single JSON object',
    explain:
      '환불 웹훅이 가리키는 주문을 DB에서 한 건으로 특정하지 못했습니다(해당 주문이 없거나 여러 건이라는 뜻). 웹훅의 주문 번호로 주문이 실제 있는지 확인이 필요합니다.',
  },
  {
    match: 'Error: 주문 생성 실패: duplicate key value violates unique constraint',
    explain:
      '같은 결제 웹훅이 두 번 도착해 이미 저장된 주문을 다시 넣으려 한 것입니다. 중복 저장은 차단되었고 주문 데이터는 그대로라 조치가 필요 없습니다.',
  },
]

/**
 * @함수명: explainError
 * @설명: 오류 원문에 해당하는 한글 설명을 찾습니다. 대응표에 없으면 null(원문 그대로 표시).
 * @매개변수: error - 로그의 오류 원문
 * @반환값: 한글 설명 또는 null
 */
export function explainError(error: string): string | null {
  const hit = ERROR_EXPLANATIONS.find((e) => error.startsWith(e.match))
  return hit ? hit.explain : null
}
