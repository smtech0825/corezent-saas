# Task: Corezent — GenieStock License Migration to Supabase

## Overview
Migrate GenieStock license management from Google Sheets to Supabase.
GeniePost stays on Google Sheets (untouched).
Use a `product` field to route requests to the correct backend.

---

## ABSOLUTE RULES

- **DO NOT modify any file not listed** in "Files to Modify" below. If a fix requires touching an unlisted file, STOP and report.
- **DO NOT touch existing GeniePost license logic.** All GeniePost-related code paths must remain identical.
- **DO NOT modify `src/app/api/license/_lib.ts`.** This is the GeniePost helper — stays as-is.
- **DO NOT modify `src/lib/sheets.ts`.** This handles GeniePost LS webhook sheet operations.
- Existing requests without `product` field must default to GeniePost behavior (backward compatibility).
- New `product='geniestock'` requests must use Supabase exclusively.
- **Do NOT repeat past mistakes**: no untested SQL, no missing error handling, no hardcoded environment values.
- Run `npm run build` after all changes. Must pass with 0 errors.
- After completion: commit message format `feat: GenieStock 라이선스 Supabase 분리 (GeniePost는 시트 유지)`

---

## Files to Modify

| File | Action |
|---|---|
| `src/app/api/license/_lib_supabase.ts` | CREATE (new file) |
| `src/app/api/license/validate/route.ts` | MODIFY (add product branching) |
| `src/app/api/license/reset/route.ts` | MODIFY (add product branching) |
| `src/app/api/license/upgrade/route.ts` | MODIFY (add product branching) |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | MODIFY (add Supabase INSERT for GenieStock orders) |

DO NOT touch any other file.

---

## Supabase Schema (already created)

**Table: `license_keys`**
| Column | Type | Notes |
|---|---|---|
| id | int8 | auto |
| license_key | text | unique |
| tier | text | 'lite' / 'pro' / 'max' |
| source | text | 'lemon_squeezy' / 'manual' |
| buyer_email | text | nullable |
| issued_at | timestamptz | default now() |
| expires_at | timestamptz | nullable (null = permanent) |
| is_active | bool | default true |
| memo | text | nullable |
| created_at | timestamptz | default now() |

**Table: `hwid_mapping`**
| Column | Type | Notes |
|---|---|---|
| id | int8 | auto |
| license_key | text | not null |
| hwid | text | not null |
| registered_at | timestamptz | default now() |
| device_name | text | nullable |
| created_at | timestamptz | default now() |

---

## Task 1: Create `_lib_supabase.ts`

**Path**: `src/app/api/license/_lib_supabase.ts`

**Purpose**: Mirror the API surface of `_lib.ts` but use Supabase instead of Google Sheets.

### Required exports

```typescript
export interface SupabaseLicense {
  licenseKey: string;
  tier: 'lite' | 'pro' | 'max';
  buyerEmail: string | null;
  expiresAt: string | null;
  isActive: boolean;
  source: string;
}

export interface HwidEntry {
  hwid: string;
  registeredAt: string;
  deviceName: string | null;
}

// Find a license by key. Returns null if not found.
export async function findLicenseByKey(key: string): Promise<SupabaseLicense | null>;

// Get all HWIDs registered for a key.
export async function getHwidsForKey(key: string): Promise<HwidEntry[]>;

// Register a new HWID for a key. Returns true on success, false if limit reached.
export async function registerHwid(key: string, hwid: string, deviceName?: string): Promise<{ ok: boolean; reason?: string }>;

// Reset all HWIDs for a key (for PC change).
export async function resetHwidsForKey(key: string): Promise<void>;

// Insert a new license (called from LS webhook).
export async function insertLicense(input: {
  licenseKey: string;
  tier: 'lite' | 'pro' | 'max';
  buyerEmail: string;
  expiresAt: string | null;
  source: 'lemon_squeezy' | 'manual';
}): Promise<void>;

// Update license expiry (called from LS webhook on subscription update).
export async function updateLicenseExpiry(key: string, expiresAt: string): Promise<void>;

// Set license active/inactive (called from LS webhook on cancellation).
export async function setLicenseActive(key: string, isActive: boolean): Promise<void>;

// Helpers (mirror _lib.ts API)
export function isExpired(license: SupabaseLicense): boolean;
export function calcRemainingDays(expiresAt: string | null): number;
```

### HWID Limit Logic

Per-tier maximum registered devices:
```typescript
const HWID_LIMITS = {
  lite: 1,
  pro: 2,
  max: 3,
};
```

`registerHwid()` behavior:
1. Check if hwid already registered for this key → return `{ ok: true }` (idempotent)
2. Count existing hwids for this key
3. If count >= HWID_LIMITS[tier] → return `{ ok: false, reason: 'HWID_LIMIT_REACHED' }`
4. Otherwise INSERT and return `{ ok: true }`

### Supabase Client Setup

Use existing project pattern. If a Supabase server-side client helper already exists in `src/lib/`, use that. Otherwise create the client inline using:
- `process.env.NEXT_PUBLIC_SUPABASE_URL`
- `process.env.SUPABASE_SERVICE_ROLE_KEY` (server-side only — never expose)

Use `@supabase/supabase-js` (already installed based on env analysis).

### Error Handling

Every function must:
- Use try/catch
- Log errors with `console.error('[supabase-license]', ...)`
- Throw with descriptive message on unrecoverable error
- Return null/false on expected failures (not found, etc.)

---

## Task 2: Modify `validate/route.ts`

**Current behavior**: Read body `{ key, hwid }`, call `_lib.ts` (sheets), return validation result.

**New behavior**: Read body `{ key, hwid, product? }`, branch by product.

### Required changes

```typescript
// Top of POST handler
const body = await req.json();
const { key, hwid, product } = body;

// NEW: branch by product
if (product === 'geniestock') {
  return await validateGenieStock(key, hwid);
}

// EXISTING: GeniePost / default path — DO NOT MODIFY
// (existing _lib.ts logic stays exactly as-is)
```

### `validateGenieStock(key, hwid)` function

```typescript
async function validateGenieStock(key: string, hwid: string) {
  // 1. Find license
  const license = await findLicenseByKey(key);
  if (!license) {
    return Response.json({ valid: false, errorCode: 'NOT_FOUND', error: '존재하지 않는 키입니다.' }, { status: 404 });
  }

  // 2. Check active
  if (!license.isActive) {
    return Response.json({ valid: false, errorCode: 'STOPPED', error: '중지된 키입니다.' }, { status: 403 });
  }

  // 3. Check expiry
  if (isExpired(license)) {
    return Response.json({ valid: false, errorCode: 'EXPIRED', error: '만료된 키입니다.' }, { status: 403 });
  }

  // 4. Check HWID
  const hwids = await getHwidsForKey(key);
  const alreadyRegistered = hwids.some(h => h.hwid === hwid);

  if (!alreadyRegistered) {
    // First time on this device — try to register
    const result = await registerHwid(key, hwid);
    if (!result.ok) {
      return Response.json({
        valid: false,
        errorCode: 'HWID_MISMATCH',
        error: '다른 PC에서 이미 인증된 키입니다. PC 변경이 필요하면 사용 PC 변경을 진행해주세요.'
      }, { status: 403 });
    }
  }

  // 5. Success
  return Response.json({
    valid: true,
    tier: license.tier,
    expiresAt: license.expiresAt,
    remainingDays: calcRemainingDays(license.expiresAt),
  });
}
```

### Response format

Must match existing GeniePost validate response shape exactly so GenieStock app code (which already expects this shape) works unchanged.

---

## Task 3: Modify `reset/route.ts`

**Existing behavior**: Reset HWID for GeniePost key in sheet.

**New behavior**: Branch by product.

```typescript
const { key, product } = await req.json();

if (product === 'geniestock') {
  return await resetGenieStock(key);
}

// EXISTING: GeniePost path — DO NOT MODIFY
```

### `resetGenieStock(key)` function

```typescript
async function resetGenieStock(key: string) {
  const license = await findLicenseByKey(key);
  if (!license) {
    return Response.json({ ok: false, error: '존재하지 않는 키입니다.' }, { status: 404 });
  }

  if (!license.isActive) {
    return Response.json({ ok: false, error: '중지된 키는 재설정할 수 없습니다.' }, { status: 403 });
  }

  await resetHwidsForKey(key);
  return Response.json({ ok: true });
}
```

---

## Task 4: Modify `upgrade/route.ts`

**Existing behavior**: Validate new key for GeniePost upgrade in sheet.

**New behavior**: Branch by product.

```typescript
const { key, hwid, product } = await req.json();

if (product === 'geniestock') {
  return await upgradeGenieStock(key, hwid);
}

// EXISTING: GeniePost path — DO NOT MODIFY
```

### `upgradeGenieStock(key, hwid)` function

Same logic as `validateGenieStock` — find license, check active, check expiry, register hwid if not yet bound. Return same response shape.

---

## Task 5: Modify Lemon Squeezy Webhook

**File**: `src/app/api/webhooks/lemonsqueezy/route.ts`

**Goal**: When LS sends `order_created` for a GenieStock product, INSERT into Supabase `license_keys` table (in addition to existing GeniePost sheet logic).

### Identifying GenieStock Orders

LS sends product information in the webhook payload. Identify GenieStock orders by:
- Product variant name containing "GenieStock" (case-insensitive)
- OR product variant ID matching a known GenieStock variant
- OR custom data field set on the LS product (if available)

**Investigation step**: Before writing the branching code, check the existing webhook handler to see how it extracts product/variant info. Use whatever pattern is already there.

### Branching logic in `order_created` handler

```typescript
// Inside order_created handler
const productName = /* extract from payload */;
const isGenieStock = productName.toLowerCase().includes('geniestock');

if (isGenieStock) {
  // NEW: insert into Supabase
  await insertLicense({
    licenseKey: generatedKey,
    tier: extractedTier, // 'lite' | 'pro' | 'max'
    buyerEmail: customerEmail,
    expiresAt: calculatedExpiry, // or null for permanent
    source: 'lemon_squeezy',
  });
  // Skip existing sheet append for GenieStock
  return /* success */;
}

// EXISTING: GeniePost path — call existing sheet append, DO NOT MODIFY
```

### Subscription Updates

For `subscription_updated` and `subscription_cancelled`:
- If the subscription belongs to a GenieStock order → call `updateLicenseExpiry` or `setLicenseActive` on Supabase
- If GeniePost → existing sheet logic unchanged

To determine which: check if the license_key exists in Supabase first. If yes → GenieStock path. If no → GeniePost (sheet) path.

This avoids needing to track product type per subscription separately.

---

## Verification Checklist

After all changes:

1. `npm run build` — passes 0 errors
2. GeniePost license validation still works (test with existing GeniePost key — should hit sheet path)
3. GenieStock validation hits Supabase (verify by checking Supabase logs)
4. New HWID registration respects per-tier limits (lite=1, pro=2, max=3)
5. HWID reset clears all entries for a key
6. Lemon Squeezy GenieStock order → row appears in Supabase `license_keys`
7. Lemon Squeezy GeniePost order → row appears in sheet (existing behavior)
8. Subscription cancel for GenieStock key → `is_active=false` in Supabase
9. No GeniePost code path was modified

---

## Manual Testing Steps (after deploy)

1. Use the existing test license key in Supabase (`SN-MBE8-JRQR-BVEL`) to verify validate flow:
   ```bash
   curl -X POST https://www.corezent.com/api/license/validate \
     -H "Content-Type: application/json" \
     -d '{"key":"SN-MBE8-JRQR-BVEL","hwid":"test-hwid-1","product":"geniestock"}'
   ```
   Expected: `{ valid: true, tier: 'max', ... }`

2. Repeat with same hwid → still success (idempotent)

3. Try with different hwid (`test-hwid-2`) → success (max allows 3)

4. Try with `test-hwid-3` → success

5. Try with `test-hwid-4` → fail with `HWID_LIMIT_REACHED`

6. Reset:
   ```bash
   curl -X POST https://www.corezent.com/api/license/reset \
     -H "Content-Type: application/json" \
     -d '{"key":"SN-MBE8-JRQR-BVEL","product":"geniestock"}'
   ```
   Then retry validate with new hwid → should succeed.

7. Test GeniePost key still works (no `product` field or `product='geniepost'`):
   ```bash
   curl -X POST https://www.corezent.com/api/license/validate \
     -H "Content-Type: application/json" \
     -d '{"key":"<existing-geniepost-key>","hwid":"<hwid>"}'
   ```
   Expected: existing sheet-based behavior unchanged.

---

## Completion Report Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Corezent Supabase Migration 완료 보고
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. _lib_supabase.ts 생성       : 완료 (N개 함수)
2. validate/route.ts            : product 분기 추가 완료
3. reset/route.ts               : product 분기 추가 완료
4. upgrade/route.ts             : product 분기 추가 완료
5. lemonsqueezy webhook         : GenieStock 분기 추가 완료
GeniePost 기존 로직 보존        : 확인됨 (변경 없음)
빌드 검증                       : npm run build 0 errors ✓
배포                            : git push 완료 / Vercel 배포 [URL]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
