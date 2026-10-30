@AGENTS.md

# Shortlist

A job-hunt helper for anyone. Read these before changing anything:

- `docs/ROADMAP.md`: what's done, what's next, and the definition of done. Tick its boxes as work lands.
- `docs/PRODUCT.md`: features and principles.
- `docs/ARCHITECTURE.md`: modules, data model and flows.
- `docs/DESIGN.md`: tokens, app shell, page layouts and writing rules.
- `docs/TEMPLATES.md`: the CV template spec, engines and built-ins.
- `SECURITY.md` and `TESTING.md`.

## Rules that never bend
1. **Nothing made up.** Every fact in a CV, letter or answer comes from the user's profile. AI output goes through `unsupportedFacts` and is only used once the user accepts it.
2. **Every query is scoped by user id.** Pages and actions use `src/lib/services/*`, never raw queries.
3. **Template specs hold only enums, hex colours and bounded numbers.** Never put free text into CSS.
4. **Never hold users' money.** Payments go through Paddle or Khalti.
5. **Plain copy.** Short sentences, sentence case, no em dashes, no hype words.
6. **Built-in template ids (`sl-NNN`) are never renumbered or reused.**

## Commands
- `npm run dev`
- `npm run test:all` (lint, typecheck, unit, integration, e2e)
- `npm run db:generate`, then `npm run db:migrate` after a schema change
- `npm run templates:thumbs` after adding or changing a built-in template
