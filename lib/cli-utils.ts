/**
 * Extract a JSON value from CLI output that may contain non-JSON preamble.
 *
 * Some OpenClaw versions print validation warnings (e.g. "Unrecognized key")
 * to stdout before the JSON payload. This function finds the first `[` or `{`
 * and parses from there, so ClawPort doesn't break on noisy CLI output.
 */
export function extractJson(raw: string): unknown {
  // Fast path: raw is already valid JSON
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return JSON.parse(trimmed)
  }

  // Find the first JSON structure in the output
  const arrStart = raw.indexOf('[')
  const objStart = raw.indexOf('{')
  const starts = [arrStart, objStart].filter(i => i >= 0)
  if (starts.length === 0) {
    throw new SyntaxError('No JSON found in CLI output')
  }

  const start = Math.min(...starts)
  return JSON.parse(raw.slice(start))
}
