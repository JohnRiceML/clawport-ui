import { NextResponse } from 'next/server'
import { createGoogleDocFromMarkdown } from '@/lib/google-doc-export'
import { getGoogleWorkspaceConfig } from '@/lib/integrations'

/**
 * GET — check whether Google Drive integration is configured.
 * Returns { enabled: boolean }
 */
export async function GET() {
  const config = getGoogleWorkspaceConfig()
  return NextResponse.json({ enabled: config?.driveEnabled ?? false })
}

/**
 * POST — create a Google Doc from markdown content.
 *
 * Body: { title: string, markdown: string }
 * Returns: { url: string } — the Google Docs URL
 */
export async function POST(request: Request) {
  const config = getGoogleWorkspaceConfig()
  if (!config?.driveEnabled) {
    return NextResponse.json(
      { error: 'Google Drive integration is not configured' },
      { status: 400 },
    )
  }

  let body: { title?: string; markdown?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title = 'Response', markdown = '' } = body
  if (!markdown.trim()) {
    return NextResponse.json({ error: 'No content provided' }, { status: 400 })
  }

  try {
    const url = await createGoogleDocFromMarkdown({ title, markdown })
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Google Doc export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
