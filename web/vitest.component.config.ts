import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts", "./vitest.component.setup.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Only component / UI tests in this config
    include: [
      "components/__tests__/**/*.test.tsx",
      "app/__tests__/**/*.test.tsx",
      "app/**/__tests__/**/*.test.tsx",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/*.e2e.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
