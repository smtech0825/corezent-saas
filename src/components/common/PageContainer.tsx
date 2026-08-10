/**
 * @컴포넌트: PageContainer
 * @설명: 콘솔(대시보드·관리자) 페이지의 공용 바깥 컨테이너.
 *        화면마다 제각각이던 최대폭·여백을 한 곳에서 관리해, 메뉴를 이동해도
 *        페이지 제목(h1)의 시작 위치가 흔들리지 않도록 기준을 통일한다.
 *
 *        - dashboard   : /dashboard 및 하위 전부
 *        - admin       : /admin 및 하위 전부 (content/ 제외, 상세 [id] 포함)
 *        - admin-form  : /admin/content/ 아래 콘텐츠 편집 화면 전부
 *
 *        영역 간 여백이 다른 것(dashboard=px/py, admin=p)은 각 영역에서 이미
 *        다수가 쓰던 값을 채택한 결과이며 의도된 차이다.
 */

/** 그룹별 컨테이너 클래스 — Tailwind가 정적 추출할 수 있도록 리터럴로 둔다 */
const VARIANT_CLASS = {
  dashboard: 'px-4 py-6 sm:px-6 sm:py-8 max-w-5xl mx-auto',
  admin: 'p-4 sm:p-6 max-w-[1440px] mx-auto',
  'admin-form': 'p-4 sm:p-6 max-w-3xl mx-auto',
} as const

export type PageContainerVariant = keyof typeof VARIANT_CLASS

interface Props {
  /** 페이지가 속한 영역 그룹 */
  variant: PageContainerVariant
  /** 추가 클래스 — 주로 자식 간 세로 간격(space-y-6) 전달용 */
  className?: string
  children: React.ReactNode
}

/**
 * @함수명: PageContainer
 * @설명: 그룹별 기준 폭·여백을 적용한 페이지 바깥 컨테이너를 렌더합니다.
 * @매개변수: variant - 영역 그룹 / className - 추가 클래스 / children - 페이지 내용
 * @반환값: 컨테이너 div 엘리먼트
 */
export default function PageContainer({ variant, className, children }: Props) {
  return (
    <div className={className ? `${VARIANT_CLASS[variant]} ${className}` : VARIANT_CLASS[variant]}>
      {children}
    </div>
  )
}
