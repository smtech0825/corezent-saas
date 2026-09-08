'use client'

/**
 * @컴포넌트: OrgProfileSection
 * @설명: 설정 화면「기관 정보 · 세금계산서」구역 — 기관 구매자가 한 번 저장해 두는 정보.
 *        저장된 값은 관리자 사용자 상세에서 세금계산서를 발행할 때 쓴다.
 *        - 전부 선택 입력이다. 개인 구매자는 비워 두면 되고, 빈 값은 null로 저장한다.
 *        - 마이그레이션 068이 아직 적용되지 않은 환경에서는 구역 자체를 그리지 않는다
 *          (손님에게 "칸이 없다"는 오류를 보이는 것보다 낫다. 사유는 브라우저 기록에만 남긴다).
 *        - 사업자등록번호는 검증번호까지 확인한다 — 틀리면 세금계산서가 발행되지 않는다.
 *        ⚠️ 주문에 확정된 기관 정보(orders.org_*)와는 별개다. 여기 값이 주문으로
 *           자동으로 옮겨가지 않는다(068 주석 참고).
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/common/Toast'
import { normalizeBizRegNo, isValidBizRegNo, formatBizRegNo } from '@/lib/bizRegNo'
import { FormField, SubmitButton, inputCls } from './settings-ui'

/** 화면이 다루는 네 칸 — DB 컬럼명과 1:1 (068) */
const COLS = 'org_name, org_biz_reg_no, org_contact_name, tax_invoice_email'

export default function OrgProfileSection() {
  const supabase = createClient()
  const { showToast } = useToast()

  const [available, setAvailable] = useState(false) // 068 적용 여부 — 미적용이면 구역을 감춘다
  const [orgName, setOrgName] = useState('')
  const [bizRegNo, setBizRegNo] = useState('')
  const [contactName, setContactName] = useState('')
  const [taxEmail, setTaxEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('profiles')
        .select(COLS)
        .eq('id', data.user.id)
        .single()
        .then(({ data: row, error }) => {
          if (error) {
            // 컬럼이 없으면 여기로 온다(068 미적용). 구역을 숨기고 조용히 넘어간다.
            console.error('[settings] 기관 정보 조회 실패(마이그레이션 068 미적용 가능):', error.message)
            return
          }
          const p = row as unknown as Record<string, string | null> | null
          setOrgName(p?.org_name ?? '')
          setBizRegNo(formatBizRegNo(p?.org_biz_reg_no))
          setContactName(p?.org_contact_name ?? '')
          setTaxEmail(p?.tax_invoice_email ?? '')
          setAvailable(true)
        })
    })
  }, [supabase])

  /**
   * @함수명: handleSave
   * @설명: 네 칸을 저장합니다. 빈 칸은 null로 지워, 예전 값이 남지 않게 합니다.
   * @매개변수: e - 폼 제출 이벤트
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    // 사업자등록번호는 입력했을 때만 검사한다(선택 입력이므로 비워 두는 것은 정상)
    const digits = normalizeBizRegNo(bizRegNo)
    if (digits && !isValidBizRegNo(digits)) {
      showToast('error', '사업자등록번호를 다시 확인해 주세요. (숫자 10자리)')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({
        org_name:          orgName.trim() || null,
        org_biz_reg_no:    digits || null,
        org_contact_name:  contactName.trim() || null,
        tax_invoice_email: taxEmail.trim() || null,
      })
      .eq('id', user.id)

    if (error) {
      // 원문은 영문이라 화면에 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[settings] 기관 정보 저장 실패:', error.message)
      showToast('error', '기관 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      showToast('success', '기관 정보가 저장되었습니다.')
      setBizRegNo(formatBizRegNo(digits))
    }
    setLoading(false)
  }

  if (!available) return null

  const bizRegNoInvalid = normalizeBizRegNo(bizRegNo).length > 0 && !isValidBizRegNo(bizRegNo)

  return (
    <section className="bg-paper-raised border border-rule rounded-card p-6 mt-6 max-w-2xl">
      <h2 className="text-base font-semibold text-ink mb-1.5">기관 정보 · 세금계산서</h2>
      <p className="text-sm text-ink-soft mb-5">
        기관·회사 이름으로 구매하시는 경우 여기에 한 번 저장해 두시면, 세금계산서를 발행할 때 그대로 사용합니다.
        <br className="hidden sm:block" />
        <span className="text-xs text-ink-faint">개인으로 구매하시면 비워 두셔도 됩니다.</span>
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <FormField label="기관·회사명">
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="○○시청 총무과"
            className={inputCls}
          />
        </FormField>

        <FormField label="사업자등록번호">
          <input
            type="text"
            inputMode="numeric"
            value={bizRegNo}
            onChange={(e) => setBizRegNo(e.target.value)}
            placeholder="000-00-00000"
            className={inputCls}
          />
          {bizRegNoInvalid && (
            <p className="text-xs text-danger mt-1.5">
              숫자 10자리를 확인해 주세요. 번호가 맞지 않으면 세금계산서가 발행되지 않습니다.
            </p>
          )}
        </FormField>

        <FormField label="담당자 이름">
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="구매 담당자"
            className={inputCls}
          />
        </FormField>

        <FormField label="세금계산서 받을 이메일">
          <input
            type="email"
            value={taxEmail}
            onChange={(e) => setTaxEmail(e.target.value)}
            placeholder="회계 담당자 주소를 따로 적으셔도 됩니다"
            className={inputCls}
          />
        </FormField>

        <div className="flex justify-stretch sm:justify-end pt-1">
          <SubmitButton loading={loading} label="기관 정보 저장" />
        </div>
      </form>
    </section>
  )
}
