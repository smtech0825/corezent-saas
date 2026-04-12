import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createAdminClient } from '@/lib/supabase/admin'
import PricingClient from './PricingClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing — CoreZent',
  description: 'Simple, transparent pricing. Pick the tools you need or bundle everything for maximum savings.',
}


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
      </main>

      <Footer />
    </div>
  )
}
