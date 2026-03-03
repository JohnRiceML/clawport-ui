import type { Message, MediaAttachment } from './conversations'
import type { ContentPart, MessageContent } from './validation'

/**
 * Convert a Message (with optional MediaAttachments) into the API content format.
 * - No media → plain string (backward compatible)
 * - Images → ContentPart[] with image_url entries (OpenAI vision format)
 * - Text files → content inlined as text parts
 * - Binary files → descriptive label
 * - Audio → skipped (transcript is already in msg.content from Whisper)
 */
export function buildApiContent(msg: Message): MessageContent {
  const media = msg.media
  if (!media || media.length === 0) return msg.content

  const parts: ContentPart[] = []
  let attachmentAdded = false

  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  for (const attachment of media) {
    if (attachment.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: attachment.url } })
      attachmentAdded = true
    } else if (attachment.type === 'file') {
      const label = attachment.name || 'unknown'
      const sizeNote = attachment.size ? ` (${Math.round(attachment.size / 1024)} KB)` : ''
      // Attempt to inline text file content from base64 data URL
      const inlined = tryExtractText(attachment)
      if (inlined) {
        parts.push({ type: 'text', text: `--- Contents of ${label} ---\n${inlined}\n--- End of file ---` })
      } else {
        parts.push({ type: 'text', text: `[Attached file: ${label}${sizeNote}]` })
      }
      attachmentAdded = true
    }
    // Audio: transcript already in msg.content via Whisper — skip binary
  }

  // If no attachment actually contributed to parts (e.g., audio-only message
  // where the transcript is already in msg.content), return a plain string
  // so the gateway doesn't receive an unnecessary ContentPart[] wrapper.
  if (!attachmentAdded) return msg.content

  return parts.length > 0 ? parts : msg.content
}

const TEXT_EXTENSIONS = ['txt', 'csv', 'json', 'md', 'log', 'xml', 'yaml', 'yml', 'toml']

function isTextFile(att: MediaAttachment): boolean {
  if (att.mimeType?.startsWith('text/')) return true
  const ext = att.name?.split('.').pop()?.toLowerCase() || ''
  return TEXT_EXTENSIONS.includes(ext)
}

function tryExtractText(att: MediaAttachment): string | null {
  if (!isTextFile(att)) return null
  if (!att.url.startsWith('data:')) return null
  try {
    const base64 = att.url.split(',')[1]
    if (!base64) return null
    return atob(base64)
  } catch {
    return null
  }
}
