# CV templates

Shortlist ships with 100 built-in CV templates, and people can make their own. Both kinds are the same thing: a **TemplateSpec**, a small JSON object. One renderer turns a spec plus a profile into the CV. That's why 100 templates stay maintainable, why a user's template works everywhere a built-in one does, and why the preview, the PDF and the gallery thumbnail always match.

Code:

| Path | What |
|---|---|
| `src/lib/templates/spec.ts` | The zod schema, types and defaults |
| `src/lib/templates/fonts.ts` | The font allowlist and its `next/font` loaders |
| `src/lib/templates/checks.ts` | ATS report, contrast, the ATS-safe twin and photo advice |
| `src/lib/templates/fit.ts` | Density steps for "fit to N pages" |
| `src/lib/templates/builtin/` | The 100 built-in templates, by family |
| `src/lib/templates/registry.ts` | Lookup by id, categories, filters and recommendations |
| `src/components/cv/cv-document.tsx` | The renderer |
| `src/lib/export/docx.ts` | The spec mapped onto Word |

## The spec

A spec contains nothing free-form. Every value is an enum, a 6-digit hex colour or a number within bounds, and it's validated with zod on every save. That means a spec can't inject CSS or HTML: see SECURITY.md.

```ts
type TemplateSpec = {
  version: 1;
  layout: Layout;            // one of the 10 engines below
  fonts: { heading: FontId; body: FontId };
  palette: {
    ink: Hex;                // body text
    accent: Hex;             // headings, rules, dots
    muted: Hex;              // dates, places
    rule: Hex;               // lines
    panel: Hex;              // sidebar or banner background
    panelInk: Hex;           // text on the panel
  };
  header: { align: "left" | "center"; nameSize: number /* 18–40pt */; nameCase: "normal" | "upper" };
  headingStyle: "underline" | "caps-rule" | "block" | "side-bar" | "minimal" | "numbered";
  bullets: "disc" | "dash" | "arrow" | "square" | "none";
  dateStyle: "right" | "under" | "left";
  skillsStyle: "inline" | "tags" | "columns" | "lines";
  density: { fontSize: number /* 9.5–12pt */; lineHeight: number /* 1.15–1.6 */; sectionGap: number /* 4–20pt */ };
  page: { size: "A4" | "Letter"; margin: number /* 10–25mm */ };
  photo: "off" | "circle" | "square" | "rounded";
  sidebarWidth: number;      // 26–40 (% of the page), for sidebar layouts
  sections: { id: SectionId; visible: boolean; column: "main" | "side" }[];
};
```

`SectionId` is one of `summary`, `experience`, `education`, `skills`, `projects`, `certifications` or `languages`. The name, headline, contact details and photo always go in the header (or at the top of the sidebar). The sections list must contain each id exactly once. Its order is the order on the page.

## The 10 layout engines

| Engine | What it looks like | Columns | ATS |
|---|---|---|---|
| `classic` | Name on top, sections down the page | 1 | Safe |
| `split-header` | Name and headline on the left, contact details on the right, a rule under them | 1 | Safe |
| `compact` | Tight spacing, with dates in a narrow left column | 1 | Safe |
| `executive` | A serif name with a double rule under it, and the summary as an opening statement | 1 | Safe |
| `academic` | Education first, dates on the left, built for long CVs | 1 | Safe |
| `timeline` | Experience along a vertical line with dots | 1 | Safe |
| `banner` | A coloured band across the top holding name, headline and contact details | 1 | Safe if the photo is off |
| `modern-grid` | Section titles in a left column and content on the right | 2 (labels) | Mostly safe |
| `sidebar-left` | A coloured side panel for photo, contact, skills and languages | 2 | Caution |
| `sidebar-right` | The same, with the panel on the right | 2 | Caution |

In every engine, the HTML order matches the reading order (header, then the main column, then the side column), and CSS only moves things on screen. Headings are real text and contact details are plain text, never icons only.

## ATS honesty
`atsReport(spec)` works out the label from the spec. It never relies on a hand-set flag, so custom templates get the same honest answer:

- **ATS-safe:** one-column engine and no photo.
- **Mostly safe:** `modern-grid`, or a photo on a one-column engine.
- **Caution:** a sidebar engine. Some ATS read two columns line by line across the page, which can mix up the order.

For anything not marked safe, "Same look, ATS-safe" (`atsTwin(spec)`) moves it to `classic` or `split-header`. It keeps the fonts, colours, headings and bullets, turns the photo off, and puts side sections back in the main column.

"What an ATS reads" shows the text taken from the rendered CV in reading order. Tests check that this text contains every fact in the profile, for all 100 templates.

## Photo advice
Photos are optional and off by default. If a template has a photo slot and the user hasn't added a photo, the slot doesn't show. The editor's advice depends on the profile's location and the job's location:

- **Gulf, much of Asia, and parts of Europe:** "A photo is common here."
- **US, UK, Canada, Australia and Ireland:** "Recruiters here usually prefer no photo, and some must ignore CVs that have one."

## Fit to N pages
`fitSteps(spec)` returns a list of progressively tighter densities: a smaller font size (down to 9.5pt), then less space between sections, then a smaller line height, then smaller margins (down to 12mm). The browser measures each step and picks the first that fits. Content is never cut. If nothing fits, it says so, so the user can shorten the content instead.

## Fonts
There are 15 families, self-hosted at build time with `next/font/google`, so no font requests go to Google from the browser. Each family is downloaded only when a CV uses it.

- **Sans:**
  - Inter
  - Source Sans 3
  - IBM Plex Sans
  - Work Sans
  - Manrope
  - DM Sans
  - Lato
  - Nunito Sans
- **Serif:**
  - Source Serif 4
  - Merriweather
  - Lora
  - EB Garamond
  - Libre Baskerville
  - Playfair Display (headings only)
- **Mono:** IBM Plex Mono (headings only)

Word downloads name the same font. If it isn't installed, Word uses the closest one it has.

## The 100 built-ins
- **Families.** The templates are made from 10 families, one per engine. Each family has hand-tuned defaults (`builtin/families.ts`), and each built-in is the family's defaults plus a few overrides: a name, palette, fonts, header and heading style, and density.
- **Ids.** Ids run from `sl-001` to `sl-100` and are **never renumbered or reused**, because users' jobs and defaults point to them. To retire a template, mark it `hidden: true`.
- **Categories.** There are 12, and a template can be in more than one:
  - ATS-safe essentials
  - Professional
  - Modern
  - Creative
  - Executive
  - Tech
  - Academic & research
  - First job & students
  - Healthcare & care
  - Hospitality & retail
  - Trades & operations
  - Photo-ready (Gulf & Asia)
- **Colour family** for filtering: navy, charcoal, blue, teal, green, burgundy, plum, terracotta, gold or mono.

### Adding a template
1. Add an entry to the family's file in `src/lib/templates/builtin/`, with the next free id.
2. Run `npm test`. Every built-in is validated, rendered with three fixture profiles, checked for missing text, and checked for contrast.
3. Run `npm run templates:thumbs` to make its thumbnail in `public/templates/`, and commit the image.

## Custom templates
- Anyone can open any template in the editor, change it and "Save as my template".
- Saved templates are stored in `cv_templates` with the user id, a name, the spec and the id of the template it was based on.
- They're private. Every read and write checks the owner.
- The limit is 50 per person.
- A user's default template is `profiles.default_template_id`. Each job can use a different one through `jobs.cv_style`.

## Word export
The Word file follows the spec as closely as Word allows:
- fonts, colours, sizes, heading style (as paragraph borders and shading), bullets and section order
- sidebar engines become a two-column table with a shaded side cell
- `banner` becomes a shaded first paragraph block

Word can't do the timeline dots, rounded photos or tag pills. Those become a plain line, a square photo and comma-separated skills.
