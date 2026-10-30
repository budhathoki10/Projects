/**
 * The fonts a CV can use. Each is self-hosted by next/font (see components/cv/cv-fonts.ts) and
 * exposed as the CSS variable `--cvf-<id>`. Word downloads name the same family; if it isn't
 * installed, Word picks the closest one.
 */
export const FONTS = {
  inter: { label: "Inter", kind: "sans", word: "Inter", fallback: "Arial, sans-serif" },
  "source-sans": { label: "Source Sans 3", kind: "sans", word: "Source Sans 3", fallback: "Arial, sans-serif" },
  "plex-sans": { label: "IBM Plex Sans", kind: "sans", word: "IBM Plex Sans", fallback: "Arial, sans-serif" },
  "work-sans": { label: "Work Sans", kind: "sans", word: "Work Sans", fallback: "Arial, sans-serif" },
  manrope: { label: "Manrope", kind: "sans", word: "Manrope", fallback: "Arial, sans-serif" },
  "dm-sans": { label: "DM Sans", kind: "sans", word: "DM Sans", fallback: "Arial, sans-serif" },
  lato: { label: "Lato", kind: "sans", word: "Lato", fallback: "Arial, sans-serif" },
  "nunito-sans": { label: "Nunito Sans", kind: "sans", word: "Nunito Sans", fallback: "Arial, sans-serif" },
  roboto: { label: "Roboto", kind: "sans", word: "Roboto", fallback: "Arial, sans-serif" },
  "space-grotesk": { label: "Space Grotesk", kind: "sans", word: "Space Grotesk", fallback: "Arial, sans-serif" },
  "source-serif": { label: "Source Serif 4", kind: "serif", word: "Source Serif 4", fallback: "Georgia, serif" },
  merriweather: { label: "Merriweather", kind: "serif", word: "Merriweather", fallback: "Georgia, serif" },
  lora: { label: "Lora", kind: "serif", word: "Lora", fallback: "Georgia, serif" },
  garamond: { label: "EB Garamond", kind: "serif", word: "EB Garamond", fallback: "Garamond, Georgia, serif" },
  baskerville: { label: "Libre Baskerville", kind: "serif", word: "Libre Baskerville", fallback: "Baskerville, Georgia, serif" },
  playfair: { label: "Playfair Display", kind: "display", word: "Playfair Display", fallback: "Georgia, serif" },
  fraunces: { label: "Fraunces", kind: "display", word: "Fraunces", fallback: "Georgia, serif" },
  "plex-mono": { label: "IBM Plex Mono", kind: "mono", word: "IBM Plex Mono", fallback: "Consolas, monospace" },
} as const;

export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as FontId[];

/** Display and mono faces are for names and headings; long body text needs a text face. */
export const BODY_FONT_IDS = FONT_IDS.filter((id) => FONTS[id].kind === "sans" || FONTS[id].kind === "serif");

export const fontStack = (id: FontId) => `var(--cvf-${id}), ${FONTS[id].fallback}`;
