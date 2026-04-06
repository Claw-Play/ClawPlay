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
      // Component tests run in separate jsdom config
      "components/__tests__/**",
      "app/__tests__/**",
      "app/**/__tests__/**",
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
