CREATE TABLE "push_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispatchType" varchar(32) NOT NULL,
	"title" varchar(120) NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"expired" integer DEFAULT 0 NOT NULL,
	"errorMessage" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "userId" integer;--> statement-breakpoint
CREATE INDEX "push_dispatches_created_idx" ON "push_dispatches" USING btree ("createdAt");