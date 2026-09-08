/**
 * @파일: app/security/page.tsx
 * @설명: 보안·개인정보 안내(신뢰 센터) — 기관 보안 검토 담당자가 도입 전에 확인하는 내용을 한 페이지로.
 *        ⚠️ 문구 원칙: 「외부 전송 없음」처럼 사실과 다른 표현을 쓰지 않는다.
 *        당사 서버로 안 가는 것과 AI 회사로 가는 것을 반드시 나눠 적는다.
 *        근거는 prompts/지니워크_제품정보_마스터.md §3-4·§5(정본)와 /api/license/validate 실제 요청 필드.
 *        DB를 읽지 않는 정적 콘텐츠지만 Navbar·Footer가 설정을 조회하므로 다른 공개 페이지와 같은 렌더 방식을 쓴다.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Section, { SectionHeader } from '@/components/ui/Section'
import { buildPageMetadata } from '@/lib/seo'
import { JsonLd, breadcrumbJsonLd } from '@/lib/jsonld'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  path: '/security',
  title: '보안·개인정보',
  description:
    '지니워크가 문서와 개인정보를 어떻게 다루는지 사실 그대로 정리했습니다. 당사 서버로 가지 않는 것, AI 회사로 전송되는 것, PC에 저장되는 것을 구분해 설명합니다.',
})

/** 데이터 흐름 단계 — 순서대로 그린다. 모바일에서는 세로, 데스크톱에서는 가로로 흐른다 */
const FLOW_STEPS: { title: string; detail: string }[] = [
  { title: '내 PC', detail: '문서·자료를 입력합니다' },
  { title: '개인정보 가림', detail: 'PC 안에서 가린 뒤 내보냅니다' },
  { title: 'AI 회사', detail: '본인 명의 키로 호출합니다' },
  { title: '내 PC', detail: '원래 값으로 되돌려 저장합니다' },
]

/** 기관 담당자가 실제로 묻는 것 — 마스터 문서 §5-3을 그대로 옮긴다(임의 각색 금지) */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: '자료가 외부로 나가나요?',
    a: '문서 파일 자체는 나가지 않습니다. AI에 보내는 것은 개인정보를 가린 글자입니다.',
  },
  { q: '당사 서버에 쌓이나요?', a: '작성한 문서를 CoreZent 서버에 저장하지 않습니다.' },
  {
    q: 'AI 회사는요?',
    a: '사용자 본인 명의 AI 계정으로 호출합니다. 해당 AI 회사의 데이터 처리 정책이 적용되며, 유료 등급 키 사용을 권장합니다.',
  },
  { q: '인터넷이 필요한가요?', a: 'AI를 쓰므로 인터넷 연결이 필요합니다.' },
  {
    q: '감사에서 문제되지 않나요?',
    a: '사람이 최종 검토하는 초안 도구입니다. 승인되지 않은 개인 AI 사용을 줄이는 수단이기도 합니다.',
  },
]

const CARD = 'border border-rule bg-paper-raised rounded-xl p-5'

export default function SecurityPage() {
  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '보안·개인정보', path: '/security' },
        ])}
      />
      <Navbar />

      <main className="flex-1">
        {/* 머리말 */}
        <Section width="text" className="pb-8 sm:pb-10">
          <SectionHeader
            label="보안·개인정보"
            title="자료가 어디로 가는지 그대로 말씀드립니다"
            sub="기관 보안 검토에 필요한 내용만, 실제 동작대로 적었습니다."
            headingLevel="h1"
          />
        </Section>

        {/* 한눈에 — 세 갈래를 먼저 구분해 준다. 이 구분이 이 페이지의 핵심이다 */}
        <Section tone="shade" width="content" className="py-10 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={CARD}>
              <p className="text-xs text-ink-faint mb-2">CoreZent 서버</p>
              <p className="text-base font-bold text-ink mb-2">작성한 문서를 받지 않습니다</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                문서 내용과 AI 키는 당사 서버를 거치지 않습니다. 서버가 받는 것은 라이선스 인증 값뿐입니다.
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-ink-faint mb-2">AI 회사</p>
              <p className="text-base font-bold text-ink mb-2">가린 글자가 전송됩니다</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                문서를 만들려면 AI 호출이 필요합니다. 개인정보를 가린 글자가 본인 명의 AI 계정으로 전송됩니다.
              </p>
            </div>
            <div className={CARD}>
              <p className="text-xs text-ink-faint mb-2">담당자 PC</p>
              <p className="text-base font-bold text-ink mb-2">원본이 남는 곳입니다</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                문서와 AI 키는 PC 안 로컬 데이터베이스에 저장되고, 개인정보 항목은 AES-256으로 암호화됩니다.
              </p>
            </div>
          </div>
        </Section>

        {/* 데이터 흐름 — SVG 대신 CSS 박스로 그린다(좁은 화면에서 글자가 줄지 않는다) */}
        <Section width="content">
          <SectionHeader label="처리 흐름" title="문서 한 건이 만들어지는 동안" />
          <ol className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-0 list-none">
            {FLOW_STEPS.map((step, i) => (
              <li key={`${step.title}-${i}`} className="flex flex-col md:flex-row md:items-center md:flex-1">
                <div className={`${CARD} flex-1 text-center`}>
                  <p className="text-sm font-bold text-ink">{step.title}</p>
                  <p className="mt-1.5 text-xs text-ink-soft leading-relaxed break-keep">{step.detail}</p>
                </div>
                {/* 마지막 단계 뒤에는 화살표를 두지 않는다 */}
                {i < FLOW_STEPS.length - 1 && (
                  <span aria-hidden className="self-center text-ink-faint px-3 py-1 md:py-0">
                    <span className="md:hidden">↓</span>
                    <span className="hidden md:inline">→</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-ink-soft leading-relaxed break-keep">
            금액·날짜 계산은 AI가 아니라 검증된 코드가 처리합니다. 한글(HWPX) 파일도 자체 엔진으로 PC 안에서 만듭니다.
          </p>
        </Section>

        {/* 가리는 것과 가리지 않는 것 — 담당자가 가장 알고 싶어 하는 부분이라 숨기지 않는다 */}
        <Section tone="shade" width="text">
          <SectionHeader
            label="개인정보"
            title="무엇을 가리고, 무엇을 가리지 않는지"
            sub="가리지 않는 항목까지 밝혀야 검토가 됩니다."
          />
          <div className="space-y-5 text-sm text-ink-soft leading-relaxed">
            <div>
              <p className="font-bold text-ink mb-1.5">문서를 작성할 때</p>
              <p>
                전화번호·이메일·주소·주민등록번호 뒷자리를 PC 안에서 찾아 가린 뒤 AI로 보냅니다. 결과를 받으면 원래
                값으로 되돌려 문서에 넣습니다. 원본은 PC에 남습니다.
              </p>
            </div>
            <div>
              <p className="font-bold text-ink mb-1.5">자료를 올릴 때(내 자료·문서 분석)</p>
              <p>
                전화번호·이메일·주민등록번호 뒷자리를 가립니다. <b className="text-ink">주소·금액·이름·계좌번호는
                가리지 않습니다.</b> 사업 대상지와 금액이 빠지면 요약이 쓸모없어지기 때문입니다. 화면에 보이는 인용문은
                원본 그대로입니다.
              </p>
            </div>
            <div>
              <p className="font-bold text-ink mb-1.5">문서 속 개인정보를 지우고 싶을 때</p>
              <p>
                별도 기능으로 문서 안의 이름·주민등록번호·연락처·계좌번호를 찾아 가릴 수 있습니다. 가리지 않을 단어는
                예외로 등록해 둘 수 있습니다.
              </p>
            </div>
          </div>
        </Section>

        {/* 처리 방식 선택 — 대외비 자료를 다루는 기관에는 이 선택이 핵심이다 */}
        <Section width="text">
          <SectionHeader
            label="처리 방식"
            title="자료를 어디서 처리할지 고를 수 있습니다"
            sub="자료 묶음을 만들 때 둘 중 하나를 고릅니다. 기본은 「내 PC에서 처리」입니다."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={CARD}>
              <p className="text-base font-bold text-ink mb-2">내 PC에서 처리 <span className="text-xs font-normal text-ink-faint">(기본)</span></p>
              <p className="text-sm text-ink-soft leading-relaxed">자료가 이 컴퓨터를 벗어나지 않습니다.</p>
            </div>
            <div className={CARD}>
              <p className="text-base font-bold text-ink mb-2">빠른 처리</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                더 빠르고 정확합니다. 다만 자료가 AI 서비스에 보관되며, 묶음을 지우면 함께 지워집니다.
                <b className="text-ink"> 대외비·개인정보가 든 자료는 「내 PC에서 처리」를 권합니다.</b>
              </p>
            </div>
          </div>
        </Section>

        {/* AI 키·라이선스 — 서버로 실제 전송되는 값을 숨기지 않고 밝힌다 */}
        <Section tone="shade" width="text">
          <SectionHeader label="키와 인증" title="AI 키와 라이선스는 이렇게 다룹니다" />
          <div className="space-y-4 text-sm text-ink-soft leading-relaxed">
            <p>
              <b className="text-ink">AI 키는 본인 것을 등록해 사용합니다.</b> 앱이 자체 AI 키를 갖고 있지 않습니다.
              문서 작성에는 Claude 키가, 자료·법령 조회에는 Gemini 키가 필요합니다. 등록한 키는 그 PC에만 암호화되어
              저장되며 당사 서버로 전송되지 않습니다. AI 사용 내역과 비용은 사용하시는 분의 계정에서 관리됩니다.
            </p>
            <p>
              <b className="text-ink">라이선스 인증 때는 두 가지만 서버로 갑니다.</b> 라이선스 키와 PC 고유번호입니다.
              문서 내용·자료·AI 키는 이 요청에 포함되지 않습니다. PC를 교체하시면 재인증으로 연결을 옮길 수 있습니다.
            </p>
          </div>
        </Section>

        {/* 먼저 확인해 주세요 — /public-sector와 같은 경고 톤을 유지한다 */}
        <Section width="text">
          <div className="border border-caution/20 bg-caution-soft rounded-xl p-6">
            <p className="text-base font-bold text-caution mb-3">도입 전에 확인해 주세요</p>
            <ul className="space-y-2 text-sm text-ink-soft list-disc pl-5 leading-relaxed">
              <li>인터넷에 연결된 PC에서 사용하는 프로그램입니다. 폐쇄망(내부망) 전용 환경은 지원하지 않습니다.</li>
              <li>문서 생성에 외부 AI 서비스를 이용합니다. 등록하신 AI 키로 해당 서비스에 요청이 전송되며, 그 회사의 데이터 처리 정책이 적용됩니다.</li>
              <li>사람이 최종 검토하는 초안 도구입니다. 생성된 문서를 그대로 결재에 올리는 용도가 아닙니다.</li>
              <li>도입 전 기관의 보안 지침에 맞는지 담당 부서와 확인해 주시기 바랍니다.</li>
            </ul>
          </div>
        </Section>

        {/* 자주 묻는 것 */}
        <Section tone="shade" width="text">
          <SectionHeader label="문답" title="기관 담당자가 묻는 것" />
          <dl className="divide-y divide-rule border-y border-rule">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="text-sm font-bold text-ink mb-1.5">{item.q}</dt>
                <dd className="text-sm text-ink-soft leading-relaxed break-keep">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 관련 문서 */}
        <Section width="text" className="pt-0">
          <h2 className="text-lg font-serif font-black text-ink mb-4">함께 보기</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/public-sector" className="text-mark underline underline-offset-4">기관 도입 안내</Link>
              <span className="text-ink-soft"> — 수의계약·견적서·세금계산서</span>
            </li>
            <li>
              <Link href="/legal/privacy" className="text-mark underline underline-offset-4">개인정보처리방침</Link>
              <span className="text-ink-soft"> — 홈페이지 회원 정보 처리 기준</span>
            </li>
            <li>
              <Link href="/docs" className="text-mark underline underline-offset-4">사용 설명서</Link>
              <span className="text-ink-soft"> — 설치·AI 키 등록 방법</span>
            </li>
            <li>
              <Link href="/contact" className="text-mark underline underline-offset-4">문의하기</Link>
              <span className="text-ink-soft"> — 보안 검토 자료가 더 필요하시면 알려 주세요</span>
            </li>
          </ul>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
