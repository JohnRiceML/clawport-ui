import { spawn } from 'child_process'
import { requireEnv } from '@/lib/env'

const MAX_LIFETIME_MS = 10 * 60 * 1000 // 10 minutes
const HEARTBEAT_INTERVAL_MS = 15 * 1000 // 15 seconds

export async function GET(request: Request) {
  const encoder = new TextEncoder()
  let child: ReturnType<typeof spawn> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let lifetime: ReturnType<typeof setTimeout> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const openclawBin = requireEnv('OPENCLAW_BIN')

      try {
        child = spawn(openclawBin, ['logs', '--follow', '--json'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to spawn openclaw'
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
        return
      }

      let buffer = ''

      child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          controller.enqueue(encoder.encode(`data: ${line}\n\n`))
        }
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim()
        if (msg) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`))
        }
      })

      child.on('error', (err) => {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`))
        cleanup()
        controller.close()
      })

      child.on('close', (code) => {
        if (code !== null && code !== 0) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: `Process exited with code ${code}` })}\n\n`))
        }
        cleanup()
        controller.close()
      })

      // Heartbeat to prevent proxy timeouts
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Controller may be closed
        }
      }, HEARTBEAT_INTERVAL_MS)

      // Max lifetime safety valve
      lifetime = setTimeout(() => {
        cleanup()
        try {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream max lifetime reached' })}\n\n`))
          controller.close()
        } catch {
          // Already closed
        }
      }, MAX_LIFETIME_MS)

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      })

      function cleanup() {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
        if (lifetime) { clearTimeout(lifetime); lifetime = null }
        if (child) {
          try { child.kill('SIGTERM') } catch { /* already dead */ }
          child = null
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
