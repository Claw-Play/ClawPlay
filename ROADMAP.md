# ClawPlay Roadmap

## Phase 1 — 核心基础设施 ✅ 已完成（2026-04）

- 统一多模态 CLI（`clawplay`）：图像生成、视觉分析、LLM 文本、TTS 语音合成
- Web 应用（Next.js 14）：用户注册/登录、Dashboard、Skill 注册表、管理员审核面板
- Relay 模式：加密 Token + Redis 配额控制 + Provider API 中继
- AES-256-GCM Token 系统：服务端密钥、CLI 本地解密、DB 哈希存储 + 撤销
- 多 Provider 支持：Ark + Google Gemini（图像/视觉/LLM）
- Skill 开发工具集：`clawplay skill lint / diagram / types`
- 人工审核流程：pending → approve/reject + append-only JSONL 审计日志

---

## Phase 2 — 社区与生态（近期目标）

**目标：让 ClawPlay 成为 X Claw 生态的正式入口**

- **非 Relay 模式兼容**：允许 Skill 分发到 ClawHub 且不强制走 Relay（需要研究 X Claw 工具列表 API 的获取方式）
- **ClawHub 整合**：定义 ClawPlay 评审范围（社交/娱乐向 Skill），与 ClawHub 职责明确区分；通过的 Skill 意味着可接入免费多模态能力
- **新手入门标准**：开发者文档 → 编辑器工作流，涵盖多模态 CLI 导入、Bash 命令导入、自然语言转 Mermaid 流程图、Prompt 模板导入
- **能力版本联动**：平台 CLI API/Schema 变更时，协同更新 Skill 中导入的多模态能力（防止 breaking change 扩散）
- **自动安全扫描**：人工审核前跑静态分析（bash 注入、危险命令检测）
- **`install.sh`**：一行命令全局安装 CLI，供 SKILL.md 中引导用户使用

---

## Phase 3 — 商业化与规模化

**目标：可持续运营，覆盖 Provider API 成本**

- **Token Plan**（free / pro / max）：free 配额主要用于引流（额度可相对宽松），pro/max 档覆盖运营成本；探索赞助模式为 free tier 提供资金
- **多 Provider 故障转移**：Ark + Gemini 负载均衡，Provider 故障时自动切换，提升可用性
- **LLM 安全审查层**：人工审核前增加 LLM 自动预筛选，过滤明显恶意/违规内容，减轻人工审核负担

---

## Phase 4 — 社交与用户体验

**目标：让用户分享玩耍心得，形成社区氛围**

- **社媒功能**：用户分享玩耍心得、社区动态帖子、对话卡片分享（参考 ChatGPT share link）
- **OpenClaw 自动分享集成**：Agent 执行完 Skill 后可自动生成分享卡片
- **Skill 评分与评论**：用户对 Skill 评分、留言，帮助其他用户筛选优质内容
- **通知中心**：审核状态变更、评论回复等消息推送
- **仪表盘增强**：配额使用量趋势图、已提交 Skill 状态汇总

---

## Phase 5 — 高级 AI 能力

**目标：探索 AI Agent 的进阶交互与记忆能力**

- **Skill 中断恢复机制**：增强 OpenClaw Skill 的用户交互体验，支持流程中断后恢复执行（而非重头开始）
- **IP 记忆注入**：双线发展
  - ① 社交/娱乐 Skill 开源社区（横向扩展）
  - ② IP 记忆注入开源社区（纵向深化，让 Agent 拥有角色记忆和人格连贯性）
- **LLM Wiki 方案**：参考 Karpathy 的 LLM Wiki 思路，为 IP 角色构建结构化知识库，支持持续学习和记忆更新

---

## Phase 6 — 国际化版本

**目标：打造面向全球用户的 ClawPlay，去除中国区强依赖**

### 认证与账户
- **GitHub OAuth + 邮箱注册**：替代微信/SMS OTP，无需国内手机号
- **Email 通知**：替代微信消息推送

### Provider 路由
- **按区域自动路由**：中国区 → Ark；海外区 → OpenAI / Anthropic / Gemini / Stability AI
- **统一 Provider 抽象层**：CLI 命令不变，底层 Provider 按 `CLAWPLAY_REGION` 环境变量切换

### 支付与配额
- **Stripe 支付集成**：支持国际信用卡，替代国内支付方式
- **Token Plan 国际档**：与国内档独立计费，价格参考海外 API 成本

### 基础设施
- **多区域部署**：CN 节点（国内 CDN + Ark）+ Global 节点（Vercel/Fly.io + OpenAI/Gemini）
- **数据隔离**：中国区与海外区数据库独立，满足数据合规要求

### 社区
- **英文 Skill 社区**：独立的海外 Skill 注册表，允许使用海外 Provider 能力的 Skill 上架
- **双语文档**：所有开发者文档支持中英文（`docs/en/` + `docs/zh/`）
