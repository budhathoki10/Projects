import { spawn, type ChildProcess } from "node:child_process";
import { FIXTURE_PORT } from "../../vitest.integration.config";
import { startMongo } from "../support/mongo";

let fixtures: ChildProcess | undefined;
let stopMongo: (() => Promise<void>) | undefined;

async function waitFor(url: string) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Fixture server did not start at ${url}`);
}

export async function setup() {
  const mongo = await startMongo();
  stopMongo = mongo.stop;
  // Test workers start after this and inherit it.
  process.env.MONGODB_URI = mongo.uri;
  process.env.MONGODB_DB = "shortlist_integration";

  fixtures = spawn("node", ["e2e/fixture-sites/server.mjs"], { env: { ...process.env, FIXTURE_PORT: String(FIXTURE_PORT) }, stdio: "ignore" });
  await waitFor(`http://127.0.0.1:${FIXTURE_PORT}/jobs/northwind.html`);
}

export async function teardown() {
  fixtures?.kill();
  await stopMongo?.();
}
