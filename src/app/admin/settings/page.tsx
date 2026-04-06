/**
 * @파일: admin/settings/page.tsx
 * @설명: 사이트 설정 관리 — General, Affiliate, SMTP 설정
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

async function saveSettings(formData: FormData) {
  'use server'
  const adminClient = createAdminClient()
  const entries = Array.from(formData.entries()) as [string, string][]
  await Promise.all(
    entries
      .filter(([key]) => key !== 'category')
      .map(([key, value]) =>
        adminClient
          .from('front_settings')
          .upsert({ key, value }, { onConflict: 'key' })
      )
  )
  revalidatePath('/admin/settings')
}

export default async function SettingsPage() {
  const adminClient = createAdminClient()

  const { data: rows } = await adminClient
    .from('front_settings')
    .select('key, value, category, label, type')

  const settingsMap = new Map((rows ?? []).map((r) => [r.key, r.value ?? '']))

  function get(key: string, fallback = '') {
    return settingsMap.get(key) ?? fallback
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Configure site-wide settings.</p>
      </div>

      {/* General 설정 */}
      <form action={saveSettings} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold text-white">General Settings</h2>
          <p className="text-xs text-[#475569] mt-0.5">Basic site configuration</p>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Site Name" name="site_name" value={get('site_name', 'CoreZent')} />
          <Field label="Site URL" name="site_url" value={get('site_url', 'https://corezent.com')} type="url" />
          <Field label="Support Email" name="support_email" value={get('support_email', 'support@corezent.com')} type="email" />
          <Field label="Footer Copyright" name="footer_copyright" value={get('footer_copyright', '© 2025 CoreZent. All rights reserved.')} />
        </div>
        <div className="px-6 pb-5">
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Save General Settings
          </button>
        </div>
      </form>

      {/* Affiliate 설정 */}
      <form action={saveSettings} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold text-white">Affiliate Settings</h2>
          <p className="text-xs text-[#475569] mt-0.5">Affiliate commission and withdrawal settings</p>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Commission Rate (%)" name="affiliate_commission_rate" value={get('affiliate_commission_rate', '20')} type="number" />
          <Field label="Minimum Withdrawal ($)" name="affiliate_min_withdrawal" value={get('affiliate_min_withdrawal', '50')} type="number" />
        </div>
        <div className="px-6 pb-5">
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Save Affiliate Settings
          </button>
        </div>
      </form>

      {/* SMTP 설정 */}
      <form action={saveSettings} className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold text-white">SMTP Settings</h2>
          <p className="text-xs text-[#475569] mt-0.5">Email delivery configuration</p>
        </div>
        <div className="p-6 space-y-4">
          <Field label="SMTP Host" name="smtp_host" value={get('smtp_host')} placeholder="smtp.example.com" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="SMTP Port" name="smtp_port" value={get('smtp_port', '587')} type="number" />
            <Field label="Encryption" name="smtp_encryption" value={get('smtp_encryption', 'tls')} placeholder="tls / ssl" />
          </div>
          <Field label="SMTP Username" name="smtp_username" value={get('smtp_username')} />
          <Field label="SMTP Password" name="smtp_password" value={get('smtp_password')} type="password" placeholder="••••••••" />
          <Field label="From Email" name="smtp_from_email" value={get('smtp_from_email')} placeholder="no-reply@corezent.com" />
          <Field label="From Name" name="smtp_from_name" value={get('smtp_from_name', 'CoreZent')} />
        </div>
        <div className="px-6 pb-5">
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Save SMTP Settings
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  value,
  type = 'text',
  placeholder,
}: {
  label: string
  name: string
  value: string
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-[#94A3B8] mb-1.5">{label}</label>
      <input
        name={name}
        defaultValue={value}
        type={type}
        placeholder={placeholder}
        className="w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder-[#475569]"
      />
    </div>
  )
}
