ALTER TABLE "rent_settings" ADD COLUMN "weekly_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_settings" ADD COLUMN "last_prepared_at" text DEFAULT '' NOT NULL;
--> statement-breakpoint
INSERT INTO "rent_settings" ("id", "landlord_name", "currency_symbol", "date_format", "timezone", "week_start", "auto_match", "friendly_days", "firm_days", "formal_days", "friendly_template", "firm_template", "formal_template", "schedule_enabled", "weekly_note", "last_prepared_at") VALUES
('default', 'Jordan Miller', '$', 'MMM d, yyyy', 'America/Los_Angeles', 'Monday', true, 3, 7, 14,
'Hi {tenantName}, just a friendly note that {amount} for {unit} was due on {dueDate}. Please let me know if you have already sent it. Thank you, {landlordName}',
'Hi {tenantName}, {amount} for {unit} is still outstanding, {daysLate} days after the due date. Please reply with an update when you can. Thank you, {landlordName}',
'Hi {tenantName}, our records show {amount} remains due for {unit}, originally due {dueDate}. Please contact me to discuss next steps. {landlordName}',
true, '', '');
