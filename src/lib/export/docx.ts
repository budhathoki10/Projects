import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { Profile } from "@/lib/model/types";
import { FONTS } from "@/lib/templates/fonts";
import { DEFAULT_SPEC, hasSidebar, PAGE_MM, SECTION_LABELS, type SectionId, type TemplateSpec } from "@/lib/templates/spec";

/**
 * A Word CV that follows the template as closely as Word allows: fonts, colours, sizes, section
 * titles, bullets, date placement and section order. Sidebar layouts become a two-column table
 * with a shaded side cell, and a banner becomes shaded paragraphs. Text stays real text, so
 * applicant tracking systems can read it. See docs/TEMPLATES.md for what Word can't do.
 */

const TWIPS_PER_MM = 56.6929;
const DATE_COLUMN = 1600; // twips, for dates on the left
const hex = (c: string) => c.replace("#", "").toUpperCase();
const dates = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");
const BULLET_CHAR = { disc: "•", square: "▪", dash: "–", arrow: "›", none: "•" } as const;

type Ctx = {
  spec: TemplateSpec;
  size: number; // half-points
  ink: string;
  muted: string;
  accent: string;
  /** Drawing inside the coloured side cell or banner: everything uses the panel's text colour. */
  onPanel: boolean;
  /** Usable width in twips, for right-aligned date tabs. */
  width: number;
};

function run(ctx: Ctx, text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; heading?: boolean; caps?: boolean } = {}) {
  const font = FONTS[opts.heading ? ctx.spec.fonts.heading : ctx.spec.fonts.body].word;
  const color = ctx.onPanel ? hex(ctx.spec.palette.panelInk) : (opts.color ?? ctx.ink);
  return new TextRun({ text, font, size: opts.size ?? ctx.size, bold: opts.bold, italics: opts.italics, color, allCaps: opts.caps });
}

function heading(ctx: Ctx, id: SectionId | "contact", index: number) {
  const s = ctx.spec;
  const label = id === "contact" ? "Contact" : SECTION_LABELS[id];
  const block = s.headingStyle === "block" && !ctx.onPanel;
  const caps = s.headingStyle === "caps-rule" || s.headingStyle === "block";
  const lineColor = ctx.onPanel ? hex(s.palette.panelInk) : hex(s.palette.rule);
  const children: ParagraphChild[] = [];
  if (s.headingStyle === "numbered") children.push(run(ctx, `${String(index + 1).padStart(2, "0")}  `, { color: ctx.muted }));
  children.push(
    run(ctx, label, {
      heading: true,
      bold: true,
      caps,
      size: Math.round(ctx.size * 1.08),
      color: block ? "FFFFFF" : s.headingStyle === "side-bar" ? ctx.ink : ctx.accent,
    }),
  );
  const ruled = s.headingStyle === "underline" || s.headingStyle === "caps-rule" || s.headingStyle === "numbered";
  return new Paragraph({
    keepNext: true,
    spacing: { before: Math.round(s.density.sectionGap * 20), after: 80 },
    border: ruled
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: lineColor, space: 2 } }
      : s.headingStyle === "side-bar"
        ? { left: { style: BorderStyle.SINGLE, size: 24, color: ctx.onPanel ? lineColor : ctx.accent, space: 6 } }
        : undefined,
    shading: block ? { type: ShadingType.CLEAR, fill: ctx.accent, color: "auto" } : undefined,
    children,
  });
}

function bullet(ctx: Ctx, text: string, indentLeft = 0) {
  if (ctx.spec.bullets === "none") return new Paragraph({ spacing: { after: 30 }, indent: indentLeft ? { left: indentLeft } : undefined, children: [run(ctx, text)] });
  return new Paragraph({
    numbering: { reference: "cv-bullets", level: 0 },
    spacing: { after: 30 },
    indent: indentLeft ? { left: indentLeft + 300, hanging: 220 } : undefined,
    children: [run(ctx, text)],
  });
}

function entry(ctx: Ctx, title: string, sub: string, place: string, when: string, bullets: string[]) {
  const left: ParagraphChild[] = [run(ctx, title, { bold: true })];
  if (sub) left.push(run(ctx, `${title ? ", " : ""}${sub}`));
  if (place) left.push(run(ctx, `, ${place}`, { color: ctx.muted }));
  const small = Math.round(ctx.size * 0.92);
  const style = ctx.onPanel ? "under" : ctx.spec.dateStyle;
  const paras: Paragraph[] = [];
  if (style === "right") {
    paras.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 100, after: 20 },
        tabStops: [{ type: TabStopType.RIGHT, position: ctx.width }],
        children: [...left, ...(when ? [run(ctx, `\t${when}`, { color: ctx.muted, size: small })] : [])],
      }),
    );
  } else if (style === "left") {
    paras.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 100, after: 20 },
        tabStops: [{ type: TabStopType.LEFT, position: DATE_COLUMN }],
        indent: { left: DATE_COLUMN, hanging: DATE_COLUMN },
        children: [run(ctx, when, { color: ctx.muted, size: small }), run(ctx, "\t"), ...left],
      }),
    );
  } else {
    paras.push(new Paragraph({ keepNext: true, spacing: { before: 100 }, children: left }));
    if (when) paras.push(new Paragraph({ keepNext: true, spacing: { after: 20 }, children: [run(ctx, when, { color: ctx.muted, size: small })] }));
  }
  for (const b of bullets) paras.push(bullet(ctx, b, style === "left" ? DATE_COLUMN : 0));
  return paras;
}

function words(ctx: Ctx, items: string[], style: TemplateSpec["skillsStyle"]) {
  if (style === "lines" || style === "columns" || ctx.onPanel) return items.map((w) => new Paragraph({ spacing: { after: 20 }, children: [run(ctx, w)] }));
  return [new Paragraph({ children: [run(ctx, items.join(style === "tags" ? "  ·  " : ", "))] })];
}

function section(ctx: Ctx, id: SectionId, cv: Profile, index: number): Paragraph[] {
  const body: Paragraph[] = (() => {
    switch (id) {
      case "summary":
        return [new Paragraph({ children: [run(ctx, cv.summary, { italics: ctx.spec.layout === "executive" })] })];
      case "experience":
        return cv.experience.flatMap((e) => entry(ctx, e.title, e.company, e.location, dates(e.start, e.end), e.bullets));
      case "projects":
        return cv.projects.flatMap((p) => entry(ctx, p.name, p.link, "", "", p.bullets));
      case "education":
        return cv.education.flatMap((e) => entry(ctx, e.degree, e.school, "", dates(e.start, e.end), e.details));
      case "skills":
        return words(ctx, cv.skills, ctx.spec.skillsStyle);
      case "languages":
        return words(ctx, cv.languages, "inline");
      case "certifications":
        return cv.certifications.map((c) => bullet(ctx, c));
    }
  })();
  return [heading(ctx, id, index), ...body];
}

const hasContent = (cv: Profile, id: SectionId) => (id === "summary" ? Boolean(cv.summary.trim()) : cv[id].length > 0);

/** The photo as a square PNG (Word doesn't take WebP), `mm` wide. */
function photoRun(photo: Buffer | null, spec: TemplateSpec, mm: number) {
  if (!photo || spec.photo === "off") return null;
  const px = Math.round((mm / 25.4) * 96);
  return new ImageRun({ type: "png", data: photo, transformation: { width: px, height: px } });
}

function header(ctx: Ctx, cv: Profile, photo: Buffer | null, withContact: boolean) {
  const s = ctx.spec;
  const align = s.header.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const banner = s.layout === "banner";
  const shading = banner ? { type: ShadingType.CLEAR, fill: hex(s.palette.panel), color: "auto" } : undefined;
  const c: Ctx = banner ? { ...ctx, onPanel: true } : ctx;
  const out: Paragraph[] = [];
  const img = photoRun(photo, s, 24);
  if (img) out.push(new Paragraph({ alignment: align, shading, spacing: { after: 80 }, children: [img] }));
  out.push(
    new Paragraph({
      alignment: align,
      shading,
      children: [run(c, cv.name || "Your name", { bold: true, size: Math.round(s.header.nameSize * 2), heading: true, caps: s.header.nameCase === "upper" })],
    }),
  );
  if (cv.headline) out.push(new Paragraph({ alignment: align, shading, children: [run(c, cv.headline, { size: Math.round(ctx.size * 1.2), color: ctx.accent })] }));
  if (withContact) {
    const contact = [cv.email, cv.phone, cv.location, ...cv.links].filter(Boolean).join("  ·  ");
    if (contact) out.push(new Paragraph({ alignment: align, shading, spacing: { after: 120 }, children: [run(c, contact, { size: Math.round(ctx.size * 0.92), color: ctx.muted })] }));
  }
  if (s.layout === "split-header" || s.layout === "executive" || s.layout === "academic") {
    out.push(
      new Paragraph({
        spacing: { after: 120 },
        border: { bottom: { style: s.layout === "executive" ? BorderStyle.DOUBLE : BorderStyle.SINGLE, size: s.layout === "academic" ? 6 : 12, color: ctx.accent, space: 1 } },
        children: [],
      }),
    );
  }
  return out;
}

export function cvDocument(cv: Profile, spec: TemplateSpec = DEFAULT_SPEC, photo: Buffer | null = null): Document {
  const page = PAGE_MM[spec.page.size];
  const margin = Math.round(spec.page.margin * TWIPS_PER_MM);
  const pageW = Math.round(page.w * TWIPS_PER_MM);
  const usable = pageW - margin * 2;
  const ctx: Ctx = {
    spec,
    size: Math.round(spec.density.fontSize * 2),
    ink: hex(spec.palette.ink),
    muted: hex(spec.palette.muted),
    accent: hex(spec.palette.accent),
    onPanel: false,
    width: usable,
  };
  const shown = spec.sections.filter((s) => s.visible && hasContent(cv, s.id));
  const children: (Paragraph | Table)[] = [];

  if (hasSidebar(spec.layout)) {
    const sideW = Math.round((usable * spec.sidebarWidth) / 100);
    const mainW = usable - sideW;
    const side: Ctx = { ...ctx, onPanel: true, width: sideW - 400 };
    const main: Ctx = { ...ctx, width: mainW - 400 };
    const sideParas: Paragraph[] = [];
    const img = photoRun(photo, spec, 30);
    if (img) sideParas.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [img] }));
    sideParas.push(
      heading(side, "contact", 0),
      ...[cv.email, cv.phone, cv.location, ...cv.links].filter(Boolean).map((c) => new Paragraph({ children: [run(side, c, { size: Math.round(ctx.size * 0.9) })] })),
    );
    shown.filter((s) => s.column === "side").forEach((s, i) => sideParas.push(...section(side, s.id, cv, i + 1)));
    const mainParas = header(main, cv, null, false);
    shown.filter((s) => s.column === "main").forEach((s, i) => mainParas.push(...section(main, s.id, cv, i)));
    const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const sideCell = new TableCell({
      width: { size: sideW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: hex(spec.palette.panel), color: "auto" },
      margins: { top: 200, bottom: 200, left: 200, right: 200 },
      verticalAlign: VerticalAlign.TOP,
      children: sideParas,
    });
    const mainCell = new TableCell({ width: { size: mainW, type: WidthType.DXA }, margins: { top: 0, bottom: 200, left: 300, right: 100 }, children: mainParas });
    children.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: usable, type: WidthType.DXA },
        columnWidths: spec.layout === "sidebar-left" ? [sideW, mainW] : [mainW, sideW],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [new TableRow({ children: spec.layout === "sidebar-left" ? [sideCell, mainCell] : [mainCell, sideCell] })],
      }),
    );
  } else {
    children.push(...header(ctx, cv, photo, true));
    shown.forEach((s, i) => children.push(...section(ctx, s.id, cv, i)));
  }

  return new Document({
    creator: "Shortlist",
    title: `${cv.name} CV`,
    styles: {
      default: {
        document: {
          run: { font: FONTS[spec.fonts.body].word, size: ctx.size, color: ctx.ink },
          paragraph: { spacing: { line: Math.round(spec.density.lineHeight * 240) } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "cv-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: BULLET_CHAR[spec.bullets],
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 300, hanging: 220 } }, run: { color: ctx.accent } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: pageW, height: Math.round(page.h * TWIPS_PER_MM) },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        children,
      },
    ],
  });
}

export async function cvDocxBuffer(cv: Profile, spec?: TemplateSpec, photo?: Buffer | null): Promise<Buffer> {
  return Packer.toBuffer(cvDocument(cv, spec, photo ?? null));
}

/** "asha-gurung-cv-frontend-developer.docx" */
export function cvFileName(cv: Profile, jobTitle: string, ext: "docx" | "pdf") {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  return `${[slug(cv.name) || "cv", "cv", slug(jobTitle)].filter(Boolean).join("-")}.${ext}`;
}
