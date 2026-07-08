/**
 * @파일: app/legal/privacy/page.tsx
 * @설명: CoreZent 개인정보 처리방침 페이지
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildPageMetadata } from '@/lib/seo'
import {
  LegalChrome,
  LegalSection,
  P,
  LabelBox,
  Bullets,
  OL,
  LegalTable,
  B,
} from '../_components/legal-ui'

export const metadata: Metadata = buildPageMetadata({
  path: '/legal/privacy',
  title: '개인정보 처리방침',
  description: 'CoreZent가 회원의 개인정보를 어떻게 수집·이용·보관·파기하는지 안내합니다.',
})

export default async function PrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const supportHref = user ? '/dashboard/support' : '/auth/login'

  return (
    <LegalChrome
      title="개인정보 처리방침"
      intro="CoreZent는 회원의 개인정보를 소중히 다룹니다. 본 방침은 CoreZent가 어떤 정보를 수집하고, 어떤 목적으로 이용하며, 어떻게 보호하는지 안내합니다."
      updated="시행일: 2026년 5월 18일"
      contactTitle="개인정보 관련 문의가 있으신가요?"
      contactDesc="빠르게 답변드리겠습니다."
      supportHref={supportHref}
    >
      <LegalSection badge="1" title="총칙">
        <P>
          CoreZent(이하 &quot;회사&quot;)는 회원의 개인정보를 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령에 따라 적법하고 안전하게 처리합니다. 본 방침은 회사가 운영하는 웹사이트(www.corezent.com) 및 회사가 제공하는 모든 소프트웨어·구독 서비스(이하 &quot;서비스&quot;)에 적용됩니다.
        </P>
      </LegalSection>

      <LegalSection badge="2" title="수집하는 개인정보 항목 및 수집 방법">
        <P>회사는 서비스 제공을 위해 다음과 같은 최소한의 개인정보를 수집합니다.</P>
        <LabelBox label="필수 항목 — 회원가입 시">
          <P>이메일 주소, 비밀번호(암호화 저장), 이름 또는 닉네임</P>
        </LabelBox>
        <LabelBox label="필수 항목 — 결제 시">
          <P>결제 이력, 청구지 정보, 영수증 발행 정보</P>
          <p className="text-xs text-ink-faint italic leading-relaxed">
            결제 카드 번호 등 민감한 결제 정보는 회사가 직접 수집·보관하지 않으며, 결제대행사(Lemon Squeezy)가 처리합니다.
          </p>
        </LabelBox>
        <LabelBox label="자동 수집 항목 — 서비스 이용 시">
          <P>IP 주소, 접속 일시, 접속 기기 정보(OS·브라우저 종류), 서비스 이용 기록, 쿠키</P>
        </LabelBox>
        <LabelBox label="수집 방법">
          <P>회원가입·로그인 절차, 결제 절차, 고객 문의, 서비스 이용 과정에서 자동 생성되는 정보</P>
        </LabelBox>
      </LegalSection>

      <LegalSection badge="3" title="개인정보의 처리 목적">
        <P>회사는 수집한 개인정보를 다음 목적으로만 이용하며, 목적이 변경될 경우 사전에 별도 동의를 받습니다.</P>
        <OL
          items={[
            <><B>회원 관리</B> — 회원가입, 본인 확인, 부정 이용 방지, 고지사항 전달</>,
            <><B>서비스 제공</B> — 소프트웨어 라이선스 발급·관리, 구독 갱신·해지 처리, 다운로드 제공</>,
            <><B>결제 처리</B> — 상품 구매에 따른 대금 결제, 영수증 발행, 환불 처리</>,
            <><B>고객 지원</B> — 문의 응대, 기술 지원, 분쟁 해결</>,
            <><B>서비스 개선</B> — 접속 통계 분석, 신규 기능 개발, 보안 강화</>,
          ]}
        />
      </LegalSection>

      <LegalSection badge="4" title="개인정보의 보유 및 이용 기간">
        <P>
          회사는 원칙적으로 개인정보 수집·이용 목적이 달성되면 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 정보는 아래 기간 동안 보관합니다.
        </P>
        <LegalTable
          head={['보존 정보', '보존 기간', '근거 법령']}
          rows={[
            ['회원 정보', '회원 탈퇴 시까지', '회원 계약'],
            ['계약·청약철회·결제·재화공급 기록', '5년', '전자상거래법'],
            ['소비자 불만·분쟁처리 기록', '3년', '전자상거래법'],
            ['표시·광고에 관한 기록', '6개월', '전자상거래법'],
            ['접속 로그(IP 등)', '3개월', '통신비밀보호법'],
          ]}
        />
      </LegalSection>

      <LegalSection badge="5" title="개인정보의 제3자 제공">
        <P>회사는 회원의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우에는 예외로 합니다.</P>
        <OL
          items={[
            '회원이 사전에 동의한 경우',
            '법령에 특별한 규정이 있거나, 수사기관이 법령에 정한 절차에 따라 요청하는 경우',
          ]}
        />
      </LegalSection>

      <LegalSection badge="6" title="개인정보의 처리 위탁 및 국외 이전">
        <P>회사는 원활한 서비스 제공을 위해 일부 업무를 외부 전문업체에 위탁하고 있으며, 일부는 국외에서 처리됩니다.</P>
        <LegalTable
          head={['수탁업체', '위탁 업무', '이전 국가', '이전 항목']}
          rows={[
            ['Lemon Squeezy Inc.', '결제 처리, 청구·영수증 발행, 부가세 처리', '미국', '이메일, 결제 정보, 청구지 정보'],
            ['Supabase Inc.', '회원 인증, 데이터베이스 호스팅', '미국', '이메일, 비밀번호(암호화), 회원 식별자'],
            ['Vercel Inc.', '웹사이트 호스팅, 트래픽 분석', '미국', 'IP, 접속 기기 정보, 이용 기록'],
            ['Google LLC', '웹사이트 분석(Google Analytics)', '미국', '익명화된 접속 정보, 쿠키'],
          ]}
        />
        <P><B>이전 시기 및 방법</B>: 회원이 서비스를 이용하는 시점에 암호화된 통신 구간(TLS)을 통해 즉시 전송됩니다.</P>
        <P><B>이전 받는 자의 보유 기간</B>: 각 수탁업체의 정책에 따르며, 회사와의 위탁 계약 종료 시 파기됩니다.</P>
        <P>회원은 본 국외 이전에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 일부 서비스 이용이 제한될 수 있습니다.</P>
      </LegalSection>

      <LegalSection badge="7" title="회원의 권리 및 행사 방법">
        <P>회원은 언제든 다음 권리를 행사할 수 있습니다.</P>
        <Bullets
          items={[
            <><B>열람 요구</B> — 본인의 개인정보 처리 현황 확인</>,
            <><B>정정·삭제 요구</B> — 잘못된 정보의 수정 또는 삭제</>,
            <><B>처리 정지 요구</B> — 본인의 개인정보 처리 중단 요청</>,
            <><B>동의 철회</B> — 수집·이용에 대한 동의 철회 (회원 탈퇴)</>,
          ]}
        />
        <P>
          회원은 대시보드의 계정 설정에서 직접 정보를 수정·삭제하거나 회원 탈퇴를 진행할 수 있습니다. 그 외 권리 행사는 support@corezent.com 으로 요청하실 수 있으며, 회사는 지체 없이 조치합니다.
        </P>
      </LegalSection>

      <LegalSection badge="8" title="쿠키의 운영 및 거부 방법">
        <P>
          회사는 회원의 서비스 이용 편의성을 위해 쿠키를 사용합니다. 쿠키의 종류와 거부 방법은{' '}
          <Link href="/legal/cookies" className="text-pen hover:underline">쿠키 정책</Link>을 참고해 주세요.
        </P>
      </LegalSection>

      <LegalSection badge="9" title="개인정보의 안전성 확보 조치">
        <P>회사는 회원의 개인정보를 안전하게 보호하기 위해 다음과 같은 조치를 시행하고 있습니다.</P>
        <Bullets
          items={[
            <><B>기술적 조치</B> — 비밀번호 단방향 암호화, 통신 구간 TLS 암호화, 접근 권한 최소화</>,
            <><B>관리적 조치</B> — 개인정보 취급자 최소화, 정기적인 보안 점검</>,
            <><B>물리적 조치</B> — 신뢰할 수 있는 클라우드 인프라(Supabase, Vercel) 활용</>,
          ]}
        />
        <P>
          다만, 회사가 합리적인 보안 조치를 시행하더라도 회원의 부주의나 인터넷의 본질적 위험 등 회사의 통제 범위를 벗어난 사유로 인한 정보 유출에 대해서는 책임을 지지 않습니다.
        </P>
      </LegalSection>

      <LegalSection badge="10" title="개인정보의 파기 절차 및 방법">
        <Bullets
          items={[
            <><B>파기 절차</B> — 보유 기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다.</>,
            <><B>파기 방법</B> — 전자적 파일은 복구가 불가능한 방법으로 영구 삭제하고, 출력물은 분쇄하거나 소각합니다.</>,
          ]}
        />
      </LegalSection>

      <LegalSection badge="11" title="개인정보 보호책임자">
        <P>회원은 개인정보 처리에 관한 모든 문의·불만·피해구제를 아래 책임자에게 신청하실 수 있습니다.</P>
        <Bullets
          items={[
            <><B>개인정보 보호책임자</B>: 유승목</>,
            <><B>이메일</B>: support@corezent.com</>,
          ]}
        />
        <P>회사는 회원의 문의에 지체 없이 답변하고 처리하기 위해 최선을 다합니다.</P>
      </LegalSection>

      <LegalSection badge="12" title="권익 침해 구제 방법">
        <P>회원은 개인정보 침해로 인한 피해 구제를 위해 아래 기관에 분쟁 조정 또는 상담을 신청할 수 있습니다.</P>
        <Bullets
          items={[
            '개인정보분쟁조정위원회: (국번 없이) 1833-6972 / www.kopico.go.kr',
            '개인정보침해신고센터: (국번 없이) 118 / privacy.kisa.or.kr',
            '대검찰청 사이버수사과: (국번 없이) 1301 / www.spo.go.kr',
            '경찰청 사이버수사국: (국번 없이) 182 / ecrm.police.go.kr',
          ]}
        />
      </LegalSection>

      <LegalSection badge="13" title="처리방침의 변경">
        <P>
          본 방침은 법령·서비스 정책 변경에 따라 개정될 수 있으며, 변경 시 시행일 최소 7일 전(중요한 변경의 경우 30일 전)에 웹사이트를 통해 공지합니다.
        </P>
      </LegalSection>
    </LegalChrome>
  )
}
