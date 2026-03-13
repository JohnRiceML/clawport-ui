import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { loadStakeholderSummary, parseStakeholderRange } from '@/lib/stakeholder/server'

export async function GET(request: NextRequest) {
  const rawRange = request.nextUrl.searchParams.get('range')
  const range = rawRange == null ? '7d' : parseStakeholderRange(rawRange)

  if (!range) {
    return apiErrorResponse(
      new Error('Unsupported range. Expected one of: 24h, 7d, 30d.'),
      'Unsupported range',
      400,
    )
  }

  try {
    const summary = await loadStakeholderSummary(range)
    return NextResponse.json(summary)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to build stakeholder summary')
  }
}
