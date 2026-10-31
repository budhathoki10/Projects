import { z } from "zod";
import type { Fit } from "./fit";
import { LIMITS } from "./spec";

/** What a job's CV looks like: a template, plus any "fit to N pages" tightening chosen for it. */
export type CvStyle = { templateId: string; fit: Fit | null };

const within = ([min, max]: readonly [number, number]) => z.number().finite().min(min).max(max);

export const fitSchema = z.object({
  density: z.object({ fontSize: within(LIMITS.fontSize), lineHeight: within(LIMITS.lineHeight), sectionGap: within(LIMITS.sectionGap) }),
  margin: within(LIMITS.margin),
});

/** A built-in id ("sl-001") or a uuid for one of the user's own templates. */
export const templateIdSchema = z.string().regex(/^(sl-\d{3}|[0-9a-f-]{36})$/i);

export const cvStyleSchema = z.object({ templateId: templateIdSchema, fit: fitSchema.nullable() });
