/**
 * @파일: app/docs/[[...slug]]/page.tsx
 * @설명: 매뉴얼 문서 페이지. content/docs의 MDX를 slug로 찾아 Fumadocs UI로 렌더한다.
 *        정적 파라미터/메타데이터를 컬렉션에서 자동 생성하므로 문서를 추가해도 코드 수정이 없다.
 */
import { source } from '@/lib/source'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/mdx-components'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'
import PageBreadcrumb from '@/components/common/PageBreadcrumb'

type DocsPageProps = { params: Promise<{ slug?: string[] }> }

/**
 * @함수명: Page
 * @설명: slug에 해당하는 매뉴얼 문서를 렌더한다. 문서가 없으면 404 처리한다.
 * @매개변수: props.params - 경로 slug 세그먼트(Promise)
 */
export default async function Page(props: DocsPageProps) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  // hidden: true 문서는 사이드바·검색·사이트맵에서만 빠져 있고 주소를 직접 치면 열렸다.
  // 표식의 뜻을 "공개하지 않음"으로 통일해 주소로도 열리지 않게 한다(문서 파일은 그대로 둔다).
  if (page.data.hidden === true) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <PageBreadcrumb trail={[{ name: '매뉴얼', path: '/docs' }, { name: page.data.title, path: page.url }]} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // 상대 파일 경로 링크를 실제 문서 경로로 변환
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

/**
 * @함수명: generateStaticParams
 * @설명: 모든 매뉴얼 문서의 정적 파라미터를 생성한다(빌드 시 정적 생성).
 */
export function generateStaticParams() {
  return source.generateParams()
}

/**
 * @함수명: generateMetadata
 * @설명: 문서별 title·description 메타데이터를 생성한다.
 * @매개변수: props.params - 경로 slug 세그먼트(Promise)
 */
export async function generateMetadata(props: DocsPageProps): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page || page.data.hidden === true) notFound()

  // canonical — 매뉴얼은 사이트맵에 올라가는 공개 문서인데 정식 주소가 없었다.
  // 없으면 물음표가 붙은 주소(추적 파라미터 등)가 각각 다른 문서로 취급돼 순위가 갈린다.
  const url = `${SITE_URL}${page.url}`

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url,
      type: 'article',
    },
  }
}
