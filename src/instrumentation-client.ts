/**
 * @파일: instrumentation-client.ts
 * @설명: Vercel BotID 클라이언트 초기화 (Next.js 15.3+ instrumentation API)
 *        보호 대상 엔드포인트에 봇 감지 토큰을 자동으로 첨부함
 */

import { initBotId } from 'botid/client/core'

initBotId({
  protect: [
    { path: '/api/contact',          method: 'POST' },
    { path: '/api/quote',            method: 'POST' },
    { path: '/api/auth/check-email', method: 'POST' },
    // 세금 계산 서버 액션(공개 POST) — 무제한 호출로 인한 룰 조회·이력 적재 남용 방지
    { path: '/tax/acquisition',      method: 'POST' },
    { path: '/tax/stamp',            method: 'POST' },
    { path: '/tax/brokerage',        method: 'POST' },
    { path: '/tax/property',         method: 'POST' },
    { path: '/tax/comprehensive',    method: 'POST' },
    { path: '/tax/registration',     method: 'POST' },
    { path: '/tax/transfer',         method: 'POST' },
  ],
})
