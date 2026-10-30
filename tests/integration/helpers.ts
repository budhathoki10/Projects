import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { shortId } from "@/lib/util";

export async function resetDb() {
  await db.execute(sql`truncate users, sessions, auth_tokens, payments, profiles, jobs, documents, interviews, usage cascade`);
}

export async function makeUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: `${shortId()}@example.com`, name: "Test User", passwordHash: "scrypt$00$00", ...overrides })
    .returning();
  return user;
}

export const DAY = 86_400_000;
