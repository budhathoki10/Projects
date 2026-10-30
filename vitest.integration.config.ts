import path from "node:path";
import { defineConfig } from "vitest/config";

export const INTEGRATION_DB = process.env.INTEGRATION_DATABASE_URL ?? "postgres://shortlist:shortlist@localhost:5432/shortlist_integration";
export const FIXTURE_PORT = 4101;

// Runs the real database-backed services against Postgres and a local fixture server.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The real package throws outside React Server Components.
      "server-only": path.resolve(__dirname, "tests/integration/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: INTEGRATION_DB,
      FIXTURE_BASE: `http://127.0.0.1:${FIXTURE_PORT}`,
      FETCH_ALLOW_PRIVATE_HOSTS: "1",
      ANTHROPIC_API_KEY: "",
      KHALTI_API_BASE: `http://127.0.0.1:${FIXTURE_PORT}/khalti`,
      KHALTI_SECRET_KEY: "e2e-khalti-key",
      NEXT_PUBLIC_PADDLE_PRICE_30: "pri_30",
      NEXT_PUBLIC_PADDLE_PRICE_90: "pri_90",
      APP_URL: "http://localhost:3000",
    },
  },
});
