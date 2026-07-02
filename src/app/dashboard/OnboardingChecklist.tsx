'use client'

/**
 * @컴포넌트: OnboardingChecklist
 * @설명: 결제 후 첫 로그인 회원용 '시작하기' 체크리스트 (다운로드 → 설치 → 인증 → 첫 사용).
 *        - ① 다운로드는 기존 데이터(hasDownloaded=licenses.last_downloaded_version)로 자동 판정.
 *        - ②③④(설치·인증·첫 사용)는 자동 판정이 불가해 수동 체크 + 안내 링크로 제공.
 *        - 수동 체크·닫기 상태는 localStorage에 저장(브라우저 기준, DB/마이그레이션 없음).
 *        - 라이선스가 없거나(구매 전) 닫은 경우 표시하지 않는다.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Check, Download, Package, KeyRound, Rocket, X } from 'lucide-react'

const LS_DISMISS = 'cz_onboarding_dismissed'
const LS_STEPS = 'cz_onboarding_steps'

type ManualSteps = { install: boolean; activate: boolean; firstUse: boolean }
const DEFAULT_STEPS: ManualSteps = { install: false, activate: false, firstUse: false }

interface Item {
  key: string
  label: string
  desc: string
  icon: LucideIcon
  done: boolean
  href?: string
  hrefLabel?: string
  mkey: keyof ManualSteps | null // null = 자동 판정(수동 체크 아님)
}

export default function OnboardingChecklist({
  hasLicense,
  hasDownloaded,
}: {
  hasLicense: boolean
  hasDownloaded: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [steps, setSteps] = useState<ManualSteps>(DEFAULT_STEPS)

  // localStorage에서 닫힘 여부·수동 체크 복원 (SSR 하이드레이션 후)
  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(LS_DISMISS) === '1')
      const raw = localStorage.getItem(LS_STEPS)
      if (raw) setSteps({ ...DEFAULT_STEPS, ...JSON.parse(raw) })
    } catch {
      /* localStorage 접근 불가 시 기본값 유지 */
    }
  }, [])

  function toggle(key: keyof ManualSteps) {
    setSteps((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(LS_STEPS, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(LS_DISMISS, '1') } catch {}
  }

  // 구매 전이거나, 하이드레이션 전이거나, 닫은 경우 표시 안 함
  if (!hasLicense || !mounted || dismissed) return null

  const items: Item[] = [
    { key: 'download', label: '앱 다운로드', desc: '구매한 제품의 설치파일을 내려받으세요.', icon: Download, done: hasDownloaded, href: '/dashboard/licenses', hrefLabel: '다운로드하러 가기', mkey: null },
    { key: 'install',  label: '설치',        desc: '내려받은 설치파일을 실행해 설치하세요.', icon: Package,  done: steps.install,  mkey: 'install' },
    { key: 'activate', label: '라이선스 인증', desc: '앱에 라이선스 키를 입력해 인증하세요.', icon: KeyRound, done: steps.activate, href: '/activate', hrefLabel: '인증 방법 보기', mkey: 'activate' },
    { key: 'firstUse', label: '첫 사용',      desc: '인증이 끝나면 바로 사용할 수 있어요.',   icon: Rocket,   done: steps.firstUse, mkey: 'firstUse' },
  ]

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  return (
    <div className="bg-[#111A2E] border border-[#38BDF8]/20 rounded-xl p-5 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">시작하기</h2>
          <p className="text-xs text-[#E2E8F0] mt-0.5">
            {allDone
              ? '모든 단계를 마쳤어요! 닫아도 됩니다.'
              : `설치부터 첫 사용까지 ${doneCount}/${items.length} 단계 완료`}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-[#94A3B8] hover:text-white transition-colors shrink-0"
          aria-label="체크리스트 닫기"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <div key={it.key} className="flex items-center gap-3 py-2">
              {/* 체크 원 — 수동 단계는 클릭 토글, 자동 단계는 표시만 */}
              <button
                type="button"
                onClick={it.mkey ? () => toggle(it.mkey!) : undefined}
                disabled={!it.mkey}
                aria-pressed={it.done}
                className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  it.done
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'border-[#1E293B] text-transparent'
                } ${it.mkey ? 'cursor-pointer hover:border-[#38BDF8]/50' : 'cursor-default'}`}
              >
                <Check size={13} />
              </button>

              <Icon size={15} className="text-[#E2E8F0] shrink-0" />

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${it.done ? 'text-[#94A3B8] line-through' : 'text-white'}`}>{it.label}</p>
                <p className="text-xs text-[#94A3B8]">{it.desc}</p>
              </div>

              {it.href && (
                <Link href={it.href} className="text-xs text-[#38BDF8] hover:underline shrink-0 whitespace-nowrap">
                  {it.hrefLabel} →
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
