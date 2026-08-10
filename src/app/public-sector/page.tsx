/**
 * @파일: app/public-sector/page.tsx
 * @설명: 기관 도입 안내 페이지 — 부서 단위 도입을 검토하는 공공기관 담당자용.
 *        가격표는 product_prices 옵션 행을 읽어 그린다(대수를 코드에 나열하지 않는다).
 *        옵션이 늘거나 금액이 바뀌면 이 페이지도 자동으로 따라간다.
 *        조달청 등록번호는 front_settings에서 읽고, 값이 없으면 그 블록을 통째로 숨긴다.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPageMetadata } from '@/lib/seo'
import { formatPrice } from '@/lib/price'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Section, { SectionHeader } from '@/components/ui/Section'
import QuoteForm from './QuoteForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  path: '/public-sector',
  title: '기관 도입 안내',
  description: '부서 단위 도입을 검토하는 공공기관 담당자를 위한 안내 — 대수별 요금, 조달청 등록번호, 견적 요청.',
})

/** 옵션 한 줄 — 같은 대수의 월/연 금액을 함께 담는다 */
interface OptionRow {
  label: string
  monthly: number | null
  annual: number | null
  sortKey: number
}

/**
 * @함수명: buildOptionRows
 * @설명: 한 제품의 가격 행들을 "대수(축2 라벨)" 기준으로 묶어 표 한 줄씩 만듭니다.
 *        대수 목록을 코드에 두지 않고 데이터에서 그대로 가져옵니다.
 * @매개변수: prices - 해당 제품의 활성 가격 행 배열
 * @반환값: 금액 오름차순으로 정렬된 표 줄 배열
 */
function buildOptionRows(prices: PriceRow[]): OptionRow[] {
  const map = new Map<string, OptionRow>()
  for (const p of prices) {
    const label = (p.option_axis2_label ?? '').trim() || (p.license_tier ?? '').trim()
    if (!label) continue
    const cur = map.get(label) ?? { label, monthly: null, annual: null, sortKey: Number.MAX_SAFE_INTEGER }
    const amount = Number(p.price)
    if (!Number.isFinite(amount)) continue
    if (p.interval === 'annual') cur.annual = amount
    else if (p.interval === 'monthly') cur.monthly = amount
    // 정렬은 월 금액(없으면 연 금액) 기준 — 대수가 늘수록 금액이 커지는 구조를 그대로 따른다
    const basis = cur.monthly ?? cur.annual ?? Number.MAX_SAFE_INTEGER
    cur.sortKey = basis
    map.set(label, cur)
  }
  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey)
}

interface PriceRow {
  product_id: string
  interval: string | null
  price: number
  option_axis2_label: string | null
  license_tier: string | null
}

export default async function PublicSectorPage() {
  const client = createAdminClient()

  const [productsRes, pricesRes, settingsRes] = await Promise.all([
    client.from('products').select('id, name, slug, system_requirements').eq('is_active', true).order('order_index'),
    client
      .from('product_prices')
      .select('product_id, interval, price, option_axis2_label, license_tier')
      .eq('is_active', true),
    client.from('front_settings').select('key, value').in('key', ['procurement_item_number', 'procurement_class_number']),
  ])

  const products = productsRes.data ?? []
  const prices = (pricesRes.data ?? []) as PriceRow[]
  const settings = new Map((settingsRes.data ?? []).map((r) => [r.key, (r.value ?? '').trim()]))

  const itemNo = settings.get('procurement_item_number') ?? ''
  const classNo = settings.get('procurement_class_number') ?? ''
  const hasProcurement = Boolean(itemNo || classNo)

  // 대수 옵션이 2가지 이상인 제품만 "부서 단위 도입" 대상으로 본다.
  // 특정 제품 slug를 코드에 박지 않는다 — 옵션 구조를 갖춘 제품이면 자동으로 표에 나온다.
  const tables = products
    .map((p) => ({ product: p, rows: buildOptionRows(prices.filter((r) => r.product_id === p.id)) }))
    .filter((t) => t.rows.length > 1)

  return (
    <div className="theme-paper min-h-screen bg-paper text-ink flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* 머리말 */}
        <Section width="text" className="pb-8 sm:pb-10">
          <SectionHeader
            label="기관 도입"
            title="부서 단위 도입을 검토하시나요?"
            sub="대수별 요금과 견적 요청 경로를 한 페이지에 정리했습니다."
            headingLevel="h1"
          />
        </Section>

        {/* 조달청 등록 정보 — 값이 없으면 블록 자체를 숨긴다 */}
        {hasProcurement && (
          <Section tone="shade" width="text" className="py-10 sm:py-12">
            <h2 className="text-lg font-bold font-serif text-ink mb-4">조달청 등록 정보</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {itemNo && (
                <div className="border border-rule bg-paper-raised rounded-xl px-5 py-4">
                  <dt className="text-xs text-ink-faint">물품식별번호</dt>
                  <dd className="text-xl font-mono font-bold text-ink mt-1 tracking-wide">{itemNo}</dd>
                </div>
              )}
              {classNo && (
                <div className="border border-rule bg-paper-raised rounded-xl px-5 py-4">
                  <dt className="text-xs text-ink-faint">물품분류번호</dt>
                  <dd className="text-xl font-mono font-bold text-ink mt-1 tracking-wide">{classNo}</dd>
                </div>
              )}
            </dl>
          </Section>
        )}

        {/* 대수별 요금 — DB 옵션 행을 그대로 읽어 그린다 */}
        <Section width="content">
          <SectionHeader label="요금" title="대수별 요금" sub="관리자에 등록된 옵션을 그대로 표시합니다." />
          {tables.length === 0 ? (
            <p className="text-sm text-ink-soft text-center">
              현재 표시할 대수별 옵션이 없습니다.{' '}
              <Link href="/pricing" className="text-mark underline">요금 페이지</Link>에서 확인해 주세요.
            </p>
          ) : (
            <div className="space-y-10">
              {tables.map(({ product, rows }) => (
                <div key={product.id}>
                  <h3 className="text-base font-bold font-serif text-ink mb-3">{product.name}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-ink bg-paper-shade px-4 py-2.5 text-left font-sans font-bold text-[13px] tracking-wider">구분</th>
                          <th className="border border-ink bg-paper-shade px-4 py-2.5 text-right font-sans font-bold text-[13px] tracking-wider">월간</th>
                          <th className="border border-ink bg-paper-shade px-4 py-2.5 text-right font-sans font-bold text-[13px] tracking-wider">연간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.label}>
                            <td className="border border-ink px-4 py-3 font-serif font-bold text-ink whitespace-nowrap">{r.label}</td>
                            <td className="border border-ink px-4 py-3 text-right tabular-nums text-ink-soft">
                              {r.monthly !== null ? formatPrice(r.monthly) : '—'}
                            </td>
                            <td className="border border-ink px-4 py-3 text-right tabular-nums text-ink-soft">
                              {r.annual !== null ? formatPrice(r.annual) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {product.system_requirements && (
                    <p className="text-xs text-ink-faint mt-2">사용 환경 · {product.system_requirements}</p>
                  )}
                </div>
              ))}
              <p className="text-xs text-ink-faint">
                요금 페이지와 같은 값을 표시합니다. 기관 구매 시 필요한 조건은 견적서로 안내드립니다.
              </p>
            </div>
          )}
        </Section>

        {/* 기관 예산으로 구매하기 — 절차만 안내한다 */}
        <Section tone="shade" width="text">
          <SectionHeader label="구매 절차" title="기관 예산으로 도입하실 때" />
          <ol className="space-y-4">
            {[
              ['견적 요청', '아래 폼에 기관·부서·도입 예정 PC 수를 남겨 주세요.'],
              ['견적서 회신', '입력하신 이메일로 견적서를 보내드립니다.'],
              ['내부 절차 진행', '받으신 견적서로 부서 내 구매 절차를 진행하시면 됩니다.'],
              ['라이선스 전달', '구매가 확정되면 라이선스 키를 전달해 드립니다.'],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-mark/10 border border-mark/30 text-mark text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-sm text-ink-soft mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-faint mt-6">
            필요한 서류나 계약 방식은 기관마다 다릅니다. 견적 요청 시 필요한 서류를 함께 적어 주시면 확인해 회신드립니다.
          </p>
        </Section>

        {/* 보안 — 사용설명서에서 확인된 구조만 설명한다 */}
        <Section width="text">
          <SectionHeader label="보안" title="어떻게 동작하는지 그대로 말씀드립니다" />
          <div className="space-y-4 text-sm text-ink-soft leading-relaxed">
            <p>
              <b className="text-ink">AI 키는 본인 것을 등록해 사용합니다.</b> 앱이 자체 AI 키를 갖고 있지 않습니다.
              등록한 키는 그 PC에만 암호화되어 저장되며 외부로 전송되지 않습니다.
              AI 사용 내역과 비용은 사용하시는 분의 계정에서 관리됩니다.
            </p>
            <p>
              <b className="text-ink">라이선스는 PC에 연결됩니다.</b> 인증 시 PC 고유번호가 라이선스에 연결되며,
              키 하나는 PC 한 대에서 사용하는 방식입니다.
            </p>
            <div className="border border-caution/20 bg-caution-soft rounded-xl p-5">
              <p className="text-sm font-semibold text-caution mb-2">먼저 확인해 주세요</p>
              <ul className="space-y-1.5 text-sm text-ink-soft list-disc pl-5">
                <li>인터넷에 연결된 PC에서 사용하는 프로그램입니다. 폐쇄망(내부망) 전용 환경은 지원하지 않습니다.</li>
                <li>문서 생성에 외부 AI 서비스를 이용합니다. 등록하신 AI 키로 해당 서비스에 요청이 전송됩니다.</li>
                <li>도입 전 기관의 보안 지침에 맞는지 담당 부서와 확인해 주시기 바랍니다.</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 견적 요청 */}
        <Section id="quote" tone="shade" width="text">
          <SectionHeader label="견적 요청" title="견적서를 보내드립니다" sub="기관명과 이메일만 있으면 요청하실 수 있습니다." />
          <QuoteForm />
        </Section>
      </main>

      <Footer />
    </div>
  )
}
