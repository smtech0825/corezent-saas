/**
 * @파일: lib/tax/law-api-parse.ts
 * @설명: 법제처 OPEN API 응답을 읽기 위한 도구 모음(파싱·정규화·안전장치).
 *        호출 자체는 law-api.ts가 맡는다 — 파일 300줄 기준을 지키려 나눴다.
 *
 *        ⚠️ 응답 JSON의 바깥 감싸개 이름(LawSearch/LawService)은 API마다 다르고 공개
 *        문서에 명시돼 있지 않다. 결과가 1건이면 배열이 아니라 객체 하나로 오기도 한다.
 *        그래서 감싸개를 가정하지 않고 '필요한 한글 필드를 가진 객체'만 훑어 모은다.
 */

import { LawApiError } from './law-api-error'

/** JSON 값 — 응답을 훑을 때 쓰는 최소 타입 */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** 보고용 문자열에서 인증키를 가린다 (질의문자열의 OC 값을 찾아 치환) */
export function maskOc(body: string, url: string): string {
  const oc = /[?&]OC=([^&]*)/.exec(url)?.[1]
  if (!oc || oc.length < 2) return body
  const decoded = decodeURIComponent(oc)
  return body.split(oc).join('***').split(decoded).join('***')
}

/**
 * @함수명: requireTotalCnt
 * @설명: 응답에서 totalCnt를 찾아 숫자로 돌려줍니다. 없으면 '쓸 수 없는 응답'으로
 *        간주해 오류를 던집니다.
 *
 *        ★ 이 검사가 이 기능의 안전장치입니다. 법제처는 인증 실패·점검 중에도
 *        HTTP 200 + JSON으로 안내 문구를 돌려주는 일이 있는데, 그때 레코드가
 *        0건이라는 이유로 '그날은 개정이 없었다'로 처리하면 그 날짜가 처리 완료로
 *        올라가 개정을 영영 다시 보지 못합니다. 정상 응답에는 결과가 0건이어도
 *        totalCnt가 반드시 실려 오므로, 그 유무로 둘을 가릅니다.
 * @매개변수: json - 응답 / url·status - 오류 보고용
 * @반환값: totalCnt 숫자
 */
export function requireTotalCnt(json: Json, url: string, body: string): number {
  const raw = findFirst(json, ['totalCnt'])
  const n = Number(raw)
  if (raw === '' || Number.isNaN(n)) {
    throw new LawApiError(
      '법제처 응답에서 totalCnt를 찾지 못했습니다 — 정상 결과가 아닙니다(인증키·점검·요청 형식 문제일 수 있습니다).',
      url,
      200,
      body,
    )
  }
  return n
}

/**
 * @함수명: collectRecords
 * @설명: 응답 JSON 전체를 훑어 지정한 필드를 모두 가진 객체만 모읍니다.
 *        바깥 감싸개 이름과 배열/단일 객체 차이를 신경 쓰지 않아도 됩니다.
 * @매개변수: value - 훑을 JSON / required - 반드시 있어야 하는 키 목록
 * @반환값: 조건을 만족하는 객체 배열
 */
export function collectRecords(value: Json, required: string[]): Record<string, Json>[] {
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
export function str(v: Json | undefined): string {
  if (v === undefined || v === null) return ''
  return String(v).trim()
}

/**
 * @함수명: digitsOnly
 * @설명: 숫자만 남깁니다. 두 API가 같은 값을 다른 표기로 줄 수 있어(20260512 vs
 *        2026-05-12, 04984 vs 4984) 대조 전에 이걸로 맞춥니다. 표기 차이를 그대로
 *        두면 모든 대조가 실패해 개정이 조용히 사라집니다.
 * @매개변수: raw - 원문
 * @반환값: 숫자만 남은 문자열(앞의 0은 제거)
 */
export function digitsOnly(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.replace(/^0+(?=\d)/, '')
}

/**
 * @함수명: normalizeLawId
 * @설명: 법령ID를 6자리 숫자열로 맞춥니다. 법제처 법령ID는 앞에 0이 붙는데
 *        JSON이 숫자형으로 주면 앞의 0이 사라져 DB 값과 대조가 실패합니다.
 * @매개변수: raw - 원문
 * @반환값: 6자리로 채운 문자열(숫자가 아니면 원문 그대로 다듬어 반환)
 */
export function normalizeLawId(raw: string): string {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return t
  return t.padStart(6, '0')
}

/** YYYYMMDD 또는 YYYY-MM-DD를 YYYY-MM-DD로. 형식이 아니면 null */
export function toIsoDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

/**
 * @함수명: findFirst
 * @설명: 응답을 훑어 후보 키 중 처음 발견한 값을 문자열로 돌려줍니다.
 * @매개변수: value - 훑을 JSON / keys - 찾을 키 후보
 * @반환값: 찾은 값(없으면 빈 문자열)
 */
export function findFirst(value: Json, keys: string[]): string {
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
