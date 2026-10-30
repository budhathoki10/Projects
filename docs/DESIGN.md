# Design

## The idea
**Quiet neutrals, one meaningful colour.** Shortlist is a tool people use while they're anxious about money and work, so the interface stays calm: warm greys do almost all the work, and the one brand colour, **jade**, means "shortlisted": you have this, it went well, this is where you are. The CVs are the colourful part, so the app around them stays out of the way.

What we avoid, because it makes an app look generated rather than designed:
- neon accents
- gradients and glow blobs
- tinted "paper" backgrounds
- a colour for every card
- raw hex values in components

## Colour

### Scales
Four 12-step scales from Radix Colors (MIT) are generated into `src/app/colors.css` by `scripts/gen-colors.mts`. Each has a light and a dark version, and dark switches with `prefers-color-scheme`.

| Scale | Role |
|---|---|
| `sand` | Neutrals: backgrounds, text, borders, the primary button |
| `jade` | Brand and success |
| `tomato` | Danger, real gaps, errors |
| `amber` | Notices and warnings |

Every scale uses its steps the same way:
- **1–2:** page and panel backgrounds
- **3–5:** component fills
- **6–8:** borders
- **9–10:** solid colour
- **11:** secondary text
- **12:** high-contrast text

### Semantic tokens
Components only use these, through Tailwind (`bg-surface`, `text-muted`, `border-border` and so on). They're defined in `src/app/globals.css`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | sand-1 | sand-1 | Page |
| `surface` | white | sand-2 | Cards, inputs, menus |
| `panel` | sand-2 | sand-1 | Sidebar, table headers, quiet boxes |
| `subtle` / `subtle-hover` | sand-3 / sand-4 | same | Hover fills, chips, preview backdrops |
| `foreground` | sand-12 | sand-12 | Text |
| `muted` | sand-11 | sand-11 | Secondary text |
| `faint` | sand-10 | sand-10 | Icons and placeholders only, never body text |
| `border` / `strong-border` / `hover-border` | sand-6 / 7 / 8 | same | Lines |
| `ink` / `ink-hover` / `on-ink` | sand-12 / 11 / 1 | same | The primary button (near-black, or near-white in dark) |
| `brand` | jade-10 | jade-9 | Logo, active-nav bar, focus ring, progress, rings, sparkline |
| `brand-soft` / `brand-border` / `brand-strong` | jade-3 / 7 / 12 | same | Selected states and brand chips |
| `highlight` | jade-4 | jade-5 | "You have this" marker, text selection |
| `money` / `money-soft` / `money-strong` | jade-11 / 3 / 12 | same | Success: a good match, an offer, "saved" |
| `pen` / `pen-soft` / `pen-border` / `pen-strong` | tomato-11 / 3 / 7 / 12 | same | Real gaps, errors, delete |
| `notice` / `notice-soft` / `notice-border` / `notice-strong` | amber-11 / 2 / 6 / 12 | same | The confirm-email banner, warnings, "harder for some ATS" |
| `paper` / `paper-ink` | white / sand-12 | same | CV pages: always white with dark ink |
| `scrim` | sand-12 at 40% | black at 60% | Behind dialogs |

### Rules
1. **Neutrals first.** About 90% of any screen is sand.
2. **Jade means something.** Use it for the brand mark, the current place (active nav, active tab), focus, progress and success. Never use it to decorate.
3. **Status colours are only for status.** Tomato is a real problem and amber is "check this". Neither is used for emphasis.
4. **One primary action per view.** It's the near-black `ink` button. Everything else is secondary (bordered) or a text link.
5. **Text on a tint uses step 12** (`*-strong`), so small text stays above 4.5:1. Coloured text on white or the page uses step 11.
6. **No raw colours in components.** `tests/palette.test.ts` fails if a hex value, `bg-white`, `bg-black` or `blur-` appears outside the CV renderer.
7. **Contrast is tested, in both themes,** for every text pair (see `tests/palette.test.ts`), and axe checks the main pages in the browser tests.

### Radius and elevation
- **Radius:**
  - 6px for badges
  - 8px (`rounded-lg`) for buttons and inputs
  - 12px (`rounded-xl`) for cards
  - 16px (`rounded-2xl`) for dialogs and sheets
  - full for avatars and pills
- **Elevation:**
  - `shadow-1` for resting cards and buttons
  - `shadow-2` for popovers, menus and hovered cards
  - `shadow-3` for dialogs and the floating button

  All three are tinted with sand-12, never pure black, in light mode.

### Spacing, type and motion
- **Spacing:** a 4px base, with layouts on an 8px rhythm (8, 16, 24, 32, 48, 64).
- **Type:**
  - Headings use Newsreader (serif).
  - Interface text uses Geist (sans), and numbers use Geist Mono.
  - Scale: 12, 13, 14 (body), 16, 20, 24, 32, 44.
  - Text runs at most about 70 characters per line.
- **Motion:** 120–180ms ease-out for hovers, menus and dialogs, and nothing that bounces. `prefers-reduced-motion` turns transitions off.

## App shell
```
┌───────────┬──────────────────────────────────────────────────────┐
│ ✓Shortlist│ Page title / breadcrumb      [⌘K Search]  [+ Add job] (A)│  ← top bar, 56px
│           ├──────────────────────────────────────────────────────┤
│ Today   ● │                                                      │
│ Jobs      │                     page content                     │
│ CV Studio │                  (max width 1200px,                  │
│ Interview │                   24–32px padding)                   │
│ Progress  │                                                      │
│           │                                                      │
│ ┌───────┐ │                                                      │
│ │Pass:  │ │                                                      │
│ │12 days│ │                                                      │
│ └───────┘ │                                                      │
│ Settings  │                                                      │
└───────────┴──────────────────────────────────────────────────────┘
   240px
```
- **Sidebar** (240px, `panel`):
  - Logo, then the main nav: Today, Jobs, CV Studio, Interview prep and Progress.
  - The active item is a quiet `subtle` fill with medium-weight text. Today shows a plain count when follow-ups are due.
  - At the bottom: a plain plan note ("Free plan · 2 of 3 CVs left", then "Upgrade", or "Job-hunt pass · 12 days left"), then Settings. There's no box and no progress bar.
- **Top bar:** the search button (opens ⌘K), the primary "Add job" button and the account menu (email, Billing, Settings, Log out). On desktop the page title isn't repeated here; it only shows on phones.
- **Below 1024px:** the sidebar collapses to icons only (72px).
- **Below 768px:** there's no sidebar. A bottom tab bar has Today, Jobs, Studio and More, and a round "Add job" button floats above it on the right. The top bar shows only the title and search.
- The email-confirmation banner sits at the top of the content area, not above the whole shell.

## Page anatomy
Every app page starts with `PageHeader` (`src/components/page-header.tsx`): a plain semibold title (26px), an optional muted line under it, and the page's actions on the right. Sections use `SectionHeading`, a 15px semibold heading in sentence case.

- **No uppercase eyebrows.** `Eyebrow` is now a quiet 13px label.
- **One typeface in the app.** Geist only, with tabular numbers instead of monospace. The serif is kept for the logo, the marketing and legal pages, and CV templates.
- **Lists and dividers before cards.** A box is only used when it holds a form, a preview or a list.
- **One primary action per page.** Empty states always say what to do next and show the button for it.

### Today
A to-do list first, numbers second, in one column about 760px wide.
1. **Header:**
   - "Today" and the date on the left.
   - On the right, "This week ■■□□□ 2 of 5" with "Change goal".
2. **Up next:** up to 5 real next steps from `nextSteps()` in `src/lib/today.ts`, in this order:
   1. add a CV
   2. interviews in the next 3 days
   3. follow-ups that are due
   4. saved jobs to tailor
   5. CV fixes, when the strength is under 85
   6. the weekly goal

   Each row has an open circle, a title, a muted detail and one action. Only the first row's button is solid. If there's nothing to do, it says "You're all caught up."
3. **Your search:** clickable counts per stage, one segmented bar, the response rate, how many are waiting, and a tiny 8-week bar row.
4. **Coming up:** booked interviews by date. Shown only when there are some.
5. **Recent jobs:** a plain list showing title, company, stage and match.

Not on Today: KPI tiles, donut rings, sparkline cards, greetings, usage counters (those are in the sidebar and on Billing) or icon chips.

### Jobs
Add a job (a link, or paste the text) at the top, then a toggle between Board and Table.

- **Board:** five columns. Cards can be dragged between stages on desktop. Every card also has a status menu, which is the keyboard and touch way to move it.
- **Table:** sortable by match, date added or date applied.

### Job detail
Title, company, place and salary, with the status control on the right. Then the tabs: Match, Tailored CV, Cover letter and Interview prep.

The Tailored CV tab has:
- the change list on the left
- the live CV in the chosen template on the right, with a "Change look" button
- a "try-on" strip showing three recommended templates

### CV Studio
- **Studio home:** your CV's strength meter, your default template, My templates, and recommended templates.
- **Gallery:**
  - Filters on the left: category, ATS label, columns, photo and colour family. On a phone they open in a sheet.
  - A grid of thumbnails (3–4 across on desktop, 2 on a phone).
  - Each card has the name, the ATS label and the categories.
  - Clicking opens a large preview with your own CV, plus "Use as default", "Use for a job…" and "Customise".
- **Editor:** a three-pane layout.
  - Controls (320px).
  - The page preview in the centre, with zoom, page-break lines and a page count.
  - Checks (280px).
  - On a phone the controls are a bottom sheet and the checks sit under the preview.
  - The toolbar has the name, undo, redo, "Fit to 1 page", "What an ATS reads" and Save.

## Components
`src/components/ui.tsx` holds Button (primary, secondary, ghost, danger), Card, Field, Input, Textarea, Select, Badge, Notice (info, success, warning, error), EmptyState, Logo and Eyebrow. Use these before writing new markup.

## Accessibility
- Everything works with a keyboard, focus is visible (a 2px jade `brand` outline), and each page has one `h1`.
- Every input has a `<label>`. Hints are linked with `aria-describedby`.
- Colour is never the only signal. Match states have text ("Shown in your work").
- Contrast is AA or better in both themes. It's tested for every token pair and for every template palette.
- Dialogs trap focus and close with Escape. The command bar is a `role="dialog"` with a listbox.
- The e2e suite runs axe on the main pages.

## Writing
Short, plain sentences in the second person ("your CV"), with sentence case for every label.

- No em dashes, hype or filler ("seamless", "unlock", "supercharge", "elevate", "leverage").
- Say what happened and what to do next: "We couldn't read that page. Paste the job text instead."
- Numbers are digits: "3 tailored CVs a month".
