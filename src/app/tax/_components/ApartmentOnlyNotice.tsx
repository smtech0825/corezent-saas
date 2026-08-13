/**
 * @컴포넌트: ApartmentOnlyNotice
 * @설명: 부동산 계산기 공용 범위 안내 — 모든 계산기는 아파트 기준이다.
 *        취득세·인지세·중개수수료와 앞으로 만들 계산기가 전부 같은 문구를 쓰도록
 *        이 컴포넌트 한 곳에서 관리한다(문구 수정도 여기 한 곳만).
 *        서버 컴포넌트 — 상태·이벤트가 없다.
 */

import { Building2 } from 'lucide-react'

export default function ApartmentOnlyNotice() {
  return (
    <div className="mb-6 bg-caution-soft border border-caution/30 rounded-lg p-4 flex items-start gap-2.5">
      <Building2 size={18} className="text-caution shrink-0 mt-0.5" aria-hidden />
      <p className="text-sm text-ink leading-relaxed">
        <strong className="font-semibold">이 계산기는 아파트를 기준으로 합니다.</strong>{' '}
        오피스텔·상가·토지·단독주택 등은 적용되는 세율·요율 체계가 달라 결과가 맞지
        않을 수 있습니다.
      </p>
    </div>
  )
}
