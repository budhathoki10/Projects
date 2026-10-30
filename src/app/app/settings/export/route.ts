import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/session";

/** Everything stored about the user, as JSON (right of access and portability). */
export async function GET() {
  const user = await requireUser();
  const [profile, jobs, documents, interviews, payments, templates, photo] = await Promise.all([
    db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)),
    db.select().from(schema.jobs).where(eq(schema.jobs.userId, user.id)),
    db.select().from(schema.documents).where(eq(schema.documents.userId, user.id)),
    db.select().from(schema.interviews).where(eq(schema.interviews.userId, user.id)),
    db.select({ provider: schema.payments.provider, status: schema.payments.status, amountMinor: schema.payments.amountMinor, currency: schema.payments.currency, days: schema.payments.days, createdAt: schema.payments.createdAt }).from(schema.payments).where(eq(schema.payments.userId, user.id)),
    db.select().from(schema.cvTemplates).where(eq(schema.cvTemplates.userId, user.id)),
    db.select().from(schema.profilePhotos).where(eq(schema.profilePhotos.userId, user.id)),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, createdAt: user.createdAt, passUntil: user.passUntil, weeklyGoal: user.weeklyGoal },
    profile: profile[0]?.data ?? null,
    defaultTemplateId: profile[0]?.defaultTemplateId ?? null,
    photo: photo[0] ? `data:image/webp;base64,${photo[0].image.toString("base64")}` : null,
    templates,
    jobs,
    documents,
    interviews,
    payments,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="shortlist-data.json"',
      "cache-control": "private, no-store",
    },
  });
}
