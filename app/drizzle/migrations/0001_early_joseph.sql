CREATE TABLE "activity_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"transaction_id" text,
	"created_at" text NOT NULL,
	"undone" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"bank_name" text DEFAULT 'Bank statement' NOT NULL,
	"imported_at" text NOT NULL,
	"row_count" integer NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"transaction_date" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text DEFAULT 'unplaced' NOT NULL,
	"unit_id" text,
	"match_reason" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"stage" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"days_late" integer NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'to-send' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"landlord_name" text DEFAULT '' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"date_format" text DEFAULT 'MMM d, yyyy' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"week_start" text DEFAULT 'Monday' NOT NULL,
	"auto_match" boolean DEFAULT true NOT NULL,
	"friendly_days" integer DEFAULT 3 NOT NULL,
	"firm_days" integer DEFAULT 7 NOT NULL,
	"formal_days" integer DEFAULT 14 NOT NULL,
	"friendly_template" text NOT NULL,
	"firm_template" text NOT NULL,
	"formal_template" text NOT NULL,
	"schedule_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_message" text NOT NULL,
	"category" text DEFAULT 'Needs review' NOT NULL,
	"urgency" text DEFAULT 'Routine' NOT NULL,
	"suggested_reply" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rent_units" ADD COLUMN "tenant_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_import_id_bank_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_unit_id_rent_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rent_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_unit_id_rent_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rent_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_drafts" ADD CONSTRAINT "reminder_drafts_unit_id_rent_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rent_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_fingerprint_idx" ON "bank_transactions" USING btree ("fingerprint");