import { google } from 'googleapis'
import { getGoogleWorkspaceConfig } from '@/lib/integrations'

export async function createGoogleDocFromMarkdown({
  title,
  markdown,
}: {
  title: string
  markdown: string
}): Promise<string> {
  const config = getGoogleWorkspaceConfig()
  if (!config?.driveEnabled) {
    throw new Error('Google Drive integration is not configured')
  }

  if (!markdown.trim()) {
    throw new Error('No content provided')
  }

  const auth = buildAuth(config)
  const docs = google.docs({ version: 'v1', auth })
  const createRes = await docs.documents.create({
    requestBody: { title },
  })

  const documentId = createRes.data.documentId
  if (!documentId) {
    throw new Error('Failed to create document')
  }

  const requests = markdownToDocRequests(markdown)
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    })
  }

  return `https://docs.google.com/document/d/${documentId}/edit`
}

function buildAuth(config: NonNullable<ReturnType<typeof getGoogleWorkspaceConfig>>) {
  if (config.authMethod === 'gws_service_account' && config.saJson) {
    const credentials = JSON.parse(config.saJson)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file',
      ],
      clientOptions: config.impersonateEmail
        ? { subject: config.impersonateEmail }
        : undefined,
    })
  }

  return new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })
}

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

function markdownToDocRequests(markdown: string): DocRequest[] {
  const lines = markdown.split('\n')
  const requests: DocRequest[] = []
  const styleOps: DocRequest[] = []

  let index = 1

  for (const line of lines) {
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
      applyInlineStyles(content, index, styleOps)
      index += text.length
      continue
    }

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

    if (line.startsWith('```')) {
      continue
    }

    const text = stripInlineMarkdown(line) + '\n'
    requests.push({
      insertText: { location: { index }, text },
    })
    applyInlineStyles(line, index, styleOps)
    index += text.length
  }

  return [...requests, ...styleOps.reverse()]
}

function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
}

function applyInlineStyles(
  rawLine: string,
  lineStartIndex: number,
  styleOps: DocRequest[],
): void {
  let strippedOffset = 0
  let i = 0

  while (i < rawLine.length) {
    if (rawLine[i] === '*' && rawLine[i + 1] === '*') {
      const closeIdx = rawLine.indexOf('**', i + 2)
      if (closeIdx !== -1) {
        const boldText = rawLine.slice(i + 2, closeIdx)
        const startIdx = lineStartIndex + strippedOffset
        styleOps.push({
          updateTextStyle: {
            range: { startIndex: startIdx, endIndex: startIdx + boldText.length },
            textStyle: { bold: true },
            fields: 'bold',
          },
        })
        strippedOffset += boldText.length
        i = closeIdx + 2
        continue
      }
    }

    if (rawLine[i] === '`') {
      const closeIdx = rawLine.indexOf('`', i + 1)
      if (closeIdx !== -1) {
        const codeText = rawLine.slice(i + 1, closeIdx)
        const startIdx = lineStartIndex + strippedOffset
        styleOps.push({
          updateTextStyle: {
            range: { startIndex: startIdx, endIndex: startIdx + codeText.length },
            textStyle: {
              weightedFontFamily: { fontFamily: 'Courier New' },
              backgroundColor: {
                color: { rgbColor: { red: 0.94, green: 0.94, blue: 0.94 } },
              },
            },
            fields: 'weightedFontFamily,backgroundColor',
          },
        })
        strippedOffset += codeText.length
        i = closeIdx + 1
        continue
      }
    }

    strippedOffset += 1
    i += 1
  }
}
