#!/usr/bin/env node

// ClawPort -- Auto-detect environment and write .env.local
// Usage: npm run setup

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, accessSync } from 'node:fs'
import { constants } from 'node:fs'
import { resolve, join } from 'node:path'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

function detectWorkspacePath() {
  // Current OpenClaw layout: ~/.openclaw/agents/main/workspace
  const agentPath = join(homedir(), '.openclaw', 'agents', 'main', 'workspace')
  if (existsSync(agentPath)) return agentPath
  // Legacy layout: ~/.openclaw/workspace
  const legacyPath = join(homedir(), '.openclaw', 'workspace')
  if (existsSync(legacyPath)) return legacyPath
  return null
}

function detectOpenClawBin() {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  return exec(`${cmd} openclaw`)
}

function detectGatewayToken() {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return null
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const token = config?.gateway?.auth?.token
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

function checkHttpEndpointEnabled() {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return null // can't check
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return config?.gateway?.http?.endpoints?.chatCompletions?.enabled === true
  } catch {
    return null
  }
}

function enableHttpEndpoint() {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return false
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (!config.gateway) config.gateway = {}
    if (!config.gateway.http) config.gateway.http = {}
    if (!config.gateway.http.endpoints) config.gateway.http.endpoints = {}
    if (!config.gateway.http.endpoints.chatCompletions) config.gateway.http.endpoints.chatCompletions = {}
    config.gateway.http.endpoints.chatCompletions.enabled = true
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    return true
  } catch {
    return false
  }
}

async function checkGatewayRunning() {
  try {
    const res = await fetch('http://127.0.0.1:18789/', {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok || res.status > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log()
  console.log(bold('  ClawPort Setup'))
  console.log(dim('  Auto-detecting your OpenClaw configuration...\n'))

  // Detect all values
  const detected = {
    WORKSPACE_PATH: detectWorkspacePath(),
    OPENCLAW_BIN: detectOpenClawBin(),
    OPENCLAW_GATEWAY_TOKEN: detectGatewayToken(),
  }

  const gatewayUp = await checkGatewayRunning()

  // Report findings
  const entries = [
    ['WORKSPACE_PATH', detected.WORKSPACE_PATH],
    ['OPENCLAW_BIN', detected.OPENCLAW_BIN],
    ['OPENCLAW_GATEWAY_TOKEN', detected.OPENCLAW_GATEWAY_TOKEN],
  ]

  let allFound = true
  for (const [name, value] of entries) {
    if (value) {
      const display = name === 'OPENCLAW_GATEWAY_TOKEN'
        ? value.slice(0, 8) + '...' + value.slice(-4)
        : value
      console.log(`  ${green('+')} ${bold(name)}`)
      console.log(`    ${dim(display)}`)
    } else {
      allFound = false
      console.log(`  ${red('x')} ${bold(name)}`)
      console.log(`    ${red('Not found')}`)
    }
  }

  // Gateway status
  console.log()
  if (gatewayUp) {
    console.log(`  ${green('+')} Gateway running at ${dim('localhost:18789')}`)
  } else {
    console.log(`  ${yellow('!')} Gateway not responding at localhost:18789`)
    console.log(`    ${dim('Start it with: openclaw gateway run')}`)
  }

  // Check HTTP chat completions endpoint
  const httpEnabled = checkHttpEndpointEnabled()
  if (httpEnabled === true) {
    console.log(`  ${green('+')} HTTP chat completions endpoint ${dim('enabled')}`)
  } else if (httpEnabled === false) {
    console.log(`  ${yellow('!')} HTTP chat completions endpoint is ${bold('disabled')}`)
    console.log(`    ${dim('ClawPort needs this to chat with agents.')}`)
    const enable = await ask(`  ${yellow('?')} Enable it in openclaw.json? (Y/n) `)
    if (enable.toLowerCase() !== 'n') {
      if (enableHttpEndpoint()) {
        console.log(`  ${green('+')} Enabled! ${dim('Restart the gateway for this to take effect.')}`)
      } else {
        console.log(`  ${red('x')} Could not update openclaw.json. Enable it manually:`)
        console.log(`    ${dim('Set gateway.http.endpoints.chatCompletions.enabled = true in ~/.openclaw/openclaw.json')}`)
      }
    }
  }
  console.log()

  // Handle missing values
  const final = { ...detected }

  if (!final.WORKSPACE_PATH) {
    const answer = await ask(`  ${yellow('?')} Enter your WORKSPACE_PATH: `)
    if (answer && existsSync(answer)) {
      final.WORKSPACE_PATH = answer
    } else if (answer) {
      console.log(`    ${yellow('Warning: path does not exist yet')}`)
      final.WORKSPACE_PATH = answer
    } else {
      console.log(`\n  ${red('Aborted.')} WORKSPACE_PATH is required.`)
      process.exit(1)
    }
  }

  if (!final.OPENCLAW_BIN) {
    const answer = await ask(`  ${yellow('?')} Enter path to openclaw binary: `)
    if (answer) {
      final.OPENCLAW_BIN = answer
    } else {
      console.log(`\n  ${red('Aborted.')} OPENCLAW_BIN is required.`)
      process.exit(1)
    }
  }

  if (!final.OPENCLAW_GATEWAY_TOKEN) {
    console.log(`    ${dim('Find your token in ~/.openclaw/openclaw.json under gateway.auth.token')}`)
    const answer = await ask(`  ${yellow('?')} Enter your gateway token: `)
    if (answer) {
      final.OPENCLAW_GATEWAY_TOKEN = answer
    } else {
      console.log(`\n  ${red('Aborted.')} OPENCLAW_GATEWAY_TOKEN is required.`)
      process.exit(1)
    }
  }

  // PORT (defaults to 3000)
  const portFlag = process.argv.find((a) => a.startsWith('--port='))
  if (portFlag) {
    final.PORT = portFlag.split('=')[1]
  } else {
    const portAnswer = await ask(`  ${yellow('?')} Port for web UI (default: 3000): `)
    final.PORT = portAnswer || '3000'
  }

  // Support --cwd flag for CLI usage (clawport setup writes .env.local into the package dir)
  const cwdFlag = process.argv.find((a) => a.startsWith('--cwd='))
  let targetDir = cwdFlag ? cwdFlag.split('=')[1] : process.cwd()

  // When installed globally (e.g. /usr/lib/node_modules/clawport-ui), targetDir may not be writable.
  // Use ~/.config/clawport-ui/.env.local in that case so setup works without sudo.
  function canWriteToDir(dir) {
    try {
      accessSync(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  if (!canWriteToDir(targetDir)) {
    const userConfigDir = join(homedir(), '.config', 'clawport-ui')
    if (!existsSync(userConfigDir)) {
      mkdirSync(userConfigDir, { recursive: true })
    }
    targetDir = userConfigDir
    console.log(`  ${yellow('!')} Package directory is not writable; using ${dim(targetDir)} for .env.local`)
    console.log()
  }

  // Check if .env.local already exists
  const envPath = resolve(targetDir, '.env.local')
  if (existsSync(envPath)) {
    const overwrite = await ask(`  ${yellow('?')} .env.local already exists. Overwrite? (y/N) `)
    if (overwrite.toLowerCase() !== 'y') {
      console.log(`\n  ${dim('Keeping existing .env.local')}`)
      process.exit(0)
    }
  }

  // Confirm
  console.log()
  console.log(dim('  Will write .env.local with:'))
  console.log(`    WORKSPACE_PATH=${dim(final.WORKSPACE_PATH)}`)
  console.log(`    OPENCLAW_BIN=${dim(final.OPENCLAW_BIN)}`)
  console.log(`    OPENCLAW_GATEWAY_TOKEN=${dim(final.OPENCLAW_GATEWAY_TOKEN.slice(0, 8) + '...')}`)
  console.log(`    PORT=${dim(final.PORT)}`)
  console.log()

  const confirm = await ask(`  ${bold('Write .env.local?')} (Y/n) `)
  if (confirm.toLowerCase() === 'n') {
    console.log(`\n  ${dim('Aborted.')}`)
    process.exit(0)
  }

  // Write
  const content = [
    '# ClawPort -- generated by npm run setup',
    `# Created: ${new Date().toISOString()}`,
    '',
    '# Required',
    `WORKSPACE_PATH=${final.WORKSPACE_PATH}`,
    `OPENCLAW_BIN=${final.OPENCLAW_BIN}`,
    `OPENCLAW_GATEWAY_TOKEN=${final.OPENCLAW_GATEWAY_TOKEN}`,
    `PORT=${final.PORT}`,
    '',
    '# Optional -- uncomment to enable voice features',
    '# ELEVENLABS_API_KEY=',
    '',
  ].join('\n')

  writeFileSync(envPath, content, 'utf-8')

  console.log()
  console.log(`  ${green('Done!')} .env.local written${targetDir !== (cwdFlag ? cwdFlag.split('=')[1] : process.cwd()) ? ` to ${dim(targetDir)}` : ''}.`)
  console.log()
  const startCmd = cwdFlag ? 'clawport dev' : 'npm run dev'
  console.log(`  Next steps:`)
  if (!gatewayUp) {
    console.log(`    1. Start the gateway:  ${dim('openclaw gateway run')}`)
    console.log(`    2. Start ClawPort:     ${dim(startCmd)}`)
  } else {
    console.log(`    ${dim(startCmd)}`)
  }
  console.log()
}

main().catch((err) => {
  console.error(`\n  ${red('Error:')} ${err.message}`)
  process.exit(1)
})
