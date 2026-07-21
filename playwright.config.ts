import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No dotenv dependency in this project — load .env manually (same approach
// used by every verification script this session) so e2e tests can reach
// Supabase directly (auth-helper.ts) without adding a new dependency.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line
      .slice(i + 1)
      .trim()
      .replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

// Points at the already-running dev server (npm run dev, port 8080) rather
// than spawning its own — this is a real Supabase-backed app, not something
// Playwright should be starting/stopping itself against a throwaway build.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One shared local dev server (npm run dev), not a scalable deployment —
  // parallel workers just contend for the same process and slow every
  // request down, not a feature bug. Run serially.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
