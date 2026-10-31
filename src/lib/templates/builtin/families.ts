import { DEFAULT_SPEC, defaultSections, withSpec, type Layout, type TemplateSpec } from "../spec";

/** Hand-tuned defaults for each layout engine. Every built-in is one of these plus a few overrides. */
export const FAMILIES: Record<Layout, { spec: TemplateSpec; description: string }> = {
  classic: {
    description: "One clean column with clear section titles. Reads well for people and every applicant tracking system.",
    spec: withSpec(DEFAULT_SPEC, { layout: "classic", sections: defaultSections("classic") }),
  },
  "split-header": {
    description: "Name on the left, contact details on the right, and a strong rule under them. One column below.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "split-header",
      headingStyle: "underline",
      header: { nameSize: 26 },
      sections: defaultSections("split-header"),
    }),
  },
  compact: {
    description: "Tight spacing with dates in a narrow left column. Fits a lot of experience on one page.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "compact",
      dateStyle: "left",
      headingStyle: "caps-rule",
      header: { nameSize: 20 },
      density: { fontSize: 10, lineHeight: 1.25, sectionGap: 8 },
      page: { margin: 13 },
      sections: defaultSections("compact"),
    }),
  },
  executive: {
    description: "A confident serif name over a double rule, with the summary as an opening statement.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "executive",
      fonts: { heading: "baskerville", body: "source-serif" },
      header: { align: "center", nameSize: 28, nameCase: "upper" },
      headingStyle: "caps-rule",
      bullets: "square",
      density: { fontSize: 10.5, lineHeight: 1.4, sectionGap: 13 },
      sections: defaultSections("executive"),
    }),
  },
  academic: {
    description: "Education first, dates on the left and room for long lists. Made for research and teaching CVs.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "academic",
      fonts: { heading: "source-serif", body: "source-serif" },
      header: { align: "center", nameSize: 22 },
      headingStyle: "minimal",
      dateStyle: "left",
      bullets: "dash",
      skillsStyle: "lines",
      sections: defaultSections("academic"),
    }),
  },
  timeline: {
    description: "Your roles along a vertical line with dots, so your path is easy to follow at a glance.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "timeline",
      headingStyle: "minimal",
      dateStyle: "under",
      bullets: "dash",
      skillsStyle: "tags",
      sections: defaultSections("timeline"),
    }),
  },
  banner: {
    description: "A coloured band across the top with your name and contact details. Bold, still one column.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "banner",
      header: { nameSize: 28 },
      headingStyle: "side-bar",
      skillsStyle: "tags",
      sections: defaultSections("banner"),
    }),
  },
  "modern-grid": {
    description: "Section titles in their own column on the left, content on the right. Calm and very easy to scan.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "modern-grid",
      headingStyle: "minimal",
      dateStyle: "under",
      header: { nameSize: 26 },
      sections: defaultSections("modern-grid"),
    }),
  },
  "sidebar-left": {
    description: "A coloured side panel for your photo, contact details, skills and languages.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "sidebar-left",
      headingStyle: "caps-rule",
      dateStyle: "under",
      skillsStyle: "lines",
      header: { nameSize: 26 },
      photo: "circle",
      sections: defaultSections("sidebar-left"),
    }),
  },
  "sidebar-right": {
    description: "Experience first on the left, with a side panel on the right for contact details and skills.",
    spec: withSpec(DEFAULT_SPEC, {
      layout: "sidebar-right",
      headingStyle: "underline",
      dateStyle: "right",
      skillsStyle: "tags",
      header: { nameSize: 26 },
      sections: defaultSections("sidebar-right"),
    }),
  },
};
