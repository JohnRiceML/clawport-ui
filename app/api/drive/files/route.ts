import { NextResponse } from 'next/server'
import { searchDriveFiles } from '@/lib/google-drive'

/**
 * GET /api/drive/files?q=search+term
 *
 * Search Google Drive files by name. Returns { files: DriveFile[] }.
 * Returns an empty array if Drive is not configured.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''

  try {
    const files = await searchDriveFiles(query)
    return NextResponse.json({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Drive file search error:', message)
    return NextResponse.json({ files: [], error: message }, { status: 500 })
  }
}
