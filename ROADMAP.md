# ClawPlay Roadmap

## Phase 1 — 核心基础设施 ✅ 已完成（2026-04-06）

- ✅ 统一多模态 CLI（`clawplay`）：图像生成、视觉分析、LLM 文本、TTS 语音合成
- ✅ Web 应用（Next.js 14）：用户注册/登录、Dashboard、Skill 注册表、管理员审核面板
- ✅ Relay 模式：加密 Token + Redis 配额控制 + Provider API 中继
- ✅ AES-256-GCM Token 系统：服务端密钥、CLI 本地解密、DB 哈希存储 + 撤销
- ✅ 多 Provider 支持：Ark + Google Gemini（图像/视觉/LLM）
- ✅ Skill 开发工具集：`clawplay skill lint / diagram / types`
- ✅ 多语言切换：自定义 i18n 系统（`getT` 服务端 + `useT` 客户端），中文/English
- ✅ OAuth 登录：GitHub、Google、Discord、X（Twitter）、微信
- ✅ 首页全局统计：平台总览（用户数、Skill 数、事件数）
- ✅ 管理员提权 UI：Admin Panel 用户管理，支持修改用户角色
- ✅ 动态密钥更新 Cron：定时重置 Key Pool 配额
- ✅ 人工审核流程：pending → approve/reject + append-only JSONL 审计日志
- ✅ Bash 单元测试：84 个用例覆盖全部 CLI lib，零外部依赖

---

## Phase 2 — 国内上线 + 初始用户积累（当前）

**目标：在国内正式上线，积累第一批开发者和用户，建立 Skill 生态基础**

### 国内正式部署

- **生产环境**：clawplay.com.cn 域名、SSL、Ark 生产 Key、Upstash Redis 生产 Key
- **Key Pool 生产配置**：`ARK_IMAGE_KEYS`/`ARK_VISION_KEYS` 多 Key + RPM 限制
- **日志监控**：Sentry 错误追踪
- **CI/CD**：GitHub Actions 自动化部署到 HK/CN 两套环境

### 登录体验（国内友好）

- ✅ **SMS OTP**：手机号 + 验证码注册/登录（已完成）
- ✅ **微信 OAuth**：一键微信授权登录（已完成）
- **忘记密码**：邮箱重置链接
- **Token 管理**：Dashboard 一键导出 CLAWPLAY_TOKEN，CLI 无缝接入

### 开发者闭环

- ✅ **自动安全扫描**：bash 注入检测 + LLM 安全预审，拦截恶意 Skill
- ✅ **Skill 版本历史**：独立页面，LCS diff 对比相邻版本
- ✅ **Providers 管理页面**：Admin 面板管理 API Key 和 Model，支持多 Key 分片
- ✅ **Submit Wizard**：4 步提交向导（基本信息 → 能力选择 → Skill MD → 流程图），提交门控卡片，Skill MD 编辑器（YAML + TAB 分区），流程图自动生成，验证 API
- ✅ **Admin 审核体验优化**：侧边栏实时 pending count（无需刷新），reject 强制填写原因（列表页 + 详情页）
- **install.sh**：一行命令安装 CLI，写入 SKILL.md 引导用户
- **Skill 下载 API**：`/api/skills/[slug]/download`（zip 打包 + 版本 + E2E 测试）
- **开发者入门文档**：CLI 导入、SKILL.md 规范、本地调试方法，发布到 `docs/`
- **第一个 Skill 提交**：内部测试全流程：提交 → 审核 → 上线 → 安装 → 调用

### 新手引导

- **评审范围定义**：明确 ClawPlay 只收录社交/娱乐向 Skill，与 ClawHub 差异化定位
- **新手入门标准**：多模态 CLI 导入、自然语言转 Mermaid 流程图、Prompt 模板
- **Skill 流程图 UI**：Web 端 Mermaid 渲染，降低复杂流程开发门槛

### 初始用户积累

- **种子用户引入**：从 X Claw 社区、微信群定向邀请第一批开发者
- **Skill 冷启动**：邀请 5-10 个社交/娱乐向 Skill 提交，覆盖图像生成、语音合成等常见场景
- **Feedback 快速迭代**：收集第一批用户反馈，快速修复体验问题
- **首页优化**：展示精选 Skill + 全局统计数据，给新访客信任感

---

## Phase 3 — 社交与用户体验 ✅ 部分完成

**目标：让用户分享玩耍心得，形成社区氛围，繁荣 Skill 生态**

### 已完成

- ✅ **Skill 评分与评论**：1-5星评分 + 文字评论，`skillRatings` 表，`/api/skills/[slug]/reviews` API，详情页 UI，`lib/ratings.ts` 聚合计算
- ✅ **Featured Skill 轮播**：`isFeatured` 字段，`FeaturedCarousel` 组件，首页自动切换，admin feature/unfeature 开关
- ✅ **Analytics 事件追踪系统**：`eventLogs` + `userStats` 表；fire-and-forget DB 写入；追踪 inputTokens/outputTokens/provider
- ✅ **Admin Analytics APIs**：平台总览、事件流、用户统计
- ✅ **审核邮件通知**：`lib/review-notifications.ts`，SMTP 发送 approve/reject 邮件通知，`nodemailer.d.ts` 类型声明

### 进行中

- 🔲 **分享卡片**：参考 ChatGPT share link，Agent 执行完 Skill 后可自动生成分享卡片（含截图/命令/Skill 名）
- 🔲 **数字统计动画**：滚动触发的数字增长动画
- 🔲 **使用量趋势图**：配额使用历史图表（已有 LineChart 组件）

### 待规划

- 🔲 **通知中心**：站内消息推送（审核状态变更、评论回复等），邮件通知已完成
- 🔲 **Skill 依赖系统**：形象类基础 Skill，其他 Skill 依赖它，依赖安装要解决
- 🔲 **社交功能**：用户分享玩耍心得，OpenClaw 自动分享对话卡片

---

## Phase 4 — 商业化与规模化

**目标：可持续运营，覆盖 Provider API 成本**

- ✅ **LLM 安全审查层**：提交时调用 LLM 对 SKILL.md 内容做安全评估，UNSAFE 直接拒绝，REVIEW 存入 moderationFlags，优雅降级
- 🔲 **多模态 Token Plan（free / pro / max）**：free 额度引流，pro/max 覆盖成本，探索赞助模式
- 🔲 **多 Provider 故障转移**：Ark + Gemini 负载均衡，Provider 故障时自动切换

---

## Phase 5 — 高级 AI 能力 + 双线深化

**目标：探索 AI Agent 的进阶交互与记忆能力**

### 社交/娱乐 Skill 开源社区（横向扩展）

- 🔲 **Skill 中断恢复机制**：支持流程中断后恢复执行，增强用户交互体验
- 🔲 **CLI 能力更新联动**：CLI 能力更新后，协同更新 Skill 里导入的能力（版本兼容）

### IP 记忆开源社区（纵向深化）

- 🔲 **LLM Wiki 知识库**：构建 IP 角色结构化知识库，支持持续学习和记忆更新
- 🔲 **IP 记忆注入**：让 Agent 拥有角色记忆和人格连贯性，`character_knowledge` 表，Agent 执行时注入角色设定，支持 RAG 检索

### 交互能力探索

- 🔲 **交互卡片**：可交互的卡片组件
- 🔲 **可交互 3D 世界**：前沿前端技术探索
- 🔲 **微信小程序**：移动端轻量化入口

---

## Phase 6 — 出海与移动端（远期）

- 🔲 **GitHub OAuth**：海外用户 GitHub 登录，无需中国手机号
- 🔲 **Stripe 支付**：国际信用卡购买 Pro Plan
- 🔲 **多区域路由**：CN → Ark；海外 → OpenAI / Gemini / Stability AI
- 🔲 **原生移动端 APP**：社区功能、Skill 浏览与管理、推送通知
