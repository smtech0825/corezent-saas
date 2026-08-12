'use client'

/**
 * @컴포넌트: AboutManager
 * @설명: About 페이지 관리 — Hero(제목 + 리치 설명), 통계 카드 CRUD, 콘텐츠 블록(텍스트+이미지 슬라이더) CRUD
 *        Hero 설명은 콘텐츠 블록과 동일한 리치 에디터(RichTextEditor)를 사용한다(서식·이미지·유튜브·표).
 */

import { useState, useTransition, useRef } from 'react'
import nextDynamic from 'next/dynamic'
import { Plus, Pencil, Trash2, X, Upload, Loader2, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { richToPlainText } from '@/lib/rich-html'
import DynamicIcon from '@/components/DynamicIcon'
import { runAdminAction } from '@/app/admin/_lib/runAdminAction'
import type { AdminActionResult } from '@/app/admin/_lib/adminActionResult'

// 콘텐츠 블록 "설명"은 제품 설명과 동일한 리치 에디터(TipTap) 재사용 — admin·클라이언트에서만 로드(ssr:false).
const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border border-rule rounded-lg bg-paper h-48 animate-pulse" aria-hidden />,
})

const BUCKET = 'about-images'

// ─── 타입 ────────────────────────────────────────────────────

interface Stat {
  id: string
  icon: string
  value: string
  label: string
  order_index: number
  is_published: boolean
}

interface Block {
  id: string
  title: string
  description: string
  images: string[]
  order_index: number
  is_published: boolean
}

interface Props {
  heroTitle: string
  heroDescription: string
  stats: Stat[]
  blocks: Block[]
  onUpdateHero: (title: string, description: string) => Promise<AdminActionResult>
  onCreateStat: (data: { icon: string; value: string; label: string }) => Promise<AdminActionResult<Stat>>
  onUpdateStat: (id: string, data: { icon: string; value: string; label: string }) => Promise<AdminActionResult>
  onDeleteStat: (id: string) => Promise<AdminActionResult>
  onCreateBlock: (data: { title: string; description: string; images: string[] }) => Promise<AdminActionResult<Block>>
  onUpdateBlock: (id: string, data: { title: string; description: string; images: string[] }) => Promise<AdminActionResult>
  onDeleteBlock: (id: string) => Promise<AdminActionResult>
}

// ─── 공통 스타일 ──────────────────────────────────────────────

const inputCls = 'w-full bg-paper border border-rule rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-mark'
const btnPrimary = 'flex items-center gap-1.5 text-xs bg-mark text-white font-semibold px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-50 transition-colors'
const btnCancel = 'flex items-center gap-1.5 text-xs text-ink-soft border border-rule px-3 py-1.5 rounded-lg hover:text-ink transition-colors'

// ─── 이미지 업로드 컴포넌트 ────────────────────────────────────

function ImageUploader({ images, onChange, max = 3 }: { images: string[]; onChange: (imgs: string[]) => void; max?: number }) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || images.length >= max) return
    if (file.size > 5 * 1024 * 1024) { alert('파일은 5MB 이하여야 합니다.'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (error) {
      // 원문은 영문이라 화면에 그대로 내보내지 않는다. 사유는 브라우저 기록에만 남긴다.
      console.error('[about] 이미지 업로드 실패:', error.message)
      alert('이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    onChange([...images, publicUrl])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {images.map((url, idx) => (
          <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-rule group">
            <img src={url} alt={`업로드된 소개 이미지 ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              title="이미지 삭제"
              aria-label={`소개 이미지 ${idx + 1} 삭제`}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-danger flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-rule flex flex-col items-center justify-center text-ink-faint hover:border-mark/40 hover:text-ink-soft transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <><Upload size={16} /><span className="text-[10px] mt-1">{images.length}/{max}</span></>}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── 섹션 헤더 (접기/펼치기) ───────────────────────────────────

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-2 group">
      <h2 className="text-sm font-bold text-ink uppercase tracking-wider">{title}</h2>
      {open ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
    </button>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export default function AboutManager({
  heroTitle: initTitle,
  heroDescription: initDesc,
  stats: initStats,
  blocks: initBlocks,
  onUpdateHero,
  onCreateStat, onUpdateStat, onDeleteStat,
  onCreateBlock, onUpdateBlock, onDeleteBlock,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // ─ Hero state
  const [heroTitle, setHeroTitle] = useState(initTitle)
  const [heroDesc, setHeroDesc] = useState(initDesc)
  const [heroOpen, setHeroOpen] = useState(true)
  const [heroSaved, setHeroSaved] = useState(false)

  // ─ Stats state
  const [stats, setStats] = useState<Stat[]>(initStats)
  const [statsOpen, setStatsOpen] = useState(true)
  const [editStatId, setEditStatId] = useState<string | null>(null)
  const [statForm, setStatForm] = useState({ icon: '', value: '', label: '' })
  const [showNewStat, setShowNewStat] = useState(false)
  const [newStatForm, setNewStatForm] = useState({ icon: '', value: '', label: '' })

  // ─ Blocks state
  const [blocks, setBlocks] = useState<Block[]>(initBlocks)
  const [blocksOpen, setBlocksOpen] = useState(true)
  const [editBlockId, setEditBlockId] = useState<string | null>(null)
  const [blockForm, setBlockForm] = useState({ title: '', description: '', images: [] as string[] })
  const [showNewBlock, setShowNewBlock] = useState(false)
  const [newBlockForm, setNewBlockForm] = useState({ title: '', description: '', images: [] as string[] })

  // ─── Hero handlers ──────────────────────────────────────────

  /**
   * @함수명: changeHero
   * @설명: 히어로 입력이 바뀌면 "저장되었습니다" 표시를 끕니다. 다른 편집기 3개(히어로·CTA·배너)가
   *        쓰는 방식과 같습니다 — 저장 뒤 다시 고쳤는데 표시가 남아 있으면 저장한 줄 알고 떠나게 됩니다.
   * @매개변수: field - 바뀐 항목 / value - 새 값
   * @반환값: 없음
   */
  function changeHero(field: 'title' | 'description', value: string) {
    if (field === 'title') setHeroTitle(value)
    else setHeroDesc(value)
    setHeroSaved(false)
  }

  function handleHeroSave() {
    setHeroSaved(false)
    startTransition(async () => {
      // 실패해도 입력값을 지우지 않는다 — 작성 중이던 내용이 날아가면 안 된다.
      // 성공했을 때만 "저장되었습니다"를 켠다(다른 저장 화면과 같은 방식).
      const res = await runAdminAction('소개 히어로 저장', () => onUpdateHero(heroTitle, heroDesc))
      if (res.status !== 'ok') return
      setHeroSaved(true)
    })
  }

  // ─── Stat handlers ──────────────────────────────────────────

  function startEditStat(s: Stat) {
    setEditStatId(s.id)
    setStatForm({ icon: s.icon, value: s.value, label: s.label })
    setShowNewStat(false)
  }

  function handleUpdateStat(id: string) {
    startTransition(async () => {
      const res = await runAdminAction('통계 수정', () => onUpdateStat(id, statForm))
      if (res.status !== 'ok') return
      setStats((prev) => prev.map((s) => (s.id === id ? { ...s, ...statForm } : s)))
      setEditStatId(null)
    })
  }

  function handleCreateStat() {
    if (!newStatForm.value.trim()) return
    startTransition(async () => {
      const res = await runAdminAction('통계 추가', () => onCreateStat(newStatForm))
      if (res.status !== 'ok') return
      const created = res.created
      if (created) setStats((prev) => [...prev, created])
      setNewStatForm({ icon: '', value: '', label: '' })
      setShowNewStat(false)
    })
  }

  function handleDeleteStat(id: string, label: string) {
    if (!confirm(`통계 "${label}"을(를) 삭제할까요?\n\n소개 페이지에서 바로 사라지며 되돌릴 수 없습니다.`)) return
    startTransition(async () => {
      // 서버가 실패하면 목록에서 지우지 않는다 — 지워지면 삭제된 것으로 오해한다.
      const res = await runAdminAction('통계 삭제', () => onDeleteStat(id))
      if (res.status !== 'ok') return
      setStats((prev) => prev.filter((s) => s.id !== id))
    })
  }

  // ─── Block handlers ─────────────────────────────────────────

  function startEditBlock(b: Block) {
    setEditBlockId(b.id)
    setBlockForm({ title: b.title, description: b.description, images: [...b.images] })
    setShowNewBlock(false)
  }

  function handleUpdateBlock(id: string) {
    startTransition(async () => {
      // 실패하면 편집 상태를 닫지 않는다 — 작성 중이던 내용이 날아가면 안 된다.
      const res = await runAdminAction('블록 수정', () => onUpdateBlock(id, blockForm))
      if (res.status !== 'ok') return
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...blockForm } : b)))
      setEditBlockId(null)
    })
  }

  function handleCreateBlock() {
    startTransition(async () => {
      const res = await runAdminAction('블록 추가', () => onCreateBlock(newBlockForm))
      if (res.status !== 'ok') return
      const created = res.created
      if (created) setBlocks((prev) => [...prev, { ...created, images: created.images ?? [] }])
      setNewBlockForm({ title: '', description: '', images: [] })
      setShowNewBlock(false)
    })
  }

  function handleDeleteBlock(id: string, title: string) {
    if (!confirm(`블록 "${title}"을(를) 삭제할까요?\n\n안에 담긴 이미지까지 함께 사라지며 되돌릴 수 없습니다.`)) return
    startTransition(async () => {
      // 서버가 실패하면 목록에서 지우지 않는다 — 지워지면 삭제된 것으로 오해한다.
      const res = await runAdminAction('블록 삭제', () => onDeleteBlock(id))
      if (res.status !== 'ok') return
      setBlocks((prev) => prev.filter((b) => b.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      {isPending && <p className="text-xs text-mark">저장 중…</p>}

      {/* ────── 1. Hero ────── */}
      <div className="border border-rule bg-paper-raised rounded-card p-4">
        <SectionHeader title="히어로 — 제목 및 설명" open={heroOpen} onToggle={() => setHeroOpen(!heroOpen)} />
        {heroOpen && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-[10px] text-ink-faint mb-1 block">제목</label>
              <input value={heroTitle} onChange={(e) => changeHero('title', e.target.value)} placeholder="About CoreZent" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-ink-faint mb-1 block">설명</label>
              {/* 콘텐츠 블록과 동일한 리치 에디터 — 서식·정렬·이미지·유튜브·표. 저장 시 서버에서 sanitize된다 */}
              <RichTextEditor value={heroDesc} onChange={(html) => changeHero('description', html)} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleHeroSave} disabled={isPending} className={btnPrimary}>
                히어로 저장
              </button>
              {heroSaved && !isPending && <span className="text-xs text-ok">저장되었습니다.</span>}
            </div>
          </div>
        )}
      </div>

      {/* ────── 2. Stats Cards ────── */}
      <div className="border border-rule bg-paper-raised rounded-card p-4">
        <SectionHeader title="통계 카드" open={statsOpen} onToggle={() => setStatsOpen(!statsOpen)} />
        {statsOpen && (
          <div className="space-y-3 mt-3">
            {stats.map((s) => (
              <div key={s.id} className="border border-rule bg-paper rounded-lg overflow-hidden">
                {editStatId === s.id ? (
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input value={statForm.icon} onChange={(e) => setStatForm({ ...statForm, icon: e.target.value })} placeholder="아이콘 (Users · tb:World)" className={inputCls} />
                      <input value={statForm.value} onChange={(e) => setStatForm({ ...statForm, value: e.target.value })} placeholder="400K+" className={inputCls} />
                      <input value={statForm.label} onChange={(e) => setStatForm({ ...statForm, label: e.target.value })} placeholder="customers" className={inputCls} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStat(s.id)} disabled={isPending} className={btnPrimary}>저장</button>
                      <button onClick={() => setEditStatId(null)} className={btnCancel}><X size={12} /> 취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-mark/10 border border-mark/30 flex items-center justify-center">
                        <DynamicIcon name={s.icon || 'Users'} size={14} className="text-mark" />
                      </div>
                      <span className="text-ink font-bold text-sm">{s.value}</span>
                      <span className="text-ink-faint text-xs">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEditStat(s)} title="통계 수정" aria-label="통계 수정" className="p-1.5 text-ink-faint hover:text-ink rounded-lg hover:bg-paper-shade transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteStat(s.id, s.label)} title="통계 삭제" aria-label="통계 삭제" className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showNewStat ? (
              <div className="border border-mark/30 bg-mark/5 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input value={newStatForm.icon} onChange={(e) => setNewStatForm({ ...newStatForm, icon: e.target.value })} placeholder="아이콘 (Users · tb:World)" className={inputCls} />
                  <input value={newStatForm.value} onChange={(e) => setNewStatForm({ ...newStatForm, value: e.target.value })} placeholder="400K+" className={inputCls} />
                  <input value={newStatForm.label} onChange={(e) => setNewStatForm({ ...newStatForm, label: e.target.value })} placeholder="customers" className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateStat} disabled={isPending || !newStatForm.value.trim()} className={btnPrimary}>통계 추가</button>
                  <button onClick={() => { setShowNewStat(false); setNewStatForm({ icon: '', value: '', label: '' }) }} className={btnCancel}><X size={12} /> 취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowNewStat(true); setEditStatId(null) }} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-rule rounded-lg text-sm text-ink-faint hover:text-ink-soft hover:border-mark/30 transition-colors">
                <Plus size={15} /> 통계 카드 추가
              </button>
            )}
          </div>
        )}
      </div>

      {/* ────── 3. Content Blocks (max 3) ────── */}
      <div className="border border-rule bg-paper-raised rounded-card p-4">
        <SectionHeader title="콘텐츠 블록 (텍스트 + 이미지)" open={blocksOpen} onToggle={() => setBlocksOpen(!blocksOpen)} />
        {blocksOpen && (
          <div className="space-y-3 mt-3">
            {blocks.map((b, idx) => (
              <div key={b.id} className="border border-rule bg-paper rounded-lg overflow-hidden">
                {editBlockId === b.id ? (
                  <div className="p-4 space-y-3">
                    <input value={blockForm.title} onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })} placeholder="블록 제목 (선택)" className={inputCls} />
                    <div>
                      <label className="text-[10px] text-ink-faint mb-1 block">설명</label>
                      <RichTextEditor value={blockForm.description} onChange={(html) => setBlockForm({ ...blockForm, description: html })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-faint mb-1.5 block">이미지 (최대 3개) — 오른쪽에 슬라이더로 표시</label>
                      <ImageUploader images={blockForm.images} onChange={(imgs) => setBlockForm({ ...blockForm, images: imgs })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateBlock(b.id)} disabled={isPending} className={btnPrimary}>저장</button>
                      <button onClick={() => setEditBlockId(null)} className={btnCancel}><X size={12} /> 취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-mark/60 font-bold">{String(idx + 1).padStart(2, '0')}</span>
                          {b.title && <span className="text-xs text-ink font-semibold">{b.title}</span>}
                        </div>
                        <p className="text-xs text-ink-faint line-clamp-2">{richToPlainText(b.description)}</p>
                        {b.images.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <ImageIcon size={11} className="text-ink-faint" />
                            <span className="text-[10px] text-ink-faint">이미지 {b.images.length}개</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEditBlock(b)} title="블록 수정" aria-label="블록 수정" className="p-1.5 text-ink-faint hover:text-ink rounded-lg hover:bg-paper-shade transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteBlock(b.id, b.title)} title="블록 삭제" aria-label="블록 삭제" className="p-1.5 text-ink-faint hover:text-danger rounded-lg hover:bg-danger-soft transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {blocks.length < 3 && (
              showNewBlock ? (
                <div className="border border-mark/30 bg-mark/5 rounded-lg p-4 space-y-3">
                  <input value={newBlockForm.title} onChange={(e) => setNewBlockForm({ ...newBlockForm, title: e.target.value })} placeholder="블록 제목 (선택)" className={inputCls} />
                  <div>
                    <label className="text-[10px] text-ink-faint mb-1 block">설명</label>
                    <RichTextEditor value={newBlockForm.description} onChange={(html) => setNewBlockForm({ ...newBlockForm, description: html })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-faint mb-1.5 block">이미지 (최대 3개)</label>
                    <ImageUploader images={newBlockForm.images} onChange={(imgs) => setNewBlockForm({ ...newBlockForm, images: imgs })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCreateBlock} disabled={isPending} className={btnPrimary}>블록 추가</button>
                    <button onClick={() => { setShowNewBlock(false); setNewBlockForm({ title: '', description: '', images: [] }) }} className={btnCancel}><X size={12} /> 취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowNewBlock(true); setEditBlockId(null) }} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-rule rounded-lg text-sm text-ink-faint hover:text-ink-soft hover:border-mark/30 transition-colors">
                  <Plus size={15} /> 콘텐츠 블록 추가 ({blocks.length}/3)
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
