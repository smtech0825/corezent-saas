/**
 * @파일: lib/tax/law-api.ts
 * @설명: 법제처 국가법령정보 OPEN API 호출 계층.
 *        인증키(OC)는 환경변수에서만 읽는다 — 코드·저장소에 넣지 않는다.
 *
 *        쓰는 API 두 가지(신구법 대조 oldAndNew는 화면 링크로만 쓰므로 여기서 호출하지 않는다):
 *          - lsHstInf  (lawSearch.do)  : regDt(YYYYMMDD)로 그날 바뀐 법령 목록
 *          - lsJoHstInf(lawService.do) : 법령ID + 6자리 조번호로 조문 변경 이력
 *
 *        ⚠️ 응답 JSON의 바깥 감싸개 이름(LawSearch 등)은 API마다 다르고 공개 문서에
 *        명시돼 있지 않다. 또 결과가 1건이면 배열이 아니라 객체 하나로 오는 경우가 있다.
 *        그래서 감싸개 이름을 가정하지 않고, 응답 전체를 훑어 '필요한 한글 필드를 가진
 *        객체'만 모으는 방식으로 파싱한다 — 감싸개가 달라져도 깨지지 않는다.
 */

/** 법제처 OPEN API 기본 주소 */
const SEARCH_URL = 'https://www.law.go.kr/DRF/lawSearch.do'
const SERVICE_URL = 'https://www.law.go.kr/DRF/lawService.do'

/** 한 번 호출의 제한 시간(ms) — 외부 API가 멎어도 배치 전체가 묶이지 않게 한다 */
const FETCH_TIMEOUT_MS = 15_000

/** 목록 조회 1페이지 최대 건수 (문서상 최대 100) */
const PAGE_SIZE = 100

/** 목록 조회 최대 페이지 — 무한 페이징 방어 */
const MAX_PAGES = 10

/** JSON 값 — 응답을 훑을 때 쓰는 최소 타입 */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** 법제처 API 호출 실패 — 원문 응답을 그대로 담아 보고에 쓴다 */
export class LawApiError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status: number | null,
    readonly body: string,
  ) {
    super(message)
    this.name = 'LawApiError'
  }
}

/**
 * @함수명: getLawApiOc
 * @설명: 법제처 인증키(OC)를 환경변수에서 읽습니다. 없으면 즉시 실패시킵니다.
 * @반환값: 인증키 문자열
 */
export function getLawApiOc(): string {
  const oc = process.env.LAW_API_OC
  if (!oc || oc.trim() === '') {
    throw new Error('LAW_API_OC 환경변수가 없습니다. 법제처 OPEN API 인증키를 설정해야 감시가 동작합니다.')
  }
  return oc.trim()
}

/**
 * @함수명: fetchJson
 * @설명: 법제처 API를 호출해 JSON으로 파싱합니다. 실패하면 응답 원문을 담은 오류를 던집니다.
 * @매개변수: url - 호출 주소(질의문자열 포함)
 * @반환값: 파싱된 JSON
 */
async function fetchJson(url: string): Promise<Json> {
  let res: Response
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new LawApiError(`법제처 API 호출에 실패했습니다: ${reason}`, url, null, '')
  }

  const text = await res.text()
  if (!res.ok) {
    throw new LawApiError('법제처 API가 오류를 반환했습니다.', url, res.status, text.slice(0, 2000))
  }
  try {
    return JSON.parse(text) as Json
  } catch {
    // 인증키가 잘못되면 JSON 대신 HTML 안내 화면이 오는 경우가 있다 — 원문을 그대로 보고한다
    throw new LawApiError(
      'JSON이 아닌 응답을 받았습니다(인증키·요청 형식 문제일 수 있습니다).',
      url,
      res.status,
      text.slice(0, 2000),
    )
  }
}

/**
 * @함수명: collectRecords
 * @설명: 응답 JSON 전체를 훑어 지정한 필드를 모두 가진 객체만 모읍니다.
 *        바깥 감싸개 이름과 배열/단일 객체 차이를 신경 쓰지 않아도 됩니다.
 * @매개변수: value - 훑을 JSON / required - 반드시 있어야 하는 키 목록
 * @반환값: 조건을 만족하는 객체 배열
 */
function collectRecords(value: Json, required: string[]): Record<string, Json>[] {
  const found: Record<string, Json>[] = []
  const walk = (node: Json) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node === null || typeof node !== 'object') return
    const obj = node as Record<string, Json>
    if (required.every((k) => obj[k] !== undefined && obj[k] !== null)) {
      found.push(obj)
      return // 레코드 안쪽은 더 파고들지 않는다
    }
    Object.values(obj).forEach(walk)
  }
  walk(value)
  return found
}

/** 응답 필드를 문자열로 정규화 (숫자로 오는 경우가 있다) */
function str(v: Json | undefined): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

/** YYYYMMDD 또는 YYYY-MM-DD를 YYYY-MM-DD로. 형식이 아니면 null */
export function toIsoDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

/** lsHstInf 한 건 — 그날 바뀐 법령 하나 */
export interface LawChangeRow {
  lawId: string          // 법령ID
  lawName: string        // 법령명한글
  promulgationDate: string // 공포일자 (YYYYMMDD 원문)
  promulgationNo: string   // 공포번호
  changeType: string       // 제개정구분명
  effectiveDate: string | null // 시행일자 (YYYY-MM-DD) — 형식이 아니면 null
}

/**
 * @함수명: fetchLawChangesOn
 * @설명: 그날(regDt) 바뀐 법령 목록을 페이지를 넘겨가며 모두 받습니다.
 * @매개변수: oc - 인증키 / date - 조회 날짜(YYYY-MM-DD)
 * @반환값: 법령 변경 목록
 */
export async function fetchLawChangesOn(oc: string, date: string): Promise<LawChangeRow[]> {
  const regDt = date.replace(/-/g, '')
  const rows: LawChangeRow[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${SEARCH_URL}?OC=${encodeURIComponent(oc)}&target=lsHstInf&type=JSON` +
      `&regDt=${regDt}&display=${PAGE_SIZE}&page=${page}`
    const json = await fetchJson(url)
    const records = collectRecords(json, ['법령ID', '법령명한글'])
    if (records.length === 0) break

    for (const r of records) {
      rows.push({
        lawId: str(r['법령ID']),
        lawName: str(r['법령명한글']),
        promulgationDate: str(r['공포일자']),
        promulgationNo: str(r['공포번호']),
        changeType: str(r['제개정구분명']),
        effectiveDate: toIsoDate(str(r['시행일자'])),
      })
    }
    if (records.length < PAGE_SIZE) break
  }
  return rows
}

/** lsJoHstInf 한 건 — 조문 변경 이력 하나 */
export interface ArticleHistoryRow {
  promulgationDate: string      // 공포일자 (YYYYMMDD 원문)
  promulgationNo: string        // 공포번호
  changeType: string            // 제개정구분명
  effectiveDate: string | null  // 시행일자 (YYYY-MM-DD)
  changeReason: string          // 변경사유
  articleChangedDate: string    // 조문변경일 (원문)
}

/**
 * @함수명: fetchArticleHistory
 * @설명: 법령ID와 6자리 조번호로 그 조문의 변경 이력을 받습니다.
 * @매개변수: oc - 인증키 / lawId - 법령ID / articleNo - 6자리 조번호
 * @반환값: 조문 변경 이력 목록
 */
export async function fetchArticleHistory(
  oc: string,
  lawId: string,
  articleNo: string,
): Promise<ArticleHistoryRow[]> {
  const url =
    `${SERVICE_URL}?OC=${encodeURIComponent(oc)}&target=lsJoHstInf&type=JSON` +
    `&ID=${encodeURIComponent(lawId)}&JO=${encodeURIComponent(articleNo)}&display=${PAGE_SIZE}`
  const json = await fetchJson(url)

  // 이 응답은 한 건이 조문정보/법령정보 두 덩어리로 나뉘어 있다(실측 확인):
  //   { LawService: { law: [ { 조문정보: {조문번호·변경사유·조문변경일},
  //                            법령정보: {공포일자·공포번호·제개정구분명·시행일자} } ] } }
  // 그래서 '법령정보' 덩어리만 뽑으면 변경사유·조문변경일을 잃는다 — 한 건 단위로
  // 두 덩어리를 합쳐서 읽는다.
  const entries = collectRecords(json, ['조문정보', '법령정보'])
  return entries.map((e) => {
    const jo = (e['조문정보'] ?? {}) as Record<string, Json>
    const ls = (e['법령정보'] ?? {}) as Record<string, Json>
    return {
      promulgationDate: str(ls['공포일자']),
      promulgationNo: str(ls['공포번호']),
      changeType: str(ls['제개정구분명']),
      effectiveDate: toIsoDate(str(ls['시행일자'])),
      changeReason: str(jo['변경사유']),
      articleChangedDate: str(jo['조문변경일']),
    }
  })
}

/**
 * @함수명: fetchLawName
 * @설명: 법령ID로 법령명을 읽습니다. 그 ID가 법제처에 실제로 있는지 확인하는 용도입니다.
 *        없는 ID를 넣으면 법제처는 오류가 아니라 안내 문자열을 돌려주므로,
 *        객체가 아닌 응답은 '없는 ID'로 판정합니다.
 * @매개변수: oc - 인증키 / lawId - 법령ID
 * @반환값: 법령명. 그 ID가 없으면 null
 */
export async function fetchLawName(oc: string, lawId: string): Promise<string | null> {
  const url =
    `${SERVICE_URL}?OC=${encodeURIComponent(oc)}&target=law&type=JSON&ID=${encodeURIComponent(lawId)}`
  const json = await fetchJson(url)
  // 없는 ID면 { "Law": "일치하는 법령이 없습니다. ..." } 처럼 문자열이 온다
  if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
    const law = (json as Record<string, Json>)['Law']
    if (typeof law === 'string') return null
  }
  const name = findFirst(json, ['법령명_한글', '법령명한글'])
  return name === '' ? null : name
}

/**
 * @함수명: findFirst
 * @설명: 응답을 훑어 후보 키 중 처음 발견한 값을 문자열로 돌려줍니다.
 * @매개변수: value - 훑을 JSON / keys - 찾을 키 후보
 * @반환값: 찾은 값(없으면 빈 문자열)
 */
function findFirst(value: Json, keys: string[]): string {
  let result = ''
  const walk = (node: Json) => {
    if (result !== '') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node === null || typeof node !== 'object') return
    const obj = node as Record<string, Json>
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        result = str(obj[k])
        return
      }
    }
    Object.values(obj).forEach(walk)
  }
  walk(value)
  return result
}

/**
 * @함수명: buildOldAndNewUrl
 * @설명: 신구법 대조(oldAndNew) 화면 주소를 만듭니다. 관리자 화면 링크 전용이며
 *        인증키가 들어가므로 서버에서만 만들어 내려보냅니다.
 * @매개변수: oc - 인증키 / lawId - 법령ID
 * @반환값: 신구법 대조 주소
 */
export function buildOldAndNewUrl(oc: string, lawId: string): string {
  return `${SERVICE_URL}?OC=${encodeURIComponent(oc)}&target=oldAndNew&type=HTML&ID=${encodeURIComponent(lawId)}`
}
