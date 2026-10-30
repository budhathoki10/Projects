import { LIMITS, type Density, type TemplateSpec } from "./spec";

export type Fit = { density: Density; margin: number };

/**
 * Progressively tighter settings for "fit to N pages", loosest first: smaller text, then less
 * space between sections, then tighter lines, then smaller margins. Content is never removed.
 * The browser measures each step and keeps the first that fits.
 */
export function fitSteps(spec: TemplateSpec): Fit[] {
  const steps: Fit[] = [];
  let { fontSize, lineHeight, sectionGap } = spec.density;
  let margin = spec.page.margin;
  const push = () => {
    const last = steps.at(-1);
    const next = { density: { fontSize, lineHeight, sectionGap }, margin };
    if (!last || JSON.stringify(last) !== JSON.stringify(next)) steps.push(next);
  };
  const round = (n: number) => Math.round(n * 100) / 100;

  push();
  while (fontSize > 10) {
    fontSize = round(Math.max(10, fontSize - 0.25));
    push();
  }
  while (sectionGap > 6) {
    sectionGap = Math.max(6, sectionGap - 2);
    push();
  }
  while (lineHeight > 1.2) {
    lineHeight = round(Math.max(1.2, lineHeight - 0.05));
    push();
  }
  while (margin > 12) {
    margin = Math.max(12, margin - 2);
    push();
  }
  while (fontSize > LIMITS.fontSize[0]) {
    fontSize = round(Math.max(LIMITS.fontSize[0], fontSize - 0.25));
    push();
  }
  return steps;
}

export function applyFit(spec: TemplateSpec, fit: Fit | null | undefined): TemplateSpec {
  if (!fit) return spec;
  return { ...spec, density: fit.density, page: { ...spec.page, margin: fit.margin } };
}
