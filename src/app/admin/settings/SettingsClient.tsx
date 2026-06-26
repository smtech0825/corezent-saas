'use client'

/**
 * @컴포넌트: SettingsClient
 * @설명: Admin Settings 페이지 클라이언트 인터랙션
 *        - 섹션별 독립 저장 (fetch → /api/admin/settings)
 *        - 저장 후 페이지 새로고침 없이 즉시 UI 반영
 *        - 저장 성공/실패 인라인 피드백
 */

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

type Settings = Record<string, string>
type Section = 'general' | 'footer' | 'seo' | 'smtp'

const SECTION_KEYS: Record<Section, string[]> = {
  general: ['site_name', 'site_url', 'support_email', 'footer_copyright'],
  footer:  ['footer_info'],
  seo:     ['seo_ga_tracking_id', 'seo_meta_title', 'seo_meta_description', 'seo_meta_keywords'],
  smtp:    ['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'],
}

const INPUT_CLS    = 'w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder-[#475569]'
const TEXTAREA_CLS = 'w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 placeholder-[#475569] resize-y'

// ─── 저장 버튼 (섹션별 로딩·성공 상태 표시) ──────────────────────────────────

function SaveButton({
  section,
  saving,
  saved,
  onSave,
}: {
  section: Section
  saving: Section | null
  saved:  Section | null
  onSave: (s: Section) => void
}) {
  const isLoading = saving === section
  const isSaved   = saved  === section
  return (
    <button
      onClick={() => onSave(section)}
      disabled={isLoading}
      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-[#0B1120] font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {isSaved   && <Check   size={14} />}
      {isLoading ? '저장 중…' : isSaved ? '저장됨!' : '저장'}
    </button>
  )
}

// ─── 레이블 + 인풋 래퍼 ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-[#94A3B8] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── 섹션 카드 래퍼 ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1E293B]">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="text-xs text-[#475569] mt-0.5">{description}</p>
      </div>
      <div className="p-6 space-y-4">{children}</div>
      <div className="px-6 pb-5">{footer}</div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function SettingsClient({ initial }: { initial: Settings }) {
  const [values, setValues] = useState<Settings>(initial)
  const [saving, setSaving] = useState<Section | null>(null)
  const [saved,  setSaved]  = useState<Section | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function saveSection(section: Section) {
    setSaving(section)
    setError(null)

    const body: Settings = {}
    for (const key of SECTION_KEYS[section]) {
      body[key] = values[key] ?? ''
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setSaved(section)
      setTimeout(() => setSaved(null), 3000)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(null)
    }
  }

  const btnProps = { saving, saved, onSave: saveSection }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-sm text-[#94A3B8] mt-1">사이트 전반 설정을 구성합니다.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── General Settings ─────────────────────────────────────────────── */}
      <SectionCard
        title="일반 설정"
        description="기본 사이트 구성"
        footer={<SaveButton section="general" {...btnProps} />}
      >
        <Field label="사이트 이름">
          <input value={values.site_name ?? ''} onChange={(e) => update('site_name', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="사이트 URL">
          <input type="url" value={values.site_url ?? ''} onChange={(e) => update('site_url', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="고객지원 이메일">
          <input type="email" value={values.support_email ?? ''} onChange={(e) => update('support_email', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="푸터 저작권">
          <input value={values.footer_copyright ?? ''} onChange={(e) => update('footer_copyright', e.target.value)} className={INPUT_CLS} />
        </Field>
      </SectionCard>

      {/* ── Footer Information ───────────────────────────────────────────── */}
      <SectionCard
        title="푸터 정보"
        description="사이트 하단에 표시되는 사업자 정보. 줄바꿈(Enter)과 여백이 그대로 반영됩니다."
        footer={<SaveButton section="footer" {...btnProps} />}
      >
        <div>
          <textarea
            value={values.footer_info ?? ''}
            onChange={(e) => update('footer_info', e.target.value)}
            rows={5}
            placeholder={'사업자등록번호: 000-00-00000\n대표: 홍길동\n통신판매업신고: 2024-서울강남-00000\n이메일: support@corezent.com'}
            className={TEXTAREA_CLS}
          />
          <p className="text-xs text-[#475569] mt-1.5">입력한 줄바꿈 그대로 Footer에 출력됩니다.</p>
        </div>
      </SectionCard>

      {/* ── SEO Settings ─────────────────────────────────────────────────── */}
      <SectionCard
        title="SEO 설정"
        description="검색 엔진 최적화 및 분석 설정"
        footer={<SaveButton section="seo" {...btnProps} />}
      >
        <Field label="Google Analytics 추적 ID (UA-1xxxxx) 또는 (G-xxxxxx)">
          <input
            value={values.seo_ga_tracking_id ?? ''}
            onChange={(e) => update('seo_ga_tracking_id', e.target.value)}
            placeholder="G-XXXXXXXXXX"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="메타 제목">
          <input value={values.seo_meta_title ?? ''} onChange={(e) => update('seo_meta_title', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="메타 설명">
          <textarea
            value={values.seo_meta_description ?? ''}
            onChange={(e) => update('seo_meta_description', e.target.value)}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </Field>
        <Field label="메타 키워드">
          <textarea
            value={values.seo_meta_keywords ?? ''}
            onChange={(e) => update('seo_meta_keywords', e.target.value)}
            rows={2}
            placeholder="ChatGPT, AI Writer, AI Image Generator, AI Chat"
            className={TEXTAREA_CLS}
          />
        </Field>
      </SectionCard>

      {/* ── SMTP Settings ────────────────────────────────────────────────── */}
      <SectionCard
        title="SMTP 설정"
        description="이메일 발송 설정"
        footer={<SaveButton section="smtp" {...btnProps} />}
      >
        <Field label="SMTP 호스트">
          <input value={values.smtp_host ?? ''} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.example.com" className={INPUT_CLS} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SMTP 포트">
            <input type="number" value={values.smtp_port ?? ''} onChange={(e) => update('smtp_port', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="암호화">
            <input value={values.smtp_encryption ?? ''} onChange={(e) => update('smtp_encryption', e.target.value)} placeholder="tls / ssl" className={INPUT_CLS} />
          </Field>
        </div>
        <Field label="SMTP 사용자 이름">
          <input value={values.smtp_username ?? ''} onChange={(e) => update('smtp_username', e.target.value)} className={INPUT_CLS} />
        </Field>
        <Field label="SMTP 비밀번호">
          <input type="password" value={values.smtp_password ?? ''} onChange={(e) => update('smtp_password', e.target.value)} placeholder="••••••••" className={INPUT_CLS} />
        </Field>
        <Field label="발신 이메일">
          <input value={values.smtp_from_email ?? ''} onChange={(e) => update('smtp_from_email', e.target.value)} placeholder="no-reply@corezent.com" className={INPUT_CLS} />
        </Field>
        <Field label="발신자 이름">
          <input value={values.smtp_from_name ?? ''} onChange={(e) => update('smtp_from_name', e.target.value)} className={INPUT_CLS} />
        </Field>
      </SectionCard>
    </div>
  )
}
