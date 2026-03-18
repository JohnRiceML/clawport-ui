# ClawPort -- Setup Guide

This guide walks you through getting ClawPort running against your own OpenClaw instance. If you just want the quick version, see the [README](README.md).

---

## Prerequisites

- **Node.js 22+** -- [Download](https://nodejs.org). Verify with `node -v`.
- **OpenClaw** -- installed and running (see below)

---

## 0. Setting Up OpenClaw

ClawPort connects to [OpenClaw](https://openclaw.ai), an open-source, self-hosted AI assistant that runs locally on your machine. If you already have OpenClaw running, skip to [step 1](#1-install-clawport).

### Install OpenClaw

```bash
# macOS / Linux
curl -fsSL https://openclaw.ai/install.sh | bash

# Or via npm (requires Node 22+)
npm install -g openclaw
```

Windows: `iwr -useb https://openclaw.ai/install.ps1 | iex`

Verify the install:

```bash
openclaw --version
```

### Run the Onboarding Wizard

The onboarding wizard sets up your workspace, configures the gateway, and installs it as a background daemon:

```bash
openclaw onboard --install-daemon
```

This creates:

| What | Where |
|------|-------|
| Config file | `~/.openclaw/openclaw.json` |
| Workspace | `~/.openclaw/workspace/` |
| Agent SOUL files | `~/.openclaw/workspace/agents/` |
| Memory | `~/.openclaw/workspace/memory/` |
| Credentials | `~/.openclaw/credentials/` |

### Verify the Gateway

The gateway is the local server that handles all AI operations. ClawPort talks to it at `localhost:18789` by default. If you use a custom port, set `OPENCLAW_GATEWAY_PORT` in `.env.local`.

```bash
openclaw gateway status
```

You should see the gateway URL, port, and auth token. If the gateway isn't running:

```bash
openclaw gateway run
```

### Key Concepts

- **Workspace** -- the directory where OpenClaw stores agent files, memory, and configuration. Default: `~/.openclaw/workspace`.
- **Gateway** -- local server (default `localhost:18789`, configurable) that routes AI calls to Claude, GPT, or local models. Exposes an OpenAI-compatible HTTP endpoint and a WebSocket control plane.
- **Agents** -- each agent has a `SOUL.md` defining its persona and a directory under `agents/` in your workspace.
- **SOUL.md** -- the identity file for an agent. Contains its name, role, personality, and operating rules. ClawPort reads these to build the dashboard.

For more detail, see the [OpenClaw documentation](https://docs.openclaw.ai/getting-started).

---

## 1. Install ClawPort

> **Note:** The npm package is `clawport-ui`. The CLI command is `clawport`.
> Do not install the unrelated `clawport` package.

```bash
# Install globally (package: clawport-ui, command: clawport)
npm install -g clawport-ui

# Or clone the repo
git clone https://github.com/JohnRiceML/clawport-ui.git
cd clawport-ui
npm install
```

---

## 2. Configure Environment

The fastest way is the auto-setup script:

```bash
# If installed globally via npm
clawport setup

# Or if running from source
npm run setup
```

This auto-detects your `WORKSPACE_PATH` (reads from `~/.openclaw/openclaw.json` agents.defaults.workspace), `OPENCLAW_BIN`, and gateway token from your local OpenClaw installation, shows you what it found, and writes `.env.local` after you confirm.

When installed globally via `npm install -g clawport-ui`, the package directory may not be writable. In that case, setup automatically writes `.env.local` to `~/.config/clawport-ui/` instead. The CLI checks both locations when loading environment variables.

If you prefer to configure manually, copy the template and edit:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and set the three required variables.

### WORKSPACE_PATH

The path to your OpenClaw workspace directory. This is where OpenClaw stores agent SOUL files, memory, and other data.

**How it's detected:**

Setup reads `agents.defaults.workspace` from `~/.openclaw/openclaw.json` (the canonical source). If not found there, it falls back to legacy filesystem paths.

To verify your configured workspace:

```bash
cat ~/.openclaw/openclaw.json | grep -A1 '"workspace"'
```

You should see files like `SOUL.md`, an `agents/` directory, and a `memory/` directory. Use the full absolute path in your `.env.local`:

```env
WORKSPACE_PATH=/Users/yourname/.openclaw/workspace
```

### OPENCLAW_BIN

The absolute path to the `openclaw` CLI binary. ClawPort calls this binary for vision messages, cron listing, and other CLI operations.

To find it:

```bash
which openclaw
```

Use whatever that returns:

```env
OPENCLAW_BIN=/usr/local/bin/openclaw
```

If you installed via nvm or a version manager, the path might be something like `/Users/yourname/.nvm/versions/node/v22.14.0/bin/openclaw`. That's fine -- just use the full path.

### OPENCLAW_GATEWAY_TOKEN

The token that authenticates all API calls to the OpenClaw gateway. Every request ClawPort makes (chat, vision, TTS, transcription) includes this token.

To find it:

```bash
openclaw gateway status
```

This should display your gateway configuration including the token. Copy it into your `.env.local`:

```env
OPENCLAW_GATEWAY_TOKEN=your-token-here
```

### ELEVENLABS_API_KEY (optional)

If you want voice indicators on agent profiles, add your ElevenLabs API key. Get one at [elevenlabs.io](https://elevenlabs.io).

```env
ELEVENLABS_API_KEY=sk_your-key-here
```

If you skip this, everything works normally. Voice indicators just won't appear.

---

## 3. Enable the HTTP Endpoint

ClawPort talks to the gateway's OpenAI-compatible HTTP endpoint, which is **disabled by default**. Running `clawport setup` or `npm run setup` will detect this and offer to enable it automatically.

To enable it manually, open `~/.openclaw/openclaw.json` and add:

```json
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  }
}
```

Merge this into your existing config -- don't replace the whole file. If this isn't enabled, chat will fail with a **405 Method Not Allowed** error.

## 4. Start the Gateway

ClawPort expects the OpenClaw gateway to be running (default port `18789`). Start it in a separate terminal:

```bash
openclaw gateway run
```

Restart the gateway after changing `openclaw.json`. Leave it running while you use ClawPort. If the gateway isn't running, chat and all AI features will fail with connection errors.

---

## 5. Run ClawPort

```bash
# If installed globally via npm
clawport dev

# Or if running from source
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First-Run Onboarding

On your first visit, ClawPort launches the **onboarding wizard**. This walks you through:

- **Naming your portal** -- give your command centre a custom name and subtitle
- **Choosing a theme** -- pick from Dark, Glass, Color, Light, or System
- **Setting an accent color** -- personalize the UI highlight color
- **Customizing your logo** -- upload an icon or choose an emoji
- **Entering your name** -- so the UI knows who the operator is

All of these can be changed later in the Settings page. The wizard just gets you started quickly.

---

## 6. Agent Customization

### Auto-Discovery (Default)

ClawPort automatically discovers your agents from your OpenClaw workspace. It scans `$WORKSPACE_PATH/agents/` for subdirectories containing a `SOUL.md` file. Each becomes an agent in the dashboard with:

- **ID** from the directory name (e.g., `agents/pulse/` becomes agent `pulse`)
- **Name** from the first `# Heading` in `SOUL.md`, or the directory name as fallback
- **Role/Title** from a `Role:` or `Title:` line in `SOUL.md`, or "Agent" as default

If `$WORKSPACE_PATH/SOUL.md` exists, it becomes the root orchestrator and all discovered agents report to it.

Cron jobs are matched to agents dynamically by name prefix (e.g., a cron named `pulse-trending` is matched to the `pulse` agent).

**No configuration needed** -- if you have an OpenClaw workspace with agents, ClawPort will find and display them automatically.

### Using a Custom Registry

For full control over names, colors, emoji, hierarchy, and tools, create a file at:

```
$WORKSPACE_PATH/clawport/agents.json
```

For example, if your `WORKSPACE_PATH` is `/Users/yourname/.openclaw/workspace`:

```bash
mkdir -p /Users/yourname/.openclaw/workspace/clawport
```

Then create `agents.json` in that directory. ClawPort checks for this file on every request. If it exists, it replaces auto-discovery entirely.

### Resolution Order

1. **User override** -- `$WORKSPACE_PATH/clawport/agents.json` (if exists and valid JSON)
2. **Auto-discovery** -- scans `$WORKSPACE_PATH/agents/` subdirectories
3. **Bundled fallback** -- `lib/agents.json` (example team for demo purposes)

### Agent Entry Format

Your `agents.json` should be an array of agent objects. Here's the minimal required shape:

```json
[
  {
    "id": "my-agent",
    "name": "My Agent",
    "title": "What this agent does",
    "reportsTo": null,
    "directReports": [],
    "soulPath": "agents/my-agent/SOUL.md",
    "voiceId": null,
    "color": "#06b6d4",
    "emoji": "🤖",
    "tools": ["read", "write"],
    "memoryPath": null,
    "description": "One-liner about this agent."
  }
]
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique slug for the agent (e.g., `"vera"`) |
| `name` | string | Display name (e.g., `"VERA"`) |
| `title` | string | Role title (e.g., `"Chief Strategy Officer"`) |
| `reportsTo` | string or null | Parent agent `id` for the org chart. `null` for the root. |
| `directReports` | string[] | Array of child agent `id`s |
| `soulPath` | string or null | Path to the agent's SOUL.md, relative to `WORKSPACE_PATH` |
| `voiceId` | string or null | ElevenLabs voice ID (requires `ELEVENLABS_API_KEY`) |
| `color` | string | Hex color for the agent's node in the Org Map |
| `emoji` | string | Emoji shown as the agent's avatar |
| `tools` | string[] | List of tools this agent has access to |
| `memoryPath` | string or null | Path to agent-specific memory (relative to `WORKSPACE_PATH`) |
| `description` | string | One-line description shown in the UI |

### Hierarchy Rules

- Exactly one agent should have `"reportsTo": null` -- this is your root/orchestrator node.
- `directReports` should be consistent with `reportsTo`. If agent B reports to agent A, then A's `directReports` should include B's `id`.
- The Org Map uses these relationships to build the org chart automatically.

### Example: Minimal Two-Agent Setup

```json
[
  {
    "id": "boss",
    "name": "Boss",
    "title": "Orchestrator",
    "reportsTo": null,
    "directReports": ["worker"],
    "soulPath": "SOUL.md",
    "voiceId": null,
    "color": "#f5c518",
    "emoji": "👑",
    "tools": ["read", "write", "exec", "message"],
    "memoryPath": null,
    "description": "Top-level orchestrator."
  },
  {
    "id": "worker",
    "name": "Worker",
    "title": "Task Runner",
    "reportsTo": "boss",
    "directReports": [],
    "soulPath": "agents/worker/SOUL.md",
    "voiceId": null,
    "color": "#22c55e",
    "emoji": "⚙️",
    "tools": ["read", "write"],
    "memoryPath": null,
    "description": "Handles assigned tasks."
  }
]
```

---

## 7. Production Build

```bash
# If installed globally via npm
clawport start

# Or if running from source
npx next build
npm start
```

The production server runs on port 3000 by default. The gateway still needs to be running (default port `18789`, or your custom port).

---

## Troubleshooting

### EACCES / EEXIST / permission denied during `npm install -g`

If you see `EACCES: permission denied`, `EEXIST`, or a failed rename in `~/.npm/_cacache` when running `npm install -g clawport-ui`, your npm cache is corrupted or has broken permissions (usually from a previous `sudo npm install`).

**Quick fix** -- clear the cache and retry:

```bash
sudo npm cache clean --force
npm install -g clawport-ui
```

If that still fails, fix the underlying permissions:

```bash
sudo chown -R $(whoami) ~/.npm
npm prefix -g
# Fix permissions on the prefix path, e.g.:
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin
npm install -g clawport-ui
```

**Alternative** -- avoid sudo entirely by installing globals to your home directory:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g clawport-ui
```

> **Warning:** Never use `sudo npm install -g` -- it creates root-owned files that cause permission errors on every future install. Use `nvm` or the `~/.npm-global` prefix approach instead.

### "Missing required environment variable: WORKSPACE_PATH"

Your `.env.local` is missing or the variable isn't set. Make sure you copied `.env.example`:

```bash
cp .env.example .env.local
```

Then fill in the values. Restart the dev server after changing `.env.local`.

### 405 Method Not Allowed when chatting

The gateway's HTTP chat completions endpoint is disabled. Enable it in `~/.openclaw/openclaw.json`:

```json
"gateway": {
  "http": {
    "endpoints": {
      "chatCompletions": { "enabled": true }
    }
  }
}
```

Restart the gateway after changing the config. You can also re-run `clawport setup` which will detect and fix this automatically.

### Gateway connection refused / chat not working

The OpenClaw gateway isn't running. Start it:

```bash
openclaw gateway run
```

Verify it's reachable:

```bash
curl http://localhost:18789/v1/models
```

You should get a JSON response. Replace `18789` with your custom port if you changed it. Set `OPENCLAW_GATEWAY_PORT` in `.env.local` so ClawPort uses the right port.

### No agents showing up

1. **Check `WORKSPACE_PATH`** -- make sure it points to a valid OpenClaw workspace directory.
2. **Check your agents.json** -- if you placed a custom `agents.json` at `$WORKSPACE_PATH/clawport/agents.json`, make sure it's valid JSON. A syntax error will cause a silent fallback to the bundled registry. Test with:
   ```bash
   cat $WORKSPACE_PATH/clawport/agents.json | python3 -m json.tool
   ```
3. **Check the server console** -- ClawPort logs errors to the terminal where `npm run dev` is running.

### Agent SOUL.md not loading

The `soulPath` in your agents.json is relative to `WORKSPACE_PATH`. If your workspace is at `/Users/you/.openclaw/workspace` and `soulPath` is `"agents/vera/SOUL.md"`, ClawPort will look for `/Users/you/.openclaw/workspace/agents/vera/SOUL.md`.

Make sure the file exists at that path.

### Images not working in chat

Image messages use the CLI pipeline (`openclaw gateway call chat.send`). Common issues:

1. **`OPENCLAW_BIN` path is wrong** -- run `which openclaw` and update `.env.local`.
2. **Gateway token is wrong** -- verify with `openclaw gateway status`.
3. **Image too large** -- ClawPort resizes to 1200px max, but extremely large images may still hit limits. Try a smaller image.

Check the server console for errors like `sendViaOpenClaw execFile error:` or `E2BIG`.

### Voice/TTS features not working

Voice features require `ELEVENLABS_API_KEY` in your `.env.local`. Without it, voice indicators won't appear on agent profiles.

Audio transcription (speech-to-text) uses Whisper through the OpenClaw gateway and does not require a separate key.

### Cross-origin errors when accessing over LAN / Tailscale

Next.js blocks requests from non-localhost origins by default. ClawPort ships with `allowedDevOrigins: ["*"]` in `next.config.mjs`, so this should work out of the box. If you see cross-origin errors, make sure you're on v0.6.4+.

### .env.local not found after global install

When installed globally, `clawport setup` writes `.env.local` to `~/.config/clawport-ui/` if the package directory isn't writable. The CLI automatically checks both the package directory and `~/.config/clawport-ui/` when loading env vars. If you moved the file manually, re-run `clawport setup`.

### Port 3000 already in use

Another process is using port 3000. Either stop it or run ClawPort on a different port:

```bash
npm run dev -- -p 3001
```

---

## Running Tests

```bash
npm test             # Run all tests via Vitest
npx tsc --noEmit     # Type-check (expect 0 errors)
```

---

## Developer Guide

For architecture deep-dives, test patterns, and contribution conventions, see [CLAUDE.md](CLAUDE.md).
