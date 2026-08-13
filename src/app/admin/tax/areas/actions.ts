'use server'

/**
 * @파일: admin/tax/areas/actions.ts
 * @설명: 규제지역 이력 등록·수정 서버 액션.
 *        소재지는 계산기와 동일한 행정구역 목록(regions.ts)만 허용하고,
 *        region_code도 동일한 buildRegionCode()로 조립해 코드 불일치를 원천 차단한다.
 *        지정일·공고 링크는 필수, 적용 세목은 'all' 또는 세목 목록 중 1개 이상.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { guardAdmin, dbFailure, type AdminActionResult } from '@/app/admin/_lib/adminActionResult'
import { isValidDateString } from '@/lib/tax/rule-store'
import { buildRegionCode, isKnownRegion } from '@/lib/tax/regions'
import { AREA_TYPES, TAX_TYPES } from '@/lib/tax/labels'
import type { RegulatedAreaType, TaxType } from '@/lib/tax/types'

/** 규제지역 저장 요청 */
export interface TaxAreaPayload {
  id?: string
  sido: string
  sigungu: string
  area_type: RegulatedAreaType
  /** true면 전 세목('all') 적용 */
  appliesAll: boolean
  /** appliesAll=false일 때 적용 세목 목록 */
  appliesTo: TaxType[]
  designated_from: string
  designated_to: string | null
  source_url: string
  /** 메모(선택, 059) — 적용 한계·일부 동·읍·면 한정 지정 등 행 단위 기록 */
  note: string | null
}

/** 실패 결과 생성 헬퍼 */
function failed(reason: string): AdminActionResult {
  return { status: 'failed', reason }
}

/**
 * @함수명: saveTaxArea
 * @설명: 규제지역 이력을 등록(id 없음)하거나 수정(id 있음)합니다.
 * @매개변수: payload - 저장 요청
 * @반환값: AdminActionResult (실패 시 한국어 사유)
 */
export async function saveTaxArea(payload: TaxAreaPayload): Promise<AdminActionResult> {
  const guard = await guardAdmin()
  if (guard) return guard

  // ── 검증 — 소재지는 계산기와 같은 목록만 허용 ─────────────────────────────
  if (!isKnownRegion(payload.sido, payload.sigungu)) {
    return failed('소재지는 목록에서 선택해 주세요. (계산기와 같은 행정구역 목록만 허용됩니다)')
  }
  if (!AREA_TYPES.includes(payload.area_type)) return failed('규제 구분이 올바르지 않습니다.')
  if (!isValidDateString(payload.designated_from)) return failed('지정일을 입력해 주세요. (YYYY-MM-DD)')
  if (payload.designated_to !== null) {
    if (!isValidDateString(payload.designated_to)) return failed('해제일 형식이 올바르지 않습니다. (YYYY-MM-DD)')
    if (payload.designated_to < payload.designated_from) return failed('해제일이 지정일보다 앞설 수 없습니다.')
  }
  if (!/^https?:\/\/.+/.test(payload.source_url.trim())) {
    return failed('국토교통부 공고 링크를 http(s) 주소로 입력해 주세요. 공고 근거 없는 이력은 저장할 수 없습니다.')
  }

  let appliesTo: string[]
  if (payload.appliesAll) {
    appliesTo = ['all']
  } else {
    const picked = payload.appliesTo.filter((t) => TAX_TYPES.includes(t))
    if (picked.length === 0) return failed('적용 세목을 1개 이상 선택하거나 전 세목을 선택해 주세요.')
    appliesTo = picked
  }

  // ── 저장 — region_code는 계산기와 동일한 규칙으로 서버에서 조립 ───────────
  const admin = createAdminClient()
  const row = {
    sido: payload.sido,
    sigungu: payload.sigungu,
    region_code: buildRegionCode(payload.sido, payload.sigungu),
    area_type: payload.area_type,
    applies_to: appliesTo,
    designated_from: payload.designated_from,
    designated_to: payload.designated_to,
    source_url: payload.source_url.trim(),
    note: payload.note?.trim() || null,   // 빈 문자열은 NULL로 — 룰 저장(saveTaxRule)과 같은 관례
  }

  const { error } = payload.id
    ? await admin.from('tax_regulated_areas').update(row).eq('id', payload.id)
    : await admin.from('tax_regulated_areas').insert(row)

  if (error) return dbFailure('규제지역 저장', error)

  revalidatePath('/admin/tax/areas')
  return { status: 'ok' }
}
