'use client'

/**
 * @컴포넌트: ChangelogSection
 * @설명: 상품 편집 페이지 하단 Changelog 관리 섹션
 *        버전 목록 조회 + 추가/수정/삭제 인라인 폼
 */

import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Check, Loader2, X } from 'lucide-react'
import { upsertChangelog, deleteChangelog, type ChangelogContent, type ChangelogFormData } from './changelog-actions'

interface ChangelogEntry {
  id: string
  version: string
  release_date: string
  is_latest: boolean
  download_urls: Record<string, string>
  content: ChangelogContent
}

interface Props {
  productId: string
  initialChangelogs: ChangelogEntry[]
}

const PLATFORMS = [
  { key: 'windows', label: 'Windows' },
  { key: 'mac',     label: 'macOS' },
  { key: 'linux',   label: 'Linux' },
  { key: 'chrome_store', label: 'Chrome Store' },
  { key: 'web',     label: 'Web' },
]

const CONTENT_KEYS: { key: keyof ChangelogContent; label: string; color: string }[] = [
  { key: 'new_features',     label: 'New Features',     color: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20' },
  { key: 'improvements',     label: 'Improvements',     color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  { key: 'bug_fixes',        label: 'Bug Fixes',        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  { key: 'breaking_changes', label: 'Breaking Changes', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
]

function emptyForm(): ChangelogFormData {
  return {
    version: '',
    release_date: new Date().toISOString().split('T')[0],
    is_latest: false,
    download_urls: {},
    content: { new_features: [], improvements: [], bug_fixes: [], breaking_changes: [] },
  }
}

export default function ChangelogSection({ productId, initialChangelogs }: Props) {
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>(initialChangelogs)
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ChangelogFormData>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ─── 헬퍼 ───────────────────────────────────────────────────────
  function openAdd() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
    setMode('add')
  }

  function openEdit(entry: ChangelogEntry) {
    setForm({
      version: entry.version,
      release_date: entry.release_date,
      is_latest: entry.is_latest,
      download_urls: { ...entry.download_urls },
      content: {
        new_features:     [...(entry.content.new_features ?? [])],
        improvements:     [...(entry.content.improvements ?? [])],
        bug_fixes:        [...(entry.content.bug_fixes ?? [])],
        breaking_changes: [...(entry.content.breaking_changes ?? [])],
      },
    })
    setEditingId(entry.id)
    setError(null)
    setMode('edit')
  }

  function cancel() {
    setMode('list')
    setEditingId(null)
    setError(null)
  }

  // content 항목 업데이트
  function setContentItems(key: keyof ChangelogContent, items: string[]) {
    setForm((prev) => ({ ...prev, content: { ...prev.content, [key]: items } }))
  }

  // ─── 저장 ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.version.trim() || !form.release_date) {
      setError('Version and release date are required.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await upsertChangelog(productId, form, editingId ?? undefined)
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    // 로컬 상태 업데이트 — 신규 항목은 DB에서 받은 실제 UUID 사용
    const saved: ChangelogEntry = {
      id: editingId ?? result.id ?? crypto.randomUUID(),
      version: form.version.trim(),
      release_date: form.release_date,
      is_latest: form.is_latest,
      download_urls: Object.fromEntries(
        Object.entries(form.download_urls).filter(([, v]) => v.trim())
      ),
      content: {
        new_features:     form.content.new_features.filter(Boolean),
        improvements:     form.content.improvements.filter(Boolean),
        bug_fixes:        form.content.bug_fixes.filter(Boolean),
        breaking_changes: form.content.breaking_changes.filter(Boolean),
      },
    }

    // is_latest 변경 시 다른 항목 is_latest = false
    let updated: ChangelogEntry[]
    if (editingId) {
      updated = changelogs.map((c) =>
        c.id === editingId ? saved : form.is_latest ? { ...c, is_latest: false } : c
      )
    } else {
      updated = [
        saved,
        ...(form.is_latest ? changelogs.map((c) => ({ ...c, is_latest: false })) : changelogs),
      ]
    }
    setChangelogs(updated.sort((a, b) => b.release_date.localeCompare(a.release_date)))
    setSaving(false)
    setMode('list')
  }

  // ─── 삭제 ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Delete this changelog entry?')) return
    setDeletingId(id)
    const result = await deleteChangelog(id)
    if (result.error) { alert(result.error); setDeletingId(null); return }
    setChangelogs((prev) => prev.filter((c) => c.id !== id))
    setDeletingId(null)
  }

  // ─── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="border border-[#1E293B] bg-[#111A2E] rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-[#1E293B] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Changelog</h2>
          <p className="text-xs text-[#475569] mt-0.5">Manage version history and download links</p>
        </div>
        {mode === 'list' && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 hover:bg-[#38BDF8]/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={12} />
            Add Version
          </button>
        )}
      </div>

      {/* 버전 목록 */}
      {mode === 'list' && (
        <div>
          {changelogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#475569]">
              No changelog entries yet. Add the first version.
            </div>
          ) : (
            <div className="divide-y divide-[#1E293B]/60">
              {changelogs.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-[#0B1120]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-white">{entry.version}</span>
                    {entry.is_latest && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                        Latest
                      </span>
                    )}
                    <span className="text-xs text-[#475569]">{entry.release_date}</span>
                    {Object.keys(entry.download_urls).length > 0 && (
                      <span className="text-xs text-[#475569]">
                        · {Object.keys(entry.download_urls).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="p-1.5 text-[#475569] hover:text-white hover:bg-[#1E293B] rounded-lg transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-1.5 text-[#475569] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {deletingId === entry.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 추가 / 수정 폼 */}
      {(mode === 'add' || mode === 'edit') && (
        <div className="px-6 py-6 space-y-6">
          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">
                Version <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                placeholder="v1.0.0"
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">
                Release Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.release_date}
                onChange={(e) => setForm((p) => ({ ...p, release_date: e.target.value }))}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#38BDF8]/50 focus:ring-1 focus:ring-[#38BDF8]/20 transition-colors"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setForm((p) => ({ ...p, is_latest: !p.is_latest }))}
                  className={`w-9 h-5 rounded-full border transition-colors flex items-center px-0.5 ${
                    form.is_latest
                      ? 'bg-[#38BDF8]/20 border-[#38BDF8]/40'
                      : 'bg-[#1E293B] border-[#1E293B]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full transition-transform ${
                    form.is_latest ? 'translate-x-4 bg-[#38BDF8]' : 'translate-x-0 bg-[#475569]'
                  }`} />
                </div>
                <span className="text-xs font-medium text-[#94A3B8]">Mark as Latest</span>
              </label>
            </div>
          </div>

          {/* Download URLs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Download URLs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORMS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-[#475569]">{label}</label>
                  <input
                    type="url"
                    value={form.download_urls[key] ?? ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        download_urls: { ...p.download_urls, [key]: e.target.value },
                      }))
                    }
                    placeholder="https://..."
                    className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl px-4 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content — 4 categories */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Changelog Content</h3>
            {CONTENT_KEYS.map(({ key, label, color }) => (
              <ContentListEditor
                key={key}
                label={label}
                colorClass={color}
                items={form.content[key]}
                onChange={(items) => setContentItems(key, items)}
              />
            ))}
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={cancel}
              className="text-sm text-[#475569] hover:text-white px-4 py-2 rounded-xl border border-[#1E293B] hover:border-[#475569] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-[#38BDF8] hover:bg-[#0ea5e9] text-[#0B1120] px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {mode === 'add' ? 'Add Version' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Content 항목 동적 편집기 ─────────────────────────────────────

function ContentListEditor({
  label,
  colorClass,
  items,
  onChange,
}: {
  label: string
  colorClass: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[#1E293B] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0B1120]/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colorClass}`}>
            {label}
          </span>
          <span className="text-xs text-[#475569]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#475569]" /> : <ChevronDown size={14} className="text-[#475569]" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-[#1E293B]/60">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...items]
                  next[i] = e.target.value
                  onChange(next)
                }}
                placeholder="Description..."
                className="flex-1 bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="p-1.5 text-[#475569] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="mt-2 text-xs text-[#475569] hover:text-[#94A3B8] flex items-center gap-1.5 transition-colors"
          >
            <Plus size={11} />
            Add item
          </button>
        </div>
      )}
    </div>
  )
}
