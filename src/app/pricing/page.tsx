import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createAdminClient } from '@/lib/supabase/admin'
import PricingClient from './PricingClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — CoreZent',
  description: 'Simple, transparent pricing. Pick the tools you need or bundle everything for maximum savings.',
}

const faqs = [
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or downgrade at any time. Changes take effect at the start of the next billing cycle.',
  },
  {
    q: 'What is a license key?',
    a: 'A license key is a unique serial number (XXXX-XXXX-XXXX-XXXX format) generated per purchase that your customers use to activate your software.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Each product comes with a 7-day free trial. No credit card required to start.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards via Lemon Squeezy. Enterprise customers can also pay via bank transfer or invoice.',
  },
  {
    q: 'Is there an annual discount?',
    a: 'Yes — paying annually saves you up to 25%. The discount is applied automatically when you switch to annual billing.',
  },
]

export default async function PricingPage() {
  // DB에서 tags, pricing_features 조회 (slug 기준 매핑)
  const client = createAdminClient()
  const { data: dbProducts } = await client
    .from('products')
    .select('slug, tags, pricing_features')
    .eq('is_active', true)

  const dbMap: Record<string, { tags: string[]; pricing_features: string[] }> = {}
  for (const p of dbProducts ?? []) {
    if (p.slug) {
      dbMap[p.slug as string] = {
        tags: (p.tags ?? []) as string[],
        pricing_features: (p.pricing_features ?? []) as string[],
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] font-sans">
      <Navbar />

      <main>
        <PricingClient dbData={dbMap} />

        {/* FAQ */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="border border-[#1E293B] bg-[#111A2E] rounded-xl px-5 sm:px-8 py-6 hover:border-[#38BDF8]/30 transition-colors"
              >
                <h3 className="text-white font-semibold mb-3">{faq.q}</h3>
                <p className="text-[#94A3B8] text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[#94A3B8] text-sm mb-4">Still have questions?</p>
            <Link
              href="#support"
              className="inline-flex items-center gap-2 border border-[#1E293B] text-[#F1F5F9] font-medium px-6 py-3 rounded-lg hover:border-[#38BDF8] hover:text-[#38BDF8] transition-all duration-200"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
