import type { Config } from "drizzle-kit";
import path from "path";

const DB_PATH =
  process.env.DATABASE_URL ??
  // 本地默认路径（相对于 web/ 目录）
  path.join(__dirname, "..", "data", "clawplay.db");

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
} satisfies Config;
