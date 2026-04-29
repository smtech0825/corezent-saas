/**
 * GenieStock 라이선스 헬퍼 — Supabase 기반
 *
 * _lib.ts(GeniePost/Google Sheets)의 API 표면을 미러링하지만 Supabase로 동작합니다.
 * GeniePost 코드 경로는 절대 수정 금지 (이 파일은 product='geniestock' 요청만 처리).
 *
 * 테이블:
 *   license_keys  — 라이선스 정보 (license_key UNIQUE)
 *   hwid_mapping  — (license_key, hwid) 매핑, 티어별 다중 PC 지원
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (서버 전용)
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─── 타입 ────────────────────────────────────────────────────────────────

export type Tier = 'lite' | 'pro' | 'max'

export interface SupabaseLicense {
  licenseKey: string
  tier: Tier
  buyerEmail: string | null
  expiresAt: string | null
  isActive: boolean
  source: string
}

export interface HwidEntry {
  hwid: string
  registeredAt: string
  deviceName: string | null
}

// ─── 티어별 HWID 한도 ─────────────────────────────────────────────────────

export const HWID_LIMITS: Record<Tier, number> = {
  lite: 1,
  pro:  2,
  max:  3,
}

// ─── 조회 ────────────────────────────────────────────────────────────────

/** 라이선스 키로 행 조회. 없으면 null. */
export async function findLicenseByKey(key: string): Promise<SupabaseLicense | null> {
  const trimmed = key?.trim()
  if (!trimmed) return null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('license_keys')
      .select('license_key, tier, source, buyer_email, expires_at, is_active')
      .eq('license_key', trimmed)
      .maybeSingle()

    if (error) {
      console.error('[supabase-license] findLicenseByKey error:', error)
      throw new Error(`라이선스 조회 실패: ${error.message}`)
    }
    if (!data) return null

    const rawTier = String(data.tier ?? '').toLowerCase().trim()
    const tier: Tier = rawTier === 'max' ? 'max' : rawTier === 'pro' ? 'pro' : 'lite'

    return {
      licenseKey:  data.license_key as string,
      tier,
      buyerEmail:  (data.buyer_email as string) ?? null,
      expiresAt:   (data.expires_at as string) ?? null,
      isActive:    Boolean(data.is_active),
      source:      String(data.source ?? ''),
    }
  } catch (err) {
    console.error('[supabase-license] findLicenseByKey exception:', err)
    throw err
  }
}

/** 키에 등록된 HWID 목록. */
export async function getHwidsForKey(key: string): Promise<HwidEntry[]> {
  const trimmed = key?.trim()
  if (!trimmed) return []

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('hwid_mapping')
      .select('hwid, registered_at, device_name')
      .eq('license_key', trimmed)
      .order('registered_at', { ascending: true })

    if (error) {
      console.error('[supabase-license] getHwidsForKey error:', error)
      throw new Error(`HWID 조회 실패: ${error.message}`)
    }

    return (data ?? []).map((r) => ({
      hwid:         r.hwid as string,
      registeredAt: r.registered_at as string,
      deviceName:   (r.device_name as string) ?? null,
    }))
  } catch (err) {
    console.error('[supabase-license] getHwidsForKey exception:', err)
    throw err
  }
}

// ─── 쓰기 ────────────────────────────────────────────────────────────────

/**
 * HWID 등록.
 * - 이미 등록된 HWID면 idempotent하게 { ok: true } 반환
 * - 한도 초과 시 { ok: false, reason: 'HWID_LIMIT_REACHED' }
 */
export async function registerHwid(
  key: string,
  hwid: string,
  deviceName?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const k = key?.trim()
  const h = hwid?.trim()
  if (!k || !h) return { ok: false, reason: 'INVALID_INPUT' }

  try {
    const license = await findLicenseByKey(k)
    if (!license) return { ok: false, reason: 'NOT_FOUND' }

    const hwids = await getHwidsForKey(k)

    // 이미 등록된 HWID — idempotent 성공
    if (hwids.some((entry) => entry.hwid === h)) {
      return { ok: true }
    }

    // 티어별 한도 검사
    const limit = HWID_LIMITS[license.tier]
    if (hwids.length >= limit) {
      return { ok: false, reason: 'HWID_LIMIT_REACHED' }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('hwid_mapping').insert({
      license_key: k,
      hwid:        h,
      device_name: deviceName ?? null,
    })

    if (error) {
      console.error('[supabase-license] registerHwid insert error:', error)
      throw new Error(`HWID 등록 실패: ${error.message}`)
    }

    return { ok: true }
  } catch (err) {
    console.error('[supabase-license] registerHwid exception:', err)
    throw err
  }
}

/** 키의 모든 HWID 삭제 (PC 변경용). */
export async function resetHwidsForKey(key: string): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('hwid_mapping').delete().eq('license_key', k)
    if (error) {
      console.error('[supabase-license] resetHwidsForKey error:', error)
      throw new Error(`HWID 초기화 실패: ${error.message}`)
    }
  } catch (err) {
    console.error('[supabase-license] resetHwidsForKey exception:', err)
    throw err
  }
}

/** 신규 라이선스 INSERT (LS 웹훅에서 호출). 중복은 무시. */
export async function insertLicense(input: {
  licenseKey: string
  tier:       Tier
  buyerEmail: string
  expiresAt:  string | null
  source:     'lemon_squeezy' | 'manual'
}): Promise<void> {
  try {
    const admin = createAdminClient()

    // 중복 키 무시 (idempotent — 웹훅 재전송 대비)
    const { data: existing } = await admin
      .from('license_keys')
      .select('id')
      .eq('license_key', input.licenseKey)
      .maybeSingle()
    if (existing) {
      console.log(`[supabase-license] insertLicense: 이미 존재 — skip (${input.licenseKey.slice(0, 8)}...)`)
      return
    }

    const { error } = await admin.from('license_keys').insert({
      license_key: input.licenseKey,
      tier:        input.tier,
      source:      input.source,
      buyer_email: input.buyerEmail,
      expires_at:  input.expiresAt,
      is_active:   true,
    })

    if (error) {
      console.error('[supabase-license] insertLicense error:', error)
      throw new Error(`라이선스 등록 실패: ${error.message}`)
    }
  } catch (err) {
    console.error('[supabase-license] insertLicense exception:', err)
    throw err
  }
}

/** 만료일 갱신 (구독 갱신 시 LS 웹훅에서 호출). */
export async function updateLicenseExpiry(key: string, expiresAt: string): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('license_keys')
      .update({ expires_at: expiresAt })
      .eq('license_key', k)
    if (error) {
      console.error('[supabase-license] updateLicenseExpiry error:', error)
      throw new Error(`만료일 갱신 실패: ${error.message}`)
    }
  } catch (err) {
    console.error('[supabase-license] updateLicenseExpiry exception:', err)
    throw err
  }
}

/** 활성 상태 토글 (취소/환불 시 LS 웹훅에서 호출). */
export async function setLicenseActive(key: string, isActive: boolean): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('license_keys')
      .update({ is_active: isActive })
      .eq('license_key', k)
    if (error) {
      console.error('[supabase-license] setLicenseActive error:', error)
      throw new Error(`활성 상태 변경 실패: ${error.message}`)
    }
  } catch (err) {
    console.error('[supabase-license] setLicenseActive exception:', err)
    throw err
  }
}

// ─── 헬퍼 (_lib.ts API와 동일한 시그니처) ────────────────────────────────

/** 라이선스 만료 여부. is_active 검사는 별도. */
export function isExpired(license: SupabaseLicense): boolean {
  if (!license.expiresAt) return false  // null = 영구
  return new Date(license.expiresAt).getTime() < Date.now()
}

/** 만료일까지 남은 일수. 영구는 9999. */
export function calcRemainingDays(expiresAt: string | null): number {
  if (!expiresAt) return 9999
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 86_400_000))
}
