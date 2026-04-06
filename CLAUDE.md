# ClawPlay — Developer Context

## What is this project?

ClawPlay is an open-source community hub for X Claw social/entertainment Skills. Phase 1 goals:

1. **Unified Multimodal CLI** (`clawplay`) — one CLI for image, vision, LLM, TTS; replaces raw API keys
2. **Web App** (Next.js 14) — Skill registry with human review, user registration, free tier quotas
3. **Token System** — AES-256-GCM encrypted tokens that protect provider API keys from Skill developers
4. **Multi-Provider Relay** — Ark + Gemini, routed server-side; quota enforced at relay layer
5. **One-click setup** — Homepage generates `export CLAWPLAY_TOKEN=...` for X Claw environment

> **Documentation is bilingual**: [English](./README.md) / [中文](./README.zh.md)

## Tech Stack

| Module | Choice | Why |
|--------|--------|-----|
| Web | Next.js 14 App Router | Stable, SSR + API Routes |
| DB | SQLite + Drizzle ORM | Zero-ops, file-based |
| Quota | Upstash Redis | Free tier (90K/day), serverless |
| Auth | JWT via httpOnly Cookie | XSS-safe, Secure + SameSite=Strict |
| CLI | Shell Script | OpenClaw is bash; aligns with take-your-claw pattern |
| Style | Tailwind CSS v3 | From create-next-app |
| Testing | Vitest + Playwright | Consistent with ClawHub |

## Project Structure

```
ClawPlay/
├── web/                          # Next.js 14 app
│   ├── app/
│   │   ├── (auth)/               # Login/register pages
│   │   ├── (app)/                # Authenticated pages (dashboard, skills, submit); layout provides nav shell on Skills routes
│   │   ├── (admin)/              # Admin review panel
│   │   ├── api/                  # 22 API routes
│   │   ├── page.tsx              # Homepage (one-click token copy)
│   │   └── layout.tsx
│   ├── components/               # Shared React components
│   └── lib/
│       ├── db/
│       │   ├── schema.ts         # Tables: users, skills, skill_versions, user_tokens
│       │   └── index.ts          # SQLite connection + auto-migration
│       ├── auth.ts               # JWT signing/verification, httpOnly cookie helpers
│       ├── token.ts              # AES-256-GCM token encryption/decryption
│       ├── redis.ts              # Upstash Redis client + quota helpers
│       ├── audit.ts              # Append-only JSONL audit log writer
│       ├── sms.ts                # SMS OTP provider (Aliyun)
│       ├── wechat.ts             # WeChat OAuth client
│       └── providers/            # Multi-provider abstraction layer
│           ├── image/            # image generation: ark + gemini
│           ├── vision/           # image understanding: ark + gemini
│           └── llm/              # text generation: ark + gemini
├── cli/                          # Shell CLI
│   ├── clawplay                  # Main entry (subcommand router)
│   ├── lib/
│   │   ├── token.sh              # Read + decrypt CLAWPLAY_TOKEN locally
│   │   ├── image.sh              # Relay client: POST /api/ability/image/generate
│   │   ├── vision.sh             # Relay client: POST /api/ability/vision/analyze
│   │   ├── llm.sh                # Relay client: POST /api/ability/llm/generate
│   │   └── api.sh                # HTTP call helpers
│   └── skill/                    # Skill authoring toolkit
│       ├── lint.mjs              # SKILL.md syntax + bash static analysis
│       ├── diagram.mjs           # SKILL.md → Mermaid flow diagram
│       └── types.mjs             # TypeScript type inference from frontmatter
├── docs/
│   ├── clawplay-commands.md      # CLI command reference
│   ├── skill-authoring-guide.md  # Advanced skill development guide
│   └── providers/                # Provider API parameter docs (Ark + Gemini)
├── data/                         # SQLite DB (git-ignored)
│   └── clawplay.db
├── README.md                     # English (GitHub default)
├── README.zh.md                  # 中文
├── ROADMAP.md                    # Phases 1–6 roadmap
└── CLAUDE.md                     # This file
```

## Key Patterns

### Database (SQLite + Drizzle)

Tables are defined in `lib/db/schema.ts`. Auto-migrates on `lib/db/index.ts` import.

```ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// db.query — for read operations (cached)
db.select().from(users).where(eq(users.email, email));

// db.execute — for raw SQL + mutations
db.execute(sql`INSERT INTO users ...`);
```

### Authentication (JWT + httpOnly Cookie)

```ts
// Set cookie on login/register
import { SignJWT } from "jose";
const token = await new SignJWT({ userId }).setExpirationTime("7d").sign(key);
response.cookies.set("clawplay_token", token, {
  httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 7
});

// Read cookie in API route
import { cookies } from "next/headers";
const token = (await cookies()).get("clawplay_token")?.value;
```

### Quota System (Upstash Redis)

```ts
// Check + increment quota atomically
const key = `clawplay:quota:${userId}`;
const result = await redis.get<{ used: number; limit: number }>(key);
// WATCH + MULTI + EXEC for atomic increment (see lib/redis.ts)
```

### Token Encryption (AES-256-GCM)

```ts
// Server side — generate token
const payload = JSON.stringify({ userId, quotaFree, exp });
const encrypted = await encryptAES(payload, secretKey);
// Store hash + encrypted in DB

// CLI side — decrypt locally (never sends plaintext token to server)
const payload = await decryptAES(encryptedToken, secretKey);
```

### Skill Frontmatter Parsing

```ts
import matter from "gray-matter";
const { data, content } = matter(skillMdContent);
// data.metadata.clawdbot.requires.env / bins
```

## Environment Variables

### Web (`web/.env.local`)

```
DATABASE_URL=              # SQLite path (default: ../data/clawplay.db)
JWT_SECRET=                # 32-byte hex or base64 for jose
CLAWPLAY_SECRET_KEY=       # 32-byte hex for AES-256-GCM
UPSTASH_REDIS_REST_URL=    # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=  # Upstash Redis REST Token
ARK_API_KEY=               # Volcengine Ark API Key (server-side only)
GEMINI_API_KEY=            # Google Gemini API Key (optional, multi-provider fallback)
```

### CLI

```
CLAWPLAY_TOKEN=            # Encrypted token (export from dashboard)
CLAWPLAY_API_URL=          # ClawPlay server URL (default: production)
ARK_API_KEY=               # Direct provider mode — bypasses quota (optional)
```

## Runtime Execution Model

OpenClaw Skills 是**文档驱动的执行框架**（不是插件系统）。Agent（Claude Code）读取 SKILL.md 中的 bash 指令，用 exec 工具执行。

```
用户消息 → OpenClaw Agent（Claude Code）
  ↓ 读取 SKILL.md
Agent exec: bash clawplay image generate --prompt "..."
  ↓
CLI: 读取 $CLAWPLAY_TOKEN → POST /api/ability/image/generate
  ↓
ClawPlay Server（Relay）:
  1. 解密 Token → userId
  2. Redis WATCH quota:{userId} → 检查 used+10 ≤ limit
  3. INCR quota_used
  4. 调用 Provider API（Ark 或 Gemini）→ 返回图片
  ↓
CLI: 写入 /tmp/avatar.png
  ↓
Agent 继续使用图片（发回用户）
```

**关键约束（防止上下文爆炸）**：
- CLI stdout **只能输出文件路径**（如 `/tmp/avatar.png`），禁止输出 base64 或任何二进制内容
- Relay 返回 base64 → CLI 解码写文件 → stdout 只 echo 路径
- Agent 上下文看到的是 `✓ /tmp/avatar.png`，不是图片数据

## All API Routes (22 total)

**Ability/Relay Routes（5个）**
```
POST /api/ability/image/generate   — 图像生成（Relay）
POST /api/ability/vision/analyze   — 视觉分析（Relay）
POST /api/ability/llm/generate     — 文本生成（Relay）
POST /api/ability/tts/synthesize   — TTS 合成（Relay）
GET  /api/ability/check            — 配额查询
```

**Auth Routes（7个）**
```
POST /api/auth/register            — 邮箱注册
POST /api/auth/login               — 邮箱登录
POST /api/auth/logout              — 登出（清除 httpOnly cookie）
POST /api/auth/sms/send            — 发送 SMS OTP
POST /api/auth/sms/verify          — 验证 SMS OTP
POST /api/auth/wechat/route        — 发起微信 OAuth
POST /api/auth/wechat/callback     — 微信 OAuth 回调
```

**User Routes（3个）**
```
GET  /api/user/me                  — 当前用户信息
POST /api/user/token/generate      — 生成加密 CLAWPLAY_TOKEN
POST /api/user/token/revoke        — 撤销 Token
```

**Skills Routes（4个）**
```
GET  /api/skills                   — Skill 列表（SSR，筛选已审核）
GET  /api/skills/[slug]            — Skill 详情
GET  /api/skills/[slug]/versions   — 版本历史
POST /api/skills/submit            — 提交 Skill（pending 状态）
```

**Admin Routes（3个）**
```
GET  /api/admin/skills             — 审核队列（pending 过滤）
PATCH /api/admin/skills/[id]       — 通过/拒绝（写 JSONL 审计日志）
GET  /api/admin/audit-logs         — 读取 append-only 审计日志
```

## Multi-Provider Abstraction

All abilities route through a provider abstraction layer in `web/lib/providers/`. Providers are selected server-side; CLI only sends generic params.

| Ability | Default Provider | Fallback | Key Difference |
|---------|-----------------|----------|----------------|
| Image generation | Volcengine Ark (`doubao-seedream-5-0-260128`) | Gemini (`gemini-3.1-flash-image-preview`) | Ark returns URL → CLI downloads; Gemini returns base64 |
| Vision analysis | Volcengine Ark | Gemini | Ark supports `file://` direct upload (512MB); Gemini requires base64 |
| LLM text generation | Gemini | Volcengine Ark | Both support streaming; Ark optimized for Chinese |

**Provider-specific notes**:
- Ark: `response_format: "url"` for images; supports web search
- Gemini: base64 inline; `gemini-3.1-flash-image-preview` for images; inline media < 20MB total request body
- Rate limit (429) from any provider: **do NOT deduct quota** (fail-open, no double-penalty)

## Common Commands (Makefile)

Run from the project root:

| Command | Purpose |
|---------|---------|
| `make dev` | Clean restart — kills port 3000, clears `.next` cache, starts dev server |
| `make restart` | Fast restart — kills process only, no cache clear |
| `make build` | Production build (`web/`) |
| `make test` | Unit tests (Vitest) |
| `make e2e` | Playwright E2E tests (requires dev server) |
| `make clean` | Full clean — removes `.next` + `node_modules`, reinstalls |

> Use `make dev` whenever you see "missing required error components" or stale bundle errors.

## Key Files to Read First

- `web/lib/db/schema.ts` — All table definitions
- `web/lib/db/index.ts` — DB connection + auto-migration
- `web/lib/auth.ts` — JWT signing/verification helpers
- `web/lib/token.ts` — AES-256-GCM encryption
- `web/lib/redis.ts` — Quota management (atomic WATCH+MULTI+EXEC)
- `web/lib/audit.ts` — Append-only JSONL audit log writer
- `web/lib/providers/*/index.ts` — Provider routing logic
- `web/app/api/` — All 22 API routes
- `cli/clawplay` — CLI subcommand router
- `cli/skill/` — Skill authoring tools (lint, diagram, types)
- `docs/clawplay-commands.md` — CLI command reference
- `docs/skill-authoring-guide.md` — Advanced skill development guide

## Reference Implementations

- `take-your-claw/scripts/draw.sh` — Provider script pattern (API call + error handling)
- `take-your-claw/SKILL.md` — Skill frontmatter structure
- `/Users/mindstorm/Projects/opensource/clawhub/` — Full-stack reference (skills registry, moderation, versioned releases)

## Important Gotchas

### Security
- **Token never leaves CLI plaintext**: Server stores AES-256-GCM encrypted blob + hash; CLI decrypts locally using `CLAWPLAY_SECRET_KEY`; server never sees plaintext
- **httpOnly cookie only**: Never use localStorage for JWT; XSS can steal localStorage but not httpOnly cookies
- **Auth failures not logged by default**: Login failures / duplicate registrations should be audit-logged (see `web/lib/audit.ts`); currently no security trail for auth failures
- **No secrets in logs**: stdout logs must never include tokens, passwords, or API keys

### Provider & Relay
- **Relay is mandatory for quota**: Direct `ARK_API_KEY` in CLI env bypasses relay and quota; this is the intended Pro mode, not a bug
- **Provider 429 = skip quota deduction**: When Ark/Gemini rate-limits, return error without deducting quota to avoid double-penalty; log the skip
- **Base64 memory pressure**: Gemini returns inline base64; large concurrent requests strain Node memory. Ark returns URLs → CLI downloads → less memory pressure
- **Ark wrong endpoint historically**: Old CLI used `/api/v3/chat/completions` for images; correct endpoint is `/api/v3/images/generations`; response parsing also differs (`data[0].b64_json` not `choices[0].message`)
- **Image file size limits**: Ark single image < 10MB; Gemini request body < 20MB total; CLI should warn for > 20MB files

### Database & Quota
- **Redis optional**: Without Upstash, quota falls back to DB (slower, no atomic increment); log a warning when falling back
- **WATCH+MULTI+EXEC race condition**: Under high concurrency, naive Redis transactions can lose quota updates; consider a Lua script for true atomicity in Phase 3
- **Soft delete**: Skills use `deletedAt` nullable timestamp, not hard delete; queries must filter `deletedAt IS NULL`
- **Token revocation**: Set `revokedAt` in `user_tokens`; CLI checks this field after decrypting

### CLI & Skill Authoring
- **stdout = file path only**: Never output base64, binary, or JSON to stdout; errors go to stderr with `[clawplay <subcommand>]` prefix
- **CLI does Base64 encoding**: For vision analysis, CLI Base64-encodes images before POST to reduce relay bandwidth; server receives base64, not raw files
- **MIME type detection**: For unknown file extensions, use `file -b --mime-type`; fallback to `image/png`
- **Figma designs > current code**: Some pages in Figma (Reviews section) are aspirational and NOT in Phase 1; do not implement Figma-only features without confirmation. Implemented so far: Dashboard full-width layout with sidebar, Skills horizontal card list with hero + filters.

### Testing
- **No real network calls in unit tests**: Mock Upstash Redis, mock Volcengine/Gemini API responses
- **E2E tests**: Run against live dev server (`localhost:3000`); use `e2e/helpers/auth.ts` for `loginAs` + `registerUser` helpers
- **SMS/WeChat can be mocked**: These routes exist but UI wiring and full OAuth flow may not be complete; test with mock responses
- **CLI unit tests**: Pure bash, zero external dependencies; `curl` is mocked via function override in isolated subprocesses. Run with `bash cli/tests/run-all.sh` or via `make test`. Test files live in `cli/tests/` — one file per lib (`token`, `api`, `image`, `llm`, `vision`, `install`); shared harness in `cli/tests/helpers.sh`
- **`make test`** runs both web unit tests (`cd web && npm test`) and CLI bash tests in sequence

## Bilingual Documentation Convention

All user-facing documentation must be maintained in both English and Chinese:
- `README.md` — English (GitHub default, shown to international visitors)
- `README.zh.md` — 中文 (links to English at top)
- `docs/` — English-only for technical docs (universal developer audience)
- Code comments — bilingual for critical logic (auth, token, quota)
- API responses — English only (developer API contract)

When adding features, update both README files and keep them in sync.

## Design Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-03 | Shell Script CLI | OpenClaw is bash; Python SDK not applicable |
| 2026-04-03 | httpOnly Cookie for JWT | Avoids XSS risk of localStorage |
| 2026-04-03 | SQLite (not PostgreSQL) | Zero-ops for community project |
| 2026-04-03 | Upstash Redis for quota | Free tier matches design doc; serverless = no state loss on restart |
| 2026-04-03 | JSONL for audit logs | Append-only immutability; Phase 1 scale sufficient |
| 2026-04-03 | Single repo (not monorepo) | Phase 1 simplicity; can split to workspaces later |
| 2026-04-03 | Next.js 14 (not 15) | Phase 1 doesn't need v15 features |
| 2026-04-03 | Warm Light design | Differentiates from ClawHub dark + Tencent corporate blue |
| 2026-04-04 | Relay 模式控制配额 | 无 Relay = 无法控制配额；Relay 是配额控制的唯一手段 |
| 2026-04-04 | Shell Installer 分发 CLI | SKILL.md 中指引用户 curl install.sh 安装，全局复用一份 CLI |
| 2026-04-05 | Multi-provider abstraction | Ark + Gemini routed server-side; CLI sends generic params only |
| 2026-04-05 | JSONL audit (not DB table) | Append-only immutability; avoids DB write bottleneck under load |
| 2026-04-06 | 分语言 README | GitHub 默认展示英文；中文用户通过 README.zh.md 访问 |
| 2026-04-06 | Dashboard 页面改版 | 全宽布局 + 左侧边栏，与 Figma 设计对齐；去掉占位符卡片（Community Status / Auto-Refill / 2FA / Cloud Sync）；Token 生成时间改为从 DB 读取 |
| 2026-04-06 | Skills 技能库页面改版 | Hero 标题 + 搜索栏 + 分类筛选 + 横向卡片布局，与 Figma 设计对齐；(app)/layout.tsx 提供 Skills 路由专用导航壳（顶部导航 + 左侧边栏） |
| 2026-04-06 | Phase 2 i18n | next-intl v4 + middleware cookie locale detection; NEXT_LOCALE env var for CN/overseas default; localePrefix: never (clean URLs); zh default |
| 2026-04-06 | CLI bash 单元测试 | 纯 bash + curl mock（函数覆盖），零外部依赖；84 个用例覆盖全部 lib（token/api/image/llm/vision/install）；`make test` 同时跑 web + CLI |
| 2026-04-06 | mktemp 不带扩展名 | macOS BSD mktemp 要求 X 在末尾，带 .png/.zip 后缀时返回字面量路径；image.sh / install.sh 统一改用 `mktemp` |
| 2026-04-06 | Phase 6 并入 Phase 2 | 原 Phase 6（GitHub OAuth / Stripe / 多区域部署 / 英文社区）并入 Phase 2；Phase 2 现为"社区与生态 + 国际化"；原 Phase 3/4/5 序号前移 |
