# ClawPlay Roadmap

## Phase 1 — 核心基础设施 ✅ 已完成（2026-04-06）

- 统一多模态 CLI（`clawplay`）：图像生成、视觉分析、LLM 文本、TTS 语音合成
- Web 应用（Next.js 14）：用户注册/登录、Dashboard、Skill 注册表、管理员审核面板
- Relay 模式：加密 Token + Redis 配额控制 + Provider API 中继
- AES-256-GCM Token 系统：服务端密钥、CLI 本地解密、DB 哈希存储 + 撤销
- 多 Provider 支持：Ark + Google Gemini（图像/视觉/LLM）
- Skill 开发工具集：`clawplay skill lint / diagram / types`
- 人工审核流程：pending → approve/reject + append-only JSONL 审计日志
- Bash 单元测试：84 个用例覆盖全部 CLI lib，零外部依赖
- 国际化：next-intl 双语 UI（中文/英文）+ middleware 语言切换

---

## Phase 2 — Web 正式上线 + Skill 生态建设（当前）

**目标：正式部署上线，接入真实 API，让第一个开发者跑通 Skill 开发全流程，让第一个用户体验到社交/娱乐 Skill**

### 里程碑 0：正式部署

- **生产环境配置**：域名 + SSL、Ark API Key 生产 KEY、Upstash Redis 生产 KEY、`JWT_SECRET`/`CLAWPLAY_SECRET_KEY` 强密钥
- **生产 DB**：迁移 schema，创建第一个 admin
- **日志监控**：Sentry 错误追踪

### 里程碑 1：第一个开发者全流程

- **注册 → 上线**：提交第一个 Skill → 人工审核 → 出现在 /skills
- **安装与执行**：`claw install my-skill` 下载安装，`clawplay image generate` 调用真实 Ark API
- **配额扣减**：Dashboard 实时展示，审核结果邮件通知
- **Feedback 收集**：联系第一个开发者收集反馈，快速迭代

### 里程碑 2：开发者体验闭环

- **install.sh 全局安装脚本**：curl 一行安装 CLI，供 SKILL.md 中引导用户使
- **Skill 下载 API**：`/api/skills/[slug]/download`（zip 打包 + 版本支持 + E2E 测试）
- **开发者入门文档**：CLI 导入、SKILL.md 编写规范、本地调试方法，发布到 `docs/`
- **非 Relay 模式兼容**：Skill 可分发到 ClawHub，优先使用 X Claw 内置多模态工具
- **自动安全扫描**：✅ 完成 — 提交时跑 bash 注入检测（`rm -rf /`、`eval $VAR`、`curl | sh` 等），拦截恶意 Skill；LLM 预审兜底
- **Skill 版本历史**：✅ 完成 — `/skills/[slug]/versions` 独立页面，LCS diff 对比相邻版本

### 里程碑 3：第一个用户体验

- **注册（微信/SMS/邮箱）** → 登录 → Dashboard
- **真实 API 调用**：`clawplay image generate` → Ark 真实图片 → 写入本地文件
- **配额实时扣减**：快用完时主动提示
- **Feedback 收集**：联系第一个用户收集反馈

### 里程碑 4：认证与账户

- **SMS OTP 认证**：注册/登录页接入短信验证码
- **微信 OAuth**：授权后自动注册/登录
- **忘记密码**：邮件重置链接

### 里程碑 5：评审范围与生态规范

- **定义 ClawPlay 评审范围**：明确哪些 Skill 算社交/娱乐向（通过 = 可接入免费多模态能力），哪些不算（与 ClawHub 职责区分）
- **平台能力更新联动**：Ark/Gemini API 变更时，通知维护者更新 Skill 中导入的多模态能力，防止 breaking change 扩散

### 里程碑 6：出海准备（后期）

- **GitHub OAuth**：海外用户 GitHub 登录，无需中国手机号
- **Stripe 支付**：国际信用卡购买 Pro Plan
- **多区域路由**：CN → Ark；海外 → OpenAI / Gemini / Stability AI

---

## Phase 3 — 社交与用户体验 ✅ 部分完成（2026-04-08）

**目标：让用户分享玩耍心得，形成社区氛围，繁荣 Skill 生态**

- **社媒分享功能**：用户分享玩耍心得、与其他用户交流，支持评论互动
- **分享卡片**：参考 ChatGPT share link，Agent 执行完 Skill 后可自动生成分享卡片（含截图/命令/Skill 名）
- **Skill 评分与评论**：✅ 完成 — 1-5星评分 + 文字评论，`skillRatings` 表，`/api/skills/[slug]/reviews` API，详情页 UI
- **Featured Skill 轮播**：✅ 完成 — `isFeatured` 字段，`FeaturedCarousel` 组件，首页自动切换，admin feature/unfeature 开关
- **数字统计动画**：滚动触发的数字增长动画
- **使用量趋势图**：配额使用历史图表
- **通知中心**：审核状态变更、评论回复等消息推送
- **OpenClaw 自动分享集成**：Agent 执行完 Skill 后可自动生成分享卡片，形成传播飞轮

---

## Phase 4 — 商业化与规模化

**目标：可持续运营，覆盖 Provider API 成本**

- **多模态 Token Plan（free / pro / max）**：free 额度相对宽松用于引流，pro/max 档覆盖运营成本，探索赞助模式为 free tier 提供资金
- **多 Provider 故障转移**：Ark + Gemini 负载均衡，Provider 故障时自动切换
- **LLM 安全审查层**：✅ 完成 — 提交时调用 LLM 对 SKILL.md 内容做安全评估（`/lib/skill-llm-safety.ts`），UNSAFE 直接拒绝，REVIEW 存入 moderationFlags，优雅降级

---

## Phase 5 — 高级 AI 能力 + 双线深化

**目标：探索 AI Agent 的进阶交互与记忆能力**

### 社交/娱乐 Skill 开源社区（横向扩展）

- **Skill 中断恢复机制**：增强 OpenClaw Skill 的用户交互体验，支持流程中断后恢复执行（状态文件增强 Skill 状态转移的可靠性，具体方案待探索）
- **IP 记忆注入**：让 Agent 拥有角色记忆和人格连贯性，X Claw 用户可自定义角色设定

### IP 记忆开源社区（纵向深化）

- **LLM Wiki 方案**：利用 LLM Wiki 思路构建 IP 角色结构化知识库，支持持续学习和记忆更新
- **结构化知识库存储**：`character_knowledge` 表，Agent 执行时注入角色设定，支持 RAG 检索
