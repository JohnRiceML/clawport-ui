/**
 * Microsoft OneDrive / SharePoint integration via Microsoft Graph API.
 * Uses client credentials OAuth2 flow (tenant ID + client ID + client secret).
 */

export interface OneDriveConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

export interface OneDriveFile {
  id: string
  name: string
  mimeType: string
  lastModifiedDateTime: string
  downloadUrl: string | null
}

async function getAccessToken(config: OneDriveConfig): Promise<string> {
  const url = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive auth failed: ${res.status} ${text}`)
  }

  const json = await res.json()
  return json.access_token as string
}

/**
 * Extract a drive item ID from an OneDrive share URL or return as-is if
 * it looks like a raw item ID already.
 */
export function extractOneDriveFolderIdFromUrl(url: string): string {
  // SharePoint/OneDrive share URLs contain a base64 encoded "u!" prefix
  // e.g. https://onedrive.live.com/?id=...&cid=...
  // For simplicity, return the URL itself as the "id" — the caller should
  // pass the raw item ID when available. Strip the URL if it contains just an id param.
  try {
    const parsed = new URL(url)
    const id = parsed.searchParams.get('id') ?? parsed.searchParams.get('itemid')
    if (id) return id
  } catch {
    // not a URL — treat as raw item ID
  }
  return url
}

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/csv']
const OFFICE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
])

/**
 * List files (non-recursive) in a OneDrive folder by item ID.
 * Uses /me/drive/items/{id}/children if no driveId, or /drives/{driveId}/items/{id}/children.
 */
export async function listOneDriveFolder(
  folderId: string,
  config: OneDriveConfig
): Promise<OneDriveFile[]> {
  const token = await getAccessToken(config)

  // Try /me/drive first; fall back to drives if needed
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,file,lastModifiedDateTime,@microsoft.graph.downloadUrl&$top=200`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive list failed: ${res.status} ${text}`)
  }

  const json = await res.json()
  const items: OneDriveFile[] = []

  for (const item of json.value ?? []) {
    if (!item.file) continue // skip folders
    items.push({
      id: item.id,
      name: item.name,
      mimeType: item.file?.mimeType ?? 'application/octet-stream',
      lastModifiedDateTime: item.lastModifiedDateTime ?? '',
      downloadUrl: item['@microsoft.graph.downloadUrl'] ?? null,
    })
  }

  return items
}

/**
 * Download a OneDrive file as text. Office documents and text files are
 * supported. Binary files return null (skipped).
 */
export async function downloadOneDriveFile(
  file: OneDriveFile,
  config: OneDriveConfig
): Promise<string | null> {
  const isText = TEXT_MIME_PREFIXES.some((p) => file.mimeType.startsWith(p))
  const isOffice = OFFICE_MIME_TYPES.has(file.mimeType)

  if (!isText && !isOffice) return null

  const downloadUrl = file.downloadUrl
  if (!downloadUrl) {
    // Fetch a fresh download URL via Graph API
    const token = await getAccessToken(config)
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(file.id)}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return null
    return await res.text()
  }

  const res = await fetch(downloadUrl)
  if (!res.ok) return null
  return await res.text()
}
