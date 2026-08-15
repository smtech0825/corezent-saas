/**
 * @파일: lib/track-when-ready.ts
 * @설명: 측정 도구(gtag) 준비 대기 공용 함수 — 페이지가 뜬 직후에는 gtag가 아직
 *        실리지 않아(afterInteractive) 바로 보내면 조용히 유실된다(검증 실측).
 *        SignupTracker(소셜 가입)·PurchaseTracker(결제 완료)가 공유한다(사본 금지).
 *        ⚠️ 이 대기는 측정 전용 — 실패·시한 초과가 화면이나 본 동작에 영향을 주면 안 된다.
 */

/** 확인 간격·시한 — 도구는 페이지 로드 후 수 초 안에 실린다(15초면 충분) */
const POLL_MS = 250
const WAIT_LIMIT_MS = 15_000

/**
 * @함수명: whenGtagReady
 * @설명: window.gtag가 준비되면 콜백을 1회 실행합니다. 이미 준비돼 있으면 즉시,
 *        아니면 짧은 간격으로 확인하다가 시한이 지나면 조용히 포기합니다(onTimeout).
 * @매개변수: onReady - 도구 준비 후 1회 실행할 일 / onTimeout - 시한 초과 시(선택)
 * @반환값: 정리 함수 — 부품 언마운트 시 호출해 타이머를 멈춘다
 */
export function whenGtagReady(onReady: () => void, onTimeout?: () => void): () => void {
  if (typeof window !== 'undefined' && window.gtag) {
    onReady()
    return () => {}
  }
  const startedAt = Date.now()
  const timer = setInterval(() => {
    try {
      if (window.gtag) {
        clearInterval(timer)
        onReady()
      } else if (Date.now() - startedAt > WAIT_LIMIT_MS) {
        clearInterval(timer)
        onTimeout?.()
      }
    } catch {
      clearInterval(timer)
    }
  }, POLL_MS)
  return () => clearInterval(timer)
}
