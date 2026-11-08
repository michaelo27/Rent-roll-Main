CREATE TABLE "lease_history" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"tenant_name" text NOT NULL,
	"rent_cents" integer NOT NULL,
	"due_date" text NOT NULL,
	"lease_end" text NOT NULL,
	"recorded_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lease_history" ADD CONSTRAINT "lease_history_unit_id_rent_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rent_units"("id") ON DELETE no action ON UPDATE no action;