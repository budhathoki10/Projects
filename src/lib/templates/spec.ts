import { z } from "zod";
import { FONT_IDS, BODY_FONT_IDS, type FontId } from "./fonts";

/**
 * A CV template is data, not code: one renderer turns a spec plus a profile into the CV. Every
 * value is an enum, a hex colour or a bounded number, so nothing a user saves can inject CSS or
 * HTML. See docs/TEMPLATES.md.
 */

export const LAYOUTS = [
  "classic",
  "split-header",
  "compact",
  "executive",
  "academic",
  "timeline",
  "banner",
  "modern-grid",
  "sidebar-left",
  "sidebar-right",
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const LAYOUT_LABELS: Record<Layout, string> = {
  classic: "Classic",
  "split-header": "Split header",
  compact: "Compact",
  executive: "Executive",
  academic: "Academic",
  timeline: "Timeline",
  banner: "Banner",
  "modern-grid": "Label column",
  "sidebar-left": "Sidebar left",
  "sidebar-right": "Sidebar right",
};

export const SIDEBAR_LAYOUTS: readonly Layout[] = ["sidebar-left", "sidebar-right"];
export const hasSidebar = (layout: Layout) => SIDEBAR_LAYOUTS.includes(layout);

export const SECTION_IDS = ["summary", "experience", "education", "skills", "projects", "certifications", "languages"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
};

export const HEADING_STYLES = ["underline", "caps-rule", "block", "side-bar", "minimal", "numbered"] as const;
export const BULLETS = ["disc", "dash", "arrow", "square", "none"] as const;
export const DATE_STYLES = ["right", "under", "left"] as const;
export const SKILLS_STYLES = ["inline", "tags", "columns", "lines"] as const;
export const PHOTO_STYLES = ["off", "circle", "square", "rounded"] as const;
export const PAGE_SIZES = ["A4", "Letter"] as const;

export const LIMITS = {
  nameSize: [18, 40],
  fontSize: [9.5, 12],
  lineHeight: [1.15, 1.6],
  sectionGap: [4, 20],
  margin: [10, 25],
  sidebarWidth: [26, 40],
} as const;

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex, like #1d2740")
  .transform((s) => s.toLowerCase());
const within = ([min, max]: readonly [number, number]) => z.number().finite().min(min).max(max);

const sectionsSchema = z
  .array(z.object({ id: z.enum(SECTION_IDS), visible: z.boolean(), column: z.enum(["main", "side"]) }))
  .length(SECTION_IDS.length)
  .refine((list) => new Set(list.map((s) => s.id)).size === SECTION_IDS.length, "Each section must appear exactly once");

export const templateSpecSchema = z.object({
  version: z.literal(1),
  layout: z.enum(LAYOUTS),
  fonts: z.object({
    heading: z.enum(FONT_IDS as [FontId, ...FontId[]]),
    body: z.enum(BODY_FONT_IDS as [FontId, ...FontId[]]),
  }),
  palette: z.object({ ink: hex, accent: hex, muted: hex, rule: hex, panel: hex, panelInk: hex }),
  header: z.object({ align: z.enum(["left", "center"]), nameSize: within(LIMITS.nameSize), nameCase: z.enum(["normal", "upper"]) }),
  headingStyle: z.enum(HEADING_STYLES),
  bullets: z.enum(BULLETS),
  dateStyle: z.enum(DATE_STYLES),
  skillsStyle: z.enum(SKILLS_STYLES),
  density: z.object({ fontSize: within(LIMITS.fontSize), lineHeight: within(LIMITS.lineHeight), sectionGap: within(LIMITS.sectionGap) }),
  page: z.object({ size: z.enum(PAGE_SIZES), margin: within(LIMITS.margin) }),
  photo: z.enum(PHOTO_STYLES),
  sidebarWidth: within(LIMITS.sidebarWidth),
  sections: sectionsSchema,
});

export type TemplateSpec = z.infer<typeof templateSpecSchema>;
export type Density = TemplateSpec["density"];
export type Palette = TemplateSpec["palette"];
export type SectionSlot = TemplateSpec["sections"][number];

/** The sections in their usual order. Sidebar layouts move the short lists to the side. */
export function defaultSections(layout: Layout = "classic"): SectionSlot[] {
  const side = new Set<SectionId>(hasSidebar(layout) ? ["skills", "languages", "certifications"] : []);
  const order: SectionId[] =
    layout === "academic"
      ? ["summary", "education", "experience", "projects", "certifications", "skills", "languages"]
      : ["summary", "experience", "projects", "education", "skills", "certifications", "languages"];
  return order.map((id) => ({ id, visible: true, column: side.has(id) ? "side" : "main" }));
}

export const DEFAULT_SPEC: TemplateSpec = {
  version: 1,
  layout: "classic",
  fonts: { heading: "inter", body: "inter" },
  palette: { ink: "#1b1b1b", accent: "#1d2740", muted: "#5c5c5c", rule: "#c8c8c8", panel: "#1d2740", panelInk: "#ffffff" },
  header: { align: "left", nameSize: 24, nameCase: "normal" },
  headingStyle: "caps-rule",
  bullets: "disc",
  dateStyle: "right",
  skillsStyle: "inline",
  density: { fontSize: 10.5, lineHeight: 1.35, sectionGap: 12 },
  page: { size: "A4", margin: 16 },
  photo: "off",
  sidebarWidth: 32,
  sections: defaultSections("classic"),
};

/** Validates anything that claims to be a spec: user input, database rows, built-ins. */
export function parseSpec(input: unknown): TemplateSpec | null {
  const parsed = templateSpecSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** A spec with some parts replaced, kept valid: used to build the built-ins from family defaults. */
export function withSpec(base: TemplateSpec, patch: SpecPatch): TemplateSpec {
  return {
    ...base,
    ...patch,
    fonts: { ...base.fonts, ...patch.fonts },
    palette: { ...base.palette, ...patch.palette },
    header: { ...base.header, ...patch.header },
    density: { ...base.density, ...patch.density },
    page: { ...base.page, ...patch.page },
    sections: patch.sections ?? base.sections,
  };
}

export type SpecPatch = Partial<Omit<TemplateSpec, "fonts" | "palette" | "header" | "density" | "page">> & {
  fonts?: Partial<TemplateSpec["fonts"]>;
  palette?: Partial<Palette>;
  header?: Partial<TemplateSpec["header"]>;
  density?: Partial<Density>;
  page?: Partial<TemplateSpec["page"]>;
};

/** Switching layout keeps the look but moves sections to sensible columns. */
export function changeLayout(spec: TemplateSpec, layout: Layout): TemplateSpec {
  const sidebar = hasSidebar(layout);
  const defaults = new Map(defaultSections(layout).map((s) => [s.id, s.column]));
  const sections = spec.sections.map((s) => ({
    ...s,
    column: sidebar ? (hasSidebar(spec.layout) ? s.column : defaults.get(s.id)!) : ("main" as const),
  }));
  return { ...spec, layout, sections };
}

/** Page size in millimetres. */
export const PAGE_MM = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } } as const;
