/**
 * @파일: instrumentation-client.ts
 * @설명: Vercel BotID 클라이언트 초기화 (Next.js 15.3+ instrumentation API)
 *        보호 대상 엔드포인트에 봇 감지 토큰을 자동으로 첨부함
 */

import { initBotId } from 'botid/client/core'

initBotId({
  protect: [
    { path: '/api/contact',          method: 'POST' },
    { path: '/api/auth/check-email', method: 'POST' },
  ],
})
