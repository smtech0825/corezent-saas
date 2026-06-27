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

import { createClient } from '@supabase/supabase-js'

// 라이선스 데이터(license_keys / hwid_mapping)는 별도 Supabase 프로젝트에 보관.
// CoreZent 본체용 createAdminClient(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)와
// 다른 프로젝트이므로 라이선스 전용 admin client를 별도 환경변수로 분리한다.
//   - LICENSE_SUPABASE_URL              : 라이선스 데이터가 있는 Supabase 프로젝트 URL
//   - LICENSE_SUPABASE_SERVICE_ROLE_KEY : 그 프로젝트의 service_role 키 (RLS 우회)
function createLicenseAdminClient() {
  return createClient(
    process.env.LICENSE_SUPABASE_URL!,
    process.env.LICENSE_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GenieWork 전용 Supabase admin client.
// geniestock(LICENSE_SUPABASE_*)과 물리적으로 분리된 별도 프로젝트를 본다.
//   - GW_SUPABASE_URL              : GenieWork 전용 Supabase 프로젝트 URL
//   - GW_SUPABASE_SERVICE_ROLE_KEY : 그 프로젝트의 service_role 키 (RLS 우회)
// env 미설정 시 조용히 실패하지 않고 명확한 에러를 던진다.
// (이 검사는 함수가 실제로 호출될 때만 동작하므로 geniestock 경로에는 영향 없음.)
function createGenieWorkAdminClient() {
  const url = process.env.GW_SUPABASE_URL
  const serviceKey = process.env.GW_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'GenieWork 전용 Supabase 환경변수가 설정되지 않았어요. ' +
      'GW_SUPABASE_URL · GW_SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.',
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * @함수명: licenseClientFor
 * @설명: product 값으로 알맞은 라이선스 Supabase admin client를 선택한다.
 *        product가 DB를 결정하는 단일 지점.
 *          - 'geniework' → 전용 Supabase (GW_SUPABASE_*)
 *          - 그 외(geniestock 등·미지정) → 기존 공유 Supabase (LICENSE_SUPABASE_*)
 * @매개변수: product - 라이선스 제품 식별자 (없으면 기존 공유 DB)
 * @반환값: 선택된 Supabase admin client
 * @비고: 라이선스 헬퍼는 전부 이 함수로 DB를 고른다. product 미지정·'geniestock'이면
 *        기존 공유 DB라 geniestock/geniepost 동작은 그대로.
 */
export function licenseClientFor(product?: SupabaseProduct) {
  return product === 'geniework'
    ? createGenieWorkAdminClient()
    : createLicenseAdminClient()
}

// ─── 타입 ────────────────────────────────────────────────────────────────

export type Tier = 'lite' | 'pro' | 'max' | '1pc' | '3pc' | '5pc' | '10pc'
export type SupabaseProduct = 'geniestock' | 'geniework'

export interface SupabaseLicense {
  licenseKey: string
  tier: Tier
  buyerEmail: string | null
  expiresAt: string | null
  isActive: boolean
  source: string
  product: SupabaseProduct
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
  '1pc':  1,
  '3pc':  3,
  '5pc':  5,
  '10pc': 10,
}

// ─── 조회 ────────────────────────────────────────────────────────────────

/** 라이선스 키로 행 조회. product 지정 시 해당 제품으로 필터. 없으면 전 제품 검색. */
export async function findLicenseByKey(
  key: string,
  product?: SupabaseProduct,
): Promise<SupabaseLicense | null> {
  const trimmed = key?.trim()
  if (!trimmed) return null

  try {
    const admin = licenseClientFor(product)
    let q = admin
      .from('license_keys')
      .select('license_key, tier, source, buyer_email, expires_at, is_active, product')
      .eq('license_key', trimmed)
    if (product) q = q.eq('product', product)
    const { data, error } = await q.maybeSingle()

    if (error) {
      console.error('[supabase-license] findLicenseByKey error:', error)
      throw new Error(`라이선스 조회 실패: ${error.message}`)
    }
    if (!data) return null

    const rawTier = String(data.tier ?? '').toLowerCase().trim()
    const validTiers: readonly string[] = ['lite', 'pro', 'max', '1pc', '3pc', '5pc', '10pc']
    const tier: Tier = validTiers.includes(rawTier) ? (rawTier as Tier) : 'lite'

    const rawProduct = String(data.product ?? 'geniestock').toLowerCase().trim()
    const productResolved: SupabaseProduct = rawProduct === 'geniework' ? 'geniework' : 'geniestock'

    return {
      licenseKey:  data.license_key as string,
      tier,
      buyerEmail:  (data.buyer_email as string) ?? null,
      expiresAt:   (data.expires_at as string) ?? null,
      isActive:    Boolean(data.is_active),
      source:      String(data.source ?? ''),
      product:     productResolved,
    }
  } catch (err) {
    console.error('[supabase-license] findLicenseByKey exception:', err)
    throw err
  }
}

/**
 * @함수명: findLicenseInAnyDb
 * @설명: 키를 양쪽 라이선스 Supabase(기존 공유 + GW 전용)에서 찾아,
 *        라이선스와 "어느 DB에서 찾았는지(db)"를 함께 반환한다.
 *        - 공유 DB를 먼저 조회 → geniestock 이벤트는 GW 클라이언트를 건드리지 않음
 *          (GW env 미설정 시에도 geniestock/geniepost 경로 안전).
 *        - 공유 DB 조회는 product 필터가 없어, 분리 전 공유 DB에 남은 geniework 행도 잡는다.
 *        - 양쪽 다 없으면 null → 호출 측에서 geniepost(Sheets) 경로로 처리.
 * @매개변수: key - 라이선스 키 (UNIQUE라 한 DB에만 존재)
 * @반환값: { license, db } 또는 null. db는 mutation 시 licenseClientFor 선택 기준.
 */
export async function findLicenseInAnyDb(
  key: string,
): Promise<{ license: SupabaseLicense; db: 'shared' | 'geniework' } | null> {
  const shared = await findLicenseByKey(key)
  if (shared) return { license: shared, db: 'shared' }

  try {
    const gw = await findLicenseByKey(key, 'geniework')
    if (gw) return { license: gw, db: 'geniework' }
  } catch (err) {
    // GW env 미설정 등으로 GW DB 조회가 실패해도 조용히 폴백(공유/Sheets 경로 보존).
    console.error('[supabase-license] findLicenseInAnyDb: GW DB 조회 실패(무시):', err)
  }
  return null
}

/** 키에 등록된 HWID 목록. product로 DB 선택(geniework=전용 Supabase). */
export async function getHwidsForKey(
  key: string,
  product?: SupabaseProduct,
): Promise<HwidEntry[]> {
  const trimmed = key?.trim()
  if (!trimmed) return []

  try {
    const admin = licenseClientFor(product)
    // GenieStock Supabase의 hwid_mapping 테이블은 표준 created_at 컬럼을 사용 (registered_at 아님).
    const { data, error } = await admin
      .from('hwid_mapping')
      .select('hwid, created_at, device_name')
      .eq('license_key', trimmed)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[supabase-license] getHwidsForKey error:', error)
      throw new Error(`HWID 조회 실패: ${error.message}`)
    }

    return (data ?? []).map((r) => ({
      hwid:         r.hwid as string,
      registeredAt: r.created_at as string,
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
 * ★ product를 내부 조회(findLicenseByKey·getHwidsForKey)에도 전달해야 한도 검사와
 *   INSERT가 같은 DB를 본다. (안 그러면 한도=옛 DB, 등록=새 DB로 엇갈림)
 */
export async function registerHwid(
  key: string,
  hwid: string,
  product?: SupabaseProduct,
  deviceName?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const k = key?.trim()
  const h = hwid?.trim()
  if (!k || !h) return { ok: false, reason: 'INVALID_INPUT' }

  try {
    const license = await findLicenseByKey(k, product)
    if (!license) return { ok: false, reason: 'NOT_FOUND' }

    // 티어별 동시 한도(동시한도는 코드 유지 — tier 문자열이 단일 출처)
    const limit = HWID_LIMITS[license.tier]

    // ── GenieWork: 원자적 RPC로 처리(직렬화로 TOCTOU 차단 + 분당 rate limit) ──
    //    "카운트→insert"를 DB 함수 한 트랜잭션(키 단위 advisory lock)에서 수행하므로
    //    동시 신규 HWID 2건이 한도를 넘겨 insert되는 경합이 불가능하다.
    //    geniestock는 아래 기존 read-then-insert 경로 그대로(이 RPC에 안 닿음).
    if (product === 'geniework') {
      const admin = licenseClientFor(product)
      const { data, error } = await admin.rpc('register_geniework_hwid', {
        p_license_key: k,
        p_hwid:        h,
        p_max:         limit,
        p_device_name: deviceName ?? null,
      })
      if (error) {
        console.error('[supabase-license] register_geniework_hwid RPC error:', error)
        throw new Error(`HWID 등록 실패: ${error.message}`)
      }
      const res = (data ?? {}) as { ok?: boolean; reason?: string }
      return { ok: Boolean(res.ok), reason: res.reason }
    }

    // ── GenieStock(기존) — read-then-insert 경로. 변경 없음. ──
    const hwids = await getHwidsForKey(k, product)

    // 이미 등록된 HWID — idempotent 성공
    if (hwids.some((entry) => entry.hwid === h)) {
      return { ok: true }
    }

    // 티어별 한도 검사
    if (hwids.length >= limit) {
      return { ok: false, reason: 'HWID_LIMIT_REACHED' }
    }

    const admin = licenseClientFor(product)
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

/** 키의 모든 HWID 삭제 (PC 변경용). product로 DB 선택(geniework=전용 Supabase). */
export async function resetHwidsForKey(key: string, product?: SupabaseProduct): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = licenseClientFor(product)
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

/**
 * @함수명: resetHwidsForKeyGenieWork
 * @설명: GenieWork 전용 reset — 원자적 RPC(reset_geniework_hwids) 호출.
 *        키 단위 advisory lock으로 register와 직렬화 + 분당 reset rate limit +
 *        전체삭제 + 이력 기록(누적 이력은 보존). geniestock는 기존 resetHwidsForKey 사용.
 * @매개변수: key - 라이선스 키 (geniework 전용 — 항상 GW_SUPABASE)
 * @반환값: { ok, reason?, deleted?, nextAllowedAt? }
 *          reason: reset | RATE_LIMITED | RESET_PERIOD_LIMITED | NO_CONFIG | INVALID_INPUT
 *          nextAllowedAt: 주기 한도 초과 시 다음 reset 가능 시각(ISO) — RESET_PERIOD_LIMITED일 때만
 * @비고: 돈·접근권한 경로 — RPC 오류는 삼키지 않고 throw로 전파(fail-closed).
 */
export async function resetHwidsForKeyGenieWork(
  key: string,
): Promise<{ ok: boolean; reason?: string; deleted?: number; nextAllowedAt?: string }> {
  const k = key?.trim()
  if (!k) return { ok: false, reason: 'INVALID_INPUT' }

  try {
    const admin = licenseClientFor('geniework')
    const { data, error } = await admin.rpc('reset_geniework_hwids', { p_license_key: k })
    if (error) {
      console.error('[supabase-license] reset_geniework_hwids RPC error:', error)
      throw new Error(`HWID 초기화 실패: ${error.message}`)
    }
    const res = (data ?? {}) as {
      ok?: boolean; reason?: string; deleted?: number; next_allowed_at?: string
    }
    return {
      ok: Boolean(res.ok),
      reason: res.reason,
      deleted: res.deleted,
      nextAllowedAt: res.next_allowed_at ?? undefined,
    }
  } catch (err) {
    console.error('[supabase-license] resetHwidsForKeyGenieWork exception:', err)
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
  product:    SupabaseProduct
}): Promise<void> {
  try {
    const admin = licenseClientFor(input.product)

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
      product:     input.product,
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

/**
 * @함수명: upsertLicenseForOrder
 * @설명: ls_order_id 기준 upsert (subscription_created/GenieWork 전용).
 *        - 행 있음(license_key_created가 먼저 LS키 stub 생성) → tier·expires·buyer·product만
 *          채우고 license_key(LS키)는 보존.
 *        - 행 없음 → 전체 INSERT(폴백 키).
 *        ★ls_order_id 컬럼은 GW DB에만 있으므로 product는 'geniework'만 전달할 것.
 * @반환값: { finalKey, wasExisting } finalKey = 실제 저장된 키(stub 있었으면 LS키)
 */
export async function upsertLicenseForOrder(input: {
  lsOrderId:  string
  licenseKey: string
  tier:       Tier
  buyerEmail: string
  expiresAt:  string | null
  source:     'lemon_squeezy' | 'manual'
  product:    SupabaseProduct
}): Promise<{ finalKey: string; wasExisting: boolean }> {
  const admin = licenseClientFor(input.product)

  const { data: existing } = await admin
    .from('license_keys')
    .select('license_key')
    .eq('ls_order_id', input.lsOrderId)
    .eq('product', input.product)
    .maybeSingle()

  if (existing) {
    // 행 있음 → 메타데이터만 채우고 license_key(LS키)는 덮지 않음
    const { error } = await admin
      .from('license_keys')
      .update({
        tier:        input.tier,
        buyer_email: input.buyerEmail,
        expires_at:  input.expiresAt,
        product:     input.product,
      })
      .eq('ls_order_id', input.lsOrderId)
      .eq('product', input.product)
    if (error) throw new Error(`라이선스 메타 갱신 실패: ${error.message}`)
    return { finalKey: existing.license_key as string, wasExisting: true }
  }

  // 행 없음 → 전체 INSERT
  const { error } = await admin.from('license_keys').insert({
    ls_order_id: input.lsOrderId,
    license_key: input.licenseKey,
    tier:        input.tier,
    source:      input.source,
    buyer_email: input.buyerEmail,
    expires_at:  input.expiresAt,
    is_active:   true,
    product:     input.product,
  })
  if (error) throw new Error(`라이선스 등록 실패: ${error.message}`)
  return { finalKey: input.licenseKey, wasExisting: false }
}

/**
 * @함수명: applyLsKeyForOrder
 * @설명: license_key_created 처리 — ls_order_id 기준으로 LS키를 license_keys에 반영.
 *        - 행 있음 → license_key를 LS키로 UPDATE(self-gen→LS 교체) + hwid_mapping 정합 방어.
 *        - 행 없음(선도착) → stub INSERT(tier 생략=NULL, license_key=LS키).
 *        ★GenieWork 전용(GW DB만 ls_order_id 컬럼). 멱등(이미 LS키면 noop).
 * @반환값: { action } 'updated' | 'inserted' | 'noop'
 */
export async function applyLsKeyForOrder(input: {
  lsOrderId:  string
  lsKey:      string
  product:    SupabaseProduct
  buyerEmail: string | null
}): Promise<{ action: 'updated' | 'inserted' | 'noop' }> {
  const admin = licenseClientFor(input.product)

  const { data: existing } = await admin
    .from('license_keys')
    .select('license_key')
    .eq('ls_order_id', input.lsOrderId)
    .eq('product', input.product)
    .maybeSingle()

  if (existing) {
    const oldKey = existing.license_key as string
    if (oldKey === input.lsKey) return { action: 'noop' }  // 멱등 — 이미 LS키

    const { error } = await admin
      .from('license_keys')
      .update({ license_key: input.lsKey })
      .eq('ls_order_id', input.lsOrderId)
      .eq('product', input.product)
    if (error) throw new Error(`LS키 교체 실패: ${error.message}`)

    // HWID 정합 방어: 옛 키 참조 매핑이 있으면 함께 갱신(첫 인증 전이라 보통 0건 → no-op)
    const { error: hwidErr } = await admin
      .from('hwid_mapping')
      .update({ license_key: input.lsKey })
      .eq('license_key', oldKey)
    if (hwidErr) console.error('[supabase-license] applyLsKeyForOrder hwid 갱신 경고:', hwidErr)

    return { action: 'updated' }
  }

  // 행 없음 → stub INSERT (tier 생략 = NULL; subscription_created가 나중에 채움)
  const { error } = await admin.from('license_keys').insert({
    ls_order_id: input.lsOrderId,
    license_key: input.lsKey,
    product:     input.product,
    is_active:   true,
    buyer_email: input.buyerEmail,
    source:      'lemon_squeezy',
  })
  if (error) throw new Error(`stub 라이선스 등록 실패: ${error.message}`)
  return { action: 'inserted' }
}

/** 만료일 갱신 (구독 갱신 시 LS 웹훅에서 호출). product로 DB 선택. */
export async function updateLicenseExpiry(
  key: string,
  expiresAt: string,
  product?: SupabaseProduct,
): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = licenseClientFor(product)
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

/** 활성 상태 토글 (취소/환불 시 LS 웹훅에서 호출). product로 DB 선택. */
export async function setLicenseActive(
  key: string,
  isActive: boolean,
  product?: SupabaseProduct,
): Promise<void> {
  const k = key?.trim()
  if (!k) return

  try {
    const admin = licenseClientFor(product)
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
