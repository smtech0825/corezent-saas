'use server'

/**
 * @파일: admin/tax/rules/actions.ts
 * @설명: 세금 룰 등록·수정 서버 액션.
 *        시행일·status·법령명·조문·원문 링크는 필수로 강제하고, rule_value는 JSON 파싱 후
 *        알려진 룰 키면 엔진과 같은 검증기(rule-value.ts)로 스키마까지 검사한다.
 *        같은 (tax_type, rule_key, status)의 기간 겹침은 DB EXCLUDE 제약(056)이 최종
 *        거부하며, 여기서는 그 오류를 한국어로 바꿔 안내한다(저장 전 경고는 화면 담당).
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { COMMON_RULE_KEYS, isValidDateString } from '@/lib/tax/rule-store'
import {
  parseBrokerageRates,
  parseBrokerageVat,
  parseDeemedGiftThreshold,
  parseGiftHeavy,
  parseGiftTaxBase,
  parseMetroScope,
  parseRateTable,
  parseRounding,
  parseStampRates,
} from '@/lib/tax/rule-value'
import { ACQUISITION_RULE_KEYS } from '@/lib/tax/acquisition'
import { STAMP_RULE_KEYS } from '@/lib/tax/stamp'
import { BROKERAGE_RULE_KEYS } from '@/lib/tax/brokerage'
import { RULE_STATUSES, RULE_TAX_TYPES, RULE_TAX_TYPE_LABELS } from '@/lib/tax/labels'
import type { Json, TaxRuleStatus, TaxRuleTaxType } from '@/lib/tax/types'

/** 룰 저장 요청 — rule_value는 JSON 문자열로 받아 서버가 파싱·검증한다 */
export interface TaxRulePayload {
  id?: string
  tax_type: TaxRuleTaxType
  rule_key: string
  rule_value_text: string
  effective_from: string
  effective_to: string | null
  status: TaxRuleStatus
  law_name: string
  law_article: string
  law_url: string
  law_id: string | null         // 법제처 법령 ID (선택)
  law_article_no: string | null // 법제처 조문번호 6자리 = 조번호 4자리 + 가지번호 2자리 (선택)
  note: string | null
}

/** 알려진 룰 키 → 엔진과 동일한 rule_value 검증기 */
const VALUE_VALIDATORS: Record<string, (value: Json, ruleKey: string) => { ok: true } | { ok: false; message: string }> = {
  [ACQUISITION_RULE_KEYS.onerousRates]: parseRateTable,
  [ACQUISITION_RULE_KEYS.giftRates]: parseRateTable,
  [ACQUISITION_RULE_KEYS.giftTaxBase]: parseGiftTaxBase,
  [ACQUISITION_RULE_KEYS.giftHeavy]: parseGiftHeavy,
  [ACQUISITION_RULE_KEYS.deemedGiftThreshold]: parseDeemedGiftThreshold,
  [ACQUISITION_RULE_KEYS.rounding]: parseRounding,
  [STAMP_RULE_KEYS.rates]: parseStampRates,
  [BROKERAGE_RULE_KEYS.rates]: parseBrokerageRates,
  [BROKERAGE_RULE_KEYS.vat]: parseBrokerageVat,
  [COMMON_RULE_KEYS.metroScope]: parseMetroScope,
}

/** 실패 결과 생성 헬퍼 */
function failed(reason: string): AdminActionResult {
  return { status: 'failed', reason }
}

/**
 * 알려진 룰 키 → 반드시 저장해야 하는 세목.
 * 다른 세목으로 저장하면 계산기의 fetchValidRules(세목별 조회)가 그 룰을 찾지 못해,
 * 저장은 성공했는데 계산은 계속 "룰 미등록"이 되는 함정이 생긴다 — 저장 단계에서 차단.
 */
const KEY_REQUIRED_TAX_TYPE: Record<string, TaxRuleTaxType> = {
  [ACQUISITION_RULE_KEYS.onerousRates]: 'acquisition',
  [ACQUISITION_RULE_KEYS.giftTaxBase]: 'acquisition',
  [ACQUISITION_RULE_KEYS.giftRates]: 'acquisition',
  [ACQUISITION_RULE_KEYS.giftHeavy]: 'acquisition',
  [ACQUISITION_RULE_KEYS.deemedGiftThreshold]: 'acquisition',
  [ACQUISITION_RULE_KEYS.rounding]: 'acquisition',
  [STAMP_RULE_KEYS.rates]: 'stamp',
  [BROKERAGE_RULE_KEYS.rates]: 'brokerage',
  [BROKERAGE_RULE_KEYS.vat]: 'brokerage',
  [COMMON_RULE_KEYS.metroScope]: 'common',
}

/**
 * @함수명: saveTaxRule
 * @설명: 룰을 등록(id 없음)하거나 수정(id 있음)합니다. 필수 입력·형식·스키마를 모두
 *        통과해야 저장되며, 근거(법령명·조문·원문 링크) 없는 룰은 저장할 수 없습니다.
 * @매개변수: payload - 룰 저장 요청
 * @반환값: AdminActionResult (실패 시 한국어 사유)
 */
export async function saveTaxRule(payload: TaxRulePayload): Promise<AdminActionResult> {
  const guard = await guardAdmin()
  if (guard) return guard

  // ── 필수 입력 강제 ─────────────────────────────────────────────────────────
  const ruleKey = payload.rule_key.trim()
  const lawName = payload.law_name.trim()
  const lawArticle = payload.law_article.trim()
  const lawUrl = payload.law_url.trim()
  if (!RULE_TAX_TYPES.includes(payload.tax_type)) return failed('세목이 올바르지 않습니다.')
  if (!ruleKey) return failed('룰 키를 입력해 주세요.')
  // 알려진 룰 키는 정해진 세목으로만 저장 허용 — 세목이 어긋나면 계산기가 룰을 못 찾는다
  const requiredType = KEY_REQUIRED_TAX_TYPE[ruleKey]
  if (requiredType && payload.tax_type !== requiredType) {
    return failed(
      `'${ruleKey}' 룰은 세목을 '${RULE_TAX_TYPE_LABELS[requiredType]}'(으)로 등록해야 합니다. ` +
        '다른 세목에 저장하면 계산기가 이 룰을 찾지 못합니다.',
    )
  }
  if (!RULE_STATUSES.includes(payload.status)) return failed('상태(확정/개정안/폐지)를 선택해 주세요.')
  if (!isValidDateString(payload.effective_from)) return failed('시행일을 입력해 주세요. (YYYY-MM-DD)')
  if (payload.effective_to !== null) {
    if (!isValidDateString(payload.effective_to)) return failed('종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
    if (payload.effective_to < payload.effective_from) return failed('종료일이 시행일보다 앞설 수 없습니다.')
  }
  if (!lawName) return failed('근거 법령명을 입력해 주세요. 근거 없는 룰은 저장할 수 없습니다.')
  if (!lawArticle) return failed('근거 조문을 입력해 주세요. 근거 없는 룰은 저장할 수 없습니다.')
  if (!/^https?:\/\/.+/.test(lawUrl)) return failed('법제처 원문 링크를 http(s) 주소로 입력해 주세요.')

  // 법령 참조(선택) — 법령 개정 자동 감시(다음 Stage)가 이 값으로 조회한다
  const lawId = payload.law_id?.trim() || null
  const lawArticleNo = payload.law_article_no?.trim() || null
  if (lawArticleNo !== null && !/^\d{6}$/.test(lawArticleNo)) {
    return failed('조문번호는 법제처 API 형식의 6자리 숫자(조번호 4자리 + 가지번호 2자리)로 입력해 주세요. 모르면 비워두세요.')
  }

  // ── rule_value 파싱·스키마 검증 ────────────────────────────────────────────
  let ruleValue: Json
  try {
    ruleValue = JSON.parse(payload.rule_value_text) as Json
  } catch {
    return failed('룰 값이 올바른 JSON이 아닙니다. «...» 자리표시자를 실제 값으로 바꿨는지 확인해 주세요.')
  }
  const validator = VALUE_VALIDATORS[ruleKey]
  if (validator) {
    const checked = validator(ruleValue, ruleKey)
    if (!checked.ok) return failed(checked.message)
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const row = {
    tax_type: payload.tax_type,
    rule_key: ruleKey,
    rule_value: ruleValue,
    effective_from: payload.effective_from,
    effective_to: payload.effective_to,
    status: payload.status,
    law_name: lawName,
    law_article: lawArticle,
    law_url: lawUrl,
    law_id: lawId,
    law_article_no: lawArticleNo,
    note: payload.note?.trim() || null,
  }

  const { error } = payload.id
    ? await admin.from('tax_rules').update(row).eq('id', payload.id)
    : await admin.from('tax_rules').insert(row)

  if (error) {
    // 23P01 = EXCLUDE 제약(056) 위반 — 같은 상태의 기간 겹침을 DB가 거부
    if (error.code === '23P01') {
      return failed(
        '같은 룰 키·같은 상태에서 시행 기간이 겹치는 룰이 이미 있어 저장이 거부되었습니다. 기존 룰의 종료일을 먼저 정리해 주세요.',
      )
    }
    return dbFailure('세금 룰 저장', error)
  }

  revalidatePath('/admin/tax/rules')
  return { status: 'ok' }
}
