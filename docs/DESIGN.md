# Design

## The idea
**Paper, navy ink and a highlighter.** Shortlist should feel like a calm, well-made notebook, not a noisy SaaS dashboard.

- Navy ink is for actions.
- The lime highlighter marks what you already have.
- Red pen marks a real gap.
- Green means something went well.

The CVs are the colourful part, so the app around them stays quiet.

## Tokens
All colours are CSS variables on `:root` in `src/app/globals.css`, with a dark set under `prefers-color-scheme: dark`. Tailwind reads them through `@theme inline`, so classes are `bg-surface`, `text-muted`, `border-border` and so on. Never use raw hex values in components.

| Token | Light | Use |
|---|---|---|
| `background` | `#f6f4ef` | Page |
| `surface` | `#fffefb` | Cards, inputs, sidebar |
| `foreground` | `#1b1a17` | Text |
| `muted` | `#6e695f` | Secondary text |
| `faint` | `#726e68` | Placeholders, minor notes (still 4.5:1 on the page) |
| `border` / `strong-border` | `#e3dfd5` / `#c9c3b6` | Lines |
| `ink` / `ink-hover` / `on-ink` | `#1d2740` / `#2f3d60` / `#fffefb` | Primary buttons, active nav |
| `highlight` | `#e6f4a0` | "You have this", the logo check, the active marker |
| `pen` / `pen-soft` | `#b0321c` / `#f8e6e1` | Gaps, errors, destructive actions |
| `money` / `money-soft` | `#2d6a3e` / `#e3efe5` | Success, offers, a good match |

The CV page is **always white with its own colours**, in dark mode too. It's a document, not app chrome.

- **Spacing:** a 4px base, with layouts on an 8px rhythm (8, 16, 24, 32, 48, 64).
- **Radius:**
  - 6px for inputs and buttons
  - 10px for cards
  - 14px for dialogs
  - full for pills
- **Elevation:**
  - 0: border only, for most cards
  - 1: `0 1px 2px rgb(0 0 0 / .05)`, for raised cards on hover
  - 2: `0 8px 24px rgb(0 0 0 / .10)`, for popovers and the command bar
  - 3: `0 24px 64px rgb(0 0 0 / .18)`, for dialogs
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
- **Sidebar** (240px, `surface`):
  - Logo, then the main nav: Today, Jobs, CV Studio, Interview prep and Progress.
  - The active item has an ink bar on the left and a soft highlight. Today shows a count badge when follow-ups are due.
  - At the bottom: a pass card ("Free plan · 2 of 3 CVs left · Get a pass", or "Pass · 12 days left"), then Settings and the account.
- **Top bar:** breadcrumb or page title, the search button (opens ⌘K), the primary "Add job" button and the account menu (email, Billing, Settings, Log out).
- **Below 1024px:** the sidebar collapses to icons only (72px).
- **Below 768px:** there's no sidebar. A bottom tab bar has Today, Jobs, Studio and More, and a round "Add job" button floats above it on the right. The top bar shows only the title and search.
- The email-confirmation banner sits at the top of the content area, not above the whole shell.

## Page anatomy
Every app page has an eyebrow (small caps, muted), a serif title, a one-line explanation in muted text, and then the content. One primary action per page, top right. Empty states always say what to do next and show the button for it.

### Today
1. Greeting and date.
2. **Next best action:** one large card with one sentence and one button. It picks the most useful thing in this order:
   1. add your CV
   2. practise for an interview in the next 3 days
   3. a follow-up that's due
   4. tailor a saved job
   5. add jobs to reach the weekly goal
   6. "You're on track"
3. **KPI row:** applied this week, waiting to hear, interviews and response rate. Each has an 8-week sparkline.
4. A two-column grid:
   - **Left:** follow-ups due, then upcoming interviews.
   - **Right:** the weekly goal ring, the mini pipeline (a count per stage, each linking to the filtered board), then the CV strength meter.
5. On a phone, the same blocks stack in that order.

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
- Everything works with a keyboard, focus is visible (`outline: 2px solid var(--ink)`), and each page has one `h1`.
- Every input has a `<label>`. Hints are linked with `aria-describedby`.
- Colour is never the only signal. Match states have text ("Shown in your work").
- Contrast is AA or better in both themes. Template palettes are checked too.
- Dialogs trap focus and close with Escape. The command bar is a `role="dialog"` with a listbox.
- The e2e suite runs axe on the main pages.

## Writing
Short, plain sentences in the second person ("your CV"), with sentence case for every label.

- No em dashes, hype or filler ("seamless", "unlock", "supercharge", "elevate", "leverage").
- Say what happened and what to do next: "We couldn't read that page. Paste the job text instead."
- Numbers are digits: "3 tailored CVs a month".
