'use client'

/**
 * @컴포넌트: ProductForm
 * @설명: 제품 추가/수정 폼 — 제품 정보 + 가격 플랜 관리
 *        Logo: URL 직접 입력 또는 파일 업로드 (상호 배타적)
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Tag, Sparkles, LayoutGrid, Image as ImageIcon, HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validateOptionRows } from '@/lib/product-validation'

export interface PriceEntry {
  id?: string
  type: 'subscription' | 'one_time'
  interval: 'monthly' | 'annual' | ''
  price: string
  lemon_squeezy_variant_id: string
  checkout_url: string
  // v2 옵션 행 — 각 행이 하나의 옵션 조합(라벨·라이선스 tier)
  option_axis1_label: string   // 축1 값 (예: 월간)
  option_axis2_label: string   // 축2 값 (예: 3PC용 · 축 1개면 비움)
  license_tier: string         // 라이선스 tier (1pc/3pc/5pc/10pc/lite/pro/max · 비면 slug fallback)
  sort_order: string           // 표시 순서 번호 (오름차순 · 041 컬럼). 작을수록 먼저
}

export interface ProductFeatureEntry {
  icon: string
  image_url: string
  title: string
  description: string
}

export interface ProductFaqEntry {
  question: string
  answer: string
}

export interface ProductFormData {
  name: string
  slug: string
  tagline: string
  description: string
  category: string
  category_group: string
  // 옵션 축 제목 (v2 — 공개 카드 드롭다운 제목). 옵션 값·가격·tier는 prices 각 행에 있다.
  option_axis1_name: string
  option_axis2_name: string
  badge_text: string
  badge_color: 'blue' | 'green' | 'yellow'
  logo_url: string
  manual_url: string
  is_active: boolean
  tags: string[]
  pricing_features: string[]
  product_features: ProductFeatureEntry[]
  hero_image_url: string
  screenshots: string[]
  system_requirements: string
  version_info_url: string
  faqs: ProductFaqEntry[]
  prices: PriceEntry[]
}

interface Props {
  initialData?: ProductFormData
  onSubmit: (data: ProductFormData) => Promise<{ error?: string }>
  submitLabel: string
}

const emptyPrice = (): PriceEntry => ({ type: 'subscription', interval: 'monthly', price: '', lemon_squeezy_variant_id: '', checkout_url: '', option_axis1_label: '', option_axis2_label: '', license_tier: '', sort_order: '' })

/** Feature 이미지 업로드 컴포넌트 — 파일 업로드 → Supabase Storage logos 버킷 */
function FeatureImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const filename = `feat-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(filename, file, { upsert: true })
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(data.path)
    onChange(publicUrl)
    setUploading(false)
  }

  function clear() {
    onChange('')
    if (fileRef.current) fileRef.current.value = ''
    setError('')
  }

  return (
    <div className="space-y-1">
      {value ? (
        <div className="flex items-center gap-2 p-2 bg-paper-raised rounded-lg border border-rule">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="feature preview" className="w-8 h-8 object-contain rounded shrink-0" />
          <span className="text-xs text-ink-faint truncate flex-1">{value.split('/').pop()}</span>
          <button type="button" onClick={clear} className="shrink-0 text-ink-faint hover:text-danger transition-colors">
            <X size={12} />
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-colors w-full ${
            uploading
              ? 'opacity-40 cursor-not-allowed border-rule text-ink-faint'
              : 'cursor-pointer border-rule text-ink-soft hover:text-ink hover:border-mark/40'
          }`}
        >
          <Upload size={11} />
          {uploading ? '업로드 중...' : '이미지 업로드 (투명 PNG)'}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-ink-soft uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-paper border border-rule text-ink text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-mark placeholder:text-ink-faint'
const selectCls = `${inputCls} cursor-pointer`

export default function ProductForm({ initialData, onSubmit, submitLabel }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugManual, setSlugManual] = useState(!!initialData?.slug)

  // URL 직접 입력 vs 파일 업로드 모드 (상호 배타적)
  const [logoMode, setLogoMode] = useState<'url' | 'file' | null>(
    initialData?.logo_url ? 'url' : null
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [form, setForm] = useState<ProductFormData>(
    initialData ?? {
      name: '',
      slug: '',
      tagline: '',
      description: '',
      category: 'desktop',
      category_group: '',
      option_axis1_name: '',
      option_axis2_name: '',
      badge_text: '',
      badge_color: 'blue',
      logo_url: '',
      manual_url: '',
      is_active: true,
      tags: [],
      pricing_features: [],
      product_features: [],
      hero_image_url: '',
      screenshots: [],
      system_requirements: '',
      version_info_url: '',
      faqs: [],
      prices: [emptyPrice()],
    }
  )

  function set(key: keyof ProductFormData, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    set('name', name)
    if (!slugManual) set('slug', slugify(name))
  }

  // Logo URL 직접 입력
  function handleLogoUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    set('logo_url', val)
    setLogoMode(val ? 'url' : null)
    setUploadError('')
  }

  // Logo 파일 업로드 → Supabase Storage
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(filename, file, { upsert: true })

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(data.path)

    set('logo_url', publicUrl)
    setLogoMode('file')
    setUploading(false)
  }

  // Logo 초기화
  function clearLogo() {
    set('logo_url', '')
    setLogoMode(null)
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addPrice() {
    // 새 옵션엔 다음 순서 번호를 자동 부여(기존 최대 + 1) — 관리자는 번호만 바꿔 순서 조정
    const nextOrder = form.prices.reduce((m, p) => Math.max(m, parseInt(p.sort_order || '0', 10) || 0), 0) + 1
    set('prices', [...form.prices, { ...emptyPrice(), sort_order: String(nextOrder) }])
  }

  function removePrice(idx: number) {
    set('prices', form.prices.filter((_, i) => i !== idx))
  }

  function updatePrice(idx: number, key: keyof PriceEntry, value: string) {
    const updated = form.prices.map((p, i) => {
      if (i !== idx) return p
      const next: PriceEntry = { ...p, [key]: value }
      if (key === 'type' && value === 'one_time') next.interval = ''
      if (key === 'type' && value === 'subscription' && !next.interval) next.interval = 'monthly'
      return next
    })
    set('prices', updated)
  }

  // 스크린샷(복수) 배열 조작
  function addScreenshot() {
    set('screenshots', [...form.screenshots, ''])
  }
  function updateScreenshot(idx: number, url: string) {
    set('screenshots', form.screenshots.map((s, i) => (i === idx ? url : s)))
  }
  function removeScreenshot(idx: number) {
    set('screenshots', form.screenshots.filter((_, i) => i !== idx))
  }

  // 상품 FAQ 배열 조작
  function addFaq() {
    set('faqs', [...form.faqs, { question: '', answer: '' }])
  }
  function updateFaq(idx: number, key: 'question' | 'answer', value: string) {
    set('faqs', form.faqs.map((f, i) => (i === idx ? { ...f, [key]: value } : f)))
  }
  function removeFaq(idx: number) {
    set('faqs', form.faqs.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // 저장 전 옵션 행 검증(서버 액션과 동일 규칙) — 어긋난 조합/중복을 저장 전에 차단
    const invalid = validateOptionRows(form.prices)
    if (invalid) {
      setError(invalid)
      return
    }
    setLoading(true)
    const result = await onSubmit(form)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/admin/products')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 기본 정보 */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-ink">기본 정보</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="제품 이름 *">
            <input
              required
              value={form.name}
              onChange={handleNameChange}
              placeholder="예: GeniePost"
              className={inputCls}
            />
          </Field>

          <Field label="Slug *">
            <input
              required
              value={form.slug}
              onChange={(e) => { setSlugManual(true); set('slug', e.target.value) }}
              placeholder="예: geniepost"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="태그라인">
          <input
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder="한 줄 소개 문구"
            className={inputCls}
          />
        </Field>

        <Field label="설명 (Markdown)">
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="제품 전체 설명..."
            className={inputCls + ' resize-none'}
          />
        </Field>

        <Field label="카테고리">
          <input
            value={form.category_group}
            onChange={(e) => set('category_group', e.target.value)}
            placeholder="예: 행정, 투자, 마케팅 (공개 목록 분류·필터용, 자유 입력)"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="플랫폼 유형 *">
            <select
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={selectCls}
            >
              <option value="desktop">데스크톱</option>
              <option value="web">웹</option>
              <option value="chrome-extension">크롬 익스텐션</option>
            </select>
          </Field>

          <Field label="상태">
            <select
              value={form.is_active ? 'true' : 'false'}
              onChange={(e) => set('is_active', e.target.value === 'true')}
              className={selectCls}
            >
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </Field>
        </div>

        {/* Badge — 색상 선택 + 텍스트 입력 */}
        <Field label="뱃지">
          <div className="space-y-2.5">
            {/* 색상 선택 */}
            <div className="flex items-center gap-2">
              {([
                { value: 'blue',   hex: '#38BDF8', label: '파랑' },
                { value: 'green',  hex: '#34D399', label: '초록' },
                { value: 'yellow', hex: '#FBBF24', label: '노랑' },
              ] as const).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set('badge_color', c.value)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    form.badge_color === c.value
                      ? ''
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    color: c.hex,
                    backgroundColor: `${c.hex}15`,
                    borderColor: form.badge_color === c.value ? c.hex : `${c.hex}30`,
                    ...(form.badge_color === c.value
                      ? { boxShadow: `0 0 0 2px ${c.hex}40` }
                      : {}),
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  {c.label}
                </button>
              ))}
            </div>
            {/* 텍스트 입력 */}
            <div className="flex items-center gap-2">
              <input
                value={form.badge_text}
                onChange={(e) => set('badge_text', e.target.value)}
                placeholder='예: 지금 사용 가능, 출시 예정, 베타 (비우면 뱃지 숨김)'
                maxLength={30}
                className={inputCls}
              />
              {form.badge_text && (
                <button
                  type="button"
                  onClick={() => set('badge_text', '')}
                  className="shrink-0 p-2 text-ink-faint hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {/* 미리보기 */}
            {form.badge_text && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-ink-faint">미리보기:</span>
                <span
                  className="inline-flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs font-semibold"
                  style={{
                    color: { blue: '#38BDF8', green: '#34D399', yellow: '#FBBF24' }[form.badge_color],
                    backgroundColor: `${{ blue: '#38BDF8', green: '#34D399', yellow: '#FBBF24' }[form.badge_color]}15`,
                    borderColor: `${{ blue: '#38BDF8', green: '#34D399', yellow: '#FBBF24' }[form.badge_color]}30`,
                  }}
                >
                  <Sparkles size={11} />
                  {form.badge_text}
                </span>
              </div>
            )}
          </div>
        </Field>

        {/* Logo — URL 입력 또는 파일 업로드 */}
        <Field label="로고">
          <div className="space-y-2">
            {/* URL 입력 */}
            <div className="flex items-center gap-2">
              <input
                value={form.logo_url}
                onChange={handleLogoUrlChange}
                readOnly={logoMode === 'file'}
                placeholder={logoMode === 'file' ? '파일 업로드됨' : 'https://...'}
                className={
                  inputCls +
                  (logoMode === 'file' ? ' opacity-50 cursor-not-allowed select-none' : '')
                }
              />
              {logoMode && (
                <button
                  type="button"
                  onClick={clearLogo}
                  title="초기화"
                  className="shrink-0 p-2 text-ink-faint hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* 파일 업로드 버튼 */}
            <div className="flex items-center gap-3">
              <label
                className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors ${
                  logoMode === 'url' || uploading
                    ? 'opacity-40 cursor-not-allowed border-rule text-ink-faint'
                    : 'cursor-pointer border-rule text-ink-soft hover:text-ink hover:border-mark/40'
                }`}
              >
                <Upload size={13} />
                {uploading ? '업로드 중...' : '파일 업로드'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  disabled={logoMode === 'url' || uploading}
                  onChange={handleLogoUpload}
                />
              </label>
              <span className="text-xs text-ink-faint">PNG · JPG · WEBP · SVG · 최대 2MB</span>
            </div>

            {/* 업로드 에러 */}
            {uploadError && (
              <p className="text-xs text-danger">{uploadError}</p>
            )}

            {/* 로고 미리보기 */}
            {form.logo_url && (
              <div className="flex items-center gap-3 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logo_url}
                  alt="로고 미리보기"
                  className="w-10 h-10 rounded-lg object-contain border border-rule bg-paper"
                />
                <span className="text-xs text-ink-faint truncate max-w-xs">{form.logo_url}</span>
              </div>
            )}
          </div>
        </Field>

        <Field label="매뉴얼 URL">
          <input
            value={form.manual_url}
            onChange={(e) => set('manual_url', e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
      </section>

      {/* 태그 (최대 5개) */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-mark" />
          <h2 className="text-sm font-semibold text-ink">태그</h2>
          <span className="text-xs text-ink-faint">— /product, /pricing 페이지에 표시 (최대 5개)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <input
              key={i}
              value={form.tags[i] ?? ''}
              onChange={(e) => {
                const next = [...form.tags]
                next[i] = e.target.value
                set('tags', next.filter((t, idx) => t || idx < i))
              }}
              placeholder={`태그 ${i + 1}`}
              className={inputCls}
            />
          ))}
        </div>
      </section>

      {/* Pricing 전용 기능 (최대 4개) */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-mark" />
          <h2 className="text-sm font-semibold text-ink">특징 (Pricing 전용)</h2>
          <span className="text-xs text-ink-faint">— /pricing 페이지에만 표시 (최대 4개)</span>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <input
              key={i}
              value={form.pricing_features[i] ?? ''}
              onChange={(e) => {
                const next = [...form.pricing_features]
                next[i] = e.target.value
                set('pricing_features', next.filter((t, idx) => t || idx < i))
              }}
              placeholder={`특징 ${i + 1} — 예: 쿼드 엔진 AI 생성: 4개의 프리미엄 AI 엔진으로 구동되는 고품질 콘텐츠.`}
              className={inputCls}
            />
          ))}
        </div>
      </section>

      {/* Product 전용 기능 (최대 12개, /product 확장 박스에 표시) */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-mark" />
            <h2 className="text-sm font-semibold text-ink">특징 (Product 전용)</h2>
            <span className="text-xs text-ink-faint">— /product 확장 박스에 표시 (최대 12개)</span>
          </div>
          {form.product_features.length < 12 && (
            <button
              type="button"
              onClick={() =>
                set('product_features', [
                  ...form.product_features,
                  { icon: '', image_url: '', title: '', description: '' },
                ])
              }
              className="flex items-center gap-1.5 text-xs text-mark hover:text-mark border border-mark/30 hover:border-mark/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> 특징 추가
            </button>
          )}
        </div>

        {form.product_features.length === 0 && (
          <p className="text-xs text-ink-faint py-4 text-center">아직 추가된 특징이 없습니다. +를 눌러 추가하세요.</p>
        )}

        {/* 입력 폼: 3열 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {form.product_features.map((feat, idx) => (
            <div key={idx} className="relative p-4 bg-paper rounded-xl border border-rule space-y-3">
              <button
                type="button"
                onClick={() =>
                  set(
                    'product_features',
                    form.product_features.filter((_, i) => i !== idx),
                  )
                }
                className="absolute top-2 right-2 p-1 text-ink-faint hover:text-danger transition-colors"
              >
                <Trash2 size={12} />
              </button>

              <input
                value={feat.icon}
                onChange={(e) => {
                  const next = [...form.product_features]
                  next[idx] = { ...next[idx], icon: e.target.value }
                  set('product_features', next)
                }}
                placeholder="Lucide: Cpu  |  Tabler: tb:Cpu  |  Radix: ri:Accessibility"
                className={inputCls + ' text-xs'}
              />

              <FeatureImageUpload
                value={feat.image_url}
                onChange={(url) => {
                  const next = [...form.product_features]
                  next[idx] = { ...next[idx], image_url: url }
                  set('product_features', next)
                }}
              />

              <input
                value={feat.title}
                onChange={(e) => {
                  const next = [...form.product_features]
                  next[idx] = { ...next[idx], title: e.target.value }
                  set('product_features', next)
                }}
                placeholder="제목 *"
                className={inputCls + ' text-xs'}
              />

              <textarea
                rows={2}
                value={feat.description}
                onChange={(e) => {
                  const next = [...form.product_features]
                  next[idx] = { ...next[idx], description: e.target.value }
                  set('product_features', next)
                }}
                placeholder="설명"
                className={inputCls + ' text-xs resize-none'}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 상세 페이지 콘텐츠 (/product/[slug]에 표시) */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-mark" />
          <h2 className="text-sm font-semibold text-ink">상세 페이지 콘텐츠</h2>
          <span className="text-xs text-ink-faint">— 상품 상세 페이지에 표시</span>
        </div>

        <Field label="대표 이미지">
          <FeatureImageUpload value={form.hero_image_url} onChange={(url) => set('hero_image_url', url)} />
        </Field>

        <Field label="스크린샷 (복수)">
          <div className="space-y-2">
            {form.screenshots.map((url, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <FeatureImageUpload value={url} onChange={(u) => updateScreenshot(i, u)} />
                </div>
                <button
                  type="button"
                  onClick={() => removeScreenshot(i)}
                  className="shrink-0 p-2 text-ink-faint hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScreenshot}
              className="flex items-center gap-1.5 text-xs text-mark hover:text-mark border border-mark/30 hover:border-mark/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> 스크린샷 추가
            </button>
          </div>
        </Field>

        <Field label="시스템 요구사항">
          <textarea
            rows={4}
            value={form.system_requirements}
            onChange={(e) => set('system_requirements', e.target.value)}
            placeholder="예: Windows 10 이상 · RAM 4GB · 500MB 저장 공간…"
            className={inputCls + ' resize-none'}
          />
        </Field>

        <Field label="버전정보 링크 (선택)">
          <input
            value={form.version_info_url}
            onChange={(e) => set('version_info_url', e.target.value)}
            placeholder="https://... (또는 /changelog)"
            className={inputCls}
          />
        </Field>
      </section>

      {/* 상품 FAQ */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-mark" />
            <h2 className="text-sm font-semibold text-ink">상품 FAQ</h2>
            <span className="text-xs text-ink-faint">— 상세 페이지에 표시</span>
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1.5 text-xs text-mark hover:text-mark border border-mark/30 hover:border-mark/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> FAQ 추가
          </button>
        </div>

        {form.faqs.length === 0 && (
          <p className="text-xs text-ink-faint py-2 text-center">아직 추가된 FAQ가 없습니다.</p>
        )}

        {form.faqs.map((faq, idx) => (
          <div key={idx} className="flex items-start gap-2 p-4 bg-paper rounded-xl border border-rule">
            <div className="flex-1 space-y-2 min-w-0">
              <input
                value={faq.question}
                onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                placeholder="질문"
                className={inputCls}
              />
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                placeholder="답변"
                className={inputCls + ' resize-none'}
              />
            </div>
            <button
              type="button"
              onClick={() => removeFaq(idx)}
              className="mt-0.5 p-2 text-ink-faint hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      {/* 옵션 · 가격 — 옵션 관련 설정을 한 곳에: ① 드롭다운 제목 + ② 옵션 목록(행별 가격·tier) */}
      <section className="border border-rule bg-paper-raised rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">옵션 · 가격</h2>
          <p className="text-xs text-ink-faint mt-0.5">
            옵션 설정을 한 곳에 모았습니다. 옵션이 없는 상품이면 ①은 비우고 ②에 행 1개만 두세요.
          </p>
        </div>

        {/* ① 옵션 드롭다운 제목 (선택) — 고객이 고르는 "기준"의 이름 */}
        <div className="border border-rule rounded-xl p-4 space-y-3 bg-paper-shade">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-mark" />
            <span className="text-sm font-semibold text-ink">① 옵션 드롭다운 제목</span>
            <span className="text-xs text-ink-faint">고객이 고르는 &quot;기준&quot;의 이름 · 옵션 없으면 비움</span>
          </div>
          <p className="text-xs text-ink-faint">
            예) 축1 = 기간(월간/연간), 축2 = PC 개수(선택). 기준이 1개면 축2는 비웁니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="축1 제목">
              <input
                value={form.option_axis1_name}
                onChange={(e) => set('option_axis1_name', e.target.value)}
                placeholder="예: 기간 (월간/연간)"
                className={inputCls}
              />
            </Field>
            <Field label="축2 제목 (선택)">
              <input
                value={form.option_axis2_name}
                onChange={(e) => set('option_axis2_name', e.target.value)}
                placeholder="예: PC 개수 — 기준이 1개면 비움"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* ② 옵션 목록 — 각 행 = 고객이 고를 선택지 하나 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">② 옵션 목록</span>
            <span className="text-xs text-ink-faint">각 행 = 선택지 하나. &quot;순서&quot; 번호 오름차순으로 공개 화면에 표시됩니다.</span>
          </div>
          <button
            type="button"
            onClick={addPrice}
            className="flex items-center gap-1.5 text-xs text-mark hover:text-mark border border-mark/30 hover:border-mark/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> 옵션 추가
          </button>
        </div>

        {form.prices.length === 0 && (
          <p className="text-xs text-ink-faint py-4 text-center">아직 추가된 옵션이 없습니다.</p>
        )}

        {form.prices.map((price, idx) => (
          <div key={idx} className="flex items-start gap-3 p-4 bg-paper rounded-xl border border-rule">
            <div className="flex-1 space-y-3">
              {/* 순서 번호 + 옵션 라벨 (축1/축2 값) — 순서 오름차순으로 공개 화면에 표시됨 */}
              <div className="grid grid-cols-[80px_1fr_1fr] gap-3">
                <Field label="순서">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={price.sort_order}
                    onChange={(e) => updatePrice(idx, 'sort_order', e.target.value)}
                    placeholder="1"
                    title="작을수록 먼저 표시됩니다 (오름차순)"
                    className={inputCls}
                  />
                </Field>
                <Field label={`옵션값 ${form.option_axis1_name || '축1'}`}>
                  <input
                    value={price.option_axis1_label}
                    onChange={(e) => updatePrice(idx, 'option_axis1_label', e.target.value)}
                    placeholder="예: 월간"
                    className={inputCls}
                  />
                </Field>
                <Field label={`옵션값 ${form.option_axis2_name || '축2'} (선택)`}>
                  <input
                    value={price.option_axis2_label}
                    onChange={(e) => updatePrice(idx, 'option_axis2_label', e.target.value)}
                    placeholder="예: 3PC용"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="유형">
                  <select
                    value={price.type}
                    onChange={(e) => updatePrice(idx, 'type', e.target.value)}
                    className={selectCls}
                  >
                    <option value="subscription">구독</option>
                    <option value="one_time">단일 구매</option>
                  </select>
                </Field>

                <Field label="주기">
                  <select
                    value={price.interval}
                    onChange={(e) => updatePrice(idx, 'interval', e.target.value)}
                    disabled={price.type === 'one_time'}
                    className={selectCls + (price.type === 'one_time' ? ' opacity-40 cursor-not-allowed' : '')}
                  >
                    <option value="monthly">월간</option>
                    <option value="annual">연간</option>
                  </select>
                </Field>

                <Field label="가격 (원, KRW)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={price.price}
                    onChange={(e) => updatePrice(idx, 'price', e.target.value)}
                    placeholder="0"
                    className={inputCls}
                  />
                </Field>

                <Field label="라이선스 tier">
                  <input
                    value={price.license_tier}
                    onChange={(e) => updatePrice(idx, 'license_tier', e.target.value)}
                    placeholder="예: 3pc"
                    className={inputCls + ' font-mono text-xs'}
                  />
                </Field>
              </div>

              <Field label="Lemon Squeezy Variant ID (웹훅 매칭용)">
                <input
                  value={price.lemon_squeezy_variant_id}
                  onChange={(e) => updatePrice(idx, 'lemon_squeezy_variant_id', e.target.value)}
                  placeholder="e.g. 123456"
                  className={inputCls + ' font-mono text-xs'}
                />
              </Field>

              <Field label="Checkout URL (구매 버튼 링크)">
                <input
                  value={price.checkout_url}
                  onChange={(e) => updatePrice(idx, 'checkout_url', e.target.value)}
                  placeholder="https://corezent.lemonsqueezy.com/checkout/buy/..."
                  className={inputCls + ' font-mono text-xs'}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => removePrice(idx)}
              className="mt-6 p-2 text-ink-faint hover:text-danger transition-colors rounded-lg hover:bg-danger-soft"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      {/* 에러 & 제출 */}
      {error && (
        <p className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-mark hover:brightness-95 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? '저장 중...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-ink-faint hover:text-ink transition-colors px-4 py-2.5"
        >
          취소
        </button>
      </div>
    </form>
  )
}
