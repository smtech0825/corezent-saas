/**
 * @파일: dashboard/test/page.tsx
 * @설명: searchParams 테스트용 임시 페이지
 */

export const dynamic = 'force-dynamic'

export default async function TestPage(props: {
  searchParams: Promise<{ page?: string }>
}) {
  // Step 1: searchParams 접근
  let sp: Record<string, unknown> = {}
  let step = 'init'
  try {
    step = 'awaiting searchParams'
    sp = await props.searchParams
    step = 'searchParams resolved'
  } catch (e: unknown) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-xl font-bold text-red-400 mb-4">searchParams FAILED</h1>
        <p>Step: {step}</p>
        <pre className="bg-red-900/30 p-4 rounded mt-2">{String(e)}</pre>
        <pre className="bg-red-900/30 p-4 rounded mt-2">
          typeof searchParams: {typeof props.searchParams}
        </pre>
      </div>
    )
  }

  return (
    <div className="p-8 text-white">
      <h1 className="text-xl font-bold text-emerald-400 mb-4">searchParams OK</h1>
      <pre className="bg-emerald-900/30 p-4 rounded">{JSON.stringify(sp, null, 2)}</pre>
      <p className="mt-4 text-[#94A3B8]">Step: {step}</p>
    </div>
  )
}
