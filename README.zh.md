**中文** | [English](./README.md)

# ClawPlay

**X Claw 社交娱乐 Skill 的开源社区枢纽。**

ClawPlay 让 AI Agent（通过 X Claw）无需管理 API 密钥即可生成图像、视觉分析、语音合成。开发者将 Skill 提交到经过人工审核的社区注册表；用户获得统一 CLI 和免费配额。

---

## 快速上手

### 1. 获取 CLI Token

```bash
# 在 https://clawplay.example.com 注册，然后从 Dashboard 复制：
export CLAWPLAY_TOKEN=eyJh...
```

### 2. 安装 CLI

```bash
npm install -g clawplay
# 或
curl -sSL https://raw.githubusercontent.com/nura-space/clawplay/main/install.sh | bash
```

### 3. 验证

```bash
clawplay whoami
# ClawPlay User ID: 42
# Quota Remaining:  1000
# Expires:         2026-05-05
```

---

## CLI 使用

```bash
# 图像生成
clawplay image generate --prompt "a cyberpunk shrimp on a neon beach"
clawplay image generate --prompt "change style" --ref ./photo.png --size 9:16 --quality 2K
clawplay image generate --prompt "latest news infographic" --web

# 视觉分析
clawplay vision analyze --image ./photo.png
clawplay vision analyze --image ./photo.png --question "这张图里有几个人？"

# 文本生成
clawplay llm generate --prompt "用一句话介绍 ClawPlay"
clawplay llm generate --prompt "续写故事" --context ./story.txt

# 语音合成
clawplay tts synthesize --text "Hello from ClawPlay"
clawplay tts synthesize -t "你好世界" --voice BV001 -o greeting.mp3

# Skill 开发工具
clawplay skill lint ./SKILL.md          # 校验 frontmatter + bash 指令
clawplay skill diagram ./SKILL.md       # 生成 Mermaid 流程图
clawplay skill types ./SKILL.md         # TypeScript 类型检查

# 其他
clawplay whoami
clawplay setup
```

---

## 架构

### Relay 模式

```
用户 → Agent → clawplay CLI → ClawPlay Server（Relay）
                                      ↓
                               1. 解密 Token → userId
                               2. 检查配额（Redis）
                               3. 调用 Provider API（Ark / Gemini）
                               4. 返回结果
                                      ↓
CLI 写入文件 → stdout: /tmp/avatar.png
```

**约束**：CLI stdout 只输出文件路径，绝不输出 base64 或二进制数据，防止 AI Agent 上下文爆炸。

**多 Provider 支持**：图像生成、视觉分析、LLM 文本生成均同时支持 Ark 和 Google Gemini，可按需切换。

### Token 安全

Token 由服务器使用 AES-256-GCM 加密。明文（userId、配额信息、过期时间）可在本地 CLI 解密，但用户无法伪造。Token 的哈希值存储在 DB 中用于撤销控制。

### Relay API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/ability/image/generate` | 图像生成（Relay） |
| `POST` | `/api/ability/vision/analyze` | 视觉分析（Relay） |
| `POST` | `/api/ability/llm/generate` | 文本生成（Relay） |
| `POST` | `/api/ability/tts/synthesize` | 语音合成（Relay） |
| `GET` | `/api/ability/check` | 配额查询 |

---

## 开发

### 前置条件

- Node.js 18+
- pnpm 8+
- SQLite（通过 `better-sqlite3`，自动初始化）
- Upstash Redis（免费版：https://console.upstash.com）
- Ark API Key（图像生成）

### 环境搭建

```bash
cd web
cp .env.example .env.local
# 填写：JWT_SECRET, CLAWPLAY_SECRET_KEY, UPSTASH_REDIS_REST_URL/TOKEN,
#        ARK_API_KEY
pnpm install
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 环境变量

**Web (`web/.env.local`)**

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥，32 字节（`openssl rand -base64 32`） |
| `CLAWPLAY_SECRET_KEY` | AES-256-GCM 加密密钥，32 字节（`openssl rand -hex 32`） |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |
| `ARK_API_KEY` | Ark API Key（服务端，图像/视觉/LLM） |
| `GEMINI_API_KEY` | Google Gemini API Key（可选，多 Provider 备用） |
| `DATABASE_URL` | SQLite 路径（默认：`../data/clawplay.db`） |

**CLI**

| 变量 | 说明 |
|------|------|
| `CLAWPLAY_TOKEN` | 从 Dashboard 导出的加密 Token |
| `CLAWPLAY_API_URL` | ClawPlay 服务器地址（默认：生产环境） |
| `ARK_API_KEY` | 直连 Provider 模式（可选，绕过配额） |

### 项目结构

```
ClawPlay/
├── web/                          # Next.js 14 应用
│   ├── app/
│   │   ├── (auth)/               # 登录/注册页
│   │   ├── (app)/                # 认证后页面（Dashboard、Skills、Submit）
│   │   ├── (admin)/              # 管理员审核面板
│   │   ├── api/                  # API 路由（22 个）
│   │   └── page.tsx              # 首页
│   ├── components/               # 共享 React 组件
│   └── lib/
│       ├── db/                   # Drizzle ORM + SQLite Schema
│       ├── auth.ts               # JWT helpers
│       ├── token.ts              # AES-256-GCM Token 加解密
│       ├── redis.ts              # Upstash Redis 配额 helpers
│       └── providers/            # 多 Provider 集成（Ark、Gemini）
│           ├── image/            # 图像生成
│           ├── vision/           # 视觉分析
│           └── llm/              # 文本生成
├── cli/                          # Shell CLI
│   ├── clawplay                  # 主入口（子命令路由）
│   ├── lib/
│   │   ├── token.sh              # Token 读取 + 本地解密
│   │   ├── image.sh              # 图像生成 Relay 客户端
│   │   ├── vision.sh             # 视觉分析 Relay 客户端
│   │   ├── llm.sh                # LLM 生成 Relay 客户端
│   │   └── api.sh                # HTTP 调用 helpers
│   └── skill/                    # Skill 开发工具集
│       ├── lint.mjs              # SKILL.md 语法校验
│       ├── diagram.mjs           # 生成 Mermaid 流程图
│       └── types.mjs             # TypeScript 类型检查
├── docs/                         # 文档
│   ├── clawplay-commands.md      # CLI 命令速查 + Bash 工具集
│   ├── skill-authoring-guide.md  # Skill 进阶开发指南
│   └── providers/                # Provider API 参考文档
└── data/                         # SQLite DB（已 gitignore）
```

### 数据库

Schema 定义在 `web/lib/db/schema.ts`，首次运行自动迁移。

```bash
# 手动运行迁移
cd web && pnpm drizzle-kit generate
```

### 测试

```bash
cd web

# 单元测试（Vitest）
pnpm test

# E2E 测试（Playwright）
pnpm playwright install
pnpm playwright test

# 全部运行
pnpm test:all
```

---

## 路线图

| 阶段 | 目标 | 状态 |
|------|------|------|
| Phase 1 | 核心基础设施（CLI、Web、Relay、Token 系统） | ✅ 已完成 |
| Phase 2 | 社区与生态（ClawHub 整合、安全扫描、install.sh） | 🔲 计划中 |
| Phase 3 | 商业化与规模化（Token Plan、多 Provider 故障转移） | 🔲 计划中 |
| Phase 4 | 社交与用户体验（分享、评分、通知中心） | 🔲 计划中 |
| Phase 5 | 高级 AI 能力（Skill 中断恢复、IP 记忆注入） | 🔲 计划中 |
| Phase 6 | 国际化版本（GitHub OAuth、Stripe、多区域部署） | 🔲 计划中 |

完整路线图见 [ROADMAP.md](./ROADMAP.md)。

---

## 文档

- [CLI 命令速查](docs/clawplay-commands.md) — 所有命令参数、示例、错误处理
- [Skill 进阶开发指南](docs/skill-authoring-guide.md) — 流程图设计、Prompt 模板、可靠性设计
- [Provider API 参考](docs/providers/) — Ark、Google Gemini 参数文档

---

## 贡献

1. Fork 本仓库
2. 创建 feature 分支
3. 通过 Web UI 提交 Skill 参与社区评审
4. 或提 Issue / Discussion

所有 Skill 在发布前均经过人工审核，保护 X Claw 用户安全。

---

## License

MIT
