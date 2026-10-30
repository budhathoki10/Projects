import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Job } from "@/db/schema";
import { applyFit, type Fit } from "@/lib/templates/fit";
import { DEFAULT_TEMPLATE_ID, getBuiltin, isBuiltinId } from "@/lib/templates/registry";
import { parseSpec, type TemplateSpec } from "@/lib/templates/spec";
import type { CvStyle } from "@/lib/templates/style";

/** Most templates one person can keep. */
export const MAX_TEMPLATES = 50;
export const MAX_TEMPLATE_NAME = 60;

export type ResolvedTemplate = { id: string; name: string; spec: TemplateSpec; builtin: boolean; basedOn: string | null };

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** A built-in template, or one of this user's own. Anyone else's template doesn't exist for them. */
export async function getTemplate(userId: string, id: string | null | undefined): Promise<ResolvedTemplate | null> {
  if (!id) return null;
  if (isBuiltinId(id)) {
    const t = getBuiltin(id);
    return t ? { id: t.id, name: t.name, spec: t.spec, builtin: true, basedOn: null } : null;
  }
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(schema.cvTemplates)
    .where(and(eq(schema.cvTemplates.id, id), eq(schema.cvTemplates.userId, userId)))
    .limit(1);
  // Re-validate on the way out too: the database is not trusted to hold a safe spec.
  const spec = row && parseSpec(row.spec);
  return row && spec ? { id: row.id, name: row.name, spec, builtin: false, basedOn: row.basedOn } : null;
}

export function listMyTemplates(userId: string) {
  return db.select().from(schema.cvTemplates).where(eq(schema.cvTemplates.userId, userId)).orderBy(desc(schema.cvTemplates.updatedAt));
}

export async function countMyTemplates(userId: string) {
  const [row] = await db.select({ n: count() }).from(schema.cvTemplates).where(eq(schema.cvTemplates.userId, userId));
  return row?.n ?? 0;
}

export class TemplateLimitError extends Error {}

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, MAX_TEMPLATE_NAME) || "My template";

/**
 * Save a template: updates one of theirs when `id` is given, otherwise creates a new one.
 * The spec must already be validated. Creating fails past MAX_TEMPLATES.
 */
export async function saveTemplate(userId: string, input: { id?: string | null; name: string; spec: TemplateSpec; basedOn?: string | null }) {
  const name = cleanName(input.name);
  if (input.id) {
    const [row] = await db
      .update(schema.cvTemplates)
      .set({ name, spec: input.spec, updatedAt: new Date() })
      .where(and(eq(schema.cvTemplates.id, input.id), eq(schema.cvTemplates.userId, userId)))
      .returning();
    return row ?? null;
  }
  // Count and insert in one statement, so two saves at once can't pass the limit.
  const rows = await db.execute<{ id: string }>(sql`
    insert into cv_templates (user_id, name, based_on, spec)
    select ${userId}, ${name}, ${input.basedOn ?? null}, ${JSON.stringify(input.spec)}::jsonb
    where (select count(*) from cv_templates where user_id = ${userId}) < ${MAX_TEMPLATES}
    returning id`);
  const id = rows[0]?.id;
  if (!id) throw new TemplateLimitError(`You can keep up to ${MAX_TEMPLATES} templates. Delete one to make room.`);
  const [row] = await db.select().from(schema.cvTemplates).where(eq(schema.cvTemplates.id, id));
  return row;
}

export async function renameTemplate(userId: string, id: string, name: string) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .update(schema.cvTemplates)
    .set({ name: cleanName(name), updatedAt: new Date() })
    .where(and(eq(schema.cvTemplates.id, id), eq(schema.cvTemplates.userId, userId)))
    .returning();
  return row ?? null;
}

/** Delete one of theirs. Jobs and the default that used it fall back to the default template. */
export async function deleteTemplate(userId: string, id: string) {
  if (!isUuid(id)) return false;
  const deleted = await db
    .delete(schema.cvTemplates)
    .where(and(eq(schema.cvTemplates.id, id), eq(schema.cvTemplates.userId, userId)))
    .returning({ id: schema.cvTemplates.id });
  if (!deleted.length) return false;
  await db
    .update(schema.profiles)
    .set({ defaultTemplateId: null })
    .where(and(eq(schema.profiles.userId, userId), eq(schema.profiles.defaultTemplateId, id)));
  await db
    .update(schema.jobs)
    .set({ cvStyle: null })
    .where(and(eq(schema.jobs.userId, userId), sql`${schema.jobs.cvStyle}->>'templateId' = ${id}`));
  return true;
}

/** Only templates they can see can be chosen; anything else is refused. */
export async function setDefaultTemplate(userId: string, id: string) {
  if (!(await getTemplate(userId, id))) return false;
  const updated = await db
    .update(schema.profiles)
    .set({ defaultTemplateId: id })
    .where(eq(schema.profiles.userId, userId))
    .returning({ userId: schema.profiles.userId });
  return updated.length > 0;
}

export async function getDefaultTemplateId(userId: string) {
  const [row] = await db.select({ id: schema.profiles.defaultTemplateId }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
  return row?.id ?? null;
}

export async function setJobStyle(userId: string, jobId: string, style: CvStyle | null) {
  if (style && !(await getTemplate(userId, style.templateId))) return false;
  const updated = await db
    .update(schema.jobs)
    .set({ cvStyle: style })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)))
    .returning({ id: schema.jobs.id });
  return updated.length > 0;
}

/**
 * The template and final spec for a CV: the job's choice, else their default, else Classic.
 * A choice that no longer resolves for this user (deleted, or someone else's) falls back quietly.
 */
export async function resolveCvStyle(userId: string, job?: Pick<Job, "cvStyle"> | null): Promise<{ template: ResolvedTemplate; spec: TemplateSpec; fit: Fit | null }> {
  const candidates = [job?.cvStyle?.templateId, await getDefaultTemplateId(userId), DEFAULT_TEMPLATE_ID];
  for (const id of candidates) {
    const template = await getTemplate(userId, id);
    if (template) {
      const fit = job?.cvStyle && job.cvStyle.templateId === template.id ? job.cvStyle.fit : null;
      return { template, spec: applyFit(template.spec, fit), fit };
    }
  }
  throw new Error("The default template is missing");
}
