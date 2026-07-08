/**
 * @파일: app/legal/terms/page.tsx
 * @설명: CoreZent 이용약관 페이지
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { buildPageMetadata } from '@/lib/seo'
import {
  LegalChrome,
  LegalSection,
  P,
  SubLabel,
  Group,
  Bullets,
  OL,
  B,
} from '../_components/legal-ui'

export const metadata: Metadata = buildPageMetadata({
  path: '/legal/terms',
  title: '이용약관',
  description: 'CoreZent 서비스 이용에 관한 회원의 권리와 의무를 안내합니다.',
})

export default async function TermsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const supportHref = user ? '/dashboard/support' : '/auth/login'

  return (
    <LegalChrome
      title="이용약관"
      intro="CoreZent를 이용하시기 전에 본 약관을 주의 깊게 읽어주세요. 회원이 서비스에 가입하거나 서비스를 이용하시면 본 약관에 동의하신 것으로 간주됩니다."
      updated="시행일: 2026년 5월 18일"
      contactTitle="약관에 대해 궁금한 점이 있으신가요?"
      contactDesc="고객지원팀이 친절하게 답변드립니다."
      supportHref={supportHref}
    >
      <LegalSection badge="1" title="제1조 (목적 및 정의)">
        <Group>
          <SubLabel>1. 목적</SubLabel>
          <P>
            본 약관은 CoreZent(이하 &quot;회사&quot;)가 운영하는 웹사이트(www.corezent.com) 및 회사가 제공하는 모든 소프트웨어·구독 서비스(이하 &quot;서비스&quot;) 이용에 관하여 회사와 회원 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
          </P>
        </Group>
        <Group>
          <SubLabel>2. 정의</SubLabel>
          <P>본 약관에서 사용하는 주요 용어의 정의는 다음과 같습니다.</P>
          <Bullets
            items={[
              <><B>&quot;회원&quot;</B> — 본 약관에 동의하고 회사와 서비스 이용 계약을 체결한 자</>,
              <><B>&quot;디지털 콘텐츠&quot;</B> — 회사가 회원에게 제공하는 데스크톱 앱, 크롬 확장 프로그램 등 모든 소프트웨어</>,
              <><B>&quot;라이선스 키&quot;</B> — 회원이 디지털 콘텐츠를 활성화하기 위해 사용하는 고유한 인증 문자열</>,
              <><B>&quot;구독&quot;</B> — 회원이 정기적인 결제를 조건으로 디지털 콘텐츠를 일정 기간 이용할 수 있는 서비스 형태</>,
            ]}
          />
        </Group>
      </LegalSection>

      <LegalSection badge="2" title="제2조 (약관의 명시 및 변경)">
        <OL
          items={[
            '회사는 본 약관을 회원이 쉽게 알 수 있도록 웹사이트에 게시합니다.',
            '회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다. 변경 시 시행일 최소 7일 전(회원에게 불리한 변경의 경우 30일 전)에 웹사이트 또는 이메일로 공지합니다.',
            '회원이 변경된 약관에 동의하지 않을 경우 회원 탈퇴를 요청할 수 있습니다. 공지된 시행일 이후에도 서비스를 계속 이용하시면 변경된 약관에 동의하신 것으로 간주됩니다.',
          ]}
        />
      </LegalSection>

      <LegalSection badge="3" title="제3조 (회원 가입 및 계정 관리)">
        <Group>
          <SubLabel>1. 가입 자격</SubLabel>
          <P>회원 가입은 만 14세 이상부터 가능합니다.</P>
        </Group>
        <Group>
          <SubLabel>2. 계약 성립</SubLabel>
          <P>회원이 본 약관에 동의하고 회사가 정한 가입 절차를 완료하면, 회사가 이를 승낙함으로써 이용 계약이 성립합니다.</P>
        </Group>
        <Group>
          <SubLabel>3. 회원의 의무</SubLabel>
          <P>회원은 가입 시 정확한 정보를 제공해야 하며, 등록 정보에 변경이 있을 경우 즉시 수정해야 합니다.</P>
        </Group>
        <Group>
          <SubLabel>4. 계정 보안</SubLabel>
          <P>
            회원은 본인의 계정과 비밀번호를 안전하게 관리할 책임이 있으며, 본인의 계정에서 발생한 모든 활동에 대해 책임을 집니다. 계정의 무단 사용을 인지한 경우 즉시 회사에 통지해야 합니다.
          </P>
        </Group>
      </LegalSection>

      <LegalSection badge="4" title="제4조 (서비스의 제공 및 이용)">
        <Group>
          <SubLabel>1. 라이선스 부여</SubLabel>
          <P>
            회사는 회원에게 디지털 콘텐츠를 사용할 수 있는 <B>비독점적·양도 불가·취소 가능한 한정 라이선스</B>를 부여합니다. 회원은 디지털 콘텐츠의 <B>소유권을 취득하는 것이 아니라, 사용할 권리만을 부여받습니다.</B>
          </P>
        </Group>
        <Group>
          <SubLabel>2. 라이선스 키의 발급</SubLabel>
          <P>결제 완료 즉시 회원의 대시보드에서 라이선스 키를 확인할 수 있으며, 결제 확인 이메일도 함께 발송됩니다.</P>
        </Group>
        <Group>
          <SubLabel>3. 금지 행위</SubLabel>
          <P>회원은 다음과 같은 행위를 해서는 안 됩니다.</P>
          <Bullets
            items={[
              '디지털 콘텐츠를 제3자에게 양도, 재판매, 임대, 재배포하는 행위',
              '라이선스 키를 공유하거나 무단으로 복제하는 행위',
              '디지털 콘텐츠를 역설계(reverse engineering), 디컴파일, 분해하는 행위',
              '저작권 표시 또는 보호 장치를 제거·변경하는 행위',
              '자동화 도구·봇·크롤러 등을 이용해 서비스를 부정 이용하는 행위',
              '서비스의 정상적인 운영을 방해하는 행위',
            ]}
          />
          <P>위반 시 회사는 사전 통지 없이 라이선스를 취소하고 계정을 정지할 수 있으며, 환불은 제공되지 않습니다.</P>
        </Group>
      </LegalSection>

      <LegalSection badge="5" title="제5조 (요금, 결제 및 세금)">
        <Group>
          <SubLabel>1. 결제 방법</SubLabel>
          <P>
            결제는 회사의 결제 파트너인 <B>Lemon Squeezy(미국)</B>를 통해 처리됩니다. 신용카드(Visa, MasterCard, American Express), PayPal, Apple Pay, Google Pay 등을 지원하며, 결제 수단은 지역에 따라 다를 수 있습니다.
          </P>
        </Group>
        <Group>
          <SubLabel>2. 통화 및 환율</SubLabel>
          <P>
            서비스 요금은 미국 달러(USD)로 표시될 수 있으며, 회원의 결제 수단에 따라 환율 및 통화 변환 수수료가 적용될 수 있습니다. 환율 차이로 인한 비용은 회원이 부담합니다.
          </P>
        </Group>
        <Group>
          <SubLabel>3. 세금</SubLabel>
          <P>
            Lemon Squeezy는 판매자 대행(Merchant of Record)으로서 회원의 거주 지역에 적용되는 부가가치세(VAT/GST) 등 세금을 자동 계산·징수합니다. 별도의 세금이 발생할 경우 결제 단계에서 명시됩니다.
          </P>
        </Group>
        <Group>
          <SubLabel>4. 구독 자동 갱신</SubLabel>
          <P>
            구독 상품은 회원이 해지하지 않는 한 결제 주기에 따라 자동으로 갱신·청구됩니다. 회원은 대시보드에서 언제든 자동 갱신을 해지할 수 있습니다.
          </P>
        </Group>
      </LegalSection>

      <LegalSection badge="6" title="제6조 (청약철회 및 환불)">
        <P>
          회사는 「전자상거래 등에서의 소비자보호에 관한 법률」 및 「콘텐츠산업진흥법」에 따라 다음과 같이 환불을 처리합니다.
        </P>
        <Group>
          <SubLabel>1. 환불 가능 — 미사용 라이선스</SubLabel>
          <P>
            구매일로부터 <B>7일 이내</B>에 라이선스 키를 사용하지 않은 경우, 회원은 청약철회를 요청하여 전액 환불받을 수 있습니다.
          </P>
        </Group>
        <Group>
          <SubLabel>2. 환불 제한 — 사용 개시 후</SubLabel>
          <P>디지털 콘텐츠의 특성상 다음의 경우 청약철회가 제한됩니다.</P>
          <Bullets
            items={[
              '라이선스 키를 활성화(activate)하거나 소프트웨어를 한 번이라도 실행한 경우',
              '구매일로부터 7일이 경과한 경우',
              '가분적(可分的) 콘텐츠 중 이미 제공된 부분',
            ]}
          />
        </Group>
        <Group>
          <SubLabel>3. 구독 해지</SubLabel>
          <P>
            회원은 언제든 대시보드에서 구독을 해지할 수 있습니다. 해지 후에도 현재 결제 주기가 끝날 때까지는 서비스를 이용할 수 있으며, 이미 결제된 금액은 잔여 기간에 대해 환불되지 않습니다(단, 회사의 귀책 사유가 있는 경우는 예외).
          </P>
        </Group>
        <Group>
          <SubLabel>4. 환불 처리 기간</SubLabel>
          <P>
            환불은 청약철회 의사 표시를 받은 날로부터 <B>3영업일 이내</B>에 회원이 결제한 동일한 수단으로 처리됩니다. 결제 수단의 특성상 실제 입금까지는 카드사·은행에 따라 추가 시일이 소요될 수 있습니다.
          </P>
        </Group>
        <Group>
          <SubLabel>5. 환불 신청 방법</SubLabel>
          <P>환불을 원하시는 회원은 support@corezent.com 으로 주문 번호와 함께 요청해 주시기 바랍니다.</P>
        </Group>
      </LegalSection>

      <LegalSection badge="7" title="제7조 (서비스의 중단 및 변경)">
        <OL
          items={[
            '회사는 시스템 점검, 보수, 교체 등을 위해 일시적으로 서비스 제공을 중단할 수 있으며, 이 경우 사전에 공지합니다.',
            '회사는 천재지변, 전쟁, 통신 두절, 결제대행사의 장애 등 회사의 통제 범위를 벗어난 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.',
            '회사는 서비스의 일부 또는 전부를 단종할 수 있으며, 이 경우 시행일 최소 30일 전에 회원에게 통지하고 잔여 구독료에 대해 일할 환불합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection badge="8" title="제8조 (지식재산권)">
        <P>
          CoreZent 웹사이트, 디지털 콘텐츠, 소프트웨어, API, 텍스트, 디자인, 로고, 이미지 등 서비스에 포함된 모든 지식재산권은 회사 또는 정당한 권리자에게 귀속됩니다. 회원은 회사의 사전 서면 동의 없이 이를 복제·전송·배포·출판할 수 없습니다.
        </P>
      </LegalSection>

      <LegalSection badge="9" title="제9조 (회사의 면책)">
        <OL
          items={[
            <>회사는 서비스를 &quot;있는 그대로(AS IS)&quot; 제공하며, 서비스가 회원의 특정 목적에 부합하거나 중단 없이 작동할 것을 보증하지 않습니다.</>,
            '회사는 회원의 귀책 사유 또는 회사의 통제 범위를 벗어난 사유로 발생한 손해에 대해 책임을 지지 않습니다.',
            '회사가 회원에게 부담하는 손해배상 책임은, 법령상 허용되는 최대한의 범위에서, 회원이 직전 12개월간 회사에 지급한 금액을 한도로 합니다. 다만, 회사의 고의 또는 중과실로 인한 손해는 예외로 합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection badge="10" title="제10조 (계약 해지)">
        <Group>
          <SubLabel>1. 회원의 해지</SubLabel>
          <P>회원은 언제든 대시보드를 통해 회원 탈퇴를 요청할 수 있습니다.</P>
        </Group>
        <Group>
          <SubLabel>2. 회사의 해지</SubLabel>
          <P>
            회원이 다음 사항에 해당하는 경우 회사는 사전 통지 후 이용 계약을 해지할 수 있습니다. 단, 명백한 위법 행위나 다른 회원에게 중대한 피해를 주는 행위가 확인된 경우 즉시 해지할 수 있습니다.
          </P>
          <Bullets
            items={[
              '본 약관을 중대하게 위반한 경우',
              '결제 의무를 이행하지 않은 경우',
              '타인의 정보를 도용한 경우',
              '서비스의 정상적인 운영을 방해한 경우',
            ]}
          />
        </Group>
      </LegalSection>

      <LegalSection badge="11" title="제11조 (분쟁 해결 및 준거법)">
        <OL
          items={[
            '본 약관은 대한민국 법령에 따라 해석되고 적용됩니다.',
            '회사와 회원 간 분쟁이 발생할 경우 양 당사자는 상호 협의를 통해 원만하게 해결하도록 노력합니다.',
            '협의가 이루어지지 않을 경우 분쟁은 회원의 주소지 관할 법원에 제소할 수 있으며, 회원의 주소가 불분명한 경우 민사소송법상 관할 법원에 제소합니다.',
            '회원은 분쟁 해결을 위해 다음 기관에 도움을 요청할 수 있습니다.',
          ]}
        />
        <Bullets
          items={[
            '한국소비자원: www.kca.go.kr (국번 없이 1372)',
            '콘텐츠분쟁조정위원회: www.kcdrc.kr',
            '전자거래분쟁조정위원회: www.ecmc.or.kr',
          ]}
        />
      </LegalSection>

      <LegalSection title="부칙">
        <P>본 약관은 2026년 5월 18일부터 시행됩니다.</P>
      </LegalSection>
    </LegalChrome>
  )
}
