/**
 * @파일: admin/tax/page.tsx
 * @설명: /admin/tax 진입 시 룰 편집 화면으로 이동 — 사이드바 링크의 착지점.
 */

import { redirect } from 'next/navigation'

export default function AdminTaxIndexPage() {
  redirect('/admin/tax/rules')
}
