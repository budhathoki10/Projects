import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Freemius's API key and secret key can move money and read customer data. These checks read the actual source and
 * fail if any of them could ever be bundled for the browser, instead of trusting that nobody will slip.
 */
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx|mts)$/.test(name) ? [full] : [];
  });

const source = files("src").map((file) => ({ file: file.replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));
const isClient = (text: string) => /^\s*(\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(text);

describe("Freemius credentials stay on the server", () => {
  it("no Freemius value is ever exposed through a NEXT_PUBLIC_ variable", () => {
    for (const { file, text } of source) expect(text, file).not.toMatch(/NEXT_PUBLIC_FREEMIUS|NEXT_PUBLIC_.*(SECRET|API_KEY)/);
    expect(readFileSync(".env.example", "utf8")).not.toMatch(/NEXT_PUBLIC_FREEMIUS/);
  });

  it("no browser component reads a credential or imports the backend SDK or billing internals", () => {
    const clients = source.filter(({ text }) => isClient(text));
    expect(clients.length).toBeGreaterThan(10); // the check is looking at the right files
    for (const { file, text } of clients) {
      expect(text, file).not.toMatch(/process\.env\.FREEMIUS|FREEMIUS_(API|SECRET|PUBLIC)_KEY/);
      expect(text, file).not.toMatch(/from ["']@freemius\/sdk["']/);
      expect(text, file).not.toMatch(/from ["']@\/lib\/billing\/(freemius|config|events|sync|webhook-ledger)["']/);
      expect(text, file).not.toMatch(/from ["']@\/lib\/services\/subscriptions["']/);
    }
  });

  it("the only code that builds the SDK client is server-only", () => {
    const owner = source.find(({ text }) => /new Freemius\(/.test(text))!;
    expect(owner.file).toBe("src/lib/billing/freemius.ts");
    expect(owner.text).toMatch(/import "server-only"/);
    const config = source.find(({ file }) => file === "src/lib/billing/config.ts")!;
    expect(config.text).toMatch(/import "server-only"/);
  });

  it("the checkout options handed to the browser come from the SDK's getOptions, never from the config", () => {
    const action = source.find(({ file }) => file === "src/app/actions/subscription.ts")!;
    expect(action.text).toMatch(/\.getOptions\(\)/);
    expect(action.text).not.toMatch(/secretKey|apiKey|FREEMIUS_SECRET_KEY|FREEMIUS_API_KEY/);
  });

  it("there is no refund handling anywhere in the billing code", () => {
    const billing = source.filter(({ file }) => /lib\/billing\/|services\/subscriptions|actions\/subscription|api\/webhooks\/freemius|subscribe-plans/.test(file));
    expect(billing.length).toBeGreaterThanOrEqual(8);
    for (const { file, text } of billing) {
      // Comments may explain what is NOT done; only code counts. The one allowed mention is the API filter that EXCLUDES refund records.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/"not_refunded"/g, "");
      expect(code, file).not.toMatch(/refund/i);
    }
  });
});
