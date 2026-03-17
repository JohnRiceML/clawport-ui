/**
 * Library sync — downloads files from a configured cloud storage folder
 * (Google Drive or OneDrive) and writes them into $WORKSPACE_PATH/library/.
 *
 * Config is persisted to $WORKSPACE_PATH/clawport/library.json.
 * A manifest of synced files is kept at $WORKSPACE_PATH/library/.sync-manifest.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs'
import { join, extname } from 'path'
import type { LibraryConfig, LibrarySyncResult } from './types'
import { listFolderFiles, downloadDriveFile } from './google-drive'
import { listOneDriveFolder, downloadOneDriveFile, extractOneDriveFolderIdFromUrl } from './onedrive'
import { getGoogleWorkspaceConfig } from './integrations'

const DEFAULT_CONFIG: LibraryConfig = {
  enabled: false,
  source: 'google_drive',
  folderUrl: '',
  folderId: '',
  syncSchedule: '0 2 * * *',
  onedriveTenantId: '',
  onedriveClientId: '',
  onedriveClientSecret: '',
  onedriveFolderUrl: '',
  onedriveFolderId: '',
  lastSync: null,
}

function configPath(): string {
  const workspacePath = process.env.WORKSPACE_PATH
  if (!workspacePath) throw new Error('WORKSPACE_PATH is not set')
  return join(workspacePath, 'clawport', 'library.json')
}

function libraryDir(): string {
  const workspacePath = process.env.WORKSPACE_PATH
  if (!workspacePath) throw new Error('WORKSPACE_PATH is not set')
  return join(workspacePath, 'library')
}

export function loadLibraryConfig(): LibraryConfig {
  try {
    const path = configPath()
    if (!existsSync(path)) return { ...DEFAULT_CONFIG }
    const raw = readFileSync(path, 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveLibraryConfig(config: LibraryConfig): void {
  const path = configPath()
  const dir = join(path, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8')
}

interface SyncManifest {
  files: Record<string, string> // filename -> lastModified (ISO string)
  syncedAt: number
}

function loadManifest(libDir: string): SyncManifest {
  const path = join(libDir, '.sync-manifest.json')
  if (!existsSync(path)) return { files: {}, syncedAt: 0 }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SyncManifest
  } catch {
    return { files: {}, syncedAt: 0 }
  }
}

function saveManifest(libDir: string, manifest: SyncManifest): void {
  writeFileSync(join(libDir, '.sync-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
}

/**
 * Extract a Google Drive folder ID from a URL or return as-is.
 */
function extractDriveFolderIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // https://drive.google.com/drive/folders/{id}
    const match = parsed.pathname.match(/\/folders\/([^/?]+)/)
    if (match) return match[1]
    // ?id= param (older links)
    const id = parsed.searchParams.get('id')
    if (id) return id
  } catch {
    // not a URL
  }
  return url
}

/**
 * Sanitize a filename to be safe for the filesystem.
 */
function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim()
}

/**
 * Determine the output filename. For Google Workspace docs exported as
 * text/CSV we append an extension if the original name lacks one.
 */
function outputFilename(name: string, mimeType: string): string {
  const safe = safeFilename(name)
  if (extname(safe)) return safe
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return `${safe}.csv`
  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.presentation'
  ) {
    return `${safe}.txt`
  }
  return safe
}

export async function syncLibrary(config: LibraryConfig): Promise<LibrarySyncResult> {
  const libDir = libraryDir()
  if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true })

  const manifest = loadManifest(libDir)
  const previousFiles = new Set(Object.keys(manifest.files))

  let added = 0
  let updated = 0
  let total = 0
  const currentFiles = new Set<string>()

  try {
    if (config.source === 'google_drive') {
      const gwsConfig = getGoogleWorkspaceConfig()
      if (!gwsConfig) throw new Error('Google Workspace is not configured')

      const folderId =
        config.folderId || extractDriveFolderIdFromUrl(config.folderUrl)
      if (!folderId) throw new Error('Google Drive folder ID is not configured')

      const files = await listFolderFiles(folderId, gwsConfig)

      for (const file of files) {
        const outName = outputFilename(file.name, file.mimeType)
        currentFiles.add(outName)
        total++

        const prevModified = manifest.files[outName]
        const changed = prevModified !== file.modifiedTime

        if (!changed && existsSync(join(libDir, outName))) continue

        const content = await downloadDriveFile(file.id, file.mimeType, gwsConfig)
        if (content === null) {
          total-- // skipped binary
          currentFiles.delete(outName)
          continue
        }

        writeFileSync(join(libDir, outName), content, 'utf-8')
        manifest.files[outName] = file.modifiedTime

        if (previousFiles.has(outName)) {
          updated++
        } else {
          added++
        }
      }
    } else {
      // OneDrive
      const oneDriveConfig = {
        tenantId: config.onedriveTenantId,
        clientId: config.onedriveClientId,
        clientSecret: config.onedriveClientSecret,
      }
      if (!oneDriveConfig.tenantId || !oneDriveConfig.clientId || !oneDriveConfig.clientSecret) {
        throw new Error('OneDrive credentials are not configured')
      }

      const folderId =
        config.onedriveFolderId || extractOneDriveFolderIdFromUrl(config.onedriveFolderUrl)
      if (!folderId) throw new Error('OneDrive folder ID is not configured')

      const files = await listOneDriveFolder(folderId, oneDriveConfig)

      for (const file of files) {
        const outName = safeFilename(file.name)
        currentFiles.add(outName)
        total++

        const prevModified = manifest.files[outName]
        const changed = prevModified !== file.lastModifiedDateTime

        if (!changed && existsSync(join(libDir, outName))) continue

        const content = await downloadOneDriveFile(file, oneDriveConfig)
        if (content === null) {
          total-- // skipped binary
          currentFiles.delete(outName)
          continue
        }

        writeFileSync(join(libDir, outName), content, 'utf-8')
        manifest.files[outName] = file.lastModifiedDateTime

        if (previousFiles.has(outName)) {
          updated++
        } else {
          added++
        }
      }
    }

    // Remove files no longer in the remote folder
    let removed = 0
    for (const prev of previousFiles) {
      if (!currentFiles.has(prev)) {
        const filePath = join(libDir, prev)
        if (existsSync(filePath)) {
          rmSync(filePath)
          removed++
        }
        delete manifest.files[prev]
      }
    }

    const syncedAt = Date.now()
    manifest.syncedAt = syncedAt
    saveManifest(libDir, manifest)

    return { ok: true, added, updated, removed, total, syncedAt }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { ok: false, added: 0, updated: 0, removed: 0, total: 0, error, syncedAt: Date.now() }
  }
}
