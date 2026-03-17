import { NextResponse } from 'next/server'
import { statSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Lightweight fingerprint endpoint for agent change detection.
 *
 * Returns a cheap hash based on:
 *   - agents/ directory mtime + entry count
 *   - clawport/agents.json mtime (if exists)
 *   - root SOUL.md mtime (if exists)
 *
 * Avoids the expensive parts of loadRegistry() (reading file content,
 * execSync CLI calls, multi-workspace merging).
 */
export async function GET() {
  const workspacePath = process.env.WORKSPACE_PATH

  if (!workspacePath) {
    return NextResponse.json({ fingerprint: 'no-workspace' })
  }

  const parts: (string | number)[] = []

  // agents/ directory: mtime + entry count
  const agentsDir = join(workspacePath, 'agents')
  if (existsSync(agentsDir)) {
    try {
      const stat = statSync(agentsDir)
      const entries = readdirSync(agentsDir)
      parts.push(stat.mtimeMs, entries.length)
    } catch {
      parts.push('agents-err')
    }
  } else {
    parts.push('no-agents-dir')
  }

  // clawport/agents.json user override mtime
  const userRegistry = join(workspacePath, 'clawport', 'agents.json')
  if (existsSync(userRegistry)) {
    try {
      parts.push(statSync(userRegistry).mtimeMs)
    } catch {
      parts.push('override-err')
    }
  }

  // Root SOUL.md mtime
  const rootSoul = join(workspacePath, 'SOUL.md')
  if (existsSync(rootSoul)) {
    try {
      parts.push(statSync(rootSoul).mtimeMs)
    } catch {
      parts.push('soul-err')
    }
  }

  return NextResponse.json({ fingerprint: JSON.stringify(parts) })
}
