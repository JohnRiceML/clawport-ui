import { NextResponse } from 'next/server'
import { loadLibraryConfig, saveLibraryConfig, syncLibrary } from '@/lib/library-sync'

export async function POST() {
  try {
    const config = loadLibraryConfig()

    if (!config.enabled) {
      return NextResponse.json({ error: 'Library sync is not enabled' }, { status: 400 })
    }

    const hasDriveFolder = config.source === 'google_drive'
      ? !!(config.folderId || config.folderUrl)
      : !!(config.onedriveFolderId || config.onedriveFolderUrl)

    if (!hasDriveFolder) {
      return NextResponse.json({ error: 'Library folder is not configured' }, { status: 400 })
    }

    const result = await syncLibrary(config)

    // Persist last sync result back into config
    saveLibraryConfig({ ...config, lastSync: result })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
