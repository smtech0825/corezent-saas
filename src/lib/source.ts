/**
 * @파일: lib/source.ts
 * @설명: Fumadocs 매뉴얼(docs) 로더. baseUrl '/docs' 기준으로 페이지 트리·slug·검색 인덱스를 만든다.
 *        생성물 `.source`는 저장소 루트에 만들어지는 빌드 산출물이라 상대경로로 참조한다.
 *        (이 저장소는 `@/*` → `src/*` 매핑이라 `@/.source` 별칭을 쓸 수 없다)
 */
import { docs } from '../../.source'
import { loader } from 'fumadocs-core/source'

/** 매뉴얼 소스 — /docs 세그먼트(레이아웃·페이지·검색 API)가 공통으로 사용한다 */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
