<div align="center">

<img src="https://raw.githubusercontent.com/JohnRiceML/clawport-ui/main/clawport-logo.png" alt="ClawPort" width="160" />

# ClawPort

**A visual command centre for your AI agent team.**

[![npm version](https://img.shields.io/npm/v/clawport-ui.svg)](https://www.npmjs.com/package/clawport-ui)
[![license](https://img.shields.io/npm/l/clawport-ui.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-781%20passed-brightgreen)](#testing)

[Website](https://clawport.dev) | [Setup Guide](SETUP.md) | [API Docs](docs/API.md) | [npm](https://www.npmjs.com/package/clawport-ui)

</div>

---

ClawPort is an open-source dashboard for managing, monitoring, and talking directly to your [OpenClaw](https://openclaw.ai) AI agents. It connects to your local OpenClaw gateway and gives you an org chart, direct agent chat with vision and voice, a kanban board, cron monitoring, cost tracking, an activity console with live log streaming, and a memory browser -- all in one place.

No separate AI API keys needed. Everything routes through your OpenClaw gateway.

<img src="docs/screenshots/org-map.png" alt="Org Map" width="100%" />

<details>
<summary><strong>More screenshots</strong></summary>

| | |
|---|---|
| <img src="docs/screenshots/chat.png" alt="Agent Chat" /> | <img src="docs/screenshots/kanban.png" alt="Kanban Board" /> |
| **Chat** -- streaming text, vision, voice, file attachments | **Kanban** -- drag-and-drop task board across agents |
| <img src="docs/screenshots/pipelines.png" alt="Cron Pipelines" /> | <img src="docs/screenshots/cron-schedule.png" alt="Cron Schedule" /> |
| **Pipelines** -- DAG visualization with health checks | **Schedule** -- weekly heatmap and job management |
| <img src="docs/screenshots/activity.png" alt="Activity Console" /> | <img src="docs/screenshots/live-logs.png" alt="Live Logs" /> |
| **Activity** -- historical log browser with JSON expansion | **Live Logs** -- real-time streaming widget |
| <img src="docs/screenshots/costs.png" alt="Cost Dashboard" /> | <img src="docs/screenshots/memory.png" alt="Memory Browser" /> |
| **Costs** -- token usage, anomalies, optimization insights | **Memory** -- team memory browser with markdown rendering |

</details>

---

## Quick Start

### 1. Install OpenClaw

ClawPort requires a running [OpenClaw](https://openclaw.ai) instance. If you don't have one yet:

```bash
# Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash

# Run the onboarding wizard (sets up workspace, gateway, and daemon)
openclaw onboard --install-daemon
```

After onboarding, verify the gateway is running:

```bash
openclaw gateway status
```

You should see your gateway URL (default `localhost:18789`) and auth token. If you use a custom port, `clawport setup` will detect it automatically. See the [OpenClaw docs](https://docs.openclaw.ai/getting-started) for more detail.

### 2. Install ClawPort

> **Note:** The npm package is `clawport-ui`. The CLI command is `clawport`.
> Do not install the unrelated `clawport` package.

```bash
npm install -g clawport-ui
```

### 3. Connect and Launch

```bash
# Auto-detect your OpenClaw config and write .env.local
clawport setup

# Start the dashboard
clawport dev
```

Open [http://localhost:3000](http://localhost:3000). The onboarding wizard walks you through naming your portal, picking a theme, and setting up your operator identity.

<details>
<summary><strong>Install from source instead</strong></summary>

```bash
git clone https://github.com/JohnRiceML/clawport-ui.git
cd clawport-ui
npm install
npm run setup
npm run dev
```

</details>

---

## Features

- **Org Map** -- Interactive org chart of your entire agent team. Hierarchy, cron status, and relationships at a glance. Powered by React Flow with auto-layout.
- **Chat** -- Streaming text chat, image attachments with vision, voice messages with waveform playback, file attachments, clipboard paste and drag-and-drop. Conversations persist locally.
- **Kanban** -- Task board for managing work across agents. Drag-and-drop cards with agent assignment and chat context.
- **Cron Monitor** -- Live status of all scheduled jobs. Filter by status, sort errors to top, expand for details. Auto-refreshes every 60 seconds.
- **Cost Dashboard** -- Token usage and cost analysis across all cron jobs. Daily cost chart, per-job breakdown, model distribution, anomaly detection, week-over-week trends, and cache savings.
- **Activity Console** -- Log browser for historical events plus a floating live stream widget. Click any log row to expand the raw JSON. The live stream widget persists across page navigation.
- **Memory Browser** -- Read team memory, long-term memory, and daily logs. Markdown rendering, JSON syntax highlighting, search, and download. Guide tab with categorized best practices.
- **Agent Detail** -- Full profile per agent: SOUL.md viewer, tools, hierarchy, crons, voice ID, and direct chat link.
- **Five Themes** -- Dark, Glass, Color, Light, and System. All CSS custom properties -- switch instantly.
- **Auto-Discovery** -- Automatically finds agents from your OpenClaw workspace. No config file needed.

---

## How It Works

ClawPort reads your OpenClaw workspace to discover agents, then connects to the gateway for all AI operations:

```
Browser  -->  ClawPort (Next.js)  -->  OpenClaw Gateway (localhost:18789 default)  -->  Claude
                  |                          |
                  |                     Text: /v1/chat/completions (streaming SSE)
                  |                     Vision: openclaw gateway call chat.send (CLI)
                  |                     Audio: /v1/audio/transcriptions (Whisper)
                  |
             Reads from:
               $WORKSPACE_PATH/agents/    (agent SOUL.md files)
               $WORKSPACE_PATH/memory/    (team memory)
               openclaw cron list         (scheduled jobs)
```

All AI calls -- chat, vision, TTS, transcription -- route through the gateway. One token, no separate API keys.

---

## Configuration

### Required Environment Variables

| Variable | Description | How to find it |
|----------|-------------|----------------|
| `WORKSPACE_PATH` | Path to your OpenClaw workspace | Read from `~/.openclaw/openclaw.json` (agents.defaults.workspace) |
| `OPENCLAW_BIN` | Path to the `openclaw` binary | Run `which openclaw` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token | Run `openclaw gateway status` |

### Optional

| Variable | Description |
|----------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key for voice indicators on agent profiles |

Running `clawport setup` auto-detects all required values and writes `.env.local`. When installed globally, if the package directory isn't writable, setup writes to `~/.config/clawport-ui/.env.local` instead. See [SETUP.md](SETUP.md) for manual configuration, agent customization, and troubleshooting.

---

## Agent Discovery

ClawPort automatically discovers agents from your OpenClaw workspace. No configuration file needed.

**What it scans:**
- `$WORKSPACE_PATH/SOUL.md` -- root orchestrator
- `$WORKSPACE_PATH/IDENTITY.md` -- root agent name and emoji
- `agents/<name>/SOUL.md` -- top-level agents
- `agents/<name>/sub-agents/*.md` -- flat sub-agent files
- `agents/<name>/members/*.md` -- team member files
- `agents/<name>/<subdir>/SOUL.md` -- nested subdirectory agents

**What it ignores:**
- Directories without `SOUL.md` (e.g., `briefs/`, data files)
- Non-`.md` files in `sub-agents/` and `members/`

For full control over names, colors, hierarchy, and tools, create `$WORKSPACE_PATH/clawport/agents.json`. See [SETUP.md](SETUP.md) for the schema and examples.

---

## CLI

```bash
clawport dev      # Start the development server
clawport start    # Build and start production server
clawport setup    # Auto-detect OpenClaw config, write .env.local
clawport status   # Check gateway reachability and config
clawport help     # Show usage
```

---

## Testing

```bash
npm test             # 781 tests across 32 suites (Vitest)
npx tsc --noEmit     # Type-check (zero errors)
npx next build       # Production build
```

---

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [React 19](https://react.dev) / [TypeScript 5](https://typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [React Flow](https://reactflow.dev) -- org chart
- [Vitest 4](https://vitest.dev) -- testing
- [OpenClaw](https://openclaw.ai) -- AI gateway and agent runtime

---

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Full setup guide, agent customization, troubleshooting |
| [docs/API.md](docs/API.md) | REST API reference for all endpoints |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | UI component catalog (50+ components) |
| [docs/THEMING.md](docs/THEMING.md) | Theme system, CSS tokens, settings API |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [docs/OPENCLAW.md](docs/OPENCLAW.md) | OpenClaw integration reference |
| [CLAUDE.md](CLAUDE.md) | Developer architecture guide |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

---

## License

[MIT](LICENSE)

---

Built by [John Rice](https://github.com/JohnRiceML) with [Jarvis](https://openclaw.ai) (OpenClaw AI).
