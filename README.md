[中文](./README.zh.md) | **English**

# ClawPlay

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Open-source community hub for X Claw social & entertainment Skills.**

ClawPlay lets AI Agents (via X Claw) generate images, analyze vision, and synthesize speech — without managing API keys. Developers submit Skills to a human-reviewed registry; users get a unified CLI and free quota.

---

## Quick Start

### 1. Get your CLI token

```bash
# Sign up at https://clawplay.shop, then copy from Dashboard:
export CLAWPLAY_TOKEN=eyJh...
```

### 2. Install CLI

```bash
npm install -g clawplay
```

### 3. Verify

```bash
clawplay whoami
# ClawPlay User ID: 42
# Quota Remaining:  1000
# Expires:         2026-05-05
```

---

## CLI Usage

```bash
# Image generation
clawplay image generate --prompt "a cyberpunk shrimp on a neon beach"
clawplay image generate --prompt "change style" --ref ./photo.png --size 9:16 --quality 2K
clawplay image generate --prompt "latest news infographic" --web

# Vision analysis
clawplay vision analyze --image ./photo.png
clawplay vision analyze --image ./photo.png --question "How many people are in this photo?"

# Text generation
clawplay llm generate --prompt "Summarize ClawPlay in one sentence"
clawplay llm generate --prompt "Continue the story" --context ./story.txt

# Text-to-speech
clawplay tts synthesize --text "Hello from ClawPlay"
clawplay tts synthesize -t "你好世界" --voice BV001 -o greeting.mp3

# Skill authoring tools
clawplay skill lint ./SKILL.md          # Validate frontmatter + bash instructions
clawplay skill diagram ./SKILL.md       # Generate Mermaid flow diagram
clawplay skill types ./SKILL.md         # TypeScript type check

# Install a skill
clawplay install my-skill

# Other
clawplay whoami
clawplay setup
clawplay setup --agent   # Print setup steps for an agent to relay
```

---

## Architecture

### Relay Mode

```
User → Agent → clawplay CLI → ClawPlay Server (Relay)
                                      ↓
                               1. Decrypt Token → userId
                               2. Check quota (Redis)
                               3. Select Ark key from Key Pool (RPM sharding)
                               4. Call Provider API (Ark / Gemini)
                               5. Return result
                                      ↓
CLI writes file → stdout: /tmp/avatar.png
```

**Constraint**: CLI stdout only emits file paths — never base64 or binary data. This prevents AI Agent context explosion.

**Multi-provider**: Image generation, vision analysis, and LLM text generation all support both Ark and Google Gemini, switchable on demand. Admin-configurable via the Providers management page.

**Key Pool**: Ark API keys are sharded across multiple keys with per-minute RPM limits. Vision and image keys use separate pools. Keys are auto-rotated via scheduled cron jobs.

### Authentication & i18n

Web UI supports three login methods:
- **Email + password**: classic account registration and login
- **OAuth**: GitHub, Google, Discord, X (Twitter), WeChat — one-click social login
- **SMS**: phone number + verification code (China-friendly)

**Multi-language**: Full i18n support with Chinese and English, switchable via the UI language toggle. Translations are served from `/messages/en.json` and `/messages/zh.json`.

**Admin user management**: Administrators can view all users, update roles, and manage permissions from the Admin Panel.

### Homepage & Analytics

The homepage displays global platform statistics (total users, total skills, total events) with real-time updates. An event tracking system (`eventLogs` + `userStats` tables) records every API call including input/output tokens, provider, and latency for analytics and billing.

CLI authentication: encrypted token exported from the dashboard (`CLAWPLAY_TOKEN`). Tokens are AES-256-GCM encrypted; the CLI decrypts locally and never sends the plaintext token to the server.

### Token Security

Tokens are AES-256-GCM encrypted on the server. The plaintext (userId, expiry) is decryptable by the CLI locally but cannot be forged. Token hashes are stored in DB for revocation. Quota is always read from Redis/DB at relay time.

### Relay API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ability/image/generate` | Image generation (Relay) |
| `POST` | `/api/ability/vision/analyze` | Vision analysis (Relay) |
| `POST` | `/api/ability/llm/generate` | Text generation (Relay) |
| `POST` | `/api/ability/tts/synthesize` | TTS synthesis (Relay) |
| `GET` | `/api/ability/check` | Quota check |

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- SQLite (via `better-sqlite3`, auto-initialized)
- Upstash Redis (free tier at https://console.upstash.com)
- Provider keys are managed in the admin Providers page

### Setup

```bash
cd web
cp .env.example .env.local
# Fill in: JWT_SECRET, CLAWPLAY_SECRET_KEY, UPSTASH_REDIS_REST_URL/TOKEN, DATABASE_URL, BASE_URL
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

**Web (`web/.env.local`)**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | 32-byte JWT signing secret (`openssl rand -base64 32`) |
| `CLAWPLAY_SECRET_KEY` | 32-byte AES-256-GCM key (`openssl rand -hex 32`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |
| `DATABASE_URL` | SQLite path (default: `../data/clawplay.db`) |

**CLI**

| Variable | Description |
|----------|-------------|
| `CLAWPLAY_TOKEN` | Encrypted token exported from Dashboard |
| `CLAWPLAY_API_URL` | ClawPlay server URL (default: production) |

### Project Structure

```
ClawPlay/
├── web/                          # Next.js 14 app
│   ├── app/
│   │   ├── (auth)/               # Login / register pages + OAuth callbacks
│   │   ├── (app)/                # Authenticated pages (Dashboard, Skills, Submit, Community)
│   │   ├── (admin)/              # Admin panel (audit, events, overview, providers, review, users)
│   │   ├── api/                  # API routes (~45 total)
│   │   │   ├── ability/          # Relay: image, vision, llm, tts, check
│   │   │   ├── admin/            # Admin: analytics, audit-logs, keys, skills, users
│   │   │   ├── auth/            # Auth: login, logout, register, sms, oauth callbacks
│   │   │   ├── cron/            # Cron: reset-keys
│   │   │   ├── skills/          # Skills: list, submit, {slug}, versions, install, download, reviews
│   │   │   └── user/            # User: me, analytics, token
│   │   └── page.tsx             # Homepage
│   ├── components/
│   │   ├── charts/               # LineChart, PieChart
│   │   ├── FeaturedCarousel.tsx  # Featured skills carousel
│   │   └── SkillDiagramPreview.tsx # Mermaid diagram renderer
│   └── lib/
│       ├── db/                   # Drizzle ORM + SQLite schema
│       ├── auth.ts               # JWT helpers
│       ├── auth/admin.ts         # Admin auth middleware
│       ├── token.ts              # AES-256-GCM token crypto
│       ├── redis.ts              # Upstash Redis quota helpers
│       ├── analytics.ts          # Event tracking system
│       ├── oauth.ts              # OAuth provider configs + callbacks
│       ├── wechat.ts             # WeChat OAuth helpers
│       ├── sms.ts                # SMS send/verify helpers
│       ├── i18n/                 # Custom i18n (server + client contexts)
│       ├── context/              # React contexts (AdminUserContext)
│       ├── skill-security-scan.ts # Skill XSS/SSRF/injection pre-scan
│       ├── skill-llm-safety.ts   # LLM output safety pre-check
│       ├── model-config.ts       # Per-ability model selection
│       └── providers/            # Multi-provider integrations (Ark, Gemini)
│           ├── key-pool.ts       # Multi-key sharding with RPM limits
│           ├── image/            # Image generation
│           ├── vision/           # Vision analysis
│           └── llm/              # Text generation
├── cli/                          # Shell CLI
│   ├── clawplay                  # Main entry (subcommand router)
│   ├── lib/
│   │   ├── token.sh              # Token read + local decrypt
│   │   ├── image.sh              # Image generation relay client
│   │   ├── vision.sh             # Vision analysis relay client
│   │   ├── llm.sh               # LLM generation relay client
│   │   ├── install.sh           # Skill install client
│   │   └── api.sh               # HTTP call helpers
│   └── skill/                    # Skill authoring toolkit
│       ├── lint.mjs              # SKILL.md syntax validator
│       ├── diagram.mjs           # Mermaid flow diagram generator
│       └── types.mjs             # TypeScript type checker
├── docs/                         # Documentation
│   ├── clawplay-commands.md      # CLI command reference + bash toolkit
│   └── skill-authoring-guide.md  # Advanced skill development guide
└── data/                         # SQLite DB (gitignored)
```

### Database

Schema lives in `web/lib/db/schema.ts`. Auto-migrates on first run.

```bash
# Run migrations manually
cd web && pnpm drizzle-kit generate
```

### Testing

```bash
cd web

# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright)
pnpm playwright install
pnpm playwright test

# Run both
pnpm test:all
```

---

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| Phase 1 | Core infrastructure (CLI, Web, Relay, Token system, i18n, OAuth, Analytics) | ✅ Done |
| Phase 2 | CN launch + initial user accumulation (providers ✅, user roles ✅, skill versioning ✅, auth, onboarding) | 🔲 In Progress |
| Phase 3 | Social & UX (reviews ✅, Featured carousel ✅, Analytics ✅, sharing, notifications) | 🔲 In Progress |
| Phase 4 | Monetization & scale (Token Plans, multi-provider failover; LLM safety pre-scan ✅) | 🔲 Planned |
| Phase 5 | Advanced AI — dual-track: Skill recovery + IP memory knowledge base | 🔲 Planned |
| Phase 6 | International expansion + Mobile app | 🔲 Planned |

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## Documentation

- [CLI Command Reference](docs/clawplay-commands.md) — All commands, parameters, examples, error handling
- [Skill Authoring Guide](docs/skill-authoring-guide.md) — Flow diagram design, prompt templates, reliability patterns

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Submit a Skill via the web UI for community review
4. Or open an issue / discussion

All Skills are human-reviewed before publication to protect X Claw users.
