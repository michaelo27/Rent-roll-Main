CREATE TABLE "rent_units" (
	"id" text PRIMARY KEY NOT NULL,
	"property" text NOT NULL,
	"unit_label" text NOT NULL,
	"tenant_name" text NOT NULL,
	"rent_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"due_date" text NOT NULL,
	"lease_end" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "rent_units" ("id", "property", "unit_label", "tenant_name", "rent_cents", "paid_cents", "due_date", "lease_end") VALUES
('unit-1a', 'Willow Court', '1A', 'Amelia Chen', 185000, 185000, '2026-11-01', '2027-05-31'),
('unit-1b', 'Willow Court', '1B', 'Marcus Reed', 142500, 142500, '2026-11-01', '2027-03-31'),
('unit-2a', 'Willow Court', '2A', 'Priya Shah', 210000, 210000, '2026-11-01', '2027-08-31'),
('unit-2b', 'Willow Court', '2B', 'Noah Williams', 167500, 167500, '2026-11-01', '2027-06-30'),
('unit-3a', 'Maple House', '3A', 'Sofia Garcia', 195000, 195000, '2026-11-01', '2027-04-30'),
('unit-3b', 'Maple House', '3B', 'Ethan Brooks', 160000, 90000, '2026-11-01', '2027-07-31'),
('unit-4a', 'Maple House', '4A', 'Olivia Martin', 185000, 0, '2026-11-01', '2027-02-28'),
('unit-4b', 'Maple House', '4B', 'James Wilson', 170000, 0, '2026-11-01', '2026-11-30');
