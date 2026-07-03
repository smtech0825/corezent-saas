/**
 * @파일: admin/logs/page.tsx
 * @설명: 관리자 모니터링 로그 — 이메일 발송(성공/실패)·웹훅 처리 실패 기록 목록(최근 200건).
 *        notification_logs(마이그레이션 034)를 조회한다. 테이블 미적용 시 안내를 표시한다.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata = { title: '모니터링 로그' }

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface LogRow {
  id: string
  kind: string
  status: string
  event: string | null
  target: string | null
  error: string | null
  created_at: string
}

export default async function LogsPage() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notification_logs')
    .select('id, kind, status, event, target, error, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const logs = (data ?? []) as LogRow[]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-serif">모니터링 로그</h1>
        <p className="text-sm text-ink-soft mt-1">이메일 발송·웹훅 처리 결과 (최근 200건).</p>
      </div>

      {error ? (
        <div className="border border-caution/20 bg-caution-soft rounded-2xl p-5 text-sm text-caution">
          로그 테이블이 아직 준비되지 않았습니다. 마이그레이션{' '}
          <span className="font-mono text-ink">034_notification_logs.sql</span> 을 Supabase에 적용해 주세요.
        </div>
      ) : logs.length === 0 ? (
        <div className="border border-rule bg-paper-raised rounded-2xl py-16 text-center text-sm text-ink-faint">
          기록된 로그가 없습니다.
        </div>
      ) : (
        <div className="border border-rule bg-paper-raised rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="text-left px-5 py-3 text-xs text-ink-faint font-medium">종류</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">상태</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">이벤트</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">대상</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">오류</th>
                  <th className="text-left px-4 py-3 text-xs text-ink-faint font-medium">시각</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-rule hover:bg-paper-shade transition-colors">
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{l.kind === 'email' ? '이메일' : '웹훅'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        l.status === 'success'
                          ? 'text-ok bg-ok-soft'
                          : 'text-danger bg-danger-soft'
                      }`}>
                        {l.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft truncate max-w-[200px]">{l.event ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-soft truncate max-w-[180px]">{l.target ?? '—'}</td>
                    <td className="px-4 py-3 text-danger truncate max-w-[240px]" title={l.error ?? ''}>{l.error ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
