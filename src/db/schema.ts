import { customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { InterviewQuestion, JobPost, Match, Profile, TailoredCv } from "@/lib/model/types";
import type { TemplateSpec } from "@/lib/templates/spec";
import type { CvStyle } from "@/lib/templates/style";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  // A Job-hunt pass is valid until this moment. Null means never bought one.
  passUntil: timestamp("pass_until", { withTimezone: true }),
  // Applications they aim to send each week, for the goal ring on Today.
  weeklyGoal: integer("weekly_goal").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token; the raw token never touches the database.
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** One-time tokens sent by email (password reset, email verification). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_purpose_idx").on(t.userId, t.purpose, t.createdAt)],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  // Paddle transaction id or Khalti pidx; unique so webhooks are idempotent.
  providerRef: text("provider_ref").notNull().unique(),
  status: text("status").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  // How many days of access this payment buys (30 or 90).
  days: integer("days").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The user's CV as structured data. Every tailored version is built from this and nothing else. */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Profile>().notNull(),
  // A built-in id ("sl-001") or one of their own cv_templates ids. Null means the default.
  defaultTemplateId: text("default_template_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Profile photo, re-encoded to WebP without metadata. Served only to its owner. */
export const profilePhotos = pgTable("profile_photos", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  image: bytea("image").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Templates people made themselves. Private to their owner. */
export const cvTemplates = pgTable(
  "cv_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    basedOn: text("based_on"),
    spec: jsonb("spec").$type<TemplateSpec>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cv_templates_user_idx").on(t.userId, t.updatedAt)],
);

/** A job the user is considering, with what we read from the post. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url"),
    postText: text("post_text").notNull(),
    post: jsonb("post").$type<JobPost>().notNull(),
    match: jsonb("match").$type<Match>(),
    // saved | applied | interview | offer | rejected
    status: text("status").notNull().default("saved"),
    appliedOn: date("applied_on", { mode: "string" }),
    followUpOn: date("follow_up_on", { mode: "string" }),
    interviewOn: date("interview_on", { mode: "string" }),
    notes: text("notes"),
    // Which template this job's CV uses, and any fit-to-page tightening. Null means the default.
    cvStyle: jsonb("cv_style").$type<CvStyle>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_user_updated_idx").on(t.userId, t.updatedAt)],
);

/** Documents written for one job. One tailored CV and one cover letter per job; edits replace them. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    // cv | cover_letter
    kind: text("kind").notNull(),
    cv: jsonb("cv").$type<TailoredCv>(),
    text: text("text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_job_kind_idx").on(t.jobId, t.kind)],
);

export const interviews = pgTable("interviews", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questions: jsonb("questions").$type<InterviewQuestion[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AI actions per user per calendar month (UTC), for plan limits. */
export const usage = pgTable(
  "usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    // tailor | cover | interview | import
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month, t.kind] })],
);

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Document = typeof documents.$inferSelect;

export type CvTemplateRow = typeof cvTemplates.$inferSelect;
