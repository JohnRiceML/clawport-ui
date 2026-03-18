/**
 * Extract a JSON value from CLI output that may contain non-JSON preamble or epilogue.
 *
 * Some OpenClaw versions print validation warnings (e.g. "Unrecognized key")
 * or plugin logs (e.g. "[plugins] ...") to stdout before/after the JSON payload.
 * This function finds and extracts only the valid JSON structure.
 */
export function extractJson(raw: string): unknown {
  const lines = raw.split('\n')
  let jsonStartLine = -1
  let jsonType: '[' | '{' | null = null

  for (let i = 0; i < lines.length; i++) {
    // Strip ANSI escape codes
    const cleanLine = lines[i].replace(/\x1b\[[0-9;]*m/g, '').trim()

    if (cleanLine.startsWith('{')) {
      jsonStartLine = i
      jsonType = '{'
      break
    }
    if (cleanLine.startsWith('[')) {
      // Check if this is a JSON array start
      // - Line is just "[" (empty array or array start on new line)
      // - OR next char is whitespace, quote, bracket, or digit (JSON array content)
      // NOT a log tag like [plugins] where next char is a letter
      const nextChar = cleanLine[1]
      if (!nextChar || /[\s"'\{\[\d]/.test(nextChar)) {
        jsonStartLine = i
        jsonType = '['
        break
      }
    }
  }

  if (jsonStartLine < 0) {
    throw new SyntaxError('No JSON found in CLI output')
  }

  // Find where the JSON ends by matching brackets
  const jsonLines = lines.slice(jsonStartLine)
  let depth = 0
  let jsonEndLine = -1

  for (let i = 0; i < jsonLines.length; i++) {
    const line = jsonLines[i].replace(/\x1b\[[0-9;]*m/g, '')
    for (const char of line) {
      if (char === '[' || char === '{') depth++
      else if (char === ']' || char === '}') {
        depth--
        if (depth === 0) {
          jsonEndLine = i
          break
        }
      }
    }
    if (jsonEndLine >= 0) break
  }

  if (jsonEndLine < 0) {
    throw new SyntaxError('JSON structure not properly closed')
  }

  const jsonPart = jsonLines.slice(0, jsonEndLine + 1).join('\n')
  return JSON.parse(jsonPart)
}
