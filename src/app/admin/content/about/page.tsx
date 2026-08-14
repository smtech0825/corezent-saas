/**
 * @파일: admin/content/about/page.tsx
 * @설명: About 페이지 콘텐츠 관리 — Hero, 통계 카드, 콘텐츠 블록(텍스트+이미지).
 *        서버 액션(히어로 저장·통계·블록 CRUD)은 actions.ts로 분리(감사 기록 추가로
 *        300줄을 넘겨 분리 — 동작 불변).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import AboutManager from './AboutManager'
import PageContainer from '@/components/common/PageContainer'
import SaveAndViewButton from '@/app/admin/content/_components/SaveAndViewButton'
import { updateHero, createStat, updateStat, deleteStat, createBlock, updateBlock, deleteBlock } from './actions'

export const dynamic = 'force-dynamic'

export default async function AboutAdminPage() {
  const c = createAdminClient()

  const [contentRes, statsRes, blocksRes] = await Promise.all([
    c.from('front_content').select('key, value').in('key', ['about_title', 'about_description']),
    c.from('front_about_stats').select('id, icon, value, label, order_index, is_published').order('order_index'),
    c.from('front_about_blocks').select('id, title, description, images, order_index, is_published').order('order_index'),
  ])

  const contentMap = Object.fromEntries((contentRes.data ?? []).map((r) => [r.key, r.value]))

  return (
    <PageContainer variant="admin-form" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink font-serif">소개 페이지</h1>
          <p className="text-sm text-ink-soft mt-1">
            소개 페이지를 관리합니다 — 히어로 텍스트, 통계 카드, 이미지 슬라이더가 포함된 콘텐츠 블록.
          </p>
        </div>
        {/* 통계·블록은 항목별 즉시 저장이지만 히어로 폼은 저장 버튼이 따로 있다 — 안내 문구로 착각 방지 */}
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <SaveAndViewButton url="/about" />
          <p className="text-xs text-ink-faint">히어로 수정은 먼저 &ldquo;히어로 저장&rdquo;을 누른 뒤 확인하세요.</p>
        </div>
      </div>

      <AboutManager
        heroTitle={contentMap['about_title'] ?? ''}
        heroDescription={contentMap['about_description'] ?? ''}
        stats={statsRes.data ?? []}
        blocks={(blocksRes.data ?? []).map((b) => ({ ...b, images: (b.images ?? []) as string[] }))}
        onUpdateHero={updateHero}
        onCreateStat={createStat}
        onUpdateStat={updateStat}
        onDeleteStat={deleteStat}
        onCreateBlock={createBlock}
        onUpdateBlock={updateBlock}
        onDeleteBlock={deleteBlock}
      />
    </PageContainer>
  )
}
