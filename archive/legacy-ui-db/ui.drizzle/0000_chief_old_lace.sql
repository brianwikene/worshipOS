CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_people_church" ON "people" USING btree ("church_id");--> statement-breakpoint
CREATE INDEX "idx_people_church_active" ON "people" USING btree ("church_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_people_display_name" ON "people" USING btree ("display_name");