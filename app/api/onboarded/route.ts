import { existsSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

function getFlagPath(): string {
  const dir = path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'clawport')
  return path.join(dir, '.onboarded')
}

export async function GET() {
  const onboarded = existsSync(getFlagPath())
  return Response.json({ onboarded })
}

export async function POST() {
  const flagPath = getFlagPath()
  const dir = path.dirname(flagPath)
  mkdirSync(dir, { recursive: true })
  writeFileSync(flagPath, new Date().toISOString(), 'utf-8')
  return Response.json({ ok: true })
}
