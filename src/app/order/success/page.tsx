/**
 * @파일: app/order/success/page.tsx
 * @설명: 결제 완료(주문 확인) 페이지 — LS 체크아웃 완료 후 도착하는 곳.
 *        로그인 사용자의 최근 주문 영수증 요약(금액은 cents÷100 = formatKRW) + 다음 단계 안내.
 *        ⚠️ LS 리다이렉트 URL 연결은 LS 제품/스토어 설정(외부)에서 이 경로로 지정한다(결제 로직 미접촉).
 *        결제 반영(웹훅)이 잠시 지연될 수 있어 "처리 중" 안내를 함께 둔다.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Download, KeyRound, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatKRW } from '@/lib/money'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 완료',
  description: '결제가 완료되었습니다. 다음 단계를 안내합니다.',
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

const ORDER_STATUS: Record<string, string> = { paid: '결제 완료', pending: '처리 중', refunded: '환불됨', cancelled: '취소됨' }

export default async function OrderSuccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 사용자의 가장 최근 주문 1건 (영수증 요약용)
  let order: { id: string; amount: number; currency: string | null; status: string; created_at: string; productName: string } | null = null
  if (user) {
    const { data: o } = await supabase
      .from('orders')
      .select('id, amount, currency, status, created_at, product_price_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (o) {
      let productName = 'CoreZent 제품'
      if (o.product_price_id) {
        const { data: pp } = await supabase
          .from('product_prices')
          .select('products(name)')
          .eq('id', o.product_price_id)
          .maybeSingle()
        const prod = (pp as unknown as { products: { name: string } | null } | null)?.products
        if (prod?.name) productName = prod.name
      }
      order = {
        id: o.id as string,
        amount: (o.amount as number) ?? 0,
        currency: (o.currency as string) ?? 'KRW',
        status: o.status as string,
        created_at: o.created_at as string,
        productName,
      }
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0B1120]">
        <section className="relative pt-36 pb-32 px-6">
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">결제가 완료되었습니다</h1>
            <p className="text-[#94A3B8] mb-10">
              주문해 주셔서 감사합니다. 결제 반영에는 잠시 시간이 걸릴 수 있습니다.
            </p>

            {/* 영수증 요약 */}
            {order ? (
              <div className="text-left border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 mb-10">
                <h2 className="text-sm font-semibold text-white mb-4">주문 요약</h2>
                <Row label="제품">{order.productName}</Row>
                <Row label="금액">{formatKRW(order.amount)}</Row>
                <Row label="상태">{ORDER_STATUS[order.status] ?? order.status}</Row>
                <Row label="주문일">{fmtDate(order.created_at)}</Row>
                <div className="pt-3">
                  <Link href="/dashboard/billing" className="text-sm text-[#38BDF8] hover:underline">전체 주문 내역 보기 →</Link>
                </div>
              </div>
            ) : (
              <div className="text-left border border-[#1E293B] bg-[#111A2E] rounded-2xl p-6 mb-10">
                <p className="text-sm text-[#94A3B8]">
                  주문 내역은 잠시 후 <Link href="/dashboard/billing" className="text-[#38BDF8] hover:underline">결제 내역</Link>에서 확인하실 수 있습니다.
                  {!user && <> 먼저 <Link href="/auth/login" className="text-[#38BDF8] hover:underline">로그인</Link>해 주세요.</>}
                </p>
              </div>
            )}

            {/* 다음 단계 */}
            <div className="text-left">
              <h2 className="text-sm font-semibold text-white mb-4">다음 단계</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <NextStep href="/dashboard/licenses" icon={<Download size={18} className="text-[#38BDF8]" />} title="앱 다운로드" desc="내 라이선스에서 설치파일을 받으세요." />
                <NextStep href="/activate" icon={<KeyRound size={18} className="text-[#38BDF8]" />} title="라이선스 인증" desc="앱에 라이선스 키를 입력해 인증하세요." />
                <NextStep href="/dashboard" icon={<LayoutDashboard size={18} className="text-[#38BDF8]" />} title="시작하기" desc="대시보드에서 온보딩을 확인하세요." />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 py-2 border-b border-[#1E293B]/60 last:border-0">
      <span className="text-xs text-[#475569] pt-0.5">{label}</span>
      <span className="text-sm text-white">{children}</span>
    </div>
  )
}

function NextStep({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="block border border-[#1E293B] bg-[#111A2E] hover:border-[#38BDF8]/30 rounded-2xl p-5 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-[#0B1120] border border-[#1E293B] flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-[#475569] mt-1">{desc}</p>
    </Link>
  )
}
