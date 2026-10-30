CREATE TABLE "cv_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"based_on" text,
	"spec" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_photos" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "interview_on" date;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cv_style" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_template_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weekly_goal" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_templates" ADD CONSTRAINT "cv_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_templates_user_idx" ON "cv_templates" USING btree ("user_id","updated_at");