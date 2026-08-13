'use client'

/**
 * @컴포넌트: SettingsClient
 * @설명: Admin Settings 페이지 클라이언트 인터랙션
 *        - 섹션별 독립 저장 (fetch → /api/admin/settings)
 *        - 저장 후 페이지 새로고침 없이 즉시 UI 반영
 *        - 저장 성공/실패 인라인 피드백
 */

import { useState, useRef, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import SelectField from '@/components/common/SelectField'

type Settings = Record<string, string>
type Section = 'general' | 'footer' | 'seo' | 'smtp' | 'bank' | 'notify' | 'company'

const SECTION_KEYS: Record<Section, string[]> = {
  general: ['site_name', 'site_url', 'support_email', 'footer_copyright'],
  // 조달청 등록번호는 공공 구매담당자가 가장 먼저 찾는 값이라 푸터·기관 도입 페이지에 노출한다.
  // front_settings는 key-value 구조라 컬럼 추가(마이그레이션) 없이 키만 늘리면 된다.
  footer:  ['footer_info', 'procurement_item_number', 'procurement_class_number'],
  seo:     ['seo_ga_tracking_id', 'seo_meta_title', 'seo_meta_description', 'seo_meta_keywords'],
  smtp:    ['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'],
  bank:    ['bank_transfer_enabled', 'bank_transfer_bank', 'bank_transfer_account_number', 'bank_transfer_account_holder'],
  // 관리자 알림 켬/끔 — lib/admin-notify.ts가 읽는다. 미설정은 켜짐(값이 'false'일 때만 끔).
  notify:  ['notify_new_order', 'notify_new_ticket'],
  // 견적서 공급자 정보 — 견적서 PDF에 그대로 인쇄된다. 푸터 정보와 별개(서로 영향 없음).
  // 하나라도 비면 견적서 발급이 차단된다(빈칸 있는 견적서 방지).
  company: ['company_name', 'company_biz_no', 'company_ceo', 'company_address', 'company_biz_type', 'company_biz_item', 'company_phone'],
}

const INPUT_CLS    = 'w-full bg-paper border border-rule text-ink text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-mark placeholder:text-ink-faint'
const TEXTAREA_CLS = 'w-full bg-paper border border-rule text-ink text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-mark placeholder:text-ink-faint resize-y'

/**
 * @함수명: displayValue
 * @설명: 화면 표시용 정규화 — 계좌이체 사용 여부는 미설정('')도 '비활성(false)'으로 보여준다.
 *        표시와 "저장 안 됨" 판정이 같은 규칙을 쓰도록 한 곳에 둔다. 서로 다르면
 *        활성↔비활성을 오갔다가 되돌려도 배지가 남는 오탐이 생긴다(검증에서 발견).
 * @매개변수: key - 설정 키 / value - 원본 값
 * @반환값: 화면·판정이 함께 쓰는 값
 */
function displayValue(key: string, value: string): string {
  if (key === 'bank_transfer_enabled') return value === 'true' ? 'true' : 'false'
  // 알림 스위치는 기본이 켜짐 — 미설정('')도 '켜짐(true)'으로 보여준다(admin-notify와 같은 규칙).
  if (key === 'notify_new_order' || key === 'notify_new_ticket') return value === 'false' ? 'false' : 'true'
  return value
}

/**
 * @함수명: sectionDirty
 * @설명: 카드의 현재 입력값이 마지막으로 저장된 값과 다른지 판정합니다.
 *        저장 안 한 변경이 있는 카드에 "저장 안 됨" 표시를 띄우는 유일한 기준이며,
 *        값을 넣어 검증할 수 있게 컴포넌트 밖의 순수 함수로 둡니다.
 *        비교는 화면 표시와 같은 정규화(displayValue)를 거친다.
 * @매개변수: keys - 카드가 저장하는 키 목록 / values - 현재 입력값 / saved - 마지막 저장값
 * @반환값: 하나라도 다르면 true
 */
function sectionDirty(keys: string[], values: Settings, saved: Settings): boolean {
  return keys.some(
    (key) => displayValue(key, values[key] ?? '') !== displayValue(key, saved[key] ?? ''),
  )
}

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
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-mark hover:brightness-95 disabled:opacity-60 text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-xl transition-colors"
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
      <label className="block text-sm text-ink-soft mb-1.5">{label}</label>
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
  dirty,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
  /** 저장 안 한 변경이 있으면 헤더에 "저장 안 됨" 표시 */
  dirty?: boolean
}) {
  return (
    <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
      <div className="px-6 py-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="text-xs text-ink-faint mt-0.5">{description}</p>
        </div>
        {dirty && (
          <span className="shrink-0 text-[10px] font-semibold text-caution bg-caution-soft border border-caution/20 px-2 py-0.5 rounded-full">
            저장 안 됨
          </span>
        )}
      </div>
      <div className="p-6 space-y-4">{children}</div>
      <div className="px-6 pb-5">{footer}</div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function SettingsClient({ initial }: { initial: Settings }) {
  const [values, setValues] = useState<Settings>(initial)
  // 마지막으로 저장된 값 — "저장 안 됨" 판정의 비교 기준. 저장 성공 시 갱신된다.
  const [savedValues, setSavedValues] = useState<Settings>(initial)
  const [saving, setSaving] = useState<Section | null>(null)
  const [saved,  setSaved]  = useState<Section | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  // "저장됨" 표시를 되돌리는 예약. 다시 저장하면 이전 예약을 취소하고, 화면을 떠날 때도 정리한다.
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (savedResetRef.current) clearTimeout(savedResetRef.current) }, [])

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
      // 저장 성공 → 이 카드의 비교 기준을 방금 저장한 값으로 갱신("저장 안 됨" 표시 해제)
      setSavedValues((prev) => ({ ...prev, ...body }))
      if (savedResetRef.current) clearTimeout(savedResetRef.current)
      savedResetRef.current = setTimeout(() => setSaved(null), 3000)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(null)
    }
  }

  const btnProps = { saving, saved, onSave: saveSection }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">설정</h1>
        <p className="text-sm text-ink-soft mt-1">사이트 전반 설정을 구성합니다.</p>
      </div>

      {error && (
        <div className="bg-danger-soft border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* 넓은 화면에서 가로폭을 활용하도록 섹션 카드를 2열 그리드로 배치 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* ── General Settings ─────────────────────────────────────────────── */}
      <SectionCard
        title="일반 설정"
        dirty={sectionDirty(SECTION_KEYS['general'], values, savedValues)}
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
        dirty={sectionDirty(SECTION_KEYS['footer'], values, savedValues)}
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
          <p className="text-xs text-ink-faint mt-1.5">입력한 줄바꿈 그대로 Footer에 출력됩니다.</p>
        </div>

        <Field label="조달청 물품식별번호">
          <input
            value={values.procurement_item_number ?? ''}
            onChange={(e) => update('procurement_item_number', e.target.value)}
            placeholder="예: 26391406"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="조달청 물품분류번호">
          <input
            value={values.procurement_class_number ?? ''}
            onChange={(e) => update('procurement_class_number', e.target.value)}
            placeholder="예: 43232698"
            className={INPUT_CLS}
          />
        </Field>
        <p className="text-xs text-ink-faint">
          입력하면 푸터와 기관 도입 페이지에 표시됩니다. 비워 두면 그 줄이 아예 나오지 않습니다.
        </p>
      </SectionCard>

      {/* ── SEO Settings ─────────────────────────────────────────────────── */}
      <SectionCard
        title="SEO 설정"
        dirty={sectionDirty(SECTION_KEYS['seo'], values, savedValues)}
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

      {/* ── 계좌이체(무통장 입금) 설정 ──────────────────────────────────── */}
      <SectionCard
        title="계좌이체(무통장 입금)"
        dirty={sectionDirty(SECTION_KEYS['bank'], values, savedValues)}
        description="상품 상세 페이지 결제방법에 '계좌이체'를 노출합니다. 활성화하려면 계좌번호까지 입력하세요."
        footer={<SaveButton section="bank" {...btnProps} />}
      >
        <Field label="계좌이체 결제 사용">
          <SelectField
            size="md"
            value={displayValue('bank_transfer_enabled', values.bank_transfer_enabled ?? '')}
            onChange={(e) => update('bank_transfer_enabled', e.target.value)}
          >
            <option value="false">비활성</option>
            <option value="true">활성</option>
          </SelectField>
        </Field>
        <Field label="은행">
          <input value={values.bank_transfer_bank ?? ''} onChange={(e) => update('bank_transfer_bank', e.target.value)} placeholder="예: 국민은행" className={INPUT_CLS} />
        </Field>
        <Field label="계좌번호">
          <input value={values.bank_transfer_account_number ?? ''} onChange={(e) => update('bank_transfer_account_number', e.target.value)} placeholder="예: 123456-01-234567" className={INPUT_CLS} />
        </Field>
        <Field label="예금주">
          <input value={values.bank_transfer_account_holder ?? ''} onChange={(e) => update('bank_transfer_account_holder', e.target.value)} placeholder="예: 홍길동" className={INPUT_CLS} />
        </Field>
        <p className="text-xs text-ink-faint">
          계좌이체는 자동 갱신이 없어 <b className="text-ink-soft">1회 결제</b>로 기록됩니다. 입금 확인은 <b className="text-ink-soft">주문</b> 화면에서 [결제 확인]으로 처리하며, 라이선스는 수동 발송해야 합니다.
        </p>
      </SectionCard>

      {/* ── 관리자 알림 설정 ─────────────────────────────────────────────── */}
      <SectionCard
        title="관리자 알림"
        dirty={sectionDirty(SECTION_KEYS['notify'], values, savedValues)}
        description="새 주문·새 고객지원 티켓이 생기면 지원 이메일로 알림 메일을 보냅니다. 기본은 모두 켜짐입니다."
        footer={<SaveButton section="notify" {...btnProps} />}
      >
        <Field label="새 주문 알림 (카드·계좌이체)">
          <SelectField
            size="md"
            value={displayValue('notify_new_order', values.notify_new_order ?? '')}
            onChange={(e) => update('notify_new_order', e.target.value)}
          >
            <option value="true">켜짐</option>
            <option value="false">꺼짐</option>
          </SelectField>
        </Field>
        <Field label="새 고객지원 티켓 알림">
          <SelectField
            size="md"
            value={displayValue('notify_new_ticket', values.notify_new_ticket ?? '')}
            onChange={(e) => update('notify_new_ticket', e.target.value)}
          >
            <option value="true">켜짐</option>
            <option value="false">꺼짐</option>
          </SelectField>
        </Field>
        <p className="text-xs text-ink-faint">
          받는 주소는 <b className="text-ink-soft">일반 설정의 고객지원 이메일</b>입니다. 주소가 비어 있으면 알림을 건너뛰고 모니터링 로그에 남깁니다. 새 문의 알림은 별도 스위치 없이 항상 발송됩니다(스팸은 자동 차단).
        </p>
      </SectionCard>

      {/* ── 견적서 공급자 정보 ───────────────────────────────────────────── */}
      <SectionCard
        title="견적서 공급자 정보"
        dirty={sectionDirty(SECTION_KEYS['company'], values, savedValues)}
        description="견적서 PDF의 공급자 칸에 그대로 인쇄됩니다. 푸터 정보와 별개이며, 하나라도 비면 견적서 발급이 막힙니다."
        footer={<SaveButton section="company" {...btnProps} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="상호(법인명)">
            <input value={values.company_name ?? ''} onChange={(e) => update('company_name', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="사업자등록번호">
            <input value={values.company_biz_no ?? ''} onChange={(e) => update('company_biz_no', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="대표자">
            <input value={values.company_ceo ?? ''} onChange={(e) => update('company_ceo', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="전화번호">
            <input value={values.company_phone ?? ''} onChange={(e) => update('company_phone', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="업태">
            <input value={values.company_biz_type ?? ''} onChange={(e) => update('company_biz_type', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="종목">
            <input value={values.company_biz_item ?? ''} onChange={(e) => update('company_biz_item', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
        <Field label="주소">
          <input value={values.company_address ?? ''} onChange={(e) => update('company_address', e.target.value)} className={INPUT_CLS} />
        </Field>
      </SectionCard>

      {/* ── SMTP Settings ────────────────────────────────────────────────── */}
      <SectionCard
        title="SMTP 설정"
        dirty={sectionDirty(SECTION_KEYS['smtp'], values, savedValues)}
        description="이메일 발송 설정"
        footer={<SaveButton section="smtp" {...btnProps} />}
      >
        <Field label="SMTP 호스트">
          <input value={values.smtp_host ?? ''} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.example.com" className={INPUT_CLS} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* ── 할인코드 안내 (정적) — 생성·관리는 Lemon Squeezy 대시보드에서 ──── */}
      <div className="border border-rule bg-paper-raised rounded-card overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">할인코드 (Lemon Squeezy)</h2>
          <p className="text-xs text-ink-faint mt-0.5">결제는 LS가 처리하므로 할인코드도 LS 대시보드에서 생성·관리합니다.</p>
        </div>
        <div className="p-6 space-y-3 text-sm text-ink-soft leading-relaxed">
          <p>
            LS 대시보드 → <strong className="text-ink">Store → Discounts</strong>에서 코드를 만들면
            (정률/정액, 적용 상품, 사용 횟수·기간 제한 설정 가능) 구매자가 요금제 페이지의
            할인코드 입력칸 또는 결제 화면에서 바로 사용할 수 있습니다.
          </p>
          <p className="text-xs text-ink-faint">
            마케팅 링크로 자동 적용하려면: <code className="font-mono text-mark">corezent.com/pricing?discount=코드</code>
          </p>
          <a
            href="https://app.lemonsqueezy.com/discounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-mark hover:underline font-medium"
          >
            LS 할인코드 관리 열기 ↗
          </a>
        </div>
      </div>
      </div>
    </div>
  )
}
