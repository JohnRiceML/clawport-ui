#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { createServer } from 'node:net'

// ---------------------------------------------------------------------------
// Node version gate (must be 22+ for native fetch / AbortSignal.timeout)
// ---------------------------------------------------------------------------

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(
    `\x1b[31mError:\x1b[0m Node.js 22+ required (found ${process.versions.node})`
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Resolve package root (where app/, lib/, etc. live)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const PKG_ROOT = resolve(dirname(__filename), '..')

const USER_CONFIG_DIR = join(homedir(), '.config', 'clawport-ui')
const ENV_LOCAL_FILENAME = '.env.local'

/** Path to .env.local: package root (preferred) or user config dir (for global installs). */
function getEnvLocalPath() {
  const pkgEnv = resolve(PKG_ROOT, ENV_LOCAL_FILENAME)
  if (existsSync(pkgEnv)) return pkgEnv
  const userEnv = resolve(USER_CONFIG_DIR, ENV_LOCAL_FILENAME)
  if (existsSync(userEnv)) return userEnv
  return null
}

/** Load .env.local into process.env so Next.js and status/doctor see the vars. */
function loadEnvLocal() {
  const path = getEnvLocalPath()
  if (!path) return
  try {
    const content = readFileSync(path, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim()
          if (key) process.env[key] = value
        }
      }
    }
  } catch (_) {}
}

loadEnvLocal()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NEXT_BIN = resolve(PKG_ROOT, 'node_modules', '.bin', 'next')

const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

const extraArgs = process.argv.slice(3)

function run(cmd, args = []) {
  const child = spawn(cmd, args, {
    cwd: PKG_ROOT,
    stdio: 'inherit',
    shell: true,
  })
  child.on('close', (code) => process.exit(code ?? 0))
}

async function checkGateway() {
  try {
    const res = await fetch('http://127.0.0.1:18789/', {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok || res.status > 0
  } catch {
    return false
  }
}

function findBinary(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    return execSync(`${cmd} ${name}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`
${bold('ClawPort')} -- AI Agent Dashboard

${bold('Usage:')} clawport <command> [options]

${bold('Commands:')}
  ${green('dev')}      Start the development server (next dev)
  ${green('start')}    Build and start the production server
  ${green('setup')}    Run the setup wizard (auto-detect OpenClaw config)
  ${green('status')}   Check gateway reachability and current config
  ${green('doctor')}   Run full environment health check
  ${green('help')}     Show this help message

${bold('Options:')}
  ${dim('--port <n>')}  Port for dev/start (passed through to Next.js)

${bold('Examples:')}
  ${dim('$ clawport setup          # Configure your OpenClaw connection')}
  ${dim('$ clawport dev            # Start dev server on localhost:3000')}
  ${dim('$ clawport dev --port 3005  # Start dev server on port 3005')}
  ${dim('$ clawport status         # Check if gateway is reachable')}
  ${dim('$ clawport doctor         # Diagnose environment issues')}

${dim(`Package root: ${PKG_ROOT}`)}
`)
}

function portArgs() {
  const hasPort = extraArgs.some((a) => a === '--port' || a.startsWith('--port=') || a === '-p')
  if (!hasPort && process.env.PORT) return ['--port', process.env.PORT]
  return []
}

function cmdDev() {
  console.log(`\n  ${bold('Starting ClawPort dev server...')}\n`)
  run(NEXT_BIN, ['dev', ...portArgs(), ...extraArgs])
}

function cmdStart() {
  console.log(`\n  ${bold('Building and starting ClawPort...')}\n`)
  const build = spawn(NEXT_BIN, ['build'], {
    cwd: PKG_ROOT,
    stdio: 'inherit',
    shell: true,
  })
  build.on('close', (code) => {
    if (code !== 0) process.exit(code)
    run(NEXT_BIN, ['start', ...portArgs(), ...extraArgs])
  })
}

function cmdSetup() {
  console.log()
  run('node', [resolve(PKG_ROOT, 'scripts/setup.mjs'), `--cwd=${PKG_ROOT}`, ...extraArgs])
}

async function cmdStatus() {
  console.log()
  console.log(bold('  ClawPort Status'))
  console.log()

  // Check gateway
  const gatewayUp = await checkGateway()

  if (gatewayUp) {
    console.log(`  ${green('+')} Gateway reachable at ${dim('localhost:18789')}`)
  } else {
    console.log(`  ${red('x')} Gateway not responding at ${dim('localhost:18789')}`)
    console.log(`    ${dim('Start it with: openclaw gateway run')}`)
  }

  // Check .env.local (package root or ~/.config/clawport-ui)
  const envPath = getEnvLocalPath()
  console.log()
  if (envPath && existsSync(envPath)) {
    console.log(`  ${green('+')} .env.local found`)
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n').filter((l) => l && !l.startsWith('#'))
    for (const line of lines) {
      const [key, ...rest] = line.split('=')
      const value = rest.join('=')
      if (key === 'OPENCLAW_GATEWAY_TOKEN' && value) {
        console.log(`    ${dim(key)}=${dim(value.slice(0, 8) + '...' + value.slice(-4))}`)
      } else if (key && value) {
        console.log(`    ${dim(key)}=${dim(value)}`)
      }
    }
  } else {
    console.log(`  ${yellow('!')} No .env.local found`)
    console.log(`    ${dim('Run: clawport setup')}`)
  }

  console.log()
  if (envPath) {
    console.log(`  ${dim(`Config: ${envPath}`)}`)
  }
  console.log(`  ${dim(`Package root: ${PKG_ROOT}`)}`)
  console.log()
}

async function cmdDoctor() {
  console.log()
  console.log(bold('  ClawPort Doctor'))
  console.log()

  let passed = 0
  let total = 0

  function check(ok, label, fix) {
    total++
    if (ok) {
      passed++
      console.log(`  ${green('+')} ${label}`)
    } else {
      console.log(`  ${red('x')} ${label}`)
      if (fix) console.log(`    ${dim(fix)}`)
    }
  }

  // 1. Node.js version
  check(major >= 22, `Node.js ${process.versions.node}`, 'Upgrade to Node.js 22 or later')

  // 2. Package integrity -- next binary exists
  check(existsSync(NEXT_BIN), 'Package integrity (node_modules/.bin/next)', 'Run: npm install')

  // 3. OpenClaw binary
  const openclawPath = findBinary('openclaw')
  check(!!openclawPath, openclawPath ? `OpenClaw binary (${openclawPath})` : 'OpenClaw binary', 'Install OpenClaw: https://docs.openclaw.dev/install')

  // 4. Gateway reachable
  const gatewayUp = await checkGateway()
  check(gatewayUp, 'Gateway reachable at localhost:18789', 'Start it with: openclaw gateway run')

  // 5. Configuration -- .env.local with required vars (package root or ~/.config/clawport-ui)
  const envPath = getEnvLocalPath()
  const requiredVars = ['WORKSPACE_PATH', 'OPENCLAW_BIN', 'OPENCLAW_GATEWAY_TOKEN']
  let envOk = false
  let envFix = 'Run: clawport setup'
  if (envPath && existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const missing = requiredVars.filter((v) => !content.includes(`${v}=`))
    if (missing.length === 0) {
      envOk = true
    } else {
      envFix = `Missing in .env.local: ${missing.join(', ')}`
    }
  }
  check(envOk, '.env.local with required variables', envFix)

  // 6. Workspace structure
  let workspaceOk = false
  let workspaceFix = 'Set WORKSPACE_PATH in .env.local via: clawport setup'
  if (envOk) {
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/^WORKSPACE_PATH=(.+)$/m)
    if (match) {
      const wsPath = match[1].trim()
      const hasSoul = existsSync(resolve(wsPath, 'SOUL.md'))
      const hasAgents = existsSync(resolve(wsPath, 'agents'))
      const hasMemory = existsSync(resolve(wsPath, 'memory'))
      if (hasSoul || hasAgents || hasMemory) {
        workspaceOk = true
      } else {
        workspaceFix = `Workspace at ${wsPath} missing expected files (SOUL.md, agents/, memory/)`
      }
    }
  }
  check(workspaceOk, 'Workspace structure', workspaceFix)

  // 7. Port 3000 available
  const portFree = await checkPort(3000)
  check(portFree, 'Port 3000 available', 'Port 3000 is in use. Use: clawport dev --port 3001')

  // Summary
  console.log()
  if (passed === total) {
    console.log(`  ${green(`${passed}/${total} checks passed`)}`)
  } else {
    console.log(`  ${yellow(`${passed}/${total} checks passed`)} -- ${total - passed} issue${total - passed === 1 ? '' : 's'} found`)
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const command = process.argv[2]

switch (command) {
  case 'dev':
    cmdDev()
    break
  case 'start':
    cmdStart()
    break
  case 'setup':
    cmdSetup()
    break
  case 'status':
    cmdStatus()
    break
  case 'doctor':
    cmdDoctor()
    break
  case 'help':
  default:
    showHelp()
    break
}
