'use client'

/**
 * @컴포넌트: PaymentMethodButton
 * @설명: 결제수단 변경 버튼 — 결제사(Lemon Squeezy)의 결제수단 변경 전용 화면으로 보낸다
 *        (요금제 변경이 가능한 고객 포털 전체가 아니다 — 플랜 변경 미동기화 방지).
 *        누를 때마다 /api/subscriptions/portal 에서 새 서명 주소를 발급받아 이동한다
 *        (주소가 24시간만 유효해 저장값 재사용 금지). 발급 실패는 한국어 안내로 알린다.
 *        노출 여부(구독 있는 행만)는 부모(BillingTable)가 판단한다.
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

/**
 * @함수명: portalErrorMessage
 * @설명: 포털 주소 발급 실패 code를 사용자 안내 문구로 바꾼다(취소 라우트의 안내 방식과 동일 관례).
 * @매개변수: code - API가 돌려준 machine-readable 실패 코드
 * @반환값: 화면에 그대로 보여줄 한국어 문구
 */
function portalErrorMessage(code?: string): string {
  switch (code) {
    case 'NO_LS_SUBSCRIPTION':
    case 'LS_NOT_FOUND':
      return '이 구독은 결제사 관리 화면이 제공되지 않습니다. 고객지원으로 문의해 주세요.'
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    case 'FORBIDDEN':
    case 'NOT_FOUND':
      return '구독 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.'
    default:
      return '결제사 관리 화면을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.'
  }
}

export default function PaymentMethodButton({ subscriptionId }: { subscriptionId: string }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  /**
   * @함수명: handleOpen
   * @설명: 결제수단 변경 화면의 새 주소를 발급받아 결제사 화면으로 이동한다.
   *        실패는 전부 한국어 안내로 알리고, 성공해서 이동을 시작하면 loading을 유지해
   *        이동 대기 중 버튼이 다시 눌리지 않게 한다.
   */
  async function handleOpen(): Promise<void> {
    if (loading) return
    setLoading(true)
    try {
      let res: Response
      try {
        res = await fetch('/api/subscriptions/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId }),
        })
      } catch {
        showToast('error', '네트워크 오류로 결제사 관리 화면을 열지 못했습니다. 잠시 후 다시 시도해 주세요.')
        setLoading(false)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; code?: string; error?: string }
      if (!res.ok || !data.url) {
        console.error('[portal]', res.status, data.code, data.error)
        showToast('error', portalErrorMessage(data.code))
        setLoading(false)
        return
      }
      // 같은 탭 이동 — 팝업 차단에 걸리지 않고, 결제사 화면에서 상점으로 되돌아올 수 있다.
      // 이동이 시작되므로 loading은 유지한다(중복 클릭 방지).
      window.location.href = data.url
    } catch (err) {
      // 예상 밖 예외도 무안내로 끝나지 않게 한다
      console.error('[portal]', err)
      showToast('error', '결제사 관리 화면을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink border border-rule hover:border-mark/60 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
    >
      {loading && <Loader2 size={11} className="animate-spin" aria-hidden />}
      {loading ? '여는 중…' : '결제수단 변경'}
    </button>
  )
}
