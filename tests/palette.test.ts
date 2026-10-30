import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/templates/checks";

/** Resolves the app's semantic colour tokens to hex for light and dark, straight from the CSS. */
function tokens(mode: "light" | "dark"): Record<string, string> {
  const vars: Record<string, string> = {};
  const read = (css: string) => {
    const [light, dark = ""] = css.split("@media (prefers-color-scheme: dark)");
    const take = (block: string) => {
      const root = block.slice(0, block.indexOf("@theme inline") === -1 ? undefined : block.indexOf("@theme inline"));
      for (const [, name, value] of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
    };
    take(light);
    if (mode === "dark") take(dark);
  };
  read(readFileSync("src/app/colors.css", "utf8"));
  read(readFileSync("src/app/globals.css", "utf8"));
  const resolve = (v: string, depth = 0): string => {
    const ref = v.match(/^var\(--([\w-]+)\)$/);
    return ref && depth < 5 ? resolve(vars[ref[1]], depth + 1) : v;
  };
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, resolve(v)]));
}

describe.each(["light", "dark"] as const)("%s colours", (mode) => {
  const t = tokens(mode);
  const hex = (name: string) => {
    expect(t[name], `--${name} should resolve to a hex colour`).toMatch(/^#[0-9a-f]{6}$/i);
    return t[name];
  };

  it.each([
    ["foreground", "background"],
    ["foreground", "surface"],
    ["foreground", "panel"],
    ["foreground", "subtle"],
    ["muted", "background"],
    ["muted", "surface"],
    ["muted", "panel"],
    ["muted", "subtle"],
    ["on-ink", "ink"],
    ["on-ink", "ink-hover"],
    ["money", "surface"],
    ["money", "background"],
    ["money-strong", "money-soft"],
    ["brand-strong", "brand-soft"],
    ["pen", "surface"],
    ["pen", "background"],
    ["pen-strong", "pen-soft"],
    ["notice-strong", "notice-soft"],
    ["foreground", "highlight"],
  ])("%s on %s is readable (4.5:1)", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("brand marks (logo, active bar, focus ring, progress) stand out from the page (3:1)", () => {
    expect(contrastRatio(hex("brand"), hex("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex("brand"), hex("background"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex("brand"), hex("panel"))).toBeGreaterThanOrEqual(3);
  });
});

it("components use tokens, not raw colours", () => {
  const hits = execSync(`grep -rnE "#[0-9a-fA-F]{6}\\b|bg-black|bg-white|text-white|blur-|neutral-[0-9]" src/app src/components --include=*.tsx || true`, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    // CV documents carry their own print colours; the logo's check and the palette picker need raw values.
    .filter((l) => !l.includes("src/components/cv/") && !/stroke="#fff"|panelInk === "#ffffff"/.test(l));
  expect(hits).toEqual([]);
});
