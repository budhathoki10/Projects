import { withSpec, type Layout, type SpecPatch, type TemplateSpec } from "../spec";
import { FAMILIES } from "./families";
import { palette, type ColourFamily } from "./palettes";

export const CATEGORIES = {
  ats: "ATS-safe essentials",
  professional: "Professional",
  modern: "Modern",
  creative: "Creative",
  executive: "Executive",
  tech: "Tech",
  academic: "Academic & research",
  "first-job": "First job & students",
  healthcare: "Healthcare & care",
  hospitality: "Hospitality & retail",
  trades: "Trades & operations",
  photo: "Photo-ready (Gulf & Asia)",
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];

export type BuiltinTemplate = {
  id: string;
  name: string;
  family: Layout;
  colour: ColourFamily;
  categories: Category[];
  description: string;
  spec: TemplateSpec;
  /** Retired templates stay resolvable for users who chose them, but leave the gallery. */
  hidden?: boolean;
};

type Tone = "deep" | "soft" | "plain";

function t(
  id: string,
  name: string,
  family: Layout,
  colour: ColourFamily,
  categories: Category[],
  patch: SpecPatch = {},
  tone: Tone = family.startsWith("sidebar") || family === "banner" ? "deep" : "plain",
): BuiltinTemplate {
  const base = FAMILIES[family];
  return {
    id,
    name,
    family,
    colour,
    categories,
    description: base.description,
    spec: withSpec(base.spec, { ...patch, palette: { ...palette(colour, tone), ...patch.palette } }),
  };
}

const serif = { heading: "source-serif", body: "source-serif" } as const;

/**
 * The 100 built-in templates. Ids are permanent: users' jobs and defaults point at them, so never
 * renumber or reuse one. To retire a template, set `hidden: true`.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // ---------- Classic: one column, ATS-safe ----------
  t("sl-001", "Classic", "classic", "navy", ["ats", "professional"]),
  t("sl-002", "Plain", "classic", "mono", ["ats", "first-job"], { headingStyle: "underline", fonts: { heading: "source-sans", body: "source-sans" } }),
  t("sl-003", "Ledger", "classic", "charcoal", ["ats", "professional", "trades"], { fonts: { heading: "plex-sans", body: "plex-sans" }, bullets: "dash" }),
  t("sl-004", "Linen", "classic", "terracotta", ["ats", "hospitality"], { fonts: { heading: "lora", body: "lato" }, headingStyle: "minimal", header: { align: "center" } }),
  t("sl-005", "Keystone", "classic", "blue", ["ats", "professional"], { fonts: { heading: "work-sans", body: "work-sans" }, headingStyle: "side-bar" }),
  t("sl-006", "Quill", "classic", "burgundy", ["ats", "professional"], { fonts: serif, headingStyle: "underline", bullets: "dash" }),
  t("sl-007", "Harbor", "classic", "teal", ["ats", "healthcare"], { fonts: { heading: "nunito-sans", body: "nunito-sans" }, headingStyle: "caps-rule", skillsStyle: "columns" }),
  t("sl-008", "Sterling", "classic", "charcoal", ["ats", "executive"], { fonts: { heading: "garamond", body: "garamond" }, header: { align: "center", nameCase: "upper" }, density: { fontSize: 11.5 } }),
  t("sl-009", "Foundation", "classic", "green", ["ats", "trades", "first-job"], { fonts: { heading: "roboto", body: "roboto" }, headingStyle: "block" }),
  t("sl-010", "Fresh Start", "classic", "blue", ["ats", "first-job"], { fonts: { heading: "dm-sans", body: "dm-sans" }, headingStyle: "minimal", skillsStyle: "tags" }),

  // ---------- Split header ----------
  t("sl-011", "Meridian", "split-header", "navy", ["ats", "professional"]),
  t("sl-012", "Signal", "split-header", "blue", ["ats", "tech"], { fonts: { heading: "space-grotesk", body: "inter" }, skillsStyle: "tags", bullets: "arrow" }),
  t("sl-013", "Anchor", "split-header", "teal", ["ats", "professional", "healthcare"], { fonts: { heading: "source-sans", body: "source-sans" } }),
  t("sl-014", "Bridge", "split-header", "charcoal", ["ats", "trades"], { fonts: { heading: "plex-sans", body: "plex-sans" }, headingStyle: "caps-rule" }),
  t("sl-015", "Northstar", "split-header", "plum", ["ats", "modern"], { fonts: { heading: "manrope", body: "manrope" }, headingStyle: "side-bar" }),
  t("sl-016", "Crossway", "split-header", "burgundy", ["ats", "executive"], { fonts: { heading: "playfair", body: "source-serif" }, header: { nameSize: 30 } }),
  t("sl-017", "Atlas", "split-header", "green", ["ats", "professional"], { fonts: { heading: "work-sans", body: "work-sans" }, dateStyle: "under" }),
  t("sl-018", "Marker", "split-header", "terracotta", ["ats", "hospitality", "creative"], { fonts: { heading: "fraunces", body: "dm-sans" }, headingStyle: "minimal", skillsStyle: "tags" }),
  t("sl-019", "Balance", "split-header", "mono", ["ats", "first-job"], { fonts: { heading: "inter", body: "inter" }, headingStyle: "numbered" }),
  t("sl-020", "Clearwater", "split-header", "teal", ["ats", "healthcare"], { fonts: { heading: "lato", body: "lato" }, bullets: "dash", headingStyle: "underline" }),

  // ---------- Compact ----------
  t("sl-021", "Brief", "compact", "navy", ["ats", "professional"]),
  t("sl-022", "Pocket", "compact", "charcoal", ["ats", "tech"], { fonts: { heading: "plex-mono", body: "plex-sans" }, bullets: "dash" }),
  t("sl-023", "Precise", "compact", "blue", ["ats", "tech"], { fonts: { heading: "inter", body: "inter" }, headingStyle: "underline", skillsStyle: "columns" }),
  t("sl-024", "Tidy", "compact", "green", ["ats", "trades"], { fonts: { heading: "roboto", body: "roboto" }, headingStyle: "block" }),
  t("sl-025", "Swift", "compact", "teal", ["ats", "healthcare"], { fonts: { heading: "source-sans", body: "source-sans" }, dateStyle: "right" }),
  t("sl-026", "Concise", "compact", "mono", ["ats", "first-job"], { fonts: { heading: "work-sans", body: "work-sans" }, headingStyle: "minimal" }),
  t("sl-027", "Ruler", "compact", "burgundy", ["ats", "professional"], { fonts: serif, bullets: "square" }),
  t("sl-028", "Logbook", "compact", "gold", ["ats", "trades"], { fonts: { heading: "plex-sans", body: "plex-sans" }, headingStyle: "side-bar" }),
  t("sl-029", "Shift", "compact", "terracotta", ["ats", "hospitality"], { fonts: { heading: "nunito-sans", body: "nunito-sans" }, skillsStyle: "tags" }),
  t("sl-030", "Minute", "compact", "plum", ["ats", "modern"], { fonts: { heading: "manrope", body: "manrope" }, headingStyle: "numbered" }),

  // ---------- Executive ----------
  t("sl-031", "Boardroom", "executive", "navy", ["executive", "ats"]),
  t("sl-032", "Principal", "executive", "charcoal", ["executive", "ats"], { fonts: { heading: "garamond", body: "garamond" }, density: { fontSize: 11.5 } }),
  t("sl-033", "Charter", "executive", "burgundy", ["executive", "ats", "professional"], { fonts: { heading: "playfair", body: "lora" } }),
  t("sl-034", "Regent", "executive", "green", ["executive", "ats"], { fonts: { heading: "baskerville", body: "lato" }, headingStyle: "underline" }),
  t("sl-035", "Summit", "executive", "blue", ["executive", "ats"], { fonts: { heading: "source-serif", body: "source-sans" }, header: { align: "left" } }),
  t("sl-036", "Laurel", "executive", "gold", ["executive", "ats"], { fonts: { heading: "fraunces", body: "source-serif" }, headingStyle: "minimal" }),
  t("sl-037", "Embassy", "executive", "plum", ["executive", "ats"], { fonts: { heading: "merriweather", body: "merriweather" }, density: { fontSize: 10 } }),
  t("sl-038", "Vanguard", "executive", "mono", ["executive", "ats"], { fonts: { heading: "inter", body: "inter" }, headingStyle: "block" }),
  t("sl-039", "Heritage", "executive", "terracotta", ["executive", "ats"], { fonts: { heading: "lora", body: "lora" }, bullets: "dash" }),
  t("sl-040", "Director", "executive", "teal", ["executive", "ats", "healthcare"], { fonts: { heading: "baskerville", body: "source-sans" }, headingStyle: "side-bar", header: { nameCase: "normal" } }),

  // ---------- Academic ----------
  t("sl-041", "Scholar", "academic", "navy", ["academic", "ats"]),
  t("sl-042", "Thesis", "academic", "mono", ["academic", "ats"], { fonts: { heading: "garamond", body: "garamond" }, density: { fontSize: 11.5 } }),
  t("sl-043", "Fellow", "academic", "burgundy", ["academic", "ats"], { fonts: { heading: "lora", body: "lora" }, headingStyle: "underline" }),
  t("sl-044", "Seminar", "academic", "green", ["academic", "ats", "first-job"], { fonts: { heading: "source-sans", body: "source-sans" }, header: { align: "left" } }),
  t("sl-045", "Archive", "academic", "charcoal", ["academic", "ats"], { fonts: { heading: "plex-sans", body: "source-serif" }, headingStyle: "caps-rule" }),
  t("sl-046", "Folio", "academic", "plum", ["academic", "ats"], { fonts: { heading: "baskerville", body: "source-serif" }, headingStyle: "numbered" }),
  t("sl-047", "Campus", "academic", "blue", ["academic", "first-job", "ats"], { fonts: { heading: "dm-sans", body: "dm-sans" }, skillsStyle: "tags", dateStyle: "right" }),
  t("sl-048", "Faculty", "academic", "teal", ["academic", "healthcare", "ats"], { fonts: { heading: "merriweather", body: "source-sans" }, headingStyle: "side-bar" }),
  t("sl-049", "Research", "academic", "gold", ["academic", "ats"], { fonts: { heading: "source-serif", body: "source-serif" }, bullets: "disc", header: { align: "left", nameSize: 24 } }),
  t("sl-050", "Index", "academic", "navy", ["academic", "tech", "ats"], { fonts: { heading: "plex-mono", body: "plex-sans" }, headingStyle: "underline", header: { align: "left" } }),

  // ---------- Timeline ----------
  t("sl-051", "Path", "timeline", "teal", ["modern", "ats"]),
  t("sl-052", "Milestone", "timeline", "navy", ["modern", "professional", "ats"], { fonts: { heading: "manrope", body: "manrope" } }),
  t("sl-053", "Waypoint", "timeline", "terracotta", ["creative", "hospitality", "ats"], { fonts: { heading: "fraunces", body: "nunito-sans" } }),
  t("sl-054", "Trail", "timeline", "green", ["modern", "trades", "ats"], { fonts: { heading: "work-sans", body: "work-sans" }, headingStyle: "caps-rule" }),
  t("sl-055", "Chronicle", "timeline", "burgundy", ["professional", "ats"], { fonts: { heading: "lora", body: "source-sans" }, headingStyle: "underline" }),
  t("sl-056", "Steps", "timeline", "blue", ["first-job", "ats"], { fonts: { heading: "dm-sans", body: "dm-sans" }, bullets: "arrow" }),
  t("sl-057", "Arc", "timeline", "plum", ["creative", "modern", "ats"], { fonts: { heading: "playfair", body: "inter" }, header: { nameSize: 32 } }),
  t("sl-058", "Route", "timeline", "charcoal", ["tech", "ats"], { fonts: { heading: "space-grotesk", body: "inter" }, headingStyle: "numbered" }),
  t("sl-059", "Compass", "timeline", "teal", ["healthcare", "ats"], { fonts: { heading: "nunito-sans", body: "nunito-sans" }, headingStyle: "side-bar" }),
  t("sl-060", "Journey", "timeline", "gold", ["hospitality", "ats"], { fonts: { heading: "baskerville", body: "lato" }, header: { align: "center" } }),

  // ---------- Banner ----------
  t("sl-061", "Masthead", "banner", "navy", ["modern", "professional", "ats"]),
  t("sl-062", "Spotlight", "banner", "plum", ["creative", "ats"], { fonts: { heading: "fraunces", body: "dm-sans" }, header: { nameSize: 32 } }),
  t("sl-063", "Skyline", "banner", "blue", ["tech", "modern", "ats"], { fonts: { heading: "space-grotesk", body: "inter" }, headingStyle: "caps-rule" }),
  t("sl-064", "Canopy", "banner", "green", ["healthcare", "ats"], { fonts: { heading: "nunito-sans", body: "nunito-sans" } }),
  t("sl-065", "Ribbon", "banner", "burgundy", ["hospitality", "creative", "ats"], { fonts: { heading: "playfair", body: "lato" }, header: { align: "center" } }),
  t("sl-066", "Beacon", "banner", "teal", ["modern", "ats"], { fonts: { heading: "manrope", body: "manrope" }, headingStyle: "underline" }, "soft"),
  t("sl-067", "Sunrise", "banner", "terracotta", ["hospitality", "first-job", "ats"], { fonts: { heading: "dm-sans", body: "dm-sans" }, headingStyle: "minimal" }, "soft"),
  t("sl-068", "Crown", "banner", "gold", ["executive", "photo"], { fonts: { heading: "baskerville", body: "source-serif" }, photo: "circle", header: { nameCase: "upper" } }),
  t("sl-069", "Marquee", "banner", "charcoal", ["photo", "professional"], { fonts: { heading: "work-sans", body: "work-sans" }, photo: "rounded" }),
  t("sl-070", "Desert Rose", "banner", "terracotta", ["photo", "hospitality"], { fonts: { heading: "lora", body: "source-sans" }, photo: "circle", headingStyle: "underline" }),

  // ---------- Label column ----------
  t("sl-071", "Gridline", "modern-grid", "navy", ["modern", "professional"]),
  t("sl-072", "Blueprint", "modern-grid", "blue", ["tech", "modern"], { fonts: { heading: "plex-mono", body: "plex-sans" }, skillsStyle: "columns" }),
  t("sl-073", "Margin", "modern-grid", "mono", ["modern", "creative"], { fonts: { heading: "playfair", body: "source-serif" }, header: { nameSize: 32 } }),
  t("sl-074", "Catalog", "modern-grid", "teal", ["professional", "healthcare"], { fonts: { heading: "source-sans", body: "source-sans" }, headingStyle: "caps-rule" }),
  t("sl-075", "Module", "modern-grid", "charcoal", ["tech"], { fonts: { heading: "space-grotesk", body: "inter" }, skillsStyle: "tags", bullets: "arrow" }),
  t("sl-076", "Frame", "modern-grid", "burgundy", ["executive", "professional"], { fonts: { heading: "baskerville", body: "lato" }, dateStyle: "right" }),
  t("sl-077", "Studio", "modern-grid", "plum", ["creative"], { fonts: { heading: "fraunces", body: "manrope" }, skillsStyle: "tags" }),
  t("sl-078", "Label", "modern-grid", "green", ["trades", "professional"], { fonts: { heading: "work-sans", body: "work-sans" }, headingStyle: "caps-rule", bullets: "square" }),
  t("sl-079", "Notebook", "modern-grid", "gold", ["first-job", "creative"], { fonts: { heading: "lora", body: "nunito-sans" } }),
  t("sl-080", "Matrix", "modern-grid", "teal", ["tech"], { fonts: { heading: "plex-sans", body: "plex-sans" }, headingStyle: "numbered", dateStyle: "right" }),

  // ---------- Sidebar left ----------
  t("sl-081", "Sidecar", "sidebar-left", "navy", ["modern", "photo"]),
  t("sl-082", "Cedar", "sidebar-left", "green", ["photo", "trades"], { fonts: { heading: "work-sans", body: "work-sans" }, photo: "square" }),
  t("sl-083", "Indigo", "sidebar-left", "blue", ["tech", "modern"], { fonts: { heading: "space-grotesk", body: "inter" }, photo: "off", skillsStyle: "tags" }),
  t("sl-084", "Saffron", "sidebar-left", "terracotta", ["photo", "hospitality", "creative"], { fonts: { heading: "fraunces", body: "dm-sans" } }),
  t("sl-085", "Orchid", "sidebar-left", "plum", ["creative", "photo"], { fonts: { heading: "playfair", body: "lato" }, photo: "rounded" }),
  t("sl-086", "Lagoon", "sidebar-left", "teal", ["healthcare", "photo"], { fonts: { heading: "nunito-sans", body: "nunito-sans" } }, "soft"),
  t("sl-087", "Slate", "sidebar-left", "charcoal", ["professional", "modern"], { fonts: { heading: "plex-sans", body: "plex-sans" }, photo: "off" }),
  t("sl-088", "Juniper", "sidebar-left", "green", ["first-job", "photo"], { fonts: { heading: "dm-sans", body: "dm-sans" }, skillsStyle: "tags" }, "soft"),
  t("sl-089", "Pillar", "sidebar-left", "burgundy", ["executive", "photo"], { fonts: { heading: "baskerville", body: "source-serif" }, photo: "square" }),
  t("sl-090", "Kathmandu", "sidebar-left", "navy", ["photo", "professional"], { fonts: { heading: "manrope", body: "manrope" }, headingStyle: "underline" }, "soft"),

  // ---------- Sidebar right ----------
  t("sl-091", "Mirror", "sidebar-right", "charcoal", ["modern", "professional"]),
  t("sl-092", "Coral", "sidebar-right", "terracotta", ["creative", "hospitality"], { fonts: { heading: "fraunces", body: "nunito-sans" } }, "soft"),
  t("sl-093", "Fjord", "sidebar-right", "blue", ["tech"], { fonts: { heading: "space-grotesk", body: "inter" }, headingStyle: "numbered" }),
  t("sl-094", "Willow", "sidebar-right", "green", ["healthcare", "photo"], { fonts: { heading: "lora", body: "lato" }, photo: "circle" }, "soft"),
  t("sl-095", "Ember", "sidebar-right", "burgundy", ["creative"], { fonts: { heading: "playfair", body: "source-sans" }, headingStyle: "minimal" }),
  t("sl-096", "Aurora", "sidebar-right", "plum", ["modern", "photo"], { fonts: { heading: "manrope", body: "manrope" }, photo: "rounded" }),
  t("sl-097", "Harvest", "sidebar-right", "gold", ["trades", "first-job"], { fonts: { heading: "work-sans", body: "work-sans" }, skillsStyle: "lines" }, "soft"),
  t("sl-098", "Easel", "sidebar-right", "teal", ["creative", "first-job"], { fonts: { heading: "dm-sans", body: "dm-sans" }, headingStyle: "side-bar" }, "soft"),
  t("sl-099", "Pebble", "sidebar-right", "mono", ["professional", "modern"], { fonts: { heading: "inter", body: "inter" } }, "soft"),
  t("sl-100", "Oasis", "sidebar-right", "teal", ["photo", "hospitality"], { fonts: { heading: "baskerville", body: "source-sans" }, photo: "circle" }),
];
