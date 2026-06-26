/**
 * @파일: admin/affiliates/types.ts
 * @설명: 제휴 관리 공유 타입 — config 편집 입력 형태.
 *        ('use server'/'use client' 양쪽에서 안전하게 import하기 위한 순수 타입 모듈)
 */

export interface AffiliateConfigInput {
  program_enabled: boolean
  commission_type: string
  commission_value: number
  is_recurring: boolean
  recurring_months_cap: number
  cookie_days: number
  hold_days: number
  min_payout_credit: number
  currency: string
  self_referral_blocked: boolean
}
