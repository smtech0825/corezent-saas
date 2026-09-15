/**
 * @파일: app/tax/_components/CalcJsonLd.tsx
 * @설명: 계산기 페이지용 구조화 데이터 한 묶음(도구 정보 + 경로 표시).
 *        페이지마다 두 벌을 따로 적으면 한쪽만 고치는 일이 생기므로 여기서 함께 낸다.
 *        빵부스러기(BreadcrumbList)는 검색결과에 「홈 > 부동산 계산기 > 취득세」처럼
 *        경로를 보여 주는 항목이라, 계산기처럼 여러 단계 아래 있는 화면에서 특히 값어치가 있다.
 */
import { JsonLd, calculatorJsonLd, breadcrumbJsonLd } from '@/lib/jsonld'

/**
 * @함수명: CalcJsonLd
 * @설명: 계산기 한 화면에 필요한 구조화 데이터를 출력합니다.
 * @매개변수: name - 화면의 h1과 같은 계산기 이름
 * @매개변수: description - 검색 설명(페이지 metadata와 같은 값을 넘깁니다)
 * @매개변수: path - '/tax/acquisition' 형태 경로. 허브면 '/tax'
 * @반환값: JSON-LD 스크립트 요소
 */
export default function CalcJsonLd({
  name,
  description,
  path,
}: {
  name: string
  description: string
  path: string
}) {
  const isHub = path === '/tax'
  const trail = [
    { name: '홈', path: '/' },
    { name: '부동산 계산기', path: '/tax' },
    // 허브 자신은 마지막 칸을 한 번 더 넣지 않는다(같은 주소가 두 번 나오면 안 된다)
    ...(isHub ? [] : [{ name: name.replace(/^부동산\s*/, ''), path }]),
  ]

  return <JsonLd data={[calculatorJsonLd({ name, description, path }), breadcrumbJsonLd(trail)]} />
}
