'use client'

/**
 * @컴포넌트: ProductForm
 * @설명: 제품 추가/수정 폼 — 제품 정보 + 가격 플랜 관리
 *        Logo: URL 직접 입력 또는 파일 업로드 (상호 배타적)
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload, X, Tag, Sparkles, LayoutGrid } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface PriceEntry {
  id?: string
  type: 'subscription' | 'one_time'
  interval: 'monthly' | 'annual' | ''
  price: string
  lemon_squeezy_variant_id: string
}

export interface ProductFeatureEntry {
  icon: string
  image_url: string
  title: string
  description: string
}

export interface ProductFormData {
  name: string
  slug: string
  tagline: string
  description: string
  category: string
  logo_url: string
  manual_url: string
  is_active: boolean
  tags: string[]
  pricing_features: string[]
  product_features: ProductFeatureEntry[]
  prices: PriceEntry[]
}

interface Props {
  initialData?: ProductFormData
  onSubmit: (data: ProductFormData) => Promise<{ error?: string }>
  submitLabel: string
}

const emptyPrice = (): PriceEntry => ({ type: 'subscription', interval: 'monthly', price: '', lemon_squeezy_variant_id: '' })

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
        <div className="flex items-center gap-2 p-2 bg-[#111A2E] rounded-lg border border-[#1E293B]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="feature preview" className="w-8 h-8 object-contain rounded shrink-0" />
          <span className="text-xs text-[#475569] truncate flex-1">{value.split('/').pop()}</span>
          <button type="button" onClick={clear} className="shrink-0 text-[#475569] hover:text-red-400 transition-colors">
            <X size={12} />
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-colors w-full ${
            uploading
              ? 'opacity-40 cursor-not-allowed border-[#1E293B] text-[#475569]'
              : 'cursor-pointer border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#38BDF8]/40'
          }`}
        >
          <Upload size={11} />
          {uploading ? '업로드 중...' : 'Upload Image (transparent PNG)'}
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
      {error && <p className="text-xs text-red-400">{error}</p>}
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
      <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-[#0B1120] border border-[#1E293B] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder-[#475569]'
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
      logo_url: '',
      manual_url: '',
      is_active: true,
      tags: [],
      pricing_features: [],
      product_features: [],
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
    set('prices', [...form.prices, emptyPrice()])
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* 기본 정보 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white">Basic Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Product Name *">
            <input
              required
              value={form.name}
              onChange={handleNameChange}
              placeholder="e.g. GeniePost"
              className={inputCls}
            />
          </Field>

          <Field label="Slug *">
            <input
              required
              value={form.slug}
              onChange={(e) => { setSlugManual(true); set('slug', e.target.value) }}
              placeholder="e.g. geniepost"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Tagline">
          <input
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder="Short one-line description"
            className={inputCls}
          />
        </Field>

        <Field label="Description (Markdown)">
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Full product description..."
            className={inputCls + ' resize-none'}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Category *">
            <select
              required
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={selectCls}
            >
              <option value="desktop">Desktop</option>
              <option value="web">Web</option>
              <option value="chrome-extension">Chrome Extension</option>
            </select>
          </Field>

          <Field label="Status">
            <select
              value={form.is_active ? 'true' : 'false'}
              onChange={(e) => set('is_active', e.target.value === 'true')}
              className={selectCls}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>

        {/* Logo — URL 입력 또는 파일 업로드 */}
        <Field label="Logo">
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
                  className="shrink-0 p-2 text-[#475569] hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/5"
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
                    ? 'opacity-40 cursor-not-allowed border-[#1E293B] text-[#475569]'
                    : 'cursor-pointer border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#38BDF8]/40'
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
              <span className="text-xs text-[#475569]">PNG · JPG · WEBP · SVG · 최대 2MB</span>
            </div>

            {/* 업로드 에러 */}
            {uploadError && (
              <p className="text-xs text-red-400">{uploadError}</p>
            )}

            {/* 로고 미리보기 */}
            {form.logo_url && (
              <div className="flex items-center gap-3 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logo_url}
                  alt="Logo preview"
                  className="w-10 h-10 rounded-lg object-contain border border-[#1E293B] bg-[#0B1120]"
                />
                <span className="text-xs text-[#475569] truncate max-w-xs">{form.logo_url}</span>
              </div>
            )}
          </div>
        </Field>

        <Field label="Manual URL">
          <input
            value={form.manual_url}
            onChange={(e) => set('manual_url', e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
      </section>

      {/* 태그 (최대 5개) */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[#38BDF8]" />
          <h2 className="text-sm font-semibold text-white">Tags</h2>
          <span className="text-xs text-[#475569]">— /product, /pricing 페이지에 표시 (최대 5개)</span>
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
              placeholder={`Tag ${i + 1}`}
              className={inputCls}
            />
          ))}
        </div>
      </section>

      {/* Pricing 전용 기능 (최대 4개) */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Features (only for Pricing)</h2>
          <span className="text-xs text-[#475569]">— /pricing 페이지에만 표시 (최대 4개)</span>
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
              placeholder={`Feature ${i + 1} — e.g. Quad-Engine AI Generation: High-quality content powered by 4 premium AI engines.`}
              className={inputCls}
            />
          ))}
        </div>
      </section>

      {/* Product 전용 기능 (최대 12개, /product 확장 박스에 표시) */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-[#38BDF8]" />
            <h2 className="text-sm font-semibold text-white">Features (only for Product)</h2>
            <span className="text-xs text-[#475569]">— /product 확장 박스에 표시 (최대 12개)</span>
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
              className="flex items-center gap-1.5 text-xs text-[#38BDF8] hover:text-[#0ea5e9] border border-[#38BDF8]/20 hover:border-[#38BDF8]/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} /> Add Feature
            </button>
          )}
        </div>

        {form.product_features.length === 0 && (
          <p className="text-xs text-[#475569] py-4 text-center">No features added yet. Click + to add.</p>
        )}

        {/* 입력 폼: 3열 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {form.product_features.map((feat, idx) => (
            <div key={idx} className="relative p-4 bg-[#0B1120] rounded-xl border border-[#1E293B] space-y-3">
              <button
                type="button"
                onClick={() =>
                  set(
                    'product_features',
                    form.product_features.filter((_, i) => i !== idx),
                  )
                }
                className="absolute top-2 right-2 p-1 text-[#475569] hover:text-red-400 transition-colors"
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
                placeholder="Title *"
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
                placeholder="Description"
                className={inputCls + ' text-xs resize-none'}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 가격 플랜 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Pricing Plans</h2>
          <button
            type="button"
            onClick={addPrice}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-400/20 hover:border-amber-400/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Plan
          </button>
        </div>

        {form.prices.length === 0 && (
          <p className="text-xs text-[#475569] py-4 text-center">No pricing plans added yet.</p>
        )}

        {form.prices.map((price, idx) => (
          <div key={idx} className="flex items-end gap-3 p-4 bg-[#0B1120] rounded-xl border border-[#1E293B]">
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Type">
                  <select
                    value={price.type}
                    onChange={(e) => updatePrice(idx, 'type', e.target.value)}
                    className={selectCls}
                  >
                    <option value="subscription">Subscription</option>
                    <option value="one_time">One-time</option>
                  </select>
                </Field>

                <Field label="Interval">
                  <select
                    value={price.interval}
                    onChange={(e) => updatePrice(idx, 'interval', e.target.value)}
                    disabled={price.type === 'one_time'}
                    className={selectCls + (price.type === 'one_time' ? ' opacity-40 cursor-not-allowed' : '')}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </Field>

                <Field label="Price (USD)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={price.price}
                    onChange={(e) => updatePrice(idx, 'price', e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Lemon Squeezy Variant ID">
                <input
                  value={price.lemon_squeezy_variant_id}
                  onChange={(e) => updatePrice(idx, 'lemon_squeezy_variant_id', e.target.value)}
                  placeholder="e.g. 123456"
                  className={inputCls + ' font-mono text-xs'}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => removePrice(idx)}
              className="mb-0.5 p-2 text-[#475569] hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/5"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      {/* 에러 & 제출 */}
      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[#475569] hover:text-white transition-colors px-4 py-2.5"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
