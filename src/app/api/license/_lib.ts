/**
 * GenieStock 라이선스 API 공용 헬퍼
 *
 * Google Sheets 컬럼 구조:
 *   A: email          (이메일)
 *   B: Serial No      (라이선스 키)
 *   C: HWID           (빈칸 = 미활성화)
 *   D: expiration date (YYYY-MM-DD, 빈칸 = 영구)
 *   E: remaining days  (수식, 자동 계산 — 쓰기 안 함)
 *   F: status          (ready | active | stopped | expired)
 *   G: version / tier  (lite | pro | max)
 *
 * 환경변수:
 *   GOOGLE_SHEET_ID                — GenieStock 라이선스 전용 시트 ID
 *   GOOGLE_SHEET_TAB               — 탭 이름 (없으면 첫 번째 시트)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   — 서비스 계정 이메일
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — 서비스 계정 개인 키
 */

import { google } from 'googleapis'

export type Tier = 'lite' | 'pro' | 'max'

export interface LicenseRow {
  rowNum:    number
  email:     string
  key:       string
  hwid:      string   // 빈칸이면 미바인딩 상태
  expiresAt: string   // YYYY-MM-DD, 빈칸이면 영구 라이선스
  status:    string
  tier:      Tier
}

// ─── Sheets 클라이언트 ────────────────────────────────────────────────────────

function buildClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '',
    key:   (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return {
    api: google.sheets({ version: 'v4', auth }),
    id:  process.env.GOOGLE_SHEET_ID ?? '',
    tab: process.env.GOOGLE_SHEET_TAB ?? '',
  }
}

function range(tab: string, cols: string) {
  return tab ? `${tab}!${cols}` : cols
}

// ─── 라이선스 키로 행 검색 ────────────────────────────────────────────────────

export async function findByKey(key: string): Promise<LicenseRow | null> {
  const { api, id, tab } = buildClient()
  if (!id) throw new Error('GOOGLE_SHEET_ID 환경변수가 설정되지 않았어요.')

  const res = await api.spreadsheets.values.get({
    spreadsheetId: id,
    range: range(tab, 'A:G'),
  })

  const rows = res.data.values ?? []
  const idx  = rows.findIndex((row) => row[1]?.toString().trim() === key.trim())
  if (idx === -1) return null

  const row = rows[idx]
  const rawTier = (row[6] ?? '').toLowerCase().trim()
  const tier: Tier = rawTier === 'max' ? 'max' : rawTier === 'pro' ? 'pro' : 'lite'

  return {
    rowNum:    idx + 1,
    email:     row[0] ?? '',
    key:       row[1] ?? '',
    hwid:      (row[2] ?? '').trim(),
    expiresAt: (row[3] ?? '').trim(),
    // row[4] = E열 remaining days (수식) — 읽기 전용
    status:    (row[5] ?? '').toLowerCase().trim(),  // F열
    tier,                                             // G열
  }
}

// ─── 셀 단일 업데이트 ─────────────────────────────────────────────────────────

export async function patchCell(rowNum: number, col: string, value: string): Promise<void> {
  const { api, id, tab } = buildClient()
  await api.spreadsheets.values.update({
    spreadsheetId: id,
    range: range(tab, `${col}${rowNum}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

// ─── 상태 판별 헬퍼 ───────────────────────────────────────────────────────────

export function isStopped(status: string): boolean {
  return ['stopped', '중지', 'revoked', '취소', 'disabled'].includes(status)
}

export function isExpired(status: string, expiresAt: string): boolean {
  if (['expired', '만료'].includes(status)) return true
  if (!expiresAt) return false
  const today = new Date().toISOString().split('T')[0]
  return expiresAt < today
}

export function calcRemainingDays(expiresAt: string): number {
  if (!expiresAt) return 9999
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / 86_400_000))
}
