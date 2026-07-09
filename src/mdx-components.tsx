/**
 * @파일: mdx-components.tsx
 * @설명: MDX 렌더링에 사용할 컴포넌트 모음. Fumadocs 기본 컴포넌트에 매뉴얼에서 쓰는
 *        Steps/Callout/Tabs를 전역 등록해 MDX 문서에서 import 없이 바로 사용할 수 있게 한다.
 */
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { Callout } from 'fumadocs-ui/components/callout'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import type { MDXComponents } from 'mdx/types'

/**
 * @함수명: getMDXComponents
 * @설명: 기본 MDX 컴포넌트에 추가/오버라이드 컴포넌트를 병합해 반환한다.
 * @매개변수: components - 페이지별로 덮어쓸 컴포넌트(선택)
 * @반환값: MDXComponents
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Steps,
    Step,
    Tabs,
    Tab,
    ...components,
  }
}
