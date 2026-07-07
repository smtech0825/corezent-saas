/**
 * @파일: lib/seo/indexing.ts
 * @설명: 검색엔진 색인 제출 헬퍼 — 신규/변경 URL을 검색엔진에 즉시 알린다.
 *        ① IndexNow  : Bing·Naver·Yandex·Seznam 등(구글 미지원). public에 배포된 키 파일로 소유 증명.
 *        ② Google Indexing API : 서비스 계정 JWT로 urlNotifications:publish 호출.
 *        두 채널은 서로 독립적으로 처리·반환한다(한쪽 실패가 다른 쪽을 막지 않음, 부분 성공 허용).
 *
 *        ⚠️ 서버 전용 모듈(서비스 계정 개인키 사용). client 컴포넌트에서 import 금지.
 */

import { google } from 'googleapis'
import { SITE_URL } from '@/lib/site'

/** IndexNow 키 — env 우선, 없으면 public에 배포된 공개 키로 폴백(키 값 자체는 공개 정보) */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? '5ae2e03853bc47f8a8569d00d31788d4'

/** 검색엔진별 제출 결과 */
export type SubmitResult = {
  engine: 'indexnow' | 'google'
  ok: boolean
  submitted: number
  detail: string
}

// ─── ① IndexNow (Bing·Naver·Yandex·Seznam) ───────────────────────────────────

/**
 * @함수명: submitToIndexNow
 * @설명: URL 목록을 IndexNow 엔드포인트에 일괄 제출한다(단일 요청). 구글은 미지원.
 * @매개변수: urls - 절대 URL 배열
 * @반환값: 제출 결과(SubmitResult)
 */
export async function submitToIndexNow(urls: string[]): Promise<SubmitResult> {
  if (urls.length === 0) return { engine: 'indexnow', ok: true, submitted: 0, detail: '대상 URL 없음' }

  try {
    const host = new URL(SITE_URL).host
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    })

    // IndexNow는 200(OK)·202(Accepted)를 성공으로 간주한다
    const ok = res.status === 200 || res.status === 202
    return { engine: 'indexnow', ok, submitted: ok ? urls.length : 0, detail: `HTTP ${res.status}` }
  } catch (e) {
    return { engine: 'indexnow', ok: false, submitted: 0, detail: e instanceof Error ? e.message : String(e) }
  }
}

// ─── ② Google Indexing API ───────────────────────────────────────────────────

/**
 * @함수명: getIndexingCredentials
 * @설명: Google Indexing API용 서비스 계정 자격증명을 env에서 해석한다.
 *        우선순위: ① GOOGLE_INDEXING_CREDENTIALS(JSON 통째로)
 *                 ② GOOGLE_INDEXING_CLIENT_EMAIL / GOOGLE_INDEXING_PRIVATE_KEY(개별)
 *                 ③ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY(시트용 재사용)
 * @반환값: { email, key } 또는 자격증명이 없으면 null
 */
function getIndexingCredentials(): { email: string; key: string } | null {
  // ① 서비스 계정 키 파일(JSON)을 통째로 붙여넣은 경우
  const jsonRaw = process.env.GOOGLE_INDEXING_CREDENTIALS
  if (jsonRaw) {
    try {
      const j = JSON.parse(jsonRaw)
      if (j.client_email && j.private_key) {
        return { email: j.client_email, key: String(j.private_key).replace(/\\n/g, '\n') }
      }
    } catch {
      /* JSON 파싱 실패 → 개별 키 폴백 */
    }
  }

  // ② 색인 전용 개별 키, 없으면 ③ 기존 시트용 서비스 계정 재사용
  const email = process.env.GOOGLE_INDEXING_CLIENT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_INDEXING_PRIVATE_KEY ?? process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (email && key) return { email, key: key.replace(/\\n/g, '\n') }

  return null
}

/**
 * @함수명: submitToGoogleIndexing
 * @설명: URL 목록을 Google Indexing API에 URL_UPDATED로 제출한다(URL당 1건).
 *        서비스 계정이 Search Console 자산에 '소유자'로 등록돼 있어야 승인된다.
 *        일일 할당량(기본 200건) 및 Google 정책(공식 지원: 채용/라이브 구조화 데이터)을 유의.
 * @매개변수: urls - 절대 URL 배열
 * @반환값: 제출 결과(SubmitResult)
 */
export async function submitToGoogleIndexing(urls: string[]): Promise<SubmitResult> {
  if (urls.length === 0) return { engine: 'google', ok: true, submitted: 0, detail: '대상 URL 없음' }

  const creds = getIndexingCredentials()
  if (!creds) {
    return { engine: 'google', ok: false, submitted: 0, detail: '자격증명 env 미설정(GOOGLE_INDEXING_CREDENTIALS 등)' }
  }

  try {
    const auth = new google.auth.JWT({
      email: creds.email,
      key: creds.key,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    })
    const indexing = google.indexing({ version: 'v3', auth })

    let success = 0
    const errors: string[] = []
    for (const url of urls) {
      try {
        await indexing.urlNotifications.publish({ requestBody: { url, type: 'URL_UPDATED' } })
        success++
      } catch (e) {
        errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return {
      engine: 'google',
      ok: success > 0,
      submitted: success,
      detail: errors.length ? `성공 ${success}건 / 실패 ${errors.length}건 (${errors[0]})` : `성공 ${success}건`,
    }
  } catch (e) {
    return { engine: 'google', ok: false, submitted: 0, detail: e instanceof Error ? e.message : String(e) }
  }
}

// ─── 통합 제출 ────────────────────────────────────────────────────────────────

/**
 * @함수명: submitUrlsToSearchEngines
 * @설명: 주어진 URL 목록을 IndexNow와 Google Indexing 두 채널에 동시에 제출한다.
 * @매개변수: urls - 절대 URL 배열
 * @반환값: 채널별 제출 결과 배열
 */
export async function submitUrlsToSearchEngines(urls: string[]): Promise<SubmitResult[]> {
  return Promise.all([submitToIndexNow(urls), submitToGoogleIndexing(urls)])
}
