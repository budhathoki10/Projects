import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const FIXTURES = 4200;
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://shortlist:shortlist@localhost:5432/shortlist_test";
// Emails are written here instead of being sent, so tests can follow the links.
export const EMAIL_OUTBOX = path.join(os.tmpdir(), "shortlist-e2e-outbox.jsonl");
export const FIXTURE_BASE = `http://127.0.0.1:${FIXTURES}`;
export const PADDLE_SECRET = "e2e-paddle-secret";

// The app runs against its own database, with local stand-ins for job sites and Khalti, and no AI key.
const appEnv = {
  DATABASE_URL: TEST_DATABASE_URL,
  APP_URL: `http://localhost:${PORT}`,
  FETCH_ALLOW_PRIVATE_HOSTS: "1",
  ANTHROPIC_API_KEY: "",
  CRON_JOB_SECRET: "e2e-cron-job-secret",
  PADDLE_WEBHOOK_SECRET: PADDLE_SECRET,
  NEXT_PUBLIC_PADDLE_PRICE_30: "pri_30",
  NEXT_PUBLIC_PADDLE_PRICE_90: "pri_90",
  KHALTI_SECRET_KEY: "e2e-khalti-key",
  KHALTI_API_BASE: `${FIXTURE_BASE}/khalti`,
  RESEND_API_KEY: "",
  EMAIL_DEV_OUTBOX: EMAIL_OUTBOX,
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fixture-sites/server.mjs",
      url: `${FIXTURE_BASE}/jobs/northwind.html`,
      env: { FIXTURE_PORT: String(FIXTURES) },
      reuseExistingServer: true,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: appEnv,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
