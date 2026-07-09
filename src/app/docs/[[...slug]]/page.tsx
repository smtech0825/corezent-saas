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

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
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
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
