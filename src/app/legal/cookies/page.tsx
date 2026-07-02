/**
 * @파일: app/legal/cookies/page.tsx
 * @설명: CoreZent 쿠키 정책 페이지
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  LegalChrome,
  LegalSection,
  P,
  LabelBox,
  Bullets,
  Note,
  B,
} from '../_components/legal-ui'

export const metadata: Metadata = {
  title: '쿠키 정책',
  description: 'CoreZent가 웹사이트에서 쿠키를 어떻게 사용하고, 회원이 어떻게 관리할 수 있는지 안내합니다.',
}

export default async function CookiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const supportHref = user ? '/dashboard/support' : '/auth/login'

  return (
    <LegalChrome
      title="쿠키 정책"
      intro="본 정책은 CoreZent가 웹사이트(www.corezent.com)에서 쿠키와 유사한 추적 기술을 어떻게 사용하는지 안내합니다."
      updated="시행일: 2026년 5월 18일"
      contactTitle="쿠키 사용에 대해 궁금한 점이 있으신가요?"
      contactDesc="support@corezent.com 으로 문의해 주세요."
      supportHref={supportHref}
    >
      <LegalSection badge="1" title="들어가며">
        <P>
          CoreZent는 더 편리하고 안전한 서비스를 제공하기 위해 쿠키 및 유사 기술을 사용합니다. 회원이 본 웹사이트를 이용하시면 본 정책에서 안내하는 방식에 따라 쿠키가 사용되는 데 동의하시는 것으로 간주됩니다.
        </P>
      </LegalSection>

      <LegalSection badge="2" title="쿠키란 무엇인가요?">
        <P>
          쿠키는 웹사이트가 회원의 기기에 저장하는 작은 텍스트 파일입니다. 회원의 컴퓨터나 모바일 기기를 식별하는 데 사용되지만, 회원 개인을 직접 식별하지는 않습니다.
        </P>
        <P>CoreZent는 두 가지 종류의 쿠키를 사용합니다.</P>
        <Bullets
          items={[
            <><B>세션 쿠키</B> — 브라우저를 닫으면 자동으로 삭제되는 임시 쿠키</>,
            <><B>지속성 쿠키</B> — 회원이 직접 삭제하거나 만료될 때까지 기기에 남아 있는 쿠키</>,
          ]}
        />
      </LegalSection>

      <LegalSection badge="3" title="CoreZent가 쿠키를 사용하는 목적">
        <P>회사는 다음 목적으로 쿠키를 사용합니다.</P>
        <LabelBox label="필수 쿠키 (반드시 필요)">
          <P>
            서비스 운영에 반드시 필요한 쿠키입니다. 로그인 상태 유지, 대시보드 접근, 라이선스 키 확인, 결제 처리 등 핵심 기능을 위해 사용되며, 이 쿠키 없이는 서비스를 정상적으로 제공할 수 없습니다.
          </P>
        </LabelBox>
        <LabelBox label="기능 쿠키 (편의 기능)">
          <P>회원이 선택한 언어, 테마 등 사용 환경을 기억하여 다음 방문 시 편리하게 이용할 수 있도록 합니다.</P>
        </LabelBox>
        <LabelBox label="분석 쿠키 (통계 및 성능)">
          <P>
            회원이 웹사이트를 어떻게 이용하는지 익명으로 분석하여 서비스를 개선하는 데 사용됩니다. 회사는 Vercel Analytics와 Google Analytics를 활용합니다.
          </P>
        </LabelBox>
        <LabelBox label="보안 쿠키">
          <P>비정상적인 접근을 감지하고 회원 계정과 라이선스 정보를 보호하는 데 사용됩니다.</P>
        </LabelBox>
      </LegalSection>

      <LegalSection badge="4" title="제3자 쿠키">
        <P>회사의 자체 쿠키 외에도, 다음과 같은 제3자 서비스의 쿠키가 사용될 수 있습니다.</P>
        <Bullets
          items={[
            <><B>결제대행사 (Lemon Squeezy)</B> — 안전한 결제 처리 및 사기 방지</>,
            <><B>인증 서비스 (Supabase)</B> — 안전한 로그인 세션 관리</>,
            <><B>분석 서비스 (Vercel Analytics, Google Analytics)</B> — 익명 통계 수집</>,
          ]}
        />
        <P>각 제3자 서비스의 쿠키는 해당 업체의 정책에 따라 관리됩니다.</P>
      </LegalSection>

      <LegalSection badge="5" title="쿠키 거부 및 관리 방법">
        <P>
          회원은 브라우저 설정을 통해 쿠키를 허용·차단·삭제할 수 있습니다. 주요 브라우저의 쿠키 관리 방법은 아래와 같습니다.
        </P>
        <Bullets
          items={[
            <><B>Chrome</B>: 설정 → 개인정보 보호 및 보안 → 쿠키 및 기타 사이트 데이터</>,
            <><B>Edge</B>: 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리 및 삭제</>,
            <><B>Safari</B>: 환경설정 → 개인 정보 보호 → 쿠키 및 웹 사이트 데이터</>,
            <><B>Firefox</B>: 설정 → 개인 정보 및 보안 → 쿠키와 사이트 데이터</>,
          ]}
        />
        <P>
          <B>Google Analytics 추적을 거부</B>하시려면{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pen hover:underline"
          >
            Google Analytics 옵트아웃 페이지
          </a>
          에서 차단 도구를 설치하실 수 있습니다.
        </P>
        <Note>
          <B>참고</B>: 필수 쿠키를 차단하실 경우 로그인, 라이선스 키 조회, 결제 등 핵심 기능을 이용하실 수 없습니다.
        </Note>
      </LegalSection>

      <LegalSection badge="6" title="정책의 변경">
        <P>
          본 정책은 법령 또는 서비스 정책 변경에 따라 개정될 수 있습니다. 변경 시 본 페이지에 시행일을 명시하여 공지하며, 정기적으로 확인해 주실 것을 권장합니다.
        </P>
      </LegalSection>
    </LegalChrome>
  )
}
