import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/*.e2e.test.ts",
      // Component tests (.tsx) require jsdom environment — run via vitest.component.config.ts only
      "lib/__tests__/components/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 55,
        statements: 70,
      },
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        // OAuth init routes are excluded because they call lib/oauth helpers (oauth.ts at 0% anyway)
        // OAuth callback routes require real OAuth flow — excluded
        "app/api/auth/discord/**",
        "app/api/auth/github/**",
        "app/api/auth/google/**",
        "app/api/auth/x/**",
        "app/api/auth/wechat/callback/**",
        // Cron 任务通过外部 cron 调用，非用户逻辑
        "app/api/cron/**",
        // 未使用的占位路由
        "app/api/auth/wechat/route.ts",
        // Provider adapters (Ark/Gemini) require real API keys — tested via E2E
        "lib/providers/**",
        // Ability relay routes call external provider APIs directly — excluded except /check
        // /check only uses token decryption + Redis/DB, no external calls, so it stays in
        "app/api/ability/image/**",
        "app/api/ability/tts/**",
        "app/api/ability/llm/**",
        "app/api/ability/vision/**",
        // Test infrastructure — not production code
        "lib/__tests__/**",
        // Drizzle schema: FK reference callbacks (() => table.id) are ORM introspection
        // hooks never called during CRUD — not user logic, not meaningful to measure
        "lib/db/schema.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
