CREATE TABLE "engagementEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventType" varchar(64) NOT NULL,
	"eventId" integer,
	"venueSlug" varchar(180),
	"channel" varchar(32),
	"source" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "engagement_events_created_at_idx" ON "engagementEvents" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "engagement_events_event_idx" ON "engagementEvents" USING btree ("eventId","eventType");--> statement-breakpoint
CREATE INDEX "engagement_events_venue_idx" ON "engagementEvents" USING btree ("venueSlug","eventType");