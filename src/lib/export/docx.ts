import "server-only";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopPosition, TabStopType, TextRun } from "docx";
import type { Profile } from "@/lib/model/types";

/**
 * A single-column Word CV that applicant tracking systems read cleanly: standard section
 * names, real text (no tables, columns, text boxes or images), plain bullets.
 */

const FONT = "Calibri";
const run = (text: string, opts: { bold?: boolean; size?: number; italics?: boolean; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics, color: opts.color });

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    children: [run(text.toUpperCase(), { bold: true, size: 22 })],
  });
}

/** Left text with dates right-aligned on the same line. */
function lineWithDates(left: TextRun[], dates: string) {
  return new Paragraph({
    spacing: { before: 120, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [...left, ...(dates ? [run(`\t${dates}`, { color: "555555" })] : [])],
  });
}

const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [run(text)] });
const dates = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

export function cvDocument(cv: Profile): Document {
  const contact = [cv.email, cv.phone, cv.location, ...cv.links].filter(Boolean).join("  |  ");
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.LEFT, children: [run(cv.name || "Your name", { bold: true, size: 36 })] }),
  ];
  if (cv.headline) body.push(new Paragraph({ children: [run(cv.headline, { size: 23, color: "333333" })] }));
  if (contact) body.push(new Paragraph({ spacing: { after: 120 }, children: [run(contact, { size: 19, color: "444444" })] }));

  if (cv.summary) body.push(heading("Summary"), new Paragraph({ children: [run(cv.summary)] }));

  if (cv.experience.length) {
    body.push(heading("Experience"));
    for (const e of cv.experience) {
      body.push(
        lineWithDates([run(e.title, { bold: true }), ...(e.company ? [run(`, ${e.company}`)] : []), ...(e.location ? [run(`, ${e.location}`, { color: "555555" })] : [])], dates(e.start, e.end)),
        ...e.bullets.map(bullet),
      );
    }
  }
  if (cv.projects.length) {
    body.push(heading("Projects"));
    for (const p of cv.projects) {
      body.push(lineWithDates([run(p.name, { bold: true }), ...(p.link ? [run(`  ${p.link}`, { color: "555555" })] : [])], ""), ...p.bullets.map(bullet));
    }
  }
  if (cv.education.length) {
    body.push(heading("Education"));
    for (const e of cv.education) {
      body.push(lineWithDates([run(e.degree, { bold: true }), ...(e.school ? [run(`, ${e.school}`)] : [])], dates(e.start, e.end)), ...e.details.map(bullet));
    }
  }
  if (cv.skills.length) body.push(heading("Skills"), new Paragraph({ children: [run(cv.skills.join(", "))] }));
  if (cv.certifications.length) body.push(heading("Certifications"), ...cv.certifications.map(bullet));
  if (cv.languages.length) body.push(heading("Languages"), new Paragraph({ children: [run(cv.languages.join(", "))] }));

  return new Document({
    creator: "Shortlist",
    title: `${cv.name} CV`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: body }],
  });
}

export async function cvDocxBuffer(cv: Profile): Promise<Buffer> {
  return Packer.toBuffer(cvDocument(cv));
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
