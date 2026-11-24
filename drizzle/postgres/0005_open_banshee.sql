CREATE TABLE "discoveredEventCandidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonicalUrl" varchar(1000) NOT NULL,
	"platform" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"eventDate" timestamp NOT NULL,
	"city" varchar(100) NOT NULL,
	"venueNameRaw" varchar(255),
	"matchedGenres" text[] DEFAULT '{}'::text[] NOT NULL,
	"flyerUrl" varchar(1000),
	"description" text,
	"sourceType" varchar(64) DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discoveredAt" timestamp DEFAULT now() NOT NULL,
	"reviewedAt" timestamp,
	CONSTRAINT "discoveredEventCandidates_canonicalUrl_unique" UNIQUE("canonicalUrl")
);
--> statement-breakpoint
CREATE INDEX "discovered_candidates_status_date_idx" ON "discoveredEventCandidates" USING btree ("status","eventDate");--> statement-breakpoint
CREATE INDEX "discovered_candidates_genre_idx" ON "discoveredEventCandidates" USING btree ("status","city");