/**
 * @파일: lib/sheets.ts
 * @설명: Google Sheets API 헬퍼 — 라이선스 행 추가 및 상태/만료일 업데이트
 *        A(ID/이메일), B(Serial No), C(HWID), D(만료일), E(상태), F(남은일), G(Pro)
 */

import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? ''
const TAB_NAME       = process.env.GOOGLE_SHEETS_TAB_NAME ?? ''

// ─── 인증 클라이언트 생성 ─────────────────────────────────────────────────────

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '',
    key:   (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ─── 시리얼 키로 행 번호 검색 ─────────────────────────────────────────────────

/**
 * @함수명: findRowBySerial
 * @설명: B열(Serial No)에서 일치하는 행 번호(1-based)를 반환합니다.
 */
async function findRowBySerial(
  sheets: ReturnType<typeof google.sheets>,
  serialKey: string,
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!B:B`,
  })
  const rows = res.data.values ?? []
  const idx  = rows.findIndex((row) => row[0]?.trim() === serialKey)
  return idx === -1 ? null : idx + 1
}

// ─── 라이선스 행 추가 ─────────────────────────────────────────────────────────

/**
 * @함수명: appendLicenseRow
 * @설명: 구매 완료 후 라이선스 관리 시트에 새 행을 추가합니다.
 *        A(ID=이메일), B(Serial No), C(HWID=빈칸), D(만료일), E(상태), F(남은일 수식), G(Pro)
 */
export async function appendLicenseRow(params: {
  email:     string
  serialKey: string
  expiresAt: string | null
  isPro?:    boolean
  status?:   '대기' | '활성'
}): Promise<void> {
  if (!SPREADSHEET_ID || !TAB_NAME) {
    console.warn('[Sheets] 환경변수 미설정 — 시트 기입 건너뜀')
    return
  }

  const sheets = getSheetsClient()

  // 다음 빈 행 번호 파악
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A:A`,
  })
  const nextRow = (res.data.values?.length ?? 1) + 1

  const expirationDate = params.expiresAt
    ? new Date(params.expiresAt).toISOString().split('T')[0]
    : ''

  const initialStatus = params.status ?? '활성'

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!A${nextRow}:G${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        params.email,                                             // A: ID (이메일)
        params.serialKey,                                         // B: Serial No
        '',                                                       // C: HWID (프로그램이 최초 인증 시 자동 입력)
        expirationDate,                                           // D: 만료일 (YYYY-MM-DD)
        initialStatus,                                            // E: 상태 (LS 구매 시 '활성')
        expirationDate ? `=D${nextRow}-TODAY()` : '',             // F: 남은 일수 수식
        params.isPro ? 'TRUE' : '',                               // G: Pro 플래그
      ]],
    },
  })
}

// ─── 만료일 업데이트 (구독 갱신 시) ──────────────────────────────────────────

/**
 * @함수명: updateLicenseExpiry
 * @설명: 구독 갱신 시 시트의 D열(만료일)을 새 기간으로 업데이트합니다.
 *        F열 수식(=D{행}-TODAY())은 자동 재계산되므로 별도 업데이트 불필요.
 */
export async function updateLicenseExpiry(params: {
  serialKey: string
  expiresAt: string
}): Promise<void> {
  if (!SPREADSHEET_ID || !TAB_NAME) return

  const sheets     = getSheetsClient()
  const rowNumber  = await findRowBySerial(sheets, params.serialKey)
  if (!rowNumber) {
    console.warn(`[Sheets] serial_key 미발견 — 만료일 업데이트 건너뜀: ${params.serialKey}`)
    return
  }

  const expirationDate = new Date(params.expiresAt).toISOString().split('T')[0]

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!D${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[expirationDate]] },
  })
}

// ─── 상태 업데이트 (취소/환불/갱신 시) ────────────────────────────────────────

/**
 * @함수명: updateLicenseStatus
 * @설명: 구독 상태 변경 시 시트의 E열(상태)을 업데이트합니다.
 */
export async function updateLicenseStatus(params: {
  serialKey: string
  status:    '대기' | '활성' | '중지'
}): Promise<void> {
  if (!SPREADSHEET_ID || !TAB_NAME) return

  const sheets    = getSheetsClient()
  const rowNumber = await findRowBySerial(sheets, params.serialKey)
  if (!rowNumber) {
    console.warn(`[Sheets] serial_key 미발견 — 상태 업데이트 건너뜀: ${params.serialKey}`)
    return
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TAB_NAME}!E${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[params.status]] },
  })
}
