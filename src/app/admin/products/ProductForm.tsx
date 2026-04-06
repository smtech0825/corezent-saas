'use client'

/**
 * @컴포넌트: ProductForm
 * @설명: 제품 추가/수정 폼 — 제품 정보 + 가격 플랜 관리
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'

export interface PriceEntry {
  id?: string
  type: 'subscription' | 'one_time'
  interval: 'monthly' | 'annual' | ''
  price: string
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
  max_devices: string
  license_duration_days: string
  order_index: string
  prices: PriceEntry[]
}

interface Props {
  initialData?: ProductFormData
  onSubmit: (data: ProductFormData) => Promise<{ error?: string }>
  submitLabel: string
}

const emptyPrice = (): PriceEntry => ({ type: 'subscription', interval: 'monthly', price: '' })

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugManual, setSlugManual] = useState(!!initialData?.slug)

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
      max_devices: '',
      license_duration_days: '',
      order_index: '0',
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

  function addPrice() {
    set('prices', [...form.prices, emptyPrice()])
  }

  function removePrice(idx: number) {
    set('prices', form.prices.filter((_, i) => i !== idx))
  }

  function updatePrice(idx: number, key: keyof PriceEntry, value: string) {
    const updated = form.prices.map((p, i) => {
      if (i !== idx) return p
      const next = { ...p, [key]: value }
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
      router.refresh()
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Logo URL">
            <input
              value={form.logo_url}
              onChange={(e) => set('logo_url', e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>

          <Field label="Manual URL">
            <input
              value={form.manual_url}
              onChange={(e) => set('manual_url', e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* 라이선스 설정 */}
      <section className="border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white">License Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field label="Max Devices">
            <input
              type="number"
              min={1}
              value={form.max_devices}
              onChange={(e) => set('max_devices', e.target.value)}
              placeholder="Unlimited"
              className={inputCls}
            />
          </Field>

          <Field label="License Duration (days)">
            <input
              type="number"
              min={1}
              value={form.license_duration_days}
              onChange={(e) => set('license_duration_days', e.target.value)}
              placeholder="Permanent"
              className={inputCls}
            />
          </Field>

          <Field label="Order Index">
            <input
              type="number"
              min={0}
              value={form.order_index}
              onChange={(e) => set('order_index', e.target.value)}
              className={inputCls}
            />
          </Field>
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
            <div className="flex-1 grid grid-cols-3 gap-3">
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
          disabled={loading}
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
