/**
 * @파일: components/common/PageBreadcrumb.tsx
 * @설명: 검색결과에 「홈 > 요금제」처럼 경로를 보여주는 구조화 데이터.
 *        화면에는 아무것도 그리지 않는다(검색엔진만 읽는 정보).
 *
 *        왜 공용으로 두나: 페이지마다 JsonLd·breadcrumbJsonLd를 각각 import해 쓰면
 *        줄 수는 같은데 손댈 곳이 늘어난다. 경로 한 줄만 넘기게 해서 호출부를 짧게 둔다.
 */
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld'

/**
 * @함수명: PageBreadcrumb
 * @설명: 홈에서 현재 화면까지의 경로를 구조화 데이터로 출력합니다.
 *        '홈'은 자동으로 맨 앞에 붙으므로 넘기지 않습니다.
 * @매개변수: trail - 홈 다음 단계부터의 [{ name, path }] 목록
 * @반환값: JSON-LD 스크립트 요소
 */
export default function PageBreadcrumb({
  trail,
}: {
  trail: { name: string; path: string }[]
}) {
  return <JsonLd data={breadcrumbJsonLd([{ name: '홈', path: '/' }, ...trail])} />
}
