/**
 * @파일: dashboard/licenses/page.tsx
 * @설명: 라이선스 목록 — 시리얼 키, 상태, 활성화 정보
 */

import { createClient } from '@/lib/supabase/server'
import { Key, Copy } from 'lucide-react'
import LicenseCopyButton from '../_components/LicenseCopyButton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My Licenses — CoreZent',
}

export default async function LicensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: licenses } = await supabase
    .from('licenses')
    .select(`
      id, serial_key, status, expires_at, created_at,
      products(name, slug)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Licenses</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Manage your product license keys.</p>
      </div>

      {licenses && licenses.length > 0 ? (
        <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="hidden md:grid grid-cols-[1fr_160px_140px_140px] gap-4 px-5 py-3 border-b border-[#1E293B] text-xs text-[#475569] font-medium">
            <span>License Key</span>
            <span>Product</span>
            <span>Status</span>
            <span>Expires</span>
          </div>

          {/* 라이선스 목록 */}
          {licenses.map((lic: any) => (
            <div
              key={lic.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_140px] gap-2 md:gap-4 items-center px-5 py-4 border-b border-[#1E293B] last:border-0 hover:bg-[#1E293B]/20 transition-colors"
            >
              {/* 시리얼 키 */}
              <div className="flex items-center gap-2">
                <Key size={14} className="text-[#38BDF8] shrink-0 hidden md:block" />
                <span className="font-mono text-sm text-white tracking-wider truncate">
                  {lic.serial_key}
                </span>
                <LicenseCopyButton serialKey={lic.serial_key} />
              </div>

              {/* 제품명 */}
              <div className="md:block">
                <span className="text-sm text-[#94A3B8]">{(lic as any).products?.name ?? '—'}</span>
              </div>

              {/* 상태 */}
              <div>
                <LicenseStatusBadge status={lic.status} />
              </div>

              {/* 만료일 / 상태 */}
              <div>
                {lic.status === 'active' ? (
                  <span className="text-sm text-emerald-400 font-medium">Active</span>
                ) : lic.status === 'revoked' || lic.status === 'expired' ? (
                  <span className="text-sm text-[#94A3B8]">Cancelled</span>
                ) : lic.expires_at ? (
                  <span className="text-sm text-[#94A3B8]">
                    {new Date(lic.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : (
                  <span className="text-sm text-[#475569]">Lifetime</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111A2E] border border-[#1E293B] rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
            <Key size={22} className="text-[#475569]" />
          </div>
          <p className="text-white font-medium mb-1">No licenses yet</p>
          <p className="text-sm text-[#475569] mb-4">Purchase a product to receive your license key.</p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm text-[#38BDF8] hover:underline"
          >
            Browse products →
          </a>
        </div>
      )}
    </div>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Active',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    inactive: { label: 'Inactive', cls: 'text-[#94A3B8] bg-[#1E293B] border-[#1E293B]' },
    expired:  { label: 'Expired',  cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    revoked:  { label: 'Revoked',  cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }
  const { label, cls } = map[status] ?? map.inactive
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  )
}
