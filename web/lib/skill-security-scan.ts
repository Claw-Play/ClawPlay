/**
 * skill-security-scan.ts
 * 静态扫描 SKILL.md 内容，检测危险 bash 模式。
 *
 * severity "error"   → 阻断提交（明显恶意），API 返回 400
 * severity "warning" → 存入 moderationFlags，提醒人工审核
 */

export interface ScanFlag {
  severity: "error" | "warning";
  code: string;
  description: string;
}

export interface ScanResult {
  /** false = 存在 error 级别 flag，提交应被拒绝 */
  safe: boolean;
  flags: ScanFlag[];
}

// ── 阻断级别：明显恶意，直接拒绝 ─────────────────────────────────────────────

const BLOCK_PATTERNS: Array<{ code: string; regex: RegExp; description: string }> = [
  {
    code: "DANGEROUS_RM",
    regex: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+[/~]/i,
    description: "Recursive deletion of root or home path (rm -rf /)",
  },
  {
    code: "REMOTE_EXEC_CURL",
    regex: /curl\b[^|]*\|\s*(ba)?sh\b/,
    description: "Remote code execution via curl | sh",
  },
  {
    code: "REMOTE_EXEC_WGET",
    regex: /wget\b[^|]*\|\s*(ba)?sh\b/,
    description: "Remote code execution via wget | sh",
  },
  {
    code: "OBFUSCATED_EXEC",
    regex: /base64\b[^|]*-d[^|]*\|\s*(ba)?sh\b/,
    description: "Obfuscated code execution via base64 -d | sh",
  },
  {
    code: "FORK_BOMB",
    regex: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:&\s*\}/,
    description: "Fork bomb pattern detected",
  },
  {
    code: "RAW_DISK_WRITE",
    regex: />\s*\/dev\/(sda|hda|nvme\d)/,
    description: "Writing to raw disk device",
  },
  {
    code: "PASSWD_OVERWRITE",
    regex: />\s*\/etc\/passwd/,
    description: "Overwriting /etc/passwd",
  },
  {
    code: "SHADOW_OVERWRITE",
    regex: />\s*\/etc\/shadow/,
    description: "Overwriting /etc/shadow",
  },
];

// ── 警告级别：可疑，存入 flags 供人工审核 ────────────────────────────────────

const WARN_PATTERNS: Array<{ code: string; regex: RegExp; description: string }> = [
  {
    code: "DYNAMIC_EVAL",
    regex: /\beval\s+[\$"'`]/,
    description: "Dynamic eval with variable or string",
  },
  {
    code: "DANGEROUS_CHMOD",
    regex: /\bchmod\s+(777|4[0-7]{3}|2[0-7]{3}|6[0-7]{3})\b/,
    description: "Overly permissive chmod (777) or setuid/setgid bit",
  },
  {
    code: "SUDO",
    regex: /\bsudo\s+/,
    description: "Privilege escalation via sudo",
  },
  {
    code: "RECURSIVE_RM",
    regex: /\brm\s+-[a-z]*r\b/i,
    description: "Recursive file deletion (rm -r)",
  },
  {
    code: "PROCESS_KILL",
    regex: /\b(pkill|killall)\b/,
    description: "Process killing command",
  },
  {
    code: "DD_DISK",
    regex: /\bdd\b.*\bif=\/dev\//,
    description: "Raw disk copy with dd",
  },
  {
    code: "CURL_SUBSHELL",
    regex: /\$\(\s*curl\b/,
    description: "Command substitution with curl",
  },
];

/**
 * 从 SKILL.md 内容中提取所有 bash/sh/shell fenced code block 的文本。
 * 全文也一并扫描（覆盖 frontmatter 中的内联命令）。
 */
function extractBashContent(content: string): string {
  const parts: string[] = [content];
  const fenceRe = /```(?:bash|sh|shell)\r?\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(content)) !== null) {
    parts.push(m[1]);
  }
  return parts.join("\n");
}

/**
 * 扫描 SKILL.md 内容，返回 ScanResult。
 */
export function scanSkillContent(content: string): ScanResult {
  const text = extractBashContent(content);
  const flags: ScanFlag[] = [];

  for (const { code, regex, description } of BLOCK_PATTERNS) {
    if (regex.test(text)) {
      flags.push({ severity: "error", code, description });
    }
  }

  for (const { code, regex, description } of WARN_PATTERNS) {
    if (regex.test(text)) {
      flags.push({ severity: "warning", code, description });
    }
  }

  return {
    safe: !flags.some((f) => f.severity === "error"),
    flags,
  };
}
