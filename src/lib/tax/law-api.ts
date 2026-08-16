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

/**
 * 한 번 호출의 제한 시간(ms) — 외부 API가 멎어도 배치 전체가 묶이지 않게 한다.
 * 함수 시간 상한이 60초라 이 값이 크면 상한 검사를 통과한 직후의 호출 하나만으로
 * 강제 종료될 수 있다. 그러면 실패 기록조차 남지 않는다.
 */
const FETCH_TIMEOUT_MS = 10_000

/** 목록 조회 1페이지 최대 건수 (문서상 최대 100) */
const PAGE_SIZE = 100

/** 목록 조회 최대 페이지 — 무한 페이징 방어 */
const MAX_PAGES = 10

import { LawApiError } from './law-api-error'
import {
  collectRecords,
  digitsOnly,
  findFirst,
  maskOc,
  normalizeLawId,
  requireTotalCnt,
  str,
  toIsoDate,
  type Json,
} from './law-api-parse'

export { LawApiError } from './law-api-error'
export { digitsOnly, normalizeLawId, toIsoDate } from './law-api-parse'

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
  // 응답 원문에 인증키가 되비쳐 실려 오는 경우가 있어 보고 전에 가린다
  const safeBody = maskOc(text.slice(0, 2000), url)
  if (!res.ok) {
    throw new LawApiError('법제처 API가 오류를 반환했습니다.', url, res.status, safeBody)
  }
  try {
    return JSON.parse(text) as Json
  } catch {
    // 인증키가 잘못되면 JSON 대신 HTML 안내 화면이 오는 경우가 있다 — 원문을 그대로 보고한다
    throw new LawApiError(
      'JSON이 아닌 응답을 받았습니다(인증키·요청 형식 문제일 수 있습니다).',
      url,
      res.status,
      safeBody,
    )
  }
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
export async function fetchLawChangesOn(
  oc: string,
  date: string,
  shouldStop: () => boolean = () => false,
): Promise<LawChangeRow[]> {
  const regDt = date.replace(/-/g, '')
  const rows: LawChangeRow[] = []
  // 첫 페이지의 총 건수만 쓴다. 범위 밖 페이지는 totalCnt를 0으로 돌려주므로
  // 매 페이지 덮어쓰면 '다 받았는지' 판정이 무너진다(실측 확인).
  let total: number | null = null

  for (let page = 1; page <= MAX_PAGES; page++) {
    // 목록 조회만으로도 시간을 다 쓸 수 있어 페이지마다 상한을 본다.
    // 여기서 던져야 그날이 처리 완료로 올라가지 않고 다음 실행이 다시 시도한다.
    if (shouldStop()) {
      throw new LawApiError(
        `시간 상한에 걸려 ${date}의 변경 법령 목록을 다 받지 못했습니다. 다음 실행에서 다시 시도합니다.`,
        `${SEARCH_URL}?target=lsHstInf&regDt=${regDt}`,
        null,
        '',
      )
    }

    const url =
      `${SEARCH_URL}?OC=${encodeURIComponent(oc)}&target=lsHstInf&type=JSON` +
      `&regDt=${regDt}&display=${PAGE_SIZE}&page=${page}`
    const json = await fetchJson(url)
    // ★ 0건이 '진짜 없음'인지 '조회 실패'인지 여기서 가른다 — 없으면 오류를 던져
    //    그날이 처리 완료로 올라가지 않게 한다
    const cnt = requireTotalCnt(json, url, maskOc(JSON.stringify(json).slice(0, 2000), url))
    if (total === null) total = cnt
    const records = collectRecords(json, ['법령ID', '법령명한글'])
    if (records.length === 0) break

    for (const r of records) {
      rows.push({
        lawId: normalizeLawId(str(r['법령ID'])),
        lawName: str(r['법령명한글']),
        promulgationDate: str(r['공포일자']),
        promulgationNo: str(r['공포번호']),
        changeType: str(r['제개정구분명']),
        effectiveDate: toIsoDate(str(r['시행일자'])),
      })
    }
    // 총 건수를 다 받았으면 더 부르지 않는다(정확히 100의 배수일 때 헛호출 방지)
    if (records.length < PAGE_SIZE || rows.length >= (total ?? 0)) break
  }

  // 받은 건수가 총 건수에 못 미치면 조용히 잘린 것이다 — 그날을 성공으로 넘기지 않는다
  if (total !== null && rows.length < total) {
    throw new LawApiError(
      `그날 변경 법령 ${total}건 중 ${rows.length}건만 받았습니다(페이지 상한 ${MAX_PAGES}). 잘린 채로 넘기지 않고 다시 시도합니다.`,
      `${SEARCH_URL}?target=lsHstInf&regDt=${regDt}`,
      200,
      '',
    )
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
 *
 *        ⚠️ 페이징을 하지 않습니다(한 번에 최대 PAGE_SIZE=100건).
 *        **언제 문제가 되는가**: 한 조문의 누적 개정 이력이 100건을 넘는 순간입니다.
 *        그때 최신 개정이 응답에서 잘리면, 방금 바뀐 조문인데도 대조에 실패해
 *        '이 조문은 안 바뀜'으로 조용히 넘어갑니다 — 오류가 아니라 무음 탈락입니다.
 *
 *        실측(2026-08-16): 감시 대상 중 이력이 가장 많은 소득세법 제95조가 49건.
 *        연 1~2회 개정을 가정하면 여유가 수십 년이지만, 개정이 잦은 조문이 감시
 *        대상에 들어오거나 세월이 쌓이면 도달합니다.
 *        **넘길 때 할 일**: totalCnt를 읽어 100을 넘으면 페이징하거나, 최소한
 *        절단 사실을 오류로 던져 그날을 재시도시켜야 합니다(fetchLawChangesOn과 동일 방식).
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
  // 여기서도 totalCnt 유무로 '진짜 0건'과 '조회 실패'를 가른다
  requireTotalCnt(json, url, maskOc(JSON.stringify(json).slice(0, 2000), url))

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

