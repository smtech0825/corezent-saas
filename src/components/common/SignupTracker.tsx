'use client'

/**
 * @컴포넌트: SignupTracker
 * @설명: 소셜 가입 측정 감지 부품 — 화면에 아무것도 그리지 않는다(항상 null).
 *        콜백(서버)이 신규 가입일 때만 심어 둔 1회용 쿠키를 읽어, 기존 사건 이름
 *        (sign_up) 그대로 방식(kakao·github·google·naver)과 함께 1회 전송한다.
 *        ★순서가 중요(검증 지적 반영): 측정 도구(gtag)는 페이지가 뜬 뒤에 실리므로
 *        도구가 준비될 때까지 기다렸다가 [표식 확인 → 표식 기록 → 전송 → 쿠키 삭제]
 *        순서로 처리한다. 먼저 지우면 도구가 늦었을 때 사건이 영구 유실된다.
 *        시한 안에 도구가 안 실리면 쿠키를 남겨 둔다 — 다음 페이지 로드에서 재시도되고,
 *        그마저 없으면 60초 뒤 자연 소멸한다(유실 최소, 중복은 표식이 막는다).
 *        브라우저 1회 표식(localStorage, 10분 유효)이 "가입 5분 안 재로그인" 이중 계수를 막는다.
 *        ⚠️ 루트 레이아웃의 전 페이지 공용 — 쿠키가 없으면 문자열 검사 한 번으로 끝나는
 *        완전 무동작이어야 하고, 어떤 실패도 화면·가입·로그인에 영향을 주면 안 된다.
 */

import { useEffect } from 'react'
import { EVENT, trackEvent } from '@/lib/analytics-events'
import { whenGtagReady } from '@/lib/track-when-ready'
import { SIGNUP_METHOD_COOKIE, SIGNUP_TRACKED_KEY, isRecentlyTracked } from '@/lib/signup-tracking'

export default function SignupTracker() {
  useEffect(() => {
    let cleanup: (() => void) | null = null
    try {
      // 쿠키가 없으면 여기서 끝 — 문자열 검사 한 번(대부분의 방문이 이 경로)
      if (!document.cookie.includes(SIGNUP_METHOD_COOKIE + '=')) return

      const clearCookie = () => { document.cookie = SIGNUP_METHOD_COOKIE + '=; path=/; max-age=0' }
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + SIGNUP_METHOD_COOKIE + '=([^;]*)'))
      // 값이 깨져 해석에 실패해도(임의 조작 등) 쿠키는 지우고 끝낸다 — 실패 반복 방지
      let method = ''
      try {
        method = match ? decodeURIComponent(match[1]) : ''
      } catch { method = '' }
      if (!method) { clearCookie(); return }

      /** 도구가 준비된 뒤 1회 실행 — 표식 확인·기록 → 전송 → 쿠키 삭제(성공 후 정리) */
      const fire = () => {
        // 브라우저 1회 표식(10분 유효) — 가입 직후 5분 안에 로그아웃→재로그인해도
        // (쿠키가 다시 심어져도) 같은 브라우저에서는 두 번 세지 않는다. 10분이 지나면
        // 표식이 무효가 되어 공용 PC의 다음 사람 가입은 정상으로 세진다.
        // 저장소가 막힌 환경(시크릿 등)은 표식 없이 진행한다(측정이 가입을 막지 않는 것이 우선).
        try {
          if (isRecentlyTracked(localStorage.getItem(SIGNUP_TRACKED_KEY))) { clearCookie(); return }
          localStorage.setItem(SIGNUP_TRACKED_KEY, String(Date.now()))
        } catch { /* 저장소 불가 — 표식 없이 1회 전송 */ }
        trackEvent(EVENT.SIGN_UP, { method })
        clearCookie()
      }

      // 도구가 아직 안 실렸으면 짧게 기다렸다가 전송(먼저 지우면 유실 — 검증 지적 반영)
      cleanup = whenGtagReady(fire)
    } catch { /* 측정 실패는 화면·가입·로그인에 아무 영향 없음 */ }

    return () => { cleanup?.() }
  }, [])

  return null
}
