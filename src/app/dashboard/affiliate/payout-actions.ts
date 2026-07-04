'use server'

/**
 * @파일: dashboard/affiliate/payout-actions.ts
 * @설명: 제휴 정산 계좌 저장 서버 액션 — 본인 profiles 행만 업데이트(RLS '본인 프로필만 수정 가능').
 *        은행은 목록(banks.ts) 내 값만, 계좌번호는 trim·숫자/하이픈 형식으로 정규화·검증한다.
 */

import { createClient } from '@/lib/supabase/server'
import { isValidBank, normalizeAccountNumber } from '@/lib/banks'
import { revalidatePath } from 'next/cache'

/**
 * @함수명: savePayoutAccount
 * @설명: 로그인 사용자의 정산 계좌(은행·계좌번호·예금주)를 저장한다.
 * @매개변수: input - 은행·계좌번호·예금주
 * @반환값: { ok, message } — 성공/실패와 사용자 표시 메시지
 */
export async function savePayoutAccount(input: {
  bank: string
  accountNumber: string
  accountHolder: string
}): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: '로그인이 필요합니다.' }

  const bank = (input.bank ?? '').trim()
  const accountNumber = normalizeAccountNumber(input.accountNumber ?? '')
  const accountHolder = (input.accountHolder ?? '').trim()

  if (!isValidBank(bank)) return { ok: false, message: '은행을 선택해 주세요.' }
  if (accountNumber.replace(/[^0-9]/g, '').length < 6) return { ok: false, message: '올바른 계좌번호를 입력해 주세요.' }
  if (!accountHolder) return { ok: false, message: '예금주를 입력해 주세요.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      payout_bank: bank,
      payout_account_number: accountNumber,
      payout_account_holder: accountHolder,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[savePayoutAccount]', error)
    return { ok: false, message: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  revalidatePath('/dashboard/affiliate')
  return { ok: true, message: '정산 계좌가 저장되었습니다.' }
}
