import { NextResponse } from 'next/server'
import { google } from 'googleapis'
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
 *
 * Auth is resolved from the OpenClaw workspace config:
 *   - gws_service_account → service account JSON + impersonate email
 *   - gws_oauth → falls back to application default credentials
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
    const auth = buildAuth(config)
    const docs = google.docs({ version: 'v1', auth })

    // Create a blank document
    const createRes = await docs.documents.create({
      requestBody: { title },
    })

    const documentId = createRes.data.documentId
    if (!documentId) {
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    // Insert content via batchUpdate
    const requests = markdownToDocRequests(markdown)
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      })
    }

    const url = `https://docs.google.com/document/d/${documentId}/edit`
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Google Doc export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Auth builder
// ---------------------------------------------------------------------------

function buildAuth(config: NonNullable<ReturnType<typeof getGoogleWorkspaceConfig>>) {
  if (config.authMethod === 'gws_service_account' && config.saJson) {
    const credentials = JSON.parse(config.saJson)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file',
      ],
      clientOptions: config.impersonateEmail
        ? { subject: config.impersonateEmail }
        : undefined,
    })
    return auth
  }

  // gws_oauth or composio — use application default credentials
  return new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })
}

// ---------------------------------------------------------------------------
// Markdown → Google Docs API requests
// ---------------------------------------------------------------------------

interface DocRequest {
  insertText?: { location: { index: number }; text: string }
  updateTextStyle?: {
    range: { startIndex: number; endIndex: number }
    textStyle: Record<string, unknown>
    fields: string
  }
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number }
    paragraphStyle: Record<string, unknown>
    fields: string
  }
}

/**
 * Convert markdown text to a sequence of Google Docs API batchUpdate requests.
 *
 * Strategy: insert all text first, then apply formatting passes.
 * Google Docs API indices are 1-based (index 1 = start of body).
 */
function markdownToDocRequests(markdown: string): DocRequest[] {
  const lines = markdown.split('\n')
  const requests: DocRequest[] = []
  const styleOps: DocRequest[] = []

  let index = 1 // Google Docs body starts at index 1

  for (const line of lines) {
    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = stripInlineMarkdown(headingMatch[2]) + '\n'
      requests.push({
        insertText: { location: { index }, text },
      })
      const namedStyle =
        level === 1 ? 'HEADING_1' :
        level === 2 ? 'HEADING_2' :
        level === 3 ? 'HEADING_3' : 'HEADING_4'
      styleOps.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: { namedStyleType: namedStyle },
          fields: 'namedStyleType',
        },
      })
      applyInlineStyles(headingMatch[2], index, styleOps)
      index += text.length
      continue
    }

    // Bullet list
    if (line.match(/^[-*]\s+/)) {
      const content = line.replace(/^[-*]\s+/, '')
      const text = stripInlineMarkdown(content) + '\n'
      requests.push({
        insertText: { location: { index }, text },
      })
      styleOps.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
            indentFirstLine: { magnitude: 36, unit: 'PT' },
            indentStart: { magnitude: 36, unit: 'PT' },
          },
          fields: 'namedStyleType,indentFirstLine,indentStart',
        },
      })
      // Add bullet character
      applyInlineStyles(content, index, styleOps)
      index += text.length
      continue
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/)
    if (numMatch) {
      const text = stripInlineMarkdown(numMatch[2]) + '\n'
      requests.push({
        insertText: { location: { index }, text },
      })
      styleOps.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + text.length },
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
            indentFirstLine: { magnitude: 36, unit: 'PT' },
            indentStart: { magnitude: 36, unit: 'PT' },
          },
          fields: 'namedStyleType,indentFirstLine,indentStart',
        },
      })
      applyInlineStyles(numMatch[2], index, styleOps)
      index += text.length
      continue
    }

    // Code fence (skip the ``` lines, insert code as monospace)
    if (line.startsWith('```')) {
      continue
    }

    // Regular text / code block lines
    const text = stripInlineMarkdown(line) + '\n'
    requests.push({
      insertText: { location: { index }, text },
    })
    applyInlineStyles(line, index, styleOps)
    index += text.length
  }

  // Style operations must come after all inserts, in reverse order
  // (so indices remain stable)
  return [...requests, ...styleOps.reverse()]
}

/** Strip ** and ` markers from text for plain insertion */
function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
}

/** Build style operations for bold and code spans within a line */
function applyInlineStyles(
  rawLine: string,
  lineStartIndex: number,
  styleOps: DocRequest[],
): void {
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let match: RegExpExecArray | null
  // We need to track the offset in the stripped version
  let rawOffset = 0
  let strippedOffset = 0

  // Walk through the raw line tracking positions in both raw and stripped versions
  const rawChars = rawLine
  let i = 0

  while (i < rawChars.length) {
    // Check for bold
    if (rawChars[i] === '*' && rawChars[i + 1] === '*') {
      const closeIdx = rawChars.indexOf('**', i + 2)
      if (closeIdx !== -1) {
        const boldText = rawChars.slice(i + 2, closeIdx)
        const startIdx = lineStartIndex + strippedOffset
        const endIdx = startIdx + boldText.length
        styleOps.push({
          updateTextStyle: {
            range: { startIndex: startIdx, endIndex: endIdx },
            textStyle: { bold: true },
            fields: 'bold',
          },
        })
        strippedOffset += boldText.length
        i = closeIdx + 2
        continue
      }
    }

    // Check for inline code
    if (rawChars[i] === '`') {
      const closeIdx = rawChars.indexOf('`', i + 1)
      if (closeIdx !== -1) {
        const codeText = rawChars.slice(i + 1, closeIdx)
        const startIdx = lineStartIndex + strippedOffset
        const endIdx = startIdx + codeText.length
        styleOps.push({
          updateTextStyle: {
            range: { startIndex: startIdx, endIndex: endIdx },
            textStyle: {
              weightedFontFamily: { fontFamily: 'Courier New' },
              fontSize: { magnitude: 10, unit: 'PT' },
              backgroundColor: { color: { rgbColor: { red: 0.96, green: 0.96, blue: 0.97 } } },
            },
            fields: 'weightedFontFamily,fontSize,backgroundColor',
          },
        })
        strippedOffset += codeText.length
        i = closeIdx + 1
        continue
      }
    }

    strippedOffset++
    i++
  }
}
