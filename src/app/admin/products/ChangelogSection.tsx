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
  { key: 'web',     label: '웹' },
]

const CONTENT_KEYS: { key: keyof ChangelogContent; label: string; color: string }[] = [
  { key: 'new_features',     label: '새 기능',       color: 'text-mark bg-mark/10 border-mark/30' },
  { key: 'improvements',     label: '개선 사항',     color: 'text-ink-soft bg-paper-shade border-rule' },
  { key: 'bug_fixes',        label: '버그 수정',     color: 'text-ok bg-ok-soft border-ok/20' },
  { key: 'breaking_changes', label: '호환성 변경',   color: 'text-danger bg-danger-soft border-danger/20' },
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
      setError('버전과 릴리스 날짜는 필수입니다.')
      return
    }
    // 다운로드 URL http/https 형식 검증 (서버와 동일 규칙 — 즉시 피드백)
    const badUrls = Object.entries(form.download_urls)
      .filter(([, v]) => v.trim())
      .filter(([, v]) => {
        try {
          const u = new URL(v.trim())
          return u.protocol !== 'http:' && u.protocol !== 'https:'
        } catch {
          return true
        }
      })
    if (badUrls.length > 0) {
      setError(`다운로드 URL 형식이 올바르지 않습니다 (http/https 필요): ${badUrls.map(([k]) => PLATFORMS.find((p) => p.key === k)?.label ?? k).join(', ')}`)
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
    if (!confirm('이 변경 이력 항목을 삭제하시겠습니까?')) return
    setDeletingId(id)
    const result = await deleteChangelog(id)
    if (result.error) { alert(result.error); setDeletingId(null); return }
    setChangelogs((prev) => prev.filter((c) => c.id !== id))
    setDeletingId(null)
  }

  // ─── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">변경 이력</h2>
          <p className="text-xs text-ink-faint mt-0.5">버전 이력과 다운로드 링크를 관리합니다</p>
        </div>
        {mode === 'list' && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-mark/10 text-mark border border-mark/30 hover:bg-mark/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={12} />
            버전 추가
          </button>
        )}
      </div>

      {/* 버전 목록 */}
      {mode === 'list' && (
        <div>
          {changelogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-faint">
              아직 변경 이력이 없습니다. 첫 버전을 추가하세요.
            </div>
          ) : (
            <div className="divide-y divide-rule">
              {changelogs.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-paper-shade transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-ink">{entry.version}</span>
                    {entry.is_latest && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-mark/10 text-mark border border-mark/30">
                        최신
                      </span>
                    )}
                    <span className="text-xs text-ink-faint">{entry.release_date}</span>
                    {Object.keys(entry.download_urls).length > 0 && (
                      <span className="text-xs text-ink-faint">
                        · {Object.keys(entry.download_urls).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="p-1.5 text-ink-faint hover:text-ink hover:bg-paper-shade rounded-lg transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-1.5 text-ink-faint hover:text-danger hover:bg-danger-soft rounded-lg transition-colors disabled:opacity-40"
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
            <p className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-4 py-2.5">{error}</p>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-soft">
                버전 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
                placeholder="v1.0.0"
                className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink font-mono placeholder-ink-faint focus:outline-none focus:border-mark focus:ring-1 focus:ring-mark/20 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-soft">
                릴리스 날짜 <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={form.release_date}
                onChange={(e) => setForm((p) => ({ ...p, release_date: e.target.value }))}
                className="w-full bg-paper border border-rule rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-mark focus:ring-1 focus:ring-mark/20 transition-colors"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setForm((p) => ({ ...p, is_latest: !p.is_latest }))}
                  className={`w-9 h-5 rounded-full border transition-colors flex items-center px-0.5 ${
                    form.is_latest
                      ? 'bg-mark/20 border-mark/40'
                      : 'bg-paper-shade border-rule'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full transition-transform ${
                    form.is_latest ? 'translate-x-4 bg-mark' : 'translate-x-0 bg-ink-faint'
                  }`} />
                </div>
                <span className="text-xs font-medium text-ink-soft">최신으로 표시</span>
              </label>
            </div>
          </div>

          {/* Download URLs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">다운로드 URL</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLATFORMS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-ink-faint">{label}</label>
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
                    className="w-full bg-paper border border-rule rounded-xl px-4 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content — 4 categories */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">변경 이력 내용</h3>
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
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={cancel}
              className="text-sm text-ink-faint hover:text-ink px-4 py-2 rounded-xl border border-rule hover:border-ink-faint transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-mark hover:brightness-95 text-white px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {mode === 'add' ? '버전 추가' : '변경사항 저장'}
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
    <div className="border border-rule rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper-shade transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colorClass}`}>
            {label}
          </span>
          <span className="text-xs text-ink-faint">{items.length}개 항목</span>
        </div>
        {open ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-rule">
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
                placeholder="설명..."
                className="flex-1 bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-mark transition-colors"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="p-1.5 text-ink-faint hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="mt-2 text-xs text-ink-faint hover:text-ink-soft flex items-center gap-1.5 transition-colors"
          >
            <Plus size={11} />
            항목 추가
          </button>
        </div>
      )}
    </div>
  )
}
