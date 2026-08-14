'use client'

/**
 * @컴포넌트: PlanUpgradeButton
 * @설명: 플랜 올리기 버튼 — 더 큰 옵션(후보는 서버가 산출해 내려줌)을 골라
 *        결제사에 변경을 요청한다(/api/subscriptions/change-plan).
 *        ★ 금액은 표시하지 않는다 — 결제사에 변경 전 청구액을 알려주는 API가 없어,
 *        차액·청구 시점은 결제사가 정산해 청구서로 안내된다는 사실을 문구로 알린다.
 *        ★ 라이선스 대수는 이 화면에서 바뀌지 않는다 — 결제사 통지(웹훅)가 반영한다.
 *        중복 클릭은 진행 중 잠금(pending)과 서버의 ALREADY_ON_PLAN 게이트가 막는다.
 *        후보가 없으면(이미 가장 큰 플랜) 부모가 이 버튼을 렌더하지 않는다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowUpCircle } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

/** 서버(billing/page.tsx)가 산출해 내려주는 상위 옵션 후보 */
export interface UpgradeOption {
  priceId: string
  label: string
}

/**
 * @함수명: changePlanErrorMessage
 * @설명: 플랜 변경 실패 code를 사용자 안내 문구로 바꿉니다(자매 라우트들과 같은 관례).
 * @매개변수: code - API가 돌려준 실패 코드
 * @반환값: 화면에 그대로 보여줄 한국어 문구
 */
function changePlanErrorMessage(code?: string): string {
  switch (code) {
    case 'NOT_ACTIVE':
      return '활성 상태의 구독만 플랜을 바꿀 수 있습니다. 화면을 새로고침해 주세요.'
    case 'ALREADY_ON_PLAN':
      return '이미 그 플랜을 쓰고 계십니다. 화면을 새로고침해 주세요.'
    case 'NOT_UPGRADE':
    case 'DIFFERENT_PRODUCT':
    case 'DIFFERENT_CYCLE':
      return '선택하신 옵션으로는 바꿀 수 없습니다. 새로고침 후 다시 선택해 주세요.'
    case 'NO_LS_SUBSCRIPTION':
    case 'LS_NOT_FOUND':
      return '이 구독은 자동 플랜 변경이 지원되지 않습니다. 고객지원으로 문의해 주세요.'
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
    default:
      return '플랜 변경 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  }
}

export default function PlanUpgradeButton({ subscriptionId, currentLabel, options }: {
  subscriptionId: string
  /** 지금 쓰는 옵션 라벨(모달 안내용) */
  currentLabel: string
  /** 올릴 수 있는 상위 옵션 목록(서버 산출 — 비면 부모가 버튼을 숨김) */
  options: UpgradeOption[]
}) {
  const { showToast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  /**
   * @함수명: handleConfirm
   * @설명: 선택한 상위 옵션으로의 변경을 서버에 요청합니다. 진행 중 재클릭은 잠깁니다.
   * @반환값: 없음(결과는 모달 안 상태·토스트로 표시)
   */
  async function handleConfirm(): Promise<void> {
    if (pending || !selected) return
    setPending(true)
    try {
      let res: Response
      try {
        res = await fetch('/api/subscriptions/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId, newPriceId: selected }),
        })
      } catch {
        showToast('error', '네트워크 오류로 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !data.ok) {
        console.error('[change-plan]', res.status, data.code, data.error)
        showToast('error', changePlanErrorMessage(data.code))
        return
      }
      setDone(true)
    } finally {
      setPending(false)
    }
  }

  /**
   * @함수명: closeModal
   * @설명: 모달을 닫고 선택 상태를 초기화합니다(진행 중에는 닫히지 않음).
   *        요청을 마친 뒤 닫을 때는 화면 데이터를 다시 받아 반영 여부를 보여줍니다.
   */
  function closeModal(): void {
    if (pending) return
    const wasDone = done
    setOpen(false)
    setSelected('')
    setDone(false)
    if (wasDone) router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-mark hover:text-ink border border-mark/40 hover:border-mark/60 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        <ArrowUpCircle size={11} aria-hidden />
        플랜 올리기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-paper-raised border border-rule rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            {!done ? (
              <>
                <h3 className="text-sm font-semibold text-ink mb-1.5">플랜 올리기</h3>
                <p className="text-sm text-ink-soft mb-4">
                  지금 플랜: <b className="text-ink">{currentLabel || '—'}</b>
                </p>

                <div className="space-y-2 mb-4">
                  {options.map((o) => (
                    <label key={o.priceId} className="flex items-center gap-2.5 border border-rule rounded-lg px-4 py-2.5 cursor-pointer hover:border-mark/40 transition-colors">
                      <input
                        type="radio"
                        name="upgrade-option"
                        value={o.priceId}
                        checked={selected === o.priceId}
                        onChange={() => setSelected(o.priceId)}
                        className="accent-mark"
                      />
                      <span className="text-sm text-ink">{o.label}</span>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-ink-faint leading-relaxed mb-1.5">
                  차액과 청구 시점은 결제사(Lemon Squeezy)가 정산해 청구서로 안내합니다 —
                  이 화면에는 금액이 표시되지 않습니다.
                </p>
                <p className="text-xs text-ink-faint leading-relaxed mb-5">
                  사용 PC 대수는 결제사의 변경 통지를 받은 뒤 바뀝니다. 보통 곧 반영되지만
                  즉시가 아닐 수 있습니다.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={pending}
                    className="flex-1 px-4 py-2.5 text-sm text-ink-soft border border-rule rounded-xl hover:bg-paper-shade transition-colors disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={pending || !selected}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-mark hover:brightness-95 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    {pending ? '요청 중…' : '변경 요청'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-ink mb-2">요청이 접수되었습니다</h3>
                <p className="text-sm text-ink-soft leading-relaxed mb-5">
                  결제사가 변경을 확정하면 사용 PC 대수가 자동으로 바뀝니다.
                  잠시 후 이 화면을 새로고침해 확인해 주세요. 차액은 결제사 청구서에서
                  확인하실 수 있습니다.
                </p>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-mark hover:brightness-95 rounded-xl transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
