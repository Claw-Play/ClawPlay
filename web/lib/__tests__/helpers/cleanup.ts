import { execSync } from "child_process";
import path from "path";

/**

Cleanup E2E test data from the shared dev database.
 * Deletes all skills and users with @example.com emails created by previous test runs.
 * Must be called AFTER the dev server has started (so the DB is accessible).
 */
export function cleanupE2EData() {
  const scriptPath = path.join(__dirname, "..", "scripts", "cleanup-test-data.js");
  try {
    execSync(`node "${scriptPath}"`, { cwd: path.join(__dirname, ".."), stdio: "ignore" });
  } catch {
    // Non-fatal: tests can still run even if cleanup fails
  }
}
