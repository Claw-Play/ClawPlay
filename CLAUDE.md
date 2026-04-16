# ClawPlay — Developer Context

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

### Analytics Event Tracking

```ts
import { analytics } from "@/lib/analytics";

// Fire-and-forget — logs to eventLogs table asynchronously
analytics.quota.use(userId, "image", 1000, { inputTokens: 500, outputTokens: 500, totalTokens: 1000, provider: "ark" });
analytics.user.login(userId);
analytics.skill.submit(userId, skillSlug, true);
```

### Key Pool (Multi-Key Sharding)

Keys are loaded from env vars on server start and stored encrypted in `providerKeys` table. Each key has a per-minute RPM limit with automatic window reset via cron.

```ts
// Env vars for key pool
ARK_API_KEY=key1               // single key, used for both image and vision
ARK_KEY_QUOTA=500              // per-key RPM limit for image keys
ARK_VISION_KEY_QUOTA=30000    // per-key RPM limit for vision keys
```

## Environment Variables

### Web (`web/.env.local`)

```
DATABASE_URL=              # SQLite path (default: ../data/clawplay.db)
JWT_SECRET=                # 32-byte hex or base64 for jose
CLAWPLAY_SECRET_KEY=       # 32-byte hex for AES-256-GCM
UPSTASH_REDIS_REST_URL=    # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=  # Upstash Redis REST Token
ARK_API_KEY=               # Ark API key (used for image, vision, LLM)
ARK_KEY_QUOTA=500         # Per-key RPM limit for image keys
ARK_VISION_KEY_QUOTA=30000# Per-key RPM limit for vision keys
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
  4. 从 Key Pool 选择 Ark Key（按 RPM 窗口轮询）
  5. 调用 Provider API（Ark 或 Gemini）→ 返回图片
  ↓
CLI: 写入 /tmp/avatar.png
  ↓
Agent 继续使用图片（发回用户）
```

**关键约束（防止上下文爆炸）**：
- CLI stdout **只能输出文件路径**（如 `/tmp/avatar.png`），禁止输出 base64 或任何二进制内容
- Relay 返回 base64 → CLI 解码写文件 → stdout 只 echo 路径
- Agent 上下文看到的是 `✓ /tmp/avatar.png`，不是图片数据

## All API Routes (~26 total)

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

**User Routes（5个）**
```
GET  /api/user/me                  — 当前用户信息
POST /api/user/token/generate      — 生成加密 CLAWPLAY_TOKEN
POST /api/user/token/refresh       — 刷新 Token（撤销旧 Token，生成新 Token）
POST /api/user/token/revoke         — 撤销 Token
GET  /api/user/analytics/          — 用户级分析数据（配额使用趋势等）
```

**Skills Routes（6个）**
```
GET  /api/skills                   — Skill 列表（SSR，筛选已审核）
GET  /api/skills/[slug]            — Skill 详情
GET  /api/skills/[slug]/versions   — 版本历史
POST /api/skills/submit            — 提交 Skill（pending 状态 + LLM 安全预审）
GET  /api/skills/[slug]/reviews    — 获取评论列表
POST /api/skills/[slug]/reviews    — 提交评分/评论
```

**Admin Routes（7个）**
```
GET  /api/admin/skills             — 审核队列（pending 过滤）
PATCH /api/admin/skills/[id]        — 通过/拒绝（写 JSONL 审计日志）
GET  /api/admin/audit-logs         — 读取 append-only 审计日志
GET  /api/admin/analytics/overview — 平台总览数据（用户数/Skill数/配额使用）
GET  /api/admin/analytics/events   — 事件流数据（eventLogs 聚合查询）
GET  /api/admin/analytics/users    — 用户统计数据（userStats 聚合）
GET  /api/admin/keys/              — Provider Key Pool 管理
```

**Cron Routes（1个）**
```
POST /api/cron/reset-key-windows   — 重置 Key Pool RPM 窗口计数器（每分钟调用）
```

## Multi-Provider Abstraction

All abilities route through a provider abstraction layer in `web/lib/providers/`. Providers are selected server-side; CLI only sends generic params.

| Ability | Default Provider | Fallback | Key Difference |
|---------|-----------------|----------|----------------|
| Image generation | Volcengine Ark (`doubao-seedream-5-0-260128`) | Gemini (`gemini-3.1-flash-image-preview`) | Ark returns URL → CLI downloads; Gemini returns base64 |
| Vision analysis | Volcengine Ark | Gemini | Ark supports `file://` direct upload (512MB); Gemini requires base64 |
| LLM text generation | Gemini | Volcengine Ark | Both support streaming; Ark optimized for Chinese |

**Key Pool Sharding**: Ark keys are sharded across multiple keys with per-minute RPM limits. Selection uses round-robin with availability checks. Vision keys use a separate pool with higher limits.

**Provider-specific notes**:
- Ark: `response_format: "url"` for images; supports web search
- Gemini: base64 inline; `gemini-3.1-flash-image-preview` for images; inline media < 20MB total request body
- Rate limit (429) from any provider: **do NOT deduct quota** (fail-open, no double-penalty)

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
- **Key Pool**: `ARK_API_KEY` is used for both image and vision pools; each pool has its own per-key quota (`ARK_KEY_QUOTA` / `ARK_VISION_KEY_QUOTA`)

### Database & Quota
- **Redis optional**: Without Upstash, quota falls back to DB (slower, no atomic increment); log a warning when falling back
- **Soft delete**: Skills use `deletedAt` nullable timestamp, not hard delete; queries must filter `deletedAt IS NULL`
- **Token revocation**: Set `revokedAt` in `user_tokens`; CLI checks this field after decrypting
- **Token refresh**: New tokens only store `userId` (no quota fields); quota is always read from Redis/DB at relay time

### CLI & Skill Authoring
- **stdout = file path only**: Never output base64, binary, or JSON to stdout; errors go to stderr with `[clawplay <subcommand>]` prefix
- **CLI does Base64 encoding**: For vision analysis, CLI Base64-encodes images before POST to reduce relay bandwidth; server receives base64, not raw files
- **MIME type detection**: For unknown file extensions, use `file -b --mime-type`; fallback to `image/png`
- **i18n is custom (not next-intl)**: `web/lib/i18n/index.ts` provides `getT<K>(ns)` for server components; `web/lib/i18n/context.tsx` provides `useT<K>(ns)` for client components via `I18nProvider` in `(app)/layout.tsx`

### Testing
- **No real network calls in unit tests**: Mock Upstash Redis, mock Volcengine/Gemini API responses
- **E2E tests**: Run against live dev server (`localhost:3000`); use `e2e/helpers/auth.ts` for `loginAs` + `registerUser` helpers
- **CLI unit tests**: Pure bash, zero external dependencies; `curl` is mocked via function override in isolated subprocesses. Run with `bash cli/tests/run-all.sh` or via `make test`
- **`make test`** runs both web unit tests (`cd web && npm test`) and CLI bash tests in sequence

### Git Workflow & PR Process

**Branch model**: `dev` 是开发分支，`main` 是生产分支。所有功能/修复都从 `dev` 开发，完成后提交 PR 合并到 `main`。

**提交流程（方式 A — 推荐）**：
```
1. 在 dev 分支开发完毕，确保所有测试通过
2. git push origin dev
3. 在 GitHub 创建 PR: dev → main
4. 仓库设置中启用 "Allow squash merging"（所有 commits 折叠成 1 个）
5. 点击 "Squash and merge" 合并到 main
6. 合并后本地同步 dev：
   git checkout dev
   git fetch origin
   git merge origin/main   # 把 main 的新内容合入 dev
   git push origin dev     # dev 和 main 保持同步
```

**为什么用 Squash**：dev 分支累积了大量历史 commits，直接 merge 到 main 会把这些全部带进 PR 记录。Squash 把 dev 上的所有 commits 折叠成 1 个，main 历史干净。

**不要做的事**：
- 不要直接 push 到 main
- 不要在 main 上开发新功能
- merge PR 时不要选 "Create a merge commit"（会产生大量历史噪音）
