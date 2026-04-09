/**
 * @파일: api/debug-searchparams/route.ts
 * @설명: searchParams 동작 확인용 디버그 API
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.json({
    searchParams: Object.fromEntries(url.searchParams),
    nextVersion: require('next/package.json').version,
  })
}
