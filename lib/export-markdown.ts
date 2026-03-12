/**
 * Markdown export utilities — PDF (via print) and DOCX (via docx library).
 *
 * Used by the markdown modal in TicketDetailPanel to let users save
 * assistant responses as formatted documents.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import { saveAs } from 'file-saver'
import { renderMarkdown } from './sanitize'

// ---------------------------------------------------------------------------
// PDF export — styled HTML in hidden iframe + browser print dialog
// ---------------------------------------------------------------------------

/**
 * Opens the browser's print dialog with a formatted HTML rendering
 * of the markdown content. The user can choose "Save as PDF" from there.
 * Zero extra dependencies — uses the existing `renderMarkdown()` pipeline.
 */
export function exportAsPdf(markdown: string): void {
  const html = renderMarkdown(markdown)

  const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Export</title>
<style>
  @media print {
    @page { margin: 1in; }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1d1d1f;
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 24px;
  }
  h1 { font-size: 28px; font-weight: 700; margin: 1rem 0 0.75rem; }
  h2 { font-size: 22px; font-weight: 600; margin: 1.5rem 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e5e5e5; }
  h3 { font-size: 17px; font-weight: 600; margin: 1.25rem 0 0.375rem; }
  h4 { font-size: 15px; font-weight: 600; margin: 1rem 0 0.25rem; }
  strong { font-weight: 600; }
  code {
    background: #f5f5f7;
    color: #6e6e73;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
  }
  pre {
    background: #f5f5f7;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.6;
  }
  pre code {
    background: none;
    padding: 0;
    color: #1d1d1f;
    white-space: pre;
  }
  li { margin-left: 1rem; line-height: 1.7; }
  p { margin-bottom: 0.75rem; }
</style>
</head>
<body><p>${html}</p></body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  if (!win) {
    document.body.removeChild(iframe)
    return
  }

  win.document.open()
  win.document.write(doc)
  win.document.close()

  // Wait for content to render before printing
  setTimeout(() => {
    win.focus()
    win.print()
    // Clean up after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }, 250)
}

// ---------------------------------------------------------------------------
// DOCX export — programmatic Word document via docx library
// ---------------------------------------------------------------------------

/** Parsed markdown line types */
type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; num: string; text: string }
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'paragraph'; text: string }
  | { type: 'blank' }

/** Parse markdown string into structured blocks */
function parseMarkdown(markdown: string): MdBlock[] {
  const lines = markdown.split('\n')
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', lang, lines: codeLines })
      i++ // skip closing ```
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3 | 4,
        text: headingMatch[2],
      })
      i++
      continue
    }

    // Bullet list
    if (line.match(/^[-*]\s+/)) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-*]\s+/, '') })
      i++
      continue
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/)
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] })
      i++
      continue
    }

    // Blank line
    if (line.trim() === '') {
      blocks.push({ type: 'blank' })
      i++
      continue
    }

    // Plain paragraph
    blocks.push({ type: 'paragraph', text: line })
    i++
  }

  return blocks
}

/** Convert inline markdown (bold, code) to docx TextRun[] */
function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    // Plain text before match
    if (match.index > last) {
      runs.push(new TextRun({ text: text.slice(last, match.index) }))
    }
    if (match[2]) {
      // Bold
      runs.push(new TextRun({ text: match[2], bold: true }))
    } else if (match[3]) {
      // Inline code
      runs.push(
        new TextRun({
          text: match[3],
          font: 'Courier New',
          size: 20, // 10pt in half-points
          shading: { fill: 'F0F0F0' },
        }),
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last) }))
  }

  // If no runs were created, return a single run with the full text
  if (runs.length === 0) {
    runs.push(new TextRun({ text }))
  }

  return runs
}

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
}

/**
 * Converts a markdown string to a DOCX file and triggers a browser download.
 */
export async function exportAsDocx(markdown: string): Promise<void> {
  const blocks = parseMarkdown(markdown)
  const paragraphs: Paragraph[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        paragraphs.push(
          new Paragraph({
            heading: HEADING_MAP[block.level],
            children: parseInlineRuns(block.text),
          }),
        )
        break

      case 'bullet':
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: parseInlineRuns(block.text),
          }),
        )
        break

      case 'numbered':
        paragraphs.push(
          new Paragraph({
            numbering: { reference: 'default-numbering', level: 0 },
            children: parseInlineRuns(block.text),
          }),
        )
        break

      case 'code':
        // Render code block as a shaded, monospace paragraph
        paragraphs.push(
          new Paragraph({
            shading: { fill: 'F5F5F7' },
            spacing: { before: 120, after: 120 },
            children: block.lines.map(
              (line, idx) =>
                new TextRun({
                  text: line + (idx < block.lines.length - 1 ? '\n' : ''),
                  font: 'Courier New',
                  size: 20,
                  break: idx > 0 ? 1 : undefined,
                }),
            ),
          }),
        )
        break

      case 'paragraph':
        paragraphs.push(
          new Paragraph({
            spacing: { after: 120 },
            children: parseInlineRuns(block.text),
          }),
        )
        break

      case 'blank':
        paragraphs.push(new Paragraph({ spacing: { after: 80 } }))
        break
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal' as const,
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch in twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, 'response.docx')
}
