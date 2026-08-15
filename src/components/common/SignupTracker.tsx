'use client'

/**
 * @컴포넌트: SignupTracker
 * @설명: 소셜 가입 측정 감지 부품 — 화면에 아무것도 그리지 않는다(항상 null).
 *        콜백(서버)이 신규 가입일 때만 심어 둔 1회용 쿠키를 읽어, 기존 사건 이름
 *        (sign_up) 그대로 방식(kakao·github·google·naver)과 함께 1회 전송하고
 *        쿠키를 즉시 지운다(지우는 것이 곧 새로고침·뒤로가기 중복 방지).
 *        브라우저 1회 표식(localStorage)으로 "가입 5분 안 재로그인" 이중 계수도 막는다.
 *        ⚠️ 루트 레이아웃에 놓이는 전 페이지 공용 — 쿠키가 없으면 문자열 검사 한 번으로
 *        끝나는 완전 무동작이어야 하고, 어떤 실패도 화면·가입·로그인에 영향을 주면 안 된다.
 */

import { useEffect } from 'react'
import { EVENT, trackEvent } from '@/lib/analytics-events'
import { SIGNUP_METHOD_COOKIE, SIGNUP_TRACKED_KEY } from '@/lib/signup-tracking'

export default function SignupTracker() {
  useEffect(() => {
    try {
      // 쿠키가 없으면 여기서 끝 — indexOf 한 번(대부분의 방문이 이 경로)
      if (!document.cookie.includes(SIGNUP_METHOD_COOKIE + '=')) return

      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + SIGNUP_METHOD_COOKIE + '=([^;]*)'))
      const method = match ? decodeURIComponent(match[1]) : ''

      // 먼저 지운다 — 전송 성공 여부와 무관하게 다시 세지 않는다(한 번만 원칙이 우선)
      document.cookie = SIGNUP_METHOD_COOKIE + '=; path=/; max-age=0'
      if (!method) return

      // 브라우저 1회 표식 — 가입 직후 5분 안에 로그아웃→재로그인해도(쿠키가 다시 심어져도)
      // 같은 브라우저에서는 두 번 세지 않는다. 저장소 접근이 막힌 환경(시크릿 등)은
      // 표식 없이 진행한다(측정이 가입을 막지 않는 것이 우선).
      try {
        if (localStorage.getItem(SIGNUP_TRACKED_KEY)) return
        localStorage.setItem(SIGNUP_TRACKED_KEY, '1')
      } catch { /* 저장소 불가 — 표식 없이 1회 전송 */ }

      trackEvent(EVENT.SIGN_UP, { method })
    } catch { /* 측정 실패는 화면·가입·로그인에 아무 영향 없음 */ }
  }, [])

  return null
}
