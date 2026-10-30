import type { Palette } from "../spec";

/** Colour families used for filtering and for building palettes. Accents pass 4.5:1 on white. */
export const COLOURS = {
  navy: { label: "Navy", accent: "#1d3557" },
  charcoal: { label: "Charcoal", accent: "#2f3337" },
  blue: { label: "Blue", accent: "#1f5aa6" },
  teal: { label: "Teal", accent: "#0d6363" },
  green: { label: "Green", accent: "#2e6339" },
  burgundy: { label: "Burgundy", accent: "#7a1f2b" },
  plum: { label: "Plum", accent: "#5b2a6e" },
  terracotta: { label: "Terracotta", accent: "#9c4325" },
  gold: { label: "Gold", accent: "#7a5c0f" },
  mono: { label: "Black and white", accent: "#111111" },
} as const;

export type ColourFamily = keyof typeof COLOURS;
export const COLOUR_IDS = Object.keys(COLOURS) as ColourFamily[];

function mix(hex: string, withHex: string, amount: number) {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(withHex.slice(i, i + 2), 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * "deep": a dark panel with white text. "soft": a pale tint of the accent with dark text.
 * "plain": no panel colour to speak of (one-column templates).
 */
export function palette(colour: ColourFamily, tone: "deep" | "soft" | "plain" = "plain"): Palette {
  const accent = COLOURS[colour].accent;
  const ink = colour === "mono" ? "#111111" : "#1c1d1f";
  return {
    ink,
    accent,
    muted: "#5d6166",
    rule: mix(accent, "#ffffff", 0.75),
    panel: tone === "soft" ? mix(accent, "#ffffff", 0.9) : accent,
    panelInk: tone === "soft" ? ink : "#ffffff",
  };
}
