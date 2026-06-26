/**
 * @파일: lib/affiliate.ts
 * @설명: 추천(Affiliate) 공통 유틸 — 서버 전용.
 *        추천 코드 정규화·추천 링크 생성·IP 해시·가입 귀속 처리.
 *        모든 규칙값(쿠키 일수·자기추천 차단 등)은 affiliate_program_config(DB)에서 읽는다.
 *        하드코딩 금지 — 설정값이 없으면 추측하지 않고 동작을 건너뛴다.
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { REF_COOKIE } from '@/lib/cookies'

export { REF_COOKIE }

/**
 * @함수명: normalizeRefCode
 * @설명: 추천 코드를 정규화합니다(대문자 영숫자만, 과도한 길이 차단).
 * @매개변수: raw - 원시 추천 코드
 * @반환값: 정규화된 코드(유효하지 않으면 빈 문자열)
 */
export function normalizeRefCode(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32)
}

/**
 * @함수명: buildReferralUrl
 * @설명: 사용자 추천 코드로 추천 링크를 만듭니다(예: https://site/r/ABCD1234).
 * @매개변수: siteUrl - 사이트 기본 URL, code - 추천 코드
 * @반환값: 추천 링크 문자열
 */
export function buildReferralUrl(siteUrl: string, code: string): string {
  const base = (siteUrl || '').replace(/\/+$/, '')
  return `${base}/r/${encodeURIComponent(code)}`
}

/**
 * @함수명: hashIp
 * @설명: 원본 IP를 저장하지 않기 위해 SHA-256으로 해시합니다(선택적 salt).
 * @매개변수: ip - 원본 IP 문자열
 * @반환값: 해시 문자열 또는 null
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const salt = process.env.AFFILIATE_IP_SALT
  if (!salt) return null // salt 미설정 시 약한 가명화 방지 — IP 미저장
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

/**
 * @함수명: getAffiliateConfig
 * @설명: affiliate_program_config 단일 행(모든 규칙의 출처)을 조회합니다.
 * @반환값: 설정 객체 또는 null(미시드/조회 실패)
 */
export async function getAffiliateConfig() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('affiliate_program_config')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  return data as AffiliateConfig | null
}

export interface AffiliateConfig {
  id: boolean
  program_enabled: boolean
  commission_type: 'percent' | 'flat'
  commission_value: number
  is_recurring: boolean
  recurring_months_cap: number
  cookie_days: number
  hold_days: number
  min_payout_credit: number
  currency: string
  self_referral_blocked: boolean
  updated_at: string
}

/**
 * @함수명: attributeReferralOnSignup
 * @설명: 가입 직후 추천 코드를 profiles.referred_by에 기록하고 귀속 행을 생성합니다.
 *        자기추천 차단(config)·중복 귀속 방지. 실패해도 가입 흐름을 막지 않습니다(best-effort).
 * @매개변수: referredUserId - 신규 가입자 ID, rawCode - cz_ref 쿠키의 추천 코드
 */
export async function attributeReferralOnSignup(
  referredUserId: string,
  rawCode: string | null | undefined,
): Promise<void> {
  const code = normalizeRefCode(rawCode)
  if (!code) return

  try {
    const admin = createAdminClient()

    // 추천인 조회 (affiliate_code → user id). 없으면 무시.
    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .eq('affiliate_code', code)
      .maybeSingle()
    if (!referrer) return

    // 설정 없거나 프로그램 비활성이면 귀속하지 않음(마스터 스위치)
    const cfg = await getAffiliateConfig()
    if (!cfg || !cfg.program_enabled) return

    // 자기추천 차단
    if (cfg.self_referral_blocked && referrer.id === referredUserId) return

    // referred_by 기록 (아직 없을 때만 — last-click이 아닌 가입 시점 1회 고정)
    const { data: me } = await admin
      .from('profiles')
      .select('referred_by')
      .eq('id', referredUserId)
      .maybeSingle()
    if (me && !me.referred_by) {
      await admin.from('profiles').update({ referred_by: code }).eq('id', referredUserId)
    }

    // 귀속 행 생성 (피추천인당 1건 — 이미 있으면 건너뜀)
    const { data: existing } = await admin
      .from('affiliate_attributions')
      .select('id')
      .eq('referred_user_id', referredUserId)
      .maybeSingle()
    if (!existing) {
      await admin.from('affiliate_attributions').insert({
        referrer_user_id: referrer.id,
        referred_user_id: referredUserId,
        referral_code: code,
      })
    }
  } catch (err) {
    console.error('[affiliate] 가입 귀속 실패:', err)
  }
}
