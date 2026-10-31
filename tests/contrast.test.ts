import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** WCAG 2.x contrast between two #rrggbb colours. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const css = readFileSync("src/app/globals.css", "utf8");
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = { ...light, ...tokens(css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme inline"))) };

// Every text colour against every surface it is actually drawn on.
const PAIRS: [fg: string, bg: string][] = [
  ...["foreground", "muted", "faint"].flatMap((fg) => ["background", "surface", "surface-hover", "sunken"].map((bg) => [fg, bg] as [string, string])),
  ["on-ink", "ink"],
  ["on-ink", "ink-hover"],
  ["on-accent", "accent"],
  ["on-accent", "danger"],
  ["accent", "background"],
  ["accent", "surface"],
  ["accent", "accent-soft"],
  ["accent", "surface-hover"],
  ["accent", "tint"],
  ["accent-strong", "accent-soft"],
  ["accent-strong", "tint"],
  ["accent-strong", "surface"],
  ["on-accent", "accent-hover"],
  ["foreground", "tint"],
  ["muted", "tint"],
  ["faint", "tint"],
  ["success", "surface"],
  ["success", "success-soft"],
  ["success", "background"],
  ["warning", "surface"],
  ["warning", "warning-soft"],
  ["warning", "background"],
  ["danger", "surface"],
  ["danger", "danger-soft"],
  ["danger", "background"],
  ["foreground", "mark"],
  ["foreground", "accent-soft"],
  ["sidebar-fg", "sidebar"],
  ["sidebar-fg", "sidebar-hover"],
  ["sidebar-fg", "sidebar-active"],
  ["sidebar-muted", "sidebar"],
  ["sidebar-muted", "sidebar-hover"],
  ["sidebar-muted", "sidebar-active"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_name, theme) => {
  it("has every colour the pairs below need", () => {
    for (const [fg, bg] of PAIRS) {
      expect(theme[fg], fg).toBeTruthy();
      expect(theme[bg], bg).toBeTruthy();
    }
  });

  it.each(PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
