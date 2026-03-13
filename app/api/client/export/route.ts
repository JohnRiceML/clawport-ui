import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { exportStakeholderSummary, parseStakeholderRange } from '@/lib/stakeholder/server'

export async function POST(request: Request) {
  let body: { range?: string; title?: string }

  try {
    body = await request.json()
  } catch {
    return apiErrorResponse(new Error('Invalid JSON body'), 'Invalid JSON body', 400)
  }

  const range = body.range == null ? '7d' : parseStakeholderRange(body.range)
  if (!range) {
    return apiErrorResponse(
      new Error('Unsupported range. Expected one of: 24h, 7d, 30d.'),
      'Unsupported range',
      400,
    )
  }

  try {
    const payload = await exportStakeholderSummary({
      range,
      title: body.title,
      defaultTitle: 'Client Summary',
    })
    return NextResponse.json(payload)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to export client summary')
  }
}
