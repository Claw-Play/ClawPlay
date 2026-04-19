# ClawPlay — Developer Context

**内容维护规则**：只保留 Claude 无法自行推断的信息。

✅ 包含：架构决策、常见陷阱、非显而易见的约束、测试命令、Git 约定
❌ 排除：详细代码示例（可读源码推断）、API 端点列表（代码自述）、标准语言约定、长解释或教程

## 关键决策（不可从代码推断）

### Multi-Provider 路由
- 国内用 Ark，海外用 Gemini，未来加入更多Provider；429 时**不扣 quota**（fail-open，避免双重惩罚）
- Ark image 返回 URL → CLI 下载；Gemini 返回 base64
- Vision: Ark 支持 `file://` 直传（512MB）；Gemini 需要 base64

### Token 安全模型
- Token 明文永不离开 CLI：服务端存 AES-256-GCM 加密 blob + hash，CLI 本地解密
- 认证只用 httpOnly cookie（不用 localStorage）

### Key Pool
- `ARK_API_KEY` 同时用于 image 和 vision 池，各自独立 per-key quota
- 多 key 模式下 `ARK_IMAGE_KEYS` / `ARK_VISION_KEYS` 优先于 `ARK_API_KEY`

### 数据库
- 软删除：Skills 用 `deletedAt` 而非硬删除，查询必须过滤 `deletedAt IS NULL`
- Redis 可选：无 Upstash 时回退到 DB（慢，无原子增量），会打警告

### CLI 输出约束
- **stdout 只能输出文件路径**，禁止 base64、二进制、JSON
- 错误输出到 stderr，格式：`[clawplay <subcommand>] <message>`
- Vision 能力：CLI 负责 Base64 编码后再 POST

## 常见陷阱

### 安全
- **Auth 失败默认不记审计日志**：登录失败应调用 `audit.ts` 记录
- **日志禁止包含 secrets**：token、password、API key 一律不能打出来

### Provider & Relay
- CLI 直连 `ARK_API_KEY` 会绕过 quota——这是 Pro 模式，不是 bug
- 429 时 relay 不扣 quota，但仍返回错误给用户

### Middleware (`web/middleware.ts`)
- 读取 `clawplay_token` cookie → 设 `X-User-Id` header 透传给 Server Components
- `/admin/*` 无 cookie → 重定向 `/login`
- `/login`、`/register` 已登录 → 重定向 `/dashboard`

## 测试

```bash
make test   # web unit tests + CLI bash tests 顺序执行
```

- Web: `cd web && npm test`
- CLI: `bash cli/tests/run-all.sh`（纯 bash，curl 通过函数覆盖 mock）
- E2E: 跑在 `localhost:3000`；用 `e2e/helpers/auth.ts` 里的 `loginAs` + `registerUser`

## Git 工作流

### 分支结构

```
Claw-Play/ClawPlay     ← 主仓（只有 main）
  └── main

your-fork/ClawPlay    ← 你的 fork
  ├── main             ← 与 upstream 同步
  └── dev              ← 开发分支
```

### 开发流程

1. `git checkout dev && git pull` — 开始前同步
2. 开发、commit
3. `git push origin dev` — 推到你的 fork
4. GitHub 上 PR：`dev` → `upstream main`

### 常用命令

```bash
# 同步 upstream 到你的 main
git fetch upstream && git rebase upstream/main

# 同步 upstream 到你的 dev
git fetch upstream && git rebase upstream/main  # 先同步 main
git checkout dev && git merge main              # 再合到 dev
```

### 规范

- 不要直接 push 到 upstream
- 不要在 main 上开发
- 不要选 "Create a merge commit"
- 不要用 `git reset --hard`、`git push --force`、`git clean -f`
