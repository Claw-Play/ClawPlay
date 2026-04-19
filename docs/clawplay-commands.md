# ClawPlay 命令速查

本文档面向 Skill 开发者，介绍如何在 SKILL.md 中使用 `clawplay` 命令调用多模态能力。
所有命令均无需配置 Provider API Key，`CLAWPLAY_TOKEN` 环境变量配置一次即可。
如果 Agent 不能直接使用交互式向导，请改用 `clawplay setup --agent` 获取需要转述给用户的步骤。

---

## 前置要求

```bash
# 1. 安装
curl -fsSL https://cli.clawplay.example.com/install.sh | bash

# 2. 配置 Token（从 https://clawplay.example.com/dashboard 获取）
export CLAWPLAY_TOKEN='your-token-here'
```

---

## image generate

文生图或参考图生图。

### 命令格式

```bash
clawplay image generate \
  --prompt "<英文描述>" \
  [--ref <图片路径>] \
  [--size <宽高比>] \
  [--quality <分辨率>] \
  [--web] \
  --output <输出路径>
```

### 参数说明

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `--prompt` | ✅ | 英文图片描述（自然语言，描述场景而非关键词） | `"A cyberpunk shrimp sitting on a neon-lit beach"` |
| `--ref` | ❌ | 参考图片路径（最多 14 张，用于角色一致性或风格迁移） | `--ref ~/.openclaw/persona/avatar.png` |
| `--size` | ❌ | 宽高比，默认 `1:1` | `1:1` / `16:9` / `9:16` / `4:3` / `3:4` |
| `--quality` | ❌ | 分辨率，默认 `2K` | `1K` / `2K` / `4K` |
| `--web` | ❌ | 启用联网搜索（生成实时信息图表时使用） | 天气、新闻等 |
| `--output` | ✅ | 输出文件路径（建议使用 `~/.openclaw/` 下的绝对路径） | `--output ~/.openclaw/avatar.png` |

### 输出

成功时 stdout 输出文件路径：
```
/Users/xxx/.openclaw/avatar.png
```

失败时输出错误信息到 stderr，退出码非 0。

### 使用示例

**文生图**：
```bash
clawplay image generate \
  --prompt "A photorealistic close-up portrait of a cute cyberpunk shrimp wearing neon pink sunglasses" \
  --output ~/.openclaw/persona/avatar.png \
  --quality 2K
```

**参考图生图（角色一致性）**：
```bash
clawplay image generate \
  --prompt "Place this character on a tropical beach at sunset, maintaining the character's appearance" \
  --ref ~/.openclaw/persona/avatar.png \
  --output ~/.openclaw/persona/beach.png \
  --quality 2K
```

**联网生图（实时信息）**：
```bash
clawplay image generate \
  --prompt "A clean infographic showing San Francisco weather forecast for the next 5 days" \
  --web \
  --output ~/.openclaw/weather.png \
  --size 16:9 \
  --quality 2K
```

---

## vision analyze

图像理解：描述、问答、目标检测、语义分割。

### 命令格式

```bash
clawplay vision analyze \
  --image <图片路径或URL> \
  --prompt "<分析任务>" \
  [--provider <ark|gemini>] \
  [--mode <describe|detect|segment>] \
  [--output <输出路径>] \
  [--json]
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--image` / `-i` | ✅ | 本地图片路径或图片 URL（可重复，支持多图） |
| `--prompt` / `-p` | ✅ | 分析任务描述或问题 |
| `--provider` | ❌ | `ark`（默认，中文优化）或 `gemini`（多语言，支持 segment） |
| `--mode` | ❌ | `describe`（默认）/ `detect`（目标检测）/ `segment`（语义分割，仅 gemini） |
| `--output` / `-o` | ❌ | 结果写入文件路径（detect/segment 模式推荐加 `.json` 后缀） |
| `--json` | ❌ | 强制以 JSON 格式输出到 stdout（detect/segment 模式自动开启） |

### 模式说明

| 模式 | Ark | Gemini | stdout 输出 |
|------|-----|--------|-------------|
| `describe` | ✅ | ✅ | 文本描述 |
| `detect` | ✅ | ✅ | JSON 数组 `[{label, box:[x1,y1,x2,y2]}]`，坐标归一化到 0-1000 |
| `segment` | ❌ | ✅ | JSON 数组 `[{label, box, mask}]`，mask 为 base64 PNG |

### 示例

```bash
# 图片描述（中文，默认 Ark 供应商）
clawplay vision analyze \
  --image ~/.openclaw/screenshot.png \
  --prompt "描述这张图片的内容"

# 英文 Q&A（Gemini）
clawplay vision analyze \
  --image https://example.com/product.jpg \
  --prompt "What color is the product?" \
  --provider gemini

# 目标检测，结果写入 JSON 文件
clawplay vision analyze \
  --image ./scene.jpg \
  --prompt "检测所有人物和物品" \
  --mode detect \
  --output /tmp/objects.json

# 多图比较
clawplay vision analyze \
  --image ./before.jpg \
  --image ./after.jpg \
  --prompt "这两张图有什么区别？"

# 语义分割（仅 Gemini）
clawplay vision analyze \
  --image ./photo.jpg \
  --prompt "segment all people" \
  --mode segment \
  --provider gemini \
  --output /tmp/masks.json
```

---

## 常用场景模式

### 模式一：创建角色形象（文生图）

```bash
clawplay image generate \
  --prompt "<角色描述 prompt，保持自然语言连贯>" \
  --output ~/.openclaw/persona/avatar.png \
  --quality 2K
```

### 模式二：角色在不同场景（参考图生图）

```bash
clawplay image generate \
  --prompt "<场景描述 + '保持参考图中的角色特征'>" \
  --ref ~/.openclaw/persona/avatar.png \
  --output ~/.openclaw/persona/<scene>.png \
  --quality 2K
```

### 模式三：多角色合成（多参考图）

```bash
clawplay image generate \
  --prompt "Place character A and character B together in a coffee shop" \
  --ref ~/.openclaw/persona/avatar_a.png \
  --ref ~/.openclaw/persona/avatar_b.png \
  --output ~/.openclaw/persona/duo.png \
  --quality 2K
```

---

## 最佳实践

### prompt 写作

- **描述场景，不要堆关键词**：`"A photorealistic close-up portrait of a cyberpunk shrimp..."` 优于 `"cyberpunk shrimp neon sunglasses pink blue"`
- **英文描述**：图片生成模型对英文理解更准确
- **参考图补充角色特征**：角色形象用 `--ref` 传入，不要把所有细节都写在 prompt 里

### 输出路径

- 始终使用绝对路径：`~/.openclaw/persona/avatar.png` 优于 `avatar.png`
- 用 `mkdir -p` 确保目录存在：
  ```bash
  mkdir -p ~/.openclaw/persona/
  clawplay image generate --prompt "..." --output ~/.openclaw/persona/avatar.png
  ```

### 错误处理

Agent 应检查命令退出码（`set -euo pipefail`），失败时向用户说明原因并重试。

---

## 常用 Bash 辅助命令

Skill 在 Agent 执行环境中运行，以下是编写可靠 Skill 时必须掌握的 Bash 工具集。

### 文件与目录

```bash
# 确保目录存在（Skill 输出前必备）
mkdir -p ~/.openclaw/persona/

# 检查文件是否存在
[ -f ~/.openclaw/persona/avatar.png ] && echo "exists" || echo "missing"

# 列出目录内容（用于 init 分支判断）
ls ~/.openclaw/persona/ 2>/dev/null | wc -l   # 返回文件数量

# 安全删除（删前确认路径是绝对路径）
rm -f ~/.openclaw/workspace/memory/my-skill-state.json
```

### 状态文件读写（JSON）

Skill 的阶段状态以 JSON 文件持久化，Agent 用读写文件替代内存状态：

```bash
# 写入状态文件（Python JSON，不依赖 jq）
python3 -c "
import json, sys
state = {'skill': 'my-skill', 'phase': 'init', 'context': {}}
with open(sys.argv[1], 'w') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)
" ~/.openclaw/workspace/memory/my-skill-state.json

# 读取字段
python3 -c "
import json
with open('~/.openclaw/workspace/memory/my-skill-state.json'.replace('~', __import__('os').path.expanduser('~'))) as f:
    s = json.load(f)
print(s['phase'])
"

# 更新单个字段
python3 -c "
import json, os
path = os.path.expanduser('~/.openclaw/workspace/memory/my-skill-state.json')
with open(path) as f:
    s = json.load(f)
s['phase'] = 'ready_to_go'
with open(path, 'w') as f:
    json.dump(s, f, indent=2, ensure_ascii=False)
"
```

> **为什么用 Python 而不是 jq？** X Claw 执行环境不保证 `jq` 已安装，Python3 是 macOS/Linux 标准工具。

### 字符串处理

```bash
# 生成 slug（场景名 → 文件名）
echo "赛博城市夜景" | python3 -c "
import sys, re, unicodedata
s = sys.stdin.read().strip()
# 中文用拼音描述时直接用；这里示范 ASCII slug
slug = re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
print(slug or 'scene')
"
# 或 Agent 直接推断 slug，无需 bash

# 获取当前 ISO 时间戳
python3 -c "from datetime import datetime, timezone; print(datetime.now(timezone.utc).isoformat())"
```

### 条件分支执行

```bash
# 退出码检查（生图失败时中止）
clawplay image generate --prompt "..." --output /tmp/out.png || {
  echo "生图失败，请检查 CLAWPLAY_TOKEN 配额" >&2
  exit 1
}

# 设置严格模式（推荐在 Skill bash 块顶部）
set -euo pipefail
```

### 网络与环境检查

```bash
# 检查 Token 是否已配置
[ -z "${CLAWPLAY_TOKEN:-}" ] && echo "❌ 请先设置 CLAWPLAY_TOKEN" && exit 1

# 检查 clawplay CLI 是否安装
command -v clawplay >/dev/null 2>&1 || {
  echo "❌ clawplay 未安装，请运行："
  echo "   curl -fsSL https://cli.clawplay.example.com/install.sh | bash"
  exit 1
}

# 检查配额（返回 JSON，Agent 解析）
clawplay quota check
```

---

## 下一步

- 查看 Skill 示例：`example-skills/take-your-claw/SKILL.md`
- Skill 流程设计与 Prompt 模板规范：`docs/skill-authoring-guide.md`
