'use client'

/**
 * @컴포넌트: ProductList
 * @설명: 관리자 제품 목록 — 위/아래 화살표로 순서 변경 + API 호출
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import DeleteButton from './DeleteButton'

export interface ProductRow {
  id: string
  name: string
  slug: string
  category: string
  tagline: string
  is_active: boolean
  monthlyLabel: string
  annualLabel: string
}

type DeleteResult =
  | { ok: true; mode: 'deleted' | 'deactivated' }
  | { ok: false; message: string }

interface Props {
  products: ProductRow[]
  onDelete: (id: string) => Promise<DeleteResult>
}

const categoryColors: Record<string, string> = {
  desktop: 'text-mark bg-mark/10',
  web: 'text-mark bg-mark/10',
  'chrome-extension': 'text-mark bg-mark/10',
  mobile: 'text-mark bg-mark/10',
}

export default function ProductList({ products: initial, onDelete }: Props) {
  const [items, setItems] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [delMsg, setDelMsg] = useState<{ text: string; kind: 'ok' | 'warn' | 'error' } | null>(null)

  // 이 화면의 조작은 순서 변경과 삭제 두 가지다. 하나가 진행 중이면 다른 하나도 막는다
  // — 한쪽만 막으면 순서 저장이 실패하는 사이에 지운 제품이 되돌리기로 되살아난다.
  const busy = isPending || deleting

  /**
   * @함수명: handleDelete
   * @설명: 삭제 서버 액션 호출 후 결과에 따라 목록을 즉시 갱신(완전삭제=행 제거 / 비활성화=상태 변경)하고 안내 메시지를 표시.
   * @매개변수: id - 제품 ID
   */
  async function handleDelete(id: string) {
    // 순서 변경이 진행 중이면 받지 않는다(그 반대도 마찬가지).
    if (busy) return
    setDeleting(true)
    setDelMsg(null)
    try {
      await runDelete(id)
    } finally {
      setDeleting(false)
    }
  }

  /**
   * @함수명: runDelete
   * @설명: 삭제 서버 기능을 부르고 결과에 따라 목록과 안내 문구를 갱신합니다.
   * @매개변수: id - 제품 ID
   * @반환값: 없음
   */
  async function runDelete(id: string) {
    const res = await onDelete(id)
    if (res.ok && res.mode === 'deleted') {
      setItems((prev) => prev.filter((p) => p.id !== id))
      setDelMsg({ text: '제품이 삭제되었습니다.', kind: 'ok' })
    } else if (res.ok && res.mode === 'deactivated') {
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)))
      setDelMsg({
        text: '주문·라이선스 이력이 있어 완전 삭제 대신 비활성화했습니다. 데이터는 보존되며 공개 스토어에서는 숨겨집니다.',
        kind: 'warn',
      })
    } else {
      setDelMsg({ text: res.ok ? '삭제 실패' : `삭제 실패: ${res.message}`, kind: 'error' })
    }
  }

  /**
   * @함수명: rollbackOrder
   * @설명: 순서 저장이 실패했을 때 화면 순서를 이전 순서로 되돌립니다. 그 사이에 목록에서
   *        사라진 제품은 되살리지 않습니다 — 지운 제품이 되돌리기로 다시 나타나면 안 됩니다.
   * @매개변수: order - 되돌릴 기준이 되는 제품 id 나열
   * @반환값: 없음
   */
  function rollbackOrder(order: string[]) {
    setItems((cur) => [...cur].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)))
  }

  function swap(fromIdx: number, toIdx: number) {
    // 처리 중에는 받지 않는다(버튼도 비활성이지만 한 번 더 막는다) — 저장이 끝나기 전에 또 바꾸면
    // 아직 서버가 받아들이지 않은 순서 위에 다시 쌓여, 실패했을 때 되돌릴 기준이 없어진다.
    if (busy) return
    if (toIdx < 0 || toIdx >= items.length) return

    // 되돌릴 기준은 "바로 지금 저장돼 있는 순서"의 id 나열이다. 목록을 통째로 복사해 두면
    // 그 사이에 지워진 제품까지 함께 되살아나므로, 순서만 기억하고 되돌릴 때 현재 목록에
    // 남아 있는 제품에만 적용한다.
    const prevOrder = items.map((p) => p.id)
    const next = [...items]
    const temp = next[fromIdx]
    next[fromIdx] = next[toIdx]
    next[toIdx] = temp
    setItems(next)
    setSaveMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/products/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ordered: next.map((p) => p.id) }),
        })
        if (res.ok) {
          setSaveMsg('순서 저장됨')
          setTimeout(() => setSaveMsg(null), 2000)
          return
        }
        // 제품 순서는 한 건씩 따로 저장되므로 중간에 실패하면 일부만 바뀌어 있을 수 있다.
        // 이 목록은 화면을 열 때 받은 값을 그대로 들고 있어서, 여기서 서버의 실제 순서를
        // 다시 받아올 방법이 없다(목록 구조 개선은 별도 작업). 그래서 "다시 불러온다"고
        // 말하지 않고, 새로고침해서 직접 확인해 달라고 사실대로 안내한다.
        rollbackOrder(prevOrder)
        setSaveMsg('순서 변경에 실패했습니다. 일부만 저장됐을 수 있으니 화면을 새로고침해 실제 순서를 확인해 주세요.')
      } catch (err) {
        console.error('[ProductList] 순서 변경 요청 실패:', err)
        rollbackOrder(prevOrder)
        setSaveMsg('순서 변경 요청을 보내지 못했습니다. 저장됐을 수도 있으니 화면을 새로고침해 실제 순서를 확인해 주세요.')
      }
    })
  }

  return (
    <div className="space-y-2">
      {/* 상태 메시지 */}
      {isPending && <p className="text-xs text-mark px-1">저장 중…</p>}
      {saveMsg && !isPending && (
        <p className={`text-xs px-1 ${saveMsg.includes('실패') ? 'text-danger' : 'text-ok'}`}>
          {saveMsg}
        </p>
      )}
      {delMsg && (
        <p className={`text-xs px-1 ${
          delMsg.kind === 'error' ? 'text-danger' : delMsg.kind === 'warn' ? 'text-caution' : 'text-ok'
        }`}>
          {delMsg.text}
        </p>
      )}

      <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left px-3 py-3 text-xs text-ink-faint font-medium w-16">순서</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">제품</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">카테고리</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">월간</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">연간</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">상태</th>
                <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, idx) => (
                <tr key={p.id} className="border-b border-rule hover:bg-paper-shade transition-colors">
                  {/* 순서 변경 화살표 */}
                  <td className="px-3 py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => swap(idx, idx - 1)}
                        disabled={idx === 0 || busy}
                        className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="위로 이동"
                        aria-label="순서 위로 이동"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <span className="text-[10px] text-ink-faint tabular-nums font-mono">{idx + 1}</span>
                      <button
                        onClick={() => swap(idx, idx + 1)}
                        disabled={idx === items.length - 1 || busy}
                        className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="아래로 이동"
                        aria-label="순서 아래로 이동"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-ink-faint mt-0.5">{p.tagline}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${categoryColors[p.category] ?? 'text-ink-soft bg-paper-shade'}`}>
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-soft">{p.monthlyLabel}</td>
                  <td className="px-4 py-4 text-ink-soft">{p.annualLabel}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      p.is_active ? 'text-ok bg-ok-soft' : 'text-ink-soft bg-paper-shade'
                    }`}>
                      {p.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="p-1.5 text-ink-faint hover:text-mark transition-colors rounded"
                        title="편집"
                        aria-label={`${p.name} 제품 편집`}
                      >
                        <Pencil size={14} />
                      </Link>
                      <DeleteButton
                        productId={p.id}
                        productName={p.name}
                        onDelete={handleDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
