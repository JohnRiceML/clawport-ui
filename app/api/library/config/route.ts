import { NextResponse } from 'next/server'
import { loadLibraryConfig, saveLibraryConfig } from '@/lib/library-sync'
import type { LibraryConfig } from '@/lib/types'

export async function GET() {
  try {
    const config = loadLibraryConfig()
    return NextResponse.json(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Partial<LibraryConfig>
    const current = loadLibraryConfig()
    const updated: LibraryConfig = { ...current, ...body }
    saveLibraryConfig(updated)
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
